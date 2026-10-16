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
