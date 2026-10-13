"""SparkSession: a porta de entrada. Uma sessão por execução do aluno (some a cada execução)."""
from diverge_runtime import estagios

from ..context import PADROES, SparkConf, SparkContext
from ..errors import PySparkException


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

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.stop()


def _reiniciar():
    """Cada execução do aluno começa com uma sessão nova (sem views, conf ou cache da anterior)."""
    SparkSession._ativa = None
    SparkContext._ativo = None


if not any(getattr(f, '__qualname__', '') == '_reiniciar' and getattr(f, '__module__', '') == __name__ for f in estagios.AO_ZERAR):
    estagios.AO_ZERAR.append(_reiniciar)

__all__ = ['SparkSession', 'SparkConf']
