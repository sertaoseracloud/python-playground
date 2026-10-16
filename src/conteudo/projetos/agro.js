// 🌾 Agronegócio: as safras do Nordeste por cultura, estado e ano. Pivot para a tabela cultura ×
// ano, crescimento ano a ano, os estados líderes e o unpivot de volta para o formato longo.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (safras) => `cultura,estado,ano,toneladas\n${Object.entries(safras).flatMap(([chave, valores]) => {
  const [cultura, estado] = chave.split('/');
  return valores.map((t, i) => `${cultura},${estado},${2023 + i},${t}\n`);
}).join('')}`;

const SAFRAS = csv({
  'milho/BA': [10, 12, 15], 'milho/CE': [5, 4, 6], 'milho/PI': [8, 9, 9],
  'soja/BA': [20, 22, 21], 'soja/CE': [1, 1, 2], 'soja/PI': [15, 18, 20],
  'feijão/BA': [3, 3, 4], 'feijão/CE': [6, 7, 5], 'feijão/PI': [2, 3, 3],
});
const SAFRAS_OCULTO = csv({
  'algodão/MA': [4, 5, 7], 'algodão/RN': [2, 2, 1],
  'mandioca/MA': [9, 8, 10], 'mandioca/RN': [6, 7, 7],
});

const LARGO = ['cultura', '2023', '2024', '2025'];

export const projetoAgro = criarProjeto({
  id: 'agro',
  titulo: 'Agronegócio',
  icone: '🌾',
  descricao: 'As safras do Nordeste: pivot de cultura por ano, crescimento, estados líderes e unpivot.',
  resumo: `
    <p>Em <code>safras.csv</code> está a produção de cada cultura em cada estado e ano, em mil toneladas (números
      inventados). É o formato <b>longo</b>: uma linha por combinação. Para ler de olho, o relatório quer o formato
      <b>largo</b>: uma linha por cultura, uma coluna por ano. O <code>pivot</code> faz a ida, e o <code>unpivot</code>
      (no SQL do Spark, <code>stack</code>), a volta.</p>
    <ol>
      <li>a produção total de cada cultura;</li>
      <li>a tabela cultura × ano, com <code>pivot</code>;</li>
      <li>o crescimento de cada ano sobre o anterior;</li>
      <li>o estado líder de cada cultura;</li>
      <li>de volta ao formato longo, com <code>unpivot</code>.</li>
    </ol>`,
  dados: { 'safras.csv': SAFRAS },
  oculto: { 'safras.csv': SAFRAS_OCULTO },
  inicial: py`
    safras = spark.read.csv("safras.csv", header=True, inferSchema=True)
    safras.show()
  `,
  etapas: [
    {
      titulo: 'Produção por cultura',
      dificuldade: 'facil',
      enunciado: '<p>Guarde em <code>por_cultura</code> a produção somada de cada cultura: as colunas <code>cultura</code> e <code>toneladas</code>.</p>',
      dica: 'safras.groupBy("cultura").agg(F.sum("toneladas").alias("toneladas"))',
      codigo: py`
        por_cultura = safras.groupBy("cultura").agg(F.sum("toneladas").alias("toneladas"))
        por_cultura.show()
      `,
      regras: [{ dataframe: 'por_cultura', colunas: ['cultura', 'toneladas'], linhas: [['milho', 78], ['soja', 120], ['feijão', 36]] }],
      regrasOcultas: [{ dataframe: 'por_cultura', colunas: ['cultura', 'toneladas'], linhas: [['algodão', 21], ['mandioca', 47]] }],
    },
    {
      titulo: 'Cultura × ano',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_ano</code> uma linha por cultura e uma coluna por ano (<code>2023</code>, <code>2024</code> e
          <code>2025</code>, nessa ordem), com a produção somada dos estados.</p>`,
      dica: 'safras.groupBy("cultura").pivot("ano", [2023, 2024, 2025]).sum("toneladas"): passar os anos fixa as colunas e a ordem.',
      codigo: py`
        por_ano = safras.groupBy("cultura").pivot("ano", [2023, 2024, 2025]).sum("toneladas")
        por_ano.show()
      `,
      regras: [{ dataframe: 'por_ano', colunas: LARGO, linhas: [['soja', 36, 41, 43], ['feijão', 11, 13, 12], ['milho', 23, 25, 30]] }],
      regrasOcultas: [{ dataframe: 'por_ano', colunas: LARGO, linhas: [['mandioca', 15, 15, 17], ['algodão', 6, 7, 8]] }],
    },
    {
      titulo: 'Crescimento ano a ano',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>crescimento</code>, para cada cultura e ano a partir de 2024, a produção do ano e quanto ela cresceu
          sobre o ano anterior (em %, 1 casa): as colunas <code>cultura</code>, <code>ano</code>, <code>toneladas</code> e
          <code>crescimento</code>.</p>`,
      dica: 'Some por cultura e ano; F.lag("toneladas") numa janela por cultura em ordem de ano dá o ano anterior. Tire o primeiro ano (anterior nulo).',
      codigo: py`
        from pyspark.sql import Window

        total_ano = safras.groupBy("cultura", "ano").agg(F.sum("toneladas").alias("toneladas"))
        por_cultura_ano = Window.partitionBy("cultura").orderBy("ano")
        crescimento = (total_ano
            .withColumn("anterior", F.lag("toneladas").over(por_cultura_ano))
            .filter(F.col("anterior").isNotNull())
            .select("cultura", "ano", "toneladas",
                    F.round((F.col("toneladas") - F.col("anterior")) * 100 / F.col("anterior"), 1).alias("crescimento")))
        crescimento.orderBy("cultura", "ano").show()
      `,
      regras: [{
        dataframe: 'crescimento',
        colunas: ['cultura', 'ano', 'toneladas', 'crescimento'],
        linhas: [['soja', 2024, 41, 13.9], ['soja', 2025, 43, 4.9], ['feijão', 2024, 13, 18.2], ['feijão', 2025, 12, -7.7], ['milho', 2024, 25, 8.7], ['milho', 2025, 30, 20.0]],
      }],
      regrasOcultas: [{
        dataframe: 'crescimento',
        colunas: ['cultura', 'ano', 'toneladas', 'crescimento'],
        linhas: [['mandioca', 2024, 15, 0.0], ['mandioca', 2025, 17, 13.3], ['algodão', 2024, 7, 16.7], ['algodão', 2025, 8, 14.3]],
      }],
    },
    {
      titulo: 'Os estados líderes',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>lideres</code> o estado que mais produziu cada cultura nos três anos somados: as colunas
          <code>cultura</code>, <code>estado</code> e <code>toneladas</code>. No empate, vence o estado em ordem alfabética.</p>`,
      dica: 'Some por cultura e estado; F.row_number() numa janela por cultura em ordem decrescente de toneladas (e estado); fique com o 1.',
      codigo: py`
        por_estado = safras.groupBy("cultura", "estado").agg(F.sum("toneladas").alias("toneladas"))
        lider = Window.partitionBy("cultura").orderBy(F.desc("toneladas"), "estado")
        lideres = (por_estado.withColumn("n", F.row_number().over(lider))
            .filter(F.col("n") == 1)
            .select("cultura", "estado", "toneladas"))
        lideres.show()
      `,
      regras: [{ dataframe: 'lideres', colunas: ['cultura', 'estado', 'toneladas'], linhas: [['soja', 'BA', 63], ['feijão', 'CE', 18], ['milho', 'BA', 37]] }],
      regrasOcultas: [{ dataframe: 'lideres', colunas: ['cultura', 'estado', 'toneladas'], linhas: [['mandioca', 'MA', 27], ['algodão', 'MA', 16]] }],
    },
    {
      titulo: 'De volta ao formato longo',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>longo</code> o <code>por_ano</code> de volta ao formato longo, com as colunas <code>cultura</code>,
          <code>ano</code> (inteiro) e <code>toneladas</code>, em ordem de ano e de cultura.</p>`,
      dica: 'por_ano.unpivot("cultura", ["2023", "2024", "2025"], "ano", "toneladas"); o ano sai como texto: .cast("int").',
      codigo: py`
        longo = (por_ano.unpivot("cultura", ["2023", "2024", "2025"], "ano", "toneladas")
            .withColumn("ano", F.col("ano").cast("int"))
            .orderBy("ano", "cultura"))
        longo.show()
      `,
      regras: [{
        dataframe: 'longo',
        colunas: ['cultura', 'ano', 'toneladas'],
        tipos: ['string', 'int', 'bigint'],
        ordem: true,
        linhas: [
          ['feijão', 2023, 11], ['milho', 2023, 23], ['soja', 2023, 36], ['feijão', 2024, 13], ['milho', 2024, 25], ['soja', 2024, 41],
          ['feijão', 2025, 12], ['milho', 2025, 30], ['soja', 2025, 43],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'longo',
        colunas: ['cultura', 'ano', 'toneladas'],
        tipos: ['string', 'int', 'bigint'],
        ordem: true,
        linhas: [['algodão', 2023, 6], ['mandioca', 2023, 15], ['algodão', 2024, 7], ['mandioca', 2024, 15], ['algodão', 2025, 8], ['mandioca', 2025, 17]],
      }],
    },
  ],
});
