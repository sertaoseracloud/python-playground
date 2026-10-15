"""A base do pyspark.ml do DivergePython: parâmetros, transformadores, estimadores e modelos.

Os parâmetros são como no PySpark: Estagio(param=valor), setParam(valor) e getParam(). O treino é
distribuído: por_particao roda uma função em cada partição (nos workers), num job com o nome do
fit, e o processo principal junta os resultados."""
import uuid

from ..errors import IllegalArgumentException
from ..rdd import _Estreito
from ..sql.column import Column, Func, para_expr


class Params:
    _padroes = {}

    def __init__(self, **kw):
        self._valores = dict(self._padroes)
        self.uid = f'{type(self).__name__}_{uuid.uuid4().hex[:12]}'
        self._definir(kw)

    def _definir(self, kw):
        for k, v in kw.items():
            if k not in self._padroes:
                raise TypeError(f"{type(self).__name__}() got an unexpected keyword argument '{k}'")
            self._valores[k] = v
        return self

    def setParams(self, **kw):
        return self._definir(kw)

    def getOrDefault(self, param):
        return self._valores[param]

    def explainParams(self):
        return '\n'.join(f'{k}: (atual: {v!r})' for k, v in sorted(self._valores.items()))

    def __getattr__(self, nome):
        """setMaxIter(10), getMaxIter(): os setters e getters do PySpark, para cada parâmetro."""
        if nome.startswith('_') or len(nome) < 4 or nome[:3] not in ('set', 'get'):
            raise AttributeError(nome)
        param = nome[3].lower() + nome[4:]
        if param not in self._padroes:
            raise AttributeError(nome)
        if nome.startswith('set'):
            return lambda valor: self._definir({param: valor})
        return lambda: self._valores[param]

    def __repr__(self):
        return self.uid


class Transformer(Params):
    def transform(self, dataset, params=None):
        return self._transform(dataset)


class Estimator(Params):
    def fit(self, dataset, params=None):
        return self._fit(dataset)


class Model(Transformer):
    pass


def por_particao(df, funcao, acao):
    """Roda `funcao(linhas) -> [resultado]` em cada partição (nos workers), num job chamado `acao`."""
    rdd = _Estreito(df._plano.rdd(), funcao, 'fit')
    return [r for parte in rdd._executar(acao) for r in parte]


def coluna_nova(df, nome, impl, entradas, tipo):
    """O df com a coluna `nome` = impl(valores das `entradas`), calculada nos workers."""
    func = Func(nome, [para_expr(c) for c in entradas], impl, lambda _tipos: tipo, propaga_nulo=False)
    return df.withColumn(nome, Column(func))


def tipo_da_coluna(df, coluna):
    e = df._entrada()
    return e.atributos[e.achar(coluna)].tipo


def exigir_vetor(df, coluna):
    from .linalg import VectorUDT
    tipo = tipo_da_coluna(df, coluna)
    if not isinstance(tipo, VectorUDT):
        raise IllegalArgumentException(
            f'requirement failed: Column {coluna} must be of type struct<type:tinyint,size:int,indices:array<int>,'
            f'values:array<double>> but was actually {tipo.simpleString()}.')
