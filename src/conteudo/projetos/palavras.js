// 📚 Contagem de palavras em livros: o "olá, mundo" do Spark, de ponta a ponta. Os livros são
// versos curtos escritos por nós, no estilo do cordel.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const SECA = 'No sertão a seca é dura,\na seca racha o chão.\nMas o povo do sertão\nespera a chuva, chuva no sertão!\n';
const MAR = 'O mar é grande, o mar é bom.\nJangada vai no mar\ne volta com o peixe, peixe bom!\n';
const SECA_OCULTO = 'Choveu no sertão, choveu!\nO rio voltou a correr.\n';
const MAR_OCULTO = 'A rede no mar, a rede na areia.\n';
const VAZIAS = ['a', 'o', 'e', 'é', 'de', 'do', 'da', 'no', 'na', 'que', 'um', 'uma', 'com', 'em', 'mas'].join('\n') + '\n';

const SECA_ID = 'cordel-da-seca';
const MAR_ID = 'cordel-do-mar';

export const projetoPalavras = criarProjeto({
  id: 'palavras',
  titulo: 'Contagem de palavras em livros',
  icone: '📚',
  descricao: 'Ler livros de cordel, limpar o texto, contar as palavras e achar as mais usadas de cada livro.',
  resumo: `
    <p>O clássico do Spark, de ponta a ponta: quais palavras mais aparecem em cada livro? Os livros são versos curtos,
      no estilo do cordel, na pasta <code>livros/</code>; a lista de <b>palavras vazias</b> (a, o, de, que…) está em
      <code>vazias.txt</code>. Veja os arquivos na aba <b>📦 Dados</b>.</p>
    <p>Cada etapa continua do código da anterior, como num pipeline de verdade:</p>
    <ol>
      <li>ler os livros, um por linha da tabela;</li>
      <li>normalizar o texto (minúsculas, sem pontuação) e quebrar em palavras;</li>
      <li>contar as palavras de cada livro;</li>
      <li>tirar as palavras vazias;</li>
      <li>ficar com as 3 mais frequentes de cada livro.</li>
    </ol>
    <p>A correção roda o seu pipeline com estes livros e, no envio, com outros livros de mesmo nome.</p>`,
  dados: { [`livros/${SECA_ID}.txt`]: SECA, [`livros/${MAR_ID}.txt`]: MAR, 'vazias.txt': VAZIAS },
  oculto: { [`livros/${SECA_ID}.txt`]: SECA_OCULTO, [`livros/${MAR_ID}.txt`]: MAR_OCULTO },
  inicial: py`
    import os

    print(sorted(os.listdir("livros")))
  `,
  etapas: [
    {
      titulo: 'Ler os livros',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia cada arquivo da pasta <code>livros</code> inteiro e guarde em <code>livros</code> um DataFrame com as colunas
          <code>livro</code> (o nome do arquivo, sem a pasta e sem o <code>.txt</code>) e <code>texto</code> (o conteúdo).</p>
        <p>Uma linha por livro: <code>cordel-da-seca</code> e <code>cordel-do-mar</code>.</p>`,
      dica: 'spark.sparkContext.wholeTextFiles("livros") dá pares (caminho, texto); .toDF(["caminho", "texto"]) e F.regexp_extract("caminho", r"([^/]+)\\.txt$", 1) tiram o nome.',
      codigo: py`
        arquivos = spark.sparkContext.wholeTextFiles("livros")
        livros = arquivos.toDF(["caminho", "texto"]).select(
            F.regexp_extract("caminho", r"([^/]+)\\.txt$", 1).alias("livro"), "texto")
        livros.select("livro").show()
      `,
      regras: [{ dataframe: 'livros', colunas: ['livro', 'texto'], linhas: [[SECA_ID, SECA], [MAR_ID, MAR]] }],
      regrasOcultas: [{ dataframe: 'livros', colunas: ['livro', 'texto'], linhas: [[SECA_ID, SECA_OCULTO], [MAR_ID, MAR_OCULTO]] }],
    },
    {
      titulo: 'Normalizar e quebrar em palavras',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>palavras</code> uma linha por palavra, com as colunas <code>livro</code> e <code>palavra</code>.</p>
        <p>Antes de quebrar, passe o texto para minúsculas e tire a pontuação (<code>. , ; : ! ?</code>). Quebre nos
          espaços e nas quebras de linha, e não deixe palavra vazia.</p>`,
      dica: 'F.lower, F.regexp_replace(texto, r"[.,;:!?]", ""), F.split(texto, r"\\s+") e F.explode; depois, filter(F.col("palavra") != "").',
      codigo: py`
        limpo = F.regexp_replace(F.lower("texto"), r"[.,;:!?]", "")
        palavras = (livros
            .select("livro", F.explode(F.split(limpo, r"\\s+")).alias("palavra"))
            .filter(F.col("palavra") != ""))
        palavras.show()
      `,
      regras: [{ dataframe: 'palavras', colunas: ['livro', 'palavra'], total: 41 }],
      regrasOcultas: [{ dataframe: 'palavras', colunas: ['livro', 'palavra'], total: 17 }],
    },
    {
      titulo: 'Contar as palavras',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>contagem</code> quantas vezes cada palavra aparece em cada livro: as colunas <code>livro</code>,
          <code>palavra</code> e <code>count</code>.</p>`,
      dica: 'palavras.groupBy("livro", "palavra").count()',
      codigo: py`
        contagem = palavras.groupBy("livro", "palavra").count()
        contagem.orderBy(F.desc("count")).show()
      `,
      regras: [{ dataframe: 'contagem', colunas: ['livro', 'palavra', 'count'], total: 26 }],
      regrasOcultas: [{ dataframe: 'contagem', colunas: ['livro', 'palavra', 'count'], total: 14 }],
    },
    {
      titulo: 'Tirar as palavras vazias',
      dificuldade: 'dificil',
      enunciado: `
        <p>As palavras vazias (a, o, de, que…) aparecem muito e não dizem nada sobre o livro. Elas estão em
          <code>vazias.txt</code>, uma por linha.</p>
        <p>Guarde em <code>relevantes</code> a contagem sem elas, com as colunas <code>livro</code>, <code>palavra</code> e
          <code>count</code>, nessa ordem.</p>`,
      dica: 'spark.read.text("vazias.txt") tem a coluna value; renomeie para palavra e use join(vazias, "palavra", "left_anti"). O join muda a ordem das colunas: termine com select.',
      codigo: py`
        vazias = spark.read.text("vazias.txt").withColumnRenamed("value", "palavra")
        relevantes = (contagem.join(vazias, "palavra", "left_anti")
            .select("livro", "palavra", "count"))
        relevantes.orderBy("livro", F.desc("count")).show()
      `,
      regras: [{
        dataframe: 'relevantes',
        colunas: ['livro', 'palavra', 'count'],
        linhas: [
          [SECA_ID, 'sertão', 3], [SECA_ID, 'seca', 2], [SECA_ID, 'chuva', 2], [SECA_ID, 'dura', 1], [SECA_ID, 'racha', 1],
          [SECA_ID, 'chão', 1], [SECA_ID, 'povo', 1], [SECA_ID, 'espera', 1],
          [MAR_ID, 'mar', 3], [MAR_ID, 'bom', 2], [MAR_ID, 'peixe', 2], [MAR_ID, 'grande', 1], [MAR_ID, 'jangada', 1],
          [MAR_ID, 'vai', 1], [MAR_ID, 'volta', 1],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'relevantes',
        colunas: ['livro', 'palavra', 'count'],
        linhas: [
          [SECA_ID, 'choveu', 2], [SECA_ID, 'sertão', 1], [SECA_ID, 'rio', 1], [SECA_ID, 'voltou', 1], [SECA_ID, 'correr', 1],
          [MAR_ID, 'rede', 2], [MAR_ID, 'mar', 1], [MAR_ID, 'areia', 1],
        ],
      }],
    },
    {
      titulo: 'As 3 mais frequentes de cada livro',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>top</code> as 3 palavras mais frequentes de cada livro, com as colunas <code>livro</code>,
          <code>palavra</code>, <code>count</code> e <code>posicao</code> (1, 2 e 3).</p>
        <p>No empate, vem antes a palavra em ordem alfabética.</p>`,
      dica: 'Uma janela por livro: Window.partitionBy("livro").orderBy(F.desc("count"), "palavra"); F.row_number().over(janela) e filter(posicao <= 3).',
      codigo: py`
        from pyspark.sql import Window

        por_livro = Window.partitionBy("livro").orderBy(F.desc("count"), "palavra")
        top = (relevantes.withColumn("posicao", F.row_number().over(por_livro))
            .filter(F.col("posicao") <= 3))
        top.orderBy("livro", "posicao").show()
      `,
      regras: [{
        dataframe: 'top',
        colunas: ['livro', 'palavra', 'count', 'posicao'],
        linhas: [[SECA_ID, 'sertão', 3, 1], [SECA_ID, 'chuva', 2, 2], [SECA_ID, 'seca', 2, 3], [MAR_ID, 'mar', 3, 1], [MAR_ID, 'bom', 2, 2], [MAR_ID, 'peixe', 2, 3]],
      }],
      regrasOcultas: [{
        dataframe: 'top',
        colunas: ['livro', 'palavra', 'count', 'posicao'],
        linhas: [[SECA_ID, 'choveu', 2, 1], [SECA_ID, 'correr', 1, 2], [SECA_ID, 'rio', 1, 3], [MAR_ID, 'rede', 2, 1], [MAR_ID, 'areia', 1, 2], [MAR_ID, 'mar', 1, 3]],
      }],
    },
  ],
});
