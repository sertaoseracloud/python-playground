"""pyspark.ml.feature: VectorAssembler, StringIndexer, OneHotEncoder e StandardScaler."""
import math

from ..errors import IllegalArgumentException, SparkRuntimeException
from ..sql import functions as F
from ..sql import types as T
from ..sql.column import Column, Func, para_expr
from ..sql.mostrar import texto_do_valor
from .base import Estimator, Model, Transformer, coluna_nova, exigir_vetor, por_particao, tipo_da_coluna
from .linalg import DenseVector, SparseVector, VectorUDT, comprimido

_VETOR = VectorUDT()
_NUMEROS = (T.IntegerType, T.LongType, T.ShortType, T.ByteType, T.DoubleType, T.FloatType, T.BooleanType)


def _pares(estagio):
    """[(entrada, saída)]: o inputCols/outputCols ou o inputCol/outputCol."""
    if estagio.getOrDefault('inputCols'):
        return list(zip(estagio.getOrDefault('inputCols'), estagio.getOrDefault('outputCols')))
    return [(estagio.getOrDefault('inputCol'), estagio.getOrDefault('outputCol'))]


def _texto(v):
    return v if isinstance(v, str) else texto_do_valor(v)


# ---------- VectorAssembler ----------

class _Montar:
    def __init__(self, invalido):
        self.invalido = invalido

    def __call__(self, *valores):
        saida = []
        for v in valores:
            if v is None:
                if self.invalido == 'keep':
                    saida.append(float('nan'))
                    continue
                raise SparkRuntimeException('Encountered null while assembling a row with handleInvalid = "error". Consider '
                                            'removing nulls from dataset or using handleInvalid = "keep" or "skip".')
            saida.extend(v.toArray() if hasattr(v, '_texto_do_spark') else [float(v)])
        return comprimido(saida)


class VectorAssembler(Transformer):
    _padroes = {'inputCols': None, 'outputCol': None, 'handleInvalid': 'error'}

    def _transform(self, df):
        colunas = list(self.getOrDefault('inputCols') or [])
        for c in colunas:
            tipo = tipo_da_coluna(df, c)
            if not isinstance(tipo, _NUMEROS + (VectorUDT,)):
                raise IllegalArgumentException(f'Data type {tipo.simpleString()} of column {c} is not supported.')
        invalido = self.getOrDefault('handleInvalid')
        if invalido == 'skip':
            df = df.dropna(subset=colunas)
        return coluna_nova(df, self.getOrDefault('outputCol') or f'{self.uid}__output', _Montar(invalido), colunas, _VETOR)


# ---------- StringIndexer ----------

_ORDENS = {
    'frequencyDesc': lambda pares: sorted(pares, key=lambda p: (-p[1], p[0])),
    'frequencyAsc': lambda pares: sorted(pares, key=lambda p: (p[1], p[0])),
    'alphabetAsc': lambda pares: sorted(pares),
    'alphabetDesc': lambda pares: sorted(pares, reverse=True),
}


class StringIndexer(Estimator):
    _padroes = {'inputCol': None, 'outputCol': None, 'inputCols': None, 'outputCols': None,
                'handleInvalid': 'error', 'stringOrderType': 'frequencyDesc'}

    def _fit(self, df):
        rotulos = []
        for entrada, _ in _pares(self):
            contagens = {}
            for valor, n in df.groupBy(entrada).count()._linhas('fit StringIndexer'):
                if valor is not None:
                    contagens[_texto(valor)] = contagens.get(_texto(valor), 0) + n
            rotulos.append([r for r, _ in _ORDENS[self.getOrDefault('stringOrderType')](list(contagens.items()))])
        return StringIndexerModel(rotulos, _pares(self), self.getOrDefault('handleInvalid'))


class _Indexar:
    def __init__(self, rotulos, invalido):
        self.mapa, self.n, self.invalido = {r: float(i) for i, r in enumerate(rotulos)}, len(rotulos), invalido

    def __call__(self, v):
        if v is None:
            if self.invalido == 'keep':
                return float(self.n)
            raise SparkRuntimeException('StringIndexer encountered NULL value. To handle or skip NULLS, try setting '
                                        'StringIndexer.handleInvalid.')
        texto = _texto(v)
        if texto in self.mapa:
            return self.mapa[texto]
        if self.invalido == 'keep':
            return float(self.n)
        raise SparkRuntimeException(f'Unseen label: {texto}. To handle unseen labels, set Param handleInvalid to keep.')


class _Conhecido:
    def __init__(self, rotulos):
        self.rotulos = set(rotulos)

    def __call__(self, v):
        return v is not None and _texto(v) in self.rotulos


class StringIndexerModel(Model):
    _padroes = {'handleInvalid': 'error'}

    def __init__(self, rotulos, pares, invalido):
        super().__init__(handleInvalid=invalido)
        self.labelsArray, self._entradas = rotulos, pares

    @property
    def labels(self):
        return self.labelsArray[0]

    def _transform(self, df):
        invalido = self.getOrDefault('handleInvalid')
        for (entrada, saida), rotulos in zip(self._entradas, self.labelsArray):
            if invalido == 'skip':
                df = df.filter(Column(Func('conhecido', [para_expr(entrada)], _Conhecido(rotulos), lambda _t: T.BooleanType(),
                                           propaga_nulo=False)))
            df = coluna_nova(df, saida, _Indexar(rotulos, invalido), [entrada], T.DoubleType())
        return df


# ---------- OneHotEncoder ----------

class OneHotEncoder(Estimator):
    _padroes = {'inputCol': None, 'outputCol': None, 'inputCols': None, 'outputCols': None,
                'dropLast': True, 'handleInvalid': 'error'}

    def _fit(self, df):
        pares = _pares(self)
        maiores = df.select(*[F.max(e) for e, _ in pares])._linhas('fit OneHotEncoder')[0]
        tamanhos = [int(m) + 1 if m is not None else 0 for m in maiores]
        return OneHotEncoderModel(tamanhos, pares, self.getOrDefault('dropLast'), self.getOrDefault('handleInvalid'))


class _Codificar:
    def __init__(self, tamanho, sem_ultimo, invalido):
        self.tamanho, self.sem_ultimo, self.invalido = tamanho, sem_ultimo, invalido

    def __call__(self, v):
        total = self.tamanho + (1 if self.invalido == 'keep' else 0)  # o keep ganha uma categoria no fim
        saida = total - 1 if self.sem_ultimo else total
        if v is None or v != int(v) or not 0 <= v < self.tamanho:
            if self.invalido != 'keep':
                raise SparkRuntimeException(f'Unseen value: {v}. To handle unseen values, set Param handleInvalid to keep.')
            i = self.tamanho
        else:
            i = int(v)
        return SparseVector(saida, [], []) if i >= saida else SparseVector(saida, [i], [1.0])


class OneHotEncoderModel(Model):
    _padroes = {'dropLast': True, 'handleInvalid': 'error'}

    def __init__(self, tamanhos, pares, sem_ultimo, invalido):
        super().__init__(dropLast=sem_ultimo, handleInvalid=invalido)
        self.categorySizes, self._entradas = tamanhos, pares

    def _transform(self, df):
        for (entrada, saida), tamanho in zip(self._entradas, self.categorySizes):
            impl = _Codificar(tamanho, self.getOrDefault('dropLast'), self.getOrDefault('handleInvalid'))
            df = coluna_nova(df, saida, impl, [entrada], _VETOR)
        return df


# ---------- StandardScaler ----------

class _SomasVetor:
    """Numa partição: (n, Σx, Σx²) de cada posição do vetor."""

    def __call__(self, linhas):
        n, somas, quadrados = 0, None, None
        for (v, *_) in linhas:
            if v is None:
                continue
            a = v.toArray()
            if somas is None:
                somas, quadrados = [0.0] * len(a), [0.0] * len(a)
            n += 1
            for i, x in enumerate(a):
                somas[i] += x
                quadrados[i] += x * x
        return [(n, somas, quadrados)] if n else []


def media_e_desvio(partes):
    """A média e o desvio-padrão amostral (n − 1), como o summarizer do Spark."""
    n = sum(p[0] for p in partes)
    tamanho = len(partes[0][1])
    somas = [sum(p[1][i] for p in partes) for i in range(tamanho)]
    quadrados = [sum(p[2][i] for p in partes) for i in range(tamanho)]
    media = [s / n for s in somas]
    desvio = [math.sqrt(max((q - n * m * m) / (n - 1), 0.0)) if n > 1 else 0.0 for q, m in zip(quadrados, media)]
    return n, media, desvio


class StandardScaler(Estimator):
    _padroes = {'inputCol': None, 'outputCol': None, 'withMean': False, 'withStd': True}

    def _fit(self, df):
        entrada = self.getOrDefault('inputCol')
        exigir_vetor(df, entrada)
        _, media, desvio = media_e_desvio(por_particao(df.select(entrada), _SomasVetor(), 'fit StandardScaler'))
        return StandardScalerModel(DenseVector(media), DenseVector(desvio), self)


class _Escalar:
    def __init__(self, media, desvio, com_media, com_desvio):
        self.media, self.com_media = media, com_media
        self.fator = [(1.0 / d if d else 0.0) if com_desvio else 1.0 for d in desvio]

    def __call__(self, v):
        if v is None:
            return None
        if isinstance(v, SparseVector) and not self.com_media:
            return SparseVector(v.size, v.indices, [x * self.fator[i] for i, x in zip(v.indices, v.values)])
        return DenseVector([((x - self.media[i]) if self.com_media else x) * self.fator[i] for i, x in enumerate(v.toArray())])


class StandardScalerModel(Model):
    _padroes = StandardScaler._padroes

    def __init__(self, media, desvio, estimador):
        super().__init__(**estimador._valores)
        self.mean, self.std = media, desvio

    def _transform(self, df):
        impl = _Escalar(self.mean.toArray(), self.std.toArray(), self.getOrDefault('withMean'), self.getOrDefault('withStd'))
        return coluna_nova(df, self.getOrDefault('outputCol'), impl, [self.getOrDefault('inputCol')], _VETOR)
