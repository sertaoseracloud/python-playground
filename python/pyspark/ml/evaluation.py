"""pyspark.ml.evaluation: os avaliadores. As métricas são calculadas no processo principal, sobre
as colunas de previsão e rótulo (coletadas num job com o nome do avaliador)."""
import math

from .base import Params


class Evaluator(Params):
    def evaluate(self, dataset, params=None):
        return self._avaliar(dataset)

    def isLargerBetter(self):
        return True


def metricas_de_regressao(pares):
    """pares: [(previsão, rótulo)] → rmse, mse, mae, r2 e var (a variância explicada)."""
    n = len(pares)
    media = sum(y for _, y in pares) / n
    sse = sum((y - p) ** 2 for p, y in pares)
    sst = sum((y - media) ** 2 for _, y in pares)
    return {'rmse': math.sqrt(sse / n), 'mse': sse / n, 'mae': sum(abs(y - p) for p, y in pares) / n,
            'r2': 1 - sse / sst if sst else float('nan'), 'var': sum((p - media) ** 2 for p, _ in pares) / n}


class RegressionEvaluator(Evaluator):
    _padroes = {'predictionCol': 'prediction', 'labelCol': 'label', 'metricName': 'rmse', 'weightCol': None,
                'throughOrigin': False}

    def _avaliar(self, df):
        pares = df.select(self.getOrDefault('predictionCol'), self.getOrDefault('labelCol'))._linhas('evaluate RegressionEvaluator')
        return metricas_de_regressao([(p, y) for p, y in pares if p is not None and y is not None])[self.getOrDefault('metricName')]

    def isLargerBetter(self):
        return self.getOrDefault('metricName') in ('r2', 'var')
