// Prova de conceito do paralelismo real: o Python do aluno chama mapear(), que espera
// (run_sync, com JSPI) o pool de workers rodar as tarefas ao mesmo tempo.
import { describe, it, expect, afterAll } from 'vitest';
import { Worker } from 'node:worker_threads';
import { PoolPython } from '../src/python/pool.js';
import { FONTES } from '../src/python/sessao.js';
import { iniciarPython } from './python-node.js';

/** Worker do Node com a mesma cara do Web Worker (onmessage/postMessage/terminate). */
function workerNode() {
  const w = new Worker(new URL('./worker-tarefa-node.js', import.meta.url), {
    workerData: { fontes: FONTES },
  });
  const adaptador = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate(), onmessage: null };
  w.on('message', (data) => adaptador.onmessage?.({ data }));
  return adaptador;
}

const CODIGO = `
from diverge_runtime import pool
def quadrado(n):
    total = 0
    for _ in range(300_000):
        total += 1
    return n * n
resultado = pool.mapear(quadrado, [1, 2, 3, 4])
info = pool.ULTIMA
`;

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());

describe('pool de workers', () => {
  it('o Node tem JSPI ligado nos testes', () => {
    expect(typeof WebAssembly.Suspending).toBe('function');
  });

  it('com JSPI: roda em paralelo em mais de um worker', async () => {
    const { sessao } = await iniciarPython({ mapear: (t) => pool.mapear(t) });
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.erro).toBeNull();
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.variaveis.info.paralelo).toBe(true);
    expect(new Set(r.variaveis.info.tarefas.map((t) => t.worker)).size).toBeGreaterThan(1);
  });

  it('sem pool: mesmo resultado, em sequência, avisando que não houve paralelismo', async () => {
    const { sessao } = await iniciarPython();
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.variaveis.info).toMatchObject({ paralelo: false, workers: 1 });
  });

  it('função definida pelo aluno (lambda) também viaja para o worker', async () => {
    const { sessao } = await iniciarPython({ mapear: (t) => pool.mapear(t) });
    const r = await sessao.executar({ 'main.py': 'from diverge_runtime import pool\nx = pool.mapear(lambda v: v + 1, [1, 2])' });
    expect(r.erro).toBeNull();
    expect(r.variaveis.x).toEqual([2, 3]);
  });
});
