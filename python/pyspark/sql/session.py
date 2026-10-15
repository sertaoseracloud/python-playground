"""SparkSession: a porta de entrada. Uma sessão por execução do aluno (some a cada execução)."""
from diverge_runtime import estagios

from ..context import PADROES, SparkConf, SparkContext
from ..errors import PySparkException, PySparkTypeError
from ..rdd import RDD, _Estreito
from . import plano as P
from . import types as T
from .column import Atributo, reiniciar_ids


class RuntimeConfig:
    def __init__(self, valores):
        self._valores = valores

    def set(self, chave, valor):
        self._valores[chave] = str(valor).lower() if isinstance(valor, bool) else str(valor)

    def get(self, chave, padrao=None):
        if chave in self._valores:
            return self._valores[chave]
        if padrao is None:
            raise PySparkException(f'The SQL config "{chave}" cannot be found. Please verify that the config exists.',
                                   'SQL_CONF_NOT_FOUND', {'sqlConf': chave}, '42K0I')
        return padrao

    def unset(self, chave):
        if chave in PADROES:
            self._valores[chave] = PADROES[chave]
        else:
            self._valores.pop(chave, None)

    def getAll(self):
        return dict(self._valores)

    def isModifiable(self, chave):
        return True


class _Construtor:
    def __init__(self):
        self._opcoes = {}

    def appName(self, nome):
        self._opcoes['spark.app.name'] = nome
        return self

    def master(self, master):
        self._opcoes['spark.master'] = master
        return self

    def config(self, key=None, value=None, conf=None, map=None):
        if conf is not None:
            self._opcoes.update(conf.getAll())
        if map:
            self._opcoes.update({k: str(v) for k, v in map.items()})
        if key is not None:
            self._opcoes[key] = str(value).lower() if isinstance(value, bool) else str(value)
        return self

    def enableHiveSupport(self):
        return self

    def getOrCreate(self):
        sessao = SparkSession._ativa or SparkSession(SparkContext.getOrCreate())
        sessao.sparkContext._conf.update(self._opcoes)
        self._opcoes = {}
        return sessao

    def create(self):
        return self.getOrCreate()


class _PropriedadeDeClasse:
    def __init__(self, f):
        self.f = f

    def __get__(self, instancia, dono):
        return self.f(dono)


class SparkSession:
    _ativa = None

    def __init__(self, sparkContext):
        self._sc = sparkContext
        self.conf = RuntimeConfig(sparkContext._conf)
        self._views = {}
        self._udfs = {}
        SparkSession._ativa = self

    @_PropriedadeDeClasse
    def builder(cls):
        return _Construtor()

    @classmethod
    def getActiveSession(cls):
        return cls._ativa

    @classmethod
    def active(cls):
        return cls._ativa or cls.builder.getOrCreate()

    @property
    def sparkContext(self):
        return self._sc

    @property
    def version(self):
        return '4.0.1'

    def stop(self):
        pass

    def createDataFrame(self, data, schema=None, samplingRatio=None, verifySchema=True):
        from .dataframe import DataFrame
        nomes = None
        if isinstance(schema, (list, tuple)) and all(isinstance(s, str) for s in schema):
            nomes, schema = list(schema), None
        elif isinstance(schema, str):
            schema = T.tipo_do_texto(schema)
        if isinstance(schema, T.DataType) and not isinstance(schema, T.StructType):
            schema = T.StructType([T.StructField('value', schema, True)])
        if isinstance(data, RDD):
            if schema is None:
                amostra = data.take(100)
                _conferir_linhas(amostra)
                schema = T.schema_dos_dados(amostra, nomes)
            rdd = _Estreito(data, P.Converter(schema), 'createDataFrame')
        else:
            if hasattr(data, 'to_dict') and hasattr(data, 'columns'):
                raise NotImplementedError('O pandas não é carregado no DivergePython: passe uma lista de tuplas ou de dicionários.')
            linhas = list(data)
            inferido = schema is None
            if inferido:
                _conferir_linhas(linhas)
                schema = T.schema_dos_dados(linhas, nomes)
            elif nomes:
                schema = T.StructType([T.StructField(n, f.dataType, f.nullable) for n, f in zip(nomes, schema.fields)])
            linhas = [P.converter_linha(linha, schema, inferido) for linha in linhas]
            rdd = self._sc.parallelize(linhas)
        atributos = [Atributo(f.name, f.dataType, anulavel=f.nullable) for f in schema.fields]
        return DataFrame(P.ScanRDD(self, rdd, atributos), self)

    @property
    def read(self):
        from .readwriter import DataFrameReader
        return DataFrameReader(self)

    @property
    def readStream(self):
        from .streaming import DataStreamReader
        return DataStreamReader(self)

    def sql(self, sqlQuery, args=None, **kwargs):
        from .sql import executar
        return executar(self, sqlQuery)

    def table(self, tableName):
        from .sql import tabela_nao_existe
        achado = self._views.get(tableName.lower())
        if achado is None:
            raise tabela_nao_existe(tableName)
        return achado[1]

    @property
    def catalog(self):
        from .catalog import Catalog
        return Catalog(self)

    @property
    def udf(self):
        from .udf import UDFRegistration
        return UDFRegistration(self)

    def newSession(self):
        return self

    def range(self, start, end=None, step=1, numPartitions=None):
        from .dataframe import DataFrame
        if end is None:
            start, end = 0, start
        n = int(numPartitions) if numPartitions is not None else self._sc.defaultParallelism
        return DataFrame(P.Range(self, start, end, step, n), self)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.stop()


def _conferir_linhas(linhas):
    for linha in linhas[:1]:
        if not isinstance(linha, (tuple, list, dict, T.Row)):
            raise PySparkTypeError(f'Can not infer schema for type: `{type(linha).__name__}`.', 'CANNOT_INFER_SCHEMA_FOR_TYPE',
                                   {'data_type': f'`{type(linha).__name__}`'})


def _reiniciar():
    """Cada execução do aluno começa com uma sessão nova (sem views, conf ou cache da anterior)."""
    SparkSession._ativa = None
    SparkContext._ativo = None
    reiniciar_ids()


if not any(getattr(f, '__qualname__', '') == '_reiniciar' and getattr(f, '__module__', '') == __name__ for f in estagios.AO_ZERAR):
    estagios.AO_ZERAR.append(_reiniciar)

__all__ = ['SparkSession', 'SparkConf']
