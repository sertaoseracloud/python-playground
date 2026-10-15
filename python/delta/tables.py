"""DeltaTable: a tabela Delta como objeto (histórico, update, delete, merge, vacuum, optimize),
com a mesma API do delta-spark."""
import os

from pyspark.sql import Column
from pyspark.sql import functions as F

from . import _escrita, _log

COLUNAS_HISTORICO = ('version BIGINT, timestamp TIMESTAMP, userId STRING, userName STRING, operation STRING, '
                     'operationParameters MAP<STRING,STRING>, job STRING, notebook STRING, clusterId STRING, '
                     'readVersion BIGINT, isolationLevel STRING, isBlindAppend BOOLEAN, '
                     'operationMetrics MAP<STRING,STRING>, userMetadata STRING, engineInfo STRING')


def _coluna(valor):
    return valor if isinstance(valor, Column) else F.expr(str(valor))


def _predicado(condicao):
    """O predicate do histórico: '[]' sem condição; senão a condição entre parênteses."""
    return '[]' if condicao is None else f'["({condicao})"]'


class DeltaTable:
    def __init__(self, sessao, caminho, apelido=None):
        self._sessao, self._caminho, self._apelido = sessao, caminho, apelido

    @classmethod
    def forPath(cls, sparkSession, path, hadoopConf=None):
        caminho = os.path.abspath(path)
        if not _log.eh_delta(caminho):
            raise _log.nao_e_delta(path)
        return cls(sparkSession, caminho)

    @classmethod
    def isDeltaTable(cls, sparkSession, identifier):
        return _log.eh_delta(os.path.abspath(identifier))

    def alias(self, aliasName):
        return DeltaTable(self._sessao, self._caminho, aliasName)

    def toDF(self):
        df = self._sessao.read.format('delta').load(self._caminho)
        return df.alias(self._apelido) if self._apelido else df

    def history(self, limit=None):
        import datetime as dt
        linhas = []
        for versao, info in _log.historico(self._caminho)[:limit]:
            momento = dt.datetime.fromtimestamp(info.get('timestamp', 0) / 1000, dt.timezone.utc).replace(tzinfo=None)
            linhas.append((versao, momento, None, None, info.get('operation'), info.get('operationParameters', {}), None, None,
                           None, info.get('readVersion'), info.get('isolationLevel'), info.get('isBlindAppend'),
                           info.get('operationMetrics', {}), None, info.get('engineInfo')))
        return self._sessao.createDataFrame(linhas, COLUNAS_HISTORICO)

    def update(self, condition=None, set=None):  # noqa: A002 — o nome é o da API do Delta
        df = self.toDF()
        cond = F.lit(True) if condition is None else _coluna(condition)
        alvo = F.coalesce(cond, F.lit(False))
        novas = [F.when(alvo, _coluna(set[c])).otherwise(F.col(c)).alias(c) if c in set else F.col(c) for c in df.columns]
        n = df.filter(alvo).count()
        _escrita.reescrever(self._sessao, self._caminho, df.select(*novas), 'UPDATE', {'predicate': _predicado(condition)},
                            {'numUpdatedRows': n, 'numCopiedRows': df.count() - n})

    def delete(self, condition=None):
        df = self.toDF()
        alvo = F.lit(True) if condition is None else F.coalesce(_coluna(condition), F.lit(False))
        n = df.filter(alvo).count()
        _escrita.reescrever(self._sessao, self._caminho, df.filter(~alvo), 'DELETE',
                            {'predicate': _predicado(condition)}, {'numDeletedRows': n})
