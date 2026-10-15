// PySpark do DivergePython no Pyodide, com o pool de verdade (workers do Node).
import { describe, it, expect, afterAll } from 'vitest';
import { PoolPython } from '../src/python/pool.js';
import { iniciarPython } from './python-node.js';
import { workerNode } from './pool-node.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
const sessao = iniciarPython({ pool }).then((s) => s.sessao);
const rodar = async (codigo, extras = {}) => (await sessao).executar({ 'main.py': codigo, ...extras });

const VENDAS = 'produto,regiao,quantidade,preco\nArroz,Nordeste,2,24.90\nFeijão,Sudeste,3,8.50\nCafé,Nordeste,1,19.90\nRapadura,Norte,10,2.50\n';
const INICIO = 'from pyspark.sql import SparkSession, functions as F\nspark = SparkSession.builder.getOrCreate()\n';

describe('PySpark no navegador', () => {
  it('lê o CSV do aluno no processo principal e roda as partições em vários workers', async () => {
    const r = await rodar(`${INICIO}df = spark.read.csv("vendas.csv", header=True, inferSchema=True)\n`
      + 'por_regiao = df.groupBy("regiao").agg(F.sum("quantidade").alias("total"))\npor_regiao.orderBy("regiao").show()\n', { 'vendas.csv': VENDAS });
    expect(r.erro).toBeNull();
    expect(r.saida).toContain('|Nordeste|    3|');
    expect(r.spark.shuffles).toBe(2);
    expect(r.spark.jobs.map((j) => j.acao)).toContain('show');
    expect(r.paralelismo.workers).toBeGreaterThan(1);
    expect(r.tabelas.por_regiao.colunas).toEqual([{ nome: 'regiao', tipo: 'string' }, { nome: 'total', tipo: 'bigint' }]);
    expect(r.tabelas.por_regiao.linhas).toHaveLength(3);
  }, 120_000);

  it('uma lambda que usa uma variável global do aluno roda no worker', async () => {
    const r = await rodar(`${INICIO}taxa = 10\nr = spark.sparkContext.parallelize(range(8)).map(lambda x: x * taxa).collect()\n`);
    expect(r.erro).toBeNull();
    expect(r.variaveis.r).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
  }, 120_000);

  it('o erro dentro de uma lambda sobe com o mesmo tipo', async () => {
    const r = await rodar(`${INICIO}spark.sparkContext.parallelize([1, 0]).map(lambda x: 1 // x).collect()\n`);
    expect(r.erro.tipo).toBe('ZeroDivisionError');
  }, 120_000);

  it('sem nenhuma ação: nenhum job, mas a tabela da variável existe', async () => {
    const r = await rodar(`${INICIO}df = spark.createDataFrame([("Ana", 3)], ["nome", "n"])\n`);
    expect(r.spark).toBeNull();
    expect(r.tabelas.df.linhas).toEqual([['Ana', 3]]);
  }, 120_000);

  it('o Delta roda no Pyodide e o resultado traz as tabelas', async () => {
    const r = await rodar(`${INICIO}from delta.tables import DeltaTable\n`
      + 'spark.createDataFrame([("a", 1)], ["p", "q"]).write.format("delta").save("estoque")\n'
      + 'DeltaTable.forPath(spark, "estoque").update("q = 1", {"q": "q + 1"})\n'
      + 'v0 = spark.read.format("delta").option("versionAsOf", 0).load("estoque").first().q\n');
    expect(r.erro).toBeNull();
    expect(r.variaveis.v0).toBe(1);
    expect(r.deltas.estoque).toEqual({ versao: 1, operacoes: ['WRITE', 'UPDATE'], colunas: ['p', 'q'], linhasPorVersao: [1, 1] });
  }, 120_000);

  it('o streaming roda no Pyodide e o resultado traz os micro-lotes', async () => {
    const r = await rodar(`${INICIO}q = (spark.readStream.schema("estacao STRING, temperatura DOUBLE")\n`
      + '  .option("maxFilesPerTrigger", 1).csv("leituras", header=True).groupBy("estacao").count()\n'
      + '  .writeStream.format("memory").queryName("contagem").outputMode("complete").start())\n'
      + 'q.processAllAvailable()\n'
      + 'total = sorted((r.estacao, r["count"]) for r in spark.table("contagem").collect())\n',
    {
      'leituras/lote-01.csv': 'estacao,temperatura\nCrato,31.5\nSobral,29.0\n',
      'leituras/lote-02.csv': 'estacao,temperatura\nCrato,33.0\n',
    });
    expect(r.erro).toBeNull();
    expect(r.variaveis.total).toEqual([['Crato', 2], ['Sobral', 1]]);
    expect(r.streaming.consultas[0].lotes.map((l) => [l.entrada, l.estado, l.saida])).toEqual([[2, 2, 2], [1, 2, 2]]);
    expect(r.spark.jobs.map((j) => j.acao)).toContain('lote 0 de contagem');
  }, 120_000);

  it('o MLlib treina no Pyodide, com o fit como job da aba Execução', async () => {
    const r = await rodar(`${INICIO}from pyspark.ml.feature import VectorAssembler\nfrom pyspark.ml.regression import LinearRegression\n`
      + 'df = spark.createDataFrame([(float(x), 2.0 + 3.0 * x) for x in range(8)], ["x", "label"])\n'
      + 'treino = VectorAssembler(inputCols=["x"], outputCol="features").transform(df)\n'
      + 'm = LinearRegression().fit(treino)\n'
      + 'coef = [round(c, 6) for c in m.coefficients]\nb = round(m.intercept, 6)\n');
    expect(r.erro).toBeNull();
    expect(r.variaveis.coef).toEqual([3]);
    expect(r.variaveis.b).toBe(2);
    expect(r.spark.jobs.map((j) => j.acao)).toContain('fit LinearRegression');
    expect(r.tabelas.treino.colunas.at(-1)).toEqual({ nome: 'features', tipo: 'vector' });
  }, 120_000);

  it('a correção pede a métrica, e o resultado traz o bloco modelos', async () => {
    const r = await (await sessao).executar({ 'main.py': `${INICIO}from pyspark.ml.feature import VectorAssembler\nfrom pyspark.ml.regression import LinearRegression\n`
      + 'montador = VectorAssembler(inputCols=["x"], outputCol="features")\n'
      + 'm = LinearRegression().fit(montador.transform(spark.read.csv("t.csv", header=True, inferSchema=True)))\n',
    't.csv': 'x,label\n0,2.0\n1,5.0\n2,8.0\n3,11.0\n' },
    { avaliacoes: [{ variavel: 'm', nome: 'rmse', dados: 't.csv', preparar: 'montador' }] });
    expect(r.erro).toBeNull();
    expect(r.modelos.m.tipo).toBe('LinearRegressionModel');
    expect(r.modelos.m.metricas['rmse@t.csv']).toBeLessThan(1e-9);
  }, 120_000);

  it('um DataFrame que só falha ao calcular vira erro na tabela, sem derrubar a execução', async () => {
    const r = await rodar(`${INICIO}df = spark.range(3).select(F.udf(lambda x: 1 // 0, "int")("id"))\n`);
    expect(r.erro).toBeNull();
    expect(r.tabelas.df.erro.tipo).toBe('ZeroDivisionError');
  }, 120_000);
});
