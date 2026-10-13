// Roda uma tarefa do pool com diverge_runtime.tarefa.rodar: (funcao, args, kwargs)
// serializados com cloudpickle → resposta serializada (valor ou erro, saída e filas).
export function criarTarefa(pyodide) {
  const rodar = pyodide.pyimport('diverge_runtime.tarefa').rodar;
  return (bytes) => {
    const proxy = rodar(bytes);
    try {
      return proxy.toJs();
    } finally {
      proxy.destroy();
    }
  };
}
