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
        minutos. A leitura cuja janela já fechou é descartada, e a janela que a marca d'água passa fecha (no
        <code>append</code>, só sai quando fecha). Como no Spark, o descarte usa a marca d'água do lote anterior, e um
        lote extra sem dados roda quando a marca anda.</p>`,
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
    ...stream('por_janela', [1, 2, 4], [1, 2, 3, 5], { modo: 'complete' }),
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
    ...stream('deslizante', [2, 4, 8], [3, 4, 6, 9], { modo: 'complete' }),
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
    regras: [{ stream: 'janelas', modo: 'update', saidaPorLote: [1, 1, 1, 0], descartadas: 1, marcaDagua: '2026-03-10T08:16' }],
    regrasOcultas: [{ stream: 'janelas', modo: 'update', saidaPorLote: [1, 1, 2, 1, 0], descartadas: 1, marcaDagua: '2026-03-11T14:26' }],
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
