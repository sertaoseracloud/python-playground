export class TempoEsgotado extends Error {}
/** Ctrl+C no terminal: a execução foi interrompida e o worker, recriado. */
export class Interrompido extends Error {}

const workerDoSite = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

// Abrir o pool de workers carrega um Pyodide em cada um: na primeira vez, pode levar
// bem mais que o limite. Esse tempo não conta, mas também não pode ser infinito.
const LIMITE_ABRIR_POOL_MS = 60_000;

/**
 * Cliente do worker Python. Executa uma tarefa por vez; se uma execução passar do
 * limite (um laço infinito, por exemplo), o worker é descartado e um novo é iniciado.
 * Enquanto o pool de workers paralelos abre ('pool-abrindo' até 'pool-pronto'), o
 * relógio da execução fica parado.
 */
export class MotorPython {
  constructor({ aoMudarEstado = () => {}, aoAbrirPool = () => {}, limiteMs = 10000, criarWorker = workerDoSite } = {}) {
    this.aoMudarEstado = aoMudarEstado;
    this.aoAbrirPool = aoAbrirPool;
    this.limiteMs = limiteMs;
    this.criarWorker = criarWorker;
    this.fila = Promise.resolve();
    this.proximoId = 1;
    this.iniciar();
  }

  iniciar() {
    this.worker?.terminate();
    this.pendentes = new Map();
    this.ganchos = new Map();
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
          this.ganchos.delete(data.id);
        } else if (data.tipo === 'saida') {
          this.ganchos.get(data.id)?.aoSaida?.(data.texto);
        } else if (data.tipo === 'entrada') {
          // Esperando a pessoa digitar: o relógio para e volta a contar com a resposta.
          const worker = this.worker;
          this.armarRelogio?.(null);
          Promise.resolve(this.ganchos.get(data.id)?.aoPedirEntrada?.() ?? null).then((texto) => {
            if (this.worker !== worker || !this.pendentes.has(data.id)) return; // interrompido enquanto esperava
            this.armarRelogio?.(this.limiteMs);
            worker.postMessage({ tipo: 'resposta-entrada', id: data.id, texto: texto ?? null });
          });
        } else if (data.tipo === 'pool-abrindo' || data.tipo === 'pool-pronto') {
          const abrindo = data.tipo === 'pool-abrindo';
          this.armarRelogio?.(abrindo ? LIMITE_ABRIR_POOL_MS : this.limiteMs);
          this.aoAbrirPool(abrindo);
        }
      };
      this.worker.onerror = (e) => {
        this.aoMudarEstado('falha', e.message ?? 'o worker do Python não abriu');
        reject(new Error(e.message ?? 'o worker do Python não abriu'));
      };
    });
    // A falha já foi avisada por aoMudarEstado; quem executar depois recebe o erro.
    this.pronto.catch(() => {});
  }

  /**
   * Roda os arquivos: `opcoes = { principal, entrada, chamadas, interativo, argv, semJSPI }`;
   * `ganchos = { aoSaida(texto), aoPedirEntrada() → Promise<string | null> }` (o terminal).
   */
  executar(arquivos, opcoes = {}, ganchos = {}) {
    const tarefa = this.fila.then(() => this.#rodar({ arquivos, opcoes }, ganchos));
    this.fila = tarefa.catch(() => {});
    return tarefa;
  }

  /** Ctrl+C: encerra a execução em andamento (o worker é recriado). */
  interromper() {
    const atual = this.atual;
    if (!atual) return;
    this.atual = null;
    atual.parar();
    this.iniciar();
    atual.reject(new Interrompido('KeyboardInterrupt'));
  }

  async #rodar(mensagem, ganchos) {
    await this.pronto;
    const id = this.proximoId++;
    const inicio = performance.now();
    return new Promise((resolve, reject) => {
      let relogio;
      const parar = () => {
        clearTimeout(relogio);
        this.armarRelogio = null;
        this.pendentes.delete(id);
        if (this.atual?.id === id) this.atual = null;
      };
      const esgotar = () => {
        parar();
        this.iniciar();
        reject(new TempoEsgotado(`O Python passou de ${this.limiteMs / 1000} s e foi interrompido.`));
      };
      // ms = null: só para o relógio (esperando a digitação).
      this.armarRelogio = (ms) => {
        clearTimeout(relogio);
        if (ms !== null) relogio = setTimeout(esgotar, ms);
      };
      this.armarRelogio(this.limiteMs);
      this.atual = { id, parar, reject };
      this.ganchos.set(id, ganchos);
      this.pendentes.set(id, (resposta) => {
        parar();
        if (resposta.erroInterno) reject(new Error(resposta.erroInterno));
        else resolve({ ...resposta, ms: Math.round(performance.now() - inicio) });
      });
      this.worker.postMessage({ id, ...mensagem });
    });
  }
}
