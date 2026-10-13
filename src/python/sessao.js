// Sessão Python: monta o pacote diverge_runtime (pasta python/) no sistema de arquivos
// do Pyodide e roda o código do aluno. A mesma sessão é usada no worker do site e nos
// testes no Node (tests/python-node.js).
import { montarPacotes } from './pacotes.js';
import { nucleosDoComputador } from './pool.js';

export const FONTES = import.meta.glob(['../../python/**/*.py', '!../../python/tests/**'], {
  query: '?raw', import: 'default', eager: true,
});

/**
 * `pool` é o pool de workers (PoolPython); o Python do aluno fala com ele pelo módulo
 * diverge_pool_js (veja python/diverge_runtime/pool.py). Sem pool, as tarefas rodam em sequência.
 */
export async function criarSessao(pyodide, { pool, fontes = FONTES } = {}) {
  montarPacotes(pyodide, fontes);
  pyodide.runPython('import diverge_runtime.execucao');
  if (pool) {
    pyodide.registerJsModule('diverge_pool_js', {
      submeter: (bytes) => pool.submeter(bytes),
      primeiro: (promessas) => Promise.race(Array.from(promessas, (p, i) => p.then(() => i, () => i))),
      maximo: () => pool.maximo,
      nucleos: () => nucleosDoComputador(),
    });
  }

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
