// Pool de workers, cada um com o seu Pyodide: as tarefas rodam ao mesmo tempo nos
// núcleos do computador. Abre os workers sob demanda (até `maximo`) e mede o início e
// o fim de cada tarefa, em ms desde o começo do mapear().
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

  #abrir(quantos) {
    while (this.workers.length < quantos) {
      const w = this.criarWorker();
      const registro = { w, pendentes: new Map() };
      w.onmessage = ({ data }) => {
        registro.pendentes.get(data.id)?.(data);
        registro.pendentes.delete(data.id);
      };
      this.workers.push(registro);
    }
  }

  #rodar(registro, tarefa) {
    const id = this.proximoId++;
    return new Promise((resolve, reject) => {
      registro.pendentes.set(id, (data) => (data.erro ? reject(new Error(data.erro)) : resolve(data.resultado)));
      registro.w.postMessage({ id, tarefa });
    });
  }

  async mapear(tarefas) {
    const lista = Array.from(tarefas, (t) => (t instanceof Uint8Array ? t : new Uint8Array(t)));
    const quantos = Math.min(this.maximo, lista.length);
    this.#abrir(quantos);
    const inicio = performance.now();
    const resultados = new Array(lista.length);
    const registros = new Array(lista.length);
    let proxima = 0;
    // Cada worker pega a próxima tarefa livre assim que termina a anterior.
    await Promise.all(this.workers.slice(0, quantos).map(async (registro, worker) => {
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
