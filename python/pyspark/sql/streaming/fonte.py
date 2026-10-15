"""As fontes do streaming (os arquivos de uma pasta e o rate), o nó do plano que recebe cada micro-lote
e o withWatermark. A fonte não guarda o que já leu: cada consulta guarda o seu (consulta.py)."""
import datetime as dt
import os

from ...errors import AnalysisException, IllegalArgumentException, caminho_nao_existe
from ...rdd import _Fonte
from .. import types as T
from ..column import Atributo
from ..plano import INFINITO, No, lista_de_atributos
from ..readwriter import _formato

ERRO_EM_LOTE = 'Queries with streaming sources must be executed with writeStream.start();'
SEM_SCHEMA = ('Schema must be specified when creating a streaming source DataFrame. If some files already exist in the '
              "directory, then depending on the file format you may be able to create a static DataFrame on that directory "
              "with 'spark.read.load(directory)' and infer schema from it.")


class FonteStream(No):
    """A tabela sem fim: só tem linhas enquanto um micro-lote roda (o executor põe as partições em `lote`)."""

    def __init__(self, sessao, fonte):
        super().__init__(sessao)
        self.fonte = fonte
        self.saida = [Atributo(f.name, f.dataType, anulavel=f.nullable) for f in fonte.schema.fields]
        self.lote = None

    def linha(self, raiz=False):
        return f'StreamingRelation {self.fonte.nome}, [{lista_de_atributos(self.saida)}]'

    def num_particoes(self):
        return len(self.lote) if self.lote else 1

    def tamanho(self):
        return INFINITO

    def rdd(self):
        if self.lote is None:
            raise AnalysisException(ERRO_EM_LOTE)
        return _Fonte(self.sessao.sparkContext, 'stream', particoes=[list(p) for p in self.lote])


class MarcaDagua(No):
    """withWatermark: não muda as linhas; diz ao executor a coluna do tempo do evento e o atraso aceito."""

    def __init__(self, filho, atributo, atraso):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.atributo, self.atraso = atributo, atraso
        self.saida = filho.saida

    def linha(self, raiz=False):
        return f'EventTimeWatermark {self.atributo.ref()}, {self.atraso // 10**6} seconds'

    def rdd(self):
        return self.filhos[0].rdd()


class FonteArquivos:
    def __init__(self, pasta, nome, schema, opcoes):
        self.pasta, self.nome, self.schema = pasta, nome, schema
        self.formato = _formato(nome, opcoes)
        self.maximo = int(opcoes['maxFilesPerTrigger']) if 'maxFilesPerTrigger' in opcoes else None
        self.descricao = f'FileStreamSource[file:{pasta}]'

    def listar(self):
        """Os arquivos de dados da pasta, em ordem de nome (sem os que começam com _ ou ., e sem subpastas)."""
        if not os.path.isdir(self.pasta):
            return []
        return sorted(n for n in os.listdir(self.pasta)
                      if not n.startswith(('_', '.')) and os.path.isfile(os.path.join(self.pasta, n)))

    def ler(self, nome):
        return self.formato.ler(os.path.join(self.pasta, nome), self.schema)


class FonteRate:
    nome = 'rate'
    schema = T.StructType([T.StructField('timestamp', T.TimestampType()), T.StructField('value', T.LongType())])

    def __init__(self, opcoes):
        self.por_segundo = int(opcoes.get('rowsPerSecond', 1))
        if self.por_segundo <= 0:
            raise IllegalArgumentException(f"Invalid value '{self.por_segundo}'. The option 'rowsPerSecond' must be positive")
        self.descricao = f'RateStreamV2[rowsPerSecond={self.por_segundo}, rampUpTimeSeconds=0, numPartitions=default'

    def linhas(self, inicio, de, ate):
        """As linhas value = de..ate-1; a de número v nasce v / rowsPerSecond segundos depois do início."""
        return [(inicio + dt.timedelta(microseconds=v * 10**6 // self.por_segundo), v) for v in range(de, ate)]


class DataStreamReader:
    def __init__(self, sessao):
        self._sessao, self._formato, self._opcoes, self._schema = sessao, None, {}, None

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
        from ..dataframe import DataFrame
        if format:
            self._formato = format
        if schema is not None:
            self.schema(schema)
        self.options(**{k: v for k, v in opcoes.items() if v is not None})
        nome = (self._formato or 'parquet').lower()
        if nome == 'rate':
            fonte = FonteRate(self._opcoes)
        else:
            if path is None:
                raise IllegalArgumentException("'path' is not specified")
            pasta = os.path.abspath(path)
            if not os.path.exists(pasta):
                raise caminho_nao_existe(pasta)
            if nome in ('text', 'txt'):
                schema_da_fonte = T.StructType([T.StructField('value', T.StringType())])
            elif self._schema is None:
                raise IllegalArgumentException(SEM_SCHEMA)
            else:
                schema_da_fonte = self._schema
            fonte = FonteArquivos(pasta, nome, schema_da_fonte, self._opcoes)
        return DataFrame(FonteStream(self._sessao, fonte), self._sessao)

    def csv(self, path, schema=None, sep=None, header=None, **opcoes):
        self._formato = 'csv'
        for k, v in (('sep', sep), ('header', header)):
            if v is not None:
                self.option(k, v)
        return self.load(path, schema=schema, **opcoes)

    def json(self, path, schema=None, multiLine=None, **opcoes):
        self._formato = 'json'
        if multiLine is not None:
            self.option('multiLine', multiLine)
        return self.load(path, schema=schema, **opcoes)

    def text(self, path, **opcoes):
        self._formato = 'text'
        return self.load(path, **opcoes)
