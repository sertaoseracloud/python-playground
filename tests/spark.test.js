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

  it('um DataFrame que só falha ao calcular vira erro na tabela, sem derrubar a execução', async () => {
    const r = await rodar(`${INICIO}df = spark.range(3).select(F.udf(lambda x: 1 // 0, "int")("id"))\n`);
    expect(r.erro).toBeNull();
    expect(r.tabelas.df.erro.tipo).toBe('ZeroDivisionError');
  }, 120_000);
});
