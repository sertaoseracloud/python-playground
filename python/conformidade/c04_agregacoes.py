"""Agregações: groupBy/agg (nomes e valores), pivot, ordenação com nulos, distinct e dropDuplicates."""
from pyspark.sql import functions as F

from _comum import sessao

spark = sessao()

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5),
          ('Arroz', 'Sul', 4, 23.0)]
df = spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])

r = (df.groupBy('regiao')
     .agg(F.sum('quantidade'), F.round(F.avg('preco'), 2).alias('preco_medio'), F.count('*'), F.countDistinct('produto'), F.max('preco'))
     .orderBy('regiao'))
print(r.columns)
print(r.dtypes)
r.show()
df.groupBy('regiao').count().orderBy(F.desc('count'), 'regiao').show()
df.groupBy('produto').agg({'quantidade': 'sum', 'preco': 'max'}).orderBy('produto').show()
df.groupBy().sum('quantidade').show()
df.agg(F.min('preco'), F.avg('quantidade')).show()
df.groupBy('regiao').agg(F.sort_array(F.collect_list('produto')).alias('produtos')).orderBy('regiao').show()
df.groupBy('regiao').agg(F.sum(F.col('quantidade') * F.col('preco')).alias('receita')).orderBy(F.desc('receita')).show()

meses = spark.createDataFrame([('caju', 'jan', 3), ('caju', 'fev', 1), ('umbu', 'jan', 2), ('umbu', 'mar', 5)], ['fruta', 'mes', 'qtd'])
meses.groupBy('fruta').pivot('mes').sum('qtd').orderBy('fruta').show()
meses.groupBy('fruta').pivot('mes', ['jan', 'fev']).agg(F.sum('qtd')).orderBy('fruta').show()
meses.groupBy('fruta').pivot('mes').agg(F.sum('qtd').alias('s'), F.count('qtd').alias('n')).orderBy('fruta').show()

nulos = spark.createDataFrame([(1, None), (2, 5), (3, 1), (4, 5)], 'id bigint, v bigint')
print([x.id for x in nulos.orderBy('v', 'id').collect()])
print([x.id for x in nulos.orderBy(F.desc('v'), 'id').collect()])
print([x.id for x in nulos.orderBy(F.col('v').asc_nulls_last(), 'id').collect()])
print([x.id for x in nulos.orderBy(['v', 'id'], ascending=[False, True]).collect()])
print(df.select('regiao').distinct().count(), df.dropDuplicates(['produto']).count(), df.distinct().count())
nulos.groupBy('v').count().orderBy('v').show()

spark.stop()
