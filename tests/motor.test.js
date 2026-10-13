// MotorPython: fila de execuções, tempo limite e reinício do worker.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MotorPython, TempoEsgotado } from '../src/python/motor.js';

/** Worker falso: responde "pronto" e devolve como saída o main.py (ou nunca responde). */
function workerFalso({ travar = false } = {}) {
  const w = {
    terminado: false,
    postMessage(m) {
      if (!travar) setTimeout(() => w.onmessage({ data: { tipo: 'resposta', id: m.id, saida: m.arquivos['main.py'] } }));
    },
    terminate() { w.terminado = true; },
  };
  setTimeout(() => w.onmessage({ data: { tipo: 'pronto' } }));
  return w;
}

afterEach(() => vi.useRealTimers());

describe('MotorPython', () => {
  it('executa em fila e mede o tempo', async () => {
    const motor = new MotorPython({ criarWorker: () => workerFalso() });
    const [a, b] = await Promise.all([motor.executar({ 'main.py': 'a' }), motor.executar({ 'main.py': 'b' })]);
    expect([a.saida, b.saida]).toEqual(['a', 'b']);
    expect(a.ms).toBeGreaterThanOrEqual(0);
  });

  it('laço infinito: estoura o tempo, recria o worker e o próximo funciona', async () => {
    vi.useFakeTimers();
    const criados = [];
    const motor = new MotorPython({
      limiteMs: 1000,
      criarWorker: () => {
        const w = workerFalso({ travar: criados.length === 0 });
        criados.push(w);
        return w;
      },
    });
    await vi.advanceTimersByTimeAsync(1);
    const travada = motor.executar({ 'main.py': 'while True: pass' });
    const expectativa = expect(travada).rejects.toThrow(TempoEsgotado);
    await vi.advanceTimersByTimeAsync(1001);
    await expectativa;
    expect(criados[0].terminado).toBe(true);
    const proxima = motor.executar({ 'main.py': 'print(1)' });
    await vi.advanceTimersByTimeAsync(10);
    expect((await proxima).saida).toBe('print(1)');
  });

  it('o tempo em que o pool de workers está abrindo não conta no limite', async () => {
    vi.useFakeTimers();
    const avisos = [];
    const w = workerFalso({ travar: true });
    const motor = new MotorPython({ limiteMs: 1000, criarWorker: () => w, aoAbrirPool: (abrindo) => avisos.push(abrindo) });
    await vi.advanceTimersByTimeAsync(1);
    const execucao = motor.executar({ 'main.py': 'pool' });
    await vi.advanceTimersByTimeAsync(500);
    w.onmessage({ data: { tipo: 'pool-abrindo' } });
    await vi.advanceTimersByTimeAsync(5000); // os workers do pool demoram a carregar
    w.onmessage({ data: { tipo: 'pool-pronto' } });
    await vi.advanceTimersByTimeAsync(800);
    w.onmessage({ data: { tipo: 'resposta', id: 1, saida: 'ok' } });
    expect((await execucao).saida).toBe('ok');
    expect(avisos).toEqual([true, false]);
    expect(w.terminado).toBe(false);
  });

  it('um pool que nunca abre também é interrompido', async () => {
    vi.useFakeTimers();
    const w = workerFalso({ travar: true });
    const motor = new MotorPython({ limiteMs: 1000, criarWorker: () => w });
    await vi.advanceTimersByTimeAsync(1);
    const execucao = motor.executar({ 'main.py': 'pool' });
    const expectativa = expect(execucao).rejects.toThrow(TempoEsgotado);
    w.onmessage({ data: { tipo: 'pool-abrindo' } });
    await vi.advanceTimersByTimeAsync(60_001);
    await expectativa;
  });
});
