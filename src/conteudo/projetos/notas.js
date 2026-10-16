// 📝 Notas de exame (sintéticas): tirar as faltas, médias por turma, percentis da escola, a faixa
// de cada aluno e as turmas acima da mediana.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const NOTAS = `aluno,turma,nota
Ana,A,9.0
Bia,A,7.0
Caio,A,
Davi,A,5.0
Edu,B,6.0
Fia,B,8.0
Gil,B,4.0
Hana,B,
Ivo,C,10.0
Jade,C,3.0
`;
const NOTAS_OCULTO = `aluno,turma,nota
Lia,A,6.0
Mel,A,
Nina,B,9.0
Olga,B,7.0
Paulo,B,8.0
Rui,C,5.0
`;

const PERCENTIS = ['p25', 'p50', 'p75', 'p90'];

export const projetoNotas = criarProjeto({
  id: 'notas',
  titulo: 'Notas de exame',
  icone: '📝',
  descricao: 'As notas de uma escola (inventadas): faltas, médias, percentis, a faixa de cada aluno e as turmas acima da mediana.',
  resumo: `
    <p>A escola quer entender as notas do exame. Em <code>notas.csv</code> está a nota de cada aluno; quem faltou está
      com a nota vazia. As notas são inventadas para o exercício.</p>
    <p>A média é puxada por notas muito altas ou muito baixas; os <b>percentis</b> contam outra história: o percentil 25 é
      a nota que deixa um quarto da turma abaixo, e o 50 é a <b>mediana</b>.</p>
    <ol>
      <li>ler e tirar as faltas;</li>
      <li>a média de cada turma;</li>
      <li>os percentis 25, 50, 75 e 90 da escola;</li>
      <li>a faixa de cada aluno;</li>
      <li>as turmas acima da mediana da escola.</li>
    </ol>`,
  dados: { 'notas.csv': NOTAS },
  oculto: { 'notas.csv': NOTAS_OCULTO },
  inicial: py`
    notas = spark.read.csv("notas.csv", header=True, inferSchema=True)
    notas.show()
  `,
  etapas: [
    {
      titulo: 'Tirar as faltas',
      dificuldade: 'facil',
      enunciado: '<p>Guarde em <code>presentes</code> só os alunos que fizeram o exame (com nota), com as mesmas colunas.</p>',
      dica: 'notas.dropna(subset=["nota"])',
      codigo: py`
        presentes = notas.dropna(subset=["nota"])
        presentes.show()
      `,
      regras: [{
        dataframe: 'presentes',
        colunas: ['aluno', 'turma', 'nota'],
        linhas: [['Ana', 'A', 9.0], ['Bia', 'A', 7.0], ['Davi', 'A', 5.0], ['Edu', 'B', 6.0], ['Fia', 'B', 8.0], ['Gil', 'B', 4.0], ['Ivo', 'C', 10.0], ['Jade', 'C', 3.0]],
      }],
      regrasOcultas: [{
        dataframe: 'presentes',
        colunas: ['aluno', 'turma', 'nota'],
        linhas: [['Lia', 'A', 6.0], ['Nina', 'B', 9.0], ['Olga', 'B', 7.0], ['Paulo', 'B', 8.0], ['Rui', 'C', 5.0]],
      }],
    },
    {
      titulo: 'A média de cada turma',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>medias</code>, para cada turma, a média das notas (<code>media</code>, em 2 casas) e quantos alunos
          fizeram o exame (<code>alunos</code>): as colunas <code>turma</code>, <code>media</code> e <code>alunos</code>.</p>`,
      dica: 'presentes.groupBy("turma").agg(F.round(F.avg("nota"), 2).alias("media"), F.count("*").alias("alunos"))',
      codigo: py`
        medias = presentes.groupBy("turma").agg(F.round(F.avg("nota"), 2).alias("media"), F.count("*").alias("alunos"))
        medias.orderBy("turma").show()
      `,
      regras: [{ dataframe: 'medias', colunas: ['turma', 'media', 'alunos'], linhas: [['A', 7.0, 3], ['B', 6.0, 3], ['C', 6.5, 2]] }],
      regrasOcultas: [{ dataframe: 'medias', colunas: ['turma', 'media', 'alunos'], linhas: [['A', 6.0, 1], ['B', 8.0, 3], ['C', 5.0, 1]] }],
    },
    {
      titulo: 'Os percentis da escola',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>percentis</code> um DataFrame de uma linha com os percentis 25, 50, 75 e 90 das notas da escola
          toda: as colunas <code>p25</code>, <code>p50</code>, <code>p75</code> e <code>p90</code>.</p>`,
      dica: 'presentes.agg(F.percentile_approx("nota", 0.25).alias("p25"), …): o percentual vai de 0 a 1.',
      codigo: py`
        percentis = presentes.agg(
            F.percentile_approx("nota", 0.25).alias("p25"),
            F.percentile_approx("nota", 0.5).alias("p50"),
            F.percentile_approx("nota", 0.75).alias("p75"),
            F.percentile_approx("nota", 0.9).alias("p90"))
        percentis.show()
      `,
      regras: [{ dataframe: 'percentis', colunas: PERCENTIS, linhas: [[4.0, 6.0, 8.0, 10.0]] }],
      regrasOcultas: [{ dataframe: 'percentis', colunas: PERCENTIS, linhas: [[6.0, 7.0, 8.0, 9.0]] }],
    },
    {
      titulo: 'A faixa de cada aluno',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>faixas</code> as colunas <code>aluno</code>, <code>turma</code>, <code>nota</code> e
          <code>faixa</code>, com a faixa pelos percentis da escola:</p>
        <ul>
          <li>abaixo do p25: <code>reforço</code>;</li>
          <li>abaixo do p50: <code>regular</code>;</li>
          <li>abaixo do p75: <code>bom</code>;</li>
          <li>do p75 para cima: <code>ótimo</code>.</li>
        </ul>`,
      dica: 'presentes.crossJoin(percentis) põe os percentis em toda linha; depois, F.when(…).when(…).otherwise("ótimo").',
      codigo: py`
        faixa = (F.when(F.col("nota") < F.col("p25"), "reforço")
            .when(F.col("nota") < F.col("p50"), "regular")
            .when(F.col("nota") < F.col("p75"), "bom")
            .otherwise("ótimo"))
        faixas = presentes.crossJoin(percentis).select("aluno", "turma", "nota", faixa.alias("faixa"))
        faixas.show()
      `,
      regras: [{
        dataframe: 'faixas',
        colunas: ['aluno', 'turma', 'nota', 'faixa'],
        linhas: [
          ['Ana', 'A', 9.0, 'ótimo'], ['Bia', 'A', 7.0, 'bom'], ['Davi', 'A', 5.0, 'regular'], ['Edu', 'B', 6.0, 'bom'],
          ['Fia', 'B', 8.0, 'ótimo'], ['Gil', 'B', 4.0, 'regular'], ['Ivo', 'C', 10.0, 'ótimo'], ['Jade', 'C', 3.0, 'reforço'],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'faixas',
        colunas: ['aluno', 'turma', 'nota', 'faixa'],
        linhas: [['Lia', 'A', 6.0, 'regular'], ['Nina', 'B', 9.0, 'ótimo'], ['Olga', 'B', 7.0, 'bom'], ['Paulo', 'B', 8.0, 'ótimo'], ['Rui', 'C', 5.0, 'reforço']],
      }],
    },
    {
      titulo: 'Turmas acima da mediana',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>acima</code> as turmas cuja mediana passa da mediana da escola (o <code>p50</code>), com as
          colunas <code>turma</code>, <code>mediana</code> e <code>diferenca</code> (a mediana da turma menos a da
          escola).</p>`,
      dica: 'A mediana da escola sai de percentis.first().p50; a de cada turma, de groupBy("turma") com F.percentile_approx("nota", 0.5).',
      codigo: py`
        mediana_geral = percentis.first().p50
        acima = (presentes.groupBy("turma")
            .agg(F.percentile_approx("nota", 0.5).alias("mediana"))
            .filter(F.col("mediana") > mediana_geral)
            .withColumn("diferenca", F.col("mediana") - mediana_geral))
        acima.show()
      `,
      regras: [{ dataframe: 'acima', colunas: ['turma', 'mediana', 'diferenca'], linhas: [['A', 7.0, 1.0]] }],
      regrasOcultas: [{ dataframe: 'acima', colunas: ['turma', 'mediana', 'diferenca'], linhas: [['B', 8.0, 1.0]] }],
    },
  ],
});
