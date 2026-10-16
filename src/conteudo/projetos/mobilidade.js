// 🚌 Mobilidade urbana: um terminal com muito mais viagens que os outros desequilibra o groupBy.
// O "salting" espalha a chave grande em pedaços e a agregação em dois passos junta de volta.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (viagens) => `id,linha,terminal,minutos\n${viagens.map((v, i) => `${i + 1},${v.join(',')}\n`).join('')}`;

const VIAGENS = csv([
  [101, 'Centro', 30], [101, 'Centro', 25], [102, 'Centro', 40], [102, 'Centro', 35], [103, 'Centro', 20], [101, 'Centro', 30],
  [104, 'Praia', 50], [101, 'Centro', 28], [102, 'Centro', 33], [103, 'Centro', 22], [104, 'Praia', 45], [105, 'Bairro Novo', 15],
  [101, 'Centro', 27], [103, 'Centro', 21], [105, 'Bairro Novo', 18], [102, 'Centro', 38],
]);
const VIAGENS_OCULTO = csv([
  [201, 'Rodoviária', 10], [201, 'Rodoviária', 12], [202, 'Aeroporto', 40], [201, 'Rodoviária', 11], [203, 'Rodoviária', 9],
  [202, 'Aeroporto', 44], [203, 'Rodoviária', 13], [201, 'Rodoviária', 10], [202, 'Aeroporto', 42], [203, 'Rodoviária', 8],
]);

export const projetoMobilidade = criarProjeto({
  id: 'mobilidade',
  titulo: 'Mobilidade urbana',
  icone: '🚌',
  descricao: 'As viagens de ônibus da cidade: um terminal muito cheio desequilibra o trabalho, e o salting reparte.',
  resumo: `
    <p>Em <code>viagens.csv</code> está cada viagem de ônibus: a linha, o terminal de onde saiu e quantos minutos levou.
      Quase tudo sai do <b>Centro</b>. No Spark, todas as linhas de uma mesma chave vão para a mesma tarefa: a tarefa do
      Centro fica com quase todo o trabalho enquanto as outras esperam. É a <b>distorção</b> (skew).</p>
    <p>O <b>salting</b> acrescenta à chave um "sal" (aqui, o resto da divisão do id por 4): o Centro vira 4 chaves menores,
      que vão para tarefas diferentes. Depois, uma segunda agregação junta os pedaços.</p>
    <ol>
      <li>as viagens e o tempo médio de cada linha;</li>
      <li>medir o desequilíbrio entre os terminais;</li>
      <li>salgar a chave e contar por terminal e sal;</li>
      <li>juntar os pedaços de volta;</li>
      <li>comparar a maior tarefa e os planos, com e sem sal.</li>
    </ol>`,
  dados: { 'viagens.csv': VIAGENS },
  oculto: { 'viagens.csv': VIAGENS_OCULTO },
  inicial: py`
    viagens = spark.read.csv("viagens.csv", header=True, inferSchema=True)
    viagens.show()
  `,
  etapas: [
    {
      titulo: 'Viagens por linha',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>por_linha</code>, para cada linha, o número de viagens (<code>viagens</code>) e o tempo médio
          (<code>media</code>, em 1 casa): as colunas <code>linha</code>, <code>viagens</code> e <code>media</code>.</p>`,
      dica: 'viagens.groupBy("linha").agg(F.count("*").alias("viagens"), F.round(F.avg("minutos"), 1).alias("media"))',
      codigo: py`
        por_linha = viagens.groupBy("linha").agg(F.count("*").alias("viagens"), F.round(F.avg("minutos"), 1).alias("media"))
        por_linha.orderBy("linha").show()
      `,
      regras: [{ dataframe: 'por_linha', colunas: ['linha', 'viagens', 'media'], linhas: [[101, 5, 28.0], [102, 4, 36.5], [103, 3, 21.0], [104, 2, 47.5], [105, 2, 16.5]] }],
      regrasOcultas: [{ dataframe: 'por_linha', colunas: ['linha', 'viagens', 'media'], linhas: [[201, 4, 10.8], [202, 3, 42.0], [203, 3, 10.0]] }],
    },
    {
      titulo: 'O desequilíbrio',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_terminal</code> as viagens de cada terminal (<code>groupBy("terminal").count()</code>) e em
          <code>desequilibrio</code> quantas vezes o terminal mais cheio passa da média dos terminais (em 2 casas).</p>
        <p>Com 12, 2 e 2 viagens, a média é 16 ÷ 3 e o desequilíbrio é 12 ÷ (16 ÷ 3) = 2,25: a maior tarefa trabalha 2,25
          vezes a média.</p>`,
      dica: 'Traga as contagens com [linha["count"] for linha in por_terminal.collect()] e use max, sum e len do Python.',
      codigo: py`
        por_terminal = viagens.groupBy("terminal").count()
        contagens = [linha["count"] for linha in por_terminal.collect()]
        desequilibrio = round(max(contagens) / (sum(contagens) / len(contagens)), 2)
        print("desequilíbrio:", desequilibrio)
      `,
      regras: [
        { dataframe: 'por_terminal', colunas: ['terminal', 'count'], linhas: [['Centro', 12], ['Bairro Novo', 2], ['Praia', 2]] },
        { variavel: 'desequilibrio', igual: 2.25 },
      ],
      regrasOcultas: [
        { dataframe: 'por_terminal', colunas: ['terminal', 'count'], linhas: [['Rodoviária', 7], ['Aeroporto', 3]] },
        { variavel: 'desequilibrio', igual: 1.4 },
      ],
    },
    {
      titulo: 'Salgar a chave',
      dificuldade: 'medio',
      enunciado: `
        <p>Acrescente às viagens a coluna <code>sal</code> (o id módulo 4) e guarde em <code>parcial</code> a contagem por
          terminal e sal: as colunas <code>terminal</code>, <code>sal</code> e <code>count</code>. O Centro, que era uma
          chave só, vira quatro.</p>`,
      dica: 'viagens.withColumn("sal", F.col("id") % 4).groupBy("terminal", "sal").count()',
      codigo: py`
        parcial = (viagens.withColumn("sal", F.col("id") % 4)
            .groupBy("terminal", "sal").count())
        parcial.orderBy("terminal", "sal").show()
      `,
      regras: [{
        dataframe: 'parcial',
        colunas: ['terminal', 'sal', 'count'],
        linhas: [['Centro', 0, 3], ['Centro', 1, 4], ['Centro', 2, 4], ['Centro', 3, 1], ['Praia', 3, 2], ['Bairro Novo', 0, 1], ['Bairro Novo', 3, 1]],
      }],
      regrasOcultas: [{
        dataframe: 'parcial',
        colunas: ['terminal', 'sal', 'count'],
        linhas: [['Rodoviária', 0, 2], ['Rodoviária', 1, 2], ['Rodoviária', 2, 2], ['Rodoviária', 3, 1], ['Aeroporto', 1, 1], ['Aeroporto', 2, 1], ['Aeroporto', 3, 1]],
      }],
    },
    {
      titulo: 'Juntar os pedaços',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>total</code> as viagens de cada terminal somando os pedaços de <code>parcial</code>: as colunas
          <code>terminal</code> e <code>viagens</code>. O resultado é o mesmo do <code>por_terminal</code>, mas o plano tem
          dois shuffles: um para cada agregação.</p>`,
      dica: 'parcial.groupBy("terminal").agg(F.sum("count").alias("viagens")); veja os dois Exchange no total.explain().',
      codigo: py`
        total = parcial.groupBy("terminal").agg(F.sum("count").alias("viagens"))
        total.show()
      `,
      regras: [
        { dataframe: 'total', colunas: ['terminal', 'viagens'], linhas: [['Centro', 12], ['Bairro Novo', 2], ['Praia', 2]] },
        { plano: 'total', shuffles: 2 },
      ],
      regrasOcultas: [
        { dataframe: 'total', colunas: ['terminal', 'viagens'], linhas: [['Rodoviária', 7], ['Aeroporto', 3]] },
        { plano: 'total', shuffles: 2 },
      ],
    },
    {
      titulo: 'Comparar a maior tarefa',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>maior_direto</code> o maior grupo do <code>por_terminal</code> (as linhas que a tarefa mais cheia
          recebe sem sal) e em <code>maior_salgado</code> o maior grupo do <code>parcial</code> (com sal).</p>
        <p>Compare também os planos: <code>por_terminal</code> tem um shuffle; <code>total</code>, dois. O sal troca um
          shuffle a mais por tarefas mais parecidas.</p>`,
      dica: 'por_terminal.agg(F.max("count")).first()[0]; o mesmo no parcial. por_terminal.explain() e total.explain().',
      codigo: py`
        maior_direto = por_terminal.agg(F.max("count")).first()[0]
        maior_salgado = parcial.agg(F.max("count")).first()[0]
        por_terminal.explain()
        total.explain()
        print("maior tarefa:", maior_direto, "→", maior_salgado)
      `,
      regras: [{ variavel: 'maior_direto', igual: 12 }, { variavel: 'maior_salgado', igual: 4 }, { plano: 'por_terminal', shuffles: 1 }],
      regrasOcultas: [{ variavel: 'maior_direto', igual: 7 }, { variavel: 'maior_salgado', igual: 2 }, { plano: 'por_terminal', shuffles: 1 }],
    },
  ],
});
