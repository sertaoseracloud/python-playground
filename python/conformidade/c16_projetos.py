"""Projetos: percentile_approx, wholeTextFiles e o CAST de timestamp para segundos."""
import os

from pyspark.sql import Window
from pyspark.sql import functions as F

from _comum import sessao, tmp

spark = sessao()
pasta = tmp()

notas = spark.createDataFrame([('A', 9.0), ('A', 7.0), ('A', 5.0), ('B', 6.0), ('B', 8.0), ('B', 4.0), ('C', 10.0), ('C', 3.0)], ['turma', 'nota'])
notas.agg(*[F.percentile_approx('nota', p).alias(f'p{i}') for i, p in enumerate((0.0, 0.25, 0.5, 0.75, 0.9, 1.0))]).show()
notas.groupBy('turma').agg(F.percentile_approx('nota', 0.5).alias('mediana')).orderBy('turma').show()
print(notas.agg(F.percentile_approx('nota', [0.1, 0.5, 0.95])).first()[0])
ms = spark.createDataFrame([(120,), (100,), (None,), (30,), (140,)], 'ms INT')
r = ms.agg(F.percentile_approx('ms', 0.95).alias('p95'))
print(r.dtypes, r.first().p95)
print(spark.createDataFrame([], 'x DOUBLE').agg(F.percentile_approx('x', 0.5)).first()[0])

livros = os.path.join(pasta, 'livros')
os.makedirs(livros)
for nome, texto in (('b.txt', 'mar\n'), ('a.txt', 'sertão\nseca\n')):
    with open(os.path.join(livros, nome), 'w', encoding='utf-8', newline='') as f:
        f.write(texto)
pares = spark.sparkContext.wholeTextFiles(livros).collect()
print(sorted((caminho.rsplit('/', 1)[-1], texto) for caminho, texto in pares))
print(all(c.startswith('file:') for c, _ in pares))
df = spark.sparkContext.wholeTextFiles(livros).toDF(['caminho', 'texto'])
df.select(F.regexp_extract('caminho', r'([^/]+)\.txt$', 1).alias('livro')).orderBy('livro').show()

t = (spark.createDataFrame([('x', '2026-10-15 09:00:05'), ('x', '2026-10-15 09:10:00'), ('x', '2026-10-15 10:40:00')], ['ip', 'm'])
     .withColumn('m', F.to_timestamp('m')))
s = F.col('m').cast('long')
t.select((s - F.lag(s).over(Window.partitionBy('ip').orderBy('m'))).alias('intervalo')).show()
print(t.select(s.alias('s')).dtypes)

spark.stop()
