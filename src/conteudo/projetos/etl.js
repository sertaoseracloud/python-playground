// 🥉🥈🥇 ETL bronze → prata → ouro: as camadas do lakehouse em tabelas Delta. Bronze guarda o que
// chegou, prata limpa e tipa, ouro agrega; a carga do dia entra com merge, e o time travel confere.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (...linhas) => `id,cliente,valor,data\n${linhas.map((l) => `${l}\n`).join('')}`;

const DADOS = {
  'bruto/pedidos-1.csv': csv('1,Ana,120.50,2026-10-01', '2,Bia,80.00,2026-10-01', '2,Bia,80.00,2026-10-01', '3,Caio,,2026-10-02'),
  'bruto/pedidos-2.csv': csv('4,Davi,200.00,2026-10-02', '5,Ana,45.00,2026-10-03'),
  'carga-dia-2.csv': csv('3,Caio,60.00,2026-10-02', '5,Ana,50.00,2026-10-03'),
};
const OCULTO = {
  'bruto/pedidos-1.csv': csv('1,Eva,30.00,2026-10-05', '1,Eva,30.00,2026-10-05', '2,Fia,,2026-10-05'),
  'bruto/pedidos-2.csv': csv('3,Gil,70.00,2026-10-06'),
  'carga-dia-2.csv': csv('2,Fia,25.00,2026-10-05', '3,Gil,75.00,2026-10-06'),
};

const COLUNAS = ['id', 'cliente', 'valor', 'data'];
const TIPOS = ['int', 'string', 'double', 'date'];

export const projetoEtl = criarProjeto({
  id: 'etl',
  titulo: 'ETL bronze → prata → ouro',
  icone: '🥉🥈🥇',
  descricao: 'As camadas do lakehouse em Delta: bronze como chegou, prata limpa, ouro agregada, merge e time travel.',
  resumo: `
    <p>Os pedidos da loja chegam em CSV na pasta <code>bruto/</code>, com problemas: um pedido repetido e um sem valor.
      A arquitetura <b>medalhão</b> organiza o lago de dados em camadas, cada uma numa tabela <b>Delta</b>:</p>
    <ul>
      <li>🥉 <b>bronze</b>: os dados como chegaram, sem mexer (dá para refazer tudo a partir dela);</li>
      <li>🥈 <b>prata</b>: limpos e tipados;</li>
      <li>🥇 <b>ouro</b>: agregados, prontos para o relatório.</li>
    </ul>
    <p>No dia seguinte chega <code>carga-dia-2.csv</code>, com um pedido novo e uma correção: ela entra na prata com
      <code>merge</code>, e o <b>time travel</b> mostra o que mudou.</p>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from delta.tables import DeltaTable

    spark.read.csv("bruto", header=True).show()
  `,
  etapas: [
    {
      titulo: 'Bronze: como chegou',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia a pasta <code>bruto</code> <b>sem</b> inferir os tipos (tudo como texto) e grave em Delta, no caminho
          <code>bronze</code>.</p>`,
      dica: 'spark.read.csv("bruto", header=True).write.format("delta").save("bronze")',
      codigo: py`
        bruto = spark.read.csv("bruto", header=True)
        bruto.write.format("delta").save("bronze")
      `,
      regras: [{ delta: 'bronze', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS, linhasNaVersao: { versao: 0, linhas: 6 } }],
      regrasOcultas: [{ delta: 'bronze', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS, linhasNaVersao: { versao: 0, linhas: 4 } }],
    },
    {
      titulo: 'Prata: limpa e tipada',
      dificuldade: 'medio',
      enunciado: `
        <p>A partir da tabela <code>bronze</code>, guarde em <code>prata</code> os pedidos com os tipos certos
          (<code>id</code> int, <code>valor</code> double, <code>data</code> date), sem os pedidos sem valor e sem
          repetidos (mesmo <code>id</code>), e grave em Delta no caminho <code>prata</code>.</p>`,
      dica: 'spark.read.format("delta").load("bronze"); .cast("int"), .cast("double"), F.to_date; dropna(subset=["valor"]) e dropDuplicates(["id"]).',
      codigo: py`
        bronze = spark.read.format("delta").load("bronze")
        prata = (bronze.select(F.col("id").cast("int").alias("id"), "cliente",
                               F.col("valor").cast("double").alias("valor"), F.to_date("data").alias("data"))
            .dropna(subset=["valor"])
            .dropDuplicates(["id"]))
        prata.write.format("delta").save("prata")
        prata.orderBy("id").show()
      `,
      regras: [
        { delta: 'prata', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS },
        { dataframe: 'prata', tipos: TIPOS, linhas: [[1, 'Ana', 120.5, '2026-10-01'], [2, 'Bia', 80.0, '2026-10-01'], [4, 'Davi', 200.0, '2026-10-02'], [5, 'Ana', 45.0, '2026-10-03']] },
      ],
      regrasOcultas: [
        { delta: 'prata', versao: 0, operacoes: ['WRITE'], colunas: COLUNAS },
        { dataframe: 'prata', tipos: TIPOS, linhas: [[1, 'Eva', 30.0, '2026-10-05'], [3, 'Gil', 70.0, '2026-10-06']] },
      ],
    },
    {
      titulo: 'Ouro: agregada',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>ouro</code>, a partir da prata gravada, os pedidos (<code>pedidos</code>) e o total gasto
          (<code>total</code>, em 2 casas) de cada cliente, e grave em Delta no caminho <code>ouro</code>.</p>`,
      dica: 'spark.read.format("delta").load("prata").groupBy("cliente").agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("total"))',
      codigo: py`
        ouro = (spark.read.format("delta").load("prata")
            .groupBy("cliente")
            .agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("total")))
        ouro.write.format("delta").save("ouro")
        ouro.show()
      `,
      regras: [
        { delta: 'ouro', versao: 0, operacoes: ['WRITE'], colunas: ['cliente', 'pedidos', 'total'] },
        { dataframe: 'ouro', linhas: [['Ana', 2, 165.5], ['Bia', 1, 80.0], ['Davi', 1, 200.0]] },
      ],
      regrasOcultas: [
        { delta: 'ouro', versao: 0, operacoes: ['WRITE'], colunas: ['cliente', 'pedidos', 'total'] },
        { dataframe: 'ouro', linhas: [['Eva', 1, 30.0], ['Gil', 1, 70.0]] },
      ],
    },
    {
      titulo: 'A carga do dia',
      dificuldade: 'dificil',
      enunciado: `
        <p>Chegou <code>carga-dia-2.csv</code>: o pedido 3 agora tem valor, e o 5 foi corrigido. Faça o <code>merge</code> da
          carga (com os mesmos tipos da prata) na tabela <code>prata</code> pelo <code>id</code>: quem casa é atualizado,
          quem não casa é inserido. No fim, guarde em <code>prata_hoje</code> a tabela atual.</p>`,
      dica: 'DeltaTable.forPath(spark, "prata").alias("p").merge(carga.alias("c"), "p.id = c.id").whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()',
      codigo: py`
        carga = (spark.read.csv("carga-dia-2.csv", header=True)
            .select(F.col("id").cast("int").alias("id"), "cliente",
                    F.col("valor").cast("double").alias("valor"), F.to_date("data").alias("data")))
        (DeltaTable.forPath(spark, "prata").alias("p")
            .merge(carga.alias("c"), "p.id = c.id")
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute())
        prata_hoje = spark.read.format("delta").load("prata")
        prata_hoje.orderBy("id").show()
      `,
      regras: [
        { delta: 'prata', versao: 1, operacoes: ['WRITE', 'MERGE'], linhasNaVersao: { versao: 1, linhas: 5 } },
        {
          dataframe: 'prata_hoje',
          linhas: [[1, 'Ana', 120.5, '2026-10-01'], [2, 'Bia', 80.0, '2026-10-01'], [3, 'Caio', 60.0, '2026-10-02'], [4, 'Davi', 200.0, '2026-10-02'], [5, 'Ana', 50.0, '2026-10-03']],
        },
      ],
      regrasOcultas: [
        { delta: 'prata', versao: 1, operacoes: ['WRITE', 'MERGE'], linhasNaVersao: { versao: 1, linhas: 3 } },
        { dataframe: 'prata_hoje', linhas: [[1, 'Eva', 30.0, '2026-10-05'], [2, 'Fia', 25.0, '2026-10-05'], [3, 'Gil', 75.0, '2026-10-06']] },
      ],
    },
    {
      titulo: 'Time travel para conferir',
      dificuldade: 'dificil',
      enunciado: `
        <p>Leia a prata como ela era antes do merge (versão 0) e guarde em <code>diferencas</code> os pedidos que entraram ou
          mudaram, com as colunas <code>id</code>, <code>antes</code> (o valor na versão 0, nulo se não existia) e
          <code>depois</code> (o valor atual).</p>`,
      dica: 'spark.read.format("delta").option("versionAsOf", 0).load("prata"); join da atual com ela pelo id ("left") e filtre antes nulo ou diferente de depois.',
      codigo: py`
        antes = spark.read.format("delta").option("versionAsOf", 0).load("prata")
        diferencas = (prata_hoje.alias("h").join(antes.alias("a"), "id", "left")
            .select("id", F.col("a.valor").alias("antes"), F.col("h.valor").alias("depois"))
            .filter(F.col("antes").isNull() | (F.col("antes") != F.col("depois"))))
        diferencas.show()
      `,
      regras: [{ dataframe: 'diferencas', colunas: ['id', 'antes', 'depois'], linhas: [[3, null, 60.0], [5, 45.0, 50.0]] }],
      regrasOcultas: [{ dataframe: 'diferencas', colunas: ['id', 'antes', 'depois'], linhas: [[2, null, 25.0], [3, 70.0, 75.0]] }],
    },
  ],
});
