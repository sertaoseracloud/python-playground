"""Como o Spark 4 mostra as coisas: show(), printSchema(), valores e números."""
import datetime
import decimal
import math

from .types import ArrayType, MapType, Row, StructType


def java_double(x):
    """Double.toString do Java: 4.0, 24.9, 1.0E7, 1.0E-4 (notação científica fora de [1e-3, 1e7))."""
    if math.isnan(x):
        return 'NaN'
    if math.isinf(x):
        return 'Infinity' if x > 0 else '-Infinity'
    if x == 0:
        return '-0.0' if math.copysign(1, x) < 0 else '0.0'
    if 1e-3 <= abs(x) < 1e7:
        texto = repr(x)
        if 'e' in texto:  # o repr do Python não usa e nessa faixa, mas por garantia
            texto = format(decimal.Decimal(texto), 'f')
        return texto if '.' in texto else texto + '.0'
    sinal, digitos, expoente = decimal.Decimal(repr(x)).as_tuple()
    digitos = ''.join(map(str, digitos)).rstrip('0') or '0'
    expoente10 = expoente + len(''.join(map(str, decimal.Decimal(repr(x)).as_tuple().digits))) - 1
    mantissa = digitos[0] + '.' + (digitos[1:] or '0')
    return f"{'-' if sinal else ''}{mantissa}E{expoente10}"


def java_float(x):
    return java_double(float(f'{x:.7g}'))


def texto_do_valor(valor, aninhado=False):
    """O valor como o show() mostra (e como o CSV grava, sem o NULL)."""
    if valor is None:
        return 'NULL'
    if isinstance(valor, bool):
        return 'true' if valor else 'false'
    if isinstance(valor, float):
        return java_double(valor)
    if isinstance(valor, datetime.datetime):
        texto = valor.strftime('%Y-%m-%d %H:%M:%S')
        if valor.microsecond:
            texto += ('.%06d' % valor.microsecond).rstrip('0')
        return texto
    if isinstance(valor, datetime.date):
        return valor.isoformat()
    if isinstance(valor, Row):
        return '{' + ', '.join(texto_do_valor(v, True) for v in valor) + '}'
    if isinstance(valor, (list, tuple)):
        return '[' + ', '.join(texto_do_valor(v, True) for v in valor) + ']'
    if isinstance(valor, dict):
        return '{' + ', '.join(f'{texto_do_valor(k, True)} -> {texto_do_valor(v, True)}' for k, v in valor.items()) + '}'
    if isinstance(valor, (bytes, bytearray)):
        return '[' + ' '.join(f'{b:02X}' for b in valor) + ']'
    return str(valor)


def _cortar(texto, truncate):
    if truncate > 0 and len(texto) > truncate:
        return texto[:truncate] if truncate < 4 else texto[:truncate - 3] + '...'
    return texto


def tabela(nomes, linhas, n, truncate, tem_mais):
    """O texto do show(), com a linha em branco do fim."""
    truncate = 20 if truncate is True else (0 if truncate is False else int(truncate))
    celulas = [[_cortar(str(c), truncate) for c in nomes]] + [[_cortar(texto_do_valor(v), truncate) for v in linha] for linha in linhas]
    larguras = [max(3, *(len(linha[i]) for linha in celulas)) for i in range(len(nomes))]
    borda = '+' + '+'.join('-' * w for w in larguras) + '+'

    def formatar(linha):
        if truncate > 0:
            return '|' + '|'.join(c.rjust(w) for c, w in zip(linha, larguras)) + '|'
        return '|' + '|'.join(c.ljust(w) for c, w in zip(linha, larguras)) + '|'
    saida = [borda, formatar(celulas[0]), borda, *(formatar(linha) for linha in celulas[1:]), borda]
    texto = '\n'.join(saida) + '\n'
    if tem_mais:
        texto += f"only showing top {n} {'row' if n == 1 else 'rows'}\n"
    return texto


def vertical(nomes, linhas, n, truncate, tem_mais):
    truncate = 20 if truncate is True else (0 if truncate is False else int(truncate))
    largura_nome = max([len(c) for c in nomes] or [0])
    valores = [[_cortar(texto_do_valor(v), truncate) for v in linha] for linha in linhas]
    largura_valor = max([len(v) for linha in valores for v in linha] or [0])
    saida = []
    for i, linha in enumerate(valores):
        cabecalho = f'-RECORD {i}'
        saida.append(cabecalho + '-' * max(0, largura_nome + largura_valor + 3 - len(cabecalho)))
        saida.extend(f' {c.ljust(largura_nome)} | {v.ljust(largura_valor)} ' for c, v in zip(nomes, linha))
    if not linhas:
        saida.append('(0 rows)')
    texto = '\n'.join(saida) + '\n'
    if tem_mais:
        texto += f"only showing top {n} {'row' if n == 1 else 'rows'}\n"
    return texto


def _campos(tipo, prefixo, linhas):
    if isinstance(tipo, StructType):
        for f in tipo.fields:
            linhas.append(f'{prefixo}-- {f.name}: {f.dataType.typeName()} (nullable = {str(f.nullable).lower()})')
            _campos(f.dataType, prefixo + '    |', linhas)
    elif isinstance(tipo, ArrayType):
        linhas.append(f'{prefixo}-- element: {tipo.elementType.typeName()} (containsNull = {str(tipo.containsNull).lower()})')
        _campos(tipo.elementType, prefixo + '    |', linhas)
    elif isinstance(tipo, MapType):
        linhas.append(f'{prefixo}-- key: {tipo.keyType.typeName()}')
        _campos(tipo.keyType, prefixo + '    |', linhas)
        linhas.append(f'{prefixo}-- value: {tipo.valueType.typeName()} (valueContainsNull = {str(tipo.valueContainsNull).lower()})')
        _campos(tipo.valueType, prefixo + '    |', linhas)


def arvore_do_schema(schema):
    linhas = ['root']
    _campos(schema, ' |', linhas)
    return '\n'.join(linhas) + '\n'
