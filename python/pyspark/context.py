"""SparkContext e SparkConf do pyspark do DivergePython (um contexto por execução)."""
import os

from . import _motor as m
from .errors import caminho_nao_existe
from .rdd import _Fonte

PADROES = {
    'spark.master': 'local[4]',
    'spark.app.name': 'DivergePython',
    'spark.default.parallelism': '4',
    'spark.sql.shuffle.partitions': '4',
    'spark.sql.autoBroadcastJoinThreshold': '10485760',
    'spark.sql.adaptive.enabled': 'true',
    'spark.sql.ansi.enabled': 'true',
    'spark.sql.session.timeZone': 'UTC',
}


class SparkConf:
    def __init__(self, loadDefaults=True):
        self._valores = {}

    def set(self, chave, valor):
        self._valores[chave] = str(valor)
        return self

    def setAppName(self, nome):
        return self.set('spark.app.name', nome)

    def setMaster(self, master):
        return self.set('spark.master', master)

    def get(self, chave, padrao=None):
        return self._valores.get(chave, padrao)

    def getAll(self):
        return list(self._valores.items())

    def contains(self, chave):
        return chave in self._valores


class SparkContext:
    _ativo = None

    def __init__(self, master=None, appName=None, conf=None, **_):
        if SparkContext._ativo is not None:
            ativo = SparkContext._ativo
            raise ValueError(f'Cannot run multiple SparkContexts at once; existing SparkContext(app={ativo.appName}, master={ativo.master})')
        self._conf = dict(PADROES)
        if conf is not None:
            self._conf.update(conf.getAll())
        if master:
            self._conf['spark.master'] = master
        if appName:
            self._conf['spark.app.name'] = appName
        SparkContext._ativo = self

    @classmethod
    def getOrCreate(cls, conf=None):
        return cls._ativo or cls(conf=conf)

    @property
    def master(self):
        return self._conf['spark.master']

    @property
    def appName(self):
        return self._conf['spark.app.name']

    @property
    def version(self):
        return '4.0.1'

    @property
    def defaultParallelism(self):
        return int(self._conf.get('spark.default.parallelism', 4))

    @property
    def defaultMinPartitions(self):
        return min(self.defaultParallelism, 2)

    def getConf(self):
        conf = SparkConf()
        for k, v in self._conf.items():
            conf.set(k, v)
        return conf

    def setLogLevel(self, nivel):
        pass

    def stop(self):
        pass

    def parallelize(self, c, numSlices=None):
        n = int(numSlices) if numSlices is not None else self.defaultParallelism
        return _Fonte(self, 'parallelize', particoes=m.fatiar(c, n))

    def range(self, start, end=None, step=1, numSlices=None):
        if end is None:
            start, end = 0, start
        return self.parallelize(range(start, end, step), numSlices)

    def emptyRDD(self):
        return _Fonte(self, 'emptyRDD', particoes=[])

    def textFile(self, name, minPartitions=None, use_unicode=True):
        """Preguiçoso como no Spark: o arquivo só é lido (e o erro de caminho só aparece) na ação."""
        n = int(minPartitions) if minPartitions is not None else self.defaultMinPartitions
        caminho = os.path.abspath(name)
        arquivos = _arquivos(caminho)
        return _Fonte(self, 'textFile', carregar=_LerLinhas(caminho, n), n=max(1, len(arquivos)) * n)

    def wholeTextFiles(self, path, minPartitions=None, use_unicode=True):
        """Pares (caminho, conteúdo), um por arquivo da pasta. O caminho vem como no Spark: file:/... ."""
        caminho = os.path.abspath(path)
        return _Fonte(self, 'wholeTextFiles', carregar=_LerInteiros(caminho), n=max(1, len(_arquivos(caminho))))

    def union(self, rdds):
        resultado = rdds[0]
        for r in rdds[1:]:
            resultado = resultado.union(r)
        return resultado


def _arquivos(caminho):
    if os.path.isdir(caminho):
        return [os.path.join(caminho, n) for n in sorted(os.listdir(caminho)) if not n.startswith(('_', '.'))]
    return [caminho] if os.path.exists(caminho) else []


class _LerLinhas:
    """Lê no processo principal (os workers não têm a pasta do aluno)."""

    def __init__(self, caminho, n):
        self.caminho, self.n = caminho, n

    def __call__(self):
        if not os.path.exists(self.caminho):
            raise caminho_nao_existe(self.caminho)
        particoes = []
        for arquivo in _arquivos(self.caminho):
            with open(arquivo, 'rb') as f:
                particoes.extend(faixas_de_linhas(f.read(), self.n))
        return particoes


class _LerInteiros:
    """Lê no processo principal: cada arquivo inteiro numa partição, com o caminho como no Spark."""

    def __init__(self, caminho):
        self.caminho = caminho

    def __call__(self):
        if not os.path.exists(self.caminho):
            raise caminho_nao_existe(self.caminho)
        particoes = []
        for arquivo in _arquivos(self.caminho):
            with open(arquivo, encoding='utf-8', newline='') as f:
                particoes.append([('file:' + arquivo.replace('\\', '/'), f.read())])
        return particoes


def faixas_de_linhas(dados, n):
    """Como o Hadoop: divide os bytes em faixas de total // n (a última pode ficar até 10% maior);
    cada linha fica na faixa em que começa (a que começa exatamente no fim de uma faixa, nela)."""
    total = len(dados)
    tamanho = max(1, total // n)
    limites, inicio = [], 0
    while (total - inicio) / tamanho > 1.1:
        limites.append((inicio, inicio + tamanho))
        inicio += tamanho
    limites.append((inicio, total))
    partes = [[] for _ in limites]
    posicao = 0
    for linha in dados.split(b'\n'):
        if posicao >= total:
            break
        i = 0 if posicao == 0 else next(k for k, (a, b) in enumerate(limites) if a < posicao <= b)
        partes[i].append(linha.rstrip(b'\r').decode('utf-8', errors='replace'))
        posicao += len(linha) + 1
    return partes
