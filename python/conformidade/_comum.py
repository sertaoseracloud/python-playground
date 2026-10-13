"""Ajudantes dos programas de conformidade (rodam no PySpark real e no nosso)."""
import contextlib
import io
import re

# Só os operadores que mudam a forma do plano: Project, Filter e scans variam entre o Spark e o nosso.
OPERADORES = ('HashAggregate', 'SortMergeJoin', 'BroadcastHashJoin', 'BroadcastExchange', 'Sort',
              'Window', 'InMemoryTableScan', 'BatchEvalPython', 'Exchange')


def operadores(texto):
    """Os operadores do explain(), em ordem, com o tipo de particionamento do Exchange."""
    if not isinstance(texto, str):  # um DataFrame
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            texto.explain()
        texto = saida.getvalue()
    achados = []
    for linha in texto.splitlines():
        m = re.match(r'^[\s:+\-|]*(?:\*\(\d+\)\s*)?([A-Za-z]+)(?:\s+(\w+))?', linha)
        if not m or m.group(1) not in OPERADORES:
            continue
        nome = m.group(1)
        if nome == 'Exchange':
            nome += ' ' + (m.group(2) or '')
        achados.append(nome.strip())
    return achados


def primeira_linha(erro):
    return str(erro).splitlines()[0]
