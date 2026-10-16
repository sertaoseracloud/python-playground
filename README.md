# 🐍 DivergePython

Trilha de exercícios no estilo LeetCode para ensinar **Python, do primeiro `print` até PySpark, com foco
em dados em paralelo**. O Python 3.14 roda **dentro do navegador** (WebAssembly, com o
[Pyodide](https://pyodide.org)), e o paralelismo é **de verdade**: um pool de Web Workers, cada um com o
seu Python, usa os núcleos do computador. Não há servidor, instalação nem custo: o site é estático e
fica no GitHub Pages.

**Acesse:** https://sertaoseracloud.github.io/python-playground/

**Acessível para todas as pessoas.** O nome vem de *neurodivergente*: a plataforma foi feita para pessoas cegas (o leitor de tela fala o resultado de cada teste), surdas e mudas (nada depende de som ou de voz, com tradução para Libras pelo VLibras) e neurodivergentes (perfis para TDAH, dislexia, autismo e ansiedade). A meta é a WCAG 2.2 nível AA, conferida com o axe-core a cada versão. Detalhes na página **Acessibilidade** do site (`#/acessibilidade`).

## O que tem

- **Landing page** (`#/`): apresenta o projeto, a trilha, os certificados e os recursos de
  acessibilidade. Os números (exercícios, lições, módulos) vêm do próprio conteúdo. A trilha fica
  em `#/trilha`, e quem já começou vê "▶ Continuar" no topo.
- **🐍 Python básico** (0.1.0): **10 lições e 40 exercícios** com dificuldade Fácil/Médio/Difícil:
  variáveis e tipos, strings, `input()`, condições, laços, funções, listas, dicionários e exceções.
- **📊 Python para dados** (0.2.0): **10 lições e 40 exercícios**: compreensões, tuplas, conjuntos,
  ordenação com `key`, `Counter` e `defaultdict`, CSV, JSON, datas, geradores, `map`/`filter`/`reduce`
  e `itertools`. Os exercícios com CSV e JSON leem arquivos de verdade, e alguns gravam arquivos que a
  correção confere.
- **⚡ Paralelismo** (0.3.0): **10 lições e 35 exercícios**: dividir o trabalho, partições por hash e por
  intervalo, map-reduce, `Pool`, `ProcessPoolExecutor`, `Process` e `Queue`, `asyncio`, condições de
  corrida, `Lock` e `Semaphore`, GIL, speedup e Lei de Amdahl. Os processos rodam de verdade, ao mesmo
  tempo, nos núcleos do computador.
- **✨ PySpark** (0.4.0): **14 lições e 45 exercícios**: SparkSession e avaliação preguiçosa, RDD
  (`map`, `reduceByKey`, `glom`, `mapPartitions`), DataFrame, funções de coluna, UDF, nulos,
  agregações e `pivot`, joins e broadcast, funções de janela, leitura e escrita (CSV, JSON, schema
  DDL), Spark SQL, partições, shuffle, skew, cache e `explain()`. As partições rodam em paralelo nos
  workers do navegador, e a aba **⚡ Execução** mostra os jobs, os estágios e as tarefas.
- **🌊 Spark além do batch** (0.5.0): **12 lições e 36 exercícios**: Delta Lake (tabela com versões,
  histórico, time travel, merge, update, delete, schema, vacuum e optimize), Structured Streaming
  (micro-lotes, fontes e saídas, modos, estado, janelas e marca d'água, num relógio simulado) e MLlib
  (features, pipelines, regressão linear e logística, árvore de decisão, KMeans e avaliação).
  Certificado: Streaming, Machine Learning e Delta Lake com Spark (20 h).
- **🏗️ Projetos** (0.6.0 a 1.0.0): **18 projetos de 5 etapas** (90 etapas), pipelines de dados de ponta a ponta com
  PySpark, em que cada etapa continua do código da anterior. DataFrame e SQL: contagem de palavras em livros de cordel,
  vendas por região, análise de logs, funil de e-commerce, painel de indicadores e notas de exame. Spark avançado:
  mobilidade urbana, saúde pública, agronegócio, energia solar, hashtags e seguidores, e logística. Além do batch:
  sensores do sertão e streaming de música (Structured Streaming), ETL bronze → prata → ouro e qualidade de dados com
  SCD tipo 2 (Delta Lake), recomendação e detecção de fraude (MLlib).
- **🎓 Certificado final**: "Engenharia de dados com Python e Spark: trilha completa" (155 h), com todos os módulos e
  os 18 projetos concluídos; no fim da cadeia de certificados, com o badge ★.
- **Como no LeetCode**: **▶ Executar** roda os casos visíveis; **⬆ Enviar** roda todos, inclusive os
  **casos ocultos**, que usam outros valores, então resposta fixa no código não passa.
- **Tela do exercício**: descrição, editor e **🖥️ Terminal**, um terminal de verdade: o `print` aparece
  na hora, o programa para no `input()` e a pessoa digita a resposta ali, na mesma linha da pergunta.
  Depois, o prompt `aluno@sertao:~/<exercício>$` aceita `python main.py [argumentos]` (vão para
  `sys.argv`), `python` (o modo interativo `>>>`, com `...` nos blocos), `python -i main.py`, `ls`,
  `cat`, `clear` e `help`. Teclas: ↑/↓ histórico (salvo, até 100), Tab completa, Ctrl+C interrompe (o
  worker é recriado), Ctrl+D é o fim da entrada, Ctrl+L limpa, Esc sai do terminal. O relógio de 10 s
  para enquanto o programa espera a digitação. **▶ Executar** roda os casos visíveis e depois
  `python main.py` no terminal. Sem JSPI no navegador, o programa roda de novo a cada resposta (o
  terminal avisa).
- **Casos de teste detalhados** (aba 🧪 Testes): cada caso mostra o **cenário** como uma sessão de
  terminal (`$ python main.py`, as entradas `> …` e as chamadas `>>> area(3, 4)`), o placar, cada
  verificação com a **categoria** (Saída, Função, Variável, Execução, Código), o que o programa fez de
  fato (**obtido**) e, quando falha, o **motivo** e uma **💡 dica**.
- **📦 Aba Dados**: os arquivos de entrada do exercício (CSV vira tabela acessível, com legenda e
  cabeçalho; JSON e texto, em bloco). O aluno lê, mas não edita; nos casos ocultos, os arquivos têm
  outros dados.
- **Editor** CodeMirror com Python, recuo de 4 espaços, abas de arquivos (`import` entre eles) e atalhos
  (Ctrl+Enter executa, Ctrl+Shift+Enter envia, Ctrl+] recua).
- **Proteção contra laço infinito**: o Python roda num Web Worker, e o motor o reinicia depois de 10 s.
  O tempo de abrir o pool de workers não conta (com um teto de 60 s).
- **👨‍🏫 Quem é o instrutor?** (`#/instrutor`), **☕ Apoie o projeto** (`#/apoie`, PIX) e
  **❓ Tutorial** passo a passo, como nos outros sites Diverge.
- **♿ Acessibilidade e 🧠 neurodiversidade**: temas Dracula, Alto contraste, Claro e Suave; texto até
  175%; fonte Atkinson Hyperlegible; perfis 🎯 Foco, 📖 Leitura facilitada, 🌿 Calmo e 🤝 Sem pressão;
  lista de tarefas, régua de leitura, lembrete de pausa; **🔊 Ouvir**; avisos falados para leitores de
  tela; Libras pelo VLibras.
- **Instruções com estrutura previsível**: roteiro curto, 🎯 O que fazer, 📚 Palavras técnicas (com
  analogia e exemplo, de `src/conteudo/glossario.js`), ✅ Como saber que deu certo e 💡 Dica.
- **Playground livre** (`#/livre`) com o código salvo no navegador, e um
  `vendas.csv` de exemplo na aba 📦 Dados.
- **Compartilhar**: link com o código embutido. Nada é enviado a servidor.

### Paralelismo

O aluno escreve `from multiprocessing import Pool` ou `from concurrent.futures import ProcessPoolExecutor`
como no Python de verdade. Durante a execução, o pacote `python/diverge_paralelo` troca esses módulos
pelos dele (`Pool` com `map`, `starmap`, `imap`, `apply_async`; `Process`, `Queue`, `cpu_count`;
`ProcessPoolExecutor`, `Future` e `as_completed`), e os devolve no fim.

- **Como roda**: cada tarefa (função e argumentos) é serializada com o
  [cloudpickle](https://github.com/cloudpipe/cloudpickle) e vai para um worker do pool
  (`src/python/pool.js`, até 4 workers, ou núcleos − 1, abertos sob demanda e fechados depois de 60 s
  ociosos). O Python do aluno espera com `pyodide.ffi.run_sync`, que depende do **JSPI** (JavaScript
  Promise Integration) do navegador. O `print` da função chega ao terminal, e o erro dela sobe no
  processo principal com o mesmo tipo. Funções de outros arquivos do aluno também viajam (vão por valor).
- **Regra do Python real**: sem `if __name__ == "__main__":`, criar o `Pool`, iniciar um `Process` ou
  enviar ao executor dá o mesmo `RuntimeError` do Python (início spawn).
- **Sem JSPI** (ou com 1 worker só), as tarefas rodam em sequência, com o mesmo resultado; o terminal e
  o leitor de tela avisam. A barra de status mostra "⚡ N tarefas em W workers".

### PySpark

O aluno escreve `from pyspark.sql import SparkSession` como no Spark de verdade. O pacote
[`python/pyspark`](python/pyspark) é **uma implementação para aprender**, em Python puro, com a API do
PySpark 4: não é o Spark, mas os resultados, o `show()`, o `printSchema()`, o `explain()` e as mensagens
de erro seguem o Spark.

- **API coberta**: `SparkSession` (`builder`, `conf`, `range`, `createDataFrame`, `read`, `sql`,
  `catalog`), RDD (`parallelize`, `textFile`, transformações e ações, pares chave-valor, `join`,
  `glom`, `mapPartitions`, `repartition`/`coalesce`, `cache`), DataFrame (`select`, `filter`,
  `withColumn`, `groupBy`/`agg`/`pivot`, joins com `broadcast`, `Window`, `na`, `orderBy`, `explain`,
  `write` em CSV, JSON e um parquet simplificado), `functions` (texto, números, datas, nulos, coleções,
  janelas, `udf`) e Spark SQL (`SELECT`, `JOIN`, `GROUP BY`/`HAVING`, `ORDER BY`, `OVER`, CTEs e
  subconsultas).
- **Como roda**: cada partição vira uma tarefa no pool de workers (o mesmo do paralelismo); os
  shuffles separam os estágios, com `hashpartitioning` determinístico. O Spark de verdade usa 200
  partições de shuffle; aqui são 4, para caber no navegador. A aba **⚡ Execução** mostra cada job, os
  estágios (os que reaproveitam um shuffle aparecem como pulados, como no Spark UI) e a linha do tempo
  das tarefas, com uma tabela equivalente para o leitor de tela.
- **Conformidade**: [`python/conformidade`](python/conformidade) tem 10 programas que rodam no
  PySpark 4.0.1 de verdade no CI (job `conformidade`, Java 17); a saída tem de bater com a nossa, e o
  build só sai depois.
- **Fica para a fase 5**: Structured Streaming, MLlib e Delta Lake (módulo 🌊 Spark além do batch).
- **asyncio** roda de verdade (`gather`, `create_task`, `Lock`, `Semaphore`, `Queue`, `wait_for`): a
  condição de corrida perde atualizações de fato. **Threads** dão o erro do próprio Pyodide (`can't start
  new thread`) e entram como conceito. `Value`/`Array` (memória compartilhada) precisam de
  SharedArrayBuffer, que o GitHub Pages não libera: levantam `NotImplementedError` com a explicação.
- Conferido no Chromium do app Claude (8 núcleos): 4 workers, 6 tarefas de 0,5 s em 1,03 s (3 s em
  sequência). No Node 24, os testes ligam o JSPI com `--experimental-wasm-jspi` (`vitest.config.js`)
  e usam workers de verdade (`worker_threads`, `tests/pool-node.js`).
- A primeira tarefa abre os workers (cada um carrega o seu Pyodide, alguns segundos); a barra de
  status avisa, e esse tempo não conta no limite de 10 s.

### Trilha gamificada e certificados

- A trilha (`#/trilha`) é um **caminho** em zigue-zague. Cada item vale **XP**: lição 5, fácil 10, médio 20 e difícil 40.
  O aluno sobe de **nível** (Iniciante → Aprendiz → Pythonista → Analista de dados → Engenheiro de dados →
  Arquiteto de dados → Mestre do Spark) e ganha uma **sequência de dias** 🔥.
- O próximo módulo **desbloqueia quando o atual chega a 70%**.
- Ao concluir 100% de um módulo, o 🏆 libera o **certificado do módulo**, emitido pela
  **Sertão será cloud** e assinado por **Cláudio Raposo**. O certificado final (trilha completa) chega
  com o último módulo.
- Cada certificado tem um **badge digital no estilo Credly**, página própria, PDF (A4 paisagem),
  **Publicar no LinkedIn** e **Adicionar ao perfil**.
- **Carga horária**: lição 10 min, fácil 15, médio 30, difícil 45; o certificado do módulo vale a soma,
  arredondada para cima em horas (Fundamentos de Python: 19 horas; Python para Dados: 20 horas;
  Paralelismo em Python: 19 horas). A regra fica em `src/cargaHoraria.js`
  e `tests/carga-horaria.test.js` avisa quando o conteúdo mudar.
- **Selo de verificação** (HMAC-SHA256), **cadeia de certificados** (cada um inclui o hash do anterior,
  como num blockchain), **🔎 Validador** (`#/validar`: link, código, impresso ou XML), **📄 XML do
  certificado** e **✍️ assinatura Ed25519** com a chave pública em
  [`chave-publica-ed25519.txt`](https://sertaoseracloud.github.io/python-playground/chave-publica-ed25519.txt).
  Namespace do XML: `https://sertaoseracloud.github.io/python-playground/certificado/v1`.
- **↩️ Restaurar o progresso pelo certificado**: ao validar um certificado válido pelo link ou código,
  quem tem neste navegador o **mesmo nome** do certificado (acentos e maiúsculas contam) restaura o
  módulo e os anteriores da cadeia, nas datas do certificado. O certificado emitido de novo é o mesmo;
  nada do que já está no navegador é apagado (`src/restaurar.js`).
- **🗺️ Cenários da trilha**: cada módulo tem um mapa em tiles de pixel art (como nos RPGs clássicos) que ocupa a
  tela toda e rola junto com a página, com uma estrada que faz curvas pelos exercícios e uma vila que cresce a
  cada exercício resolvido (casas, filhos e filhotes, calculados do progresso, sem nada a mais no navegador), com
  personagens andando de tile em tile, sem pisar na água nem no
  caminho (`src/ui/cenarios/`). É só decoração: o leitor de tela não lê, e os personagens param com "reduzir
  movimento" e no alto contraste.

### Certificados: a palavra secreta

**A palavra secreta nunca entra no código nem no site.** Ela fica no secret `CERTIFICADO_SEGREDO` do
GitHub Actions; o build injeta só um SHA-256 derivado dela (`vite.config.js`) e falha se o secret não
existir. Para gerar o build localmente: `CERTIFICADO_SEGREDO='...' npm run build`. Trocar a palavra
invalida os selos já emitidos.

**Limite:** sem servidor, a chave derivada vai no JavaScript do site. O selo pega alterações no link,
mas quem estudar o código publicado consegue gerar selos. Para impedir isso de verdade seria preciso um
servidor assinando os certificados.

#### Como a prévia do LinkedIn funciona

O robô do LinkedIn não roda JavaScript nem lê o que vem depois do `#`. Por isso cada badge tem uma
página estática em `public/badge/<módulo>/` com as meta tags `og:` apontando para a imagem do badge
(`public/badges/<módulo>-card.png`, 1200×627). Depois de mudar `src/badges.js` ou `src/certificados.js`, rode
`npm run badges` e faça commit de `public/`. O teste `tests/badges.test.js` falha se faltar algum arquivo.

### SEO

O build roda `scripts/prerender.mjs` depois do Vite: escreve no `<head>` o título, a descrição, o
endereço canônico, Open Graph, Twitter e os dados estruturados (Organization, WebSite e Course), tudo de
[`src/seo.js`](src/seo.js), deixa a landing já em HTML e gera o `sitemap.xml`. Capa (`og-capa.png`),
ícones e `manifest.webmanifest` saem de `npm run badges`.

### Privacidade, cookies e LGPD

- **Sem cookies e sem rastreamento**: não há analytics, anúncios nem servidor próprio.
- **Dados só no navegador** (`localStorage`, prefixo `python-playground:`): progresso, datas, dias de
  estudo, nome do certificado, código, histórico de comandos do terminal, tarefas marcadas e preferências.
  A tabela fica em [`src/privacidade.js`](src/privacidade.js), e um teste falha se o código gravar uma
  chave que não está documentada.
- **O Pyodide é servido pelo próprio site** (`/pyodide/`), sem CDN de terceiros.
- **Terceiros**: GitHub Pages (hospedagem), GitHub (logo do certificado), LinkedIn (só ao clicar),
  VLibras (só se ligado) e a voz do navegador (🔊 Ouvir).
- **LGPD**: direitos do art. 18 com **📥 Baixar meus dados** e **🗑️ Apagar meus dados**. O texto é
  informativo e vale uma revisão jurídica antes de uso institucional.

### Links diretos para a aula

- Landing: `https://sertaoseracloud.github.io/python-playground/`
- Trilha: `.../python-playground/#/trilha`
- Um exercício: `.../python-playground/#/p/py-fizzbuzz`
- Playground livre: `.../python-playground/#/livre`
- Validar certificado: `.../python-playground/#/validar`

## Como adicionar conteúdo

Cada módulo fica em [`src/conteudo/`](src/conteudo/) (`basico.js` com `basico-colecoes.js`, `dados.js` com
`dados-arquivos.js`), com uma lista `itens` de lições (`{ id, tipo: 'licao', titulo, resumo, arquivos, entrada?, dados? }`)
e problemas (`{ id, tipo: 'problema', titulo, dificuldade, enunciado, dica, arquivos, solucao, testes, dados? }`).
`dados` são os arquivos de entrada (`{ "vendas.csv": "..." }`), mostrados na aba 📦 Dados. O código
fica no template `py` de `util.js`, que tira a indentação comum.

Cada teste tem `entrada` (as linhas do `input()`), `regras`, pode ser `oculto: true` e pode trazer `dados`
que trocam os arquivos do exercício (os casos ocultos usam outros dados). As regras ficam em
[`src/verificacoes.js`](src/verificacoes.js):

| Regra | Confere |
| --- | --- |
| `{ saida }` / `{ saidaIgual }` | a saída contém o texto / é exatamente igual |
| `{ funcao, args, igual }` (`aprox`) | chama a função e compara o retorno |
| `{ funcao, args, erro }` | a chamada levanta essa exceção |
| `{ variavel, igual }` | o valor final de uma variável |
| `{ erro }` / `{ semErros }` | o programa termina com essa exceção / sem exceção |
| `{ codigo }` / `{ semCodigo }` | regex no código do aluno (ex.: proibir `sum(`) |
| `{ paralelo: { workers, tarefas } }` | quantos workers trabalharam e em quantas tarefas o trabalho foi dividido (nunca o tempo); não cobra paralelismo onde o navegador não consegue |
| `{ arquivo, igual }` / `{ arquivo, json }` | o arquivo que o programa gravou: o texto (sem diferenciar `\r\n`) ou os dados do JSON |
| `{ dataframe, colunas, tipos, linhas, ordem, aprox, total }` | o DataFrame no fim do programa: colunas, tipos e linhas (em qualquer ordem, a não ser com `ordem: true`) |
| `{ plano, shuffles, broadcast, cache, particoes, estagios }` | o plano físico do DataFrame (o que o `explain()` mostra) |

`tests/conteudo.test.js` roda **toda a trilha** no Python de verdade: as lições rodam sem erro, cada
solução passa em todos os casos e cada código inicial ainda não passa.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local com recarga
npm run lint     # ESLint
npm test         # testes do site e de toda a trilha (Pyodide no Node 24, com JSPI)
python -m pytest # testes do runtime e do paralelismo (python/diverge_runtime e diverge_paralelo) no CPython
npm run build    # gera dist/ (precisa de CERTIFICADO_SEGREDO)
npm run badges   # regenera badges, capa e ícones em public/
```

A cada push na `main`, o GitHub Actions ([`.github/workflows/pages.yml`](.github/workflows/pages.yml))
roda o lint, o pytest e os testes, faz o build e publica no GitHub Pages.

## Como funciona

```
Editor (CodeMirror) ──arquivos + entrada──▶ Web Worker: Python 3.14 (Pyodide)
        ▲                                    │ grava os arquivos, roda main.py,
        │                                    │ chama as funções dos testes
 🖥️ Terminal ◀── saída, traceback ◀──────────┤
 🧪 Testes   ◀── regras de verificação ◀─────┘
                                             │ pool.mapear(...)  (run_sync + JSPI)
                                             ▼
                              Pool de Web Workers, um Pyodide em cada (cloudpickle)
```

O runtime Python (`python/diverge_runtime`) é montado no sistema de arquivos do Pyodide em `/lib/diverge`.

## Licença

O DivergePython é **software livre com copyleft**:

- **Código**: [GNU AGPL-3.0-or-later](LICENSE). Pode usar, estudar, modificar e distribuir; quem
  distribuir ou **oferecer pela internet** uma versão modificada precisa publicar o código dela sob a
  mesma licença. Componentes de terceiros: Pyodide (MPL-2.0) e cloudpickle (BSD-3-Clause, em
  `python/vendor/cloudpickle`).
- **Conteúdo didático** (lições, exercícios, projetos, glossário): [CC BY-SA 4.0](LICENSE-CONTEUDO.md).
  Crédito sugerido: "DivergePython, Sertão será cloud (CC BY-SA 4.0)".
- **Fora da licença**: o nome, a marca e o logotipo da Sertão será cloud e a emissão de certificados
  em nome dela.

No site: [Licença](https://sertaoseracloud.github.io/python-playground/#/licenca) e
[Termos de uso](https://sertaoseracloud.github.io/python-playground/#/termos). A lista de componentes de
terceiros fica em `src/licenca.js`, e um teste confere a licença de cada dependência.

Copyright (C) 2026 Sertão será cloud.
