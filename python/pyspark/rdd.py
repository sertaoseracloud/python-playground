"""RDD do pyspark do DivergePython: a linhagem (de onde vem cada partição) e as ações.

Cada RDD sabe dizer `_tarefas(job)`: a lista de tarefas `(dados, funcoes, nomes)` que
calculam as suas partições. Transformações estreitas só acrescentam uma função à cadeia;
as largas (reduceByKey, groupByKey, sortBy, join, distinct, repartition) rodam, no mesmo
job, o estágio de shuffle dos pais e começam a cadeia de novo a partir dos baldes."""
from . import _motor as m
from .storagelevel import StorageLevel


class RDD:
    def __init__(self, ctx, nome):
        self.ctx = ctx
        self._nome = nome
        self.is_cached = False
        self._nivel = StorageLevel.MEMORY_ONLY
        self._guardado = None  # partições calculadas, quando em cache

    # ---------- linhagem ----------
    def getNumPartitions(self):
        return self._num()

    def _num(self):
        raise NotImplementedError

    def _tarefas_sem_cache(self, job):
        raise NotImplementedError

    def _tarefas(self, job):
        if self.is_cached:
            if self._guardado is None:
                self._guardado = m.rodar_estagio(job, self._tarefas_sem_cache(job), 'resultado')
            return [(p, (), ('cache',)) for p in self._guardado]
        return self._tarefas_sem_cache(job)

    def _executar(self, acao, final=None):
        """Roda a ação: o resultado de cada partição (com `final` aplicado)."""
        job = m.novo_job(acao)
        if self.is_cached and self._guardado is None:
            self._guardado = m.rodar_estagio(job, self._tarefas_sem_cache(job), 'resultado')
            return [final(p) if final else p for p in self._guardado]
        return m.rodar_estagio(job, self._tarefas(job), 'resultado', final)

    @property
    def context(self):
        return self.ctx

    def _padrao(self, n):
        return int(n) if n is not None else self.ctx.defaultParallelism

    # ---------- transformações estreitas ----------
    def map(self, f, preservesPartitioning=False):
        return _Estreito(self, m.Mapear(f), 'map')

    def flatMap(self, f, preservesPartitioning=False):
        return _Estreito(self, m.Achatar(f), 'flatMap')

    def filter(self, f):
        return _Estreito(self, m.Filtrar(f), 'filter')

    def mapPartitions(self, f, preservesPartitioning=False):
        return _Estreito(self, m.PorParticao(f), 'mapPartitions')

    def mapPartitionsWithIndex(self, f, preservesPartitioning=False):
        return _Estreito(self, None, 'mapPartitionsWithIndex', com_indice=f)

    def glom(self):
        return _Estreito(self, m.Agrupar(), 'glom')

    def mapValues(self, f):
        return _Estreito(self, m.Mapear(_ValoresDe(f)), 'mapValues')

    def flatMapValues(self, f):
        return _Estreito(self, m.Achatar(_ValoresAchatados(f)), 'flatMapValues')

    def keys(self):
        return _Estreito(self, m.Mapear(m.chave_do_par), 'keys')

    def values(self):
        return _Estreito(self, m.Mapear(_valor_do_par), 'values')

    def union(self, outro):
        return _Uniao([self, outro])

    def coalesce(self, numPartitions, shuffle=False):
        if shuffle:
            return self.repartition(numPartitions)
        return _Coalesce(self, int(numPartitions))

    def zipWithIndex(self):
        # O índice depende do tamanho das partições anteriores: calcula as contagens antes.
        contagens = self._executar('zipWithIndex', m.contar)
        inicios = [sum(contagens[:i]) for i in range(len(contagens))]
        return _Estreito(self, None, 'zipWithIndex', com_indice=_ComIndiceGlobal(inicios))

    # ---------- transformações largas ----------
    def reduceByKey(self, func, numPartitions=None, partitionFunc=None):
        n = self._padrao(numPartitions)
        return _Largo([self], n, [m.Particionar(n, combinar=func)], m.CombinarPorChave(func), 'reduceByKey')

    def groupByKey(self, numPartitions=None, partitionFunc=None):
        n = self._padrao(numPartitions)
        return _Largo([self], n, [m.Particionar(n)], m.AgruparPorChave(), 'groupByKey')

    def partitionBy(self, numPartitions, partitionFunc=None):
        n = int(numPartitions)
        return _Largo([self], n, [m.Particionar(n)], None, 'partitionBy')

    def repartition(self, numPartitions):
        n = int(numPartitions)
        return _Largo([self], n, [m.ParticionarCircular(n)], None, 'repartition')

    def distinct(self, numPartitions=None):
        n = self._padrao(numPartitions)
        pares = _Estreito(self, m.Mapear(_par_com_nada), 'distinct')
        return _Estreito(_Largo([pares], n, [m.Particionar(n, combinar=_primeiro)], m.CombinarPorChave(_primeiro), 'distinct'),
                         m.Mapear(m.chave_do_par), 'distinct')

    def sortBy(self, keyfunc, ascending=True, numPartitions=None):
        return _Ordenado(self, keyfunc, ascending, self._padrao(numPartitions), 'sortBy')

    def sortByKey(self, ascending=True, numPartitions=None, keyfunc=None):
        chave = _ChaveDoPar(keyfunc) if keyfunc else m.chave_do_par
        return _Ordenado(self, chave, ascending, self._padrao(numPartitions), 'sortByKey')

    def join(self, outro, numPartitions=None):
        return self._juntar(outro, 'inner', numPartitions)

    def leftOuterJoin(self, outro, numPartitions=None):
        return self._juntar(outro, 'left', numPartitions)

    def rightOuterJoin(self, outro, numPartitions=None):
        return self._juntar(outro, 'right', numPartitions)

    def fullOuterJoin(self, outro, numPartitions=None):
        return self._juntar(outro, 'full', numPartitions)

    def _juntar(self, outro, como, n):
        n = self._padrao(n)
        return _Largo([self, outro], n, [m.Particionar(n), m.Particionar(n)], m.Juntar(como), 'join')

    # ---------- cache ----------
    def cache(self):
        return self.persist(StorageLevel.MEMORY_ONLY)

    def persist(self, storageLevel=None):
        self.is_cached = True
        self._nivel = storageLevel or StorageLevel.MEMORY_ONLY
        return self

    def unpersist(self, blocking=False):
        self.is_cached = False
        self._guardado = None
        return self

    def getStorageLevel(self):
        return self._nivel if self.is_cached else StorageLevel.NONE

    # ---------- ações ----------
    def collect(self):
        return [x for parte in self._executar('collect') for x in parte]

    def count(self):
        return sum(self._executar('count', m.contar))

    def reduce(self, f):
        parciais = [x for p in self._executar('reduce', m.Reduzir(f)) for x in p]
        if not parciais:
            raise ValueError('Can not reduce() empty RDD')
        valor = parciais[0]
        for x in parciais[1:]:
            valor = f(valor, x)
        return valor

    def fold(self, zeroValue, op):
        valor = zeroValue
        for p in self._executar('fold'):
            for x in p:
                valor = op(valor, x)
        return valor

    def sum(self):
        return sum(x for p in self._executar('sum') for x in p)

    def max(self, key=None):
        return max(self.collect(), key=key)

    def min(self, key=None):
        return min(self.collect(), key=key)

    def mean(self):
        itens = self.collect()
        return sum(itens) / len(itens) if itens else float('nan')

    def take(self, num):
        saida = []
        for parte in self._executar('take'):
            saida.extend(parte[:num - len(saida)])
            if len(saida) >= num:
                break
        return saida

    def first(self):
        primeiros = self.take(1)
        if not primeiros:
            raise ValueError('RDD is empty')
        return primeiros[0]

    def isEmpty(self):
        return self.count() == 0

    def countByValue(self):
        total = {}
        for parcial in self._executar('countByValue', m.ContarValores()):
            for chave, n in parcial.items():
                total[chave] = total.get(chave, 0) + n
        return total

    def countByKey(self):
        return self.keys().countByValue()

    def collectAsMap(self):
        return dict(self.collect())

    def foreach(self, f):
        self._executar('foreach', m.Aplicar(f))

    def foreachPartition(self, f):
        self._executar('foreachPartition', m.Aplicar(f, particao=True))

    def toDF(self, schema=None, sampleRatio=None):
        from .sql.session import SparkSession
        return SparkSession.builder.getOrCreate().createDataFrame(self, schema)

    def toDebugString(self):
        linhas, rdd, nivel = [], self, 0
        while rdd is not None:
            linhas.append(f"{'  ' * nivel}({rdd.getNumPartitions()}) {rdd._nome}")
            rdd = rdd._pais()[0] if rdd._pais() else None
            nivel += 1
        return '\n'.join(linhas).encode()

    def _pais(self):
        return []

    def __repr__(self):
        return f'{self._nome} RDD'


class _Fonte(RDD):
    """parallelize, textFile, range: partições vindas do processo principal."""

    def __init__(self, ctx, nome, particoes=None, carregar=None, n=None):
        super().__init__(ctx, nome)
        self._particoes = particoes
        self._carregar = carregar
        self._n = n if particoes is None else len(particoes)

    def _num(self):
        return self._n

    def _tarefas_sem_cache(self, job):
        particoes = self._particoes if self._particoes is not None else self._carregar()
        return [(p, (), (self._nome,)) for p in particoes]


class _Estreito(RDD):
    def __init__(self, pai, funcao, nome, com_indice=None):
        super().__init__(pai.ctx, nome)
        self.pai, self.funcao, self.com_indice = pai, funcao, com_indice

    def _pais(self):
        return [self.pai]

    def _num(self):
        return self.pai._num()

    def _tarefas_sem_cache(self, job):
        tarefas = self.pai._tarefas(job)
        saida = []
        for i, (dados, funcoes, nomes) in enumerate(tarefas):
            funcao = self.funcao if self.com_indice is None else m.PorParticao(self.com_indice, indice=i)
            saida.append((dados, funcoes + (funcao,), nomes + (self._nome,)))
        return saida


class _Uniao(RDD):
    def __init__(self, pais):
        super().__init__(pais[0].ctx, 'union')
        self.pais_ = pais

    def _pais(self):
        return self.pais_

    def _num(self):
        return sum(p._num() for p in self.pais_)

    def _tarefas_sem_cache(self, job):
        return [(d, fs, ns + ('union',)) for p in self.pais_ for d, fs, ns in p._tarefas(job)]


class _Coalesce(RDD):
    def __init__(self, pai, n):
        super().__init__(pai.ctx, 'coalesce')
        self.pai, self.n = pai, n

    def _pais(self):
        return [self.pai]

    def _num(self):
        return min(self.n, self.pai._num())

    def _tarefas_sem_cache(self, job):
        tarefas = self.pai._tarefas(job)
        n = min(self.n, len(tarefas))
        grupos = [tarefas[i * len(tarefas) // n:(i + 1) * len(tarefas) // n] for i in range(n)]
        return [([(d, fs) for d, fs, _ in g], (m.RodarGrupo(),), (g[0][2] if g else ()) + ('coalesce',)) for g in grupos]


class _Largo(RDD):
    """Transformação larga: o shuffle dos pais roda agora, e as partições novas saem dos baldes."""

    def __init__(self, pais, n, particionadores, depois, nome):
        super().__init__(pais[0].ctx, nome)
        self.pais_, self.n, self.particionadores, self.depois = pais, n, particionadores, depois

    def _pais(self):
        return self.pais_

    def _num(self):
        return self.n

    def _baldes(self, job):
        """Para cada pai, as n partições novas (junta o balde j de cada tarefa, na ordem)."""
        por_pai = []
        for pai, particionar in zip(self.pais_, self.particionadores):
            tarefas = [(d, fs, ns + (self._nome,)) for d, fs, ns in pai._tarefas(job)]
            baldes = m.rodar_estagio(job, tarefas, 'shuffle', particionar)
            por_pai.append([[x for b in baldes for x in b[j]] for j in range(self.n)])
        return por_pai

    def _tarefas_sem_cache(self, job):
        por_pai = self._baldes(job)
        entradas = por_pai[0] if len(por_pai) == 1 else [tuple(p[j] for p in por_pai) for j in range(self.n)]
        funcoes = (self.depois,) if self.depois is not None else ()
        return [(e, funcoes, (self._nome,)) for e in entradas]


class _Ordenado(RDD):
    """sortBy: um job de amostra acha os limites, o shuffle separa por faixa e cada partição se ordena."""

    def __init__(self, pai, chave, crescente, n, nome):
        super().__init__(pai.ctx, nome)
        self.pai, self.chave, self.crescente, self.n = pai, chave, crescente, n

    def _pais(self):
        return [self.pai]

    def _num(self):
        return self.n

    def _tarefas_sem_cache(self, job):
        amostra = m.novo_job(f'{self._nome} (amostra)')
        tarefas_amostra = [(d, fs, ns + (self._nome,)) for d, fs, ns in self.pai._tarefas(amostra)]
        chaves = sorted(k for p in m.rodar_estagio(amostra, tarefas_amostra, 'resultado', m.ExtrairChaves(self.chave)) for k in p)
        limites = [chaves[i * len(chaves) // self.n] for i in range(1, self.n)] if chaves else []
        tarefas = [(d, fs, ns + (self._nome,)) for d, fs, ns in self.pai._tarefas(job)]
        baldes = m.rodar_estagio(job, tarefas, 'shuffle', m.ParticionarIntervalo(limites, self.chave, self.crescente))
        partes = len(limites) + 1
        entradas = [[x for b in baldes for x in b[j]] for j in range(partes)]
        entradas += [[] for _ in range(self.n - partes)]
        return [(e, (m.OrdenarParticao(self.chave, self.crescente),), (self._nome,)) for e in entradas]


class _ValoresDe:
    def __init__(self, f):
        self.f = f

    def __call__(self, par):
        return (par[0], self.f(par[1]))


class _ValoresAchatados:
    def __init__(self, f):
        self.f = f

    def __call__(self, par):
        return [(par[0], v) for v in self.f(par[1])]


class _ChaveDoPar:
    def __init__(self, f):
        self.f = f

    def __call__(self, par):
        return self.f(par[0])


class _ComIndiceGlobal:
    def __init__(self, inicios):
        self.inicios = inicios

    def __call__(self, indice, iterador):
        return [(x, self.inicios[indice] + i) for i, x in enumerate(iterador)]


def _valor_do_par(par):
    return par[1]


def _par_com_nada(x):
    return (x, None)


def _primeiro(a, b):
    return a
