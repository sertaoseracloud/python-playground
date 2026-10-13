"""Troca `multiprocessing` e `concurrent.futures` pelos do DivergePython só durante a execução do aluno."""
import sys

from . import futuros, guarda, processos


def instalar(principal, fonte):
    guarda.configurar(principal, fonte)
    processos.zerar()
    import concurrent
    antigos = {nome: sys.modules.get(nome) for nome in ('multiprocessing', 'concurrent.futures')}
    atributo = getattr(concurrent, 'futures', None)
    sys.modules['multiprocessing'] = processos.modulo()
    sys.modules['concurrent.futures'] = concurrent.futures = futuros.modulo()

    def desfazer():
        # Processos que o aluno iniciou e não esperou: espera agora, para o print deles não se perder.
        for processo in list(processos.PENDENTES):
            processo.join()
        for nome, modulo in antigos.items():
            if modulo is None:
                sys.modules.pop(nome, None)
            else:
                sys.modules[nome] = modulo
        if atributo is not None:
            concurrent.futures = atributo

    return desfazer
