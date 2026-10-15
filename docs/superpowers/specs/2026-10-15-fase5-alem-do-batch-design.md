# Fase 5: 🌊 Spark além do batch — design

Data: 2026-10-15 · Site: DivergePython · Versão: 0.5.0 · Spec mestre: `2026-10-13-divergepython-design.md`

## Objetivo

O quinto módulo da trilha leva o aluno do Spark em lote para três assuntos:

- **Delta Lake:** tabelas com versões.
- **Structured Streaming:** dados que chegam aos poucos.
- **MLlib:** aprendizado de máquina.

São 12 lições e 36 exercícios, mais o certificado "Streaming, Machine Learning e Delta Lake com
Spark". Tudo roda no navegador, com o mesmo pacote `pyspark` próprio da fase 4.

Critério de sucesso:
- as soluções dos 36 exercícios passam nos casos visíveis e nos ocultos;
- as respostas erradas típicas falham, com um motivo útil;
- o CI confirma que a saída bate com o PySpark 4.0.1 e o delta-spark 4.0 reais, e com tolerância
  no MLlib;
- a aba ⚡ Execução mostra os micro-lotes em visual, em tabela e no resumo falado.

## Decisões (respostas do usuário)

- **Streaming na tela:** o console imprime `Batch: N` como o Spark, e a aba ⚡ Execução ganha a
  parte 🌊 Micro-lotes.
- **Conformidade com o Spark real no CI:** vale nas três áreas. O MLlib é comparado com tolerância.
- **Dados:** um tema por área. Delta usa a cooperativa, Streaming as estações do sertão e MLlib a
  safra.
- **Como o streaming roda:** relógio simulado e determinístico (opção A).
- **Ordem do módulo:** Delta → Streaming → MLlib.
- Os cenários da trilha têm spec própria (`2026-10-15-cenarios-da-trilha-design.md`). Este módulo
  usa o cenário `rio`.

## 1. Pacote Python

### 1.1 Delta Lake (`python/delta/`, mais o formato `delta` em `pyspark/sql/readwriter.py`)

**API:**
- `df.write.format("delta").mode("append" | "overwrite").save(caminho)`, com as opções
  `mergeSchema` e `overwriteSchema`.
- `spark.read.format("delta").load(caminho)`, com as opções `versionAsOf` e `timestampAsOf`.
- `DeltaTable.forPath(spark, caminho)`, que oferece:
  - `toDF()` e `history(n=None)`;
  - `update(condicao, {col: expr})` e `delete(condicao)`;
  - `merge(fonte, condicao)` com `whenMatchedUpdate`, `whenMatchedUpdateAll`, `whenMatchedDelete`,
    `whenNotMatchedInsert`, `whenNotMatchedInsertAll` e `execute()`;
  - `vacuum(horas)`;
  - `optimize().executeCompaction()`.

**Armazenamento** (no sistema de arquivos virtual do worker principal, como o Delta real):
- `caminho/_delta_log/00000000000000000000.json`, um commit por versão, com as ações
  `commitInfo`, `metaData` (schema), `add` e `remove`.
- Os arquivos de dados são `part-*.parquet`, no "parquet simplificado" da fase 4, um por partição
  gravada.
- O `history()` sai do log, com as colunas `version`, `timestamp`, `operation`,
  `operationParameters` e `operationMetrics`. O `show()` desse resultado tem o mesmo formato do Delta.
- O `timestamp` vem do relógio virtual (1.3). Assim, `timestampAsOf` e a ordem das versões são
  determinísticos.

**Regras do Delta:**
- **Schema:**
  - Gravar com uma coluna nova sem `mergeSchema` dá `AnalysisException`, com a mensagem do Delta.
  - Com `mergeSchema`, a coluna entra, e as linhas antigas leem `null` nela.
- **`vacuum`:**
  - Abaixo de 168 horas, recusa como o Delta, a não ser que
    `spark.databricks.delta.retentionDurationCheck.enabled` seja `false`.
  - Apaga só os arquivos removidos há mais tempo que a retenção, contada no relógio virtual.
- **`optimize`:** junta os arquivos pequenos de cada partição num só, com um commit `OPTIMIZE`.

### 1.2 Structured Streaming (`python/pyspark/sql/streaming/`)

**Leitura e escrita:**
- **`spark.readStream`:**
  - formatos `csv`, `json` e `text` de uma pasta, com `schema(...)` obrigatório para csv e json, e
    o mesmo erro do Spark sem ele;
  - formato `rate`, com `rowsPerSecond`, que gera as colunas `timestamp` e `value`;
  - opção `maxFilesPerTrigger`.
- **`df.writeStream`:**
  - `format("console" | "memory")` e `outputMode("append" | "complete" | "update")`;
  - `trigger(processingTime=…, once=True, availableNow=True)`, `queryName(...)`,
    `option("truncate", …)` e `start()`;
  - os mesmos erros do Spark para as combinações inválidas, por exemplo `complete` sem agregação e
    `append` com agregação sem marca d'água.
- **`StreamingQuery`:** `processAllAvailable()`, `awaitTermination(timeout=None)`, `stop()`,
  `isActive`, `lastProgress`, `recentProgress`, `name` e `id`.
- **`spark.streams`:** `active` e `awaitAnyTermination`.
- **Estado e janelas:** `groupBy(...).agg(...)` com estado; `window(coluna, duracao, deslize)`;
  `withWatermark(coluna, atraso)`; `dropDuplicates` com marca d'água.

**Execução (relógio simulado):**
- **Quais arquivos entram:** cada micro-lote pega os arquivos da pasta ainda não lidos, em ordem
  de nome, até `maxFilesPerTrigger`. Os arquivos que o próprio programa grava na pasta entre um
  lote e outro também entram.
- **Fonte `rate`:** gera `rowsPerSecond` linhas por segundo do relógio virtual.
- **Gatilho:**
  - `processingTime` avança o relógio virtual a cada lote;
  - `availableNow` e `processAllAvailable()` rodam lotes até não sobrar entrada;
  - `once` roda um lote;
  - `awaitTermination(timeout)` roda até acabar a entrada ou estourar o tempo virtual;
  - **sem gatilho de fim:** um `start()` sem `processAllAvailable` nem `awaitTermination` roda os
    lotes disponíveis quando o programa termina. Assim o resultado não depende do tempo real.
- **Execução do lote:** cada lote vira um DataFrame comum com as linhas novas e roda no mesmo
  executor da fase 4, com as partições nos workers.
- **Estado:** o estado (agregação por chave e janelas) fica no processo principal, entre um lote e
  outro.
- **Marca d'água:** é o maior tempo de evento já visto menos o atraso, recalculada no fim de cada
  lote.
  - Janelas abaixo dela são descartadas do estado.
  - No modo `append`, uma janela só sai quando a marca d'água passa do seu fim.
  - Uma linha atrasada além da marca d'água é ignorada e contada como descartada.
- **Saídas:**
  - `console` imprime como o Spark: `-------------------------------------------`,
    `Batch: N`, a mesma linha de traços, e então a tabela do `show()` (truncada a 20 caracteres, a
    não ser que `truncate` seja `false`).
  - `memory` cria uma tabela temporária com o nome da consulta, que pode ser lida com `spark.sql`.

### 1.3 Relógio virtual (`python/diverge_runtime/relogio.py`)

- Uma hora fixa de início por execução: `2026-01-01 00:00:00` UTC.
- Avança só quando o streaming ou o Delta pedem.
- `current_timestamp()` e `now()` do Spark, dentro de streaming e Delta, usam esse relógio.
- O módulo `time` e o `datetime` do aluno continuam com a hora real.

### 1.4 MLlib (`python/pyspark/ml/`)

**API:**
- **`linalg`:** `Vectors.dense`, `Vectors.sparse`, `DenseVector` e `SparseVector`, que aparecem no
  `show()` como no Spark.
- **`feature`:**
  - `VectorAssembler` (`inputCols`, `outputCol`, `handleInvalid`);
  - `StringIndexer`, com o índice em ordem de frequência e o empate pela ordem alfabética, como o
    Spark;
  - `OneHotEncoder`, com `dropLast=True`, que gera vetores esparsos;
  - `StandardScaler` (`withMean`, `withStd`).
- **Modelos:**
  - `regression.LinearRegression`, com `regParam`, `elasticNetParam=0` e a solução exata pelas
    equações normais. Tem `coefficients`, `intercept` e `summary` (`rootMeanSquaredError`, `r2`).
  - `classification.LogisticRegression`, binária, com `regParam` e o ótimo pelo método de Newton.
    Tem `coefficients`, `intercept`, `probability`, `prediction` e `summary.areaUnderROC`.
  - `classification.DecisionTreeClassifier`, com `maxDepth`, `maxBins=32`, gini e os cortes
    candidatos como no Spark. Tem `depth`, `numNodes` e `featureImportances`.
  - `clustering.KMeans`, com `k`, `seed` e `maxIter`, inicialização determinística pela semente, e
    `clusterCenters()` e `summary.trainingCost`.
- **`Pipeline`, `PipelineModel` e `evaluation`:**
  - `RegressionEvaluator`: rmse, mse, mae e r2;
  - `BinaryClassificationEvaluator`: areaUnderROC e areaUnderPR;
  - `MulticlassClassificationEvaluator`: accuracy e f1;
  - `ClusteringEvaluator`: silhouette.
- **`randomSplit(pesos, seed)`:** é determinístico pela semente, mas não sorteia as mesmas linhas do
  Spark.

**Treino distribuído:**
- Cada partição calcula num worker as suas estatísticas (X'X e X'y; gradiente e hessiana; somas
  por centro; contagens por corte), e o processo principal junta tudo.
- Cada `fit` vira um ou mais jobs na aba ⚡ Execução: "fit LinearRegression", "fit KMeans
  (iteração 3)"…

**Números:** cálculos em Python puro, com `float`, sem numpy. Os resultados podem diferir dos do
Spark nas últimas casas; os exercícios e o CI usam tolerância (seção 4).

## 2. O que o aluno vê

### 2.1 Resultado da execução

O motor devolve, além do que já devolve, um bloco `streaming` (ou `null`):

```js
streaming: { consultas: [{ nome, modo, formato, lotes: [{ id, entrada, arquivos, estado, marcaDagua, saida, descartadas }] }] }
```

No bloco, `entrada` e `saida` são números de linhas, `estado` é o número de chaves guardadas,
`marcaDagua` é a data ISO (ou `null`) e `arquivos` é a lista de nomes.

As operações do Delta e os `fit` do MLlib entram como jobs comuns no bloco `spark` que já existe.

### 2.2 Aba ⚡ Execução: parte 🌊 Micro-lotes

- Aparece quando `streaming` não é `null`.
- Para cada consulta, há uma linha do tempo dos lotes, só visual (`aria-hidden`). Cada lote é um
  bloco com a entrada, o estado, a marca d'água e a saída.
- Embaixo, uma tabela diz o mesmo em texto, com as colunas Lote, Arquivos, Linhas lidas, Estado,
  Marca d'água, Linhas emitidas e Descartadas.
- **Resumo falado:** "1 consulta, 4 micro-lotes, 12 linhas lidas, 2 descartadas, marca d'água em
  00:10".
- Com programa sem jobs Spark mas com streaming, a aba aparece do mesmo jeito.

### 2.3 Terminal

- O console do streaming, o `history()` e os `summary` saem no terminal, no formato do Spark.

## 3. Correção: três regras novas (`src/verificacoes.js`)

| Regra | Campos | Motivos (exemplos) |
|---|---|---|
| `stream` | `stream: nome`, `lotes`, `modo`, `saidaPorLote: [n…]`, `marcaDagua`, `descartadas` | "a consulta alertas não existe", "esperados 3 lotes, vieram 1", "o lote 2 devia emitir 1 linha, emitiu 3", "a marca d'água final devia ser 00:10, foi 00:20" |
| `modelo` | `modelo: variavel`, `tipo`, `coeficientes` + `aprox`, `intercepto`, `k`, `profundidade`, `metrica: { nome, min \| max, dados }` | "m não é um modelo treinado (fit)", "esperado LinearRegressionModel, veio LogisticRegressionModel", "AUC 0,61 nos dados de teste; o mínimo é 0,80" |
| `delta` | `delta: caminho`, `versao`, `operacoes: [...]`, `linhasNaVersao: { versao, linhas }`, `colunas` | "não existe tabela Delta em /dados/estoque", "o histórico tem WRITE, MERGE; faltou DELETE", "a versão atual devia ser 3, é 2" |

**Categorias e dados que a regra usa:**
- As categorias são Streaming, Modelo e Delta.
- O `metrica.dados` aponta para o arquivo de teste do caso. O executor avalia o modelo do aluno
  nesses dados, depois do programa, e devolve o valor em `modelos[variavel].metricas`.
- O executor Python devolve também `modelos` (tipo, coeficientes, intercepto, k, profundidade e
  métricas pedidas) e `deltas` (versão, operações e schema de cada caminho lido ou gravado). As
  regras novas leem isso.
- Os casos ocultos usam outros dados:
  - streaming: outros arquivos na pasta;
  - MLlib: outro conjunto de teste;
  - Delta: outra carga e outras atualizações.

## 4. Conformidade com o Spark real (CI)

O job de conformidade da fase 4 (`.github/workflows/pages.yml`, PySpark 4.0.1) ganha:

- **`delta-spark==4.0.0`** e os testes Delta: a mesma sequência de operações nos dois lados e a
  mesma saída do `history()` (só as colunas `version`, `operation` e `operationParameters`), do
  `toDF()` em cada versão e dos erros de schema e de `vacuum`.
- **Streaming:** os arquivos já na pasta, `maxFilesPerTrigger=1`, `trigger(availableNow=True)` e
  saída `memory`. Os dois lados comparam o resultado da tabela de memória depois de cada lote, e o
  texto do console.
- **MLlib** com tolerância:
  - coeficientes e intercepto com `abs ≤ 1e-4` na linear e `≤ 1e-3` na logística;
  - métricas com `≤ 1e-3`;
  - árvore: mesma profundidade e mesmas previsões;
  - KMeans com grupos bem separados: os mesmos grupos, em qualquer ordem, e custo com `≤ 1e-3`
    relativo;
  - `randomSplit`: tamanhos com `±15%`.

Se uma diferença com o Spark real for impossível de evitar, ela vira uma nota na declaração de
acessibilidade e sobre, nunca um teste desligado sem explicação.

## 5. Conteúdo do módulo (`src/conteudo/alem.js`, mais arquivos por área se ficar grande)

- O id do módulo é `alem`, com o título "Spark além do batch" e o ícone 🌊. Ele sai de
  `PROXIMOS_MODULOS`.
- São 12 lições (4 por área) e 36 exercícios, 12 por área. Em cada área: 3 fáceis, 6 médios e 3
  difíceis.
- A carga horária dá **20 h**: 12×10 + 9×15 + 18×30 + 9×45 = 1200 min.

### 5.1 🔺 Delta Lake: cooperativa (`associados.csv`, `estoque.csv`, `entrada-dia-N.csv`)

- **Lições:** tabela Delta e log de transações; histórico e time travel; merge, update e delete;
  schema, vacuum e optimize.
- **Exercícios (12):**
  1. gravar e ler em delta (F);
  2. append e versões (F);
  3. ler uma versão antiga (F);
  4. `history()` com as operações (M);
  5. `update` do preço (M);
  6. `delete` de associado desligado (M);
  7. `merge` (upsert) do estoque do dia (M);
  8. erro de schema e `mergeSchema` (M);
  9. `overwrite` e voltar no tempo (M);
  10. `vacuum` com retenção (D);
  11. `optimize` de arquivos pequenos (D);
  12. desfazer uma carga errada com time travel e `merge` (D).

### 5.2 🌊 Structured Streaming: estações (`leituras/lote-NN.csv`)

- As estações são Petrolina, Juazeiro, Crato, Sobral e Mossoró. Cada leitura tem as colunas
  `estacao`, `momento` (tempo do evento), `temperatura`, `umidade` e `chuva_mm`.
- **Lições:** micro-lotes e a tabela sem fim; fontes, saídas e gatilhos; modos e estado; tempo do
  evento, janelas e marca d'água.
- **Exercícios (12):**
  1. primeira consulta com `rate` (F);
  2. ler a pasta com schema (F);
  3. filtro de temperatura alta no append (F);
  4. contagem por estação no complete (M);
  5. o update mostrando só o que mudou (M);
  6. `maxFilesPerTrigger` e o número de lotes (M);
  7. saída `memory` consultada com SQL (M);
  8. janela de 10 minutos (M);
  9. janela deslizante (M);
  10. marca d'água descartando o atrasado (D);
  11. append com janela e marca d'água (D);
  12. alerta de chuva forte com estado (D).

### 5.3 🤖 MLlib: safra (`safra-treino.csv`, `safra-teste.csv`, `municipios.csv`)

- As colunas são `municipio`, `cultura`, `chuva_mm`, `area_ha`, `irrigado`, `producao_t` e `risco`
  (0 ou 1).
- **Lições:** features, vetores e `VectorAssembler`; transformadores, estimadores e `Pipeline`;
  regressão e classificação; avaliação, treino e teste, e agrupamento.
- **Exercícios (12):**
  1. vetor de features (F);
  2. `StringIndexer` e `OneHotEncoder` (F);
  3. `StandardScaler` (F);
  4. regressão linear da produção (M);
  5. coeficientes e RMSE (M);
  6. logística do risco (M);
  7. AUC no teste (M);
  8. árvore de decisão e profundidade (M);
  9. `KMeans` de municípios (M);
  10. `Pipeline` completo (D);
  11. comparar dois modelos pela métrica (D);
  12. pipeline treinado em dados novos (D).

**Os dados:**
- São gerados por um script versionado (`scripts/gerar-dados-alem.mjs`) com semente fixa, com uma
  relação clara para o modelo aprender. Por exemplo, a produção cresce com a chuva e a área, e a
  irrigação reduz o risco.
- Os grupos do KMeans são bem separados.

### 5.4 Certificado, badge e glossário

- **Certificado** `alem`: "Streaming, Machine Learning e Delta Lake com Spark", 20 h, com o resumo
  "concluiu o módulo Spark além do batch, resolvendo os 36 problemas práticos".
  - **Conteúdos:** Delta Lake (versões, merge e time travel); Structured Streaming (micro-lotes,
    janelas e marca d'água); MLlib (pipelines, regressão, classificação e agrupamento); avaliação de
    modelos.
  - O certificado entra na cadeia depois de `pyspark`.
- **Badge** 🌊, no mesmo estilo dos outros.
- **Glossário**, só do módulo `alem` em diante: micro-lote, estado, marca d'água, gatilho, modo de
  saída, tempo do evento, feature, vetor, estimador, transformador, pipeline, overfitting, log de
  transações, time travel, upsert e vacuum.

## 6. Testes

- **pytest** (`python/tests/`), com testes próprios de cada API acima:
  - Delta: log, histórico, merge e schema;
  - streaming: lotes, estado, marca d'água e modos;
  - MLlib: valores conhecidos calculados à mão.
- **Conformidade** (seção 4), no CI.
- **vitest:**
  - as regras `stream`, `modelo` e `delta` (passa, falha e motivo);
  - a parte 🌊 Micro-lotes da aba ⚡ Execução (tabela e fala);
  - o motor com streaming de ponta a ponta no Pyodide;
  - os testes de conteúdo de sempre: as soluções dos 36 passam nos casos visíveis e ocultos, as
    respostas erradas falham, o glossário fica restrito ao módulo e a carga horária dá 20 h.
- **Conferência manual:** o preview, o axe (WCAG 2.2 AA) nos 4 temas, com a aba Execução mostrando
  micro-lotes, e a largura de 375px.

## 7. Documentação e versão

- A declaração de acessibilidade e a página sobre ganham uma nota: o streaming usa um relógio
  simulado, e o MLlib é uma implementação para aprender, com números próximos aos do Spark.
- README, novidades e a capa com o badge novo.
- Sai na versão **0.5.0**, junto com os cenários da trilha (spec própria). Publica só com o "sim".

## 8. Planos

A spec é grande demais para um plano só. São quatro, executados em ordem:

1. **Delta Lake e relógio virtual:** pacote, pytest e conformidade.
2. **Structured Streaming:** pacote, pytest, conformidade, o bloco `streaming` no motor e a parte
   🌊 Micro-lotes.
3. **MLlib:** pacote, pytest e conformidade.
4. **Conteúdo e correção:** as regras `stream`, `modelo` e `delta`, os dados, as lições e os
   exercícios, o certificado, o badge, o glossário e a documentação.

Cada plano termina com a suíte inteira verde. A publicação acontece só depois do plano 4 e dos
cenários.

## Fora do escopo

- Kafka, sockets e outras fontes de streaming além de arquivos e `rate`.
- `foreachBatch`, `writeStream` para arquivos ou Delta, e `mapGroupsWithState`.
- Regularização L1 (`elasticNetParam > 0`), regressão logística multinomial, florestas e GBT, e
  validação cruzada (`CrossValidator`).
- Tabelas Delta no catálogo (`forName`, `CREATE TABLE … USING delta`), Change Data Feed e Z-order.
