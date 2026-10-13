# DivergePython: Python até PySpark, com dados em paralelo

Especificação de design. Aprovada por partes na conversa de 13/10/2026; este documento
junta as quatro partes para revisão antes do plano de implementação.

## 1. Objetivo

Um terceiro site da família Diverge (depois do DivergeTerraform e do DivergePHP), da
Sertão será cloud: uma trilha gamificada que leva do Python básico ao PySpark, com foco
em **processamento de dados em paralelo**, acessível para pessoas cegas, surdas, mudas e
neurodivergentes.

**Público:** quem está começando em programação ou em dados, em aula ou sozinho.

**Critérios de sucesso:**

- 286 exercícios com correção automática na hora, cada um com casos visíveis e ocultos.
- O código do aluno é Python de verdade (Pyodide) e PySpark com a API real.
- O paralelismo é real: processos e partições do Spark rodam em vários workers do
  navegador ao mesmo tempo, com tempos medidos.
- O comportamento da API simulada bate com o PySpark real nos testes de conformidade.
- Mesmo nível de acessibilidade dos outros sites (WCAG 2.2 AA conferida com axe-core nos
  quatro temas, leitor de tela, Libras, perfis para neurodivergentes).
- Site estático e gratuito no GitHub Pages, sem conta, sem cadastro e sem servidor.

## 2. Decisões tomadas

| Pergunta | Decisão |
| --- | --- |
| Onde fica | Site novo: **DivergePython**, repositório `sertaoseracloud/python-playground`, publicado em `https://sertaoseracloud.github.io/python-playground/` |
| Como o Python roda | Pyodide 314.0.7 (Python 3.14) em Web Worker |
| Como o Spark roda | Pacote `pyspark` próprio, em Python puro, com a API do PySpark real |
| Paralelismo | Real: um pool de workers, cada um com seu Pyodide. Nada de relógio virtual |
| Threads | O Pyodide não cria threads. Concorrência de I/O e condições de corrida com `asyncio` (real); threads entram como conceito |
| Escopo do Spark | Batch (RDD, DataFrame, SQL) e também Structured Streaming, MLlib e Delta Lake |
| Tamanho | 286 exercícios em 6 módulos |
| Entrega | 6 fases; cada fase é uma versão publicada depois da aprovação do usuário |

## 3. Arquitetura

O projeto nasce como cópia do DivergePHP, que já roda uma linguagem em WebAssembly num
worker. Ficam iguais (com o nome trocado): interface, painel ♿ e perfis, avisos para
leitor de tela, VLibras, temas, trilha gamificada, certificados com selo HMAC e
assinatura Ed25519, validador, LGPD, termos, licença, instrutor e apoio via PIX, SEO
focado em acessibilidade, prerender da landing e o workflow do GitHub Pages.

Muda o motor: sai o php-wasm, entra o Pyodide com os nossos pacotes Python.

```
Página (main thread)
 ├─ src/python/motor.js        API para a interface: executar(arquivos, opções) → resultado
 ├─ src/python/pool.js         pool de workers paralelos (abre sob demanda, até 4)
 │    └─ interface Executor: navegador (Web Worker) e Node (worker_threads, nos testes)
 └─ src/ui/...                 telas herdadas do DivergePHP + aba ⚡ Execução

Worker principal (src/python/worker.js) — roda o código do aluno
 └─ Pyodide + pacotes de python/ montados no sistema de arquivos virtual

Workers do pool (src/python/worker-tarefa.js) — rodam tarefas e partições
 └─ Pyodide + os mesmos pacotes; recebem funções e dados com cloudpickle
```

### 3.1 Unidades e interfaces

| Unidade | Faz | Usa |
| --- | --- | --- |
| `src/python/motor.js` | Sobe o worker principal, envia arquivos e dados, aplica tempo limite (reinicia o worker se estourar), devolve `{ saida, erros, variaveis, tabelas, metricas, ms }` | worker principal |
| `src/python/pool.js` | Abre de 1 a 4 workers (`navigator.hardwareConcurrency - 1`, no máximo 4; no celular, menos), distribui tarefas, mede tempos reais, fecha os ociosos | `Executor` |
| `src/python/worker.js` | Carrega o Pyodide, monta `python/` no sistema de arquivos, roda o código, coleta as saídas | `diverge_runtime` |
| `python/diverge_runtime/` | Captura `print`, DataFrames mostrados e métricas de execução; ponte com o pool (envia tarefas pelo JS) | — |
| `python/diverge_paralelo/` | Implementa `multiprocessing.Pool`, `concurrent.futures.ProcessPoolExecutor` e `multiprocessing.Process` sobre o pool real | `diverge_runtime`, cloudpickle |
| `python/pyspark/` | SparkSession, RDD, DataFrame, `functions`, `Window`, `types`, SQL, `streaming`, `ml` | `diverge_runtime` (execução das partições no pool) |
| `python/delta/` | `DeltaTable` e o formato `delta` (log de transações no sistema de arquivos virtual) | `pyspark` |
| `python/vendor/cloudpickle/` | Serializa funções e `lambda` do aluno para os outros workers (licença BSD-3) | — |
| `src/corrigir.js` e `src/verificacoes.js` | Rodam os casos de teste e conferem as regras (seção 6) | `motor.js` |
| `src/ui/execucao.js` | Aba ⚡ Execução: estágios, tarefas por partição e linha do tempo dos workers, com versão em texto | métricas do resultado |

### 3.2 Fluxo de uma execução

1. O aluno clica em ▶ Executar (Ctrl+Enter).
2. `motor.js` envia os arquivos e os dados do exercício ao worker principal.
3. O worker roda o código. Se ele chamar `Pool.map`, `ProcessPoolExecutor.submit` ou uma
   ação do Spark, o `diverge_runtime` serializa as tarefas (cloudpickle) e pede ao
   `pool.js`, pelo JS, que as rode nos workers do pool.
4. O pool roda as tarefas em paralelo, mede início e fim de cada uma e devolve os
   resultados, também serializados.
5. O worker principal termina o código e devolve saída, erros, tabelas e métricas.
6. A interface mostra o terminal, a aba ⚡ Execução e roda os casos de teste (Executar:
   visíveis; Enviar: todos). O leitor de tela fala o resumo.

O worker principal espera o pool sem travar a página. O código do aluno é síncrono
(`df.show()`, `pool.map(...)`), então o Python precisa pausar no meio de uma chamada até
o pool responder. Isso usa o `run_sync` do Pyodide, que depende do JSPI (JavaScript
Promise Integration) do navegador. Onde o JSPI não existir, as tarefas e partições rodam
em sequência dentro do próprio worker principal: o resultado é o mesmo, e a aba ⚡
Execução e o leitor de tela avisam que, naquele navegador, não houve paralelismo. Esse
ponto é o primeiro risco técnico a validar (seção 10).

### 3.3 Carregamento

- O Pyodide (~10 MB) só baixa ao abrir o primeiro exercício. A landing continua
  pré-renderizada e leve.
- Os workers do pool só abrem quando o código usa paralelismo ou uma ação do Spark. O
  download é reaproveitado pelo cache do navegador.
- Cada worker usa de 40 a 60 MB de memória. Com pouca memória ou poucos núcleos, o pool
  abre menos workers (mínimo 1) e o site avisa que o resultado é o mesmo, só mais lento.

## 4. Paralelismo

- **Processos reais:** `multiprocessing.Pool` (`map`, `imap`, `starmap`, `apply_async`),
  `ProcessPoolExecutor` (`submit`, `map`, `as_completed`) e `Process`.
- **Regra do Python real mantida:** sem `if __name__ == "__main__":` o pool não sobe e o
  erro é o mesmo do Python real (vira lição).
- **Custo real:** abrir workers e serializar dados custa tempo. Paralelizar pouco dado
  pode ficar mais lento, e a linha do tempo mostra isso.
- **Threads:** o Pyodide não cria threads; `threading.Thread.start()` e
  `ThreadPoolExecutor` dão o erro do próprio Pyodide, explicado no site. Para não fingir,
  a concorrência de I/O é ensinada com `asyncio` (`gather`, `create_task`,
  `asyncio.Lock`, `Semaphore`), que roda de verdade, e as threads entram como conceito.
- **Condições de corrida reais:** com `asyncio`, `x = saldo; await asyncio.sleep(0);
  saldo = x + 1` perde atualizações de fato; a correção é com `asyncio.Lock`.
- **Memória compartilhada:** `multiprocessing.Value`/`Array` exigem SharedArrayBuffer, que
  o GitHub Pages não libera (sem os cabeçalhos COOP/COEP). Ficam como conceito, com a
  alternativa por troca de mensagens (`Queue`), que roda de verdade.

## 5. PySpark (implementação própria, em Python puro)

**Comum a tudo:**

- 4 partições por padrão (`spark.default.parallelism` e `spark.sql.shuffle.partitions`,
  ajustáveis com `spark.conf.set`). O site explica que o Spark real usa 200 partições de
  shuffle por padrão.
- Avaliação preguiçosa: transformações montam o plano; ações (`show`, `count`, `collect`,
  `take`, `write`) executam.
- Estágios cortados por transformações largas (`groupBy`, `join` sem broadcast,
  `orderBy`, `distinct`, `repartition`); shuffle por hash determinístico (o hash do Python
  muda a cada execução, então não é usado).
- Cada partição de um estágio roda num worker do pool. Métricas: linhas por partição,
  tarefas por estágio, linhas embaralhadas, tempos medidos.
- Saídas no formato do Spark: `show()` (tabela ASCII, truncamento em 20 caracteres),
  `printSchema()`, `explain()` (plano físico simplificado: `Exchange hashpartitioning`,
  `HashAggregate`, `BroadcastHashJoin`, `SortMergeJoin`).
- Erros no formato do Spark (`AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION]`,
  com sugestão de coluna parecida).

**Cobertura da API:**

| Área | Inclui |
| --- | --- |
| RDD | `parallelize`, `textFile`, `map`, `flatMap`, `filter`, `reduceByKey`, `groupByKey`, `sortBy`, `join`, `distinct`, `union`, `collect`, `count`, `reduce`, `take`, `getNumPartitions`, `glom`, `mapPartitions` |
| DataFrame | `createDataFrame`, leitura CSV/JSON (com e sem schema), `select`, `selectExpr`, `filter`/`where`, `withColumn`, `withColumnRenamed`, `drop`, `distinct`, `dropDuplicates`, `groupBy`/`agg`, `pivot`, `orderBy`, `limit`, `join` (inner, left, right, full, semi, anti), `union`/`unionByName`, `na.fill`/`na.drop`, `explode`, `cache`/`persist`, `repartition`/`coalesce`, `write` (CSV, JSON, parquet simplificado, delta) |
| `functions` | colunas e literais, aritmética, comparação, `when`/`otherwise`, strings, datas, agregações (`count`, `sum`, `avg`, `min`, `max`, `countDistinct`, `collect_list`), `broadcast`, `udf` |
| `Window` | `partitionBy`, `orderBy`, `rowsBetween`; `row_number`, `rank`, `dense_rank`, `lag`, `lead`, somas acumuladas e médias móveis |
| SQL | `createOrReplaceTempView`, `spark.sql` com SELECT, WHERE, GROUP BY, HAVING, ORDER BY, JOIN e funções de janela |
| Structured Streaming | `readStream` de pasta (arquivos que "chegam" ao longo da execução) e fonte `rate`; micro-lotes; `trigger`; modos `append`/`complete`/`update`; janela por tempo do evento; `withWatermark`; `writeStream` para console e memória |
| MLlib (`pyspark.ml`) | `Pipeline`, `VectorAssembler`, `StringIndexer`, `OneHotEncoder`, `StandardScaler`, `LinearRegression`, `LogisticRegression`, `KMeans`, `DecisionTreeClassifier`, avaliadores, `randomSplit` com semente |
| Delta Lake | `write.format("delta")`, `DeltaTable.forPath`, histórico, time travel (`versionAsOf`), `merge`, `update`, `delete`, aplicação e evolução de schema, `vacuum`, `optimize` simplificado |

**Fora de escopo:** `toPandas` (o pandas não é carregado), GraphX/GraphFrames, Spark Connect, Pandas API on Spark, Catalyst
completo (o otimizador só faz o essencial: empurrar filtros e escolher broadcast abaixo
de um limite), múltiplas sessões.

O site deixa claro, na trilha e na página de acessibilidade/sobre, que é uma
implementação para aprender, com a API do Spark, e não o Spark.

## 6. Correção dos exercícios

Mesmo modelo do DivergePHP: casos visíveis e ocultos (com outros dados), cada
verificação com categoria, valor obtido, motivo e dica, e o resumo falado para o leitor
de tela. Regras:

| Regra | Confere |
| --- | --- |
| `saida` | o texto impresso (contém, igual, regex) |
| `variavel` | o valor final de uma variável |
| `funcao` | chama a função do aluno com entradas de teste e compara o retorno |
| `dataframe` | schema e linhas de um DataFrame (a ordem só conta se o exercício pede `orderBy`) |
| `plano` | número de shuffles, broadcast, cache, partições, estágios |
| `paralelo` | quantos workers rodaram tarefas de fato (nunca o tempo, que varia por máquina) |
| `erro` | o erro esperado (por exemplo, sem `__main__`) |
| `codigo` / `semCodigo` | trechos exigidos ou proibidos |
| `semErros` | o código roda sem exceção |

## 7. Trilha (286 exercícios)

| Módulo | Exercícios | Conteúdo |
| --- | --- | --- |
| 🐍 Python básico | 40 | variáveis, tipos, strings, condições, laços, funções, listas, dicionários, exceções |
| 📊 Python para dados | 40 | comprehensions, tuplas, conjuntos, ordenação com `key`, `Counter`/`defaultdict`, CSV e JSON, datas, geradores, `map`/`filter`/`reduce`, `itertools` |
| ⚡ Paralelismo | 35 | dividir o trabalho, map-reduce à mão, partições (hash e intervalo), processos (`Pool`, `ProcessPoolExecutor`), `asyncio`, condições de corrida e `Lock`, GIL (conceito), speedup, Lei de Amdahl, custo de serializar |
| ✨ PySpark | 45 | SparkSession, RDD, DataFrame, nulos, joins e broadcast, Window, schema, leitura, Spark SQL, particionamento, shuffle e skew, cache, `explain`, UDF |
| 🌊 Spark além do batch | 36 | 12 de Structured Streaming, 12 de MLlib, 12 de Delta Lake |
| 🏗️ Projetos | 90 | 18 projetos × 5 etapas encadeadas (cada etapa parte da solução da anterior) |

Cada módulo tem também lições curtas. Desbloqueio aos 70% do módulo anterior.

**Projetos:** contagem de palavras em livros; vendas por região; análise de logs;
sensores de clima do sertão (Streaming); funil de e-commerce; ETL bronze → prata → ouro
(Delta); recomendação (MLlib); painel de indicadores; detecção de fraude; mobilidade
urbana (skew); saúde pública (média móvel); agronegócio (pivot); energia solar (séries
temporais); notas de exame sintéticas (percentis); hashtags e seguidores (`explode`);
streaming de música (top da semana); logística (joins e broadcast); qualidade de dados e
SCD tipo 2.

**Dados:** gerados por nós, pequenos, determinísticos e com tema brasileiro; os casos
ocultos usam outra semente.

**Certificados:** um por módulo e um final, emitidos pela Sertão será cloud e assinados
por Cláudio Raposo, com a carga horária pela regra dos outros sites (lição 10 min, fácil
15, médio 30, difícil 45; soma arredondada para cima, mínimo 1 h).

## 8. Interface

Igual ao DivergePHP, com:

- editor CodeMirror com `@codemirror/lang-python`;
- terminal com a saída e os erros (traceback do Python com a linha do aluno destacada);
- aba **⚡ Execução**: estágios, tarefas por partição e linha do tempo dos workers, com
  uma tabela em texto equivalente (leitor de tela) e a fala do resumo
  ("3 estágios, 1 shuffle, 4 tarefas em 4 workers");
- aba **📦 Dados** com os arquivos de entrada do exercício;
- playground livre com os dados de exemplo.

## 9. Testes

- **vitest + Pyodide no Node:** a solução de cada exercício passa em todos os casos; o
  código inicial falha em algum caso visível; as lições rodam sem erro.
- **Pool:** a mesma interface `Executor` com `worker_threads` no Node, para testar o
  paralelismo de verdade nos testes.
- **Unidade dos pacotes Python:** pytest em CPython no GitHub Actions (rápido).
- **Conformidade com o PySpark real:** no GitHub Actions (com Java), um conjunto de
  programas roda no PySpark real e no nosso; `show()`, schema, contagens, `explain`
  (forma geral) e mensagens de erro têm de bater. MLlib compara com tolerância.
- **Acessibilidade:** axe-core nas telas (incluindo a aba ⚡ Execução) e os testes de
  leitor de tela e Libras herdados.
- Lint, build de produção sem avisos e verificação do site publicado a cada fase.

## 10. Riscos

| Risco | Mitigação |
| --- | --- |
| O código síncrono do aluno precisa esperar o pool (assíncrono) | Fase 1 inclui uma prova de conceito do `run_sync`/JSPI do Pyodide nos navegadores principais (Chrome, Edge, Firefox, Safari); onde não houver JSPI, execução em sequência no worker principal, com o mesmo resultado e aviso de que não houve paralelismo. Os testes no Node usam o mesmo caminho com JSPI ligado |
| Memória com 4 Pyodides abertos | Pool sob demanda, fecha workers ociosos, limita pelo hardware e avisa |
| Diferenças de comportamento em relação ao Spark real | Testes de conformidade no CI e aviso claro no site |
| Tamanho do trabalho (286 exercícios) | Seis fases publicáveis; cada uma com testes completos |
| Números do MLlib diferentes do Spark | Tolerância nos testes; exercícios conferem tendência e métricas, não casas decimais |

## 11. Fases de entrega

| Fase | Entrega | Versão |
| --- | --- | --- |
| 1 | Plataforma (cópia adaptada do DivergePHP), Pyodide no worker, prova de conceito do pool, playground livre, 🐍 Python básico | 0.1.0 |
| 2 | 📊 Python para dados | 0.2.0 |
| 3 | Pool de workers real, `diverge_paralelo`, `asyncio` e ⚡ Paralelismo | 0.3.0 |
| 4 | Núcleo do `pyspark` (RDD, DataFrame, SQL, execução paralela, aba ⚡ Execução, conformidade) e ✨ PySpark | 0.4.0 |
| 5 | Streaming, MLlib, Delta Lake e 🌊 Spark além do batch | 0.5.0 |
| 6 | 🏗️ Projetos e certificado final | 1.0.0 |

Cada fase só é publicada depois do "sim" do usuário. O repositório no GitHub é criado na
fase 1, na hora da primeira publicação.
