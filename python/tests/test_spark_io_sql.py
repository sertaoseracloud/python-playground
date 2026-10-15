"""Leitura e escrita de arquivos, explode, UDF, expressões em texto e Spark SQL."""
import os

import pytest

from _comum import operadores
from diverge_runtime import estagios
from pyspark.errors import AnalysisException, ParseException
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def vendas(spark):
    return spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])


def tuplas(df):
    return [tuple(r) for r in df.collect()]


def test_csv(spark, tmp_path):
    (tmp_path / 'vendas.csv').write_text('produto,quantidade,preco,ativo\nArroz,2,24.90,true\n"Café, torrado",,19.90,false\n', encoding='utf-8')
    df = spark.read.csv('vendas.csv', header=True, inferSchema=True)
    assert df.dtypes == [('produto', 'string'), ('quantidade', 'int'), ('preco', 'double'), ('ativo', 'boolean')]
    assert df.collect()[1] == Row(produto='Café, torrado', quantidade=None, preco=19.9, ativo=False)
    assert spark.read.option('header', True).csv('vendas.csv').dtypes[1] == ('quantidade', 'string')
    assert spark.read.csv('vendas.csv').columns == ['_c0', '_c1', '_c2', '_c3']
    s = spark.read.schema('produto STRING, quantidade INT, preco DOUBLE, ativo BOOLEAN').csv('vendas.csv', header=True)
    assert s.first().preco == 24.9
    assert spark.read.format('csv').option('header', 'true').load('vendas.csv').count() == 2
    assert df.rdd.getNumPartitions() == 1
    with pytest.raises(AnalysisException) as e:
        spark.read.csv('nao_tem.csv')
    assert e.value.getErrorClass() == 'PATH_NOT_FOUND'


def test_json(spark, tmp_path):
    (tmp_path / 'notas.json').write_text('{"nome": "Ana", "nota": 9.5, "turma": 1}\n{"turma": 2, "nome": "Bia", "nota": 7}\n{"nome": "Caio"}\n', encoding='utf-8')
    j = spark.read.json('notas.json')
    assert j.dtypes == [('nome', 'string'), ('nota', 'double'), ('turma', 'bigint')]
    assert tuplas(j)[2] == ('Caio', None, None)


def test_escrita(spark, tmp_path):
    df = vendas(spark).filter(F.col('regiao') == 'Nordeste').coalesce(1)
    df.write.mode('overwrite').csv('saida', header=True)
    assert sorted(os.listdir('saida')) == ['_SUCCESS', 'part-00000-c000.csv']
    assert (tmp_path / 'saida' / 'part-00000-c000.csv').read_text(encoding='utf-8') == 'produto,regiao,quantidade,preco\nArroz,Nordeste,2,24.9\nCafé,Nordeste,1,19.9\n'
    assert spark.read.csv('saida', header=True, inferSchema=True).count() == 2
    with pytest.raises(AnalysisException) as e:
        df.write.csv('saida')
    assert e.value.getErrorClass() == 'PATH_ALREADY_EXISTS'
    spark.createDataFrame(VENDAS[:3], ['produto', 'regiao', 'quantidade', 'preco']).write.json('j')
    assert len([n for n in os.listdir('j') if n.startswith('part-')]) == 3  # 3 linhas em 4 partições: a vazia não gera arquivo
    assert spark.read.json('j').count() == 3
    vendas(spark).write.parquet('p')
    assert spark.read.parquet('p').dtypes == vendas(spark).dtypes
    vendas(spark).write.partitionBy('regiao').mode('overwrite').parquet('por_regiao')
    assert sorted(n for n in os.listdir('por_regiao') if not n.startswith('_')) == ['regiao=Nordeste', 'regiao=Norte', 'regiao=Sudeste']
    with pytest.raises(AnalysisException) as e:
        vendas(spark).write.format('inventado').save('d')  # o delta existe desde a fase 5
    assert e.value.getErrorClass() == 'DATA_SOURCE_NOT_FOUND'


def test_explode_e_udf(spark):
    t = spark.createDataFrame([('a', ['x', 'y']), ('b', [])], ['id', 'tags'])
    assert tuplas(t.select('id', F.explode('tags').alias('tag'))) == [('a', 'x'), ('a', 'y')]
    assert t.select(F.explode('tags')).columns == ['col']
    assert tuplas(t.select('id', F.explode_outer('tags')))[2] == ('b', None)
    assert t.select(F.size('tags')).collect()[1][0] == 0

    @F.udf(returnType=IntegerType())
    def dobro(x):
        return x * 2

    r = vendas(spark).select(dobro('quantidade').alias('d'), F.udf(lambda s: s[:3])('produto'))
    assert r.columns == ['d', '<lambda>(produto)']
    assert r.first() == Row(d=4, **{'<lambda>(produto)': 'Arr'})
    assert 'BatchEvalPython' in operadores(r)
    assert vendas(spark).select(F.udf(lambda x: 'texto', 'int')('quantidade')).first()[0] is None
    with pytest.raises(ZeroDivisionError):
        vendas(spark).select(F.udf(lambda x: x // 0, 'int')('quantidade')).collect()


def test_expressoes_em_texto(spark):
    assert vendas(spark).selectExpr('produto', 'quantidade * 2 AS dobro').columns == ['produto', 'dobro']
    assert vendas(spark).filter("preco > 10 AND regiao = 'Nordeste'").count() == 2
    assert vendas(spark).withColumn('x', F.expr('upper(produto)')).first().x == 'ARROZ'
    assert vendas(spark).selectExpr('count(*)').columns == ['count(1)']
    assert spark.range(5).filter('id > 2').collect() == [Row(id=3), Row(id=4)]


def test_sql(spark):
    vendas(spark).createOrReplaceTempView('vendas')
    r = spark.sql('''
        SELECT regiao, ROUND(SUM(quantidade * preco), 2) AS receita, COUNT(*) AS n
        FROM vendas WHERE preco > 2
        GROUP BY regiao HAVING COUNT(*) >= 1
        ORDER BY receita DESC''')
    assert tuplas(r) == [('Nordeste', 69.7, 2), ('Sudeste', 25.5, 1), ('Norte', 25.0, 1)]
    spark.createDataFrame([('Nordeste', 'Recife')], ['regiao', 'capital']).createOrReplaceTempView('capitais')
    j = spark.sql('SELECT v.produto, c.capital FROM vendas v JOIN capitais c ON v.regiao = c.regiao ORDER BY v.produto')
    assert tuplas(j) == [('Arroz', 'Recife'), ('Café', 'Recife')]
    w = spark.sql('SELECT produto, ROW_NUMBER() OVER (PARTITION BY regiao ORDER BY preco DESC) AS pos FROM vendas ORDER BY produto')
    assert tuplas(w) == [('Arroz', 1), ('Café', 2), ('Feijão', 1), ('Rapadura', 1)]
    # Como no Spark, a subconsulta no FROM não precisa de apelido.
    s = spark.sql('SELECT produto FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY regiao ORDER BY preco DESC) AS pos FROM vendas) WHERE pos = 1 ORDER BY produto')
    assert tuplas(s) == [('Arroz',), ('Feijão',), ('Rapadura',)]
    assert spark.sql('SELECT 1 + 1 AS dois').first().dois == 2
    assert spark.sql('SELECT SUM(quantidade) FROM vendas').columns == ['sum(quantidade)']
    assert spark.sql('WITH ne AS (SELECT * FROM vendas WHERE regiao = "Nordeste") SELECT COUNT(*) AS n FROM ne').first().n == 2
    assert spark.sql('SELECT DISTINCT regiao FROM vendas').count() == 3
    assert [r.regiao for r in spark.sql('SELECT DISTINCT regiao FROM vendas ORDER BY regiao').collect()] == ['Nordeste', 'Norte', 'Sudeste']
    assert spark.table('vendas').count() == 4
    assert [t.name for t in spark.catalog.listTables()] == ['capitais', 'vendas']
    with pytest.raises(AnalysisException) as e:
        spark.sql('SELECT * FROM vendass')
    assert e.value.getErrorClass() == 'TABLE_OR_VIEW_NOT_FOUND'
    with pytest.raises(AnalysisException) as e:
        spark.sql('SELECT produto, SUM(quantidade) FROM vendas GROUP BY regiao')
    assert e.value.getErrorClass() == 'MISSING_AGGREGATION'
    with pytest.raises(ParseException):
        spark.sql('SELECT * FORM vendas')


def test_cada_execucao_comeca_do_zero(spark):
    vendas(spark).createOrReplaceTempView('v')
    spark.conf.set('spark.sql.shuffle.partitions', '8')
    cacheado = vendas(spark).cache()
    cacheado.count()
    estagios.zerar()
    s = SparkSession.builder.getOrCreate()
    assert s is not spark
    assert s.conf.get('spark.sql.shuffle.partitions') == '4'
    with pytest.raises(AnalysisException):
        s.table('v')
