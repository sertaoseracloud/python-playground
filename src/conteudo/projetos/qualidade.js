// 🧹 Qualidade de dados e SCD tipo 2: regras de qualidade, quarentena das linhas ruins em Delta e a
// tabela de clientes com histórico (início, fim e atual), atualizada com merge.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (...linhas) => `id,nome,email,cidade\n${linhas.map((l) => `${l}\n`).join('')}`;

const DADOS = {
  'clientes-dia-1.csv': csv('1,Ana,ana@exemplo.com,Crato', '2,Bia,bia-exemplo.com,Sobral', '3,Caio,caio@exemplo.com,', '4,Davi,davi@exemplo.com,Recife'),
  'clientes-dia-2.csv': csv('1,Ana,ana@exemplo.com,Fortaleza', '4,Davi,davi@exemplo.com,Recife', '5,Edu,edu@exemplo.com,Natal', '6,Fia,,Natal'),
};
const OCULTO = {
  'clientes-dia-1.csv': csv('1,Gil,gil@exemplo.com,Iguatu', '2,Hana,hana@exemplo.com,', '3,Ivo,ivo@exemplo.com,Tauá'),
  'clientes-dia-2.csv': csv('1,Gil,gil@exemplo.com,Iguatu', '3,Ivo,ivo@exemplo.com,Quixadá', '4,Jade,jade-exemplo.com,Crato'),
};

const HISTORICO = ['id', 'nome', 'email', 'cidade', 'inicio', 'fim', 'atual'];

export const projetoQualidade = criarProjeto({
  id: 'qualidade',
  titulo: 'Qualidade de dados e SCD tipo 2',
  icone: '🧹',
  descricao: 'Clientes chegando todo dia: regras de qualidade, quarentena e histórico (SCD tipo 2) com merge no Delta.',
  resumo: `
    <p>Todo dia chega um arquivo com os clientes (<code>clientes-dia-1.csv</code>, <code>clientes-dia-2.csv</code>). Alguns
      vêm com problema: e-mail sem @, cidade vazia. Eles não entram na tabela: vão para a <b>quarentena</b>, para alguém
      corrigir.</p>
    <p>Quando um cliente muda de cidade, não basta sobrescrever: a empresa quer saber onde ele morava em cada data. É o
      <b>SCD tipo 2</b> (dimensão que muda devagar): a linha antiga ganha a data de <code>fim</code> e deixa de ser a
      <code>atual</code>, e uma linha nova entra com a data de <code>inicio</code>.</p>
    <ol>
      <li>as regras de qualidade;</li>
      <li>a quarentena das linhas ruins;</li>
      <li>a tabela de clientes em Delta, com início, fim e atual;</li>
      <li>o SCD tipo 2 com o merge do dia 2;</li>
      <li>como a tabela estava em cada data.</li>
    </ol>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from delta.tables import DeltaTable

    dia1 = spark.read.csv("clientes-dia-1.csv", header=True, inferSchema=True)
    dia1.show()
  `,
  etapas: [
    {
      titulo: 'As regras de qualidade',
      dificuldade: 'facil',
      enunciado: `
        <p>Escreva a função <code>checar(df)</code>, que acrescenta a coluna <code>problema</code>: <code>"email sem @"</code>
          quando o e-mail está vazio ou não tem @, <code>"sem cidade"</code> quando a cidade está vazia, e nulo quando a linha
          está boa. Guarde em <code>checados</code> o dia 1 checado.</p>`,
      dica: 'F.when(F.col("email").isNull() | ~F.col("email").contains("@"), "email sem @").when(F.col("cidade").isNull(), "sem cidade")',
      codigo: py`
        def checar(df):
            return df.withColumn("problema",
                F.when(F.col("email").isNull() | ~F.col("email").contains("@"), "email sem @")
                 .when(F.col("cidade").isNull(), "sem cidade"))

        checados = checar(dia1)
        checados.show()
      `,
      regras: [{
        dataframe: 'checados',
        colunas: ['id', 'nome', 'email', 'cidade', 'problema'],
        linhas: [[1, 'Ana', 'ana@exemplo.com', 'Crato', null], [2, 'Bia', 'bia-exemplo.com', 'Sobral', 'email sem @'], [3, 'Caio', 'caio@exemplo.com', null, 'sem cidade'], [4, 'Davi', 'davi@exemplo.com', 'Recife', null]],
      }],
      regrasOcultas: [{
        dataframe: 'checados',
        colunas: ['id', 'nome', 'email', 'cidade', 'problema'],
        linhas: [[1, 'Gil', 'gil@exemplo.com', 'Iguatu', null], [2, 'Hana', 'hana@exemplo.com', null, 'sem cidade'], [3, 'Ivo', 'ivo@exemplo.com', 'Tauá', null]],
      }],
    },
    {
      titulo: 'A quarentena',
      dificuldade: 'medio',
      enunciado: `
        <p>Grave as linhas com problema em Delta, no caminho <code>quarentena</code>, e guarde em <code>bons</code> as
          outras, sem a coluna <code>problema</code>.</p>`,
      dica: 'checados.filter(F.col("problema").isNotNull()).write.format("delta").save("quarentena"); bons = checados.filter(F.col("problema").isNull()).drop("problema").',
      codigo: py`
        checados.filter(F.col("problema").isNotNull()).write.format("delta").save("quarentena")
        bons = checados.filter(F.col("problema").isNull()).drop("problema")
        bons.show()
      `,
      regras: [
        { delta: 'quarentena', versao: 0, operacoes: ['WRITE'], linhasNaVersao: { versao: 0, linhas: 2 } },
        { dataframe: 'bons', colunas: ['id', 'nome', 'email', 'cidade'], linhas: [[1, 'Ana', 'ana@exemplo.com', 'Crato'], [4, 'Davi', 'davi@exemplo.com', 'Recife']] },
      ],
      regrasOcultas: [
        { delta: 'quarentena', versao: 0, operacoes: ['WRITE'], linhasNaVersao: { versao: 0, linhas: 1 } },
        { dataframe: 'bons', colunas: ['id', 'nome', 'email', 'cidade'], linhas: [[1, 'Gil', 'gil@exemplo.com', 'Iguatu'], [3, 'Ivo', 'ivo@exemplo.com', 'Tauá']] },
      ],
    },
    {
      titulo: 'Os clientes em Delta',
      dificuldade: 'medio',
      enunciado: `
        <p>Grave os bons em Delta, no caminho <code>clientes</code>, com mais três colunas: <code>inicio</code> (a data
          2026-10-01), <code>fim</code> (uma data nula) e <code>atual</code> (verdadeiro).</p>`,
      dica: 'F.to_date(F.lit("2026-10-01")), F.lit(None).cast("date") e F.lit(True).',
      codigo: py`
        clientes = (bons.withColumn("inicio", F.to_date(F.lit("2026-10-01")))
            .withColumn("fim", F.lit(None).cast("date"))
            .withColumn("atual", F.lit(True)))
        clientes.write.format("delta").save("clientes")
      `,
      regras: [{ delta: 'clientes', versao: 0, operacoes: ['WRITE'], colunas: HISTORICO, linhasNaVersao: { versao: 0, linhas: 2 } }],
      regrasOcultas: [{ delta: 'clientes', versao: 0, operacoes: ['WRITE'], colunas: HISTORICO, linhasNaVersao: { versao: 0, linhas: 2 } }],
    },
    {
      titulo: 'O SCD tipo 2 com merge',
      dificuldade: 'dificil',
      enunciado: `
        <p>Chegou o dia 2 (data 2026-10-02). Cheque-o, mande os ruins para a quarentena (em <code>append</code>) e faça o
          merge dos bons na tabela <code>clientes</code>:</p>
        <ul>
          <li>quem mudou de cidade: a linha atual ganha <code>fim</code> = 2026-10-02 e <code>atual</code> = falso, e entra uma
            linha nova com a cidade nova;</li>
          <li>quem é novo entra; quem não mudou fica como está.</li>
        </ul>
        <p>No fim, guarde em <code>historico</code> a tabela inteira.</p>`,
      dica: 'O truque do SCD 2: some à entrada uma cópia de quem mudou com a chave nula (ela nunca casa, então vira a linha nova). O merge casa por "c.id = e.chave AND c.atual = true": whenMatchedUpdate fecha a linha antiga, whenNotMatchedInsert insere.',
      codigo: py`
        dia2 = checar(spark.read.csv("clientes-dia-2.csv", header=True, inferSchema=True))
        dia2.filter(F.col("problema").isNotNull()).write.format("delta").mode("append").save("quarentena")
        novos = (dia2.filter(F.col("problema").isNull()).drop("problema")
            .withColumn("dia", F.to_date(F.lit("2026-10-02"))))

        tabela = DeltaTable.forPath(spark, "clientes")
        atuais = tabela.toDF().filter("atual").select("id", F.col("cidade").alias("cidade_atual"))
        mudaram = (novos.join(atuais, "id")
            .filter(F.col("cidade") != F.col("cidade_atual"))
            .drop("cidade_atual"))
        entrada = (mudaram.withColumn("chave", F.lit(None).cast("int"))
            .unionByName(novos.withColumn("chave", F.col("id"))))
        (tabela.alias("c")
            .merge(entrada.alias("e"), "c.id = e.chave AND c.atual = true")
            .whenMatchedUpdate(condition="c.cidade <> e.cidade", set={"fim": "e.dia", "atual": "false"})
            .whenNotMatchedInsert(values={
                "id": "e.id", "nome": "e.nome", "email": "e.email", "cidade": "e.cidade",
                "inicio": "e.dia", "fim": "null", "atual": "true"})
            .execute())
        historico = spark.read.format("delta").load("clientes")
        historico.orderBy("id", "inicio").show()
      `,
      regras: [
        { delta: 'clientes', versao: 1, operacoes: ['WRITE', 'MERGE'] },
        { delta: 'quarentena', versao: 1, operacoes: ['WRITE', 'WRITE'] },
        {
          dataframe: 'historico',
          colunas: HISTORICO,
          linhas: [
            [1, 'Ana', 'ana@exemplo.com', 'Crato', '2026-10-01', '2026-10-02', false], [1, 'Ana', 'ana@exemplo.com', 'Fortaleza', '2026-10-02', null, true],
            [4, 'Davi', 'davi@exemplo.com', 'Recife', '2026-10-01', null, true], [5, 'Edu', 'edu@exemplo.com', 'Natal', '2026-10-02', null, true],
          ],
        },
      ],
      regrasOcultas: [
        { delta: 'clientes', versao: 1, operacoes: ['WRITE', 'MERGE'] },
        { delta: 'quarentena', versao: 1, operacoes: ['WRITE', 'WRITE'] },
        {
          dataframe: 'historico',
          colunas: HISTORICO,
          linhas: [
            [1, 'Gil', 'gil@exemplo.com', 'Iguatu', '2026-10-01', null, true], [3, 'Ivo', 'ivo@exemplo.com', 'Tauá', '2026-10-01', '2026-10-02', false],
            [3, 'Ivo', 'ivo@exemplo.com', 'Quixadá', '2026-10-02', null, true],
          ],
        },
      ],
    },
    {
      titulo: 'Como estava em cada data',
      dificuldade: 'dificil',
      enunciado: `
        <p>Escreva a função <code>em(data)</code>, que devolve, do <code>historico</code>, as linhas válidas naquela data
          (<code>inicio</code> até a data, e <code>fim</code> nulo ou depois dela), com as colunas <code>id</code>,
          <code>nome</code> e <code>cidade</code>. Guarde em <code>em_1</code> e <code>em_2</code> a tabela em 2026-10-01 e em
          2026-10-02.</p>`,
      dica: 'd = F.to_date(F.lit(data)); filter((F.col("inicio") <= d) & (F.col("fim").isNull() | (F.col("fim") > d))).',
      codigo: py`
        def em(data):
            d = F.to_date(F.lit(data))
            validas = (F.col("inicio") <= d) & (F.col("fim").isNull() | (F.col("fim") > d))
            return historico.filter(validas).select("id", "nome", "cidade")

        em_1 = em("2026-10-01")
        em_2 = em("2026-10-02")
        em_1.show()
        em_2.show()
      `,
      regras: [
        { dataframe: 'em_1', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Ana', 'Crato'], [4, 'Davi', 'Recife']] },
        { dataframe: 'em_2', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Ana', 'Fortaleza'], [4, 'Davi', 'Recife'], [5, 'Edu', 'Natal']] },
      ],
      regrasOcultas: [
        { dataframe: 'em_1', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Gil', 'Iguatu'], [3, 'Ivo', 'Tauá']] },
        { dataframe: 'em_2', colunas: ['id', 'nome', 'cidade'], linhas: [[1, 'Gil', 'Iguatu'], [3, 'Ivo', 'Quixadá']] },
      ],
    },
  ],
});
