"""Leitura e escrita de arquivos (CSV, JSON, texto e um parquet simplificado).

Tudo é lido e gravado no processo principal: os workers não têm a pasta do aluno, então os
dados lidos viajam dentro das tarefas. O schema é descoberto na hora do read (como no Spark),
e as linhas são lidas na ação."""
import csv
import io
import json
import os
import re
import shutil

from ..errors import AnalysisException, caminho_nao_existe
from ..rdd import _Fonte
from . import types as T
from .column import Atributo, converter
from .mostrar import texto_do_valor
from .plano import No


def _arquivos(caminho):
    """Os arquivos de dados de um caminho (pasta: os que não começam com _ ou .), com as partições (col=valor)."""
    if os.path.isfile(caminho):
        return [(caminho, {})]
    saida = []
    for raiz, pastas, nomes in os.walk(caminho):
        pastas[:] = sorted(p for p in pastas if not p.startswith(('_', '.')))
        relativo = os.path.relpath(raiz, caminho)
        particao = {}
        if relativo != '.':
            for parte in relativo.replace('\\', '/').split('/'):
                if '=' in parte:
                    k, v = parte.split('=', 1)
                    particao[k] = None if v == '__HIVE_DEFAULT_PARTITION__' else v
        for nome in sorted(nomes):
            if not nome.startswith(('_', '.')) and not nome.endswith('.crc'):
                saida.append((os.path.join(raiz, nome), particao))
    return saida


def _ler_texto(caminho):
    with open(caminho, encoding='utf-8', newline='') as f:
        return f.read()


# ---------- CSV ----------

def _linhas_csv(texto, opcoes):
    sep = opcoes.get('sep', opcoes.get('delimiter', ','))
    aspas = opcoes.get('quote', '"')
    leitor = csv.reader(io.StringIO(texto), delimiter=sep, quotechar=aspas or None, escapechar=opcoes.get('escape', '\\') or None)
    return [linha for linha in leitor if linha]


def _verdade(v):
    return str(v).lower() == 'true'


_INT = re.compile(r'^[+-]?\d+$')
_NUM = re.compile(r'^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$')
_DATA = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_DATA_HORA = re.compile(r'^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$')


def _tipo_do_texto(v):
    if _INT.match(v):
        return T.IntegerType() if -2**31 <= int(v) < 2**31 else T.LongType()
    if _NUM.match(v) or v in ('NaN', 'Infinity', '-Infinity'):
        return T.DoubleType()
    if v.lower() in ('true', 'false'):
        return T.BooleanType()
    if _DATA.match(v):
        return T.DateType()
    if _DATA_HORA.match(v):
        return T.TimestampType()
    return T.StringType()


def _juntar_csv(a, b):
    if a is None:
        return b
    if a == b:
        return a
    numeros = [T.IntegerType(), T.LongType(), T.DoubleType()]
    if a in numeros and b in numeros:
        return max(a, b, key=numeros.index)
    if {type(a), type(b)} == {T.DateType, T.TimestampType}:
        return T.TimestampType()
    return T.StringType()


def _converter_texto(v, tipo):
    if v is None:
        return None
    try:
        return converter(v, T.StringType(), tipo, False)
    except Exception:
        return None


class _Csv:
    extensao = 'csv'

    def __init__(self, opcoes):
        self.opcoes = opcoes

    def _registros(self, caminho):
        linhas = _linhas_csv(_ler_texto(caminho), self.opcoes)
        if _verdade(self.opcoes.get('header', False)) and linhas:
            return linhas[0], linhas[1:]
        return None, linhas

    def inferir(self, arquivos):
        cabecalho, tipos, largura = None, None, 0
        nulo = self.opcoes.get('nullValue', '')
        inferir = _verdade(self.opcoes.get('inferSchema', False))
        for caminho, _ in arquivos:
            cab, linhas = self._registros(caminho)
            if cabecalho is None and cab is not None:
                cabecalho = cab
            for linha in linhas:
                largura = max(largura, len(linha))
            if inferir:
                tipos = tipos or {}
                for linha in linhas:
                    for i, v in enumerate(linha):
                        if v == nulo:
                            continue
                        tipos[i] = _juntar_csv(tipos.get(i), _tipo_do_texto(v))
        largura = len(cabecalho) if cabecalho else largura
        nomes = list(cabecalho) if cabecalho else [f'_c{i}' for i in range(largura)]
        return T.StructType([T.StructField(n, (tipos or {}).get(i) or T.StringType()) for i, n in enumerate(nomes)])

    def ler(self, caminho, schema):
        nulo = self.opcoes.get('nullValue', '')
        _, linhas = self._registros(caminho)
        n = len(schema.fields)
        saida = []
        for linha in linhas:
            valores = [None if v == nulo else v for v in linha[:n]] + [None] * (n - len(linha))
            saida.append(tuple(_converter_texto(v, f.dataType) for v, f in zip(valores, schema.fields)))
        return saida

    def gravar(self, linhas, nomes, arquivo):
        sep = self.opcoes.get('sep', self.opcoes.get('delimiter', ','))
        saida = io.StringIO()
        escritor = csv.writer(saida, delimiter=sep, quotechar='"', lineterminator='\n', quoting=csv.QUOTE_MINIMAL)
        if _verdade(self.opcoes.get('header', False)):
            escritor.writerow(nomes)
        for linha in linhas:
            escritor.writerow(['' if v is None else texto_do_valor(v) for v in linha])
        with open(arquivo, 'w', encoding='utf-8', newline='') as f:
            f.write(saida.getvalue())


# ---------- JSON ----------

def _tipo_json(v):
    if v is None:
        return T.NullType()
    if isinstance(v, bool):
        return T.BooleanType()
    if isinstance(v, int):
        return T.LongType()
    if isinstance(v, float):
        return T.DoubleType()
    if isinstance(v, str):
        return T.StringType()
    if isinstance(v, list):
        t = T.NullType()
        for x in v:
            t = _juntar_json(t, _tipo_json(x))
        return T.ArrayType(t, True)
    if isinstance(v, dict):
        return T.StructType([T.StructField(k, _tipo_json(v[k])) for k in sorted(v)])
    return T.StringType()


def _juntar_json(a, b):
    if isinstance(a, T.NullType):
        return b
    if isinstance(b, T.NullType):
        return a
    if a == b:
        return a
    if {type(a), type(b)} == {T.LongType, T.DoubleType}:
        return T.DoubleType()
    if isinstance(a, T.ArrayType) and isinstance(b, T.ArrayType):
        return T.ArrayType(_juntar_json(a.elementType, b.elementType), True)
    if isinstance(a, T.StructType) and isinstance(b, T.StructType):
        campos = {f.name: f.dataType for f in a.fields}
        for f in b.fields:
            campos[f.name] = _juntar_json(campos.get(f.name, T.NullType()), f.dataType)
        return T.StructType([T.StructField(k, campos[k]) for k in sorted(campos)])
    return T.StringType()


def _sem_nulo(t):
    if isinstance(t, T.NullType):
        return T.StringType()
    if isinstance(t, T.ArrayType):
        return T.ArrayType(_sem_nulo(t.elementType), True)
    if isinstance(t, T.StructType):
        return T.StructType([T.StructField(f.name, _sem_nulo(f.dataType)) for f in t.fields])
    return t


def _valor_json(v, tipo):
    if v is None:
        return None
    if isinstance(tipo, T.StructType):
        if not isinstance(v, dict):
            return None
        return T._criar_row(tipo.names, [_valor_json(v.get(f.name), f.dataType) for f in tipo.fields])
    if isinstance(tipo, T.ArrayType):
        return [_valor_json(x, tipo.elementType) for x in v] if isinstance(v, list) else None
    if isinstance(tipo, (T.DoubleType, T.FloatType)):
        return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else _converter_texto(str(v), tipo)
    if isinstance(tipo, T.StringType):
        return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    if isinstance(tipo, (T.LongType, T.IntegerType)):
        return v if isinstance(v, int) and not isinstance(v, bool) else _converter_texto(str(v), tipo)
    if isinstance(tipo, T.BooleanType):
        return v if isinstance(v, bool) else None
    return _converter_texto(str(v), tipo)


def _para_json(v):
    import datetime
    if isinstance(v, (datetime.date, datetime.datetime)):
        return texto_do_valor(v)
    if isinstance(v, T.Row) and hasattr(v, '__fields__'):
        return {k: _para_json(x) for k, x in zip(v.__fields__, v) if x is not None}
    if isinstance(v, list):
        return [_para_json(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _para_json(x) for k, x in v.items()}
    return v


class _Json:
    extensao = 'json'

    def __init__(self, opcoes):
        self.opcoes = opcoes

    def _objetos(self, caminho):
        texto = _ler_texto(caminho)
        if _verdade(self.opcoes.get('multiLine', False)):
            dado = json.loads(texto)
            return dado if isinstance(dado, list) else [dado]
        objetos = []
        for linha in texto.splitlines():
            if linha.strip():
                try:
                    objetos.append(json.loads(linha))
                except ValueError:
                    objetos.append({'_corrupt_record': linha})
        return objetos

    def inferir(self, arquivos):
        tipo = T.StructType([])
        for caminho, _ in arquivos:
            for obj in self._objetos(caminho):
                tipo = _juntar_json(tipo, _tipo_json(obj if isinstance(obj, dict) else {}))
        return _sem_nulo(tipo)

    def ler(self, caminho, schema):
        return [tuple(_valor_json(obj.get(f.name), f.dataType) if isinstance(obj, dict) else None for f in schema.fields)
                for obj in self._objetos(caminho)]

    def gravar(self, linhas, nomes, arquivo):
        with open(arquivo, 'w', encoding='utf-8', newline='') as f:
            for linha in linhas:
                registro = {k: _para_json(v) for k, v in zip(nomes, linha) if v is not None}
                f.write(json.dumps(registro, ensure_ascii=False, separators=(',', ':')) + '\n')


class _Parquet(_Json):
    """Parquet simplificado: uma linha com o schema e uma linha JSON por registro (só o DivergePython lê)."""
    extensao = 'parquet'

    def inferir(self, arquivos):
        for caminho, _ in arquivos:
            with open(caminho, encoding='utf-8') as f:
                return T.ler_tipo(json.loads(f.readline())['schema'])
        return T.StructType([])

    def ler(self, caminho, schema):
        with open(caminho, encoding='utf-8') as f:
            f.readline()
            return [tuple(_valor_json(obj.get(fd.name), fd.dataType) for fd in schema.fields) for obj in map(json.loads, f) if obj is not None]

    def gravar(self, linhas, nomes, arquivo, schema=None):
        with open(arquivo, 'w', encoding='utf-8', newline='') as f:
            f.write(json.dumps({'schema': schema.simpleString()}) + '\n')
            for linha in linhas:
                registro = {k: _para_json(v) for k, v in zip(nomes, linha) if v is not None}
                f.write(json.dumps(registro, ensure_ascii=False, separators=(',', ':')) + '\n')


class _Texto:
    extensao = 'txt'

    def __init__(self, opcoes):
        self.opcoes = opcoes

    def inferir(self, arquivos):
        return T.StructType([T.StructField('value', T.StringType())])

    def ler(self, caminho, schema):
        return [(linha,) for linha in _ler_texto(caminho).splitlines()]

    def gravar(self, linhas, nomes, arquivo):
        with open(arquivo, 'w', encoding='utf-8', newline='') as f:
            for linha in linhas:
                f.write(('' if linha[0] is None else str(linha[0])) + '\n')


_FORMATOS = {'csv': _Csv, 'json': _Json, 'parquet': _Parquet, 'text': _Texto, 'txt': _Texto}


def _formato(nome, opcoes):
    classe = _FORMATOS.get(nome.lower())
    if classe is None:
        raise AnalysisException(
            f'Failed to find the data source: {nome}. Make sure the provider name is correct and the package is properly '
            'registered and compatible with your Spark version.', 'DATA_SOURCE_NOT_FOUND', {'provider': nome}, '42K02')
    return classe(opcoes)


class _LerArquivos:
    """Lê as partições na hora da ação (no processo principal)."""

    def __init__(self, formato, arquivos, schema, colunas_particao):
        self.formato, self.arquivos, self.schema, self.colunas_particao = formato, arquivos, schema, colunas_particao

    def __call__(self):
        particoes = []
        for caminho, particao in self.arquivos:
            if not os.path.exists(caminho):
                raise caminho_nao_existe(caminho)
            linhas = self.formato.ler(caminho, self.schema)
            extras = tuple(_converter_texto(particao.get(c.name), c.dataType) for c in self.colunas_particao)
            particoes.append([linha + extras for linha in linhas])
        return particoes


class FileScan(No):
    def __init__(self, sessao, nome_formato, arquivos, schema, colunas_particao, raiz, leitor):
        super().__init__(sessao)
        self.nome_formato, self.arquivos, self.schema, self.colunas_particao, self.raiz = nome_formato, arquivos, schema, colunas_particao, raiz
        self.leitor = leitor
        campos = list(schema.fields) + list(colunas_particao)
        self.saida = [Atributo(f.name, f.dataType, anulavel=f.nullable) for f in campos]

    def linha(self, raiz=False):
        cols = ','.join(a.ref() for a in self.saida)
        return (f'FileScan {self.nome_formato} [{cols}] Batched: false, DataFilters: [], Format: {self.nome_formato.upper()}, '
                f'Location: InMemoryFileIndex(1 paths)[file:{self.raiz}], PartitionFilters: [], PushedFilters: [], '
                f'ReadSchema: {self.schema.simpleString()}')

    def num_particoes(self):
        return max(1, len(self.arquivos))

    def tamanho(self):
        return sum(os.path.getsize(c) for c, _ in self.arquivos if os.path.exists(c))

    def rdd(self):
        leitor = _LerArquivos(self.leitor, self.arquivos, self.schema, self.colunas_particao)
        return _Fonte(self.sessao.sparkContext, self.nome_formato, carregar=leitor, n=self.num_particoes())


class DataFrameReader:
    def __init__(self, sessao):
        self._sessao = sessao
        self._formato = 'parquet'
        self._opcoes = {}
        self._schema = None

    def format(self, source):
        self._formato = source
        return self

    def option(self, key, value):
        self._opcoes[key] = str(value).lower() if isinstance(value, bool) else str(value)
        return self

    def options(self, **opcoes):
        for k, v in opcoes.items():
            self.option(k, v)
        return self

    def schema(self, schema):
        self._schema = T.ler_ddl(schema) if isinstance(schema, str) else schema
        return self

    def load(self, path=None, format=None, schema=None, **opcoes):  # noqa: A002
        if format:
            self._formato = format
        if schema is not None:
            self.schema(schema)
        self.options(**{k: v for k, v in opcoes.items() if v is not None})
        return self._ler(path)

    def _ler(self, caminho):
        from .dataframe import DataFrame
        if self._formato.lower() == 'delta':
            from delta._escrita import ler_delta
            return ler_delta(self._sessao, os.path.abspath(caminho), self._opcoes)
        caminhos = caminho if isinstance(caminho, (list, tuple)) else [caminho]
        arquivos = []
        for c in caminhos:
            absoluto = os.path.abspath(c)
            if not os.path.exists(absoluto):
                raise caminho_nao_existe(absoluto)
            arquivos.extend(_arquivos(absoluto))
        formato = _formato(self._formato, self._opcoes)
        arquivos.sort(key=lambda a: (-os.path.getsize(a[0]), a[0]))
        schema = self._schema or formato.inferir(arquivos)
        chaves = []
        for _, particao in arquivos:
            for k in particao:
                if k not in chaves and k not in schema.names:
                    chaves.append(k)
        colunas_particao = []
        for k in chaves:
            tipo = None
            for _, particao in arquivos:
                v = particao.get(k)
                if v is not None:
                    tipo = _juntar_csv(tipo, _tipo_do_texto(v))
            colunas_particao.append(T.StructField(k, tipo or T.StringType()))
        no = FileScan(self._sessao, self._formato.lower(), arquivos, schema, colunas_particao, os.path.abspath(caminhos[0]), formato)
        return DataFrame(no, self._sessao)

    def csv(self, path, schema=None, sep=None, header=None, inferSchema=None, nullValue=None, quote=None, **opcoes):
        self._formato = 'csv'
        for k, v in (('sep', sep), ('header', header), ('inferSchema', inferSchema), ('nullValue', nullValue), ('quote', quote)):
            if v is not None:
                self.option(k, v)
        return self.load(path, schema=schema, **opcoes)

    def json(self, path, schema=None, multiLine=None, **opcoes):
        self._formato = 'json'
        if multiLine is not None:
            self.option('multiLine', multiLine)
        return self.load(path, schema=schema, **opcoes)

    def parquet(self, *paths, **opcoes):
        self._formato = 'parquet'
        return self.load(list(paths) if len(paths) > 1 else paths[0], **opcoes)

    def text(self, paths, **opcoes):
        self._formato = 'text'
        return self.load(paths, **opcoes)

    def table(self, nome):
        return self._sessao.table(nome)


class DataFrameWriter:
    def __init__(self, df):
        self._df = df
        self._modo = 'errorifexists'
        self._formato = 'parquet'
        self._opcoes = {}
        self._particionar = []

    def mode(self, saveMode):
        modo = (saveMode or 'errorifexists').lower()
        if modo not in ('overwrite', 'append', 'ignore', 'error', 'errorifexists', 'default'):
            raise AnalysisException(f'The specified save mode "{saveMode}" is invalid. Valid save modes include "append", '
                                    '"overwrite", "ignore", "error", "errorifexists", and "default".', 'INVALID_SAVE_MODE', {}, '42000')
        self._modo = 'errorifexists' if modo in ('error', 'default') else modo
        return self

    def format(self, source):
        self._formato = source
        return self

    def option(self, key, value):
        self._opcoes[key] = str(value).lower() if isinstance(value, bool) else str(value)
        return self

    def options(self, **opcoes):
        for k, v in opcoes.items():
            self.option(k, v)
        return self

    def partitionBy(self, *cols):
        if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
            cols = cols[0]
        self._particionar = list(cols)
        return self

    def save(self, path=None, format=None, mode=None, partitionBy=None, **opcoes):  # noqa: A002
        if format:
            self._formato = format
        if mode:
            self.mode(mode)
        if partitionBy:
            self.partitionBy(partitionBy)
        self.options(**{k: v for k, v in opcoes.items() if v is not None})
        if self._formato.lower() == 'delta':
            from delta._escrita import gravar_delta
            return gravar_delta(self._df, os.path.abspath(path), self._modo, self._opcoes)
        formato = _formato(self._formato, self._opcoes)
        destino = os.path.abspath(path)
        if os.path.exists(destino):
            if self._modo == 'errorifexists':
                raise AnalysisException(f'Path file:{destino} already exists. Set mode as "overwrite" to overwrite the existing path.',
                                        'PATH_ALREADY_EXISTS', {'outputPath': f'file:{destino}'}, '42K04')
            if self._modo == 'ignore':
                return
            if self._modo == 'overwrite':
                shutil.rmtree(destino) if os.path.isdir(destino) else os.remove(destino)
        os.makedirs(destino, exist_ok=True)
        df = self._df
        particoes = df._particoes('save')
        nomes = df.columns
        schema = df.schema
        indices = [nomes.index(c) for c in self._particionar]
        resto = [i for i in range(len(nomes)) if i not in indices]
        existentes = len([n for n in os.listdir(destino) if n.startswith('part-')])
        escritos = 0
        for numero, linhas in enumerate(particoes):
            if not linhas:
                continue
            grupos = {}
            for linha in linhas:
                k = tuple(linha[i] for i in indices)
                grupos.setdefault(k, []).append(tuple(linha[i] for i in resto))
            for k, grupo in grupos.items():
                pasta = destino
                for c, v in zip(self._particionar, k):
                    pasta = os.path.join(pasta, f"{c}={'__HIVE_DEFAULT_PARTITION__' if v is None else texto_do_valor(v)}")
                os.makedirs(pasta, exist_ok=True)
                arquivo = os.path.join(pasta, f'part-{existentes + numero:05d}-c000.{formato.extensao}')
                self._gravar(formato, grupo, [nomes[i] for i in resto], arquivo, T.StructType([schema.fields[i] for i in resto]))
                escritos += 1
        if not escritos and not self._particionar:
            arquivo = os.path.join(destino, f'part-{existentes:05d}-c000.{formato.extensao}')
            self._gravar(formato, [], nomes, arquivo, schema)
        open(os.path.join(destino, '_SUCCESS'), 'w').close()

    @staticmethod
    def _gravar(formato, linhas, nomes, arquivo, schema):
        if isinstance(formato, _Parquet):
            formato.gravar(linhas, nomes, arquivo, schema)
        else:
            formato.gravar(linhas, nomes, arquivo)

    def csv(self, path, mode=None, sep=None, header=None, **opcoes):
        self._formato = 'csv'
        if sep is not None:
            self.option('sep', sep)
        if header is not None:
            self.option('header', header)
        return self.save(path, mode=mode, **opcoes)

    def json(self, path, mode=None, **opcoes):
        self._formato = 'json'
        return self.save(path, mode=mode, **opcoes)

    def parquet(self, path, mode=None, partitionBy=None, **opcoes):
        self._formato = 'parquet'
        return self.save(path, mode=mode, partitionBy=partitionBy, **opcoes)

    def text(self, path, **opcoes):
        self._formato = 'text'
        return self.save(path, **opcoes)

    def saveAsTable(self, nome, **_):
        raise AnalysisException('O DivergePython não tem catálogo de tabelas: use df.createOrReplaceTempView(nome) ou grave num caminho com save().',
                                'UNSUPPORTED_FEATURE.TABLE_OPERATION', {}, '0A000')
