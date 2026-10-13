// Worker do Node com a mesma cara do Web Worker (onmessage/postMessage/terminate), para o pool nos testes.
import { Worker } from 'node:worker_threads';
import { FONTES } from '../src/python/sessao.js';

export function workerNode() {
  const w = new Worker(new URL('./worker-tarefa-node.js', import.meta.url), { workerData: { fontes: FONTES } });
  const adaptador = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate(), onmessage: null, onerror: null };
  w.on('message', (data) => adaptador.onmessage?.({ data }));
  w.on('error', (e) => adaptador.onerror?.(e));
  return adaptador;
}
