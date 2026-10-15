"""As consultas de streaming da execução atual. No fim do programa, as que ficaram ativas rodam a
entrada disponível, e o resultado da execução leva o resumo dos micro-lotes (para a aba ⚡ Execução e
para a correção)."""
from . import estagios

LIMITE_CONSULTAS = 10
_CONSULTAS = []


def zerar():
    _CONSULTAS.clear()


def registrar(consulta):
    _CONSULTAS.append(consulta)


def consultas():
    return list(_CONSULTAS)


def terminar():
    """Fim do programa: cada consulta ainda ativa roda o que está disponível. O erro de um lote sobe."""
    for consulta in list(_CONSULTAS):
        consulta._fim_do_programa()


def resumo():
    if not _CONSULTAS:
        return None
    return {'consultas': [c._resumo() for c in _CONSULTAS[:LIMITE_CONSULTAS]]}


estagios.AO_ZERAR.append(zerar)
