"""diverge_paralelo em CPython: sem o pool do navegador, tudo roda em sequência."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from diverge_runtime import execucao  # noqa: E402

execucao.PASTA = tempfile.mkdtemp()


def rodar(codigo, **kw):
    return execucao.executar({'main.py': codigo, **kw.pop('arquivos', {})}, **kw)


def test_pool_map_com_main():
    r = rodar('from multiprocessing import Pool\ndef q(x):\n    return x * x\n'
              'if __name__ == "__main__":\n    with Pool(2) as p:\n        r = p.map(q, range(5))\n')
    assert r['erro'] is None
    assert r['variaveis']['r'] == [0, 1, 4, 9, 16]
    assert r['paralelismo']['tarefas'] >= 1


def test_pool_sem_main_da_o_erro_do_python_real():
    r = rodar('from multiprocessing import Pool\np = Pool(2)\n')
    assert r['erro']['tipo'] == 'RuntimeError'
    assert 'bootstrapping phase' in r['erro']['mensagem']


def test_pool_numa_funcao_chamada_do_bloco_main():
    r = rodar('from multiprocessing import Pool\ndef calcular():\n    with Pool(2) as p:\n        return p.map(abs, [-1, -2])\n'
              'if __name__ == "__main__":\n    r = calcular()\n')
    assert r['erro'] is None and r['variaveis']['r'] == [1, 2]


def test_process_e_queue():
    r = rodar('from multiprocessing import Process, Queue\ndef soma(q, a, b):\n    q.put(sum(range(a, b)))\n'
              'if __name__ == "__main__":\n    q = Queue()\n    ps = [Process(target=soma, args=(q, 0, 5)), Process(target=soma, args=(q, 5, 10))]\n'
              '    for p in ps:\n        p.start()\n    total = q.get() + q.get()\n    for p in ps:\n        p.join()\n')
    assert r['erro'] is None and r['variaveis']['total'] == 45


def test_fila_vazia_sem_processo_explica_em_vez_de_travar():
    r = rodar('from multiprocessing import Queue\nif __name__ == "__main__":\n    Queue().get()\n')
    assert r['erro']['tipo'] == 'RuntimeError'
    assert 'ficaria parado para sempre' in r['erro']['mensagem']


def test_executor_as_completed_e_erro():
    r = rodar('from concurrent.futures import ProcessPoolExecutor, as_completed\n'
              'def inv(x):\n    return 1 / x\n'
              'if __name__ == "__main__":\n    with ProcessPoolExecutor() as ex:\n'
              '        fs = [ex.submit(inv, x) for x in (1, 2, 4)]\n        total = sum(f.result() for f in as_completed(fs))\n'
              '        try:\n            ex.submit(inv, 0).result()\n        except ZeroDivisionError:\n            pegou = True\n')
    assert r['erro'] is None
    assert r['variaveis']['total'] == 1.75 and r['variaveis']['pegou'] is True


def test_threads_continuam_reais_e_modulos_voltam_ao_normal():
    import multiprocessing
    import concurrent.futures
    rodar('import multiprocessing\n')
    assert sys.modules['multiprocessing'] is multiprocessing
    assert concurrent.futures.ProcessPoolExecutor.__module__ == 'concurrent.futures.process'


def test_value_e_array_explicam():
    r = rodar('from multiprocessing import Value\nif __name__ == "__main__":\n    Value("i", 0)\n')
    assert r['erro']['tipo'] == 'NotImplementedError'
    assert 'SharedArrayBuffer' in r['erro']['mensagem']
