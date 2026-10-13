// Pool de workers, cada um com o seu Pyodide: as tarefas rodam ao mesmo tempo nos
// núcleos do computador. Abre os workers sob demanda (até `maximo`) e mede o início e
// o fim de cada tarefa, em ms desde o começo do mapear() (depois de os workers abrirem).
const workerDoSite = () => new Worker(new URL('./worker-tarefa.js', import.meta.url), { type: 'module' });

export const maximoDeWorkers = () => {
  const nucleos = globalThis.navigator?.hardwareConcurrency ?? 2;
  return Math.max(1, Math.min(4, nucleos - 1));
};

export class PoolPython {
  constructor({ criarWorker = workerDoSite, maximo = maximoDeWorkers() } = {}) {
    this.criarWorker = criarWorker;
    this.maximo = maximo;
    this.workers = [];
    this.proximoId = 1;
  }

  /** Abre workers até `quantos`; cada um avisa { pronto: true } ou { falha } ao carregar. */
  #abrir(quantos) {
    while (this.workers.length < quantos) {
      const w = this.criarWorker();
      const registro = { w, pendentes: new Map(), aberto: false };
      registro.pronto = new Promise((resolve, reject) => {
        const falhar = (mensagem) => {
          const erro = new Error(mensagem);
          reject(erro);
          for (const responder of registro.pendentes.values()) responder({ erro: mensagem });
          registro.pendentes.clear();
        };
        w.onmessage = ({ data }) => {
          if (data.pronto) {
            registro.aberto = true;
            resolve();
          } else if (data.falha) {
            falhar(data.falha);
          } else {
            registro.pendentes.get(data.id)?.(data);
            registro.pendentes.delete(data.id);
          }
        };
        w.onerror = (e) => falhar(e.message ?? 'um worker do pool não abriu');
      });
      registro.pronto.catch(() => {});
      this.workers.push(registro);
    }
    return this.workers.slice(0, quantos);
  }

  #rodar(registro, tarefa) {
    const id = this.proximoId++;
    return new Promise((resolve, reject) => {
      registro.pendentes.set(id, (data) => (data.erro ? reject(new Error(data.erro)) : resolve(data.resultado)));
      registro.w.postMessage({ id, tarefa });
    });
  }

  /** `aoAbrir(true/false)`: avisa quando precisa esperar os workers carregarem. */
  async mapear(tarefas, { aoAbrir = () => {} } = {}) {
    const lista = Array.from(tarefas, (t) => (t instanceof Uint8Array ? t : new Uint8Array(t)));
    const usados = this.#abrir(Math.min(this.maximo, lista.length));
    if (usados.some((r) => !r.aberto)) {
      aoAbrir(true);
      try {
        await Promise.all(usados.map((r) => r.pronto));
      } catch (erro) {
        this.fechar(); // na próxima vez, tenta abrir de novo
        throw erro;
      } finally {
        aoAbrir(false);
      }
    }
    const inicio = performance.now();
    const resultados = new Array(lista.length);
    const registros = new Array(lista.length);
    let proxima = 0;
    // Cada worker pega a próxima tarefa livre assim que termina a anterior.
    await Promise.all(usados.map(async (registro, worker) => {
      while (proxima < lista.length) {
        const i = proxima++;
        const comeco = performance.now() - inicio;
        resultados[i] = await this.#rodar(registro, lista[i]);
        registros[i] = { worker, inicio: comeco, fim: performance.now() - inicio };
      }
    }));
    return { resultados, tarefas: registros };
  }

  fechar() {
    for (const { w } of this.workers) w.terminate();
    this.workers = [];
  }
}
