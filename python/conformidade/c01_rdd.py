"""RDD: partições do parallelize, transformações, pares, shuffle e textFile."""
import os

from _comum import sessao, tmp

spark = sessao()
sc = spark.sparkContext

print('glom range', sc.parallelize(range(10), 4).glom().collect())
print('glom lista', sc.parallelize(list(range(10)), 4).glom().collect())
print('glom 3', sc.parallelize([1, 2, 3]).glom().collect())
print('glom range 7 em 3', sc.parallelize(range(7), 3).glom().collect())
print('partições', sc.parallelize([1, 2, 3]).getNumPartitions(), sc.defaultParallelism)

rdd = sc.parallelize(range(1, 11))
print('quadrados dos pares', rdd.filter(lambda x: x % 2 == 0).map(lambda x: x * x).collect())
print('reduce', rdd.reduce(lambda a, b: a + b), 'count', rdd.count(), 'take', rdd.take(3), 'first', rdd.first())
print('soma por partição', rdd.mapPartitions(lambda it: [sum(it)]).collect())
print('flatMap', sc.parallelize(['a b', 'c']).flatMap(lambda s: s.split()).collect())

palavras = sc.parallelize(['sol', 'mar', 'sol', 'rio', 'sol', 'mar'])
contagem = palavras.map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b)
print('reduceByKey', sorted(contagem.collect()), contagem.getNumPartitions())
print('groupByKey', sorted((k, sorted(v)) for k, v in palavras.map(lambda p: (p[0], p)).groupByKey().collect()))
print('distinct + sortBy', palavras.distinct().sortBy(lambda p: p).collect())
print('sortBy desc', sc.parallelize([5, 1, 4]).sortBy(lambda x: x, ascending=False).collect())
print('sortByKey', sc.parallelize([('b', 2), ('a', 1), ('c', 0)]).sortByKey().collect())
print('countByValue', sorted(palavras.countByValue().items()))
print('join', sorted(sc.parallelize([(1, 'a'), (2, 'b')]).join(sc.parallelize([(1, 10), (1, 11), (3, 30)])).collect()))
print('leftOuterJoin', sorted(sc.parallelize([(1, 'a'), (2, 'b')]).leftOuterJoin(sc.parallelize([(1, 10)])).collect()))
print('union', sc.parallelize([1, 2]).union(sc.parallelize([3])).collect())
print('mapValues', sorted(sc.parallelize([('a', 1), ('a', 3)]).mapValues(lambda v: v * 10).collect()))

arquivo = os.path.join(tmp(), 'frases.txt')
with open(arquivo, 'w', encoding='utf-8') as f:
    f.write('o sertão\nvai virar mar\ne o mar\nvai virar sertão\n')
linhas = sc.textFile(arquivo)
print('textFile', linhas.getNumPartitions(), linhas.collect())
print('palavras do texto', sorted(linhas.flatMap(str.split).map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b).collect()))

spark.stop()
