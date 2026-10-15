"""Structured Streaming do DivergePython: janelas de tempo, fontes, micro-lotes no relógio virtual,
estado, marca d'água e as saídas console e memory."""
import datetime as dt
import os

import pytest

from diverge_runtime import estagios, relogio
from pyspark.errors import AnalysisException, IllegalArgumentException
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
