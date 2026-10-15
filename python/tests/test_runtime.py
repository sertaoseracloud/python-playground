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


def test_deltas_no_resultado():
    codigo = ('from pyspark.sql import SparkSession\nfrom delta.tables import DeltaTable\n'
              'spark = SparkSession.builder.getOrCreate()\n'
              'spark.createDataFrame([("a", 1)], ["p", "q"]).write.format("delta").save("dados/estoque")\n'
              'DeltaTable.forPath(spark, "dados/estoque").delete("q = 1")\n')
    r = rodar(codigo)
    assert r['erro'] is None
    assert r['deltas'] == {'dados/estoque': {'versao': 1, 'operacoes': ['WRITE', 'DELETE'], 'colunas': ['p', 'q'], 'linhasPorVersao': [1, 0]}}
    assert rodar('x = 1\n')['deltas'] == {}  # cada execução começa sem tabelas registradas


def test_streaming_no_resultado():
    codigo = ('from pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()\n'
              'leituras = spark.readStream.schema("estacao STRING, temperatura DOUBLE").csv("leituras", header=True)\n'
              'leituras.writeStream.format("console").queryName("q").start()\n')
    r = execucao.executar({'main.py': codigo, 'leituras/a.csv': 'estacao,temperatura\nCrato,31.5\nSobral,29.0\n'})
    assert r['erro'] is None
    assert 'Batch: 0' in r['saida'] and '|  Crato|' in r['saida']  # o start() sem espera roda no fim do programa
    assert r['streaming'] == {'consultas': [{'nome': 'q', 'modo': 'append', 'formato': 'console', 'lotes': [
        {'id': 0, 'entrada': 2, 'arquivos': ['a.csv'], 'estado': 0, 'marcaDagua': None, 'saida': 2, 'descartadas': 0}]}]}
    assert 'leituras' not in r['tabelas']  # o DataFrame de streaming não tem linhas fora do writeStream
    assert rodar('x = 1\n')['streaming'] is None


def test_erro_do_streaming_no_fim_do_programa_vira_erro_do_aluno():
    codigo = ('from pyspark.sql import SparkSession, functions as F\nspark = SparkSession.builder.getOrCreate()\n'
              'quebra = F.udf(lambda t: 1 // 0, "int")\n'
              'spark.readStream.schema("t DOUBLE").csv("leituras").select(quebra("t")).writeStream.format("console").start()\n')
    r = execucao.executar({'main.py': codigo, 'leituras/a.csv': '1.0\n'})
    assert r['erro']['tipo'] == 'StreamingQueryException'


executar = execucao.executar
SAFRA = ('chuva,area,irrigado,producao\n'
         '300,5,1,17.5\n350,4,1,16.0\n800,3,0,17.0\n400,2,0,11.0\n250,6,1,19.0\n700,2,0,14.0\n')
TREINO_LINEAR = '''
from pyspark.sql import SparkSession
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import LinearRegression
from pyspark.ml import Pipeline
spark = SparkSession.builder.getOrCreate()
treino = spark.read.csv("safra.csv", header=True, inferSchema=True)
montador = VectorAssembler(inputCols=["chuva", "area", "irrigado"], outputCol="features")
modelo = LinearRegression(labelCol="producao").fit(montador.transform(treino))
sem_fit = LinearRegression(labelCol="producao")
tubo = Pipeline(stages=[montador, LinearRegression(labelCol="producao")]).fit(treino)
'''


def test_modelos_descreve_modelos_e_estimadores():
    r = executar({'main.py': TREINO_LINEAR, 'safra.csv': SAFRA})
    assert r['erro'] is None
    m = r['modelos']
    assert m['modelo']['tipo'] == 'LinearRegressionModel'
    assert [round(c, 6) for c in m['modelo']['coeficientes']] == [0.01, 2.0, 1.5]
    assert round(m['modelo']['intercepto'], 6) == 3.0
    assert m['sem_fit'] == {'tipo': 'LinearRegression', 'treinado': False, 'metricas': {}}
    assert m['tubo']['tipo'] == 'PipelineModel' and m['tubo']['ultimo'] == 'LinearRegressionModel'
    assert 'montador' not in m  # o VectorAssembler é transformador, não modelo


def test_modelos_calcula_a_metrica_pedida_e_o_erro_vira_resultado():
    pedidos = [
        {'variavel': 'modelo', 'nome': 'rmse', 'dados': 'safra.csv', 'preparar': 'montador'},
        {'variavel': 'tubo', 'nome': 'r2', 'dados': 'safra.csv'},
        {'variavel': 'modelo', 'nome': 'rmse', 'dados': 'nao-existe.csv', 'preparar': 'montador'},
    ]
    r = executar({'main.py': TREINO_LINEAR, 'safra.csv': SAFRA}, avaliacoes=pedidos)
    metricas = r['modelos']['modelo']['metricas']
    assert metricas['rmse@safra.csv'] < 1e-9
    assert abs(r['modelos']['tubo']['metricas']['r2@safra.csv'] - 1.0) < 1e-9
    assert metricas['rmse@nao-existe.csv']['erro']['tipo'] == 'AnalysisException'
    acoes = [j['acao'] for j in (r['spark'] or {'jobs': []})['jobs']]
    assert not any('evaluate' in a or 'avalia' in a for a in acoes)  # a métrica da correção fica fora da aba ⚡ Execução


def test_sem_pyspark_ml_o_bloco_modelos_fica_vazio():
    assert executar({'main.py': 'x = 1\n'})['modelos'] == {}


def test_deltas_tem_as_linhas_de_cada_versao():
    codigo = '''
from pyspark.sql import SparkSession
spark = SparkSession.builder.getOrCreate()
df = spark.createDataFrame([("mel", 10), ("farinha", 40)], ["produto", "qtd"])
df.write.format("delta").save("estoque")
df.limit(1).write.format("delta").mode("append").save("estoque")
'''
    assert executar({'main.py': codigo})['deltas']['estoque']['linhasPorVersao'] == [2, 3]
