"""Motor de execução do pyspark do DivergePython.

Uma ação vira um job; o job roda estágios; cada estágio tem uma tarefa por partição. Uma
tarefa é `(dados, funcoes, nomes)`: os dados da partição e a cadeia de funções estreitas
(cada uma recebe e devolve uma lista). As tarefas vão para os workers do pool pela ponte de
diverge_runtime.pool (ou rodam aqui mesmo, sem pool), e cada uma é registrada com o worker
e os tempos em diverge_runtime.estagios.

As funções da cadeia são instâncias das classes deste módulo (o cloudpickle as manda por
referência, e o worker tem o pacote) com as funções do aluno dentro (que vão por valor)."""
import bisect
import datetime
import zlib

from diverge_runtime import estagios, pool

_MASCARA = (1 << 64) - 1


def hash_estavel(valor):
    """Hash que não muda de uma execução para outra (o hash() do Python muda para textos)."""
    if valor is None:
        return 0
    if isinstance(valor, bool):
        return int(valor)
    if isinstance(valor, int):
        return valor & _MASCARA
    if isinstance(valor, float):
        return int(valor) if valor.is_integer() else zlib.crc32(repr(valor).encode())
    if isinstance(valor, str):
        return zlib.crc32(valor.encode('utf-8'))
    if isinstance(valor, bytes):
        return zlib.crc32(valor)
    if isinstance(valor, (tuple, list)):
        h = 7
        for item in valor:
            h = (h * 31 + hash_estavel(item)) & _MASCARA
        return h
    if isinstance(valor, (datetime.date, datetime.datetime)):
        return zlib.crc32(valor.isoformat().encode())
    return zlib.crc32(repr(valor).encode())


def fatiar_range(r, n):
    """sc.parallelize(range(...)): a partição i começa em r[0] + int(i * len / n) * passo."""
    tamanho = len(r)
    if not tamanho:
        return [[] for _ in range(n)]

    def inicio(i):
        return r.start + int(i * tamanho / n) * r.step
    return [list(range(inicio(i), inicio(i + 1), r.step)) for i in range(n)]


def fatiar_lista(itens, n):
    """Listas vão em lotes de max(1, min(len // n, 1024)) itens, e os lotes são divididos
    como no ParallelCollectionRDD do Scala: lotes [i * L // n, (i + 1) * L // n)."""
    lote = max(1, min(len(itens) // n, 1024))
    lotes = [itens[i:i + lote] for i in range(0, len(itens), lote)]
    total = len(lotes)
    return [[x for b in lotes[i * total // n:(i + 1) * total // n] for x in b] for i in range(n)]


def fatiar(dados, n):
    return fatiar_range(dados, n) if isinstance(dados, range) else fatiar_lista(list(dados), n)


# ---------- funções da cadeia (rodam nos workers) ----------

def _rodar_cadeia(funcoes, dados, final=None):
    """Roda a cadeia de uma tarefa: (resultado, linhas que chegaram ao fim da cadeia)."""
    for funcao in funcoes:
        dados = funcao(dados)
    return (final(dados) if final else dados), len(dados)


class Mapear:
    def __init__(self, f):
        self.f = f

    def __call__(self, dados):
        return [self.f(x) for x in dados]


class Achatar:
    def __init__(self, f):
        self.f = f

    def __call__(self, dados):
        return [y for x in dados for y in self.f(x)]


class Filtrar:
    def __init__(self, f):
        self.f = f

    def __call__(self, dados):
        return [x for x in dados if self.f(x)]


class PorParticao:
    """mapPartitions: a função do aluno recebe um iterador e devolve um iterável."""

    def __init__(self, f, indice=None):
        self.f, self.indice = f, indice

    def __call__(self, dados):
        saida = self.f(iter(dados)) if self.indice is None else self.f(self.indice, iter(dados))
        return list(saida) if saida is not None else []


class Agrupar:
    def __call__(self, dados):
        return [dados]


class RodarGrupo:
    """coalesce: uma tarefa roda as cadeias de várias partições do pai e junta tudo."""

    def __call__(self, grupo):
        saida = []
        for dados, funcoes in grupo:
            saida.extend(_rodar_cadeia(funcoes, dados)[0])
        return saida


def chave_do_par(par):
    return par[0]


class Particionar:
    """Lado do map de um shuffle: n baldes pelo hash da chave (combinando antes, se der)."""

    def __init__(self, n, chave=chave_do_par, combinar=None):
        self.n, self.chave, self.combinar = n, chave, combinar

    def __call__(self, dados):
        if self.combinar is not None:
            acumulado = {}
            for k, v in dados:
                acumulado[k] = self.combinar(acumulado[k], v) if k in acumulado else v
            dados = list(acumulado.items())
        baldes = [[] for _ in range(self.n)]
        for item in dados:
            baldes[hash_estavel(self.chave(item)) % self.n].append(item)
        return baldes


class ParticionarCircular:
    """repartition: distribui em rodízio."""

    def __init__(self, n):
        self.n = n

    def __call__(self, dados):
        baldes = [[] for _ in range(self.n)]
        for i, item in enumerate(dados):
            baldes[i % self.n].append(item)
        return baldes


class ParticionarIntervalo:
    """sortBy: o balde sai da faixa da chave (limites já ordenados)."""

    def __init__(self, limites, chave, crescente):
        self.limites, self.chave, self.crescente = limites, chave, crescente

    def __call__(self, dados):
        n = len(self.limites) + 1
        baldes = [[] for _ in range(n)]
        for item in dados:
            i = bisect.bisect_right(self.limites, self.chave(item))
            baldes[i if self.crescente else n - 1 - i].append(item)
        return baldes


class ExtrairChaves:
    def __init__(self, chave):
        self.chave = chave

    def __call__(self, dados):
        return [self.chave(x) for x in dados]


class OrdenarParticao:
    def __init__(self, chave, crescente):
        self.chave, self.crescente = chave, crescente

    def __call__(self, dados):
        return sorted(dados, key=self.chave, reverse=not self.crescente)


class CombinarPorChave:
    """Lado do reduce do reduceByKey: junta os valores de cada chave na ordem de chegada."""

    def __init__(self, f):
        self.f = f

    def __call__(self, dados):
        acumulado = {}
        for k, v in dados:
            acumulado[k] = self.f(acumulado[k], v) if k in acumulado else v
        return list(acumulado.items())


class ResultIterable:
    """Os valores de uma chave no groupByKey (como o pyspark.resultiterable)."""

    def __init__(self, data):
        self.data = data
        self.maxindex = len(data)

    def __iter__(self):
        return iter(self.data)

    def __len__(self):
        return len(self.data)

    def __repr__(self):
        return f'<pyspark.resultiterable.ResultIterable object at {id(self):#x}>'


class AgruparPorChave:
    def __call__(self, dados):
        grupos = {}
        for k, v in dados:
            grupos.setdefault(k, []).append(v)
        return [(k, ResultIterable(vs)) for k, vs in grupos.items()]


class Juntar:
    """Lado do reduce de um join entre dois RDDs de pares (recebe os dois baldes)."""

    def __init__(self, como):
        self.como = como

    def __call__(self, lados):
        esquerda, direita = lados
        porchave = {}
        for k, w in direita:
            porchave.setdefault(k, []).append(w)
        saida = []
        vistas = set()
        for k, v in esquerda:
            if k in porchave:
                vistas.add(k)
                saida.extend((k, (v, w)) for w in porchave[k])
            elif self.como in ('left', 'full'):
                saida.append((k, (v, None)))
        if self.como in ('right', 'full'):
            for k, w in direita:
                if k not in vistas:
                    saida.append((k, (None, w)))
        return saida


class ContarValores:
    def __call__(self, dados):
        contagem = {}
        for x in dados:
            contagem[x] = contagem.get(x, 0) + 1
        return contagem


class Reduzir:
    def __init__(self, f):
        self.f = f

    def __call__(self, dados):
        if not dados:
            return []
        valor = dados[0]
        for x in dados[1:]:
            valor = self.f(valor, x)
        return [valor]


class Aplicar:
    """foreach / foreachPartition: roda a função do aluno e não devolve nada."""

    def __init__(self, f, particao=False):
        self.f, self.particao = f, particao

    def __call__(self, dados):
        if self.particao:
            self.f(iter(dados))
        else:
            for x in dados:
                self.f(x)
        return []


def contar(dados):
    return len(dados)


# ---------- estágios ----------

def _nome_do_estagio(nomes):
    passos = []
    for nome in nomes:
        if not passos or passos[-1] != nome:
            passos.append(nome)
    return ' → '.join(passos)


def rodar_estagio(job, tarefas, tipo, final=None):
    """Roda um estágio (uma tarefa por partição) e devolve o resultado de cada tarefa.

    `tipo` é 'shuffle' (a tarefa devolve os baldes) ou 'resultado'. O primeiro erro de
    tarefa sobe com a exceção original, depois de todas terminarem."""
    if estagios.em_local():
        return [_rodar_cadeia(funcoes, dados, final)[0] for dados, funcoes, _ in tarefas]
    estagio = estagios.novo_estagio(job, _nome_do_estagio(tarefas[0][2]) if tarefas else '(sem partições)', tipo)
    promessas = [pool.submeter(_rodar_cadeia, (funcoes, dados, final)) for dados, funcoes, _ in tarefas]
    resultados, erro = [], None
    for particao, promessa in enumerate(promessas):
        situacao, valor, info = pool.esperar_tarefa(promessa)
        if situacao == 'erro':
            erro = erro or valor
            continue
        resultado, linhas = valor
        estagios.registrar_tarefa(estagio, particao, linhas, info)
        if tipo == 'shuffle':
            estagio['linhas_embaralhadas'] += sum(len(b) for b in resultado)
        resultados.append(resultado)
    if erro is not None:
        raise erro
    return resultados


def novo_job(acao):
    return estagios.novo_job(acao)
