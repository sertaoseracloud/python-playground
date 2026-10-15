"""Escrita e leitura no formato delta: grava os arquivos de dados (parquet simplificado) e
um commit no _delta_log; lê a foto da versão pedida (versionAsOf/timestampAsOf)."""
import datetime as dt
import os
import uuid

from diverge_runtime import relogio
from pyspark.errors import AnalysisException
from pyspark.sql import types as T
from pyspark.sql.readwriter import FileScan, _Parquet

from . import _log

MODOS = {'append': 'Append', 'overwrite': 'Overwrite', 'errorifexists': 'ErrorIfExists', 'ignore': 'Ignore'}
MOTOR = 'Apache-Spark/4.0.1 Delta-Lake/4.0.0'


def _sim(opcoes, chave):
    return str(opcoes.get(chave, '')).lower() == 'true'


def _gravar_arquivos(df, caminho, acao):
    """Uma parte por partição não vazia do DataFrame; devolve as ações add."""
    formato = _Parquet({})
    adds = []
    for linhas in df._particoes(acao):
        if not linhas:
            continue
        nome = f'part-{len(adds):05d}-{uuid.uuid4()}-c000.snappy.parquet'
        destino = os.path.join(caminho, nome)
        formato.gravar(linhas, df.columns, destino, df.schema)
        adds.append({'add': {'path': nome, 'partitionValues': {}, 'size': os.path.getsize(destino),
                             'modificationTime': relogio.em_ms(), 'dataChange': True,
                             'stats': f'{{"numRecords":{len(linhas)}}}'}})
    return adds


def _diferenca(atual, novo):
    tipos = {f.name.lower(): f.dataType for f in atual.fields}
    novas = [f for f in novo.fields if f.name.lower() not in tipos]
    conflito = [f for f in novo.fields if f.name.lower() in tipos and tipos[f.name.lower()] != f.dataType]
    return novas, conflito


def _incompativel(snap):
    return AnalysisException(
        f'A schema mismatch detected when writing to the Delta table (Table ID: {snap.id}).\n'
        'To enable schema migration using DataFrameWriter or DataStreamWriter, please set:\n'
        "'.option(\"mergeSchema\", \"true\")'.", '_LEGACY_ERROR_TEMP_DELTA_0007', {}, None)


def schema_final(snap, novo, opcoes, modo):
    if modo == 'overwrite' and _sim(opcoes, 'overwriteSchema'):
        return novo
    novas, conflito = _diferenca(snap.schema, novo)
    if conflito or (novas and not _sim(opcoes, 'mergeSchema')):
        raise _incompativel(snap)
    return T.StructType(list(snap.schema.fields) + novas)


def _metadados(schema, id_tabela=None):
    return {'metaData': {'id': id_tabela or str(uuid.uuid4()), 'format': {'provider': 'parquet', 'options': {}},
                         'schemaString': schema.simpleString(), 'partitionColumns': [], 'configuration': {},
                         'createdTime': relogio.em_ms()}}


def _commit(caminho, versao, operacao, parametros, metricas, acoes, leitura=None, cego=False):
    info = {'commitInfo': {'timestamp': relogio.em_ms(), 'operation': operacao,
                           'operationParameters': {k: str(v) for k, v in parametros.items()},
                           'readVersion': leitura, 'isolationLevel': 'Serializable', 'isBlindAppend': cego,
                           'operationMetrics': {k: str(v) for k, v in metricas.items()}, 'engineInfo': MOTOR}}
    _log.gravar_commit(caminho, versao, [info, *acoes])
    relogio.avancar(1)
    from diverge_runtime import deltas  # registro do que a execução fez (resultado devolve 'deltas')
    deltas.registrar(caminho)
    return versao


def gravar_delta(df, destino, modo, opcoes):
    with relogio.virtual():  # o current_timestamp() do DataFrame gravado lê o relógio virtual
        return _gravar_delta(df, destino, modo, opcoes)


def _gravar_delta(df, destino, modo, opcoes):
    existe = _log.eh_delta(destino)
    if existe and modo == 'ignore':
        return None
    if existe and modo == 'errorifexists':
        raise AnalysisException(f'Cannot write to already existent path file:{destino} without setting '
                                "OVERWRITE = 'true'.", 'DELTA_PATH_EXISTS', {'path': f'file:{destino}'}, '42K04')
    os.makedirs(destino, exist_ok=True)
    acoes = []
    if existe:
        snap = _log.snapshot(destino)
        schema = schema_final(snap, df.schema, opcoes, modo)
        if schema != snap.schema:
            acoes.append(_metadados(schema, snap.id))
        if modo == 'overwrite':
            acoes += [{'remove': {'path': p, 'deletionTimestamp': relogio.em_ms(), 'dataChange': True}} for p in snap.arquivos]
        versao, leitura = snap.versao + 1, snap.versao
    else:
        acoes += [{'protocol': {'minReaderVersion': 1, 'minWriterVersion': 2}}, _metadados(df.schema)]
        versao, leitura = 0, None
    adds = _gravar_arquivos(df, destino, 'save')
    linhas = sum(int(a['add']['stats'].split(':')[1][:-1]) for a in adds)
    parametros = {'mode': MODOS.get(modo, 'ErrorIfExists'), 'partitionBy': '[]'}
    metricas = {'numFiles': len(adds), 'numOutputRows': linhas}
    return _commit(destino, versao, 'WRITE', parametros, metricas, acoes + adds, leitura, cego=modo == 'append')


def reescrever(sessao, caminho, df, operacao, parametros, metricas, data_change=True):
    """Nova versão com o conteúdo inteiro de `df` (update, delete, merge, optimize)."""
    with relogio.virtual():  # um update com current_timestamp() grava o tempo do commit
        return _reescrever(sessao, caminho, df, operacao, parametros, metricas, data_change)


def _reescrever(sessao, caminho, df, operacao, parametros, metricas, data_change):
    snap = _log.snapshot(caminho)
    linhas = df._linhas(operacao.lower())  # materializa antes de trocar os arquivos
    novo = sessao.createDataFrame(linhas, snap.schema) if linhas else sessao.createDataFrame([], snap.schema)
    removes = [{'remove': {'path': p, 'deletionTimestamp': relogio.em_ms(), 'dataChange': data_change}} for p in snap.arquivos]
    adds = _gravar_arquivos(novo.coalesce(1) if operacao == 'OPTIMIZE' else novo, caminho, operacao.lower())
    for a in adds:
        a['add']['dataChange'] = data_change
    return _commit(caminho, snap.versao + 1, operacao, parametros, metricas, removes + adds, snap.versao)


def _momento(texto):
    m = dt.datetime.fromisoformat(str(texto))
    return relogio.em_ms(m if m.tzinfo else m.replace(tzinfo=dt.timezone.utc))


def ler_delta(sessao, caminho, opcoes):
    from pyspark.sql.dataframe import DataFrame
    if not _log.eh_delta(caminho):
        raise _log.nao_e_delta(caminho)
    versao = None
    if 'versionAsOf' in opcoes:
        versao = int(opcoes['versionAsOf'])
    elif 'timestampAsOf' in opcoes:
        versao = _log.versao_no_momento(caminho, _momento(opcoes['timestampAsOf']))
    snap = _log.snapshot(caminho, versao)
    arquivos = [(os.path.join(caminho, p), {}) for p in sorted(snap.arquivos)]
    no = FileScan(sessao, 'delta', arquivos, snap.schema, [], caminho, _Parquet({}))
    from diverge_runtime import deltas
    deltas.registrar(caminho)
    return DataFrame(no, sessao)
