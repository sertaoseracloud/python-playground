// Roda uma tarefa do pool: (funcao, item) serializados com cloudpickle → retorno serializado.
export function criarTarefa(pyodide) {
  pyodide.runPython(`
import cloudpickle
def _diverge_tarefa(pacote):
    funcao, item = cloudpickle.loads(bytes(pacote))
    return cloudpickle.dumps(funcao(item))
`);
  const rodar = pyodide.globals.get('_diverge_tarefa');
  return (bytes) => {
    const proxy = rodar(bytes);
    try {
      return proxy.toJs();
    } finally {
      proxy.destroy();
    }
  };
}
