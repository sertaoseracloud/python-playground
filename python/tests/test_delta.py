"""Delta Lake do DivergePython: log de transações, versões, time travel, update/delete/merge,
schema, vacuum e optimize, sobre o relógio virtual."""
import datetime as dt
import json
import os

import pytest

from diverge_runtime import estagios, relogio
from pyspark.errors import AnalysisException, IllegalArgumentException
from pyspark.sql import Row, SparkSession  # noqa: F401
from pyspark.sql import functions as F


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def tuplas(df, *ordem):
    return [tuple(r) for r in (df.orderBy(*ordem) if ordem else df).collect()]


def test_relogio_comeca_em_2026_e_so_anda_quando_pedem():
    relogio.avancar(5)
    estagios.zerar()  # cada execução começa do zero
    assert relogio.agora() == dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    assert relogio.avancar(90) == dt.datetime(2026, 1, 1, 0, 1, 30, tzinfo=dt.timezone.utc)
    assert relogio.em_ms() == relogio.em_ms(relogio.agora())
    assert relogio.em_ms(relogio.INICIO) == 1767225600000


def test_illegal_argument_exception():
    with pytest.raises(ValueError):
        raise IllegalArgumentException('requirement failed')


ESTOQUE = [('arroz', 10, 24.9), ('feijao', 4, 8.5), ('cafe', 7, 19.9)]


def estoque(spark, linhas=ESTOQUE):
    return spark.createDataFrame(linhas, ['produto', 'qtd', 'preco'])


def test_gravar_e_ler_delta_com_log(spark):
    estoque(spark).write.format('delta').save('estoque')
    assert sorted(os.listdir('estoque/_delta_log')) == ['00000000000000000000.json']
    acoes = [json.loads(linha) for linha in open('estoque/_delta_log/00000000000000000000.json', encoding='utf-8')]
    tipos = [next(iter(a)) for a in acoes]
    assert tipos[:3] == ['commitInfo', 'protocol', 'metaData'] and 'add' in tipos
    info = acoes[0]['commitInfo']
    assert info['operation'] == 'WRITE' and info['operationParameters']['mode'] == 'ErrorIfExists'
    assert info['timestamp'] == relogio.em_ms(relogio.INICIO)
    df = spark.read.format('delta').load('estoque')
    assert df.dtypes == [('produto', 'string'), ('qtd', 'bigint'), ('preco', 'double')]
    assert tuplas(df, 'produto') == sorted(ESTOQUE)


def test_append_cria_versoes_e_time_travel(spark):
    estoque(spark).write.format('delta').save('estoque')
    estoque(spark, [('milho', 3, 5.0)]).write.format('delta').mode('append').save('estoque')
    estoque(spark, [('sal', 1, 2.0)]).write.format('delta').mode('overwrite').save('estoque')
    assert spark.read.format('delta').load('estoque').count() == 1
    assert spark.read.format('delta').option('versionAsOf', 0).load('estoque').count() == 3
    assert spark.read.format('delta').option('versionAsOf', 1).load('estoque').count() == 4
    # 1 s por commit: a versão 1 foi gravada às 00:00:01
    assert spark.read.format('delta').option('timestampAsOf', '2026-01-01 00:00:01').load('estoque').count() == 4
    with pytest.raises(AnalysisException, match=r'Cannot time travel Delta table to version 7\. Available versions: \[0, 2\]'):
        spark.read.format('delta').option('versionAsOf', 7).load('estoque')
    with pytest.raises(AnalysisException, match='before the earliest version'):
        spark.read.format('delta').option('timestampAsOf', '2025-12-31 23:00:00').load('estoque')


def test_modos(spark):
    estoque(spark).write.format('delta').save('estoque')
    with pytest.raises(AnalysisException, match='already exist'):
        estoque(spark).write.format('delta').save('estoque')
    estoque(spark).write.format('delta').mode('ignore').save('estoque')
    assert spark.read.format('delta').load('estoque').count() == 3
    assert len(os.listdir('estoque/_delta_log')) == 1


def test_coluna_nova_sem_merge_schema_e_recusada(spark):
    estoque(spark).write.format('delta').save('estoque')
    novo = spark.createDataFrame([('sal', 1, 2.0, 'Crato')], ['produto', 'qtd', 'preco', 'cidade'])
    with pytest.raises(AnalysisException, match='A schema mismatch detected when writing to the Delta table'):
        novo.write.format('delta').mode('append').save('estoque')
    assert len(os.listdir('estoque/_delta_log')) == 1


def test_merge_schema_linhas_antigas_nulas(spark):
    estoque(spark).write.format('delta').save('estoque')
    novo = spark.createDataFrame([('sal', 1, 2.0, 'Crato')], ['produto', 'qtd', 'preco', 'cidade'])
    novo.write.format('delta').mode('append').option('mergeSchema', 'true').save('estoque')
    df = spark.read.format('delta').load('estoque')
    assert df.columns == ['produto', 'qtd', 'preco', 'cidade']
    assert tuplas(df.select('produto', 'cidade'), 'produto') == [('arroz', None), ('cafe', None), ('feijao', None), ('sal', 'Crato')]
    df.show()  # não quebra com nulos de arquivos antigos


def test_overwrite_schema(spark):
    estoque(spark).write.format('delta').save('estoque')
    outro = spark.createDataFrame([(1, 'x')], ['id', 'nome'])
    with pytest.raises(AnalysisException, match='schema mismatch'):
        outro.write.format('delta').mode('overwrite').save('estoque')
    outro.write.format('delta').mode('overwrite').option('overwriteSchema', 'true').save('estoque')
    assert spark.read.format('delta').load('estoque').dtypes == [('id', 'bigint'), ('nome', 'string')]


def test_delta_vazio_e_configure(spark):
    from delta import configure_spark_with_delta_pip
    construtor = SparkSession.builder  # cada acesso a .builder dá um construtor novo
    assert configure_spark_with_delta_pip(construtor) is construtor
    spark.createDataFrame([], 'produto STRING, qtd BIGINT').write.format('delta').save('vazio')
    df = spark.read.format('delta').load('vazio')
    assert df.count() == 0 and df.columns == ['produto', 'qtd']


def tabela(spark):
    from delta.tables import DeltaTable
    estoque(spark).write.format('delta').save('estoque')
    return DeltaTable.forPath(spark, 'estoque')


def test_for_path_de_pasta_que_nao_e_delta(spark):
    from delta.tables import DeltaTable
    estoque(spark).write.csv('csv')
    with pytest.raises(AnalysisException, match='is not a Delta table'):
        DeltaTable.forPath(spark, 'csv')
    assert DeltaTable.isDeltaTable(spark, 'csv') is False


def test_history_colunas_ordem_e_operacoes(spark):
    t = tabela(spark)
    estoque(spark, [('sal', 1, 2.0)]).write.format('delta').mode('append').save('estoque')
    h = t.history()
    assert h.columns == ['version', 'timestamp', 'userId', 'userName', 'operation', 'operationParameters', 'job', 'notebook',
                         'clusterId', 'readVersion', 'isolationLevel', 'isBlindAppend', 'operationMetrics', 'userMetadata', 'engineInfo']
    linhas = h.select('version', 'operation', 'operationParameters').collect()
    assert [(r.version, r.operation, r.operationParameters['mode']) for r in linhas] == [(1, 'WRITE', 'Append'), (0, 'WRITE', 'ErrorIfExists')]
    assert t.history(1).count() == 1
    assert h.first().timestamp == dt.datetime(2026, 1, 1, 0, 0, 1)


def test_update_e_delete(spark):
    t = tabela(spark)
    t.update('produto = "cafe"', {'preco': 'preco * 2'})
    t.update(F.col('qtd') < 5, {'qtd': F.lit(5)})
    t.delete('produto = "arroz"')
    assert tuplas(t.toDF(), 'produto') == [('cafe', 7, 39.8), ('feijao', 5, 8.5)]
    ops = [r.operation for r in t.history().collect()]
    assert ops == ['DELETE', 'UPDATE', 'UPDATE', 'WRITE']
    assert t.history().filter('version = 3').first().operationMetrics['numDeletedRows'] == '1'
    # o passado continua lá
    assert spark.read.format('delta').option('versionAsOf', 0).load('estoque').count() == 3


def test_delete_de_tudo_deixa_a_tabela_vazia(spark):
    t = tabela(spark)
    t.delete()
    df = t.toDF()
    assert df.count() == 0 and df.columns == ['produto', 'qtd', 'preco']
    df.show()


def test_merge_upsert_do_estoque(spark):
    t = tabela(spark)
    dia = spark.createDataFrame([('cafe', 9, 21.0), ('milho', 3, 5.0)], ['produto', 'qtd', 'preco'])
    (t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto')
      .whenMatchedUpdate(set={'qtd': 'e.qtd + d.qtd', 'preco': 'd.preco'})
      .whenNotMatchedInsertAll()
      .execute())
    assert tuplas(t.toDF(), 'produto') == [('arroz', 10, 24.9), ('cafe', 16, 21.0), ('feijao', 4, 8.5), ('milho', 3, 5.0)]
    h = t.history(1).first()
    assert h.operation == 'MERGE'
    assert h.operationMetrics['numTargetRowsUpdated'] == '1' and h.operationMetrics['numTargetRowsInserted'] == '1'


def test_merge_com_condicao_delete_e_insert_seletivo(spark):
    t = tabela(spark)
    dia = spark.createDataFrame([('feijao', 0, 8.5), ('arroz', 2, 25.0), ('sal', 0, 2.0)], ['produto', 'qtd', 'preco'])
    (t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto')
      .whenMatchedDelete(condition='d.qtd = 0')
      .whenMatchedUpdateAll()
      .whenNotMatchedInsert(condition='d.qtd > 0', values={'produto': 'd.produto', 'qtd': 'd.qtd', 'preco': 'd.preco'})
      .execute())
    assert tuplas(t.toDF(), 'produto') == [('arroz', 2, 25.0), ('cafe', 7, 19.9)]


def test_merge_com_duas_linhas_da_fonte_para_o_mesmo_alvo_e_erro(spark):
    t = tabela(spark)
    dia = spark.createDataFrame([('cafe', 1, 1.0), ('cafe', 2, 2.0)], ['produto', 'qtd', 'preco'])
    with pytest.raises(Exception, match='DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE'):
        t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto').whenMatchedUpdateAll().execute()
    assert t.history(1).first().operation == 'WRITE'  # nada foi gravado


def arquivos_de_dados(caminho):
    return sorted(n for n in os.listdir(caminho) if n.endswith('.parquet'))


def test_vacuum_recusa_retencao_curta_e_apaga_so_os_removidos(spark):
    t = tabela(spark)
    estoque(spark, [('sal', 1, 2.0)]).write.format('delta').mode('overwrite').save('estoque')
    antes = arquivos_de_dados('estoque')
    with pytest.raises(IllegalArgumentException, match='retention'):
        t.vacuum(0)
    spark.conf.set('spark.databricks.delta.retentionDurationCheck.enabled', 'false')
    t.vacuum(1)  # removidos há menos de 1 h no relógio virtual: ficam
    assert arquivos_de_dados('estoque') == antes
    relogio.avancar(2 * 3600)
    t.vacuum(1)
    depois = arquivos_de_dados('estoque')
    assert len(depois) == len(_snapshot_arquivos('estoque')) < len(antes)
    assert t.toDF().count() == 1
    assert [r.operation for r in t.history(2).collect()] == ['VACUUM END', 'VACUUM START']


def _snapshot_arquivos(caminho):
    from delta import _log
    return _log.snapshot(os.path.abspath(caminho)).arquivos


def test_optimize_junta_arquivos_pequenos(spark):
    t = tabela(spark)
    for i in range(3):
        estoque(spark, [(f'p{i}', i, 1.0)]).write.format('delta').mode('append').save('estoque')
    assert len(_snapshot_arquivos('estoque')) > 1
    r = t.optimize().executeCompaction()
    assert r.first().numFilesAdded == 1
    assert len(_snapshot_arquivos('estoque')) == 1
    assert t.toDF().count() == 6
    h = t.history(1).first()
    assert h.operation == 'OPTIMIZE'
    assert spark.read.format('delta').option('versionAsOf', h.version - 1).load('estoque').count() == 6


def test_overwrite_com_menos_colunas_mantem_o_schema(spark):
    estoque(spark).write.format('delta').save('estoque')
    spark.createDataFrame([('sal', 1)], ['produto', 'qtd']).write.format('delta').mode('overwrite').save('estoque')
    df = spark.read.format('delta').load('estoque')
    assert df.columns == ['produto', 'qtd', 'preco']
    assert tuplas(df) == [('sal', 1, None)]


def test_a_classe_do_erro_aparece_uma_vez_so(spark):
    estoque(spark).write.format('delta').save('estoque')
    with pytest.raises(AnalysisException) as e:
        spark.read.format('delta').option('versionAsOf', 9).load('estoque')
    assert str(e.value).count('[DELTA_VERSION_NOT_FOUND]') == 1
