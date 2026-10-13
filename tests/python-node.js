// Python 3.14 (Pyodide) no Node: a mesma sessão que o navegador usa.
import { carregarPython } from '../src/python/carregar.js';
import { criarSessao } from '../src/python/sessao.js';

let compartilhada;
/** Uma instância do Pyodide por arquivo de teste (carregar leva uns 2 s). */
export function iniciarPython(opcoes) {
  if (opcoes) return carregarPython().then(async (pyodide) => ({ pyodide, sessao: await criarSessao(pyodide, opcoes) }));
  compartilhada ??= carregarPython().then(async (pyodide) => ({ pyodide, sessao: await criarSessao(pyodide) }));
  return compartilhada;
}
