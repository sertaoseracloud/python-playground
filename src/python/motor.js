export class TempoEsgotado extends Error {}

const workerDoSite = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

/**
 * Cliente do worker Python. Executa uma tarefa por vez; se uma execução passar do
 * limite (um laço infinito, por exemplo), o worker é descartado e um novo é iniciado.
 */
export class MotorPython {
  constructor({ aoMudarEstado = () => {}, limiteMs = 10000, criarWorker = workerDoSite } = {}) {
    this.aoMudarEstado = aoMudarEstado;
    this.limiteMs = limiteMs;
    this.criarWorker = criarWorker;
    this.fila = Promise.resolve();
    this.proximoId = 1;
    this.iniciar();
  }

  iniciar() {
    this.worker?.terminate();
    this.pendentes = new Map();
    this.aoMudarEstado('carregando');
    this.worker = this.criarWorker();
    this.pronto = new Promise((resolve, reject) => {
      this.worker.onmessage = ({ data }) => {
        if (data.tipo === 'pronto') {
          this.aoMudarEstado('pronto');
          resolve();
        } else if (data.tipo === 'falha') {
          this.aoMudarEstado('falha', data.erro);
          reject(new Error(data.erro));
        } else if (data.tipo === 'resposta') {
          this.pendentes.get(data.id)?.(data);
          this.pendentes.delete(data.id);
        }
      };
      this.worker.onerror = (e) => {
        this.aoMudarEstado('falha', e.message);
        reject(new Error(e.message));
      };
    });
  }

  /** Roda os arquivos: `opcoes = { principal, entrada, chamadas }`. */
  executar(arquivos, opcoes = {}) {
    const tarefa = this.fila.then(() => this.#rodar({ arquivos, opcoes }));
    this.fila = tarefa.catch(() => {});
    return tarefa;
  }

  async #rodar(mensagem) {
    await this.pronto;
    const id = this.proximoId++;
    const inicio = performance.now();
    return new Promise((resolve, reject) => {
      const relogio = setTimeout(() => {
        this.pendentes.delete(id);
        this.iniciar();
        reject(new TempoEsgotado(`O Python passou de ${this.limiteMs / 1000} s e foi interrompido.`));
      }, this.limiteMs);
      this.pendentes.set(id, (resposta) => {
        clearTimeout(relogio);
        if (resposta.erroInterno) reject(new Error(resposta.erroInterno));
        else resolve({ ...resposta, ms: Math.round(performance.now() - inicio) });
      });
      this.worker.postMessage({ id, ...mensagem });
    });
  }
}
