"""pyspark.ml.regression: LinearRegression pelas equações normais (o solver "normal" do Spark).

Cada partição soma, num worker, n, Σx, Σy, Σxxᵀ, Σxy e Σy²; o processo principal junta e resolve o
sistema. Com regParam, a penalidade L2 é a do Spark: λ/σy · ½ Σ (σj wj)², com os desvios da
população e a padronização ligada (o padrão)."""
import math

from ..errors import IllegalArgumentException
from ..sql import types as T
from ._algebra import resolver
from .base import Estimator, Model, coluna_nova, exigir_vetor, por_particao
from .evaluation import metricas_de_regressao
from .linalg import DenseVector


class _SomasLineares:
    def __call__(self, linhas):
        n, sx, sy, sxx, sxy, syy = 0, None, 0.0, None, None, 0.0
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray()
            if sx is None:
                p = len(x)
                sx, sxy, sxx = [0.0] * p, [0.0] * p, [[0.0] * p for _ in range(p)]
            n += 1
            sy += y
            syy += y * y
            for i, xi in enumerate(x):
                sx[i] += xi
                sxy[i] += xi * y
                linha = sxx[i]
                for j in range(i, len(x)):  # só a metade de cima: a matriz é simétrica
                    linha[j] += xi * x[j]
        return [(n, sx, sy, sxx, sxy, syy)] if n else []


def _juntar(partes):
    p = len(partes[0][1])
    n = sum(q[0] for q in partes)
    sx = [sum(q[1][i] for q in partes) for i in range(p)]
    sxx = [[sum(q[3][i][j] for q in partes) if j >= i else 0.0 for j in range(p)] for i in range(p)]
    for i in range(p):
        for j in range(i):
            sxx[i][j] = sxx[j][i]
    sxy = [sum(q[4][i] for q in partes) for i in range(p)]
    return n, sx, sum(q[2] for q in partes), sxx, sxy, sum(q[5] for q in partes)


class LinearRegression(Estimator):
    _padroes = {'featuresCol': 'features', 'labelCol': 'label', 'predictionCol': 'prediction', 'maxIter': 100,
                'regParam': 0.0, 'elasticNetParam': 0.0, 'tol': 1e-6, 'fitIntercept': True, 'standardization': True,
                'solver': 'auto', 'weightCol': None, 'loss': 'squaredError', 'aggregationDepth': 2}

    def _fit(self, df):
        if self.getOrDefault('elasticNetParam'):
            raise NotImplementedError('O DivergePython treina só com a penalidade L2 (elasticNetParam=0).')
        f, rotulo = self.getOrDefault('featuresCol'), self.getOrDefault('labelCol')
        exigir_vetor(df, f)
        partes = por_particao(df.select(f, rotulo), _SomasLineares(), 'fit LinearRegression')
        if not partes:
            raise IllegalArgumentException('requirement failed: Nothing has been added to this summarizer.')
        n, sx, sy, sxx, sxy, syy = _juntar(partes)
        p = len(sx)
        mx, my = [s / n for s in sx], sy / n
        com_intercepto = self.getOrDefault('fitIntercept')
        if com_intercepto:
            a = [[sxx[i][j] / n - mx[i] * mx[j] for j in range(p)] for i in range(p)]
            b = [sxy[i] / n - mx[i] * my for i in range(p)]
        else:
            a = [[sxx[i][j] / n for j in range(p)] for i in range(p)]
            b = [sxy[i] / n for i in range(p)]
        desvio_y = math.sqrt(max(syy / n - my * my, 0.0))
        lam = self.getOrDefault('regParam')
        if lam and desvio_y > 0:
            efetivo = lam / desvio_y
            for i in range(p):
                a[i][i] += efetivo * ((sxx[i][i] / n - mx[i] ** 2) if self.getOrDefault('standardization') else 1.0)
        w = resolver(a, b) if desvio_y > 0 else [0.0] * p  # rótulo constante: só o intercepto, como o Spark
        intercepto = my - sum(wi * m for wi, m in zip(w, mx)) if com_intercepto else 0.0
        return LinearRegressionModel(DenseVector(w), intercepto, self, df)


class _Prever:
    def __init__(self, coeficientes, intercepto):
        self.coeficientes, self.intercepto = coeficientes, intercepto

    def __call__(self, v):
        if v is None:
            return None
        return sum(c * x for c, x in zip(self.coeficientes, v.toArray())) + self.intercepto


class LinearRegressionModel(Model):
    _padroes = LinearRegression._padroes

    def __init__(self, coeficientes, intercepto, estimador, treino):
        super().__init__(**estimador._valores)
        self.coefficients, self.intercept, self._treino, self._resumo = coeficientes, intercepto, treino, None

    @property
    def numFeatures(self):
        return self.coefficients.size

    def predict(self, value):
        return _Prever(self.coefficients.toArray(), self.intercept)(value)

    def _transform(self, df):
        impl = _Prever(self.coefficients.toArray(), self.intercept)
        return coluna_nova(df, self.getOrDefault('predictionCol'), impl, [self.getOrDefault('featuresCol')], T.DoubleType())

    @property
    def hasSummary(self):
        return True

    @property
    def summary(self):
        if self._resumo is None:
            self._resumo = self.evaluate(self._treino)
        return self._resumo

    def evaluate(self, dataset):
        return LinearRegressionSummary(self.transform(dataset), self.getOrDefault('predictionCol'), self.getOrDefault('labelCol'))


class LinearRegressionSummary:
    """As métricas no treino (ou no evaluate), calculadas na primeira vez que alguém pede."""

    def __init__(self, predictions, previsao, rotulo):
        self.predictions, self.predictionCol, self.labelCol = predictions, previsao, rotulo
        self._m = None

    def _metricas(self):
        if self._m is None:
            pares = self.predictions.select(self.predictionCol, self.labelCol)._linhas('resumo LinearRegression')
            self._m = metricas_de_regressao(pares)
        return self._m

    rootMeanSquaredError = property(lambda self: self._metricas()['rmse'])
    meanSquaredError = property(lambda self: self._metricas()['mse'])
    meanAbsoluteError = property(lambda self: self._metricas()['mae'])
    r2 = property(lambda self: self._metricas()['r2'])
    explainedVariance = property(lambda self: self._metricas()['var'])

    @property
    def numInstances(self):
        return self.predictions.count()
