// 🛒 Vendas por região: ler com schema, calcular a receita, juntar com o catálogo, agregar e
// montar o ranking das regiões com a participação de cada uma.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const VENDAS = `id,data,produto,regiao,quantidade,preco
1,2026-03-02,P1,Nordeste,2,24.90
2,2026-03-02,P2,Sudeste,3,8.50
3,2026-03-03,P3,Nordeste,1,19.90
4,2026-03-03,P4,Norte,10,2.50
5,2026-03-04,P1,Sul,1,25.00
6,2026-03-04,P2,Nordeste,4,8.00
7,2026-03-05,P9,Sul,1,5.00
`;
const VENDAS_OCULTO = `id,data,produto,regiao,quantidade,preco
1,2026-04-01,P2,Norte,2,9.00
2,2026-04-01,P3,Norte,1,20.00
3,2026-04-02,P4,Sul,4,2.50
4,2026-04-02,P8,Nordeste,3,4.00
5,2026-04-03,P1,Sul,2,25.00
`;
const PRODUTOS = `produto,nome,categoria
P1,Arroz 5kg,Mercearia
P2,Feijão 1kg,Mercearia
P3,Café 500g,Bebidas
P4,Rapadura,Doces
`;

const TIPOS = ['int', 'date', 'string', 'string', 'int', 'double'];

export const projetoVendasRegiao = criarProjeto({
  id: 'vendas-regiao',
  titulo: 'Vendas por região',
  icone: '🛒',
  descricao: 'Das vendas do mercadinho ao ranking das regiões: schema, receita, join com o catálogo e participação.',
  resumo: `
    <p>Um mercadinho vende para todo o Brasil. Em <code>vendas.csv</code> está cada venda (produto, região, quantidade e
      preço) e em <code>produtos.csv</code>, o catálogo (nome e categoria). Uma venda pode ser de um produto que saiu do
      catálogo: ela não entra no relatório.</p>
    <ol>
      <li>ler as vendas com o schema certo;</li>
      <li>calcular a receita de cada venda;</li>
      <li>juntar com o catálogo;</li>
      <li>somar a receita por região e categoria;</li>
      <li>montar o ranking das regiões, com a participação de cada uma no total.</li>
    </ol>`,
  dados: { 'vendas.csv': VENDAS, 'produtos.csv': PRODUTOS },
  oculto: { 'vendas.csv': VENDAS_OCULTO },
  inicial: py`
    vendas = spark.read.csv("vendas.csv", header=True)
    vendas.printSchema()
  `,
  etapas: [
    {
      titulo: 'Ler com schema',
      dificuldade: 'facil',
      enunciado: `
        <p>Sem schema, todas as colunas chegam como texto. Leia <code>vendas.csv</code> de novo em <code>vendas</code>, com o
          schema <code>id INT, data DATE, produto STRING, regiao STRING, quantidade INT, preco DOUBLE</code>.</p>
        <p>Aproveite e leia <code>produtos.csv</code> em <code>produtos</code> (com <code>inferSchema=True</code>): ele entra na etapa 3.</p>`,
      dica: 'spark.read.csv("vendas.csv", header=True, schema="id INT, data DATE, ...")',
      codigo: py`
        ESQUEMA = "id INT, data DATE, produto STRING, regiao STRING, quantidade INT, preco DOUBLE"
        vendas = spark.read.csv("vendas.csv", header=True, schema=ESQUEMA)
        produtos = spark.read.csv("produtos.csv", header=True, inferSchema=True)
        vendas.printSchema()
      `,
      regras: [{ dataframe: 'vendas', tipos: TIPOS, total: 7 }],
      regrasOcultas: [{ dataframe: 'vendas', tipos: TIPOS, total: 5 }],
    },
    {
      titulo: 'A receita de cada venda',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>receitas</code> as colunas <code>id</code>, <code>regiao</code>, <code>produto</code> e
          <code>receita</code> (quantidade × preço, arredondada em 2 casas).</p>`,
      dica: 'vendas.select("id", "regiao", "produto", F.round(F.col("quantidade") * F.col("preco"), 2).alias("receita"))',
      codigo: py`
        receitas = vendas.select("id", "regiao", "produto",
            F.round(F.col("quantidade") * F.col("preco"), 2).alias("receita"))
        receitas.show()
      `,
      regras: [{
        dataframe: 'receitas',
        colunas: ['id', 'regiao', 'produto', 'receita'],
        linhas: [[1, 'Nordeste', 'P1', 49.8], [2, 'Sudeste', 'P2', 25.5], [3, 'Nordeste', 'P3', 19.9], [4, 'Norte', 'P4', 25.0], [5, 'Sul', 'P1', 25.0], [6, 'Nordeste', 'P2', 32.0], [7, 'Sul', 'P9', 5.0]],
      }],
      regrasOcultas: [{
        dataframe: 'receitas',
        colunas: ['id', 'regiao', 'produto', 'receita'],
        linhas: [[1, 'Norte', 'P2', 18.0], [2, 'Norte', 'P3', 20.0], [3, 'Sul', 'P4', 10.0], [4, 'Nordeste', 'P8', 12.0], [5, 'Sul', 'P1', 50.0]],
      }],
    },
    {
      titulo: 'Juntar com o catálogo',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>detalhe</code> as receitas juntadas com <code>produtos</code> pela coluna <code>produto</code>,
          com as colunas <code>id</code>, <code>regiao</code>, <code>nome</code>, <code>categoria</code> e
          <code>receita</code>. A venda de produto fora do catálogo fica de fora.</p>`,
      dica: 'receitas.join(produtos, "produto") é um inner join: quem não casa sai. Termine com select nas colunas pedidas.',
      codigo: py`
        detalhe = receitas.join(produtos, "produto").select("id", "regiao", "nome", "categoria", "receita")
        detalhe.show()
      `,
      regras: [{
        dataframe: 'detalhe',
        colunas: ['id', 'regiao', 'nome', 'categoria', 'receita'],
        linhas: [
          [1, 'Nordeste', 'Arroz 5kg', 'Mercearia', 49.8], [2, 'Sudeste', 'Feijão 1kg', 'Mercearia', 25.5], [3, 'Nordeste', 'Café 500g', 'Bebidas', 19.9],
          [4, 'Norte', 'Rapadura', 'Doces', 25.0], [5, 'Sul', 'Arroz 5kg', 'Mercearia', 25.0], [6, 'Nordeste', 'Feijão 1kg', 'Mercearia', 32.0],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'detalhe',
        colunas: ['id', 'regiao', 'nome', 'categoria', 'receita'],
        linhas: [[1, 'Norte', 'Feijão 1kg', 'Mercearia', 18.0], [2, 'Norte', 'Café 500g', 'Bebidas', 20.0], [3, 'Sul', 'Rapadura', 'Doces', 10.0], [5, 'Sul', 'Arroz 5kg', 'Mercearia', 50.0]],
      }],
    },
    {
      titulo: 'Receita por região e categoria',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>por_categoria</code>, para cada região e categoria, o número de vendas (<code>vendas</code>) e a
          receita somada (<code>receita</code>, em 2 casas): as colunas <code>regiao</code>, <code>categoria</code>,
          <code>vendas</code> e <code>receita</code>.</p>
        <p>Deixe em ordem de região e, dentro de cada região, da maior receita para a menor.</p>`,
      dica: 'groupBy("regiao", "categoria").agg(F.count("*").alias("vendas"), F.round(F.sum("receita"), 2).alias("receita")), e orderBy("regiao", F.desc("receita")) no próprio por_categoria.',
      codigo: py`
        por_categoria = (detalhe.groupBy("regiao", "categoria")
            .agg(F.count("*").alias("vendas"), F.round(F.sum("receita"), 2).alias("receita"))
            .orderBy("regiao", F.desc("receita")))
        por_categoria.show()
      `,
      regras: [{
        dataframe: 'por_categoria',
        colunas: ['regiao', 'categoria', 'vendas', 'receita'],
        ordem: true,
        linhas: [['Nordeste', 'Mercearia', 2, 81.8], ['Nordeste', 'Bebidas', 1, 19.9], ['Norte', 'Doces', 1, 25.0], ['Sudeste', 'Mercearia', 1, 25.5], ['Sul', 'Mercearia', 1, 25.0]],
      }],
      regrasOcultas: [{
        dataframe: 'por_categoria',
        colunas: ['regiao', 'categoria', 'vendas', 'receita'],
        ordem: true,
        linhas: [['Norte', 'Bebidas', 1, 20.0], ['Norte', 'Mercearia', 1, 18.0], ['Sul', 'Mercearia', 1, 50.0], ['Sul', 'Doces', 1, 10.0]],
      }],
    },
    {
      titulo: 'O ranking das regiões',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>ranking</code> uma linha por região, com as colunas <code>posicao</code> (1 para a maior receita;
          empate fica na mesma posição), <code>regiao</code>, <code>receita</code> (em 2 casas) e <code>participacao</code>
          (a porcentagem da receita total, em 1 casa).</p>`,
      dica: 'Some por região a partir de detalhe; o total sai de por_regiao.agg(F.sum("receita")).first()[0]. A posição é F.rank().over(Window.orderBy(F.desc("receita"))).',
      codigo: py`
        from pyspark.sql import Window

        por_regiao = detalhe.groupBy("regiao").agg(F.round(F.sum("receita"), 2).alias("receita"))
        total = por_regiao.agg(F.sum("receita")).first()[0]
        ranking = por_regiao.select(
            F.rank().over(Window.orderBy(F.desc("receita"))).alias("posicao"), "regiao", "receita",
            F.round(F.col("receita") * 100 / total, 1).alias("participacao"))
        ranking.orderBy("posicao").show()
      `,
      regras: [{
        dataframe: 'ranking',
        colunas: ['posicao', 'regiao', 'receita', 'participacao'],
        linhas: [[1, 'Nordeste', 101.7, 57.4], [2, 'Sudeste', 25.5, 14.4], [3, 'Norte', 25.0, 14.1], [3, 'Sul', 25.0, 14.1]],
      }],
      regrasOcultas: [{
        dataframe: 'ranking',
        colunas: ['posicao', 'regiao', 'receita', 'participacao'],
        linhas: [[1, 'Sul', 60.0, 61.2], [2, 'Norte', 38.0, 38.8]],
      }],
    },
  ],
});
