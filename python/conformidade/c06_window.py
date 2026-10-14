"""Funções de janela: ranking, lag/lead, somas acumuladas, médias móveis e agregação por partição."""
from pyspark.sql import Window
from pyspark.sql import functions as F

from _comum import sessao

spark = sessao()

lojas = spark.createDataFrame([('NE', 'a', 10), ('NE', 'b', 30), ('NE', 'c', 20), ('S', 'd', 5), ('S', 'e', 7)], ['regiao', 'loja', 'receita'])
w = Window.partitionBy('regiao').orderBy(F.desc('receita'))
lojas.select('regiao', 'loja', 'receita',
             F.row_number().over(w).alias('rn'), F.rank().over(w).alias('rk'), F.dense_rank().over(w).alias('dr'),
             F.lag('receita').over(w).alias('anterior'), F.lead('receita', 1, 0).over(w).alias('proximo'),
             F.sum('receita').over(Window.partitionBy('regiao')).alias('total_regiao')).orderBy('loja').show()

notas = spark.createDataFrame([('Ana', 9), ('Bia', 7), ('Caio', 9), ('Davi', 6)], ['nome', 'nota'])
notas.select('nome', 'nota', F.rank().over(Window.orderBy(F.desc('nota'))).alias('rank'),
             F.dense_rank().over(Window.orderBy(F.desc('nota'))).alias('dense')).orderBy('nome').show()

dias = spark.createDataFrame([(1, 10), (2, 20), (3, 30), (4, 40), (5, 50)], ['dia', 'v'])
w2 = Window.orderBy('dia')
dias.select('dia', 'v',
            F.sum('v').over(w2.rowsBetween(Window.unboundedPreceding, Window.currentRow)).alias('acumulado'),
            F.avg('v').over(w2.rowsBetween(-2, 0)).alias('media_3'),
            F.count('*').over(w2.rowsBetween(-1, 1)).alias('vizinhos'),
            (F.col('v') - F.lag('v').over(w2)).alias('variacao')).orderBy('dia').show()

empates = spark.createDataFrame([(1, 1), (1, 2), (2, 3)], ['k', 'v'])
print([r.s for r in empates.select(F.sum('v').over(Window.orderBy('k')).alias('s')).orderBy('s').collect()])
lojas.withColumn('pos', F.row_number().over(w)).filter(F.col('pos') == 1).select('regiao', 'loja').orderBy('regiao').show()

spark.stop()
