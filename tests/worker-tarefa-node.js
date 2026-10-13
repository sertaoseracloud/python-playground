// Worker do pool para os testes no Node (o do site é src/python/worker-tarefa.js).
// Roda fora do vitest: recebe as fontes de python/ prontas, por workerData.
import { parentPort, workerData } from 'node:worker_threads';
import { carregarPython } from '../src/python/carregar.js';
import { montarPacotes } from '../src/python/pacotes.js';
import { criarTarefa } from '../src/python/tarefa.js';

const rodar = carregarPython().then((pyodide) => {
  montarPacotes(pyodide, workerData.fontes);
  return criarTarefa(pyodide);
});
// Avisa o pool quando o Pyodide terminou de carregar (ou por que não carregou).
rodar.then(() => parentPort.postMessage({ pronto: true }), (erro) => parentPort.postMessage({ falha: String(erro?.message ?? erro) }));

parentPort.on('message', async ({ id, tarefa }) => {
  const rodarTarefa = await rodar;
  try {
    const inicio = performance.timeOrigin + performance.now();
    const resultado = rodarTarefa(tarefa);
    const fim = performance.timeOrigin + performance.now();
    parentPort.postMessage({ id, resultado, inicio, fim }, [resultado.buffer]);
  } catch (erro) {
    parentPort.postMessage({ id, erro: String(erro?.message ?? erro) });
  }
});
