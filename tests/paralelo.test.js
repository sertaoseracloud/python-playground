// multiprocessing e concurrent.futures com o pool de verdade (workers do Node).
import { describe, it, expect, afterAll } from 'vitest';
import { PoolPython } from '../src/python/pool.js';
import { iniciarPython } from './python-node.js';
import { workerNode } from './pool-node.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
const sessao = iniciarPython({ pool }).then((s) => s.sessao);

describe('processos de verdade', () => {
  it('Pool.map usa mais de um worker', async () => {
    const r = await (await sessao).executar({ 'main.py': 'from multiprocessing import Pool\ndef q(x):\n    return x * x\nif __name__ == "__main__":\n    with Pool(4) as p:\n        r = p.map(q, range(8))\n' });
    expect(r.erro).toBeNull();
    expect(r.variaveis.r).toEqual([0, 1, 4, 9, 16, 25, 36, 49]);
    expect(r.paralelismo.workers).toBeGreaterThan(1);
  }, 120_000);

  it('função de outro arquivo do aluno funciona no worker', async () => {
    const r = await (await sessao).executar({
      'main.py': 'from multiprocessing import Pool\nfrom funcoes import dobro\nif __name__ == "__main__":\n    with Pool(2) as p:\n        r = p.map(dobro, [1, 2, 3])\n',
      'funcoes.py': 'def dobro(x):\n    return x * 2\n',
    });
    expect(r.erro).toBeNull();
    expect(r.variaveis.r).toEqual([2, 4, 6]);
  }, 120_000);

  it('Process com Queue e ProcessPoolExecutor com as_completed', async () => {
    const r = await (await sessao).executar({
      'main.py': 'from multiprocessing import Process, Queue\nfrom concurrent.futures import ProcessPoolExecutor, as_completed\n'
        + 'def soma(q, a, b):\n    q.put(sum(range(a, b)))\ndef q2(x):\n    return x * x\n'
        + 'if __name__ == "__main__":\n    q = Queue()\n    ps = [Process(target=soma, args=(q, 0, 50)), Process(target=soma, args=(q, 50, 100))]\n'
        + '    for p in ps:\n        p.start()\n    total = q.get() + q.get()\n    for p in ps:\n        p.join()\n'
        + '    with ProcessPoolExecutor() as ex:\n        quadrados = sorted(f.result() for f in as_completed([ex.submit(q2, x) for x in range(4)]))\n',
    });
    expect(r.erro).toBeNull();
    expect(r.variaveis).toMatchObject({ total: 4950, quadrados: [0, 1, 4, 9] });
    expect(r.paralelismo.workers).toBeGreaterThan(1);
  }, 120_000);
});
