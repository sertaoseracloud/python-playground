// 🔺 Delta Lake (módulo 🌊 Spark além do batch): 4 lições e 12 exercícios com a cooperativa.
// O delta do DivergePython grava o log de transações (_delta_log) e os arquivos parquet no
// sistema de arquivos do navegador, como o Delta de verdade. As regras `delta` conferem a versão,
// as operações do histórico e as colunas da tabela que o programa gravou.
import { programa } from './pyspark-comum.js';
import { exercicioAlem, LER, bloco } from './alem-comum.js';
import { coopAssociados, coopAssociadosOculto, coopEstoque, coopEstoqueOculto } from './alem-dados.js';

const DELTA = 'from delta.tables import DeltaTable\n\n';
const ESTOQUE = LER('estoque.csv', 'estoque');
const ENTRADA = LER('entrada-dia-1.csv', 'entrada');
const GRAVAR = 'estoque.write.format("delta").save("estoque")\n';

// As linhas do estoque, na mesma ordem dos arquivos (visível e oculto).
const LINHAS_ESTOQUE = [[['mel', 10, 25], ['farinha', 40, 6.5], ['rapadura', 25, 3]], [['mel', 4, 27], ['queijo', 12, 30]]];
const LINHAS_MERGE = [
  [['mel', 25, 25], ['farinha', 40, 6.5], ['rapadura', 25, 3], ['feijao', 30, 8]],
  [['mel', 4, 27], ['queijo', 32, 31], ['milho', 50, 2.5]],
];

export const licoesDelta = {
  tabela: {
    id: 'licao-delta-tabela',
    tipo: 'licao',
    titulo: 'Tabela Delta e log de transações',
    resumo: `
      <p>Uma tabela <b>Delta</b> são arquivos parquet mais uma pasta <code>_delta_log</code>, com um arquivo JSON por
        <b>versão</b> (um <b>commit</b>). Cada gravação cria uma versão nova, e nada do que já foi gravado é reescrito.</p>
      <p>É o livro-caixa da cooperativa: cada lançamento vai numa página nova, e dá para voltar a qualquer página.</p>
      <p>Para gravar, <code>df.write.format("delta").save("estoque")</code>; para ler,
        <code>spark.read.format("delta").load("estoque")</code>. O <code>mode("append")</code> acrescenta linhas e o
        <code>mode("overwrite")</code> troca tudo, sempre numa versão nova.</p>`,
    arquivos: programa('delta', bloco`
      import os

      ${ESTOQUE}
      estoque.write.format("delta").save("estoque")
      print(sorted(os.listdir("estoque/_delta_log")))     # a versão 0
      spark.read.format("delta").load("estoque").show()
    `),
    dados: coopEstoque,
  },
  historico: {
    id: 'licao-delta-historico',
    tipo: 'licao',
    titulo: 'Histórico e time travel',
    resumo: `
      <p><code>DeltaTable.forPath(spark, "estoque").history()</code> mostra as versões: <code>version</code>,
        <code>timestamp</code>, <code>operation</code> (WRITE, UPDATE, MERGE...) e os parâmetros de cada uma.</p>
      <p>O <b>time travel</b> lê a tabela como ela era: <code>.option("versionAsOf", 0)</code> pela versão, ou
        <code>.option("timestampAsOf", ...)</code> pela hora. Serve para conferir o que mudou e para desfazer um erro.</p>`,
    arquivos: programa('historico', bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}
      estoque.write.format("delta").save("estoque")
      entrada.write.format("delta").mode("append").save("estoque")
      DeltaTable.forPath(spark, "estoque").history().select("version", "operation").show()
      spark.read.format("delta").option("versionAsOf", 0).load("estoque").show()
    `),
    dados: coopEstoque,
  },
  merge: {
    id: 'licao-delta-merge',
    tipo: 'licao',
    titulo: 'Merge, update e delete',
    resumo: `
      <p>Numa tabela Delta dá para mudar linhas no lugar, cada mudança numa versão nova:
        <code>update(condição, {"coluna": "expressão"})</code>, <code>delete(condição)</code> e o <code>merge</code>.</p>
      <p>O <b>merge</b> (o <b>upsert</b>) junta uma fonte à tabela pela condição: quem casa é atualizado
        (<code>whenMatchedUpdate</code>), e quem não casa é inserido (<code>whenNotMatchedInsertAll</code>). É o
        estoque do dia: o mel que já existia soma a quantidade, e o feijão novo entra.</p>`,
    arquivos: programa('merge', bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}
      estoque.write.format("delta").save("estoque")
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.update("produto = 'farinha'", {"preco": "preco + 0.5"})
      (tabela.alias("e")
          .merge(entrada.alias("n"), "e.produto = n.produto")
          .whenMatchedUpdate(set={"qtd": "e.qtd + n.qtd"})
          .whenNotMatchedInsertAll()
          .execute())
      tabela.delete("qtd < 30")
      tabela.toDF().show()
      tabela.history().select("version", "operation").show()
    `),
    dados: coopEstoque,
  },
  manutencao: {
    id: 'licao-delta-manutencao',
    tipo: 'licao',
    titulo: 'Schema, vacuum e optimize',
    resumo: `
      <p>O Delta protege o <b>schema</b>: gravar uma coluna nova dá erro, a não ser que você peça
        <code>.option("mergeSchema", "true")</code>; aí a coluna entra, e as linhas antigas ficam com
        <code>NULL</code> nela.</p>
      <p><code>optimize().executeCompaction()</code> junta os arquivos pequenos num só. <code>vacuum(horas)</code> apaga de
        verdade os arquivos que nenhuma versão recente usa; abaixo de 168 horas (7 dias) o Delta recusa, porque o time
        travel para antes disso deixa de funcionar.</p>`,
    arquivos: programa('manutencao', bloco`
      ${DELTA}${ESTOQUE}
      estoque.write.format("delta").save("estoque")
      novo = estoque.withColumn("validade", F.lit("2026-12-31"))
      try:
          novo.write.format("delta").mode("append").save("estoque")
      except Exception as e:
          print("sem mergeSchema:", type(e).__name__)
      novo.write.format("delta").mode("append").option("mergeSchema", "true").save("estoque")
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.optimize().executeCompaction()
      spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")
      tabela.vacuum(0)
      tabela.history().select("version", "operation").show()
    `),
    dados: coopEstoque,
  },
};

const estoque = { dados: coopEstoque, oculto: coopEstoqueOculto };

export const exerciciosDelta = [
  exercicioAlem({
    id: 'dl-gravar',
    titulo: 'Associados em Delta',
    dificuldade: 'facil',
    enunciado: '<p>Grave os associados (<code>associados.csv</code>) como tabela Delta em <code>associados</code> e guarde em <code>tabela</code> a leitura dela.</p>',
    dica: 'df.write.format("delta").save("associados") e spark.read.format("delta").load("associados")',
    dados: coopAssociados,
    oculto: coopAssociadosOculto,
    inicial: `${LER('associados.csv', 'df')}tabela = df\ntabela.show()\n`,
    solucao: bloco`
      ${LER('associados.csv', 'df')}
      df.write.format("delta").save("associados")
      tabela = spark.read.format("delta").load("associados")
      tabela.show()
    `,
    regras: [{ delta: 'associados', versao: 0, operacoes: ['WRITE'], colunas: ['id', 'nome', 'cidade', 'ativo'] }, { dataframe: 'tabela', total: 4 }],
    regrasOcultas: [{ delta: 'associados', versao: 0, operacoes: ['WRITE'], colunas: ['id', 'nome', 'cidade', 'ativo'] }, { dataframe: 'tabela', total: 3 }],
  }),
  exercicioAlem({
    id: 'dl-append',
    titulo: 'A entrada do dia',
    dificuldade: 'facil',
    enunciado: '<p>A tabela <code>estoque</code> já é gravada. Acrescente a ela as linhas de <code>entrada-dia-1.csv</code>, numa versão nova, sem apagar o que já existe.</p>',
    dica: 'entrada.write.format("delta").mode("append").save("estoque")',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}tabela = spark.read.format("delta").load("estoque")\ntabela.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("append").save("estoque")
      tabela = spark.read.format("delta").load("estoque")
      tabela.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'WRITE'], linhasNaVersao: { versao: 1, linhas: 5 } }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'WRITE'], linhasNaVersao: { versao: 1, linhas: 4 } }],
  }),
  exercicioAlem({
    id: 'dl-versao',
    titulo: 'Como estava ontem',
    dificuldade: 'facil',
    enunciado: '<p>Alguém trocou o estoque pela entrada do dia (<code>overwrite</code>). Guarde em <code>antes</code> a tabela como ela era na <b>versão 0</b>.</p>',
    dica: 'spark.read.format("delta").option("versionAsOf", 0).load("estoque")',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\nantes = spark.read.format("delta").load("estoque")\nantes.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      antes = spark.read.format("delta").option("versionAsOf", 0).load("estoque")
      antes.show()
    `,
    regras: [{ dataframe: 'antes', linhas: LINHAS_ESTOQUE[0] }, { codigo: 'versionAsOf|timestampAsOf' }],
    regrasOcultas: [{ dataframe: 'antes', linhas: LINHAS_ESTOQUE[1] }],
  }),
  exercicioAlem({
    id: 'dl-historico',
    titulo: 'O histórico conta tudo',
    dificuldade: 'medio',
    enunciado: '<p>Na tabela <code>estoque</code>, aumente o preço do mel em 10% (<code>update</code>) e apague os produtos com menos de 20 unidades (<code>delete</code>). Depois guarde em <code>historico</code> as colunas <code>version</code> e <code>operation</code> do histórico, em ordem de versão.</p>',
    dica: 'tabela.update("produto = \'mel\'", {"preco": "preco * 1.1"}); tabela.delete("qtd < 20"); tabela.history().select("version", "operation").orderBy("version")',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${GRAVAR}tabela = DeltaTable.forPath(spark, "estoque")\nhistorico = tabela.history().select("version", "operation").orderBy("version")\nhistorico.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${GRAVAR}
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.update("produto = 'mel'", {"preco": "preco * 1.1"})
      tabela.delete("qtd < 20")
      historico = tabela.history().select("version", "operation").orderBy("version")
      historico.show()
    `,
    regras: [{ dataframe: 'historico', ordem: true, linhas: [[0, 'WRITE'], [1, 'UPDATE'], [2, 'DELETE']] }, { delta: 'estoque', versao: 2 }],
  }),
  exercicioAlem({
    id: 'dl-update',
    titulo: 'Mel mais caro',
    dificuldade: 'medio',
    enunciado: '<p>O mel ficou 10% mais caro. Mude o preço <b>na tabela Delta</b> <code>estoque</code> (não só num DataFrame) e guarde em <code>atual</code> a tabela depois da mudança.</p>',
    dica: 'DeltaTable.forPath(spark, "estoque").update("produto = \'mel\'", {"preco": "preco * 1.1"})',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${GRAVAR}tabela = DeltaTable.forPath(spark, "estoque")\natual = tabela.toDF().withColumn("preco", F.when(F.col("produto") == "mel", F.col("preco") * 1.1).otherwise(F.col("preco")))\natual.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${GRAVAR}
      tabela = DeltaTable.forPath(spark, "estoque")
      tabela.update("produto = 'mel'", {"preco": "preco * 1.1"})
      atual = tabela.toDF()
      atual.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'UPDATE'] }, { dataframe: 'atual', aprox: 1e-9, linhas: [['mel', 10, 27.5], ['farinha', 40, 6.5], ['rapadura', 25, 3]] }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'UPDATE'] }, { dataframe: 'atual', aprox: 1e-9, linhas: [['mel', 4, 29.7], ['queijo', 12, 30]] }],
  }),
  exercicioAlem({
    id: 'dl-delete',
    titulo: 'Quem saiu da cooperativa',
    dificuldade: 'medio',
    enunciado: '<p>Apague da tabela Delta <code>associados</code> quem não está mais ativo (<code>ativo = false</code>) e guarde em <code>ativos</code> a tabela que sobrou.</p>',
    dica: 'DeltaTable.forPath(spark, "associados").delete("ativo = false")',
    dados: coopAssociados,
    oculto: coopAssociadosOculto,
    inicial: `${DELTA}${LER('associados.csv', 'df')}df.write.format("delta").save("associados")\nativos = df.filter("ativo = true")\nativos.show()\n`,
    solucao: bloco`
      ${DELTA}${LER('associados.csv', 'df')}
      df.write.format("delta").save("associados")
      tabela = DeltaTable.forPath(spark, "associados")
      tabela.delete("ativo = false")
      ativos = tabela.toDF()
      ativos.show()
    `,
    regras: [{ delta: 'associados', versao: 1, operacoes: ['WRITE', 'DELETE'] }, { dataframe: 'ativos', linhas: [[1, 'Ana', 'Petrolina', true], [2, 'Bento', 'Juazeiro', true], [4, 'Dora', 'Sobral', true]] }],
    regrasOcultas: [{ delta: 'associados', versao: 1, operacoes: ['WRITE', 'DELETE'] }, { dataframe: 'ativos', linhas: [[1, 'Edu', 'Mossoró', true], [3, 'Gil', 'Petrolina', true]] }],
  }),
  exercicioAlem({
    id: 'dl-merge',
    titulo: 'Upsert do estoque do dia',
    dificuldade: 'medio',
    enunciado: '<p>Junte a entrada do dia à tabela <code>estoque</code> com um <code>merge</code>: o produto que já existe soma a quantidade e fica com o preço novo; o produto novo entra inteiro. Guarde em <code>atual</code> a tabela depois do merge.</p>',
    dica: 'tabela.alias("e").merge(entrada.alias("n"), "e.produto = n.produto").whenMatchedUpdate(set={"qtd": "e.qtd + n.qtd", "preco": "n.preco"}).whenNotMatchedInsertAll().execute()',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}tabela = DeltaTable.forPath(spark, "estoque")\natual = tabela.toDF().union(entrada)\natual.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}
      tabela = DeltaTable.forPath(spark, "estoque")
      (tabela.alias("e")
          .merge(entrada.alias("n"), "e.produto = n.produto")
          .whenMatchedUpdate(set={"qtd": "e.qtd + n.qtd", "preco": "n.preco"})
          .whenNotMatchedInsertAll()
          .execute())
      atual = tabela.toDF()
      atual.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[0] }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, operacoes: ['WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[1] }],
  }),
  exercicioAlem({
    id: 'dl-schema',
    titulo: 'A coluna nova da validade',
    dificuldade: 'medio',
    enunciado: '<p>A entrada do dia agora traz a <code>validade</code>. Acrescente-a à tabela <code>estoque</code> com a coluna nova (o Delta recusa sem pedir), e guarde em <code>sem_validade</code> as linhas que ficaram com a validade nula.</p>',
    dica: '.mode("append").option("mergeSchema", "true").save("estoque"); depois filter(F.col("validade").isNull())',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}com_validade = entrada.withColumn("validade", F.lit("2026-12-31"))\ncom_validade.write.format("delta").mode("append").save("estoque")\nsem_validade = spark.read.format("delta").load("estoque")\nsem_validade.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      com_validade = entrada.withColumn("validade", F.lit("2026-12-31"))
      com_validade.write.format("delta").mode("append").option("mergeSchema", "true").save("estoque")
      tabela = spark.read.format("delta").load("estoque")
      sem_validade = tabela.filter(F.col("validade").isNull())
      sem_validade.show()
    `,
    regras: [{ delta: 'estoque', versao: 1, colunas: ['produto', 'qtd', 'preco', 'validade'] }, { dataframe: 'sem_validade', total: 3 }],
    regrasOcultas: [{ delta: 'estoque', versao: 1, colunas: ['produto', 'qtd', 'preco', 'validade'] }, { dataframe: 'sem_validade', total: 2 }],
  }),
  exercicioAlem({
    id: 'dl-voltar',
    titulo: 'Voltar no tempo',
    dificuldade: 'medio',
    enunciado: '<p>Uma carga errada trocou o estoque pela entrada do dia (versão 1). Recupere a tabela: leia a versão 0 e grave por cima, numa versão nova (2). Guarde em <code>tabela</code> a leitura final.</p>',
    dica: 'bom = spark.read.format("delta").option("versionAsOf", 0).load("estoque"); bom.write.format("delta").mode("overwrite").save("estoque")',
    ...estoque,
    inicial: `${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\ntabela = spark.read.format("delta").load("estoque")\ntabela.show()\n`,
    solucao: bloco`
      ${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      bom = spark.read.format("delta").option("versionAsOf", 0).load("estoque")
      bom.write.format("delta").mode("overwrite").save("estoque")
      tabela = spark.read.format("delta").load("estoque")
      tabela.show()
    `,
    regras: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'WRITE'], linhasNaVersao: { versao: 2, linhas: 3 } }, { dataframe: 'tabela', linhas: LINHAS_ESTOQUE[0] }],
    regrasOcultas: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'WRITE'], linhasNaVersao: { versao: 2, linhas: 2 } }, { dataframe: 'tabela', linhas: LINHAS_ESTOQUE[1] }],
  }),
  exercicioAlem({
    id: 'dl-vacuum',
    titulo: 'Faxina com vacuum',
    dificuldade: 'dificil',
    enunciado: '<p>Depois de trocar o estoque (<code>overwrite</code>), apague de verdade os arquivos antigos com <code>vacuum(0)</code>. O Delta recusa menos de 168 horas: desligue a checagem para esta faxina. No fim, tente ler a versão 0 e guarde em <code>v0_existe</code> se deu certo (<code>True</code>) ou não (<code>False</code>).</p>',
    dica: 'spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false"); DeltaTable.forPath(spark, "estoque").vacuum(0); a leitura da versão 0 vai num try/except',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\nDeltaTable.forPath(spark, "estoque").vacuum(0)\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")
      DeltaTable.forPath(spark, "estoque").vacuum(0)
      try:
          spark.read.format("delta").option("versionAsOf", 0).load("estoque").collect()
          v0_existe = True
      except Exception:
          v0_existe = False
      print("a versão 0 ainda existe?", v0_existe)
    `,
    regras: [{ semErros: true }, { variavel: 'v0_existe', igual: false }, { codigo: 'vacuum\\(\\s*0' }],
  }),
  exercicioAlem({
    id: 'dl-optimize',
    titulo: 'Arquivos pequenos demais',
    dificuldade: 'dificil',
    enunciado: '<p>Cada produto do estoque chega sozinho: grave um <code>append</code> por linha na tabela <code>miudo</code> (uma versão por linha). Depois junte os arquivos pequenos com <code>optimize</code>, numa versão a mais.</p>',
    dica: 'for linha in estoque.collect(): spark.createDataFrame([linha], estoque.schema).write.format("delta").mode("append").save("miudo"); depois DeltaTable.forPath(spark, "miudo").optimize().executeCompaction()',
    ...estoque,
    inicial: `${ESTOQUE}for linha in estoque.collect():\n    spark.createDataFrame([linha], estoque.schema).write.format("delta").mode("append").save("miudo")\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}
      for linha in estoque.collect():
          spark.createDataFrame([linha], estoque.schema).write.format("delta").mode("append").save("miudo")
      DeltaTable.forPath(spark, "miudo").optimize().executeCompaction()
      DeltaTable.forPath(spark, "miudo").history().select("version", "operation").show()
    `,
    regras: [{ delta: 'miudo', versao: 3, operacoes: ['WRITE', 'WRITE', 'WRITE', 'OPTIMIZE'], linhasNaVersao: { versao: 3, linhas: 3 } }],
    regrasOcultas: [{ delta: 'miudo', versao: 2, operacoes: ['WRITE', 'WRITE', 'OPTIMIZE'], linhasNaVersao: { versao: 2, linhas: 2 } }],
  }),
  exercicioAlem({
    id: 'dl-desfazer',
    titulo: 'Desfazer a carga errada',
    dificuldade: 'dificil',
    enunciado: '<p>A carga do dia foi gravada com <code>overwrite</code> e apagou o estoque. Desfaça sem perder a entrada: leia a versão 0 (time travel) e faça um <code>merge</code> dela na tabela, somando a quantidade dos produtos que estão nas duas e inserindo os outros. Guarde em <code>atual</code> a tabela final.</p>',
    dica: 'bom = ...option("versionAsOf", 0)...; tabela.alias("e").merge(bom.alias("b"), "e.produto = b.produto").whenMatchedUpdate(set={"qtd": "e.qtd + b.qtd"}).whenNotMatchedInsertAll().execute()',
    ...estoque,
    inicial: `${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}entrada.write.format("delta").mode("overwrite").save("estoque")\ntabela = DeltaTable.forPath(spark, "estoque")\natual = tabela.toDF()\natual.show()\n`,
    solucao: bloco`
      ${DELTA}${ESTOQUE}${ENTRADA}${GRAVAR}
      entrada.write.format("delta").mode("overwrite").save("estoque")
      bom = spark.read.format("delta").option("versionAsOf", 0).load("estoque")
      tabela = DeltaTable.forPath(spark, "estoque")
      (tabela.alias("e")
          .merge(bom.alias("b"), "e.produto = b.produto")
          .whenMatchedUpdate(set={"qtd": "e.qtd + b.qtd"})
          .whenNotMatchedInsertAll()
          .execute())
      atual = tabela.toDF()
      atual.show()
    `,
    regras: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[0] }],
    regrasOcultas: [{ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'WRITE', 'MERGE'] }, { dataframe: 'atual', linhas: LINHAS_MERGE[1] }],
  }),
];
