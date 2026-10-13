"""Testes rápidos do runtime em CPython (no CI): a mesma lógica que roda no Pyodide."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from diverge_runtime import execucao  # noqa: E402
from diverge_runtime.valores import descrever  # noqa: E402

execucao.PASTA = tempfile.mkdtemp()


def rodar(codigo, **kw):
    return execucao.executar({'main.py': codigo}, **kw)


def test_print_e_erro_com_linha():
    r = rodar('print("oi")\n1/0\n')
    assert r['saida'] == 'oi\n'
    assert r['erro']['tipo'] == 'ZeroDivisionError'
    assert r['erro']['linha'] == 2


def test_chamada_de_funcao():
    r = rodar('def f(a, b):\n    return a + b\n', chamadas=[{'funcao': 'f', 'args': [2, 3]}])
    assert r['retornos'][0]['valor'] == 5


def test_descrever_valores():
    assert descrever((1, {2, 1}))['valor'] == [1, [1, 2]]
    assert descrever(float('nan'))['json'] is False


def test_executar_json():
    saida = json.loads(execucao.executar_json({'arquivos': {'main.py': 'x = 1'}}))
    assert saida['variaveis'] == {'x': 1}
