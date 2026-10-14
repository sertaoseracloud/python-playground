// ✨ PySpark, segunda parte (exercícios 23 a 45): agregações, joins e broadcast, janelas,
// leitura e escrita, Spark SQL e desempenho (shuffle, cache, partições e skew). Cada bloco
// entra na trilha depois da lição do assunto (veja pyspark.js).
import { py } from './util.js';
import { programa, exercicioDf, dadosVendas, ocultoVendas, LER_VENDAS, PESSOAS, PESSOAS_OCULTO } from './pyspark-comum.js';

// ---------- dados novos ----------
const CLIENTES = `id_cliente,nome,cidade
1,Ana,Recife
2,Bia,Natal
3,Caio,Recife
4,Davi,Fortaleza
5,Edu,Natal
`;
const CLIENTES_OCULTO = `id_cliente,nome,cidade
1,Gil,Salvador
2,Hana,Natal
3,Ivo,Salvador
4,Jade,Recife
`;
// Um cliente sem pedido (Davi; Hana nos ocultos) e um pedido de cliente desconhecido (9; 7).
const PEDIDOS = `id_pedido,id_cliente,valor
101,1,120.50
102,2,35.90
103,1,80.00
104,3,15.25
105,5,60.00
106,9,42.00
107,2,19.10
`;
const PEDIDOS_OCULTO = `id_pedido,id_cliente,valor
201,1,50.00
202,3,70.40
203,3,10.00
204,7,99.90
205,4,25.50
`;
const NOTAS = `{"nome": "Ana", "turma": 1, "nota": 9.0}
{"nome": "Bia", "turma": 1, "nota": 9.0}
{"nome": "Caio", "turma": 1, "nota": 7.5}
{"nome": "Davi", "turma": 2, "nota": 8.0}
{"nome": "Edu", "turma": 2, "nota": 6.5}
{"nome": "Fia", "turma": 2, "nota": 8.0}
{"nome": "Gil", "turma": 2, "nota": 5.0}
`;
const NOTAS_OCULTO = `{"nome": "Hana", "turma": 3, "nota": 10.0}
{"nome": "Ivo", "turma": 3, "nota": 10.0}
{"nome": "Jade", "turma": 3, "nota": 10.0}
{"nome": "Lia", "turma": 3, "nota": 4.0}
{"nome": "Max", "turma": 4, "nota": 7.0}
`;
const LEITURAS = `dia,sensor,temperatura
2026-01-01,Crato,31.2
2026-01-01,Sobral,33.5
2026-01-02,Crato,32.0
2026-01-02,Sobral,34.1
2026-01-03,Crato,30.4
2026-01-03,Sobral,35.0
2026-01-04,Crato,29.9
2026-01-04,Sobral,34.4
2026-01-05,Crato,31.5
2026-01-05,Sobral,33.0
2026-01-06,Crato,32.8
2026-01-06,Sobral,36.2
`;
const LEITURAS_OCULTO = `dia,sensor,temperatura
2026-02-01,Patos,30.0
2026-02-01,Juazeiro,32.0
2026-02-02,Patos,31.5
2026-02-02,Juazeiro,31.0
2026-02-03,Patos,29.0
2026-02-03,Juazeiro,33.5
2026-02-04,Patos,30.5
2026-02-04,Juazeiro,34.0
`;
const REGIOES = `regiao,capital
Nordeste,Recife
Norte,Belém
Sudeste,São Paulo
Sul,Porto Alegre
`;
const REGIOES_OCULTO = `regiao,capital
Nordeste,Salvador
Norte,Manaus
Sudeste,Rio de Janeiro
`;
// Uma página com quase todas as linhas: o desequilíbrio (skew) do exercício 45.
const linhasDeCliques = (paginas) => paginas.map(([pagina, cliques], i) => `${i + 1},${pagina},${cliques}`).join('\n');
const CLIQUES = `id,pagina,cliques\n${linhasDeCliques([
  ...Array.from({ length: 14 }, (_, i) => ['inicio', (i % 5) + 1]), ['contato', 2], ['sobre', 3], ['inicio', 4], ['contato', 1],
])}\n`;
const CLIQUES_OCULTO = `id,pagina,cliques\n${linhasDeCliques([
  ...Array.from({ length: 9 }, (_, i) => ['loja', (i % 3) + 2]), ['ajuda', 5],
])}\n`;

const LER_LOJA = 'pedidos = spark.read.csv("pedidos.csv", header=True, inferSchema=True)\nclientes = spark.read.csv("clientes.csv", header=True, inferSchema=True)\n';
const dadosLoja = { 'pedidos.csv': PEDIDOS, 'clientes.csv': CLIENTES };
const ocultoLoja = { 'pedidos.csv': PEDIDOS_OCULTO, 'clientes.csv': CLIENTES_OCULTO };
const LER_LEITURAS = 'df = spark.read.csv("leituras.csv", header=True, inferSchema=True)\n';
const dadosLeituras = { 'leituras.csv': LEITURAS };
const ocultoLeituras = { 'leituras.csv': LEITURAS_OCULTO };
const COM_JANELA = 'from pyspark.sql import Window\n\n';
const VIEW_VENDAS = `${LER_VENDAS}df.createOrReplaceTempView("vendas")\n`;

// ---------- agregações (depois de licao-agregacoes) ----------
export const exerciciosAgregacoes = [
  exercicioDf({
    id: 'sp-pivot',
    titulo: 'Quantidade por produto e mês',
    dificuldade: 'dificil',
    enunciado: '<p>Guarde em <code>tabela</code> uma linha por produto e uma coluna por mês (<code>1</code>, <code>2</code>...) com a quantidade total vendida; o mês sem venda fica <code>NULL</code>. Ordene por produto.</p>',
    dica: 'withColumn("mes", F.month(F.to_date("data"))).groupBy("produto").pivot("mes").sum("quantidade").orderBy("produto")',
    variavel: 'tabela',
    inicial: 'tabela = df.groupBy("produto").sum("quantidade")\n',
    solucao: 'tabela = df.withColumn("mes", F.month(F.to_date("data"))).groupBy("produto").pivot("mes").sum("quantidade").orderBy("produto")\n',
    regras: { ordem: true },
    extras: [{ codigo: 'pivot', msg: 'O código usa pivot' }],
    esperado: [
      [['Arroz 5kg', 2, null, 1], ['Café 500g', 1, null, 5], ['Farinha de mandioca', null, 4, null], ['Feijão 1kg', 3, null, null], ['Queijo coalho', null, 2, null], ['Rapadura', null, 10, null]],
      [['Arroz 5kg', null, 1, null], ['Café 500g', null, 4, null], ['Farinha de mandioca', null, null, 6], ['Feijão 1kg', 2, null, null], ['Queijo coalho', 3, null, null], ['Rapadura', 20, null, null]],
    ],
  }),
  exercicioDf({
    id: 'sp-collect-list',
    titulo: 'Produtos de cada região',
    dificuldade: 'medio',
    enunciado: '<p>Guarde em <code>listas</code>, por região, a coluna <code>produtos</code>: a lista em ordem alfabética dos produtos diferentes vendidos ali.</p>',
    dica: 'groupBy("regiao").agg(F.sort_array(F.collect_set("produto")).alias("produtos"))',
    variavel: 'listas',
    inicial: 'listas = df.select("regiao", "produto")\n',
    solucao: 'listas = df.groupBy("regiao").agg(F.sort_array(F.collect_set("produto")).alias("produtos"))\n',
    regras: { colunas: ['regiao', 'produtos'] },
    esperado: [
      [['Norte', ['Café 500g', 'Rapadura']], ['Sul', ['Farinha de mandioca']], ['Nordeste', ['Arroz 5kg', 'Café 500g', 'Queijo coalho']], ['Sudeste', ['Arroz 5kg', 'Feijão 1kg']]],
      [['Norte', ['Feijão 1kg', 'Queijo coalho']], ['Nordeste', ['Arroz 5kg', 'Rapadura']], ['Sudeste', ['Café 500g', 'Farinha de mandioca']]],
    ],
  }),
];

// ---------- joins (depois de licao-joins) ----------
export const exerciciosJoins = [
  exercicioDf({
    id: 'sp-join-inner',
    titulo: 'Pedidos com o nome',
    dificuldade: 'facil',
    enunciado: '<p>Junte <code>pedidos.csv</code> e <code>clientes.csv</code> em <code>com_nome</code>: cada pedido com o nome e a cidade do cliente. Pedido de cliente que não existe fica de fora.</p>',
    dica: 'com_nome = pedidos.join(clientes, "id_cliente")',
    variavel: 'com_nome',
    ler: LER_LOJA,
    dados: dadosLoja,
    oculto: ocultoLoja,
    inicial: 'com_nome = pedidos\n',
    solucao: 'com_nome = pedidos.join(clientes, "id_cliente")\n',
    regras: { colunas: ['id_cliente', 'id_pedido', 'valor', 'nome', 'cidade'] },
    esperado: [
      [[1, 101, 120.5, 'Ana', 'Recife'], [2, 102, 35.9, 'Bia', 'Natal'], [1, 103, 80, 'Ana', 'Recife'], [3, 104, 15.25, 'Caio', 'Recife'], [5, 105, 60, 'Edu', 'Natal'], [2, 107, 19.1, 'Bia', 'Natal']],
      [[1, 201, 50, 'Gil', 'Salvador'], [3, 202, 70.4, 'Ivo', 'Salvador'], [3, 203, 10, 'Ivo', 'Salvador'], [4, 205, 25.5, 'Jade', 'Recife']],
    ],
  }),
  exercicioDf({
    id: 'sp-join-left',
    titulo: 'Pedidos por cliente',
    dificuldade: 'medio',
    enunciado: '<p>Guarde em <code>por_cliente</code> <b>todos</b> os clientes (<code>id_cliente</code> e <code>nome</code>) com a coluna <code>pedidos</code>: quantos pedidos cada um fez (0 para quem não fez nenhum).</p>',
    dica: 'clientes.join(pedidos, "id_cliente", "left").groupBy("id_cliente", "nome").agg(F.count("id_pedido").alias("pedidos")). O count de uma coluna não conta os NULL.',
    variavel: 'por_cliente',
    ler: LER_LOJA,
    dados: dadosLoja,
    oculto: ocultoLoja,
    inicial: 'por_cliente = clientes\n',
    solucao: 'por_cliente = clientes.join(pedidos, "id_cliente", "left").groupBy("id_cliente", "nome").agg(F.count("id_pedido").alias("pedidos"))\n',
    regras: { colunas: ['id_cliente', 'nome', 'pedidos'] },
    esperado: [
      [[1, 'Ana', 2], [4, 'Davi', 0], [2, 'Bia', 2], [3, 'Caio', 1], [5, 'Edu', 1]],
      [[1, 'Gil', 1], [3, 'Ivo', 2], [4, 'Jade', 1], [2, 'Hana', 0]],
    ],
  }),
  exercicioDf({
    id: 'sp-anti-join',
    titulo: 'Clientes sem pedido',
    dificuldade: 'medio',
    enunciado: '<p>Guarde em <code>sem_pedido</code> os clientes que não aparecem em <code>pedidos.csv</code>, com um <code>left_anti</code> join.</p>',
    dica: 'clientes.join(pedidos, "id_cliente", "left_anti")',
    variavel: 'sem_pedido',
    ler: LER_LOJA,
    dados: dadosLoja,
    oculto: ocultoLoja,
    inicial: 'sem_pedido = clientes\n',
    solucao: 'sem_pedido = clientes.join(pedidos, "id_cliente", "left_anti")\n',
    regras: { colunas: ['id_cliente', 'nome', 'cidade'] },
    extras: [{ codigo: 'left_anti', msg: 'O código usa left_anti' }],
    esperado: [
      [[4, 'Davi', 'Fortaleza']],
      [[2, 'Hana', 'Natal']],
    ],
  }),
  exercicioDf({
    id: 'sp-broadcast',
    titulo: 'Broadcast da tabela pequena',
    dificuldade: 'medio',
    enunciado: '<p>Junte <code>vendas.csv</code> com <code>regioes.csv</code> (a tabela pequena) em <code>com_capital</code>, mandando a tabela pequena por <b>broadcast</b>: o plano não pode ter shuffle.</p>',
    dica: 'com_capital = df.join(F.broadcast(regioes), "regiao")',
    variavel: 'com_capital',
    ler: `${LER_VENDAS}regioes = spark.read.csv("regioes.csv", header=True)\nspark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1)  # o broadcast automático está desligado\n`,
    dados: { ...dadosVendas, 'regioes.csv': REGIOES },
    oculto: { ...ocultoVendas, 'regioes.csv': REGIOES_OCULTO },
    inicial: 'com_capital = df.join(regioes, "regiao")\n',
    solucao: 'com_capital = df.join(F.broadcast(regioes), "regiao")\n',
    regras: { colunas: ['regiao', 'data', 'produto', 'quantidade', 'preco', 'capital'] },
    extras: [{ plano: 'com_capital', broadcast: true, shuffles: 0 }],
    extrasOcultos: [{ plano: 'com_capital', broadcast: true, shuffles: 0 }],
    esperado: [
      [['Nordeste', '2026-01-05', 'Arroz 5kg', 2, 24.9, 'Recife'], ['Sudeste', '2026-01-12', 'Feijão 1kg', 3, 8.5, 'São Paulo'], ['Nordeste', '2026-01-20', 'Café 500g', 1, 19.9, 'Recife'], ['Norte', '2026-02-03', 'Rapadura', 10, 2.5, 'Belém'], ['Sul', '2026-02-14', 'Farinha de mandioca', 4, 6.8, 'Porto Alegre'], ['Nordeste', '2026-02-21', 'Queijo coalho', 2, 32, 'Recife'], ['Sudeste', '2026-03-02', 'Arroz 5kg', 1, 25.5, 'São Paulo'], ['Norte', '2026-03-15', 'Café 500g', 5, 18.9, 'Belém']],
      [['Norte', '2026-04-01', 'Queijo coalho', 3, 30, 'Manaus'], ['Nordeste', '2026-04-09', 'Rapadura', 20, 2.2, 'Salvador'], ['Norte', '2026-04-18', 'Feijão 1kg', 2, 9.1, 'Manaus'], ['Sudeste', '2026-05-02', 'Café 500g', 4, 21, 'Rio de Janeiro'], ['Nordeste', '2026-05-20', 'Arroz 5kg', 1, 23.4, 'Salvador'], ['Sudeste', '2026-06-11', 'Farinha de mandioca', 6, 7.5, 'Rio de Janeiro']],
    ],
  }),
  exercicioDf({
    id: 'sp-sort-merge',
    titulo: 'Sem broadcast',
    dificuldade: 'dificil',
    enunciado: '<p>Desligue o broadcast automático (<code>spark.sql.autoBroadcastJoinThreshold</code> = <code>-1</code>), junte <code>pedidos</code> e <code>clientes</code> em <code>juntos</code> e mostre o plano com <code>explain()</code>. O plano deve mostrar o <code>SortMergeJoin</code>, com os dois shuffles.</p>',
    dica: 'spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1) antes do join; depois juntos.explain().',
    variavel: 'juntos',
    ler: LER_LOJA,
    dados: dadosLoja,
    oculto: ocultoLoja,
    inicial: 'juntos = pedidos.join(clientes, "id_cliente")\n',
    solucao: 'spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1)\njuntos = pedidos.join(clientes, "id_cliente")\njuntos.explain()\n',
    regras: { colunas: ['id_cliente', 'id_pedido', 'valor', 'nome', 'cidade'] },
    extras: [{ plano: 'juntos', broadcast: false, shuffles: 2 }, { saida: 'SortMergeJoin', msg: 'O plano (explain) aparece com o SortMergeJoin' }],
    extrasOcultos: [{ plano: 'juntos', broadcast: false, shuffles: 2 }],
    esperado: [
      [[3, 104, 15.25, 'Caio', 'Recife'], [1, 101, 120.5, 'Ana', 'Recife'], [1, 103, 80, 'Ana', 'Recife'], [5, 105, 60, 'Edu', 'Natal'], [2, 102, 35.9, 'Bia', 'Natal'], [2, 107, 19.1, 'Bia', 'Natal']],
      [[3, 202, 70.4, 'Ivo', 'Salvador'], [3, 203, 10, 'Ivo', 'Salvador'], [4, 205, 25.5, 'Jade', 'Recife'], [1, 201, 50, 'Gil', 'Salvador']],
    ],
  }),
];

// ---------- janelas (depois de licao-window) ----------
export const exerciciosJanelas = [
  exercicioDf({
    id: 'sp-row-number',
    titulo: 'O campeão de cada região',
    dificuldade: 'medio',
    enunciado: '<p>Em cada região, ache a venda de maior receita (<code>quantidade * preco</code>, com 2 casas). Guarde em <code>campeoes</code> a <code>regiao</code>, o <code>produto</code> e a <code>receita</code>. Em empate, fica o produto que vem primeiro em ordem alfabética.</p>',
    dica: 'row_number().over(Window.partitionBy("regiao").orderBy(F.desc("receita"), "produto")) e filter(F.col("n") == 1)',
    variavel: 'campeoes',
    ler: `${COM_JANELA}${LER_VENDAS}`,
    inicial: 'campeoes = df.select("regiao", "produto")\n',
    solucao: py`
      com_receita = df.withColumn("receita", F.round(F.col("quantidade") * F.col("preco"), 2))
      janela = Window.partitionBy("regiao").orderBy(F.desc("receita"), "produto")
      campeoes = com_receita.withColumn("n", F.row_number().over(janela)).filter(F.col("n") == 1).select("regiao", "produto", "receita")
    `,
    regras: { colunas: ['regiao', 'produto', 'receita'] },
    extras: [{ codigo: 'row_number', msg: 'O código usa row_number' }],
    esperado: [
      [['Norte', 'Café 500g', 94.5], ['Sul', 'Farinha de mandioca', 27.2], ['Nordeste', 'Queijo coalho', 64], ['Sudeste', 'Arroz 5kg', 25.5]],
      [['Norte', 'Queijo coalho', 90], ['Nordeste', 'Rapadura', 44], ['Sudeste', 'Café 500g', 84]],
    ],
  }),
  exercicioDf({
    id: 'sp-rank',
    titulo: 'Ranking com empates',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>notas.json</code> e guarde em <code>ranking</code> o <code>nome</code>, a <code>nota</code>, o <code>rank</code> e o <code>dense_rank</code> de cada aluno dentro da turma, da maior nota para a menor. Com empate, o <code>rank</code> pula posições e o <code>dense_rank</code> não.</p>',
    dica: 'w = Window.partitionBy("turma").orderBy(F.desc("nota")); F.rank().over(w).alias("rank") e F.dense_rank().over(w).alias("dense_rank")',
    variavel: 'ranking',
    ler: `${COM_JANELA}df = spark.read.json("notas.json")\n`,
    dados: { 'notas.json': NOTAS },
    oculto: { 'notas.json': NOTAS_OCULTO },
    inicial: 'ranking = df.select("nome", "nota")\n',
    solucao: py`
      w = Window.partitionBy("turma").orderBy(F.desc("nota"))
      ranking = df.select("nome", "nota", F.rank().over(w).alias("rank"), F.dense_rank().over(w).alias("dense_rank"))
    `,
    regras: { colunas: ['nome', 'nota', 'rank', 'dense_rank'] },
    esperado: [
      [['Ana', 9, 1, 1], ['Bia', 9, 1, 1], ['Caio', 7.5, 3, 2], ['Davi', 8, 1, 1], ['Fia', 8, 1, 1], ['Edu', 6.5, 3, 2], ['Gil', 5, 4, 3]],
      [['Hana', 10, 1, 1], ['Ivo', 10, 1, 1], ['Jade', 10, 1, 1], ['Lia', 4, 4, 2], ['Max', 7, 1, 1]],
    ],
  }),
  exercicioDf({
    id: 'sp-lag',
    titulo: 'Variação de um dia para o outro',
    dificuldade: 'dificil',
    enunciado: '<p>Em <code>leituras.csv</code>, guarde em <code>variacao</code> o <code>dia</code>, o <code>sensor</code>, a <code>temperatura</code> e a <code>variacao</code>: a temperatura menos a do dia anterior do mesmo sensor (<code>NULL</code> no primeiro dia).</p>',
    dica: 'F.col("temperatura") - F.lag("temperatura").over(Window.partitionBy("sensor").orderBy("dia"))',
    variavel: 'variacao',
    ler: `${COM_JANELA}${LER_LEITURAS}`,
    dados: dadosLeituras,
    oculto: ocultoLeituras,
    inicial: 'variacao = df\n',
    solucao: py`
      janela = Window.partitionBy("sensor").orderBy("dia")
      variacao = df.withColumn("variacao", F.col("temperatura") - F.lag("temperatura").over(janela))
    `,
    regras: { colunas: ['dia', 'sensor', 'temperatura', 'variacao'] },
    extras: [{ codigo: 'lag', msg: 'O código usa lag' }],
    esperado: [
      [['2026-01-01', 'Crato', 31.2, null], ['2026-01-02', 'Crato', 32, 0.8000000000000007], ['2026-01-03', 'Crato', 30.4, -1.6000000000000014], ['2026-01-04', 'Crato', 29.9, -0.5], ['2026-01-05', 'Crato', 31.5, 1.6000000000000014], ['2026-01-06', 'Crato', 32.8, 1.2999999999999972], ['2026-01-01', 'Sobral', 33.5, null], ['2026-01-02', 'Sobral', 34.1, 0.6000000000000014], ['2026-01-03', 'Sobral', 35, 0.8999999999999986], ['2026-01-04', 'Sobral', 34.4, -0.6000000000000014], ['2026-01-05', 'Sobral', 33, -1.3999999999999986], ['2026-01-06', 'Sobral', 36.2, 3.200000000000003]],
      [['2026-02-01', 'Juazeiro', 32, null], ['2026-02-02', 'Juazeiro', 31, -1], ['2026-02-03', 'Juazeiro', 33.5, 2.5], ['2026-02-04', 'Juazeiro', 34, 0.5], ['2026-02-01', 'Patos', 30, null], ['2026-02-02', 'Patos', 31.5, 1.5], ['2026-02-03', 'Patos', 29, -2.5], ['2026-02-04', 'Patos', 30.5, 1.5]],
    ],
  }),
  exercicioDf({
    id: 'sp-soma-acumulada',
    titulo: 'Receita acumulada',
    dificuldade: 'dificil',
    enunciado: '<p>Guarde em <code>acumulado</code>, por <code>data</code> (em ordem), a <code>receita</code> do dia (soma de <code>quantidade * preco</code>, 2 casas) e a <code>acumulada</code>: a soma das receitas até aquele dia (2 casas).</p>',
    dica: 'Some a receita por data; depois F.sum("receita").over(Window.orderBy("data").rowsBetween(Window.unboundedPreceding, Window.currentRow)).',
    variavel: 'acumulado',
    ler: `${COM_JANELA}${LER_VENDAS}`,
    inicial: 'acumulado = df.select("data")\n',
    solucao: py`
      por_dia = df.groupBy("data").agg(F.round(F.sum(F.col("quantidade") * F.col("preco")), 2).alias("receita"))
      ate_hoje = Window.orderBy("data").rowsBetween(Window.unboundedPreceding, Window.currentRow)
      acumulado = por_dia.withColumn("acumulada", F.round(F.sum("receita").over(ate_hoje), 2)).orderBy("data")
    `,
    regras: { colunas: ['data', 'receita', 'acumulada'], ordem: true },
    extras: [{ codigo: 'rowsBetween', msg: 'O código usa rowsBetween' }],
    esperado: [
      [['2026-01-05', 49.8, 49.8], ['2026-01-12', 25.5, 75.3], ['2026-01-20', 19.9, 95.2], ['2026-02-03', 25, 120.2], ['2026-02-14', 27.2, 147.4], ['2026-02-21', 64, 211.4], ['2026-03-02', 25.5, 236.9], ['2026-03-15', 94.5, 331.4]],
      [['2026-04-01', 90, 90], ['2026-04-09', 44, 134], ['2026-04-18', 18.2, 152.2], ['2026-05-02', 84, 236.2], ['2026-05-20', 23.4, 259.6], ['2026-06-11', 45, 304.6]],
    ],
  }),
  exercicioDf({
    id: 'sp-media-movel',
    titulo: 'Média móvel de 3 dias',
    dificuldade: 'dificil',
    enunciado: '<p>Em <code>leituras.csv</code>, guarde em <code>media_movel</code> o <code>sensor</code>, o <code>dia</code> e a <code>media</code>: a média da temperatura do dia e dos 2 dias anteriores do mesmo sensor, com 2 casas.</p>',
    dica: 'F.round(F.avg("temperatura").over(Window.partitionBy("sensor").orderBy("dia").rowsBetween(-2, 0)), 2)',
    variavel: 'media_movel',
    ler: `${COM_JANELA}${LER_LEITURAS}`,
    dados: dadosLeituras,
    oculto: ocultoLeituras,
    inicial: 'media_movel = df\n',
    solucao: py`
      tres_dias = Window.partitionBy("sensor").orderBy("dia").rowsBetween(-2, 0)
      media_movel = df.select("sensor", "dia", F.round(F.avg("temperatura").over(tres_dias), 2).alias("media"))
    `,
    regras: { colunas: ['sensor', 'dia', 'media'] },
    esperado: [
      [['Crato', '2026-01-01', 31.2], ['Crato', '2026-01-02', 31.6], ['Crato', '2026-01-03', 31.2], ['Crato', '2026-01-04', 30.77], ['Crato', '2026-01-05', 30.6], ['Crato', '2026-01-06', 31.4], ['Sobral', '2026-01-01', 33.5], ['Sobral', '2026-01-02', 33.8], ['Sobral', '2026-01-03', 34.2], ['Sobral', '2026-01-04', 34.5], ['Sobral', '2026-01-05', 34.13], ['Sobral', '2026-01-06', 34.53]],
      [['Juazeiro', '2026-02-01', 32], ['Juazeiro', '2026-02-02', 31.5], ['Juazeiro', '2026-02-03', 32.17], ['Juazeiro', '2026-02-04', 32.83], ['Patos', '2026-02-01', 30], ['Patos', '2026-02-02', 30.75], ['Patos', '2026-02-03', 30.17], ['Patos', '2026-02-04', 30.33]],
    ],
  }),
];

// ---------- leitura e escrita (depois de licao-leitura) ----------
export const exerciciosLeitura = [
  exercicioDf({
    id: 'sp-ler-json',
    titulo: 'Ler JSON',
    dificuldade: 'facil',
    enunciado: '<p>Leia <code>notas.json</code> (um objeto JSON por linha) em <code>notas</code> e mostre o schema com <code>printSchema()</code>.</p>',
    dica: 'notas = spark.read.json("notas.json") e notas.printSchema()',
    variavel: 'notas',
    ler: '',
    dados: { 'notas.json': NOTAS },
    oculto: { 'notas.json': NOTAS_OCULTO },
    inicial: 'notas = spark.read.text("notas.json")\n',
    solucao: 'notas = spark.read.json("notas.json")\nnotas.printSchema()\n',
    regras: { colunas: ['nome', 'nota', 'turma'], tipos: ['string', 'double', 'bigint'] },
    extras: [{ saida: ' |-- nota: double (nullable = true)', msg: 'O schema aparece na saída' }],
    esperado: [
      [['Ana', 9, 1], ['Bia', 9, 1], ['Caio', 7.5, 1], ['Davi', 8, 2], ['Edu', 6.5, 2], ['Fia', 8, 2], ['Gil', 5, 2]],
      [['Hana', 10, 3], ['Ivo', 10, 3], ['Jade', 10, 3], ['Lia', 4, 3], ['Max', 7, 4]],
    ],
  }),
  exercicioDf({
    id: 'sp-schema-ddl',
    titulo: 'Schema escrito à mão',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>pessoas.csv</code> em <code>pessoas</code> com o schema escrito à mão <code>nome STRING, idade INT, cidade STRING, nota DOUBLE</code>, sem <code>inferSchema</code>.</p>',
    dica: 'pessoas = spark.read.schema("nome STRING, idade INT, cidade STRING, nota DOUBLE").csv("pessoas.csv", header=True)',
    variavel: 'pessoas',
    ler: '',
    dados: { 'pessoas.csv': PESSOAS },
    oculto: { 'pessoas.csv': PESSOAS_OCULTO },
    inicial: 'pessoas = spark.read.csv("pessoas.csv", header=True, inferSchema=True)\n',
    solucao: 'pessoas = spark.read.schema("nome STRING, idade INT, cidade STRING, nota DOUBLE").csv("pessoas.csv", header=True)\n',
    regras: { tipos: ['string', 'int', 'string', 'double'] },
    extras: [{ semCodigo: 'inferSchema', msg: 'O código não usa inferSchema' }],
    esperado: [
      [['  Ana', 31, 'Recife', 8.5], ['bia ', 15, 'Fortaleza', null], ['CAIO', 8, null, 7], ['davi', 64, 'São Paulo', 9], [' Edu ', 22, 'Curitiba', 6.5], ['Fia', 17, null, null]],
      [['gil ', 45, 'Salvador', 7.5], [' HANA', 11, 'Rio de Janeiro', null], ['Ivo', 70, null, 8], ['jade', 19, 'Natal', 9.5]],
    ],
  }),
  exercicioDf({
    id: 'sp-escrever-csv',
    titulo: 'Gravar o resultado',
    dificuldade: 'medio',
    enunciado: '<p>Grave as vendas do <b>Nordeste</b> na pasta <code>saida</code> como CSV com cabeçalho, sobrescrevendo (<code>overwrite</code>) e num arquivo só. Depois leia de volta em <code>relidas</code> (com <code>inferSchema</code>).</p>',
    dica: 'df.filter(F.col("regiao") == "Nordeste").coalesce(1).write.mode("overwrite").csv("saida", header=True); relidas = spark.read.csv("saida", header=True, inferSchema=True)',
    variavel: 'relidas',
    inicial: 'relidas = df.filter(F.col("regiao") == "Nordeste")\n',
    solucao: py`
      df.filter(F.col("regiao") == "Nordeste").coalesce(1).write.mode("overwrite").csv("saida", header=True)
      relidas = spark.read.csv("saida", header=True, inferSchema=True)
    `,
    regras: { colunas: ['data', 'regiao', 'produto', 'quantidade', 'preco'] },
    extras: [{ codigo: 'coalesce\\(1\\)', msg: 'O código grava um arquivo só (coalesce(1))' }, { codigo: '\\.write', msg: 'O código grava com write' }],
    esperado: [
      [['2026-01-05', 'Nordeste', 'Arroz 5kg', 2, 24.9], ['2026-01-20', 'Nordeste', 'Café 500g', 1, 19.9], ['2026-02-21', 'Nordeste', 'Queijo coalho', 2, 32]],
      [['2026-04-09', 'Nordeste', 'Rapadura', 20, 2.2], ['2026-05-20', 'Nordeste', 'Arroz 5kg', 1, 23.4]],
    ],
  }),
];

// ---------- Spark SQL (depois de licao-sql) ----------
export const exerciciosSql = [
  exercicioDf({
    id: 'sp-sql-select',
    titulo: 'Primeira consulta SQL',
    dificuldade: 'facil',
    enunciado: '<p>A view <code>vendas</code> já existe. Guarde em <code>caras</code>, com <code>spark.sql</code>, o <code>produto</code> e o <code>preco</code> das vendas com preço acima de 10, do mais caro para o mais barato.</p>',
    dica: 'spark.sql("SELECT produto, preco FROM vendas WHERE preco > 10 ORDER BY preco DESC")',
    variavel: 'caras',
    ler: VIEW_VENDAS,
    inicial: 'caras = df.select("produto", "preco")\n',
    solucao: 'caras = spark.sql("SELECT produto, preco FROM vendas WHERE preco > 10 ORDER BY preco DESC")\n',
    regras: { colunas: ['produto', 'preco'], ordem: true },
    extras: [{ codigo: 'spark\\.sql', msg: 'O código usa spark.sql' }],
    esperado: [
      [['Queijo coalho', 32], ['Arroz 5kg', 25.5], ['Arroz 5kg', 24.9], ['Café 500g', 19.9], ['Café 500g', 18.9]],
      [['Queijo coalho', 30], ['Arroz 5kg', 23.4], ['Café 500g', 21]],
    ],
  }),
  exercicioDf({
    id: 'sp-sql-group',
    titulo: 'GROUP BY e HAVING',
    dificuldade: 'medio',
    enunciado: '<p>Em SQL, guarde em <code>fortes</code> as regiões com receita total (soma de <code>quantidade * preco</code>) acima de 50, com a <code>receita</code> em 2 casas.</p>',
    dica: 'SELECT regiao, ROUND(SUM(quantidade * preco), 2) AS receita FROM vendas GROUP BY regiao HAVING SUM(quantidade * preco) > 50',
    variavel: 'fortes',
    ler: VIEW_VENDAS,
    inicial: 'fortes = spark.sql("SELECT regiao FROM vendas")\n',
    solucao: py`
      fortes = spark.sql("""
          SELECT regiao, ROUND(SUM(quantidade * preco), 2) AS receita
          FROM vendas
          GROUP BY regiao
          HAVING SUM(quantidade * preco) > 50
      """)
    `,
    regras: { colunas: ['regiao', 'receita'] },
    extras: [{ codigo: 'HAVING', msg: 'O código usa HAVING' }],
    esperado: [
      [['Norte', 119.5], ['Nordeste', 133.7], ['Sudeste', 51]],
      [['Norte', 108.2], ['Nordeste', 67.4], ['Sudeste', 129]],
    ],
  }),
  exercicioDf({
    id: 'sp-sql-join',
    titulo: 'JOIN em SQL',
    dificuldade: 'medio',
    enunciado: '<p>As views <code>pedidos</code> e <code>clientes</code> já existem. Em SQL, guarde em <code>total_por_cidade</code>, por <code>cidade</code> do cliente, o <code>total</code> dos pedidos (2 casas).</p>',
    dica: 'SELECT c.cidade, ROUND(SUM(p.valor), 2) AS total FROM pedidos p JOIN clientes c ON p.id_cliente = c.id_cliente GROUP BY c.cidade',
    variavel: 'total_por_cidade',
    ler: `${LER_LOJA}pedidos.createOrReplaceTempView("pedidos")\nclientes.createOrReplaceTempView("clientes")\n`,
    dados: dadosLoja,
    oculto: ocultoLoja,
    inicial: 'total_por_cidade = spark.sql("SELECT cidade FROM clientes")\n',
    solucao: py`
      total_por_cidade = spark.sql("""
          SELECT c.cidade, ROUND(SUM(p.valor), 2) AS total
          FROM pedidos p JOIN clientes c ON p.id_cliente = c.id_cliente
          GROUP BY c.cidade
      """)
    `,
    regras: { colunas: ['cidade', 'total'] },
    extras: [{ codigo: 'JOIN', msg: 'O código usa JOIN' }],
    esperado: [
      [['Recife', 215.75], ['Natal', 115]],
      [['Salvador', 130.4], ['Recife', 25.5]],
    ],
  }),
  exercicioDf({
    id: 'sp-sql-window',
    titulo: 'Janela em SQL',
    dificuldade: 'dificil',
    enunciado: '<p>A view <code>leituras</code> já existe. Em SQL, guarde em <code>ultimas</code> a leitura mais recente de cada sensor (<code>dia</code>, <code>sensor</code>, <code>temperatura</code>), numerando com <code>ROW_NUMBER() OVER (PARTITION BY sensor ORDER BY dia DESC)</code>.</p>',
    dica: 'SELECT dia, sensor, temperatura FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY sensor ORDER BY dia DESC) AS pos FROM leituras) WHERE pos = 1',
    variavel: 'ultimas',
    ler: `${LER_LEITURAS}df.createOrReplaceTempView("leituras")\n`,
    dados: dadosLeituras,
    oculto: ocultoLeituras,
    inicial: 'ultimas = spark.sql("SELECT dia, sensor, temperatura FROM leituras")\n',
    solucao: py`
      ultimas = spark.sql("""
          SELECT dia, sensor, temperatura FROM (
              SELECT *, ROW_NUMBER() OVER (PARTITION BY sensor ORDER BY dia DESC) AS pos
              FROM leituras
          ) WHERE pos = 1
      """)
    `,
    regras: { colunas: ['dia', 'sensor', 'temperatura'] },
    extras: [{ codigo: 'OVER', msg: 'O código usa OVER' }],
    esperado: [
      [['2026-01-06', 'Crato', 32.8], ['2026-01-06', 'Sobral', 36.2]],
      [['2026-02-04', 'Juazeiro', 34], ['2026-02-04', 'Patos', 30.5]],
    ],
  }),
];

// ---------- desempenho (depois de licao-shuffle-cache; o 44 depois de licao-particoes-spark) ----------
const exercicioPlano = ({ id, titulo, dificuldade, enunciado, dica, ler = LER_VENDAS, dados = dadosVendas, oculto = ocultoVendas, inicial, solucao, regras, regrasOcultas = regras }) => ({
  id,
  tipo: 'problema',
  titulo,
  dificuldade,
  enunciado,
  dica,
  arquivos: programa(id, `${ler}${inicial}`),
  solucao: programa(id, `${ler}${solucao}`),
  dados,
  testes: [
    { descricao: Object.keys(dados)[0], regras },
    { descricao: 'outros dados', oculto: true, dados: oculto, regras: regrasOcultas },
  ],
});

export const exerciciosDesempenho = [
  exercicioPlano({
    id: 'sp-menos-shuffle',
    titulo: 'Um shuffle a menos',
    dificuldade: 'medio',
    enunciado: '<p>O código faz um <code>repartition(4)</code> antes do <code>groupBy</code>: são dois shuffles. Chegue ao mesmo <code>resumo</code> (a soma da quantidade por região, em <code>itens</code>) com <b>um</b> shuffle só. Confira no <code>explain()</code> e na aba ⚡ Execução.</p>',
    dica: 'O groupBy já redistribui as linhas pela região: o repartition antes dele não ajuda.',
    inicial: 'resumo = df.repartition(4).groupBy("regiao").agg(F.sum("quantidade").alias("itens"))\nresumo.show()\n',
    solucao: 'resumo = df.groupBy("regiao").agg(F.sum("quantidade").alias("itens"))\nresumo.show()\n',
    regras: [{ dataframe: 'resumo', colunas: ['regiao', 'itens'], linhas: [['Norte', 15], ['Sul', 4], ['Nordeste', 5], ['Sudeste', 4]] }, { plano: 'resumo', shuffles: 1 }],
    regrasOcultas: [{ dataframe: 'resumo', colunas: ['regiao', 'itens'], linhas: [['Norte', 5], ['Nordeste', 21], ['Sudeste', 10]] }, { plano: 'resumo', shuffles: 1 }],
  }),
  exercicioPlano({
    id: 'sp-cache',
    titulo: 'Cache para duas ações',
    dificuldade: 'medio',
    enunciado: '<p><code>caros</code> (as vendas com preço acima de 10) é usado por duas ações: <code>count</code> e <code>show</code>. Guarde <code>caros</code> em cache antes, para a segunda ação não refazer o caminho. Guarde a contagem em <code>n</code>.</p>',
    dica: 'caros = df.filter(F.col("preco") > 10).cache()',
    inicial: 'caros = df.filter(F.col("preco") > 10)\nn = caros.count()\ncaros.show()\n',
    solucao: 'caros = df.filter(F.col("preco") > 10).cache()\nn = caros.count()\ncaros.show()\n',
    regras: [{ plano: 'caros', cache: true }, { variavel: 'n', igual: 5 }, { codigo: 'cache\\(\\)', msg: 'O código usa cache()' }],
    regrasOcultas: [{ plano: 'caros', cache: true }, { variavel: 'n', igual: 3 }],
  }),
  exercicioPlano({
    id: 'sp-repartition',
    titulo: 'Partições sob medida',
    dificuldade: 'medio',
    enunciado: '<p>Guarde em <code>por_regiao</code> as vendas reparticionadas em <b>3</b> partições pela coluna <code>regiao</code>, e em <code>uma</code> o <code>por_regiao</code> numa partição só, <b>sem</b> outro shuffle.</p>',
    dica: 'por_regiao = df.repartition(3, "regiao") e uma = por_regiao.coalesce(1) (o coalesce junta partições sem shuffle).',
    inicial: 'por_regiao = df\numa = df\n',
    solucao: 'por_regiao = df.repartition(3, "regiao")\numa = por_regiao.coalesce(1)\nprint(por_regiao.rdd.getNumPartitions(), uma.rdd.getNumPartitions())\n',
    regras: [{ plano: 'por_regiao', particoes: 3, shuffles: 1 }, { plano: 'uma', particoes: 1, shuffles: 1 }, { codigo: 'coalesce', msg: 'O código usa coalesce' }],
    regrasOcultas: [{ plano: 'por_regiao', particoes: 3, shuffles: 1 }, { plano: 'uma', particoes: 1, shuffles: 1 }],
  }),
  exercicioPlano({
    id: 'sp-skew',
    titulo: 'Sal contra o desequilíbrio',
    dificuldade: 'dificil',
    enunciado: '<p>Em <code>cliques.csv</code> (<code>id,pagina,cliques</code>), uma página tem quase todas as linhas: no <code>groupBy("pagina")</code>, uma tarefa fica com quase todo o trabalho. Some os cliques por página em duas etapas, com uma coluna <code>sal</code> = <code>F.col("id") % 4</code>: primeiro por <code>pagina</code> e <code>sal</code>, depois só por <code>pagina</code>. Guarde em <code>total</code> (colunas <code>pagina</code> e <code>cliques</code>).</p><p>No Spark de verdade, o sal costuma ser aleatório (<code>F.rand()</code>); aqui a coluna <code>id</code> deixa o resultado igual a cada execução.</p>',
    dica: 'withColumn("sal", F.col("id") % 4).groupBy("pagina", "sal").agg(F.sum("cliques").alias("parcial")).groupBy("pagina").agg(F.sum("parcial").alias("cliques"))',
    ler: 'df = spark.read.csv("cliques.csv", header=True, inferSchema=True)\n',
    dados: { 'cliques.csv': CLIQUES },
    oculto: { 'cliques.csv': CLIQUES_OCULTO },
    inicial: 'total = df.groupBy("pagina").agg(F.sum("cliques").alias("cliques"))\ntotal.show()\n',
    solucao: py`
      com_sal = df.withColumn("sal", F.col("id") % 4)
      parciais = com_sal.groupBy("pagina", "sal").agg(F.sum("cliques").alias("parcial"))
      total = parciais.groupBy("pagina").agg(F.sum("parcial").alias("cliques"))
      total.show()
    `,
    regras: [{ dataframe: 'total', colunas: ['pagina', 'cliques'], linhas: [['inicio', 44], ['contato', 3], ['sobre', 3]] }, { plano: 'total', shuffles: 2 }, { codigo: 'sal', msg: 'O código usa a coluna sal' }],
    regrasOcultas: [{ dataframe: 'total', colunas: ['pagina', 'cliques'], linhas: [['loja', 27], ['ajuda', 5]] }, { plano: 'total', shuffles: 2 }],
  }),
];
