// ☀️ Energia solar: a geração de hora em hora de duas usinas, com horas que não chegaram (lacunas)
// e leituras vazias, que são preenchidas com a última leitura boa.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

// Cada série: usina, dia e as leituras das 9h às 14h. null = leitura vazia; FALTA = a hora não chegou.
const FALTA = 'falta';
const hora = (h) => String(9 + h).padStart(2, '0');
const csv = (series) => `usina,momento,kwh\n${series.flatMap(([usina, dia, leituras]) => leituras
  .map((kwh, h) => (kwh === FALTA ? '' : `${usina},2026-10-${dia} ${hora(h)}:00:00,${kwh ?? ''}\n`))).join('')}`;

const GERACAO = csv([
  ['Juazeiro', '01', [10, 20, 30, 35, 25, 15]],
  ['Juazeiro', '02', [12, null, 28, FALTA, 30, 18]],
  ['Tauá', '01', [8, 16, 24, null, 22, FALTA]],
  ['Tauá', '02', [9, 18, 27, 33, 26, 14]],
]);
const GERACAO_OCULTO = csv([
  ['Quixadá', '01', [5, null, 15, 20, null, 10]],
  ['Quixadá', '02', [6, 12, FALTA, 22, 18, FALTA]],
]);

export const projetoEnergia = criarProjeto({
  id: 'energia',
  titulo: 'Energia solar',
  icone: '☀️',
  descricao: 'A geração das usinas solares do sertão: por dia, o pico, as lacunas, o preenchimento e o acumulado.',
  resumo: `
    <p>As usinas solares mandam a geração de hora em hora, das 9h às 14h, em <code>geracao.csv</code> (kWh, números
      inventados). Mas a rede falha: às vezes a hora <b>não chega</b> (uma lacuna na série) e às vezes chega
      <b>vazia</b> (o sensor não leu).</p>
    <ol>
      <li>a geração de cada usina por dia;</li>
      <li>a hora de pico de cada dia;</li>
      <li>as horas que não chegaram;</li>
      <li>as leituras vazias, preenchidas com a última leitura boa;</li>
      <li>o acumulado do mês, com as leituras preenchidas.</li>
    </ol>`,
  dados: { 'geracao.csv': GERACAO },
  oculto: { 'geracao.csv': GERACAO_OCULTO },
  inicial: py`
    geracao = spark.read.csv("geracao.csv", header=True, inferSchema=True)
    geracao.show()
  `,
  etapas: [
    {
      titulo: 'Geração por dia',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>leituras</code> a geração com mais duas colunas: <code>dia</code> (a data do momento) e
          <code>hora</code>. Depois, guarde em <code>por_dia</code> o total de cada usina em cada dia: as colunas
          <code>usina</code>, <code>dia</code> e <code>kwh</code>. A leitura vazia não soma.</p>`,
      dica: 'F.to_date("momento") e F.hour("momento"); depois groupBy("usina", "dia").agg(F.sum("kwh").alias("kwh")).',
      codigo: py`
        leituras = geracao.withColumn("dia", F.to_date("momento")).withColumn("hora", F.hour("momento"))
        por_dia = leituras.groupBy("usina", "dia").agg(F.sum("kwh").alias("kwh"))
        por_dia.orderBy("usina", "dia").show()
      `,
      regras: [{
        dataframe: 'por_dia',
        colunas: ['usina', 'dia', 'kwh'],
        linhas: [['Juazeiro', '2026-10-01', 135], ['Juazeiro', '2026-10-02', 88], ['Tauá', '2026-10-01', 70], ['Tauá', '2026-10-02', 127]],
      }],
      regrasOcultas: [{ dataframe: 'por_dia', colunas: ['usina', 'dia', 'kwh'], linhas: [['Quixadá', '2026-10-01', 50], ['Quixadá', '2026-10-02', 58]] }],
    },
    {
      titulo: 'O pico do dia',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>picos</code> a hora em que cada usina mais gerou em cada dia: as colunas <code>usina</code>,
          <code>dia</code>, <code>hora</code> e <code>kwh</code>.</p>`,
      dica: 'F.row_number() numa janela por usina e dia em ordem decrescente de kwh; fique com a linha 1.',
      codigo: py`
        from pyspark.sql import Window

        maior = Window.partitionBy("usina", "dia").orderBy(F.desc("kwh"))
        picos = (leituras.withColumn("n", F.row_number().over(maior))
            .filter(F.col("n") == 1)
            .select("usina", "dia", "hora", "kwh"))
        picos.show()
      `,
      regras: [{
        dataframe: 'picos',
        colunas: ['usina', 'dia', 'hora', 'kwh'],
        linhas: [['Juazeiro', '2026-10-01', 12, 35], ['Juazeiro', '2026-10-02', 13, 30], ['Tauá', '2026-10-01', 11, 24], ['Tauá', '2026-10-02', 12, 33]],
      }],
      regrasOcultas: [{ dataframe: 'picos', colunas: ['usina', 'dia', 'hora', 'kwh'], linhas: [['Quixadá', '2026-10-01', 12, 20], ['Quixadá', '2026-10-02', 12, 22]] }],
    },
    {
      titulo: 'As lacunas',
      dificuldade: 'medio',
      enunciado: `
        <p>Toda usina deveria mandar as 6 horas (9h a 14h) de cada dia. Guarde em <code>lacunas</code> as horas que não
          chegaram: as colunas <code>usina</code>, <code>dia</code> e <code>hora</code>. A hora que chegou vazia não é
          lacuna.</p>`,
      dica: 'Monte a grade esperada: leituras.select("usina", "dia").distinct().crossJoin(spark.range(9, 15).withColumnRenamed("id", "hora")); depois, left_anti com o que chegou.',
      codigo: py`
        grade = (leituras.select("usina", "dia").distinct()
            .crossJoin(spark.range(9, 15).withColumnRenamed("id", "hora")))
        lacunas = grade.join(leituras.select("usina", "dia", "hora"), ["usina", "dia", "hora"], "left_anti")
        lacunas.show()
      `,
      regras: [{ dataframe: 'lacunas', colunas: ['usina', 'dia', 'hora'], linhas: [['Juazeiro', '2026-10-02', 12], ['Tauá', '2026-10-01', 14]] }],
      regrasOcultas: [{ dataframe: 'lacunas', colunas: ['usina', 'dia', 'hora'], linhas: [['Quixadá', '2026-10-02', 11], ['Quixadá', '2026-10-02', 14]] }],
    },
    {
      titulo: 'Preencher com a última leitura',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>preenchida</code> as leituras com a coluna <code>kwh_ok</code>: o próprio kWh ou, se ele estiver
          vazio, a última leitura boa da mesma usina antes dele. Depois, guarde em <code>consertadas</code> só as linhas
          que estavam vazias, com as colunas <code>usina</code>, <code>momento</code> e <code>kwh_ok</code>.</p>`,
      dica: 'F.last("kwh", ignorenulls=True) numa janela por usina em ordem de momento, de Window.unboundedPreceding até 0; F.coalesce("kwh", …).',
      codigo: py`
        ate_agora = Window.partitionBy("usina").orderBy("momento").rowsBetween(Window.unboundedPreceding, 0)
        preenchida = leituras.withColumn("kwh_ok", F.coalesce("kwh", F.last("kwh", ignorenulls=True).over(ate_agora)))
        consertadas = preenchida.filter(F.col("kwh").isNull()).select("usina", "momento", "kwh_ok")
        consertadas.show()
      `,
      regras: [{
        dataframe: 'consertadas',
        colunas: ['usina', 'momento', 'kwh_ok'],
        linhas: [['Juazeiro', '2026-10-02 10:00:00', 12], ['Tauá', '2026-10-01 12:00:00', 24]],
      }],
      regrasOcultas: [{
        dataframe: 'consertadas',
        colunas: ['usina', 'momento', 'kwh_ok'],
        linhas: [['Quixadá', '2026-10-01 10:00:00', 5], ['Quixadá', '2026-10-01 13:00:00', 20]],
      }],
    },
    {
      titulo: 'O acumulado do mês',
      dificuldade: 'dificil',
      enunciado: `
        <p>Com as leituras preenchidas, guarde em <code>acumulado</code> a geração de cada usina por dia (<code>kwh</code>) e o
          total desde o começo do mês até aquele dia (<code>acumulado</code>): as colunas <code>usina</code>,
          <code>dia</code>, <code>kwh</code> e <code>acumulado</code>.</p>`,
      dica: 'Some kwh_ok por usina e dia; depois F.sum("kwh").over(Window.partitionBy("usina").orderBy("dia").rowsBetween(Window.unboundedPreceding, 0)).',
      codigo: py`
        dia_ok = preenchida.groupBy("usina", "dia").agg(F.sum("kwh_ok").alias("kwh"))
        no_mes = Window.partitionBy("usina").orderBy("dia").rowsBetween(Window.unboundedPreceding, 0)
        acumulado = dia_ok.withColumn("acumulado", F.sum("kwh").over(no_mes))
        acumulado.orderBy("usina", "dia").show()
      `,
      regras: [{
        dataframe: 'acumulado',
        colunas: ['usina', 'dia', 'kwh', 'acumulado'],
        linhas: [['Juazeiro', '2026-10-01', 135, 135], ['Juazeiro', '2026-10-02', 100, 235], ['Tauá', '2026-10-01', 94, 94], ['Tauá', '2026-10-02', 127, 221]],
      }],
      regrasOcultas: [{
        dataframe: 'acumulado',
        colunas: ['usina', 'dia', 'kwh', 'acumulado'],
        linhas: [['Quixadá', '2026-10-01', 75, 75], ['Quixadá', '2026-10-02', 58, 133]],
      }],
    },
  ],
});
