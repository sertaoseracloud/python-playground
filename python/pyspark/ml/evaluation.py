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


def _curva(pares):
    """(pontos, positivos, negativos): os pontos (fp, tp) acumulados por limiar, do maior escore ao menor."""
    pares = sorted(pares, key=lambda p: -p[0])
    pontos, tp, fp, i = [], 0, 0, 0
    while i < len(pares):
        escore = pares[i][0]
        while i < len(pares) and pares[i][0] == escore:
            if pares[i][1] > 0.5:
                tp += 1
            else:
                fp += 1
            i += 1
        pontos.append((fp, tp))
    return pontos, tp, fp


def _trapezios(xs, ys):
    return sum((x1 - x0) * (y0 + y1) / 2 for x0, x1, y0, y1 in zip(xs, xs[1:], ys, ys[1:]))


def area_roc(pares):
    """pares: [(escore, rótulo)]. A curva vai de (0, 0) a (1, 1), como o BinaryClassificationMetrics."""
    pontos, positivos, negativos = _curva(pares)
    if not positivos or not negativos:
        return float('nan')
    return _trapezios([0.0] + [fp / negativos for fp, _ in pontos], [0.0] + [tp / positivos for _, tp in pontos])


def area_pr(pares):
    """A curva precisão × revocação, começando em (0, a precisão do primeiro limiar), como o Spark."""
    pontos, positivos, _ = _curva(pares)
    if not positivos:
        return float('nan')
    revocacao = [tp / positivos for _, tp in pontos]
    precisao = [tp / (tp + fp) for fp, tp in pontos]
    return _trapezios([0.0] + revocacao, [precisao[0]] + precisao)


class BinaryClassificationEvaluator(Evaluator):
    _padroes = {'rawPredictionCol': 'rawPrediction', 'labelCol': 'label', 'metricName': 'areaUnderROC',
                'weightCol': None, 'numBins': 1000}

    def _avaliar(self, df):
        linhas = df.select(self.getOrDefault('rawPredictionCol'), self.getOrDefault('labelCol'))._linhas(
            'evaluate BinaryClassificationEvaluator')
        pares = [(s[1] if hasattr(s, '_texto_do_spark') else float(s), float(y)) for s, y in linhas if s is not None and y is not None]
        return area_roc(pares) if self.getOrDefault('metricName') == 'areaUnderROC' else area_pr(pares)


def metricas_de_classes(pares):
    """pares: [(previsão, rótulo)] → accuracy e as médias ponderadas pelo rótulo (f1, precisão, revocação)."""
    n = len(pares)
    saida = {'accuracy': sum(1 for p, y in pares if p == y) / n, 'f1': 0.0, 'weightedPrecision': 0.0, 'weightedRecall': 0.0}
    for c in sorted({y for _, y in pares}):
        tp = sum(1 for p, y in pares if p == c and y == c)
        previstos = sum(1 for p, _ in pares if p == c)
        reais = sum(1 for _, y in pares if y == c)
        precisao = tp / previstos if previstos else 0.0
        revocacao = tp / reais
        f1 = 2 * precisao * revocacao / (precisao + revocacao) if precisao + revocacao else 0.0
        peso = reais / n
        saida['f1'] += peso * f1
        saida['weightedPrecision'] += peso * precisao
        saida['weightedRecall'] += peso * revocacao
    return saida


class MulticlassClassificationEvaluator(Evaluator):
    _padroes = {'predictionCol': 'prediction', 'labelCol': 'label', 'metricName': 'f1', 'weightCol': None,
                'metricLabel': 0.0, 'beta': 1.0, 'probabilityCol': 'probability', 'eps': 1e-15}

    def _avaliar(self, df):
        pares = df.select(self.getOrDefault('predictionCol'), self.getOrDefault('labelCol'))._linhas(
            'evaluate MulticlassClassificationEvaluator')
        return metricas_de_classes(pares)[self.getOrDefault('metricName')]
