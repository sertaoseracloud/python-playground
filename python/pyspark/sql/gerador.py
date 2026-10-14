"""Geradores (explode): uma linha de entrada vira zero ou mais linhas de saída."""
from ..errors import AnalysisException
from ..rdd import _Estreito
from . import types as T
from .column import Alias, Atributo, Entrada, Expr, Ref, sem_alias
from .plano import No, Project


class Explode(Expr):
    eh_gerador = True

    def __init__(self, filho, externo=False, posicao=False):
        self.filho, self.externo, self.posicao = filho, externo, posicao

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return Explode(filhos[0], self.externo, self.posicao)

    def _formatar(self, partes):
        nome = ('pos' if self.posicao else '') + 'explode' + ('_outer' if self.externo else '')
        return f'{nome}({partes[0]})'

    def colunas(self, e):
        """(nome, tipo) das colunas que o gerador produz."""
        t = self.filho.tipo(e)
        if isinstance(t, T.MapType):
            cols = [('key', t.keyType), ('value', t.valueType)]
        elif isinstance(t, T.ArrayType):
            cols = [('col', t.elementType)]
        else:
            raise AnalysisException(
                f'Cannot resolve "{self.nome()}" due to data type mismatch: Parameter 1 requires the ("ARRAY" or "MAP") type, '
                f'however "{self.filho.nome()}" has the type "{t.simpleString().upper()}".', 'DATATYPE_MISMATCH.UNEXPECTED_INPUT_TYPE', {}, '42K09')
        if self.posicao:
            cols = [('pos', T.IntegerType())] + cols
        return cols

    def tipo(self, e):
        return self.colunas(e)[-1][1]


class Gerar:
    def __init__(self, valor, externo, posicao, mapa, largura):
        self.valor, self.externo, self.posicao, self.mapa, self.largura = valor, externo, posicao, mapa, largura

    def __call__(self, linhas):
        saida = []
        for linha in linhas:
            itens = self.valor(linha)
            if itens:
                pares = list(itens.items()) if self.mapa else [(x,) for x in itens]
                for i, par in enumerate(pares):
                    saida.append(linha + ((i,) if self.posicao else ()) + tuple(par))
            elif self.externo:
                saida.append(linha + (None,) * self.largura)
        return saida


class Generate(No):
    def __init__(self, filho, gerador, atributos):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.gerador, self.atributos = gerador, atributos
        self.saida = list(filho.saida) + list(atributos)

    def linha(self, raiz=False):
        e = self.entrada()
        return (f"Generate {self.gerador.explicar(e)}, [{', '.join(a.ref() for a in self.filhos[0].saida)}], "
                f"{'true' if self.gerador.externo else 'false'}, [{', '.join(a.ref() for a in self.atributos)}]")

    def rdd(self):
        e = self.entrada()
        t = self.gerador.filho.tipo(e)
        funcao = Gerar(self.gerador.filho.compilar(e), self.gerador.externo, self.gerador.posicao, isinstance(t, T.MapType), len(self.atributos))
        return _Estreito(self.filhos[0].rdd(), funcao, 'explode')


def tem_gerador(expr):
    return expr.tem(lambda n: n.eh_gerador)


def gerar(plano, exprs, operacao):
    com = [x for x in exprs if tem_gerador(x)]
    if len(com) > 1:
        raise AnalysisException('Only one generator allowed per SELECT clause but found 2.', 'UNSUPPORTED_GENERATOR.MULTI_GENERATOR',
                                {}, '42K0E')
    alvo = com[0]
    gerador = sem_alias(alvo)
    if not isinstance(gerador, Explode):
        raise AnalysisException('Generators are not supported when it\'s nested in expressions.', 'UNSUPPORTED_GENERATOR.NESTED_IN_EXPRESSIONS',
                                {}, '42K0E')
    e = Entrada(plano.saida, plano.ansi)
    colunas = gerador.colunas(e)
    nomes = list(alvo.nomes) if isinstance(alvo, Alias) and getattr(alvo, 'nomes', None) else (
        [alvo.alias] if isinstance(alvo, Alias) and len(colunas) == 1 else [n for n, _ in colunas])
    atributos = [Atributo(n, t) for n, (_, t) in zip(nomes, colunas)]
    no = Generate(plano, gerador, atributos)
    saidas = []
    for x in exprs:
        if x is alvo:
            saidas.extend(Ref(a) for a in atributos)
        else:
            saidas.append(x)
    return Project(no, saidas, operacao)
