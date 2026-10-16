// 🧺 Funil de e-commerce: quantos visitantes chegam ao carrinho e à compra, por canal, e quem
// abandonou o carrinho.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const EVENTOS = `usuario,evento,canal,momento
ana,visita,busca,2026-10-15 08:00:00
ana,carrinho,busca,2026-10-15 08:05:00
ana,compra,busca,2026-10-15 08:10:00
bia,visita,social,2026-10-15 09:00:00
bia,carrinho,social,2026-10-15 09:03:00
caio,visita,busca,2026-10-15 09:30:00
davi,visita,social,2026-10-15 10:00:00
davi,visita,social,2026-10-15 10:20:00
davi,carrinho,social,2026-10-15 10:25:00
davi,compra,social,2026-10-15 10:40:00
edu,visita,email,2026-10-15 11:00:00
edu,carrinho,email,2026-10-15 11:02:00
`;
const EVENTOS_OCULTO = `usuario,evento,canal,momento
gil,visita,busca,2026-10-16 08:00:00
gil,carrinho,busca,2026-10-16 08:10:00
hana,visita,busca,2026-10-16 09:00:00
hana,carrinho,busca,2026-10-16 09:05:00
hana,compra,busca,2026-10-16 09:20:00
ivo,visita,social,2026-10-16 10:00:00
jade,visita,social,2026-10-16 10:30:00
jade,carrinho,social,2026-10-16 10:31:00
jade,carrinho,social,2026-10-16 10:45:00
`;

const TIPOS = ['string', 'string', 'string', 'timestamp'];
const CANAL = ['canal', 'visita', 'carrinho', 'compra', 'taxa'];

export const projetoFunil = criarProjeto({
  id: 'funil',
  titulo: 'Funil de e-commerce',
  icone: '🧺',
  descricao: 'Visita, carrinho e compra: o funil da loja, a conversão entre as etapas, os canais e os carrinhos abandonados.',
  resumo: `
    <p>Em <code>eventos.csv</code> está tudo o que os clientes fizeram na loja: cada linha é uma <b>visita</b>, um
      produto posto no <b>carrinho</b> ou uma <b>compra</b>, com o canal de onde o cliente veio (busca, rede social ou
      e-mail). O funil conta <b>pessoas</b>, não cliques: quem visitou duas vezes conta uma.</p>
    <ol>
      <li>ler e tipar os eventos;</li>
      <li>contar as pessoas em cada etapa do funil;</li>
      <li>calcular a conversão entre as etapas;</li>
      <li>montar o funil de cada canal;</li>
      <li>achar quem abandonou o carrinho.</li>
    </ol>`,
  dados: { 'eventos.csv': EVENTOS },
  oculto: { 'eventos.csv': EVENTOS_OCULTO },
  inicial: py`
    eventos = spark.read.csv("eventos.csv", header=True)
    eventos.printSchema()
  `,
  etapas: [
    {
      titulo: 'Ler e tipar',
      dificuldade: 'facil',
      enunciado: `
        <p>Do jeito que está, o <code>momento</code> chega como texto. Leia <code>eventos.csv</code> de novo em
          <code>eventos</code>, de modo que <code>momento</code> seja um timestamp.</p>`,
      dica: 'inferSchema=True reconhece "2026-10-15 08:00:00" como timestamp.',
      codigo: py`
        eventos = spark.read.csv("eventos.csv", header=True, inferSchema=True)
        eventos.printSchema()
      `,
      regras: [{ dataframe: 'eventos', colunas: ['usuario', 'evento', 'canal', 'momento'], tipos: TIPOS, total: 12 }],
      regrasOcultas: [{ dataframe: 'eventos', colunas: ['usuario', 'evento', 'canal', 'momento'], tipos: TIPOS, total: 9 }],
    },
    {
      titulo: 'Pessoas em cada etapa',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_etapa</code> quantas <b>pessoas diferentes</b> chegaram a cada etapa: as colunas
          <code>evento</code> e <code>usuarios</code>.</p>`,
      dica: 'groupBy("evento").agg(F.countDistinct("usuario").alias("usuarios")): o count contaria a visita repetida duas vezes.',
      codigo: py`
        por_etapa = eventos.groupBy("evento").agg(F.countDistinct("usuario").alias("usuarios"))
        por_etapa.show()
      `,
      regras: [{ dataframe: 'por_etapa', colunas: ['evento', 'usuarios'], linhas: [['visita', 5], ['carrinho', 4], ['compra', 2]] }],
      regrasOcultas: [{ dataframe: 'por_etapa', colunas: ['evento', 'usuarios'], linhas: [['visita', 4], ['carrinho', 3], ['compra', 1]] }],
    },
    {
      titulo: 'A conversão entre as etapas',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>conversao</code> um DataFrame de uma linha com as porcentagens, em 1 casa:
          <code>visita_carrinho</code> (das pessoas que visitaram, quantas puseram no carrinho), <code>carrinho_compra</code>
          e <code>visita_compra</code>.</p>`,
      dica: 'Traga os números para o Python: {r.evento: r.usuarios for r in por_etapa.collect()}; depois, spark.createDataFrame([(…, …, …)], [nomes]).',
      codigo: py`
        n = {linha.evento: linha.usuarios for linha in por_etapa.collect()}
        taxa = lambda de, para: round(100 * n[para] / n[de], 1)
        conversao = spark.createDataFrame(
            [(taxa("visita", "carrinho"), taxa("carrinho", "compra"), taxa("visita", "compra"))],
            ["visita_carrinho", "carrinho_compra", "visita_compra"])
        conversao.show()
      `,
      regras: [{ dataframe: 'conversao', colunas: ['visita_carrinho', 'carrinho_compra', 'visita_compra'], linhas: [[80.0, 50.0, 40.0]] }],
      regrasOcultas: [{ dataframe: 'conversao', colunas: ['visita_carrinho', 'carrinho_compra', 'visita_compra'], linhas: [[75.0, 33.3, 25.0]] }],
    },
    {
      titulo: 'O funil de cada canal',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>por_canal</code> uma linha por canal, com as pessoas de cada etapa em colunas
          (<code>visita</code>, <code>carrinho</code> e <code>compra</code>, nessa ordem; 0 quando ninguém chegou) e a
          <code>taxa</code> de compra (compra ÷ visita, em %, 1 casa).</p>`,
      dica: 'groupBy("canal").pivot("evento", ["visita", "carrinho", "compra"]).agg(F.countDistinct("usuario")), depois fillna(0) e a coluna taxa.',
      codigo: py`
        ETAPAS = ["visita", "carrinho", "compra"]
        por_canal = (eventos.groupBy("canal").pivot("evento", ETAPAS)
            .agg(F.countDistinct("usuario")).fillna(0)
            .withColumn("taxa", F.round(F.col("compra") * 100 / F.col("visita"), 1)))
        por_canal.orderBy("canal").show()
      `,
      regras: [{ dataframe: 'por_canal', colunas: CANAL, linhas: [['busca', 2, 1, 1, 50.0], ['email', 1, 1, 0, 0.0], ['social', 2, 2, 1, 50.0]] }],
      regrasOcultas: [{ dataframe: 'por_canal', colunas: CANAL, linhas: [['busca', 2, 2, 1, 50.0], ['social', 2, 1, 0, 0.0]] }],
    },
    {
      titulo: 'Quem abandonou o carrinho',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>abandonos</code> as pessoas que puseram algo no carrinho e não compraram, com as colunas
          <code>usuario</code>, <code>canal</code> e <code>ultimo_carrinho</code> (a hora do último carrinho, no formato
          <code>HH:mm</code>). É a lista para o e-mail de "esqueceu alguma coisa?".</p>`,
      dica: 'Dos carrinhos, groupBy("usuario", "canal") com F.date_format(F.max("momento"), "HH:mm"); depois, join com quem comprou usando "left_anti".',
      codigo: py`
        carrinhos = (eventos.filter(F.col("evento") == "carrinho")
            .groupBy("usuario", "canal")
            .agg(F.date_format(F.max("momento"), "HH:mm").alias("ultimo_carrinho")))
        compras = eventos.filter(F.col("evento") == "compra").select("usuario")
        abandonos = carrinhos.join(compras, "usuario", "left_anti")
        abandonos.show()
      `,
      regras: [{ dataframe: 'abandonos', colunas: ['usuario', 'canal', 'ultimo_carrinho'], linhas: [['bia', 'social', '09:03'], ['edu', 'email', '11:02']] }],
      regrasOcultas: [{ dataframe: 'abandonos', colunas: ['usuario', 'canal', 'ultimo_carrinho'], linhas: [['gil', 'busca', '08:10'], ['jade', 'social', '10:45']] }],
    },
  ],
});
