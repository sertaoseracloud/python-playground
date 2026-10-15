"""Tipos do Spark SQL, Row, inferência de schema e o schema em texto (DDL)."""
import datetime
import re

from ..errors import PySparkTypeError, PySparkValueError, ParseException


class DataType:
    _simples = ''
    _nome = ''

    def simpleString(self):
        return self._simples

    def typeName(self):
        return self._nome

    def sql(self):
        return self.simpleString().upper()

    def __repr__(self):
        return f'{type(self).__name__}()'

    def __eq__(self, outro):
        return isinstance(outro, DataType) and repr(self) == repr(outro)

    def __hash__(self):
        return hash(repr(self))


class StringType(DataType):
    _simples, _nome = 'string', 'string'


class IntegerType(DataType):
    _simples, _nome = 'int', 'integer'


class LongType(DataType):
    _simples, _nome = 'bigint', 'long'


class ShortType(DataType):
    _simples, _nome = 'smallint', 'short'


class ByteType(DataType):
    _simples, _nome = 'tinyint', 'byte'


class DoubleType(DataType):
    _simples, _nome = 'double', 'double'


class FloatType(DataType):
    _simples, _nome = 'float', 'float'


class BooleanType(DataType):
    _simples, _nome = 'boolean', 'boolean'


class DateType(DataType):
    _simples, _nome = 'date', 'date'


class TimestampType(DataType):
    _simples, _nome = 'timestamp', 'timestamp'


class NullType(DataType):
    _simples, _nome = 'void', 'void'


class BinaryType(DataType):
    _simples, _nome = 'binary', 'binary'


class ArrayType(DataType):
    _nome = 'array'

    def __init__(self, elementType, containsNull=True):
        self.elementType, self.containsNull = elementType, containsNull

    def simpleString(self):
        return f'array<{self.elementType.simpleString()}>'

    def __repr__(self):
        return f'ArrayType({self.elementType!r}, {self.containsNull})'


class MapType(DataType):
    _nome = 'map'

    def __init__(self, keyType, valueType, valueContainsNull=True):
        self.keyType, self.valueType, self.valueContainsNull = keyType, valueType, valueContainsNull

    def simpleString(self):
        return f'map<{self.keyType.simpleString()},{self.valueType.simpleString()}>'

    def __repr__(self):
        return f'MapType({self.keyType!r}, {self.valueType!r}, {self.valueContainsNull})'


class StructField(DataType):
    def __init__(self, name, dataType, nullable=True, metadata=None):
        self.name, self.dataType, self.nullable, self.metadata = name, dataType, nullable, metadata or {}

    def simpleString(self):
        return f'{self.name}:{self.dataType.simpleString()}'

    def __repr__(self):
        return f"StructField('{self.name}', {self.dataType!r}, {self.nullable})"


class StructType(DataType):
    _nome = 'struct'

    def __init__(self, fields=None):
        self.fields = list(fields or [])

    def add(self, field, data_type=None, nullable=True, metadata=None):
        if isinstance(field, StructField):
            self.fields.append(field)
        else:
            tipo = ler_tipo(data_type) if isinstance(data_type, str) else data_type
            self.fields.append(StructField(field, tipo, nullable, metadata))
        return self

    @property
    def names(self):
        return [f.name for f in self.fields]

    def fieldNames(self):
        return self.names

    def simpleString(self):
        return f"struct<{','.join(f.simpleString() for f in self.fields)}>"

    def __iter__(self):
        return iter(self.fields)

    def __len__(self):
        return len(self.fields)

    def __getitem__(self, chave):
        if isinstance(chave, str):
            for f in self.fields:
                if f.name == chave:
                    return f
            raise KeyError(f'No StructField named {chave}')
        return self.fields[chave]

    def __repr__(self):
        return f"StructType([{', '.join(repr(f) for f in self.fields)}])"

    def treeString(self):
        from .mostrar import arvore_do_schema
        return arvore_do_schema(self)


# ---------- Row ----------

class UserDefinedType(DataType):
    """Tipo de uma classe do Python, como o VectorUDT do pyspark.ml (a classe aponta para ele em __UDT__)."""

    def aceita(self, valor):
        return True


def _criar_row(campos, valores):
    row = Row(*valores)
    row.__fields__ = list(campos)
    return row


class Row(tuple):
    """Uma linha: tupla com nomes (Row(nome='Ana', idade=30)) ou fábrica de linhas (Row('nome', 'idade'))."""

    def __new__(cls, *args, **kwargs):
        if args and kwargs:
            raise ValueError('Can not use both args and kwargs to create Row')
        if kwargs:
            row = tuple.__new__(cls, list(kwargs.values()))
            row.__fields__ = list(kwargs)
            return row
        return tuple.__new__(cls, args)

    def __call__(self, *valores):
        return _criar_row(list(self), valores)

    def asDict(self, recursive=False):
        if not hasattr(self, '__fields__'):
            raise TypeError('Cannot convert a Row class into dict')

        def converter(v):
            if not recursive:
                return v
            if isinstance(v, Row):
                return v.asDict(True)
            if isinstance(v, list):
                return [converter(x) for x in v]
            if isinstance(v, dict):
                return {k: converter(x) for k, x in v.items()}
            return v
        return {k: converter(v) for k, v in zip(self.__fields__, self)}

    def __getattr__(self, item):
        if item.startswith('__'):
            raise AttributeError(item)
        try:
            return self[self.__fields__.index(item)]
        except (ValueError, AttributeError):
            raise AttributeError(item) from None

    def __getitem__(self, item):
        if isinstance(item, str):
            try:
                return tuple.__getitem__(self, self.__fields__.index(item))
            except (ValueError, AttributeError):
                raise ValueError(item) from None
        return tuple.__getitem__(self, item)

    def __contains__(self, item):
        if hasattr(self, '__fields__'):
            return item in self.__fields__
        return tuple.__contains__(self, item)

    def __setattr__(self, chave, valor):
        if chave != '__fields__':
            raise RuntimeError('Row is read-only')
        object.__setattr__(self, chave, valor)

    def __reduce__(self):
        if hasattr(self, '__fields__'):
            return (_criar_row, (self.__fields__, tuple(self)))
        return tuple.__reduce__(self)

    def __repr__(self):
        if hasattr(self, '__fields__'):
            return 'Row(%s)' % ', '.join(f'{k}={v!r}' for k, v in zip(self.__fields__, self))
        return '<Row(%s)>' % ', '.join(repr(v) for v in self)


# ---------- inferência ----------

_INTEIROS = (IntegerType, LongType, ShortType, ByteType)
NUMERICOS = _INTEIROS + (DoubleType, FloatType)


def inferir_tipo(valor):
    if valor is None:
        return NullType()
    if isinstance(valor, bool):
        return BooleanType()
    if isinstance(valor, int):
        return LongType()
    if isinstance(valor, float):
        return DoubleType()
    if isinstance(valor, str):
        return StringType()
    if isinstance(valor, datetime.datetime):
        return TimestampType()
    if isinstance(valor, datetime.date):
        return DateType()
    if isinstance(valor, (list, tuple)) and not isinstance(valor, Row):
        elemento = NullType()
        for item in valor:
            elemento = juntar_tipos(elemento, inferir_tipo(item))
        return ArrayType(elemento, True)
    if isinstance(valor, Row) and hasattr(valor, '__fields__'):
        return StructType([StructField(k, inferir_tipo(v)) for k, v in zip(valor.__fields__, valor)])
    if isinstance(valor, dict):
        chave, val = NullType(), NullType()
        for k, v in valor.items():
            chave, val = juntar_tipos(chave, inferir_tipo(k)), juntar_tipos(val, inferir_tipo(v))
        return MapType(chave, val, True)
    udt = getattr(type(valor), '__UDT__', None)
    if udt is not None:
        return udt
    raise PySparkTypeError(f'Column, parameter or value of type {type(valor).__name__} is not supported.',
                           'CANNOT_INFER_TYPE_FOR_FIELD',
                           {'data_type': type(valor).__name__})


def juntar_tipos(a, b, campo=None):
    if isinstance(a, NullType):
        return b
    if isinstance(b, NullType):
        return a
    if isinstance(a, ArrayType) and isinstance(b, ArrayType):
        return ArrayType(juntar_tipos(a.elementType, b.elementType), True)
    if isinstance(a, StructType) and isinstance(b, StructType):
        campos = {f.name: f.dataType for f in a.fields}
        for f in b.fields:
            campos[f.name] = juntar_tipos(campos[f.name], f.dataType) if f.name in campos else f.dataType
        return StructType([StructField(k, v) for k, v in campos.items()])
    if a == b:
        return a
    # Spark 4: tipos simples diferentes se juntam (números no mais largo; o resto vira texto).
    simples = (StringType, BooleanType, DateType, TimestampType) + NUMERICOS
    if isinstance(a, simples) and isinstance(b, simples):
        if isinstance(a, NUMERICOS) and isinstance(b, NUMERICOS):
            return tipo_mais_largo(a, b)
        return StringType()
    nome = f' for field {campo}' if campo else ''
    raise PySparkTypeError(f'Can not merge type `{type(a).__name__}` and `{type(b).__name__}`{nome}.',
                           'CANNOT_MERGE_TYPE', {'data_type1': type(a).__name__, 'data_type2': type(b).__name__})


def tipo_mais_largo(a, b):
    """Tipo comum para aritmética, union e CASE WHEN (sem erro: o mais largo)."""
    if isinstance(a, NullType):
        return b
    if isinstance(b, NullType):
        return a
    if a == b:
        return a
    ordem = [ByteType, ShortType, IntegerType, LongType, FloatType, DoubleType]
    ta, tb = type(a), type(b)
    if ta in ordem and tb in ordem:
        return max(a, b, key=lambda t: ordem.index(type(t)))
    if StringType in (ta, tb):
        return StringType()
    if {ta, tb} == {DateType, TimestampType}:
        return TimestampType()
    return a


def schema_dos_dados(linhas, nomes=None):
    """Schema inferido de uma lista de linhas (tuplas, listas, dicionários ou Row)."""
    tipos = None
    for linha in linhas:
        if isinstance(linha, dict):
            itens = sorted(linha.items())
            nomes_linha, valores = [k for k, _ in itens], [v for _, v in itens]
        elif isinstance(linha, Row) and hasattr(linha, '__fields__'):
            nomes_linha, valores = list(linha.__fields__), list(linha)
        elif isinstance(linha, (tuple, list)):
            nomes_linha, valores = None, list(linha)
        else:
            nomes_linha, valores = None, [linha]
        if nomes is None and nomes_linha is not None:
            nomes = nomes_linha
        atuais = [inferir_tipo(v) for v in valores]
        if tipos is None:
            tipos = atuais
        else:
            nomes_atuais = nomes or [f'_{i + 1}' for i in range(len(tipos))]
            tipos = [juntar_tipos(a, b, nomes_atuais[i] if i < len(nomes_atuais) else None) for i, (a, b) in enumerate(zip(tipos, atuais))]
    tipos = tipos or []
    nomes = list(nomes or [f'_{i + 1}' for i in range(len(tipos))])
    if len(nomes) < len(tipos):
        nomes += [f'_{i + 1}' for i in range(len(nomes), len(tipos))]
    for tipo in tipos:
        if _tem_nulo(tipo):
            raise PySparkValueError('Some of types cannot be determined after inferring.', 'CANNOT_DETERMINE_TYPE')
    return StructType([StructField(n, t, True) for n, t in zip(nomes, tipos)])


def _tem_nulo(tipo):
    if isinstance(tipo, NullType):
        return True
    if isinstance(tipo, StructType):
        return any(_tem_nulo(f.dataType) for f in tipo.fields)
    return False


def conferir(valor, tipo, campo, inferido=False):
    """Valor convertido para o tipo do campo (ou erro, como o PySpark faz no createDataFrame).

    `inferido`: o schema saiu dos próprios dados; uma coluna com tipos misturados virou texto
    e os valores que não são texto são convertidos (como no Spark 4)."""
    if valor is None:
        return None
    if inferido and isinstance(tipo, StringType) and not isinstance(valor, str):
        from .mostrar import texto_do_valor
        return texto_do_valor(valor)

    def erro():
        return PySparkTypeError(f'field {campo}: {tipo!r} can not accept object {valor!r} in type {type(valor)}.',
                                'FIELD_DATA_TYPE_UNACCEPTABLE', {'field_name': campo})
    if isinstance(tipo, _INTEIROS):
        if isinstance(valor, bool) or not isinstance(valor, int):
            raise erro()
        return valor
    if isinstance(tipo, (DoubleType, FloatType)):
        if isinstance(valor, bool) or not isinstance(valor, (int, float)):
            raise erro()
        return float(valor)
    if isinstance(tipo, StringType):
        if not isinstance(valor, str):
            raise erro()
        return valor
    if isinstance(tipo, BooleanType):
        if not isinstance(valor, bool):
            raise erro()
        return valor
    if isinstance(tipo, TimestampType):
        if isinstance(valor, datetime.datetime):
            return valor
        if isinstance(valor, datetime.date):
            return datetime.datetime(valor.year, valor.month, valor.day)
        raise erro()
    if isinstance(tipo, DateType):
        if isinstance(valor, datetime.datetime):
            return valor.date()
        if isinstance(valor, datetime.date):
            return valor
        raise erro()
    if isinstance(tipo, ArrayType):
        if not isinstance(valor, (list, tuple)):
            raise erro()
        return [conferir(v, tipo.elementType, campo) for v in valor]
    if isinstance(tipo, MapType):
        if not isinstance(valor, dict):
            raise erro()
        return {conferir(k, tipo.keyType, campo): conferir(v, tipo.valueType, campo) for k, v in valor.items()}
    if isinstance(tipo, StructType):
        if isinstance(valor, dict):
            valores = [valor.get(f.name) for f in tipo.fields]
        elif isinstance(valor, (tuple, list)):
            valores = list(valor)
        else:
            raise erro()
        return _criar_row(tipo.names, [conferir(v, f.dataType, f.name) for v, f in zip(valores, tipo.fields)])
    if isinstance(tipo, UserDefinedType):
        if not tipo.aceita(valor):
            raise erro()
        return valor
    return valor


# ---------- DDL ----------

_NOMES = {
    'string': StringType, 'varchar': StringType, 'char': StringType, 'text': StringType,
    'int': IntegerType, 'integer': IntegerType, 'bigint': LongType, 'long': LongType,
    'smallint': ShortType, 'short': ShortType, 'tinyint': ByteType, 'byte': ByteType,
    'double': DoubleType, 'float': FloatType, 'real': FloatType, 'boolean': BooleanType, 'bool': BooleanType,
    'date': DateType, 'timestamp': TimestampType, 'void': NullType, 'binary': BinaryType,
    'decimal': DoubleType, 'numeric': DoubleType,
}


def _dividir_no_nivel(texto, separador=','):
    partes, nivel, atual = [], 0, ''
    for c in texto:
        if c in '<(':
            nivel += 1
        elif c in '>)':
            nivel -= 1
        if c == separador and nivel == 0:
            partes.append(atual)
            atual = ''
        else:
            atual += c
    if atual.strip():
        partes.append(atual)
    return [p.strip() for p in partes]


def ler_tipo(texto):
    """'int', 'array<string>', 'struct<a:int,b:string>', 'decimal(10,2)'..."""
    if isinstance(texto, DataType):
        return texto
    t = texto.strip()
    baixo = t.lower()
    if baixo.startswith('array<') and baixo.endswith('>'):
        return ArrayType(ler_tipo(t[6:-1]), True)
    if baixo.startswith('map<') and baixo.endswith('>'):
        chave, valor = _dividir_no_nivel(t[4:-1])
        return MapType(ler_tipo(chave), ler_tipo(valor), True)
    if baixo.startswith('struct<') and baixo.endswith('>'):
        campos = []
        for parte in _dividir_no_nivel(t[7:-1]):
            nome, tipo = re.split(r'\s*:\s*|\s+', parte, maxsplit=1)
            campos.append(StructField(nome.strip('`'), ler_tipo(tipo)))
        return StructType(campos)
    base = re.sub(r'\(.*\)$', '', baixo).strip()
    if base in _NOMES:
        return _NOMES[base]()
    raise ParseException(f"DataType {t} is not supported.", 'UNSUPPORTED_DATATYPE', {'typeName': t}, '0A000')


def ler_ddl(texto):
    """'nome STRING, idade INT' (ou 'nome: string, idade: int') → StructType."""
    if isinstance(texto, StructType):
        return texto
    campos = []
    for parte in _dividir_no_nivel(texto.strip()):
        m = re.match(r'^`?([^`\s:]+)`?\s*:?\s+(.+?)(\s+NOT\s+NULL)?$', parte, re.IGNORECASE)
        if not m:
            m = re.match(r'^`?([^`\s:]+)`?\s*:\s*(.+?)(\s+NOT\s+NULL)?$', parte, re.IGNORECASE)
        if not m:
            raise ParseException(f"Syntax error at or near '{parte}'.", 'PARSE_SYNTAX_ERROR', {}, '42601')
        campos.append(StructField(m.group(1), ler_tipo(m.group(2)), not m.group(3)))
    return StructType(campos)


def tipo_do_texto(texto):
    """Um tipo ('int') ou um schema ('a int, b string')."""
    try:
        return ler_tipo(texto)
    except ParseException:
        return ler_ddl(texto)


__all__ = [
    'DataType', 'StringType', 'IntegerType', 'LongType', 'ShortType', 'ByteType', 'DoubleType', 'FloatType',
    'BooleanType', 'DateType', 'TimestampType', 'NullType', 'BinaryType', 'ArrayType', 'MapType',
    'StructField', 'StructType', 'Row', 'UserDefinedType',
]
