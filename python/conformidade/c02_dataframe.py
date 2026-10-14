"""DataFrame: schema inferido, printSchema, show (com truncamento e valores especiais) e nomes das colunas."""
import datetime

from pyspark.sql import Row
from pyspark.sql import functions as F

from _comum import sessao

spark = sessao()

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]
df = spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])
print(df.dtypes)
print(repr(df))
df.printSchema()
df.show()
df.show(2)
df.select('produto').show(1, truncate=False)
df.orderBy('produto').show(truncate=3)
print(df.columns, df.count())
print(df.rdd.getNumPartitions())
print(df.orderBy('produto').first())
print(df.orderBy('produto').take(2))

ddl = spark.createDataFrame([(1, 'Ana', 9.5)], 'id INT, nome STRING, nota DOUBLE')
print(ddl.dtypes)
ddl.printSchema()
print(spark.createDataFrame([Row(nome='Ana', idade=3)]).dtypes)
print(spark.createDataFrame([{'b': 1, 'a': 'x'}]).columns)

especiais = spark.createDataFrame(
    [('um texto bem comprido demais', None, 10000000.0, True, datetime.date(2026, 10, 13), ['a', 'b'], 0.1 + 0.2, 0.0001)],
    'texto string, nada string, grande double, ok boolean, dia date, tags array<string>, soma double, pequeno double')
especiais.show()
especiais.printSchema()
especiais.show(truncate=False)

print(df.select(F.col('quantidade') * F.col('preco'), F.col('preco') > 10, F.upper('regiao'),
                F.when(F.col('quantidade') > 2, 'muito').otherwise('pouco'), F.col('quantidade').isin(1, 2),
                F.col('quantidade').cast('int'), (F.col('quantidade') + 1).alias('mais_um')).columns)
print(df.selectExpr('CAST(quantidade AS INT)', 'quantidade * 2', 'upper(produto) AS p').columns)
print(df.select(F.col('quantidade').between(1, 2), F.col('regiao').isNull(), ~(F.col('preco') > 1)).columns)
r = df.select('produto', (F.col('quantidade') * F.col('preco')).alias('total')).orderBy('produto')
r.show()
r.printSchema()
print([x.total for x in r.collect()])
df.select(F.lit(1).alias('um'), F.lit('x').alias('xis'), F.lit(None).alias('nulo')).printSchema()

spark.stop()
