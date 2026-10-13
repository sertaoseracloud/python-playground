"""Converte valores do Python para JSON (o site compara retornos e variáveis assim).

Tuplas viram listas; conjuntos viram listas ordenadas; chaves de dicionário viram texto.
O que não tem equivalente em JSON volta como None, e o `repr` vai junto para mostrar ao aluno.
"""
import math

SEM_JSON = object()


def para_json(valor, profundidade=0):
    if profundidade > 20:
        return SEM_JSON
    if valor is None or isinstance(valor, (bool, str)):
        return valor
    if isinstance(valor, int):
        return valor
    if isinstance(valor, float):
        return valor if math.isfinite(valor) else SEM_JSON
    if isinstance(valor, (list, tuple)):
        itens = [para_json(v, profundidade + 1) for v in valor]
        return SEM_JSON if any(i is SEM_JSON for i in itens) else itens
    if isinstance(valor, (set, frozenset)):
        try:
            ordenados = sorted(valor)
        except TypeError:
            return SEM_JSON
        return para_json(ordenados, profundidade + 1)
    if isinstance(valor, dict):
        saida = {}
        for chave, v in valor.items():
            convertido = para_json(v, profundidade + 1)
            if convertido is SEM_JSON:
                return SEM_JSON
            saida[str(chave)] = convertido
        return saida
    return SEM_JSON


def descrever(valor):
    """{'valor': json ou None, 'repr': texto, 'json': bool} para mostrar no relatório."""
    convertido = para_json(valor)
    texto = repr(valor)
    if len(texto) > 500:
        texto = texto[:499] + '…'
    return {'valor': None if convertido is SEM_JSON else convertido, 'repr': texto, 'json': convertido is not SEM_JSON}
