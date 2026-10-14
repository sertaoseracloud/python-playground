"""Colunas e expressões do Spark SQL.

Uma `Column` guarda uma expressão (`Expr`). A expressão sabe:
- `nome()`: o nome automático do Spark (`(quantidade * preco)`, `upper(regiao)`);
- `explicar(e)`: o mesmo com os ids dos atributos, para o explain() (`(quantidade#2L * preco#3)`);
- `tipo(e)` e `anulavel(e)`: resolvidos contra a entrada `e` (os atributos do plano filho);
- `compilar(e)`: uma função `linha (tupla) → valor`, que roda dentro das tarefas, nos workers.

Os nomes de coluna são resolvidos sem diferenciar maiúsculas, como no Spark. NULL segue a
lógica de três valores do SQL, e o modo ANSI (padrão do Spark 4) dá erro na divisão por zero
e no CAST de texto inválido."""
import datetime
import decimal
import itertools
import math
import re

from ..errors import AnalysisException, PySparkTypeError, PySparkValueError, cast_invalido, data_invalida, divisao_por_zero
from . import types as T
from .mostrar import java_double, texto_do_valor

# ---------- atributos e entrada ----------

_ids = itertools.count()


def novo_id():
    return next(_ids)


def reiniciar_ids():
    global _ids
    _ids = itertools.count()


class Atributo:
    """Uma coluna de saída de um nó do plano (o `nome#id` do Spark)."""
    __slots__ = ('nome', 'tipo', 'id', 'anulavel', 'qualificador')

    def __init__(self, nome, tipo, id=None, anulavel=True, qualificador=None):
        self.nome, self.tipo, self.anulavel, self.qualificador = nome, tipo, anulavel, qualificador
        self.id = novo_id() if id is None else id

    def ref(self):
        return f"{self.nome}#{self.id}{'L' if isinstance(self.tipo, T.LongType) else ''}"

    def com(self, **mudancas):
        a = Atributo(self.nome, self.tipo, self.id, self.anulavel, self.qualificador)
        for k, v in mudancas.items():
            setattr(a, k, v)
        return a

    def __repr__(self):
        return self.ref()


def levenshtein(a, b):
    anterior = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        atual = [i]
        for j, cb in enumerate(b, 1):
            atual.append(min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (ca != cb)))
        anterior = atual
    return anterior[-1]


class Entrada:
    """Os atributos que uma expressão pode usar (a saída do nó filho)."""

    def __init__(self, atributos, ansi=True, plano=None):
        self.atributos = list(atributos)
        self.ansi = ansi
        self.plano = plano

    def achar(self, nome, qualificador=None):
        baixo = nome.lower()
        achados = [i for i, a in enumerate(self.atributos) if a.nome.lower() == baixo
                   and (qualificador is None or (a.qualificador or '').lower() == qualificador.lower())]
        if len(achados) == 1:
            return achados[0]
        texto = f'{qualificador}.{nome}' if qualificador else nome
        if len(achados) > 1:
            candidatos = ', '.join((f'`{a.qualificador}`.' if a.qualificador else '') + f'`{a.nome}`' for a in (self.atributos[i] for i in achados))
            raise AnalysisException(f'Reference `{texto}` is ambiguous, could be: [{candidatos}].', 'AMBIGUOUS_REFERENCE',
                                    {'name': f'`{texto}`', 'referenceNames': f'[{candidatos}]'}, '42704')
        raise erro_de_coluna(texto, [a.nome for a in self.atributos], self._linha_plano(texto))

    def achar_atributo(self, atributo):
        for i, a in enumerate(self.atributos):
            if a.id == atributo.id:
                return i
        return self.achar(atributo.nome)

    def _linha_plano(self, nome):
        return f"'Project ['{nome}]"


def erro_de_coluna(nome, candidatos, plano=None):
    if not candidatos:
        return AnalysisException(f'A column, variable, or function parameter with name `{nome}` cannot be resolved.',
                                 'UNRESOLVED_COLUMN.WITHOUT_SUGGESTION', {'objectName': f'`{nome}`'}, '42703', plano=plano)
    ordem = sorted(range(len(candidatos)), key=lambda i: (levenshtein(nome.lower(), candidatos[i].lower()), i))
    sugestao = ', '.join(f'`{candidatos[i]}`' for i in ordem[:5])
    return AnalysisException(
        f'A column, variable, or function parameter with name `{nome}` cannot be resolved. '
        f'Did you mean one of the following? [{sugestao}].',
        'UNRESOLVED_COLUMN.WITH_SUGGESTION', {'objectName': f'`{nome}`', 'proposal': sugestao}, '42703', plano=plano)


# ---------- expressões ----------

class Expr:
    eh_agregacao = False
    eh_janela = False
    eh_gerador = False
    eh_udf = False

    def filhos(self):
        return ()

    def com_filhos(self, filhos):
        return self

    def nome(self):
        return self._formatar([f.nome() for f in self.filhos()])

    def explicar(self, e):
        return self._formatar([f.explicar(e) for f in self.filhos()])

    def _formatar(self, partes):
        raise NotImplementedError

    def tipo(self, e):
        raise NotImplementedError

    def anulavel(self, e):
        return any(f.anulavel(e) for f in self.filhos()) if self.filhos() else True

    def compilar(self, e):
        raise NotImplementedError

    def percorrer(self):
        yield self
        for f in self.filhos():
            yield from f.percorrer()

    def tem(self, condicao):
        return any(condicao(x) for x in self.percorrer())


def substituir(expr, troca):
    """Reconstrói a árvore trocando os nós para os quais `troca(no)` devolve algo."""
    novo = troca(expr)
    if novo is not None:
        return novo
    filhos = expr.filhos()
    if not filhos:
        return expr
    return expr.com_filhos([substituir(f, troca) for f in filhos])


class Col(Expr):
    def __init__(self, nome, qualificador=None):
        if qualificador is None and '.' in nome and not nome.startswith('`'):
            qualificador, nome = nome.split('.', 1)
        self.nome_col, self.qualificador = nome.strip('`'), qualificador

    def nome(self):
        return self.nome_col

    def _atributo(self, e):
        return e.atributos[e.achar(self.nome_col, self.qualificador)]

    def explicar(self, e):
        return self._atributo(e).ref()

    def tipo(self, e):
        return self._atributo(e).tipo

    def anulavel(self, e):
        return self._atributo(e).anulavel

    def compilar(self, e):
        i = e.achar(self.nome_col, self.qualificador)
        return lambda linha: linha[i]


class Ref(Expr):
    """df['coluna'] e df.coluna: o atributo daquele DataFrame (resolve pelo id)."""

    def __init__(self, atributo):
        self.atributo = atributo

    def nome(self):
        return self.atributo.nome

    def _atributo(self, e):
        return e.atributos[e.achar_atributo(self.atributo)]

    def explicar(self, e):
        return self._atributo(e).ref()

    def tipo(self, e):
        return self._atributo(e).tipo

    def anulavel(self, e):
        return self._atributo(e).anulavel

    def compilar(self, e):
        i = e.achar_atributo(self.atributo)
        return lambda linha: linha[i]


class Estrela(Expr):
    def __init__(self, qualificador=None):
        self.qualificador = qualificador

    def nome(self):
        return f'{self.qualificador}.*' if self.qualificador else '*'

    def expandir(self, e):
        q = (self.qualificador or '').lower()
        return [Ref(a) for a in e.atributos if not q or (a.qualificador or '').lower() == q]


def tipo_do_literal(valor):
    if isinstance(valor, bool):
        return T.BooleanType()
    if isinstance(valor, int):
        return T.IntegerType() if -2**31 <= valor < 2**31 else T.LongType()
    return T.inferir_tipo(valor)


class Lit(Expr):
    def __init__(self, valor, tipo=None):
        if isinstance(valor, tuple):
            valor = list(valor)
        self.valor = valor
        self._tipo = tipo or tipo_do_literal(valor)

    def nome(self):
        v = self.valor
        if v is None:
            return 'NULL'
        if isinstance(v, bool):
            return 'true' if v else 'false'
        if isinstance(v, float):
            return java_double(v)
        if isinstance(v, datetime.datetime):
            return f"TIMESTAMP '{texto_do_valor(v)}'"
        if isinstance(v, datetime.date):
            return f"DATE '{v.isoformat()}'"
        if isinstance(v, list):
            return 'array(' + ', '.join(Lit(x).nome() for x in v) + ')'
        return str(v)

    def explicar(self, e):
        return self.nome()

    def tipo(self, e):
        return self._tipo

    def anulavel(self, e):
        return self.valor is None

    def compilar(self, e):
        v = self.valor
        return lambda linha: v


class Alias(Expr):
    def __init__(self, filho, alias):
        self.filho, self.alias = filho, alias

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return Alias(filhos[0], self.alias)

    def nome(self):
        return self.alias

    def explicar(self, e):
        return self.filho.explicar(e)

    def tipo(self, e):
        return self.filho.tipo(e)

    def anulavel(self, e):
        return self.filho.anulavel(e)

    def compilar(self, e):
        return self.filho.compilar(e)


def nome_de_saida(expr):
    """O nome da coluna que a expressão produz no select (o cast de uma coluna mantém o nome dela)."""
    if isinstance(expr, Cast) and isinstance(expr.filho, (Col, Ref)):
        return expr.filho.nome()
    return expr.nome()


def sem_alias(expr):
    while isinstance(expr, Alias):
        expr = expr.filho
    return expr


# ---------- conversões (CAST) ----------

def _nome_sql(tipo):
    return tipo.simpleString().upper()


_VERDADE = {'true', 't', 'yes', 'y', '1'}
_FALSO = {'false', 'f', 'no', 'n', '0'}
_DATA = re.compile(r'^\s*(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[ T].*)?\s*$')
_DATA_HORA = re.compile(r'^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?\s*$')


def texto_para_data(texto):
    m = _DATA.match(texto)
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3) or 1))
    except ValueError:
        return None


def texto_para_data_hora(texto):
    m = _DATA_HORA.match(texto)
    if not m:
        return None
    a, mes, d, h, mi, s, frac = m.groups()
    try:
        return datetime.datetime(int(a), int(mes), int(d), int(h or 0), int(mi or 0), int(s or 0), int((frac or '0').ljust(6, '0')))
    except ValueError:
        return None


def converter(valor, de, para, ansi):
    """CAST de um valor (já sem NULL) do tipo `de` para o tipo `para`."""
    def falhou():
        if ansi:
            raise cast_invalido(texto_do_valor(valor), _nome_sql(de), _nome_sql(para))
        return None
    if isinstance(para, T.StringType):
        return valor if isinstance(valor, str) else texto_do_valor(valor)
    if isinstance(para, (T.IntegerType, T.LongType, T.ShortType, T.ByteType)):
        if isinstance(valor, bool):
            return int(valor)
        if isinstance(valor, int):
            return valor
        if isinstance(valor, float):
            if math.isnan(valor) or math.isinf(valor):
                return falhou()
            return int(valor)
        if isinstance(valor, str):
            texto = valor.strip()
            if re.fullmatch(r'[+-]?\d+', texto):
                return int(texto)
            if not ansi and re.fullmatch(r'[+-]?\d*\.\d*', texto) and texto not in ('.', '+.', '-.'):
                return int(float(texto))
            return falhou()
        return falhou()
    if isinstance(para, (T.DoubleType, T.FloatType)):
        if isinstance(valor, (bool, int, float)):
            return float(valor)
        if isinstance(valor, str):
            try:
                return float(valor.strip())
            except ValueError:
                return falhou()
        return falhou()
    if isinstance(para, T.BooleanType):
        if isinstance(valor, bool):
            return valor
        if isinstance(valor, (int, float)):
            return valor != 0
        if isinstance(valor, str):
            baixo = valor.strip().lower()
            if baixo in _VERDADE:
                return True
            if baixo in _FALSO:
                return False
        return falhou()
    if isinstance(para, T.DateType):
        if isinstance(valor, datetime.datetime):
            return valor.date()
        if isinstance(valor, datetime.date):
            return valor
        if isinstance(valor, str):
            data = texto_para_data(valor)
            if data is None and ansi:
                raise data_invalida(valor)
            return data
        return falhou()
    if isinstance(para, T.TimestampType):
        if isinstance(valor, datetime.datetime):
            return valor
        if isinstance(valor, datetime.date):
            return datetime.datetime(valor.year, valor.month, valor.day)
        if isinstance(valor, str):
            data = texto_para_data_hora(valor)
            if data is None and ansi:
                raise data_invalida(valor)
            return data
        return falhou()
    if isinstance(para, T.ArrayType):
        if isinstance(valor, list):
            return [None if v is None else converter(v, getattr(de, 'elementType', T.StringType()), para.elementType, ansi) for v in valor]
        return falhou()
    return valor


class Cast(Expr):
    def __init__(self, filho, para, do_usuario=False):
        self.filho = filho
        self.para = T.ler_tipo(para) if isinstance(para, str) else para
        self.do_usuario = do_usuario  # col.cast(...): no topo do select, a coluna fica com o nome da original

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return type(self)(filhos[0], self.para, self.do_usuario)

    def _formatar(self, partes):
        return f'CAST({partes[0]} AS {_nome_sql(self.para)})'

    def tipo(self, e):
        return self.para

    def compilar(self, e):
        f, de, para, ansi = self.filho.compilar(e), self.filho.tipo(e), self.para, e.ansi

        def cast(linha):
            v = f(linha)
            return None if v is None else converter(v, de, para, ansi)
        return cast


def como(f, de, para, ansi):
    """Função que converte o resultado de `f` para `para` (coerção implícita)."""
    if de == para or isinstance(de, T.NullType):
        return f

    def g(linha):
        v = f(linha)
        return None if v is None else converter(v, de, para, ansi)
    return g


# ---------- operadores ----------

def _resto_java(x, y):
    if isinstance(x, float) or isinstance(y, float):
        return math.fmod(x, y)
    r = abs(x) % abs(y)
    return r if x >= 0 else -r


_SIMBOLOS = {'+': '+', '-': '-', '*': '*', '/': '/', '%': '%', '==': '=', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
             '<=>': '<=>', 'and': 'AND', 'or': 'OR'}


class Binario(Expr):
    def __init__(self, op, a, b):
        self.op, self.a, self.b = op, a, b

    def filhos(self):
        return (self.a, self.b)

    def com_filhos(self, filhos):
        return Binario(self.op, *filhos)

    def _formatar(self, partes):
        if self.op == '**':
            return f'POWER({partes[0]}, {partes[1]})'
        return f'({partes[0]} {_SIMBOLOS[self.op]} {partes[1]})'

    def _tipo_comum(self, e):
        ta, tb = self.a.tipo(e), self.b.tipo(e)
        if isinstance(ta, T.StringType) and isinstance(tb, T.NUMERICOS):
            return T.DoubleType() if self.op in '+-*/%' else tb
        if isinstance(tb, T.StringType) and isinstance(ta, T.NUMERICOS):
            return T.DoubleType() if self.op in '+-*/%' else ta
        if {type(ta), type(tb)} == {T.StringType, T.DateType}:
            return T.DateType()
        if {type(ta), type(tb)} == {T.StringType, T.TimestampType}:
            return T.TimestampType()
        return T.tipo_mais_largo(ta, tb)

    def tipo(self, e):
        if self.op in ('==', '<', '<=', '>', '>=', '<=>'):
            self._tipo_comum(e)  # resolve as colunas dos dois lados (erro se não existem)
        if self.op in ('==', '<', '<=', '>', '>=', '<=>', 'and', 'or'):
            if self.op in ('and', 'or'):
                for lado in (self.a, self.b):
                    t = lado.tipo(e)
                    if not isinstance(t, (T.BooleanType, T.NullType)):
                        raise AnalysisException(
                            f'Cannot resolve "{self.nome()}" due to data type mismatch: the binary operator requires the input type "BOOLEAN", not "{_nome_sql(t)}".',
                            'DATATYPE_MISMATCH.BINARY_OP_DIFF_TYPES', {}, '42K09')
            return T.BooleanType()
        if self.op in ('/', '**'):
            return T.DoubleType()
        comum = self._tipo_comum(e)
        if not isinstance(comum, T.NUMERICOS + (T.NullType,)):
            raise AnalysisException(
                f'Cannot resolve "{self.nome()}" due to data type mismatch: the binary operator requires the input type '
                f'("NUMERIC" or "INTERVAL DAY TO SECOND" or "INTERVAL YEAR TO MONTH" or "INTERVAL"), not "{_nome_sql(comum)}".',
                'DATATYPE_MISMATCH.BINARY_OP_WRONG_TYPE', {}, '42K09')
        return comum

    def anulavel(self, e):
        if self.op == '<=>':
            return False
        return self.op == '/' or self.a.anulavel(e) or self.b.anulavel(e)

    def compilar(self, e):
        op, ansi = self.op, e.ansi
        if op in ('and', 'or'):
            fa, fb = self.a.compilar(e), self.b.compilar(e)
            if op == 'and':
                def e_logico(linha):
                    x = fa(linha)
                    if x is False:
                        return False
                    y = fb(linha)
                    if y is False:
                        return False
                    return None if x is None or y is None else True
                return e_logico

            def ou(linha):
                x = fa(linha)
                if x is True:
                    return True
                y = fb(linha)
                if y is True:
                    return True
                return None if x is None or y is None else False
            return ou
        comum = self._tipo_comum(e) if op not in ('/', '**') else T.DoubleType()
        fa = como(self.a.compilar(e), self.a.tipo(e), comum, ansi)
        fb = como(self.b.compilar(e), self.b.tipo(e), comum, ansi)
        if op == '<=>':
            return lambda linha: fa(linha) == fb(linha)
        conta = {
            '+': lambda x, y: x + y, '-': lambda x, y: x - y, '*': lambda x, y: x * y,
            '==': lambda x, y: x == y, '<': lambda x, y: x < y, '<=': lambda x, y: x <= y,
            '>': lambda x, y: x > y, '>=': lambda x, y: x >= y, '**': lambda x, y: float(x) ** float(y),
        }.get(op)
        if op in ('/', '%'):
            def dividir(linha):
                x, y = fa(linha), fb(linha)
                if x is None or y is None:
                    return None
                if y == 0:
                    if ansi:
                        raise divisao_por_zero()
                    return None
                return x / y if op == '/' else _resto_java(x, y)
            return dividir

        def calcular(linha):
            x, y = fa(linha), fb(linha)
            if x is None or y is None:
                return None
            return conta(x, y)
        return calcular


class Nao(Expr):
    def __init__(self, filho):
        self.filho = filho

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return Nao(filhos[0])

    def _formatar(self, partes):
        return f'(NOT {partes[0]})'

    def tipo(self, e):
        self.filho.tipo(e)
        return T.BooleanType()

    def compilar(self, e):
        f = self.filho.compilar(e)

        def nao(linha):
            v = f(linha)
            return None if v is None else not v
        return nao


class Negativo(Expr):
    def __init__(self, filho):
        self.filho = filho

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return Negativo(filhos[0])

    def _formatar(self, partes):
        return f'(- {partes[0]})'

    def tipo(self, e):
        return self.filho.tipo(e)

    def compilar(self, e):
        f = self.filho.compilar(e)

        def negativo(linha):
            v = f(linha)
            return None if v is None else -v
        return negativo


class EhNulo(Expr):
    def __init__(self, filho, negado=False):
        self.filho, self.negado = filho, negado

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return EhNulo(filhos[0], self.negado)

    def _formatar(self, partes):
        return f"({partes[0]} IS {'NOT ' if self.negado else ''}NULL)"

    def tipo(self, e):
        self.filho.tipo(e)
        return T.BooleanType()

    def anulavel(self, e):
        return False

    def compilar(self, e):
        f, negado = self.filho.compilar(e), self.negado
        return lambda linha: (f(linha) is not None) if negado else (f(linha) is None)


class Em(Expr):
    def __init__(self, filho, valores):
        self.filho, self.valores = filho, list(valores)

    def filhos(self):
        return (self.filho, *self.valores)

    def com_filhos(self, filhos):
        return Em(filhos[0], filhos[1:])

    def _formatar(self, partes):
        return f"({partes[0]} IN ({', '.join(partes[1:])}))"

    def tipo(self, e):
        for f in self.filhos():
            f.tipo(e)
        return T.BooleanType()

    def compilar(self, e):
        comum = self.filho.tipo(e)
        for v in self.valores:
            comum = T.tipo_mais_largo(comum, v.tipo(e))
        f = como(self.filho.compilar(e), self.filho.tipo(e), comum, e.ansi)
        fs = [como(v.compilar(e), v.tipo(e), comum, e.ansi) for v in self.valores]

        def em(linha):
            x = f(linha)
            if x is None:
                return None
            vistos = [g(linha) for g in fs]
            if x in [v for v in vistos if v is not None]:
                return True
            return None if None in vistos else False
        return em


def _padrao_like(padrao, escape='\\'):
    regex, i = '', 0
    while i < len(padrao):
        c = padrao[i]
        if c == escape and i + 1 < len(padrao):
            regex += re.escape(padrao[i + 1])
            i += 2
            continue
        regex += '.*' if c == '%' else '.' if c == '_' else re.escape(c)
        i += 1
    return re.compile(regex, re.DOTALL)


class Like(Expr):
    def __init__(self, filho, padrao, regex=False, ilike=False):
        self.filho, self.padrao, self.regex, self.ilike = filho, padrao, regex, ilike

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return Like(filhos[0], self.padrao, self.regex, self.ilike)

    def _formatar(self, partes):
        if self.regex:
            return f'RLIKE({partes[0]}, {self.padrao})'
        return f"ilike({partes[0]}, {self.padrao})" if self.ilike else f'{partes[0]} LIKE {self.padrao}'

    def tipo(self, e):
        self.filho.tipo(e)
        return T.BooleanType()

    def compilar(self, e):
        f = como(self.filho.compilar(e), self.filho.tipo(e), T.StringType(), e.ansi)
        if self.regex:
            r = re.compile(self.padrao)

            def rlike(linha):
                v = f(linha)
                return None if v is None else r.search(v) is not None
            return rlike
        r = _padrao_like(self.padrao.lower() if self.ilike else self.padrao)
        ilike = self.ilike

        def like(linha):
            v = f(linha)
            if v is None:
                return None
            return r.fullmatch(v.lower() if ilike else v) is not None
        return like


class Caso(Expr):
    """CASE WHEN ... THEN ... [ELSE ...] END (F.when(...).otherwise(...))."""

    def __init__(self, ramos, senao=None):
        self.ramos, self.senao = list(ramos), senao

    def filhos(self):
        return tuple(x for c, v in self.ramos for x in (c, v)) + ((self.senao,) if self.senao is not None else ())

    def com_filhos(self, filhos):
        n = len(self.ramos) * 2
        ramos = [(filhos[i], filhos[i + 1]) for i in range(0, n, 2)]
        return Caso(ramos, filhos[n] if len(filhos) > n else None)

    def _formatar(self, partes):
        n = len(self.ramos) * 2
        texto = 'CASE' + ''.join(f' WHEN {partes[i]} THEN {partes[i + 1]}' for i in range(0, n, 2))
        if self.senao is not None:
            texto += f' ELSE {partes[n]}'
        return texto + ' END'

    def tipo(self, e):
        tipo = T.NullType()
        for _, v in self.ramos:
            tipo = T.tipo_mais_largo(tipo, v.tipo(e))
        if self.senao is not None:
            tipo = T.tipo_mais_largo(tipo, self.senao.tipo(e))
        return tipo

    def anulavel(self, e):
        return self.senao is None or any(v.anulavel(e) for _, v in self.ramos) or self.senao.anulavel(e)

    def compilar(self, e):
        tipo, ansi = self.tipo(e), e.ansi
        ramos = [(c.compilar(e), como(v.compilar(e), v.tipo(e), tipo, ansi)) for c, v in self.ramos]
        senao = como(self.senao.compilar(e), self.senao.tipo(e), tipo, ansi) if self.senao is not None else (lambda linha: None)

        def caso(linha):
            for c, v in ramos:
                if c(linha) is True:
                    return v(linha)
            return senao(linha)
        return caso


class Func(Expr):
    """Função comum: nome(arg1, arg2). `impl(*valores)` recebe os valores já calculados.

    `tipo_de(tipos)` dá o tipo do resultado; com `propaga_nulo`, qualquer argumento NULL dá NULL.
    `entradas` (opcional) diz para que tipo converter cada argumento antes de chamar `impl`."""

    def __init__(self, nome, args, impl, tipo_de, propaga_nulo=True, anulavel=None, entradas=None, usa_ansi=False, formato=None):
        self.nome_func, self.args, self.impl, self.tipo_de = nome, list(args), impl, tipo_de
        self.propaga_nulo, self._anulavel, self.entradas, self.usa_ansi, self.formato = propaga_nulo, anulavel, entradas, usa_ansi, formato

    def filhos(self):
        return tuple(self.args)

    def com_filhos(self, filhos):
        return Func(self.nome_func, filhos, self.impl, self.tipo_de, self.propaga_nulo, self._anulavel, self.entradas, self.usa_ansi, self.formato)

    def _formatar(self, partes):
        if self.formato:
            return self.formato(partes)
        return f"{self.nome_func}({', '.join(partes)})"

    def tipo(self, e):
        return self.tipo_de([a.tipo(e) for a in self.args])

    def anulavel(self, e):
        if self._anulavel is not None:
            return self._anulavel
        return super().anulavel(e)

    def compilar(self, e):
        fs = [a.compilar(e) for a in self.args]
        if self.entradas:
            fs = [como(f, a.tipo(e), self.entradas[min(i, len(self.entradas) - 1)], e.ansi) if self.entradas[min(i, len(self.entradas) - 1)] else f
                  for i, (f, a) in enumerate(zip(fs, self.args))]
        impl, propaga = self.impl, self.propaga_nulo
        if self.usa_ansi:
            ansi = e.ansi
            impl0 = impl
            impl = (lambda *v: impl0(ansi, *v))

        def chamar(linha):
            valores = [f(linha) for f in fs]
            if propaga and any(v is None for v in valores):
                return None
            return impl(*valores)
        return chamar


class Ordem(Expr):
    """Ordenação: x ASC NULLS FIRST (o padrão do Spark para asc) ou x DESC NULLS LAST."""

    def __init__(self, filho, crescente=True, nulos_primeiro=None):
        self.filho, self.crescente = filho, crescente
        self.nulos_primeiro = crescente if nulos_primeiro is None else nulos_primeiro

    def filhos(self):
        return (self.filho,)

    def com_filhos(self, filhos):
        return Ordem(filhos[0], self.crescente, self.nulos_primeiro)

    def _formatar(self, partes):
        return f"{partes[0]} {'ASC' if self.crescente else 'DESC'} NULLS {'FIRST' if self.nulos_primeiro else 'LAST'}"

    def tipo(self, e):
        return self.filho.tipo(e)

    def compilar(self, e):
        return self.filho.compilar(e)


def como_ordem(expr):
    expr = sem_alias(expr) if not isinstance(expr, Ordem) else expr
    return expr if isinstance(expr, Ordem) else Ordem(expr)


def comparar_valores(x, y):
    if x == y:
        return 0
    try:
        return -1 if x < y else 1
    except TypeError:
        return -1 if str(x) < str(y) else 1


class ChaveDeOrdem:
    """Chave de ordenação com ASC/DESC e NULLS FIRST/LAST por coluna (vale em sorted e bisect)."""
    __slots__ = ('valores', 'regras')

    def __init__(self, valores, regras):
        self.valores, self.regras = valores, regras

    def _cmp(self, outra):
        for x, y, (crescente, nulos_primeiro) in zip(self.valores, outra.valores, self.regras):
            if x is None and y is None:
                continue
            if x is None:
                return -1 if nulos_primeiro else 1
            if y is None:
                return 1 if nulos_primeiro else -1
            c = comparar_valores(x, y)
            if c:
                return c if crescente else -c
        return 0

    def __lt__(self, outra):
        return self._cmp(outra) < 0

    def __le__(self, outra):
        return self._cmp(outra) <= 0

    def __gt__(self, outra):
        return self._cmp(outra) > 0

    def __ge__(self, outra):
        return self._cmp(outra) >= 0

    def __eq__(self, outra):
        return self._cmp(outra) == 0


class FazerChave:
    """linha → ChaveDeOrdem (vai para os workers)."""

    def __init__(self, funcoes, regras):
        self.funcoes, self.regras = funcoes, regras

    def __call__(self, linha):
        return ChaveDeOrdem([f(linha) for f in self.funcoes], self.regras)


def compilar_ordem(ordens, e):
    return FazerChave([o.compilar(e) for o in ordens], [(o.crescente, o.nulos_primeiro) for o in ordens])


# ---------- Column (a API) ----------

def para_expr(x):
    """Argumento de função: texto é nome de coluna; Column é a expressão; o resto é literal."""
    if isinstance(x, Column):
        return x._expr
    if isinstance(x, str):
        return Estrela() if x == '*' else Col(x)
    return Lit(x)


def literal_ou_coluna(x):
    """Operando: Column é a expressão; o resto (inclusive texto) é literal."""
    if isinstance(x, Column):
        return x._expr
    return Lit(x)


class Column:
    def __init__(self, expr):
        self._expr = expr

    def __repr__(self):
        return f"Column<'{self._expr.nome()}'>"

    def __bool__(self):
        raise PySparkValueError(
            "Cannot convert column into bool: please use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions.",
            'CANNOT_CONVERT_COLUMN_INTO_BOOL')

    __hash__ = None

    def __iter__(self):
        raise PySparkTypeError('Column is not iterable.', 'NOT_ITERABLE', {'objectName': 'Column'})

    def _bin(self, op, outro, reverso=False):
        a, b = self._expr, literal_ou_coluna(outro)
        return Column(Binario(op, b, a) if reverso else Binario(op, a, b))

    def __add__(self, o): return self._bin('+', o)
    def __radd__(self, o): return self._bin('+', o, True)
    def __sub__(self, o): return self._bin('-', o)
    def __rsub__(self, o): return self._bin('-', o, True)
    def __mul__(self, o): return self._bin('*', o)
    def __rmul__(self, o): return self._bin('*', o, True)
    def __truediv__(self, o): return self._bin('/', o)
    def __rtruediv__(self, o): return self._bin('/', o, True)
    def __mod__(self, o): return self._bin('%', o)
    def __rmod__(self, o): return self._bin('%', o, True)
    def __pow__(self, o): return self._bin('**', o)
    def __rpow__(self, o): return self._bin('**', o, True)
    def __eq__(self, o): return self._bin('==', o)  # noqa: E704
    def __ne__(self, o): return Column(Nao(Binario('==', self._expr, literal_ou_coluna(o))))
    def __lt__(self, o): return self._bin('<', o)
    def __le__(self, o): return self._bin('<=', o)
    def __gt__(self, o): return self._bin('>', o)
    def __ge__(self, o): return self._bin('>=', o)
    def __and__(self, o): return self._bin('and', o)
    def __rand__(self, o): return self._bin('and', o, True)
    def __or__(self, o): return self._bin('or', o)
    def __ror__(self, o): return self._bin('or', o, True)
    def __invert__(self): return Column(Nao(self._expr))
    def __neg__(self): return Column(Negativo(self._expr))

    def eqNullSafe(self, outro):
        return self._bin('<=>', outro)

    def alias(self, *nomes, **_):
        return Column(Alias(self._expr, nomes[0]))

    name = alias

    def cast(self, tipo):
        return Column(Cast(self._expr, tipo, do_usuario=True))

    astype = cast

    def try_cast(self, tipo):
        return Column(_TryCast(self._expr, tipo))

    def isNull(self):
        return Column(EhNulo(self._expr))

    def isNotNull(self):
        return Column(EhNulo(self._expr, negado=True))

    def isNaN(self):
        from .functions import isnan
        return isnan(self)

    def isin(self, *valores):
        if len(valores) == 1 and isinstance(valores[0], (list, tuple, set)):
            valores = list(valores[0])
        return Column(Em(self._expr, [literal_ou_coluna(v) for v in valores]))

    def between(self, minimo, maximo):
        return (self >= minimo) & (self <= maximo)

    def like(self, padrao):
        return Column(Like(self._expr, padrao))

    def ilike(self, padrao):
        return Column(Like(self._expr, padrao, ilike=True))

    def rlike(self, padrao):
        return Column(Like(self._expr, padrao, regex=True))

    def startswith(self, outro):
        from .functions import _texto_bool
        return _texto_bool('startswith', self, outro, lambda s, p: s.startswith(p))

    def endswith(self, outro):
        from .functions import _texto_bool
        return _texto_bool('endswith', self, outro, lambda s, p: s.endswith(p))

    def contains(self, outro):
        from .functions import _texto_bool
        return _texto_bool('contains', self, outro, lambda s, p: p in s)

    def substr(self, inicio, tamanho):
        from .functions import substring
        return substring(self, inicio, tamanho)

    def getItem(self, chave):
        from .functions import _item
        return _item(self, chave)

    def __getitem__(self, chave):
        if isinstance(chave, slice):
            return self.substr(chave.start, chave.stop)
        return self.getItem(chave)

    def getField(self, nome):
        from .functions import _campo
        return _campo(self, nome)

    def asc(self):
        return Column(Ordem(self._expr, True, True))

    def asc_nulls_first(self):
        return Column(Ordem(self._expr, True, True))

    def asc_nulls_last(self):
        return Column(Ordem(self._expr, True, False))

    def desc(self):
        return Column(Ordem(self._expr, False, False))

    def desc_nulls_first(self):
        return Column(Ordem(self._expr, False, True))

    def desc_nulls_last(self):
        return Column(Ordem(self._expr, False, False))

    def when(self, condicao, valor):
        expr = self._expr
        if not isinstance(expr, Caso) or expr.senao is not None:
            raise PySparkTypeError('when() can only be applied on a Column previously generated by when() function, and cannot be applied once otherwise() is applied.',
                                   'INVALID_WHEN_USAGE')
        return Column(Caso(expr.ramos + [(para_expr(condicao), literal_ou_coluna(valor))]))

    def otherwise(self, valor):
        expr = self._expr
        if not isinstance(expr, Caso) or expr.senao is not None:
            raise PySparkTypeError('otherwise() can only be applied on a Column previously generated by when() function, and cannot be applied once otherwise() is applied.',
                                   'INVALID_OTHERWISE_USAGE')
        return Column(Caso(expr.ramos, literal_ou_coluna(valor)))

    def over(self, janela):
        from .window import Sobre
        return Column(Sobre(self._expr, janela))

    def dropFields(self, *nomes):
        raise NotImplementedError('dropFields não existe no DivergePython')


class _TryCast(Cast):
    def _formatar(self, partes):
        return f'TRY_CAST({partes[0]} AS {_nome_sql(self.para)})'

    def compilar(self, e):
        f, de, para = self.filho.compilar(e), self.filho.tipo(e), self.para

        def cast(linha):
            v = f(linha)
            if v is None:
                return None
            try:
                return converter(v, de, para, True)
            except Exception:
                return None
        return cast


def arredondar(valor, casas, modo=decimal.ROUND_HALF_UP):
    """round do Spark: HALF_UP (o round do Python arredonda para o par)."""
    if isinstance(valor, int) and not isinstance(valor, bool):
        if casas >= 0:
            return valor
        q = 10 ** (-casas)
        return int((decimal.Decimal(valor) / q).quantize(decimal.Decimal(1), rounding=modo) * q)
    if math.isnan(valor) or math.isinf(valor):
        return valor
    d = decimal.Decimal(repr(valor))
    return float(d.quantize(decimal.Decimal(1).scaleb(-casas), rounding=modo))
