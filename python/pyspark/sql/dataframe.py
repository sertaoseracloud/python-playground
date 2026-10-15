"""DataFrame do pyspark do DivergePython: transformações montam o plano; ações o executam."""
from .. import _motor as m
from ..errors import AnalysisException, PySparkTypeError, PySparkValueError
from ..rdd import _Estreito
from . import mostrar
from . import plano as P
from . import types as T
from .column import Alias, Col, Column, Entrada, Estrela, Lit, Ref, para_expr
from .functions import coalesce


class _FazerRow:
    def __init__(self, nomes):
        self.nomes = nomes

    def __call__(self, linhas):
        return [T._criar_row(self.nomes, linha) for linha in linhas]


class DataFrame:
    def __init__(self, plano, sessao):
        self._plano = plano
        self.sparkSession = sessao

    # ---------- schema ----------
    @property
    def columns(self):
        return [a.nome for a in self._plano.saida]

    @property
    def schema(self):
        return T.StructType([T.StructField(a.nome, a.tipo, a.anulavel) for a in self._plano.saida])

    @property
    def dtypes(self):
        return [(a.nome, a.tipo.simpleString()) for a in self._plano.saida]

    def printSchema(self, level=None):
        print(mostrar.arvore_do_schema(self.schema))

    @property
    def isStreaming(self):
        from .streaming.fonte import FonteStream
        return any(isinstance(n, FonteStream) for n in P.nos(self._plano))

    def withWatermark(self, eventTime, delayThreshold):
        from .functions import duracao_em_micros
        from .streaming.fonte import MarcaDagua
        e = self._entrada()
        atributo = e.atributos[e.achar(eventTime)]
        if not isinstance(atributo.tipo, T.TimestampType):
            raise AnalysisException(f'The event time `{eventTime}` has the invalid type "{atributo.tipo.simpleString().upper()}", '
                                    'but expected "TIMESTAMP".', 'EVENT_TIME_IS_NOT_ON_TIMESTAMP_TYPE', {}, '42K09')
        atraso = duracao_em_micros(delayThreshold)
        if not self.isStreaming:
            return self  # como no Spark: num DataFrame de lote, a marca d'água não faz nada
        return self._novo(MarcaDagua(self._plano, atributo, atraso))

    def __repr__(self):
        return f"DataFrame[{', '.join(f'{n}: {t}' for n, t in self.dtypes)}]"

    def _novo(self, plano):
        return DataFrame(plano, self.sparkSession)

    def _entrada(self):
        return Entrada(self._plano.saida, self._plano.ansi)

    # ---------- colunas ----------
    def __getitem__(self, item):
        if isinstance(item, str):
            if item == '*':
                return Column(Estrela())
            e = self._entrada()
            return Column(Ref(e.atributos[e.achar(item)]))
        if isinstance(item, int):
            return Column(Ref(self._plano.saida[item]))
        if isinstance(item, Column):
            return self.filter(item)
        if isinstance(item, (list, tuple)):
            return self.select(*item)
        raise PySparkTypeError(f'Column, int, list, str or tuple expected, got {type(item).__name__}.', 'NOT_COLUMN_OR_INT_OR_LIST_OR_STR_OR_TUPLE')

    def __getattr__(self, nome):
        if nome.startswith('_'):
            raise AttributeError(nome)
        for a in self._plano.saida:
            if a.nome == nome:
                return Column(Ref(a))
        raise AttributeError(f"'DataFrame' object has no attribute '{nome}'")

    def _exprs(self, cols):
        if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
            cols = cols[0]
        exprs = []
        e = self._entrada()
        for c in cols:
            x = para_expr(c)
            if isinstance(x, Estrela):
                exprs.extend(x.expandir(e))
            else:
                exprs.append(x)
        return exprs

    # ---------- transformações estreitas ----------
    def select(self, *cols):
        return self._novo(self._projetar(self._exprs(cols), 'select'))

    def _projetar(self, exprs, operacao):
        from .avancado import projetar
        return projetar(self._plano, exprs, operacao)

    # ---------- transformações largas ----------
    def groupBy(self, *cols):
        from .group import GroupedData
        return GroupedData(self, self._exprs(cols))

    groupby = groupBy

    def agg(self, *exprs):
        return self.groupBy().agg(*exprs)

    def _ordens(self, cols, ascending):
        from .column import Ordem, como_ordem
        if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
            cols = cols[0]
        ordens = [como_ordem(para_expr(c)) for c in cols]
        if ascending is not None:
            lista = ascending if isinstance(ascending, (list, tuple)) else [ascending] * len(ordens)
            ordens = [Ordem(o.filho, bool(a)) if not isinstance(para_expr(c), Ordem) else o
                      for o, a, c in zip(ordens, lista, cols)]
        return ordens

    def orderBy(self, *cols, ascending=None):
        from .avancado import ordenar
        ordens = self._ordens(cols, ascending)
        return self._novo(self._abaixo_do_select(lambda plano: ordenar(plano, ordens)))

    def _abaixo_do_select(self, montar):
        """orderBy/filter com uma coluna que saiu no select: como o Spark, faz antes do select e repete o select."""
        try:
            return montar(self._plano)
        except AnalysisException as erro:
            plano = self._plano
            if not str(erro.getErrorClass()).startswith('UNRESOLVED_COLUMN') or not isinstance(plano, P.Project):
                raise
            try:
                abaixo = montar(plano.filhos[0])
            except AnalysisException:
                raise erro from None
            return P.Project(abaixo, [Ref(a) if isinstance(x, (Col, Ref)) else x for x, a in zip(plano.exprs, plano.saida)], plano.operacao)

    sort = orderBy

    def sortWithinPartitions(self, *cols, ascending=None):
        from .plano_largo import Sort
        return self._novo(Sort(self._plano, self._ordens(cols, ascending), False))

    def distinct(self):
        from .avancado import agregar
        refs = [Ref(a) for a in self._plano.saida]
        return self._novo(agregar(self._plano, refs, refs, 'distinct'))

    def dropDuplicates(self, subset=None):
        from .agregacoes import Agg
        from .avancado import agregar
        if subset is None:
            return self.distinct()
        if isinstance(subset, str):
            subset = [subset]
        e = self._entrada()
        chaves = [Ref(e.atributos[e.achar(c)]) for c in subset]
        ids = {k.atributo.id for k in chaves}
        saidas = [Ref(a) if a.id in ids else Alias(Agg('first', [Ref(a)]), a.nome) for a in self._plano.saida]
        return self._novo(agregar(self._plano, chaves, saidas, 'dropDuplicates'))

    drop_duplicates = dropDuplicates

    def join(self, other, on=None, how=None):
        from .avancado import juntar
        return self._novo(juntar(self._plano, other._plano, on, how))

    def crossJoin(self, other):
        return self.join(other, how='cross')

    def union(self, other):
        from .avancado import unir
        return self._novo(unir([self._plano, other._plano]))

    unionAll = union

    def unionByName(self, other, allowMissingColumns=False):
        from .avancado import por_nome
        return self._novo(por_nome(self._plano, other._plano, allowMissingColumns))

    def repartition(self, numPartitions=None, *cols):
        from .plano_largo import ChaveLinha, Exchange, _atributo_da_chave
        if isinstance(numPartitions, (str, Column)):
            cols, numPartitions = (numPartitions, *cols), None
        if not cols:
            return self._novo(Exchange(self._plano, 'roundrobin', int(numPartitions), operacao='repartition'))
        n = int(numPartitions) if numPartitions is not None else int(self.sparkSession.conf.get('spark.sql.shuffle.partitions'))
        e = self._entrada()
        exprs = self._exprs(cols)
        for x in exprs:
            x.tipo(e)
        return self._novo(Exchange(self._plano, 'hash', n, chave=ChaveLinha([x.compilar(e) for x in exprs]),
                                   atributos=[_atributo_da_chave(x, e) for x in exprs], motivo='REPARTITION_BY_NUM' if numPartitions else 'REPARTITION_BY_COL',
                                   operacao='repartition'))

    def coalesce(self, numPartitions):
        from .plano_largo import Coalesce
        return self._novo(Coalesce(self._plano, int(numPartitions)))

    # ---------- views e escrita ----------
    def createOrReplaceTempView(self, name):
        from .catalog import registrar_view
        registrar_view(self.sparkSession, name, self)

    def createTempView(self, name):
        from .catalog import registrar_view
        registrar_view(self.sparkSession, name, self, substituir=False)

    createOrReplaceGlobalTempView = createOrReplaceTempView
    registerTempTable = createOrReplaceTempView

    @property
    def write(self):
        from .readwriter import DataFrameWriter
        return DataFrameWriter(self)

    @property
    def writeStream(self):
        raise NotImplementedError('O Structured Streaming chega no módulo 🌊 Spark além do batch.')

    # ---------- cache ----------
    def cache(self):
        return self.persist()

    def persist(self, storageLevel=None):
        from .plano_largo import Guardado, InMemoryTableScan
        if not self.is_cached:
            self._sem_cache = self._plano
            self._plano = InMemoryTableScan(Guardado(self._plano))
        return self

    def unpersist(self, blocking=False):
        if self.is_cached:
            self._plano = self._sem_cache
        return self

    @property
    def is_cached(self):
        from .plano_largo import InMemoryTableScan
        return isinstance(self._plano, InMemoryTableScan)

    @property
    def storageLevel(self):
        from ..storagelevel import StorageLevel
        return StorageLevel(True, True, False, True, 1) if self.is_cached else StorageLevel.NONE

    # ---------- para a correção ----------
    def _plano_resumo(self):
        from .plano_largo import BroadcastHashJoin, Exchange, InMemoryTableScan
        resumo = {'shuffles': 0, 'broadcast': False, 'cache': False}

        def visitar(no):
            for x in P.nos(no):
                if isinstance(x, Exchange):
                    resumo['shuffles'] += 1
                elif isinstance(x, BroadcastHashJoin):
                    resumo['broadcast'] = True
                elif isinstance(x, InMemoryTableScan):
                    resumo['cache'] = True
                    if not x.interno.calculado:
                        visitar(x.interno.plano)
        visitar(self._plano)
        return {**resumo, 'particoes': self._plano.num_particoes(), 'estagios': resumo['shuffles'] + 1}

    def _diverge_tabela(self, limite):
        from diverge_runtime import estagios
        from .plano_largo import Sort
        with estagios.local():
            linhas = self._linhas('tabela')
        topo = self._plano
        while topo.transparente() or isinstance(topo, (P.Project, P.Filter, P.Limit)):
            topo = topo.filhos[0]
        return {
            'colunas': [{'nome': a.nome, 'tipo': a.tipo.simpleString()} for a in self._plano.saida],
            'linhas': [[_para_json(v) for v in linha] for linha in linhas[:limite]],
            'total': len(linhas),
            'ordenado': isinstance(topo, Sort) and topo.global_,
            'plano': self._plano_resumo(),
        }

    def filter(self, condicao):
        if isinstance(condicao, str):
            from .sql import ler_expressao
            condicao = Column(ler_expressao(condicao))
        expr = para_expr(condicao)
        return self._novo(self._abaixo_do_select(lambda plano: P.Filter(plano, expr)))

    where = filter

    def withColumn(self, nome, coluna):
        if not isinstance(coluna, Column):
            raise PySparkTypeError(f"Argument `col` should be a Column, got {type(coluna).__name__}.", 'NOT_COLUMN', {'arg_name': 'col'})
        return self.withColumns({nome: coluna})

    def withColumns(self, *mapa):
        mapa = mapa[0] if mapa else {}
        exprs = [Ref(a) for a in self._plano.saida]
        nomes = [a.nome.lower() for a in self._plano.saida]
        for nome, coluna in mapa.items():
            novo = Alias(coluna._expr, nome)
            if nome.lower() in nomes:
                exprs[nomes.index(nome.lower())] = novo
            else:
                exprs.append(novo)
                nomes.append(nome.lower())
        return self._novo(self._projetar(exprs, 'withColumn'))

    def withColumnRenamed(self, antigo, novo):
        if antigo.lower() not in [n.lower() for n in self.columns]:
            return self
        exprs = [Alias(Ref(a), novo) if a.nome.lower() == antigo.lower() else Ref(a) for a in self._plano.saida]
        return self._novo(P.Project(self._plano, exprs, 'withColumnRenamed'))

    def withColumnsRenamed(self, mapa):
        df = self
        for antigo, novo in mapa.items():
            df = df.withColumnRenamed(antigo, novo)
        return df

    def drop(self, *cols):
        fora = set()
        for c in cols:
            if isinstance(c, Column):
                base = c._expr
                if isinstance(base, Ref):
                    fora.add(base.atributo.id)
                elif isinstance(base, Col):
                    fora.update(a.id for a in self._plano.saida if a.nome.lower() == base.nome_col.lower())
            else:
                fora.update(a.id for a in self._plano.saida if a.nome.lower() == c.lower())
        if not fora:
            return self
        return self._novo(P.Project(self._plano, [Ref(a) for a in self._plano.saida if a.id not in fora], 'drop'))

    def toDF(self, *nomes):
        if len(nomes) != len(self.columns):
            raise PySparkValueError(f'Number of column names ({len(nomes)}) does not match the number of columns ({len(self.columns)}).',
                                    'LENGTH_SHOULD_BE_THE_SAME')
        return self._novo(P.Project(self._plano, [Alias(Ref(a), n) for a, n in zip(self._plano.saida, nomes)], 'toDF'))

    def alias(self, nome):
        return self._novo(P.Apelido(self._plano, nome))

    def limit(self, n):
        return self._novo(P.Limit(self._plano, int(n)))

    def selectExpr(self, *textos):
        from .sql import ler_expressao
        if len(textos) == 1 and isinstance(textos[0], (list, tuple)):
            textos = textos[0]
        return self.select(*[Column(ler_expressao(t)) for t in textos])

    # ---------- execução ----------
    def _particoes(self, acao):
        plano = self._plano
        while plano.transparente():
            plano = plano.filhos[0]
        if isinstance(plano, P.Limit):
            partes = plano.filhos[0].rdd()._executar(acao, P.Limitar(plano.n))
            linhas = [x for p in partes for x in p][:plano.n]
            return [linhas]
        return plano.rdd()._executar(acao)

    def _linhas(self, acao):
        return [x for p in self._particoes(acao) for x in p]

    def collect(self):
        nomes = self.columns
        return [T._criar_row(nomes, linha) for linha in self._linhas('collect')]

    def toLocalIterator(self, prefetchPartitions=False):
        return iter(self.collect())

    def count(self):
        plano = self._plano
        while plano.transparente():
            plano = plano.filhos[0]
        if isinstance(plano, P.Limit):
            return len(self._linhas('count'))
        return sum(plano.rdd()._executar('count', m.contar))

    def take(self, n):
        nomes = self.columns
        return [T._criar_row(nomes, linha) for linha in self.limit(n)._linhas('take')]

    def head(self, n=None):
        if n is None:
            linhas = self.take(1)
            return linhas[0] if linhas else None
        return self.take(n)

    def first(self):
        return self.head()

    def tail(self, n):
        return self.collect()[-n:] if n else []

    def isEmpty(self):
        return not self.take(1)

    def show(self, n=20, truncate=True, vertical=False):
        linhas = self.limit(n + 1)._linhas('show')
        formatar = mostrar.vertical if vertical else mostrar.tabela
        print(formatar(self.columns, linhas[:n], n, truncate, len(linhas) > n))

    def explain(self, extended=None, mode=None):
        # extended/mode mostram o mesmo plano físico (o DivergePython não tem os planos lógicos)
        print('== Physical Plan ==\n' + '\n'.join(self._arvore()) + '\n')

    def _arvore(self):
        linhas = P.arvore(self._plano)
        if self.sparkSession.conf.get('spark.sql.adaptive.enabled', 'true').lower() == 'true':
            return ['AdaptiveSparkPlan isFinalPlan=false'] + ['+- ' + linhas[0]] + ['   ' + x for x in linhas[1:]]
        return linhas

    @property
    def rdd(self):
        return _Estreito(self._plano.rdd(), _FazerRow(self.columns), 'map')

    @property
    def na(self):
        return DataFrameNaFunctions(self)

    def fillna(self, value, subset=None):
        return self.na.fill(value, subset)

    def dropna(self, how='any', thresh=None, subset=None):
        return self.na.drop(how, thresh, subset)

    def toPandas(self):
        raise NotImplementedError(
            'toPandas() não existe no DivergePython: o pandas não é carregado no navegador. '
            'Use df.collect() para ter a lista de Row, ou df.show() para ver a tabela.')

    def toJSON(self, use_unicode=True):
        import json
        nomes = self.columns
        return self.sparkSession.sparkContext.parallelize(
            [json.dumps({k: _json(v) for k, v in zip(nomes, linha) if v is not None}, ensure_ascii=False, separators=(',', ':'))
             for linha in self._linhas('toJSON')])


def _para_json(v):
    """Valor de uma célula para a correção (JSON): datas como no show, Row vira dicionário."""
    import datetime
    import math
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (datetime.date, datetime.datetime)):
        return mostrar.texto_do_valor(v)
    if isinstance(v, T.Row) and hasattr(v, '__fields__'):
        return {k: _para_json(x) for k, x in zip(v.__fields__, v)}
    if isinstance(v, (list, tuple)):
        return [_para_json(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _para_json(x) for k, x in v.items()}
    if isinstance(v, (bytes, bytearray)):
        return mostrar.texto_do_valor(v)
    return v


def _json(v):
    import datetime
    if isinstance(v, (datetime.date, datetime.datetime)):
        return mostrar.texto_do_valor(v)
    if isinstance(v, T.Row):
        return {k: _json(x) for k, x in zip(v.__fields__, v)}
    if isinstance(v, list):
        return [_json(x) for x in v]
    return v


class DataFrameNaFunctions:
    def __init__(self, df):
        self.df = df

    def fill(self, value, subset=None):
        df = self.df
        if isinstance(subset, str):
            subset = [subset]
        if isinstance(value, dict):
            mapa = {k.lower(): v for k, v in value.items()}
        else:
            if not isinstance(value, (int, float, str, bool)):
                raise PySparkTypeError(f'Argument `value` should be a bool, dict, float, int or str, got {type(value).__name__}.',
                                       'NOT_BOOL_OR_DICT_OR_FLOAT_OR_INT_OR_STR')
            alvo = [s.lower() for s in subset] if subset else [a.nome.lower() for a in df._plano.saida]
            mapa = {}
            for a in df._plano.saida:
                if a.nome.lower() not in alvo:
                    continue
                if isinstance(value, bool):
                    combina = isinstance(a.tipo, T.BooleanType)
                elif isinstance(value, (int, float)):
                    combina = isinstance(a.tipo, T.NUMERICOS)
                else:
                    combina = isinstance(a.tipo, T.StringType)
                if combina:
                    mapa[a.nome.lower()] = value
        exprs = []
        for a in df._plano.saida:
            if a.nome.lower() in mapa:
                v = mapa[a.nome.lower()]
                if isinstance(a.tipo, (T.IntegerType, T.LongType)) and isinstance(v, float):
                    v = int(v)
                elif isinstance(a.tipo, (T.DoubleType, T.FloatType)) and isinstance(v, int) and not isinstance(v, bool):
                    v = float(v)
                exprs.append(Alias(coalesce(Column(Ref(a)), Column(Lit(v)))._expr, a.nome))
            else:
                exprs.append(Ref(a))
        return df._novo(P.Project(df._plano, exprs, 'na.fill'))

    def drop(self, how='any', thresh=None, subset=None):
        df = self.df
        if isinstance(subset, str):
            subset = [subset]
        atributos = [a for a in df._plano.saida if not subset or a.nome.lower() in [s.lower() for s in subset]]
        if thresh is None:
            thresh = len(atributos) if how == 'any' else 1
        indices = [df._plano.saida.index(a) for a in atributos]
        return df._novo(_FiltroDeNulos(df._plano, indices, thresh))

    def replace(self, to_replace, value=None, subset=None):
        df = self.df
        mapa = to_replace if isinstance(to_replace, dict) else (
            dict(zip(to_replace, value if isinstance(value, (list, tuple)) else [value] * len(to_replace)))
            if isinstance(to_replace, (list, tuple)) else {to_replace: value})
        exprs = []
        from .functions import when
        for a in df._plano.saida:
            if subset and a.nome not in subset:
                exprs.append(Ref(a))
                continue
            coluna = Column(Ref(a))
            novo = None
            for de, para in mapa.items():
                if isinstance(de, str) != isinstance(a.tipo, T.StringType):
                    continue
                novo = when(coluna == de, para) if novo is None else novo.when(coluna == de, para)
            exprs.append(Alias(novo.otherwise(coluna)._expr, a.nome) if novo is not None else Ref(a))
        return df._novo(P.Project(df._plano, exprs, 'na.replace'))


class _ContarNaoNulos:
    def __init__(self, indices, minimo):
        self.indices, self.minimo = indices, minimo

    def __call__(self, linhas):
        return [linha for linha in linhas if sum(linha[i] is not None for i in self.indices) >= self.minimo]


class _FiltroDeNulos(P.Filter):
    def __init__(self, filho, indices, minimo):
        P.No.__init__(self, filho.sessao)
        self.filhos = (filho,)
        self.saida = filho.saida
        self.indices, self.minimo = indices, minimo

    def linha(self, raiz=False):
        return f'Filter atleastnnonnulls({self.minimo}, {", ".join(self.saida[i].ref() for i in self.indices)})'

    def rdd(self):
        return _Estreito(self.filhos[0].rdd(), _ContarNaoNulos(self.indices, self.minimo), 'na.drop')

