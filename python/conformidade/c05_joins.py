"""Joins: os tipos, a coluna da chave, e quando o Spark usa broadcast ou sort-merge."""
from pyspark.sql import functions as F

from _comum import operadores, sessao

spark = sessao()

cli = spark.createDataFrame([(1, 'Ana', 'Recife'), (2, 'Bia', 'Natal'), (3, 'Caio', 'Recife')], ['id', 'nome', 'cidade'])
ped = spark.createDataFrame([(10, 1, 50.0), (11, 1, 20.0), (12, 3, 10.0), (13, 4, 5.0)], ['pedido', 'id', 'valor'])

for como in ('inner', 'left', 'right', 'full', 'left_semi', 'left_anti'):
    j = cli.join(ped, 'id', como)
    print(como, j.columns)
    j.orderBy('id', *[c for c in j.columns if c == 'pedido']).show()

e = cli.join(ped, cli.id == ped.id)
print(e.columns)
e.select(cli.nome, ped.valor).orderBy('valor').show()
cli.join(ped, ['id'], 'inner').groupBy('nome').agg(F.sum('valor').alias('total')).orderBy('nome').show()
cli.alias('c').join(ped.alias('p'), F.col('c.id') == F.col('p.id'), 'left').select('c.nome', 'p.valor').orderBy('nome', 'valor').show()
cli.crossJoin(spark.createDataFrame([('x',), ('y',)], ['letra'])).orderBy('id', 'letra').select('id', 'letra').show()

print('createDataFrame', operadores(cli.join(ped, 'id')))
print('hint', operadores(cli.join(F.broadcast(ped), 'id')))
print('range', operadores(spark.range(100).join(spark.range(10), 'id')))
spark.conf.set('spark.sql.autoBroadcastJoinThreshold', '-1')
print('sem broadcast', operadores(spark.range(100).join(spark.range(10), 'id')))
print('hint sem limite', operadores(spark.range(100).join(F.broadcast(spark.range(10)), 'id')))
print(spark.range(100).join(spark.range(10), 'id').count())

spark.stop()
