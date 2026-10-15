"""pyspark.ml.classification: a regressão logística binária (pelo método de Newton) e a árvore de
decisão.

A logística minimiza a perda média mais λ/2 Σ (σj wj)², a penalidade do Spark com a padronização
ligada (σ amostral). Cada iteração de Newton é um job: as partições somam o gradiente e a hessiana
nos workers, e o processo principal resolve o passo."""
import math

from ..errors import IllegalArgumentException
from ..sql import types as T
from ._algebra import resolver
from .base import Estimator, Model, coluna_nova, exigir_vetor, por_particao
from .evaluation import area_roc, metricas_de_classes
from .feature import _SomasVetor, media_e_desvio
from .linalg import DenseVector, VectorUDT

_VETOR = VectorUDT()
MAX_NEWTON = 100


def _sigmoide(m):
    if m >= 0:
        return 1.0 / (1.0 + math.exp(-m))
    e = math.exp(m)
    return e / (1.0 + e)


class _Newton:
    """Numa partição: n, o gradiente e a hessiana (metade de cima) da perda logística em θ = [w..., b]."""

    def __init__(self, theta):
        self.theta = theta

    def __call__(self, linhas):
        k = len(self.theta)
        g, h, n = [0.0] * k, [[0.0] * k for _ in range(k)], 0
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray() + [1.0]
            p = _sigmoide(sum(t * xi for t, xi in zip(self.theta, x)))
            for i, xi in enumerate(x):
                g[i] += (p - y) * xi
                peso = p * (1 - p) * xi
                linha = h[i]
                for j in range(i, k):
                    linha[j] += peso * x[j]
            n += 1
        return [(n, g, h)] if n else []


class LogisticRegression(Estimator):
    _padroes = {'featuresCol': 'features', 'labelCol': 'label', 'predictionCol': 'prediction',
                'probabilityCol': 'probability', 'rawPredictionCol': 'rawPrediction', 'maxIter': 100, 'regParam': 0.0,
                'elasticNetParam': 0.0, 'tol': 1e-6, 'fitIntercept': True, 'threshold': 0.5, 'standardization': True,
                'family': 'auto', 'weightCol': None, 'aggregationDepth': 2}

    def _fit(self, df):
        if self.getOrDefault('elasticNetParam'):
            raise NotImplementedError('O DivergePython treina só com a penalidade L2 (elasticNetParam=0).')
        f, rotulo = self.getOrDefault('featuresCol'), self.getOrDefault('labelCol')
        exigir_vetor(df, f)
        dados = df.select(f, rotulo)
        classes = {r[0] for r in dados.select(rotulo).distinct()._linhas('fit LogisticRegression (classes)') if r[0] is not None}
        if self.getOrDefault('family') == 'multinomial' or any(c not in (0.0, 1.0) for c in classes):
            if any(c < 0 or c != int(c) for c in classes):
                raise IllegalArgumentException(f'Classification labels should be in [0 to 1]. Found {len(classes)} invalid labels.')
            raise NotImplementedError('O DivergePython faz só a regressão logística binária (rótulos 0 e 1).')
        _, _, desvio = media_e_desvio(por_particao(dados.select(f), _SomasVetor(), 'fit LogisticRegression (resumo)'))
        lam = self.getOrDefault('regParam')
        penalidade = [lam * (d * d if self.getOrDefault('standardization') else 1.0) for d in desvio] + [0.0]
        theta = [0.0] * (len(desvio) + 1)
        iteracoes = 0
        for iteracoes in range(1, MAX_NEWTON + 1):
            partes = por_particao(dados, _Newton(theta), f'fit LogisticRegression (iteração {iteracoes})')
            n = sum(q[0] for q in partes)
            k = len(theta)
            g = [sum(q[1][i] for q in partes) / n + penalidade[i] * theta[i] for i in range(k)]
            h = [[0.0] * k for _ in range(k)]
            for i in range(k):
                for j in range(i, k):
                    h[i][j] = h[j][i] = sum(q[2][i][j] for q in partes) / n + (penalidade[i] if i == j else 0.0)
            passo = resolver(h, g)
            theta = [t - d for t, d in zip(theta, passo)]
            if max(abs(d) for d in passo) < 1e-10:
                break
        return LogisticRegressionModel(DenseVector(theta[:-1]), theta[-1], iteracoes, self, df)


class _Margem:
    """O que o modelo logístico põe em cada linha: 'raw' ([−m, m]), 'prob' ([1 − p, p]) ou 'pred'."""

    def __init__(self, coeficientes, intercepto, limiar, parte):
        self.coeficientes, self.intercepto, self.limiar, self.parte = coeficientes, intercepto, limiar, parte

    def __call__(self, v):
        if v is None:
            return None
        m = sum(c * x for c, x in zip(self.coeficientes, v.toArray())) + self.intercepto
        if self.parte == 'raw':
            return DenseVector([-m, m])
        p = _sigmoide(m)
        if self.parte == 'prob':
            return DenseVector([1 - p, p])
        return 1.0 if p > self.limiar else 0.0


class LogisticRegressionModel(Model):
    _padroes = LogisticRegression._padroes
    numClasses = 2

    def __init__(self, coeficientes, intercepto, iteracoes, estimador, treino):
        super().__init__(**estimador._valores)
        self.coefficients, self.intercept = coeficientes, intercepto
        self._iteracoes, self._treino, self._resumo = iteracoes, treino, None

    @property
    def numFeatures(self):
        return self.coefficients.size

    def _margem(self, parte):
        return _Margem(self.coefficients.toArray(), self.intercept, self.getOrDefault('threshold'), parte)

    def predict(self, value):
        return self._margem('pred')(value)

    def predictProbability(self, value):
        return self._margem('prob')(value)

    def predictRaw(self, value):
        return self._margem('raw')(value)

    def _transform(self, df):
        f = [self.getOrDefault('featuresCol')]
        df = coluna_nova(df, self.getOrDefault('rawPredictionCol'), self._margem('raw'), f, _VETOR)
        df = coluna_nova(df, self.getOrDefault('probabilityCol'), self._margem('prob'), f, _VETOR)
        return coluna_nova(df, self.getOrDefault('predictionCol'), self._margem('pred'), f, T.DoubleType())

    @property
    def hasSummary(self):
        return True

    @property
    def summary(self):
        if self._resumo is None:
            self._resumo = self.evaluate(self._treino)
            self._resumo.totalIterations = self._iteracoes
        return self._resumo

    def evaluate(self, dataset):
        return BinaryLogisticRegressionSummary(self.transform(dataset), self)


class BinaryLogisticRegressionSummary:
    def __init__(self, predictions, modelo):
        self.predictions = predictions
        self.probabilityCol, self.labelCol = modelo.getOrDefault('probabilityCol'), modelo.getOrDefault('labelCol')
        self.predictionCol = modelo.getOrDefault('predictionCol')
        self.totalIterations = 0
        self._linhas = None

    def _dados(self):
        if self._linhas is None:
            self._linhas = self.predictions.select(self.probabilityCol, self.predictionCol, self.labelCol)._linhas(
                'resumo LogisticRegression')
        return self._linhas

    @property
    def areaUnderROC(self):
        return area_roc([(prob[1], y) for prob, _, y in self._dados()])

    @property
    def accuracy(self):
        return metricas_de_classes([(p, y) for _, p, y in self._dados()])['accuracy']


# ---------- árvore de decisão ----------

class DecisionTreeClassifier(Estimator):
    _padroes = {'featuresCol': 'features', 'labelCol': 'label', 'predictionCol': 'prediction',
                'probabilityCol': 'probability', 'rawPredictionCol': 'rawPrediction', 'maxDepth': 5, 'maxBins': 32,
                'minInstancesPerNode': 1, 'minInfoGain': 0.0, 'impurity': 'gini', 'seed': None, 'weightCol': None}

    def _fit(self, df):
        from . import _arvore
        if self.getOrDefault('impurity') != 'gini':
            raise NotImplementedError('O DivergePython treina a árvore só com gini.')
        f, rotulo = self.getOrDefault('featuresCol'), self.getOrDefault('labelCol')
        exigir_vetor(df, f)
        raiz, num_classes, num_features = _arvore.treinar(
            df.select(f, rotulo), self.getOrDefault('maxDepth'), self.getOrDefault('maxBins'),
            self.getOrDefault('minInstancesPerNode'), 'DecisionTreeClassifier')
        return DecisionTreeClassificationModel(raiz, num_classes, num_features, self)


class _Folha:
    def __init__(self, raiz, parte):
        self.raiz, self.parte = raiz, parte

    def __call__(self, v):
        from ._arvore import folha_de
        if v is None:
            return None
        folha = folha_de(self.raiz, v.toArray())
        if self.parte == 'pred':
            return folha.previsao
        contagem = [float(c) for c in folha.contagem]
        if self.parte == 'raw':
            return DenseVector(contagem)
        total = sum(contagem)
        return DenseVector([c / total for c in contagem])


class DecisionTreeClassificationModel(Model):
    _padroes = DecisionTreeClassifier._padroes

    def __init__(self, raiz, num_classes, num_features, estimador):
        super().__init__(**estimador._valores)
        self._raiz, self.numClasses, self.numFeatures = raiz, num_classes, num_features

    @property
    def depth(self):
        from ._arvore import profundidade
        return profundidade(self._raiz)

    @property
    def numNodes(self):
        from ._arvore import contar
        return contar(self._raiz)

    @property
    def featureImportances(self):
        from ._arvore import importancias
        from .linalg import SparseVector
        valores = importancias(self._raiz, self.numFeatures)
        return SparseVector(self.numFeatures, [(i, v) for i, v in enumerate(valores) if v])

    @property
    def toDebugString(self):
        from ._arvore import texto
        return (f'DecisionTreeClassificationModel: uid={self.uid}, depth={self.depth}, numNodes={self.numNodes}, '
                f'numClasses={self.numClasses}, numFeatures={self.numFeatures}\n' + texto(self._raiz, 2))

    def predict(self, value):
        return _Folha(self._raiz, 'pred')(value)

    def _transform(self, df):
        f = [self.getOrDefault('featuresCol')]
        df = coluna_nova(df, self.getOrDefault('rawPredictionCol'), _Folha(self._raiz, 'raw'), f, _VETOR)
        df = coluna_nova(df, self.getOrDefault('probabilityCol'), _Folha(self._raiz, 'prob'), f, _VETOR)
        return coluna_nova(df, self.getOrDefault('predictionCol'), _Folha(self._raiz, 'pred'), f, T.DoubleType())
