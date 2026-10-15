"""MLlib do DivergePython: vetores, features, pipeline, modelos e avaliadores, com o treino
distribuído pelos workers."""
import math

import pytest

from diverge_runtime import estagios
from pyspark.errors import IllegalArgumentException
from pyspark.sql import SparkSession
from pyspark.ml.linalg import DenseVector, SparseVector, Vectors


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def acoes():
    return [j['acao'] for j in estagios.resumo()['jobs']]


def test_vetores_como_o_pyspark():
    d = Vectors.dense([1.0, 0.0, 3.5])
    s = Vectors.sparse(4, [1, 3], [2.0, 1.0])
    assert str(d) == '[1.0,0.0,3.5]' and repr(d) == 'DenseVector([1.0, 0.0, 3.5])'
    assert str(s) == '(4,[1,3],[2.0,1.0])' and repr(s) == 'SparseVector(4, {1: 2.0, 3: 1.0})'
    assert s.toArray() == [0.0, 2.0, 0.0, 1.0] and s[1] == 2.0 and s[0] == 0.0 and len(s) == 4
    assert Vectors.dense(1, 2) == DenseVector([1.0, 2.0]) and Vectors.sparse(2, {0: 1.0}) == Vectors.dense([1.0, 0.0])
    assert d.dot([1, 1, 2]) == 8.0 and Vectors.squared_distance(d, [0, 0, 0]) == 13.25 and s.numNonzeros() == 2
    assert Vectors.dense([1e-5])._texto_do_spark() == '[1.0E-5]' and str(Vectors.dense([1e-5])) == '[1e-05]'


def test_vetor_no_dataframe(spark, capsys):
    df = spark.createDataFrame([(Vectors.dense([1.0, 2.0]), Vectors.sparse(3, [2], [1.0]))], ['d', 's'])
    assert df.dtypes == [('d', 'vector'), ('s', 'vector')]
    df.printSchema()
    df.show()
    saida = capsys.readouterr().out
    assert ' |-- d: vector (nullable = true)' in saida
    assert '|[1.0,2.0]|(3,[2],[1.0])|' in saida
    assert df.first().s == SparseVector(3, [2], [1.0])


def test_vetor_na_tabela_da_correcao(spark):
    df = spark.createDataFrame([(Vectors.dense([1.0, 2.0]),)], ['features'])
    tabela = df._diverge_tabela(10)
    assert tabela['colunas'] == [{'nome': 'features', 'tipo': 'vector'}]
    assert tabela['linhas'] == [['[1.0,2.0]']]


def test_random_split_deterministico_e_sem_sobra(spark):
    df = spark.range(200)
    a, b = df.randomSplit([0.7, 0.3], seed=42)
    ida, idb = {r.id for r in a.collect()}, {r.id for r in b.collect()}
    assert not ida & idb and len(ida) + len(idb) == 200
    assert 0.55 <= len(ida) / 200 <= 0.85
    assert {r.id for r in df.randomSplit([0.7, 0.3], seed=42)[0].collect()} == ida
    assert {r.id for r in df.randomSplit([0.7, 0.3], seed=7)[0].collect()} != ida
    with pytest.raises(ValueError, match='Weights must be positive'):
        df.randomSplit([0.5, -1.0])
