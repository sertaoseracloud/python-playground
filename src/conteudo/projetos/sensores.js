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
