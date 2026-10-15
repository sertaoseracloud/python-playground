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

  /** Chama `funcao(args)` do Python com o terminal da página ligado (diverge_terminal_js). */
  async function chamar(funcao, dados, { aoSaida, aoPedirEntrada, semJSPI = false }) {
    const args = pyodide.toPy(dados);
    pyodide.registerJsModule('diverge_terminal_js', {
      escrever: (texto) => aoSaida?.(texto),
      // EOF vira undefined: o null do JS chega no Python como jsnull, não como None.
      pedir: () => Promise.resolve(aoPedirEntrada?.()).then((texto) => texto ?? undefined),
      sem_jspi: () => semJSPI || !aoPedirEntrada,
    });
    try {
      pyodide.globals.set('_diverge_args', args);
      return JSON.parse(await pyodide.runPythonAsync(`${funcao}(_diverge_args)`));
    } finally {
      args.destroy();
      pyodide.globals.delete('_diverge_args');
      pyodide.unregisterJsModule('diverge_terminal_js');
      pyodide.runPython("import sys; sys.modules.pop('diverge_terminal_js', None)");
    }
  }

  return {
    /**
     * `interativo`: o input() sem resposta na fila pede ao terminal (`aoPedirEntrada`, que
     * resolve com o texto ou com null = EOF); `aoSaida` recebe cada escrita na hora; com
     * `semJSPI`, o resultado volta com `precisa_entrada` em vez de esperar.
     */
    executar(arquivos, {
      principal = 'main.py', entrada = [], chamadas = [], interativo = false, argv = [], avaliacoes = [], ...ganchos
    } = {}) {
      return chamar('import diverge_runtime.execucao as _e\n_e.executar_json',
        // null (Ctrl+D numa execução repetida) vira undefined, que chega no Python como None.
        { arquivos, principal, entrada: entrada.map((r) => r ?? undefined), chamadas, interativo, argv, avaliacoes }, ganchos);
    },

    /** O >>>: `{ acao: 'iniciar', doPrograma }` ou `{ acao: 'linha', texto }` → `{ saida, erro, continua }`. */
    repl({ acao, doPrograma = false, texto = '', ...ganchos } = {}) {
      return chamar('import diverge_runtime.repl as _r\n_r.repl_json',
        { acao, doPrograma, texto, interativo: Boolean(ganchos.aoPedirEntrada) }, ganchos);
    },
  };
}
