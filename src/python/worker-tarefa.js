// Worker do pool: um Pyodide que só roda tarefas (funcao, item) serializadas.
import { carregarPython } from './carregar.js';
import { montarPacotes } from './pacotes.js';
import { FONTES } from './sessao.js';
import { criarTarefa } from './tarefa.js';

const indexURL = import.meta.env.DEV ? '/pyodide/' : new URL(/* @vite-ignore */ '../pyodide/', import.meta.url).href;
const rodar = carregarPython({ indexURL }).then((pyodide) => {
  montarPacotes(pyodide, FONTES);
  return criarTarefa(pyodide);
});
// Avisa o pool quando o Pyodide terminou de carregar (ou por que não carregou).
rodar.then(() => postMessage({ pronto: true }), (erro) => postMessage({ falha: String(erro?.message ?? erro) }));

onmessage = async ({ data }) => {
  const rodarTarefa = await rodar;
  try {
    const resultado = rodarTarefa(data.tarefa);
    postMessage({ id: data.id, resultado }, [resultado.buffer]);
  } catch (erro) {
    postMessage({ id: data.id, erro: String(erro?.message ?? erro) });
  }
};
