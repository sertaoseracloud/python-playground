"""Roda uma tarefa num worker do pool (ou aqui mesmo, sem pool).

O pacote é (funcao, args, kwargs) serializado com cloudpickle. A resposta, também
serializada, é (situacao, valor ou exceção, o que a função imprimiu, itens que ela pôs
em filas do multiprocessing). Assim o print do worker chega ao terminal e o erro sobe no
processo principal com o mesmo tipo, como no Python de verdade."""
import contextlib
import io

import cloudpickle

FILAS_DA_TAREFA = {}  # id da fila -> itens postos durante esta tarefa (veja diverge_paralelo)


def rodar(pacote):
    funcao, args, kwargs = cloudpickle.loads(bytes(pacote))
    FILAS_DA_TAREFA.clear()
    saida = io.StringIO()
    try:
        with contextlib.redirect_stdout(saida):
            resposta = ('ok', funcao(*args, **kwargs))
    except BaseException as erro:  # o erro da função do aluno volta para o processo principal
        resposta = ('erro', erro)
    filas = {fila: list(itens) for fila, itens in FILAS_DA_TAREFA.items()}
    try:
        return cloudpickle.dumps((*resposta, saida.getvalue(), filas))
    except Exception as erro:  # valor ou exceção que não dá para serializar
        problema = RuntimeError(f'o resultado da tarefa não pôde ser enviado de volta: {erro}')
        return cloudpickle.dumps(('erro', problema, saida.getvalue(), filas))
