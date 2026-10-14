"""Catálogo da sessão: as views temporárias (somem a cada execução, com a sessão)."""
from collections import namedtuple

from ..errors import AnalysisException

Table = namedtuple('Table', 'name catalog namespace description tableType isTemporary')


class Catalog:
    def __init__(self, sessao):
        self._sessao = sessao

    def listTables(self, dbName=None, pattern=None):
        nomes = sorted(nome for nome, _ in self._sessao._views.values())
        return [Table(n, None, [], None, 'TEMPORARY', True) for n in nomes]

    def tableExists(self, tableName, dbName=None):
        return tableName.lower() in self._sessao._views

    def dropTempView(self, viewName):
        return self._sessao._views.pop(viewName.lower(), None) is not None

    def dropGlobalTempView(self, viewName):
        return self.dropTempView(viewName)

    def cacheTable(self, tableName, storageLevel=None):
        self._sessao.table(tableName).cache()

    def uncacheTable(self, tableName):
        self._sessao.table(tableName).unpersist()

    def isCached(self, tableName):
        return self._sessao.table(tableName).is_cached

    def clearCache(self):
        for _, df in self._sessao._views.values():
            df.unpersist()

    def currentDatabase(self):
        return 'default'

    def listDatabases(self, pattern=None):
        return []


def registrar_view(sessao, nome, df, substituir=True):
    if not substituir and nome.lower() in sessao._views:
        raise AnalysisException(f'Cannot create the temporary view `{nome}` because it already exists.\n'
                                'Choose a different name, drop or replace the existing view,  or add the IF NOT EXISTS clause to tolerate pre-existing views.',
                                'TEMP_TABLE_OR_VIEW_ALREADY_EXISTS', {'relationName': f'`{nome}`'}, '42P07')
    sessao._views[nome.lower()] = (nome, df)
