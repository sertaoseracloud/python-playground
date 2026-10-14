"""GroupedData: o que df.groupBy(...) devolve (agg, count, sum, avg, min, max e pivot)."""
from ..errors import AnalysisException, PySparkTypeError
from . import types as T
from .agregacoes import Agg, contar_tudo
from .avancado import agregar, filtro_de_pivo
from .column import Alias, Col, Column, Entrada, para_expr, sem_alias
from .mostrar import texto_do_valor

_FUNCOES_DO_DICIONARIO = {'avg': 'avg', 'mean': 'avg', 'sum': 'sum', 'min': 'min', 'max': 'max', 'count': 'count',
                          'first': 'first', 'last': 'last', 'collect_list': 'collect_list', 'collect_set': 'collect_set',
                          'stddev': 'stddev', 'variance': 'variance'}


class GroupedData:
    def __init__(self, df, chaves, pivo=None):
        self._df, self._chaves, self._pivo = df, chaves, pivo

    def _agregar(self, exprs):
        df = self._df
        if self._pivo is not None:
            exprs = self._expandir_pivo(exprs)
        saidas = list(self._chaves) + list(exprs)
        return df._novo(agregar(df._plano, list(self._chaves), saidas, 'groupBy'))

    def agg(self, *exprs):
        if len(exprs) == 1 and isinstance(exprs[0], dict):
            lista = []
            for coluna, funcao in exprs[0].items():
                nome = _FUNCOES_DO_DICIONARIO.get(funcao.lower())
                if nome is None:
                    raise AnalysisException(f'Undefined function: `{funcao}`.', 'UNRESOLVED_ROUTINE', {}, '42883')
                lista.append(Agg(nome, [contar_tudo().args[0]] if coluna == '*' else [Col(coluna)]))
            return self._agregar(lista)
        if not exprs:
            raise PySparkTypeError('exprs should not be empty', 'CANNOT_BE_EMPTY', {'item': 'exprs'})
        lista = []
        for x in exprs:
            if not isinstance(x, Column):
                raise PySparkTypeError(f'Argument `exprs` should be a dict or Column, got {type(x).__name__}.', 'NOT_DICT_OR_COLUMN')
            lista.append(x._expr)
        return self._agregar(lista)

    def count(self):
        return self._agregar([Alias(contar_tudo(), 'count')])

    def _numericas(self, cols, funcao):
        df = self._df
        e = Entrada(df._plano.saida, df._plano.ansi)
        if not cols:
            chaves = {sem_alias(c).nome().lower() for c in self._chaves}
            cols = [a.nome for a in df._plano.saida if isinstance(a.tipo, T.NUMERICOS) and a.nome.lower() not in chaves]
        lista = []
        for c in cols:
            a = e.atributos[e.achar(c)]
            if not isinstance(a.tipo, T.NUMERICOS):
                raise AnalysisException(f'"{c}" is not a numeric column. Aggregation function can only be applied on a numeric column.',
                                        'NON_NUMERIC_COLUMN',
                                        {}, '42K09')
            lista.append(Agg(funcao, [Col(c)]))
        return self._agregar(lista)

    def sum(self, *cols):
        return self._numericas(cols, 'sum')

    def avg(self, *cols):
        return self._numericas(cols, 'avg')

    mean = avg

    def min(self, *cols):
        return self._numericas(cols, 'min')

    def max(self, *cols):
        return self._numericas(cols, 'max')

    def pivot(self, pivot_col, values=None):
        coluna = para_expr(pivot_col)
        if values is None:
            df = self._df
            distintos = df.select(Column(coluna)).distinct().collect()
            valores = [r[0] for r in distintos]
            nulos = [v for v in valores if v is None]
            values = sorted(v for v in valores if v is not None) + nulos
        return GroupedData(self._df, self._chaves, (coluna, list(values)))

    def _expandir_pivo(self, exprs):
        coluna, valores = self._pivo
        saidas = []
        varias = len(exprs) > 1
        for v in valores:
            nome_valor = 'null' if v is None else texto_do_valor(v)
            for x in exprs:
                base = sem_alias(x)
                if not base.eh_agregacao:
                    raise AnalysisException('Aggregate expression required for pivot.', 'PIVOT_REQUIRES_AGGREGATE', {}, '42K0F')
                nome_agg = x.alias if isinstance(x, Alias) else base.nome()
                filtrada = Agg(base.funcao, base.args, base.distinto, base.ignorar_nulos, filtro_de_pivo(coluna, v))
                saidas.append(Alias(filtrada, f'{nome_valor}_{nome_agg}' if varias else nome_valor))
        return saidas

