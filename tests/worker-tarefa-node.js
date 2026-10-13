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

parentPort.on('message', async ({ id, tarefa }) => {
  const rodarTarefa = await rodar;
  try {
    const resultado = rodarTarefa(tarefa);
    parentPort.postMessage({ id, resultado }, [resultado.buffer]);
  } catch (erro) {
    parentPort.postMessage({ id, erro: String(erro?.message ?? erro) });
  }
});
