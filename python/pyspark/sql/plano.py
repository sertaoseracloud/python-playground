"""Plano físico do DataFrame (uma versão simplificada do que o Spark mostra no explain()).

Cada nó tem `saida` (os atributos), `linha()` (o texto no explain), `num_particoes()`,
`tamanho()` (bytes estimados, para escolher o broadcast) e `rdd()`: o RDD de tuplas que
calcula o nó, em cima do motor de estágios. Os nós largos (Exchange) cortam o estágio."""
import math

from .. import _motor as m
from ..errors import AnalysisException
from ..rdd import _Estreito, _Largo
from . import types as T
from .column import Alias, Atributo, Col, Entrada, Ref, nome_de_saida, sem_alias

INFINITO = math.inf


def _zero(_):
    return 0


class Projetar:
    def __init__(self, funcoes):
        self.funcoes = funcoes

    def __call__(self, linhas):
        fs = self.funcoes
        return [tuple(f(linha) for f in fs) for linha in linhas]


class FiltrarLinhas:
    def __init__(self, predicado):
        self.predicado = predicado

    def __call__(self, linhas):
        p = self.predicado
        return [linha for linha in linhas if p(linha) is True]


class Limitar:
    def __init__(self, n):
        self.n = n

    def __call__(self, linhas):
        return linhas[:self.n]


class EmTupla:
    def __call__(self, valores):
        return [(v,) for v in valores]


class Converter:
    """Linhas do aluno (tupla, lista, dicionário ou Row) → tuplas no schema, conferindo os tipos."""

    def __init__(self, schema):
        self.schema = schema

    def __call__(self, linhas):
        return [converter_linha(linha, self.schema) for linha in linhas]


def converter_linha(linha, schema):
    campos = schema.fields
    if isinstance(linha, dict):
        valores = [linha.get(f.name) for f in campos]
    elif isinstance(linha, T.Row) and hasattr(linha, '__fields__'):
        valores = [linha[f.name] if f.name in linha.__fields__ else None for f in campos] \
            if set(linha.__fields__) >= set(schema.names) and linha.__fields__ != schema.names else list(linha)
    elif isinstance(linha, (tuple, list)):
        valores = list(linha)
    else:
        valores = [linha]
    if len(valores) != len(campos):
        from ..errors import PySparkValueError
        raise PySparkValueError(f'The length of obj ({len(valores)}) and fields ({len(campos)}) should be the same.',
                                'LENGTH_SHOULD_BE_THE_SAME', {'arg1': 'obj', 'arg2': 'fields', 'arg1_length': str(len(valores)), 'arg2_length': str(len(campos))})
    return tuple(T.conferir(v, f.dataType, f.name) for v, f in zip(valores, campos))


def tamanho_da_linha(atributos):
    total = 8
    for a in atributos:
        t = a.tipo
        total += 20 if isinstance(t, (T.StringType, T.ArrayType, T.MapType, T.StructType)) else 4 if isinstance(t, (T.IntegerType, T.DateType)) else 8
    return total


class No:
    filhos = ()

    def __init__(self, sessao):
        self.sessao = sessao

    def conf(self, chave):
        return self.sessao.conf.get(chave)

    @property
    def ansi(self):
        return self.sessao.conf.get('spark.sql.ansi.enabled', 'true').lower() == 'true'

    def entrada(self, i=0):
        return Entrada(self.filhos[i].saida, self.ansi)

    def linha(self, raiz=False):
        raise NotImplementedError

    def filhos_no_explain(self):
        return self.filhos

    def num_particoes(self):
        return self.filhos[0].num_particoes()

    def tamanho(self):
        return self.filhos[0].tamanho()

    def rdd(self):
        raise NotImplementedError

    def percorrer(self):
        yield self
        for f in self.filhos_no_explain():
            yield from f.percorrer()

    def transparente(self):
        """Nós que não aparecem no plano físico (alias de tabela)."""
        return False


def arvore(no, linhas=None, ultimos=(), raiz=True):
    """As linhas do plano, como o treeString do Spark (`+- ` no último filho, `:- ` nos outros)."""
    linhas = [] if linhas is None else linhas
    while no.transparente():
        no = no.filhos[0]
    prefixo = ''
    if ultimos:
        prefixo = ''.join('   ' if u else ':  ' for u in ultimos[:-1]) + ('+- ' if ultimos[-1] else ':- ')
    linhas.append(prefixo + no.linha(raiz))
    interno = getattr(no, 'interno', None)
    if interno is not None:  # InMemoryTableScan: a relação guardada e o plano dela, mais para dentro
        recuo = ''.join('   ' if u else ':  ' for u in ultimos) + '   '
        linhas.append(recuo + '+- ' + interno.linha())
        sub = arvore(interno.plano, raiz=False)
        linhas.extend(recuo + '      ' + s for s in sub)
    filhos = no.filhos_no_explain()
    for i, f in enumerate(filhos):
        arvore(f, linhas, (*ultimos, i == len(filhos) - 1), raiz=False)
    return linhas


def nos(no):
    """Todos os nós visíveis do plano (sem entrar no plano guardado de um cache)."""
    while no.transparente():
        no = no.filhos[0]
    yield no
    for f in no.filhos_no_explain():
        yield from nos(f)


def lista_de_atributos(atributos, separador=', '):
    return separador.join(a.ref() for a in atributos)


# ---------- fontes ----------

class ScanRDD(No):
    """createDataFrame de uma lista ou de um RDD (o PySpark mostra Scan ExistingRDD)."""

    def __init__(self, sessao, rdd, atributos):
        super().__init__(sessao)
        self._rdd, self.saida = rdd, atributos

    def linha(self, raiz=False):
        return f"Scan ExistingRDD[{lista_de_atributos(self.saida, ',')}]"

    def num_particoes(self):
        return self._rdd.getNumPartitions()

    def tamanho(self):
        return INFINITO  # o Spark não sabe o tamanho de um RDD

    def rdd(self):
        return self._rdd


class Range(No):
    def __init__(self, sessao, inicio, fim, passo, n):
        super().__init__(sessao)
        self.inicio, self.fim, self.passo, self.n = inicio, fim, passo, n
        self.saida = [Atributo('id', T.LongType(), anulavel=False)]

    def linha(self, raiz=False):
        return f'Range ({self.inicio}, {self.fim}, step={self.passo}, splits={self.n})'

    def num_particoes(self):
        return self.n

    def tamanho(self):
        return len(range(self.inicio, self.fim, self.passo)) * 8

    def rdd(self):
        sc = self.sessao.sparkContext
        return _Estreito(sc.parallelize(range(self.inicio, self.fim, self.passo), self.n), EmTupla(), 'range')


class UmaLinha(No):
    """SELECT sem FROM."""

    def __init__(self, sessao):
        super().__init__(sessao)
        self.saida = []

    def linha(self, raiz=False):
        return 'Scan OneRowRelation[]'

    def num_particoes(self):
        return 1

    def tamanho(self):
        return 8

    def rdd(self):
        return self.sessao.sparkContext.parallelize([()], 1)


class Apelido(No):
    """df.alias('t') e o alias de tabela no SQL: só marca os atributos com o qualificador."""

    def __init__(self, filho, nome):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.nome = nome
        self.saida = [a.com(qualificador=nome) for a in filho.saida]

    def transparente(self):
        return True

    def linha(self, raiz=False):
        return self.filhos[0].linha(raiz)

    def rdd(self):
        return self.filhos[0].rdd()


# ---------- estreitos ----------

def atributo_de_saida(expr, e):
    """O atributo que uma expressão do select produz (o mesmo, se for só a coluna)."""
    base = sem_alias(expr)
    if isinstance(base, (Col, Ref)) and not isinstance(expr, Alias):
        return e.atributos[e.achar(base.nome_col, base.qualificador) if isinstance(base, Col) else e.achar_atributo(base.atributo)]
    return Atributo(nome_de_saida(expr), expr.tipo(e), anulavel=expr.anulavel(e))


class Project(No):
    def __init__(self, filho, exprs, operacao='select'):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.exprs, self.operacao = list(exprs), operacao
        e = self.entrada()
        self.saida = [atributo_de_saida(x, e) for x in self.exprs]

    def linha(self, raiz=False):
        e = self.entrada()
        partes = []
        for x, a in zip(self.exprs, self.saida):
            base = sem_alias(x)
            if isinstance(base, (Col, Ref)) and not isinstance(x, Alias):
                partes.append(a.ref())
            else:
                partes.append(f'{x.explicar(e)} AS {a.ref()}')
        return f"Project [{', '.join(partes)}]"

    def tamanho(self):
        filho = self.filhos[0].tamanho()
        if filho == INFINITO:
            return INFINITO
        return filho * tamanho_da_linha(self.saida) / max(1, tamanho_da_linha(self.filhos[0].saida))

    def rdd(self):
        e = self.entrada()
        return _Estreito(self.filhos[0].rdd(), Projetar([x.compilar(e) for x in self.exprs]), self.operacao)


class Filter(No):
    def __init__(self, filho, condicao):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.condicao = condicao
        self.saida = filho.saida
        tipo = condicao.tipo(self.entrada())
        if not isinstance(tipo, (T.BooleanType, T.NullType)):
            raise AnalysisException(
                f'Cannot resolve "{condicao.nome()}" due to data type mismatch: The filter expression must be of type "BOOLEAN", not "{tipo.simpleString().upper()}".',
                'DATATYPE_MISMATCH.FILTER_NOT_BOOLEAN', {}, '42K09')

    def linha(self, raiz=False):
        return f'Filter {self.condicao.explicar(self.entrada())}'

    def rdd(self):
        return _Estreito(self.filhos[0].rdd(), FiltrarLinhas(self.condicao.compilar(self.entrada())), 'filter')


class Limit(No):
    """CollectLimit na raiz; dentro do plano, GlobalLimit + Exchange SinglePartition + LocalLimit."""

    def __init__(self, filho, n):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.n = n
        self.saida = filho.saida

    def linha(self, raiz=False):
        return f'CollectLimit {self.n}' if raiz else f'GlobalLimit {self.n}, 0'

    def num_particoes(self):
        return 1

    def tamanho(self):
        return self.n * tamanho_da_linha(self.saida)

    def rdd(self):
        local = _Estreito(self.filhos[0].rdd(), Limitar(self.n), 'limit')
        junto = _Largo([local], 1, [m.Particionar(1, chave=_zero)], None, 'limit')
        return _Estreito(junto, Limitar(self.n), 'limit')
