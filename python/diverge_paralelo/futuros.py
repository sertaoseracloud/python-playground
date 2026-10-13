"""ProcessPoolExecutor, Future e as_completed (concurrent.futures) sobre o pool de workers."""
import concurrent.futures as _reais
import types

from diverge_runtime import pool

from .guarda import exigir_main


class Future:
    def __init__(self, promessa):
        self._promessa = promessa
        self._pronto = False

    def _esperar(self):
        if not self._pronto:
            self._situacao, self._valor = pool.esperar(self._promessa)
            self._pronto = True

    def result(self, timeout=None):
        self._esperar()
        if self._situacao == 'erro':
            raise self._valor
        return self._valor

    def exception(self, timeout=None):
        self._esperar()
        return self._valor if self._situacao == 'erro' else None

    def done(self):
        return self._pronto


class ProcessPoolExecutor:
    def __init__(self, max_workers=None, *args, **kwargs):
        self._futuros = []

    def __enter__(self):
        return self

    def __exit__(self, *erro):
        self.shutdown()

    def submit(self, fn, /, *args, **kwargs):
        exigir_main()
        futuro = Future(pool.submeter(fn, args, kwargs))
        self._futuros.append(futuro)
        return futuro

    def map(self, fn, *iterables, timeout=None, chunksize=1):
        futuros = [self.submit(fn, *args) for args in zip(*iterables)]
        return (f.result() for f in futuros)

    def shutdown(self, wait=True, *, cancel_futures=False):
        if wait:
            for futuro in self._futuros:
                futuro._esperar()


def as_completed(fs, timeout=None):
    """Na ordem em que as tarefas terminam (a ordem muda de uma execução para outra)."""
    restantes = list(fs)
    while restantes:
        prontos = [i for i, f in enumerate(restantes) if f.done()]
        i = prontos[0] if prontos else pool.primeiro([f._promessa for f in restantes])
        futuro = restantes.pop(i)
        futuro._esperar()
        yield futuro


def modulo():
    """concurrent.futures do aluno: o real, com os processos trocados pelos daqui."""
    m = types.ModuleType('concurrent.futures')
    m.__dict__.update({k: v for k, v in vars(_reais).items() if not k.startswith('__')})
    m.ProcessPoolExecutor, m.Future, m.as_completed = ProcessPoolExecutor, Future, as_completed
    return m
