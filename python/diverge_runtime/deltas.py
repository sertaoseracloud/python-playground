"""As tabelas Delta que a execução leu ou gravou (para a correção conferir versão, operações e
colunas). Os caminhos ficam relativos à pasta do aluno."""
import os

from . import estagios

_CAMINHOS = []


def zerar():
    _CAMINHOS.clear()


def registrar(caminho):
    if caminho not in _CAMINHOS:
        _CAMINHOS.append(caminho)


def resumo():
    from delta import _log
    saida = {}
    for caminho in _CAMINHOS:
        if not _log.eh_delta(caminho):
            continue
        snap = _log.snapshot(caminho)
        operacoes = [info.get('operation') for _, info in reversed(_log.historico(caminho))]
        nome = os.path.relpath(caminho).replace('\\', '/')
        saida[nome] = {'versao': snap.versao, 'operacoes': operacoes, 'colunas': snap.schema.names}
    return saida


estagios.AO_ZERAR.append(zerar)
