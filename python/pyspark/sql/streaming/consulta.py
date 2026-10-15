"""writeStream, StreamingQuery e spark.streams: os micro-lotes no relógio virtual.

Cada micro-lote pega a entrada nova da fonte: os arquivos ainda não lidos, em ordem de nome, até o
maxFilesPerTrigger, ou as linhas do rate no tempo que passou. Roda o plano como um DataFrame comum,
com as partições nos workers, e entrega o resultado à saída: o console imprime como o Spark, e a
memory guarda uma tabela temporária com o nome da consulta. O relógio virtual anda 1 s por lote, ou o
intervalo do processingTime."""
import datetime as dt
import uuid

from diverge_runtime import relogio, streams

from ...errors import AnalysisException, IllegalArgumentException, PySparkValueError, StreamingQueryException
from .. import mostrar
from .. import plano as P
from .. import types as T
from ..plano_largo import HashAggregate, Sort
from .fonte import FonteRate, FonteStream, MarcaDagua

MODOS = ('append', 'complete', 'update')
FORMATOS = ('console', 'memory')
LIMITE_LOTES = 200       # por chamada: uma fonte que nunca acaba não prende o programa
LIMITE_PROGRESSO = 100   # como o spark.sql.streaming.numRecentProgressUpdates
_EPOCA = dt.datetime(1970, 1, 1)
_TRACOS = '-' * 43


def _analisar(plano, modo):
    """As regras do Spark para as consultas de streaming (o UnsupportedOperationChecker); devolve a fonte."""
    nos = list(P.nos(plano))
    fontes = [n for n in nos if isinstance(n, FonteStream)]
    if len(fontes) != 1:
        raise NotImplementedError('O DivergePython roda uma fonte de streaming por consulta (sem join entre streams).')
    agregacoes = [n for n in nos if isinstance(n, HashAggregate) and n.final and n.operacao not in ('dropDuplicates', 'distinct')]
    if modo == 'complete' and not agregacoes:
        raise AnalysisException('Complete output mode not supported when there are no streaming aggregations on '
                                'streaming DataFrames/Datasets;')
    if any(isinstance(n, Sort) and n.global_ for n in nos) and not (modo == 'complete' and agregacoes):
        raise AnalysisException('Sorting is not supported on streaming DataFrames/Datasets, unless it is on aggregated '
                                'DataFrame/Dataset in Complete output mode;')
    return fontes[0]


class DataStreamWriter:
    def __init__(self, df):
        self._df = df
        self._formato, self._modo, self._nome, self._opcoes, self._gatilho = None, 'append', None, {}, None

    def format(self, source):
        self._formato = source.lower()
        return self

    def outputMode(self, outputMode):
        modo = str(outputMode).lower()
        if modo not in MODOS:
            raise IllegalArgumentException(f"Unknown output mode {outputMode}. Accepted output modes are 'append', "
                                           "'complete', 'update'")
        self._modo = modo
        return self

    def queryName(self, queryName):
        self._nome = queryName
        return self

    def option(self, key, value):
        self._opcoes[key] = str(value).lower() if isinstance(value, bool) else str(value)
        return self

    def options(self, **opcoes):
        for k, v in opcoes.items():
            self.option(k, v)
        return self

    def trigger(self, processingTime=None, once=None, continuous=None, availableNow=None):
        dados = [x for x in (processingTime, once, continuous, availableNow) if x is not None]
        if len(dados) != 1:
            raise PySparkValueError('Only allow single trigger.', 'ONLY_ALLOW_SINGLE_TRIGGER')
        if continuous is not None:
            raise NotImplementedError('O DivergePython roda o streaming em micro-lotes: o gatilho continuous fica de fora.')
        if processingTime is not None:
            from ..functions import duracao_em_micros
            self._gatilho = ('tempo', duracao_em_micros(processingTime) / 10**6)
        elif once:
            self._gatilho = ('once',)
        elif availableNow:
            self._gatilho = ('disponivel',)
        return self

    def foreachBatch(self, func):
        raise NotImplementedError('O foreachBatch fica fora do DivergePython: use a saída memory e leia a tabela com spark.sql.')

    foreach = foreachBatch

    def toTable(self, tableName, **_):
        raise NotImplementedError('O DivergePython grava o streaming só em console e memory.')

    def start(self, path=None, format=None, outputMode=None, partitionBy=None, queryName=None, **opcoes):  # noqa: A002
        if format:
            self.format(format)
        if outputMode:
            self.outputMode(outputMode)
        if queryName:
            self.queryName(queryName)
        self.options(**{k: v for k, v in opcoes.items() if v is not None})
        formato = self._formato or 'parquet'  # o padrão do Spark grava arquivos
        if formato not in FORMATOS:
            raise NotImplementedError(f'O DivergePython grava o streaming só em console e memory (pediram {formato}).')
        if formato == 'memory' and not self._nome:
            raise AnalysisException('queryName must be specified for memory sink')
        if self._nome and any(q.isActive and q.name == self._nome for q in streams.consultas()):
            raise IllegalArgumentException(f'Cannot start query with name {self._nome} as a query with that name is '
                                           'already active in this SparkSession')
        consulta = StreamingQuery(self._df, formato, self._modo, self._nome, dict(self._opcoes), self._gatilho)
        streams.registrar(consulta)
        return consulta


class StreamingQueryProgress(dict):
    """O progresso de um micro-lote, com as chaves do Spark (também como atributo: p.numInputRows)."""

    def __getattr__(self, nome):
        try:
            return self[nome]
        except KeyError:
            raise AttributeError(nome) from None


class _SemEstado:
    """Consulta sem agregação: cada lote roda o plano inteiro só com as linhas novas."""

    def __init__(self, consulta):
        self.consulta = consulta

    def lote(self, acao):
        from ..dataframe import DataFrame
        c = self.consulta
        linhas = DataFrame(c._plano, c._sessao)._linhas(acao)
        return linhas, {'operador': None, 'estado': None, 'atualizadas': 0, 'removidas': 0, 'descartadas': 0,
                        'marca_usada': None, 'marca': None}

    def precisa_lote_vazio(self):
        return False


class StreamingQuery:
    def __init__(self, df, formato, modo, nome, opcoes, gatilho):
        self._sessao, self._plano = df.sparkSession, df._plano
        self._no = _analisar(self._plano, modo)
        self._formato, self._modo, self._nome, self._opcoes, self._gatilho = formato, modo, nome, opcoes, gatilho
        self._id, self._run_id = str(uuid.uuid4()), str(uuid.uuid4())
        self._ativa, self._erro = True, None
        self._intervalo = gatilho[1] if gatilho and gatilho[0] == 'tempo' else 1
        self._colunas = [a.nome for a in self._plano.saida]
        self._tem_marca = any(isinstance(n, MarcaDagua) for n in P.nos(self._plano))
        self._lidos, self._fixos = set(), None
        self._inicio, self._gerados = relogio.agora_local(), 0  # o rate: quando começou e quantas linhas já deu
        self._proximo = 0
        self._lotes, self._progresso, self._memoria = [], [], []
        if gatilho == ('disponivel',) and not isinstance(self._no.fonte, FonteRate):
            self._fixos = set(self._no.fonte.listar())  # o availableNow processa o que existia no start
        self._operador = self._escolher_operador()
        if formato == 'memory':
            self._publicar()

    def _escolher_operador(self):
        from .estado import ComEstado, analisar
        fin, marca = analisar(self._plano, self._modo)
        return _SemEstado(self) if fin is None else ComEstado(self, fin, marca)

    # ---------- a API do Spark ----------
    @property
    def id(self):
        return self._id

    @property
    def runId(self):
        return self._run_id

    @property
    def name(self):
        return self._nome

    @property
    def isActive(self):
        return self._ativa

    @property
    def lastProgress(self):
        return self._progresso[-1] if self._progresso else None

    @property
    def recentProgress(self):
        return list(self._progresso)

    @property
    def status(self):
        return {'message': 'Waiting for data to arrive' if self._ativa else 'Stopped',
                'isDataAvailable': False, 'isTriggerActive': False}

    def processAllAvailable(self):
        self._rodar()
        self._levantar()

    def awaitTermination(self, timeout=None):
        if timeout is None:
            self._rodar()
            self._ativa = False  # o Spark esperaria para sempre: aqui a consulta acaba quando a entrada acaba
            self._levantar()
            return None
        self._rodar(relogio.agora_local() + dt.timedelta(seconds=float(timeout)))
        self._levantar()
        return not self._ativa

    def stop(self):
        self._ativa = False

    def exception(self):
        return self._erro

    def explain(self, extended=False):
        print('== Physical Plan ==\n' + '\n'.join(P.arvore(self._plano)) + '\n')

    # ---------- os micro-lotes ----------
    def _novos(self):
        fonte = self._no.fonte
        return [n for n in fonte.listar() if n not in self._lidos and (self._fixos is None or n in self._fixos)]

    def _tem_entrada(self):
        return isinstance(self._no.fonte, FonteRate) or bool(self._novos())

    def _entrada(self):
        """Os arquivos e as partições do próximo micro-lote (uma partição por arquivo, como o Spark)."""
        fonte = self._no.fonte
        if isinstance(fonte, FonteRate):
            ate = int((relogio.agora_local() - self._inicio).total_seconds() * fonte.por_segundo)
            linhas = fonte.linhas(self._inicio, self._gerados, ate)
            self._gerados = max(self._gerados, ate)
            return [], [linhas]
        nomes = self._novos()
        if fonte.maximo and self._gatilho != ('once',):  # o once lê tudo de uma vez
            nomes = nomes[:fonte.maximo]
        self._lidos.update(nomes)
        return nomes, [fonte.ler(n) for n in nomes]

    def _rodar(self, ate=None):
        """Roda micro-lotes enquanto houver entrada nova, ou um lote sem dados que o estado precise, sem
        passar do momento `ate` do relógio virtual. O rate entrega o tempo de um lote por vez: sem `ate`,
        roda um lote só. O once roda um lote; o once e o availableNow terminam a consulta."""
        if not self._ativa:
            return
        rate = isinstance(self._no.fonte, FonteRate)
        try:
            for _ in range(LIMITE_LOTES):
                if ate is not None and relogio.agora_local() >= ate:
                    break
                if self._gatilho != ('once',) and not self._tem_entrada() and not self._operador.precisa_lote_vazio():
                    break
                self._lote()
                if self._gatilho == ('once',) or (rate and ate is None):
                    break
        except Exception as e:  # noqa: BLE001 — o erro de um lote derruba a consulta, como no Spark
            self._falhar(e)
            return
        if self._gatilho in (('once',), ('disponivel',)):
            self._ativa = False
        elif ate is not None and relogio.agora_local() < ate:
            relogio.avancar((ate - relogio.agora_local()).total_seconds())  # o resto da espera passa sem dados

    def _lote(self):
        numero = self._proximo
        self._proximo += 1
        momento = relogio.agora_local()
        arquivos, particoes = self._entrada()
        entrada = sum(len(p) for p in particoes)
        acao = f'lote {numero} de {self._nome}' if self._nome else f'lote {numero}'
        self._no.lote = particoes or [[]]
        try:
            with relogio.virtual():
                linhas, info = self._operador.lote(acao)
        finally:
            self._no.lote = None
        self._entregar(numero, linhas)
        self._progresso.append(self._progresso_do_lote(numero, momento, entrada, len(linhas), info))
        del self._progresso[:-LIMITE_PROGRESSO]
        if len(self._lotes) < LIMITE_PROGRESSO:
            self._lotes.append({'id': numero, 'entrada': entrada, 'arquivos': arquivos, 'estado': info['estado'] or 0,
                                'marcaDagua': relogio.iso(info['marca']) if info['marca'] else None,
                                'saida': len(linhas), 'descartadas': info['descartadas']})
        relogio.avancar(self._intervalo)

    def _entregar(self, numero, linhas):
        if self._formato == 'console':
            n = int(self._opcoes.get('numRows', 20))
            truncate = self._opcoes.get('truncate', 'true')
            truncate = {'true': True, 'false': False}.get(truncate.lower(), truncate)
            print(f'{_TRACOS}\nBatch: {numero}\n{_TRACOS}')
            print(mostrar.tabela(self._colunas, linhas[:n], n, truncate, len(linhas) > n))
            return
        self._memoria = list(linhas) if self._modo == 'complete' else self._memoria + list(linhas)
        self._publicar()

    def _publicar(self):
        """A tabela temporária da saída memory, com o nome da consulta."""
        from ..catalog import registrar_view
        schema = T.StructType([T.StructField(a.nome, a.tipo, True) for a in self._plano.saida])
        registrar_view(self._sessao, self._nome, self._sessao.createDataFrame(self._memoria, schema))

    def _progresso_do_lote(self, numero, momento, entrada, saida, info):
        fonte = self._no.fonte
        estado = [] if info['operador'] is None else [{
            'operatorName': info['operador'], 'numRowsTotal': info['estado'], 'numRowsUpdated': info['atualizadas'],
            'numRowsRemoved': info['removidas'], 'numRowsDroppedByWatermark': info['descartadas']}]
        return StreamingQueryProgress({
            'id': self._id, 'runId': self._run_id, 'name': self._nome, 'timestamp': relogio.iso(momento),
            'batchId': numero, 'batchDuration': 0, 'numInputRows': entrada, 'inputRowsPerSecond': 0.0,
            'processedRowsPerSecond': 0.0, 'durationMs': {'addBatch': 0, 'triggerExecution': 0},
            'eventTime': {'watermark': relogio.iso(info['marca_usada'] or _EPOCA)} if self._tem_marca else {},
            'stateOperators': estado,
            'sources': [{'description': fonte.descricao, 'numInputRows': entrada}],
            'sink': {'description': 'MemorySink' if self._formato == 'memory' else
                     'org.apache.spark.sql.execution.streaming.ConsoleTable$', 'numOutputRows': saida},
        })

    def _falhar(self, causa):
        self._ativa = False
        self._erro = StreamingQueryException(
            f'Query [id = {self._id}, runId = {self._run_id}] terminated with exception: {causa}', 'STREAM_FAILED', {}, 'XXKST')
        self._erro.__cause__ = causa

    def _levantar(self):
        if self._erro is not None:
            raise self._erro

    # ---------- para o runtime ----------
    def _fim_do_programa(self):
        """O programa acabou com a consulta ativa: roda a entrada disponível (o resultado não depende do tempo real)."""
        if self._ativa:
            self._rodar()
            self._ativa = False
            self._levantar()

    def _resumo(self):
        return {'nome': self._nome, 'modo': self._modo, 'formato': self._formato, 'lotes': list(self._lotes)}


class StreamingQueryManager:
    def __init__(self, sessao):
        self._sessao = sessao

    @property
    def active(self):
        return [q for q in streams.consultas() if q.isActive and q._sessao is self._sessao]

    def get(self, id):  # noqa: A002
        return next((q for q in streams.consultas() if q.id == id), None)

    def awaitAnyTermination(self, timeout=None):
        """Roda a entrada disponível de cada consulta ativa. Sem prazo, as consultas acabam (o Spark
        esperaria para sempre); com prazo, o relógio vai até ele, e a volta diz se alguma terminou."""
        ativas = self.active
        ate = None if timeout is None else relogio.agora_local() + dt.timedelta(seconds=float(timeout))
        for q in ativas:
            q._rodar()
        if ate is None:
            for q in ativas:
                q._ativa = False
        elif relogio.agora_local() < ate:
            relogio.avancar((ate - relogio.agora_local()).total_seconds())
        for q in ativas:
            q._levantar()
        return None if timeout is None else any(not q.isActive for q in ativas)

    def resetTerminated(self):
        pass
