"""pyspark.ml.clustering: KMeans pelo algoritmo de Lloyd.

A inicialização é o k-means++ com a semente (o Spark usa o k-means||, que sorteia de outro jeito:
os centros iniciais mudam, mas, com grupos bem separados, os grupos finais são os mesmos). Cada
iteração é um job: as partições somam os pontos de cada centro nos workers, e o processo principal
calcula os centros novos, até nenhum mudar mais que tol ou chegar ao maxIter. O trainingCost é o da
última iteração, como no Spark."""
import random

from ..sql import types as T
from .base import Estimator, Model, coluna_nova, exigir_vetor, por_particao
from .linalg import DenseVector


def _mais_perto(centros, x):
    melhor, distancia = 0, float('inf')
    for i, c in enumerate(centros):
        d = sum((a - b) ** 2 for a, b in zip(c, x))
        if d < distancia:
            melhor, distancia = i, d
    return melhor, distancia


class _SomasKMeans:
    def __init__(self, centros):
        self.centros = centros

    def __call__(self, linhas):
        k = len(self.centros)
        somas, contagens, custo = [None] * k, [0] * k, 0.0
        for (v,) in linhas:
            if v is None:
                continue
            x = v.toArray()
            i, d = _mais_perto(self.centros, x)
            custo += d
            contagens[i] += 1
            somas[i] = list(x) if somas[i] is None else [a + b for a, b in zip(somas[i], x)]
        return [(somas, contagens, custo)]


class KMeans(Estimator):
    _padroes = {'featuresCol': 'features', 'predictionCol': 'prediction', 'k': 2, 'maxIter': 20, 'seed': None,
                'tol': 1e-4, 'initMode': 'k-means||', 'initSteps': 2, 'distanceMeasure': 'euclidean', 'weightCol': None}

    def _fit(self, df):
        if self.getOrDefault('distanceMeasure') != 'euclidean':
            raise NotImplementedError('O DivergePython agrupa só pela distância euclidiana.')
        f = self.getOrDefault('featuresCol')
        exigir_vetor(df, f)
        dados = df.select(f)
        pontos = [v.toArray() for (v,) in dados._linhas('fit KMeans (início)') if v is not None]
        semente = self.getOrDefault('seed')
        sorteio = random.Random(semente if semente is not None else 20260101)
        centros = [pontos[sorteio.randrange(len(pontos))]]
        while len(centros) < self.getOrDefault('k'):  # k-means++: o próximo centro sai pela distância ao quadrado
            distancias = [_mais_perto(centros, p)[1] for p in pontos]
            total = sum(distancias)
            if total == 0:
                break  # menos pontos distintos que k: como o Spark, menos centros
            alvo, acumulado = sorteio.random() * total, 0.0
            for p, d in zip(pontos, distancias):
                acumulado += d
                if acumulado >= alvo:
                    centros.append(p)
                    break
        tol2 = self.getOrDefault('tol') ** 2
        custo, iteracao = 0.0, 0
        for iteracao in range(1, self.getOrDefault('maxIter') + 1):
            partes = por_particao(dados, _SomasKMeans(centros), f'fit KMeans (iteração {iteracao})')
            custo = sum(p[2] for p in partes)
            novos = []
            for i, c in enumerate(centros):
                n = sum(p[1][i] for p in partes)
                somas = [p[0][i] for p in partes if p[0][i] is not None]
                novos.append([sum(s[j] for s in somas) / n for j in range(len(c))] if n else c)
            mudou = any(sum((a - b) ** 2 for a, b in zip(novo, velho)) > tol2 for novo, velho in zip(novos, centros))
            centros = novos
            if not mudou:
                break
        return KMeansModel([DenseVector(c) for c in centros], custo, iteracao, self, df)


class _Grupo:
    def __init__(self, centros):
        self.centros = centros

    def __call__(self, v):
        return None if v is None else _mais_perto(self.centros, v.toArray())[0]


class KMeansModel(Model):
    _padroes = KMeans._padroes

    def __init__(self, centros, custo, iteracoes, estimador, treino):
        super().__init__(**estimador._valores)
        self._centros, self._custo, self._iteracoes, self._treino, self._resumo = centros, custo, iteracoes, treino, None

    def clusterCenters(self):
        """Os centros (o Spark devolve arrays do numpy; aqui, DenseVector)."""
        return list(self._centros)

    def predict(self, value):
        return _Grupo([c.toArray() for c in self._centros])(value)

    def _transform(self, df):
        impl = _Grupo([c.toArray() for c in self._centros])
        return coluna_nova(df, self.getOrDefault('predictionCol'), impl, [self.getOrDefault('featuresCol')], T.IntegerType())

    @property
    def hasSummary(self):
        return True

    @property
    def summary(self):
        if self._resumo is None:
            self._resumo = KMeansSummary(self.transform(self._treino), self)
        return self._resumo


class KMeansSummary:
    def __init__(self, predictions, modelo):
        self.predictions = predictions
        self.predictionCol = modelo.getOrDefault('predictionCol')
        self.k, self.trainingCost, self.numIter = len(modelo._centros), modelo._custo, modelo._iteracoes
        self._tamanhos = None

    @property
    def clusterSizes(self):
        if self._tamanhos is None:
            contagem = [0] * self.k
            for (g,) in self.predictions.select(self.predictionCol)._linhas('resumo KMeans'):
                contagem[g] += 1
            self._tamanhos = contagem
        return self._tamanhos

    @property
    def cluster(self):
        return self.predictions.select(self.predictionCol)
