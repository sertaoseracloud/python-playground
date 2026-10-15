"""Structured Streaming do DivergePython: janelas de tempo, fontes, micro-lotes no relógio virtual,
estado, marca d'água e as saídas console e memory."""
import datetime as dt
import os

import pytest

from diverge_runtime import estagios, relogio
from pyspark.errors import AnalysisException, IllegalArgumentException, StreamingQueryException
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

T0 = dt.datetime(2026, 1, 1)


def m(minutos):
    """T0 mais tantos minutos (sem fuso, como o Spark devolve os timestamps)."""
    return T0 + dt.timedelta(minutes=minutos)


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def eventos(spark, *minutos):
    return spark.createDataFrame([(m(x), i) for i, x in enumerate(minutos)], 'momento TIMESTAMP, v INT')


def janelas(df):
    return sorted((r.window.start, r.window.end, r['count']) for r in df.collect())


def test_window_fixa(spark):
    agrupado = eventos(spark, 1, 4, 12).groupBy(F.window('momento', '10 minutes')).count()
    assert agrupado.columns == ['window', 'count']
    assert agrupado.dtypes[0] == ('window', 'struct<start:timestamp,end:timestamp>')
    assert janelas(agrupado) == [(m(0), m(10), 2), (m(10), m(20), 1)]


def test_window_deslizante_poe_a_linha_em_varias_janelas(spark):
    agrupado = eventos(spark, 1, 4, 12).groupBy(F.window('momento', '10 minutes', '5 minutes')).count()
    assert janelas(agrupado) == [(m(-5), m(5), 2), (m(0), m(10), 2), (m(5), m(15), 1), (m(10), m(20), 1)]


def test_window_com_inicio_e_outra_chave(spark):
    df = eventos(spark, 1, 4, 12).withColumn('estacao', F.lit('Crato'))
    r = df.groupBy('estacao', F.window('momento', '10 minutes', startTime='2 minutes')).count().collect()
    assert sorted((x.estacao, x.window.start, x['count']) for x in r) == [
        ('Crato', m(-8), 1), ('Crato', m(2), 1), ('Crato', m(12), 1)]


def test_duracao_invalida(spark):
    with pytest.raises(IllegalArgumentException, match='did not correspond to a valid interval string'):
        F.window('momento', 'dez minutos')
    with pytest.raises(IllegalArgumentException, match='slide duration'):
        F.window('momento', '5 minutes', '10 minutes')
    assert F.duracao_em_micros('interval 1 hour 30 minutes') == 90 * 60 * 10**6


def test_janela_deslizante_fora_do_groupby_explica(spark):
    with pytest.raises(NotImplementedError, match='groupBy'):
        eventos(spark, 1).select(F.window('momento', '10 minutes', '5 minutes')).collect()


def test_current_timestamp_le_o_relogio_virtual_no_streaming(spark):
    df = spark.range(1).select(F.current_timestamp().alias('agora'), F.current_date().alias('hoje'), F.now().alias('n'))
    with relogio.virtual():
        relogio.avancar(90)
        assert tuple(df.first()) == (m(1.5), dt.date(2026, 1, 1), m(1.5))
        assert relogio.agora_local() == m(1.5)
    assert abs(df.first().agora - dt.datetime.now()) < dt.timedelta(minutes=5)  # fora: a hora real
    assert relogio.iso(m(10)) == '2026-01-01T00:10:00.000Z'
    assert relogio.iso(relogio.agora()) == '2026-01-01T00:01:30.000Z'


CABECALHO = 'estacao,momento,temperatura\n'
SCHEMA = 'estacao STRING, momento TIMESTAMP, temperatura DOUBLE'
LOTES = {
    'lote-01.csv': ['Crato,2026-01-01 00:01:00,31.5', 'Sobral,2026-01-01 00:04:00,29.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-02.csv': ['Petrolina,2026-01-01 00:25:00,35.0', 'Crato,2026-01-01 00:03:00,30.0'],
    'lote-03.csv': ['Sobral,2026-01-01 00:41:00,28.0', 'Crato,2026-01-01 00:05:00,32.0'],
}


def gravar(nome, linhas, pasta='leituras'):
    os.makedirs(pasta, exist_ok=True)
    with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
        f.write(CABECALHO + ''.join(x + '\n' for x in linhas))


@pytest.fixture
def pasta(spark):
    for nome, linhas in LOTES.items():
        gravar(nome, linhas)
    return 'leituras'


def leituras(spark, maximo=1):
    leitor = spark.readStream.schema(SCHEMA)
    if maximo:
        leitor = leitor.option('maxFilesPerTrigger', maximo)
    return leitor.csv('leituras', header=True)


def test_readstream_le_a_pasta_com_schema(spark, pasta):
    df = leituras(spark)
    assert df.isStreaming and not spark.range(1).isStreaming
    assert df.dtypes == [('estacao', 'string'), ('momento', 'timestamp'), ('temperatura', 'double')]
    assert 'StreamingRelation csv' in '\n'.join(df._arvore())


def test_csv_e_json_sem_schema_dao_o_erro_do_spark(spark, pasta):
    for ler in (lambda: spark.readStream.csv(pasta, header=True), lambda: spark.readStream.format('json').load(pasta)):
        with pytest.raises(IllegalArgumentException, match='Schema must be specified when creating a streaming source DataFrame'):
            ler()


def test_text_e_rate_tem_o_schema_fixo(spark, pasta):
    assert spark.readStream.text(pasta).dtypes == [('value', 'string')]
    assert spark.readStream.format('rate').option('rowsPerSecond', 5).load().dtypes == [('timestamp', 'timestamp'), ('value', 'bigint')]


def test_acao_de_lote_num_stream_da_o_erro_do_spark(spark, pasta):
    df = leituras(spark).filter(F.col('temperatura') > 30)
    for acao in (df.count, df.collect, df.show):
        with pytest.raises(AnalysisException, match=r'writeStream\.start\(\)'):
            acao()


def test_pasta_que_nao_existe(spark):
    with pytest.raises(AnalysisException, match='PATH_NOT_FOUND'):
        spark.readStream.schema(SCHEMA).csv('nao-existe')


def test_with_watermark(spark, pasta):
    lote = eventos(spark, 1)
    assert lote.withWatermark('momento', '10 minutes') is lote  # num DataFrame de lote, o Spark ignora a marca d'água
    with pytest.raises(AnalysisException, match='EVENT_TIME_IS_NOT_ON_TIMESTAMP_TYPE'):
        leituras(spark).withWatermark('estacao', '10 minutes')
    marcado = leituras(spark).withWatermark('momento', '10 minutes')
    assert marcado.isStreaming and 'EventTimeWatermark momento' in '\n'.join(marcado._arvore())


def correr(df, nome='q', modo='append', formato='memory', gatilho=None, **opcoes):
    escritor = df.writeStream.format(formato).queryName(nome).outputMode(modo).options(**opcoes)
    q = escritor.trigger(**(gatilho or {'availableNow': True})).start()
    q.awaitTermination()
    return q


def tabela(spark, nome):
    return sorted((tuple(r) for r in spark.table(nome).collect()), key=str)


def test_append_sem_estado_um_lote_por_arquivo(spark, pasta):
    q = correr(leituras(spark).filter(F.col('temperatura') > 30).select('estacao', 'temperatura'), 'quentes')
    assert not q.isActive and q.name == 'quentes'
    assert [p['numInputRows'] for p in q.recentProgress] == [3, 2, 2]
    assert [p.batchId for p in q.recentProgress] == [0, 1, 2]
    assert q.lastProgress['sources'][0]['numInputRows'] == 2
    assert tabela(spark, 'quentes') == [('Crato', 31.5), ('Crato', 32.0), ('Crato', 33.0), ('Petrolina', 35.0)]
    assert spark.sql('select count(*) from quentes').first()[0] == 4


def test_console_imprime_como_o_spark(spark, pasta, capsys):
    correr(leituras(spark, maximo=None).filter(F.col('estacao') == 'Petrolina').select('estacao', 'temperatura'),
           formato='console')
    assert capsys.readouterr().out == (
        '-------------------------------------------\nBatch: 0\n-------------------------------------------\n'
        '+---------+-----------+\n|  estacao|temperatura|\n+---------+-----------+\n'
        '|Petrolina|       35.0|\n+---------+-----------+\n\n')


def test_console_sem_truncar(spark, capsys):
    gravar('a.csv', ['Estação Meteorológica de Petrolina,2026-01-01 00:01:00,30.0'])
    correr(spark.readStream.schema(SCHEMA).csv('leituras', header=True).select('estacao'), formato='console', truncate=False)
    assert '|Estação Meteorológica de Petrolina|' in capsys.readouterr().out


def test_await_any_termination(spark, pasta):
    q = leituras(spark).writeStream.format('memory').queryName('a').start()
    assert spark.streams.awaitAnyTermination(5) is False
    assert len(q.recentProgress) == 3 and q.isActive
    assert relogio.agora_local() == T0 + dt.timedelta(seconds=5)  # o resto do prazo passa sem dados
    assert spark.streams.awaitAnyTermination() is None and not q.isActive


def test_relogio_anda_por_lote(spark, pasta):
    q = correr(leituras(spark), gatilho={'processingTime': '10 seconds'})
    assert [p['timestamp'] for p in q.recentProgress] == [
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z', '2026-01-01T00:00:20.000Z']
    assert relogio.agora_local() == T0 + dt.timedelta(seconds=30)


def test_arquivo_novo_entra_no_lote_seguinte(spark, pasta):
    q = leituras(spark).writeStream.format('memory').queryName('todas').start()
    assert spark.table('todas').count() == 0  # a tabela existe desde o start
    q.processAllAvailable()
    assert q.isActive and len(q.recentProgress) == 3
    gravar('lote-04.csv', ['Mossoró,2026-01-01 00:50:00,36.0'])
    gravar('_temporario.csv', ['X,2026-01-01 00:50:00,1.0'])  # _ e . ficam de fora, como no Spark
    os.makedirs('leituras/sub', exist_ok=True)
    q.processAllAvailable()
    assert [p['numInputRows'] for p in q.recentProgress] == [3, 2, 2, 1]
    assert spark.table('todas').count() == 8
    assert spark.streams.active == [q]
    q.stop()
    assert not q.isActive and spark.streams.active == []


def test_once_le_tudo_num_lote_so(spark, pasta):
    q = correr(leituras(spark), gatilho={'once': True})
    assert [p['numInputRows'] for p in q.recentProgress] == [7] and not q.isActive


def test_available_now_fica_com_os_arquivos_do_start(spark, pasta):
    q = leituras(spark).writeStream.format('memory').queryName('fixas').trigger(availableNow=True).start()
    gravar('lote-04.csv', ['Mossoró,2026-01-01 00:50:00,36.0'])
    q.awaitTermination()
    assert [p['numInputRows'] for p in q.recentProgress] == [3, 2, 2]


def test_csv_com_linha_ruim_vira_null(spark):
    gravar('a.csv', ['Crato,2026-01-01 00:01:00,quente', 'Sobral'])
    correr(spark.readStream.schema(SCHEMA).csv('leituras', header=True), 'ruins')
    assert tabela(spark, 'ruins') == [('Crato', m(1), None), ('Sobral', None, None)]


def test_rate_gera_linhas_pelo_relogio(spark):
    q = spark.readStream.format('rate').option('rowsPerSecond', 2).load().writeStream.format('memory').queryName('taxa').start()
    assert q.awaitTermination(3) is False and q.isActive
    assert [p['numInputRows'] for p in q.recentProgress] == [0, 2, 2]
    assert tabela(spark, 'taxa') == [(T0 + dt.timedelta(seconds=v / 2), v) for v in range(4)]
    q.awaitTermination()  # sem prazo, o Spark esperaria para sempre: aqui roda um lote e acaba
    assert not q.isActive and len(q.recentProgress) == 4


def test_erros_do_spark_no_start(spark, pasta):
    df = leituras(spark)
    with pytest.raises(AnalysisException, match=r'Invalid streaming output mode: complete\. This output mode is not supported for no streaming aggregations'):
        df.writeStream.format('memory').queryName('a').outputMode('complete').start()
    with pytest.raises(AnalysisException, match='Sorting is not supported'):
        df.orderBy('estacao').writeStream.format('memory').queryName('b').start()
    with pytest.raises(AnalysisException, match='queryName must be specified for memory sink'):
        df.writeStream.format('memory').start()
    with pytest.raises(IllegalArgumentException, match='Unknown output mode'):
        df.writeStream.outputMode('tudo')
    with pytest.raises(ValueError, match='Only allow single trigger'):
        df.writeStream.trigger(once=True, availableNow=True)
    with pytest.raises(AnalysisException, match='WRITE_STREAM_NOT_ALLOWED. `writeStream` can be called only'):
        spark.range(1).writeStream  # noqa: B018
    df.writeStream.format('memory').queryName('c').start()
    with pytest.raises(IllegalArgumentException, match='already active'):
        df.writeStream.format('memory').queryName('c').start()
    with pytest.raises(NotImplementedError, match='console e memory'):
        df.writeStream.format('parquet').start('saida')


def test_erro_no_lote_derruba_a_consulta(spark, pasta):
    quebra = F.udf(lambda t: 1 // 0, 'int')
    q = leituras(spark).select(quebra('temperatura')).writeStream.format('memory').queryName('quebrada').start()
    with pytest.raises(StreamingQueryException, match=r'STREAM_FAILED.*division'):
        q.processAllAvailable()
    assert not q.isActive and isinstance(q.exception(), StreamingQueryException)


def test_cada_lote_e_um_job_na_aba_execucao(spark, pasta):
    correr(leituras(spark), 'jobs')
    assert [j['acao'] for j in estagios.resumo()['jobs']] == ['lote 0 de jobs', 'lote 1 de jobs', 'lote 2 de jobs']


def test_complete_guarda_o_estado_entre_os_lotes(spark, pasta):
    q = correr(leituras(spark).groupBy('estacao').count(), 'contagem', 'complete')
    assert [p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress] == [2, 3, 3]
    assert [lote['estado'] for lote in q._lotes] == [2, 3, 3]
    assert tabela(spark, 'contagem') == [('Crato', 4), ('Petrolina', 1), ('Sobral', 2)]


def test_update_emite_so_as_chaves_do_lote(spark, pasta):
    q = correr(leituras(spark).groupBy('estacao').agg(F.max('temperatura').alias('maxima')), 'maximas', 'update')
    assert [p['sink']['numOutputRows'] for p in q.recentProgress] == [2, 2, 2]
    assert tabela(spark, 'maximas') == [('Crato', 33.0)] * 3 + [('Petrolina', 35.0)] + [('Sobral', 29.0)] * 2


def em_ordem(*nomes):
    """Os arquivos ficam com a data de modificação nesta ordem (o Spark lê pela data, não pelo nome)."""
    for i, nome in enumerate(nomes):
        os.utime(os.path.join('leituras', nome), (1_700_000_000 + i, 1_700_000_000 + i))


@pytest.fixture
def fora_de_ordem(spark):
    """Os lotes do c13 (o 2 com uma linha repetida do 1), lidos na ordem 3, 1, 2: o que o PySpark 4.0.1 real deu no CI."""
    for nome, linhas in LOTES.items():
        gravar(nome, linhas + (['Crato,2026-01-01 00:12:00,33.0'] if nome == 'lote-02.csv' else []))
    em_ordem('lote-03.csv', 'lote-01.csv', 'lote-02.csv')


def test_arquivos_em_ordem_de_modificacao(spark, pasta):
    em_ordem('lote-02.csv', 'lote-01.csv', 'lote-03.csv')
    q = correr(leituras(spark), 'ordem')
    assert [lote['arquivos'] for lote in q._lotes] == [['lote-02.csv'], ['lote-01.csv'], ['lote-03.csv']]


def test_append_com_janela_e_as_duas_marcas_dagua(spark, fora_de_ordem):
    por_janela = leituras(spark).withWatermark('momento', '10 minutes').groupBy(F.window('momento', '10 minutes')).count()
    q = correr(por_janela, 'janelas')
    progresso = q.recentProgress
    assert [p['numInputRows'] for p in progresso] == [2, 3, 3]
    assert [p['eventTime']['watermark'] for p in progresso] == [
        '1970-01-01T00:00:00.000Z', '2026-01-01T00:31:00.000Z', '2026-01-01T00:31:00.000Z']
    # o lote 1 só descarta pela marca do lote anterior (1970): as linhas antigas entram e a janela fecha;
    # o lote 2 já descarta pela de 00:31
    assert [p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in progresso] == [0, 0, 3]
    assert janelas(spark.table('janelas')) == [(m(0), m(10), 3), (m(10), m(20), 1)]


def test_update_com_marca_dagua_como_o_spark(spark, fora_de_ordem):
    por_janela = leituras(spark).withWatermark('momento', '10 minutes').groupBy(F.window('momento', '10 minutes')).count()
    q = correr(por_janela, 'janelas_update', 'update')
    assert [p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress] == [2, 1, 1]
    assert janelas(spark.table('janelas_update')) == [(m(0), m(10), 1), (m(0), m(10), 3), (m(10), m(20), 1), (m(40), m(50), 1)]


def test_complete_nao_descarta_pela_marca_dagua(spark, fora_de_ordem):
    por_janela = leituras(spark).withWatermark('momento', '10 minutes').groupBy(F.window('momento', '10 minutes')).count()
    q = correr(por_janela, 'tudo', 'complete')
    assert [p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress] == [0, 0, 0]
    assert janelas(spark.table('tudo')) == [(m(0), m(10), 4), (m(10), m(20), 2), (m(20), m(30), 1), (m(40), m(50), 1)]


def test_erros_do_spark_com_estado(spark, pasta):
    with pytest.raises(AnalysisException, match='STREAMING_OUTPUT_MODE.UNSUPPORTED_OPERATION'):
        leituras(spark).groupBy('estacao').count().writeStream.format('memory').queryName('x').start()
    with pytest.raises(AnalysisException, match='Multiple streaming aggregations'):
        leituras(spark).groupBy('estacao').count().groupBy('count').count() \
            .writeStream.format('memory').queryName('y').outputMode('complete').start()


def test_drop_duplicates_com_marca_dagua(spark, fora_de_ordem):
    unicas = leituras(spark).withWatermark('momento', '10 minutes').dropDuplicates(['estacao', 'momento'])
    q = correr(unicas, 'unicas')
    assert [p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress] == [0, 0, 3]
    assert q.recentProgress[0]['stateOperators'][0]['operatorName'] == 'dedupe'
    assert len(spark.table('unicas').collect()) == 5


def test_drop_duplicates_sem_marca_dagua_guarda_tudo(spark, pasta):
    q = correr(leituras(spark).dropDuplicates(['estacao']), 'estacoes')
    assert [p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress] == [2, 3, 3]
    assert sorted(r.estacao for r in spark.table('estacoes').collect()) == ['Crato', 'Petrolina', 'Sobral']


def test_janela_deslizante_no_complete(spark, pasta):
    correr(leituras(spark).groupBy(F.window('momento', '10 minutes', '5 minutes')).count(), 'deslizante', 'complete')
    assert janelas(spark.table('deslizante')) == [
        (m(-5), m(5), 3), (m(0), m(10), 4), (m(5), m(15), 2), (m(10), m(20), 1),
        (m(20), m(30), 1), (m(25), m(35), 1), (m(35), m(45), 1), (m(40), m(50), 1)]


def test_complete_com_order_by_depois_da_agregacao(spark, pasta, capsys):
    correr(leituras(spark).groupBy('estacao').count().orderBy('estacao'), modo='complete', formato='console',
           gatilho={'once': True})
    assert '|    Crato|    4|\n|Petrolina|    1|\n|   Sobral|    2|' in capsys.readouterr().out
