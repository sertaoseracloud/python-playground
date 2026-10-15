# Fase 5, plano 4: conteúdo e correção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o módulo 🌊 Spark além do batch (`alem`): as regras `stream`, `modelo` e `delta`, o bloco `modelos` do executor, os dados, as 12 lições e os 36 exercícios, o certificado, o badge, o glossário, a documentação e a versão 0.5.0.

**Architecture:** O executor Python (`python/diverge_runtime/execucao.py`) ganha o bloco `modelos` (com as métricas pedidas pela correção) e o número de linhas de cada versão no bloco `deltas`. As três regras novas em `src/verificacoes.js` leem `streaming`, `deltas` e `modelos`. O conteúdo fica em `src/conteudo/alem-*.js`, com dados pequenos escritos à mão, para que cada valor esperado possa ser conferido de cabeça.

**Tech Stack:** Pyodide (Python 3.12) com o `pyspark`, o `delta` e o `pyspark.ml` próprios; JavaScript (ES modules), Vite, vitest, pytest, eslint.

**Spec:** `docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md` (seções 2.1, 3, 5, 6 e 7).

## Global Constraints

- Módulo `alem`, título "Spark além do batch", ícone 🌊; sai de `PROXIMOS_MODULOS`.
- 12 lições (4 por área) e 36 exercícios: em cada área, 3 fáceis, 6 médios e 3 difíceis. Ordem: Delta → Streaming → MLlib.
- Carga horária do certificado: **20 h** (12×10 + 9×15 + 18×30 + 9×45 = 1200 min).
- Certificado `alem`: "Streaming, Machine Learning e Delta Lake com Spark", resumo "concluiu o módulo Spark além do batch, resolvendo os 36 problemas práticos", na cadeia depois de `pyspark`.
- Categorias das regras novas: Streaming, Modelo e Delta. Motivos em português, como os exemplos da spec.
- Todo exercício tem um caso visível e um oculto com outros dados; o código inicial falha em algum caso visível.
- Versão **0.5.0**. Publicar (push, PR, merge, tag) só com o "sim" do usuário.
- Commits como `Cláudio Raposo <engcfraposo@gmail.com>` (via `git -c user.name=... -c user.email=...`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O valor de `CERTIFICADO_SEGREDO` nunca aparece no código nem no site; o build local usa um valor aleatório: `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.
- Neste Windows o `rtk` esconde saídas: use `rtk proxy <comando>`, e leia o pytest de um arquivo com `PYTHONIOENCODING=utf-8`.

## Review Focus

1. **Modelo não treinado na regra `modelo`** (a variável guarda o estimador, sem `fit`): o motivo deve dizer "sem treino", e não "a variável não existe". Testes na Task 1 (estimadores no `resumo` com `treinado: False`) e na Task 2 (motivo).
2. **Métrica que falha ao calcular** (arquivo de teste que não existe, categoria nova, `preparar` errado): a correção mostra o erro, sem derrubar a execução. Testes na Task 1 (`metricas[...] = {'erro': ...}`) e na Task 2 (motivo "calcular rmse em … deu …").
3. **Caso oculto com mais arquivos de streaming que o visível** (`lote-04.csv` só no oculto): os lotes seguem a ordem dos nomes. Coberto pelos casos ocultos da Task 5, que conferem 4 lotes.
4. **Regra `stream` sem consulta nenhuma** (o programa não chama `start()`, `streaming: null`): motivo "a consulta X não existe", sem exceção no JS. Teste na Task 2.
5. **`descreverRegra` das regras novas antes de rodar** (aba Testes, casos pendentes, contexto vazio): devolve a mensagem sem quebrar. Teste na Task 2.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `python/diverge_runtime/modelos.py` (novo) | Descreve os modelos e estimadores do MLlib nas variáveis do aluno e calcula as métricas pedidas. |
| `python/diverge_runtime/deltas.py` | `resumo()` ganha `linhasPorVersao`. |
| `python/diverge_runtime/execucao.py` | Parâmetro `avaliacoes` e bloco `modelos` no resultado. |
| `src/python/sessao.js` | Passa `avaliacoes` para o Python. |
| `src/corrigir.js` | Monta as `avaliacoes` das regras `modelo` e passa `streaming`, `deltas` e `modelos` às regras. |
| `src/verificacoes.js` | Regras `stream`, `modelo` e `delta`, categorias e dicas. |
| `src/conteudo/alem-dados.js` (novo) | Os dados do módulo (visíveis e ocultos). |
| `src/conteudo/alem-comum.js` (novo) | `exercicioAlem` e `programaAlem`. |
| `src/conteudo/alem-delta.js` (novo) | 4 lições e 12 exercícios de Delta Lake. |
| `src/conteudo/alem-streaming.js` (novo) | 4 lições e 12 exercícios de Structured Streaming. |
| `src/conteudo/alem-mllib.js` (novo) | 4 lições e 12 exercícios de MLlib. |
| `src/conteudo/alem.js` (novo) | `moduloAlem`, na ordem das lições. |
| `src/conteudo/trilha.js`, `src/certificados.js`, `src/badges.js`, `src/conteudo/glossario.js` | O módulo na trilha, o certificado, o badge e os termos. |
| Documentação | Declaração de acessibilidade, README, novidades 0.5.0 e a spec. |

---

### Task 1: O executor devolve `modelos` e as linhas de cada versão Delta

**Files:**
- Create: `python/diverge_runtime/modelos.py`
- Modify: `python/diverge_runtime/deltas.py` (`resumo`), `python/diverge_runtime/execucao.py` (`executar`, `executar_json`), `src/python/sessao.js` (`executar`)
- Test: `python/tests/test_runtime.py`, `tests/spark.test.js`

**Interfaces:**
- Produces: `executar(..., avaliacoes=())`, e o resultado com `'modelos': {variavel: {tipo, treinado?, ultimo?, coeficientes?, intercepto?, k?, profundidade?, metricas: {'<nome>@<dados>': float | {'erro': {tipo, mensagem}}}}}`.
- Produces: `deltas[caminho].linhasPorVersao: [int]` (o índice é a versão; até 20 versões).
- Produces: `sessao.executar(arquivos, { ..., avaliacoes })`, com `avaliacoes = [{ variavel, nome, dados, preparar? }]`.

- [ ] **Step 1: Write the failing tests (pytest)**

Acrescente a `python/tests/test_runtime.py` (o arquivo já importa `executar` de `diverge_runtime.execucao`; confira o topo):

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests/test_runtime.py -q -p no:randomly -k "modelos or linhas_de_cada" > /tmp/pt.txt 2>&1; tail -5 /tmp/pt.txt`
Expected: 4 failed (`KeyError: 'modelos'`, `TypeError: ... 'avaliacoes'`, `KeyError: 'linhasPorVersao'`).

- [ ] **Step 3: Write `python/diverge_runtime/modelos.py`**

```python
"""Os modelos do MLlib nas variáveis do aluno, para a regra `modelo` (src/verificacoes.js).

Cada modelo treinado vira {tipo, coeficientes, intercepto, k, profundidade}, conforme o tipo; um
estimador sem fit vira {tipo, treinado: False}. Um PipelineModel é descrito pelo último estágio que
é modelo (o da previsão). As métricas pedidas pela correção (`avaliacoes`) rodam aqui, depois do
programa, fora da aba ⚡ Execução."""
import sys

from . import estagios

_TIPOS_DE_METRICA = {
    'rmse': 'regressao', 'mse': 'regressao', 'mae': 'regressao', 'r2': 'regressao',
    'areaUnderROC': 'binaria', 'areaUnderPR': 'binaria',
    'accuracy': 'multiclasse', 'f1': 'multiclasse',
    'silhouette': 'agrupamento',
}


def _ultimo(modelo):
    from pyspark.ml.base import Model
    from pyspark.ml.pipeline import PipelineModel
    if isinstance(modelo, PipelineModel):
        treinados = [s for s in modelo.stages if isinstance(s, Model)]
        return treinados[-1] if treinados else modelo
    return modelo


def descrever(modelo):
    alvo = _ultimo(modelo)
    d = {'tipo': type(modelo).__name__}
    if alvo is not modelo:
        d['ultimo'] = type(alvo).__name__
    if hasattr(alvo, 'coefficients'):
        d['coeficientes'] = [float(x) for x in alvo.coefficients.toArray()]
        d['intercepto'] = float(alvo.intercept)
    if hasattr(alvo, 'clusterCenters'):
        d['k'] = len(alvo.clusterCenters())
    if hasattr(alvo, 'depth'):
        d['profundidade'] = int(alvo.depth)
    return d


def _avaliador(alvo, nome):
    from pyspark.ml import evaluation as E
    tipo = _TIPOS_DE_METRICA[nome]
    previsao = alvo.getOrDefault('predictionCol')
    if tipo == 'agrupamento':
        return E.ClusteringEvaluator(featuresCol=alvo.getOrDefault('featuresCol'), predictionCol=previsao)
    rotulo = alvo.getOrDefault('labelCol')
    if tipo == 'regressao':
        return E.RegressionEvaluator(labelCol=rotulo, predictionCol=previsao, metricName=nome)
    if tipo == 'binaria':
        return E.BinaryClassificationEvaluator(labelCol=rotulo, rawPredictionCol=alvo.getOrDefault('rawPredictionCol'), metricName=nome)
    return E.MulticlassClassificationEvaluator(labelCol=rotulo, predictionCol=previsao, metricName=nome)


def avaliar(escopo, pedido):
    """Lê `pedido['dados']` (CSV com cabeçalho), aplica `preparar` (um transformador do aluno), o
    modelo e o avaliador da métrica `pedido['nome']`."""
    from pyspark.sql import SparkSession
    modelo = escopo[pedido['variavel']]
    df = SparkSession.builder.getOrCreate().read.csv(pedido['dados'], header=True, inferSchema=True)
    if pedido.get('preparar'):
        df = escopo[pedido['preparar']].transform(df)
    return float(_avaliador(_ultimo(modelo), pedido['nome']).evaluate(modelo.transform(df)))


def resumo(escopo, avaliacoes=()):
    if 'pyspark.ml.base' not in sys.modules:
        return {}  # o aluno não usou o MLlib: não há modelo nenhum
    from pyspark.ml.base import Estimator, Model
    saida = {}
    for nome, valor in list(escopo.items()):
        if nome.startswith('_'):
            continue
        if isinstance(valor, Model):
            saida[nome] = {**descrever(valor), 'metricas': {}}
        elif isinstance(valor, Estimator):
            saida[nome] = {'tipo': type(valor).__name__, 'treinado': False, 'metricas': {}}
    for pedido in avaliacoes:
        alvo = saida.get(pedido['variavel'])
        if alvo is None or alvo.get('treinado') is False:
            continue
        chave = f"{pedido['nome']}@{pedido['dados']}"
        try:
            with estagios.local():
                alvo['metricas'][chave] = avaliar(escopo, pedido)
        except Exception as e:  # a métrica que falha vira motivo na correção
            alvo['metricas'][chave] = {'erro': {'tipo': type(e).__name__, 'mensagem': str(e)}}
    return saida
```

- [ ] **Step 4: Wire it in `execucao.py`, `deltas.py` and `sessao.js`**

Em `python/diverge_runtime/execucao.py`:
- import: `from . import deltas, estagios, modelos, pool, streams`;
- assinatura: `def executar(arquivos, principal='main.py', entrada=(), chamadas=(), interativo=False, argv=None, avaliacoes=()):`;
- junto de `resumo_streaming = None`: `resumo_modelos = {}`;
- logo depois de `resumo_streaming = streams.resumo()`: `resumo_modelos = {} if precisa else modelos.resumo(escopo, avaliacoes)`;
- no dicionário devolvido, depois de `'streaming': resumo_streaming,`: `'modelos': resumo_modelos,`;
- em `executar_json`, um argumento a mais no fim da chamada: `list(args.get('avaliacoes', None) or []),`.

Em `python/diverge_runtime/deltas.py` (acrescente `import json` no topo, se não houver), troque `resumo()` por:

```python
LIMITE_VERSOES = 20


def _linhas(snap):
    return sum(json.loads(a.get('stats') or '{}').get('numRecords', 0) for a in snap.arquivos.values())


def resumo():
    from delta import _log
    saida = {}
    for caminho in _CAMINHOS:
        if not _log.eh_delta(caminho):
            continue
        snap = _log.snapshot(caminho)
        operacoes = [info.get('operation') for _, info in reversed(_log.historico(caminho))]
        nome = os.path.relpath(caminho).replace('\\', '/')
        versoes = _log.versoes(caminho)[:LIMITE_VERSOES]
        saida[nome] = {'versao': snap.versao, 'operacoes': operacoes, 'colunas': snap.schema.names,
                       'linhasPorVersao': [_linhas(_log.snapshot(caminho, v)) for v in versoes]}
    return saida
```

Em `src/python/sessao.js`, no `executar`:

```js
    executar(arquivos, {
      principal = 'main.py', entrada = [], chamadas = [], interativo = false, argv = [], avaliacoes = [], ...ganchos
    } = {}) {
      return chamar('import diverge_runtime.execucao as _e\n_e.executar_json',
        // null (Ctrl+D numa execução repetida) vira undefined, que chega no Python como None.
        { arquivos, principal, entrada: entrada.map((r) => r ?? undefined), chamadas, interativo, argv, avaliacoes }, ganchos);
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > /tmp/pt.txt 2>&1; tail -3 /tmp/pt.txt`
Expected: tudo passa (172 passed). Se `getOrDefault('rawPredictionCol')` (ou outro parâmetro) der `KeyError` em algum modelo, acrescente a chave aos `_padroes` do estimador com o padrão do Spark (por exemplo `'rawPredictionCol': 'rawPrediction'`) e rode de novo.

- [ ] **Step 6: Test it end to end in Pyodide**

Acrescente a `tests/spark.test.js`, depois do teste do MLlib:

```js
  it('a correção pede a métrica, e o resultado traz o bloco modelos', async () => {
    const r = await (await sessao).executar({ 'main.py': `${INICIO}from pyspark.ml.feature import VectorAssembler\nfrom pyspark.ml.regression import LinearRegression\n`
      + 'montador = VectorAssembler(inputCols=["x"], outputCol="features")\n'
      + 'm = LinearRegression().fit(montador.transform(spark.read.csv("t.csv", header=True, inferSchema=True)))\n',
    't.csv': 'x,label\n0,2.0\n1,5.0\n2,8.0\n3,11.0\n' },
    { avaliacoes: [{ variavel: 'm', nome: 'rmse', dados: 't.csv', preparar: 'montador' }] });
    expect(r.erro).toBeNull();
    expect(r.modelos.m.tipo).toBe('LinearRegressionModel');
    expect(r.modelos.m.metricas['rmse@t.csv']).toBeLessThan(1e-9);
  }, 120_000);
```

Run: `rtk proxy npx vitest run tests/spark.test.js 2>&1 | grep -E "Tests |×"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add python/diverge_runtime/modelos.py python/diverge_runtime/deltas.py python/diverge_runtime/execucao.py src/python/sessao.js python/tests/test_runtime.py tests/spark.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Executor: bloco modelos (com as métricas da correção) e linhas por versão Delta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: As regras `stream`, `modelo` e `delta`

**Files:**
- Modify: `src/verificacoes.js`, `src/corrigir.js`
- Test: `tests/verificacoes.test.js`, `tests/corrigir.test.js`

**Interfaces:**
- Consumes: os blocos `streaming`, `deltas` (com `linhasPorVersao`) e `modelos` do resultado (Task 1).
- Produces: as regras
  - `{ stream: nome, modo?, lotes?, saidaPorLote?: [n], marcaDagua?: 'AAAA-MM-DDTHH:MM', descartadas? }`;
  - `{ modelo: variavel, tipo?, coeficientes?, intercepto?, aprox? (padrão 1e-6), k?, profundidade?, metrica?: { nome, min | max, dados, preparar? } }`;
  - `{ delta: caminho, versao?, operacoes?: [..], colunas?: [..], linhasNaVersao?: { versao, linhas } }`.
- Produces: `verificarRegra(regra, { ..., streaming, deltas, modelos })`, e `corrigir` passando `avaliacoes` ao `executar`.

- [ ] **Step 1: Write the failing tests**

Acrescente a `tests/verificacoes.test.js` (confira no topo do arquivo que `verificarRegra`, `categoriaDe` e `descreverRegra` estão importados de `../src/verificacoes.js`; acrescente os que faltarem):

```js
describe('regra stream', () => {
  const lote = (id, saida, marcaDagua = null, descartadas = 0) => ({ id, entrada: 2, arquivos: [], estado: 0, marcaDagua, saida, descartadas });
  const streaming = { consultas: [{ nome: 'janelas', modo: 'update', formato: 'memory', lotes: [lote(0, 1), lote(1, 1), lote(2, 1, '2026-03-10T08:16:00.000Z', 1)] }] };
  const ver = (regra) => verificarRegra(regra, { streaming });

  it('passa quando lotes, saída, modo, marca d\'água e descartadas batem', () => {
    const r = ver({ stream: 'janelas', modo: 'update', lotes: 3, saidaPorLote: [1, 1, 1], marcaDagua: '2026-03-10T08:16', descartadas: 1 });
    expect(r.ok).toBe(true);
    expect(r.obtido).toBe('3 lotes · saída por lote [1, 1, 1] · update');
  });

  it.each([
    [{ stream: 'alertas' }, 'a consulta alertas não existe (use .queryName("alertas") e .start())'],
    [{ stream: 'janelas', lotes: 1 }, 'esperado 1 lote, vieram 3'],
    [{ stream: 'janelas', saidaPorLote: [1, 3, 1] }, 'o lote 1 devia emitir 3 linhas, emitiu 1'],
    [{ stream: 'janelas', modo: 'complete' }, 'o modo devia ser complete, é update'],
    [{ stream: 'janelas', marcaDagua: '2026-03-10T08:10' }, "a marca d'água final devia ser 08:10, foi 08:16"],
    [{ stream: 'janelas', descartadas: 0 }, 'deviam ser descartadas 0 linhas atrasadas, foram 1'],
  ])('%j falha com o motivo', (regra, detalhe) => {
    expect(ver(regra)).toMatchObject({ ok: false, detalhe });
  });

  it('sem streaming nenhum (programa sem start): motivo, sem exceção', () => {
    expect(verificarRegra({ stream: 'x' }, {})).toMatchObject({ ok: false });
    expect(descreverRegra({ stream: 'x', lotes: 2 })).toBe('A consulta x rodou como pedido');
  });
});

describe('regra modelo', () => {
  const modelos = {
    m: { tipo: 'LinearRegressionModel', coeficientes: [0.0100000001, 2, 1.5], intercepto: 3, metricas: { 'rmse@safra-teste.csv': 0.00002, 'r2@x.csv': { erro: { tipo: 'AnalysisException', mensagem: 'Path does not exist' } } } },
    r: { tipo: 'LogisticRegressionModel', coeficientes: [-0.01, -3], intercepto: 4, metricas: { 'areaUnderROC@safra-teste.csv': 0.61 } },
    est: { tipo: 'LogisticRegression', treinado: false, metricas: {} },
    tubo: { tipo: 'PipelineModel', ultimo: 'LinearRegressionModel', coeficientes: [1], intercepto: 0, metricas: {} },
    g: { tipo: 'KMeansModel', k: 3, metricas: {} },
    a: { tipo: 'DecisionTreeClassificationModel', profundidade: 2, metricas: {} },
  };
  const ver = (regra, variaveis = {}) => verificarRegra(regra, { modelos, variaveis });

  it('passa com tipo, coeficientes aproximados, k, profundidade e métrica', () => {
    expect(ver({ modelo: 'm', tipo: 'LinearRegressionModel', coeficientes: [0.01, 2, 1.5], intercepto: 3 }).ok).toBe(true);
    expect(ver({ modelo: 'm', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv' } }).ok).toBe(true);
    expect(ver({ modelo: 'tubo', tipo: 'PipelineModel' }).ok).toBe(true);
    expect(ver({ modelo: 'tubo', tipo: 'LinearRegressionModel' }).ok).toBe(true); // o último estágio do pipeline
    expect(ver({ modelo: 'g', k: 3 }).ok).toBe(true);
    expect(ver({ modelo: 'a', profundidade: 2 }).ok).toBe(true);
  });

  it.each([
    [{ modelo: 'x' }, {}, 'a variável x não existe no fim do programa'],
    [{ modelo: 'n' }, { n: 3 }, 'n não é um modelo treinado (fit)'],
    [{ modelo: 'est' }, {}, 'est é um LogisticRegression sem treino: use est = LogisticRegression(...).fit(dados)'],
    [{ modelo: 'm', tipo: 'LogisticRegressionModel' }, {}, 'esperado LogisticRegressionModel, veio LinearRegressionModel'],
    [{ modelo: 'm', coeficientes: [0.02, 2, 1.5] }, {}, 'coeficientes esperados [0,02, 2, 1,5], vieram [0,01, 2, 1,5]'],
    [{ modelo: 'm', intercepto: 1 }, {}, 'intercepto esperado 1, veio 3'],
    [{ modelo: 'g', k: 2 }, {}, 'k esperado 2, veio 3'],
    [{ modelo: 'a', profundidade: 3 }, {}, 'profundidade esperada 3, veio 2'],
    [{ modelo: 'r', metrica: { nome: 'areaUnderROC', min: 0.8, dados: 'safra-teste.csv' } }, {}, 'areaUnderROC 0,61 em safra-teste.csv; o mínimo é 0,8'],
    [{ modelo: 'm', metrica: { nome: 'r2', min: 0.9, dados: 'x.csv' } }, {}, 'calcular r2 em x.csv deu AnalysisException: Path does not exist'],
    [{ modelo: 'm', metrica: { nome: 'mae', max: 1, dados: 'y.csv' } }, {}, 'não deu para calcular mae em y.csv'],
  ])('%j falha com o motivo', (regra, variaveis, detalhe) => {
    expect(ver(regra, variaveis)).toMatchObject({ ok: false, detalhe });
  });

  it('mensagens antes de rodar (contexto vazio)', () => {
    expect(descreverRegra({ modelo: 'm', tipo: 'LinearRegressionModel' })).toBe('m é o modelo treinado pedido');
    expect(descreverRegra({ modelo: 'r', metrica: { nome: 'areaUnderROC', min: 0.75, dados: 't.csv' } })).toBe('r tem areaUnderROC ≥ 0,75 em t.csv');
  });
});

describe('regra delta', () => {
  const deltas = { estoque: { versao: 2, operacoes: ['WRITE', 'MERGE', 'DELETE'], colunas: ['produto', 'qtd'], linhasPorVersao: [3, 4, 2] } };
  const ver = (regra) => verificarRegra(regra, { deltas });

  it('passa com versão, operações, colunas e linhas da versão', () => {
    expect(ver({ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'MERGE', 'DELETE'], colunas: ['produto', 'qtd'], linhasNaVersao: { versao: 1, linhas: 4 } }).ok).toBe(true);
  });

  it.each([
    [{ delta: 'dados/estoque' }, 'não existe tabela Delta em dados/estoque'],
    [{ delta: 'estoque', versao: 3 }, 'a versão atual devia ser 3, é 2'],
    [{ delta: 'estoque', operacoes: ['WRITE', 'MERGE', 'DELETE', 'OPTIMIZE'] }, 'o histórico tem WRITE, MERGE, DELETE; faltou OPTIMIZE'],
    [{ delta: 'estoque', operacoes: ['WRITE', 'MERGE'] }, 'o histórico tem WRITE, MERGE, DELETE; sobrou DELETE'],
    [{ delta: 'estoque', operacoes: ['WRITE', 'UPDATE', 'DELETE'] }, 'a operação da versão 1 devia ser UPDATE, é MERGE'],
    [{ delta: 'estoque', colunas: ['produto', 'qtd', 'preco'] }, 'colunas esperadas [produto, qtd, preco], vieram [produto, qtd]'],
    [{ delta: 'estoque', linhasNaVersao: { versao: 0, linhas: 4 } }, 'a versão 0 devia ter 4 linhas, tem 3'],
    [{ delta: 'estoque', linhasNaVersao: { versao: 7, linhas: 1 } }, 'a tabela não tem a versão 7'],
  ])('%j falha com o motivo', (regra, detalhe) => {
    expect(ver(regra)).toMatchObject({ ok: false, detalhe });
  });

  it('categorias novas', () => {
    expect(categoriaDe({ stream: 'q' })).toBe('Streaming');
    expect(categoriaDe({ modelo: 'm' })).toBe('Modelo');
    expect(categoriaDe({ delta: 't' })).toBe('Delta');
  });
});
```

E em `tests/corrigir.test.js` (ele já importa `corrigir`):

```js
  it('as regras modelo com métrica viram avaliacoes, e os blocos novos chegam às regras', async () => {
    let opcoes;
    const executar = async (_arquivos, o) => {
      opcoes = o;
      return { saida: '', erro: null, variaveis: {}, streaming: null,
        deltas: { t: { versao: 0, operacoes: ['WRITE'], colunas: ['a'], linhasPorVersao: [1] } },
        modelos: { m: { tipo: 'LinearRegressionModel', metricas: { 'rmse@t.csv': 0.5 } } } };
    };
    const problema = { testes: [{ descricao: 'v', regras: [
      { modelo: 'm', metrica: { nome: 'rmse', max: 1, dados: 't.csv', preparar: 'montador' } },
      { delta: 't', versao: 0 },
    ] }] };
    const { aprovado } = await corrigir(problema, { 'main.py': '' }, executar);
    expect(opcoes.avaliacoes).toEqual([{ variavel: 'm', nome: 'rmse', dados: 't.csv', preparar: 'montador' }]);
    expect(aprovado).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk proxy npx vitest run tests/verificacoes.test.js tests/corrigir.test.js 2>&1 | grep -E "Tests |×" | tail -5`
Expected: FAIL com `Regra desconhecida`.

- [ ] **Step 3: Implement the rules in `src/verificacoes.js`**

No comentário do topo, depois da linha do `plano`, acrescente:

```js
//   { stream: 'q', modo?, lotes?, saidaPorLote?, marcaDagua?, descartadas? }
//                                          a consulta de streaming q (queryName) e os seus micro-lotes
//   { modelo: 'm', tipo?, coeficientes?, intercepto?, aprox?, k?, profundidade?, metrica? }
//                                          o modelo do MLlib em m; `metrica: { nome, min | max, dados, preparar? }`
//                                          é calculada pelo executor nos dados de teste
//   { delta: 'caminho', versao?, operacoes?, colunas?, linhasNaVersao? }
//                                          a tabela Delta gravada em caminho
```

Antes de `export function verificarRegra`, acrescente:

```js
/** 0.61 → "0,61": números como se escreve no Brasil (até 4 casas). */
const decimal = (n) => String(Number(Number(n).toFixed(4))).replace('.', ',');
const hora = (iso) => (iso ? iso.slice(11, 16) : 'nenhuma');

function verificarStream(regra, streaming) {
  const nome = regra.stream;
  const mensagem = `A consulta ${nome} rodou como pedido`;
  const consulta = streaming?.consultas?.find((c) => c.nome === nome);
  if (!consulta) return res(regra, mensagem, false, `a consulta ${nome} não existe (use .queryName("${nome}") e .start())`);
  const { lotes } = consulta;
  const obtido = `${plural(lotes.length, 'lote', 'lotes')} · saída por lote [${lotes.map((l) => l.saida).join(', ')}] · ${consulta.modo}`;
  const falha = (detalhe) => res(regra, mensagem, false, detalhe, obtido);
  if (regra.modo && consulta.modo !== regra.modo) return falha(`o modo devia ser ${regra.modo}, é ${consulta.modo}`);
  const total = regra.lotes ?? regra.saidaPorLote?.length;
  if (total !== undefined && lotes.length !== total) {
    return falha(`${total === 1 ? 'esperado 1 lote' : `esperados ${total} lotes`}, ${lotes.length === 1 ? 'veio 1' : `vieram ${lotes.length}`}`);
  }
  if (regra.saidaPorLote) {
    const i = regra.saidaPorLote.findIndex((n, k) => lotes[k].saida !== n);
    if (i >= 0) return falha(`o lote ${i} devia emitir ${plural(regra.saidaPorLote[i], 'linha', 'linhas')}, emitiu ${lotes[i].saida}`);
  }
  if (regra.descartadas !== undefined) {
    const d = lotes.reduce((s, l) => s + (l.descartadas ?? 0), 0);
    if (d !== regra.descartadas) return falha(`deviam ser descartadas ${plural(regra.descartadas, 'linha atrasada', 'linhas atrasadas')}, foram ${d}`);
  }
  if (regra.marcaDagua !== undefined) {
    const m = lotes.at(-1)?.marcaDagua ?? null;
    if (!(m ?? '').startsWith(regra.marcaDagua)) return falha(`a marca d'água final devia ser ${hora(regra.marcaDagua)}, foi ${hora(m)}`);
  }
  return res(regra, mensagem, true, undefined, obtido);
}

function verificarModelo(regra, modelos, variaveis) {
  const nome = regra.modelo;
  const met = regra.metrica;
  const mensagem = met
    ? `${nome} tem ${met.nome} ${met.min !== undefined ? `≥ ${decimal(met.min)}` : `≤ ${decimal(met.max)}`} em ${met.dados}`
    : `${nome} é o modelo treinado pedido`;
  const m = modelos[nome];
  if (!m) return res(regra, mensagem, false, nome in variaveis ? `${nome} não é um modelo treinado (fit)` : `a variável ${nome} não existe no fim do programa`);
  if (m.treinado === false) return res(regra, mensagem, false, `${nome} é um ${m.tipo} sem treino: use ${nome} = ${m.tipo}(...).fit(dados)`, m.tipo);
  const lista = (v) => `[${v.map(decimal).join(', ')}]`;
  const obtido = [
    m.ultimo ? `${m.tipo} (${m.ultimo})` : m.tipo,
    m.coeficientes && `coeficientes ${lista(m.coeficientes)}`,
    m.intercepto !== undefined && `intercepto ${decimal(m.intercepto)}`,
    m.k !== undefined && `k = ${m.k}`,
    m.profundidade !== undefined && `profundidade ${m.profundidade}`,
  ].filter(Boolean).join(' · ');
  const falha = (detalhe) => res(regra, mensagem, false, detalhe, obtido);
  const tolerancia = regra.aprox ?? 1e-6;
  if (regra.tipo && m.tipo !== regra.tipo && m.ultimo !== regra.tipo) return falha(`esperado ${regra.tipo}, veio ${m.ultimo ? `${m.tipo} (${m.ultimo})` : m.tipo}`);
  if (regra.coeficientes && !aproximado(m.coeficientes, regra.coeficientes, tolerancia)) {
    return falha(`coeficientes esperados ${lista(regra.coeficientes)}, vieram ${m.coeficientes ? lista(m.coeficientes) : 'nenhum'}`);
  }
  if (regra.intercepto !== undefined && !aproximado(m.intercepto, regra.intercepto, tolerancia)) {
    return falha(`intercepto esperado ${decimal(regra.intercepto)}, veio ${m.intercepto === undefined ? 'nenhum' : decimal(m.intercepto)}`);
  }
  if (regra.k !== undefined && m.k !== regra.k) return falha(`k esperado ${regra.k}, veio ${m.k ?? 'nenhum'}`);
  if (regra.profundidade !== undefined && m.profundidade !== regra.profundidade) return falha(`profundidade esperada ${regra.profundidade}, veio ${m.profundidade ?? 'nenhuma'}`);
  if (met) {
    const v = m.metricas?.[`${met.nome}@${met.dados}`];
    if (v === undefined) return falha(`não deu para calcular ${met.nome} em ${met.dados}`);
    if (v.erro) return falha(`calcular ${met.nome} em ${met.dados} deu ${v.erro.tipo}: ${v.erro.mensagem}`);
    if (met.min !== undefined && v < met.min) return falha(`${met.nome} ${decimal(v)} em ${met.dados}; o mínimo é ${decimal(met.min)}`);
    if (met.max !== undefined && v > met.max) return falha(`${met.nome} ${decimal(v)} em ${met.dados}; o máximo é ${decimal(met.max)}`);
  }
  return res(regra, mensagem, true, undefined, obtido);
}

function verificarDelta(regra, deltas) {
  const caminho = regra.delta;
  const mensagem = `A tabela Delta ${caminho} está como pedido`;
  const t = deltas[caminho];
  if (!t) return res(regra, mensagem, false, `não existe tabela Delta em ${caminho}`);
  const obtido = `versão ${t.versao} · ${t.operacoes.join(', ')} · [${t.colunas.join(', ')}]`;
  const falha = (detalhe) => res(regra, mensagem, false, detalhe, obtido);
  if (regra.versao !== undefined && t.versao !== regra.versao) return falha(`a versão atual devia ser ${regra.versao}, é ${t.versao}`);
  if (regra.operacoes && !iguais(t.operacoes, regra.operacoes)) {
    const tem = `o histórico tem ${t.operacoes.join(', ')}`;
    const i = regra.operacoes.findIndex((op, k) => t.operacoes[k] !== op);
    if (i < 0) return falha(`${tem}; sobrou ${t.operacoes.slice(regra.operacoes.length).join(', ')}`);
    if (i >= t.operacoes.length) return falha(`${tem}; faltou ${regra.operacoes.slice(i).join(', ')}`);
    return falha(`a operação da versão ${i} devia ser ${regra.operacoes[i]}, é ${t.operacoes[i]}`);
  }
  if (regra.colunas && !iguais(t.colunas, regra.colunas)) return falha(`colunas esperadas [${regra.colunas.join(', ')}], vieram [${t.colunas.join(', ')}]`);
  if (regra.linhasNaVersao) {
    const { versao, linhas: n } = regra.linhasNaVersao;
    const tem = t.linhasPorVersao?.[versao];
    if (tem === undefined) return falha(`a tabela não tem a versão ${versao}`);
    if (tem !== n) return falha(`a versão ${versao} devia ter ${plural(n, 'linha', 'linhas')}, tem ${tem}`);
  }
  return res(regra, mensagem, true, undefined, obtido);
}
```

Troque a assinatura e o começo de `verificarRegra`:

```js
export function verificarRegra(regra, { saida = '', erro = null, variaveis = {}, retorno, codigo = '', arquivos = {}, paralelismo = null, tabelas = {}, streaming = null, deltas = {}, modelos = {} }) {
  if ('stream' in regra) return verificarStream(regra, streaming);
  if ('modelo' in regra) return verificarModelo(regra, modelos, variaveis);
  if ('delta' in regra) return verificarDelta(regra, deltas);
  if ('dataframe' in regra) return verificarDataFrame(regra, tabelas, variaveis);
```

Em `CATEGORIAS`, no começo da lista: `['stream', 'Streaming'], ['modelo', 'Modelo'], ['delta', 'Delta'],`.

Em `DICAS`:

```js
  Streaming: 'Confira o queryName, o outputMode e o gatilho. A aba ⚡ Execução mostra cada micro-lote: o que entrou, o estado e o que saiu.',
  Modelo: 'Confira se você chamou fit, as colunas de features e de rótulo (labelCol) e os parâmetros. Imprima coefficients e intercept para ver o que o modelo aprendeu.',
  Delta: 'Use DeltaTable.forPath(spark, caminho).history().show() para ver as versões e as operações, e confira o caminho da tabela.',
```

- [ ] **Step 4: Pass the new blocks in `src/corrigir.js`**

Dentro do laço, troque a linha do `executar`:

```js
    // As métricas das regras `modelo` são calculadas pelo executor, depois do programa, nos dados de teste do caso.
    const avaliacoes = teste.regras.filter((r) => 'modelo' in r && r.metrica)
      .map((r) => ({ variavel: r.modelo, nome: r.metrica.nome, dados: r.metrica.dados, ...(r.metrica.preparar ? { preparar: r.metrica.preparar } : {}) }));
    const r = await executar({ ...arquivos, ...(problema.dados ?? {}), ...dadosDoCaso }, { entrada: teste.entrada ?? [], chamadas, avaliacoes });
```

E no contexto das regras, depois de `tabelas: r.tabelas ?? {},`:

```js
      streaming: r.streaming ?? null, deltas: r.deltas ?? {}, modelos: r.modelos ?? {},
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/verificacoes.test.js tests/corrigir.test.js 2>&1 | grep -E "Tests |×" | tail -5` e `rtk proxy npx eslint .`
Expected: PASS; eslint sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/verificacoes.js src/corrigir.js tests/verificacoes.test.js tests/corrigir.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Correção: regras stream, modelo e delta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Os dados do módulo e o exercício-padrão

**Files:**
- Create: `src/conteudo/alem-dados.js`, `src/conteudo/alem-comum.js`
- Test: `tests/alem-dados.test.js` (novo)

**Interfaces:**
- Produces (`alem-dados.js`): `coopAssociados`, `coopAssociadosOculto`, `coopEstoque`, `coopEstoqueOculto` (objetos `{ arquivo: texto }`); `estacoes`, `estacoesOculto` (`{ 'leituras/lote-NN.csv': texto }`); `safra`, `safraOculto` (`safra-treino.csv` e `safra-teste.csv`); `municipios`, `municipiosOculto`.
- Produces (`alem-comum.js`): `bloco` (template de código Python: tira a indentação só do texto do template, e os trechos interpolados de várias linhas entram como estão; o `py` de `util.js` calcula a indentação depois de interpolar e quebraria com eles); `exercicioAlem({ id, titulo, dificuldade, enunciado, dica, inicial, solucao, dados?, oculto?, regras, regrasOcultas? })` → item `problema`; `LER(arquivo, variavel)` → a linha do `spark.read.csv`.

**Decisão (registrar na spec, Task 8):** a spec pedia dados gerados por `scripts/gerar-dados-alem.mjs`. Os dados ficam escritos à mão em `alem-dados.js`: são poucos, e com eles cada valor esperado dos exercícios pode ser conferido de cabeça (a produção segue uma fórmula exata, os lotes têm 1 a 3 linhas).

- [ ] **Step 1: Write the failing test**

`tests/alem-dados.test.js`:

```js
// Os dados do módulo 🌊 seguem as regras que os exercícios usam: a produção é uma fórmula exata,
// os lotes de leituras estão em ordem de nome, e o caso oculto troca todos os arquivos do visível.
import { describe, it, expect } from 'vitest';
import { safra, safraOculto, estacoes, estacoesOculto, coopEstoque, coopEstoqueOculto, coopAssociados, coopAssociadosOculto, municipios, municipiosOculto } from '../src/conteudo/alem-dados.js';
import { exercicioAlem, bloco } from '../src/conteudo/alem-comum.js';

const linhas = (csv) => csv.trim().split('\n').slice(1).map((l) => l.split(','));

describe('dados do módulo além do batch', () => {
  it.each([
    ['visível', safra, (c, a, i) => 3 + 0.01 * c + 2 * a + 1.5 * i],
    ['oculto', safraOculto, (c, a, i) => 1 + 0.02 * c + 1 * a + 3 * i],
  ])('safra %s: producao_t segue a fórmula (a regressão acha os coeficientes exatos)', (_nome, dados, formula) => {
    for (const arquivo of ['safra-treino.csv', 'safra-teste.csv']) {
      for (const [, , chuva, area, irrigado, producao] of linhas(dados[arquivo])) {
        expect(Number(producao)).toBeCloseTo(formula(Number(chuva), Number(area), Number(irrigado)), 9);
      }
    }
  });

  it('as culturas do teste existem no treino (o StringIndexer do pipeline não erra)', () => {
    for (const d of [safra, safraOculto]) {
      const doTreino = new Set(linhas(d['safra-treino.csv']).map((l) => l[1]));
      for (const l of linhas(d['safra-teste.csv'])) expect(doTreino).toContain(l[1]);
    }
  });

  it('o caso oculto troca todos os arquivos do visível (nada do visível sobra)', () => {
    for (const [v, o] of [[safra, safraOculto], [estacoes, estacoesOculto], [coopEstoque, coopEstoqueOculto], [coopAssociados, coopAssociadosOculto], [municipios, municipiosOculto]]) {
      for (const nome of Object.keys(v)) expect(o).toHaveProperty(nome);
    }
  });

  it('os lotes estão em ordem de nome (a ordem em que são gravados e lidos)', () => {
    for (const d of [estacoes, estacoesOculto]) expect(Object.keys(d)).toEqual(Object.keys(d).sort());
    expect(Object.keys(estacoesOculto)).toHaveLength(4);
  });

  it('bloco: tira a indentação do template e mantém os trechos de várias linhas', () => {
    const DOIS = 'a = 1\nb = 2\n';
    expect(bloco`
      ${DOIS}
      if a:
          print(b)
    `).toBe('a = 1\nb = 2\n\nif a:\n    print(b)\n');
  });

  it('exercicioAlem monta o item com caso visível e oculto', () => {
    const p = exercicioAlem({ id: 'x', titulo: 'X', dificuldade: 'facil', enunciado: '<p>x</p>', dica: 'd', inicial: 'a = 1\n', solucao: 'a = 2\n',
      dados: coopEstoque, oculto: coopEstoqueOculto, regras: [{ variavel: 'a', igual: 2 }] });
    expect(p.tipo).toBe('problema');
    expect(p.arquivos['main.py']).toContain('SparkSession');
    expect(p.testes.map((t) => [t.descricao, Boolean(t.oculto)])).toEqual([['estoque.csv', false], ['outros dados', true]]);
    expect(p.testes[1].regras).toEqual([{ variavel: 'a', igual: 2 }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/alem-dados.test.js 2>&1 | grep -E "Tests |Error" | head -3`
Expected: FAIL (`Failed to resolve import "../src/conteudo/alem-dados.js"`).

- [ ] **Step 3: Write `src/conteudo/alem-dados.js`**

```js
// Dados do módulo 🌊 Spark além do batch (aba 📦 Dados). Pequenos e escritos à mão: cada valor
// esperado dos exercícios dá para conferir de cabeça. O caso oculto troca todos os arquivos.

// ---------- 🔺 Delta Lake: a cooperativa ----------
const ASSOCIADOS = `id,nome,cidade,ativo
1,Ana,Petrolina,true
2,Bento,Juazeiro,true
3,Cida,Crato,false
4,Dora,Sobral,true
`;
const ASSOCIADOS_OCULTO = `id,nome,cidade,ativo
1,Edu,Mossoró,true
2,Fia,Crato,false
3,Gil,Petrolina,true
`;
const ESTOQUE = `produto,qtd,preco
mel,10,25.0
farinha,40,6.5
rapadura,25,3.0
`;
const ESTOQUE_OCULTO = `produto,qtd,preco
mel,4,27.0
queijo,12,30.0
`;
// A entrada do dia: o que chegou na cooperativa (para o append e o merge).
const ENTRADA = `produto,qtd,preco
mel,15,25.0
feijao,30,8.0
`;
const ENTRADA_OCULTO = `produto,qtd,preco
queijo,20,31.0
milho,50,2.5
`;

export const coopAssociados = { 'associados.csv': ASSOCIADOS };
export const coopAssociadosOculto = { 'associados.csv': ASSOCIADOS_OCULTO };
export const coopEstoque = { 'estoque.csv': ESTOQUE, 'entrada-dia-1.csv': ENTRADA };
export const coopEstoqueOculto = { 'estoque.csv': ESTOQUE_OCULTO, 'entrada-dia-1.csv': ENTRADA_OCULTO };

// ---------- 🌊 Structured Streaming: as estações do sertão ----------
// Um arquivo por lote. A última linha do lote-03 visível (Crato, 07:58) e a do lote-04 oculto
// (Sobral, 14:12) chegam atrasadas: a marca d'água de 5 minutos descarta as duas.
const lote = (...linhas) => `estacao,momento,temperatura,umidade,chuva_mm\n${linhas.map((l) => `${l}\n`).join('')}`;
export const estacoes = {
  'leituras/lote-01.csv': lote('Petrolina,2026-03-10 08:01:00,31.0,40,0.0', 'Crato,2026-03-10 08:03:00,27.5,70,12.0', 'Sobral,2026-03-10 08:04:00,33.5,35,0.0'),
  'leituras/lote-02.csv': lote('Petrolina,2026-03-10 08:12:00,34.0,38,0.0', 'Crato,2026-03-10 08:14:00,26.0,80,25.0'),
  'leituras/lote-03.csv': lote('Juazeiro,2026-03-10 08:21:00,35.5,30,0.0', 'Crato,2026-03-10 07:58:00,25.0,85,30.0'),
};
export const estacoesOculto = {
  'leituras/lote-01.csv': lote('Mossoró,2026-03-11 14:02:00,36.0,25,0.0', 'Sobral,2026-03-11 14:06:00,29.0,60,8.0'),
  'leituras/lote-02.csv': lote('Mossoró,2026-03-11 14:11:00,37.5,22,0.0'),
  'leituras/lote-03.csv': lote('Crato,2026-03-11 14:25:00,24.0,90,40.0', 'Sobral,2026-03-11 14:08:00,28.0,65,5.0', 'Mossoró,2026-03-11 14:26:00,38.0,20,0.0'),
  'leituras/lote-04.csv': lote('Juazeiro,2026-03-11 14:31:00,34.0,33,0.0', 'Sobral,2026-03-11 14:12:00,27.0,70,3.0'),
};

// ---------- 🤖 MLlib: a safra ----------
// Visível: producao_t = 3 + 0,01·chuva_mm + 2·area_ha + 1,5·irrigado (exata, sem ruído).
// Oculto:  producao_t = 1 + 0,02·chuva_mm + 1·area_ha + 3·irrigado.
// O risco (0 ou 1) cai com a chuva e com a irrigação, com exceções (Serra Talhada, Picos, Pau dos
// Ferros, Russas): sem separação perfeita, a regressão logística tem coeficientes finitos.
const SAFRA = 'municipio,cultura,chuva_mm,area_ha,irrigado,producao_t,risco\n';
const SAFRA_TREINO = `${SAFRA}Petrolina,uva,300,5,1,17.5,0
Juazeiro,manga,350,4,1,16.0,0
Crato,milho,800,3,0,17.0,0
Sobral,feijao,400,2,0,11.0,1
Mossoró,melao,250,6,1,19.0,0
Iguatu,milho,700,2,0,14.0,0
Quixadá,feijao,350,1,0,8.5,1
Arcoverde,milho,450,3,0,13.5,1
Serra Talhada,feijao,380,2,0,10.8,0
Picos,milho,600,4,0,17.0,1
Caicó,feijao,300,1,0,8.0,1
Barbalha,milho,900,2,0,16.0,0
`;
const SAFRA_TESTE = `${SAFRA}Ouricuri,feijao,320,2,0,10.2,1
Salgueiro,milho,750,3,0,16.5,0
Petrolina,uva,280,6,1,19.3,0
Tauá,feijao,360,1,0,8.6,1
Crato,milho,850,4,0,19.5,0
Sobral,feijao,500,2,0,12.0,1
`;
const SAFRA_TREINO_OCULTO = `${SAFRA}Afogados,feijao,400,2,0,11.0,1
Petrolândia,uva,300,4,1,14.0,0
Ouricuri,milho,350,3,0,11.0,1
Iguatu,milho,750,2,0,18.0,0
Juazeiro,uva,280,5,1,14.6,0
Crateús,feijao,420,1,0,10.4,1
Limoeiro,milho,800,3,0,20.0,0
Pau dos Ferros,feijao,390,2,0,10.8,0
Russas,milho,650,2,0,16.0,1
Lavras,feijao,500,1,0,12.0,1
`;
const SAFRA_TESTE_OCULTO = `${SAFRA}Arcoverde,feijao,330,2,0,9.6,1
Petrolina,uva,260,6,1,15.2,0
Barbalha,milho,900,2,0,21.0,0
Tauá,feijao,370,1,0,9.4,1
Sobral,milho,520,3,0,14.4,1
`;
export const safra = { 'safra-treino.csv': SAFRA_TREINO, 'safra-teste.csv': SAFRA_TESTE };
export const safraOculto = { 'safra-treino.csv': SAFRA_TREINO_OCULTO, 'safra-teste.csv': SAFRA_TESTE_OCULTO };

// Municípios para o KMeans: grupos bem separados pela chuva (sertão seco, serra, litoral).
const MUNICIPIOS = `municipio,chuva_anual,temperatura
Petrolina,480,28.0
Juazeiro,510,27.5
Mossoró,560,28.5
Recife,1600,26.0
Fortaleza,1450,26.5
Natal,1500,26.5
Garanhuns,1100,21.0
Triunfo,1150,20.5
Guaramiranga,1250,19.5
`;
const MUNICIPIOS_OCULTO = `municipio,chuva_anual,temperatura
Arcoverde,650,24.0
Sobral,700,27.5
Salvador,1700,25.5
João Pessoa,1650,26.0
Maceió,1750,25.5
Crato,1050,24.5
Ubajara,1150,22.0
Areia,1200,21.5
Tianguá,1100,22.0
`;
export const municipios = { 'municipios.csv': MUNICIPIOS };
export const municipiosOculto = { 'municipios.csv': MUNICIPIOS_OCULTO };
```

- [ ] **Step 4: Write `src/conteudo/alem-comum.js`**

```js
// Auxiliares do módulo 🌊 Spark além do batch (alem-delta.js, alem-streaming.js e alem-mllib.js).
import { programa } from './pyspark-comum.js';

/**
 * Template para código Python, como o `py` de util.js, mas a indentação comum sai só do texto do
 * template: um trecho interpolado com várias linhas sem indentação (${ESTOQUE}${ENTRADA}) entra como está.
 */
export function bloco(partes, ...valores) {
  const texto = partes.join('\u0000').replace(/^\n/, '');
  const margem = Math.min(...texto.split('\n').filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  let i = 0;
  return texto.split('\n').map((l) => l.slice(margem)).join('\n').replace(/\s*$/, '\n').replace(/\u0000/g, () => valores[i++] ?? '');
}

/** A linha que lê um CSV com cabeçalho e tipos. */
export const LER = (arquivo, variavel) => `${variavel} = spark.read.csv("${arquivo}", header=True, inferSchema=True)\n`;

/**
 * Um exercício do módulo: o programa começa pela SparkSession; o caso visível usa `dados`, e o
 * oculto, `oculto` (outros dados, com os mesmos nomes de arquivo) com `regrasOcultas`.
 */
export function exercicioAlem({ id, titulo, dificuldade, enunciado, dica, inicial, solucao, dados, oculto, regras, regrasOcultas = regras }) {
  return {
    id,
    tipo: 'problema',
    titulo,
    dificuldade,
    enunciado,
    dica,
    arquivos: programa(id, inicial),
    solucao: programa(id, solucao),
    ...(dados ? { dados } : {}),
    testes: [
      { descricao: dados ? Object.keys(dados)[0] : 'execução', regras },
      { descricao: 'outros dados', oculto: true, ...(oculto ? { dados: oculto } : {}), regras: regrasOcultas },
    ],
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `rtk proxy npx vitest run tests/alem-dados.test.js 2>&1 | grep -E "Tests |×"`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/conteudo/alem-dados.js src/conteudo/alem-comum.js tests/alem-dados.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Além do batch: os dados (cooperativa, estações e safra) e o exercício-padrão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 🔺 Delta Lake: 4 lições e 12 exercícios

**Files:**
- Create: `src/conteudo/alem-delta.js`
- Modify: `python/tests/test_delta.bloco` (uma checagem do motor)
- Test: `tests/conteudo.test.js` (os testes de sempre rodam os exercícios novos depois da Task 7; aqui eles rodam por um arquivo próprio, `tests/alem-conteudo.test.js`, criado nesta task e estendido nas Tasks 5 e 6)

**Interfaces:**
- Consumes: `exercicioAlem`, `LER` (Task 3); `coopAssociados`, `coopAssociadosOculto`, `coopEstoque`, `coopEstoqueOculto` (Task 3); as regras `delta` e `dataframe` (Task 2).
- Produces: `licoesDelta = { tabela, historico, merge, manutencao }` e `exerciciosDelta` (12 itens, nesta ordem de ids: `dl-gravar`, `dl-append`, `dl-versao`, `dl-historico`, `dl-update`, `dl-delete`, `dl-merge`, `dl-schema`, `dl-voltar`, `dl-vacuum`, `dl-optimize`, `dl-desfazer`).

- [ ] **Step 1: Pin the engine behavior the exercises rely on (pytest)**

Acrescente a `python/tests/test_delta.bloco` (ele já tem as fixtures `spark` e `pasta`; confira os nomes no topo e use os mesmos):

```python
def test_vacuum_zero_sem_a_checagem_apaga_a_versao_antiga(spark, pasta):
    spark.createDataFrame([('mel', 10)], ['produto', 'qtd']).write.format('delta').save('estoque')
    spark.createDataFrame([('feijao', 30)], ['produto', 'qtd']).write.format('delta').mode('overwrite').save('estoque')
    spark.conf.set('spark.databricks.delta.retentionDurationCheck.enabled', 'false')
    try:
        DeltaTable.forPath(spark, 'estoque').vacuum(0)
        with pytest.raises(Exception):
            spark.read.format('delta').option('versionAsOf', 0).load('estoque').collect()
    finally:
        spark.conf.set('spark.databricks.delta.retentionDurationCheck.enabled', 'true')


def test_operacoes_que_os_exercicios_usam(spark, pasta):
    linhas = [('mel', 10, 25.0), ('farinha', 40, 6.5)]
    df = spark.createDataFrame(linhas, 'produto STRING, qtd INT, preco DOUBLE')
    df.write.format('delta').save('estoque')
    for linha in df.collect():
        spark.createDataFrame([linha], df.schema).write.format('delta').mode('append').save('miudo')
    DeltaTable.forPath(spark, 'miudo').optimize().executeCompaction()
    t = DeltaTable.forPath(spark, 'estoque')
    t.update("produto = 'mel'", {'preco': 'preco * 1.1'})
    (t.alias('e').merge(df.alias('n'), 'e.produto = n.produto')
     .whenMatchedUpdate(set={'qtd': 'e.qtd + n.qtd'}).whenNotMatchedInsertAll().execute())
    ops = [r.operation for r in t.history().orderBy('version').collect()]
    assert ops == ['WRITE', 'UPDATE', 'MERGE']
    assert [r.operation for r in DeltaTable.forPath(spark, 'miudo').history().orderBy('version').collect()] == ['WRITE', 'WRITE', 'OPTIMIZE']
```

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests/test_delta.py -q -p no:randomly > /tmp/pt.txt 2>&1; tail -3 /tmp/pt.txt`
Expected: PASS. (Se `test_vacuum_zero...` falhar, o `vacuum` não está apagando os arquivos removidos no mesmo instante do relógio virtual: em `python/delta/tables.bloco`, a comparação com o limite tem de ser `<=`. Corrija e rode de novo.)

- [ ] **Step 2: Write the failing content test**

`tests/alem-conteudo.test.js`:

```js
// Os exercícios do módulo 🌊 com o Python de verdade: a solução passa nos casos visível e oculto,
// e o código inicial falha no visível. (Depois da Task 7 eles também entram em conteudo.test.js.)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { corrigir } from '../src/corrigir.js';
import { iniciarPython } from './python-node.js';
import { PoolPython } from '../src/python/pool.js';
import { workerNode } from './pool-node.js';
import { exerciciosDelta, licoesDelta } from '../src/conteudo/alem-delta.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
let executar;
beforeAll(async () => { const { sessao } = await iniciarPython({ pool }); executar = (a, o) => sessao.executar(a, o); }, 120_000);

const AREAS = [['delta', exerciciosDelta, licoesDelta]];

describe.each(AREAS)('%s', (_area, exercicios, licoes) => {
  it('12 exercícios: 3 fáceis, 6 médios e 3 difíceis', () => {
    const conta = (d) => exercicios.filter((e) => e.dificuldade === d).length;
    expect([exercicios.length, conta('facil'), conta('medio'), conta('dificil')]).toEqual([12, 3, 6, 3]);
  });

  it.each(Object.values(licoes).map((l) => [l.id, l]))('lição %s roda sem erro', async (_id, l) => {
    expect((await executar({ ...l.arquivos, ...(l.dados ?? {}) }, {})).erro).toBeNull();
  }, 120_000);

  it.each(exercicios.map((p) => [p.id, p]))('%s: a solução passa em todos os casos', async (_id, p) => {
    const { relatorio } = await corrigir(p, p.solucao, executar);
    expect(relatorio.flatMap((c) => c.resultados.filter((r) => !r.ok).map((r) => `[${c.descricao}] ${r.mensagem}: ${r.detalhe}`))).toEqual([]);
  }, 120_000);

  it.each(exercicios.map((p) => [p.id, p]))('%s: o código inicial ainda não passa', async (_id, p) => {
    expect((await corrigir(p, p.arquivos, executar, { incluirOcultos: false })).aprovado).toBe(false);
  }, 120_000);
});
```

Run: `rtk proxy npx vitest run tests/alem-conteudo.test.js 2>&1 | grep -E "Tests |Error" | head -3`
Expected: FAIL (`alem-delta.js` não existe).

- [ ] **Step 3: Write `src/conteudo/alem-delta.js`**

```js
// 🔺 Delta Lake (módulo 🌊 Spark além do batch): 4 lições e 12 exercícios com a cooperativa.
// O delta do DivergePython grava o log de transações (_delta_log) e os arquivos parquet no
// sistema de arquivos do navegador, como o Delta de verdade. As regras `delta` conferem a versão,
// as operações do histórico e as colunas da tabela que o programa gravou.
import { programa } from './pyspark-comum.js';
import { exercicioAlem, LER, bloco } from './alem-comum.js';
import { coopAssociados, coopAssociadosOculto, coopEstoque, coopEstoqueOculto } from './alem-dados.js';

const DELTA = 'from delta.tables import DeltaTable\n\n';
const ESTOQUE = LER('estoque.csv', 'estoque');
const ENTRADA = LER('entrada-dia-1.csv', 'entrada');
const GRAVAR = 'estoque.write.format("delta").save("estoque")\n';

// As linhas do estoque, na mesma ordem dos arquivos (visível e oculto).
const LINHAS_ESTOQUE = [[['mel', 10, 25], ['farinha', 40, 6.5], ['rapadura', 25, 3]], [['mel', 4, 27], ['queijo', 12, 30]]];
const LINHAS_MERGE = [
  [['mel', 25, 25], ['farinha', 40, 6.5], ['rapadura', 25, 3], ['feijao', 30, 8]],
  [['mel', 4, 27], ['queijo', 32, 31], ['milho', 50, 2.5]],
];

export const licoesDelta = {
  tabela: {
    id: 'licao-delta-tabela',
    tipo: 'licao',
    titulo: 'Tabela Delta e log de transações',
    resumo: `
      <p>Uma tabela <b>Delta</b> são arquivos parquet mais uma pasta <code>_delta_log</code>, com um arquivo JSON por
        <b>versão</b> (um <b>commit</b>). Cada gravação cria uma versão nova, e nada do que já foi gravado é reescrito.</p>
      <p>É o livro-caixa da cooperativa: cada lançamento vai numa página nova, e dá para voltar a qualquer página.</p>
      <p>Para gravar, <code>df.write.format("delta").save("estoque")</code>; para ler,
        <code>spark.read.format("delta").load("estoque")</code>. O <code>mode("append")</code> acrescenta linhas e o
        <code>mode("overwrite")</code> troca tudo, sempre numa versão nova.</p>`,
    arquivos: programa('delta', bloco`
      import os

      ${ESTOQUE}
      estoque.write.format("delta").save("estoque")
      print(sorted(os.listdir("estoque/_delta_log")))     # a versão 0
      spark.read.format("delta").load("estoque").show()
    `),
    dados: coopEstoque,
  },
  historico: {
    id: 'licao-delta-historico',
    tipo: 'licao',
    titulo: 'Histórico e time travel',
    resumo: `
      <p><code>DeltaTable.forPath(spark, "estoque").history()</code> mostra as versões: <code>version</code>,
        <code>timestamp</code>, <code>operation</code> (WRITE, UPDATE, MERGE...) e os parâmetros de cada uma.</p>
      <p>O <b>time travel</b> lê a tabela como ela era: <code>.option("versionAsOf", 0)</code> pela versão, ou
        <code>.option("timestampAsOf", ...)</code> pela hora. Serve para conferir o que mudou e para desfazer um erro.</p>`,
    arquivos: programa('historico', bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}
      estoque.write.format("delta").save("estoque")
      entrada.write.format("delta").mode("append").save("estoque")
      DeltaTable.forPath(spark, "estoque").history().select("version", "operation").show()
      spark.read.format("delta").option("versionAsOf", 0).load("estoque").show()
    `),
    dados: coopEstoque,
  },
  merge: {
    id: 'licao-delta-merge',
    tipo: 'licao',
    titulo: 'Merge, update e delete',
    resumo: `
      <p>Numa tabela Delta dá para mudar linhas no lugar, cada mudança numa versão nova:
        <code>update(condição, {"coluna": "expressão"})</code>, <code>delete(condição)</code> e o <code>merge</code>.</p>
      <p>O <b>merge</b> (o <b>upsert</b>) junta uma fonte à tabela pela condição: quem casa é atualizado
        (<code>whenMatchedUpdate</code>), e quem não casa é inserido (<code>whenNotMatchedInsertAll</code>). É o
        estoque do dia: o mel que já existia soma a quantidade, e o feijão novo entra.</p>`,
    arquivos: programa('merge', bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}
      estoque.write.format("delta").save("estoque")
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.update("produto = 'farinha'", {"preco": "preco + 0.5"})
      (tabela.alias("e")
          .merge(entrada.alias("n"), "e.produto = n.produto")
          .whenMatchedUpdate(set={"qtd": "e.qtd + n.qtd"})
          .whenNotMatchedInsertAll()
          .execute())
      tabela.delete("qtd < 30")
      tabela.toDF().show()
      tabela.history().select("version", "operation").show()
    `),
    dados: coopEstoque,
  },
  manutencao: {
    id: 'licao-delta-manutencao',
    tipo: 'licao',
    titulo: 'Schema, vacuum e optimize',
    resumo: `
      <p>O Delta protege o <b>schema</b>: gravar uma coluna nova dá erro, a não ser que você peça
        <code>.option("mergeSchema", "true")</code>; aí a coluna entra, e as linhas antigas ficam com
        <code>NULL</code> nela.</p>
      <p><code>optimize().executeCompaction()</code> junta os arquivos pequenos num só. <code>vacuum(horas)</code> apaga de
        verdade os arquivos que nenhuma versão recente usa; abaixo de 168 horas (7 dias) o Delta recusa, porque o time
        travel para antes disso deixa de funcionar.</p>`,
    arquivos: programa('manutencao', bloco`
      ${DELTA}${ESTOQUE}
      estoque.write.format("delta").save("estoque")
      novo = estoque.withColumn("validade", F.lit("2026-12-31"))
      try:
          novo.write.format("delta").mode("append").save("estoque")
      except Exception as e:
          print("sem mergeSchema:", type(e).__name__)
      novo.write.format("delta").mode("append").option("mergeSchema", "true").save("estoque")
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.optimize().executeCompaction()
      spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")
      tabela.vacuum(0)
      tabela.history().select("version", "operation").show()
    `),
    dados: coopEstoque,
  },
};

const estoque = { dados: coopEstoque, oculto: coopEstoqueOculto };

export const exerciciosDelta = [
  exercicioAlem({
    id: 'dl-gravar',
    titulo: 'Associados em Delta',
    dificuldade: 'facil',
    enunciado: '<p>Grave os associados (<code>associados.csv</code>) como tabela Delta em <code>associados</code> e guarde em <code>tabela</code> a leitura dela.</p>',
    dica: 'df.write.format("delta").save("associados") e spark.read.format("delta").load("associados")',
    dados: coopAssociados,
    oculto: coopAssociadosOculto,
    inicial: `${LER('associados.csv', 'df')}tabela = df\ntabela.show()\n`,
    solucao: bloco`
      ${LER('associados.csv', 'df')}
      df.write.format("delta").save("associados")
      tabela = spark.read.format("delta").load("associados")
      tabela.show()
    `,
    regras: [{ delta: 'associados', versao: 0, operacoes: ['WRITE'], colunas: ['id', 'nome', 'cidade', 'ativo'] }, { dataframe: 'tabela', total: 4 }],
    regrasOcultas: [{ delta: 'associados', versao: 0, operacoes: ['WRITE'], colunas: ['id', 'nome', 'cidade', 'ativo'] }, { dataframe: 'tabela', total: 3 }],
  }),
  exercicioAlem({
    id: 'dl-append',
    titulo: 'A entrada do dia',
    dificuldade: 'facil',
    enunciado: '<p>A tabela <code>estoque</code> já é gravada. Acrescente a ela as linhas de <code>entrada-dia-1.csv</code>, numa versão nova, sem apagar o que já existe.</p>',
    dica: 'entrada.write.format("delta").mode("append").save("estoque")',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}tabela = spark.read.format("delta").load("estoque")\ntabela.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("append").save("estoque")
      tabela = spark.read.format("delta").load("estoque")
      tabela.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'WRITE'], linhasNaVersao: { versao: 1, linhas: 5 } }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'WRITE'], linhasNaVersao: { versao: 1, linhas: 4 } }],
  }),
  exercicioAlem({
    id: 'dl-versao',
    titulo: 'Como estava ontem',
    dificuldade: 'facil',
    enunciado: '<p>Alguém trocou o estoque pela entrada do dia (<code>overwrite</code>). Guarde em <code>antes</code> a tabela como ela era na <b>versão 0</b>.</p>',
    dica: 'spark.read.format("delta").option("versionAsOf", 0).load("estoque")',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\nantes = spark.read.format("delta").load("estoque")\nantes.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      antes = spark.read.format("delta").option("versionAsOf", 0).load("estoque")
      antes.show()
    `,
    regras: [{ dataframe: 'antes', linhas: LINHAS_ESTOQUE[0] }, { codigo: 'versionAsOf|timestampAsOf' }],
    regrasOcultas: [{ dataframe: 'antes', linhas: LINHAS_ESTOQUE[1] }],
  }),
  exercicioAlem({
    id: 'dl-historico',
    titulo: 'O histórico conta tudo',
    dificuldade: 'medio',
    enunciado: '<p>Na tabela <code>estoque</code>, aumente o preço do mel em 10% (<code>update</code>) e apague os produtos com menos de 20 unidades (<code>delete</code>). Depois guarde em <code>historico</code> as colunas <code>version</code> e <code>operation</code> do histórico, em ordem de versão.</p>',
    dica: 'tabela.update("produto = \'mel\'", {"preco": "preco * 1.1"}); tabela.delete("qtd < 20"); tabela.history().select("version", "operation").orderBy("version")',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${GRAVAR}tabela = DeltaTable.forPath(spark, "estoque")\nhistorico = tabela.history().select("version", "operation").orderBy("version")\nhistorico.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${GRAVAR}
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.update("produto = 'mel'", {"preco": "preco * 1.1"})
      tabela.delete("qtd < 20")
      historico = tabela.history().select("version", "operation").orderBy("version")
      historico.show()
    `,
    regras: [{ dataframe: 'historico', ordem: true, linhas: [[0, 'WRITE'], [1, 'UPDATE'], [2, 'DELETE']] }, { delta: 'estoque', versao: 2 }],
  }),
  exercicioAlem({
    id: 'dl-update',
    titulo: 'Mel mais caro',
    dificuldade: 'medio',
    enunciado: '<p>O mel ficou 10% mais caro. Mude o preço <b>na tabela Delta</b> <code>estoque</code> (não só num DataFrame) e guarde em <code>atual</code> a tabela depois da mudança.</p>',
    dica: 'DeltaTable.forPath(spark, "estoque").update("produto = \'mel\'", {"preco": "preco * 1.1"})',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${GRAVAR}tabela = DeltaTable.forPath(spark, "estoque")\natual = tabela.toDF().withColumn("preco", F.when(F.col("produto") == "mel", F.col("preco") * 1.1).otherwise(F.col("preco")))\natual.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${GRAVAR}
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.update("produto = 'mel'", {"preco": "preco * 1.1"})
      atual = tabela.toDF()
      atual.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'UPDATE'] }, { dataframe: 'atual', aprox: 1e-9, linhas: [['mel', 10, 27.5], ['farinha', 40, 6.5], ['rapadura', 25, 3]] }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'UPDATE'] }, { dataframe: 'atual', aprox: 1e-9, linhas: [['mel', 4, 29.7], ['queijo', 12, 30]] }],
  }),
  exercicioAlem({
    id: 'dl-delete',
    titulo: 'Quem saiu da cooperativa',
    dificuldade: 'medio',
    enunciado: '<p>Apague da tabela Delta <code>associados</code> quem não está mais ativo (<code>ativo = false</code>) e guarde em <code>ativos</code> a tabela que sobrou.</p>',
    dica: 'DeltaTable.forPath(spark, "associados").delete("ativo = false")',
    dados: coopAssociados,
    oculto: coopAssociadosOculto,
    inicial: `${DELTA}${LER('associados.csv', 'df')}df.write.format("delta").save("associados")\nativos = df.filter("ativo = true")\nativos.show()\n`,
    solucao: bloco`
      ${DELTA}${LER('associados.csv', 'df')}
      df.write.format("delta").save("associados")
      tabela = DeltaTable.forPath(spark, "associados")
      tabela.delete("ativo = false")
      ativos = tabela.toDF()
      ativos.show()
    `,
    regras: [{ delta: 'associados', versao: 1, operacoes: ['WRITE', 'DELETE'] }, { dataframe: 'ativos', linhas: [[1, 'Ana', 'Petrolina', true], [2, 'Bento', 'Juazeiro', true], [4, 'Dora', 'Sobral', true]] }],
    regrasOcultas: [{ delta: 'associados', versao: 1, operacoes: ['WRITE', 'DELETE'] }, { dataframe: 'ativos', linhas: [[1, 'Edu', 'Mossoró', true], [3, 'Gil', 'Petrolina', true]] }],
  }),
  exercicioAlem({
    id: 'dl-merge',
    titulo: 'Upsert do estoque do dia',
    dificuldade: 'medio',
    enunciado: '<p>Junte a entrada do dia à tabela <code>estoque</code> com um <code>merge</code>: o produto que já existe soma a quantidade e fica com o preço novo; o produto novo entra inteiro. Guarde em <code>atual</code> a tabela depois do merge.</p>',
    dica: 'tabela.alias("e").merge(entrada.alias("n"), "e.produto = n.produto").whenMatchedUpdate(set={"qtd": "e.qtd + n.qtd", "preco": "n.preco"}).whenNotMatchedInsertAll().execute()',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}tabela = DeltaTable.forPath(spark, "estoque")\natual = tabela.toDF().union(entrada)\natual.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}
      tabela = DeltaTable.forPath(spark, "estoque")
      (tabela.alias("e")
          .merge(entrada.alias("n"), "e.produto = n.produto")
          .whenMatchedUpdate(set={"qtd": "e.qtd + n.qtd", "preco": "n.preco"})
          .whenNotMatchedInsertAll()
          .execute())
      atual = tabela.toDF()
      atual.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[0] }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[1] }],
  }),
  exercicioAlem({
    id: 'dl-schema',
    titulo: 'A coluna nova da validade',
    dificuldade: 'medio',
    enunciado: '<p>A entrada do dia agora traz a <code>validade</code>. Acrescente-a à tabela <code>estoque</code> com a coluna nova (o Delta recusa sem pedir), e guarde em <code>sem_validade</code> as linhas que ficaram com a validade nula.</p>',
    dica: '.mode("append").option("mergeSchema", "true").save("estoque"); depois filter(F.col("validade").isNull())',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}com_validade = entrada.withColumn("validade", F.lit("2026-12-31"))\ncom_validade.write.format("delta").mode("append").save("estoque")\nsem_validade = spark.read.format("delta").load("estoque")\nsem_validade.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      com_validade = entrada.withColumn("validade", F.lit("2026-12-31"))
      com_validade.write.format("delta").mode("append").option("mergeSchema", "true").save("estoque")
      tabela = spark.read.format("delta").load("estoque")
      sem_validade = tabela.filter(F.col("validade").isNull())
      sem_validade.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, colunas: ['produto', 'qtd', 'preco', 'validade'] }, { dataframe: 'sem_validade', total: 3 }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, colunas: ['produto', 'qtd', 'preco', 'validade'] }, { dataframe: 'sem_validade', total: 2 }],
  }),
  exercicioAlem({
    id: 'dl-voltar',
    titulo: 'Voltar no tempo',
    dificuldade: 'medio',
    enunciado: '<p>Uma carga errada trocou o estoque pela entrada do dia (versão 1). Recupere a tabela: leia a versão 0 e grave por cima, numa versão nova (2). Guarde em <code>tabela</code> a leitura final.</p>',
    dica: 'bom = spark.read.format("delta").option("versionAsOf", 0).load("estoque"); bom.write.format("delta").mode("overwrite").save("estoque")',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\ntabela = spark.read.format("delta").load("estoque")\ntabela.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      bom = spark.read.format("delta").option("versionAsOf", 0).load("estoque")
      bom.write.format("delta").mode("overwrite").save("estoque")
      tabela = spark.read.format("delta").load("estoque")
      tabela.show()
    `,
    regras: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'WRITE'], linhasNaVersao: { versao: 2, linhas: 3 } }, { dataframe: 'tabela', linhas: LINHAS_ESTOQUE[0] }],
    regrasOcultas: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'WRITE'], linhasNaVersao: { versao: 2, linhas: 2 } }, { dataframe: 'tabela', linhas: LINHAS_ESTOQUE[1] }],
  }),
  exercicioAlem({
    id: 'dl-vacuum',
    titulo: 'Faxina com vacuum',
    dificuldade: 'dificil',
    enunciado: '<p>Depois de trocar o estoque (<code>overwrite</code>), apague de verdade os arquivos antigos com <code>vacuum(0)</code>. O Delta recusa menos de 168 horas: desligue a checagem para esta faxina. No fim, tente ler a versão 0 e guarde em <code>v0_existe</code> se deu certo (<code>True</code>) ou não (<code>False</code>).</p>',
    dica: 'spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false"); DeltaTable.forPath(spark, "estoque").vacuum(0); a leitura da versão 0 vai num try/except',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\nDeltaTable.forPath(spark, "estoque").vacuum(0)\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")
      DeltaTable.forPath(spark, "estoque").vacuum(0)
      try:
          spark.read.format("delta").option("versionAsOf", 0).load("estoque").collect()
          v0_existe = True
      except Exception:
          v0_existe = False
      print("a versão 0 ainda existe?", v0_existe)
    `,
    regras: [{ semErros: true }, { variavel: 'v0_existe', igual: false }, { codigo: 'vacuum\\(\\s*0' }],
  }),
  exercicioAlem({
    id: 'dl-optimize',
    titulo: 'Arquivos pequenos demais',
    dificuldade: 'dificil',
    enunciado: '<p>Cada produto do estoque chega sozinho: grave um <code>append</code> por linha na tabela <code>miudo</code> (uma versão por linha). Depois junte os arquivos pequenos com <code>optimize</code>, numa versão a mais.</p>',
    dica: 'for linha in estoque.collect(): spark.createDataFrame([linha], estoque.schema).write.format("delta").mode("append").save("miudo"); depois DeltaTable.forPath(spark, "miudo").optimize().executeCompaction()',
    ...estoque,
    inicial: `${ESTOQUE}for linha in estoque.collect():\n    spark.createDataFrame([linha], estoque.schema).write.format("delta").mode("append").save("miudo")\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}
      for linha in estoque.collect():
          spark.createDataFrame([linha], estoque.schema).write.format("delta").mode("append").save("miudo")
      DeltaTable.forPath(spark, "miudo").optimize().executeCompaction()
      DeltaTable.forPath(spark, "miudo").history().select("version", "operation").show()
    `,
    regras: [{ delta: 'miudo', versao: 3, operacoes: ['WRITE', 'WRITE', 'WRITE', 'OPTIMIZE'], linhasNaVersao: { versao: 3, linhas: 3 } }],
    regrasOcultas: [{ delta: 'miudo', versao: 2, operacoes: ['WRITE', 'WRITE', 'OPTIMIZE'], linhasNaVersao: { versao: 2, linhas: 2 } }],
  }),
  exercicioAlem({
    id: 'dl-desfazer',
    titulo: 'Desfazer a carga errada',
    dificuldade: 'dificil',
    enunciado: '<p>A carga do dia foi gravada com <code>overwrite</code> e apagou o estoque. Desfaça sem perder a entrada: leia a versão 0 (time travel) e faça um <code>merge</code> dela na tabela, somando a quantidade dos produtos que estão nas duas e inserindo os outros. Guarde em <code>atual</code> a tabela final.</p>',
    dica: 'bom = ...option("versionAsOf", 0)...; tabela.alias("e").merge(bom.alias("b"), "e.produto = b.produto").whenMatchedUpdate(set={"qtd": "e.qtd + b.qtd"}).whenNotMatchedInsertAll().execute()',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\ntabela = DeltaTable.forPath(spark, "estoque")\natual = tabela.toDF()\natual.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      bom = spark.read.format("delta").option("versionAsOf", 0).load("estoque")
      tabela = DeltaTable.forPath(spark, "estoque")
      (tabela.alias("e")
          .merge(bom.alias("b"), "e.produto = b.produto")
          .whenMatchedUpdate(set={"qtd": "e.qtd + b.qtd"})
          .whenNotMatchedInsertAll()
          .execute())
      atual = tabela.toDF()
      atual.show()
    `,
    regras: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[0] }],
    regrasOcultas: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[1] }],
  }),
];
```

Conferência de cabeça dos valores (visível; o oculto é igual com os outros dados):
- `dl-merge`/`dl-desfazer`: mel 10 + 15 = 25 (preço 25), farinha e rapadura sem par, feijão novo (30, 8). Oculto: queijo 12 + 20 = 32 (31), mel sem par, milho novo.
- `dl-update`: 25 × 1,1 = 27,5; oculto 27 × 1,1 = 29,7.
- `dl-schema`: as 3 linhas do estoque (2 no oculto) ficam com a validade nula.
- `dl-optimize`: 3 appends (versões 0 a 2) + OPTIMIZE (3), com 3 linhas; oculto 2 + 1.

- [ ] **Step 4: Run the content test to verify it passes**

Run: `rtk proxy npx vitest run tests/alem-conteudo.test.js > /tmp/v.txt 2>&1; grep -E "Tests |×" /tmp/v.txt | head -20`
Expected: PASS (1 + 4 + 12 + 12 testes). Se um exercício falhar, leia o motivo no relatório: um valor esperado errado se corrige no exercício (refaça a conta de cabeça com os dados da Task 3); um comportamento do motor diferente do Delta de verdade se corrige no motor, com um pytest que mostre a diferença.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/alem-delta.js tests/alem-conteudo.test.js python/tests/test_delta.py
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Além do batch: Delta Lake (4 lições e 12 exercícios)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: 🌊 Structured Streaming: 4 lições e 12 exercícios (e `window.start` no motor)

**Files:**
- Create: `src/conteudo/alem-streaming.js`
- Modify: `python/pyspark/sql/column.py` (classe `Col`), `tests/alem-conteudo.test.js`
- Test: `python/tests/test_dataframe.py` (ou o arquivo de testes de colunas que já existe; confira com `ls python/tests`)

**Interfaces:**
- Consumes: `exercicioAlem`, `bloco` (Task 3); `estacoes`, `estacoesOculto` (Task 3); as regras `stream` e `dataframe` (Task 2).
- Produces: `licoesStreaming = { microLotes, fontes, modos, janelas }` e `exerciciosStreaming` (12 itens: `st-rate`, `st-ler`, `st-filtro`, `st-max-files`, `st-sql`, `st-complete`, `st-update`, `st-alerta`, `st-janela`, `st-deslizante`, `st-marca`, `st-fechadas`).
- Produces (motor): `F.col("a.b")` e `df.select("a.b")` leem o campo `b` da coluna struct `a` quando não existe tabela `a` (como o Spark); a coluna se chama `b`.

**Regra de leitura dos lotes** (o motor segue o PySpark 4, conferido no CI): com `maxFilesPerTrigger=1`, cada micro-lote lê um arquivo, na ordem de modificação e depois de nome. A correção grava os arquivos na ordem do dicionário (`lote-01`, `lote-02`, ...), então os lotes seguem os nomes. Uma linha é descartada quando o tempo dela é menor que a marca d'água do **lote anterior**; a marca d'água é o maior tempo visto menos o atraso.

Valores esperados, calculados à mão com os dados da Task 3 (V = visível, O = oculto):

| Exercício | Consulta | V: saída por lote | O: saída por lote | Outros |
|---|---|---|---|---|
| `st-rate` | `numeros` | [0, 2, 2] | igual | 2 linhas por segundo, `awaitTermination(3)` e `stop()` |
| `st-ler` | `leituras` | [7] | [8] | sem `maxFilesPerTrigger`: um lote só |
| `st-filtro` (≥ 33 °C) | `quentes` | [1, 1, 1] | [1, 1, 1, 1] | |
| `st-max-files` | `leituras` | [3, 2, 2] | [2, 1, 3, 2] | |
| `st-sql` | `chuva` | — | — | Crato 67 (12+25+30), os outros 0; O: Crato 40, Sobral 16 (8+5+3) |
| `st-complete` | `contagem` | [3, 3, 4] | [2, 2, 3, 4] | complete emite todas as chaves |
| `st-update` | `contagem` | [3, 2, 2] | [2, 1, 3, 2] | update emite só as chaves que mudaram |
| `st-alerta` | `chuva_total` | [3, 3, 4] | [2, 2, 3, 4] | alertas ≥ 30 mm: V [Crato 67], O [Crato 40] |
| `st-janela` (10 min) | `por_janela` | [1, 2, 4] | [1, 2, 3, 4] | o Crato das 07:58 abre a janela das 07:50 |
| `st-deslizante` (10 min, 5 min) | `deslizante` | [2, 4, 7] | [3, 4, 6, 7] | |
| `st-marca` (5 min, update) | `janelas` | [1, 1, 1] | [1, 1, 2, 1] | 1 descartada; marca d'água final V 08:16, O 14:26 |
| `st-fechadas` (5 min, append) | `fechadas` | — | — | janelas fechadas: V [08:00 → 3]; O [14:00 → 3, 14:10 → 1] |

- [ ] **Step 1: Write the failing engine test (struct field with a dot)**

Acrescente ao arquivo de testes de DataFrame em `python/tests/` (o que testa `select`; se houver dúvida, use `python/tests/test_dataframe.py`, criando-o com a fixture `spark` igual à dos outros arquivos):

```python
def test_campo_de_struct_com_ponto(spark):
    from pyspark.sql import functions as F
    df = spark.createDataFrame([(1, 'a')], ['x', 'y']).select(F.struct('x', 'y').alias('p'))
    assert df.select('p.x', F.col('p.y')).columns == ['x', 'y']
    assert [tuple(r) for r in df.select('p.x', F.col('p.y')).collect()] == [(1, 'a')]
    t = spark.createDataFrame([(1, 'a')], ['x', 'y']).alias('p')
    assert [tuple(r) for r in t.select('p.x').collect()] == [(1,)]  # com a tabela p, p.x é a coluna x dela
```

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly -k campo_de_struct > /tmp/pt.txt 2>&1; tail -3 /tmp/pt.txt`
Expected: FAIL com `UNRESOLVED_COLUMN ... p.x`.

- [ ] **Step 2: Implement it in `Col` (`python/pyspark/sql/column.py`)**

Troque a classe `Col` por:

```python
class Col(Expr):
    def __init__(self, nome, qualificador=None):
        if qualificador is None and '.' in nome and not nome.startswith('`'):
            qualificador, nome = nome.split('.', 1)
        self.nome_col, self.qualificador = nome.strip('`'), qualificador

    def nome(self):
        return self.nome_col

    def _resolver(self, e):
        """`a.b`: a coluna b da tabela a; sem tabela a, o campo b da coluna struct a (como o Spark).
        Devolve (índice do atributo, campo ou None)."""
        q = self.qualificador
        if q is not None and not any((a.qualificador or '').lower() == q.lower() for a in e.atributos):
            achados = [i for i, a in enumerate(e.atributos) if a.nome.lower() == q.lower()]
            if len(achados) == 1 and isinstance(e.atributos[achados[0]].tipo, T.StructType):
                return achados[0], self.nome_col
        return e.achar(self.nome_col, self.qualificador), None

    def _atributo(self, e):
        return e.atributos[self._resolver(e)[0]]

    def explicar(self, e):
        i, campo = self._resolver(e)
        return e.atributos[i].ref() + (f'.{campo}' if campo else '')

    def tipo(self, e):
        i, campo = self._resolver(e)
        tipo = e.atributos[i].tipo
        return tipo[campo].dataType if campo else tipo

    def anulavel(self, e):
        i, campo = self._resolver(e)
        return True if campo else e.atributos[i].anulavel

    def compilar(self, e):
        i, campo = self._resolver(e)
        if campo:
            return lambda linha: None if linha[i] is None else linha[i][campo]
        return lambda linha: linha[i]
```

(`T` já está importado em `column.py`; confira o `import` do topo.)

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > /tmp/pt.txt 2>&1; tail -3 /tmp/pt.txt`
Expected: tudo passa.

- [ ] **Step 3: Extend the content test**

Em `tests/alem-conteudo.test.js`, importe e acrescente a área:

```js
import { exerciciosStreaming, licoesStreaming } from '../src/conteudo/alem-streaming.js';
// ...
const AREAS = [['delta', exerciciosDelta, licoesDelta], ['streaming', exerciciosStreaming, licoesStreaming]];
```

Run: `rtk proxy npx vitest run tests/alem-conteudo.test.js 2>&1 | grep -E "Tests |Error" | head -3`
Expected: FAIL (`alem-streaming.js` não existe).

- [ ] **Step 4: Write `src/conteudo/alem-streaming.js`**

```js
// 🌊 Structured Streaming (módulo 🌊 Spark além do batch): 4 lições e 12 exercícios com as
// estações do sertão. O relógio é simulado: os micro-lotes não dependem do tempo real, e o
// resultado é sempre o mesmo. As regras `stream` conferem os lotes de cada consulta (queryName).
import { programa } from './pyspark-comum.js';
import { exercicioAlem, bloco } from './alem-comum.js';
import { estacoes, estacoesOculto } from './alem-dados.js';

const SCHEMA = 'SCHEMA = "estacao STRING, momento TIMESTAMP, temperatura DOUBLE, umidade INT, chuva_mm DOUBLE"\n';
/** A leitura da pasta: um arquivo por micro-lote (ou todos de uma vez, com `porLote = false`). */
const LER = (porLote = true) => `${SCHEMA}leituras = (spark.readStream.schema(SCHEMA)\n${porLote ? '            .option("maxFilesPerTrigger", 1)\n' : ''}            .csv("leituras", header=True))\n`;
/** Começa a consulta na memória e roda tudo o que já está na pasta. */
const RODAR = (df, nome, modo = 'append') => `q = ${df}.writeStream.format("memory").queryName("${nome}").outputMode("${modo}").start()\nq.processAllAvailable()\n`;

const dados = { dados: estacoes, oculto: estacoesOculto };
const stream = (nome, v, o, extra = {}) => ({ regras: [{ stream: nome, saidaPorLote: v, ...extra }], regrasOcultas: [{ stream: nome, saidaPorLote: o, ...extra }] });

export const licoesStreaming = {
  microLotes: {
    id: 'licao-micro-lotes',
    tipo: 'licao',
    titulo: 'Micro-lotes e a tabela sem fim',
    resumo: `
      <p>No <b>Structured Streaming</b>, os dados chegam aos poucos e o Spark trata a entrada como uma <b>tabela sem
        fim</b>: cada pedaço novo vira linhas novas, processadas num <b>micro-lote</b>.</p>
      <p>É a lavoura com o pluviômetro: a cada passada você anota só o que choveu desde a última, e o total vai
        crescendo.</p>
      <p><code>spark.readStream</code> lê; <code>df.writeStream...start()</code> começa a <b>consulta</b>, que roda até
        você parar (<code>stop()</code>). A fonte <code>rate</code> gera números sozinha, para testar. Aqui o relógio é
        simulado: <code>awaitTermination(3)</code> são 3 segundos do relógio do Spark, e o resultado é sempre o mesmo.
        Veja os lotes na aba <b>⚡ Execução</b>.</p>`,
    arquivos: programa('micro-lotes', bloco`
      numeros = spark.readStream.format("rate").option("rowsPerSecond", 2).load()
      q = numeros.writeStream.format("console").start()
      q.awaitTermination(2)
      q.stop()
      print("lotes:", len(q.recentProgress))
    `),
  },
  fontes: {
    id: 'licao-fontes-saidas',
    tipo: 'licao',
    titulo: 'Fontes, saídas e gatilhos',
    resumo: `
      <p>Para ler uma pasta (<code>csv</code>, <code>json</code>, <code>text</code>), o Spark exige o <b>schema</b>: ele não
        pode adivinhar os tipos de arquivos que ainda nem chegaram. <code>maxFilesPerTrigger</code> limita quantos arquivos
        entram em cada micro-lote.</p>
      <p>A saída <code>console</code> imprime cada lote (<code>Batch: 0</code>, <code>Batch: 1</code>...), e a saída
        <code>memory</code> guarda o resultado numa tabela com o nome da consulta, que dá para ler com
        <code>spark.sql</code>. O <b>gatilho</b> diz quando rodar: <code>processAllAvailable()</code> roda tudo o que já
        está na pasta.</p>`,
    arquivos: programa('fontes', bloco`
      ${LER()}
      q = leituras.writeStream.format("console").start()
      q.processAllAvailable()
    `),
    dados: estacoes,
  },
  modos: {
    id: 'licao-modos-estado',
    tipo: 'licao',
    titulo: 'Modos de saída e estado',
    resumo: `
      <p>Uma agregação no streaming (<code>groupBy(...).count()</code>) guarda um <b>estado</b> entre um lote e outro: a
        contagem de cada estação até agora.</p>
      <p>O <b>modo de saída</b> diz o que sai em cada lote: <code>append</code>, só as linhas novas (sem agregação, ou com
        marca d'água); <code>complete</code>, a tabela inteira de novo; <code>update</code>, só as chaves que mudaram
        neste lote.</p>`,
    arquivos: programa('modos', bloco`
      ${LER()}
      contagem = leituras.groupBy("estacao").count()
      q = contagem.writeStream.format("console").outputMode("update").start()
      q.processAllAvailable()
    `),
    dados: estacoes,
  },
  janelas: {
    id: 'licao-janelas-marca-dagua',
    tipo: 'licao',
    titulo: "Tempo do evento, janelas e marca d'água",
    resumo: `
      <p>O <b>tempo do evento</b> é a hora em que a leitura aconteceu (<code>momento</code>), não a hora em que ela chegou.
        <code>F.window("momento", "10 minutes")</code> agrupa por janelas de 10 minutos; com um terceiro argumento
        (<code>"5 minutes"</code>), as janelas <b>deslizam</b> e se sobrepõem.</p>
      <p>Leitura atrasada acontece: o sinal da estação caiu e voltou depois. A <b>marca d'água</b>
        (<code>withWatermark("momento", "5 minutes")</code>) diz quanto atraso esperar: é o maior tempo já visto menos 5
        minutos. O que chega antes dela é descartado, e a janela que ela já passou fecha (no <code>append</code>, só sai
        quando fecha).</p>`,
    arquivos: programa('janelas', bloco`
      ${LER()}
      por_janela = (leituras.withWatermark("momento", "5 minutes")
                    .groupBy(F.window("momento", "10 minutes")).count())
      q = por_janela.writeStream.format("console").outputMode("update").option("truncate", False).start()
      q.processAllAvailable()
      print("lotes:", len(q.recentProgress))   # a marca d'água de cada lote está na aba ⚡ Execução
    `),
    dados: estacoes,
  },
};

export const exerciciosStreaming = [
  exercicioAlem({
    id: 'st-rate',
    titulo: 'A primeira consulta',
    dificuldade: 'facil',
    enunciado: '<p>Comece uma consulta com o nome <code>numeros</code> que lê a fonte <code>rate</code> (2 linhas por segundo) e grava na memória. Espere 3 segundos com <code>awaitTermination(3)</code> e pare a consulta.</p>',
    dica: 'numeros.writeStream.format("memory").queryName("numeros").start(); q.awaitTermination(3); q.stop()',
    inicial: 'numeros = spark.readStream.format("rate").option("rowsPerSecond", 2).load()\nnumeros.printSchema()\n',
    solucao: bloco`
      numeros = spark.readStream.format("rate").option("rowsPerSecond", 2).load()
      q = numeros.writeStream.format("memory").queryName("numeros").start()
      q.awaitTermination(3)   # 3 segundos no relógio do Spark
      q.stop()
      spark.table("numeros").show()
    `,
    ...stream('numeros', [0, 2, 2], [0, 2, 2]),
  }),
  exercicioAlem({
    id: 'st-ler',
    titulo: 'As leituras das estações',
    dificuldade: 'facil',
    enunciado: '<p>Leia a pasta <code>leituras</code> como streaming (CSV com cabeçalho e o schema em <code>SCHEMA</code>) e grave tudo na memória numa consulta chamada <code>leituras</code>.</p>',
    dica: 'spark.readStream.schema(SCHEMA).csv("leituras", header=True)',
    ...dados,
    inicial: `${SCHEMA}leituras = spark.readStream.csv("leituras", header=True)\n${RODAR('leituras', 'leituras')}`,
    solucao: bloco`
      ${SCHEMA}
      leituras = spark.readStream.schema(SCHEMA).csv("leituras", header=True)
      ${RODAR('leituras', 'leituras')}
      spark.table("leituras").show()
    `,
    ...stream('leituras', [7], [8], { modo: 'append' }),
  }),
  exercicioAlem({
    id: 'st-filtro',
    titulo: 'Calor de rachar',
    dificuldade: 'facil',
    enunciado: '<p>Guarde na consulta <code>quentes</code> (na memória) só as leituras com <code>temperatura</code> de 33 °C ou mais, um arquivo por micro-lote.</p>',
    dica: 'quentes = leituras.filter(F.col("temperatura") >= 33)',
    ...dados,
    inicial: `${LER()}quentes = leituras\n${RODAR('quentes', 'quentes')}`,
    solucao: bloco`
      ${LER()}
      quentes = leituras.filter(F.col("temperatura") >= 33)
      ${RODAR('quentes', 'quentes')}
      spark.table("quentes").show()
    `,
    ...stream('quentes', [1, 1, 1], [1, 1, 1, 1]),
  }),
  exercicioAlem({
    id: 'st-max-files',
    titulo: 'Um arquivo por vez',
    dificuldade: 'medio',
    enunciado: '<p>A consulta <code>leituras</code> lê a pasta toda num lote só. Faça cada micro-lote ler <b>um</b> arquivo.</p>',
    dica: '.option("maxFilesPerTrigger", 1) antes do .csv(...)',
    ...dados,
    inicial: `${LER(false)}${RODAR('leituras', 'leituras')}`,
    solucao: bloco`
      ${LER()}
      ${RODAR('leituras', 'leituras')}
    `,
    ...stream('leituras', [3, 2, 2], [2, 1, 3, 2]),
  }),
  exercicioAlem({
    id: 'st-sql',
    titulo: 'Quanto choveu em cada estação',
    dificuldade: 'medio',
    enunciado: '<p>As leituras vão para a consulta <code>chuva</code>, na memória. Guarde em <code>total_chuva</code> o resultado de um SQL nessa tabela: <code>estacao</code> e <code>total</code> (a soma de <code>chuva_mm</code>), em ordem de estação.</p>',
    dica: 'spark.sql("SELECT estacao, SUM(chuva_mm) AS total FROM chuva GROUP BY estacao ORDER BY estacao")',
    ...dados,
    inicial: `${LER()}${RODAR('leituras', 'chuva')}total_chuva = spark.sql("SELECT estacao, chuva_mm FROM chuva")\ntotal_chuva.show()\n`,
    solucao: bloco`
      ${LER()}
      ${RODAR('leituras', 'chuva')}
      total_chuva = spark.sql("SELECT estacao, SUM(chuva_mm) AS total FROM chuva GROUP BY estacao ORDER BY estacao")
      total_chuva.show()
    `,
    regras: [{ stream: 'chuva' }, { dataframe: 'total_chuva', colunas: ['estacao', 'total'], ordem: true, linhas: [['Crato', 67], ['Juazeiro', 0], ['Petrolina', 0], ['Sobral', 0]] }],
    regrasOcultas: [{ stream: 'chuva' }, { dataframe: 'total_chuva', colunas: ['estacao', 'total'], ordem: true, linhas: [['Crato', 40], ['Juazeiro', 0], ['Mossoró', 0], ['Sobral', 16]] }],
  }),
  exercicioAlem({
    id: 'st-complete',
    titulo: 'Leituras por estação',
    dificuldade: 'medio',
    enunciado: '<p>Conte as leituras de cada estação na consulta <code>contagem</code>, mostrando a contagem inteira a cada micro-lote. (Uma agregação sem marca d\'água não pode sair em <code>append</code>.)</p>',
    dica: 'leituras.groupBy("estacao").count() com outputMode("complete")',
    ...dados,
    inicial: `${LER()}contagem = leituras.groupBy("estacao").count()\n${RODAR('contagem', 'contagem')}`,
    solucao: bloco`
      ${LER()}
      contagem = leituras.groupBy("estacao").count()
      ${RODAR('contagem', 'contagem', 'complete')}
      spark.table("contagem").show()
    `,
    ...stream('contagem', [3, 3, 4], [2, 2, 3, 4], { modo: 'complete' }),
  }),
  exercicioAlem({
    id: 'st-update',
    titulo: 'Só o que mudou',
    dificuldade: 'medio',
    enunciado: '<p>A consulta <code>contagem</code> manda a tabela inteira a cada lote. Faça ela mandar só as estações cuja contagem mudou no lote.</p>',
    dica: 'outputMode("update")',
    ...dados,
    inicial: `${LER()}contagem = leituras.groupBy("estacao").count()\n${RODAR('contagem', 'contagem', 'complete')}`,
    solucao: bloco`
      ${LER()}
      contagem = leituras.groupBy("estacao").count()
      ${RODAR('contagem', 'contagem', 'update')}
    `,
    ...stream('contagem', [3, 2, 2], [2, 1, 3, 2], { modo: 'update' }),
  }),
  exercicioAlem({
    id: 'st-alerta',
    titulo: 'Alerta de chuva forte',
    dificuldade: 'dificil',
    enunciado: '<p>Some a chuva de cada estação numa consulta <code>chuva_total</code> (coluna <code>chuva</code>), com a tabela inteira a cada lote. No fim, guarde em <code>alertas</code> as estações com 30 mm ou mais no total.</p>',
    dica: 'groupBy("estacao").agg(F.sum("chuva_mm").alias("chuva")) em complete; depois spark.sql("SELECT estacao, chuva FROM chuva_total WHERE chuva >= 30")',
    ...dados,
    inicial: `${LER()}chuva = leituras.groupBy("estacao").agg(F.sum("chuva_mm").alias("chuva"))\n${RODAR('chuva', 'chuva_total', 'complete')}alertas = spark.sql("SELECT estacao, chuva FROM chuva_total")\nalertas.show()\n`,
    solucao: bloco`
      ${LER()}
      chuva = leituras.groupBy("estacao").agg(F.sum("chuva_mm").alias("chuva"))
      ${RODAR('chuva', 'chuva_total', 'complete')}
      alertas = spark.sql("SELECT estacao, chuva FROM chuva_total WHERE chuva >= 30")
      alertas.show()
    `,
    regras: [{ stream: 'chuva_total', modo: 'complete', saidaPorLote: [3, 3, 4] }, { dataframe: 'alertas', linhas: [['Crato', 67]] }],
    regrasOcultas: [{ stream: 'chuva_total', modo: 'complete', saidaPorLote: [2, 2, 3, 4] }, { dataframe: 'alertas', linhas: [['Crato', 40]] }],
  }),
  exercicioAlem({
    id: 'st-janela',
    titulo: 'Janelas de 10 minutos',
    dificuldade: 'medio',
    enunciado: '<p>Conte as leituras por janela de 10 minutos do <code>momento</code> (o tempo do evento) na consulta <code>por_janela</code>, com a tabela inteira a cada lote.</p>',
    dica: 'leituras.groupBy(F.window("momento", "10 minutes")).count()',
    ...dados,
    inicial: `${LER()}por_janela = leituras.groupBy("estacao").count()\n${RODAR('por_janela', 'por_janela', 'complete')}`,
    solucao: bloco`
      ${LER()}
      por_janela = leituras.groupBy(F.window("momento", "10 minutes")).count()
      ${RODAR('por_janela', 'por_janela', 'complete')}
      spark.table("por_janela").orderBy("window").show(truncate=False)
    `,
    ...stream('por_janela', [1, 2, 4], [1, 2, 3, 4], { modo: 'complete' }),
  }),
  exercicioAlem({
    id: 'st-deslizante',
    titulo: 'Janelas que deslizam',
    dificuldade: 'medio',
    enunciado: '<p>Conte as leituras em janelas de 10 minutos que começam a cada 5 minutos (uma leitura cai em duas janelas), na consulta <code>deslizante</code>, com a tabela inteira a cada lote.</p>',
    dica: 'F.window("momento", "10 minutes", "5 minutes")',
    ...dados,
    inicial: `${LER()}deslizante = leituras.groupBy(F.window("momento", "10 minutes")).count()\n${RODAR('deslizante', 'deslizante', 'complete')}`,
    solucao: bloco`
      ${LER()}
      deslizante = leituras.groupBy(F.window("momento", "10 minutes", "5 minutes")).count()
      ${RODAR('deslizante', 'deslizante', 'complete')}
    `,
    ...stream('deslizante', [2, 4, 7], [3, 4, 6, 7], { modo: 'complete' }),
  }),
  exercicioAlem({
    id: 'st-marca',
    titulo: "Marca d'água para o atrasado",
    dificuldade: 'dificil',
    enunciado: "<p>Uma leitura chegou muito atrasada. Conte as leituras por janela de 10 minutos na consulta <code>janelas</code>, em <code>update</code>, aceitando até 5 minutos de atraso: o que chegar depois disso é descartado.</p>",
    dica: 'leituras.withWatermark("momento", "5 minutes").groupBy(F.window("momento", "10 minutes")).count()',
    ...dados,
    inicial: `${LER()}janelas = leituras.groupBy(F.window("momento", "10 minutes")).count()\n${RODAR('janelas', 'janelas', 'update')}`,
    solucao: bloco`
      ${LER()}
      janelas = (leituras.withWatermark("momento", "5 minutes")
                 .groupBy(F.window("momento", "10 minutes")).count())
      ${RODAR('janelas', 'janelas', 'update')}
    `,
    regras: [{ stream: 'janelas', modo: 'update', saidaPorLote: [1, 1, 1], descartadas: 1, marcaDagua: '2026-03-10T08:16' }],
    regrasOcultas: [{ stream: 'janelas', modo: 'update', saidaPorLote: [1, 1, 2, 1], descartadas: 1, marcaDagua: '2026-03-11T14:26' }],
  }),
  exercicioAlem({
    id: 'st-fechadas',
    titulo: 'Só as janelas fechadas',
    dificuldade: 'dificil',
    enunciado: "<p>Grave na consulta <code>fechadas</code>, em <code>append</code>, a contagem por janela de 10 minutos com 5 minutos de marca d'água: em <code>append</code>, a janela só sai quando a marca d'água passa do fim dela. No fim, guarde em <code>fechadas</code> as colunas <code>inicio</code> (o começo da janela, como texto) e <code>count</code>, em ordem.</p>",
    dica: 'outputMode("append") com withWatermark; depois spark.table("fechadas").select(F.col("window.start").cast("string").alias("inicio"), "count").orderBy("inicio")',
    ...dados,
    inicial: `${LER()}contagem = leituras.groupBy(F.window("momento", "10 minutes")).count()\n${RODAR('contagem', 'fechadas', 'append')}`,
    solucao: bloco`
      ${LER()}
      contagem = (leituras.withWatermark("momento", "5 minutes")
                  .groupBy(F.window("momento", "10 minutes")).count())
      ${RODAR('contagem', 'fechadas', 'append')}
      fechadas = spark.table("fechadas").select(F.col("window.start").cast("string").alias("inicio"), "count").orderBy("inicio")
      fechadas.show()
    `,
    regras: [{ stream: 'fechadas', modo: 'append' }, { dataframe: 'fechadas', ordem: true, linhas: [['2026-03-10 08:00:00', 3]] }],
    regrasOcultas: [{ stream: 'fechadas', modo: 'append' }, { dataframe: 'fechadas', ordem: true, linhas: [['2026-03-11 14:00:00', 3], ['2026-03-11 14:10:00', 1]] }],
  }),
];
```

Conferência de cabeça de `st-marca` (visível): lote 0 (08:01, 08:03, 08:04) → janela 08:00, marca d'água 07:59; lote 1 (08:12, 08:14) → janela 08:10, marca 08:09; lote 2: o Crato das 07:58 é menor que 08:09 e é descartado, o Juazeiro das 08:21 abre a janela 08:20, marca 08:16. Oculto: lote 2 atualiza as janelas 14:20 e 14:00 (o Sobral das 14:08 ainda passa da marca 14:06); no lote 3, o Sobral das 14:12 é menor que 14:21 e sai.

- [ ] **Step 5: Run the content test to verify it passes**

Run: `rtk proxy npx vitest run tests/alem-conteudo.test.js > /tmp/v.txt 2>&1; grep -E "Tests |×" /tmp/v.txt | head -20`
Expected: PASS. Se um valor de lote não bater, imprima `q.recentProgress` no programa da solução e refaça a conta pela regra de leitura dos lotes acima; um valor esperado errado se corrige no exercício (e na tabela desta task), uma diferença do motor para o Spark se corrige no motor, com pytest.

- [ ] **Step 6: Commit**

```bash
git add src/conteudo/alem-streaming.js tests/alem-conteudo.test.js python/pyspark/sql/column.py python/tests
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Além do batch: Structured Streaming (4 lições e 12 exercícios) e window.start no select

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: 🤖 MLlib: 4 lições e 12 exercícios

**Files:**
- Create: `src/conteudo/alem-mllib.js`
- Modify: `tests/alem-conteudo.test.js`

**Interfaces:**
- Consumes: `exercicioAlem`, `bloco`, `LER` (Task 3); `safra`, `safraOculto`, `municipios`, `municipiosOculto` (Task 3); as regras `modelo`, `dataframe` e `variavel` (Task 2); o bloco `modelos` com as métricas (Task 1).
- Produces: `licoesMllib = { features, pipeline, modelos, avaliacao }` e `exerciciosMllib` (12 itens: `ml-vetor`, `ml-indexer`, `ml-scaler`, `ml-linear`, `ml-rmse`, `ml-logistica`, `ml-auc`, `ml-arvore`, `ml-kmeans`, `ml-pipeline`, `ml-comparar`, `ml-novos`).

Valores esperados, de cabeça a partir dos dados da Task 3:
- **Regressão linear** (chuva, área, irrigado → produção): a fórmula é exata, então os coeficientes são V `[0.01, 2, 1.5]` e intercepto `3`; O `[0.02, 1, 3]` e `1`. O RMSE no teste é 0 (a regra aceita até 0,001).
- **Pipeline** com a cultura em one-hot: a fórmula verdadeira tem peso 0 nas culturas e continua sendo a solução exata (8 parâmetros e 12 linhas no visível; 6 e 10 no oculto), então o RMSE no teste também é 0, e as previsões do `ml-novos` são a produção do teste arredondada: V Ouricuri 10.2, Salgueiro 16.5, Petrolina 19.3, Tauá 8.6, Crato 19.5, Sobral 12.0; O Arcoverde 9.6, Petrolina 15.2, Barbalha 21.0, Tauá 9.4, Sobral 14.4.
- **StringIndexer** (por frequência, empate em ordem alfabética): V milho 5 → 0, feijão 4 → 1, manga 2, melão 3, uva 4; O feijão 4 e milho 4 empatam → feijão 0, milho 1, uva 2.
- **Logística e AUC**: no teste, os de risco 1 têm menos chuva e nenhuma irrigação; o modelo ordena todos acima dos de risco 0, e a AUC é 1 (a regra pede pelo menos 0,75).
- **Árvore com `maxDepth=2`**: nenhum corte sozinho separa os riscos (Serra Talhada e Picos; Pau dos Ferros e Russas), e os dois filhos do segundo corte preveem classes diferentes; a profundidade é 2.
- **KMeans com k = 3**: os grupos de chuva (sertão, serra, litoral) ficam com V `[3, 3, 3]` e O `[2, 3, 4]` municípios.

- [ ] **Step 1: Extend the content test**

Em `tests/alem-conteudo.test.js`:

```js
import { exerciciosMllib, licoesMllib } from '../src/conteudo/alem-mllib.js';
// ...
const AREAS = [['delta', exerciciosDelta, licoesDelta], ['streaming', exerciciosStreaming, licoesStreaming], ['mllib', exerciciosMllib, licoesMllib]];
```

Run: `rtk proxy npx vitest run tests/alem-conteudo.test.js 2>&1 | grep -E "Tests |Error" | head -3`
Expected: FAIL (`alem-mllib.js` não existe).

- [ ] **Step 2: Write `src/conteudo/alem-mllib.js`**

```js
// 🤖 MLlib (módulo 🌊 Spark além do batch): 4 lições e 12 exercícios com a safra do sertão. O
// pyspark.ml do DivergePython é Python puro, com a API do Spark: os números ficam muito perto
// dos do Spark, e as regras `modelo` usam tolerância. As métricas da regra são calculadas pelo
// executor nos dados de teste (safra-teste.csv), com o modelo do aluno.
import { programa } from './pyspark-comum.js';
import { exercicioAlem, bloco, LER } from './alem-comum.js';
import { safra, safraOculto, municipios, municipiosOculto } from './alem-dados.js';

const TREINO = LER('safra-treino.csv', 'treino');
const TESTE = LER('safra-teste.csv', 'teste');
const FEATURES = 'from pyspark.ml.feature import VectorAssembler\n';
const MONTADOR = 'montador = VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado"], outputCol="features")\n';
const RISCO = 'montador = VectorAssembler(inputCols=["chuva_mm", "irrigado"], outputCol="features")\n';
const COLUNAS = ['municipio', 'cultura', 'chuva_mm', 'area_ha', 'irrigado', 'producao_t', 'risco'];
const COEF = [[0.01, 2, 1.5], [0.02, 1, 3]];
const INTERCEPTO = [3, 1];
const PIPELINE = `from pyspark.ml import Pipeline
from pyspark.ml.feature import StringIndexer, OneHotEncoder, VectorAssembler
from pyspark.ml.regression import LinearRegression

etapas = [
    StringIndexer(inputCol="cultura", outputCol="cultura_idx"),
    OneHotEncoder(inputCols=["cultura_idx"], outputCols=["cultura_vec"]),
    VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado", "cultura_vec"], outputCol="features"),
    LinearRegression(labelCol="producao_t"),
]
`;

const dados = { dados: safra, oculto: safraOculto };
const nosDois = (regra) => ({ regras: [regra(0)], regrasOcultas: [regra(1)] });

export const licoesMllib = {
  features: {
    id: 'licao-features',
    tipo: 'licao',
    titulo: 'Features, vetores e VectorAssembler',
    resumo: `
      <p>Um modelo aprende com <b>features</b> (as características: chuva, área, irrigação) para prever um <b>rótulo</b>
        (a produção, o risco). No MLlib, as features de cada linha vão juntas num <b>vetor</b>, numa coluna só.</p>
      <p>O <code>VectorAssembler(inputCols=[...], outputCol="features")</code> monta esse vetor. É a ficha do agricultor:
        em vez de folhas soltas, um cartão com todos os números da roça.</p>`,
    arquivos: programa('features', bloco`
      ${FEATURES}from pyspark.ml.linalg import Vectors

      ${TREINO}
      ${MONTADOR}
      com_features = montador.transform(treino)
      com_features.select("municipio", "features", "producao_t").show(truncate=False)
      print(Vectors.dense([300.0, 5.0, 1.0]))
    `),
    dados: safra,
  },
  pipeline: {
    id: 'licao-pipeline',
    tipo: 'licao',
    titulo: 'Transformadores, estimadores e Pipeline',
    resumo: `
      <p>Um <b>transformador</b> muda o DataFrame com <code>transform</code> (o <code>VectorAssembler</code>). Um
        <b>estimador</b> primeiro aprende com os dados (<code>fit</code>) e devolve um <b>modelo</b>, que é um transformador
        (o <code>StringIndexer</code> aprende os números de cada cultura).</p>
      <p>O <b>Pipeline</b> junta as etapas em ordem: <code>Pipeline(stages=[...]).fit(treino)</code> devolve um
        <code>PipelineModel</code>, que faz tudo de uma vez nos dados novos. <code>OneHotEncoder</code> transforma o índice
        da cultura num vetor de zeros e uns, para o modelo não achar que "uva" (4) vale mais que "milho" (0).</p>`,
    arquivos: programa('pipeline', bloco`
      ${PIPELINE}
      ${TREINO}
      modelo = Pipeline(stages=etapas).fit(treino)
      modelo.transform(treino).select("cultura", "cultura_idx", "cultura_vec", "prediction").show(truncate=False)
    `),
    dados: safra,
  },
  modelos: {
    id: 'licao-regressao-classificacao',
    tipo: 'licao',
    titulo: 'Regressão e classificação',
    resumo: `
      <p>A <b>regressão</b> prevê um número: <code>LinearRegression(labelCol="producao_t")</code> aprende um peso
        (<code>coefficients</code>) para cada feature, mais o <code>intercept</code>.</p>
      <p>A <b>classificação</b> prevê uma classe: <code>LogisticRegression(labelCol="risco")</code> dá a
        <code>probability</code> de cada classe e a <code>prediction</code>. A <code>DecisionTreeClassifier</code> faz
        perguntas em sequência ("choveu menos de 650 mm?"); o <code>maxDepth</code> limita quantas.</p>`,
    arquivos: programa('modelos', bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.classification import LogisticRegression

      ${TREINO}
      ${MONTADOR}
      dados = montador.transform(treino)
      producao = LinearRegression(labelCol="producao_t").fit(dados)
      print("pesos:", producao.coefficients, "intercepto:", round(producao.intercept, 3))
      risco = LogisticRegression(labelCol="risco").fit(dados)
      risco.transform(dados).select("municipio", "probability", "prediction").show(truncate=False)
    `),
    dados: safra,
  },
  avaliacao: {
    id: 'licao-avaliacao',
    tipo: 'licao',
    titulo: 'Avaliação, treino e teste, e agrupamento',
    resumo: `
      <p>Um modelo se avalia com dados que ele <b>não viu</b> no treino. Se ele vai bem no treino e mal no teste, decorou
        em vez de aprender: é o <b>overfitting</b>. <code>randomSplit([0.8, 0.2], seed=1)</code> separa os dois.</p>
      <p>Os <b>avaliadores</b> dão uma nota: <code>RegressionEvaluator</code> (rmse, r2), <code>BinaryClassificationEvaluator</code>
        (área sob a curva ROC: 1 é perfeito, 0,5 é chute) e <code>ClusteringEvaluator</code> (silhueta).</p>
      <p>O <b>KMeans</b> agrupa sem rótulo nenhum: <code>KMeans(k=3, seed=1)</code> acha 3 grupos de municípios parecidos.</p>`,
    arquivos: programa('avaliacao', bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.clustering import KMeans
      from pyspark.ml.evaluation import RegressionEvaluator, ClusteringEvaluator

      ${TREINO}${TESTE}
      ${MONTADOR}
      modelo = LinearRegression(labelCol="producao_t").fit(montador.transform(treino))
      rmse = RegressionEvaluator(labelCol="producao_t", metricName="rmse").evaluate(modelo.transform(montador.transform(teste)))
      print("RMSE no teste:", round(rmse, 4))
      cidades = spark.read.csv("municipios.csv", header=True, inferSchema=True)
      pontos = VectorAssembler(inputCols=["chuva_anual", "temperatura"], outputCol="features").transform(cidades)
      grupos = KMeans(k=3, seed=1).fit(pontos)
      print("tamanhos:", sorted(grupos.summary.clusterSizes))
      print("silhueta:", round(ClusteringEvaluator().evaluate(grupos.transform(pontos)), 3))
    `),
    dados: { ...safra, ...municipios },
  },
};

export const exerciciosMllib = [
  exercicioAlem({
    id: 'ml-vetor',
    titulo: 'O vetor de features',
    dificuldade: 'facil',
    enunciado: '<p>Guarde em <code>com_features</code> a safra de treino com uma coluna nova, <code>features</code>, com o vetor de <code>chuva_mm</code>, <code>area_ha</code> e <code>irrigado</code>.</p>',
    dica: 'VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado"], outputCol="features").transform(treino)',
    ...dados,
    inicial: `${FEATURES}${TREINO}com_features = treino\ncom_features.show()\n`,
    solucao: bloco`
      ${FEATURES}${TREINO}
      ${MONTADOR}
      com_features = montador.transform(treino)
      com_features.show(truncate=False)
    `,
    regras: [{ dataframe: 'com_features', colunas: [...COLUNAS, 'features'], total: 12 }],
    regrasOcultas: [{ dataframe: 'com_features', colunas: [...COLUNAS, 'features'], total: 10 }],
  }),
  exercicioAlem({
    id: 'ml-indexer',
    titulo: 'Culturas em números',
    dificuldade: 'facil',
    enunciado: '<p>Transforme a <code>cultura</code> em <code>cultura_idx</code> (com <code>StringIndexer</code>) e depois em <code>cultura_vec</code> (com <code>OneHotEncoder</code>), guardando o resultado em <code>codificado</code>. Guarde em <code>indices</code> os pares distintos de <code>cultura</code> e <code>cultura_idx</code>.</p>',
    dica: 'StringIndexer(inputCol="cultura", outputCol="cultura_idx").fit(treino); OneHotEncoder(inputCols=["cultura_idx"], outputCols=["cultura_vec"]).fit(...)',
    ...dados,
    inicial: `from pyspark.ml.feature import StringIndexer, OneHotEncoder\n${TREINO}codificado = treino\nindices = treino.select("cultura").distinct()\nindices.show()\n`,
    solucao: bloco`
      from pyspark.ml.feature import StringIndexer, OneHotEncoder

      ${TREINO}
      indexado = StringIndexer(inputCol="cultura", outputCol="cultura_idx").fit(treino).transform(treino)
      codificado = OneHotEncoder(inputCols=["cultura_idx"], outputCols=["cultura_vec"]).fit(indexado).transform(indexado)
      indices = codificado.select("cultura", "cultura_idx").distinct()
      indices.show()
    `,
    regras: [{ dataframe: 'codificado', colunas: [...COLUNAS, 'cultura_idx', 'cultura_vec'] }, { dataframe: 'indices', linhas: [['milho', 0], ['feijao', 1], ['manga', 2], ['melao', 3], ['uva', 4]] }],
    regrasOcultas: [{ dataframe: 'indices', linhas: [['feijao', 0], ['milho', 1], ['uva', 2]] }],
  }),
  exercicioAlem({
    id: 'ml-scaler',
    titulo: 'Tudo na mesma escala',
    dificuldade: 'facil',
    enunciado: '<p>A chuva vai a 900 e a irrigação, só a 1. Treine em <code>escalador</code> um <code>StandardScaler</code> com média 0 e desvio 1 (<code>withMean=True</code>, <code>withStd=True</code>) sobre a coluna <code>features</code>, e guarde em <code>escalado</code> o resultado, na coluna <code>escalado</code>.</p>',
    dica: 'StandardScaler(inputCol="features", outputCol="escalado", withMean=True, withStd=True).fit(com_features)',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.feature import StandardScaler\n${TREINO}${MONTADOR}com_features = montador.transform(treino)\nescalador = StandardScaler(inputCol="features", outputCol="escalado")\nescalado = com_features\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.feature import StandardScaler

      ${TREINO}
      ${MONTADOR}
      com_features = montador.transform(treino)
      escalador = StandardScaler(inputCol="features", outputCol="escalado", withMean=True, withStd=True).fit(com_features)
      escalado = escalador.transform(com_features)
      escalado.select("municipio", "escalado").show(truncate=False)
    `,
    regras: [{ modelo: 'escalador', tipo: 'StandardScalerModel' }, { dataframe: 'escalado', total: 12 }, { codigo: 'withMean\\s*=\\s*True' }],
    regrasOcultas: [{ modelo: 'escalador', tipo: 'StandardScalerModel' }, { dataframe: 'escalado', total: 10 }],
  }),
  exercicioAlem({
    id: 'ml-linear',
    titulo: 'Quanto a roça produz',
    dificuldade: 'medio',
    enunciado: '<p>Treine em <code>modelo</code> uma regressão linear que prevê <code>producao_t</code> a partir de <code>chuva_mm</code>, <code>area_ha</code> e <code>irrigado</code>. Imprima os pesos (<code>coefficients</code>) e o <code>intercept</code>.</p>',
    dica: 'LinearRegression(featuresCol="features", labelCol="producao_t").fit(montador.transform(treino))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\n${TREINO}${MONTADOR}modelo = LinearRegression(labelCol="risco").fit(montador.transform(treino))\nprint(modelo.coefficients, modelo.intercept)\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression

      ${TREINO}
      ${MONTADOR}
      modelo = LinearRegression(featuresCol="features", labelCol="producao_t").fit(montador.transform(treino))
      print(modelo.coefficients, modelo.intercept)
    `,
    ...nosDois((i) => ({ modelo: 'modelo', tipo: 'LinearRegressionModel', coeficientes: COEF[i], intercepto: INTERCEPTO[i] })),
  }),
  exercicioAlem({
    id: 'ml-rmse',
    titulo: 'O erro no teste',
    dificuldade: 'medio',
    enunciado: '<p>O <code>modelo</code> usa só a chuva. Use as três features (<code>chuva_mm</code>, <code>area_ha</code>, <code>irrigado</code>) no <code>montador</code>, treine de novo e calcule em <code>rmse</code> o erro (RMSE) nos dados de <code>safra-teste.csv</code>, com o <code>RegressionEvaluator</code>.</p>',
    dica: 'RegressionEvaluator(labelCol="producao_t", metricName="rmse").evaluate(modelo.transform(montador.transform(teste)))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\nfrom pyspark.ml.evaluation import RegressionEvaluator\n${TREINO}${TESTE}montador = VectorAssembler(inputCols=["chuva_mm"], outputCol="features")\nmodelo = LinearRegression(labelCol="producao_t").fit(montador.transform(treino))\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.evaluation import RegressionEvaluator

      ${TREINO}${TESTE}
      ${MONTADOR}
      modelo = LinearRegression(labelCol="producao_t").fit(montador.transform(treino))
      print("RMSE no treino:", modelo.summary.rootMeanSquaredError)
      rmse = RegressionEvaluator(labelCol="producao_t", metricName="rmse").evaluate(modelo.transform(montador.transform(teste)))
      print("RMSE no teste:", rmse)
    `,
    regras: [{ modelo: 'modelo', tipo: 'LinearRegressionModel', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv', preparar: 'montador' } }, { codigo: 'RegressionEvaluator' }],
    regrasOcultas: [{ modelo: 'modelo', tipo: 'LinearRegressionModel', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv', preparar: 'montador' } }],
  }),
  exercicioAlem({
    id: 'ml-logistica',
    titulo: 'O risco da safra',
    dificuldade: 'medio',
    enunciado: '<p>O risco (0 ou 1) é uma classe, não um número. Treine em <code>risco</code> uma regressão <b>logística</b> com <code>chuva_mm</code> e <code>irrigado</code>, e guarde em <code>previsoes</code> as colunas <code>municipio</code>, <code>probability</code> e <code>prediction</code> do treino.</p>',
    dica: 'LogisticRegression(labelCol="risco").fit(montador.transform(treino))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\n${TREINO}${RISCO}risco = LinearRegression(labelCol="risco").fit(montador.transform(treino))\nprevisoes = risco.transform(montador.transform(treino)).select("municipio", "prediction")\nprevisoes.show()\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.classification import LogisticRegression

      ${TREINO}
      ${RISCO}
      risco = LogisticRegression(labelCol="risco").fit(montador.transform(treino))
      previsoes = risco.transform(montador.transform(treino)).select("municipio", "probability", "prediction")
      previsoes.show(truncate=False)
    `,
    regras: [{ modelo: 'risco', tipo: 'LogisticRegressionModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'probability', 'prediction'], total: 12 }],
    regrasOcultas: [{ modelo: 'risco', tipo: 'LogisticRegressionModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'probability', 'prediction'], total: 10 }],
  }),
  exercicioAlem({
    id: 'ml-auc',
    titulo: 'A nota do classificador',
    dificuldade: 'medio',
    enunciado: '<p>Treine em <code>risco</code> a regressão logística (com <code>chuva_mm</code> e <code>irrigado</code>) e calcule em <code>auc</code> a área sob a curva ROC nos dados de <code>safra-teste.csv</code>. A nota precisa ser de pelo menos 0,75.</p>',
    dica: 'BinaryClassificationEvaluator(labelCol="risco").evaluate(risco.transform(montador.transform(teste)))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.classification import LogisticRegression\nfrom pyspark.ml.evaluation import BinaryClassificationEvaluator\n${TREINO}${TESTE}${RISCO}risco = LogisticRegression(labelCol="risco")\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.classification import LogisticRegression
      from pyspark.ml.evaluation import BinaryClassificationEvaluator

      ${TREINO}${TESTE}
      ${RISCO}
      risco = LogisticRegression(labelCol="risco").fit(montador.transform(treino))
      auc = BinaryClassificationEvaluator(labelCol="risco").evaluate(risco.transform(montador.transform(teste)))
      print("AUC no teste:", round(auc, 3))
    `,
    regras: [{ modelo: 'risco', metrica: { nome: 'areaUnderROC', min: 0.75, dados: 'safra-teste.csv', preparar: 'montador' } }, { codigo: 'BinaryClassificationEvaluator' }],
    regrasOcultas: [{ modelo: 'risco', metrica: { nome: 'areaUnderROC', min: 0.75, dados: 'safra-teste.csv', preparar: 'montador' } }],
  }),
  exercicioAlem({
    id: 'ml-arvore',
    titulo: 'Duas perguntas',
    dificuldade: 'medio',
    enunciado: '<p>Treine em <code>arvore</code> uma árvore de decisão que prevê o <code>risco</code> com chuva, área e irrigação, fazendo no máximo <b>duas</b> perguntas em sequência (profundidade 2). Imprima a profundidade (<code>depth</code>) e o número de nós (<code>numNodes</code>).</p>',
    dica: 'DecisionTreeClassifier(labelCol="risco", maxDepth=2).fit(montador.transform(treino))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.classification import DecisionTreeClassifier\n${TREINO}${MONTADOR}arvore = DecisionTreeClassifier(labelCol="risco", maxDepth=1).fit(montador.transform(treino))\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.classification import DecisionTreeClassifier

      ${TREINO}
      ${MONTADOR}
      arvore = DecisionTreeClassifier(labelCol="risco", maxDepth=2).fit(montador.transform(treino))
      print("profundidade:", arvore.depth, "nós:", arvore.numNodes)
    `,
    ...nosDois(() => ({ modelo: 'arvore', tipo: 'DecisionTreeClassificationModel', profundidade: 2 })),
  }),
  exercicioAlem({
    id: 'ml-kmeans',
    titulo: 'Municípios parecidos',
    dificuldade: 'medio',
    enunciado: '<p>Agrupe os municípios (<code>municipios.csv</code>) em <b>3</b> grupos pela <code>chuva_anual</code> e pela <code>temperatura</code>, com <code>KMeans(k=3, seed=1)</code>, guardando o modelo em <code>grupos</code>. Guarde em <code>tamanhos</code> o tamanho de cada grupo, em ordem crescente.</p>',
    dica: 'sorted(grupos.summary.clusterSizes)',
    dados: municipios,
    oculto: municipiosOculto,
    inicial: `${FEATURES}from pyspark.ml.clustering import KMeans\ncidades = spark.read.csv("municipios.csv", header=True, inferSchema=True)\npontos = VectorAssembler(inputCols=["chuva_anual", "temperatura"], outputCol="features").transform(cidades)\ngrupos = KMeans(k=2, seed=1).fit(pontos)\ntamanhos = sorted(grupos.summary.clusterSizes)\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.clustering import KMeans

      cidades = spark.read.csv("municipios.csv", header=True, inferSchema=True)
      pontos = VectorAssembler(inputCols=["chuva_anual", "temperatura"], outputCol="features").transform(cidades)
      grupos = KMeans(k=3, seed=1).fit(pontos)
      tamanhos = sorted(grupos.summary.clusterSizes)
      print(tamanhos)
      grupos.transform(pontos).select("municipio", "prediction").show()
    `,
    regras: [{ modelo: 'grupos', tipo: 'KMeansModel', k: 3 }, { variavel: 'tamanhos', igual: [3, 3, 3] }],
    regrasOcultas: [{ modelo: 'grupos', tipo: 'KMeansModel', k: 3 }, { variavel: 'tamanhos', igual: [2, 3, 4] }],
  }),
  exercicioAlem({
    id: 'ml-pipeline',
    titulo: 'O pipeline completo',
    dificuldade: 'dificil',
    enunciado: '<p>As <code>etapas</code> estão prontas: índice da cultura, one-hot, vetor de features (com a cultura) e a regressão. Treine em <code>modelo</code> um <code>Pipeline</code> com elas, usando a safra de treino. O RMSE nos dados de teste deve ficar abaixo de 0,001.</p>',
    dica: 'modelo = Pipeline(stages=etapas).fit(treino)',
    ...dados,
    inicial: `${PIPELINE}${TREINO}modelo = Pipeline(stages=etapas)\n`,
    solucao: bloco`
      ${PIPELINE}
      ${TREINO}
      modelo = Pipeline(stages=etapas).fit(treino)
      modelo.transform(treino).select("municipio", "producao_t", "prediction").show()
    `,
    ...nosDois(() => ({ modelo: 'modelo', tipo: 'PipelineModel', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv' } })),
  }),
  exercicioAlem({
    id: 'ml-comparar',
    titulo: 'Qual modelo é melhor',
    dificuldade: 'dificil',
    enunciado: '<p>Treine duas regressões da produção: uma só com a chuva, outra com chuva, área e irrigação. Calcule o RMSE de cada uma nos dados de teste, guarde em <code>melhor</code> o modelo de menor erro e em <code>venceu</code> o nome dele: <code>"simples"</code> ou <code>"completo"</code>.</p>',
    dica: 'Um VectorAssembler para cada modelo; avalie cada um com os dados de teste montados pelo seu VectorAssembler.',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\n${TREINO}${TESTE}simples = VectorAssembler(inputCols=["chuva_mm"], outputCol="features")\nmelhor = LinearRegression(labelCol="producao_t").fit(simples.transform(treino))\nvenceu = "simples"\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.evaluation import RegressionEvaluator

      ${TREINO}${TESTE}
      simples = VectorAssembler(inputCols=["chuva_mm"], outputCol="features")
      completo = VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado"], outputCol="features")
      avaliador = RegressionEvaluator(labelCol="producao_t", metricName="rmse")
      m1 = LinearRegression(labelCol="producao_t").fit(simples.transform(treino))
      m2 = LinearRegression(labelCol="producao_t").fit(completo.transform(treino))
      rmse_simples = avaliador.evaluate(m1.transform(simples.transform(teste)))
      rmse_completo = avaliador.evaluate(m2.transform(completo.transform(teste)))
      melhor, venceu = (m2, "completo") if rmse_completo < rmse_simples else (m1, "simples")
      print(venceu, round(rmse_simples, 3), round(rmse_completo, 3))
    `,
    ...nosDois((i) => ({ modelo: 'melhor', coeficientes: COEF[i], intercepto: INTERCEPTO[i] })),
  }),
  exercicioAlem({
    id: 'ml-novos',
    titulo: 'A previsão para a próxima safra',
    dificuldade: 'dificil',
    enunciado: '<p>Treine o pipeline com as <code>etapas</code> e use-o nos municípios de <code>safra-teste.csv</code> <b>sem</b> as colunas <code>producao_t</code> e <code>risco</code> (como dados novos, que ainda não têm a resposta). Guarde em <code>previsoes</code> o <code>municipio</code> e a <code>producao_prevista</code> (a previsão com 1 casa decimal).</p>',
    dica: 'novos = teste.drop("producao_t", "risco"); modelo.transform(novos).select("municipio", F.round("prediction", 1).alias("producao_prevista"))',
    ...dados,
    inicial: `${PIPELINE}${TREINO}${TESTE}novos = teste.drop("producao_t", "risco")\nprevisoes = novos.select("municipio")\nprevisoes.show()\n`,
    solucao: bloco`
      ${PIPELINE}
      ${TREINO}${TESTE}
      modelo = Pipeline(stages=etapas).fit(treino)
      novos = teste.drop("producao_t", "risco")
      previsoes = modelo.transform(novos).select("municipio", F.round("prediction", 1).alias("producao_prevista"))
      previsoes.show()
    `,
    regras: [{ modelo: 'modelo', tipo: 'PipelineModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'producao_prevista'], aprox: 1e-9,
      linhas: [['Ouricuri', 10.2], ['Salgueiro', 16.5], ['Petrolina', 19.3], ['Tauá', 8.6], ['Crato', 19.5], ['Sobral', 12]] }],
    regrasOcultas: [{ modelo: 'modelo', tipo: 'PipelineModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'producao_prevista'], aprox: 1e-9,
      linhas: [['Arcoverde', 9.6], ['Petrolina', 15.2], ['Barbalha', 21], ['Tauá', 9.4], ['Sobral', 14.4]] }],
  }),
];
```

- [ ] **Step 3: Run the content test to verify it passes**

Run: `rtk proxy npx vitest run tests/alem-conteudo.test.js > /tmp/v.txt 2>&1; grep -E "Tests |×" /tmp/v.txt | head -20`
Expected: PASS. Se um coeficiente vier com erro maior que 1e-6 (por causa da padronização interna), a regra pode usar `aprox: 1e-4`, a tolerância do CI para a regressão linear; nunca mude o valor esperado, que é a fórmula exata dos dados.

- [ ] **Step 4: Commit**

```bash
git add src/conteudo/alem-mllib.js tests/alem-conteudo.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Além do batch: MLlib (4 lições e 12 exercícios)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: O módulo na trilha: certificado, badge e glossário

**Files:**
- Create: `src/conteudo/alem.js`
- Modify: `src/conteudo/trilha.js`, `src/certificados.js`, `src/badges.js`, `src/conteudo/glossario.js`, `tests/conteudo.test.js`, `tests/glossario.test.js`
- Delete: `tests/alem-conteudo.test.js` (a partir daqui, `conteudo.test.js` roda os exercícios do módulo com os outros)
- Generated: `public/badges/alem.png`, `public/badges/alem-card.png`, `public/badge/alem/index.html` e a capa (`npm run badges`)

**Interfaces:**
- Consumes: `licoesDelta`/`exerciciosDelta` (Task 4), `licoesStreaming`/`exerciciosStreaming` (Task 5), `licoesMllib`/`exerciciosMllib` (Task 6).
- Produces: `moduloAlem` (`id: 'alem'`), na trilha depois de `moduloPyspark`; `CERTIFICADOS.alem`; `BADGES.alem`; 16 termos do glossário no nível `alem`.

- [ ] **Step 1: Write the failing tests**

Em `tests/conteudo.test.js`, na tabela de `estrutura`, acrescente o módulo:

```js
  it.each([['basico', 40, 10], ['dados', 40, 10], ['paralelismo', 35, 10], ['pyspark', 45, 14], ['alem', 36, 12]])('o módulo %s tem %i exercícios e %i lições', (id, exercicios, licoes) => {
```

e, no mesmo `describe('estrutura')`:

```js
  it('o módulo alem tem, em cada área, 3 fáceis, 6 médios e 3 difíceis, e vem depois do PySpark', () => {
    const m = modulos.find((x) => x.id === 'alem');
    for (const prefixo of ['dl-', 'st-', 'ml-']) {
      const area = m.itens.filter((i) => i.tipo === 'problema' && i.id.startsWith(prefixo));
      expect(['facil', 'medio', 'dificil'].map((d) => area.filter((i) => i.dificuldade === d).length)).toEqual([3, 6, 3]);
    }
    expect(modulos.map((x) => x.id).slice(-2)).toEqual(['pyspark', 'alem']);
  });
```

Em `tests/glossario.test.js`:

```js
  it('os termos do streaming, do Delta e do MLlib só aparecem do módulo alem em diante', () => {
    const texto = "A marca d'água descarta o atrasado; o merge faz o upsert; o pipeline junta o estimador";
    expect(ids(texto, 'alem')).toEqual(expect.arrayContaining(['marca-dagua', 'upsert', 'pipeline', 'estimador']));
    expect(ids(texto, 'pyspark')).not.toContain('marca-dagua');
  });
```

Run: `rtk proxy npx vitest run tests/glossario.test.js tests/carga-horaria.test.js 2>&1 | grep -E "Tests |×" | tail -4`
Expected: FAIL no glossário (os termos ainda não existem).

- [ ] **Step 2: Write `src/conteudo/alem.js`**

```js
// 🌊 Spark além do batch: 12 lições e 36 exercícios em três áreas, na ordem Delta Lake →
// Structured Streaming → MLlib (alem-delta.js, alem-streaming.js e alem-mllib.js).
import { licoesDelta, exerciciosDelta } from './alem-delta.js';
import { licoesStreaming, exerciciosStreaming } from './alem-streaming.js';
import { licoesMllib, exerciciosMllib } from './alem-mllib.js';

const ex = Object.fromEntries([...exerciciosDelta, ...exerciciosStreaming, ...exerciciosMllib].map((e) => [e.id, e]));
const itens = (...ids) => ids.map((id) => ex[id]);

export const moduloAlem = {
  id: 'alem',
  titulo: 'Spark além do batch',
  icone: '🌊',
  descricao: "Delta Lake (versões, merge e time travel), Structured Streaming (micro-lotes, janelas e marca d'água) e MLlib (pipelines, regressão, classificação e agrupamento). Uma implementação para aprender, com a API do Spark, rodando no seu navegador.",
  itens: [
    licoesDelta.tabela, ...itens('dl-gravar', 'dl-append'),
    licoesDelta.historico, ...itens('dl-versao', 'dl-voltar'),
    licoesDelta.merge, ...itens('dl-update', 'dl-delete', 'dl-merge', 'dl-historico', 'dl-desfazer'),
    licoesDelta.manutencao, ...itens('dl-schema', 'dl-vacuum', 'dl-optimize'),
    licoesStreaming.microLotes, ...itens('st-rate', 'st-ler'),
    licoesStreaming.fontes, ...itens('st-filtro', 'st-max-files', 'st-sql'),
    licoesStreaming.modos, ...itens('st-complete', 'st-update', 'st-alerta'),
    licoesStreaming.janelas, ...itens('st-janela', 'st-deslizante', 'st-marca', 'st-fechadas'),
    licoesMllib.features, ...itens('ml-vetor', 'ml-scaler'),
    licoesMllib.pipeline, ...itens('ml-indexer', 'ml-pipeline'),
    licoesMllib.modelos, ...itens('ml-linear', 'ml-logistica', 'ml-arvore'),
    licoesMllib.avaliacao, ...itens('ml-rmse', 'ml-auc', 'ml-kmeans', 'ml-comparar', 'ml-novos'),
  ],
};
```

- [ ] **Step 3: Put it in the trail, the certificate chain and the badge**

`src/conteudo/trilha.js`:

```js
import { moduloAlem } from './alem.js';

export const modulos = [moduloBasico, moduloDados, moduloParalelismo, moduloPyspark, moduloAlem];

/** Módulos das próximas versões (só título e ícone, para a landing e a trilha). */
export const PROXIMOS_MODULOS = [
  { id: 'projetos', icone: '🏗️', titulo: 'Projetos' },
];
```

`src/certificados.js`, em `CERTIFICADOS`, depois de `pyspark` (a ordem das chaves é a ordem da cadeia):

```js
  alem: {
    titulo: 'Streaming, Machine Learning e Delta Lake com Spark',
    cargaHoraria: 20,
    resumo: 'concluiu o módulo Spark além do batch, resolvendo os 36 problemas práticos',
    hashtags: ['Spark', 'Streaming', 'MachineLearning', 'DeltaLake'],
    conteudos: ['Delta Lake: versões, merge e time travel', "Structured Streaming: micro-lotes, janelas e marca d'água", 'MLlib: pipelines, regressão, classificação e agrupamento', 'Avaliação de modelos'],
  },
```

`src/badges.js`, em `BADGES`, depois de `pyspark`:

```js
  // A onda do ícone 🌊: um til, porque o gerador de PNG só tem a fonte do site.
  alem: { cor: '#50fa7b', simbolo: '~', faixa: 'ALÉM DO BATCH' },
```

e na capa (a função que monta o SVG de 1200×630, junto dos outros `badge(...)`):

```js
${badge('alem', 1000, 400, 195)}
```

- [ ] **Step 4: Add the glossary terms**

Em `src/conteudo/glossario.js`, no **fim** de `GLOSSARIO` (os termos do nível `alem` vêm depois de todos os do PySpark), e em `INICIO_DO_NIVEL` acrescente `alem: 'micro-lote'`:

```js
  // ---------- Spark além do batch ----------
  {
    id: 'micro-lote', termo: 'Micro-lote', padroes: ['micro-?lotes?'],
    definicao: 'Um pedaço dos dados que chegaram no streaming, processado de uma vez. O Structured Streaming roda um micro-lote atrás do outro.',
    analogia: 'A passada no pluviômetro: a cada visita você anota só o que choveu desde a última.',
    exemplo: 'q = df.writeStream.format("console").start()\nq.processAllAvailable()  # Batch: 0, Batch: 1...',
  },
  {
    id: 'estado-streaming', termo: 'Estado', padroes: ['estado'],
    definicao: 'O que uma consulta de streaming guarda entre um micro-lote e outro, como a contagem de cada chave até agora.',
    analogia: 'O caderno do apurador: a cada urna nova, ele soma aos totais que já anotou.',
    exemplo: 'contagem = leituras.groupBy("estacao").count()  # a contagem é o estado',
  },
  {
    id: 'marca-dagua', termo: "Marca d'água", padroes: ["marca d['’]água", 'watermark'],
    definicao: 'Até onde o streaming espera dados atrasados: o maior tempo de evento já visto menos o atraso aceito. O que chega antes dela é descartado.',
    analogia: 'O fim da feira: depois de certa hora, quem chega com mercadoria não monta mais a banca.',
    exemplo: 'df.withWatermark("momento", "5 minutes")',
  },
  {
    id: 'gatilho', termo: 'Gatilho', padroes: ['gatilhos?', 'trigger'],
    definicao: 'Quando a consulta de streaming roda um micro-lote: a cada intervalo, uma vez só, ou até acabar o que já chegou.',
    analogia: 'O despertador do vigia: ele faz a ronda a cada hora, ou uma vez antes de fechar.',
    exemplo: 'df.writeStream.trigger(availableNow=True).start()',
  },
  {
    id: 'modo-saida', termo: 'Modo de saída', padroes: ['modos? de saída', 'outputMode'],
    definicao: 'O que sai em cada micro-lote: append (só as linhas novas), complete (a tabela inteira) ou update (só o que mudou).',
    analogia: 'O boletim da chuva: só as cidades novas, a lista inteira de novo, ou só quem mudou desde o último.',
    exemplo: 'df.writeStream.outputMode("update")',
  },
  {
    id: 'tempo-evento', termo: 'Tempo do evento', padroes: ['tempo do evento'],
    definicao: 'A hora em que a coisa aconteceu (a leitura da estação), e não a hora em que o dado chegou ao Spark.',
    analogia: 'A data da carta é a do dia em que foi escrita, não a do dia em que o carteiro entregou.',
    exemplo: 'F.window("momento", "10 minutes")  # momento é o tempo do evento',
  },
  {
    id: 'feature', termo: 'Feature', padroes: ['features?'],
    definicao: 'Uma característica usada pelo modelo para prever: chuva, área, irrigação.',
    analogia: 'Os dados da ficha do agricultor que o agrônomo olha antes de dar o palpite da safra.',
    exemplo: 'VectorAssembler(inputCols=["chuva_mm", "area_ha"], outputCol="features")',
  },
  {
    id: 'vetor', termo: 'Vetor', padroes: ['vetor(es)?', 'DenseVector', 'SparseVector'],
    definicao: 'Uma lista de números numa coluna só. No MLlib, as features de cada linha vão juntas num vetor.',
    analogia: 'O cartão com todos os números da roça, em vez de folhas soltas.',
    exemplo: 'from pyspark.ml.linalg import Vectors\nVectors.dense([300.0, 5.0, 1.0])',
  },
  {
    id: 'estimador', termo: 'Estimador', padroes: ['estimador(es)?', 'Estimator'],
    definicao: 'Algo que aprende com os dados (fit) e devolve um modelo, como o LinearRegression ou o StringIndexer.',
    analogia: 'O aprendiz que observa a colheita e, depois, sabe dar o palpite sozinho.',
    exemplo: 'modelo = LinearRegression(labelCol="producao_t").fit(dados)',
  },
  {
    id: 'transformador', termo: 'Transformador', padroes: ['transformador(es)?', 'Transformer'],
    definicao: 'Algo que muda um DataFrame com transform: o VectorAssembler e todo modelo treinado.',
    analogia: 'A máquina de beneficiar: entra o grão, sai o grão limpo.',
    exemplo: 'com_features = montador.transform(treino)',
  },
  {
    id: 'pipeline', termo: 'Pipeline', padroes: ['pipelines?'],
    definicao: 'As etapas de preparo e o modelo em ordem: o fit treina tudo, e o modelo do pipeline faz tudo de uma vez nos dados novos.',
    analogia: 'A linha da casa de farinha: descascar, ralar, prensar e torrar, sempre na mesma ordem.',
    exemplo: 'Pipeline(stages=[indexador, montador, regressao]).fit(treino)',
  },
  {
    id: 'overfitting', termo: 'Overfitting', padroes: ['overfitting', 'sobreajuste'],
    definicao: 'Quando o modelo decora o treino em vez de aprender: vai muito bem nele e mal em dados que nunca viu.',
    analogia: 'O aluno que decorou as respostas da prova do ano passado e não sabe resolver a deste ano.',
    exemplo: 'treino, teste = df.randomSplit([0.8, 0.2], seed=1)',
  },
  {
    id: 'log-transacoes', termo: 'Log de transações', padroes: ['log de transaç(ão|ões)', '_delta_log'],
    definicao: 'A pasta _delta_log de uma tabela Delta: um arquivo por versão, dizendo o que entrou e o que saiu.',
    analogia: 'O livro-caixa da cooperativa: cada lançamento numa página nova, nada é apagado.',
    exemplo: 'os.listdir("estoque/_delta_log")',
  },
  {
    id: 'time-travel', termo: 'Time travel', padroes: ['time travel', 'versionAsOf', 'timestampAsOf'],
    definicao: 'Ler uma tabela Delta como ela era numa versão (ou numa hora) do passado.',
    analogia: 'Folhear o livro-caixa até a página de ontem.',
    exemplo: 'spark.read.format("delta").option("versionAsOf", 0).load("estoque")',
  },
  {
    id: 'upsert', termo: 'Upsert', padroes: ['upsert'],
    definicao: 'Atualizar o que já existe e inserir o que é novo, numa operação só (o merge do Delta).',
    analogia: 'Na chegada da mercadoria, o que já tem na prateleira soma, e o produto novo ganha prateleira.',
    exemplo: 'tabela.alias("e").merge(novos.alias("n"), "e.id = n.id").whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()',
  },
  {
    id: 'vacuum', termo: 'Vacuum', padroes: ['vacuum'],
    definicao: 'Apagar de verdade os arquivos que nenhuma versão recente de uma tabela Delta usa. Depois dele, o time travel para antes da retenção não funciona.',
    analogia: 'Jogar fora os rascunhos velhos: o armário esvazia, mas não dá mais para consultar.',
    exemplo: 'DeltaTable.forPath(spark, "estoque").vacuum(168)',
  },
```

- [ ] **Step 5: Generate the badge files**

Run: `rtk proxy npm run badges` e depois `git status --porcelain public`
Expected: novos `public/badges/alem.png`, `public/badges/alem-card.png`, `public/badge/alem/index.html` e a capa refeita. Abra `public/badges/alem.png` e a capa com a ferramenta de ler arquivos (imagem) e confira que o badge 🌊 não cobre os outros nem sai da capa; se cobrir, ajuste as coordenadas do `badge('alem', ...)` e gere de novo.

- [ ] **Step 6: Remove the temporary content test and run the full suite**

Run: `git rm -q tests/alem-conteudo.test.js` e `rtk proxy npx vitest run > /tmp/v.txt 2>&1; grep -E "Test Files|Tests |×" /tmp/v.txt | head -20`
Expected: tudo passa. Os testes que conferem a lista de módulos ou de certificados (landing, SEO, novidades, validador) devem acompanhar sozinhos, porque leem `modulos` e `CERTIFICADOS`; se algum tiver o número de módulos ou de exercícios escrito à mão, atualize-o para 5 módulos e 196 exercícios (40 + 40 + 35 + 45 + 36) e diga isso no commit.

- [ ] **Step 7: Commit**

```bash
git add src/conteudo/alem.js src/conteudo/trilha.js src/certificados.js src/badges.js src/conteudo/glossario.js tests public
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Trilha: o módulo 🌊 Spark além do batch, com certificado, badge e glossário

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentação, spec, versão 0.5.0 e a conferência final

**Files:**
- Modify: `src/ui/declaracao-acessibilidade.js`, `README.md`, `src/novidades.js`, `package.json`, `package-lock.json`, `docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md`

**Interfaces:**
- Consumes: tudo das Tasks 1 a 7.
- Produces: a versão 0.5.0 pronta para publicar (com o "sim").

- [ ] **Step 1: Accessibility statement**

Em `src/ui/declaracao-acessibilidade.js`, logo depois do `<li>` que começa com "O PySpark daqui é uma implementação para aprender", acrescente:

```html
        <li>O streaming daqui usa um relógio simulado: os micro-lotes não dependem do tempo real, e o resultado é sempre o mesmo. O MLlib é uma implementação para aprender, em Python puro: os números ficam muito perto dos do Spark, mas podem diferir nas últimas casas, e a correção usa tolerância.</li>
```

(O site não tem página "sobre" separada: a declaração e o README cumprem o que a spec pede na seção 7.)

- [ ] **Step 2: README**

Rode `grep -n "14 lições e 45 exercícios" README.md` para achar o item do módulo PySpark na lista de módulos e acrescente, logo depois do parágrafo dele, no mesmo formato:

```markdown
- **🌊 Spark além do batch** · **12 lições e 36 exercícios**: Delta Lake (tabela com versões, histórico, time
  travel, merge, update, delete, schema, vacuum e optimize), Structured Streaming (micro-lotes, fontes e saídas,
  modos, estado, janelas e marca d'água, num relógio simulado) e MLlib (features, pipelines, regressão linear e
  logística, árvore de decisão, KMeans e avaliação). Certificado: Streaming, Machine Learning e Delta Lake com
  Spark (20 h).
```

Se o README tiver o total de exercícios ou de módulos (`grep -n "exercícios" README.md | head`), atualize para 196 exercícios e 5 módulos.

- [ ] **Step 3: Novidades and version**

Em `src/novidades.js`, no começo de `RELEASES`:

```js
  {
    versao: '0.5.0',
    data: '2026-10-15',
    titulo: 'Spark além do batch',
    resumo: 'O quinto módulo chegou: tabelas Delta com versões, dados que chegam aos poucos (Structured Streaming) e aprendizado de máquina com o MLlib, tudo no navegador.',
    grupos: [
      { titulo: '🌊 Módulo novo', itens: ['12 lições e 36 exercícios, com a cooperativa (Delta Lake), as estações do sertão (streaming) e a safra (MLlib).', 'Certificado "Streaming, Machine Learning e Delta Lake com Spark", de 20 horas, com o badge 🌊.', 'Termos novos no glossário: micro-lote, marca d\'água, pipeline, time travel, upsert e outros.'] },
      { titulo: '⚡ Aba Execução', itens: ['A parte 🌊 Micro-lotes mostra cada lote: o que entrou, o estado, a marca d\'água e o que saiu, em visual, em tabela e no resumo falado.', 'Cada fit do MLlib aparece como job, com as iterações.'] },
      { titulo: '♿ Acessibilidade', itens: ['O streaming roda num relógio simulado: o resultado não depende do tempo real, nem da velocidade do computador.'] },
    ],
  },
```

`package.json` e `package-lock.json` (só as duas primeiras ocorrências, as do próprio pacote): `"version": "0.4.2"` → `"version": "0.5.0"`.

- [ ] **Step 4: Update the spec**

Em `docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md`:
- §1.2, "Quais arquivos entram": troque "em ordem de nome" por "na ordem de modificação dos arquivos e, no empate, de nome (como o PySpark 4, conferido no CI)", e acrescente: "Uma linha atrasada é descartada pela marca d'água do lote anterior; a remoção do estado e a emissão usam a marca d'água atual."
- §5.3, "Os dados": troque o primeiro item por "São escritos à mão em `src/conteudo/alem-dados.js`, pequenos, com uma relação exata para o modelo aprender (a produção é uma fórmula sem ruído, e os coeficientes esperados são os da fórmula). Assim cada valor esperado pode ser conferido de cabeça. (Decisão do plano 4: no lugar do script `gerar-dados-alem.mjs`.)"
- §3, depois da tabela: "A métrica da regra `modelo` é calculada com `metrica.dados` e, se o modelo não for um `PipelineModel`, com `metrica.preparar` (o transformador do aluno que monta as features)."
- §7: "A página sobre" vira "O README" (o site não tem página sobre separada).

- [ ] **Step 5: Full verification**

Run, em ordem (cada um precisa terminar verde):
- `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > /tmp/pt.txt 2>&1; tail -2 /tmp/pt.txt`
- `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py 2>&1 | tail -2` → 15/15
- `rtk proxy npx vitest run > /tmp/v.txt 2>&1; grep -E "Test Files|Tests " /tmp/v.txt`
- `rtk proxy npx eslint .`
- `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") rtk proxy npm run build`

Depois, o preview (`preview_start` com o nome `python-playground`, porta 4176):
- abra `#/trilha`: o módulo 🌊 aparece depois do PySpark, com o cenário `rio`, e não está mais em "em breve";
- abra um exercício de streaming (`st-marca`), rode a solução (a aba Solução fica liberada se você somar o tempo no `localStorage`, ou cole o código da solução no editor) e confira a parte 🌊 Micro-lotes da aba ⚡ Execução;
- rode o axe (`https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`, injetado pela página) nos temas `dracula`, `claro`, `suave` e `alto-contraste`, com `runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']`: nenhuma violação;
- com a largura de 375px (`resize_window` preset `mobile`), a trilha e o exercício não têm rolagem horizontal.

- [ ] **Step 6: Commit**

```bash
git add src/ui/declaracao-acessibilidade.js README.md src/novidades.js package.json package-lock.json docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 0.5.0: Spark além do batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7 (só com o "sim"): publicar**

Peça o "sim" ao usuário. Com ele: `git push origin fase5`, confira o CI do PR sertaoseracloud/python-playground#2 (a conformidade roda os 15 programas), tire o PR do rascunho e faça o merge com rebase, como os anteriores.
