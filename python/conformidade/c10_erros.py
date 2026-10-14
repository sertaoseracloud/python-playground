"""Mensagens de erro no formato do Spark 4 (a primeira linha e o tipo da exceção)."""
import os

from pyspark.sql import Window
from pyspark.sql import functions as F

from _comum import erro, sessao, tmp

spark = sessao()

df = spark.createDataFrame([('Ana', 30, 'Recife')], ['nome', 'idade', 'cidade'])
df.createOrReplaceTempView('pessoas')

erro(lambda: df.select('idadee'))
erro(lambda: df.filter(F.col('cidadee') == 'Recife'))
erro(lambda: df.groupBy('cidade').agg(F.sum('idad')))
erro(lambda: spark.sql('SELECT * FROM pessoass'))
erro(lambda: spark.sql('SELECT nome, SUM(idade) FROM pessoas GROUP BY cidade'))
erro(lambda: spark.sql('SELECT * FORM pessoas'))
erro(lambda: spark.read.csv(os.path.join(tmp(), 'nao_existe.csv')))
outro = spark.createDataFrame([(1, 'x')], ['id', 'v'])
junto = outro.alias('a').join(outro.alias('b'), F.col('a.id') == F.col('b.id'))
erro(lambda: junto.select('id'))
erro(lambda: df.union(outro))
erro(lambda: print(spark.createDataFrame([(1,), ('a',)], ['x']).dtypes))
erro(lambda: spark.createDataFrame([(None,)], ['x']))
erro(lambda: df.select(F.row_number().over(Window.partitionBy('cidade'))).collect())

spark.stop()
