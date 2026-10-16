// #️⃣ Hashtags e seguidores: posts em JSON com listas. explode das hashtags, as mais usadas de cada
// dia, quem segue quem (outra lista) e o alcance de cada hashtag.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const jsonl = (objetos) => objetos.map((o) => `${JSON.stringify(o)}\n`).join('');
const post = (autor, dia, hashtags) => ({ autor, dia: `2026-10-${dia}`, hashtags });

const POSTS = jsonl([
  post('ana', '14', ['sertao', 'chuva']), post('bia', '14', ['chuva']), post('caio', '14', ['forro', 'sertao']),
  post('ana', '15', ['forro']), post('davi', '15', ['forro', 'chuva']), post('bia', '15', ['sertao']),
]);
const USUARIOS = jsonl([
  { usuario: 'ana', seguidores: ['bia'] }, { usuario: 'bia', seguidores: ['ana'] },
  { usuario: 'caio', seguidores: ['ana', 'davi'] }, { usuario: 'davi', seguidores: [] },
]);
const POSTS_OCULTO = jsonl([post('eva', '20', ['praia']), post('fia', '20', ['praia', 'sol']), post('eva', '21', ['sol'])]);
const USUARIOS_OCULTO = jsonl([
  { usuario: 'eva', seguidores: ['fia', 'gil'] }, { usuario: 'fia', seguidores: ['eva'] }, { usuario: 'gil', seguidores: [] },
]);

const COLUNAS = ['autor', 'dia', 'hashtags'];
const TIPOS = ['string', 'string', 'array<string>'];

export const projetoHashtags = criarProjeto({
  id: 'hashtags',
  titulo: 'Hashtags e seguidores',
  icone: '#️⃣',
  descricao: 'Posts em JSON com listas: explode, as hashtags do dia, quem segue quem e o alcance de cada hashtag.',
  resumo: `
    <p>Uma rede social pequena guarda os posts em <code>posts.json</code>, um JSON por linha, e cada post tem uma
      <b>lista</b> de hashtags. Os usuários estão em <code>usuarios.json</code>, cada um com a lista de seguidores.</p>
    <p>Lista dentro de uma coluna não dá para agrupar: o <code>explode</code> faz uma linha para cada item.</p>
    <ol>
      <li>ler o JSON;</li>
      <li>uma linha por hashtag;</li>
      <li>as hashtags mais usadas de cada dia;</li>
      <li>quem segue quem;</li>
      <li>o alcance de cada hashtag: quantas pessoas diferentes seguem quem a usou.</li>
    </ol>`,
  dados: { 'posts.json': POSTS, 'usuarios.json': USUARIOS },
  oculto: { 'posts.json': POSTS_OCULTO, 'usuarios.json': USUARIOS_OCULTO },
  inicial: py`
    posts = spark.read.text("posts.json")
    posts.show(truncate=False)
  `,
  etapas: [
    {
      titulo: 'Ler o JSON',
      dificuldade: 'facil',
      enunciado: `
        <p>Lido como texto, cada post é uma linha só. Leia <code>posts.json</code> como JSON em <code>posts</code>: as colunas
          <code>autor</code>, <code>dia</code> e <code>hashtags</code> (uma lista de textos).</p>`,
      dica: 'spark.read.json("posts.json"): o Spark lê um JSON por linha e descobre os tipos, inclusive a lista.',
      codigo: py`
        posts = spark.read.json("posts.json")
        posts.printSchema()
      `,
      regras: [{ dataframe: 'posts', colunas: COLUNAS, tipos: TIPOS, total: 6 }],
      regrasOcultas: [{ dataframe: 'posts', colunas: COLUNAS, tipos: TIPOS, total: 3 }],
    },
    {
      titulo: 'Uma linha por hashtag',
      dificuldade: 'medio',
      enunciado: '<p>Guarde em <code>marcacoes</code> uma linha por hashtag de cada post: as colunas <code>autor</code>, <code>dia</code> e <code>hashtag</code>.</p>',
      dica: 'posts.select("autor", "dia", F.explode("hashtags").alias("hashtag"))',
      codigo: py`
        marcacoes = posts.select("autor", "dia", F.explode("hashtags").alias("hashtag"))
        marcacoes.show()
      `,
      regras: [{
        dataframe: 'marcacoes',
        colunas: ['autor', 'dia', 'hashtag'],
        linhas: [
          ['ana', '2026-10-14', 'sertao'], ['ana', '2026-10-14', 'chuva'], ['bia', '2026-10-14', 'chuva'], ['caio', '2026-10-14', 'forro'],
          ['caio', '2026-10-14', 'sertao'], ['ana', '2026-10-15', 'forro'], ['davi', '2026-10-15', 'forro'], ['davi', '2026-10-15', 'chuva'],
          ['bia', '2026-10-15', 'sertao'],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'marcacoes',
        colunas: ['autor', 'dia', 'hashtag'],
        linhas: [['eva', '2026-10-20', 'praia'], ['fia', '2026-10-20', 'praia'], ['fia', '2026-10-20', 'sol'], ['eva', '2026-10-21', 'sol']],
      }],
    },
    {
      titulo: 'As mais usadas de cada dia',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>top_dia</code> a hashtag mais usada de cada dia (todas, se houver empate): as colunas
          <code>dia</code>, <code>hashtag</code> e <code>count</code>.</p>`,
      dica: 'Conte por dia e hashtag; F.rank() numa janela por dia em ordem decrescente de count dá 1 para todas as empatadas no topo.',
      codigo: py`
        from pyspark.sql import Window

        contagem = marcacoes.groupBy("dia", "hashtag").count()
        no_dia = Window.partitionBy("dia").orderBy(F.desc("count"))
        top_dia = (contagem.withColumn("posicao", F.rank().over(no_dia))
            .filter(F.col("posicao") == 1)
            .select("dia", "hashtag", "count"))
        top_dia.show()
      `,
      regras: [{ dataframe: 'top_dia', colunas: ['dia', 'hashtag', 'count'], linhas: [['2026-10-14', 'chuva', 2], ['2026-10-14', 'sertao', 2], ['2026-10-15', 'forro', 2]] }],
      regrasOcultas: [{ dataframe: 'top_dia', colunas: ['dia', 'hashtag', 'count'], linhas: [['2026-10-20', 'praia', 2], ['2026-10-21', 'sol', 1]] }],
    },
    {
      titulo: 'Quem segue quem',
      dificuldade: 'dificil',
      enunciado: `
        <p>Leia <code>usuarios.json</code> e guarde em <code>segue</code> uma linha por par: as colunas <code>usuario</code>
          (quem é seguido) e <code>seguidor</code>. Quem não tem seguidores não aparece.</p>`,
      dica: 'spark.read.json("usuarios.json").select("usuario", F.explode("seguidores").alias("seguidor")): a lista vazia não gera linha.',
      codigo: py`
        usuarios = spark.read.json("usuarios.json")
        segue = usuarios.select("usuario", F.explode("seguidores").alias("seguidor"))
        segue.show()
      `,
      regras: [{ dataframe: 'segue', colunas: ['usuario', 'seguidor'], linhas: [['ana', 'bia'], ['bia', 'ana'], ['caio', 'ana'], ['caio', 'davi']] }],
      regrasOcultas: [{ dataframe: 'segue', colunas: ['usuario', 'seguidor'], linhas: [['eva', 'fia'], ['eva', 'gil'], ['fia', 'eva']] }],
    },
    {
      titulo: 'O alcance de cada hashtag',
      dificuldade: 'dificil',
      enunciado: `
        <p>O <b>alcance</b> de uma hashtag é quantas pessoas diferentes seguem alguém que a usou. Guarde em
          <code>alcance</code> as colunas <code>hashtag</code> e <code>alcance</code>, do maior alcance para o menor e, no
          empate, em ordem de hashtag.</p>`,
      dica: 'marcacoes.join(segue, marcacoes.autor == segue.usuario), groupBy("hashtag") com F.countDistinct("seguidor"), e orderBy(F.desc("alcance"), "hashtag").',
      codigo: py`
        alcance = (marcacoes.join(segue, marcacoes.autor == segue.usuario)
            .groupBy("hashtag").agg(F.countDistinct("seguidor").alias("alcance"))
            .orderBy(F.desc("alcance"), "hashtag"))
        alcance.show()
      `,
      regras: [{ dataframe: 'alcance', colunas: ['hashtag', 'alcance'], ordem: true, linhas: [['forro', 3], ['sertao', 3], ['chuva', 2]] }],
      regrasOcultas: [{ dataframe: 'alcance', colunas: ['hashtag', 'alcance'], ordem: true, linhas: [['praia', 3], ['sol', 3]] }],
    },
  ],
});
