"""unpivot e melt: do formato largo para o longo, com a ordem das linhas e os tipos do Spark."""
from pyspark.sql import functions as F

from _comum import sessao

spark = sessao()

largo = spark.createDataFrame([('soja', 36, 41, 43), ('milho', 23, 25, 30)], ['cultura', '2023', '2024', '2025'])
longo = largo.unpivot('cultura', ['2023', '2024', '2025'], 'ano', 'toneladas')
print(longo.dtypes)
longo.show()
longo.withColumn('ano', F.col('ano').cast('int')).orderBy('ano', 'cultura').show()
print(largo.melt(['cultura'], None, 'ano', 'toneladas').count())
misto = spark.createDataFrame([(1, 2, 2.5)], 'id INT, a INT, b DOUBLE')
print(misto.unpivot('id', ['a', 'b'], 'k', 'v').dtypes, misto.unpivot('id', ['a', 'b'], 'k', 'v').collect())

spark.stop()
