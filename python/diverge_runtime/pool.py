"""Ponte com o pool de workers (src/python/pool.js).

Com JSPI (run_sync), cada tarefa roda num worker, de verdade em paralelo, e o Python do aluno
espera a resposta. Sem JSPI (ou fora do navegador), a tarefa roda aqui mesmo, em sequência:
o resultado é o mesmo. METRICAS conta o que aconteceu na execução atual (zerar() a cada execução)."""
import os
import sys
import time

import cloudpickle

from . import tarefa

METRICAS = {'disponivel': False, 'maximo': 1, 'tarefas': 0, 'workers': set()}
AO_RECEBER_FILAS = None  # diverge_paralelo entrega aqui os itens que as tarefas puseram em filas
_PASTA = None


def _modulo_js():
    try:
        import diverge_pool_js
    except ImportError:
        return None
    return diverge_pool_js


def _js():
    js = _modulo_js()
    if js is None:
        return None
    from pyodide.ffi import can_run_sync
    return js if can_run_sync() else None


def maximo():
    js = _js()
    return int(js.maximo()) if js else 1


def nucleos():
    js = _modulo_js()
    return int(js.nucleos()) if js else (os.cpu_count() or 1)


def zerar(pasta=None):
    global _PASTA
    _PASTA = pasta
    METRICAS.update(disponivel=_js() is not None, maximo=maximo(), tarefas=0, workers=set())


def resumo():
    return {**METRICAS, 'workers': len(METRICAS['workers'])}


class _Pronta:
    """Tarefa que já rodou aqui mesmo (sem pool), com os tempos medidos."""

    def __init__(self, resposta, inicio, fim):
        self.resposta, self.inicio, self.fim = resposta, inicio, fim


def _registrar_modulos_do_aluno():
    """O worker não tem os arquivos do aluno: os módulos dele vão por valor."""
    if not _PASTA:
        return
    for nome, modulo in list(sys.modules.items()):
        arquivo = getattr(modulo, '__file__', '') or ''
        if nome != '__main__' and arquivo.startswith(_PASTA):
            cloudpickle.register_pickle_by_value(modulo)


def submeter(funcao, args=(), kwargs=None):
    _registrar_modulos_do_aluno()
    pacote = cloudpickle.dumps((funcao, tuple(args), kwargs or {}))
    METRICAS['tarefas'] += 1
    js = _js()
    if js is None:
        inicio = time.time() * 1000
        resposta = tarefa.rodar(pacote)
        return _Pronta(resposta, inicio, time.time() * 1000)
    from pyodide.ffi import to_js
    return js.submeter(to_js(pacote))


def esperar_tarefa(promessa):
    """Espera a tarefa: imprime o que ela imprimiu, entrega as filas e devolve
    (situacao, valor, {'worker', 'inicio', 'fim'})."""
    if isinstance(promessa, _Pronta):
        resposta, info = promessa.resposta, {'worker': 0, 'inicio': promessa.inicio, 'fim': promessa.fim}
    else:
        from pyodide.ffi import run_sync
        r = run_sync(promessa)
        resposta = bytes(r.resultado.to_py())
        info = {'worker': int(r.worker), 'inicio': float(r.inicio), 'fim': float(r.fim)}
    METRICAS['workers'].add(info['worker'])
    situacao, valor, saida, filas = cloudpickle.loads(resposta)
    if saida:
        sys.stdout.write(saida)
    if filas and AO_RECEBER_FILAS:
        AO_RECEBER_FILAS(filas)
    return situacao, valor, info


def esperar(promessa):
    """Espera a tarefa e devolve (situacao, valor); veja esperar_tarefa."""
    situacao, valor, _ = esperar_tarefa(promessa)
    return situacao, valor


def primeiro(promessas):
    """Índice da primeira tarefa a terminar (as que já rodaram aqui contam como prontas)."""
    for i, p in enumerate(promessas):
        if isinstance(p, _Pronta):
            return i
    from pyodide.ffi import run_sync, to_js
    return int(run_sync(_js().primeiro(to_js(list(promessas)))))


def mapear(funcao, itens):
    """funcao(item) para cada item, em paralelo; o primeiro erro sobe aqui."""
    promessas = [submeter(funcao, (item,)) for item in itens]
    resultados = []
    for p in promessas:
        situacao, valor = esperar(p)
        if situacao == 'erro':
            raise valor
        resultados.append(valor)
    return resultados
