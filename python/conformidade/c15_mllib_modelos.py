"""MLlib: regressão logística, árvore de decisão, KMeans e os avaliadores (com tolerância nos números)."""
import math
import random

from _comum import sessao
from pyspark.ml.classification import DecisionTreeClassifier, LogisticRegression
from pyspark.ml.clustering import KMeans
from pyspark.ml.evaluation import BinaryClassificationEvaluator, ClusteringEvaluator, MulticlassClassificationEvaluator
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.linalg import Vectors

spark = sessao()
sorteio = random.Random(11)


def safra(n):
    linhas = []
    for _ in range(n):
        chuva, irrigado = round(sorteio.uniform(200, 900), 1), float(sorteio.random() < 0.3)
        logito = 4.0 - 0.009 * chuva - 2.0 * irrigado
        risco = 1.0 if sorteio.random() < 1 / (1 + math.exp(-logito)) else 0.0
        linhas.append((chuva, irrigado, risco))
    df = spark.createDataFrame(linhas, ['chuva_mm', 'irrigado', 'label'])
    return VectorAssembler(inputCols=['chuva_mm', 'irrigado'], outputCol='features').transform(df)


treino, teste = safra(120), safra(40)
lr = LogisticRegression().fit(treino)
print([round(float(c), 3) for c in lr.coefficients], round(lr.intercept, 3), round(lr.summary.areaUnderROC, 3))
lr2 = LogisticRegression(regParam=0.1).fit(treino)
print([round(float(c), 3) for c in lr2.coefficients], round(lr2.intercept, 3))
p = lr.transform(teste)
print([round(float(x), 3) for x in p.first().probability], p.first().prediction)
print(round(BinaryClassificationEvaluator().evaluate(p), 3),
      round(BinaryClassificationEvaluator(metricName='areaUnderPR').evaluate(p), 3))
print(round(MulticlassClassificationEvaluator(metricName='accuracy').evaluate(p), 3),
      round(MulticlassClassificationEvaluator().evaluate(p), 3))

arvore = DecisionTreeClassifier(maxDepth=3).fit(treino)
print(arvore.depth, arvore.numNodes, [r.prediction for r in arvore.transform(teste).collect()])
print([round(float(x), 3) for x in arvore.featureImportances.toArray()])

centros = [(0.0, 0.0), (10.0, 10.0), (0.0, 10.0)]
pontos = spark.createDataFrame([(Vectors.dense([cx + sorteio.gauss(0, 0.5), cy + sorteio.gauss(0, 0.5)]),)
                                for cx, cy in centros for _ in range(20)], ['features'])
km = KMeans(k=3, seed=1).fit(pontos)
print(sorted(km.summary.clusterSizes), sorted([round(float(x), 1) for x in c] for c in km.clusterCenters()))
print(f'{km.summary.trainingCost:.4g}', round(ClusteringEvaluator().evaluate(km.transform(pontos)), 3))
spark.stop()
