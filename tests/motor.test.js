// MotorPython: fila de execuções, tempo limite e reinício do worker.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MotorPython, TempoEsgotado, Interrompido } from '../src/python/motor.js';

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

/** Worker controlado pelo teste: guarda o que recebe e só responde quando o teste manda. */
const workerManual = () => { const w = { enviadas: [], onmessage: null, onerror: null, postMessage: (m) => w.enviadas.push(m), terminate() {} }; return w; };

describe('MotorPython: terminal', () => {
  it('o relógio para enquanto o programa espera o input() e a página responde', async () => {
    vi.useFakeTimers();
    try {
      const w = workerManual();
      const motor = new MotorPython({ limiteMs: 1000, criarWorker: () => w });
      w.onmessage({ data: { tipo: 'pronto' } });
      let digitar;
      const pendente = motor.executar({}, {}, { aoPedirEntrada: () => new Promise((r) => { digitar = r; }) });
      await vi.advanceTimersByTimeAsync(0);
      const { id } = w.enviadas.at(-1);
      w.onmessage({ data: { tipo: 'entrada', id } });
      await vi.advanceTimersByTimeAsync(5000); // a pessoa leva 5 s para digitar: não estoura
      digitar('Ana');
      await vi.advanceTimersByTimeAsync(0);
      expect(w.enviadas.at(-1)).toMatchObject({ tipo: 'resposta-entrada', id, texto: 'Ana' });
      await vi.advanceTimersByTimeAsync(500); // de volta ao relógio: ainda dentro do limite
      w.onmessage({ data: { tipo: 'resposta', id, saida: 'ok' } });
      expect((await pendente).saida).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a saída ao vivo chega pelo gancho aoSaida', async () => {
    const w = workerManual();
    const motor = new MotorPython({ criarWorker: () => w });
    w.onmessage({ data: { tipo: 'pronto' } });
    const vistos = [];
    const pendente = motor.executar({}, {}, { aoSaida: (t) => vistos.push(t) });
    await new Promise((r) => setTimeout(r));
    const { id } = w.enviadas.at(-1);
    w.onmessage({ data: { tipo: 'saida', id, texto: 'oi\n' } });
    w.onmessage({ data: { tipo: 'resposta', id, saida: 'oi\n' } });
    await pendente;
    expect(vistos).toEqual(['oi\n']);
  });

  it('repl entra na mesma fila e manda a mensagem do REPL', async () => {
    const w = workerManual();
    const motor = new MotorPython({ criarWorker: () => w });
    w.onmessage({ data: { tipo: 'pronto' } });
    const pendente = motor.repl({ acao: 'linha', texto: '1 + 1', interativo: true });
    await new Promise((r) => setTimeout(r));
    const m = w.enviadas.at(-1);
    expect(m).toMatchObject({ tipo: 'repl', opcoes: { acao: 'linha', texto: '1 + 1' } });
    w.onmessage({ data: { tipo: 'resposta', id: m.id, saida: '2\n', erro: null, continua: false } });
    expect((await pendente).saida).toBe('2\n');
  });

  it('interromper rejeita com Interrompido e recria o worker', async () => {
    const criados = [];
    const motor = new MotorPython({ criarWorker: () => { const w = workerManual(); criados.push(w); return w; } });
    criados[0].onmessage({ data: { tipo: 'pronto' } });
    const pendente = motor.executar({}, {});
    await new Promise((r) => setTimeout(r));
    motor.interromper();
    await expect(pendente).rejects.toBeInstanceOf(Interrompido);
    expect(criados).toHaveLength(2);
  });
});
