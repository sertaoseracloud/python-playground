# DivergePython fase 4 (✨ PySpark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versão 0.4.0 com um pacote `pyspark` próprio, em Python puro (RDD, DataFrame, `functions`, `Window`, SQL, leitura e escrita), cujas partições rodam de verdade no pool de workers; a aba ⚡ Execução; as regras `dataframe` e `plano`; os testes de conformidade com o PySpark real no CI; e o módulo ✨ PySpark (14 lições e 45 exercícios).

**Architecture:** Cada ação do Spark vira um *job*. O motor (`pyspark/_motor.py`) monta, a partir da linhagem, a lista de tarefas de cada estágio (uma por partição, cada uma com a cadeia de funções estreitas) e as manda ao pool pela ponte da fase 3 (`diverge_runtime.pool.submeter`/`esperar_tarefa`). Transformações largas cortam o estágio: o lado do map grava baldes por um hash determinístico, o motor junta os baldes e o estágio seguinte continua dali. O DataFrame é um plano físico simplificado (`pyspark/sql/plano.py`) que se compila em operações de RDD, imprime o `explain()` no formato do Spark e se resume (shuffles, broadcast, cache, partições, estágios) para a regra `plano`. Os arquivos do aluno são lidos e gravados no processo principal (os workers não têm a pasta do aluno). `diverge_runtime/estagios.py` guarda jobs, estágios e tarefas com tempos medidos; o resultado da execução ganha `spark` (para a aba ⚡ Execução) e `tabelas` (os DataFrames das variáveis, para a regra `dataframe`).

**Tech Stack:** Pyodide 314.0.7 (Python 3.14) com JSPI, cloudpickle 3.1.1, Web Workers / `worker_threads` nos testes, vitest 5 (Node 24, `--experimental-wasm-jspi`), pytest 8.4.2; no CI, PySpark 4.0.1 com Java 17 e Python 3.12 para a conformidade.

**Spec:** `docs/superpowers/specs/2026-10-13-divergepython-design.md` (seções 3, 5, 6, 7, 8, 9 e 11, fase 4)

## Global Constraints

- Versão publicada: **0.4.0**. Módulo `pyspark`: **45 exercícios** e **14 lições**; abre com 70% do ⚡ Paralelismo.
- "4 partições por padrão (`spark.default.parallelism` e `spark.sql.shuffle.partitions`, ajustáveis com `spark.conf.set`). O site explica que o Spark real usa 200 partições de shuffle por padrão."
- "Avaliação preguiçosa: transformações montam o plano; ações (`show`, `count`, `collect`, `take`, `write`) executam."
- "Estágios cortados por transformações largas (`groupBy`, `join` sem broadcast, `orderBy`, `distinct`, `repartition`); shuffle por hash determinístico (o hash do Python muda a cada execução, então não é usado)."
- "Cada partição de um estágio roda num worker do pool. Métricas: linhas por partição, tarefas por estágio, linhas embaralhadas, tempos medidos."
- "Saídas no formato do Spark: `show()` (tabela ASCII, truncamento em 20 caracteres), `printSchema()`, `explain()` (plano físico simplificado: `Exchange hashpartitioning`, `HashAggregate`, `BroadcastHashJoin`, `SortMergeJoin`)."
- "Erros no formato do Spark (`AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION]`, com sugestão de coluna parecida)."
- Fora de escopo: "`toPandas` (o pandas não é carregado), GraphX/GraphFrames, Spark Connect, Pandas API on Spark, Catalyst completo (o otimizador só faz o essencial: empurrar filtros e escolher broadcast abaixo de um limite), múltiplas sessões." Streaming, MLlib e Delta ficam para a fase 5.
- "O site deixa claro, na trilha e na página de acessibilidade/sobre, que é uma implementação para aprender, com a API do Spark, e não o Spark."
- Regras novas: `dataframe` ("schema e linhas de um DataFrame (a ordem só conta se o exercício pede `orderBy`)") e `plano` ("número de shuffles, broadcast, cache, partições, estágios"). A regra `paralelo` continua nunca conferindo tempo.
- Aba ⚡ Execução: "estágios, tarefas por partição e linha do tempo dos workers, com uma tabela em texto equivalente (leitor de tela) e a fala do resumo ("3 estágios, 1 shuffle, 4 tarefas em 4 workers")".
- Conformidade: "um conjunto de programas roda no PySpark real e no nosso; `show()`, schema, contagens, `explain` (forma geral) e mensagens de erro têm de bater."
- Dados "gerados por nós, pequenos, determinísticos e com tema brasileiro; os casos ocultos usam outra semente".
- Certificado da Sertão será cloud, assinado por Cláudio Raposo; carga pela regra (lição 10, fácil 15, médio 30, difícil 45 min; arredonda para cima).
- Publicação (inclusive empurrar um branch para o CI rodar a conformidade) só depois do "sim" do usuário; commits como "Cláudio Raposo" <engcfraposo@gmail.com> com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- O aluno lê `vendas.csv` com `spark.read.csv` e o Spark roda nos workers, que **não têm a pasta do aluno**: a leitura acontece no processo principal e os dados viajam dentro das tarefas (teste no `tests/spark.test.js` da Task 7).
- Uma `lambda` do aluno que usa uma variável global do `main.py` (`taxa = 0.1; rdd.map(lambda x: x * taxa)`) tem de funcionar no worker (teste no `tests/spark.test.js` da Task 7).
- Um erro dentro de uma `lambda` ou UDF (`1 // 0`) sobe no processo principal com o mesmo tipo, e a correção mostra a mensagem em vez de quebrar; um DataFrame numa variável que só falha ao ser calculado vira `tabelas.x.erro` (testes no `tests/spark.test.js` da Task 7 e no `verificacoes.test.js` da Task 7).
- Duas execuções seguidas na mesma sessão: as views temporárias, o `spark.conf` e o cache da execução anterior não podem vazar para a próxima (teste no pytest da Task 5).
- Um programa sem nenhuma ação (só transformações) não roda job nenhum: a aba ⚡ Execução fica escondida, mas a regra `dataframe` ainda confere a variável (teste no `tests/spark.test.js` da Task 7 e no `item-python.test.js` da Task 8).

---

### Task 1: Tempos das tarefas e registro de jobs e estágios

Antes de começar: `git checkout -b fase-4`.

**Files:**
- Create: `python/diverge_runtime/estagios.py`
- Modify: `src/python/pool.js` (`submeter` devolve também `inicio` e `fim`), `src/python/worker-tarefa.js`, `tests/worker-tarefa-node.js` (medem a tarefa), `python/diverge_runtime/pool.py` (`esperar_tarefa`), `python/diverge_runtime/execucao.py` (resultado com `spark` e `tabelas`)
- Test: `python/tests/test_runtime.py`, `tests/pool.test.js`

**Interfaces:**
- Consumes: `pool.submeter`, `pool.esperar`, `pool.METRICAS` (fase 3).
- Produces (JS): `pool.submeter(bytes) → Promise<{ resultado, worker, inicio, fim }>` (`inicio`/`fim` em ms de relógio de parede, `performance.timeOrigin + performance.now()`, medidos dentro do worker em volta da tarefa).
- Produces (Python): `diverge_runtime.pool.esperar_tarefa(promessa) → (situacao, valor, { 'worker': int, 'inicio': float, 'fim': float })` (`esperar` passa a chamar esta e descartar o terceiro item; sem pool, `inicio`/`fim` vêm de `time.time() * 1000` em volta de `tarefa.rodar`).
- Produces (Python) `diverge_runtime.estagios`:
  - `zerar()`: limpa os jobs, marca `T0 = time.time() * 1000` e chama cada função de `AO_ZERAR` (o pyspark se registra ali para reiniciar a sessão).
  - `AO_ZERAR: list[callable]`.
  - `novo_job(acao: str) → dict` (`{ 'id', 'acao', 'estagios': [] }`; guarda no máximo 50 jobs).
  - `novo_estagio(job, nome: str, tipo: 'shuffle' | 'resultado') → dict` (`{ 'id', 'nome', 'tipo', 'tarefas': [], 'linhas_embaralhadas': 0 }`; `id` sequencial na execução).
  - `registrar_tarefa(estagio, particao: int, linhas: int, info)`: anexa `{ 'particao', 'worker', 'linhas', 'inicio', 'fim' }`, com tempos relativos a `T0` e arredondados a 0,1 ms.
  - `local()`: gerenciador de contexto; dentro dele `em_local()` é `True`, e os jobs e estágios criados são descartados.
  - `resumo() → None | { 'jobs', 'estagios', 'shuffles', 'tarefas', 'workers', 'ms' }` (`None` sem jobs; `shuffles` conta os estágios `tipo == 'shuffle'`; `workers` conta os workers distintos; `ms` vai do início da primeira tarefa ao fim da última).
- O resultado de `executar(...)` ganha `spark: estagios.resumo()` e `tabelas: { nome: tabela }`. Para cada variável global (sem `_` no início) cujo tipo tenha o método `_diverge_tabela`, chama `valor._diverge_tabela(1000)` dentro de `estagios.local()`, ainda com o `cwd` na pasta do aluno e antes de restaurar o `stdout`. Se der exceção: `{ 'erro': { 'tipo', 'mensagem' } }`.

- [ ] **Step 1: Testes que falham**

`python/tests/test_runtime.py`:

```python
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
    r = executar({'main.py': (
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
```

(`executar` é o import que o arquivo já usa de `diverge_runtime.execucao`.)

`tests/pool.test.js`, no `describe('tarefas avulsas e workers ociosos')`, um worker falso que mede:

```js
  it('submeter devolve os tempos medidos no worker', async () => {
    const w = () => {
      const x = workerFalso();
      x.postMessage = ({ id, tarefa }) => setTimeout(() => x.onmessage({ data: { id, resultado: tarefa, inicio: 10, fim: 15 } }));
      return x;
    };
    const p = new PoolPython({ criarWorker: w, maximo: 1 });
    expect(await p.submeter(new Uint8Array([1]))).toMatchObject({ inicio: 10, fim: 15, worker: 0 });
  });
```

e, no teste `'com JSPI: roda em paralelo em mais de um worker'`, nada muda (os tempos não aparecem em `paralelismo`).

Run: `python -m pytest python/tests/test_runtime.py -q && npx vitest run tests/pool.test.js`
Expected: FAIL (`estagios` não existe, `esperar_tarefa` não existe, `tabelas` ausente, `inicio` indefinido).

- [ ] **Step 2: Implementar**

`src/python/worker-tarefa.js` e `tests/worker-tarefa-node.js`, em volta de `rodarTarefa(tarefa)`:

```js
    const inicio = performance.timeOrigin + performance.now();
    const resultado = rodarTarefa(data.tarefa);
    const fim = performance.timeOrigin + performance.now();
    postMessage({ id: data.id, resultado, inicio, fim }, [resultado.buffer]);
```

`src/python/pool.js`: o `resolve` das pendentes guarda o `data` inteiro e `submeter` devolve `{ resultado: data.resultado, worker: registro.indice, inicio: data.inicio, fim: data.fim }` (o `mapear` continua igual).

`python/diverge_runtime/pool.py`:

```python
class _Pronta:
    """Tarefa que já rodou aqui mesmo (sem pool), com os tempos medidos."""

    def __init__(self, resposta, inicio, fim):
        self.resposta, self.inicio, self.fim = resposta, inicio, fim
```

Em `submeter`, sem JS: `inicio = time.time() * 1000; resposta = tarefa.rodar(pacote); return _Pronta(resposta, inicio, time.time() * 1000)`.

```python
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
    situacao, valor, _ = esperar_tarefa(promessa)
    return situacao, valor
```

`python/diverge_runtime/estagios.py`:

```python
"""Jobs, estágios e tarefas do Spark na execução atual (para a aba ⚡ Execução).

O pyspark do DivergePython registra aqui cada ação (job), cada estágio e cada tarefa,
com o worker que rodou e os tempos medidos. `local()` é usado quando o próprio site
calcula um DataFrame (para a correção): isso não aparece para o aluno."""
import contextlib
import time

LIMITE_JOBS = 50
JOBS = []
AO_ZERAR = []
T0 = 0.0
_local = 0
_proximo_estagio = 0


def zerar():
    global T0, _proximo_estagio
    JOBS.clear()
    T0 = time.time() * 1000
    _proximo_estagio = 0
    for funcao in AO_ZERAR:
        funcao()


def em_local():
    return _local > 0


@contextlib.contextmanager
def local():
    global _local
    _local += 1
    try:
        yield
    finally:
        _local -= 1


def novo_job(acao):
    job = {'id': len(JOBS) + 1, 'acao': acao, 'estagios': []}
    if not em_local() and len(JOBS) < LIMITE_JOBS:
        JOBS.append(job)
    return job


def novo_estagio(job, nome, tipo):
    global _proximo_estagio
    _proximo_estagio += 1
    estagio = {'id': _proximo_estagio, 'nome': nome, 'tipo': tipo, 'tarefas': [], 'linhas_embaralhadas': 0}
    job['estagios'].append(estagio)
    return estagio


def registrar_tarefa(estagio, particao, linhas, info):
    estagio['tarefas'].append({
        'particao': particao, 'worker': info['worker'], 'linhas': linhas,
        'inicio': round(info['inicio'] - T0, 1), 'fim': round(info['fim'] - T0, 1),
    })


def resumo():
    if not JOBS:
        return None
    estagios = [e for j in JOBS for e in j['estagios']]
    tarefas = [t for e in estagios for t in e['tarefas']]
    ms = round(max((t['fim'] for t in tarefas), default=0) - min((t['inicio'] for t in tarefas), default=0), 1)
    return {
        'jobs': JOBS, 'estagios': len(estagios), 'shuffles': sum(e['tipo'] == 'shuffle' for e in estagios),
        'tarefas': len(tarefas), 'workers': len({t['worker'] for t in tarefas}), 'ms': ms,
    }
```

(Arredonde `ms` para inteiro quando for inteiro — `int(ms) if ms == int(ms) else ms` — para o teste comparar `8`.)

`python/diverge_runtime/execucao.py`: `from . import estagios`; logo depois de `pool.zerar(PASTA)`, `estagios.zerar()`; dentro do `try` de fora, depois das `chamadas`:

```python
        tabelas = _tabelas(escopo)
```

com

```python
def _tabelas(escopo):
    """DataFrames nas variáveis do aluno, calculados aqui mesmo (sem pool e sem aparecer na aba ⚡ Execução)."""
    tabelas = {}
    for nome, valor in list(escopo.items()):
        if nome.startswith('_') or not callable(getattr(type(valor), '_diverge_tabela', None)):
            continue
        try:
            with estagios.local():
                tabelas[nome] = valor._diverge_tabela(1000)
        except Exception as e:  # o DataFrame que falha ao calcular vira motivo na correção
            tabelas[nome] = {'erro': {'tipo': type(e).__name__, 'mensagem': str(e)}}
    return tabelas
```

(`tabelas = {}` antes do `try`, para o caso de erro antes.) O dicionário de resultado ganha `'spark': estagios.resumo(), 'tabelas': tabelas`.

Run: `python -m pytest python/tests -q && npx vitest run tests/pool.test.js tests/runtime.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Tempos medidos das tarefas, registro de jobs e estágios e tabelas no resultado"
```

---

### Task 2: `pyspark` — SparkContext, RDD e o motor de estágios

**Files:**
- Create: `python/pyspark/__init__.py`, `python/pyspark/context.py`, `python/pyspark/rdd.py`, `python/pyspark/_motor.py`, `python/pyspark/storagelevel.py`, `python/pyspark/errors/__init__.py`, `python/pyspark/sql/__init__.py` (por enquanto só `SparkSession`), `python/pyspark/sql/session.py` (o mínimo: `builder`, `getOrCreate`, `sparkContext`, `conf`)
- Test: `python/tests/test_spark_rdd.py`

**Interfaces:**
- Consumes: `diverge_runtime.pool.submeter/esperar_tarefa`, `diverge_runtime.estagios` (Task 1).
- Produces `pyspark._motor`:
  - `Tarefa = (dados: list, funcoes: tuple[callable], nomes: tuple[str])`; cada função recebe e devolve uma lista (a partição).
  - `rodar_estagio(job, tarefas, tipo, final=None) → list[resultado por tarefa]`: cria o estágio (`nome = ' → '.join(nomes da primeira tarefa sem repetir em sequência)`), manda cada tarefa ao pool (`pool.submeter(_rodar_cadeia, (funcoes + (final,), dados))`) e espera todas, registrando cada uma (`linhas` = itens da saída; nos estágios de shuffle, a soma dos baldes). Dentro de `estagios.local()`, chama `_rodar_cadeia` aqui mesmo, sem pool e sem registrar. O primeiro erro de tarefa sobe com a exceção original.
  - `hash_estavel(valor) → int` (determinístico: `int` → ele mesmo; `bool` → 0/1; `None` → 0; `float` → `zlib.crc32(repr(v))`; `str` → `zlib.crc32(utf-8)`; `bytes`; `tuple`/`list` → combinação `h = h * 31 + hash_estavel(item)` em 64 bits; `datetime.date` → `toordinal()`).
  - `fatiar_lista(itens, n)` e `fatiar_range(r, n)` (as regras do PySpark, abaixo).
- Produces `pyspark.SparkContext` (um por processo, criado pela sessão): `parallelize(c, numSlices=None)`, `textFile(caminho, minPartitions=None)`, `range(inicio, fim=None, passo=1, numSlices=None)`, `defaultParallelism` (lê `spark.default.parallelism` da sessão, padrão `4`), `emptyRDD()`, `setLogLevel(nivel)` (não faz nada), `appName`, `master` (`'local[4]'`), `version` (`'4.0.1'`), `stop()`.
- Produces `pyspark.RDD`: `map`, `flatMap`, `filter`, `mapPartitions`, `mapPartitionsWithIndex`, `glom`, `mapValues`, `flatMapValues`, `keys`, `values`, `reduceByKey(f, numPartitions=None)`, `groupByKey(numPartitions=None)` (valores como `ResultIterable`, iterável com `len`), `sortBy(f, ascending=True, numPartitions=None)`, `sortByKey(ascending=True, numPartitions=None)`, `join`, `leftOuterJoin`, `distinct(numPartitions=None)`, `union`, `repartition(n)`, `coalesce(n)`, `partitionBy(n)`, `cache()`, `persist(nivel=None)`, `unpersist()`, `is_cached`, `getNumPartitions()`, ações `collect`, `count`, `reduce`, `fold(zero, f)`, `sum`, `max`, `min`, `mean`, `take`, `first`, `countByKey`, `countByValue`, `foreach`, `toDF(schema=None)` (Task 3), `toDebugString()`. `StorageLevel.MEMORY_ONLY`, `MEMORY_AND_DISK`.
- Produces `pyspark.errors`: `PySparkException` (com `getErrorClass()`, `getMessageParameters()`, `getSqlState()`), `AnalysisException`, `ParseException`, `PySparkValueError`, `PySparkTypeError`; `str(e)` = `[CLASSE] mensagem SQLSTATE: XXXXX;` (o `SQLSTATE` só quando houver), como no Spark 4.

Regras de fatiamento (as do PySpark 4, para o `glom()` bater com o real):

```python
def fatiar_range(r, n):
    """sc.parallelize(range(...)): a partição i começa em r[0] + int(i * len / n) * passo."""
    tamanho = len(r)
    if not tamanho:
        return [[] for _ in range(n)]
    inicio = lambda i: r.start + int(i * tamanho / n) * r.step
    return [list(range(inicio(i), inicio(i + 1), r.step)) for i in range(n)]


def fatiar_lista(itens, n):
    """Listas vão em lotes de max(1, min(len // n, 1024)) itens, e os lotes são divididos
    como no ParallelCollectionRDD do Scala: lotes [i * L // n, (i + 1) * L // n)."""
    lote = max(1, min(len(itens) // n, 1024))
    lotes = [itens[i:i + lote] for i in range(0, len(itens), lote)]
    total = len(lotes)
    return [[x for b in lotes[i * total // n:(i + 1) * total // n] for x in b] for i in range(n)]
```

Execução (o coração do `_motor`): cada RDD sabe dizer `_tarefas(job) → list[Tarefa]`:

- fonte (`parallelize`, `textFile`, cache já calculado, saída de um shuffle): `[(particao, (), (nome,)) …]`;
- estreita (`map` etc.): as tarefas do pai com a função a mais, `(dados, funcoes + (f,), nomes + ('map',))`;
- `union`: as tarefas dos pais concatenadas (o mesmo estágio, como no Spark);
- larga (`reduceByKey`, `groupByKey`, `sortBy`, `join`, `distinct`, `repartition`, `partitionBy`): roda **agora**, no mesmo job, o estágio de shuffle de cada pai com `final = _baldes(n, chave, combinar)` (devolve `n` listas; `combinar` faz a combinação no lado do map do `reduceByKey`), soma em `linhas_embaralhadas` as linhas gravadas, junta os baldes (`particao j` = os baldes `j` de cada tarefa, na ordem das tarefas) e devolve `[(entrada_j, (pos,), (nome_da_operacao,)) …]`, em que `pos` é o lado do reduce (`reduceByKey`: soma por chave mantendo a ordem de chegada; `groupByKey`: agrupa; `join`: recebe a tupla dos baldes de cada lado). `sortBy` primeiro roda um job `sortBy (amostra)` que coleta as chaves, escolhe `n - 1` limites pelos quantis das chaves ordenadas e particiona por intervalo (`bisect`), depois ordena cada partição.
- `cache()`: na primeira ação, as partições calculadas ficam guardadas; daí em diante a fonte é `('cache',)`.
- `getNumPartitions()` é estático (não roda nada).
- Ações chamam `estagios.novo_job(nome_da_acao)` e `rodar_estagio(job, rdd._tarefas(job), 'resultado', final=…)` (por exemplo, `count` usa `final=len` para trazer só o número de cada partição).

- [ ] **Step 1: Testes que falham**

`python/tests/test_spark_rdd.py`:

```python
"""RDD do pyspark do DivergePython. Sem pool, as tarefas rodam aqui mesmo, em sequência:
o resultado e os estágios são os mesmos do navegador."""
import pytest

from diverge_runtime import estagios
from pyspark.errors import PySparkException
from pyspark.sql import SparkSession


@pytest.fixture
def sc():
    estagios.zerar()
    return SparkSession.builder.master('local[4]').appName('teste').getOrCreate().sparkContext


def test_parallelize_divide_como_o_pyspark(sc):
    assert sc.defaultParallelism == 4
    assert sc.parallelize(range(10), 4).glom().collect() == [[0, 1], [2, 3, 4], [5, 6], [7, 8, 9]]
    assert sc.parallelize(list(range(10)), 4).glom().collect() == [[0, 1], [2, 3], [4, 5], [6, 7, 8, 9]]
    assert sc.parallelize([1, 2, 3]).glom().collect() == [[], [1], [2], [3]]
    assert sc.parallelize([1, 2, 3]).getNumPartitions() == 4


def test_transformacoes_e_acoes(sc):
    rdd = sc.parallelize(range(1, 11))
    assert rdd.filter(lambda x: x % 2 == 0).map(lambda x: x * x).collect() == [4, 16, 36, 64, 100]
    assert rdd.reduce(lambda a, b: a + b) == 55
    assert (rdd.count(), rdd.sum(), rdd.take(3), rdd.first(), rdd.max(), rdd.mean()) == (10, 55, [1, 2, 3], 1, 10, 5.5)
    assert rdd.flatMap(lambda x: [x] * 2).count() == 20
    assert rdd.mapPartitions(lambda it: [sum(it)]).collect() == [3, 12, 13, 27]
    assert rdd.mapPartitionsWithIndex(lambda i, it: [i]).collect() == [0, 1, 2, 3]
    assert sc.parallelize(['a b', 'c']).flatMap(str.split).collect() == ['a', 'b', 'c']


def test_pares_e_shuffle(sc):
    palavras = sc.parallelize(['sol', 'mar', 'sol', 'rio', 'sol', 'mar'])
    contagem = palavras.map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b)
    assert sorted(contagem.collect()) == [('mar', 2), ('rio', 1), ('sol', 3)]
    assert contagem.getNumPartitions() == 4
    grupos = palavras.map(lambda p: (len(p), p)).groupByKey().collect()
    assert [(k, sorted(v)) for k, v in grupos] == [(3, ['mar', 'mar', 'rio', 'sol', 'sol', 'sol'])]
    assert palavras.distinct().sortBy(lambda p: p).collect() == ['mar', 'rio', 'sol']
    assert palavras.countByValue() == {'sol': 3, 'mar': 2, 'rio': 1}
    nomes = sc.parallelize([(1, 'a'), (2, 'b')])
    assert sorted(nomes.join(sc.parallelize([(1, 10), (1, 11), (3, 30)])).collect()) == [(1, ('a', 10)), (1, ('a', 11))]
    assert sorted(nomes.leftOuterJoin(sc.parallelize([(1, 10)])).collect()) == [(1, ('a', 10)), (2, ('b', None))]
    assert sc.parallelize([1, 2]).union(sc.parallelize([3])).collect() == [1, 2, 3]
    assert sc.parallelize([('b', 2), ('a', 1), ('c', 0)]).sortByKey().collect() == [('a', 1), ('b', 2), ('c', 0)]
    assert sc.parallelize([5, 1, 4]).sortBy(lambda x: x, ascending=False).collect() == [5, 4, 1]
    assert sorted(sc.parallelize([('a', 1), ('a', 3)]).mapValues(lambda v: v * 10).collect()) == [('a', 10), ('a', 30)]


def test_o_shuffle_e_deterministico(sc):
    um = sc.parallelize(['caju', 'umbu', 'pequi', 'ata'] * 3).map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b).glom().collect()
    estagios.zerar()
    dois = SparkSession.builder.getOrCreate().sparkContext.parallelize(['caju', 'umbu', 'pequi', 'ata'] * 3) \
        .map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b).glom().collect()
    assert um == dois


def test_estagios_e_metricas(sc):
    rdd = sc.parallelize(range(8), 4).map(lambda x: (x % 2, x)).reduceByKey(lambda a, b: a + b)
    assert sorted(rdd.collect()) == [(0, 12), (1, 16)]
    resumo = estagios.resumo()
    job = resumo['jobs'][-1]
    assert job['acao'] == 'collect'
    assert [e['tipo'] for e in job['estagios']] == ['shuffle', 'resultado']
    assert [len(e['tarefas']) for e in job['estagios']] == [4, 4]
    mapa = job['estagios'][0]
    assert mapa['nome'] == 'parallelize → map → reduceByKey'
    assert mapa['linhas_embaralhadas'] == 8  # combina no lado do map: 2 chaves em cada uma das 4 partições
    assert {'particao', 'worker', 'linhas', 'inicio', 'fim'} <= set(mapa['tarefas'][0])
    assert resumo['shuffles'] == 1


def test_cache_le_do_que_ja_foi_calculado(sc):
    rdd = sc.parallelize(range(4), 2).map(lambda x: x * 10).cache()
    assert rdd.is_cached
    assert rdd.collect() == [0, 10, 20, 30]
    assert rdd.map(lambda x: x + 1).collect() == [1, 11, 21, 31]
    assert estagios.resumo()['jobs'][-1]['estagios'][0]['nome'] == 'cache → map'


def test_text_file_le_na_pasta_atual(sc, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / 'frases.txt').write_text('o sertão\nvai virar mar\n', encoding='utf-8')
    linhas = sc.textFile('frases.txt')
    assert linhas.getNumPartitions() == 2
    assert linhas.collect() == ['o sertão', 'vai virar mar']
    with pytest.raises(PySparkException) as e:
        sc.textFile('nao_existe.txt').collect()
    assert e.value.getErrorClass() == 'PATH_NOT_FOUND'


def test_erro_na_lambda_sobe_com_o_mesmo_tipo(sc):
    with pytest.raises(ZeroDivisionError):
        sc.parallelize([1, 0]).map(lambda x: 1 // x).collect()
    with pytest.raises(ValueError, match='Can not reduce\\(\\) empty RDD'):
        sc.parallelize([]).reduce(lambda a, b: a + b)
```

(`textFile` divide as linhas em `minPartitions = min(defaultParallelism, 2)` partições com `fatiar_lista`; o caminho que não existe dá `AnalysisException` com a classe `PATH_NOT_FOUND`: `[PATH_NOT_FOUND] Path does not exist: file:<caminho absoluto>. SQLSTATE: 42K03`, na primeira ação, porque o `textFile` é preguiçoso como no Spark.)

Run: `python -m pytest python/tests/test_spark_rdd.py -q`
Expected: FAIL (`No module named 'pyspark'`).

- [ ] **Step 2: Implementar o motor, o contexto e o RDD**

Siga as interfaces acima. Pontos que os testes não mostram:

- `pyspark/__init__.py` reexporta `SparkContext`, `SparkConf`, `RDD`, `StorageLevel` e `__version__ = '4.0.1'` (o DataFrame chega na Task 3). Comentário no topo: é uma implementação para aprender, com a API do PySpark 4, e não o Spark.
- O `SparkSession` desta task guarda a configuração num dicionário com os padrões `{'spark.default.parallelism': '4', 'spark.sql.shuffle.partitions': '4', 'spark.sql.autoBroadcastJoinThreshold': '10485760', 'spark.sql.adaptive.enabled': 'true', 'spark.app.name': 'DivergePython', 'spark.master': 'local[4]'}`. `builder.config(k, v)`, `.appName`, `.master` gravam ali, e `getOrCreate()` devolve a sessão única. `pyspark.sql.session` registra em `estagios.AO_ZERAR` uma função que apaga a sessão e o contexto, para cada execução do aluno começar do zero.
- A função que vai ao pool é `pyspark._motor._rodar_cadeia(funcoes, dados)`, de nível de módulo (o cloudpickle a manda por referência; o worker tem o pacote `pyspark` montado). As `lambda` do aluno vão por valor.
- Os nomes das operações nos estágios são os da API: `parallelize`, `textFile`, `map`, `flatMap`, `filter`, `mapPartitions`, `glom`, `mapValues`, `reduceByKey`, `groupByKey`, `sortBy`, `join`, `distinct`, `union`, `repartition`, `cache`.

Run: `python -m pytest python/tests -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "pyspark: SparkContext, RDD e motor de estágios com shuffle determinístico"
```

---

### Task 3: `pyspark.sql` — tipos, Row, colunas, `functions` e o DataFrame estreito

**Files:**
- Create: `python/pyspark/sql/types.py`, `python/pyspark/sql/column.py`, `python/pyspark/sql/functions.py`, `python/pyspark/sql/plano.py`, `python/pyspark/sql/dataframe.py`, `python/pyspark/sql/utils.py`, `python/pyspark/sql/mostrar.py` (formatação do `show`, `printSchema` e dos valores)
- Modify: `python/pyspark/sql/__init__.py`, `python/pyspark/sql/session.py` (`createDataFrame`, `range`), `python/pyspark/rdd.py` (`toDF`), `pytest.ini` (`pythonpath` com `python/conformidade`, para os testes usarem `operadores`)
- Create: `python/conformidade/_comum.py` (só `operadores(texto)` e `primeira_linha(erro)` nesta task; a sessão e os programas vêm na Task 6)
- Test: `python/tests/test_spark_df.py`

**Interfaces:**
- Produces `pyspark.sql.types`: `DataType` com `simpleString()` (`string`, `int`, `bigint`, `double`, `float`, `boolean`, `date`, `timestamp`, `array<string>`, `struct<a:string,b:bigint>`) e `typeName()` (`string`, `integer`, `long`, `double`, `boolean`, `date`, `timestamp`, `array`, `struct`); `StringType`, `IntegerType`, `LongType`, `DoubleType`, `FloatType`, `BooleanType`, `DateType`, `TimestampType`, `NullType`, `ArrayType(elemento, containsNull=True)`, `StructField(nome, tipo, nullable=True)`, `StructType(campos)` (`add`, `fieldNames()`, `simpleString`, `treeString`, iterável, `__getitem__` por nome); `Row` (subclasse de `tuple` com `__fields__`, acesso por atributo e por nome, `asDict()`, `Row(nome='Ana')` e `Row('nome', 'idade')('Ana', 3)`, `repr` `Row(nome='Ana', idade=30)`); `ler_ddl(texto) → StructType` (`"nome STRING, idade INT, tags ARRAY<STRING>"`, sem diferenciar maiúsculas); `inferir_tipo(valor)` (`bool`→boolean, `int`→bigint, `float`→double, `str`→string, `date`→date, `datetime`→timestamp, `list`→array; `None`→NullType) e `juntar_tipos(a, b)` (NullType some; tipos diferentes dão `PySparkTypeError` `[CANNOT_MERGE_TYPE]`); coluna só com `None` dá `PySparkValueError` `[CANNOT_DETERMINE_TYPE] Some of types cannot be determined after inferring.`
- Produces `pyspark.sql.column.Column`: expressão com `nome()` (o nome automático do Spark), `tipo(entrada)` e `compilar(entrada) → função(linha_tuple) → valor`, resolvida contra a saída do plano filho (atributos com id único, como o `#12` do Spark; nomes sem diferenciar maiúsculas). Operadores `+ - * / % ** == != < <= > >= & | ~` (e os reversos), `alias`/`name`, `cast`/`astype` (por tipo ou texto), `isNull`, `isNotNull`, `isin`, `between`, `like`, `rlike`, `startswith`, `endswith`, `contains`, `substr`, `asc`, `desc`, `asc_nulls_last`, `desc_nulls_first`, `over` (Task 4), `getItem`, `otherwise` (no `when`). Lógica de três valores com `None`, como no SQL.
- Nomes automáticos (o que o `show` e o `columns` mostram): `(a + 1)`, `(a * b)`, `(a > 1)`, `((a > 1) AND (b < 2))`, `(NOT a)`, `(a IS NULL)`, `(a IS NOT NULL)`, `(a IN (1, 2))`, `((a >= 1) AND (a <= 2))` (between), `a LIKE x%`, `upper(a)`, `round(avg(v), 2)`, `CASE WHEN (idade > 18) THEN adulto ELSE menor END`, `CAST(a AS INT)`, `concat_ws(-, a, b)`, `substring(s, 1, 3)`, `coalesce(a, b)`, literais sem aspas (`1`, `x`), `<lambda>(produto)` e `dobro(x)` nas UDFs.
- Tipos das expressões: `long + long → bigint`, `int` com `long` → `bigint`, qualquer um com `double` → `double`, `/` → `double`, comparações → `boolean`, `length`/`year`/`month`/`dayofmonth` → `int`, `round(double)` → `double`, `round(bigint)` → `bigint`, `when` → o tipo comum dos ramos, `cast` → o pedido.
- Produces `pyspark.sql.functions` (estreitas, nesta task): `col`, `column`, `lit`, `expr` (Task 5), `when`, `coalesce`, `isnull`, `isnan`, `upper`, `lower`, `trim`, `ltrim`, `rtrim`, `initcap`, `length`, `substring`, `concat`, `concat_ws`, `split`, `regexp_replace`, `regexp_extract`, `lpad`, `rpad`, `round`, `abs`, `sqrt`, `floor`, `ceil`, `pow`, `greatest`, `least`, `year`, `month`, `dayofmonth`, `dayofweek`, `to_date`, `to_timestamp`, `date_format`, `datediff`, `date_add`, `date_sub`, `current_date`, `size`, `array`, `array_contains`, `sort_array`, `explode` (Task 5), `asc`, `desc`, `broadcast` (Task 4), `udf` (Task 5).
- Produces `pyspark.sql.plano`: nós do plano físico com `saida` (atributos), `filhos`, `explicar(nivel) → linhas`, `num_particoes()`, `tamanho()` (bytes estimados, Task 4), `para_rdd() → RDD de tuplas`. Nesta task: `ScanRDD` (`Scan ExistingRDD[a#0L,b#1]`, o que o PySpark mostra para `createDataFrame` de uma lista), `Range` (`Range (0, 10, step=1, splits=4)`), `Project` (`Project [a#0L, (b#1 * 2) AS x#5]`), `Filter` (`Filter (a#0L > 1)`), `CollectLimit` / `GlobalLimit`.
- Produces `pyspark.sql.DataFrame` (estreito, nesta task): `columns`, `dtypes`, `schema`, `printSchema()`, `show(n=20, truncate=True, vertical=False)`, `collect`, `count`, `take`, `first`, `head(n=None)`, `limit`, `select`, `filter`/`where` (com `Column`; texto na Task 5), `withColumn`, `withColumns`, `withColumnRenamed`, `drop`, `toDF(*nomes)`, `alias`, `df['col']`, `df.col`, `rdd`, `na.fill`/`fillna`, `na.drop`/`dropna`, `explain(extended=False, mode=None)`, `cache`/`persist`/`unpersist`/`is_cached` (Task 4), `isEmpty()`, `toPandas()` (dá `NotImplementedError` explicando que o pandas não é carregado e sugerindo `collect()` ou `show()`), `_plano_resumo()` (Task 4) e `_diverge_tabela(limite)` (Task 4). `repr` `DataFrame[produto: string, quantidade: bigint]`.
- `SparkSession.createDataFrame(dados, schema=None)`: `dados` é lista de tuplas, listas, dicionários (chaves em ordem alfabética, como o PySpark), `Row` ou um `RDD`; `schema` é lista de nomes, texto DDL ou `StructType`. Vira `ScanRDD` com `sc.parallelize(linhas)` (4 partições, mesmo com 3 linhas). Valores conferidos contra o schema (`PySparkTypeError` `[FIELD_DATA_TYPE_UNACCEPTABLE]` quando um texto vai numa coluna `bigint`). `spark.range(inicio, fim=None, passo=1, numPartitions=None)` dá a coluna `id` (`bigint`).

Formatação (em `mostrar.py`, a mesma do Spark 4):

- `show()`: cada coluna tem largura `max(3, cabeçalho, maior célula)`; com `truncate=True` (20), células e cabeçalhos alinhados à direita e texto com mais de 20 caracteres vira os 17 primeiros + `...`; com `truncate=False`, alinhados à esquerda e sem corte; um `truncate` numérico `n` corta em `n` (`n - 3` + `...`, ou só `n` se `n < 4`). Linha de borda `+---+`, cabeçalho, borda, linhas, borda. Se havia mais linhas que `n`: `only showing top N rows` (`row` no singular quando `n == 1`). Depois, uma linha em branco. A largura conta caracteres (não bytes).
- Valores no `show`: `None` → `NULL`; `True` → `true`; `double` como o `Double.toString` do Java (`4.0`, `24.9`, `0.30000000000000004`, `1.0E7`, `1.0E-4`: notação científica fora de `[1e-3, 1e7)`); `date` → `2026-10-13`; `timestamp` → `2026-10-13 10:00:00`; listas → `[a, b]` (elementos com as mesmas regras); `Row`/struct → `{a, 1}`.
- `printSchema()`: `root`, uma linha ` |-- nome: tipo (nullable = true)` por campo (com `typeName`: `long`, `integer`…), arrays com ` |    |-- element: string (containsNull = true)`, e uma linha em branco no fim.
- `explain()`: `== Physical Plan ==`, depois `AdaptiveSparkPlan isFinalPlan=false` quando `spark.sql.adaptive.enabled` é `true`, e o plano em árvore com `+- ` e `:- ` como no Spark (filhos indentados com 3 espaços), atributos com `#id` (`L` no fim para `bigint`, como `id#0L`) e uma linha em branco no fim.

Erros de análise (lançados já na transformação, como no Spark):

```text
[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `idadee` cannot be resolved. Did you mean one of the following? [`idade`, `nome`]. SQLSTATE: 42703;
```

(sugestões: as colunas disponíveis em ordem de distância de Levenshtein, empate pela ordem original, no máximo 5; o nome vem entre crases); `[AMBIGUOUS_REFERENCE] Reference `id` is ambiguous, could be: [`id`, `id`]. SQLSTATE: 42704;`.

`python/conformidade/_comum.py` (nesta task, o começo):

```python
"""Ajudantes dos programas de conformidade (rodam no PySpark real e no nosso)."""
import contextlib
import io
import re

# Só os operadores que mudam a forma do plano: Project, Filter e scans variam entre o Spark e o nosso.
OPERADORES = ('HashAggregate', 'SortMergeJoin', 'BroadcastHashJoin', 'BroadcastExchange', 'Sort',
              'Window', 'InMemoryTableScan', 'BatchEvalPython', 'Exchange')


def operadores(texto):
    """Os operadores do explain(), em ordem, com o tipo de particionamento do Exchange."""
    if not isinstance(texto, str):  # um DataFrame
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            texto.explain()
        texto = saida.getvalue()
    achados = []
    for linha in texto.splitlines():
        m = re.match(r'^[\s:+\-|]*(?:\*\(\d+\)\s*)?([A-Za-z]+)(?:\s+(\w+))?', linha)
        if not m or m.group(1) not in OPERADORES:
            continue
        nome = m.group(1)
        if nome == 'Exchange':
            nome += ' ' + (m.group(2) or '')
        achados.append(nome.strip())
    return achados


def primeira_linha(erro):
    return str(erro).splitlines()[0]
```

- [ ] **Step 1: Testes que falham**

`python/tests/test_spark_df.py`:

```python
"""DataFrame do pyspark do DivergePython: schema, show, colunas, funções, nulos e erros no formato do Spark 4."""
import datetime

import pytest

from _comum import operadores
from diverge_runtime import estagios
from pyspark.errors import AnalysisException, PySparkTypeError, PySparkValueError
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, IntegerType, LongType, StringType, StructField, StructType

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]


@pytest.fixture
def spark():
    estagios.zerar()
    return SparkSession.builder.appName('teste').getOrCreate()


def vendas(spark):
    return spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])


def test_schema_inferido(spark, capsys):
    df = vendas(spark)
    assert df.dtypes == [('produto', 'string'), ('regiao', 'string'), ('quantidade', 'bigint'), ('preco', 'double')]
    assert repr(df) == 'DataFrame[produto: string, regiao: string, quantidade: bigint, preco: double]'
    assert df.schema == StructType([StructField('produto', StringType()), StructField('regiao', StringType()),
                                    StructField('quantidade', LongType()), StructField('preco', DoubleType())])
    df.printSchema()
    assert capsys.readouterr().out == (
        'root\n |-- produto: string (nullable = true)\n |-- regiao: string (nullable = true)\n'
        ' |-- quantidade: long (nullable = true)\n |-- preco: double (nullable = true)\n\n')
    assert df.rdd.getNumPartitions() == 4
    assert spark.createDataFrame([{'b': 1, 'a': 'x'}]).columns == ['a', 'b']
    assert spark.createDataFrame([Row(nome='Ana', idade=3)]).dtypes == [('nome', 'string'), ('idade', 'bigint')]
    with pytest.raises(PySparkValueError, match='CANNOT_DETERMINE_TYPE'):
        spark.createDataFrame([(None,)], ['x'])
    with pytest.raises(PySparkTypeError, match='CANNOT_MERGE_TYPE'):
        spark.createDataFrame([(1,), ('a',)], ['x'])


def test_show_como_o_spark(spark, capsys):
    vendas(spark).show()
    assert capsys.readouterr().out == (
        '+--------+--------+----------+-----+\n'
        '| produto|  regiao|quantidade|preco|\n'
        '+--------+--------+----------+-----+\n'
        '|   Arroz|Nordeste|         2| 24.9|\n'
        '|  Feijão| Sudeste|         3|  8.5|\n'
        '|    Café|Nordeste|         1| 19.9|\n'
        '|Rapadura|   Norte|        10|  2.5|\n'
        '+--------+--------+----------+-----+\n\n')
    vendas(spark).show(2)
    assert capsys.readouterr().out == (
        '+-------+--------+----------+-----+\n'
        '|produto|  regiao|quantidade|preco|\n'
        '+-------+--------+----------+-----+\n'
        '|  Arroz|Nordeste|         2| 24.9|\n'
        '| Feijão| Sudeste|         3|  8.5|\n'
        '+-------+--------+----------+-----+\n'
        'only showing top 2 rows\n\n')
    vendas(spark).select('produto').show(1, truncate=False)
    assert capsys.readouterr().out == '+-------+\n|produto|\n+-------+\n|Arroz  |\n+-------+\nonly showing top 1 row\n\n'


def test_valores_especiais_no_show(spark, capsys):
    df = spark.createDataFrame(
        [('um texto bem comprido demais', None, 10000000.0, True, datetime.date(2026, 10, 13), ['a', 'b'])],
        'texto string, nada string, grande double, ok boolean, dia date, tags array<string>')
    df.show()
    assert capsys.readouterr().out == (
        '+--------------------+----+------+----+----------+------+\n'
        '|               texto|nada|grande|  ok|       dia|  tags|\n'
        '+--------------------+----+------+----+----------+------+\n'
        '|um texto bem comp...|NULL| 1.0E7|true|2026-10-13|[a, b]|\n'
        '+--------------------+----+------+----+----------+------+\n\n')
    df.select('tags').printSchema()
    assert capsys.readouterr().out == 'root\n |-- tags: array (nullable = true)\n |    |-- element: string (containsNull = true)\n\n'


def test_colunas_e_nomes_automaticos(spark):
    df = vendas(spark)
    r = df.select('produto', F.col('quantidade') * F.col('preco'), (F.col('preco') > 10).alias('caro'), F.upper('regiao'))
    assert r.columns == ['produto', '(quantidade * preco)', 'caro', 'upper(regiao)']
    assert r.filter(F.col('caro')).count() == 2
    assert df.filter((df.preco > 5) & (df['regiao'] == 'Nordeste')).count() == 2
    t = (df.withColumn('total', F.round(F.col('quantidade') * F.col('preco'), 2))
           .withColumnRenamed('produto', 'item').drop('regiao'))
    assert t.columns == ['item', 'quantidade', 'preco', 'total']
    assert [row.total for row in t.collect()] == [49.8, 25.5, 19.9, 25.0]
    assert t.collect()[0] == Row(item='Arroz', quantidade=2, preco=24.9, total=49.8)
    assert repr(t.first()) == "Row(item='Arroz', quantidade=2, preco=24.9, total=49.8)"
    assert t.first().asDict() == {'item': 'Arroz', 'quantidade': 2, 'preco': 24.9, 'total': 49.8}
    assert df.select((F.col('quantidade') / 4).alias('x')).first().x == 0.5
    assert df.select(F.col('quantidade').isin(1, 2)).columns == ['(quantidade IN (1, 2))']
    assert df.limit(2).count() == 2 and df.take(1) == [Row(produto='Arroz', regiao='Nordeste', quantidade=2, preco=24.9)]
    assert [r.id for r in spark.range(1, 7, 2).collect()] == [1, 3, 5]


def test_when_strings_datas_e_cast(spark):
    df = spark.createDataFrame([('  ana ', 17, '2026-03-05'), ('BIA', 30, '2025-12-31')], ['nome', 'idade', 'nascimento'])
    r = df.select(
        F.initcap(F.trim('nome')).alias('nome'),
        F.when(F.col('idade') >= 18, 'adulto').otherwise('menor').alias('faixa'),
        F.year(F.to_date('nascimento')).alias('ano'),
        F.col('idade').cast('string').alias('texto'),
        F.concat_ws('-', F.lower(F.trim('nome')), F.col('idade')).alias('chave'),
    )
    assert [tuple(x) for x in r.collect()] == [('Ana', 'menor', 2026, '17', 'ana-17'), ('Bia', 'adulto', 2025, '30', 'bia-30')]
    assert r.dtypes == [('nome', 'string'), ('faixa', 'string'), ('ano', 'int'), ('texto', 'string'), ('chave', 'string')]
    assert df.select(F.when(F.col('idade') > 18, 'adulto').otherwise('menor')).columns == ['CASE WHEN (idade > 18) THEN adulto ELSE menor END']
    assert df.select(F.col('idade').cast(IntegerType())).dtypes == [('idade', 'int')]
    assert df.select(F.to_date('nascimento').alias('d')).first().d == datetime.date(2026, 3, 5)
    assert df.select(F.datediff(F.to_date(F.lit('2026-03-10')), F.to_date('nascimento'))).first()[0] == 5
    assert df.select(F.substring('nascimento', 1, 4)).columns == ['substring(nascimento, 1, 4)']
    assert df.select(F.split('nascimento', '-').alias('p')).first().p == ['2026', '03', '05']


def test_nulos(spark):
    df = spark.createDataFrame([('Ana', None, 7.5), ('Bia', 'Recife', None), (None, None, None)], 'nome string, cidade string, nota double')
    assert df.na.fill({'cidade': 'Desconhecida', 'nota': 0.0}).collect()[0].cidade == 'Desconhecida'
    assert df.na.drop().count() == 0
    assert df.na.drop(how='all').count() == 2
    assert df.dropna(subset=['nome']).count() == 2
    assert df.fillna(0).collect()[1].nota == 0.0
    assert df.fillna('?').collect()[2].nome == '?'
    assert df.filter(F.col('cidade').isNull()).count() == 2
    assert [r[0] for r in df.select(F.coalesce('cidade', 'nome', F.lit('?'))).collect()] == ['Ana', 'Recife', '?']
    assert df.filter(F.col('nota') > 5).count() == 1  # NULL > 5 não é verdadeiro


def test_erros_como_o_spark(spark):
    df = spark.createDataFrame([('Ana', 30)], ['nome', 'idade'])
    with pytest.raises(AnalysisException) as e:
        df.select('idadee')
    assert str(e.value).splitlines()[0] == (
        '[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `idadee` '
        'cannot be resolved. Did you mean one of the following? [`idade`, `nome`]. SQLSTATE: 42703;')
    assert e.value.getErrorClass() == 'UNRESOLVED_COLUMN.WITH_SUGGESTION'
    with pytest.raises(AnalysisException):
        df.filter(F.col('cidade') == 'Recife')
    with pytest.raises(NotImplementedError, match='pandas'):
        df.toPandas()


def test_explain_estreito(spark, capsys):
    vendas(spark).filter(F.col('preco') > 10).select('produto').explain()
    saida = capsys.readouterr().out
    assert saida.startswith('== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Project [produto#')
    assert 'Filter (preco#' in saida and 'Scan ExistingRDD[produto#' in saida
    assert operadores(saida) == []
    assert saida.endswith('\n\n')


def test_rdd_vira_dataframe_e_volta(spark):
    sc = spark.sparkContext
    df = sc.parallelize([('a', 1), ('b', 2)]).toDF(['letra', 'n'])
    assert df.dtypes == [('letra', 'string'), ('n', 'bigint')]
    assert df.rdd.map(lambda r: r.n * 10).collect() == [10, 20]
    assert spark.createDataFrame(sc.parallelize([Row(x=1)])).first().x == 1
```

Run: `python -m pytest python/tests/test_spark_df.py -q`
Expected: FAIL (`cannot import name 'Row'`).

- [ ] **Step 2: Implementar**

Siga as interfaces e a formatação acima. Pontos que os testes não mostram:

- Cada expressão resolvida vira uma função Python de nível de módulo ou um fechamento simples (o cloudpickle manda fechamentos por valor). Os nós do plano compilam a lista de expressões uma vez por partição, dentro da tarefa.
- `Project` e `Filter` viram `mapPartitions` no RDD (estágio estreito, nome `select`/`filter`/`withColumn` no estágio). `CollectLimit n` traz só `n` linhas por partição.
- O `show` roda um job `show`, o `count` um job `count` (cada partição devolve só o número), o `collect` um job `collect`.
- `df.rdd` devolve um RDD de `Row`; `Row` é serializável pelo cloudpickle (classe de módulo).
- `F.to_date(col, formato=None)` aceita `yyyy-MM-dd` (padrão), `dd/MM/yyyy` e `yyyyMMdd` (conversão do padrão do Java para o `strptime`); texto inválido vira `NULL`, como no Spark com o ANSI desligado. `cast` de texto inválido para número também vira `NULL`.

Run: `python -m pytest python/tests -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "pyspark.sql: tipos, Row, colunas, functions, show, printSchema e erros no formato do Spark"
```

---

### Task 4: DataFrame largo — agregações, pivot, joins, broadcast, Window, cache, partições e o resumo do plano

**Files:**
- Create: `python/pyspark/sql/window.py`, `python/pyspark/sql/group.py` (`GroupedData`)
- Modify: `python/pyspark/sql/plano.py`, `python/pyspark/sql/dataframe.py`, `python/pyspark/sql/column.py`, `python/pyspark/sql/functions.py`
- Test: `python/tests/test_spark_largas.py`

**Interfaces:**
- Produces nós do plano: `HashAggregate` (parcial e final, `HashAggregate(keys=[regiao#1], functions=[partial_sum(quantidade#2L)])` e `functions=[sum(quantidade#2L)]`), `Exchange` (`Exchange hashpartitioning(regiao#1, 4), ENSURE_REQUIREMENTS, [plan_id=N]`, `rangepartitioning(total#5 DESC NULLS LAST, 4)`, `SinglePartition`, `RoundRobinPartitioning(3), REPARTITION_BY_NUM`), `Sort` (`Sort [total#5 DESC NULLS LAST], true, 0`), `BroadcastExchange`, `BroadcastHashJoin [id#0L], [id#4L], Inner, BuildRight, false`, `SortMergeJoin [id#0L], [id#4L], Inner` (com `Sort` e `Exchange hashpartitioning` nos dois lados), `Window [row_number() windowspecdefinition(...) AS rn#9], [regiao#1], [receita#2L DESC NULLS LAST]`, `Union`, `Coalesce 1`, `InMemoryTableScan [cols]` com `InMemoryRelation [cols], StorageLevel(disk, memory, deserialized, 1 replicas)` e o plano guardado embaixo.
- Produces `DataFrame`: `groupBy`/`groupby(*cols)` → `GroupedData` com `agg(*exprs | dict)`, `count()`, `sum/avg/mean/min/max(*cols)`, `pivot(col, valores=None)`; `agg(*exprs)` (sem chaves: `Exchange SinglePartition`); `orderBy`/`sort(*cols, ascending=True | lista)`; `distinct()`; `dropDuplicates(subset=None)`/`drop_duplicates`; `join(outro, on=None, how='inner')` com `how` em `inner`, `left`/`left_outer`, `right`/`right_outer`, `full`/`outer`/`full_outer`, `semi`/`left_semi`, `anti`/`left_anti`, `cross`; `crossJoin`; `union`/`unionAll` (por posição), `unionByName(outro, allowMissingColumns=False)`; `repartition(n, *cols)` / `repartition(*cols)`; `coalesce(n)`; `cache()`, `persist(nivel)`, `unpersist()`, `is_cached`, `storageLevel`; `_plano_resumo() → {'shuffles', 'broadcast', 'cache', 'particoes', 'estagios'}`; `_diverge_tabela(limite) → {'colunas': [{'nome', 'tipo'}], 'linhas': [[json]], 'total': int, 'ordenado': bool, 'plano': _plano_resumo()}`.
- Produces `functions` (agregações e janelas): `count` (`count("*")` → `count(1)`), `sum`, `avg`, `mean` (nome `avg(x)`), `min`, `max`, `countDistinct`/`count_distinct` (`count(DISTINCT x)`), `sum_distinct`, `collect_list`, `collect_set`, `first`, `last`, `stddev`, `variance`, `approx_count_distinct`, `broadcast(df)`, `row_number`, `rank`, `dense_rank`, `percent_rank`, `ntile`, `lag(col, offset=1, default=None)`, `lead`, e as agregações usadas com `.over(janela)`. `pyspark.sql.Window` / `pyspark.sql.window.Window`: `partitionBy`, `orderBy`, `rowsBetween`, `rangeBetween`, `unboundedPreceding`, `unboundedFollowing`, `currentRow`.
- Regras do plano:
  - Cada `Exchange` de shuffle conta 1 em `shuffles`; `BroadcastExchange` não conta. `estagios = shuffles + 1`. Os shuffles dentro de um `InMemoryRelation` já calculado não contam (não rodam de novo).
  - `particoes`: `ScanRDD` → as do RDD (4); leitura de arquivo → 1 por arquivo (Task 5); `Exchange` de hash/range → `spark.sql.shuffle.partitions`; `SinglePartition` → 1; `repartition(n)` → `n`; `coalesce(n)` → `min(n, filho)`; `Union` → soma; os outros → o do filho.
  - Broadcast: `BroadcastHashJoin` quando há `F.broadcast(...)` num lado que pode ser o construído, ou quando o `tamanho()` estimado de um lado é ≤ `spark.sql.autoBroadcastJoinThreshold` (padrão 10 MB; `-1` desliga). Estimativa, como o Spark sem CBO: `ScanRDD` → infinito (o PySpark não sabe o tamanho de um RDD, por isso joins de `createDataFrame` viram `SortMergeJoin`); `Range` → linhas × 8; leitura de arquivo → bytes dos arquivos; `Project`/`Filter`/`Sort`/`Window`/`Exchange` → o do filho; `HashAggregate` sem chaves → 8 + tamanho de uma linha; `Limit n` → `n` × tamanho de uma linha (8 + 8 por número, 20 por texto); `Union` → soma; join → infinito (semi/anti: o lado esquerdo). Lado construído: `inner` → o menor dos que cabem (direita no empate); `left`/`semi`/`anti` → só a direita; `right` → só a esquerda; `full` → nunca.
  - Ordenação: `asc` põe `NULL` primeiro, `desc` põe `NULL` por último (como o Spark).
  - `orderBy` faz `Exchange rangepartitioning` (um job `amostra` para os limites, como no RDD) e `Sort` global; `show`/`collect` devolvem a ordem global.
  - `Window`: `Exchange hashpartitioning` pelas chaves de `partitionBy` (sem chaves: `SinglePartition`), `Sort` local e o cálculo. Quadro padrão com `orderBy`: `RANGE` do início até a linha atual, **incluindo os empates**; sem `orderBy`: a partição inteira. `rowsBetween(a, b)` conta linhas.
  - `join` com `on` em texto ou lista de textos: a coluna da chave sai uma vez só, no começo (no `full`, `coalesce` dos dois lados); com expressão, as duas colunas ficam (e `select('id')` dá `AMBIGUOUS_REFERENCE`).
  - `pivot`: valores distintos em ordem crescente (um job a mais para descobri-los, se não vierem na chamada); uma coluna por valor (com uma agregação) ou `valor_agregação` (com várias).
  - `cache()`: na primeira ação, o resultado do plano fica guardado (por partição); depois, o plano vira `InMemoryTableScan` (que não roda os estágios de novo).
  - `_diverge_tabela` calcula em `estagios.local()` (feito pela Task 1), converte cada valor para JSON (`date`/`datetime` → texto ISO como no `show`; `Row` → dicionário; números não finitos → `None`) e marca `ordenado: True` quando o nó de cima do plano (ignorando `Project`/`Filter`/`Limit`) é um `Sort` global.

- [ ] **Step 1: Testes que falham**

`python/tests/test_spark_largas.py`:

```python
"""Transformações largas do DataFrame: estágios, shuffles, broadcast, janelas e cache."""
import pytest

from _comum import operadores
from diverge_runtime import estagios
from pyspark.errors import AnalysisException
from pyspark.sql import Row, SparkSession, Window
from pyspark.sql import functions as F

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]


@pytest.fixture
def spark():
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def vendas(spark):
    return spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])


def tuplas(df):
    return [tuple(r) for r in df.collect()]


def test_group_by_e_agg(spark):
    r = (vendas(spark).groupBy('regiao')
         .agg(F.sum('quantidade'), F.round(F.avg('preco'), 2).alias('preco_medio'), F.count('*'), F.countDistinct('produto'))
         .orderBy('regiao'))
    assert r.columns == ['regiao', 'sum(quantidade)', 'preco_medio', 'count(1)', 'count(DISTINCT produto)']
    assert tuplas(r) == [('Nordeste', 3, 22.4, 2, 2), ('Norte', 10, 2.5, 1, 1), ('Sudeste', 3, 8.5, 1, 1)]
    assert r.dtypes[1] == ('sum(quantidade)', 'bigint') and r.dtypes[3] == ('count(1)', 'bigint')
    assert vendas(spark).groupBy('regiao').count().orderBy(F.desc('count'), 'regiao').first() == Row(regiao='Nordeste', count=2)
    assert vendas(spark).agg(F.max('preco').alias('m')).first().m == 24.9
    assert vendas(spark).groupBy('regiao').agg({'preco': 'max'}).columns == ['regiao', 'max(preco)']
    listas = vendas(spark).groupBy('regiao').agg(F.sort_array(F.collect_list('produto')).alias('p')).orderBy('regiao')
    assert tuplas(listas)[0] == ('Nordeste', ['Arroz', 'Café'])


def test_pivot(spark):
    df = spark.createDataFrame([('caju', 'jan', 3), ('caju', 'fev', 1), ('umbu', 'jan', 2)], ['fruta', 'mes', 'qtd'])
    p = df.groupBy('fruta').pivot('mes').sum('qtd').orderBy('fruta')
    assert p.columns == ['fruta', 'fev', 'jan']
    assert tuplas(p) == [('caju', 1, 3), ('umbu', None, 2)]
    assert df.groupBy('fruta').pivot('mes', ['jan']).agg(F.sum('qtd')).orderBy('fruta').columns == ['fruta', 'jan']


def test_ordenacao_com_nulos(spark):
    df = spark.createDataFrame([(1, None), (2, 5), (3, 1)], 'id bigint, v bigint')
    assert [r.id for r in df.orderBy('v').collect()] == [1, 3, 2]
    assert [r.id for r in df.orderBy(F.desc('v')).collect()] == [2, 3, 1]
    assert [r.id for r in df.orderBy(['v', 'id'], ascending=[False, True]).collect()] == [2, 3, 1]


def test_joins(spark):
    cli = spark.createDataFrame([(1, 'Ana'), (2, 'Bia'), (3, 'Caio')], ['id', 'nome'])
    ped = spark.createDataFrame([(1, 50.0), (1, 20.0), (3, 10.0), (4, 5.0)], ['id', 'valor'])

    def linhas(df):
        return sorted(tuplas(df), key=str)

    assert linhas(cli.join(ped, 'id')) == [(1, 'Ana', 20.0), (1, 'Ana', 50.0), (3, 'Caio', 10.0)]
    assert (2, 'Bia', None) in linhas(cli.join(ped, 'id', 'left'))
    assert (4, None, 5.0) in linhas(cli.join(ped, ['id'], 'right'))
    assert len(linhas(cli.join(ped, 'id', 'full'))) == 5
    assert linhas(cli.join(ped, 'id', 'left_semi')) == [(1, 'Ana'), (3, 'Caio')]
    assert linhas(cli.join(ped, 'id', 'left_anti')) == [(2, 'Bia')]
    e = cli.join(ped, cli.id == ped.id)
    assert e.columns == ['id', 'nome', 'id', 'valor']
    assert linhas(e.select(cli.nome, ped.valor)) == [('Ana', 20.0), ('Ana', 50.0), ('Caio', 10.0)]
    with pytest.raises(AnalysisException) as erro:
        e.select('id')
    assert erro.value.getErrorClass() == 'AMBIGUOUS_REFERENCE'


def test_plano_broadcast_e_sort_merge(spark):
    cli = spark.createDataFrame([(1, 'Ana')], ['id', 'nome'])
    ped = spark.createDataFrame([(1, 5.0)], ['id', 'valor'])
    j = cli.join(ped, 'id')
    assert j._plano_resumo() == {'shuffles': 2, 'broadcast': False, 'cache': False, 'particoes': 4, 'estagios': 3}
    assert operadores(_explain(j)) == ['SortMergeJoin', 'Sort', 'Exchange hashpartitioning', 'Sort', 'Exchange hashpartitioning']
    b = cli.join(F.broadcast(ped), 'id')
    assert b._plano_resumo() == {'shuffles': 0, 'broadcast': True, 'cache': False, 'particoes': 4, 'estagios': 1}
    assert operadores(_explain(b)) == ['BroadcastHashJoin', 'BroadcastExchange']
    pequeno = spark.range(3)
    assert spark.range(10).join(pequeno, 'id')._plano_resumo()['broadcast'] is True
    spark.conf.set('spark.sql.autoBroadcastJoinThreshold', '-1')
    assert spark.range(10).join(pequeno, 'id')._plano_resumo()['broadcast'] is False
    assert sorted(r.id for r in b.collect()) == [1]


def _explain(df):
    import contextlib
    import io
    saida = io.StringIO()
    with contextlib.redirect_stdout(saida):
        df.explain()
    return saida.getvalue()


def test_explain_e_estagios_do_group_by(spark):
    df = vendas(spark).groupBy('regiao').sum('quantidade')
    texto = _explain(df)
    assert texto.startswith('== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- HashAggregate(keys=[regiao#')
    assert operadores(texto) == ['HashAggregate', 'Exchange hashpartitioning', 'HashAggregate']
    assert 'functions=[partial_sum(quantidade#' in texto
    assert operadores(_explain(vendas(spark).orderBy(F.desc('preco')))) == ['Sort', 'Exchange rangepartitioning']
    assert operadores(_explain(vendas(spark).repartition(3))) == ['Exchange RoundRobinPartitioning']
    spark.conf.set('spark.sql.adaptive.enabled', 'false')
    assert 'AdaptiveSparkPlan' not in _explain(df)
    estagios.zerar()
    spark = SparkSession.builder.getOrCreate()
    vendas(spark).groupBy('regiao').count().show()
    job = estagios.resumo()['jobs'][-1]
    assert job['acao'] == 'show'
    assert [e['tipo'] for e in job['estagios']] == ['shuffle', 'resultado']
    assert [len(e['tarefas']) for e in job['estagios']] == [4, 4]


def test_resumo_do_plano(spark):
    df = vendas(spark)
    assert df._plano_resumo() == {'shuffles': 0, 'broadcast': False, 'cache': False, 'particoes': 4, 'estagios': 1}
    assert df.groupBy('regiao').count().orderBy('count')._plano_resumo()['shuffles'] == 2
    assert df.repartition(3)._plano_resumo()['particoes'] == 3
    assert df.repartition(2, 'regiao').rdd.getNumPartitions() == 2
    assert df.coalesce(1)._plano_resumo() == {'shuffles': 0, 'broadcast': False, 'cache': False, 'particoes': 1, 'estagios': 1}
    spark.conf.set('spark.sql.shuffle.partitions', '8')
    assert df.groupBy('regiao').count()._plano_resumo()['particoes'] == 8
    assert df.distinct()._plano_resumo()['shuffles'] == 1


def test_cache(spark):
    c = vendas(spark).groupBy('regiao').count().cache()
    assert c.is_cached
    assert c.count() == 3
    assert c._plano_resumo()['cache'] is True
    assert c.orderBy('regiao')._plano_resumo()['shuffles'] == 1  # o shuffle do groupBy já está guardado
    assert 'InMemoryTableScan' in operadores(_explain(c))
    c.unpersist()
    assert not c.is_cached


def test_janelas(spark):
    df = spark.createDataFrame([('NE', 'a', 10), ('NE', 'b', 30), ('NE', 'c', 20), ('S', 'd', 5)], ['regiao', 'loja', 'receita'])
    w = Window.partitionBy('regiao').orderBy(F.desc('receita'))
    r = df.select('loja', F.row_number().over(w).alias('rn'), F.rank().over(w).alias('rk'),
                  F.dense_rank().over(w).alias('dr'), F.lag('receita').over(w).alias('ant')).orderBy('loja')
    assert tuplas(r) == [('a', 3, 3, 3, 20), ('b', 1, 1, 1, None), ('c', 2, 2, 2, 30), ('d', 1, 1, 1, None)]
    assert operadores(_explain(r))[:3] == ['Sort', 'Exchange rangepartitioning', 'Window']
    d = spark.createDataFrame([(1, 10), (2, 20), (3, 30), (4, 40)], ['dia', 'v'])
    w2 = Window.orderBy('dia')
    r2 = d.select('dia',
                  F.sum('v').over(w2.rowsBetween(Window.unboundedPreceding, Window.currentRow)).alias('acum'),
                  F.avg('v').over(w2.rowsBetween(-1, 0)).alias('media'),
                  F.lead('v', 1, 0).over(w2).alias('prox'))
    assert tuplas(r2.orderBy('dia')) == [(1, 10, 10.0, 20), (2, 30, 15.0, 30), (3, 60, 25.0, 40), (4, 100, 35.0, 0)]
    empates = spark.createDataFrame([(1, 1), (1, 2), (2, 3)], ['k', 'v'])
    assert [r.s for r in empates.select(F.sum('v').over(Window.orderBy('k')).alias('s')).collect()] == [3, 3, 6]
    total = df.withColumn('total_regiao', F.sum('receita').over(Window.partitionBy('regiao'))).orderBy('loja')
    assert [r.total_regiao for r in total.collect()] == [60, 60, 60, 5]
    with pytest.raises(AnalysisException):
        df.select(F.row_number().over(Window.partitionBy('regiao')))  # row_number precisa de orderBy


def test_union_distinct_e_duplicados(spark):
    a = spark.createDataFrame([(1, 'x')], ['id', 'v'])
    b = spark.createDataFrame([('y', 2)], ['v', 'id'])
    assert tuplas(a.unionByName(b)) == [(1, 'x'), (2, 'y')]
    assert a.union(a).distinct().count() == 1
    assert vendas(spark).dropDuplicates(['regiao']).count() == 3
    c = spark.createDataFrame([(3,)], ['id'])
    assert tuplas(a.unionByName(c, allowMissingColumns=True)) == [(1, 'x'), (3, None)]
    assert a.union(b).rdd.getNumPartitions() == 8


def test_tabela_para_a_correcao(spark):
    t = vendas(spark).groupBy('regiao').count()._diverge_tabela(1000)
    assert t['colunas'] == [{'nome': 'regiao', 'tipo': 'string'}, {'nome': 'count', 'tipo': 'bigint'}]
    assert sorted(t['linhas']) == [['Nordeste', 2], ['Norte', 1], ['Sudeste', 1]]
    assert (t['total'], t['ordenado'], t['plano']['shuffles']) == (3, False, 1)
    assert vendas(spark).orderBy('produto').select('produto')._diverge_tabela(2) == {
        'colunas': [{'nome': 'produto', 'tipo': 'string'}], 'linhas': [['Arroz'], ['Café']], 'total': 4, 'ordenado': True,
        'plano': {'shuffles': 1, 'broadcast': False, 'cache': False, 'particoes': 4, 'estagios': 2}}
    assert estagios.resumo() is None  # calcular para a correção não aparece para o aluno
```

(Os resultados de `test_janelas` dependem só de a ordem dentro da partição seguir a ordenação; não há empates no `orderBy` da primeira janela.)

Run: `python -m pytest python/tests/test_spark_largas.py -q`
Expected: FAIL.

- [ ] **Step 2: Implementar**

Siga as interfaces e as regras acima. A compilação de cada nó largo para o RDD da Task 2:

- `HashAggregate` parcial + `Exchange hashpartitioning` + `HashAggregate` final → `mapPartitions(agregar_parcial)`, um `partitionBy` por `hash_estavel` das chaves (o lado do map grava os baldes) e `mapPartitions(agregar_final)`. Cada agregação tem `zero`, `somar(acumulado, valor)`, `juntar(a, b)` e `resultado(acumulado)` (`avg` guarda `(soma, n)`; `count(DISTINCT)` e `collect_set` guardam um conjunto em ordem de chegada).
- `SortMergeJoin`: os dois lados vão para o mesmo número de partições pelo hash da chave; cada partição junta as duas listas (a "ordenação + merge" do Spark vira uma junção por dicionário, com a ordem do lado da esquerda).
- `BroadcastHashJoin`: o lado construído é calculado num job próprio (`broadcast`), vira um dicionário e vai dentro da função de cada tarefa do outro lado (sem shuffle).
- O nome do estágio de shuffle traz a operação de DataFrame que o causou (`groupBy`, `orderBy`, `join`, `distinct`, `repartition`, `Window`), para a aba ⚡ Execução.

Run: `python -m pytest python/tests -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "pyspark.sql: agregações, pivot, joins com broadcast, Window, cache, partições e resumo do plano"
```

---

### Task 5: Leitura e escrita, `explode`, UDF, `expr` e Spark SQL

**Files:**
- Create: `python/pyspark/sql/readwriter.py`, `python/pyspark/sql/sql.py` (tokenizador e parser de SQL e de expressões), `python/pyspark/sql/catalog.py`
- Modify: `python/pyspark/sql/session.py` (`read`, `sql`, `table`, `catalog`), `python/pyspark/sql/dataframe.py` (`write`, `selectExpr`, `filter` com texto, `createOrReplaceTempView`, `createTempView`), `python/pyspark/sql/functions.py` (`expr`, `explode`, `explode_outer`, `posexplode`, `udf`), `python/pyspark/sql/plano.py` (`FileScan`, `Generate`, `BatchEvalPython`)
- Test: `python/tests/test_spark_io_sql.py`

**Interfaces:**
- `spark.read` → `DataFrameReader`: `format(f)`, `option(k, v)`, `options(**kw)`, `schema(StructType | ddl)`, `load(caminho)`, `csv(caminho, header=None, inferSchema=None, sep=None, schema=None)`, `json(caminho, schema=None)`, `parquet(caminho)`, `text(caminho)` (coluna `value`). `caminho` pode ser arquivo, pasta (todos os arquivos que não começam com `_` ou `.`) ou lista. Lido no processo principal, na hora da ação (as partições carregam os dados para os workers). Uma partição por arquivo, arquivos em ordem de tamanho decrescente e depois por nome. Caminho que não existe: `AnalysisException` `[PATH_NOT_FOUND] Path does not exist: file:<absoluto>. SQLSTATE: 42K03`, já no `csv(...)`. Formato `delta`: `AnalysisException` `[DATA_SOURCE_NOT_FOUND] Failed to find the data source: delta. …` (a fase 5 o implementa).
- CSV: separador `,` (ou `sep`), aspas `"` com `""` dentro, campo vazio → `NULL`; `header=True` usa a primeira linha como nomes (senão `_c0`, `_c1`…). `inferSchema=True`: `int` se todos cabem em 32 bits, `bigint` se inteiros maiores, `double` se números, `boolean` se `true`/`false` (sem diferenciar maiúsculas), senão `string`. Sem inferência: tudo `string`. Com `schema`: converte (valor inválido → `NULL`). Explain: `FileScan csv [produto#0,...] Batched: false, DataFilters: [], Format: CSV, Location: InMemoryFileIndex(1 paths)[file:/...], PartitionFilters: [], PushedFilters: [], ReadSchema: struct<...>`.
- JSON (uma linha por objeto): campos em ordem alfabética; inteiros → `bigint`, com decimais → `double` (inteiro e decimal na mesma coluna → `double`), `true`/`false` → `boolean`, listas → `array`, objetos → `struct`; campo ausente → `NULL`.
- `df.write` → `DataFrameWriter`: `mode('overwrite' | 'append' | 'ignore' | 'error' | 'errorifexists')`, `format`, `option`, `options`, `partitionBy(*cols)` (pastas `col=valor`), `save(caminho)`, `csv(caminho, header=None, mode=None, sep=None)`, `json(caminho, mode=None)`, `parquet(caminho, mode=None)`, `text(caminho)`. Grava no processo principal (um job `save` calcula as partições): pasta com `part-0000N-c000.<ext>` (uma por partição não vazia; se todas estão vazias, uma só, com o cabeçalho) e `_SUCCESS` vazio. Já existe e modo `error`: `AnalysisException` `[PATH_ALREADY_EXISTS] Path file:<absoluto> already exists. Set mode as "overwrite" to overwrite the existing path. SQLSTATE: 42K04`. CSV: valores como no `show` sem truncar, `NULL` vira campo vazio, aspas quando há `,`, `"` ou quebra de linha. JSON: `{"produto":"Arroz","preco":24.9}` sem espaços, campos `NULL` omitidos. Parquet "simplificado": arquivo `.parquet` com uma linha JSON do schema (`{"schema": "<ddl>"}`) e uma linha JSON por registro; só o nosso leitor entende (o site avisa na lição).
- `F.explode(col)` (linhas com lista vazia ou `NULL` somem), `explode_outer` (ficam com `NULL`), `posexplode` (`pos`, `col`); o nome padrão é `col`. Plano `Generate explode(tags#2), [id#0], false, [col#7]`.
- `F.udf(f=None, returnType=StringType())` (função ou decorador; `returnType` como tipo ou texto DDL; `@F.udf('int')`); devolve uma função que recebe colunas e dá `Column` com o nome `nome_da_funcao(colunas)` (`<lambda>(produto)`). Roda dentro das tarefas, nos workers. Valor que não combina com o tipo de retorno vira `NULL` (como no Spark). Plano: `BatchEvalPython [dobro(quantidade#2L)#9], [pythonUDF0#10]`.
- `F.expr(texto)`, `df.selectExpr(*textos)`, `df.filter(texto)`/`where(texto)`: usam o parser de expressões de `sql.py`.
- `df.createOrReplaceTempView(nome)`, `createTempView` (já existe: `AnalysisException` `[TEMP_TABLE_OR_VIEW_ALREADY_EXISTS]`), `spark.table(nome)`, `spark.catalog.listTables()`, `spark.catalog.dropTempView(nome)`. As views ficam na sessão e somem a cada execução (o `AO_ZERAR` da Task 2).
- `spark.sql(texto)`: `SELECT [DISTINCT] expressões [FROM tabela [AS] alias [JOIN | INNER JOIN | LEFT [OUTER] JOIN | RIGHT [OUTER] JOIN | FULL [OUTER] JOIN | LEFT SEMI JOIN | LEFT ANTI JOIN | CROSS JOIN tabela [alias] [ON condição | USING (colunas)]]…] [WHERE] [GROUP BY] [HAVING] [ORDER BY expr [ASC|DESC] [NULLS FIRST|LAST], …] [LIMIT n]`, subconsulta no `FROM` (`FROM (SELECT …) t`), `WITH nome AS (SELECT …)`. Expressões: colunas (com `tabela.coluna`), `*` e `t.*`, literais (números, `'texto'`, `TRUE`, `FALSE`, `NULL`, `DATE '2026-10-13'`), aritmética, comparações, `AND`/`OR`/`NOT`, `IS [NOT] NULL`, `[NOT] IN (…)`, `[NOT] BETWEEN … AND …`, `[NOT] LIKE`, `CASE WHEN … THEN … [ELSE …] END`, `CAST(x AS tipo)`, funções (as mesmas de `functions`, sem diferenciar maiúsculas), `COUNT(*)`, `COUNT(DISTINCT x)`, janelas `função(…) OVER (PARTITION BY … ORDER BY … [ROWS BETWEEN … AND …])`, `AS alias` (ou alias sem `AS`). Palavras-chave sem diferenciar maiúsculas; nomes entre crases. Os nomes automáticos seguem as regras da Task 3 (`SELECT SUM(x)` dá a coluna `sum(x)`). Erros: `[TABLE_OR_VIEW_NOT_FOUND] The table or view `vendass` cannot be found. Verify the spelling and correctness of the schema and catalog. … SQLSTATE: 42P01;`, `[UNRESOLVED_COLUMN.WITH_SUGGESTION]` como na Task 3, `[MISSING_AGGREGATION] The non-aggregating expression `produto` is based on columns which are not participating in the GROUP BY clause. … SQLSTATE: 42803;`, e `ParseException` `[PARSE_SYNTAX_ERROR] Syntax error at or near 'FORM'. SQLSTATE: 42601`.

- [ ] **Step 1: Testes que falham**

`python/tests/test_spark_io_sql.py`:

```python
"""Leitura e escrita de arquivos, explode, UDF, expressões em texto e Spark SQL."""
import os

import pytest

from _comum import operadores
from diverge_runtime import estagios
from pyspark.errors import AnalysisException, ParseException
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def vendas(spark):
    return spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])


def tuplas(df):
    return [tuple(r) for r in df.collect()]


def test_csv(spark, tmp_path):
    (tmp_path / 'vendas.csv').write_text('produto,quantidade,preco,ativo\nArroz,2,24.90,true\n"Café, torrado",,19.90,false\n', encoding='utf-8')
    df = spark.read.csv('vendas.csv', header=True, inferSchema=True)
    assert df.dtypes == [('produto', 'string'), ('quantidade', 'int'), ('preco', 'double'), ('ativo', 'boolean')]
    assert df.collect()[1] == Row(produto='Café, torrado', quantidade=None, preco=19.9, ativo=False)
    assert spark.read.option('header', True).csv('vendas.csv').dtypes[1] == ('quantidade', 'string')
    assert spark.read.csv('vendas.csv').columns == ['_c0', '_c1', '_c2', '_c3']
    s = spark.read.schema('produto STRING, quantidade INT, preco DOUBLE, ativo BOOLEAN').csv('vendas.csv', header=True)
    assert s.first().preco == 24.9
    assert spark.read.format('csv').option('header', 'true').load('vendas.csv').count() == 2
    assert df.rdd.getNumPartitions() == 1
    with pytest.raises(AnalysisException) as e:
        spark.read.csv('nao_tem.csv')
    assert e.value.getErrorClass() == 'PATH_NOT_FOUND'


def test_json(spark, tmp_path):
    (tmp_path / 'notas.json').write_text('{"nome": "Ana", "nota": 9.5, "turma": 1}\n{"turma": 2, "nome": "Bia", "nota": 7}\n{"nome": "Caio"}\n', encoding='utf-8')
    j = spark.read.json('notas.json')
    assert j.dtypes == [('nome', 'string'), ('nota', 'double'), ('turma', 'bigint')]
    assert tuplas(j)[2] == ('Caio', None, None)


def test_escrita(spark, tmp_path):
    df = vendas(spark).filter(F.col('regiao') == 'Nordeste').coalesce(1)
    df.write.mode('overwrite').csv('saida', header=True)
    assert sorted(os.listdir('saida')) == ['_SUCCESS', 'part-00000-c000.csv']
    assert (tmp_path / 'saida' / 'part-00000-c000.csv').read_text(encoding='utf-8') == 'produto,regiao,quantidade,preco\nArroz,Nordeste,2,24.9\nCafé,Nordeste,1,19.9\n'
    assert spark.read.csv('saida', header=True, inferSchema=True).count() == 2
    with pytest.raises(AnalysisException) as e:
        df.write.csv('saida')
    assert e.value.getErrorClass() == 'PATH_ALREADY_EXISTS'
    vendas(spark).write.json('j')
    assert len([n for n in os.listdir('j') if n.startswith('part-')]) == 3  # a partição vazia não gera arquivo
    assert spark.read.json('j').count() == 4
    vendas(spark).write.parquet('p')
    assert spark.read.parquet('p').dtypes == vendas(spark).dtypes
    vendas(spark).write.partitionBy('regiao').mode('overwrite').parquet('por_regiao')
    assert sorted(n for n in os.listdir('por_regiao') if not n.startswith('_')) == ['regiao=Nordeste', 'regiao=Norte', 'regiao=Sudeste']
    with pytest.raises(AnalysisException) as e:
        vendas(spark).write.format('delta').save('d')
    assert e.value.getErrorClass() == 'DATA_SOURCE_NOT_FOUND'


def test_explode_e_udf(spark):
    t = spark.createDataFrame([('a', ['x', 'y']), ('b', [])], ['id', 'tags'])
    assert tuplas(t.select('id', F.explode('tags').alias('tag'))) == [('a', 'x'), ('a', 'y')]
    assert t.select(F.explode('tags')).columns == ['col']
    assert tuplas(t.select('id', F.explode_outer('tags')))[2] == ('b', None)
    assert t.select(F.size('tags')).collect()[1][0] == 0

    @F.udf(returnType=IntegerType())
    def dobro(x):
        return x * 2

    r = vendas(spark).select(dobro('quantidade').alias('d'), F.udf(lambda s: s[:3])('produto'))
    assert r.columns == ['d', '<lambda>(produto)']
    assert r.first() == Row(d=4, **{'<lambda>(produto)': 'Arr'})
    assert 'BatchEvalPython' in operadores(r)
    assert vendas(spark).select(F.udf(lambda x: 'texto', 'int')('quantidade')).first()[0] is None
    with pytest.raises(ZeroDivisionError):
        vendas(spark).select(F.udf(lambda x: x // 0, 'int')('quantidade')).collect()


def test_expressoes_em_texto(spark):
    assert vendas(spark).selectExpr('produto', 'quantidade * 2 AS dobro').columns == ['produto', 'dobro']
    assert vendas(spark).filter("preco > 10 AND regiao = 'Nordeste'").count() == 2
    assert vendas(spark).withColumn('x', F.expr('upper(produto)')).first().x == 'ARROZ'
    assert vendas(spark).selectExpr('count(*)').columns == ['count(1)']
    assert spark.range(5).filter('id > 2').collect() == [Row(id=3), Row(id=4)]


def test_sql(spark):
    vendas(spark).createOrReplaceTempView('vendas')
    r = spark.sql('''
        SELECT regiao, ROUND(SUM(quantidade * preco), 2) AS receita, COUNT(*) AS n
        FROM vendas WHERE preco > 2
        GROUP BY regiao HAVING COUNT(*) >= 1
        ORDER BY receita DESC''')
    assert tuplas(r) == [('Nordeste', 69.7, 2), ('Sudeste', 25.5, 1), ('Norte', 25.0, 1)]
    spark.createDataFrame([('Nordeste', 'Recife')], ['regiao', 'capital']).createOrReplaceTempView('capitais')
    j = spark.sql('SELECT v.produto, c.capital FROM vendas v JOIN capitais c ON v.regiao = c.regiao ORDER BY v.produto')
    assert tuplas(j) == [('Arroz', 'Recife'), ('Café', 'Recife')]
    w = spark.sql('SELECT produto, ROW_NUMBER() OVER (PARTITION BY regiao ORDER BY preco DESC) AS pos FROM vendas ORDER BY produto')
    assert tuplas(w) == [('Arroz', 1), ('Café', 2), ('Feijão', 1), ('Rapadura', 1)]
    assert spark.sql('SELECT 1 + 1 AS dois').first().dois == 2
    assert spark.sql('SELECT SUM(quantidade) FROM vendas').columns == ['sum(quantidade)']
    assert spark.sql('WITH ne AS (SELECT * FROM vendas WHERE regiao = "Nordeste") SELECT COUNT(*) AS n FROM ne').first().n == 2
    assert spark.sql('SELECT DISTINCT regiao FROM vendas').count() == 3
    assert spark.table('vendas').count() == 4
    assert [t.name for t in spark.catalog.listTables()] == ['capitais', 'vendas']
    with pytest.raises(AnalysisException) as e:
        spark.sql('SELECT * FROM vendass')
    assert e.value.getErrorClass() == 'TABLE_OR_VIEW_NOT_FOUND'
    with pytest.raises(AnalysisException) as e:
        spark.sql('SELECT produto, SUM(quantidade) FROM vendas GROUP BY regiao')
    assert e.value.getErrorClass() == 'MISSING_AGGREGATION'
    with pytest.raises(ParseException):
        spark.sql('SELECT * FORM vendas')


def test_cada_execucao_comeca_do_zero(spark):
    vendas(spark).createOrReplaceTempView('v')
    spark.conf.set('spark.sql.shuffle.partitions', '8')
    cacheado = vendas(spark).cache()
    cacheado.count()
    estagios.zerar()
    s = SparkSession.builder.getOrCreate()
    assert s is not spark
    assert s.conf.get('spark.sql.shuffle.partitions') == '4'
    with pytest.raises(AnalysisException):
        s.table('v')
```

Run: `python -m pytest python/tests/test_spark_io_sql.py -q`
Expected: FAIL.

- [ ] **Step 2: Implementar**

Siga as interfaces acima. O parser de SQL é de descida recursiva, com precedência `OR` < `AND` < `NOT` < comparações/`IS`/`IN`/`BETWEEN`/`LIKE` < `+ -` < `* / %` < unário < átomo; ele monta `Column` e chamadas de `DataFrame` (o `FROM`/`JOIN` vira `join`, o `GROUP BY` vira `groupBy().agg()` com as agregações achadas no `SELECT`, no `HAVING` e no `ORDER BY`, e o `HAVING` vira `filter` depois). A mensagem do `ParseException` aponta o primeiro símbolo inesperado.

Run: `python -m pytest python/tests -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "pyspark.sql: leitura e escrita (CSV, JSON, parquet simplificado), explode, UDF, expr e Spark SQL"
```

---

### Task 6: Conformidade com o PySpark real

**Files:**
- Create: `python/conformidade/rodar.py`, `python/conformidade/c01_rdd.py` … `c10_erros.py` e um `cNN_*.esperado.txt` para cada um
- Modify: `python/conformidade/_comum.py` (`sessao()`), `.github/workflows/pages.yml` (job `conformidade`; `build` depende dele)
- Test: `python/tests/test_conformidade.py`

**Interfaces:**
- `_comum.sessao()`: `SparkSession.builder.master('local[4]').appName('conformidade').config('spark.sql.shuffle.partitions', '4').config('spark.default.parallelism', '4').config('spark.sql.adaptive.enabled', 'false').config('spark.sql.session.timeZone', 'UTC').config('spark.ui.enabled', 'false').getOrCreate()` e `sparkContext.setLogLevel('ERROR')`.
- `python python/conformidade/rodar.py [--real] [nomes…]`: roda cada `cNN_*.py` num subprocesso com `cwd` na pasta `conformidade` e um diretório temporário em `CONFORMIDADE_TMP`. Sem `--real`, `PYTHONPATH` = `python` + `python/vendor` + `python/conformidade` (o nosso `pyspark`). Com `--real`, só `python/conformidade` (o `pyspark` instalado). Compara o `stdout` com `cNN_*.esperado.txt`, mostra um `difflib.unified_diff` de cada diferença e sai com código 1 se alguma não bater.

Os programas imprimem só o que o Spark real e o nosso têm de mostrar igual: `show()` (sempre depois de um `orderBy` quando há mais de uma linha), `printSchema()`, `dtypes`, `columns`, contagens, `collect()` ordenado, `glom()` de `parallelize`, `getNumPartitions()`, `operadores(df)` e `primeira_linha(erro)`.

| programa | confere |
| --- | --- |
| `c01_rdd.py` | `glom` de `parallelize(range(10), 4)`, de `parallelize(list(range(10)), 4)` e de `parallelize([1, 2, 3])`; `map`/`filter`/`reduce`/`count`/`take`; `reduceByKey` (ordenado); `groupByKey` (ordenado); `sortBy`; `join`; `distinct`; `union`; `getNumPartitions` de um `reduceByKey` e de um `textFile` |
| `c02_dataframe.py` | `createDataFrame` com nomes, DDL e `Row`; `dtypes`; `printSchema` (com `array`); `show()`, `show(2)`, `show(truncate=False)`; texto com mais de 20 caracteres; `NULL`, `true`, `1.0E7`, `0.30000000000000004`, datas e listas no `show`; `columns` de `(a * b)`, `(a > 1)`, `upper(a)`, `CASE WHEN … END`, `CAST(a AS INT)`, `(a IN (1, 2))` |
| `c03_funcoes.py` | `when`, `trim`, `initcap`, `concat_ws`, `substring`, `split`, `to_date`, `year`, `datediff`, `round`, `coalesce`, `na.fill`, `na.drop` |
| `c04_agregacoes.py` | `groupBy().agg()` com `sum`, `avg`, `count("*")`, `countDistinct`, `max` (nomes e valores); `groupBy().count()`; `pivot` (com e sem valores); `orderBy` com `NULL` (`asc` e `desc`); `distinct`; `dropDuplicates` (contagem) |
| `c05_joins.py` | `inner`, `left`, `right`, `full`, `left_semi`, `left_anti` com `on="id"` (`show` ordenado); `operadores` de um join de `createDataFrame` (SortMergeJoin), com `broadcast(...)` e de `range` com `range` (broadcast automático) e com `autoBroadcastJoinThreshold = -1` |
| `c06_window.py` | `row_number`, `rank`, `dense_rank`, `lag`, `lead` com padrão, soma acumulada com `rowsBetween`, média móvel, soma por partição sem `orderBy` (sem empates) |
| `c07_leitura.py` | grava um CSV e um JSON em `CONFORMIDADE_TMP`; `read.csv` com e sem `inferSchema` e com schema DDL (`dtypes` e `show`); `read.json` (ordem alfabética e tipos); `write.csv` com `coalesce(1)` e leitura de volta (contagem) |
| `c08_sql.py` | view temporária; `SELECT … WHERE … GROUP BY … HAVING … ORDER BY`; `JOIN … ON`; `ROW_NUMBER() OVER (…)`; `columns` de `SELECT SUM(x)`; `COUNT(*)` |
| `c09_explain.py` | `operadores` de `groupBy().sum()`, `orderBy`, `repartition(3)`, `distinct`, uma janela, um DataFrame em cache já calculado, uma UDF; `_ = df.rdd.getNumPartitions()` depois de `repartition(3)`, `coalesce(1)` e `groupBy` |
| `c10_erros.py` | `primeira_linha` de: coluna que não existe (com sugestão), tabela que não existe, `MISSING_AGGREGATION`, `PATH_NOT_FOUND` (o caminho impresso troca `CONFORMIDADE_TMP` por `<tmp>`), referência ambígua depois de um join por expressão; e `type(e).__name__` de cada um |

Para não depender do caminho absoluto, `primeira_linha` troca o valor de `CONFORMIDADE_TMP` por `<tmp>` e o `cwd` por `<cwd>`. O `.esperado.txt` de cada programa é escrito com a saída do nosso pyspark **depois** de conferida linha a linha com o formato documentado do Spark 4 (as regras das Tasks 3 a 5); o CI é quem confirma contra o real.

- [ ] **Step 1: Teste da conformidade com o nosso pyspark**

`python/tests/test_conformidade.py`:

```python
"""Os programas de conformidade dão, no nosso pyspark, a saída esperada (a mesma do PySpark real, conferida no CI)."""
import pathlib
import subprocess
import sys

import pytest

PASTA = pathlib.Path(__file__).resolve().parents[1] / 'conformidade'
PROGRAMAS = sorted(p.stem for p in PASTA.glob('c[0-9][0-9]_*.py'))


def test_ha_programas():
    assert len(PROGRAMAS) == 10


@pytest.mark.parametrize('nome', PROGRAMAS)
def test_programa(nome):
    r = subprocess.run([sys.executable, str(PASTA / 'rodar.py'), nome], capture_output=True, text=True, encoding='utf-8', timeout=300)
    assert r.returncode == 0, r.stdout + r.stderr
```

Run: `python -m pytest python/tests/test_conformidade.py -q`
Expected: FAIL (nenhum programa).

- [ ] **Step 2: Programas, saídas esperadas e o executor**

Escreva os 10 programas da tabela e o `rodar.py`; gere cada `.esperado.txt` rodando o nosso (`python python/conformidade/rodar.py --gravar cNN`, uma opção do executor que grava em vez de comparar) e **leia cada um** antes de commitar, conferindo com as regras de formato das Tasks 3 a 5. Diferença encontrada entre a regra e a saída é bug do nosso pyspark: corrija o pyspark, não o esperado.

`.github/workflows/pages.yml`, job novo antes do `build` (e `needs: conformidade` no `build`):

```yaml
  # O nosso pyspark tem de dar a mesma saída do PySpark real (show, schema, contagens, explain e erros).
  conformidade:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '17'
      - uses: actions/setup-python@v6
        with:
          python-version: '3.12'
      - run: python -m pip install pyspark==4.0.1
      - run: python python/conformidade/rodar.py --real
```

Run: `python -m pytest python/tests -q && npx eslint .`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Conformidade: 10 programas comparados com o PySpark real no CI"
```

- [ ] **Step 4: Rodar a conformidade no CI (depois do "sim")**

Sem Java nesta máquina, a comparação com o real só roda no GitHub Actions. Peça o "sim" do usuário para empurrar o branch `fase-4` e abrir um PR em rascunho (o workflow roda nos PRs, sem publicar o site). Depois do "sim":

```bash
git push -u origin fase-4
gh pr create -R sertaoseracloud/python-playground --draft --base main --head fase-4 --title "Fase 4: PySpark (rascunho para a conformidade)" --body "Rascunho para rodar a conformidade com o PySpark real no CI. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Leia o log do job `conformidade`. Cada diferença: se o real mostra outro formato, corrija o nosso pyspark **e** o `.esperado.txt` (e o teste pytest da Task 3 a 5 que fixava o formato antigo), commit `Conformidade: <o que mudou> como no PySpark 4.0.1`, e empurre de novo (o mesmo "sim" vale para os pushes deste PR de rascunho). Repita até o job passar.

---

### Task 7: Spark no navegador, regras `dataframe` e `plano`

**Files:**
- Modify: `src/verificacoes.js`, `src/corrigir.js`
- Create: `tests/spark.test.js`
- Test: `tests/spark.test.js`, `tests/verificacoes.test.js`, `tests/corrigir.test.js`

**Interfaces:**
- Consumes: `r.spark`, `r.tabelas` (Task 1); `tabela = { colunas: [{ nome, tipo }], linhas, total, ordenado, plano: { shuffles, broadcast, cache, particoes, estagios } } | { erro: { tipo, mensagem } }` (Task 4).
- Produces: regra `{ dataframe: 'nome', colunas?: ['a', 'b'], tipos?: ['string', 'bigint'], linhas?: [[…]], ordem?: true, aprox?: 1e-6, total?: n }` (categoria "DataFrame"); regra `{ plano: 'nome', shuffles?, broadcast?, cache?, particoes?, estagios? }` (categoria "Plano"); contexto das regras com `tabelas`.

Comparação da regra `dataframe`: confere, nesta ordem, que a variável existe e é um DataFrame (`tabelas[nome]`), que ele calcula sem erro, as colunas (`colunas`, na ordem), os tipos (`tipos`), o total de linhas (`total`, ou `linhas.length` quando `linhas` vem) e as linhas. Sem `ordem`, compara as linhas como multiconjunto (as duas listas ordenadas pelo JSON de cada linha); com `ordem: true`, na ordem, e o detalhe diz a primeira linha diferente. Números com tolerância `aprox` (padrão `1e-9`). Detalhes:

- `a variável x não existe no fim do programa` / `x não é um DataFrame`
- `calcular x deu ZeroDivisionError: integer division or modulo by zero`
- `colunas esperadas [a, b], vieram [a, c]`
- `tipos esperados [string, bigint], vieram [string, double]`
- `esperadas 3 linhas, vieram 4` (`esperada 1 linha, vieram 2` no singular)
- `faltou a linha ["Ana", 3]` / `sobrou a linha ["Bia", 2]` (sem ordem)
- `linha 2: esperado ["Ana", 3], veio ["Bia", 2]` (com ordem)

O `obtido` mostra as colunas e até 5 linhas: `regiao | count · Nordeste | 2 · Norte | 1 …`.

Regra `plano`: cada chave pedida tem de bater com `tabelas[nome].plano`; o detalhe diz a primeira que não bateu (`o plano tem 2 shuffles; o pedido é 1`, `o join não usou broadcast`, `o DataFrame não está em cache`, `o DataFrame tem 4 partições; o pedido é 3`, `o plano tem 2 estágios; o pedido é 1`); `obtido`: `1 shuffle · sem broadcast · sem cache · 4 partições · 2 estágios`.

- [ ] **Step 1: Testes que falham**

`tests/spark.test.js`:

```js
// PySpark do DivergePython no Pyodide, com o pool de verdade (workers do Node).
import { describe, it, expect, afterAll } from 'vitest';
import { PoolPython } from '../src/python/pool.js';
import { iniciarPython } from './python-node.js';
import { workerNode } from './pool-node.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
const sessao = iniciarPython({ pool }).then((s) => s.sessao);
const rodar = async (codigo, extras = {}) => (await sessao).executar({ 'main.py': codigo, ...extras });

const VENDAS = 'produto,regiao,quantidade,preco\nArroz,Nordeste,2,24.90\nFeijão,Sudeste,3,8.50\nCafé,Nordeste,1,19.90\nRapadura,Norte,10,2.50\n';
const INICIO = 'from pyspark.sql import SparkSession, functions as F\nspark = SparkSession.builder.getOrCreate()\n';

describe('PySpark no navegador', () => {
  it('lê o CSV do aluno no processo principal e roda as partições em vários workers', async () => {
    const r = await rodar(`${INICIO}df = spark.read.csv("vendas.csv", header=True, inferSchema=True)\n`
      + 'por_regiao = df.groupBy("regiao").agg(F.sum("quantidade").alias("total"))\npor_regiao.orderBy("regiao").show()\n', { 'vendas.csv': VENDAS });
    expect(r.erro).toBeNull();
    expect(r.saida).toContain('|Nordeste|    3|');
    expect(r.spark.shuffles).toBe(2);
    expect(r.spark.jobs.map((j) => j.acao)).toContain('show');
    expect(r.paralelismo.workers).toBeGreaterThan(1);
    expect(r.tabelas.por_regiao.colunas).toEqual([{ nome: 'regiao', tipo: 'string' }, { nome: 'total', tipo: 'bigint' }]);
    expect(r.tabelas.por_regiao.linhas).toHaveLength(3);
  }, 120_000);

  it('uma lambda que usa uma variável global do aluno roda no worker', async () => {
    const r = await rodar(`${INICIO}taxa = 10\nr = spark.sparkContext.parallelize(range(8)).map(lambda x: x * taxa).collect()\n`);
    expect(r.erro).toBeNull();
    expect(r.variaveis.r).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
  }, 120_000);

  it('o erro dentro de uma lambda sobe com o mesmo tipo', async () => {
    const r = await rodar(`${INICIO}spark.sparkContext.parallelize([1, 0]).map(lambda x: 1 // x).collect()\n`);
    expect(r.erro.tipo).toBe('ZeroDivisionError');
  }, 120_000);

  it('sem nenhuma ação: nenhum job, mas a tabela da variável existe', async () => {
    const r = await rodar(`${INICIO}df = spark.createDataFrame([("Ana", 3)], ["nome", "n"])\n`);
    expect(r.spark).toBeNull();
    expect(r.tabelas.df.linhas).toEqual([['Ana', 3]]);
  }, 120_000);

  it('um DataFrame que só falha ao calcular vira erro na tabela, sem derrubar a execução', async () => {
    const r = await rodar(`${INICIO}df = spark.range(3).select(F.udf(lambda x: 1 // 0, "int")("id"))\n`);
    expect(r.erro).toBeNull();
    expect(r.tabelas.df.erro.tipo).toBe('ZeroDivisionError');
  }, 120_000);
});
```

`tests/verificacoes.test.js`:

```js
  it('dataframe: colunas, tipos e linhas (sem ordem, a não ser que o exercício peça)', () => {
    const tabelas = {
      df: { colunas: [{ nome: 'regiao', tipo: 'string' }, { nome: 'total', tipo: 'bigint' }], linhas: [['Sul', 1], ['Nordeste', 3]], total: 2, ordenado: false, plano: {} },
      ruim: { erro: { tipo: 'ZeroDivisionError', mensagem: 'integer division or modulo by zero' } },
    };
    const v = (regra) => verificarRegra(regra, { tabelas, variaveis: { n: 1 } });
    expect(v({ dataframe: 'df', colunas: ['regiao', 'total'], linhas: [['Nordeste', 3], ['Sul', 1]] }).ok).toBe(true);
    expect(v({ dataframe: 'df', linhas: [['Nordeste', 3], ['Sul', 1]], ordem: true })).toMatchObject({ ok: false, detalhe: 'linha 1: esperado ["Nordeste",3], veio ["Sul",1]' });
    expect(v({ dataframe: 'df', colunas: ['regiao', 'soma'] }).detalhe).toBe('colunas esperadas [regiao, soma], vieram [regiao, total]');
    expect(v({ dataframe: 'df', tipos: ['string', 'double'] }).detalhe).toBe('tipos esperados [string, double], vieram [string, bigint]');
    expect(v({ dataframe: 'df', linhas: [['Sul', 1], ['Norte', 2]] }).detalhe).toBe('faltou a linha ["Norte",2]');
    expect(v({ dataframe: 'df', linhas: [['Sul', 1]] }).detalhe).toBe('esperada 1 linha, vieram 2');
    expect(v({ dataframe: 'df', linhas: [['Sul', 1.0000000001], ['Nordeste', 3]] }).ok).toBe(true);
    expect(v({ dataframe: 'ruim', total: 1 }).detalhe).toBe('calcular ruim deu ZeroDivisionError: integer division or modulo by zero');
    expect(v({ dataframe: 'n', total: 1 }).detalhe).toBe('n não é um DataFrame');
    expect(v({ dataframe: 'x', total: 1 }).detalhe).toBe('a variável x não existe no fim do programa');
    expect(v({ dataframe: 'df', total: 2 }).obtido).toBe('regiao | total · Sul | 1 · Nordeste | 3');
    expect(categoriaDe({ dataframe: 'df' })).toBe('DataFrame');
  });

  it('plano: shuffles, broadcast, cache, partições e estágios', () => {
    const plano = { shuffles: 1, broadcast: false, cache: true, particoes: 4, estagios: 2 };
    const ctx = { tabelas: { df: { colunas: [], linhas: [], total: 0, plano } } };
    expect(verificarRegra({ plano: 'df', shuffles: 1, cache: true }, ctx).ok).toBe(true);
    expect(verificarRegra({ plano: 'df', shuffles: 0 }, ctx)).toMatchObject({ ok: false, detalhe: 'o plano tem 1 shuffle; o pedido é 0' });
    expect(verificarRegra({ plano: 'df', broadcast: true }, ctx).detalhe).toBe('o join não usou broadcast');
    expect(verificarRegra({ plano: 'df', particoes: 3 }, ctx).detalhe).toBe('o DataFrame tem 4 partições; o pedido é 3');
    expect(verificarRegra({ plano: 'df', estagios: 1 }, ctx).obtido).toBe('1 shuffle · sem broadcast · em cache · 4 partições · 2 estágios');
    expect(categoriaDe({ plano: 'df' })).toBe('Plano');
  });
```

`tests/corrigir.test.js` (no padrão dos casos que já existem):

```js
  it('passa as tabelas do resultado para as regras', async () => {
    const problema = { testes: [{ regras: [{ dataframe: 'df', total: 1 }] }] };
    const executar = async () => ({ saida: '', erro: null, variaveis: {}, tabelas: { df: { colunas: [], linhas: [[1]], total: 1, plano: {} } } });
    expect((await corrigir(problema, { 'main.py': '' }, executar)).aprovado).toBe(true);
  });
```

Run: `npx vitest run tests/spark.test.js tests/verificacoes.test.js tests/corrigir.test.js`
Expected: FAIL (regras desconhecidas; o Pyodide sem o pacote ainda passa, mas falha se algo da Task 1 a 5 não funciona no Pyodide).

- [ ] **Step 2: Implementar**

`src/verificacoes.js`: comentário do topo com as duas regras; contexto com `tabelas = {}`; as duas regras antes de `'funcao' in regra`, com os detalhes acima (singular/plural em `shuffle`/`shuffles`, `estágio`/`estágios`, `partição`/`partições`); `CATEGORIAS` com `['dataframe', 'DataFrame'], ['plano', 'Plano']` antes de `['funcao', 'Função']`; `DICAS.DataFrame`: `'Confira as colunas (nomes e alias), os tipos e as linhas. Use df.show() e df.printSchema() para ver o que o seu DataFrame tem.'`; `DICAS.Plano`: `'Use df.explain() para ver o plano: cada Exchange é um shuffle, e BroadcastHashJoin é o join com broadcast.'`.

`src/corrigir.js`: `tabelas: r.tabelas ?? {}` no contexto.

Se o `spark.test.js` falhar só no Pyodide (e não no pytest), o problema é do ambiente do navegador (por exemplo, `zlib`, `datetime` ou `os.path` diferentes): corrija o pyspark e acrescente o caso ao pytest.

Run: `npx vitest run && npx eslint . && python -m pytest -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Spark no Pyodide com o pool, regras dataframe e plano"
```

---

### Task 8: Aba ⚡ Execução

**Files:**
- Create: `src/ui/execucao.js`
- Modify: `index.html` (aba e painel), `src/ui/item.js`, `src/estilo.css`, `tests/acessibilidade-telas.test.js`
- Test: `tests/execucao-ui.test.js`, `tests/item-python.test.js`

**Interfaces:**
- Consumes: `r.spark` (Task 1).
- Produces: `htmlDaExecucao(spark) → string`, `falaDaExecucao(spark) → string`, `textoDaExecucao(spark) → string` (a linha de resumo, igual à fala).

Conteúdo da aba:

1. Resumo: `3 estágios, 1 shuffle, 4 tarefas em 4 workers · 120 ms` (singular quando 1), com `role="status"` desligado (é texto fixo, a fala vai pelo `anunciar`).
2. Uma seção por job (`<section aria-labelledby>` com `<h3>Job 1 · show()</h3>`), com:
   - a linha do tempo (`<div class="linha-do-tempo" aria-hidden="true">`): uma faixa por worker (`Worker 1`, `Worker 2`…), e em cada faixa uma barra por tarefa (`left`/`width` em % do tempo do job, a cor pelo número do estágio, o texto `E1·P0` dentro quando cabe e o `title` com estágio, partição, linhas e duração);
   - a tabela equivalente (`<table>` com `<caption>Tarefas do job 1</caption>`, colunas Estágio, Partição, Worker, Linhas, Início (ms), Duração (ms)), uma linha por tarefa, e uma linha de estágio com o nome e, nos de shuffle, `N linhas embaralhadas`.
3. Uma nota no fim: o Spark de verdade usa 200 partições de shuffle por padrão; aqui são 4, para caber no navegador, e o tempo varia de um computador para outro (por isso a correção nunca confere tempo).

`falaDaExecucao`: `3 estágios, 1 shuffle, 4 tarefas em 4 workers.` (só o resumo; os detalhes estão na tabela).

- [ ] **Step 1: Testes que falham**

`tests/execucao-ui.test.js`:

```js
// @vitest-environment happy-dom
// Aba ⚡ Execução: estágios, tarefas e linha do tempo, com a tabela equivalente para o leitor de tela.
import { describe, it, expect } from 'vitest';
import { htmlDaExecucao, falaDaExecucao } from '../src/ui/execucao.js';

const tarefa = (particao, worker, inicio, fim) => ({ particao, worker, linhas: 2, inicio, fim });
const SPARK = {
  jobs: [{
    id: 1, acao: 'show',
    estagios: [
      { id: 1, nome: 'csv → groupBy', tipo: 'shuffle', linhas_embaralhadas: 6, tarefas: [tarefa(0, 0, 0, 10)] },
      { id: 2, nome: 'groupBy', tipo: 'resultado', linhas_embaralhadas: 0, tarefas: [0, 1, 2, 3].map((p) => tarefa(p, p, 12, 20)) },
    ],
  }],
  estagios: 2, shuffles: 1, tarefas: 5, workers: 4, ms: 20,
};

describe('aba ⚡ Execução', () => {
  it('fala o resumo', () => {
    expect(falaDaExecucao(SPARK)).toBe('2 estágios, 1 shuffle, 5 tarefas em 4 workers.');
    expect(falaDaExecucao({ ...SPARK, estagios: 1, shuffles: 0, tarefas: 1, workers: 1 })).toBe('1 estágio, 0 shuffles, 1 tarefa em 1 worker.');
  });

  it('mostra cada job com a linha do tempo escondida do leitor e a tabela equivalente', () => {
    document.body.innerHTML = `<div id="x">${htmlDaExecucao(SPARK)}</div>`;
    expect(document.querySelector('h3').textContent).toBe('Job 1 · show()');
    expect(document.querySelector('.linha-do-tempo').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('.linha-do-tempo .faixa')).toHaveLength(4);
    expect(document.querySelectorAll('.linha-do-tempo .barra')).toHaveLength(5);
    expect(document.querySelector('caption').textContent).toBe('Tarefas do job 1');
    expect(document.querySelectorAll('tbody tr.tarefa')).toHaveLength(5);
    expect(document.querySelector('tbody tr.estagio').textContent).toContain('6 linhas embaralhadas');
    expect(document.getElementById('x').textContent).toContain('200 partições');
  });
});
```

`tests/item-python.test.js` (no padrão do `montar` que já existe):

```js
  it('com jobs do Spark, a aba ⚡ Execução aparece; sem jobs, some', async () => {
    const spark = { jobs: [{ id: 1, acao: 'count', estagios: [{ id: 1, nome: 'parallelize', tipo: 'resultado', linhas_embaralhadas: 0, tarefas: [{ particao: 0, worker: 0, linhas: 1, inicio: 0, fim: 1 }] }] }], estagios: 1, shuffles: 0, tarefas: 1, workers: 1, ms: 1 };
    const { tela } = montar({ saida: '1\n', erro: null, spark });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('aba-execucao').hidden).toBe(false);
    expect(document.getElementById('saida-execucao').textContent).toContain('Job 1 · count()');
  });
```

e um segundo caso com `spark: null` conferindo `aba-execucao` escondida (e, se a aba estava aberta, volta para o 🖥️ Terminal).

Run: `npx vitest run tests/execucao-ui.test.js tests/item-python.test.js`
Expected: FAIL.

- [ ] **Step 2: Implementar**

`index.html`, no `tablist` da saída: `<button class="aba" data-saida="execucao" id="aba-execucao" role="tab" aria-selected="false" aria-controls="saida-execucao" hidden>⚡ Execução</button>`; depois do terminal: `<div id="saida-execucao" class="execucao" data-saida-painel="execucao" role="tabpanel" tabindex="0" aria-label="Execução no Spark: estágios e tarefas" hidden></div>`.

`src/ui/item.js`, em `mostrarTerminal(r)`:

```js
    const temSpark = Boolean(r.spark?.jobs?.length);
    $('aba-execucao').hidden = !temSpark;
    $('saida-execucao').innerHTML = temSpark ? htmlDaExecucao(r.spark) : '';
```

(o `mostrarSaida('terminal')` que já está ali cobre a aba escondida) e, em `falaDoPython`, `r.spark` acrescenta `falaDaExecucao(r.spark)` ao `extra`. Em `tratarErro` e em `abrir`, a aba é escondida.

`src/estilo.css`: `.execucao` (rolagem, espaçamento), `.linha-do-tempo` (grade com o rótulo do worker e o trilho), `.barra` (posição absoluta, cantos arredondados, borda de 1px na cor do texto para separar barras vizinhas sem depender da cor), cores dos estágios a partir dos tokens de tema que já existem (`--roxo`, `--verde`, `--laranja`, `--azul`, alternando por `estagio % 4`), e a tabela no estilo da aba 📦 Dados.

`tests/acessibilidade-telas.test.js`: um caso com a aba ⚡ Execução aberta (resultado com o `SPARK` do teste acima), sem violações do axe-core nos 4 temas.

Run: `npx vitest run && npx eslint .`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Aba ⚡ Execução: estágios, tarefas por partição e linha do tempo, com tabela e fala"
```

---

### Task 9: Módulo ✨ PySpark — lições e exercícios 1 a 22, certificado e badge

**Files:**
- Create: `src/conteudo/pyspark.js` (`moduloPyspark`, as 14 lições e os exercícios 1–22)
- Modify: `src/conteudo/trilha.js` (`modulos = [moduloBasico, moduloDados, moduloParalelismo, moduloPyspark]`; `PROXIMOS_MODULOS` sem `pyspark`; `LIVRE.resumo` cita o PySpark), `src/certificados.js` (`CERTIFICADOS.pyspark`), `src/badges.js` (`BADGES.pyspark` e a capa), `public/` (`npm run badges`), `tests/conteudo.test.js` (`['pyspark', 45, 14]`)
- Test: `tests/conteudo.test.js`

**Interfaces:**
- Consumes: `py`, `main`, `assinatura`; regras `dataframe`, `plano`, `paralelo`, `saidaIgual`, `saida`, `variavel`, `codigo`, `semCodigo`, `semErros`, `erro`; `item.dados` e `teste.dados`.
- Produces: `moduloPyspark = { id: 'pyspark', titulo: 'PySpark', icone: '✨', descricao: 'SparkSession, RDD, DataFrame, nulos, agregações, joins e broadcast, Window, leitura e escrita, Spark SQL, partições, shuffle, cache, explain e UDF. Uma implementação para aprender, com a API do PySpark, rodando em paralelo no seu navegador.', itens }`.

`CERTIFICADOS.pyspark = { titulo: 'PySpark para Dados', cargaHoraria: 24, resumo: 'concluiu o módulo PySpark, resolvendo os 45 problemas práticos', hashtags: ['PySpark', 'Spark', 'Dados'], conteudos: ['RDD, partições e shuffle', 'DataFrame, funções, nulos e agregações', 'Joins, broadcast e funções de janela', 'Spark SQL, leitura e escrita, cache e explain'] }` (carga: 14 lições × 10 + 13 fáceis × 15 + 24 médios × 30 + 8 difíceis × 45 = 1415 min → 24 h). `BADGES.pyspark = { cor: '#ff79c6', simbolo: '*', faixa: 'PYSPARK' }` (a estrela do logo do Spark; um asterisco simples, porque o gerador de badges só tem a fonte do site); na capa, os quatro badges em losango: `basico (740, 40, 200)`, `dados (900, 190, 200)`, `paralelismo (740, 340, 200)`, `pyspark (580, 190, 200)` (confira na imagem gerada que nenhum cobre o título; se cobrir, desloque o conjunto para a direita). O teste de carga e o de "N problemas" ficam vermelhos até a Task 10.

Todos os programas começam com `from pyspark.sql import SparkSession` (e `functions as F` quando usam funções) e `spark = SparkSession.builder.appName("…").getOrCreate()`. Os exercícios com DataFrame guardam o resultado numa variável conferida pela regra `dataframe`; o código inicial monta o DataFrame de partida e deixa a variável pedida igual a ele (ou faz a conta em Python puro, sem Spark), por isso falha em alguma regra visível.

- [ ] **Step 1: Teste de conteúdo**

`tests/conteudo.test.js`: o `it.each` de estrutura ganha `['pyspark', 45, 14]`.

Run: `npx vitest run tests/conteudo.test.js -t estrutura`
Expected: FAIL (o módulo não existe).

- [ ] **Step 2: As 14 lições**

Cada lição tem `resumo` (2 a 4 parágrafos curtos, com uma analogia) e um `main.py` que roda sem erro. As que leem arquivos têm `dados`.

| id | título | o `main.py` mostra |
| --- | --- | --- |
| `licao-spark-session` | SparkSession e avaliação preguiçosa | criar a sessão; uma transformação não roda nada (sem job na aba ⚡ Execução) até a ação (`count`); o texto avisa que é uma implementação para aprender, com a API do PySpark 4, e que o Spark real usa 200 partições de shuffle (aqui, 4) |
| `licao-rdd` | RDD: dados distribuídos | `sc.parallelize`, `map`, `filter`, `reduce`, `collect`; a analogia da colheita dividida entre trabalhadores |
| `licao-rdd-pares` | Pares chave-valor e contagem de palavras | `textFile` (`frases.txt`), `flatMap`, `map` para `(palavra, 1)`, `reduceByKey`, `sortBy`; o `reduceByKey` combina antes do shuffle |
| `licao-particoes-spark` | Partições, glom e mapPartitions | `getNumPartitions`, `glom`, `mapPartitions`, `repartition` e `coalesce` (com o número de partições antes e depois) |
| `licao-dataframe` | DataFrame e schema | `createDataFrame`, `show`, `printSchema`, `select`, `filter`, `withColumn`, `columns` |
| `licao-funcoes` | Funções de coluna | `when`/`otherwise`, `upper`, `trim`, `concat_ws`, `to_date`, `year`, `cast`, `round`; o nome automático das colunas e o `alias` |
| `licao-udf` | UDF: sua função no Spark | `F.udf` com tipo de retorno; por que a UDF é mais lenta (`BatchEvalPython` no `explain()`) e quando preferir as funções prontas |
| `licao-nulos` | Valores nulos | `NULL` no `show`, `isNull`, `na.fill`, `na.drop`, `coalesce`; `NULL > 5` não é verdadeiro |
| `licao-agregacoes` | groupBy e agregações | `groupBy().agg()` com `sum`, `avg`, `count`, `countDistinct`, `alias`; `pivot` |
| `licao-joins` | Joins e broadcast | `inner`, `left`, `left_anti`; `explain()` com `SortMergeJoin` (dois shuffles) e com `F.broadcast` (`BroadcastHashJoin`, nenhum) |
| `licao-window` | Funções de janela | `Window.partitionBy().orderBy()`, `row_number`, `rank`, `lag`, soma acumulada com `rowsBetween` |
| `licao-leitura` | Ler e gravar arquivos | `spark.read.csv` com `header` e `inferSchema`, schema DDL, `read.json`, `write.mode("overwrite").csv`; a pasta com `part-*` e `_SUCCESS`; o parquet daqui é simplificado |
| `licao-sql` | Spark SQL | `createOrReplaceTempView`, `spark.sql` com `WHERE`, `GROUP BY`, `ORDER BY` e `JOIN`; o mesmo plano do DataFrame |
| `licao-shuffle-cache` | Shuffle, skew, cache e explain | `explain()` de um `groupBy` + `orderBy` (dois `Exchange`), a aba ⚡ Execução, desequilíbrio (uma chave com quase tudo), `cache()` antes de duas ações |

- [ ] **Step 3: Exercícios 1 a 22**

Dados usados (arquivos na aba 📦 Dados; os casos ocultos trocam por outros, com o mesmo cabeçalho):

- `vendas.csv` (visível): `data,regiao,produto,quantidade,preco` com 8 linhas de 2026 (Arroz 5kg, Feijão 1kg, Café 500g, Rapadura, Farinha de mandioca, Queijo coalho), regiões Nordeste, Norte, Sudeste e Sul. Oculto: 6 linhas, com outra distribuição e uma região a menos.
- `frases.txt`: 4 frases curtas sobre o sertão (visível); 3 outras (oculto).
- `pessoas.csv`: `nome,idade,cidade,nota` com nulos em `cidade` e `nota` (visível e oculto diferentes).

| # | id | título | dif. | o que pede | solução de referência | visíveis | ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `sp-parallelize-soma` | Somar com um RDD | fácil | ler números numa linha; `total` = soma com `sc.parallelize(numeros).reduce(...)` | `rdd.reduce(lambda a, b: a + b)` | `['3 5 7 9'] → variavel total 24`; `codigo 'parallelize'`; `paralelo {workers: 2}` | `['10 -4'] → 6` com `paralelo {workers: 1}` |
| 2 | `sp-map-filter` | Quadrados dos pares | fácil | ler números; `resultado` = os quadrados dos pares, na ordem, com `filter` e `map` | `rdd.filter(lambda x: x % 2 == 0).map(lambda x: x * x).collect()` | `['1 2 3 4 5 6'] → variavel resultado [4,16,36]`; `codigo 'filter'`; `codigo 'map'` | `['7 9'] → []`; `['0'] → [0]` |
| 3 | `sp-contar-palavras` | Contar palavras com reduceByKey | médio | ler `frases.txt` com `textFile`; `contagem` = lista `[palavra, vezes]` em ordem alfabética, com as palavras em minúsculas | `flatMap(lambda l: l.lower().split())`, `map(lambda p: (p, 1))`, `reduceByKey(add)`, `sorted(...collect())` | dados visíveis → `variavel contagem` (a contagem das 4 frases); `codigo 'reduceByKey'`; `codigo 'textFile'` | dados ocultos → a contagem das 3 frases |
| 4 | `sp-glom` | Ver as partições | médio | ler `n` e `k`; `particoes = sc.parallelize(range(n), k).glom().collect()` | o próprio | `['10','4'] → variavel particoes [[0,1],[2,3,4],[5,6],[7,8,9]]`; `codigo 'glom'` | `['7','3'] → [[0,1],[2,3],[4,5,6]]` |
| 5 | `sp-media-por-chave` | Média por cidade | médio | ler `k` linhas `cidade temperatura`; `medias` = `{cidade: média com 1 casa}` usando `mapValues` e `reduceByKey` com `(soma, contagem)` | `mapValues(lambda t: (t, 1))`, `reduceByKey(lambda a, b: (a[0] + b[0], a[1] + b[1]))`, `dict(...)` com `round` | `['3','Crato 30','Crato 33','Sobral 35'] → variavel medias {"Crato":31.5,"Sobral":35}`; `codigo 'reduceByKey'` | `['1','Juazeiro 28'] → {"Juazeiro":28}` |
| 6 | `sp-join-rdd` | Juntar dois RDDs | médio | `nomes = [(1,"Ana"),(2,"Bia"),(3,"Caio")]` e `compras` lidas da entrada (`id valor` por linha); `pares` = `sorted(join)` | `sc.parallelize(nomes).join(sc.parallelize(compras))` | `['2','1 10','3 5'] → variavel pares [[1,["Ana",10]],[3,["Caio",5]]]`; `codigo 'join'` | `['1','4 9'] → []` |
| 7 | `sp-udf` | Uma UDF para a região | médio | em `pessoas.csv`, criar `com_regiao` com a coluna `regiao` = `regiao_da_cidade(cidade)` (UDF que devolve `"Nordeste"` para Recife, Fortaleza, Salvador e Natal, `"Sudeste"` para São Paulo e Rio de Janeiro, `"Outra"` para o resto e para `NULL`) | `@F.udf("string")` | `dataframe com_regiao` (colunas `nome, idade, cidade, nota, regiao` e as linhas); `codigo 'udf'` | dados ocultos |
| 8 | `sp-map-partitions` | Uma soma por partição | difícil | ler `n`; `somas` = soma de cada uma das 4 partições de `sc.parallelize(list(range(1, n + 1)), 4)` com `mapPartitions` | `mapPartitions(lambda it: [sum(it)])` | `['8'] → variavel somas [3,7,11,15]`; `codigo 'mapPartitions'`; `paralelo {workers: 2}` | `['12'] → [6,15,24,33]` |
| 9 | `sp-criar-df` | Criar um DataFrame | fácil | `pessoas` com as colunas `nome` e `idade` a partir de `[("Ana", 31), ("Bia", 25), ("Caio", 40)]`, e mostrar o schema | `spark.createDataFrame(dados, ["nome", "idade"])` e `printSchema()` | `dataframe pessoas` (colunas, tipos `string, bigint` e as 3 linhas); `saida ' |-- idade: long (nullable = true)'` | as mesmas regras (os dados vêm do enunciado; o caso oculto confere que o programa não depende de nada além do código) |
| 10 | `sp-select-filter` | Produtos caros | fácil | ler `vendas.csv` (`header`, `inferSchema`); `caros` = `produto` e `preco` das vendas com `preco > 10` | `df.filter(F.col("preco") > 10).select("produto", "preco")` | `dataframe caros` (colunas e linhas) | dados ocultos |
| 11 | `sp-with-column` | Coluna calculada | fácil | `com_total` = `vendas.csv` com a coluna `total` = `quantidade * preco` arredondada em 2 casas | `withColumn("total", F.round(F.col("quantidade") * F.col("preco"), 2))` | `dataframe com_total` (colunas e linhas); `codigo 'withColumn'` | dados ocultos |
| 12 | `sp-show` | Os 3 mais caros | fácil | mostrar `produto` e `preco` das 3 vendas de maior preço, do mais caro para o mais barato, com `show(3)` | `df.orderBy(F.desc("preco")).select("produto", "preco").show(3)` | `saidaIgual` com a tabela dos 3 e `only showing top 3 rows` | dados ocultos |
| 13 | `sp-renomear` | Renomear e remover | fácil | `limpo` = `vendas.csv` sem a coluna `data` e com `preco` renomeada para `preco_unitario` | `drop("data").withColumnRenamed("preco", "preco_unitario")` | `dataframe limpo` (colunas na ordem `regiao, produto, quantidade, preco_unitario`) | dados ocultos |
| 14 | `sp-when` | Faixa de idade | médio | em `pessoas.csv`, `faixas` = `nome` e `faixa` (`"criança"` < 12, `"jovem"` < 18, `"adulto"` < 60, senão `"idoso"`) | `F.when(...).when(...).when(...).otherwise("idoso")` | `dataframe faixas` | dados ocultos |
| 15 | `sp-strings` | Texto arrumado | médio | em `pessoas.csv` (com espaços e maiúsculas misturadas nos nomes), `cartao` = coluna `rotulo` = `NOME - Cidade` (`upper(trim(nome))`, ` - `, `initcap(cidade)`; cidade `NULL` vira `SEM CIDADE`) | `F.concat_ws(" - ", F.upper(F.trim("nome")), F.coalesce(F.initcap("cidade"), F.lit("SEM CIDADE")))` | `dataframe cartao` | dados ocultos |
| 16 | `sp-datas` | Vendas por mês | médio | em `vendas.csv`, `por_mes` = `ano`, `mes` e `quantidade` total, ordenado por ano e mês | `to_date`, `year`, `month`, `groupBy("ano", "mes").agg(F.sum("quantidade").alias("quantidade")).orderBy("ano", "mes")` | `dataframe por_mes` com `ordem: true` | dados ocultos |
| 17 | `sp-cast` | Tipos certos | médio | ler `vendas.csv` **sem** `inferSchema` e fazer `tipado` com `quantidade` como `int` e `preco` como `double` | `withColumn("quantidade", F.col("quantidade").cast("int"))`… | `dataframe tipado` com `tipos ['string','string','string','int','double']`; `semCodigo 'inferSchema'` | dados ocultos |
| 18 | `sp-na-fill` | Preencher nulos | fácil | em `pessoas.csv`, `completo` com `cidade` nula → `"Não informada"` e `nota` nula → `0.0` | `na.fill({"cidade": "Não informada", "nota": 0.0})` | `dataframe completo` | dados ocultos |
| 19 | `sp-na-drop` | Tirar linhas sem nota | fácil | em `pessoas.csv`, `com_nota` só com as pessoas que têm `nota` | `dropna(subset=["nota"])` | `dataframe com_nota` | dados ocultos |
| 20 | `sp-coalesce-null` | Primeiro contato disponível | médio | `contatos.csv` (`nome,telefone,email`); `contato` = `nome` e `meio` = o telefone, se houver, senão o email, senão `"sem contato"` | `F.coalesce("telefone", "email", F.lit("sem contato"))` | `dataframe contato` | dados ocultos |
| 21 | `sp-group-count` | Vendas por região | fácil | `por_regiao` = quantas vendas cada região teve, em ordem alfabética | `groupBy("regiao").count().orderBy("regiao")` | `dataframe por_regiao` (colunas `regiao, count`, `ordem: true`); `paralelo {workers: 2}` | dados ocultos |
| 22 | `sp-agg` | Resumo por região | médio | `resumo` = por região: `receita` (soma de `quantidade * preco`, 2 casas), `preco_medio` (2 casas) e `produtos` (produtos distintos) | `groupBy("regiao").agg(F.round(F.sum(...), 2).alias("receita"), …, F.countDistinct("produto").alias("produtos"))` | `dataframe resumo` (colunas, tipos `string, double, double, bigint` e linhas) | dados ocultos |

(As linhas esperadas de cada `dataframe` saem dos dados de cada caso; escreva-as à mão e confira com a solução de referência rodando — a regra compara com `aprox: 1e-9`.)

- [ ] **Step 4: Trilha, certificado e badge**

`src/conteudo/trilha.js`: importe `moduloPyspark`, acrescente em `modulos` e tire `pyspark` de `PROXIMOS_MODULOS`; no `LIVRE.resumo`, um parágrafo: `<p>O PySpark também funciona aqui: <code>from pyspark.sql import SparkSession</code>. Depois de uma ação (<code>show</code>, <code>count</code>), veja a aba <b>⚡ Execução</b>.</p>`. Acrescente `CERTIFICADOS.pyspark` e `BADGES.pyspark` (valores acima), rode `npm run badges` e confira a capa gerada (`public/og-capa.png`).

Run: `npm run badges && npx vitest run tests/conteudo.test.js -t "sp-"`
Expected: os 22 exercícios passam nos dois testes (solução aprova, código inicial reprova).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "PySpark: 14 lições e exercícios 1 a 22, certificado e badge"
```

---

### Task 10: Módulo ✨ PySpark — exercícios 23 a 45 e glossário

**Files:**
- Create: `src/conteudo/pyspark-avancado.js` (exercícios 23–45, em blocos `exerciciosAgregacoes`, `exerciciosJoins`, `exerciciosJanelas`, `exerciciosLeitura`, `exerciciosSql`, `exerciciosDesempenho`)
- Modify: `src/conteudo/pyspark.js` (espalha os blocos depois das lições), `src/conteudo/glossario.js`, `tests/carga-horaria.test.js` (se precisar de caso próprio)

Dados novos: `clientes.csv` (`id_cliente,nome,cidade`, 5 linhas) e `pedidos.csv` (`id_pedido,id_cliente,valor`, 7 linhas, um cliente sem pedido e um pedido de cliente desconhecido); `notas.json` (uma linha por aluno: `nome`, `turma`, `nota`); `leituras.csv` (`dia,sensor,temperatura`, 6 dias de dois sensores do sertão); `regioes.csv` (`regiao,capital`, a tabela pequena do broadcast). Os ocultos trocam por outros dados.

- [ ] **Step 1: Exercícios 23 a 45**

| # | id | título | dif. | o que pede | solução de referência | visíveis | ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 23 | `sp-pivot` | Quantidade por produto e mês | difícil | `tabela` = uma linha por produto e uma coluna por mês (`1`, `2`…) com a quantidade total; mês sem venda fica `NULL`; ordenado por produto | `withColumn("mes", F.month(F.to_date("data"))).groupBy("produto").pivot("mes").sum("quantidade").orderBy("produto")` | `dataframe tabela` (colunas e linhas, `ordem: true`); `codigo 'pivot'` | dados ocultos |
| 24 | `sp-collect-list` | Produtos de cada região | médio | `listas` = por região, `produtos` = lista ordenada dos produtos distintos | `F.sort_array(F.collect_set("produto")).alias("produtos")` | `dataframe listas` | dados ocultos |
| 25 | `sp-join-inner` | Pedidos com o nome | fácil | `com_nome` = `pedidos.csv` com o `nome` do cliente (só os pedidos de clientes conhecidos) | `pedidos.join(clientes, "id_cliente")` | `dataframe com_nome` (colunas `id_cliente, id_pedido, valor, nome, cidade`) | dados ocultos |
| 26 | `sp-join-left` | Pedidos por cliente | médio | `por_cliente` = todos os clientes com `pedidos` (quantos fez, 0 para quem não fez) | `clientes.join(pedidos, "id_cliente", "left").groupBy("id_cliente", "nome").agg(F.count("id_pedido").alias("pedidos"))` | `dataframe por_cliente` | dados ocultos |
| 27 | `sp-anti-join` | Clientes sem pedido | médio | `sem_pedido` = os clientes que não aparecem em `pedidos.csv` | `clientes.join(pedidos, "id_cliente", "left_anti")` | `dataframe sem_pedido`; `codigo 'left_anti'` | dados ocultos |
| 28 | `sp-broadcast` | Broadcast da tabela pequena | médio | `com_capital` = `vendas.csv` com a `capital` de `regioes.csv`, mandando a tabela pequena por broadcast | `vendas.join(F.broadcast(regioes), "regiao")` | `dataframe com_capital`; `plano com_capital {broadcast: true, shuffles: 0}` | dados ocultos |
| 29 | `sp-sort-merge` | Sem broadcast | difícil | desligar o broadcast automático (`spark.sql.autoBroadcastJoinThreshold = -1`) e juntar `pedidos` e `clientes` em `juntos`; mostrar o plano | `spark.conf.set(...)`, `join` e `explain()` | `dataframe juntos`; `plano juntos {broadcast: false, shuffles: 2}`; `saida 'SortMergeJoin'` | dados ocultos |
| 30 | `sp-row-number` | O campeão de cada região | médio | `campeoes` = em cada região, o produto de maior receita (`quantidade * preco`), com `regiao`, `produto` e `receita` (2 casas) | `row_number().over(Window.partitionBy("regiao").orderBy(F.desc("receita")))` e `filter(rn == 1)` | `dataframe campeoes`; `codigo 'row_number'` | dados ocultos (sem empates de receita dentro de uma região) |
| 31 | `sp-rank` | Ranking com empates | médio | em `notas.json`, `ranking` = `nome`, `nota`, `rank` e `dense_rank` por turma, da maior nota para a menor | `F.rank().over(w)` e `F.dense_rank().over(w)` | `dataframe ranking` (dados com empates de nota, ordenando por nota e nome para desempatar o `row` — rank e dense_rank não dependem do desempate) | dados ocultos |
| 32 | `sp-lag` | Variação de um dia para o outro | difícil | em `leituras.csv`, `variacao` = `dia`, `sensor`, `temperatura` e `variacao` = temperatura − a do dia anterior do mesmo sensor (`NULL` no primeiro dia) | `F.col("temperatura") - F.lag("temperatura").over(Window.partitionBy("sensor").orderBy("dia"))` | `dataframe variacao`; `codigo 'lag'` | dados ocultos |
| 33 | `sp-soma-acumulada` | Receita acumulada | difícil | `acumulado` = por data (em ordem), a receita do dia e a `acumulada` até ali | `F.sum("receita").over(Window.orderBy("data").rowsBetween(Window.unboundedPreceding, Window.currentRow))` sobre a receita por data | `dataframe acumulado` (`ordem: true`); `codigo 'rowsBetween'` | dados ocultos |
| 34 | `sp-media-movel` | Média móvel de 3 dias | difícil | em `leituras.csv`, `media_movel` = por sensor e dia, a média da temperatura do dia e dos 2 anteriores, 2 casas | `F.round(F.avg("temperatura").over(Window.partitionBy("sensor").orderBy("dia").rowsBetween(-2, 0)), 2)` | `dataframe media_movel` | dados ocultos |
| 35 | `sp-ler-json` | Ler JSON | fácil | ler `notas.json` em `notas` e mostrar o schema | `spark.read.json("notas.json")` e `printSchema()` | `dataframe notas` com `tipos ['string','double','bigint']` (ordem alfabética: `nome, nota, turma`); `saida ' |-- nota: double (nullable = true)'` | dados ocultos |
| 36 | `sp-schema-ddl` | Schema escrito à mão | médio | ler `pessoas.csv` com o schema `nome STRING, idade INT, cidade STRING, nota DOUBLE` em `pessoas` | `spark.read.schema("…").csv("pessoas.csv", header=True)` | `dataframe pessoas` com `tipos ['string','int','string','double']`; `semCodigo 'inferSchema'` | dados ocultos |
| 37 | `sp-escrever-csv` | Gravar o resultado | médio | gravar as vendas do Nordeste em `saida/` como CSV com cabeçalho (`overwrite`, um arquivo só) e ler de volta em `relidas` | `filter(...).coalesce(1).write.mode("overwrite").csv("saida", header=True)` e `spark.read.csv("saida", header=True, inferSchema=True)` | `dataframe relidas` (linhas do Nordeste); `codigo 'coalesce\\(1\\)'`; `codigo 'write'` | dados ocultos |
| 38 | `sp-sql-select` | Primeira consulta SQL | fácil | criar a view `vendas` e fazer `caras` com `spark.sql`: produto e preço das vendas com preço acima de 10, do mais caro ao mais barato | `createOrReplaceTempView("vendas")` e `SELECT produto, preco FROM vendas WHERE preco > 10 ORDER BY preco DESC` | `dataframe caras` (`ordem: true`); `codigo 'spark\\.sql'` | dados ocultos |
| 39 | `sp-sql-group` | GROUP BY e HAVING | médio | `fortes` = regiões com receita total acima de 50 (`receita` com 2 casas), em SQL | `SELECT regiao, ROUND(SUM(quantidade * preco), 2) AS receita FROM vendas GROUP BY regiao HAVING SUM(quantidade * preco) > 50` | `dataframe fortes`; `codigo 'HAVING'` | dados ocultos |
| 40 | `sp-sql-join` | JOIN em SQL | médio | `total_por_cidade` = por cidade do cliente, a soma dos pedidos (2 casas), em SQL com `JOIN` | `SELECT c.cidade, ROUND(SUM(p.valor), 2) AS total FROM pedidos p JOIN clientes c ON p.id_cliente = c.id_cliente GROUP BY c.cidade` | `dataframe total_por_cidade`; `codigo 'JOIN'` | dados ocultos |
| 41 | `sp-sql-window` | Janela em SQL | difícil | `ultimas` = a leitura mais recente de cada sensor, com `ROW_NUMBER() OVER (PARTITION BY sensor ORDER BY dia DESC)` | subconsulta com o `ROW_NUMBER` e `WHERE pos = 1` | `dataframe ultimas`; `codigo 'OVER'` | dados ocultos |
| 42 | `sp-menos-shuffle` | Um shuffle a menos | médio | o código inicial faz `vendas.repartition(4).groupBy("regiao").agg(...)` (2 shuffles): chegue ao mesmo `resumo` com 1 | tirar o `repartition` | `dataframe resumo`; `plano resumo {shuffles: 1}` | dados ocultos |
| 43 | `sp-cache` | Cache para duas ações | médio | `caros` (vendas com preço > 10) é usado por duas ações (`count` e `show`): guarde em cache antes | `caros = ….cache()` | `plano caros {cache: true}`; `variavel n` (a contagem); `codigo 'cache\\(\\)'` | dados ocultos |
| 44 | `sp-repartition` | Partições sob medida | médio | `por_regiao` = `vendas` reparticionado em 3 partições pela coluna `regiao`, e `uma` = `por_regiao` em uma partição só (sem shuffle) | `repartition(3, "regiao")` e `coalesce(1)` | `plano por_regiao {particoes: 3, shuffles: 1}`; `plano uma {particoes: 1, shuffles: 1}`; `codigo 'coalesce'` | dados ocultos |
| 45 | `sp-skew` | Sal contra o desequilíbrio | difícil | `cliques.csv` (`id,pagina,cliques`) tem uma página com quase todas as linhas; some os cliques por página em duas etapas, com a coluna `sal` = `F.col("id") % 4`: primeiro por `pagina` e `sal`, depois só por `pagina`, em `total` (colunas `pagina, cliques`) | `withColumn("sal", F.col("id") % 4).groupBy("pagina", "sal").agg(F.sum("cliques").alias("parcial")).groupBy("pagina").agg(F.sum("parcial").alias("cliques"))` | `dataframe total`; `plano total {shuffles: 2}`; `codigo 'sal'` | dados ocultos |

O enunciado do 45 explica que, no Spark real, o sal costuma ser aleatório (`F.rand()`) e que aqui a coluna `id` deixa o resultado igual a cada execução.

Ordem na trilha: `licao-spark-session`, `licao-rdd` (1, 2), `licao-rdd-pares` (3, 5, 6), `licao-particoes-spark` (4, 8, 44), `licao-dataframe` (9, 10, 11, 12, 13), `licao-funcoes` (14, 15, 16, 17), `licao-udf` (7), `licao-nulos` (18, 19, 20), `licao-agregacoes` (21, 22, 23, 24), `licao-joins` (25, 26, 27, 28, 29), `licao-window` (30, 31, 32, 33, 34), `licao-leitura` (35, 36, 37), `licao-sql` (38, 39, 40, 41), `licao-shuffle-cache` (42, 43, 45).

Dificuldades: fácil 1, 2, 9, 10, 11, 12, 13, 18, 19, 21, 25, 35, 38 (13); difícil 8, 23, 29, 32, 33, 34, 41, 45 (8); os outros 24 são médios. Carga: 24 h (Task 9).

- [ ] **Step 2: Glossário**

Bloco `// ---------- PySpark ----------` em `src/conteudo/glossario.js`, com `INICIO_DO_NIVEL.pyspark = 'spark'`: `spark` (Spark), `sparksession` (SparkSession), `rdd` (RDD), `dataframe` (DataFrame), `preguicosa` (Avaliação preguiçosa: transformação e ação), `schema` (Schema), `shuffle` (Shuffle), `estagio` (Estágio e tarefa), `broadcast` (Broadcast), `join` (Join), `janela` (Função de janela), `spark-sql` (Spark SQL e view), `cache` (Cache), `explain` (Plano de execução / explain), `udf` (UDF), `nulo` (Valor nulo / NULL). Formato existente (`id, termo, padroes, definicao, analogia, exemplo`).

- [ ] **Step 3: Rodar**

Run: `npx vitest run && npx eslint . && python -m pytest -q`
Expected: PASS (inclusive a carga de 24 h e o `['pyspark', 45, 14]`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "PySpark: exercícios 23 a 45 (agregações, joins, janelas, leitura, SQL e desempenho) e glossário"
```

---

### Task 11: Versão 0.4.0, textos e publicação

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/novidades.js`, `README.md`, `src/ui/declaracao-acessibilidade.js`, `src/ui/tutorial-passos.js` (se citar os módulos publicados), textos com a contagem de exercícios (procure `115`)

- [ ] **Step 1: Versão e textos**

`"version": "0.4.0"`. `src/novidades.js`, no topo:

```js
  {
    versao: '0.4.0',
    data: '2026-10-13', // a data do dia da publicação
    titulo: 'PySpark no navegador',
    resumo: 'O quarto módulo: RDD, DataFrame, joins, janelas e Spark SQL, com as partições rodando em paralelo no seu computador.',
    grupos: [
      { titulo: '✨ PySpark', itens: ['14 lições e 45 exercícios: RDD, DataFrame, nulos, agregações, joins e broadcast, Window, leitura e escrita, Spark SQL, partições, shuffle, cache, explain e UDF.', 'Certificado PySpark para Dados.'] },
      { titulo: '⚡ Execução', itens: ['Uma aba nova mostra os estágios, as tarefas de cada partição e a linha do tempo dos workers, com uma tabela equivalente.', 'show(), printSchema(), explain() e as mensagens de erro saem no formato do Spark, conferidas com o PySpark real a cada versão.'] },
      { titulo: '♿ Acessibilidade', itens: ['O leitor de tela fala o resumo da execução: estágios, shuffles, tarefas e workers.'] },
    ],
  },
```

`README.md`: ✨ PySpark sai de "Em breve" e entra em "O que tem"; seção "PySpark" nova (o pacote `python/pyspark`, a API coberta, o que fica para a fase 5, a conformidade no CI e o aviso de que é uma implementação para aprender); as regras `dataframe` e `plano` na tabela de regras.

`declaracao-acessibilidade.js`, "Limites conhecidos": um item novo — `O PySpark daqui é uma implementação para aprender, com a API do PySpark 4, e não o Spark: os resultados, o show() e os erros seguem o Spark, mas o desempenho e os detalhes internos não.` — e um item sobre a aba ⚡ Execução (a linha do tempo é visual, e a tabela logo abaixo tem as mesmas informações em texto). `ATUALIZADA_EM` com a data do dia.

Procure `115` nos textos (landing, SEO, prerender) e troque pela contagem nova (160), se não vier de `problemas.length`.

- [ ] **Step 2: Auditoria**

Run: `npx eslint . && npx vitest run && python -m pytest -q && CERTIFICADO_SEGREDO=<valor aleatório descartável> npm run build`
Expected: tudo verde, build sem avisos.

No navegador (build + preview, com os servidores de outras sessões fechados por causa da memória): `#/p/licao-spark-session` (sem job antes do `count`), `#/p/sp-contar-palavras` (solução: Executar → status com "⚡ … tarefas em … workers", aba ⚡ Execução com 2 estágios; Enviar → Aceito), `#/p/sp-sort-merge` (o `explain()` no terminal), `#/p/sp-broadcast`, `#/livre` com um `groupBy().show()`; axe-core sem violações nos 4 temas a 1280 px e a 320 px em `#/`, `#/trilha`, `#/p/licao-joins`, `#/p/sp-agg` (aba ⚡ Execução aberta) e `#/livre`. O job `conformidade` do PR de rascunho (Task 6) tem de estar verde.

- [ ] **Step 3: Pedir o "sim" do usuário**

Mostre o resumo (o que entra na 0.4.0, testes, conformidade e auditoria) e pergunte se pode publicar. Não siga sem o "sim".

- [ ] **Step 4: Publicar (depois do "sim")**

```bash
git push origin fase-4
gh pr ready -R sertaoseracloud/python-playground fase-4
git checkout main && git merge --ff-only fase-4 && git push origin main
gh run watch $(gh run list -R sertaoseracloud/python-playground --branch main --limit 1 --json databaseId -q '.[0].databaseId') -R sertaoseracloud/python-playground --exit-status
git tag -a v0.4.0 -m "Versão 0.4.0" && git push --follow-tags
gh release create v0.4.0 -R sertaoseracloud/python-playground --verify-tag --title "v0.4.0 · PySpark" --notes-file ../notas-0.4.0.md
```

(confira que o run acompanhado é o do commit novo; o PR de rascunho fecha sozinho como "merged" com o push na `main`; `../notas-0.4.0.md` com o título e os três grupos da entrada 0.4.0.)

- [ ] **Step 5: Conferir o site publicado**

`curl -s https://sertaoseracloud.github.io/python-playground/ | grep -o "160 exercícios"` e, no navegador, `#/p/sp-contar-palavras`: Enviar com a solução → "Aceito! 🎉", status com os workers e a aba ⚡ Execução com os estágios.
