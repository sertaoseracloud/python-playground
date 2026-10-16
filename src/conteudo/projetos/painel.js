// 📊 Painel de indicadores: pedidos, receita e ticket médio por dia, clientes novos e
// recorrentes, a meta do dia e tudo junto numa tabela só.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const PEDIDOS = `pedido,cliente,dia,valor
1,c1,2026-10-13,100.00
2,c2,2026-10-13,50.00
3,c1,2026-10-14,80.00
4,c3,2026-10-14,40.00
5,c3,2026-10-14,60.00
6,c4,2026-10-15,200.00
7,c2,2026-10-14,20.00
`;
const CLIENTES = `cliente,nome,cadastro
c1,Ana,2026-10-13
c2,Bia,2026-09-01
c3,Caio,2026-10-14
c4,Davi,2026-10-15
`;
const METAS = `dia,meta
2026-10-13,200.00
2026-10-14,180.00
2026-10-15,250.00
2026-10-16,100.00
`;
const PEDIDOS_OCULTO = `pedido,cliente,dia,valor
1,c5,2026-10-20,30.00
2,c5,2026-10-21,70.00
3,c6,2026-10-21,50.00
`;
const CLIENTES_OCULTO = `cliente,nome,cadastro
c5,Edu,2026-10-20
c6,Fia,2026-01-10
`;
const METAS_OCULTO = `dia,meta
2026-10-20,50.00
2026-10-21,100.00
2026-10-22,80.00
`;

const META = ['dia', 'pedidos', 'receita', 'ticket', 'meta', 'atingiu', 'bateu'];
const PAINEL = ['dia', 'pedidos', 'receita', 'ticket', 'novos', 'recorrentes', 'meta', 'atingiu', 'bateu'];

export const projetoPainel = criarProjeto({
  id: 'painel',
  titulo: 'Painel de indicadores',
  icone: '📊',
  descricao: 'Os números do dia da loja: pedidos, receita, ticket médio, clientes novos e recorrentes e a meta.',
  resumo: `
    <p>A gerente da loja quer abrir o painel de manhã e ver, para cada dia, como foram as vendas. Os dados estão em três
      arquivos: <code>pedidos.csv</code>, <code>clientes.csv</code> (com o dia do cadastro) e <code>metas.csv</code> (a
      meta de receita de cada dia).</p>
    <ol>
      <li>os indicadores do dia: pedidos e receita;</li>
      <li>o ticket médio;</li>
      <li>os clientes novos e os recorrentes;</li>
      <li>a comparação com a meta, inclusive nos dias sem venda;</li>
      <li>o painel inteiro numa tabela só.</li>
    </ol>`,
  dados: { 'pedidos.csv': PEDIDOS, 'clientes.csv': CLIENTES, 'metas.csv': METAS },
  oculto: { 'pedidos.csv': PEDIDOS_OCULTO, 'clientes.csv': CLIENTES_OCULTO, 'metas.csv': METAS_OCULTO },
  inicial: py`
    pedidos = spark.read.csv("pedidos.csv", header=True, inferSchema=True)
    clientes = spark.read.csv("clientes.csv", header=True, inferSchema=True)
    metas = spark.read.csv("metas.csv", header=True, inferSchema=True)
    pedidos.show()
  `,
  etapas: [
    {
      titulo: 'Os indicadores do dia',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>por_dia</code>, para cada dia, o número de pedidos (<code>pedidos</code>) e a receita somada
          (<code>receita</code>, em 2 casas): as colunas <code>dia</code>, <code>pedidos</code> e <code>receita</code>.</p>`,
      dica: 'pedidos.groupBy("dia").agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("receita"))',
      codigo: py`
        por_dia = pedidos.groupBy("dia").agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("receita"))
        por_dia.orderBy("dia").show()
      `,
      regras: [{ dataframe: 'por_dia', colunas: ['dia', 'pedidos', 'receita'], linhas: [['2026-10-13', 2, 150.0], ['2026-10-14', 4, 200.0], ['2026-10-15', 1, 200.0]] }],
      regrasOcultas: [{ dataframe: 'por_dia', colunas: ['dia', 'pedidos', 'receita'], linhas: [['2026-10-20', 1, 30.0], ['2026-10-21', 2, 120.0]] }],
    },
    {
      titulo: 'O ticket médio',
      dificuldade: 'medio',
      enunciado: `
        <p>O <b>ticket médio</b> é quanto cada pedido rendeu, em média. Guarde em <code>ticket</code> o
          <code>por_dia</code> com mais a coluna <code>ticket</code> (receita ÷ pedidos, em 2 casas).</p>`,
      dica: 'por_dia.withColumn("ticket", F.round(F.col("receita") / F.col("pedidos"), 2))',
      codigo: py`
        ticket = por_dia.withColumn("ticket", F.round(F.col("receita") / F.col("pedidos"), 2))
        ticket.orderBy("dia").show()
      `,
      regras: [{ dataframe: 'ticket', colunas: ['dia', 'pedidos', 'receita', 'ticket'], linhas: [['2026-10-13', 2, 150.0, 75.0], ['2026-10-14', 4, 200.0, 50.0], ['2026-10-15', 1, 200.0, 200.0]] }],
      regrasOcultas: [{ dataframe: 'ticket', colunas: ['dia', 'pedidos', 'receita', 'ticket'], linhas: [['2026-10-20', 1, 30.0, 30.0], ['2026-10-21', 2, 120.0, 60.0]] }],
    },
    {
      titulo: 'Clientes novos e recorrentes',
      dificuldade: 'medio',
      enunciado: `
        <p>Um cliente é <b>novo</b> no dia em que se cadastrou e <b>recorrente</b> nos outros. Guarde em
          <code>clientes_dia</code>, para cada dia com pedido, quantos clientes diferentes eram novos e quantos eram
          recorrentes: as colunas <code>dia</code>, <code>novos</code> e <code>recorrentes</code>.</p>`,
      dica: 'Junte pedidos e clientes pelo cliente e compare cadastro com dia. F.countDistinct(F.when(condição, F.col("cliente"))) conta só quem passa na condição.',
      codigo: py`
        com_cadastro = pedidos.join(clientes, "cliente").withColumn("novo", F.col("cadastro") == F.col("dia"))
        clientes_dia = com_cadastro.groupBy("dia").agg(
            F.countDistinct(F.when(F.col("novo"), F.col("cliente"))).alias("novos"),
            F.countDistinct(F.when(~F.col("novo"), F.col("cliente"))).alias("recorrentes"))
        clientes_dia.orderBy("dia").show()
      `,
      regras: [{ dataframe: 'clientes_dia', colunas: ['dia', 'novos', 'recorrentes'], linhas: [['2026-10-13', 1, 1], ['2026-10-14', 1, 2], ['2026-10-15', 1, 0]] }],
      regrasOcultas: [{ dataframe: 'clientes_dia', colunas: ['dia', 'novos', 'recorrentes'], linhas: [['2026-10-20', 1, 0], ['2026-10-21', 0, 2]] }],
    },
    {
      titulo: 'A meta do dia',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>contra_meta</code> uma linha por dia de <code>metas.csv</code>, <b>inclusive os dias sem
          pedido</b> (com pedidos, receita e ticket 0), com as colunas <code>dia</code>, <code>pedidos</code>,
          <code>receita</code>, <code>ticket</code>, <code>meta</code>, <code>atingiu</code> (receita ÷ meta, em %, 1 casa)
          e <code>bateu</code> (verdadeiro se a receita chegou à meta).</p>`,
      dica: 'metas.join(ticket, "dia", "left") mantém todos os dias da meta; fillna(0) zera o que faltou. Termine com select na ordem pedida.',
      codigo: py`
        contra_meta = (metas.join(ticket, "dia", "left").fillna(0)
            .withColumn("atingiu", F.round(F.col("receita") * 100 / F.col("meta"), 1))
            .withColumn("bateu", F.col("receita") >= F.col("meta"))
            .select("dia", "pedidos", "receita", "ticket", "meta", "atingiu", "bateu"))
        contra_meta.orderBy("dia").show()
      `,
      regras: [{
        dataframe: 'contra_meta',
        colunas: META,
        linhas: [
          ['2026-10-13', 2, 150.0, 75.0, 200.0, 75.0, false], ['2026-10-14', 4, 200.0, 50.0, 180.0, 111.1, true],
          ['2026-10-15', 1, 200.0, 200.0, 250.0, 80.0, false], ['2026-10-16', 0, 0, 0, 100.0, 0, false],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'contra_meta',
        colunas: META,
        linhas: [['2026-10-20', 1, 30.0, 30.0, 50.0, 60.0, false], ['2026-10-21', 2, 120.0, 60.0, 100.0, 120.0, true], ['2026-10-22', 0, 0, 0, 80.0, 0, false]],
      }],
    },
    {
      titulo: 'O painel numa tabela só',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>painel</code> o <code>contra_meta</code> com os clientes do dia (0 nos dias sem pedido), em ordem
          de dia, com as colunas <code>dia</code>, <code>pedidos</code>, <code>receita</code>, <code>ticket</code>,
          <code>novos</code>, <code>recorrentes</code>, <code>meta</code>, <code>atingiu</code> e <code>bateu</code>.</p>`,
      dica: 'contra_meta.join(clientes_dia, "dia", "left"), fillna(0, ["novos", "recorrentes"]), select na ordem pedida e orderBy("dia").',
      codigo: py`
        painel = (contra_meta.join(clientes_dia, "dia", "left").fillna(0, ["novos", "recorrentes"])
            .select("dia", "pedidos", "receita", "ticket", "novos", "recorrentes", "meta", "atingiu", "bateu")
            .orderBy("dia"))
        painel.show()
      `,
      regras: [{
        dataframe: 'painel',
        colunas: PAINEL,
        ordem: true,
        linhas: [
          ['2026-10-13', 2, 150.0, 75.0, 1, 1, 200.0, 75.0, false], ['2026-10-14', 4, 200.0, 50.0, 1, 2, 180.0, 111.1, true],
          ['2026-10-15', 1, 200.0, 200.0, 1, 0, 250.0, 80.0, false], ['2026-10-16', 0, 0, 0, 0, 0, 100.0, 0, false],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'painel',
        colunas: PAINEL,
        ordem: true,
        linhas: [
          ['2026-10-20', 1, 30.0, 30.0, 1, 0, 50.0, 60.0, false], ['2026-10-21', 2, 120.0, 60.0, 0, 2, 100.0, 120.0, true],
          ['2026-10-22', 0, 0, 0, 0, 0, 80.0, 0, false],
        ],
      }],
    },
  ],
});
