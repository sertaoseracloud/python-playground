// Os exercícios do módulo 🌊 com o Python de verdade: a solução passa nos casos visível e oculto,
// e o código inicial falha no visível. (Depois da Task 7 eles também entram em conteudo.test.js.)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { corrigir } from '../src/corrigir.js';
import { iniciarPython } from './python-node.js';
import { PoolPython } from '../src/python/pool.js';
import { workerNode } from './pool-node.js';
import { exerciciosDelta, licoesDelta } from '../src/conteudo/alem-delta.js';
import { exerciciosStreaming, licoesStreaming } from '../src/conteudo/alem-streaming.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
let executar;
beforeAll(async () => { const { sessao } = await iniciarPython({ pool }); executar = (a, o) => sessao.executar(a, o); }, 120_000);

const AREAS = [['delta', exerciciosDelta, licoesDelta], ['streaming', exerciciosStreaming, licoesStreaming]];

describe.each(AREAS)('%s', (_area, exercicios, licoes) => {
  it('12 exercícios: 3 fáceis, 6 médios e 3 difíceis', () => {
    const conta = (d) => exercicios.filter((e) => e.dificuldade === d).length;
    expect([exercicios.length, conta('facil'), conta('medio'), conta('dificil')]).toEqual([12, 3, 6, 3]);
  });

  it.each(Object.values(licoes).map((l) => [l.id, l]))('lição %s roda sem erro', async (_id, l) => {
    expect((await executar({ ...l.arquivos, ...(l.dados ?? {}) }, {})).erro).toBeNull();
  }, 120_000);

  it.each(exercicios.map((p) => [p.id, p]))('%s: a solução passa em todos os casos', async (_id, p) => {
    const { relatorio } = await corrigir(p, p.solucao, executar);
    expect(relatorio.flatMap((c) => c.resultados.filter((r) => !r.ok).map((r) => `[${c.descricao}] ${r.mensagem}: ${r.detalhe}`))).toEqual([]);
  }, 120_000);

  it.each(exercicios.map((p) => [p.id, p]))('%s: o código inicial ainda não passa', async (_id, p) => {
    expect((await corrigir(p, p.arquivos, executar, { incluirOcultos: false })).aprovado).toBe(false);
  }, 120_000);
});
