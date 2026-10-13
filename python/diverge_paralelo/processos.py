"""Pool, Process e Queue (multiprocessing) sobre o pool de workers."""
import itertools
import traceback
import types
from collections import deque

from diverge_runtime import pool, tarefa

from .guarda import exigir_main

_contador_filas = itertools.count(1)
_contador_processos = itertools.count(1)
FILAS = {}         # id -> Queue do processo principal
PENDENTES = []     # processos iniciados e ainda não esperados
MENSAGEM_FILA_VAZIA = (
    'a fila está vazia e nenhum processo vai colocar nada nela. '
    'No Python de verdade, o programa ficaria parado para sempre aqui.'
)


def zerar():
    FILAS.clear()
    PENDENTES.clear()


def _receber_filas(filas):
    for fila, itens in filas.items():
        if fila in FILAS:
            FILAS[fila]._itens.extend(itens)


pool.AO_RECEBER_FILAS = _receber_filas


def _valor(resposta):
    situacao, valor = resposta
    if situacao == 'erro':
        raise valor
    return valor


def _aplicar_lote(funcao, lote):
    return [funcao(item) for item in lote]


def _aplicar_lote_estrela(funcao, lote):
    return [funcao(*args) for args in lote]


def cpu_count():
    return pool.nucleos()


class Queue:
    def __init__(self, maxsize=0):
        self._id = next(_contador_filas)
        self._itens = deque()
        self._copia = False
        FILAS[self._id] = self

    def __getstate__(self):
        return {'_id': self._id}

    def __setstate__(self, estado):
        # Cópia que viaja para o worker: o que for posto nela volta junto com a resposta.
        self._id = estado['_id']
        self._itens = deque()
        self._copia = True

    def put(self, item, block=True, timeout=None):
        if self._copia:
            tarefa.FILAS_DA_TAREFA.setdefault(self._id, []).append(item)
        else:
            self._itens.append(item)

    def get(self, block=True, timeout=None):
        while not self._itens:
            if not PENDENTES:
                raise RuntimeError(MENSAGEM_FILA_VAZIA)
            PENDENTES[0].join()
        return self._itens.popleft()

    def empty(self):
        return not self._itens

    def qsize(self):
        return len(self._itens)


class Process:
    def __init__(self, group=None, target=None, name=None, args=(), kwargs=None):
        self._target, self._args, self._kwargs = target, tuple(args), kwargs or {}
        self.name = name or f'Process-{next(_contador_processos)}'
        self.exitcode = None
        self._promessa = None

    def start(self):
        exigir_main()
        self._promessa = pool.submeter(self._target or _nada, self._args, self._kwargs)
        PENDENTES.append(self)

    def join(self, timeout=None):
        if self._promessa is None:
            return
        promessa, self._promessa = self._promessa, None
        PENDENTES.remove(self)
        situacao, valor = pool.esperar(promessa)
        if situacao == 'erro':
            # Como no Python real: o erro do filho é impresso, e o pai continua.
            print(f'Process {self.name}:')
            print(''.join(traceback.format_exception_only(valor)), end='')
            self.exitcode = 1
        else:
            self.exitcode = 0

    def is_alive(self):
        return self._promessa is not None


def _nada(*args, **kwargs):
    return None


class AsyncResult:
    def __init__(self, obter):
        self._obter = obter
        self._pronto = False

    def get(self, timeout=None):
        if not self._pronto:
            self._valor = self._obter()
            self._pronto = True
        return self._valor

    def ready(self):
        return self._pronto

    def wait(self, timeout=None):
        self.get()


class Pool:
    def __init__(self, processes=None, initializer=None, initargs=()):
        exigir_main()
        self._processos = max(1, processes or cpu_count())
        self._aberto = True

    def __enter__(self):
        return self

    def __exit__(self, *erro):
        self.terminate()

    def _conferir(self):
        if not self._aberto:
            raise ValueError('Pool not running')

    def _lotes(self, itens, chunksize):
        itens = list(itens)
        if chunksize is None:
            chunksize, resto = divmod(len(itens), self._processos * 4)
            if resto:
                chunksize += 1
        chunksize = max(1, chunksize)
        return [itens[i:i + chunksize] for i in range(0, len(itens), chunksize)]

    def _rodar_lotes(self, aplicar, funcao, itens, chunksize):
        """No máximo `processes` lotes ao mesmo tempo, como os processos de um Pool real."""
        self._conferir()
        lotes = self._lotes(itens, chunksize)
        janela = deque()
        resultados = []
        for lote in lotes:
            if len(janela) == self._processos:
                resultados.extend(_valor(pool.esperar(janela.popleft())))
            janela.append(pool.submeter(aplicar, (funcao, lote)))
        while janela:
            resultados.extend(_valor(pool.esperar(janela.popleft())))
        return resultados

    def map(self, func, iterable, chunksize=None):
        return self._rodar_lotes(_aplicar_lote, func, iterable, chunksize)

    def starmap(self, func, iterable, chunksize=None):
        return self._rodar_lotes(_aplicar_lote_estrela, func, iterable, chunksize)

    def imap(self, func, iterable, chunksize=1):
        yield from self.map(func, iterable, chunksize)

    def imap_unordered(self, func, iterable, chunksize=1):
        yield from self.map(func, iterable, chunksize)

    def map_async(self, func, iterable, chunksize=None):
        return AsyncResult(lambda: self.map(func, iterable, chunksize))

    def apply_async(self, func, args=(), kwds=None):
        self._conferir()
        promessa = pool.submeter(func, args, kwds)
        return AsyncResult(lambda: _valor(pool.esperar(promessa)))

    def apply(self, func, args=(), kwds=None):
        return self.apply_async(func, args, kwds).get()

    def close(self):
        self._aberto = False

    def terminate(self):
        self._aberto = False

    def join(self):
        pass


class _Atual:
    name = 'MainProcess'


def current_process():
    return _Atual()


def freeze_support():
    pass


def set_start_method(metodo, force=False):
    pass


def _sem_memoria_compartilhada(*args, **kwargs):
    raise NotImplementedError(
        'Value e Array precisam de memória compartilhada (SharedArrayBuffer), que o GitHub Pages não libera. '
        'Aqui, troque dados entre processos com Queue ou com os resultados de Pool.map.'
    )


Value = Array = _sem_memoria_compartilhada

PUBLICOS = (
    'Array', 'AsyncResult', 'Pool', 'Process', 'Queue', 'Value',
    'cpu_count', 'current_process', 'freeze_support', 'set_start_method',
)


def modulo():
    """O `multiprocessing` que o aluno importa durante a execução."""
    m = types.ModuleType('multiprocessing')
    m.__dict__.update({nome: globals()[nome] for nome in PUBLICOS})
    return m
