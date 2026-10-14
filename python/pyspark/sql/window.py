"""Funções de janela: Window.partitionBy(...).orderBy(...), row_number, rank, lag, somas acumuladas."""
import sys

from ..errors import AnalysisException
from . import types as T
from .column import Expr, Lit, Ordem, como_ordem, literal_ou_coluna, para_expr

_ILIMITADO = sys.maxsize


def _limite(valor):
    if valor <= -_ILIMITADO:
        return None  # sem limite para trás
    if valor >= _ILIMITADO:
        return None
    return int(valor)


class WindowSpec:
    def __init__(self, particao=(), ordem=(), quadro=None):
        self.particao, self.ordem, self.quadro = list(particao), list(ordem), quadro

    def partitionBy(self, *cols):
        if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
            cols = cols[0]
        return WindowSpec([para_expr(c) for c in cols], self.ordem, self.quadro)

    def orderBy(self, *cols):
        if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
            cols = cols[0]
        return WindowSpec(self.particao, [como_ordem(para_expr(c)) for c in cols], self.quadro)

    def rowsBetween(self, inicio, fim):
        return WindowSpec(self.particao, self.ordem, ('rows', inicio, fim))

    def rangeBetween(self, inicio, fim):
        return WindowSpec(self.particao, self.ordem, ('range', inicio, fim))

    def chave(self):
        return (tuple(p.nome() for p in self.particao), tuple(o.nome() for o in self.ordem))

    def texto(self, partes_particao, partes_ordem, funcao_de_ranking):
        pedacos = []
        if partes_particao:
            pedacos.append('PARTITION BY ' + ', '.join(partes_particao))
        if partes_ordem:
            pedacos.append('ORDER BY ' + ', '.join(partes_ordem))
        pedacos.append(self.texto_do_quadro(funcao_de_ranking))
        return ' '.join(pedacos)

    def texto_do_quadro(self, funcao_de_ranking=False):
        def ponta(v, inicio):
            if v <= -_ILIMITADO:
                return 'UNBOUNDED PRECEDING'
            if v >= _ILIMITADO:
                return 'UNBOUNDED FOLLOWING'
            if v == 0:
                return 'CURRENT ROW'
            return f'{-v} PRECEDING' if v < 0 else f'{v} FOLLOWING'
        if self.quadro is not None:
            tipo, a, b = self.quadro
            return f"{'ROWS' if tipo == 'rows' else 'RANGE'} BETWEEN {ponta(a, True)} AND {ponta(b, False)}"
        if funcao_de_ranking:
            return 'ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW'
        if self.ordem:
            return 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW'
        return 'ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING'


class Window:
    unboundedPreceding = -_ILIMITADO
    unboundedFollowing = _ILIMITADO
    currentRow = 0

    @staticmethod
    def partitionBy(*cols):
        return WindowSpec().partitionBy(*cols)

    @staticmethod
    def orderBy(*cols):
        return WindowSpec().orderBy(*cols)

    @staticmethod
    def rowsBetween(inicio, fim):
        return WindowSpec().rowsBetween(inicio, fim)

    @staticmethod
    def rangeBetween(inicio, fim):
        return WindowSpec().rangeBetween(inicio, fim)


class FuncaoDeJanela(Expr):
    """row_number, rank, dense_rank, percent_rank, ntile, lag, lead: só existem com over()."""
    precisa_de_ordem = True
    ranking = True

    def __init__(self, nome, args=(), tipo=None, anulavel=False):
        self.nome_func, self.args, self._tipo, self._anulavel = nome, list(args), tipo or T.IntegerType(), anulavel

    def filhos(self):
        return tuple(self.args)

    def com_filhos(self, filhos):
        novo = FuncaoDeJanela(self.nome_func, filhos, self._tipo, self._anulavel)
        novo.ranking = self.ranking
        return novo

    def _formatar(self, partes):
        return f"{self.nome_func}({', '.join(partes)})"

    def tipo(self, e):
        if self.nome_func in ('lag', 'lead'):
            return self.args[0].tipo(e)
        return self._tipo

    def anulavel(self, e):
        return self._anulavel

    def compilar(self, e):
        raise AnalysisException(f'Window function {self.nome()} requires an OVER clause.', 'WINDOW_FUNCTION_WITHOUT_OVER_CLAUSE',
                                {'funcName': self.nome_func}, '42601')


def deslocamento(nome, coluna, offset, default):
    f = FuncaoDeJanela(nome, [para_expr(coluna), Lit(int(offset)), literal_ou_coluna(default)], anulavel=True)
    f.ranking = False
    return f


class Sobre(Expr):
    """funcao OVER (janela)."""
    eh_janela = True

    def __init__(self, funcao, janela):
        self.funcao, self.janela = funcao, janela

    def filhos(self):
        return (self.funcao, *self.janela.particao, *self.janela.ordem)

    def com_filhos(self, filhos):
        n_p = len(self.janela.particao)
        return Sobre(filhos[0], WindowSpec(filhos[1:1 + n_p], filhos[1 + n_p:], self.janela.quadro))

    def _eh_ranking(self):
        return isinstance(self.funcao, FuncaoDeJanela)

    def _formatar(self, partes):
        n_p = len(self.janela.particao)
        texto = self.janela.texto(partes[1:1 + n_p], partes[1 + n_p:], self._eh_ranking())
        return f'{partes[0]} OVER ({texto})'

    def tipo(self, e):
        for p in self.janela.particao:
            p.tipo(e)
        for o in self.janela.ordem:
            o.tipo(e)
        if isinstance(self.funcao, FuncaoDeJanela) and self.funcao.precisa_de_ordem and not self.janela.ordem:
            raise AnalysisException(
                f'Window function {self.funcao.nome()} requires window to be ordered, please add ORDER BY clause. '
                'For example SELECT row_number()(value_expr) OVER (PARTITION BY window_partition ORDER BY window_ordering) from table.',
                None, {}, None)
        if not (isinstance(self.funcao, FuncaoDeJanela) or self.funcao.eh_agregacao):
            raise AnalysisException(f'Expression {self.funcao.nome()} is not supported as a window function.',
                                    'UNSUPPORTED_EXPR_FOR_WINDOW', {}, '42P20')
        return self.funcao.tipo(e)

    def anulavel(self, e):
        return self.funcao.anulavel(e)

    def compilar(self, e):
        raise AnalysisException('Window expressions are evaluated by the Window operator.', 'INTERNAL_ERROR')


def eh_ordem(x):
    return isinstance(x, Ordem)
