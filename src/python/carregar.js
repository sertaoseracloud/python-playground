// Carrega o Pyodide 314.0.7. No navegador os arquivos vêm do próprio site (pasta
// pyodide/, copiada no build pelo vite.config.js); no Node, do node_modules.
import { loadPyodide } from 'pyodide';

export function carregarPython({ indexURL } = {}) {
  return loadPyodide(indexURL ? { indexURL } : {});
}
