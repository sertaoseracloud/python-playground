# Fase 6, plano 3: 🏗️ Projetos além do batch e o certificado final (1.0.0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o módulo 🏗️ Projetos com os 6 projetos além do batch (streaming, Delta e MLlib) e emitir o certificado final da trilha completa, na versão 1.0.0.

**Architecture:** Os projetos seguem o modelo `criarProjeto` (`src/conteudo/projetos/base.js`), um arquivo por projeto, registrados em `PROJETOS`. Não há peça nova no motor: streaming, Delta e MLlib já existem (fase 5). O certificado final entra em `CERTIFICADOS` (`src/certificados.js`) no fim da cadeia; as telas já sabem mostrá-lo (diploma na trilha, badge ★, documento). A restauração pelo certificado final passa a devolver também o módulo de projetos, que não tem certificado próprio.

**Tech Stack:** JavaScript (ES modules), vitest, eslint; Python 3.14 (Pyodide no site, CPython nos testes); o `pyspark` e o `delta` próprios.

**Spec:** `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md` (seções 1 "1.0.0", 2, 3, 4, 5, 6 e 7). Planos anteriores: `2026-10-15-fase6-plano1-dataframe-sql.md` e `2026-10-16-fase6-plano2-spark-avancado.md`.

## Global Constraints

- 6 projetos novos, nesta ordem, depois dos 12 já publicados: `sensores` 🌡️, `musica` 🎵, `etl` 🥉🥈🥇, `qualidade` 🧹, `recomendacao` 🎯, `fraude` 🕵️.
- Cada projeto: a lição `<id>-visao-geral` e as etapas `<id>-1` a `<id>-5`, com as dificuldades **fácil, médio, médio, difícil, difícil**.
- O caso oculto troca só arquivos que o visível tem, com os mesmos nomes (no streaming, o mesmo número de lotes).
- Streaming: a linha atrasada é descartada quando o fim da janela dela não passa da marca d'água **de dois lotes antes** (a que o Spark 3.5+ usa para os atrasados; conferido no CI na fase 5).
- Certificado final: título **"Engenharia de dados com Python e Spark: trilha completa"**, resumo **"concluiu a trilha completa: os 5 módulos, 196 problemas práticos e 18 projetos (90 etapas)"**, carga = soma das cargas dos 5 certificados de módulo (102 h) + as horas do módulo de projetos (53 h) = **155 h**. Só sai com todos os módulos, inclusive os projetos.
- Versão **1.0.0**. Publicar (push, PR, merge) só com o "sim" do usuário.
- Commits como `Cláudio Raposo <engcfraposo@gmail.com>` (via `git -c user.name=... -c user.email=...`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O valor de `CERTIFICADO_SEGREDO` nunca aparece no código nem no site; o build local usa um valor aleatório: `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.
- Neste Windows o `rtk` esconde saídas: use `rtk proxy <comando>`. Código JS com barra invertida vai pelo Edit/Write. Os blocos deste plano saem com `python /tmp/scr/blocos8.py <índice> <destino>` (cópia do `blocos6.py` apontando para este plano).

## Review Focus

1. **Restaurar pelo certificado final num navegador vazio**: voltam os 5 módulos **e** os projetos, e o certificado final reemitido sai com o mesmo código. Teste na Task 7.
2. **Certificado final antes da hora** (todos os módulos prontos, menos um projeto): o diploma fica desabilitado. Coberto pelo `calcularJornada` (o final exige todos os módulos concluídos); teste na Task 7.
3. **Streaming com a linha atrasada que não é descartada** (atrasada, mas dentro da marca d'água de dois lotes antes): os dados escolhem um atraso que é descartado nos dois casos (07:52 e 12:45). Coberto pelas regras `descartadas: 1` da Task 1.
4. **SCD tipo 2 com cliente que não mudou**: o merge não mexe nele (a condição do `whenMatchedUpdate` é falsa). Coberto pelo Davi (visível) e pelo Gil (oculto) na Task 4.
5. **Grupos do KMeans com números trocados** (0 e 1 dependem da inicialização): a correção usa o perfil ("ação"/"drama") tirado dos centros, nunca o número. Coberto pela regra de `membros` na Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/conteudo/projetos/sensores.js`, `musica.js`, `etl.js`, `qualidade.js`, `recomendacao.js`, `fraude.js` (novos) | Um projeto cada. |
| `src/conteudo/projetos/index.js`, `tests/projetos.test.js` | Os 18 projetos e a lista `IDS`; a descrição final do módulo. |
| `src/certificados.js` | `CERTIFICADOS.final`. |
| `src/restaurar.js`, `tests/restaurar.test.js` | O certificado final devolve também os projetos. |
| `tests/carga-horaria.test.js`, `tests/certificados.test.js` | A carga do final e os números do resumo. |
| `src/conteudo/glossario.js`, `tests/glossario.test.js` | Medalhão e SCD tipo 2. |
| `src/ui/validador.js`, `src/ui/declaracao-acessibilidade.js` | Citam o certificado final. |
| Documentação | README, novidades 1.0.0, spec, `package.json`, badges e capa. |

---

Em cada uma das Tasks 1 a 6, os passos são os mesmos (só mudam o arquivo, o nome e o filtro):

1. **Test first:** acrescente o id no fim de `IDS` em `tests/projetos.test.js` (`python /tmp/scr/proj.py ids <id>`).
2. **Run, expect fail:** `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt` → `2 failed`.
3. **Implement:** grave o bloco do projeto em `src/conteudo/projetos/<arquivo>.js` e registre-o (`python /tmp/scr/proj.py registra <arquivo> <Nome>`).
4. **Run, expect pass:** `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "<filtro>|vem por último" --reporter=verbose > $TEMP/v.txt 2>&1; grep -E "Tests |×|faltou|sobrou|esperad" $TEMP/v.txt | head -20` → só verdes (a visão geral roda; as 5 soluções passam no visível e no oculto; os 5 iniciais falham no visível).
5. **Commit:** `git add src/conteudo/projetos/<arquivo>.js src/conteudo/projetos/index.js tests/projetos.test.js` e `git commit -m "Projetos: <título>"` com o autor e o Co-Authored-By das restrições.

Os 6 arquivos abaixo já rodaram inteiros no corretor de verdade (`tests/conteudo.test.js`), com os dois casos de cada etapa, antes de entrar no plano.

### Task 1: 🌡️ Sensores do sertão

**Files:** Create `src/conteudo/projetos/sensores.js`; Modify `index.js`, `tests/projetos.test.js`. Produces `projetoSensores`. Filtro: `sensores`.

```js
// 🌡️ Sensores do sertão: as estações mandam as leituras em lotes, e o Structured Streaming
// conta, agrupa em janelas, descarta o atrasado com a marca d'água e separa os alertas.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const lote = (...linhas) => `estacao,momento,temperatura\n${linhas.map((l) => `${l}\n`).join('')}`;
const pasta = (lotes) => Object.fromEntries(lotes.map((l, i) => [`leituras/lote-0${i + 1}.csv`, l]));

const LEITURAS = pasta([
  lote('Crato,2026-10-14 08:01:00,30.0', 'Sobral,2026-10-14 08:03:00,33.0', 'Crato,2026-10-14 08:07:00,31.0'),
  lote('Sobral,2026-10-14 08:12:00,36.0', 'Crato,2026-10-14 08:14:00,32.5', 'Juazeiro,2026-10-14 08:16:00,37.0'),
  lote('Crato,2026-10-14 08:22:00,35.5', 'Sobral,2026-10-14 07:52:00,34.0', 'Juazeiro,2026-10-14 08:25:00,38.0'),
]);
const LEITURAS_OCULTO = pasta([
  lote('Iguatu,2026-10-15 13:02:00,34.0', 'Tauá,2026-10-15 13:04:00,36.5'),
  lote('Iguatu,2026-10-15 13:13:00,35.0', 'Tauá,2026-10-15 13:18:00,33.0'),
  lote('Iguatu,2026-10-15 13:24:00,37.5', 'Tauá,2026-10-15 12:45:00,32.0'),
]);

export const projetoSensores = criarProjeto({
  id: 'sensores',
  titulo: 'Sensores do sertão',
  icone: '🌡️',
  descricao: 'As leituras das estações chegando aos poucos: streaming, contagem, janelas, marca d’água e alertas.',
  resumo: `
    <p>As estações meteorológicas do sertão mandam as leituras de temperatura em lotes, na pasta <code>leituras/</code>:
      um arquivo por vez, como se chegassem pela rede. Com o <b>Structured Streaming</b>, o Spark trata a pasta como uma
      tabela sem fim e processa cada arquivo num micro-lote (veja a parte 🌊 Micro-lotes da aba ⚡ Execução).</p>
    <p>Uma leitura do terceiro lote chegou <b>atrasada</b>: ela é de antes das outras.</p>
    <ol>
      <li>a consulta de streaming que só copia as leituras;</li>
      <li>a contagem de leituras por estação;</li>
      <li>a temperatura média em janelas de 10 minutos;</li>
      <li>a marca d'água, que descarta o atrasado;</li>
      <li>os alertas de calor numa tabela de memória, consultada com SQL.</li>
    </ol>`,
  dados: LEITURAS,
  oculto: LEITURAS_OCULTO,
  inicial: py`
    ESQUEMA = "estacao STRING, momento TIMESTAMP, temperatura DOUBLE"

    # Lido de uma vez só (batch), para conhecer os dados:
    spark.read.schema(ESQUEMA).csv("leituras", header=True).orderBy("momento").show()
  `,
  etapas: [
    {
      titulo: 'A consulta de streaming',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie em <code>leituras</code> a leitura em streaming da pasta <code>leituras</code>, com o <code>ESQUEMA</code> e um
          arquivo por micro-lote (<code>maxFilesPerTrigger</code> = 1). Depois, comece a consulta <code>brutas</code>, que só
          copia as leituras para a memória, em modo <code>append</code>, e rode tudo o que está na pasta.</p>`,
      dica: 'spark.readStream.schema(ESQUEMA).option("maxFilesPerTrigger", 1).csv("leituras", header=True); depois .writeStream.format("memory").queryName("brutas").outputMode("append").start() e q.processAllAvailable().',
      codigo: py`
        leituras = (spark.readStream.schema(ESQUEMA)
            .option("maxFilesPerTrigger", 1)
            .csv("leituras", header=True))
        q = leituras.writeStream.format("memory").queryName("brutas").outputMode("append").start()
        q.processAllAvailable()
      `,
      regras: [{ stream: 'brutas', modo: 'append', saidaPorLote: [3, 3, 3] }],
      regrasOcultas: [{ stream: 'brutas', modo: 'append', saidaPorLote: [2, 2, 2] }],
    },
    {
      titulo: 'Leituras por estação',
      dificuldade: 'medio',
      enunciado: `
        <p>Comece a consulta <code>por_estacao</code>, que conta as leituras de cada estação, em modo <code>complete</code>
          (a cada lote, a tabela inteira). No fim, guarde em <code>contagem</code> a tabela da memória
          (<code>spark.table("por_estacao")</code>).</p>`,
      dica: 'leituras.groupBy("estacao").count().writeStream...queryName("por_estacao").outputMode("complete")',
      codigo: py`
        q = (leituras.groupBy("estacao").count()
            .writeStream.format("memory").queryName("por_estacao").outputMode("complete").start())
        q.processAllAvailable()
        contagem = spark.table("por_estacao")
        contagem.show()
      `,
      regras: [
        { stream: 'por_estacao', modo: 'complete', saidaPorLote: [2, 3, 3] },
        { dataframe: 'contagem', colunas: ['estacao', 'count'], linhas: [['Crato', 4], ['Sobral', 3], ['Juazeiro', 2]] },
      ],
      regrasOcultas: [
        { stream: 'por_estacao', modo: 'complete', saidaPorLote: [2, 2, 2] },
        { dataframe: 'contagem', colunas: ['estacao', 'count'], linhas: [['Tauá', 3], ['Iguatu', 3]] },
      ],
    },
    {
      titulo: 'Janelas de 10 minutos',
      dificuldade: 'medio',
      enunciado: `
        <p>Comece a consulta <code>janelas</code>, com a temperatura média (<code>media</code>, em 1 casa) de cada janela de
          10 minutos, em modo <code>update</code>: cada lote emite só as janelas que mudaram.</p>`,
      dica: 'leituras.groupBy(F.window("momento", "10 minutes")).agg(F.round(F.avg("temperatura"), 1).alias("media"))',
      codigo: py`
        media = F.round(F.avg("temperatura"), 1).alias("media")
        q = (leituras.groupBy(F.window("momento", "10 minutes")).agg(media)
            .writeStream.format("memory").queryName("janelas").outputMode("update").start())
        q.processAllAvailable()
      `,
      regras: [{ stream: 'janelas', modo: 'update', saidaPorLote: [1, 1, 2] }],
      regrasOcultas: [{ stream: 'janelas', modo: 'update', saidaPorLote: [1, 1, 2] }],
    },
    {
      titulo: "A marca d'água",
      dificuldade: 'dificil',
      enunciado: `
        <p>Uma leitura do último lote é de muito antes. Comece a consulta <code>com_marca</code>, igual à
          <code>janelas</code>, mas aceitando até 5 minutos de atraso: o que chegar depois disso é descartado.</p>`,
      dica: 'leituras.withWatermark("momento", "5 minutes") antes do groupBy.',
      codigo: py`
        q = (leituras.withWatermark("momento", "5 minutes")
            .groupBy(F.window("momento", "10 minutes")).agg(media)
            .writeStream.format("memory").queryName("com_marca").outputMode("update").start())
        q.processAllAvailable()
      `,
      regras: [{ stream: 'com_marca', modo: 'update', saidaPorLote: [1, 1, 1, 0], descartadas: 1, marcaDagua: '2026-10-14T08:20' }],
      regrasOcultas: [{ stream: 'com_marca', modo: 'update', saidaPorLote: [1, 1, 1, 0], descartadas: 1, marcaDagua: '2026-10-15T13:19' }],
    },
    {
      titulo: 'Os alertas de calor',
      dificuldade: 'dificil',
      enunciado: `
        <p>Comece a consulta <code>alertas</code>, que guarda na memória, em <code>append</code>, só as leituras de 35 graus
          ou mais. No fim, guarde em <code>resumo</code>, com SQL sobre a tabela <code>alertas</code>, a temperatura máxima
          (<code>maxima</code>) e o número de alertas (<code>vezes</code>) de cada estação.</p>`,
      dica: 'leituras.filter(F.col("temperatura") >= 35); depois spark.sql("SELECT estacao, MAX(temperatura) AS maxima, COUNT(*) AS vezes FROM alertas GROUP BY estacao").',
      codigo: py`
        q = (leituras.filter(F.col("temperatura") >= 35)
            .writeStream.format("memory").queryName("alertas").outputMode("append").start())
        q.processAllAvailable()
        resumo = spark.sql("SELECT estacao, MAX(temperatura) AS maxima, COUNT(*) AS vezes FROM alertas GROUP BY estacao")
        resumo.show()
      `,
      regras: [
        { stream: 'alertas', modo: 'append', saidaPorLote: [0, 2, 2] },
        { dataframe: 'resumo', colunas: ['estacao', 'maxima', 'vezes'], linhas: [['Crato', 35.5, 1], ['Sobral', 36.0, 1], ['Juazeiro', 38.0, 2]] },
      ],
      regrasOcultas: [
        { stream: 'alertas', modo: 'append', saidaPorLote: [1, 1, 1] },
        { dataframe: 'resumo', colunas: ['estacao', 'maxima', 'vezes'], linhas: [['Tauá', 36.5, 1], ['Iguatu', 37.5, 2]] },
      ],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra sensores projetoSensores`.

### Task 2: 🎵 Streaming de música

**Files:** Create `src/conteudo/projetos/musica.js`; Modify `index.js`, `tests/projetos.test.js`. Produces `projetoMusica`. Filtro: `musica`.

```js
// 🎵 Streaming de música: as execuções (plays) chegam em lotes de JSON. Contagem por música, o
// top de cada semana (janela de 7 dias), o modo update e o top numa tabela de memória.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const play = (usuario, musica, momento) => JSON.stringify({ usuario, musica, momento: `2026-10-${momento}:00` });
const lote = (...plays) => plays.map((p) => `${p}\n`).join('');
const pasta = (lotes) => Object.fromEntries(lotes.map((l, i) => [`plays/lote-0${i + 1}.json`, l]));

const PLAYS = pasta([
  lote(play('ana', 'Asa Branca', '02 10:00'), play('bia', 'Asa Branca', '03 11:00'), play('caio', 'Xote das Meninas', '03 12:00')),
  lote(play('ana', 'Xote das Meninas', '05 09:00'), play('davi', 'Asa Branca', '06 18:00'), play('bia', 'Pagode Russo', '08 20:00')),
  lote(play('caio', 'Pagode Russo', '09 08:00'), play('ana', 'Pagode Russo', '10 10:00'), play('davi', 'Xote das Meninas', '11 15:00'), play('bia', 'Pagode Russo', '12 21:00')),
]);
const PLAYS_OCULTO = pasta([
  lote(play('eva', 'Baião', '01 09:00'), play('fia', 'Baião', '02 10:00')),
  lote(play('gil', 'Forró no Escuro', '04 16:00'), play('eva', 'Baião', '08 07:00')),
  lote(play('fia', 'Forró no Escuro', '09 19:00'), play('gil', 'Forró no Escuro', '10 20:00'), play('eva', 'Forró no Escuro', '13 22:00')),
]);

export const projetoMusica = criarProjeto({
  id: 'musica',
  titulo: 'Streaming de música',
  icone: '🎵',
  descricao: 'As músicas tocadas chegando em lotes de JSON: contagem, top da semana, modo update e o top em SQL.',
  resumo: `
    <p>Um aplicativo de música manda, de tempos em tempos, um arquivo JSON com as músicas tocadas (os <b>plays</b>): quem
      ouviu, qual música e quando. Os arquivos chegam na pasta <code>plays/</code>, um por micro-lote.</p>
    <p>O <b>modo de saída</b> diz o que cada lote entrega: <code>append</code> só as linhas novas, <code>complete</code> a
      tabela inteira, e <code>update</code> só as linhas que mudaram.</p>
    <ol>
      <li>ler o stream de JSON;</li>
      <li>os plays de cada música;</li>
      <li>o top de cada semana, numa janela de 7 dias;</li>
      <li>o modo update, que manda só o que mudou;</li>
      <li>o top numa tabela de memória, com SQL.</li>
    </ol>`,
  dados: PLAYS,
  oculto: PLAYS_OCULTO,
  inicial: py`
    ESQUEMA = "usuario STRING, musica STRING, momento TIMESTAMP"

    spark.read.schema(ESQUEMA).json("plays").orderBy("momento").show()
  `,
  etapas: [
    {
      titulo: 'Ler o stream',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie em <code>plays</code> a leitura em streaming dos JSON da pasta <code>plays</code>, com o <code>ESQUEMA</code> e
          um arquivo por micro-lote. Comece a consulta <code>todos</code>, que copia os plays para a memória em
          <code>append</code>, e rode tudo o que está na pasta.</p>`,
      dica: 'spark.readStream.schema(ESQUEMA).option("maxFilesPerTrigger", 1).json("plays")',
      codigo: py`
        plays = spark.readStream.schema(ESQUEMA).option("maxFilesPerTrigger", 1).json("plays")
        q = plays.writeStream.format("memory").queryName("todos").outputMode("append").start()
        q.processAllAvailable()
      `,
      regras: [{ stream: 'todos', modo: 'append', saidaPorLote: [3, 3, 4] }],
      regrasOcultas: [{ stream: 'todos', modo: 'append', saidaPorLote: [2, 2, 3] }],
    },
    {
      titulo: 'Plays por música',
      dificuldade: 'medio',
      enunciado: `
        <p>Comece a consulta <code>por_musica</code>, que conta os plays de cada música em modo <code>complete</code>. No fim,
          guarde em <code>ranking</code> a tabela da memória.</p>`,
      dica: 'plays.groupBy("musica").count(), com outputMode("complete"); ranking = spark.table("por_musica").',
      codigo: py`
        q = (plays.groupBy("musica").count()
            .writeStream.format("memory").queryName("por_musica").outputMode("complete").start())
        q.processAllAvailable()
        ranking = spark.table("por_musica")
        ranking.show()
      `,
      regras: [
        { stream: 'por_musica', modo: 'complete', saidaPorLote: [2, 3, 3] },
        { dataframe: 'ranking', colunas: ['musica', 'count'], linhas: [['Asa Branca', 3], ['Xote das Meninas', 3], ['Pagode Russo', 4]] },
      ],
      regrasOcultas: [
        { stream: 'por_musica', modo: 'complete', saidaPorLote: [1, 2, 2] },
        { dataframe: 'ranking', colunas: ['musica', 'count'], linhas: [['Baião', 3], ['Forró no Escuro', 4]] },
      ],
    },
    {
      titulo: 'O top de cada semana',
      dificuldade: 'medio',
      enunciado: `
        <p>Comece a consulta <code>semanas</code>, que conta os plays de cada música em janelas de 7 dias, em
          <code>complete</code>. No fim, guarde em <code>por_semana</code> as colunas <code>semana</code> (o começo da janela,
          como texto), <code>musica</code> e <code>count</code>.</p>`,
      dica: 'groupBy(F.window("momento", "7 days"), "musica").count(); depois spark.table("semanas").select(F.col("window.start").cast("string").alias("semana"), "musica", "count").',
      codigo: py`
        q = (plays.groupBy(F.window("momento", "7 days"), "musica").count()
            .writeStream.format("memory").queryName("semanas").outputMode("complete").start())
        q.processAllAvailable()
        por_semana = spark.table("semanas").select(
            F.col("window.start").cast("string").alias("semana"), "musica", "count")
        por_semana.orderBy("semana", F.desc("count")).show()
      `,
      regras: [
        { stream: 'semanas', modo: 'complete', saidaPorLote: [2, 3, 4] },
        {
          dataframe: 'por_semana',
          colunas: ['semana', 'musica', 'count'],
          linhas: [['2026-10-01 00:00:00', 'Asa Branca', 3], ['2026-10-01 00:00:00', 'Xote das Meninas', 2], ['2026-10-08 00:00:00', 'Pagode Russo', 4], ['2026-10-08 00:00:00', 'Xote das Meninas', 1]],
        },
      ],
      regrasOcultas: [
        { stream: 'semanas', modo: 'complete', saidaPorLote: [1, 3, 4] },
        {
          dataframe: 'por_semana',
          colunas: ['semana', 'musica', 'count'],
          linhas: [['2026-10-01 00:00:00', 'Baião', 2], ['2026-10-01 00:00:00', 'Forró no Escuro', 1], ['2026-10-08 00:00:00', 'Baião', 1], ['2026-10-08 00:00:00', 'Forró no Escuro', 3]],
        },
      ],
    },
    {
      titulo: 'Só o que mudou',
      dificuldade: 'dificil',
      enunciado: `
        <p>O <code>complete</code> manda a tabela inteira a cada lote, mesmo o que não mudou. Comece a consulta
          <code>mudancas</code>, com a mesma contagem por música, em modo <code>update</code>: cada lote manda só as músicas
          que tocaram nele. Compare as saídas dos lotes na aba ⚡ Execução.</p>`,
      dica: 'A mesma agregação de por_musica, com outputMode("update").',
      codigo: py`
        q = (plays.groupBy("musica").count()
            .writeStream.format("memory").queryName("mudancas").outputMode("update").start())
        q.processAllAvailable()
      `,
      regras: [{ stream: 'mudancas', modo: 'update', saidaPorLote: [2, 3, 2] }],
      regrasOcultas: [{ stream: 'mudancas', modo: 'update', saidaPorLote: [1, 2, 1] }],
    },
    {
      titulo: 'O top numa tabela de memória',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>top</code>, com SQL sobre a tabela <code>por_musica</code>, as 2 músicas mais tocadas, com as
          colunas <code>musica</code> e <code>plays</code>, da mais tocada para a menos e, no empate, em ordem de nome.</p>`,
      dica: 'spark.sql("SELECT musica, count AS plays FROM por_musica ORDER BY count DESC, musica LIMIT 2")',
      codigo: py`
        top = spark.sql("SELECT musica, count AS plays FROM por_musica ORDER BY count DESC, musica LIMIT 2")
        top.show()
      `,
      regras: [{ dataframe: 'top', colunas: ['musica', 'plays'], ordem: true, linhas: [['Pagode Russo', 4], ['Asa Branca', 3]] }],
      regrasOcultas: [{ dataframe: 'top', colunas: ['musica', 'plays'], ordem: true, linhas: [['Forró no Escuro', 4], ['Baião', 3]] }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra musica projetoMusica`.

### Task 3: 🥉🥈🥇 ETL bronze → prata → ouro

**Files:** Create `src/conteudo/projetos/etl.js`; Modify `index.js`, `tests/projetos.test.js`. Produces `projetoEtl`. Filtro: `etl-|etl `. (O filtro `etl` sozinho também pega outros ids com "etl"; isso só roda testes a mais.)

```js
// 🥉🥈🥇 ETL bronze → prata → ouro: as camadas do lakehouse em tabelas Delta. Bronze guarda o que
// chegou, prata limpa e tipa, ouro agrega; a carga do dia entra com merge, e o time travel confere.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (...linhas) => `id,cliente,valor,data\n${linhas.map((l) => `${l}\n`).join('')}`;

const DADOS = {
  'bruto/pedidos-1.csv': csv('1,Ana,120.50,2026-10-01', '2,Bia,80.00,2026-10-01', '2,Bia,80.00,2026-10-01', '3,Caio,,2026-10-02'),
  'bruto/pedidos-2.csv': csv('4,Davi,200.00,2026-10-02', '5,Ana,45.00,2026-10-03'),
  'carga-dia-2.csv': csv('3,Caio,60.00,2026-10-02', '5,Ana,50.00,2026-10-03'),
};
const OCULTO = {
  'bruto/pedidos-1.csv': csv('1,Eva,30.00,2026-10-05', '1,Eva,30.00,2026-10-05', '2,Fia,,2026-10-05'),
  'bruto/pedidos-2.csv': csv('3,Gil,70.00,2026-10-06'),
  'carga-dia-2.csv': csv('2,Fia,25.00,2026-10-05', '3,Gil,75.00,2026-10-06'),
};

const COLUNAS = ['id', 'cliente', 'valor', 'data'];
const TIPOS = ['int', 'string', 'double', 'date'];

export const projetoEtl = criarProjeto({
  id: 'etl',
  titulo: 'ETL bronze → prata → ouro',
  icone: '🥉🥈🥇',
  descricao: 'As camadas do lakehouse em Delta: bronze como chegou, prata limpa, ouro agregada, merge e time travel.',
  resumo: `
    <p>Os pedidos da loja chegam em CSV na pasta <code>bruto/</code>, com problemas: um pedido repetido e um sem valor.
      A arquitetura <b>medalhão</b> organiza o lago de dados em camadas, cada uma numa tabela <b>Delta</b>:</p>
    <ul>
      <li>🥉 <b>bronze</b>: os dados como chegaram, sem mexer (dá para refazer tudo a partir dela);</li>
      <li>🥈 <b>prata</b>: limpos e tipados;</li>
      <li>🥇 <b>ouro</b>: agregados, prontos para o relatório.</li>
    </ul>
    <p>No dia seguinte chega <code>carga-dia-2.csv</code>, com um pedido novo e uma correção: ela entra na prata com
      <code>merge</code>, e o <b>time travel</b> mostra o que mudou.</p>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from delta.tables import DeltaTable

    spark.read.csv("bruto", header=True).show()
  `,
  etapas: [
    {
      titulo: 'Bronze: como chegou',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia a pasta <code>bruto</code> <b>sem</b> inferir os tipos (tudo como texto) e grave em Delta, no caminho
          <code>bronze</code>.</p>`,
      dica: 'spark.read.csv("bruto", header=True).write.format("delta").save("bronze")',
      codigo: py`
        bruto = spark.read.csv("bruto", header=True)
        bruto.write.format("delta").save("bronze")
      `,
      regras: [{ delta: 'bronze', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS, linhasNaVersao: { versao: 0, linhas: 6 } }],
      regrasOcultas: [{ delta: 'bronze', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS, linhasNaVersao: { versao: 0, linhas: 4 } }],
    },
    {
      titulo: 'Prata: limpa e tipada',
      dificuldade: 'medio',
      enunciado: `
        <p>A partir da tabela <code>bronze</code>, guarde em <code>prata</code> os pedidos com os tipos certos
          (<code>id</code> int, <code>valor</code> double, <code>data</code> date), sem os pedidos sem valor e sem
          repetidos (mesmo <code>id</code>), e grave em Delta no caminho <code>prata</code>.</p>`,
      dica: 'spark.read.format("delta").load("bronze"); .cast("int"), .cast("double"), F.to_date; dropna(subset=["valor"]) e dropDuplicates(["id"]).',
      codigo: py`
        bronze = spark.read.format("delta").load("bronze")
        prata = (bronze.select(F.col("id").cast("int").alias("id"), "cliente",
                               F.col("valor").cast("double").alias("valor"), F.to_date("data").alias("data"))
            .dropna(subset=["valor"])
            .dropDuplicates(["id"]))
        prata.write.format("delta").save("prata")
        prata.orderBy("id").show()
      `,
      regras: [
        { delta: 'prata', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS },
        { dataframe: 'prata', tipos: TIPOS, linhas: [[1, 'Ana', 120.5, '2026-10-01'], [2, 'Bia', 80.0, '2026-10-01'], [4, 'Davi', 200.0, '2026-10-02'], [5, 'Ana', 45.0, '2026-10-03']] },
      ],
      regrasOcultas: [
        { delta: 'prata', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS },
        { dataframe: 'prata', tipos: TIPOS, linhas: [[1, 'Eva', 30.0, '2026-10-05'], [3, 'Gil', 70.0, '2026-10-06']] },
      ],
    },
    {
      titulo: 'Ouro: agregada',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>ouro</code>, a partir da prata gravada, os pedidos (<code>pedidos</code>) e o total gasto
          (<code>total</code>, em 2 casas) de cada cliente, e grave em Delta no caminho <code>ouro</code>.</p>`,
      dica: 'spark.read.format("delta").load("prata").groupBy("cliente").agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("total"))',
      codigo: py`
        ouro = (spark.read.format("delta").load("prata")
            .groupBy("cliente")
            .agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("total")))
        ouro.write.format("delta").save("ouro")
        ouro.show()
      `,
      regras: [
        { delta: 'ouro', versao: 0, operacoes: ['WRITE'], colunas: ['cliente', 'pedidos', 'total'] },
        { dataframe: 'ouro', linhas: [['Ana', 2, 165.5], ['Bia', 1, 80.0], ['Davi', 1, 200.0]] },
      ],
      regrasOcultas: [
        { delta: 'ouro', versao: 0, operacoes: ['WRITE'], colunas: ['cliente', 'pedidos', 'total'] },
        { dataframe: 'ouro', linhas: [['Eva', 1, 30.0], ['Gil', 1, 70.0]] },
      ],
    },
    {
      titulo: 'A carga do dia',
      dificuldade: 'dificil',
      enunciado: `
        <p>Chegou <code>carga-dia-2.csv</code>: o pedido 3 agora tem valor, e o 5 foi corrigido. Faça o <code>merge</code> da
          carga (com os mesmos tipos da prata) na tabela <code>prata</code> pelo <code>id</code>: quem casa é atualizado,
          quem não casa é inserido. No fim, guarde em <code>prata_hoje</code> a tabela atual.</p>`,
      dica: 'DeltaTable.forPath(spark, "prata").alias("p").merge(carga.alias("c"), "p.id = c.id").whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()',
      codigo: py`
        carga = (spark.read.csv("carga-dia-2.csv", header=True)
            .select(F.col("id").cast("int").alias("id"), "cliente",
                    F.col("valor").cast("double").alias("valor"), F.to_date("data").alias("data")))
        (DeltaTable.forPath(spark, "prata").alias("p")
            .merge(carga.alias("c"), "p.id = c.id")
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute())
        prata_hoje = spark.read.format("delta").load("prata")
        prata_hoje.orderBy("id").show()
      `,
      regras: [
        { delta: 'prata', versao: 1, operacoes: ['WRITE', 'MERGE'], linhasNaVersao: { versao: 1, linhas: 5 } },
        {
          dataframe: 'prata_hoje',
          linhas: [[1, 'Ana', 120.5, '2026-10-01'], [2, 'Bia', 80.0, '2026-10-01'], [3, 'Caio', 60.0, '2026-10-02'], [4, 'Davi', 200.0, '2026-10-02'], [5, 'Ana', 50.0, '2026-10-03']],
        },
      ],
      regrasOcultas: [
        { delta: 'prata', versao: 1, operacoes: ['WRITE', 'MERGE'], linhasNaVersao: { versao: 1, linhas: 3 } },
        { dataframe: 'prata_hoje', linhas: [[1, 'Eva', 30.0, '2026-10-05'], [2, 'Fia', 25.0, '2026-10-05'], [3, 'Gil', 75.0, '2026-10-06']] },
      ],
    },
    {
      titulo: 'Time travel para conferir',
      dificuldade: 'dificil',
      enunciado: `
        <p>Leia a prata como ela era antes do merge (versão 0) e guarde em <code>diferencas</code> os pedidos que entraram ou
          mudaram, com as colunas <code>id</code>, <code>antes</code> (o valor na versão 0, nulo se não existia) e
          <code>depois</code> (o valor atual).</p>`,
      dica: 'spark.read.format("delta").option("versionAsOf", 0).load("prata"); join da atual com ela pelo id ("left") e filtre antes nulo ou diferente de depois.',
      codigo: py`
        antes = spark.read.format("delta").option("versionAsOf", 0).load("prata")
        diferencas = (prata_hoje.alias("h").join(antes.alias("a"), "id", "left")
            .select("id", F.col("a.valor").alias("antes"), F.col("h.valor").alias("depois"))
            .filter(F.col("antes").isNull() | (F.col("antes") != F.col("depois"))))
        diferencas.show()
      `,
      regras: [{ dataframe: 'diferencas', colunas: ['id', 'antes', 'depois'], linhas: [[3, null, 60.0], [5, 45.0, 50.0]] }],
      regrasOcultas: [{ dataframe: 'diferencas', colunas: ['id', 'antes', 'depois'], linhas: [[2, null, 25.0], [3, 70.0, 75.0]] }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra etl projetoEtl`.

### Task 4: 🧹 Qualidade de dados e SCD tipo 2

**Files:** Create `src/conteudo/projetos/qualidade.js`; Modify `index.js`, `tests/projetos.test.js`. Produces `projetoQualidade`. Filtro: `qualidade`.

```js
// 🧹 Qualidade de dados e SCD tipo 2: regras de qualidade, quarentena das linhas ruins em Delta e a
// tabela de clientes com histórico (início, fim e atual), atualizada com merge.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (...linhas) => `id,nome,email,cidade\n${linhas.map((l) => `${l}\n`).join('')}`;

const DADOS = {
  'clientes-dia-1.csv': csv('1,Ana,ana@exemplo.com,Crato', '2,Bia,bia-exemplo.com,Sobral', '3,Caio,caio@exemplo.com,', '4,Davi,davi@exemplo.com,Recife'),
  'clientes-dia-2.csv': csv('1,Ana,ana@exemplo.com,Fortaleza', '4,Davi,davi@exemplo.com,Recife', '5,Edu,edu@exemplo.com,Natal', '6,Fia,,Natal'),
};
const OCULTO = {
  'clientes-dia-1.csv': csv('1,Gil,gil@exemplo.com,Iguatu', '2,Hana,hana@exemplo.com,', '3,Ivo,ivo@exemplo.com,Tauá'),
  'clientes-dia-2.csv': csv('1,Gil,gil@exemplo.com,Iguatu', '3,Ivo,ivo@exemplo.com,Quixadá', '4,Jade,jade-exemplo.com,Crato'),
};

const HISTORICO = ['id', 'nome', 'email', 'cidade', 'inicio', 'fim', 'atual'];

export const projetoQualidade = criarProjeto({
  id: 'qualidade',
  titulo: 'Qualidade de dados e SCD tipo 2',
  icone: '🧹',
  descricao: 'Clientes chegando todo dia: regras de qualidade, quarentena e histórico (SCD tipo 2) com merge no Delta.',
  resumo: `
    <p>Todo dia chega um arquivo com os clientes (<code>clientes-dia-1.csv</code>, <code>clientes-dia-2.csv</code>). Alguns
      vêm com problema: e-mail sem @, cidade vazia. Eles não entram na tabela: vão para a <b>quarentena</b>, para alguém
      corrigir.</p>
    <p>Quando um cliente muda de cidade, não basta sobrescrever: a empresa quer saber onde ele morava em cada data. É o
      <b>SCD tipo 2</b> (dimensão que muda devagar): a linha antiga ganha a data de <code>fim</code> e deixa de ser a
      <code>atual</code>, e uma linha nova entra com a data de <code>inicio</code>.</p>
    <ol>
      <li>as regras de qualidade;</li>
      <li>a quarentena das linhas ruins;</li>
      <li>a tabela de clientes em Delta, com início, fim e atual;</li>
      <li>o SCD tipo 2 com o merge do dia 2;</li>
      <li>como a tabela estava em cada data.</li>
    </ol>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from delta.tables import DeltaTable

    dia1 = spark.read.csv("clientes-dia-1.csv", header=True, inferSchema=True)
    dia1.show()
  `,
  etapas: [
    {
      titulo: 'As regras de qualidade',
      dificuldade: 'facil',
      enunciado: `
        <p>Escreva a função <code>checar(df)</code>, que acrescenta a coluna <code>problema</code>: <code>"email sem @"</code>
          quando o e-mail está vazio ou não tem @, <code>"sem cidade"</code> quando a cidade está vazia, e nulo quando a linha
          está boa. Guarde em <code>checados</code> o dia 1 checado.</p>`,
      dica: 'F.when(F.col("email").isNull() | ~F.col("email").contains("@"), "email sem @").when(F.col("cidade").isNull(), "sem cidade")',
      codigo: py`
        def checar(df):
            return df.withColumn("problema",
                F.when(F.col("email").isNull() | ~F.col("email").contains("@"), "email sem @")
                 .when(F.col("cidade").isNull(), "sem cidade"))

        checados = checar(dia1)
        checados.show()
      `,
      regras: [{
        dataframe: 'checados',
        colunas: ['id', 'nome', 'email', 'cidade', 'problema'],
        linhas: [[1, 'Ana', 'ana@exemplo.com', 'Crato', null], [2, 'Bia', 'bia-exemplo.com', 'Sobral', 'email sem @'], [3, 'Caio', 'caio@exemplo.com', null, 'sem cidade'], [4, 'Davi', 'davi@exemplo.com', 'Recife', null]],
      }],
      regrasOcultas: [{
        dataframe: 'checados',
        colunas: ['id', 'nome', 'email', 'cidade', 'problema'],
        linhas: [[1, 'Gil', 'gil@exemplo.com', 'Iguatu', null], [2, 'Hana', 'hana@exemplo.com', null, 'sem cidade'], [3, 'Ivo', 'ivo@exemplo.com', 'Tauá', null]],
      }],
    },
    {
      titulo: 'A quarentena',
      dificuldade: 'medio',
      enunciado: `
        <p>Grave as linhas com problema em Delta, no caminho <code>quarentena</code>, e guarde em <code>bons</code> as
          outras, sem a coluna <code>problema</code>.</p>`,
      dica: 'checados.filter(F.col("problema").isNotNull()).write.format("delta").save("quarentena"); bons = checados.filter(F.col("problema").isNull()).drop("problema").',
      codigo: py`
        checados.filter(F.col("problema").isNotNull()).write.format("delta").save("quarentena")
        bons = checados.filter(F.col("problema").isNull()).drop("problema")
        bons.show()
      `,
      regras: [
        { delta: 'quarentena', versao: 0, operacoes: ['WRITE'], linhasNaVersao: { versao: 0, linhas: 2 } },
        { dataframe: 'bons', colunas: ['id', 'nome', 'email', 'cidade'], linhas: [[1, 'Ana', 'ana@exemplo.com', 'Crato'], [4, 'Davi', 'davi@exemplo.com', 'Recife']] },
      ],
      regrasOcultas: [
        { delta: 'quarentena', versao: 0, operacoes: ['WRITE'], linhasNaVersao: { versao: 0, linhas: 1 } },
        { dataframe: 'bons', colunas: ['id', 'nome', 'email', 'cidade'], linhas: [[1, 'Gil', 'gil@exemplo.com', 'Iguatu'], [3, 'Ivo', 'ivo@exemplo.com', 'Tauá']] },
      ],
    },
    {
      titulo: 'Os clientes em Delta',
      dificuldade: 'medio',
      enunciado: `
        <p>Grave os bons em Delta, no caminho <code>clientes</code>, com mais três colunas: <code>inicio</code> (a data
          2026-10-01), <code>fim</code> (uma data nula) e <code>atual</code> (verdadeiro).</p>`,
      dica: 'F.to_date(F.lit("2026-10-01")), F.lit(None).cast("date") e F.lit(True).',
      codigo: py`
        clientes = (bons.withColumn("inicio", F.to_date(F.lit("2026-10-01")))
            .withColumn("fim", F.lit(None).cast("date"))
            .withColumn("atual", F.lit(True)))
        clientes.write.format("delta").save("clientes")
      `,
      regras: [{ delta: 'clientes', versao: 0, operacoes: ['WRITE'], colunas: HISTORICO, linhasNaVersao: { versao: 0, linhas: 2 } }],
      regrasOcultas: [{ delta: 'clientes', versao: 0, operacoes: ['WRITE'], colunas: HISTORICO, linhasNaVersao: { versao: 0, linhas: 2 } }],
    },
    {
      titulo: 'O SCD tipo 2 com merge',
      dificuldade: 'dificil',
      enunciado: `
        <p>Chegou o dia 2 (data 2026-10-02). Cheque-o, mande os ruins para a quarentena (em <code>append</code>) e faça o
          merge dos bons na tabela <code>clientes</code>:</p>
        <ul>
          <li>quem mudou de cidade: a linha atual ganha <code>fim</code> = 2026-10-02 e <code>atual</code> = falso, e entra uma
            linha nova com a cidade nova;</li>
          <li>quem é novo entra; quem não mudou fica como está.</li>
        </ul>
        <p>No fim, guarde em <code>historico</code> a tabela inteira.</p>`,
      dica: 'O truque do SCD 2: some à entrada uma cópia de quem mudou com a chave nula (ela nunca casa, então vira a linha nova). O merge casa por "c.id = e.chave AND c.atual = true": whenMatchedUpdate fecha a linha antiga, whenNotMatchedInsert insere.',
      codigo: py`
        dia2 = checar(spark.read.csv("clientes-dia-2.csv", header=True, inferSchema=True))
        dia2.filter(F.col("problema").isNotNull()).write.format("delta").mode("append").save("quarentena")
        novos = (dia2.filter(F.col("problema").isNull()).drop("problema")
            .withColumn("dia", F.to_date(F.lit("2026-10-02"))))

        tabela = DeltaTable.forPath(spark, "clientes")
        atuais = tabela.toDF().filter("atual").select("id", F.col("cidade").alias("cidade_atual"))
        mudaram = (novos.join(atuais, "id")
            .filter(F.col("cidade") != F.col("cidade_atual"))
            .drop("cidade_atual"))
        entrada = (mudaram.withColumn("chave", F.lit(None).cast("int"))
            .unionByName(novos.withColumn("chave", F.col("id"))))
        (tabela.alias("c")
            .merge(entrada.alias("e"), "c.id = e.chave AND c.atual = true")
            .whenMatchedUpdate(condition="c.cidade <> e.cidade", set={"fim": "e.dia", "atual": "false"})
            .whenNotMatchedInsert(values={
                "id": "e.id", "nome": "e.nome", "email": "e.email", "cidade": "e.cidade",
                "inicio": "e.dia", "fim": "null", "atual": "true"})
            .execute())
        historico = spark.read.format("delta").load("clientes")
        historico.orderBy("id", "inicio").show()
      `,
      regras: [
        { delta: 'clientes', versao: 1, operacoes: ['WRITE', 'MERGE'] },
        { delta: 'quarentena', versao: 1, operacoes: ['WRITE', 'WRITE'] },
        {
          dataframe: 'historico',
          colunas: HISTORICO,
          linhas: [
            [1, 'Ana', 'ana@exemplo.com', 'Crato', '2026-10-01', '2026-10-02', false], [1, 'Ana', 'ana@exemplo.com', 'Fortaleza', '2026-10-02', null, true],
            [4, 'Davi', 'davi@exemplo.com', 'Recife', '2026-10-01', null, true], [5, 'Edu', 'edu@exemplo.com', 'Natal', '2026-10-02', null, true],
          ],
        },
      ],
      regrasOcultas: [
        { delta: 'clientes', versao: 1, operacoes: ['WRITE', 'MERGE'] },
        { delta: 'quarentena', versao: 1, operacoes: ['WRITE', 'WRITE'] },
        {
          dataframe: 'historico',
          colunas: HISTORICO,
          linhas: [
            [1, 'Gil', 'gil@exemplo.com', 'Iguatu', '2026-10-01', null, true], [3, 'Ivo', 'ivo@exemplo.com', 'Tauá', '2026-10-01', '2026-10-02', false],
            [3, 'Ivo', 'ivo@exemplo.com', 'Quixadá', '2026-10-02', null, true],
          ],
        },
      ],
    },
    {
      titulo: 'Como estava em cada data',
      dificuldade: 'dificil',
      enunciado: `
        <p>Escreva a função <code>em(data)</code>, que devolve, do <code>historico</code>, as linhas válidas naquela data
          (<code>inicio</code> até a data, e <code>fim</code> nulo ou depois dela), com as colunas <code>id</code>,
          <code>nome</code> e <code>cidade</code>. Guarde em <code>em_1</code> e <code>em_2</code> a tabela em 2026-10-01 e em
          2026-10-02.</p>`,
      dica: 'd = F.to_date(F.lit(data)); filter((F.col("inicio") <= d) & (F.col("fim").isNull() | (F.col("fim") > d))).',
      codigo: py`
        def em(data):
            d = F.to_date(F.lit(data))
            validas = (F.col("inicio") <= d) & (F.col("fim").isNull() | (F.col("fim") > d))
            return historico.filter(validas).select("id", "nome", "cidade")

        em_1 = em("2026-10-01")
        em_2 = em("2026-10-02")
        em_1.show()
        em_2.show()
      `,
      regras: [
        { dataframe: 'em_1', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Ana', 'Crato'], [4, 'Davi', 'Recife']] },
        { dataframe: 'em_2', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Ana', 'Fortaleza'], [4, 'Davi', 'Recife'], [5, 'Edu', 'Natal']] },
      ],
      regrasOcultas: [
        { dataframe: 'em_1', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Gil', 'Iguatu'], [3, 'Ivo', 'Tauá']] },
        { dataframe: 'em_2', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Gil', 'Iguatu'], [3, 'Ivo', 'Quixadá']] },
      ],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra qualidade projetoQualidade`.

### Task 5: 🎯 Recomendação

**Files:** Create `src/conteudo/projetos/recomendacao.js`; Modify `index.js`, `tests/projetos.test.js`. Produces `projetoRecomendacao`. Filtro: `recomendacao`.

```js
// 🎯 Recomendação: as notas dos filmes viram o perfil de cada pessoa (ação ou drama); o KMeans
// agrupa os perfis, e cada pessoa recebe o filme que o seu grupo mais gostou e ela ainda não viu.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const FILMES = {
  'O Cangaceiro': 'acao', Corisco: 'acao', Lampião: 'acao',
  'Vidas Secas': 'drama', 'Central do Brasil': 'drama', 'Abril Despedaçado': 'drama',
};
const csv = (notas) => `usuario,filme,genero,nota\n${notas.map(([u, f, n]) => `${u},${f},${FILMES[f]},${n}\n`).join('')}`;
const teste = (notas) => `usuario,filme,nota\n${notas.map((l) => `${l.join(',')}\n`).join('')}`;

const DADOS = {
  'avaliacoes.csv': csv([
    ['ana', 'O Cangaceiro', 5], ['ana', 'Corisco', 4], ['ana', 'Vidas Secas', 2],
    ['bia', 'O Cangaceiro', 4], ['bia', 'Lampião', 5], ['bia', 'Central do Brasil', 1],
    ['caio', 'Corisco', 5], ['caio', 'Lampião', 4], ['caio', 'Abril Despedaçado', 2],
    ['davi', 'Vidas Secas', 5], ['davi', 'Central do Brasil', 4], ['davi', 'O Cangaceiro', 1],
    ['eva', 'Central do Brasil', 5], ['eva', 'Abril Despedaçado', 4], ['eva', 'Corisco', 2],
    ['fia', 'Vidas Secas', 4], ['fia', 'Abril Despedaçado', 5], ['fia', 'Lampião', 1],
  ]),
  'teste.csv': teste([
    ['ana', 'Lampião', 5], ['bia', 'Corisco', 4], ['caio', 'O Cangaceiro', 2],
    ['davi', 'Abril Despedaçado', 5], ['eva', 'Vidas Secas', 4], ['fia', 'Central do Brasil', 3],
  ]),
};
const OCULTO = {
  'avaliacoes.csv': csv([
    ['gil', 'O Cangaceiro', 5], ['gil', 'Vidas Secas', 1],
    ['hana', 'Corisco', 4], ['hana', 'O Cangaceiro', 5], ['hana', 'Central do Brasil', 2],
    ['ivo', 'Vidas Secas', 5], ['ivo', 'Corisco', 1],
    ['jade', 'Central do Brasil', 4], ['jade', 'Vidas Secas', 5], ['jade', 'Lampião', 2],
  ]),
  'teste.csv': teste([['gil', 'Corisco', 4], ['hana', 'Vidas Secas', 2], ['ivo', 'Central do Brasil', 5], ['jade', 'Corisco', 1]]),
};

export const projetoRecomendacao = criarProjeto({
  id: 'recomendacao',
  titulo: 'Recomendação',
  icone: '🎯',
  descricao: 'Notas de filmes nacionais: perfis, grupos com KMeans, a nota de cada grupo, a recomendação e a conferência.',
  resumo: `
    <p>Um cineclube guarda as notas (de 1 a 5) que cada pessoa deu aos filmes em <code>avaliacoes.csv</code>. Os filmes são
      de ação ou de drama. A ideia da recomendação: pessoas de gosto parecido gostam dos mesmos filmes.</p>
    <ol>
      <li>o gosto de cada pessoa: a nota média em cada gênero;</li>
      <li>dois grupos de gosto com o <b>KMeans</b>;</li>
      <li>a nota média de cada filme em cada grupo;</li>
      <li>para cada pessoa, o filme que o grupo dela mais gostou e ela ainda não viu;</li>
      <li>a conferência: depois, cada pessoa viu o filme recomendado e deu uma nota (<code>teste.csv</code>).</li>
    </ol>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from pyspark.ml.feature import VectorAssembler
    from pyspark.ml.clustering import KMeans

    avaliacoes = spark.read.csv("avaliacoes.csv", header=True, inferSchema=True)
    avaliacoes.show()
  `,
  etapas: [
    {
      titulo: 'O gosto de cada pessoa',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>gosto</code> uma linha por pessoa com a nota média que ela deu a cada gênero: as colunas
          <code>usuario</code>, <code>acao</code> e <code>drama</code>.</p>`,
      dica: 'avaliacoes.groupBy("usuario").pivot("genero", ["acao", "drama"]).avg("nota")',
      codigo: py`
        gosto = avaliacoes.groupBy("usuario").pivot("genero", ["acao", "drama"]).avg("nota")
        gosto.show()
      `,
      regras: [{
        dataframe: 'gosto',
        colunas: ['usuario', 'acao', 'drama'],
        linhas: [['ana', 4.5, 2.0], ['bia', 4.5, 1.0], ['caio', 4.5, 2.0], ['davi', 1.0, 4.5], ['eva', 2.0, 4.5], ['fia', 1.0, 4.5]],
      }],
      regrasOcultas: [{ dataframe: 'gosto', colunas: ['usuario', 'acao', 'drama'], linhas: [['gil', 5.0, 1.0], ['hana', 4.5, 2.0], ['ivo', 1.0, 5.0], ['jade', 2.0, 4.5]] }],
    },
    {
      titulo: 'Grupos de gosto',
      dificuldade: 'medio',
      enunciado: `
        <p>Monte o vetor de features com <code>acao</code> e <code>drama</code> e agrupe as pessoas em <b>2</b> grupos com
          <code>KMeans(k=2, seed=1)</code>, guardando o modelo em <code>grupos</code>.</p>
        <p>Os números dos grupos (0 e 1) não dizem nada. Guarde em <code>membros</code> as colunas <code>usuario</code> e
          <code>perfil</code>: <code>"ação"</code> para o grupo cujo centro tem a nota de ação maior que a de drama, e
          <code>"drama"</code> para o outro.</p>`,
      dica: 'grupos.clusterCenters() dá os centros [acao, drama]; o grupo de ação é o índice com centro[0] > centro[1]. Use F.when(F.col("prediction") == indice, "ação").otherwise("drama").',
      codigo: py`
        pontos = VectorAssembler(inputCols=["acao", "drama"], outputCol="features").transform(gosto)
        grupos = KMeans(k=2, seed=1).fit(pontos)
        centros = grupos.clusterCenters()
        de_acao = max(range(2), key=lambda i: centros[i][0] - centros[i][1])
        membros = grupos.transform(pontos).select(
            "usuario", F.when(F.col("prediction") == de_acao, "ação").otherwise("drama").alias("perfil"))
        membros.show()
      `,
      regras: [
        { modelo: 'grupos', tipo: 'KMeansModel', k: 2 },
        { dataframe: 'membros', colunas: ['usuario', 'perfil'], linhas: [['ana', 'ação'], ['bia', 'ação'], ['caio', 'ação'], ['davi', 'drama'], ['eva', 'drama'], ['fia', 'drama']] },
      ],
      regrasOcultas: [
        { modelo: 'grupos', tipo: 'KMeansModel', k: 2 },
        { dataframe: 'membros', colunas: ['usuario', 'perfil'], linhas: [['gil', 'ação'], ['hana', 'ação'], ['ivo', 'drama'], ['jade', 'drama']] },
      ],
    },
    {
      titulo: 'A nota de cada grupo',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_perfil</code> a nota média (<code>media</code>, em 1 casa) de cada filme em cada perfil: as
          colunas <code>perfil</code>, <code>filme</code> e <code>media</code>.</p>`,
      dica: 'avaliacoes.join(membros, "usuario").groupBy("perfil", "filme").agg(F.round(F.avg("nota"), 1).alias("media"))',
      codigo: py`
        por_perfil = (avaliacoes.join(membros, "usuario")
            .groupBy("perfil", "filme").agg(F.round(F.avg("nota"), 1).alias("media")))
        por_perfil.orderBy("perfil", F.desc("media")).show()
      `,
      regras: [{
        dataframe: 'por_perfil',
        colunas: ['perfil', 'filme', 'media'],
        linhas: [
          ['ação', 'O Cangaceiro', 4.5], ['ação', 'Corisco', 4.5], ['ação', 'Lampião', 4.5], ['ação', 'Vidas Secas', 2.0], ['ação', 'Central do Brasil', 1.0], ['ação', 'Abril Despedaçado', 2.0],
          ['drama', 'Vidas Secas', 4.5], ['drama', 'Central do Brasil', 4.5], ['drama', 'Abril Despedaçado', 4.5], ['drama', 'O Cangaceiro', 1.0], ['drama', 'Corisco', 2.0], ['drama', 'Lampião', 1.0],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'por_perfil',
        colunas: ['perfil', 'filme', 'media'],
        linhas: [
          ['ação', 'O Cangaceiro', 5.0], ['ação', 'Corisco', 4.0], ['ação', 'Central do Brasil', 2.0], ['ação', 'Vidas Secas', 1.0],
          ['drama', 'Vidas Secas', 5.0], ['drama', 'Central do Brasil', 4.0], ['drama', 'Lampião', 2.0], ['drama', 'Corisco', 1.0],
        ],
      }],
    },
    {
      titulo: 'A recomendação',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>recomendacoes</code>, para cada pessoa, o filme de maior nota no perfil dela que ela ainda
          <b>não</b> avaliou (no empate, o primeiro em ordem alfabética): as colunas <code>usuario</code>,
          <code>filme</code> e <code>media</code>.</p>`,
      dica: 'Junte membros com por_perfil pelo perfil (todos os filmes do grupo); tire os já vistos com left_anti em ["usuario", "filme"]; F.row_number() por usuario em ordem de media decrescente e filme.',
      codigo: py`
        from pyspark.sql import Window

        candidatos = (membros.join(por_perfil, "perfil")
            .join(avaliacoes.select("usuario", "filme"), ["usuario", "filme"], "left_anti"))
        melhor = Window.partitionBy("usuario").orderBy(F.desc("media"), "filme")
        recomendacoes = (candidatos.withColumn("n", F.row_number().over(melhor))
            .filter(F.col("n") == 1)
            .select("usuario", "filme", "media"))
        recomendacoes.orderBy("usuario").show()
      `,
      regras: [{
        dataframe: 'recomendacoes',
        colunas: ['usuario', 'filme', 'media'],
        linhas: [['ana', 'Lampião', 4.5], ['bia', 'Corisco', 4.5], ['caio', 'O Cangaceiro', 4.5], ['davi', 'Abril Despedaçado', 4.5], ['eva', 'Vidas Secas', 4.5], ['fia', 'Central do Brasil', 4.5]],
      }],
      regrasOcultas: [{
        dataframe: 'recomendacoes',
        colunas: ['usuario', 'filme', 'media'],
        linhas: [['gil', 'Corisco', 4.0], ['hana', 'Vidas Secas', 1.0], ['ivo', 'Central do Brasil', 4.0], ['jade', 'Corisco', 1.0]],
      }],
    },
    {
      titulo: 'A conferência',
      dificuldade: 'dificil',
      enunciado: `
        <p>Em <code>teste.csv</code> está a nota que cada pessoa deu depois ao filme recomendado. Guarde em
          <code>conferencia</code> as recomendações com a nota real (colunas <code>usuario</code>, <code>filme</code> e
          <code>nota</code>) e em <code>acerto</code> a fração das recomendações que tiveram nota 4 ou mais (em 2 casas).</p>`,
      dica: 'recomendacoes.join(teste, ["usuario", "filme"]); acerto = round(conferencia.filter(F.col("nota") >= 4).count() / conferencia.count(), 2).',
      codigo: py`
        teste = spark.read.csv("teste.csv", header=True, inferSchema=True)
        conferencia = recomendacoes.join(teste, ["usuario", "filme"]).select("usuario", "filme", "nota")
        acerto = round(conferencia.filter(F.col("nota") >= 4).count() / conferencia.count(), 2)
        print("acerto:", acerto)
      `,
      regras: [
        {
          dataframe: 'conferencia',
          colunas: ['usuario', 'filme', 'nota'],
          linhas: [['ana', 'Lampião', 5], ['bia', 'Corisco', 4], ['caio', 'O Cangaceiro', 2], ['davi', 'Abril Despedaçado', 5], ['eva', 'Vidas Secas', 4], ['fia', 'Central do Brasil', 3]],
        },
        { variavel: 'acerto', igual: 0.67 },
      ],
      regrasOcultas: [
        { dataframe: 'conferencia', colunas: ['usuario', 'filme', 'nota'], linhas: [['gil', 'Corisco', 4], ['hana', 'Vidas Secas', 2], ['ivo', 'Central do Brasil', 5], ['jade', 'Corisco', 1]] },
        { variavel: 'acerto', igual: 0.5 },
      ],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra recomendacao projetoRecomendacao`.

### Task 6: 🕵️ Detecção de fraude

**Files:** Create `src/conteudo/projetos/fraude.js`; Modify `index.js`, `tests/projetos.test.js`. Produces `projetoFraude`. Filtro: `fraude`.

```js
// 🕵️ Detecção de fraude: as transações viram features (valor, hora, distância), um Pipeline com
// StandardScaler e regressão logística aprende a separar as fraudes, a AUC confere no teste, e uma
// árvore de decisão entra na comparação.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (linhas) => `valor,hora,distancia_km,fraude\n${linhas.map((l) => `${l.join(',')}\n`).join('')}`;

const DADOS = {
  'transacoes.csv': csv([
    [45, 10, 2, 0], [120, 14, 5, 0], [80, 9, 1, 0], [60, 19, 8, 0], [200, 12, 3, 0], [35, 16, 4, 0], [150, 11, 6, 0], [90, 20, 10, 0],
    [2500, 3, 450, 1], [1800, 2, 300, 1], [3000, 4, 600, 1], [950, 23, 120, 1], [2200, 1, 800, 1], [1200, 3, 90, 0], [400, 22, 350, 1], [70, 13, 3, 0],
  ]),
  'teste.csv': csv([[55, 15, 3, 0], [130, 10, 7, 0], [2700, 2, 500, 1], [300, 21, 280, 1], [1000, 12, 15, 0], [1600, 4, 200, 1], [40, 8, 1, 0], [800, 23, 60, 0]]),
};
const OCULTO = {
  'transacoes.csv': csv([
    [30, 9, 1, 0], [75, 15, 6, 0], [140, 18, 4, 0], [55, 11, 2, 0], [210, 13, 9, 0], [95, 10, 3, 0],
    [2800, 2, 700, 1], [1500, 3, 250, 1], [700, 1, 400, 1], [2100, 23, 520, 1], [1300, 14, 20, 0], [60, 4, 5, 0],
  ]),
  'teste.csv': csv([[65, 12, 4, 0], [1900, 3, 380, 1], [180, 17, 7, 0], [900, 2, 300, 1], [400, 15, 12, 0], [2500, 1, 650, 1]]),
};

export const projetoFraude = criarProjeto({
  id: 'fraude',
  titulo: 'Detecção de fraude',
  icone: '🕵️',
  descricao: 'Transações de cartão: features, Pipeline com StandardScaler, regressão logística, AUC e árvore de decisão.',
  resumo: `
    <p>O banco marcou, em <code>transacoes.csv</code>, quais compras foram <b>fraude</b> (1) e quais não (0), com o valor,
      a hora e a distância (em km) de onde o cliente costuma comprar. Os dados são inventados. Com eles, o MLlib aprende a
      separar uma da outra; <code>teste.csv</code> tem transações que o modelo nunca viu, para conferir.</p>
    <p>Valor (em reais) e hora (0 a 23) estão em escalas muito diferentes: o <b>StandardScaler</b> põe todas as features na
      mesma régua, e o <b>Pipeline</b> junta as etapas num modelo só.</p>
    <ol>
      <li>o vetor de features;</li>
      <li>o Pipeline com o StandardScaler;</li>
      <li>a regressão logística no Pipeline;</li>
      <li>a AUC nos dados de teste;</li>
      <li>uma árvore de decisão, e qual dos dois é melhor.</li>
    </ol>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from pyspark.ml import Pipeline
    from pyspark.ml.feature import VectorAssembler, StandardScaler
    from pyspark.ml.classification import LogisticRegression, DecisionTreeClassifier
    from pyspark.ml.evaluation import BinaryClassificationEvaluator

    treino = spark.read.csv("transacoes.csv", header=True, inferSchema=True)
    teste = spark.read.csv("teste.csv", header=True, inferSchema=True)
    treino.show()
  `,
  etapas: [
    {
      titulo: 'O vetor de features',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie em <code>montador</code> um <code>VectorAssembler</code> que junta <code>valor</code>, <code>hora</code> e
          <code>distancia_km</code> na coluna <code>brutas</code>, e guarde em <code>com_features</code> o treino
          transformado.</p>`,
      dica: 'VectorAssembler(inputCols=["valor", "hora", "distancia_km"], outputCol="brutas").transform(treino)',
      codigo: py`
        montador = VectorAssembler(inputCols=["valor", "hora", "distancia_km"], outputCol="brutas")
        com_features = montador.transform(treino)
        com_features.show(truncate=False)
      `,
      regras: [{ dataframe: 'com_features', colunas: ['valor', 'hora', 'distancia_km', 'fraude', 'brutas'], total: 16 }],
      regrasOcultas: [{ dataframe: 'com_features', colunas: ['valor', 'hora', 'distancia_km', 'fraude', 'brutas'], total: 12 }],
    },
    {
      titulo: 'O Pipeline com o StandardScaler',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie em <code>escala</code> um <code>StandardScaler</code> de <code>brutas</code> para <code>features</code> e
          treine em <code>preparo</code> um <code>Pipeline</code> com o montador e a escala.</p>`,
      dica: 'escala = StandardScaler(inputCol="brutas", outputCol="features"); preparo = Pipeline(stages=[montador, escala]).fit(treino)',
      codigo: py`
        escala = StandardScaler(inputCol="brutas", outputCol="features")
        preparo = Pipeline(stages=[montador, escala]).fit(treino)
        preparo.transform(treino).select("brutas", "features").show(3, truncate=False)
      `,
      regras: [{ modelo: 'preparo', tipo: 'StandardScalerModel' }],
      regrasOcultas: [{ modelo: 'preparo', tipo: 'StandardScalerModel' }],
    },
    {
      titulo: 'A regressão logística',
      dificuldade: 'medio',
      enunciado: `
        <p>Treine em <code>modelo</code> um <code>Pipeline</code> com o montador, a escala e uma
          <code>LogisticRegression</code> que prevê a coluna <code>fraude</code>.</p>`,
      dica: 'Pipeline(stages=[montador, escala, LogisticRegression(labelCol="fraude")]).fit(treino)',
      codigo: py`
        modelo = Pipeline(stages=[montador, escala, LogisticRegression(labelCol="fraude")]).fit(treino)
        modelo.transform(teste).select("valor", "hora", "distancia_km", "fraude", "prediction").show()
      `,
      regras: [{ modelo: 'modelo', tipo: 'LogisticRegressionModel' }],
      regrasOcultas: [{ modelo: 'modelo', tipo: 'LogisticRegressionModel' }],
    },
    {
      titulo: 'A AUC no teste',
      dificuldade: 'dificil',
      enunciado: `
        <p>Calcule em <code>auc</code> a área sob a curva ROC do <code>modelo</code> nos dados de teste. Ela precisa ser de
          pelo menos 0,9: o modelo separa bem as fraudes de transações que nunca viu.</p>`,
      dica: 'avaliador = BinaryClassificationEvaluator(labelCol="fraude"); auc = avaliador.evaluate(modelo.transform(teste))',
      codigo: py`
        avaliador = BinaryClassificationEvaluator(labelCol="fraude")
        auc = avaliador.evaluate(modelo.transform(teste))
        print("AUC da regressão logística:", round(auc, 3))
      `,
      regras: [{ modelo: 'modelo', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } }, { variavel: 'auc', igual: 1.0 }],
      regrasOcultas: [{ modelo: 'modelo', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } }, { variavel: 'auc', igual: 1.0 }],
    },
    {
      titulo: 'A árvore de decisão',
      dificuldade: 'dificil',
      enunciado: `
        <p>Treine em <code>arvore</code> um <code>Pipeline</code> com o montador e uma <code>DecisionTreeClassifier</code>
          de profundidade máxima 2 (a árvore não precisa de escala), calcule em <code>auc_arvore</code> a AUC dela no teste e
          guarde em <code>melhor</code> o texto <code>"logística"</code> ou <code>"árvore"</code>, o de maior AUC (no empate,
          a logística).</p>`,
      dica: 'Pipeline(stages=[montador, DecisionTreeClassifier(labelCol="fraude", featuresCol="brutas", maxDepth=2)]).fit(treino); melhor = "logística" if auc >= auc_arvore else "árvore".',
      codigo: py`
        arvore = Pipeline(stages=[montador, DecisionTreeClassifier(labelCol="fraude", featuresCol="brutas", maxDepth=2)]).fit(treino)
        auc_arvore = avaliador.evaluate(arvore.transform(teste))
        melhor = "logística" if auc >= auc_arvore else "árvore"
        print("AUC da árvore:", round(auc_arvore, 3), "· melhor:", melhor)
      `,
      regras: [
        { modelo: 'arvore', tipo: 'DecisionTreeClassificationModel', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } },
        { variavel: 'melhor', igual: 'logística' },
      ],
      regrasOcultas: [
        { modelo: 'arvore', tipo: 'DecisionTreeClassificationModel', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } },
        { variavel: 'melhor', igual: 'logística' },
      ],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra fraude projetoFraude`.

Depois desta task, troque a descrição do módulo em `src/conteudo/projetos/index.js` (agora com os 18) por:

```js
  descricao: 'Pipelines de dados de ponta a ponta com PySpark: ler, limpar, juntar, agregar e entregar. São 18 projetos de 5 etapas, em que cada etapa continua do código da anterior: DataFrame e SQL, Spark avançado e além do batch (streaming, Delta e MLlib).',
```

e inclua `src/conteudo/projetos/index.js` no commit da Task 6.

---

### Task 7: O certificado final

**Files:**
- Modify: `src/certificados.js`, `src/restaurar.js`, `tests/carga-horaria.test.js`, `tests/certificados.test.js`, `tests/restaurar.test.js`

**Interfaces:**
- Consumes: `modulos` (com os 18 projetos), `horasDosItens` de `src/cargaHoraria.js`.
- Produces: `CERTIFICADOS.final`; `planoDeRestauracao(cert, modulos)` devolve, para o certificado final, também o bloco `projetos` (com o título do módulo, já que ele não tem certificado).

- [ ] **Step 1: Write the failing tests**

Em `tests/carga-horaria.test.js`, troque o teste `it.skipIf(!CERTIFICADOS.final)('o certificado final soma todos os módulos', ...)` por:

```js
  it('o certificado final soma os certificados dos módulos e as horas dos projetos', () => {
    const projetos = modulos.find((m) => m.id === 'projetos');
    expect(CERTIFICADOS.final.cargaHoraria).toBe(MODULOS.reduce((s, id) => s + CERTIFICADOS[id].cargaHoraria, 0) + horasDosItens(projetos.itens));
    expect(CERTIFICADOS.final.cargaHoraria).toBe(155);
  });
```

Em `tests/certificados.test.js`, logo depois do teste `'os números do texto batem com o conteúdo da trilha'`, acrescente:

```js
  it('o resumo do certificado final bate com a trilha inteira', () => {
    const projetos = modulos.find((m) => m.id === 'projetos');
    const exercicios = modulos.filter((m) => m.id !== 'projetos').flatMap((m) => m.itens).filter((i) => i.tipo === 'problema').length;
    const etapas = projetos.itens.filter((i) => i.tipo === 'problema').length;
    expect(CERTIFICADOS.final.resumo).toBe(`concluiu a trilha completa: os ${modulos.length - 1} módulos, ${exercicios} problemas práticos e ${projetos.grupos.length} projetos (${etapas} etapas)`);
    expect(ORDEM.at(-1)).toBe('final');
  });
```

(Se `ORDEM` não estiver importado nesse arquivo, acrescente-o ao import de `../src/certificados.js`.)

Em `tests/restaurar.test.js`, no teste `'um bloco por módulo da cadeia, com os itens e a data de cada um'`, troque:

```js
    const comItens = ORDEM.filter((id) => modulos.some((m) => m.id === id));
    expect(plano.map((b) => b.modulo)).toEqual(comItens); // o final não traz itens
    for (const b of plano) {
      const m = modulos.find((x) => x.id === b.modulo);
      expect(b.titulo).toBe(CERTIFICADOS[b.modulo].titulo);
```

por:

```js
    // O final não traz itens próprios, mas devolve os projetos (que não têm certificado), na data dele.
    const comItens = [...ORDEM.filter((id) => modulos.some((m) => m.id === id)), 'projetos'];
    expect(plano.map((b) => b.modulo)).toEqual(comItens);
    expect(plano.at(-1).data).toBe(cert.data);
    for (const b of plano) {
      const m = modulos.find((x) => x.id === b.modulo);
      expect(b.titulo).toBe(CERTIFICADOS[b.modulo]?.titulo ?? m.titulo);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `rtk proxy npx vitest run tests/carga-horaria.test.js tests/certificados.test.js tests/restaurar.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |TypeError|AssertionError" $TEMP/v.txt | head -6`
Expected: falham o da carga do final (`Cannot read properties of undefined (reading 'cargaHoraria')`), o do resumo do final e o do plano de restauração (falta o bloco `projetos`).

- [ ] **Step 3: Implement**

Em `src/certificados.js`, troque o comentário `// veja src/cargaHoraria.js). O certificado final (trilha completa) volta na fase 6, quando\n// todos os módulos existirem.` por `// veja src/cargaHoraria.js). O final soma os módulos e as horas dos projetos, que não têm\n// certificado próprio.` e acrescente no fim do objeto `CERTIFICADOS`, depois de `alem`:

```js
  final: {
    titulo: 'Engenharia de dados com Python e Spark: trilha completa',
    cargaHoraria: 155,
    resumo: 'concluiu a trilha completa: os 5 módulos, 196 problemas práticos e 18 projetos (90 etapas)',
    hashtags: ['Python', 'PySpark', 'EngenhariaDeDados'],
    conteudos: ['Python básico e para dados', 'Paralelismo', 'PySpark', 'Streaming, Delta Lake e MLlib', '18 projetos de ponta a ponta'],
  },
```

Em `src/restaurar.js`, troque o comentário do topo de `planoDeRestauracao` e o começo da função:

```js
/**
 * Um bloco por módulo da cadeia. O certificado final não tem itens próprios, mas prova também os
 * projetos, que não têm certificado: eles voltam na data do final.
 * `modulos` é o de conteudo/trilha.js.
 */
export function planoDeRestauracao(cert, modulos) {
  const elos = [...cert.cadeia, { modulo: cert.modulo, data: cert.data }];
  if (cert.modulo === 'final') elos.push({ modulo: 'projetos', data: cert.data });
  return elos.flatMap(({ modulo, data }) => {
    const m = modulos.find((x) => x.id === modulo);
    if (!m) return [];
    return [{
      modulo,
      titulo: CERTIFICADOS[modulo]?.titulo ?? m.titulo,
```

(o resto da função fica igual).

- [ ] **Step 4: Run them to verify they pass**

Run: `rtk proxy npx vitest run tests/carga-horaria.test.js tests/certificados.test.js tests/restaurar.test.js tests/restaurar-ui.test.js tests/landing.test.js tests/gamificacao.test.js tests/validador.test.js > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL" $TEMP/v.txt`
Expected: tudo verde. O teste de ida e volta do `tests/restaurar.test.js` passa a cobrir o final: restaurado num navegador vazio, ele volta liberado e com o mesmo código (Review Focus 1). Se algum teste supunha "sem certificado final" (`skipIf(!CERTIFICADOS.final)`), ele passa a rodar; se falhar, é porque o final mudou o comportamento: corrija o código, não o teste, a não ser que ele contradiga a spec (aí, ledger com `Ruling:`).

Acrescente em `tests/restaurar.test.js` o teste do Review Focus 2, no `describe` de `planoDeRestauracao` (ou num novo `describe('certificado final')`):

```js
  it('o final só sai com todos os projetos: faltando uma etapa, o diploma fica desabilitado', async () => {
    const { calcularJornada } = await import('../src/gamificacao.js');
    const ultima = modulos.find((m) => m.id === 'projetos').itens.at(-1).id;
    const j = calcularJornada({ modulos, statusDe: (id) => (id === ultima ? undefined : 'resolvido'), dataDe: () => '2026-10-16' });
    expect(j.final.concluido).toBe(false);
  });
```

Run de novo o mesmo comando: verde.

- [ ] **Step 5: Badges**

Run: `rtk proxy npm run badges > $TEMP/b.txt 2>&1; tail -3 $TEMP/b.txt; git status --short public | head`
Expected: `badge final ok` e `ícones e capa ok`; arquivos novos `public/badges/final*.png` (e a página `public/badge/final/index.html`) e a capa nova ("286 exercícios · 18 projetos"). Confira a capa e o badge final abrindo os PNGs com o Read.

- [ ] **Step 6: Commit**

```bash
git add src/certificados.js src/restaurar.js tests/carga-horaria.test.js tests/certificados.test.js tests/restaurar.test.js public
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Certificado final: trilha completa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Glossário, documentação, versão 1.0.0 e a conferência final

**Files:**
- Modify: `src/conteudo/glossario.js`, `tests/glossario.test.js`, `tests/conteudo.test.js`, `src/ui/validador.js`, `src/ui/declaracao-acessibilidade.js`, `README.md`, `src/novidades.js`, `package.json`, `package-lock.json`, `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md`

- [ ] **Step 1: Write the failing tests**

Em `tests/glossario.test.js`, antes do `});` final:

```js
  it('medalhão e SCD tipo 2 aparecem nos projetos', () => {
    const texto = 'A arquitetura medalhão tem bronze, prata e ouro; o SCD tipo 2 guarda o histórico';
    expect(ids(texto, 'projetos')).toEqual(expect.arrayContaining(['medalhao', 'scd2']));
    expect(ids(texto, 'alem')).not.toContain('medalhao');
  });
```

Em `tests/conteudo.test.js`, troque `['projetos', 60, 12]` por `['projetos', 90, 18]`.

Run: `rtk proxy npx vitest run tests/glossario.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt` → `1 failed | 6 passed`.

- [ ] **Step 2: Glossário**

Em `src/conteudo/glossario.js`, logo depois do termo `pivot` (o último):

```js
  {
    id: 'medalhao', termo: 'Arquitetura medalhão (bronze, prata, ouro)', padroes: ['medalhão', 'camadas? (bronze|prata|ouro)'],
    definicao: 'Organizar o lago de dados em camadas: bronze guarda os dados como chegaram, prata limpos e tipados, ouro agregados para o relatório.',
    analogia: 'O caminho do algodão: o fardo que chega do roçado, o fio limpo e penteado, e o pano pronto para a costureira.',
    exemplo: 'bruto.write.format("delta").save("bronze")',
  },
  {
    id: 'scd2', termo: 'SCD tipo 2 (histórico)', padroes: ['scd( tipo)? ?2', 'dimens(ão|ões) que mudam? devagar'],
    definicao: 'Guardar o histórico de uma tabela: quando um valor muda, a linha antiga ganha a data de fim e uma linha nova entra com a data de início.',
    analogia: 'O caderno de endereços que não apaga: risca o endereço velho com a data da mudança e escreve o novo embaixo.',
    exemplo: 'whenMatchedUpdate(set={"fim": "e.dia", "atual": "false"})',
  },
```

Run: `rtk proxy npx vitest run tests/glossario.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt` → `7 passed`.

- [ ] **Step 3: Validação e declaração de acessibilidade**

Em `src/ui/validador.js`, troque `<p>Confira se um certificado ou badge da <b>${esc(EMISSOR.organizacao)}</b> é autêntico.</p>` por:

```js
        <p>Confira se um certificado ou badge da <b>${esc(EMISSOR.organizacao)}</b> é autêntico: o de cada módulo ou o certificado final, da trilha completa.</p>
```

Em `src/ui/declaracao-acessibilidade.js`, troque o item que começa com `<li>O certificado em PDF é gerado pela impressão do navegador.` por:

```html
        <li>O certificado em PDF, inclusive o certificado final da trilha completa, é gerado pela impressão do navegador. Para conferir com leitor de tela, use a página do certificado ou a página de validação.</li>
```

- [ ] **Step 4: README, novidades e versão**

No `README.md`, troque o item dos projetos (que começa com `- **🏗️ Projetos** (0.6.0 e 0.7.0)`) por:

```markdown
- **🏗️ Projetos** (0.6.0 a 1.0.0): **18 projetos de 5 etapas** (90 etapas), pipelines de dados de ponta a ponta com
  PySpark, em que cada etapa continua do código da anterior. DataFrame e SQL: contagem de palavras em livros de cordel,
  vendas por região, análise de logs, funil de e-commerce, painel de indicadores e notas de exame. Spark avançado:
  mobilidade urbana, saúde pública, agronegócio, energia solar, hashtags e seguidores, e logística. Além do batch:
  sensores do sertão e streaming de música (Structured Streaming), ETL bronze → prata → ouro e qualidade de dados com
  SCD tipo 2 (Delta Lake), recomendação e detecção de fraude (MLlib).
- **🎓 Certificado final**: "Engenharia de dados com Python e Spark: trilha completa" (155 h), com todos os módulos e
  os 18 projetos concluídos; no fim da cadeia de certificados, com o badge ★.
```

Em `src/novidades.js`, no começo de `RELEASES`:

```js
  {
    versao: '1.0.0',
    data: '2026-10-16',
    titulo: 'A trilha completa',
    resumo: 'Os últimos 6 projetos chegaram, e com eles o certificado final: do primeiro print ao streaming, Delta Lake e MLlib.',
    grupos: [
      { titulo: '🏗️ Projetos novos', itens: ['Sensores do sertão e streaming de música (Structured Streaming), ETL bronze → prata → ouro e qualidade de dados com SCD tipo 2 (Delta Lake), recomendação e detecção de fraude (MLlib).', 'Agora são 18 projetos de 5 etapas: o módulo 🏗️ está completo.'] },
      { titulo: '🎓 Certificado final', itens: ['"Engenharia de dados com Python e Spark: trilha completa", de 155 horas, com o badge ★, quando todos os módulos e todos os projetos estiverem concluídos.', 'O certificado final também restaura o progresso em outro navegador, inclusive os projetos.'] },
      { titulo: '📖 Glossário', itens: ['Termos novos: arquitetura medalhão e SCD tipo 2.'] },
    ],
  },
```

`package.json` e `package-lock.json` (as duas primeiras ocorrências): `"version": "0.7.0"` → `"version": "1.0.0"`.

- [ ] **Step 5: Spec**

Em `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md`:
- tabela da 1.0.0, linha 🌡️: troque "alerta na memória com SQL" por "alertas na memória, consultados com SQL";
- linha 🧹: troque "a versão de uma data" por "como a tabela estava em cada data (pelo início e fim)";
- linha 🕵️: troque "`Pipeline` com `StandardScaler`" por "`Pipeline` com `StandardScaler` (a árvore usa as features sem escala)";
- §4: acrescente "Restaurar pelo certificado final devolve também os projetos (que não têm certificado), na data do final. Carga: 102 h dos 5 certificados de módulo + 53 h dos projetos = 155 h."

- [ ] **Step 6: Conferência inteira**

Run, em ordem (cada um verde):
- `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > $TEMP/pt.txt 2>&1; grep -E "passed|failed" $TEMP/pt.txt | tail -1`
- `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py > $TEMP/c.txt 2>&1; tail -1 $TEMP/c.txt` → 17/17
- `rtk proxy npx vitest run > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL" $TEMP/v.txt`
- `rtk proxy npx eslint -f json -o $TEMP/eslint.json .; node -e "const r=require(process.argv[1]);console.log(r.reduce((s,f)=>s+f.errorCount+f.warningCount,0))" $(cygpath -m $TEMP/eslint.json)` → 0
- `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") rtk proxy npm run build > $TEMP/b.txt 2>&1; tail -2 $TEMP/b.txt`

Preview (`preview_start` com `python-playground`):
- `#/trilha`: 18 subunidades no módulo 🏗️ e o bloco 🎓 do certificado final no fim (desabilitado); `#/`: "18 projetos · 90 etapas" e 7 badges na vitrine;
- grave no `localStorage` o rascunho com a solução da etapa 4 de `qualidade` (`python-playground:rascunho:qualidade-4`), abra `#/p/qualidade-4` e rode: os casos visíveis passam no navegador (o merge do SCD 2 roda no Pyodide);
- emita o certificado final de teste: marque todos os itens como resolvidos no `localStorage` (`python-playground:progresso`, cada id → `"resolvido"`), salve um nome, abra a trilha e clique no diploma: a página do certificado final mostra "Certificado de conclusão da trilha", 155 horas e o badge ★; valide o link em `#/validar`;
- axe (`https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`) na trilha, em `#/p/sensores-4` e na página do certificado final, nos 4 temas, com `runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']`: nenhuma violação;
- 375 px: `#/trilha`, `#/p/fraude-5` e o certificado final sem rolagem horizontal;
- no fim, apague do `localStorage` o progresso de teste.

- [ ] **Step 7: Commit**

```bash
git add src/conteudo/glossario.js tests/glossario.test.js tests/conteudo.test.js src/ui/validador.js src/ui/declaracao-acessibilidade.js README.md src/novidades.js package.json package-lock.json docs/superpowers/specs/2026-10-15-fase6-projetos-design.md
git status --short
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 1.0.0: a trilha completa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8 (só com o "sim"): publicar**

Com o "sim": `git push -u origin fase6-3`, PR para `main` (corpo terminando em "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), CI verde, merge com rebase e conferência do site no ar (a trilha, um projeto de streaming e a página de validação).
