"""RDD do pyspark do DivergePython. Sem pool, as tarefas rodam aqui mesmo, em sequência:
o resultado e os estágios são os mesmos do navegador."""
import pytest

from diverge_runtime import estagios
from pyspark.errors import PySparkException
from pyspark.sql import SparkSession


@pytest.fixture
def sc():
    estagios.zerar()
    return SparkSession.builder.master('local[4]').appName('teste').getOrCreate().sparkContext


def test_parallelize_divide_como_o_pyspark(sc):
    assert sc.defaultParallelism == 4
    assert sc.parallelize(range(10), 4).glom().collect() == [[0, 1], [2, 3, 4], [5, 6], [7, 8, 9]]
    assert sc.parallelize(list(range(10)), 4).glom().collect() == [[0, 1], [2, 3], [4, 5], [6, 7, 8, 9]]
    assert sc.parallelize([1, 2, 3]).glom().collect() == [[], [1], [2], [3]]
    assert sc.parallelize([1, 2, 3]).getNumPartitions() == 4


def test_transformacoes_e_acoes(sc):
    rdd = sc.parallelize(range(1, 11))
    assert rdd.filter(lambda x: x % 2 == 0).map(lambda x: x * x).collect() == [4, 16, 36, 64, 100]
    assert rdd.reduce(lambda a, b: a + b) == 55
    assert (rdd.count(), rdd.sum(), rdd.take(3), rdd.first(), rdd.max(), rdd.mean()) == (10, 55, [1, 2, 3], 1, 10, 5.5)
    assert rdd.flatMap(lambda x: [x] * 2).count() == 20
    assert rdd.mapPartitions(lambda it: [sum(it)]).collect() == [3, 12, 13, 27]
    assert rdd.mapPartitionsWithIndex(lambda i, it: [i]).collect() == [0, 1, 2, 3]
    assert sc.parallelize(['a b', 'c']).flatMap(str.split).collect() == ['a', 'b', 'c']


def test_pares_e_shuffle(sc):
    palavras = sc.parallelize(['sol', 'mar', 'sol', 'rio', 'sol', 'mar'])
    contagem = palavras.map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b)
    assert sorted(contagem.collect()) == [('mar', 2), ('rio', 1), ('sol', 3)]
    assert contagem.getNumPartitions() == 4
    grupos = palavras.map(lambda p: (len(p), p)).groupByKey().collect()
    assert [(k, sorted(v)) for k, v in grupos] == [(3, ['mar', 'mar', 'rio', 'sol', 'sol', 'sol'])]
    assert palavras.distinct().sortBy(lambda p: p).collect() == ['mar', 'rio', 'sol']
    assert palavras.countByValue() == {'sol': 3, 'mar': 2, 'rio': 1}
    nomes = sc.parallelize([(1, 'a'), (2, 'b')])
    assert sorted(nomes.join(sc.parallelize([(1, 10), (1, 11), (3, 30)])).collect()) == [(1, ('a', 10)), (1, ('a', 11))]
    assert sorted(nomes.leftOuterJoin(sc.parallelize([(1, 10)])).collect()) == [(1, ('a', 10)), (2, ('b', None))]
    assert sc.parallelize([1, 2]).union(sc.parallelize([3])).collect() == [1, 2, 3]
    assert sc.parallelize([('b', 2), ('a', 1), ('c', 0)]).sortByKey().collect() == [('a', 1), ('b', 2), ('c', 0)]
    assert sc.parallelize([5, 1, 4]).sortBy(lambda x: x, ascending=False).collect() == [5, 4, 1]
    assert sorted(sc.parallelize([('a', 1), ('a', 3)]).mapValues(lambda v: v * 10).collect()) == [('a', 10), ('a', 30)]


def test_o_shuffle_e_deterministico(sc):
    um = sc.parallelize(['caju', 'umbu', 'pequi', 'ata'] * 3).map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b).glom().collect()
    estagios.zerar()
    dois = SparkSession.builder.getOrCreate().sparkContext.parallelize(['caju', 'umbu', 'pequi', 'ata'] * 3) \
        .map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b).glom().collect()
    assert um == dois


def test_estagios_e_metricas(sc):
    rdd = sc.parallelize(range(8), 4).map(lambda x: (x % 2, x)).reduceByKey(lambda a, b: a + b)
    assert sorted(rdd.collect()) == [(0, 12), (1, 16)]
    resumo = estagios.resumo()
    job = resumo['jobs'][-1]
    assert job['acao'] == 'collect'
    assert [e['tipo'] for e in job['estagios']] == ['shuffle', 'resultado']
    assert [len(e['tarefas']) for e in job['estagios']] == [4, 4]
    mapa = job['estagios'][0]
    assert mapa['nome'] == 'parallelize → map → reduceByKey'
    assert mapa['linhas_embaralhadas'] == 8  # combina no lado do map: 2 chaves em cada uma das 4 partições
    assert {'particao', 'worker', 'linhas', 'inicio', 'fim'} <= set(mapa['tarefas'][0])
    assert resumo['shuffles'] == 1


def test_cache_le_do_que_ja_foi_calculado(sc):
    rdd = sc.parallelize(range(4), 2).map(lambda x: x * 10).cache()
    assert rdd.is_cached
    assert rdd.collect() == [0, 10, 20, 30]
    assert rdd.map(lambda x: x + 1).collect() == [1, 11, 21, 31]
    assert estagios.resumo()['jobs'][-1]['estagios'][0]['nome'] == 'cache → map'


def test_text_file_le_na_pasta_atual(sc, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / 'frases.txt').write_text('o sertão\nvai virar mar\n', encoding='utf-8')
    linhas = sc.textFile('frases.txt')
    assert linhas.getNumPartitions() == 2
    assert linhas.collect() == ['o sertão', 'vai virar mar']
    with pytest.raises(PySparkException) as e:
        sc.textFile('nao_existe.txt').collect()
    assert e.value.getErrorClass() == 'PATH_NOT_FOUND'


def test_erro_na_lambda_sobe_com_o_mesmo_tipo(sc):
    with pytest.raises(ZeroDivisionError):
        sc.parallelize([1, 0]).map(lambda x: 1 // x).collect()
    with pytest.raises(ValueError, match='Can not reduce\\(\\) empty RDD'):
        sc.parallelize([]).reduce(lambda a, b: a + b)
