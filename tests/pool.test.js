// Pool de workers: o Python do aluno manda tarefas, que rodam ao mesmo tempo em outros
// workers (run_sync, com JSPI); o print e os erros da tarefa voltam para o processo principal.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { PoolPython } from '../src/python/pool.js';
import { iniciarPython } from './python-node.js';
import { workerNode } from './pool-node.js';

const CODIGO = `
from diverge_runtime import pool
def quadrado(n):
    total = 0
    for _ in range(300_000):
        total += 1
    return n * n
resultado = pool.mapear(quadrado, [1, 2, 3, 4])
`;

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());

describe('pool de workers', () => {
  it('o Node tem JSPI ligado nos testes', () => {
    expect(typeof WebAssembly.Suspending).toBe('function');
  });

  it('com JSPI: roda em paralelo em mais de um worker', async () => {
    const { sessao } = await iniciarPython({ pool });
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.erro).toBeNull();
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.paralelismo).toMatchObject({ disponivel: true, maximo: 4, tarefas: 4 });
    expect(r.paralelismo.workers).toBeGreaterThan(1);
  }, 120_000);

  it('o print do worker aparece no terminal e o erro do worker sobe com o mesmo tipo', async () => {
    const { sessao } = await iniciarPython({ pool });
    const codigo = 'from diverge_runtime import pool\n'
      + 'def f(x):\n    print("no worker", x)\n    if x < 0:\n        raise ValueError("negativo")\n    return x\n'
      + 'print(pool.mapear(f, [1, 2]))\n'
      + 'try:\n    pool.mapear(f, [-1])\nexcept ValueError as e:\n    print("pegou:", e)\n';
    const r = await sessao.executar({ 'main.py': codigo });
    expect(r.saida).toBe('no worker 1\nno worker 2\n[1, 2]\nno worker -1\npegou: negativo\n');
  }, 120_000);

  it('sem pool: mesmo resultado, em sequência, avisando que não houve paralelismo', async () => {
    const { sessao } = await iniciarPython();
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.paralelismo).toMatchObject({ disponivel: false, maximo: 1, tarefas: 4, workers: 1 });
  });

  it('função definida pelo aluno (lambda) também viaja para o worker', async () => {
    const { sessao } = await iniciarPython({ pool });
    const r = await sessao.executar({ 'main.py': 'from diverge_runtime import pool\nx = pool.mapear(lambda v: v + 1, [1, 2])' });
    expect(r.erro).toBeNull();
    expect(r.variaveis.x).toEqual([2, 3]);
  }, 120_000);
});

/** Worker falso do pool: avisa que abriu depois de `abreEm` ms (ou falha) e devolve a tarefa. */
function workerFalso({ abreEm = 5, falha = null } = {}) {
  const w = {
    onmessage: null,
    postMessage({ id, tarefa }) { setTimeout(() => w.onmessage({ data: { id, resultado: tarefa } })); },
    terminate() {},
  };
  setTimeout(() => w.onmessage({ data: falha ? { falha } : { pronto: true } }), abreEm);
  return w;
}

describe('abertura do pool', () => {
  it('avisa enquanto os workers abrem, só na primeira vez', async () => {
    const avisos = [];
    const p = new PoolPython({ criarWorker: () => workerFalso(), maximo: 2, aoAbrir: (abrindo) => avisos.push(abrindo) });
    const r = await p.mapear([new Uint8Array([1]), new Uint8Array([2])]);
    expect(r.resultados.map((b) => b[0])).toEqual([1, 2]);
    await p.mapear([new Uint8Array([3])]);
    expect(avisos).toEqual([true, false]);
  });

  it('um worker que não abre faz a tarefa falhar com a mensagem dele', async () => {
    const p = new PoolPython({ criarWorker: () => workerFalso({ falha: 'sem memória' }), maximo: 2 });
    await expect(p.mapear([new Uint8Array([1])])).rejects.toThrow('sem memória');
  });
});

describe('tarefas avulsas e workers ociosos', () => {
  it('submeter usa o worker mais livre e abre só o que precisa', async () => {
    const p = new PoolPython({ criarWorker: () => workerFalso(), maximo: 3 });
    const [a, b] = await Promise.all([p.submeter(new Uint8Array([1])), p.submeter(new Uint8Array([2]))]);
    expect([a.resultado[0], b.resultado[0]]).toEqual([1, 2]);
    expect(new Set([a.worker, b.worker]).size).toBe(2);
    expect(p.abertos).toBe(2);
  });

  it('submeter devolve os tempos medidos no worker', async () => {
    const w = () => {
      const x = workerFalso();
      x.postMessage = ({ id, tarefa }) => setTimeout(() => x.onmessage({ data: { id, resultado: tarefa, inicio: 10, fim: 15 } }));
      return x;
    };
    const p = new PoolPython({ criarWorker: w, maximo: 1 });
    expect(await p.submeter(new Uint8Array([1]))).toMatchObject({ inicio: 10, fim: 15, worker: 0 });
  });

  it('fecha os workers ociosos depois do tempo e reabre na próxima tarefa', async () => {
    vi.useFakeTimers();
    try {
      const avisos = [];
      const p = new PoolPython({ criarWorker: () => workerFalso({ abreEm: 1 }), maximo: 2, ociosoMs: 1000, aoAbrir: (a) => avisos.push(a) });
      const r = p.submeter(new Uint8Array([7]));
      await vi.advanceTimersByTimeAsync(5);
      await r;
      await vi.advanceTimersByTimeAsync(1001);
      expect(p.abertos).toBe(0);
      const r2 = p.submeter(new Uint8Array([8]));
      await vi.advanceTimersByTimeAsync(5);
      expect((await r2).resultado[0]).toBe(8);
      expect(avisos).toEqual([true, false, true, false]);
    } finally {
      vi.useRealTimers();
    }
  });
});
