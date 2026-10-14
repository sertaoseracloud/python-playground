// ✨ PySpark: 14 lições e 45 exercícios. O pyspark do DivergePython é uma implementação para
// aprender, com a API do PySpark 4, que roda em paralelo nos workers do navegador (veja
// python/pyspark/). Os exercícios com DataFrame guardam o resultado numa variável conferida
// pela regra `dataframe`; o código inicial monta o DataFrame de partida e falha em alguma
// regra visível.
import { py, main } from './util.js';

/** O começo de todo programa: a SparkSession (e o sc, nos de RDD). */
const sessao = (app, { rdd = false } = {}) => `from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder.appName("${app}").getOrCreate()
${rdd ? 'sc = spark.sparkContext\n' : ''}`;
const programa = (app, codigo, opcoes) => main(`${sessao(app, opcoes)}\n${codigo}`);

// ---------- dados (aba 📦 Dados; os casos ocultos trocam por outros, com o mesmo cabeçalho) ----------
export const VENDAS = `data,regiao,produto,quantidade,preco
2026-01-05,Nordeste,Arroz 5kg,2,24.90
2026-01-12,Sudeste,Feijão 1kg,3,8.50
2026-01-20,Nordeste,Café 500g,1,19.90
2026-02-03,Norte,Rapadura,10,2.50
2026-02-14,Sul,Farinha de mandioca,4,6.80
2026-02-21,Nordeste,Queijo coalho,2,32.00
2026-03-02,Sudeste,Arroz 5kg,1,25.50
2026-03-15,Norte,Café 500g,5,18.90
`;
export const VENDAS_OCULTO = `data,regiao,produto,quantidade,preco
2026-04-01,Norte,Queijo coalho,3,30.00
2026-04-09,Nordeste,Rapadura,20,2.20
2026-04-18,Norte,Feijão 1kg,2,9.10
2026-05-02,Sudeste,Café 500g,4,21.00
2026-05-20,Nordeste,Arroz 5kg,1,23.40
2026-06-11,Sudeste,Farinha de mandioca,6,7.50
`;
export const FRASES = `o sertão vai virar mar
o mar vai virar sertão
a chuva chegou no sertão
Sertão é onde o pensamento da gente se forma
`;
export const FRASES_OCULTO = `a seca passou
a chuva voltou
e o rio voltou a correr
`;
export const PESSOAS = `nome,idade,cidade,nota
  Ana,31,Recife,8.5
bia ,15,Fortaleza,
CAIO,8,,7.0
davi,64,São Paulo,9.0
 Edu ,22,Curitiba,6.5
Fia,17,,
`;
export const PESSOAS_OCULTO = `nome,idade,cidade,nota
gil ,45,Salvador,7.5
 HANA,11,Rio de Janeiro,
Ivo,70,,8.0
jade,19,Natal,9.5
`;
export const CONTATOS = `nome,telefone,email
Ana,(81) 99999-0001,ana@exemplo.com
Bia,,bia@exemplo.com
Caio,,
Davi,(85) 98888-0002,
`;
export const CONTATOS_OCULTO = `nome,telefone,email
Edu,,edu@exemplo.com
Fia,(84) 97777-0003,fia@exemplo.com
Gil,,
`;

const dadosVendas = { 'vendas.csv': VENDAS };
const ocultoVendas = { 'vendas.csv': VENDAS_OCULTO };
const dadosPessoas = { 'pessoas.csv': PESSOAS };
const ocultoPessoas = { 'pessoas.csv': PESSOAS_OCULTO };
const LER_VENDAS = 'df = spark.read.csv("vendas.csv", header=True, inferSchema=True)\n';
const LER_PESSOAS = 'df = spark.read.csv("pessoas.csv", header=True, inferSchema=True)\n';

// ---------- lições ----------
export const licoes = {
  sessao: {
    id: 'licao-spark-session',
    tipo: 'licao',
    titulo: 'SparkSession e avaliação preguiçosa',
    resumo: `
      <p>O <b>Spark</b> divide um trabalho grande em pedaços (as <b>partições</b>) e roda cada pedaço num computador
        diferente. Tudo começa pela <code>SparkSession</code>: <code>SparkSession.builder.getOrCreate()</code>.</p>
      <p>O Spark é <b>preguiçoso</b>: <code>filter</code>, <code>select</code> e <code>withColumn</code> só anotam a receita.
        Nada roda até uma <b>ação</b> (<code>count</code>, <code>show</code>, <code>collect</code>). É como anotar a lista de
        compras: ninguém sai de casa até alguém dizer "vai".</p>
      <p>Depois da ação, a aba <b>⚡ Execução</b> mostra o job, os estágios e as tarefas, em que worker cada uma rodou.</p>
      <p>Este é o pyspark do DivergePython: uma implementação para aprender, com a API do PySpark 4, que roda em paralelo
        no seu navegador. O Spark de verdade usa 200 partições depois de um shuffle; aqui são 4, para caber no navegador.</p>`,
    arquivos: programa('primeiros-passos', py`
      numeros = spark.range(1, 11)          # 1 a 10, ainda sem rodar nada
      pares = numeros.filter(F.col("id") % 2 == 0)
      print("Anotado. Agora a ação:")
      print("pares:", pares.count())        # o count roda o job (veja a aba ⚡ Execução)
    `),
  },
  rdd: {
    id: 'licao-rdd',
    tipo: 'licao',
    titulo: 'RDD: dados distribuídos',
    resumo: `
      <p>O <b>RDD</b> é a base do Spark: uma coleção dividida em partições. Pense numa colheita de algodão dividida entre
        trabalhadores: cada um colhe a sua faixa do roçado, e no fim alguém soma o que todos colheram.</p>
      <p><code>sc.parallelize(lista)</code> cria o RDD. <code>map</code> transforma cada item, <code>filter</code> fica com
        alguns, e as ações <code>collect</code> (traz tudo) e <code>reduce</code> (junta dois a dois) rodam o trabalho.</p>
      <p>As funções (<code>lambda</code>) vão para os workers: elas não podem depender de nada que só existe na sua tela.</p>`,
    arquivos: programa('rdd', py`
      colheita = sc.parallelize([12, 7, 30, 18, 5, 21, 9, 14])
      print("partições:", colheita.getNumPartitions())
      dobro = colheita.map(lambda kg: kg * 2)
      grandes = colheita.filter(lambda kg: kg >= 15)
      print("dobro:", dobro.collect())
      print("grandes:", grandes.collect())
      print("total:", colheita.reduce(lambda a, b: a + b))
    `, { rdd: true }),
  },
  pares: {
    id: 'licao-rdd-pares',
    tipo: 'licao',
    titulo: 'Pares chave-valor e contagem de palavras',
    resumo: `
      <p>Um RDD de pares <code>(chave, valor)</code> permite somar por chave: <code>reduceByKey</code>. É o "conte as
        palavras" clássico do Spark: <code>flatMap</code> quebra as linhas em palavras, <code>map</code> faz
        <code>(palavra, 1)</code> e <code>reduceByKey</code> soma.</p>
      <p>O <code>reduceByKey</code> soma <b>dentro de cada partição antes</b> de mandar pela rede (o <b>shuffle</b>): é como cada
        trabalhador entregar o total do seu saco, e não cada caroço.</p>
      <p><code>sc.textFile</code> lê um arquivo de texto, uma linha por item.</p>`,
    arquivos: programa('palavras', py`
      linhas = sc.textFile("frases.txt")
      palavras = linhas.flatMap(lambda linha: linha.lower().split())
      contagem = palavras.map(lambda p: (p, 1)).reduceByKey(lambda a, b: a + b)
      mais_comuns = contagem.sortBy(lambda par: par[1], ascending=False).take(3)
      print(mais_comuns)
    `, { rdd: true }),
    dados: { 'frases.txt': FRASES },
  },
  particoes: {
    id: 'licao-particoes-spark',
    tipo: 'licao',
    titulo: 'Partições, glom e mapPartitions',
    resumo: `
      <p>Cada partição é um pedaço que uma tarefa processa. <code>getNumPartitions()</code> diz quantas são, e
        <code>glom()</code> mostra o que tem em cada uma (cada partição vira uma lista).</p>
      <p><code>mapPartitions</code> recebe a partição inteira de uma vez: bom para preparar algo caro uma vez por pedaço,
        como abrir uma conexão.</p>
      <p><code>repartition(n)</code> redistribui tudo (faz shuffle); <code>coalesce(n)</code> só junta partições vizinhas
        para diminuir o número, sem shuffle.</p>`,
    arquivos: programa('particoes', py`
      numeros = sc.parallelize(range(1, 11), 4)
      print(numeros.getNumPartitions(), "partições:", numeros.glom().collect())
      somas = numeros.mapPartitions(lambda parte: [sum(parte)])
      print("soma de cada partição:", somas.collect())
      print("repartition(2):", numeros.repartition(2).getNumPartitions())
      print("coalesce(2):", numeros.coalesce(2).glom().collect())
    `, { rdd: true }),
  },
  dataframe: {
    id: 'licao-dataframe',
    tipo: 'licao',
    titulo: 'DataFrame e schema',
    resumo: `
      <p>O <b>DataFrame</b> é uma tabela distribuída, com colunas que têm nome e tipo (o <b>schema</b>). É o jeito mais usado
        do Spark: você diz <i>o que</i> quer, e o Spark monta o plano.</p>
      <p><code>spark.createDataFrame(dados, colunas)</code> cria; <code>show()</code> mostra; <code>printSchema()</code> diz os
        tipos. <code>select</code> escolhe colunas, <code>filter</code> escolhe linhas e <code>withColumn</code> cria uma coluna.</p>`,
    arquivos: programa('dataframe', py`
      dados = [("Ana", "Recife", 31), ("Bia", "Fortaleza", 15), ("Caio", "Natal", 8)]
      pessoas = spark.createDataFrame(dados, ["nome", "cidade", "idade"])
      pessoas.printSchema()
      pessoas.show()
      maiores = pessoas.filter(F.col("idade") >= 18).select("nome", "idade")
      maiores.show()
      print(pessoas.withColumn("ano_que_vem", F.col("idade") + 1).columns)
    `),
  },
  funcoes: {
    id: 'licao-spark-funcoes',
    tipo: 'licao',
    titulo: 'Funções de coluna',
    resumo: `
      <p>O módulo <code>functions</code> (o <code>F</code>) tem centenas de funções que rodam dentro do Spark:
        <code>F.upper</code>, <code>F.trim</code>, <code>F.concat_ws</code>, <code>F.round</code>, <code>F.to_date</code>,
        <code>F.year</code>...</p>
      <p><code>F.when(condição, valor).otherwise(outro)</code> é o <code>if</code> das colunas. <code>.cast("int")</code> troca
        o tipo.</p>
      <p>Sem <code>alias</code>, a coluna ganha um nome automático (como <code>upper(nome)</code>); com
        <code>.alias("nome")</code>, você escolhe.</p>`,
    arquivos: programa('funcoes', py`
      vendas = spark.createDataFrame(
          [(" arroz ", "2026-01-05", "2", 24.9), ("feijão", "2026-02-14", "3", 8.5)],
          ["produto", "data", "quantidade", "preco"],
      )
      vendas.select(
          F.upper(F.trim("produto")),
          F.year(F.to_date("data")).alias("ano"),
          F.col("quantidade").cast("int").alias("qtd"),
          F.when(F.col("preco") > 10, "caro").otherwise("barato").alias("faixa"),
          F.concat_ws(" / ", "produto", "data").alias("rotulo"),
      ).show()
    `),
  },
  udf: {
    id: 'licao-udf',
    tipo: 'licao',
    titulo: 'UDF: sua função no Spark',
    resumo: `
      <p>Quando nenhuma função pronta serve, a <b>UDF</b> (função definida pelo usuário) leva a sua função Python para dentro
        do Spark: <code>F.udf(funcao, "string")</code>, ou o decorador <code>@F.udf("string")</code>.</p>
      <p>Ela é mais lenta: cada valor sai do motor do Spark, passa pelo Python e volta. No <code>explain()</code> isso aparece
        como <code>BatchEvalPython</code>. Prefira as funções prontas sempre que der.</p>`,
    arquivos: programa('udf', py`
      @F.udf("string")
      def tamanho(nome):
          return "curto" if len(nome) <= 3 else "longo"


      nomes = spark.createDataFrame([("Ana",), ("Rapadura",)], ["nome"])
      com_tamanho = nomes.withColumn("tamanho", tamanho("nome"))
      com_tamanho.show()
      com_tamanho.explain()
    `),
  },
  nulos: {
    id: 'licao-nulos',
    tipo: 'licao',
    titulo: 'Valores nulos',
    resumo: `
      <p>Um valor que falta é <code>NULL</code> (no Python, <code>None</code>). O <code>show</code> mostra
        <code>NULL</code>.</p>
      <p>Cuidado: <code>NULL &gt; 5</code> não é verdadeiro nem falso, é <code>NULL</code>, e o <code>filter</code> descarta.
        Para achar os nulos, use <code>isNull()</code>.</p>
      <p><code>na.fill</code> troca os nulos por um valor, <code>na.drop</code> (ou <code>dropna</code>) tira as linhas com nulos,
        e <code>F.coalesce(a, b)</code> pega o primeiro que não é nulo.</p>`,
    arquivos: programa('nulos', py`
      ${LER_PESSOAS}
      df.show()
      df.filter(F.col("nota") > 7).select("nome", "nota").show()      # quem tem nota NULL fica de fora
      df.filter(F.col("cidade").isNull()).select("nome").show()
      df.na.fill({"cidade": "?"}).select("nome", "cidade").show()
      print("com nota:", df.dropna(subset=["nota"]).count())
    `),
    dados: dadosPessoas,
  },
  agregacoes: {
    id: 'licao-agregacoes',
    tipo: 'licao',
    titulo: 'groupBy e agregações',
    resumo: `
      <p><code>groupBy("regiao").agg(...)</code> junta as linhas de cada grupo e calcula: <code>F.sum</code>,
        <code>F.avg</code>, <code>F.count</code>, <code>F.countDistinct</code>, <code>F.max</code>. Dê nome com
        <code>alias</code>.</p>
      <p>É como a apuração de uma eleição: cada seção conta os seus votos, e a central soma por candidato. Por isso o groupBy
        faz um shuffle: todas as linhas do mesmo grupo precisam ir para a mesma partição.</p>
      <p><code>pivot</code> vira os valores de uma coluna em colunas.</p>`,
    arquivos: programa('agregacoes', py`
      ${LER_VENDAS}
      df.groupBy("regiao").agg(
          F.sum("quantidade").alias("itens"),
          F.round(F.avg("preco"), 2).alias("preco_medio"),
          F.countDistinct("produto").alias("produtos"),
      ).orderBy("regiao").show()
      df.groupBy("regiao").pivot("produto", ["Arroz 5kg", "Café 500g"]).sum("quantidade").orderBy("regiao").show()
    `),
    dados: dadosVendas,
  },
  joins: {
    id: 'licao-joins',
    tipo: 'licao',
    titulo: 'Joins e broadcast',
    resumo: `
      <p><code>a.join(b, "chave", "inner")</code> junta as linhas com a mesma chave. Com <code>"left"</code> ficam todas as de
        <code>a</code>; com <code>"left_anti"</code>, só as de <code>a</code> que não têm par em <code>b</code>.</p>
      <p>No join comum, as duas tabelas vão pela rede (dois shuffles) e o plano mostra <code>SortMergeJoin</code>. Se uma
        delas é pequena, <code>F.broadcast(pequena)</code> manda uma cópia para cada worker: nenhum shuffle, e o plano mostra
        <code>BroadcastHashJoin</code>. É como dar a cada trabalhador uma cópia da tabela de preços em vez de todo mundo
        ir perguntar no escritório.</p>`,
    arquivos: programa('joins', py`
      pedidos = spark.createDataFrame([(1, "Ana", 30.0), (2, "Bia", 12.5), (3, "Caio", 8.0)], ["id", "cliente", "valor"])
      cidades = spark.createDataFrame([("Ana", "Recife"), ("Bia", "Natal")], ["cliente", "cidade"])
      pedidos.join(cidades, "cliente", "inner").show()
      pedidos.join(cidades, "cliente", "left").show()
      pedidos.join(cidades, "cliente", "left_anti").show()
      spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1)   # desliga o broadcast automático
      pedidos.join(cidades, "cliente").explain()
      pedidos.join(F.broadcast(cidades), "cliente").explain()
    `),
  },
  janela: {
    id: 'licao-window',
    tipo: 'licao',
    titulo: 'Funções de janela',
    resumo: `
      <p>Uma <b>janela</b> calcula olhando para as linhas vizinhas, sem juntar o grupo numa linha só:
        <code>Window.partitionBy("regiao").orderBy("data")</code>.</p>
      <p><code>F.row_number()</code> numera, <code>F.rank()</code> dá a posição (com empate), <code>F.lag("x")</code> pega o
        valor da linha anterior e <code>F.sum("x").over(janela.rowsBetween(Window.unboundedPreceding, Window.currentRow))</code>
        faz a soma acumulada. É o placar do campeonato: cada time sabe a sua posição e quantos pontos tinha na rodada passada.</p>`,
    arquivos: main(`${sessao('janelas')}from pyspark.sql import Window

${py`
      ${LER_VENDAS}
      janela = Window.partitionBy("regiao").orderBy("data")
      df.select(
          "regiao", "data", "quantidade",
          F.row_number().over(janela).alias("n"),
          F.lag("quantidade").over(janela).alias("anterior"),
          F.sum("quantidade").over(janela.rowsBetween(Window.unboundedPreceding, Window.currentRow)).alias("acumulado"),
      ).orderBy("regiao", "data").show()
    `}`),
    dados: dadosVendas,
  },
  leitura: {
    id: 'licao-leitura',
    tipo: 'licao',
    titulo: 'Ler e gravar arquivos',
    resumo: `
      <p><code>spark.read.csv("vendas.csv", header=True, inferSchema=True)</code> lê um CSV e adivinha os tipos. Para não
        depender do palpite, passe o schema em texto: <code>schema="data DATE, regiao STRING, ..."</code>.
        <code>spark.read.json</code> lê um JSON por linha.</p>
      <p><code>df.write.mode("overwrite").csv("saida")</code> grava uma <b>pasta</b>: um arquivo <code>part-*</code> por
        partição e um <code>_SUCCESS</code> no fim, porque cada worker grava o seu pedaço ao mesmo tempo.</p>
      <p>O parquet daqui é simplificado: guarda o schema e as linhas, para você praticar a API.</p>`,
    arquivos: programa('leitura', py`
      import os

      schema = "data DATE, regiao STRING, produto STRING, quantidade INT, preco DOUBLE"
      df = spark.read.csv("vendas.csv", header=True, schema=schema)
      df.printSchema()
      df.filter(F.col("regiao") == "Nordeste").write.mode("overwrite").csv("nordeste", header=True)
      print(sorted(os.listdir("nordeste")))
      spark.read.csv("nordeste", header=True).show()
    `),
    dados: dadosVendas,
  },
  sql: {
    id: 'licao-sql',
    tipo: 'licao',
    titulo: 'Spark SQL',
    resumo: `
      <p>Quem conhece SQL já sabe Spark: <code>df.createOrReplaceTempView("vendas")</code> dá um nome à tabela, e
        <code>spark.sql("SELECT ...")</code> devolve um DataFrame.</p>
      <p>SQL e DataFrame são duas portas para o mesmo motor: o plano (o <code>explain()</code>) sai igual.</p>`,
    arquivos: programa('sql', py`
      ${LER_VENDAS}
      df.createOrReplaceTempView("vendas")
      spark.sql("""
          SELECT regiao, SUM(quantidade) AS itens
          FROM vendas
          WHERE preco > 5
          GROUP BY regiao
          ORDER BY itens DESC
      """).show()
    `),
    dados: dadosVendas,
  },
  shuffle: {
    id: 'licao-shuffle-cache',
    tipo: 'licao',
    titulo: 'Shuffle, skew, cache e explain',
    resumo: `
      <p>O <b>shuffle</b> é quando os dados mudam de partição pela rede: no <code>groupBy</code>, no <code>join</code>, no
        <code>orderBy</code>. No <code>explain()</code>, cada shuffle é um <code>Exchange</code>, e ele separa os estágios na
        aba ⚡ Execução. É a parte cara: diminuir shuffles é o que mais acelera um job.</p>
      <p>Quando uma chave tem quase todas as linhas (<b>skew</b>, desequilíbrio), uma tarefa fica com o trabalho todo e as
        outras esperam: veja as barras na linha do tempo.</p>
      <p><code>cache()</code> guarda o resultado na memória: a segunda ação não refaz o caminho.</p>`,
    arquivos: programa('shuffle', py`
      ${LER_VENDAS}
      por_regiao = df.groupBy("regiao").agg(F.sum("quantidade").alias("itens")).orderBy("itens")
      por_regiao.explain()          # dois Exchange: o do groupBy e o do orderBy
      por_regiao.show()

      torto = spark.createDataFrame([("Nordeste",)] * 30 + [("Sul",), ("Norte",)], ["regiao"])
      torto.groupBy("regiao").count().show()   # uma tarefa recebe quase tudo (veja a aba ⚡ Execução)

      caro = df.withColumn("total", F.col("quantidade") * F.col("preco")).cache()
      print(caro.count(), "linhas;", caro.filter(F.col("total") > 40).count(), "acima de 40")
    `),
    dados: dadosVendas,
  },
};

// ---------- exercícios 1 a 22 ----------
export const exerciciosRdd = [
  {
    id: 'sp-parallelize-soma',
    tipo: 'problema',
    titulo: 'Somar com um RDD',
    dificuldade: 'facil',
    enunciado: '<p>O programa lê números numa linha (<code>3 5 7 9</code>). Guarde em <code>total</code> a soma, feita pelo Spark: <code>sc.parallelize(numeros)</code> e <code>reduce</code>.</p>',
    dica: 'total = sc.parallelize(numeros).reduce(lambda a, b: a + b)',
    arquivos: programa('soma', py`
      numeros = [int(x) for x in input().split()]
      total = sum(numeros)  # troque por um RDD
      print(total)
    `, { rdd: true }),
    solucao: programa('soma', py`
      numeros = [int(x) for x in input().split()]
      rdd = sc.parallelize(numeros)
      total = rdd.reduce(lambda a, b: a + b)
      print(total)
    `, { rdd: true }),
    testes: [
      { descricao: '3 5 7 9', entrada: ['3 5 7 9'], regras: [{ variavel: 'total', igual: 24 }, { codigo: 'parallelize', msg: 'O código usa sc.parallelize' }, { paralelo: { workers: 2 } }] },
      { descricao: 'com negativo', oculto: true, entrada: ['10 -4'], regras: [{ variavel: 'total', igual: 6 }, { paralelo: { workers: 1 } }] },
    ],
  },
  {
    id: 'sp-map-filter',
    tipo: 'problema',
    titulo: 'Quadrados dos pares',
    dificuldade: 'facil',
    enunciado: '<p>Leia números numa linha e guarde em <code>resultado</code> os quadrados dos números <b>pares</b>, na ordem, usando <code>filter</code> e <code>map</code> num RDD.</p>',
    dica: 'rdd.filter(lambda x: x % 2 == 0).map(lambda x: x * x).collect()',
    arquivos: programa('quadrados', py`
      numeros = [int(x) for x in input().split()]
      rdd = sc.parallelize(numeros)
      resultado = rdd.collect()
      print(resultado)
    `, { rdd: true }),
    solucao: programa('quadrados', py`
      numeros = [int(x) for x in input().split()]
      rdd = sc.parallelize(numeros)
      resultado = rdd.filter(lambda x: x % 2 == 0).map(lambda x: x * x).collect()
      print(resultado)
    `, { rdd: true }),
    testes: [
      { descricao: '1 a 6', entrada: ['1 2 3 4 5 6'], regras: [{ variavel: 'resultado', igual: [4, 16, 36] }, { codigo: '\\.filter\\(', msg: 'O código usa filter' }, { codigo: '\\.map\\(', msg: 'O código usa map' }] },
      { descricao: 'sem pares e só o zero', oculto: true, entrada: ['7 9'], regras: [{ variavel: 'resultado', igual: [] }] },
      { descricao: 'só o zero', oculto: true, entrada: ['0'], regras: [{ variavel: 'resultado', igual: [0] }] },
    ],
  },
  {
    id: 'sp-contar-palavras',
    tipo: 'problema',
    titulo: 'Contar palavras com reduceByKey',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>frases.txt</code> com <code>sc.textFile</code> e guarde em <code>contagem</code> a lista de pares <code>(palavra, vezes)</code>, com as palavras em minúsculas, em ordem alfabética. Use <code>reduceByKey</code>.</p>',
    dica: 'flatMap(lambda l: l.lower().split()), map(lambda p: (p, 1)), reduceByKey(lambda a, b: a + b) e sorted(... .collect()).',
    arquivos: programa('palavras', py`
      linhas = sc.textFile("frases.txt")
      contagem = []
      print(linhas.collect())
    `, { rdd: true }),
    solucao: programa('palavras', py`
      linhas = sc.textFile("frases.txt")
      pares = linhas.flatMap(lambda linha: linha.lower().split()).map(lambda p: (p, 1))
      contagem = sorted(pares.reduceByKey(lambda a, b: a + b).collect())
      print(contagem)
    `, { rdd: true }),
    dados: { 'frases.txt': FRASES },
    testes: [
      {
        descricao: 'as frases do sertão',
        regras: [
          {
            variavel: 'contagem',
            igual: [['a', 1], ['chegou', 1], ['chuva', 1], ['da', 1], ['forma', 1], ['gente', 1], ['mar', 2], ['no', 1], ['o', 3], ['onde', 1], ['pensamento', 1], ['se', 1], ['sertão', 4], ['vai', 2], ['virar', 2], ['é', 1]],
          },
          { codigo: 'reduceByKey', msg: 'O código usa reduceByKey' },
          { codigo: 'textFile', msg: 'O código lê o arquivo com sc.textFile' },
        ],
      },
      {
        descricao: 'outras frases',
        oculto: true,
        dados: { 'frases.txt': FRASES_OCULTO },
        regras: [{ variavel: 'contagem', igual: [['a', 3], ['chuva', 1], ['correr', 1], ['e', 1], ['o', 1], ['passou', 1], ['rio', 1], ['seca', 1], ['voltou', 2]] }],
      },
    ],
  },
  {
    id: 'sp-glom',
    tipo: 'problema',
    titulo: 'Ver as partições',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>n</code> e <code>k</code> (uma linha cada) e guarde em <code>particoes</code> o conteúdo de cada uma das <code>k</code> partições de <code>sc.parallelize(range(n), k)</code>, com <code>glom</code>.</p>',
    dica: 'particoes = sc.parallelize(range(n), k).glom().collect()',
    arquivos: programa('glom', py`
      n = int(input())
      k = int(input())
      particoes = []
    `, { rdd: true }),
    solucao: programa('glom', py`
      n = int(input())
      k = int(input())
      particoes = sc.parallelize(range(n), k).glom().collect()
      print(particoes)
    `, { rdd: true }),
    testes: [
      { descricao: 'n = 10, k = 4', entrada: ['10', '4'], regras: [{ variavel: 'particoes', igual: [[0, 1], [2, 3, 4], [5, 6], [7, 8, 9]] }, { codigo: 'glom', msg: 'O código usa glom' }] },
      { descricao: 'n = 7, k = 3', oculto: true, entrada: ['7', '3'], regras: [{ variavel: 'particoes', igual: [[0, 1], [2, 3], [4, 5, 6]] }] },
    ],
  },
  {
    id: 'sp-media-por-chave',
    tipo: 'problema',
    titulo: 'Média por cidade',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>k</code> e depois <code>k</code> linhas <code>cidade temperatura</code>. Guarde em <code>medias</code> um dicionário <code>{cidade: média}</code> com 1 casa, usando <code>mapValues</code> e <code>reduceByKey</code> com o par <code>(soma, contagem)</code>.</p>',
    dica: 'mapValues(lambda t: (t, 1)), reduceByKey(lambda a, b: (a[0] + b[0], a[1] + b[1])), e no fim round(soma / contagem, 1).',
    arquivos: programa('medias', py`
      k = int(input())
      leituras = []
      for _ in range(k):
          cidade, temperatura = input().split()
          leituras.append((cidade, float(temperatura)))
      medias = {}
    `, { rdd: true }),
    solucao: programa('medias', py`
      k = int(input())
      leituras = []
      for _ in range(k):
          cidade, temperatura = input().split()
          leituras.append((cidade, float(temperatura)))
      somas = sc.parallelize(leituras).mapValues(lambda t: (t, 1)).reduceByKey(lambda a, b: (a[0] + b[0], a[1] + b[1]))
      medias = {cidade: round(s / n, 1) for cidade, (s, n) in somas.collect()}
      print(medias)
    `, { rdd: true }),
    testes: [
      { descricao: 'Crato e Sobral', entrada: ['3', 'Crato 30', 'Crato 33', 'Sobral 35'], regras: [{ variavel: 'medias', igual: { Crato: 31.5, Sobral: 35 } }, { codigo: 'reduceByKey', msg: 'O código usa reduceByKey' }] },
      { descricao: 'uma cidade', oculto: true, entrada: ['1', 'Juazeiro 28'], regras: [{ variavel: 'medias', igual: { Juazeiro: 28 } }] },
    ],
  },
  {
    id: 'sp-join-rdd',
    tipo: 'problema',
    titulo: 'Juntar dois RDDs',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>k</code> e <code>k</code> linhas <code>id valor</code> (as compras). Guarde em <code>pares</code> o <code>join</code> de <code>nomes</code> com as compras, ordenado: cada item é <code>(id, (nome, valor))</code>.</p>',
    dica: 'pares = sorted(sc.parallelize(nomes).join(sc.parallelize(compras)).collect())',
    arquivos: programa('join', py`
      nomes = [(1, "Ana"), (2, "Bia"), (3, "Caio")]
      k = int(input())
      compras = [tuple(int(x) for x in input().split()) for _ in range(k)]
      pares = []
    `, { rdd: true }),
    solucao: programa('join', py`
      nomes = [(1, "Ana"), (2, "Bia"), (3, "Caio")]
      k = int(input())
      compras = [tuple(int(x) for x in input().split()) for _ in range(k)]
      pares = sorted(sc.parallelize(nomes).join(sc.parallelize(compras)).collect())
      print(pares)
    `, { rdd: true }),
    testes: [
      { descricao: 'Ana e Caio compraram', entrada: ['2', '1 10', '3 5'], regras: [{ variavel: 'pares', igual: [[1, ['Ana', 10]], [3, ['Caio', 5]]] }, { codigo: '\\.join\\(', msg: 'O código usa join' }] },
      { descricao: 'compra de quem não existe', oculto: true, entrada: ['1', '4 9'], regras: [{ variavel: 'pares', igual: [] }] },
    ],
  },
  {
    id: 'sp-map-partitions',
    tipo: 'problema',
    titulo: 'Uma soma por partição',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>n</code> e guarde em <code>somas</code> a soma de cada uma das 4 partições de <code>sc.parallelize(list(range(1, n + 1)), 4)</code>, com <code>mapPartitions</code> (uma soma por partição, na ordem).</p>',
    dica: 'mapPartitions recebe um iterador: mapPartitions(lambda parte: [sum(parte)]).collect()',
    arquivos: programa('somas', py`
      n = int(input())
      rdd = sc.parallelize(list(range(1, n + 1)), 4)
      somas = [rdd.sum()]
    `, { rdd: true }),
    solucao: programa('somas', py`
      n = int(input())
      rdd = sc.parallelize(list(range(1, n + 1)), 4)
      somas = rdd.mapPartitions(lambda parte: [sum(parte)]).collect()
      print(somas)
    `, { rdd: true }),
    testes: [
      { descricao: 'n = 8', entrada: ['8'], regras: [{ variavel: 'somas', igual: [3, 7, 11, 15] }, { codigo: 'mapPartitions', msg: 'O código usa mapPartitions' }, { paralelo: { workers: 2 } }] },
      { descricao: 'n = 12', oculto: true, entrada: ['12'], regras: [{ variavel: 'somas', igual: [6, 15, 24, 33] }] },
    ],
  },
];

export const exercicioUdf = {
  id: 'sp-udf',
  tipo: 'problema',
  titulo: 'Uma UDF para a região',
  dificuldade: 'medio',
  enunciado: '<p>Em <code>pessoas.csv</code>, crie <code>com_regiao</code>: o DataFrame com a coluna <code>regiao</code> = <code>regiao_da_cidade(cidade)</code>, uma UDF que devolve <code>"Nordeste"</code> para Recife, Fortaleza, Salvador e Natal, <code>"Sudeste"</code> para São Paulo e Rio de Janeiro, e <code>"Outra"</code> para o resto (e para cidade <code>NULL</code>).</p>',
  dica: 'Use @F.udf("string") em cima da função e withColumn("regiao", regiao_da_cidade("cidade")).',
  arquivos: programa('udf', py`
    ${LER_PESSOAS}

    def regiao_da_cidade(cidade):
        return "Outra"


    com_regiao = df
    com_regiao.show()
  `),
  solucao: programa('udf', py`
    ${LER_PESSOAS}

    @F.udf("string")
    def regiao_da_cidade(cidade):
        if cidade in ("Recife", "Fortaleza", "Salvador", "Natal"):
            return "Nordeste"
        if cidade in ("São Paulo", "Rio de Janeiro"):
            return "Sudeste"
        return "Outra"


    com_regiao = df.withColumn("regiao", regiao_da_cidade("cidade"))
    com_regiao.show()
  `),
  dados: dadosPessoas,
  testes: [
    {
      descricao: 'pessoas.csv',
      regras: [
        {
          dataframe: 'com_regiao',
          colunas: ['nome', 'idade', 'cidade', 'nota', 'regiao'],
          linhas: [['  Ana', 31, 'Recife', 8.5, 'Nordeste'], ['bia ', 15, 'Fortaleza', null, 'Nordeste'], ['CAIO', 8, null, 7, 'Outra'], ['davi', 64, 'São Paulo', 9, 'Sudeste'], [' Edu ', 22, 'Curitiba', 6.5, 'Outra'], ['Fia', 17, null, null, 'Outra']],
        },
        { codigo: 'udf', msg: 'O código usa uma UDF' },
      ],
    },
    {
      descricao: 'outras pessoas',
      oculto: true,
      dados: ocultoPessoas,
      regras: [{
        dataframe: 'com_regiao',
        colunas: ['nome', 'idade', 'cidade', 'nota', 'regiao'],
        linhas: [['gil ', 45, 'Salvador', 7.5, 'Nordeste'], [' HANA', 11, 'Rio de Janeiro', null, 'Sudeste'], ['Ivo', 70, null, 8, 'Outra'], ['jade', 19, 'Natal', 9.5, 'Nordeste']],
      }],
    },
  ],
};

/**
 * Exercício de DataFrame: lê o arquivo; o inicial deixa a variável igual ao DataFrame lido.
 * `esperado`: as linhas do caso visível e as do oculto (com os dados de cada um).
 */
function exercicioDf({ id, titulo, dificuldade, enunciado, dica, variavel, inicial, solucao, esperado, ler = LER_VENDAS, dados = dadosVendas, oculto = ocultoVendas, regras = {}, extras = [], extrasOcultos = [] }) {
  const regra = (linhas) => ({ dataframe: variavel, ...regras, linhas });
  return {
    id,
    tipo: 'problema',
    titulo,
    dificuldade,
    enunciado,
    dica,
    arquivos: programa(id, `${ler}${inicial ?? `${variavel} = df\n`}${variavel}.show()\n`),
    solucao: programa(id, `${ler}${solucao}${variavel}.show()\n`),
    dados,
    testes: [
      { descricao: Object.keys(dados)[0], regras: [regra(esperado[0]), ...extras] },
      { descricao: 'outros dados', oculto: true, dados: oculto, regras: [regra(esperado[1]), ...extrasOcultos] },
    ],
  };
}

export const exerciciosDataFrame = [
  {
    id: 'sp-criar-df',
    tipo: 'problema',
    titulo: 'Criar um DataFrame',
    dificuldade: 'facil',
    enunciado: '<p>Crie <code>pessoas</code>, um DataFrame com as colunas <code>nome</code> e <code>idade</code> a partir de <code>dados</code>, e mostre o schema com <code>printSchema()</code>.</p>',
    dica: 'pessoas = spark.createDataFrame(dados, ["nome", "idade"]) e pessoas.printSchema()',
    arquivos: programa('criar', py`
      dados = [("Ana", 31), ("Bia", 25), ("Caio", 40)]
      pessoas = None  # crie o DataFrame aqui
    `),
    solucao: programa('criar', py`
      dados = [("Ana", 31), ("Bia", 25), ("Caio", 40)]
      pessoas = spark.createDataFrame(dados, ["nome", "idade"])
      pessoas.printSchema()
      pessoas.show()
    `),
    testes: [
      {
        descricao: 'Ana, Bia e Caio',
        regras: [
          { dataframe: 'pessoas', colunas: ['nome', 'idade'], tipos: ['string', 'bigint'], linhas: [['Ana', 31], ['Bia', 25], ['Caio', 40]] },
          { saida: ' |-- idade: long (nullable = true)', msg: 'O schema aparece na saída' },
        ],
      },
      {
        descricao: 'o programa só depende do próprio código',
        oculto: true,
        regras: [{ dataframe: 'pessoas', tipos: ['string', 'bigint'], linhas: [['Ana', 31], ['Bia', 25], ['Caio', 40]] }],
      },
    ],
  },
  exercicioDf({
    id: 'sp-select-filter',
    esperado: [
      [['Arroz 5kg', 24.9], ['Café 500g', 19.9], ['Queijo coalho', 32], ['Arroz 5kg', 25.5], ['Café 500g', 18.9]],
      [['Queijo coalho', 30], ['Café 500g', 21], ['Arroz 5kg', 23.4]],
    ],
    titulo: 'Produtos caros',
    dificuldade: 'facil',
    enunciado: '<p>Leia <code>vendas.csv</code> e guarde em <code>caros</code> só o <code>produto</code> e o <code>preco</code> das vendas com <code>preco &gt; 10</code>.</p>',
    dica: 'caros = df.filter(F.col("preco") > 10).select("produto", "preco")',
    variavel: 'caros',
    solucao: 'caros = df.filter(F.col("preco") > 10).select("produto", "preco")\n',
    regras: { colunas: ['produto', 'preco'] },
  }),
  exercicioDf({
    id: 'sp-with-column',
    esperado: [
      [['2026-01-05', 'Nordeste', 'Arroz 5kg', 2, 24.9, 49.8], ['2026-01-12', 'Sudeste', 'Feijão 1kg', 3, 8.5, 25.5], ['2026-01-20', 'Nordeste', 'Café 500g', 1, 19.9, 19.9], ['2026-02-03', 'Norte', 'Rapadura', 10, 2.5, 25], ['2026-02-14', 'Sul', 'Farinha de mandioca', 4, 6.8, 27.2], ['2026-02-21', 'Nordeste', 'Queijo coalho', 2, 32, 64], ['2026-03-02', 'Sudeste', 'Arroz 5kg', 1, 25.5, 25.5], ['2026-03-15', 'Norte', 'Café 500g', 5, 18.9, 94.5]],
      [['2026-04-01', 'Norte', 'Queijo coalho', 3, 30, 90], ['2026-04-09', 'Nordeste', 'Rapadura', 20, 2.2, 44], ['2026-04-18', 'Norte', 'Feijão 1kg', 2, 9.1, 18.2], ['2026-05-02', 'Sudeste', 'Café 500g', 4, 21, 84], ['2026-05-20', 'Nordeste', 'Arroz 5kg', 1, 23.4, 23.4], ['2026-06-11', 'Sudeste', 'Farinha de mandioca', 6, 7.5, 45]],
    ],
    titulo: 'Coluna calculada',
    dificuldade: 'facil',
    enunciado: '<p>Guarde em <code>com_total</code> o <code>vendas.csv</code> com uma coluna nova, <code>total</code> = <code>quantidade * preco</code>, arredondada em 2 casas.</p>',
    dica: 'withColumn("total", F.round(F.col("quantidade") * F.col("preco"), 2))',
    variavel: 'com_total',
    solucao: 'com_total = df.withColumn("total", F.round(F.col("quantidade") * F.col("preco"), 2))\n',
    regras: { colunas: ['data', 'regiao', 'produto', 'quantidade', 'preco', 'total'] },
    extras: [{ codigo: 'withColumn', msg: 'O código usa withColumn' }],
  }),
  {
    id: 'sp-show',
    tipo: 'problema',
    titulo: 'Os 3 mais caros',
    dificuldade: 'facil',
    enunciado: '<p>Mostre o <code>produto</code> e o <code>preco</code> das <b>3</b> vendas de maior preço, do mais caro para o mais barato, com <code>show(3)</code>.</p>',
    dica: 'df.orderBy(F.desc("preco")).select("produto", "preco").show(3)',
    arquivos: programa('top3', `${LER_VENDAS}df.show()\n`),
    solucao: programa('top3', `${LER_VENDAS}df.orderBy(F.desc("preco")).select("produto", "preco").show(3)\n`),
    dados: dadosVendas,
    testes: [
      {
        descricao: 'vendas.csv',
        regras: [{ saidaIgual: '+-------------+-----+\n|      produto|preco|\n+-------------+-----+\n|Queijo coalho| 32.0|\n|    Arroz 5kg| 25.5|\n|    Arroz 5kg| 24.9|\n+-------------+-----+\nonly showing top 3 rows' }],
      },
      {
        descricao: 'outros dados',
        oculto: true,
        dados: ocultoVendas,
        regras: [{ saidaIgual: '+-------------+-----+\n|      produto|preco|\n+-------------+-----+\n|Queijo coalho| 30.0|\n|    Arroz 5kg| 23.4|\n|    Café 500g| 21.0|\n+-------------+-----+\nonly showing top 3 rows' }],
      },
    ],
  },
  exercicioDf({
    id: 'sp-renomear',
    esperado: [
      [['Nordeste', 'Arroz 5kg', 2, 24.9], ['Sudeste', 'Feijão 1kg', 3, 8.5], ['Nordeste', 'Café 500g', 1, 19.9], ['Norte', 'Rapadura', 10, 2.5], ['Sul', 'Farinha de mandioca', 4, 6.8], ['Nordeste', 'Queijo coalho', 2, 32], ['Sudeste', 'Arroz 5kg', 1, 25.5], ['Norte', 'Café 500g', 5, 18.9]],
      [['Norte', 'Queijo coalho', 3, 30], ['Nordeste', 'Rapadura', 20, 2.2], ['Norte', 'Feijão 1kg', 2, 9.1], ['Sudeste', 'Café 500g', 4, 21], ['Nordeste', 'Arroz 5kg', 1, 23.4], ['Sudeste', 'Farinha de mandioca', 6, 7.5]],
    ],
    titulo: 'Renomear e remover',
    dificuldade: 'facil',
    enunciado: '<p>Guarde em <code>limpo</code> o <code>vendas.csv</code> sem a coluna <code>data</code> e com <code>preco</code> renomeada para <code>preco_unitario</code>.</p>',
    dica: 'df.drop("data").withColumnRenamed("preco", "preco_unitario")',
    variavel: 'limpo',
    solucao: 'limpo = df.drop("data").withColumnRenamed("preco", "preco_unitario")\n',
    regras: { colunas: ['regiao', 'produto', 'quantidade', 'preco_unitario'] },
  }),
  exercicioDf({
    id: 'sp-when',
    esperado: [
      [['  Ana', 'adulto'], ['bia ', 'jovem'], ['CAIO', 'criança'], ['davi', 'idoso'], [' Edu ', 'adulto'], ['Fia', 'jovem']],
      [['gil ', 'adulto'], [' HANA', 'criança'], ['Ivo', 'idoso'], ['jade', 'adulto']],
    ],
    titulo: 'Faixa de idade',
    dificuldade: 'medio',
    enunciado: '<p>Em <code>pessoas.csv</code>, guarde em <code>faixas</code> o <code>nome</code> e a <code>faixa</code>: <code>"criança"</code> abaixo de 12 anos, <code>"jovem"</code> abaixo de 18, <code>"adulto"</code> abaixo de 60 e <code>"idoso"</code> no resto.</p>',
    dica: 'F.when(F.col("idade") < 12, "criança").when(F.col("idade") < 18, "jovem").when(F.col("idade") < 60, "adulto").otherwise("idoso")',
    variavel: 'faixas',
    ler: LER_PESSOAS,
    dados: dadosPessoas,
    oculto: ocultoPessoas,
    inicial: 'faixas = df.select("nome")\n',
    solucao: py`
      faixa = (F.when(F.col("idade") < 12, "criança").when(F.col("idade") < 18, "jovem")
               .when(F.col("idade") < 60, "adulto").otherwise("idoso"))
      faixas = df.select("nome", faixa.alias("faixa"))
    `,
    regras: { colunas: ['nome', 'faixa'] },
  }),
  exercicioDf({
    id: 'sp-strings',
    esperado: [
      [['ANA - Recife'], ['BIA - Fortaleza'], ['CAIO - SEM CIDADE'], ['DAVI - São Paulo'], ['EDU - Curitiba'], ['FIA - SEM CIDADE']],
      [['GIL - Salvador'], ['HANA - Rio De Janeiro'], ['IVO - SEM CIDADE'], ['JADE - Natal']],
    ],
    titulo: 'Texto arrumado',
    dificuldade: 'medio',
    enunciado: '<p>Os nomes de <code>pessoas.csv</code> vieram com espaços e maiúsculas misturadas. Guarde em <code>cartao</code> uma coluna só, <code>rotulo</code> = <code>NOME - Cidade</code>: o nome sem espaços nas pontas e em maiúsculas, <code> - </code>, e a cidade com a primeira letra de cada palavra maiúscula. Cidade <code>NULL</code> vira <code>SEM CIDADE</code>.</p>',
    dica: 'F.concat_ws(" - ", F.upper(F.trim("nome")), F.coalesce(F.initcap("cidade"), F.lit("SEM CIDADE"))).alias("rotulo")',
    variavel: 'cartao',
    ler: LER_PESSOAS,
    dados: dadosPessoas,
    oculto: ocultoPessoas,
    inicial: 'cartao = df.select("nome")\n',
    solucao: py`
      cidade = F.coalesce(F.initcap("cidade"), F.lit("SEM CIDADE"))
      cartao = df.select(F.concat_ws(" - ", F.upper(F.trim("nome")), cidade).alias("rotulo"))
    `,
    regras: { colunas: ['rotulo'] },
  }),
  exercicioDf({
    id: 'sp-datas',
    esperado: [
      [[2026, 1, 6], [2026, 2, 16], [2026, 3, 6]],
      [[2026, 4, 25], [2026, 5, 5], [2026, 6, 6]],
    ],
    titulo: 'Vendas por mês',
    dificuldade: 'medio',
    enunciado: '<p>Em <code>vendas.csv</code>, guarde em <code>por_mes</code> as colunas <code>ano</code>, <code>mes</code> e <code>quantidade</code> (o total vendido no mês), ordenado por ano e mês.</p>',
    dica: 'F.year(F.to_date("data")).alias("ano"), F.month(...).alias("mes"); depois groupBy("ano", "mes").agg(F.sum("quantidade").alias("quantidade")).orderBy("ano", "mes")',
    variavel: 'por_mes',
    solucao: py`
      datas = df.select(F.year(F.to_date("data")).alias("ano"), F.month(F.to_date("data")).alias("mes"), "quantidade")
      por_mes = datas.groupBy("ano", "mes").agg(F.sum("quantidade").alias("quantidade")).orderBy("ano", "mes")
    `,
    regras: { colunas: ['ano', 'mes', 'quantidade'], ordem: true },
  }),
  exercicioDf({
    id: 'sp-cast',
    esperado: [
      [['2026-01-05', 'Nordeste', 'Arroz 5kg', 2, 24.9], ['2026-01-12', 'Sudeste', 'Feijão 1kg', 3, 8.5], ['2026-01-20', 'Nordeste', 'Café 500g', 1, 19.9], ['2026-02-03', 'Norte', 'Rapadura', 10, 2.5], ['2026-02-14', 'Sul', 'Farinha de mandioca', 4, 6.8], ['2026-02-21', 'Nordeste', 'Queijo coalho', 2, 32], ['2026-03-02', 'Sudeste', 'Arroz 5kg', 1, 25.5], ['2026-03-15', 'Norte', 'Café 500g', 5, 18.9]],
      [['2026-04-01', 'Norte', 'Queijo coalho', 3, 30], ['2026-04-09', 'Nordeste', 'Rapadura', 20, 2.2], ['2026-04-18', 'Norte', 'Feijão 1kg', 2, 9.1], ['2026-05-02', 'Sudeste', 'Café 500g', 4, 21], ['2026-05-20', 'Nordeste', 'Arroz 5kg', 1, 23.4], ['2026-06-11', 'Sudeste', 'Farinha de mandioca', 6, 7.5]],
    ],
    titulo: 'Tipos certos',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>vendas.csv</code> <b>sem</b> <code>inferSchema</code> (tudo vem como texto) e guarde em <code>tipado</code> o mesmo DataFrame com <code>quantidade</code> como <code>int</code> e <code>preco</code> como <code>double</code>.</p>',
    dica: 'withColumn("quantidade", F.col("quantidade").cast("int")) e o mesmo para preco com "double".',
    variavel: 'tipado',
    ler: 'df = spark.read.csv("vendas.csv", header=True)\n',
    solucao: py`
      tipado = (df.withColumn("quantidade", F.col("quantidade").cast("int"))
                .withColumn("preco", F.col("preco").cast("double")))
    `,
    regras: { tipos: ['string', 'string', 'string', 'int', 'double'] },
    extras: [{ semCodigo: 'inferSchema', msg: 'O código não usa inferSchema' }],
  }),
  exercicioDf({
    id: 'sp-na-fill',
    esperado: [
      [['  Ana', 31, 'Recife', 8.5], ['bia ', 15, 'Fortaleza', 0], ['CAIO', 8, 'Não informada', 7], ['davi', 64, 'São Paulo', 9], [' Edu ', 22, 'Curitiba', 6.5], ['Fia', 17, 'Não informada', 0]],
      [['gil ', 45, 'Salvador', 7.5], [' HANA', 11, 'Rio de Janeiro', 0], ['Ivo', 70, 'Não informada', 8], ['jade', 19, 'Natal', 9.5]],
    ],
    titulo: 'Preencher nulos',
    dificuldade: 'facil',
    enunciado: '<p>Em <code>pessoas.csv</code>, guarde em <code>completo</code> o DataFrame com a <code>cidade</code> que falta trocada por <code>"Não informada"</code> e a <code>nota</code> que falta trocada por <code>0.0</code>.</p>',
    dica: 'df.na.fill({"cidade": "Não informada", "nota": 0.0})',
    variavel: 'completo',
    ler: LER_PESSOAS,
    dados: dadosPessoas,
    oculto: ocultoPessoas,
    solucao: 'completo = df.na.fill({"cidade": "Não informada", "nota": 0.0})\n',
    regras: { colunas: ['nome', 'idade', 'cidade', 'nota'] },
  }),
  exercicioDf({
    id: 'sp-na-drop',
    esperado: [
      [['  Ana', 31, 'Recife', 8.5], ['CAIO', 8, null, 7], ['davi', 64, 'São Paulo', 9], [' Edu ', 22, 'Curitiba', 6.5]],
      [['gil ', 45, 'Salvador', 7.5], ['Ivo', 70, null, 8], ['jade', 19, 'Natal', 9.5]],
    ],
    titulo: 'Tirar linhas sem nota',
    dificuldade: 'facil',
    enunciado: '<p>Em <code>pessoas.csv</code>, guarde em <code>com_nota</code> só as pessoas que têm <code>nota</code>.</p>',
    dica: 'df.dropna(subset=["nota"])',
    variavel: 'com_nota',
    ler: LER_PESSOAS,
    dados: dadosPessoas,
    oculto: ocultoPessoas,
    solucao: 'com_nota = df.dropna(subset=["nota"])\n',
    regras: { colunas: ['nome', 'idade', 'cidade', 'nota'] },
  }),
  exercicioDf({
    id: 'sp-coalesce-null',
    esperado: [
      [['Ana', '(81) 99999-0001'], ['Bia', 'bia@exemplo.com'], ['Caio', 'sem contato'], ['Davi', '(85) 98888-0002']],
      [['Edu', 'edu@exemplo.com'], ['Fia', '(84) 97777-0003'], ['Gil', 'sem contato']],
    ],
    titulo: 'Primeiro contato disponível',
    dificuldade: 'medio',
    enunciado: '<p>Em <code>contatos.csv</code> (<code>nome,telefone,email</code>), guarde em <code>contato</code> o <code>nome</code> e o <code>meio</code>: o telefone, se houver; senão o email; senão <code>"sem contato"</code>.</p>',
    dica: 'F.coalesce("telefone", "email", F.lit("sem contato")).alias("meio")',
    variavel: 'contato',
    ler: 'df = spark.read.csv("contatos.csv", header=True)\n',
    dados: { 'contatos.csv': CONTATOS },
    oculto: { 'contatos.csv': CONTATOS_OCULTO },
    inicial: 'contato = df.select("nome")\n',
    solucao: 'contato = df.select("nome", F.coalesce("telefone", "email", F.lit("sem contato")).alias("meio"))\n',
    regras: { colunas: ['nome', 'meio'] },
  }),
];

export const exerciciosAgregacao = [
  exercicioDf({
    id: 'sp-group-count',
    esperado: [
      [['Nordeste', 3], ['Norte', 2], ['Sudeste', 2], ['Sul', 1]],
      [['Nordeste', 2], ['Norte', 2], ['Sudeste', 2]],
    ],
    titulo: 'Vendas por região',
    dificuldade: 'facil',
    enunciado: '<p>Guarde em <code>por_regiao</code> quantas vendas cada região teve (colunas <code>regiao</code> e <code>count</code>), em ordem alfabética de região.</p>',
    dica: 'df.groupBy("regiao").count().orderBy("regiao")',
    variavel: 'por_regiao',
    solucao: 'por_regiao = df.groupBy("regiao").count().orderBy("regiao")\n',
    regras: { colunas: ['regiao', 'count'], ordem: true },
    extras: [{ paralelo: { workers: 2 } }],
  }),
  exercicioDf({
    id: 'sp-agg',
    esperado: [
      [['Norte', 119.5, 10.7, 2], ['Sul', 27.2, 6.8, 1], ['Nordeste', 133.7, 25.6, 3], ['Sudeste', 51, 17, 2]],
      [['Norte', 108.2, 19.55, 2], ['Nordeste', 67.4, 12.8, 2], ['Sudeste', 129, 14.25, 2]],
    ],
    titulo: 'Resumo por região',
    dificuldade: 'medio',
    enunciado: '<p>Guarde em <code>resumo</code>, por região: <code>receita</code> (a soma de <code>quantidade * preco</code>, com 2 casas), <code>preco_medio</code> (com 2 casas) e <code>produtos</code> (quantos produtos diferentes).</p>',
    dica: 'groupBy("regiao").agg(F.round(F.sum(F.col("quantidade") * F.col("preco")), 2).alias("receita"), F.round(F.avg("preco"), 2).alias("preco_medio"), F.countDistinct("produto").alias("produtos"))',
    variavel: 'resumo',
    inicial: 'resumo = df.groupBy("regiao").count()\n',
    solucao: py`
      resumo = df.groupBy("regiao").agg(
          F.round(F.sum(F.col("quantidade") * F.col("preco")), 2).alias("receita"),
          F.round(F.avg("preco"), 2).alias("preco_medio"),
          F.countDistinct("produto").alias("produtos"),
      )
    `,
    regras: { colunas: ['regiao', 'receita', 'preco_medio', 'produtos'], tipos: ['string', 'double', 'double', 'bigint'] },
  }),
];

export const moduloPyspark = {
  id: 'pyspark',
  titulo: 'PySpark',
  icone: '✨',
  descricao: 'SparkSession, RDD, DataFrame, nulos, agregações, joins e broadcast, Window, leitura e escrita, Spark SQL, partições, shuffle, cache, explain e UDF. Uma implementação para aprender, com a API do PySpark, rodando em paralelo no seu navegador.',
  itens: [
    licoes.sessao,
    licoes.rdd,
    exerciciosRdd[0], exerciciosRdd[1],
    licoes.pares,
    exerciciosRdd[2], exerciciosRdd[4], exerciciosRdd[5],
    licoes.particoes,
    exerciciosRdd[3], exerciciosRdd[6],
    licoes.dataframe,
    ...exerciciosDataFrame.slice(0, 5),
    licoes.funcoes,
    ...exerciciosDataFrame.slice(5, 9),
    licoes.udf,
    exercicioUdf,
    licoes.nulos,
    ...exerciciosDataFrame.slice(9),
    licoes.agregacoes,
    ...exerciciosAgregacao,
    licoes.joins,
    licoes.janela,
    licoes.leitura,
    licoes.sql,
    licoes.shuffle,
  ],
};
