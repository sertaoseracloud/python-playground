// 📜 Análise de logs: quebrar as linhas do servidor web com regex, contar status por hora, achar
// as rotas com erro e as mais lentas (percentil 95) e contar as sessões de cada visitante.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const linha = (ip, momento, metodo, rota, status, ms) => `${ip} - - [${momento}] "${metodo} ${rota} HTTP/1.1" ${status} ${ms}\n`;

const LOG_1 = [
  linha('10.0.0.1', '2026-10-15 09:00:05', 'GET', '/produtos', 200, 120),
  linha('10.0.0.2', '2026-10-15 09:05:10', 'GET', '/carrinho', 200, 80),
  linha('10.0.0.1', '2026-10-15 09:10:00', 'POST', '/pagamento', 500, 900),
  linha('10.0.0.3', '2026-10-15 09:20:30', 'GET', '/produtos', 200, 100),
  linha('10.0.0.1', '2026-10-15 09:50:00', 'GET', '/produtos', 404, 30),
].join('');
const LOG_2 = [
  linha('10.0.0.2', '2026-10-15 10:00:00', 'POST', '/pagamento', 200, 700),
  linha('10.0.0.3', '2026-10-15 10:02:00', 'POST', '/pagamento', 503, 1200),
  linha('10.0.0.2', '2026-10-15 10:15:00', 'GET', '/produtos', 200, 140),
  linha('10.0.0.1', '2026-10-15 10:40:00', 'GET', '/carrinho', 500, 60),
].join('');
const LOG_1_OCULTO = [
  linha('10.0.0.7', '2026-10-16 14:00:00', 'GET', '/busca', 200, 50),
  linha('10.0.0.7', '2026-10-16 14:20:00', 'GET', '/busca', 502, 400),
  linha('10.0.0.8', '2026-10-16 14:30:00', 'GET', '/produtos', 200, 90),
].join('');
const LOG_2_OCULTO = [
  linha('10.0.0.7', '2026-10-16 15:00:00', 'GET', '/produtos', 200, 110),
  linha('10.0.0.8', '2026-10-16 15:05:00', 'GET', '/busca', 200, 70),
].join('');

const COLUNAS = ['ip', 'momento', 'metodo', 'rota', 'status', 'ms'];
const TIPOS = ['string', 'timestamp', 'string', 'string', 'int', 'int'];

export const projetoLogs = criarProjeto({
  id: 'logs',
  titulo: 'Análise de logs',
  icone: '📜',
  descricao: 'Os logs do servidor da loja: regex, status por hora, erros, rotas lentas (percentil 95) e sessões.',
  resumo: `
    <p>O servidor da loja grava uma linha por acesso nos arquivos da pasta <code>logs/</code>: o IP, o momento, o
      método e a rota, o status da resposta e quanto tempo ela levou, em milissegundos.</p>
    <pre><code>10.0.0.1 - - [2026-10-15 09:00:05] "GET /produtos HTTP/1.1" 200 120</code></pre>
    <ol>
      <li>quebrar cada linha nas colunas, com uma expressão regular;</li>
      <li>contar os status por hora;</li>
      <li>contar os erros 5xx de cada rota;</li>
      <li>achar as rotas mais lentas pelo percentil 95;</li>
      <li>contar as sessões de cada IP (uma pausa de mais de 30 minutos começa outra).</li>
    </ol>`,
  dados: { 'logs/acesso-1.log': LOG_1, 'logs/acesso-2.log': LOG_2 },
  oculto: { 'logs/acesso-1.log': LOG_1_OCULTO, 'logs/acesso-2.log': LOG_2_OCULTO },
  inicial: py`
    # Cada linha: ip - - [momento] "MÉTODO rota protocolo" status ms
    PADRAO = r'^(\\S+) - - \\[(.+?)\\] "(\\S+) (\\S+) \\S+" (\\d+) (\\d+)$'

    linhas = spark.read.text("logs")
    linhas.show(3, truncate=False)
  `,
  etapas: [
    {
      titulo: 'Quebrar as linhas',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>acessos</code> uma linha por acesso, com as colunas <code>ip</code>, <code>momento</code>
          (timestamp), <code>metodo</code>, <code>rota</code>, <code>status</code> (int) e <code>ms</code> (int).</p>
        <p>O <code>PADRAO</code> do código já tem um grupo para cada coluna, na ordem.</p>`,
      dica: 'F.regexp_extract("value", PADRAO, 1) pega o primeiro grupo; F.to_timestamp para o momento e .cast("int") para os números.',
      codigo: py`
        parte = lambda i: F.regexp_extract("value", PADRAO, i)
        acessos = linhas.select(
            parte(1).alias("ip"),
            F.to_timestamp(parte(2)).alias("momento"),
            parte(3).alias("metodo"),
            parte(4).alias("rota"),
            parte(5).cast("int").alias("status"),
            parte(6).cast("int").alias("ms"))
        acessos.show()
      `,
      regras: [{
        dataframe: 'acessos',
        colunas: COLUNAS,
        tipos: TIPOS,
        linhas: [
          ['10.0.0.1', '2026-10-15 09:00:05', 'GET', '/produtos', 200, 120], ['10.0.0.2', '2026-10-15 09:05:10', 'GET', '/carrinho', 200, 80],
          ['10.0.0.1', '2026-10-15 09:10:00', 'POST', '/pagamento', 500, 900], ['10.0.0.3', '2026-10-15 09:20:30', 'GET', '/produtos', 200, 100],
          ['10.0.0.1', '2026-10-15 09:50:00', 'GET', '/produtos', 404, 30], ['10.0.0.2', '2026-10-15 10:00:00', 'POST', '/pagamento', 200, 700],
          ['10.0.0.3', '2026-10-15 10:02:00', 'POST', '/pagamento', 503, 1200], ['10.0.0.2', '2026-10-15 10:15:00', 'GET', '/produtos', 200, 140],
          ['10.0.0.1', '2026-10-15 10:40:00', 'GET', '/carrinho', 500, 60],
        ],
      }],
      regrasOcultas: [{ dataframe: 'acessos', colunas: COLUNAS, tipos: TIPOS, total: 5 }],
    },
    {
      titulo: 'Status por hora',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_hora</code> quantos acessos houve de cada status em cada hora do dia: as colunas
          <code>hora</code>, <code>status</code> e <code>count</code>.</p>`,
      dica: 'acessos.groupBy(F.hour("momento").alias("hora"), "status").count()',
      codigo: py`
        por_hora = acessos.groupBy(F.hour("momento").alias("hora"), "status").count()
        por_hora.orderBy("hora", "status").show()
      `,
      regras: [{ dataframe: 'por_hora', colunas: ['hora', 'status', 'count'], linhas: [[9, 200, 3], [9, 404, 1], [9, 500, 1], [10, 200, 2], [10, 500, 1], [10, 503, 1]] }],
      regrasOcultas: [{ dataframe: 'por_hora', colunas: ['hora', 'status', 'count'], linhas: [[14, 200, 2], [14, 502, 1], [15, 200, 2]] }],
    },
    {
      titulo: 'Erros 5xx por rota',
      dificuldade: 'medio',
      enunciado: `
        <p>Os status 500 e acima são erros do servidor. Guarde em <code>erros</code> quantos erros teve cada rota (só as
          que tiveram algum): as colunas <code>rota</code> e <code>erros</code>, da rota com mais erros para a com menos e,
          no empate, em ordem de rota.</p>`,
      dica: 'filter(F.col("status") >= 500), groupBy("rota").agg(F.count("*").alias("erros")) e orderBy(F.desc("erros"), "rota").',
      codigo: py`
        erros = (acessos.filter(F.col("status") >= 500)
            .groupBy("rota").agg(F.count("*").alias("erros"))
            .orderBy(F.desc("erros"), "rota"))
        erros.show()
      `,
      regras: [{ dataframe: 'erros', colunas: ['rota', 'erros'], ordem: true, linhas: [['/pagamento', 2], ['/carrinho', 1]] }],
      regrasOcultas: [{ dataframe: 'erros', colunas: ['rota', 'erros'], ordem: true, linhas: [['/busca', 1]] }],
    },
    {
      titulo: 'As rotas mais lentas',
      dificuldade: 'dificil',
      enunciado: `
        <p>A média esconde os acessos lentos; o <b>percentil 95</b> mostra o tempo que só 5% dos acessos passam. Guarde em
          <code>lentas</code>, para cada rota, o percentil 95 do tempo (<code>p95</code>) e o número de acessos
          (<code>acessos</code>), da rota mais lenta para a mais rápida.</p>`,
      dica: 'F.percentile_approx("ms", 0.95).alias("p95") dentro do agg, e orderBy(F.desc("p95")).',
      codigo: py`
        lentas = (acessos.groupBy("rota")
            .agg(F.percentile_approx("ms", 0.95).alias("p95"), F.count("*").alias("acessos"))
            .orderBy(F.desc("p95")))
        lentas.show()
      `,
      regras: [{ dataframe: 'lentas', colunas: ['rota', 'p95', 'acessos'], ordem: true, linhas: [['/pagamento', 1200, 3], ['/produtos', 140, 4], ['/carrinho', 80, 2]] }],
      regrasOcultas: [{ dataframe: 'lentas', colunas: ['rota', 'p95', 'acessos'], ordem: true, linhas: [['/busca', 400, 3], ['/produtos', 110, 2]] }],
    },
    {
      titulo: 'Sessões por IP',
      dificuldade: 'dificil',
      enunciado: `
        <p>Uma <b>sessão</b> é uma sequência de acessos do mesmo IP sem pausa de mais de 30 minutos; uma pausa maior começa
          outra sessão. Guarde em <code>sessoes</code> quantas sessões teve cada IP: as colunas <code>ip</code> e
          <code>sessoes</code>.</p>`,
      dica: 'Numa janela por IP em ordem de momento, F.lag dá o acesso anterior; F.col("momento").cast("long") vira segundos. Marque 1 no primeiro acesso e quando a pausa passar de 30 * 60, e some as marcas por IP.',
      codigo: py`
        from pyspark.sql import Window

        por_ip = Window.partitionBy("ip").orderBy("momento")
        segundos = F.col("momento").cast("long")
        marcados = (acessos
            .withColumn("intervalo", segundos - F.lag(segundos).over(por_ip))
            .withColumn("nova", F.when(F.col("intervalo").isNull() | (F.col("intervalo") > 30 * 60), 1).otherwise(0)))
        sessoes = marcados.groupBy("ip").agg(F.sum("nova").alias("sessoes"))
        sessoes.orderBy("ip").show()
      `,
      regras: [{ dataframe: 'sessoes', colunas: ['ip', 'sessoes'], linhas: [['10.0.0.1', 3], ['10.0.0.2', 2], ['10.0.0.3', 2]] }],
      regrasOcultas: [{ dataframe: 'sessoes', colunas: ['ip', 'sessoes'], linhas: [['10.0.0.7', 2], ['10.0.0.8', 2]] }],
    },
  ],
});
