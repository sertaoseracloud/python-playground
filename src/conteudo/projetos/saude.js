// 🏥 Saúde pública: os atendimentos de cada município, a média móvel de 7 dias, a variação da
// semana, os municípios em alta e o ranking de cada região.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const dia = (d) => `2026-10-${String(d + 1).padStart(2, '0')}`;
const csv = (municipios) => `municipio,regiao,dia,casos\n${Object.entries(municipios)
  .flatMap(([municipio, [regiao, casos]]) => casos.map((c, d) => `${municipio},${regiao},${dia(d)},${c}\n`)).join('')}`;
const porDia = (totais) => totais.map((c, d) => [dia(d), c]);

const ATENDIMENTOS = csv({
  Crato: ['Cariri', [5, 6, 5, 7, 6, 8, 7, 9, 10, 9, 11, 12, 11, 13]],
  Juazeiro: ['Cariri', [10, 12, 11, 10, 13, 12, 11, 10, 9, 11, 10, 9, 10, 8]],
  Barbalha: ['Cariri', [2, 3, 2, 2, 3, 2, 3, 3, 4, 3, 4, 5, 4, 5]],
  Sobral: ['Norte', [8, 8, 9, 8, 7, 8, 9, 8, 9, 8, 8, 9, 8, 8]],
});
const ATENDIMENTOS_OCULTO = csv({
  Iguatu: ['Centro-Sul', [3, 3, 4, 3, 4, 3, 4, 5, 6, 5, 7, 6, 7, 8]],
  Quixadá: ['Sertão Central', [6, 6, 5, 6, 7, 6, 6, 5, 5, 4, 5, 4, 4, 3]],
});

const MOVEL = ['municipio', 'dia', 'casos', 'media7'];
const VARIACAO = ['municipio', 'regiao', 'semana', 'anterior', 'variacao'];
const RANKING = ['regiao', 'municipio', 'media7', 'posicao'];

export const projetoSaude = criarProjeto({
  id: 'saude',
  titulo: 'Saúde pública',
  icone: '🏥',
  descricao: 'Os atendimentos dos municípios do Ceará: média móvel, variação da semana, municípios em alta e ranking.',
  resumo: `
    <p>A secretaria de saúde acompanha os atendimentos de um tipo de doença em cada município, dia a dia, em
      <code>atendimentos.csv</code> (14 dias, dados inventados). Um dia sozinho engana: um feriado derruba os números, e
      uma segunda-feira os infla. A <b>média móvel de 7 dias</b> alisa a curva.</p>
    <ol>
      <li>os casos de cada dia no estado;</li>
      <li>a média móvel de 7 dias de cada município;</li>
      <li>a variação da última semana sobre a anterior;</li>
      <li>os municípios em alta;</li>
      <li>o ranking de cada região pela média móvel.</li>
    </ol>`,
  dados: { 'atendimentos.csv': ATENDIMENTOS },
  oculto: { 'atendimentos.csv': ATENDIMENTOS_OCULTO },
  inicial: py`
    atendimentos = spark.read.csv("atendimentos.csv", header=True, inferSchema=True)
    atendimentos.show(5)
  `,
  etapas: [
    {
      titulo: 'Casos por dia',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>por_dia</code> os casos de cada dia somando todos os municípios, em ordem de dia: as colunas
          <code>dia</code> e <code>casos</code>.</p>`,
      dica: 'atendimentos.groupBy("dia").agg(F.sum("casos").alias("casos")).orderBy("dia")',
      codigo: py`
        por_dia = atendimentos.groupBy("dia").agg(F.sum("casos").alias("casos")).orderBy("dia")
        por_dia.show(14)
      `,
      regras: [{ dataframe: 'por_dia', colunas: ['dia', 'casos'], ordem: true, linhas: porDia([25, 29, 27, 27, 29, 30, 30, 30, 32, 31, 33, 35, 33, 34]) }],
      regrasOcultas: [{ dataframe: 'por_dia', colunas: ['dia', 'casos'], ordem: true, linhas: porDia([9, 9, 9, 9, 11, 9, 10, 10, 11, 9, 12, 10, 11, 11]) }],
    },
    {
      titulo: 'A média móvel de 7 dias',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>movel</code>, para cada município e dia, a média dos casos daquele dia e dos 6 anteriores
          (<code>media7</code>, em 1 casa): as colunas <code>municipio</code>, <code>dia</code>, <code>casos</code> e
          <code>media7</code>.</p>
        <p>Fique só com os dias que já têm 7 dias de histórico: nos 6 primeiros, a média ainda não é de uma semana.</p>`,
      dica: 'Uma janela Window.partitionBy("municipio").orderBy("dia").rowsBetween(-6, 0): F.avg e F.count sobre ela; filtre count == 7.',
      codigo: py`
        from pyspark.sql import Window

        sete = Window.partitionBy("municipio").orderBy("dia").rowsBetween(-6, 0)
        movel = (atendimentos
            .withColumn("media7", F.round(F.avg("casos").over(sete), 1))
            .withColumn("dias", F.count("casos").over(sete))
            .filter(F.col("dias") == 7)
            .select("municipio", "dia", "casos", "media7"))
        movel.show()
      `,
      regras: [{ dataframe: 'movel', colunas: MOVEL, total: 32 }],
      regrasOcultas: [{ dataframe: 'movel', colunas: MOVEL, total: 16 }],
    },
    {
      titulo: 'A variação da semana',
      dificuldade: 'medio',
      enunciado: `
        <p>No último dia, compare os casos dos últimos 7 dias (<code>semana</code>) com os dos 7 dias antes deles
          (<code>anterior</code>). Guarde em <code>variacao</code> uma linha por município, com as colunas
          <code>municipio</code>, <code>regiao</code>, <code>semana</code>, <code>anterior</code> e <code>variacao</code>
          (a diferença em %, 1 casa).</p>`,
      dica: 'F.sum("casos").over(sete) dá a semana; F.lag("semana", 7) numa janela por município em ordem de dia dá a anterior. O último dia sai de atendimentos.agg(F.max("dia")).first()[0].',
      codigo: py`
        ordem = Window.partitionBy("municipio").orderBy("dia")
        ultimo = atendimentos.agg(F.max("dia")).first()[0]
        variacao = (atendimentos
            .withColumn("semana", F.sum("casos").over(sete))
            .withColumn("anterior", F.lag("semana", 7).over(ordem))
            .filter(F.col("dia") == ultimo)
            .select("municipio", "regiao", "semana", "anterior",
                    F.round((F.col("semana") - F.col("anterior")) * 100 / F.col("anterior"), 1).alias("variacao")))
        variacao.show()
      `,
      regras: [{
        dataframe: 'variacao',
        colunas: VARIACAO,
        linhas: [['Crato', 'Cariri', 75, 44, 70.5], ['Barbalha', 'Cariri', 28, 17, 64.7], ['Sobral', 'Norte', 58, 57, 1.8], ['Juazeiro', 'Cariri', 67, 79, -15.2]],
      }],
      regrasOcultas: [{
        dataframe: 'variacao',
        colunas: VARIACAO,
        linhas: [['Quixadá', 'Sertão Central', 30, 42, -28.6], ['Iguatu', 'Centro-Sul', 44, 24, 83.3]],
      }],
    },
    {
      titulo: 'Municípios em alta',
      dificuldade: 'dificil',
      enunciado: `
        <p>Um município está <b>em alta</b> quando a semana passou da anterior em mais de 10%. Guarde em <code>em_alta</code>
          esses municípios, com as colunas <code>municipio</code> e <code>variacao</code>, da maior alta para a menor.</p>`,
      dica: 'variacao.filter(F.col("variacao") > 10).select("municipio", "variacao").orderBy(F.desc("variacao"))',
      codigo: py`
        em_alta = (variacao.filter(F.col("variacao") > 10)
            .select("municipio", "variacao")
            .orderBy(F.desc("variacao")))
        em_alta.show()
      `,
      regras: [{ dataframe: 'em_alta', colunas: ['municipio', 'variacao'], ordem: true, linhas: [['Crato', 70.5], ['Barbalha', 64.7]] }],
      regrasOcultas: [{ dataframe: 'em_alta', colunas: ['municipio', 'variacao'], ordem: true, linhas: [['Iguatu', 83.3]] }],
    },
    {
      titulo: 'O ranking de cada região',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>ranking</code> a posição de cada município na sua região pela média móvel do último dia (1 para a
          maior): as colunas <code>regiao</code>, <code>municipio</code>, <code>media7</code> e <code>posicao</code>.</p>`,
      dica: 'Do movel, fique com o último dia e junte a região (atendimentos.select("municipio", "regiao").distinct()); F.rank() numa janela por região em ordem decrescente de media7.',
      codigo: py`
        regioes = atendimentos.select("municipio", "regiao").distinct()
        hoje = movel.filter(F.col("dia") == ultimo).join(regioes, "municipio")
        ranking = hoje.select("regiao", "municipio", "media7",
            F.rank().over(Window.partitionBy("regiao").orderBy(F.desc("media7"))).alias("posicao"))
        ranking.orderBy("regiao", "posicao").show()
      `,
      regras: [{
        dataframe: 'ranking',
        colunas: RANKING,
        linhas: [['Norte', 'Sobral', 8.3, 1], ['Cariri', 'Crato', 10.7, 1], ['Cariri', 'Juazeiro', 9.6, 2], ['Cariri', 'Barbalha', 4.0, 3]],
      }],
      regrasOcultas: [{
        dataframe: 'ranking',
        colunas: RANKING,
        linhas: [['Centro-Sul', 'Iguatu', 6.3, 1], ['Sertão Central', 'Quixadá', 4.3, 1]],
      }],
    },
  ],
});
