"""mapear(funcao, itens): roda funcao(item) para cada item no pool de workers, de verdade em
paralelo, quando o navegador permite que o Python espere o JavaScript (run_sync, com JSPI).
Sem isso, roda em sequência aqui mesmo: o resultado é o mesmo e ULTIMA avisa."""
import time

import cloudpickle

ULTIMA = {'paralelo': False, 'workers': 1, 'tarefas': []}


def _pool_js():
    try:
        import diverge_pool_js
        from pyodide.ffi import can_run_sync
    except ImportError:
        return None
    return diverge_pool_js if can_run_sync() else None


def mapear(funcao, itens):
    itens = list(itens)
    js = _pool_js()
    if js is None:
        return _em_sequencia(funcao, itens)
    from pyodide.ffi import run_sync, to_js
    pacotes = [cloudpickle.dumps((funcao, item)) for item in itens]
    resposta = run_sync(js.mapear(to_js(pacotes))).to_py()
    resultados = [cloudpickle.loads(bytes(r)) for r in resposta['resultados']]
    tarefas = resposta['tarefas']
    ULTIMA.update(paralelo=True, workers=len({t['worker'] for t in tarefas}), tarefas=tarefas)
    return resultados


def _em_sequencia(funcao, itens):
    inicio = time.perf_counter()
    resultados, tarefas = [], []
    for item in itens:
        comeco = (time.perf_counter() - inicio) * 1000
        resultados.append(funcao(item))
        tarefas.append({'worker': 0, 'inicio': comeco, 'fim': (time.perf_counter() - inicio) * 1000})
    ULTIMA.update(paralelo=False, workers=1, tarefas=tarefas)
    return resultados
