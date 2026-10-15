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

    def vacuum(self, retentionHours=None):
        """Apaga do disco os arquivos que saíram da tabela há mais tempo que a retenção (no relógio virtual)."""
        from diverge_runtime import relogio
        from pyspark.errors import IllegalArgumentException
        horas = 168 if retentionHours is None else retentionHours
        conferir = str(self._sessao.conf.get('spark.databricks.delta.retentionDurationCheck.enabled', 'true')).lower() != 'false'
        if horas < 168 and conferir:
            raise IllegalArgumentException(
                'requirement failed: Are you sure you would like to vacuum files with such a low retention period? If you have\n'
                'writers that are currently writing to this table, there is a risk that you may corrupt the\n'
                'state of your Delta table.\n\nIf you are certain that there are no operations being performed on this table, such as\n'
                'insert/upsert/delete/optimize, then you may turn off this check by setting:\n'
                'spark.databricks.delta.retentionDurationCheck.enabled = false', 'DELTA_VACUUM_RETENTION_PERIOD_TOO_SMALL', {}, None)
        snap = _log.snapshot(self._caminho)
        removidos = {}
        for versao in _log.versoes(self._caminho):
            for acao in _log.ler_commit(self._caminho, versao):
                if 'remove' in acao:
                    caminho = acao['remove']['path']
                    removidos[caminho] = max(removidos.get(caminho, 0), acao['remove'].get('deletionTimestamp', 0))
        limite = relogio.em_ms() - int(horas * 3600 * 1000)
        candidatos = [n for n in sorted(os.listdir(self._caminho))
                      if n.endswith('.parquet') and n not in snap.arquivos and removidos.get(n, 0) <= limite]
        parametros = {'retentionCheckEnabled': str(conferir).lower(), 'defaultRetentionMillis': 604800000,
                      'specifiedRetentionMillis': int(horas * 3600 * 1000)}
        _escrita._commit(self._caminho, snap.versao + 1, 'VACUUM START', parametros, {'numFilesToDelete': len(candidatos)}, [], snap.versao)
        for nome in candidatos:
            os.remove(os.path.join(self._caminho, nome))
        _escrita._commit(self._caminho, snap.versao + 2, 'VACUUM END', {'status': 'COMPLETED'},
                         {'numDeletedFiles': len(candidatos)}, [], snap.versao + 1)
        return self._sessao.createDataFrame([], 'path STRING')

    def optimize(self):
        return DeltaOptimizeBuilder(self)

    def merge(self, source, condition):
        return DeltaMergeBuilder(self, source, condition)

    def delete(self, condition=None):
        df = self.toDF()
        alvo = F.lit(True) if condition is None else F.coalesce(_coluna(condition), F.lit(False))
        n = df.filter(alvo).count()
        _escrita.reescrever(self._sessao, self._caminho, df.filter(~alvo), 'DELETE',
                            {'predicate': _predicado(condition)}, {'numDeletedRows': n})


# ---------- merge ----------

def _apelido(df, padrao):
    """O apelido dado com df.alias(...) (o nó Apelido mais de cima), ou o padrão."""
    from pyspark.sql.plano import Apelido
    plano = df._plano
    while True:
        if isinstance(plano, Apelido):
            return plano.nome
        if not plano.filhos or not plano.transparente():
            return padrao
        plano = plano.filhos[0]


def _com_indice(sessao, df, nome):
    """O DataFrame com uma coluna de índice (a posição de cada linha), para a montagem do merge."""
    from pyspark.sql import types as T
    linhas = [tuple(r) + (i,) for i, r in enumerate(df.collect())]
    schema = T.StructType(list(df.schema.fields) + [T.StructField(nome, T.LongType())])
    return sessao.createDataFrame(linhas, schema)


class DeltaMergeBuilder:
    """merge(fonte, condição) com as cláusulas whenMatched*/whenNotMatched* e o execute()."""

    def __init__(self, tabela, fonte, condicao):
        self._t, self._fonte, self._cond = tabela, fonte, condicao
        self._casadas, self._nao_casadas = [], []

    def whenMatchedUpdate(self, condition=None, set=None):  # noqa: A002 — o nome é o da API do Delta
        self._casadas.append(('update', condition, set))
        return self

    def whenMatchedUpdateAll(self, condition=None):
        self._casadas.append(('update', condition, None))
        return self

    def whenMatchedDelete(self, condition=None):
        self._casadas.append(('delete', condition, None))
        return self

    def whenNotMatchedInsert(self, condition=None, values=None):
        self._nao_casadas.append(('insert', condition, values))
        return self

    def whenNotMatchedInsertAll(self, condition=None):
        self._nao_casadas.append(('insert', condition, None))
        return self

    def execute(self):
        from pyspark.errors import SparkRuntimeException
        t, sessao = self._t, self._t._sessao
        alvo = sessao.read.format('delta').load(t._caminho)
        schema, colunas = alvo.schema, alvo.columns
        ap_alvo, ap_fonte = t._apelido or 'target', _apelido(self._fonte, 'source')
        a = _com_indice(sessao, alvo, '__alvo_i').alias(ap_alvo)
        f = _com_indice(sessao, self._fonte, '__fonte_i').alias(ap_fonte)
        j = a.join(f, _coluna(self._cond), 'full_outer')

        # Uma coluna por condição de cláusula e uma por valor que a cláusula grava.
        extras = [F.col(f'{ap_alvo}.__alvo_i').alias('__a'), F.col(f'{ap_fonte}.__fonte_i').alias('__f')]
        for grupo, sigla in ((self._casadas, 'm'), (self._nao_casadas, 'n')):
            for k, (acao, condicao, valores) in enumerate(grupo):
                extras.append((F.coalesce(_coluna(condicao), F.lit(False)) if condicao is not None else F.lit(True)).alias(f'__{sigla}c{k}'))
                if acao == 'delete':
                    continue
                for i, campo in enumerate(schema.fields):
                    if valores is None:
                        valor = F.col(f'{ap_fonte}.{campo.name}')
                    elif campo.name in valores:
                        valor = _coluna(valores[campo.name])
                    else:
                        valor = F.col(f'{ap_alvo}.{campo.name}') if sigla == 'm' else F.lit(None)
                    extras.append(valor.cast(campo.dataType.simpleString()).alias(f'__{sigla}v{k}_{i}'))
        resultado = j.select(*extras).collect()

        linhas_alvo = [tuple(r) for r in alvo.collect()]
        casadas = {}
        inseridas, atualizadas, apagadas = [], 0, 0
        for r in resultado:
            d = r.asDict()
            if d['__a'] is not None and d['__f'] is not None:
                if d['__a'] in casadas and self._casadas:
                    raise SparkRuntimeException(
                        'Cannot perform Merge as multiple source rows matched and '
                        'attempted to modify the same target row in the Delta table in possibly conflicting ways.',
                        'DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE', {}, '21506')
                casadas[d['__a']] = d
            elif d['__f'] is not None:
                for k, (acao, _, _) in enumerate(self._nao_casadas):
                    if d[f'__nc{k}']:
                        inseridas.append(tuple(d[f'__nv{k}_{i}'] for i in range(len(colunas))))
                        break

        novas = []
        for indice, linha in enumerate(linhas_alvo):
            d = casadas.get(indice)
            if d is None:
                novas.append(linha)
                continue
            for k, (acao, _, _) in enumerate(self._casadas):
                if not d[f'__mc{k}']:
                    continue
                if acao == 'delete':
                    apagadas += 1
                else:
                    novas.append(tuple(d[f'__mv{k}_{i}'] for i in range(len(colunas))))
                    atualizadas += 1
                break
            else:
                novas.append(linha)  # casou, mas nenhuma cláusula valeu: fica como estava
        novas += inseridas

        df_novo = sessao.createDataFrame(novas, schema)
        parametros = {'predicate': _predicado(self._cond),
                      'matchedPredicates': str([{'actionType': acao} for acao, _, _ in self._casadas]),
                      'notMatchedPredicates': str([{'actionType': acao} for acao, _, _ in self._nao_casadas])}
        metricas = {'numSourceRows': self._fonte.count(), 'numTargetRowsUpdated': atualizadas,
                    'numTargetRowsDeleted': apagadas, 'numTargetRowsInserted': len(inseridas)}
        _escrita.reescrever(sessao, t._caminho, df_novo, 'MERGE', parametros, metricas)



class DeltaOptimizeBuilder:
    """optimize().executeCompaction(): junta os arquivos pequenos da tabela num só."""

    def __init__(self, tabela):
        self._t = tabela

    def executeCompaction(self):
        t = self._t
        n = len(_log.snapshot(t._caminho).arquivos)
        if n > 1:
            df = t._sessao.read.format('delta').load(t._caminho)
            _escrita.reescrever(t._sessao, t._caminho, df, 'OPTIMIZE',
                                {'predicate': '[]', 'auto': 'false', 'clusterBy': '[]', 'zOrderBy': '[]'},
                                {'numAddedFiles': 1, 'numRemovedFiles': n}, data_change=False)
        adicionados, removidos = (1, n) if n > 1 else (0, 0)
        return t._sessao.createDataFrame([(t._caminho, adicionados, removidos)], 'path STRING, numFilesAdded BIGINT, numFilesRemoved BIGINT')
