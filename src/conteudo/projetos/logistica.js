// 🚚 Logística: as entregas das transportadoras, juntadas com uma tabela pequena de cidades
// (broadcast) e com os prazos. Atrasos, o plano com e sem broadcast e o relatório.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (entregas) => `id,destino,transportadora,saida,chegada\n${entregas
  .map(([destino, transportadora, saida, chegada], i) => `${i + 1},${destino},${transportadora},2026-10-${saida},2026-10-${chegada}\n`).join('')}`;

const ENTREGAS = csv([
  ['Crato', 'Rapidão', '01', '03'], ['Sobral', 'Rapidão', '01', '06'], ['Recife', 'Asa Branca', '02', '04'],
  ['Crato', 'Asa Branca', '02', '06'], ['Natal', 'Rapidão', '03', '07'], ['Recife', 'Rapidão', '03', '08'],
]);
const ENTREGAS_OCULTO = csv([['Natal', 'Asa Branca', '10', '12'], ['Recife', 'Asa Branca', '10', '11'], ['Sobral', 'Rapidão', '11', '17']]);
const CIDADES = 'destino,uf\nCrato,CE\nSobral,CE\nRecife,PE\nNatal,RN\n';
const ROTAS = 'destino,prazo\nCrato,3\nSobral,4\nRecife,2\nNatal,3\n';

const PRAZO = ['id', 'destino', 'uf', 'transportadora', 'dias', 'prazo'];
const RELATORIO = ['transportadora', 'entregas', 'atrasadas', 'media_dias', 'pct_atraso'];

export const projetoLogistica = criarProjeto({
  id: 'logistica',
  titulo: 'Logística',
  icone: '🚚',
  descricao: 'As entregas das transportadoras: broadcast da tabela pequena, prazos, atrasos e o relatório.',
  resumo: `
    <p>Em <code>entregas.csv</code> está cada entrega: o destino, a transportadora e as datas de saída e de chegada.
      <code>cidades.csv</code> diz o estado de cada destino, e <code>rotas.csv</code>, o prazo em dias.</p>
    <p>As cidades são uma tabela <b>pequena</b>: em vez de embaralhar as entregas pela rede para o join (shuffle), o
      Spark manda uma cópia dela para cada tarefa, o <b>broadcast</b>.</p>
    <ol>
      <li>juntar com as cidades, por broadcast;</li>
      <li>os dias de viagem e o prazo de cada entrega;</li>
      <li>as entregas atrasadas;</li>
      <li>o plano com e sem broadcast;</li>
      <li>o relatório de cada transportadora.</li>
    </ol>`,
  dados: { 'entregas.csv': ENTREGAS, 'cidades.csv': CIDADES, 'rotas.csv': ROTAS },
  oculto: { 'entregas.csv': ENTREGAS_OCULTO },
  inicial: py`
    entregas = spark.read.csv("entregas.csv", header=True, inferSchema=True)
    cidades = spark.read.csv("cidades.csv", header=True, inferSchema=True)
    rotas = spark.read.csv("rotas.csv", header=True, inferSchema=True)
    entregas.show()
  `,
  etapas: [
    {
      titulo: 'Juntar com as cidades (broadcast)',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>com_cidade</code> as entregas juntadas com <code>cidades</code> pelo <code>destino</code>,
          mandando as cidades por <b>broadcast</b>. Veja no <code>explain()</code> o <code>BroadcastHashJoin</code>.</p>`,
      dica: 'entregas.join(F.broadcast(cidades), "destino")',
      codigo: py`
        com_cidade = entregas.join(F.broadcast(cidades), "destino")
        com_cidade.explain()
      `,
      regras: [{ plano: 'com_cidade', broadcast: true }, { dataframe: 'com_cidade', total: 6 }],
      regrasOcultas: [{ plano: 'com_cidade', broadcast: true }, { dataframe: 'com_cidade', total: 3 }],
    },
    {
      titulo: 'Dias de viagem e prazo',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>com_prazo</code> o <code>com_cidade</code> juntado com <code>rotas</code> e os dias de viagem
          (chegada menos saída): as colunas <code>id</code>, <code>destino</code>, <code>uf</code>,
          <code>transportadora</code>, <code>dias</code> e <code>prazo</code>.</p>`,
      dica: 'join(rotas, "destino"), F.datediff("chegada", "saida").alias("dias") e select na ordem pedida.',
      codigo: py`
        com_prazo = (com_cidade.join(rotas, "destino")
            .withColumn("dias", F.datediff("chegada", "saida"))
            .select("id", "destino", "uf", "transportadora", "dias", "prazo"))
        com_prazo.show()
      `,
      regras: [{
        dataframe: 'com_prazo',
        colunas: PRAZO,
        linhas: [
          [1, 'Crato', 'CE', 'Rapidão', 2, 3], [2, 'Sobral', 'CE', 'Rapidão', 5, 4], [3, 'Recife', 'PE', 'Asa Branca', 2, 2],
          [4, 'Crato', 'CE', 'Asa Branca', 4, 3], [5, 'Natal', 'RN', 'Rapidão', 4, 3], [6, 'Recife', 'PE', 'Rapidão', 5, 2],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'com_prazo',
        colunas: PRAZO,
        linhas: [[1, 'Natal', 'RN', 'Asa Branca', 2, 3], [2, 'Recife', 'PE', 'Asa Branca', 1, 2], [3, 'Sobral', 'CE', 'Rapidão', 6, 4]],
      }],
    },
    {
      titulo: 'As entregas atrasadas',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>atrasadas</code> as entregas que levaram mais dias que o prazo, com as colunas <code>id</code>,
          <code>destino</code>, <code>transportadora</code> e <code>atraso</code> (os dias além do prazo).</p>`,
      dica: 'filter(F.col("dias") > F.col("prazo")) e (F.col("dias") - F.col("prazo")).alias("atraso").',
      codigo: py`
        atrasadas = (com_prazo.filter(F.col("dias") > F.col("prazo"))
            .select("id", "destino", "transportadora", (F.col("dias") - F.col("prazo")).alias("atraso")))
        atrasadas.show()
      `,
      regras: [{
        dataframe: 'atrasadas',
        colunas: ['id', 'destino', 'transportadora', 'atraso'],
        linhas: [[2, 'Sobral', 'Rapidão', 1], [4, 'Crato', 'Asa Branca', 1], [5, 'Natal', 'Rapidão', 1], [6, 'Recife', 'Rapidão', 3]],
      }],
      regrasOcultas: [{ dataframe: 'atrasadas', colunas: ['id', 'destino', 'transportadora', 'atraso'], linhas: [[3, 'Sobral', 'Rapidão', 2]] }],
    },
    {
      titulo: 'O plano sem broadcast',
      dificuldade: 'dificil',
      enunciado: `
        <p>O Spark manda por broadcast, sozinho, as tabelas abaixo de 10 MB. Desligue isso
          (<code>spark.sql.autoBroadcastJoinThreshold</code> = -1) e guarde em <code>sem_broadcast</code> o join das
          entregas com as cidades <b>sem</b> o <code>broadcast()</code>. Compare os planos: o <code>com_cidade</code>, que
          pediu o broadcast, continua com ele; o <code>sem_broadcast</code> embaralha as duas tabelas (dois shuffles).</p>`,
      dica: 'spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1) antes do join; depois sem_broadcast.explain() e com_cidade.explain().',
      codigo: py`
        spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1)
        sem_broadcast = entregas.join(cidades, "destino")
        sem_broadcast.explain()
        com_cidade.explain()
      `,
      regras: [{ plano: 'sem_broadcast', broadcast: false, shuffles: 2 }, { plano: 'com_cidade', broadcast: true }],
    },
    {
      titulo: 'O relatório por transportadora',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>relatorio</code>, para cada transportadora, as colunas <code>transportadora</code>,
          <code>entregas</code>, <code>atrasadas</code>, <code>media_dias</code> (em 1 casa) e <code>pct_atraso</code> (a
          porcentagem de atrasadas, em 1 casa).</p>`,
      dica: 'Do com_prazo: F.count("*"), F.sum(F.when(F.col("dias") > F.col("prazo"), 1).otherwise(0)) e F.round(F.avg("dias"), 1); a porcentagem vem depois, com withColumn.',
      codigo: py`
        relatorio = (com_prazo.groupBy("transportadora").agg(
                F.count("*").alias("entregas"),
                F.sum(F.when(F.col("dias") > F.col("prazo"), 1).otherwise(0)).alias("atrasadas"),
                F.round(F.avg("dias"), 1).alias("media_dias"))
            .withColumn("pct_atraso", F.round(F.col("atrasadas") * 100 / F.col("entregas"), 1)))
        relatorio.show()
      `,
      regras: [{ dataframe: 'relatorio', colunas: RELATORIO, linhas: [['Asa Branca', 2, 1, 3.0, 50.0], ['Rapidão', 4, 3, 4.0, 75.0]] }],
      regrasOcultas: [{ dataframe: 'relatorio', colunas: RELATORIO, linhas: [['Asa Branca', 2, 0, 1.5, 0.0], ['Rapidão', 1, 1, 6.0, 100.0]] }],
    },
  ],
});
