"""Testes rápidos do runtime em CPython (no CI): a mesma lógica que roda no Pyodide."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # sem '..': no Windows o import falha com ele
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


def test_estagios_registra_jobs_tarefas_e_resumo():
    from diverge_runtime import estagios
    estagios.zerar()
    assert estagios.resumo() is None
    job = estagios.novo_job('collect')
    mapa = estagios.novo_estagio(job, 'parallelize → map', 'shuffle')
    fim = estagios.novo_estagio(job, 'reduceByKey', 'resultado')
    t0 = estagios.T0
    for i in range(2):
        estagios.registrar_tarefa(mapa, i, 3, {'worker': i, 'inicio': t0 + 1, 'fim': t0 + 5})
    estagios.registrar_tarefa(fim, 0, 2, {'worker': 0, 'inicio': t0 + 6, 'fim': t0 + 9})
    r = estagios.resumo()
    assert (r['estagios'], r['shuffles'], r['tarefas'], r['workers'], r['ms']) == (2, 1, 3, 2, 8)
    assert r['jobs'][0]['estagios'][0]['tarefas'][0] == {'particao': 0, 'worker': 0, 'linhas': 3, 'inicio': 1.0, 'fim': 5.0}
    with estagios.local():
        assert estagios.em_local()
        estagios.novo_job('tabela')
    assert not estagios.em_local() and len(estagios.resumo()['jobs']) == 1
    chamou = []
    estagios.AO_ZERAR.append(lambda: chamou.append(1))
    try:
        estagios.zerar()
    finally:
        estagios.AO_ZERAR.pop()
    assert chamou == [1] and estagios.resumo() is None


def test_tarefa_sem_pool_tem_tempos_medidos():
    from diverge_runtime import pool
    pool.zerar()
    situacao, valor, info = pool.esperar_tarefa(pool.submeter(sum, ([1, 2],)))
    assert (situacao, valor, info['worker']) == ('ok', 3, 0)
    assert info['fim'] >= info['inicio'] > 0


def test_resultado_traz_spark_e_tabelas_de_objetos_com_tabela():
    r = execucao.executar({'main.py': (
        'class T:\n'
        '    def _diverge_tabela(self, limite):\n'
        '        return {"colunas": [{"nome": "a", "tipo": "bigint"}], "linhas": [[open("d.txt").read()]]}\n'
        'class Ruim:\n'
        '    def _diverge_tabela(self, limite):\n'
        '        raise ValueError("não deu")\n'
        't = T()\nr = Ruim()\n'), 'd.txt': 'oi'})
    assert r['spark'] is None
    assert r['tabelas']['t'] == {'colunas': [{'nome': 'a', 'tipo': 'bigint'}], 'linhas': [['oi']]}
    assert r['tabelas']['r'] == {'erro': {'tipo': 'ValueError', 'mensagem': 'não deu'}}
