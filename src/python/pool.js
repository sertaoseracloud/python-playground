// Pool de workers, cada um com o seu Pyodide: as tarefas rodam ao mesmo tempo nos núcleos do
// computador. Abre os workers sob demanda (até `maximo`), manda cada tarefa ao worker mais livre
// e fecha os ociosos depois de `ociosoMs` (cada worker ocupa uns 50 MB).
const workerDoSite = () => new Worker(new URL('./worker-tarefa.js', import.meta.url), { type: 'module' });

export const nucleosDoComputador = () => globalThis.navigator?.hardwareConcurrency ?? 2;
export const maximoDeWorkers = () => Math.max(1, Math.min(4, nucleosDoComputador() - 1));

export class PoolPython {
  constructor({ criarWorker = workerDoSite, maximo = maximoDeWorkers(), aoAbrir = () => {}, ociosoMs = 60_000 } = {}) {
    this.criarWorker = criarWorker;
    this.maximo = maximo;
    this.aoAbrir = aoAbrir;
    this.ociosoMs = ociosoMs;
    this.workers = [];
    this.proximoId = 1;
    this.abrindo = 0;
  }

  get abertos() {
    return this.workers.length;
  }

  /** Abre um worker; ele avisa { pronto: true } ou { falha } ao carregar. */
  #abrirUm() {
    const w = this.criarWorker();
    const registro = { w, pendentes: new Map(), indice: this.workers.length };
    if (this.abrindo++ === 0) this.aoAbrir(true);
    registro.pronto = new Promise((resolve, reject) => {
      const falhar = (mensagem) => {
        reject(new Error(mensagem));
        for (const responder of registro.pendentes.values()) responder({ erro: mensagem });
        registro.pendentes.clear();
      };
      w.onmessage = ({ data }) => {
        if (data.pronto) {
          resolve();
        } else if (data.falha) {
          falhar(data.falha);
        } else {
          registro.pendentes.get(data.id)?.(data);
          registro.pendentes.delete(data.id);
          this.#talvezOcioso();
        }
      };
      w.onerror = (e) => falhar(e.message ?? 'um worker do pool não abriu');
    }).finally(() => {
      if (--this.abrindo === 0) this.aoAbrir(false);
    });
    registro.pronto.catch(() => {});
    this.workers.push(registro);
    return registro;
  }

  /** O worker mais livre; abre outro se todos estão ocupados e ainda cabe. */
  #escolher() {
    const livre = this.workers.find((r) => r.pendentes.size === 0);
    if (livre) return livre;
    if (this.workers.length < this.maximo) return this.#abrirUm();
    return this.workers.reduce((a, b) => (b.pendentes.size < a.pendentes.size ? b : a));
  }

  #talvezOcioso() {
    clearTimeout(this.relogioOcioso);
    if (this.workers.some((r) => r.pendentes.size)) return;
    this.relogioOcioso = setTimeout(() => this.fechar(), this.ociosoMs);
  }

  /** Roda uma tarefa (Uint8Array) no worker mais livre: { resultado, worker }. */
  async submeter(tarefa) {
    clearTimeout(this.relogioOcioso);
    const registro = this.#escolher();
    const id = this.proximoId++;
    const resposta = new Promise((resolve, reject) => {
      registro.pendentes.set(id, (data) => (data.erro ? reject(new Error(data.erro)) : resolve(data.resultado)));
    });
    resposta.catch(() => {}); // se o worker não abrir, quem avisa é o erro do `pronto`, abaixo
    try {
      await registro.pronto;
    } catch (erro) {
      this.fechar(); // na próxima vez, tenta abrir de novo
      throw erro;
    }
    registro.w.postMessage({ id, tarefa: tarefa instanceof Uint8Array ? tarefa : new Uint8Array(tarefa) });
    return { resultado: await resposta, worker: registro.indice };
  }

  async mapear(tarefas) {
    const respostas = await Promise.all(Array.from(tarefas, (t) => this.submeter(t)));
    return { resultados: respostas.map((r) => r.resultado), tarefas: respostas.map((r) => ({ worker: r.worker })) };
  }

  fechar() {
    clearTimeout(this.relogioOcioso);
    for (const { w } of this.workers) w.terminate();
    this.workers = [];
  }
}
