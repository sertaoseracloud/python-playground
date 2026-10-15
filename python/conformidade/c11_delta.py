"""Delta Lake: escrita, versões, time travel, update, delete, merge, schema, vacuum e optimize."""
import os

from pyspark.sql import functions as F

from _comum import sessao_delta, tmp

spark = sessao_delta()
from delta.tables import DeltaTable  # noqa: E402 — depois da sessão, como no delta-spark

caminho = os.path.join(tmp(), 'estoque')
linhas = lambda df: sorted((tuple(r) for r in df.collect()), key=str)  # noqa: E731 — str: há None (mergeSchema)

estoque = spark.createDataFrame([('arroz', 10, 24.9), ('feijao', 4, 8.5), ('cafe', 7, 19.9)], ['produto', 'qtd', 'preco'])
estoque.write.format('delta').save(caminho)
spark.createDataFrame([('milho', 3, 5.0)], ['produto', 'qtd', 'preco']).write.format('delta').mode('append').save(caminho)
t = DeltaTable.forPath(spark, caminho)
print(t.toDF().count(), spark.read.format('delta').option('versionAsOf', 0).load(caminho).count())

t.update('produto = "cafe"', {'preco': 'preco * 2'})
t.delete(F.col('qtd') < 5)
print(linhas(t.toDF()))

dia = spark.createDataFrame([('cafe', 9, 21.0), ('sal', 2, 2.0)], ['produto', 'qtd', 'preco'])
(t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto')
  .whenMatchedUpdate(set={'qtd': 'e.qtd + d.qtd', 'preco': 'd.preco'})
  .whenNotMatchedInsertAll().execute())
print(linhas(t.toDF()))

novo = spark.createDataFrame([('sal', 1, 2.0, 'Crato')], ['produto', 'qtd', 'preco', 'cidade'])
try:
    novo.write.format('delta').mode('append').save(caminho)
except Exception as e:  # noqa: BLE001
    print(type(e).__name__, 'schema mismatch' in str(e).lower())
novo.write.format('delta').mode('append').option('mergeSchema', 'true').save(caminho)
print(t.toDF().columns, t.toDF().count())  # a DeltaTable antiga: as linhas novas, o schema de quando foi criada
t = DeltaTable.forPath(spark, caminho)
print(t.toDF().columns, linhas(t.toDF().select('produto', 'cidade')))

h = t.history().orderBy('version').collect()
print([(r.version, r.operation) for r in h])
print([r.operationParameters['mode'] for r in h if r.operation == 'WRITE'])
print(spark.read.format('delta').option('versionAsOf', 2).load(caminho).count())

try:
    t.vacuum(0)
except Exception as e:  # noqa: BLE001
    print('vacuum recusou', 'retention' in str(e).lower())

for i in range(3):
    spark.createDataFrame([(f'p{i}', i, 1.0, None)], 'produto STRING, qtd BIGINT, preco DOUBLE, cidade STRING') \
        .write.format('delta').mode('append').save(caminho)
t.optimize().executeCompaction()
print(t.history(1).first().operation, t.toDF().count())

spark.stop()
