"""Funções de agregação (sum, avg, count...) e os acumuladores que elas usam.

Cada agregação roda em duas fases, como no HashAggregate do Spark: no lado do map, cada
partição soma o que tem (parcial); depois do shuffle, as parciais de cada chave se juntam
(final). Um acumulador sabe começar (`zero`), somar um valor, juntar dois parciais e dar o
resultado (`fim`)."""
import math

from . import types as T
from .column import Expr, Lit, comparar_valores


class Acumulador:
    def zero(self):
        return None

    def somar(self, acc, v):
        raise NotImplementedError

    def juntar(self, a, b):
        raise NotImplementedError

    def fim(self, acc):
        return acc


class Soma(Acumulador):
    def somar(self, acc, v):
        if v is None:
            return acc
        return v if acc is None else acc + v

    juntar = somar


class Contar(Acumulador):
    def zero(self):
        return 0

    def somar(self, acc, v):
        return acc + (v is not None)

    def juntar(self, a, b):
        return a + b


class Media(Acumulador):
    def zero(self):
        return (0, 0)

    def somar(self, acc, v):
        return acc if v is None else (acc[0] + v, acc[1] + 1)

    def juntar(self, a, b):
        return (a[0] + b[0], a[1] + b[1])

    def fim(self, acc):
        return acc[0] / acc[1] if acc[1] else None


class Extremo(Acumulador):
    def __init__(self, maior):
        self.maior = maior

    def somar(self, acc, v):
        if v is None:
            return acc
        if acc is None:
            return v
        c = comparar_valores(v, acc)
        return v if (c > 0 if self.maior else c < 0) else acc

    juntar = somar


class ColetarLista(Acumulador):
    def zero(self):
        return []

    def somar(self, acc, v):
        return acc if v is None else acc + [v]

    def juntar(self, a, b):
        return a + b


class ColetarConjunto(ColetarLista):
    def somar(self, acc, v):
        return acc if v is None or v in acc else acc + [v]

    def juntar(self, a, b):
        return a + [x for x in b if x not in a]


class Primeiro(Acumulador):
    def __init__(self, ultimo=False, ignorar_nulos=False):
        self.ultimo, self.ignorar_nulos = ultimo, ignorar_nulos

    def zero(self):
        return (False, None)

    def somar(self, acc, v):
        if self.ignorar_nulos and v is None:
            return acc
        if self.ultimo or not acc[0]:
            return (True, v)
        return acc

    def juntar(self, a, b):
        if self.ultimo:
            return b if b[0] else a
        return a if a[0] else b

    def fim(self, acc):
        return acc[1]


class Variancia(Acumulador):
    def __init__(self, raiz=False, populacao=False):
        self.raiz, self.populacao = raiz, populacao

    def zero(self):
        return (0, 0.0, 0.0)

    def somar(self, acc, v):
        if v is None:
            return acc
        return (acc[0] + 1, acc[1] + v, acc[2] + v * v)

    def juntar(self, a, b):
        return (a[0] + b[0], a[1] + b[1], a[2] + b[2])

    def fim(self, acc):
        n, s, s2 = acc
        divisor = n if self.populacao else n - 1
        if n == 0 or divisor <= 0:
            return None
        var = max((s2 - s * s / n) / divisor, 0.0)
        return math.sqrt(var) if self.raiz else var


class Distinto(Acumulador):
    """count(DISTINCT x), sum(DISTINCT x): guarda os valores distintos e aplica a base no fim."""

    def __init__(self, base, varios=False):
        self.base, self.varios = base, varios

    def zero(self):
        return {}

    def somar(self, acc, v):
        if v is None or (self.varios and any(x is None for x in v)):
            return acc
        acc = dict(acc)
        acc[v] = True
        return acc

    def juntar(self, a, b):
        return {**a, **b}

    def fim(self, acc):
        if isinstance(self.base, Contar):
            return len(acc)
        r = self.base.zero()
        for v in acc:
            r = self.base.somar(r, v)
        return self.base.fim(r)


class ComFiltro(Acumulador):
    """Agregação que só conta as linhas da condição (usada pelo pivot); sem linhas, NULL."""

    def __init__(self, base):
        self.base = base

    def zero(self):
        return (False, self.base.zero())

    def somar(self, acc, par):
        passou, v = par
        if not passou:
            return acc
        return (True, self.base.somar(acc[1], v))

    def juntar(self, a, b):
        return (a[0] or b[0], self.base.juntar(a[1], b[1]))

    def fim(self, acc):
        return self.base.fim(acc[1]) if acc[0] else None


_INTEIROS = (T.IntegerType, T.LongType, T.ShortType, T.ByteType)


class Agg(Expr):
    """Uma agregação: sum(x), avg(x), count(1), count(DISTINCT x)..."""
    eh_agregacao = True

    def __init__(self, funcao, args, distinto=False, ignorar_nulos=False, filtro=None):
        self.funcao, self.args, self.distinto, self.ignorar_nulos, self.filtro = funcao, list(args), distinto, ignorar_nulos, filtro

    def filhos(self):
        return tuple(self.args) + ((self.filtro,) if self.filtro is not None else ())

    def com_filhos(self, filhos):
        n = len(self.args)
        return Agg(self.funcao, filhos[:n], self.distinto, self.ignorar_nulos, filhos[n] if len(filhos) > n else None)

    def _formatar(self, partes, prefixo=''):
        args = partes[:len(self.args)]
        nome = {'sum_distinct': 'sum', 'count_distinct': 'count'}.get(self.funcao, self.funcao)
        texto = f"{prefixo}{nome}({'DISTINCT ' if self.distinto else ''}{', '.join(args)})"
        if self.filtro is not None:
            texto += f' FILTER (WHERE {partes[-1]})'
        return texto

    def explicar_parcial(self, e):
        return self._formatar([f.explicar(e) for f in self.filhos()], 'partial_')

    def tipo(self, e):
        t = self.args[0].tipo(e) if self.args else T.LongType()
        f = self.funcao
        if f in ('count', 'approx_count_distinct'):
            return T.LongType()
        if f == 'sum':
            if isinstance(t, _INTEIROS):
                return T.LongType()
            if isinstance(t, (T.DoubleType, T.FloatType, T.StringType, T.NullType)):
                return T.DoubleType()
            raise _tipo_errado(self, t, 'NUMERIC')
        if f in ('avg', 'stddev', 'stddev_samp', 'stddev_pop', 'variance', 'var_samp', 'var_pop'):
            if not isinstance(t, T.NUMERICOS + (T.StringType, T.NullType)):
                raise _tipo_errado(self, t, 'NUMERIC')
            return T.DoubleType()
        if f in ('collect_list', 'collect_set'):
            return T.ArrayType(t, False)
        return t

    def anulavel(self, e):
        return self.funcao not in ('count', 'approx_count_distinct', 'collect_list', 'collect_set')

    def acumulador(self, e):
        f = self.funcao
        base = {
            'sum': Soma(), 'count': Contar(), 'avg': Media(), 'min': Extremo(False), 'max': Extremo(True),
            'collect_list': ColetarLista(), 'collect_set': ColetarConjunto(),
            'first': Primeiro(False, self.ignorar_nulos), 'last': Primeiro(True, self.ignorar_nulos),
            'stddev': Variancia(True), 'stddev_samp': Variancia(True), 'stddev_pop': Variancia(True, True),
            'variance': Variancia(), 'var_samp': Variancia(), 'var_pop': Variancia(False, True),
            'approx_count_distinct': Contar(),
        }[f]
        if self.distinto or f == 'approx_count_distinct':
            base = Distinto(base, varios=len(self.args) > 1)
        if self.filtro is not None:
            base = ComFiltro(base)
        return base

    def entrada_do_valor(self, e):
        """Função linha → o valor que entra no acumulador (tupla, se forem vários argumentos)."""
        from .column import como
        fs = [a.compilar(e) for a in self.args]
        if self.funcao in ('sum', 'avg', 'stddev', 'stddev_samp', 'stddev_pop', 'variance', 'var_samp', 'var_pop'):
            alvo = T.DoubleType() if not isinstance(self.args[0].tipo(e), _INTEIROS) else T.LongType()
            fs = [como(fs[0], self.args[0].tipo(e), alvo, e.ansi)]
        if len(fs) == 1:
            valor = fs[0]
        else:
            def valor(linha):
                return tuple(f(linha) for f in fs)
        if self.filtro is None:
            return valor
        condicao = self.filtro.compilar(e)
        return lambda linha: (condicao(linha) is True, valor(linha))


def _tipo_errado(agg, tipo, esperado):
    from ..errors import AnalysisException
    return AnalysisException(
        f'Cannot resolve "{agg.nome()}" due to data type mismatch: Parameter 1 requires the "{esperado}" type, '
        f'however "{agg.args[0].nome()}" has the type "{tipo.simpleString().upper()}".',
        'DATATYPE_MISMATCH.UNEXPECTED_INPUT_TYPE', {}, '42K09')


def agregacoes_de(expr):
    """As agregações de uma expressão (sem entrar nas funções de janela)."""
    if expr.eh_janela:
        return []
    if expr.eh_agregacao:
        return [expr]
    return [a for f in expr.filhos() for a in agregacoes_de(f)]


def contar_tudo():
    return Agg('count', [Lit(1)])
