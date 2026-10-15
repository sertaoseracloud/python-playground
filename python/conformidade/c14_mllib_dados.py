"""MLlib: vetores, features, regressão linear, avaliação e randomSplit (com tolerância nos números)."""
import random

from _comum import sessao
from pyspark.ml import Pipeline
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.feature import OneHotEncoder, StandardScaler, StringIndexer, VectorAssembler
from pyspark.ml.linalg import Vectors
from pyspark.ml.regression import LinearRegression

spark = sessao()
sorteio = random.Random(7)
BASE = {'milho': 3.0, 'feijao': 1.0, 'mandioca': 5.0}
linhas = []
for i in range(60):
    cultura = list(BASE)[i % 3]
    chuva, area, irrigado = round(sorteio.uniform(300, 900), 1), round(sorteio.uniform(1, 20), 1), i % 4 == 0
    producao = round(0.004 * chuva + 1.8 * area + (2.5 if irrigado else 0.0) + BASE[cultura] + sorteio.gauss(0, 0.8), 2)
    linhas.append((f'm{i % 7}', cultura, chuva, area, irrigado, producao))
safra = spark.createDataFrame(linhas, 'municipio STRING, cultura STRING, chuva_mm DOUBLE, area_ha DOUBLE, irrigado BOOLEAN, producao_t DOUBLE')


def r4(xs):
    return [round(float(x), 4) for x in xs]


v = spark.createDataFrame([(Vectors.dense([1.0, 0.0, 3.5]), Vectors.sparse(4, [1, 3], [2.0, 1.0]))], ['d', 's'])
v.show(truncate=False)
print(v.dtypes)
print(VectorAssembler(inputCols=['chuva_mm', 'area_ha'], outputCol='x').transform(safra).select('x').first().x)
VectorAssembler(inputCols=['a', 'b', 'c', 'd'], outputCol='v').transform(
    spark.createDataFrame([(0.0, 0.0, 0.0, 5.0)], ['a', 'b', 'c', 'd'])).show(truncate=False)

indexador = StringIndexer(inputCol='cultura', outputCol='ci').fit(safra)
print(indexador.labels)
indexada = indexador.transform(safra)
OneHotEncoder(inputCols=['ci'], outputCols=['cv']).fit(indexada).transform(indexada) \
    .select('cultura', 'cv').distinct().orderBy('cultura').show(truncate=False)

montada = VectorAssembler(inputCols=['chuva_mm', 'area_ha'], outputCol='x').transform(safra)
escala = StandardScaler(inputCol='x', outputCol='xs', withMean=True).fit(montada)
print(r4(escala.mean), r4(escala.std))

treino = VectorAssembler(inputCols=['chuva_mm', 'area_ha'], outputCol='features').transform(safra) \
    .withColumnRenamed('producao_t', 'label')
m = LinearRegression().fit(treino)
print(r4(m.coefficients), round(m.intercept, 4), round(m.summary.rootMeanSquaredError, 4), round(m.summary.r2, 4))
m2 = LinearRegression(regParam=0.5).fit(treino)
print(r4(m2.coefficients), round(m2.intercept, 4))
previsoes = m.transform(treino)
print([round(RegressionEvaluator(metricName=n).evaluate(previsoes), 4) for n in ('rmse', 'mse', 'mae', 'r2')])

pipe = Pipeline(stages=[StringIndexer(inputCol='cultura', outputCol='ci'), OneHotEncoder(inputCols=['ci'], outputCols=['cv']),
                        VectorAssembler(inputCols=['chuva_mm', 'area_ha', 'cv'], outputCol='features'),
                        LinearRegression(labelCol='producao_t')]).fit(safra)
print([type(s).__name__ for s in pipe.stages], [round(float(c), 3) for c in pipe.stages[-1].coefficients])
a, b = safra.randomSplit([0.7, 0.3], seed=42)
print(a.count() + b.count(), abs(a.count() / 60 - 0.7) <= 0.15)
spark.stop()
