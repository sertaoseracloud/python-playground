"""Log de transações do Delta: um arquivo JSON por versão em _delta_log, com as ações
commitInfo, protocol, metaData, add e remove. A foto (snapshot) de uma versão é o que
sobra de aplicar os commits em ordem: os arquivos adicionados e não removidos, e o schema
do último metaData."""
import json
import os

from pyspark.errors import AnalysisException
from pyspark.sql import types as T

PASTA_LOG = '_delta_log'


def _arquivo(caminho, versao):
    return os.path.join(caminho, PASTA_LOG, f'{versao:020d}.json')


def versoes(caminho):
    pasta = os.path.join(caminho, PASTA_LOG)
    if not os.path.isdir(pasta):
        return []
    return sorted(int(n[:-5]) for n in os.listdir(pasta) if n.endswith('.json') and n[:-5].isdigit())


def eh_delta(caminho):
    return bool(versoes(caminho))


def ler_commit(caminho, versao):
    with open(_arquivo(caminho, versao), encoding='utf-8') as f:
        return [json.loads(linha) for linha in f if linha.strip()]


def gravar_commit(caminho, versao, acoes):
    os.makedirs(os.path.join(caminho, PASTA_LOG), exist_ok=True)
    with open(_arquivo(caminho, versao), 'x', encoding='utf-8', newline='\n') as f:  # 'x': nunca reescreve uma versão
        for acao in acoes:
            f.write(json.dumps(acao, ensure_ascii=False, separators=(',', ':')) + '\n')


class Snapshot:
    def __init__(self, versao, schema, arquivos, id_tabela, commit):
        self.versao, self.schema, self.arquivos, self.id, self.commit = versao, schema, arquivos, id_tabela, commit
        self.timestamp_ms = commit.get('timestamp', 0)


def nao_e_delta(caminho):
    return AnalysisException(f'`{caminho}` is not a Delta table.', 'DELTA_MISSING_DELTA_TABLE',
                             {'tableName': caminho}, '42P01')


def snapshot(caminho, versao=None):
    disponiveis = versoes(caminho)
    if not disponiveis:
        raise nao_e_delta(caminho)
    if versao is None:
        versao = disponiveis[-1]
    if versao not in disponiveis:
        raise AnalysisException(f'Cannot time travel Delta table to version {versao}. '
                                f'Available versions: [{disponiveis[0]}, {disponiveis[-1]}].', 'DELTA_VERSION_NOT_FOUND',
                                {'userVersion': str(versao)}, '22003')
    arquivos, schema, id_tabela, commit = {}, T.StructType([]), '', {}
    for v in disponiveis:
        if v > versao:
            break
        for acao in ler_commit(caminho, v):
            if 'metaData' in acao:
                schema = T.ler_tipo(acao['metaData']['schemaString'])
                id_tabela = acao['metaData']['id']
            elif 'add' in acao:
                arquivos[acao['add']['path']] = acao['add']
            elif 'remove' in acao:
                arquivos.pop(acao['remove']['path'], None)
            elif 'commitInfo' in acao and v == versao:
                commit = acao['commitInfo']
    return Snapshot(versao, schema, arquivos, id_tabela, commit)


def historico(caminho):
    """[(versão, commitInfo)] da mais nova para a mais antiga, como o history() do Delta."""
    saida = []
    for v in reversed(versoes(caminho)):
        info = next((a['commitInfo'] for a in ler_commit(caminho, v) if 'commitInfo' in a), {})
        saida.append((v, info))
    return saida


def versao_no_momento(caminho, ms):
    """A última versão gravada até o momento `ms` (o timestampAsOf)."""
    escolhida = None
    for v, info in reversed(historico(caminho)):
        if info.get('timestamp', 0) <= ms:
            escolhida = v
    if escolhida is None:
        raise AnalysisException('The provided timestamp is before the earliest '
                                'version available to this table.', 'DELTA_TIMESTAMP_EARLIER_THAN_COMMIT_RETENTION', {}, '42816')
    return escolhida
