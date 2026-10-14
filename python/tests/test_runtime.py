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


def test_subpasta_nao_sobra_entre_execucoes():
    execucao.executar({'main.py': 'import os\nos.makedirs("saida", exist_ok=True)\nopen("saida/x.txt", "w").write("1")\n'})
    r = execucao.executar({'main.py': 'import os\nprint(os.path.exists("saida/x.txt"))\n'})
    assert r['saida'] == 'False\n'


def test_arquivos_gerados():
    r = execucao.executar({
        'main.py': 'open("novo.csv", "w").write("a,b\\n")\nopen("dados.txt", "a").write("2")\n',
        'dados.txt': '1',
        'igual.txt': 'x',
    })
    assert r['arquivos_gerados'] == {'novo.csv': 'a,b\n', 'dados.txt': '12'}


def test_gerador_infinito_vira_lista_limitada():
    r = rodar('def contar():\n    n = 0\n    while True:\n        yield n\n        n += 1\n',
              chamadas=[{'funcao': 'contar', 'args': []}])
    assert r['retornos'][0]['valor'][:3] == [0, 1, 2]
    assert len(r['retornos'][0]['valor']) == 1000


def test_map_e_filter_viram_lista():
    assert descrever(map(str, [1, 2]))['valor'] == ['1', '2']
    assert descrever(filter(None, [0, 3]))['valor'] == [3]


def test_tarefa_devolve_saida_erro_e_filas():
    import cloudpickle
    from diverge_runtime import tarefa

    def f(x):
        print('oi', x)
        tarefa.FILAS_DA_TAREFA.setdefault(5, []).append(x * 2)
        return x + 1

    assert cloudpickle.loads(tarefa.rodar(cloudpickle.dumps((f, (1,), {})))) == ('ok', 2, 'oi 1\n', {5: [2]})
    situacao, erro, saida, filas = cloudpickle.loads(tarefa.rodar(cloudpickle.dumps((int, ('x',), {}))))
    assert situacao == 'erro' and isinstance(erro, ValueError) and saida == '' and filas == {}


def test_paralelismo_sem_pool_roda_em_sequencia():
    r = execucao.executar({'main.py': 'from diverge_runtime import pool\nprint(pool.mapear(abs, [-1, -2]))\n'})
    assert r['saida'] == '[1, 2]\n'
    assert r['paralelismo'] == {'disponivel': False, 'maximo': 1, 'tarefas': 2, 'workers': 1}


# ---------- terminal interativo ----------
import types  # noqa: E402


def _terminal_falso(respostas, sem_jspi=True):
    saidas = []
    modulo = types.ModuleType('diverge_terminal_js')
    modulo.escrever = saidas.append
    modulo.sem_jspi = lambda: sem_jspi
    modulo.pedir = lambda: None
    sys.modules['diverge_terminal_js'] = modulo
    return saidas


def test_saida_ao_vivo_e_input_sem_jspi_pede_resposta():
    saidas = _terminal_falso([])
    try:
        r = execucao.executar({'main.py': 'print("antes")\nnome = input("Nome: ")\nprint("Olá", nome)\n'}, interativo=True)
    finally:
        del sys.modules['diverge_terminal_js']
    assert r['precisa_entrada'] is True
    assert r['erro'] is None
    assert ''.join(saidas) == 'antes\nNome: '
    assert r['saida'] == 'antes\nNome: '


def test_input_interativo_usa_as_respostas_ja_dadas_antes_de_pedir():
    _terminal_falso([])
    try:
        r = execucao.executar({'main.py': 'a = input("A: ")\nb = input("B: ")\nprint(a + b)\n'}, entrada=['1'], interativo=True)
    finally:
        del sys.modules['diverge_terminal_js']
    assert r['precisa_entrada'] is True
    assert r['saida'] == 'A: 1\nB: '  # a resposta dada aparece como se tivesse sido digitada


def test_chamadas_da_correcao_nunca_pedem_resposta():
    _terminal_falso([])
    try:
        r = execucao.executar({'main.py': 'def f():\n    return input()\n'}, interativo=True, chamadas=[{'funcao': 'f', 'args': []}])
    finally:
        del sys.modules['diverge_terminal_js']
    assert r['retornos'][0]['erro']['tipo'] == 'EOFError'
    assert not r.get('precisa_entrada')


def test_argv():
    r = execucao.executar({'main.py': 'import sys\nprint(sys.argv)\n'}, argv=['a', 'b'])
    assert r['saida'] == "['main.py', 'a', 'b']\n"


def test_repl_expressoes_blocos_e_erros():
    from diverge_runtime import repl
    repl.iniciar()
    assert repl.linha('x = 2') == {'saida': '', 'erro': None, 'continua': False}
    assert repl.linha('x * 21')['saida'] == '42\n'
    assert repl.linha('_ + 1')['saida'] == '43\n'
    assert repl.linha("'oi'")['saida'] == "'oi'\n"
    assert repl.linha('None')['saida'] == ''
    assert repl.linha('for i in range(2):')['continua'] is True
    assert repl.linha('    print(i)')['continua'] is True
    assert repl.linha('')['saida'] == '0\n1\n'
    r = repl.linha('1/0')
    assert r['erro']['tipo'] == 'ZeroDivisionError'
    assert 'File "<stdin>", line 1' in r['erro']['traceback']
    assert repl.linha('def f(')['continua'] is True
    r = repl.linha('')  # linha vazia termina o bloco: o erro aparece, o prompt volta a >>>
    assert r['continua'] is False and r['erro']['tipo'] == 'SyntaxError'


def test_repl_com_o_escopo_do_programa():
    from diverge_runtime import repl
    execucao.executar({'main.py': 'total = 10\n'})
    repl.iniciar(do_programa=True)
    assert repl.linha('total + 1')['saida'] == '11\n'
    repl.iniciar()
    assert repl.linha('total')['erro']['tipo'] == 'NameError'


def test_chamadas_usam_as_respostas_que_sobraram_na_fila():
    r = execucao.executar({'main.py': 'a = input()\ndef f():\n    return input()\n'}, entrada=['1', '2'], chamadas=[{'funcao': 'f', 'args': []}])
    assert r['retornos'][0]['valor'] == '2'
