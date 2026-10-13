// Sessão Python: monta o pacote diverge_runtime (pasta python/) no sistema de arquivos
// do Pyodide e roda o código do aluno. A mesma sessão é usada no worker do site e nos
// testes no Node (tests/python-node.js).
import { montarPacotes } from './pacotes.js';

export const FONTES = import.meta.glob(['../../python/**/*.py', '!../../python/tests/**'], {
  query: '?raw', import: 'default', eager: true,
});

/**
 * `mapear(tarefas: Uint8Array[]) -> Promise<{ resultados: Uint8Array[], tarefas: object[] }>`
 * é o pool de workers; sem ele, o paralelismo roda em sequência.
 */
export async function criarSessao(pyodide, { mapear, fontes = FONTES } = {}) {
  montarPacotes(pyodide, fontes);
  pyodide.runPython('import diverge_runtime.execucao');
  if (mapear) pyodide.registerJsModule('diverge_pool_js', { mapear });

  return {
    async executar(arquivos, { principal = 'main.py', entrada = [], chamadas = [] } = {}) {
      const args = pyodide.toPy({ arquivos, principal, entrada, chamadas });
      try {
        pyodide.globals.set('_diverge_args', args);
        const json = await pyodide.runPythonAsync('import diverge_runtime.execucao as _e\n_e.executar_json(_diverge_args)');
        return JSON.parse(json);
      } finally {
        args.destroy();
        pyodide.globals.delete('_diverge_args');
      }
    },
  };
}
