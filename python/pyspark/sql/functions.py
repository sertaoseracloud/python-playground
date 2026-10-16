"""pyspark.sql.functions do DivergePython: as funções de coluna, com os nomes do Spark."""
import builtins
import datetime
import math
import re

from . import types as T
from .column import (
    Alias, Caso, Cast, Col, Column, EhNulo, Func, Lit, arredondar, como_ordem, converter, literal_ou_coluna, para_expr,
    texto_para_data, texto_para_data_hora,
)
from .column import Ordem  # noqa: F401  (usada por quem importa daqui)
from ..errors import data_invalida


def _c(x):
    return Column(para_expr(x))


def col(nome):
    return Column(para_expr(nome))


column = col


def lit(valor):
    if isinstance(valor, Column):
        return valor
    return Column(Lit(valor))


def _f(nome, args, impl, tipo, **kw):
    """Uma Column de função comum (veja column.Func)."""
    return Column(Func(nome, [a if not isinstance(a, Column) else a._expr for a in args], impl, tipo, **kw))


def _mesmo(i=0):
    return lambda tipos: tipos[i]


def _fixo(tipo):
    return lambda tipos: tipo


_TEXTO = T.StringType()

# ---------- condicionais e nulos ----------


def when(condicao, valor):
    return Column(Caso([(para_expr(condicao), literal_ou_coluna(valor))]))


def coalesce(*cols):
    exprs = [para_expr(c) for c in cols]

    def tipo(tipos):
        t = T.NullType()
        for x in tipos:
            t = T.tipo_mais_largo(t, x)
        return t

    def primeiro(*valores):
        return next((v for v in valores if v is not None), None)
    expr = Func('coalesce', exprs, primeiro, tipo, propaga_nulo=False)
    return Column(_CoalesceConvertido(expr))


class _CoalesceConvertido(Func):
    """coalesce com os argumentos convertidos para o tipo comum."""

    def __init__(self, base):
        super().__init__(base.nome_func, base.args, base.impl, base.tipo_de, False)

    def com_filhos(self, filhos):
        return _CoalesceConvertido(Func(self.nome_func, filhos, self.impl, self.tipo_de, False))

    def anulavel(self, e):
        return all(a.anulavel(e) for a in self.args)

    def compilar(self, e):
        from .column import como
        tipo = self.tipo(e)
        fs = [como(a.compilar(e), a.tipo(e), tipo, e.ansi) for a in self.args]

        def coalescer(linha):
            for f in fs:
                v = f(linha)
                if v is not None:
                    return v
            return None
        return coalescer


def isnull(c):
    return Column(EhNulo(para_expr(c)))


def isnotnull(c):
    return Column(EhNulo(para_expr(c), negado=True))


def isnan(c):
    return _f('isnan', [_c(c)], lambda v: isinstance(v, float) and math.isnan(v), _fixo(T.BooleanType()), propaga_nulo=False, anulavel=False)


def nanvl(a, b):
    return _f('nanvl', [_c(a), _c(b)], lambda x, y: y if isinstance(x, float) and math.isnan(x) else x, _mesmo(0), propaga_nulo=False)


def ifnull(a, b):
    return coalesce(a, b)


nvl = ifnull

# ---------- texto ----------


def _texto(nome, impl):
    def funcao(c):
        return _f(nome, [_c(c)], impl, _fixo(_TEXTO), entradas=[_TEXTO])
    funcao.__name__ = nome
    return funcao


upper = _texto('upper', str.upper)
lower = _texto('lower', str.lower)
trim = _texto('trim', lambda s: s.strip(' '))
ltrim = _texto('ltrim', lambda s: s.lstrip(' '))
rtrim = _texto('rtrim', lambda s: s.rstrip(' '))
reverse = _texto('reverse', lambda s: s[::-1])
initcap = _texto('initcap', lambda s: ' '.join(p[:1].upper() + p[1:].lower() for p in s.split(' ')))


def length(c):
    return _f('length', [_c(c)], len, _fixo(T.IntegerType()), entradas=[_TEXTO])


char_length = length


def _substring(s, pos, tamanho):
    if pos > 0:
        inicio = pos - 1
    elif pos < 0:
        inicio = len(s) + pos if len(s) + pos > 0 else 0  # (max aqui é a agregação do Spark)
    else:
        inicio = 0
    return s[inicio:inicio + tamanho] if tamanho > 0 else ''


def substring(c, pos, tamanho):
    return _f('substring', [_c(c), Column(Lit(pos)), Column(Lit(tamanho))], _substring, _fixo(_TEXTO), entradas=[_TEXTO, None, None])


def concat(*cols):
    def juntar(*valores):
        if valores and all(isinstance(v, list) for v in valores):
            return [x for v in valores for x in v]
        return ''.join(valores)

    def tipo(tipos):
        return tipos[0] if tipos and all(isinstance(t, T.ArrayType) for t in tipos) else _TEXTO
    exprs = [_c(c) for c in cols]
    return _f('concat', exprs, juntar, tipo)


def concat_ws(sep, *cols):
    from .mostrar import texto_do_valor

    def juntar(separador, *valores):
        partes = []
        for v in valores:
            if v is None:
                continue
            if isinstance(v, list):
                partes.extend(texto_do_valor(x) for x in v if x is not None)
            else:
                partes.append(v if isinstance(v, str) else texto_do_valor(v))
        return separador.join(partes)
    return _f('concat_ws', [Column(Lit(sep))] + [_c(c) for c in cols], juntar, _fixo(_TEXTO), propaga_nulo=False)


def _regex_java(padrao):
    return padrao


def split(c, padrao, limit=-1):
    def dividir(s, p, n):
        partes = re.split(_regex_java(p), s) if n <= 0 else re.split(_regex_java(p), s, maxsplit=n - 1)
        return partes
    return _f('split', [_c(c), Column(Lit(padrao)), Column(Lit(limit))], dividir, _fixo(T.ArrayType(_TEXTO, False)), entradas=[_TEXTO, None, None])


def regexp_replace(c, padrao, troca):
    def trocar(s, p, r):
        return re.sub(_regex_java(p), re.sub(r'\$(\d+)', r'\\\1', r), s)
    return _f('regexp_replace', [_c(c), Column(Lit(padrao)), Column(Lit(troca)), Column(Lit(1))],
              lambda s, p, r, _pos: trocar(s, p, r), _fixo(_TEXTO), entradas=[_TEXTO, None, None, None])


def regexp_extract(c, padrao, idx):
    def extrair(s, p, i):
        m = re.search(_regex_java(p), s)
        return (m.group(i) or '') if m else ''
    return _f('regexp_extract', [_c(c), Column(Lit(padrao)), Column(Lit(idx))], extrair, _fixo(_TEXTO), entradas=[_TEXTO, None, None])


def _pad(nome, esquerda):
    def funcao(c, tamanho, pad=' '):
        def preencher(s, n, p):
            if len(s) >= n:
                return s[:n]
            falta = n - len(s)
            enchimento = (p * falta)[:falta] if p else ''
            return enchimento + s if esquerda else s + enchimento
        return _f(nome, [_c(c), Column(Lit(tamanho)), Column(Lit(pad))], preencher, _fixo(_TEXTO), entradas=[_TEXTO, None, None])
    funcao.__name__ = nome
    return funcao


lpad = _pad('lpad', True)
rpad = _pad('rpad', False)


def _texto_bool(nome, c, outro, impl):
    return _f(nome, [_c(c), Column(literal_ou_coluna(outro))], impl, _fixo(T.BooleanType()), entradas=[_TEXTO, _TEXTO])


def instr(c, sub):
    return _f('instr', [_c(c), Column(Lit(sub))], lambda s, p: s.find(p) + 1, _fixo(T.IntegerType()), entradas=[_TEXTO, None])


def repeat(c, n):
    return _f('repeat', [_c(c), Column(Lit(n))], lambda s, k: s * k, _fixo(_TEXTO), entradas=[_TEXTO, None])

# ---------- números ----------


def _numero(tipos):
    return tipos[0] if isinstance(tipos[0], T.NUMERICOS) else T.DoubleType()


def round(c, scale=0):  # noqa: A001
    return _f('round', [_c(c), Column(Lit(scale))], lambda v, s: arredondar(v, s), _numero)


def bround(c, scale=0):
    import decimal
    return _f('bround', [_c(c), Column(Lit(scale))], lambda v, s: arredondar(v, s, decimal.ROUND_HALF_EVEN), _numero)


def abs(c):  # noqa: A001
    import builtins
    return _f('abs', [_c(c)], builtins.abs, _numero)


def _matematica(nome, impl, tipo=T.DoubleType()):
    def funcao(c):
        return _f(nome, [_c(c)], impl, _fixo(tipo), entradas=[T.DoubleType()])
    funcao.__name__ = nome.lower()
    return funcao


def _raiz(v):
    return math.sqrt(v) if v >= 0 else float('nan')


sqrt = _matematica('SQRT', _raiz)
exp = _matematica('EXP', math.exp)
log10 = _matematica('LOG10', lambda v: math.log10(v) if v > 0 else None)
floor = _matematica('FLOOR', lambda v: math.floor(v), T.LongType())
ceil = _matematica('CEIL', lambda v: math.ceil(v), T.LongType())
ceiling = ceil


def log(arg1, arg2=None):
    if arg2 is None:
        return _f('ln', [_c(arg1)], lambda v: math.log(v) if v > 0 else None, _fixo(T.DoubleType()), entradas=[T.DoubleType()])
    return _f('LOG', [Column(Lit(float(arg1))), _c(arg2)], lambda b, v: math.log(v, b) if v > 0 else None, _fixo(T.DoubleType()), entradas=[T.DoubleType()])


def pow(a, b):  # noqa: A001
    return _f('POWER', [_c(a), Column(literal_ou_coluna(b)) if not isinstance(b, str) else _c(b)], lambda x, y: float(x) ** float(y),
              _fixo(T.DoubleType()), entradas=[T.DoubleType()])


power = pow


def _extremo(nome, escolher):
    def funcao(*cols):
        def tipo(tipos):
            t = T.NullType()
            for x in tipos:
                t = T.tipo_mais_largo(t, x)
            return t

        def calcular(*valores):
            validos = [v for v in valores if v is not None]
            return escolher(validos) if validos else None
        return _f(nome, [_c(c) for c in cols], calcular, tipo, propaga_nulo=False)
    funcao.__name__ = nome
    return funcao


greatest = _extremo('greatest', max)
least = _extremo('least', min)


def signum(c):
    return _f('SIGNUM', [_c(c)], lambda v: float((v > 0) - (v < 0)), _fixo(T.DoubleType()), entradas=[T.DoubleType()])

# ---------- datas ----------


_JAVA_PARA_PY = [('yyyy', '%Y'), ('yy', '%y'), ('MMMM', '%B'), ('MMM', '%b'), ('MM', '%m'), ('dd', '%d'), ('HH', '%H'),
                 ('mm', '%M'), ('ss', '%S'), ('EEEE', '%A'), ('EEE', '%a'), ('M', '%m'), ('d', '%d')]


def formato_python(formato):
    saida, i = '', 0
    while i < len(formato):
        if formato[i] == "'":
            fim = formato.find("'", i + 1)
            fim = len(formato) if fim < 0 else fim
            saida += formato[i + 1:fim].replace('%', '%%')
            i = fim + 1
            continue
        for java, py in _JAVA_PARA_PY:
            if formato.startswith(java, i):
                saida += py
                i += len(java)
                break
        else:
            saida += formato[i].replace('%', '%%')
            i += 1
    return saida


def _para_data(ansi, valor, formato=None):
    if isinstance(valor, datetime.datetime):
        return valor.date()
    if isinstance(valor, datetime.date):
        return valor
    texto = str(valor)
    if formato is None:
        data = texto_para_data(texto)
    else:
        try:
            data = datetime.datetime.strptime(texto.strip(), formato_python(formato)).date()
        except ValueError:
            data = None
    if data is None and ansi:
        raise data_invalida(texto)
    return data


def to_date(c, format=None):  # noqa: A002
    args = [_c(c)] + ([Column(Lit(format))] if format else [])
    return _f('to_date', args, lambda ansi, v, *f: _para_data(ansi, v, *f), _fixo(T.DateType()), usa_ansi=True)


def _para_data_hora(ansi, valor, formato=None):
    if isinstance(valor, datetime.datetime):
        return valor
    if isinstance(valor, datetime.date):
        return datetime.datetime(valor.year, valor.month, valor.day)
    texto = str(valor)
    if formato is None:
        data = texto_para_data_hora(texto)
    else:
        try:
            data = datetime.datetime.strptime(texto.strip(), formato_python(formato))
        except ValueError:
            data = None
    if data is None and ansi:
        raise data_invalida(texto)
    return data


def to_timestamp(c, format=None):  # noqa: A002
    args = [_c(c)] + ([Column(Lit(format))] if format else [])
    return _f('to_timestamp', args, lambda ansi, v, *f: _para_data_hora(ansi, v, *f), _fixo(T.TimestampType()), usa_ansi=True)


def _parte_da_data(nome, impl):
    def funcao(c):
        return _f(nome, [_c(c)], lambda ansi, v: impl(_para_data_hora(ansi, v) if isinstance(v, str) else v), _fixo(T.IntegerType()), usa_ansi=True)
    funcao.__name__ = nome
    return funcao


year = _parte_da_data('year', lambda d: d.year)
month = _parte_da_data('month', lambda d: d.month)
dayofmonth = _parte_da_data('dayofmonth', lambda d: d.day)
day = dayofmonth
dayofweek = _parte_da_data('dayofweek', lambda d: d.isoweekday() % 7 + 1)
dayofyear = _parte_da_data('dayofyear', lambda d: d.timetuple().tm_yday)
quarter = _parte_da_data('quarter', lambda d: (d.month - 1) // 3 + 1)
hour = _parte_da_data('hour', lambda d: getattr(d, 'hour', 0))
minute = _parte_da_data('minute', lambda d: getattr(d, 'minute', 0))
second = _parte_da_data('second', lambda d: getattr(d, 'second', 0))
weekofyear = _parte_da_data('weekofyear', lambda d: d.isocalendar()[1])


def date_format(c, formato):
    def formatar(ansi, v, f):
        d = _para_data_hora(ansi, v) if isinstance(v, str) else v
        return None if d is None else d.strftime(formato_python(f))
    return _f('date_format', [_c(c), Column(Lit(formato))], formatar, _fixo(_TEXTO), usa_ansi=True)


def datediff(fim, inicio):
    def dias(ansi, a, b):
        a, b = _para_data(ansi, a), _para_data(ansi, b)
        return None if a is None or b is None else (a - b).days
    return _f('datediff', [_c(fim), _c(inicio)], dias, _fixo(T.IntegerType()), usa_ansi=True)


def date_add(c, dias):
    def somar(ansi, d, n):
        d = _para_data(ansi, d)
        return None if d is None else d + datetime.timedelta(days=n)
    return _f('date_add', [_c(c), Column(literal_ou_coluna(dias))], somar, _fixo(T.DateType()), usa_ansi=True)


def date_sub(c, dias):
    def subtrair(ansi, d, n):
        d = _para_data(ansi, d)
        return None if d is None else d - datetime.timedelta(days=n)
    return _f('date_sub', [_c(c), Column(literal_ou_coluna(dias))], subtrair, _fixo(T.DateType()), usa_ansi=True)


def months_between(fim, inicio):
    def meses(ansi, a, b):
        a, b = _para_data(ansi, a), _para_data(ansi, b)
        if a is None or b is None:
            return None
        return arredondar((a.year - b.year) * 12 + (a.month - b.month) + (a.day - b.day) / 31, 8)
    return _f('months_between', [_c(fim), _c(inicio), Column(Lit(True))], lambda ansi, a, b, _r: meses(ansi, a, b), _fixo(T.DoubleType()), usa_ansi=True)


class _Agora(Func):
    """current_timestamp(), now() e current_date(): um valor só por consulta, lido ao montar o plano
    (no processo principal). No streaming e no Delta, vem do relógio virtual."""

    def com_filhos(self, filhos):
        return self

    def compilar(self, e):
        from diverge_runtime import relogio
        momento = relogio.momento_do_spark()
        valor = momento.date() if self.nome_func == 'current_date' else momento
        return lambda linha: valor


def current_date():
    return Column(_Agora('current_date', [], None, _fixo(T.DateType()), anulavel=False))


def current_timestamp():
    return Column(_Agora('current_timestamp', [], None, _fixo(T.TimestampType()), anulavel=False))


def now():
    return Column(_Agora('now', [], None, _fixo(T.TimestampType()), anulavel=False))

# ---------- arrays ----------


def size(c):
    return _f('size', [_c(c)], len, _fixo(T.IntegerType()))


def array(*cols):
    if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
        cols = cols[0]

    def tipo(tipos):
        t = T.NullType()
        for x in tipos:
            t = T.tipo_mais_largo(t, x)
        return T.ArrayType(t, True)
    return _f('array', [_c(c) for c in cols], lambda *v: list(v), tipo, propaga_nulo=False, anulavel=False)


def array_contains(c, valor):
    def contem(arr, v):
        if v in arr:
            return True
        return None if None in arr else False
    return _f('array_contains', [_c(c), Column(literal_ou_coluna(valor))], contem, _fixo(T.BooleanType()))


def _ordenar_lista(arr, crescente):
    validos = sorted((v for v in arr if v is not None), reverse=not crescente)
    nulos = [None] * (len(arr) - len(validos))
    return nulos + validos if crescente else validos + nulos


def sort_array(c, asc=True):
    return _f('sort_array', [_c(c), Column(Lit(asc))], _ordenar_lista, _mesmo(0))


def array_distinct(c):
    return _f('array_distinct', [_c(c)], lambda arr: list(dict.fromkeys(arr)), _mesmo(0))


def array_join(c, sep):
    return _f('array_join', [_c(c), Column(Lit(sep))], lambda arr, s: s.join(str(x) for x in arr if x is not None), _fixo(_TEXTO))


def element_at(c, i):
    def pegar(arr, k):
        if isinstance(arr, dict):
            return arr.get(k)
        return arr[k - 1] if 0 < k <= len(arr) else (arr[k] if -len(arr) <= k < 0 else None)
    return _f('element_at', [_c(c), Column(Lit(i))], pegar, lambda tipos: getattr(tipos[0], 'elementType', getattr(tipos[0], 'valueType', _TEXTO)))


def _item(c, chave):
    def pegar(arr, k):
        if isinstance(arr, dict):
            return arr.get(k)
        return arr[k] if 0 <= k < len(arr) else None
    return _f('getitem', [c, Column(Lit(chave))], pegar,
              lambda tipos: getattr(tipos[0], 'elementType', getattr(tipos[0], 'valueType', _TEXTO)),
              formato=lambda p: f'{p[0]}[{p[1]}]')


def _campo(c, nome):
    def pegar(linha):
        return linha[nome] if hasattr(linha, '__fields__') else None

    def tipo(tipos):
        return tipos[0][nome].dataType if isinstance(tipos[0], T.StructType) else _TEXTO
    return _f('getfield', [c], pegar, tipo, formato=lambda p: f'{p[0]}.{nome}')


def struct(*cols):
    if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
        cols = cols[0]
    exprs = [_c(c) for c in cols]
    nomes = [e._expr.nome() for e in exprs]

    def montar(*valores):
        return T._criar_row(nomes, valores)
    return _f('struct', exprs, montar, lambda tipos: T.StructType([T.StructField(n, t) for n, t in zip(nomes, tipos)]),
              propaga_nulo=False, anulavel=False)

# ---------- janelas de tempo ----------

_UNIDADES = {'microsecond': 1, 'millisecond': 1000, 'second': 10**6, 'minute': 60 * 10**6,
             'hour': 3600 * 10**6, 'day': 86400 * 10**6, 'week': 7 * 86400 * 10**6}
_DURACAO = re.compile(r'(\d+)\s*(microsecond|millisecond|second|minute|hour|day|week)s?', re.IGNORECASE)
_EPOCA = datetime.datetime(1970, 1, 1)
JANELA = T.StructType([T.StructField('start', T.TimestampType()), T.StructField('end', T.TimestampType())])


def duracao_em_micros(texto):
    """'10 minutes', '1 hour 30 minutes' ou 'interval 5 seconds' em microssegundos, como o Spark lê."""
    limpo = str(texto).strip()
    if limpo.lower().startswith('interval '):
        limpo = limpo[9:]
    partes = _DURACAO.findall(limpo)
    if not partes or _DURACAO.sub('', limpo).strip():
        from ..errors import IllegalArgumentException
        raise IllegalArgumentException(f'The provided interval ({texto}) did not correspond to a valid interval string.')
    return builtins.sum(int(n) * _UNIDADES[u.lower()] for n, u in partes)  # o sum daqui é o do Spark


def _micros(ts):
    return (ts - _EPOCA) // datetime.timedelta(microseconds=1)


def _janela(inicio, duracao):
    return T._criar_row(['start', 'end'], (_EPOCA + datetime.timedelta(microseconds=inicio),
                                           _EPOCA + datetime.timedelta(microseconds=inicio + duracao)))


class _UmaJanela:
    def __init__(self, duracao, inicio):
        self.duracao, self.inicio = duracao, inicio

    def __call__(self, ts):
        t = _micros(ts)
        return _janela(t - (t - self.inicio) % self.duracao, self.duracao)


class _VariasJanelas:
    """As janelas deslizantes que contêm o momento (início <= ts < fim), da mais antiga à mais nova."""

    def __init__(self, duracao, deslize, inicio):
        self.duracao, self.deslize, self.inicio = duracao, deslize, inicio

    def __call__(self, ts):
        t = _micros(ts)
        s = t - (t - self.inicio) % self.deslize
        saida = []
        while s > t - self.duracao:
            saida.append(_janela(s, self.duracao))
            s -= self.deslize
        return saida[::-1]


class _Janela(Func):
    """window(coluna, duração, deslize, início): a janela fixa da linha (struct<start, end>). A
    deslizante só existe dentro do groupBy, que põe a linha em cada janela (group.py)."""

    def __init__(self, coluna, duracao, deslize, inicio):
        self.duracao, self.deslize, self.inicio = duracao, deslize, inicio
        super().__init__('window', [coluna], _UmaJanela(duracao, inicio), _fixo(JANELA), entradas=[T.TimestampType()],
                         formato=lambda p: f'window({p[0]}, {duracao}, {deslize}, {inicio})')

    def com_filhos(self, filhos):
        return _Janela(filhos[0], self.duracao, self.deslize, self.inicio)

    def compilar(self, e):
        if self.deslize != self.duracao:
            raise NotImplementedError('No DivergePython, a janela deslizante só funciona dentro do groupBy.')
        return super().compilar(e)


def window(timeColumn, windowDuration, slideDuration=None, startTime=None):
    duracao = duracao_em_micros(windowDuration)
    deslize = duracao_em_micros(slideDuration) if slideDuration else duracao
    inicio = duracao_em_micros(startTime) if startTime else 0
    if deslize > duracao:
        from ..errors import IllegalArgumentException
        raise IllegalArgumentException(f'The slide duration ({deslize}) must be less than or equal to the windowDuration ({duracao}).')
    return Column(Alias(_Janela(para_expr(timeColumn), duracao, deslize, inicio), 'window'))

# ---------- ordenação ----------


def asc(c):
    return _c(c).asc()


def desc(c):
    return _c(c).desc()


def asc_nulls_first(c):
    return _c(c).asc_nulls_first()


def asc_nulls_last(c):
    return _c(c).asc_nulls_last()


def desc_nulls_first(c):
    return _c(c).desc_nulls_first()


def desc_nulls_last(c):
    return _c(c).desc_nulls_last()


def expr(texto):
    from .sql import ler_expressao
    return Column(ler_expressao(texto))


# ---------- agregações ----------
# (definidas no fim do módulo porque os nomes sum, min, max e count escondem os do Python)

def _agg(funcao, c, **kw):
    from .agregacoes import Agg
    return Column(Agg(funcao, [para_expr(c)], **kw))


def count(c):
    from .agregacoes import Agg
    if isinstance(c, str) and c == '*':
        return Column(Agg('count', [Lit(1)]))
    return _agg('count', c)


def sum(c):  # noqa: A001
    return _agg('sum', c)


def avg(c):
    return _agg('avg', c)


mean = avg


def min(c):  # noqa: A001
    return _agg('min', c)


def max(c):  # noqa: A001
    return _agg('max', c)


def countDistinct(c, *cols):
    from .agregacoes import Agg
    return Column(Agg('count', [para_expr(x) for x in (c, *cols)], distinto=True))


count_distinct = countDistinct


def sum_distinct(c):
    return _agg('sum', c, distinto=True)


sumDistinct = sum_distinct


def approx_count_distinct(c, rsd=None):
    return _agg('approx_count_distinct', c)


approxCountDistinct = approx_count_distinct


def percentile_approx(col, percentage, accuracy=10000):
    """O percentil (ou a lista de percentis) da coluna: o menor valor da lista ordenada com pelo menos
    essa fração dos valores menores ou iguais a ele. Com poucos dados, é exato, como no Spark."""
    from ..errors import AnalysisException
    from .agregacoes import Agg
    lista = isinstance(percentage, (list, tuple))
    valores = [float(p) for p in percentage] if lista else [float(percentage)]
    fora = next((p for p in valores if not 0.0 <= p <= 1.0), None)
    if fora is not None:
        raise AnalysisException(
            f'Cannot resolve "percentile_approx({para_expr(col).nome()}, {percentage}, {accuracy})" due to data type mismatch: '
            f'The percentage must be between [0.0, 1.0], but got {percentage}.',
            'DATATYPE_MISMATCH.VALUE_OUT_OF_RANGE', {}, '42K09')
    return Column(Agg('percentile_approx', [para_expr(col), Lit(valores if lista else valores[0]), Lit(int(accuracy))]))


def collect_list(c):
    return _agg('collect_list', c)


def collect_set(c):
    return _agg('collect_set', c)


def first(c, ignorenulls=False):
    return _agg('first', c, ignorar_nulos=ignorenulls)


def last(c, ignorenulls=False):
    return _agg('last', c, ignorar_nulos=ignorenulls)


def stddev(c):
    return _agg('stddev', c)


stddev_samp = stddev


def stddev_pop(c):
    return _agg('stddev_pop', c)


def variance(c):
    return _agg('variance', c)


var_samp = variance


def var_pop(c):
    return _agg('var_pop', c)


def any_value(c):
    return _agg('first', c)

# ---------- janelas ----------


def _ranking(nome, tipo=None, args=()):
    from .window import FuncaoDeJanela
    return Column(FuncaoDeJanela(nome, [Lit(a) for a in args], tipo or T.IntegerType()))


def row_number():
    return _ranking('row_number')


def rank():
    return _ranking('rank')


def dense_rank():
    return _ranking('dense_rank')


def percent_rank():
    return _ranking('percent_rank', T.DoubleType())


def cume_dist():
    return _ranking('cume_dist', T.DoubleType())


def ntile(n):
    return _ranking('ntile', T.IntegerType(), (int(n),))


def lag(c, offset=1, default=None):
    from .window import deslocamento
    return Column(deslocamento('lag', c, offset, default))


def lead(c, offset=1, default=None):
    from .window import deslocamento
    return Column(deslocamento('lead', c, offset, default))


def broadcast(df):
    from .plano_largo import ComDica
    return df._novo(ComDica(df._plano))


def explode(c):
    from .gerador import Explode
    return Column(Explode(para_expr(c)))


def explode_outer(c):
    from .gerador import Explode
    return Column(Explode(para_expr(c), externo=True))


def posexplode(c):
    from .gerador import Explode
    return Column(Explode(para_expr(c), posicao=True))


def posexplode_outer(c):
    from .gerador import Explode
    return Column(Explode(para_expr(c), externo=True, posicao=True))


def udf(f=None, returnType=None, *, useArrow=None):
    from .udf import udf as criar
    return criar(f, returnType)


def hash(*cols):  # noqa: A001
    from .._motor import hash_estavel
    return _f('hash', [_c(c) for c in cols], lambda *v: (hash_estavel(list(v)) & 0x7FFFFFFF), _fixo(T.IntegerType()), propaga_nulo=False, anulavel=False)


__all__ = [n for n in dir() if not n.startswith('_') and n not in ('T', 'datetime', 'math', 're', 'Caso', 'Cast', 'Col', 'Column', 'EhNulo', 'Func', 'Lit',
                                                               'arredondar', 'como_ordem', 'converter', 'literal_ou_coluna', 'para_expr',
                                                               'texto_para_data', 'texto_para_data_hora', 'data_invalida', 'formato_python')]
