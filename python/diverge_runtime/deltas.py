"""As tabelas Delta que a execução leu ou gravou (para a correção conferir versão, operações e
colunas). Os caminhos ficam relativos à pasta do aluno."""
import json
import os

from . import estagios

_CAMINHOS = []


def zerar():
    _CAMINHOS.clear()


def registrar(caminho):
    if caminho not in _CAMINHOS:
        _CAMINHOS.append(caminho)


LIMITE_VERSOES = 20


def _linhas(snap):
    return sum(json.loads(a.get('stats') or '{}').get('numRecords', 0) for a in snap.arquivos.values())


def resumo():
    from delta import _log
    saida = {}
    for caminho in _CAMINHOS:
        if not _log.eh_delta(caminho):
            continue
        snap = _log.snapshot(caminho)
        operacoes = [info.get('operation') for _, info in reversed(_log.historico(caminho))]
        nome = os.path.relpath(caminho).replace('\\', '/')
        versoes = _log.versoes(caminho)[:LIMITE_VERSOES]
        saida[nome] = {'versao': snap.versao, 'operacoes': operacoes, 'colunas': snap.schema.names,
                       'linhasPorVersao': [_linhas(_log.snapshot(caminho, v)) for v in versoes]}
    return saida


estagios.AO_ZERAR.append(zerar)
