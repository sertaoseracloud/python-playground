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
