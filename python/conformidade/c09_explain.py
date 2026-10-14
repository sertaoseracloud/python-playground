"""A forma do plano (explain) e o número de partições."""
from pyspark.sql import Window
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType

from _comum import operadores, sessao

spark = sessao()

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]
df = spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])

print('filter', operadores(df.filter(F.col('preco') > 10).select('produto')))
print('groupBy', operadores(df.groupBy('regiao').sum('quantidade')))
print('groupBy + orderBy', operadores(df.groupBy('regiao').count().orderBy('count')))
print('orderBy', operadores(df.orderBy(F.desc('preco'))))
print('repartition', operadores(df.repartition(3)))
print('repartition col', operadores(df.repartition(2, 'regiao')))
print('distinct', operadores(df.distinct()))
print('agg global', operadores(df.agg(F.sum('quantidade'))))
print('janela', operadores(df.withColumn('rn', F.row_number().over(Window.partitionBy('regiao').orderBy('preco')))))
print('janela sem partição', operadores(df.withColumn('rn', F.row_number().over(Window.orderBy('preco')))))
dobro = F.udf(lambda x: x * 2, IntegerType())
print('udf', operadores(df.select(dobro('quantidade'))))

guardado = df.groupBy('regiao').count().cache()
guardado.count()
print('cache', operadores(guardado))
print('cache + orderBy', operadores(guardado.orderBy('regiao')))
print(guardado.is_cached, guardado.storageLevel)

print('partições', df.rdd.getNumPartitions(), df.repartition(3).rdd.getNumPartitions(), df.coalesce(1).rdd.getNumPartitions(),
      df.groupBy('regiao').count().rdd.getNumPartitions(), df.repartition(2, 'regiao').rdd.getNumPartitions(),
      df.union(df).rdd.getNumPartitions(), spark.range(10).rdd.getNumPartitions())
spark.conf.set('spark.sql.shuffle.partitions', '8')
print('shuffle 8', df.groupBy('produto').count().rdd.getNumPartitions())  # groupBy('regiao') já está em cache

spark.stop()
