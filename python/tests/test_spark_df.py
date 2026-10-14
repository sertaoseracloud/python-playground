"""DataFrame do pyspark do DivergePython: schema, show, colunas, funções, nulos e erros no formato do Spark 4."""
import datetime

import pytest

from _comum import operadores
from diverge_runtime import estagios
from pyspark.errors import AnalysisException, PySparkTypeError, PySparkValueError
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, IntegerType, LongType, StringType, StructField, StructType

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]


@pytest.fixture
def spark():
    estagios.zerar()
    return SparkSession.builder.appName('teste').getOrCreate()


def vendas(spark):
    return spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])


def test_schema_inferido(spark, capsys):
    df = vendas(spark)
    assert df.dtypes == [('produto', 'string'), ('regiao', 'string'), ('quantidade', 'bigint'), ('preco', 'double')]
    assert repr(df) == 'DataFrame[produto: string, regiao: string, quantidade: bigint, preco: double]'
    assert df.schema == StructType([StructField('produto', StringType()), StructField('regiao', StringType()),
                                    StructField('quantidade', LongType()), StructField('preco', DoubleType())])
    df.printSchema()
    assert capsys.readouterr().out == (
        'root\n |-- produto: string (nullable = true)\n |-- regiao: string (nullable = true)\n'
        ' |-- quantidade: long (nullable = true)\n |-- preco: double (nullable = true)\n\n')
    assert df.rdd.getNumPartitions() == 4
    assert spark.createDataFrame([{'b': 1, 'a': 'x'}]).columns == ['a', 'b']
    assert spark.createDataFrame([Row(nome='Ana', idade=3)]).dtypes == [('nome', 'string'), ('idade', 'bigint')]
    with pytest.raises(PySparkValueError, match='CANNOT_DETERMINE_TYPE'):
        spark.createDataFrame([(None,)], ['x'])
    # Spark 4: tipos diferentes na mesma coluna viram texto (antes era o erro CANNOT_MERGE_TYPE)
    misturado = spark.createDataFrame([(1,), ('a',)], ['x'])
    assert misturado.dtypes == [('x', 'string')]
    assert [r.x for r in misturado.collect()] == ['1', 'a']
    assert spark.createDataFrame([(1,), (2.5,)], ['x']).dtypes == [('x', 'double')]


def test_show_como_o_spark(spark, capsys):
    vendas(spark).show()
    assert capsys.readouterr().out == (
        '+--------+--------+----------+-----+\n'
        '| produto|  regiao|quantidade|preco|\n'
        '+--------+--------+----------+-----+\n'
        '|   Arroz|Nordeste|         2| 24.9|\n'
        '|  Feijão| Sudeste|         3|  8.5|\n'
        '|    Café|Nordeste|         1| 19.9|\n'
        '|Rapadura|   Norte|        10|  2.5|\n'
        '+--------+--------+----------+-----+\n\n')
    vendas(spark).show(2)
    assert capsys.readouterr().out == (
        '+-------+--------+----------+-----+\n'
        '|produto|  regiao|quantidade|preco|\n'
        '+-------+--------+----------+-----+\n'
        '|  Arroz|Nordeste|         2| 24.9|\n'
        '| Feijão| Sudeste|         3|  8.5|\n'
        '+-------+--------+----------+-----+\n'
        'only showing top 2 rows\n')
    vendas(spark).select('produto').show(1, truncate=False)
    assert capsys.readouterr().out == '+-------+\n|produto|\n+-------+\n|Arroz  |\n+-------+\nonly showing top 1 row\n'


def test_valores_especiais_no_show(spark, capsys):
    df = spark.createDataFrame(
        [('um texto bem comprido demais', None, 10000000.0, True, datetime.date(2026, 10, 13), ['a', 'b'])],
        'texto string, nada string, grande double, ok boolean, dia date, tags array<string>')
    df.show()
    assert capsys.readouterr().out == (
        '+--------------------+----+------+----+----------+------+\n'
        '|               texto|nada|grande|  ok|       dia|  tags|\n'
        '+--------------------+----+------+----+----------+------+\n'
        '|um texto bem comp...|NULL| 1.0E7|true|2026-10-13|[a, b]|\n'
        '+--------------------+----+------+----+----------+------+\n\n')
    df.select('tags').printSchema()
    assert capsys.readouterr().out == 'root\n |-- tags: array (nullable = true)\n |    |-- element: string (containsNull = true)\n\n'


def test_colunas_e_nomes_automaticos(spark):
    df = vendas(spark)
    r = df.select('produto', F.col('quantidade') * F.col('preco'), (F.col('preco') > 10).alias('caro'), F.upper('regiao'))
    assert r.columns == ['produto', '(quantidade * preco)', 'caro', 'upper(regiao)']
    assert r.filter(F.col('caro')).count() == 2
    assert df.filter((df.preco > 5) & (df['regiao'] == 'Nordeste')).count() == 2
    t = (df.withColumn('total', F.round(F.col('quantidade') * F.col('preco'), 2))
           .withColumnRenamed('produto', 'item').drop('regiao'))
    assert t.columns == ['item', 'quantidade', 'preco', 'total']
    assert [row.total for row in t.collect()] == [49.8, 25.5, 19.9, 25.0]
    assert t.collect()[0] == Row(item='Arroz', quantidade=2, preco=24.9, total=49.8)
    assert repr(t.first()) == "Row(item='Arroz', quantidade=2, preco=24.9, total=49.8)"
    assert t.first().asDict() == {'item': 'Arroz', 'quantidade': 2, 'preco': 24.9, 'total': 49.8}
    assert df.select((F.col('quantidade') / 4).alias('x')).first().x == 0.5
    assert df.select(F.col('quantidade').isin(1, 2)).columns == ['(quantidade IN (1, 2))']
    assert df.limit(2).count() == 2 and df.take(1) == [Row(produto='Arroz', regiao='Nordeste', quantidade=2, preco=24.9)]
    assert [r.id for r in spark.range(1, 7, 2).collect()] == [1, 3, 5]


def test_when_strings_datas_e_cast(spark):
    df = spark.createDataFrame([('  ana ', 17, '2026-03-05'), ('BIA', 30, '2025-12-31')], ['nome', 'idade', 'nascimento'])
    r = df.select(
        F.initcap(F.trim('nome')).alias('nome'),
        F.when(F.col('idade') >= 18, 'adulto').otherwise('menor').alias('faixa'),
        F.year(F.to_date('nascimento')).alias('ano'),
        F.col('idade').cast('string').alias('texto'),
        F.concat_ws('-', F.lower(F.trim('nome')), F.col('idade')).alias('chave'),
    )
    assert [tuple(x) for x in r.collect()] == [('Ana', 'menor', 2026, '17', 'ana-17'), ('Bia', 'adulto', 2025, '30', 'bia-30')]
    assert r.dtypes == [('nome', 'string'), ('faixa', 'string'), ('ano', 'int'), ('texto', 'string'), ('chave', 'string')]
    assert df.select(F.when(F.col('idade') > 18, 'adulto').otherwise('menor')).columns == ['CASE WHEN (idade > 18) THEN adulto ELSE menor END']
    assert df.select(F.col('idade').cast(IntegerType())).dtypes == [('idade', 'int')]
    assert df.select(F.to_date('nascimento').alias('d')).first().d == datetime.date(2026, 3, 5)
    assert df.select(F.datediff(F.to_date(F.lit('2026-03-10')), F.to_date('nascimento'))).first()[0] == 5
    assert df.select(F.substring('nascimento', 1, 4)).columns == ['substring(nascimento, 1, 4)']
    assert df.select(F.split('nascimento', '-').alias('p')).first().p == ['2026', '03', '05']


def test_nulos(spark):
    df = spark.createDataFrame([('Ana', None, 7.5), ('Bia', 'Recife', None), (None, None, None)], 'nome string, cidade string, nota double')
    assert df.na.fill({'cidade': 'Desconhecida', 'nota': 0.0}).collect()[0].cidade == 'Desconhecida'
    assert df.na.drop().count() == 0
    assert df.na.drop(how='all').count() == 2
    assert df.dropna(subset=['nome']).count() == 2
    assert df.fillna(0).collect()[1].nota == 0.0
    assert df.fillna('?').collect()[2].nome == '?'
    assert df.filter(F.col('cidade').isNull()).count() == 2
    assert [r[0] for r in df.select(F.coalesce('cidade', 'nome', F.lit('?'))).collect()] == ['Ana', 'Recife', '?']
    assert df.filter(F.col('nota') > 5).count() == 1  # NULL > 5 não é verdadeiro


def test_erros_como_o_spark(spark):
    df = spark.createDataFrame([('Ana', 30)], ['nome', 'idade'])
    with pytest.raises(AnalysisException) as e:
        df.select('idadee')
    assert str(e.value).splitlines()[0] == (
        '[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `idadee` '
        'cannot be resolved. Did you mean one of the following? [`idade`, `nome`]. SQLSTATE: 42703;')
    assert e.value.getErrorClass() == 'UNRESOLVED_COLUMN.WITH_SUGGESTION'
    with pytest.raises(AnalysisException):
        df.filter(F.col('cidade') == 'Recife')
    with pytest.raises(NotImplementedError, match='pandas'):
        df.toPandas()


def test_explain_estreito(spark, capsys):
    vendas(spark).filter(F.col('preco') > 10).select('produto').explain()
    saida = capsys.readouterr().out
    assert saida.startswith('== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Project [produto#')
    assert 'Filter (preco#' in saida and 'Scan ExistingRDD[produto#' in saida
    assert operadores(saida) == []
    assert saida.endswith('\n\n')


def test_rdd_vira_dataframe_e_volta(spark):
    sc = spark.sparkContext
    df = sc.parallelize([('a', 1), ('b', 2)]).toDF(['letra', 'n'])
    assert df.dtypes == [('letra', 'string'), ('n', 'bigint')]
    assert df.rdd.map(lambda r: r.n * 10).collect() == [10, 20]
    assert spark.createDataFrame(sc.parallelize([Row(x=1)])).first().x == 1
