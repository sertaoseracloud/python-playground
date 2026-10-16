"""O que os projetos usam do motor: percentile_approx, wholeTextFiles e o CAST de timestamp para segundos."""
import pytest

from diverge_runtime import estagios
from pyspark.errors import AnalysisException
from pyspark.sql import SparkSession, Window
from pyspark.sql import functions as F

NOTAS = [('A', 9.0), ('A', 7.0), ('A', 5.0), ('B', 6.0), ('B', 8.0), ('B', 4.0), ('C', 10.0), ('C', 3.0)]


@pytest.fixture
def spark():
    estagios.zerar()
    return SparkSession.builder.appName('teste').getOrCreate()


def test_percentil_como_o_spark(spark):
    # O valor de posição ceil(p * n) na lista ordenada (exato com poucos dados, como no Spark).
    notas = spark.createDataFrame(NOTAS, ['turma', 'nota'])
    linha = notas.agg(*[F.percentile_approx('nota', p).alias(f'p{i}') for i, p in enumerate((0.0, 0.25, 0.5, 0.75, 0.9, 1.0))]).first()
    assert list(linha) == [3.0, 4.0, 6.0, 8.0, 10.0, 10.0]
    medianas = notas.groupBy('turma').agg(F.percentile_approx('nota', 0.5).alias('m')).orderBy('turma').collect()
    assert [(r.turma, r.m) for r in medianas] == [('A', 7.0), ('B', 6.0), ('C', 3.0)]
    assert notas.agg(F.percentile_approx('nota', [0.1, 0.5, 0.95])).first()[0] == [3.0, 6.0, 10.0]


def test_percentil_tipo_nulos_e_grupo_vazio(spark):
    ms = spark.createDataFrame([(120,), (100,), (None,), (30,), (140,)], 'ms INT')
    r = ms.agg(F.percentile_approx('ms', 0.95).alias('p95'))
    assert r.dtypes == [('p95', 'int')]
    assert r.first().p95 == 140
    assert ms.agg(F.percentile_approx('ms', [0.5]).alias('l')).dtypes == [('l', 'array<int>')]
    assert spark.createDataFrame([], 'x DOUBLE').agg(F.percentile_approx('x', 0.5)).first()[0] is None


def test_percentil_fora_de_0_a_1_e_coluna_de_texto(spark):
    ms = spark.createDataFrame([(1,)], 'ms INT')
    with pytest.raises(AnalysisException, match='between'):
        ms.agg(F.percentile_approx('ms', 95)).collect()
    with pytest.raises(AnalysisException, match='NUMERIC'):
        spark.createDataFrame([('a',)], ['t']).agg(F.percentile_approx('t', 0.5)).collect()


def test_whole_text_files(spark, tmp_path):
    livros = tmp_path / 'livros'
    livros.mkdir()
    # newline='\n': no Windows, o write_text trocaria por \r\n.
    (livros / 'b.txt').write_text('mar\n', encoding='utf-8', newline='\n')
    (livros / 'a.txt').write_text('sertão\nseca\n', encoding='utf-8', newline='\n')
    pares = spark.sparkContext.wholeTextFiles(str(livros)).collect()
    assert sorted((c.rsplit('/', 1)[-1], t) for c, t in pares) == [('a.txt', 'sertão\nseca\n'), ('b.txt', 'mar\n')]
    assert all(c.startswith('file:') and '\\' not in c for c, _ in pares)
    df = spark.sparkContext.wholeTextFiles(str(livros)).toDF(['caminho', 'texto'])
    nomes = df.select(F.regexp_extract('caminho', r'([^/]+)\.txt$', 1).alias('livro')).collect()
    assert sorted(r.livro for r in nomes) == ['a', 'b']


def test_whole_text_files_numa_pasta_que_nao_existe(spark, tmp_path):
    rdd = spark.sparkContext.wholeTextFiles(str(tmp_path / 'nada'))  # preguiçoso: ainda não leu
    with pytest.raises(AnalysisException, match='PATH_NOT_FOUND|Path does not exist'):
        rdd.collect()


def test_timestamp_em_segundos(spark):
    t = (spark.createDataFrame([('x', '2026-10-15 09:00:05'), ('x', '2026-10-15 09:10:00'), ('x', '2026-10-15 10:40:00')], ['ip', 'm'])
         .withColumn('m', F.to_timestamp('m')))
    s = F.col('m').cast('long')
    intervalos = t.select((s - F.lag(s).over(Window.partitionBy('ip').orderBy('m'))).alias('i')).collect()
    assert [r.i for r in intervalos] == [None, 595, 5400]
    assert t.select(s.alias('s')).dtypes == [('s', 'bigint')]
    assert t.select(s.alias('s')).first().s == 1792054805  # 2026-10-15 09:00:05 contado como UTC

def test_unpivot_volta_ao_formato_longo(spark):
    largo = spark.createDataFrame([('soja', 36, 41), ('milho', 23, 25)], ['cultura', '2023', '2024'])
    longo = largo.unpivot('cultura', ['2023', '2024'], 'ano', 'toneladas')
    assert longo.dtypes == [('cultura', 'string'), ('ano', 'string'), ('toneladas', 'bigint')]
    assert [tuple(r) for r in longo.collect()] == [('soja', '2023', 36), ('soja', '2024', 41), ('milho', '2023', 23), ('milho', '2024', 25)]
    assert [tuple(r) for r in largo.melt(['cultura'], None, 'ano', 't').collect()] == [tuple(r) for r in longo.collect()]


def test_unpivot_tipos_diferentes(spark):
    df = spark.createDataFrame([(1, 2, 2.5)], 'id INT, a INT, b DOUBLE')
    assert df.unpivot('id', ['a', 'b'], 'k', 'v').dtypes == [('id', 'int'), ('k', 'string'), ('v', 'double')]
    misto = spark.createDataFrame([(1, 'x', 2)], 'id INT, a STRING, b INT')
    with pytest.raises(AnalysisException, match='UNPIVOT_VALUE_DATA_TYPE_MISMATCH'):
        misto.unpivot('id', ['a', 'b'], 'k', 'v')
