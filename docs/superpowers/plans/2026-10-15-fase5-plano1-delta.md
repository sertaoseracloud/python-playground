# Fase 5, plano 1: Delta Lake e relógio virtual — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O `pyspark` do DivergePython ganha o Delta Lake (`format("delta")`, `DeltaTable`, histórico,
time travel, `update`, `delete`, `merge`, schema, `vacuum` e `optimize`) sobre um relógio virtual
determinístico, conferido contra o delta-spark 4.0 real no CI.

**Architecture:**
- **Pacote `python/delta/`** (o mesmo nome do delta-spark: `from delta.tables import DeltaTable`):
  - `_log.py`: o log de transações em `_delta_log/NNNNNNNNNNNNNNNNNNNN.json`, com `commitInfo`,
    `protocol`, `metaData`, `add` e `remove`, e as fotos (`Snapshot`) de cada versão;
  - `_escrita.py`: grava os arquivos de dados no "parquet simplificado" da fase 4 e faz os commits;
  - `tables.py`: a `DeltaTable`.
- **Integração:** o `readwriter.py` repassa o formato `delta` ao pacote.
- **Tempo:** `python/diverge_runtime/relogio.py` dá o tempo dos commits. Começa em 2026-01-01
  00:00:00 UTC a cada execução e avança 1 s a cada commit.
- **Resultado da execução:** `python/diverge_runtime/deltas.py` registra as tabelas usadas, para o
  resultado devolver `deltas` (que a regra `delta` do plano 4 vai ler).

**Tech Stack:** Python 3.14 puro (CPython nos testes, Pyodide no site), pytest 8.4.2; no CI, PySpark
4.0.1 + delta-spark 4.0.0 com Java 17.

**Spec:** `python-playground/docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md`
(seções 1.1, 1.3, 2.1, 4 e 6).

## Global Constraints

- **API do Delta** (spec 1.1):
  - `df.write.format("delta").mode("append" | "overwrite").save(caminho)`, com as opções
    `mergeSchema` e `overwriteSchema`;
  - `spark.read.format("delta").load(caminho)`, com `versionAsOf` e `timestampAsOf`;
  - `DeltaTable.forPath(spark, caminho)`, com:
    - `toDF()`, `history(n=None)`, `update(condicao, {col: expr})` e `delete(condicao)`;
    - `merge(fonte, condicao)`, com `whenMatchedUpdate`, `whenMatchedUpdateAll`,
      `whenMatchedDelete`, `whenNotMatchedInsert`, `whenNotMatchedInsertAll` e `execute()`;
    - `vacuum(horas)` e `optimize().executeCompaction()`.
- **Regras do Delta:**
  - Gravar com uma coluna nova sem `mergeSchema` dá `AnalysisException`, com a mensagem do Delta.
    Com `mergeSchema`, a coluna entra, e as linhas antigas leem `null`.
  - `vacuum` abaixo de 168 horas recusa, a não ser com
    `spark.databricks.delta.retentionDurationCheck.enabled` em `false`. Só apaga arquivos removidos
    há mais tempo que a retenção, contada no relógio virtual.
  - `optimize` junta os arquivos pequenos num só, com um commit `OPTIMIZE`.
- **Relógio virtual** (spec 1.3):
  - começa em `2026-01-01 00:00:00` UTC a cada execução e só avança quando o streaming ou o Delta
    pedem;
  - o `time` e o `datetime` do aluno continuam com a hora real.
- **Python puro:** sem numpy e sem pyarrow. Os arquivos de dados são o "parquet simplificado" da fase
  4, uma linha de schema e uma linha JSON por registro, que só o DivergePython lê.
- **Erros:** os nomes de exceção e o começo das mensagens imitam o Delta real. A conformidade compara
  o que é estável (ver a Task 7).
- **Commits:** autor via
  `git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit`, e a mensagem
  termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Publicação:** push, PR, tag e release só com o "sim". O PR em rascunho da Task 7 também precisa
  do "sim".
- **Ferramentas:**
  - pytest com `python -m pytest python/tests/<arquivo> -q -p no:randomly`, lido pelo arquivo de
    saída (o rtk esconde a saída do pytest);
  - vitest com `rtk proxy npx vitest run …`;
  - eslint com `-f json -o $TEMP/lint.json`.
- **Branch:** `fase5`, a partir do branch `cenarios` (que sai junto na 0.5.0).

## Review Focus

1. **Ler uma tabela Delta antiga depois de uma evolução de schema:** as linhas antigas mostram
   `null` na coluna nova, e o `show()` não quebra. O teste fica na Task 2,
   `test_merge_schema_linhas_antigas_nulas`.
2. **Duas linhas da fonte casando com a mesma linha do destino no `merge`:** dá o erro do Delta
   (`DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE`), em vez de duplicar em silêncio. O teste
   fica na Task 4.
3. **`versionAsOf` de uma versão que não existe:** dá o erro com as versões disponíveis. O teste fica
   na Task 2.
4. **`DeltaTable.forPath` numa pasta que não é Delta** (um CSV gravado antes): dá o erro "is not a
   Delta table". O teste fica na Task 3.
5. **Tabela Delta vazia** (`delete` de tudo, ou gravar um DataFrame vazio): `count()` dá 0, e o
   `show()` mostra só o cabeçalho. O teste fica na Task 3.

---

### Task 1: Relógio virtual e `IllegalArgumentException`

**Files:**
- Create: `python/diverge_runtime/relogio.py`
- Modify: `python/pyspark/errors/__init__.py`, que ganha `IllegalArgumentException` depois de
  `AnalysisException`
- Test: `python/tests/test_delta.py` (novo; recebe também os testes das Tasks 2 a 5)

**Interfaces:**
- Produces:
  - `relogio.INICIO`: um `datetime` UTC, em 2026-01-01 00:00;
  - `relogio.zerar()`;
  - `relogio.agora() -> datetime` (UTC, *aware*);
  - `relogio.avancar(segundos) -> datetime`;
  - `relogio.em_ms(momento=None) -> int`;
  - o `zerar` é registrado em `estagios.AO_ZERAR`;
  - `pyspark.errors.IllegalArgumentException(PySparkException, ValueError)`.

- [ ] **Step 1: Teste que falha**

`python/tests/test_delta.py`:

```python
"""Delta Lake do DivergePython: log de transações, versões, time travel, update/delete/merge,
schema, vacuum e optimize, sobre o relógio virtual."""
import datetime as dt
import json
import os

import pytest

from diverge_runtime import estagios, relogio
from pyspark.errors import AnalysisException, IllegalArgumentException
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def tuplas(df, *ordem):
    return [tuple(r) for r in (df.orderBy(*ordem) if ordem else df).collect()]


def test_relogio_comeca_em_2026_e_so_anda_quando_pedem():
    relogio.avancar(5)
    estagios.zerar()  # cada execução começa do zero
    assert relogio.agora() == dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    assert relogio.avancar(90) == dt.datetime(2026, 1, 1, 0, 1, 30, tzinfo=dt.timezone.utc)
    assert relogio.em_ms() == relogio.em_ms(relogio.agora())
    assert relogio.em_ms(relogio.INICIO) == 1767225600000


def test_illegal_argument_exception():
    with pytest.raises(ValueError):
        raise IllegalArgumentException('requirement failed')
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest python/tests/test_delta.py -q > $TEMP/pt.txt 2>&1; tail -5 $TEMP/pt.txt`
Expected: um erro de coleta, `ImportError: cannot import name 'relogio'`.

- [ ] **Step 3: Implementar**

`python/diverge_runtime/relogio.py`:

```python
"""Relógio virtual do streaming e do Delta Lake.

Cada execução começa em 2026-01-01 00:00:00 UTC, e o tempo só anda quando o streaming ou o
Delta pedem (cada commit do Delta avança 1 s). Assim o histórico, o time travel e as janelas
dão sempre o mesmo resultado. O time e o datetime do aluno continuam com a hora real."""
import datetime as _dt

from . import estagios

INICIO = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)
_EPOCA = _dt.datetime(1970, 1, 1, tzinfo=_dt.timezone.utc)
_agora = INICIO


def zerar():
    global _agora
    _agora = INICIO


def agora():
    return _agora


def avancar(segundos):
    global _agora
    _agora += _dt.timedelta(seconds=segundos)
    return _agora


def em_ms(momento=None):
    """Milissegundos desde 1970 (o formato dos timestamps do log do Delta)."""
    return int(((momento or _agora) - _EPOCA).total_seconds() * 1000)


estagios.AO_ZERAR.append(zerar)
```

Em `python/pyspark/errors/__init__.py`, depois da classe `AnalysisException`:

```python
class IllegalArgumentException(PySparkException, ValueError):
    """Argumento inválido (o vacuum com retenção curta, por exemplo)."""
```

- [ ] **Step 4: Rodar e ver passar** (o mesmo comando). Expected: `2 passed`.

- [ ] **Step 5: Commit**: "Relógio virtual do streaming e do Delta, e IllegalArgumentException".

### Task 2: Log de transações, escrita e leitura em delta

**Files:**
- Create: `python/delta/__init__.py`, `python/delta/_log.py` e `python/delta/_escrita.py`
- Modify: `python/pyspark/sql/readwriter.py`
  - `DataFrameWriter.save`: logo depois das opções, `if self._formato.lower() == 'delta': return gravar_delta(...)`;
  - `DataFrameReader._ler`: o desvio para `ler_delta` quando o formato é `delta`.
- Test: `python/tests/test_delta.py`

**Interfaces:**
- Consumes: `relogio.agora()`, `relogio.em_ms()` e `relogio.avancar(1)` da Task 1; `_Parquet`,
  `FileScan` e `T.ler_tipo` do `readwriter`/`types`.
- Produces:
  - `delta._log`:
    - `eh_delta(caminho) -> bool` e `versoes(caminho) -> list[int]`;
    - `snapshot(caminho, versao=None) -> Snapshot`, com `versao`, `schema` (StructType),
      `arquivos` (dict caminho → ação `add`), `id`, `timestamp_ms` e `commit` (o `commitInfo`);
    - `historico(caminho) -> list[(versao, commitInfo)]`;
    - `versao_no_momento(caminho, ms) -> int`;
    - `gravar_commit(caminho, versao, acoes)`.
  - `delta._escrita`:
    - `gravar_delta(df, destino, modo, opcoes)`;
    - `reescrever(sessao, caminho, df, operacao, parametros, metricas, data_change=True) -> int`
      (a versão nova);
    - `ler_delta(sessao, caminho, opcoes) -> DataFrame`.
  - `delta.configure_spark_with_delta_pip(builder, extra_packages=None) -> builder` (aqui não faz
    nada; existe para o mesmo programa rodar no Delta real).

- [ ] **Step 1: Testes que falham** (acrescentar ao `test_delta.py`)

```python
ESTOQUE = [('arroz', 10, 24.9), ('feijao', 4, 8.5), ('cafe', 7, 19.9)]


def estoque(spark, linhas=ESTOQUE):
    return spark.createDataFrame(linhas, ['produto', 'qtd', 'preco'])


def test_gravar_e_ler_delta_com_log(spark):
    estoque(spark).write.format('delta').save('estoque')
    assert sorted(os.listdir('estoque/_delta_log')) == ['00000000000000000000.json']
    acoes = [json.loads(l) for l in open('estoque/_delta_log/00000000000000000000.json', encoding='utf-8')]
    tipos = [next(iter(a)) for a in acoes]
    assert tipos[:3] == ['commitInfo', 'protocol', 'metaData'] and 'add' in tipos
    info = acoes[0]['commitInfo']
    assert info['operation'] == 'WRITE' and info['operationParameters']['mode'] == 'ErrorIfExists'
    assert info['timestamp'] == relogio.em_ms(relogio.INICIO)
    df = spark.read.format('delta').load('estoque')
    assert df.dtypes == [('produto', 'string'), ('qtd', 'bigint'), ('preco', 'double')]
    assert tuplas(df, 'produto') == sorted(ESTOQUE)


def test_append_cria_versoes_e_time_travel(spark):
    estoque(spark).write.format('delta').save('estoque')
    estoque(spark, [('milho', 3, 5.0)]).write.format('delta').mode('append').save('estoque')
    estoque(spark, [('sal', 1, 2.0)]).write.format('delta').mode('overwrite').save('estoque')
    assert spark.read.format('delta').load('estoque').count() == 1
    assert spark.read.format('delta').option('versionAsOf', 0).load('estoque').count() == 3
    assert spark.read.format('delta').option('versionAsOf', 1).load('estoque').count() == 4
    # 1 s por commit: a versão 1 foi gravada às 00:00:01
    assert spark.read.format('delta').option('timestampAsOf', '2026-01-01 00:00:01').load('estoque').count() == 4
    with pytest.raises(AnalysisException, match=r'Cannot time travel Delta table to version 7\. Available versions: \[0, 2\]'):
        spark.read.format('delta').option('versionAsOf', 7).load('estoque')
    with pytest.raises(AnalysisException, match='before the earliest version'):
        spark.read.format('delta').option('timestampAsOf', '2025-12-31 23:00:00').load('estoque')


def test_modos(spark):
    estoque(spark).write.format('delta').save('estoque')
    with pytest.raises(AnalysisException, match='already exists'):
        estoque(spark).write.format('delta').save('estoque')
    estoque(spark).write.format('delta').mode('ignore').save('estoque')
    assert spark.read.format('delta').load('estoque').count() == 3
    assert len(os.listdir('estoque/_delta_log')) == 1


def test_coluna_nova_sem_merge_schema_e_recusada(spark):
    estoque(spark).write.format('delta').save('estoque')
    novo = spark.createDataFrame([('sal', 1, 2.0, 'Crato')], ['produto', 'qtd', 'preco', 'cidade'])
    with pytest.raises(AnalysisException, match='A schema mismatch detected when writing to the Delta table'):
        novo.write.format('delta').mode('append').save('estoque')
    assert len(os.listdir('estoque/_delta_log')) == 1


def test_merge_schema_linhas_antigas_nulas(spark):
    estoque(spark).write.format('delta').save('estoque')
    novo = spark.createDataFrame([('sal', 1, 2.0, 'Crato')], ['produto', 'qtd', 'preco', 'cidade'])
    novo.write.format('delta').mode('append').option('mergeSchema', 'true').save('estoque')
    df = spark.read.format('delta').load('estoque')
    assert df.columns == ['produto', 'qtd', 'preco', 'cidade']
    assert tuplas(df.select('produto', 'cidade'), 'produto') == [('arroz', None), ('cafe', None), ('feijao', None), ('sal', 'Crato')]
    df.show()  # não quebra com nulos de arquivos antigos


def test_overwrite_schema(spark):
    estoque(spark).write.format('delta').save('estoque')
    outro = spark.createDataFrame([(1, 'x')], ['id', 'nome'])
    with pytest.raises(AnalysisException, match='schema mismatch'):
        outro.write.format('delta').mode('overwrite').save('estoque')
    outro.write.format('delta').mode('overwrite').option('overwriteSchema', 'true').save('estoque')
    assert spark.read.format('delta').load('estoque').dtypes == [('id', 'bigint'), ('nome', 'string')]


def test_delta_vazio_e_configure(spark):
    from delta import configure_spark_with_delta_pip
    assert configure_spark_with_delta_pip(SparkSession.builder) is SparkSession.builder
    spark.createDataFrame([], 'produto STRING, qtd BIGINT').write.format('delta').save('vazio')
    df = spark.read.format('delta').load('vazio')
    assert df.count() == 0 and df.columns == ['produto', 'qtd']
```

- [ ] **Step 2: Rodar e ver falhar**: `ModuleNotFoundError: No module named 'delta'`, ou
  `Failed to find the data source: delta`.

- [ ] **Step 3: Implementar `python/delta/__init__.py`**

```python
"""Delta Lake do DivergePython: tabelas com versões sobre o pyspark daqui (python/delta).

A API segue o delta-spark (from delta.tables import DeltaTable); o log de transações fica em
<tabela>/_delta_log, como no Delta real. Os arquivos de dados usam o parquet simplificado do
DivergePython (só este site lê)."""


def configure_spark_with_delta_pip(spark_session_builder, extra_packages=None):
    """No Delta real, baixa os jars; aqui o Delta já vem junto, então só devolve o builder."""
    return spark_session_builder
```

- [ ] **Step 4: Implementar `python/delta/_log.py`**

```python
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
    return AnalysisException(f'[DELTA_MISSING_DELTA_TABLE] `{caminho}` is not a Delta table.', 'DELTA_MISSING_DELTA_TABLE',
                             {'tableName': caminho}, '42P01')


def snapshot(caminho, versao=None):
    disponiveis = versoes(caminho)
    if not disponiveis:
        raise nao_e_delta(caminho)
    if versao is None:
        versao = disponiveis[-1]
    if versao not in disponiveis:
        raise AnalysisException(f'[DELTA_VERSION_NOT_FOUND] Cannot time travel Delta table to version {versao}. '
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
        raise AnalysisException('[DELTA_TIMESTAMP_EARLIER_THAN_COMMIT_RETENTION] The provided timestamp is before the earliest '
                                'version available to this table.', 'DELTA_TIMESTAMP_EARLIER_THAN_COMMIT_RETENTION', {}, '42816')
    return escolhida
```

- [ ] **Step 5: Implementar `python/delta/_escrita.py`**

```python
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
        f'[_LEGACY_ERROR_TEMP_DELTA_0007] A schema mismatch detected when writing to the Delta table (Table ID: {snap.id}).\n'
        'To enable schema migration using DataFrameWriter or DataStreamWriter, please set:\n'
        "'.option(\"mergeSchema\", \"true\")'.", '_LEGACY_ERROR_TEMP_DELTA_0007', {}, None)


def schema_final(snap, novo, opcoes, modo):
    if modo == 'overwrite' and _sim(opcoes, 'overwriteSchema'):
        return novo
    novas, conflito = _diferenca(snap.schema, novo)
    if conflito or (novas and not _sim(opcoes, 'mergeSchema')):
        raise _incompativel(snap)
    if modo == 'overwrite' and not _sim(opcoes, 'mergeSchema') and len(novo.fields) != len(snap.schema.fields):
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
    existe = _log.eh_delta(destino)
    if existe and modo == 'ignore':
        return None
    if existe and modo == 'errorifexists':
        raise AnalysisException(f'[DELTA_PATH_EXISTS] Cannot write to already existent path file:{destino} without setting '
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
```

Observações para quem implementa:
- `ler_delta` registra a tabela no `diverge_runtime.deltas` (Task 6). Até a Task 6 existir, crie já
  o arquivo mínimo da Task 6, Step 3, ou deixe as duas importações para a Task 6 e rode estes
  testes sem elas. A ordem recomendada é fazer a Task 6, Step 3, aqui.
- `reescrever` usa `df._linhas(acao)` (que já existe no `DataFrame`). Se `createDataFrame` com
  `StructType` reclamar de tipos, converta as linhas com `tuple(r)`.
- O `T.ler_tipo` lê o `simpleString()` (`struct<produto:string,qtd:bigint,...>`).

- [ ] **Step 6: Ligar no `readwriter.py`**
  - **`DataFrameWriter.save`:** depois de `self.options(...)` e antes de `formato = _formato(...)`:

```python
        if self._formato.lower() == 'delta':
            from delta._escrita import gravar_delta
            return gravar_delta(self._df, os.path.abspath(path), self._modo, self._opcoes)
```

  - **`DataFrameReader._ler`:** no começo:

```python
        if self._formato.lower() == 'delta':
            from delta._escrita import ler_delta
            return ler_delta(self._sessao, os.path.abspath(caminho), self._opcoes)
```

- [ ] **Step 7:** rodar e ver passar (`python -m pytest python/tests/test_delta.py -q`), depois a
  suíte Python inteira (`python -m pytest python/tests -q`), que deve seguir verde. Commit
  "Delta Lake: log de transações, escrita e leitura com versões e schema".

### Task 3: `DeltaTable`: `forPath`, `toDF`, `history`, `update` e `delete`

**Files:** criar `python/delta/tables.py`; teste em `python/tests/test_delta.py`.

**Interfaces:**
- Consumes: `_log.eh_delta`, `_log.snapshot`, `_log.historico`, `_log.nao_e_delta` e
  `_escrita.reescrever` (Task 2).
- Produces:
  - `DeltaTable.forPath(spark, path)` e `DeltaTable.isDeltaTable(spark, path)`;
  - os métodos `.toDF()`, `.alias(nome)`, `.history(limit=None)`, `.update(condition=None, set=None)`
    e `.delete(condition=None)`;
  - `DeltaTable._sessao` e `DeltaTable._caminho`, que as Tasks 4 e 5 usam.

- [ ] **Step 1: Testes que falham**

```python
def tabela(spark):
    from delta.tables import DeltaTable
    estoque(spark).write.format('delta').save('estoque')
    return DeltaTable.forPath(spark, 'estoque')


def test_for_path_de_pasta_que_nao_e_delta(spark):
    from delta.tables import DeltaTable
    estoque(spark).write.csv('csv')
    with pytest.raises(AnalysisException, match='is not a Delta table'):
        DeltaTable.forPath(spark, 'csv')
    assert DeltaTable.isDeltaTable(spark, 'csv') is False


def test_history_colunas_ordem_e_operacoes(spark):
    t = tabela(spark)
    estoque(spark, [('sal', 1, 2.0)]).write.format('delta').mode('append').save('estoque')
    h = t.history()
    assert h.columns == ['version', 'timestamp', 'userId', 'userName', 'operation', 'operationParameters', 'job', 'notebook',
                         'clusterId', 'readVersion', 'isolationLevel', 'isBlindAppend', 'operationMetrics', 'userMetadata', 'engineInfo']
    linhas = h.select('version', 'operation', 'operationParameters').collect()
    assert [(r.version, r.operation, r.operationParameters['mode']) for r in linhas] == [(1, 'WRITE', 'Append'), (0, 'WRITE', 'ErrorIfExists')]
    assert t.history(1).count() == 1
    assert h.first().timestamp == dt.datetime(2026, 1, 1, 0, 0, 1)


def test_update_e_delete(spark):
    t = tabela(spark)
    t.update('produto = "cafe"', {'preco': 'preco * 2'})
    t.update(F.col('qtd') < 5, {'qtd': F.lit(5)})
    t.delete('produto = "arroz"')
    assert tuplas(t.toDF(), 'produto') == [('cafe', 7, 39.8), ('feijao', 5, 8.5)]
    ops = [r.operation for r in t.history().collect()]
    assert ops == ['DELETE', 'UPDATE', 'UPDATE', 'WRITE']
    assert t.history().filter('version = 3').first().operationMetrics['numDeletedRows'] == '1'
    # o passado continua lá
    assert spark.read.format('delta').option('versionAsOf', 0).load('estoque').count() == 3


def test_delete_de_tudo_deixa_a_tabela_vazia(spark):
    t = tabela(spark)
    t.delete()
    df = t.toDF()
    assert df.count() == 0 and df.columns == ['produto', 'qtd', 'preco']
    df.show()
```

- [ ] **Step 2:** rodar e ver falhar (`No module named 'delta.tables'`).

- [ ] **Step 3: Implementar `python/delta/tables.py`**

```python
"""DeltaTable: a tabela Delta como objeto (histórico, update, delete, merge, vacuum, optimize),
com a mesma API do delta-spark."""
import os

from pyspark.sql import Column
from pyspark.sql import functions as F
from pyspark.sql import types as T

from . import _escrita, _log

COLUNAS_HISTORICO = ('version BIGINT, timestamp TIMESTAMP, userId STRING, userName STRING, operation STRING, '
                     'operationParameters MAP<STRING,STRING>, job STRING, notebook STRING, clusterId STRING, '
                     'readVersion BIGINT, isolationLevel STRING, isBlindAppend BOOLEAN, '
                     'operationMetrics MAP<STRING,STRING>, userMetadata STRING, engineInfo STRING')


def _coluna(valor):
    return valor if isinstance(valor, Column) else F.expr(str(valor))


def _predicado(condicao):
    """O predicate do histórico: '[]' sem condição; senão a condição entre parênteses."""
    return '[]' if condicao is None else f'["({condicao})"]'


class DeltaTable:
    def __init__(self, sessao, caminho, apelido=None):
        self._sessao, self._caminho, self._apelido = sessao, caminho, apelido

    @classmethod
    def forPath(cls, sparkSession, path, hadoopConf=None):
        caminho = os.path.abspath(path)
        if not _log.eh_delta(caminho):
            raise _log.nao_e_delta(path)
        return cls(sparkSession, caminho)

    @classmethod
    def isDeltaTable(cls, sparkSession, identifier):
        return _log.eh_delta(os.path.abspath(identifier))

    def alias(self, aliasName):
        return DeltaTable(self._sessao, self._caminho, aliasName)

    def toDF(self):
        df = self._sessao.read.format('delta').load(self._caminho)
        return df.alias(self._apelido) if self._apelido else df

    def history(self, limit=None):
        import datetime as dt
        linhas = []
        for versao, info in _log.historico(self._caminho)[:limit]:
            momento = dt.datetime.fromtimestamp(info.get('timestamp', 0) / 1000, dt.timezone.utc).replace(tzinfo=None)
            linhas.append((versao, momento, None, None, info.get('operation'), info.get('operationParameters', {}), None, None,
                           None, info.get('readVersion'), info.get('isolationLevel'), info.get('isBlindAppend'),
                           info.get('operationMetrics', {}), None, info.get('engineInfo')))
        return self._sessao.createDataFrame(linhas, COLUNAS_HISTORICO)

    def update(self, condition=None, set=None):  # noqa: A002 — o nome é o da API do Delta
        df = self.toDF()
        cond = F.lit(True) if condition is None else _coluna(condition)
        alvo = F.coalesce(cond, F.lit(False))
        novas = [F.when(alvo, _coluna(set[c])).otherwise(F.col(c)).alias(c) if c in set else F.col(c) for c in df.columns]
        n = df.filter(alvo).count()
        _escrita.reescrever(self._sessao, self._caminho, df.select(*novas), 'UPDATE', {'predicate': _predicado(condition)},
                            {'numUpdatedRows': n, 'numCopiedRows': df.count() - n})

    def delete(self, condition=None):
        df = self.toDF()
        alvo = F.lit(True) if condition is None else F.coalesce(_coluna(condition), F.lit(False))
        n = df.filter(alvo).count()
        _escrita.reescrever(self._sessao, self._caminho, df.filter(~alvo), 'DELETE',
                            {'predicate': _predicado(condition)}, {'numDeletedRows': n})
```

Ao implementar:
- Se `MAP<STRING,STRING>` não for aceito pelo `createDataFrame` com dicionários, ajuste o
  `types.conferir` para aceitar `dict` em `MapType`. É o que o Spark faz.
- **`history` com `limit`:** `_log.historico` já vem da versão mais nova para a mais antiga, e
  `[:None]` devolve tudo.

- [ ] **Step 4:** rodar e ver passar; a suíte Python segue verde. Commit "Delta Lake: DeltaTable
  com history, update e delete".

### Task 4: `merge`

**Files:** alterar `python/delta/tables.py` (`merge` e o construtor `DeltaMergeBuilder`); teste em
`python/tests/test_delta.py`.

**Interfaces:**
- Consumes: `DeltaTable._sessao`, `DeltaTable._caminho` e `DeltaTable._apelido` (Task 3);
  `_escrita.reescrever` (Task 2).
- Produces:
  - `DeltaTable.merge(source, condition) -> DeltaMergeBuilder`, com:
    - `whenMatchedUpdate(condition=None, set=…)`, `whenMatchedUpdateAll(condition=None)` e
      `whenMatchedDelete(condition=None)`;
    - `whenNotMatchedInsert(condition=None, values=…)` e `whenNotMatchedInsertAll(condition=None)`;
    - `.execute()`.

- [ ] **Step 1: Testes que falham**

```python
def test_merge_upsert_do_estoque(spark):
    t = tabela(spark)
    dia = spark.createDataFrame([('cafe', 9, 21.0), ('milho', 3, 5.0)], ['produto', 'qtd', 'preco'])
    (t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto')
      .whenMatchedUpdate(set={'qtd': 'e.qtd + d.qtd', 'preco': 'd.preco'})
      .whenNotMatchedInsertAll()
      .execute())
    assert tuplas(t.toDF(), 'produto') == [('arroz', 10, 24.9), ('cafe', 16, 21.0), ('feijao', 4, 8.5), ('milho', 3, 5.0)]
    h = t.history(1).first()
    assert h.operation == 'MERGE'
    assert h.operationMetrics['numTargetRowsUpdated'] == '1' and h.operationMetrics['numTargetRowsInserted'] == '1'


def test_merge_com_condicao_delete_e_insert_seletivo(spark):
    t = tabela(spark)
    dia = spark.createDataFrame([('feijao', 0, 8.5), ('arroz', 2, 25.0), ('sal', 0, 2.0)], ['produto', 'qtd', 'preco'])
    (t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto')
      .whenMatchedDelete(condition='d.qtd = 0')
      .whenMatchedUpdateAll()
      .whenNotMatchedInsert(condition='d.qtd > 0', values={'produto': 'd.produto', 'qtd': 'd.qtd', 'preco': 'd.preco'})
      .execute())
    assert tuplas(t.toDF(), 'produto') == [('arroz', 2, 25.0), ('cafe', 7, 19.9)]


def test_merge_com_duas_linhas_da_fonte_para_o_mesmo_alvo_e_erro(spark):
    t = tabela(spark)
    dia = spark.createDataFrame([('cafe', 1, 1.0), ('cafe', 2, 2.0)], ['produto', 'qtd', 'preco'])
    with pytest.raises(Exception, match='DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE'):
        t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto').whenMatchedUpdateAll().execute()
    assert t.history(1).first().operation == 'WRITE'  # nada foi gravado
```

- [ ] **Step 2:** rodar e ver falhar (`'DeltaTable' object has no attribute 'merge'`).

- [ ] **Step 3: Implementar.**
  - **Junção:**
    - `alvo = self.toDF()`, com o índice de cada linha (`__alvo_i`, por `zipWithIndex` sobre o
      `rdd` e `createDataFrame`) e o apelido do destino;
    - `fonte = source`, com `__fonte_i` e o apelido dela;
    - `j = alvo.join(fonte, F.expr(condition), 'full_outer')`.
  - **Colunas auxiliares em `j`:** para cada cláusula `k`, `__c{k}` (a condição da cláusula, ou
    `lit(True)`, com `coalesce(…, False)`) e, para cada coluna de destino, o valor que ela recebe
    (`__v{k}_{coluna}`). No `UpdateAll` e no `InsertAll`, o valor é a coluna de mesmo nome da fonte
    (`F.col(f'{apelido_fonte}.{c}')`).
  - **Montagem**, no processo principal, com as linhas de `j` coletadas:
    - **casada** (os dois índices preenchidos): se o mesmo `__alvo_i` aparece em mais de uma linha
      casada e há cláusula de `matched`, dá o erro abaixo. Senão, a 1ª cláusula `matched` cuja
      condição vale decide: atualizar (os valores dela), apagar (a linha some) ou nenhuma (fica como
      estava);
    - **só no destino:** fica como está;
    - **só na fonte:** a 1ª cláusula `notMatched` cuja condição vale insere os valores dela; sem
      nenhuma, nada.
  - **Erro de várias linhas da fonte para o mesmo destino:**
    `pyspark.errors.SparkRuntimeException('[DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE] Cannot perform Merge as multiple source rows matched and attempted to modify the same target row in the Delta table in possibly conflicting ways.', 'DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE', {}, '21506')`.
  - **Gravação:** `_escrita.reescrever(..., 'MERGE', {'predicate': f'["({condition})"]', 'matchedPredicates': ..., 'notMatchedPredicates': ...}, {'numTargetRowsUpdated': u, 'numTargetRowsDeleted': d, 'numTargetRowsInserted': i, 'numSourceRows': n})`,
    com o DataFrame novo criado por `createDataFrame(linhas, snap.schema)`.
- [ ] **Step 4:** rodar e ver passar; commit "Delta Lake: merge (upsert) com cláusulas condicionais".

### Task 5: `vacuum` e `optimize`

**Files:** alterar `python/delta/tables.py`; teste em `python/tests/test_delta.py`.

**Interfaces:**
- Consumes: `_log.snapshot`, `_log.ler_commit`, `_log.versoes`, `relogio.agora()` e
  `_escrita.reescrever`.
- Produces:
  - `DeltaTable.vacuum(retentionHours=None) -> DataFrame`, vazio, com a coluna `path`;
  - `DeltaTable.optimize() -> DeltaOptimizeBuilder`, com `.executeCompaction() -> DataFrame` (as
    colunas `path`, `numFilesAdded` e `numFilesRemoved`).

- [ ] **Step 1: Testes que falham**

```python
def arquivos_de_dados(caminho):
    return sorted(n for n in os.listdir(caminho) if n.endswith('.parquet'))


def test_vacuum_recusa_retencao_curta_e_apaga_so_os_removidos(spark):
    t = tabela(spark)
    estoque(spark, [('sal', 1, 2.0)]).write.format('delta').mode('overwrite').save('estoque')
    antes = arquivos_de_dados('estoque')
    with pytest.raises(IllegalArgumentException, match='retention'):
        t.vacuum(0)
    spark.conf.set('spark.databricks.delta.retentionDurationCheck.enabled', 'false')
    t.vacuum(1)  # removidos há menos de 1 h no relógio virtual: ficam
    assert arquivos_de_dados('estoque') == antes
    relogio.avancar(2 * 3600)
    t.vacuum(1)
    depois = arquivos_de_dados('estoque')
    assert len(depois) == len(_snapshot_arquivos('estoque')) < len(antes)
    assert t.toDF().count() == 1
    assert [r.operation for r in t.history(2).collect()] == ['VACUUM END', 'VACUUM START']


def _snapshot_arquivos(caminho):
    from delta import _log
    return _log.snapshot(os.path.abspath(caminho)).arquivos


def test_optimize_junta_arquivos_pequenos(spark):
    t = tabela(spark)
    for i in range(3):
        estoque(spark, [(f'p{i}', i, 1.0)]).write.format('delta').mode('append').save('estoque')
    assert len(_snapshot_arquivos('estoque')) > 1
    r = t.optimize().executeCompaction()
    assert r.first().numFilesAdded == 1
    assert len(_snapshot_arquivos('estoque')) == 1
    assert t.toDF().count() == 6
    h = t.history(1).first()
    assert h.operation == 'OPTIMIZE'
    assert spark.read.format('delta').option('versionAsOf', h.version - 1).load('estoque').count() == 6
```

- [ ] **Step 2:** rodar e ver falhar.

- [ ] **Step 3: Implementar.**
  - **`vacuum(retentionHours=None)`:**
    - `horas = 168 if retentionHours is None else retentionHours`;
    - se `horas < 168` e `spark.conf.get('spark.databricks.delta.retentionDurationCheck.enabled', 'true') != 'false'`,
      lance
      `IllegalArgumentException('requirement failed: Are you sure you would like to vacuum files with such a low retention period? If you have\nwriters that are currently writing to this table, there is a risk that you may corrupt the\nstate of your Delta table.\n\nIf you are certain that there are no operations being performed on this table, such as\ninsert/upsert/delete/optimize, then you may turn off this check by setting:\nspark.databricks.delta.retentionDurationCheck.enabled = false', 'DELTA_VACUUM_RETENTION_PERIOD_TOO_SMALL', {}, None)`;
    - **candidatos:** os arquivos `*.parquet` da pasta que não estão na foto atual;
    - o momento da remoção de cada um é o maior `deletionTimestamp` dos `remove` no log; arquivos
      nunca removidos (órfãos) usam `0`;
    - apaga os que têm `agora_ms - removido_ms >= horas * 3600 * 1000`;
    - grava dois commits sem dados: `VACUUM START` (`{'retentionCheckEnabled': …, 'defaultRetentionMillis': 604800000, 'specifiedRetentionMillis': …}` / `{'numFilesToDelete': n}`)
      e `VACUUM END` (`{'status': 'COMPLETED'}` / `{'numDeletedFiles': n}`); para isso,
      `_escrita._commit` com `acoes=[]`;
    - devolve `createDataFrame([], 'path STRING')`.
  - **`optimize().executeCompaction()`:**
    - com 1 arquivo ou menos na foto, não grava nada e devolve uma linha com `numFilesAdded = 0`;
    - senão, chama `reescrever(…, 'OPTIMIZE', {'predicate': '[]', 'auto': 'false', 'clusterBy': '[]', 'zOrderBy': '[]'}, {'numAddedFiles': 1, 'numRemovedFiles': n}, data_change=False)`,
      que grava uma partição só (o `coalesce(1)` já está no `reescrever`);
    - devolve `createDataFrame([(caminho, 1, n)], 'path STRING, numFilesAdded BIGINT, numFilesRemoved BIGINT')`.
- [ ] **Step 4:** rodar e ver passar; commit "Delta Lake: vacuum com retenção e optimize".

### Task 6: `deltas` no resultado da execução (e o Delta no Pyodide)

**Files:**
- Create: `python/diverge_runtime/deltas.py`
- Modify: `python/diverge_runtime/execucao.py`, onde o `return` do `executar` ganha
  `'deltas': deltas.resumo()`
- Test: `python/tests/test_runtime.py` (um teste novo) e `tests/spark.test.js` (um teste novo, no
  Pyodide)

**Interfaces:**
- Produces:
  - `deltas.registrar(caminho_absoluto)`;
  - `deltas.zerar()` (em `AO_ZERAR`);
  - `deltas.resumo() -> { caminhoRelativo: { versao: int, operacoes: [str] (da mais antiga para a mais nova), colunas: [str] } }`;
  - o resultado de `executar` ganha `deltas`.

- [ ] **Step 1: Testes que falham**

Em `python/tests/test_runtime.py`, seguindo o estilo dos testes de `executar` que já estão lá:

```python
def test_deltas_no_resultado():
    codigo = ('from pyspark.sql import SparkSession\nfrom delta.tables import DeltaTable\n'
              'spark = SparkSession.builder.getOrCreate()\n'
              'spark.createDataFrame([("a", 1)], ["p", "q"]).write.format("delta").save("dados/estoque")\n'
              'DeltaTable.forPath(spark, "dados/estoque").delete("q = 1")\n')
    r = executar({'main.py': codigo})
    assert r['erro'] is None
    assert r['deltas'] == {'dados/estoque': {'versao': 1, 'operacoes': ['WRITE', 'DELETE'], 'colunas': ['p', 'q']}}
```

Em `tests/spark.test.js`:

```js
  it('o Delta roda no Pyodide e o resultado traz as tabelas', async () => {
    const r = await rodar(`${INICIO}from delta.tables import DeltaTable\n`
      + 'spark.createDataFrame([("a", 1)], ["p", "q"]).write.format("delta").save("estoque")\n'
      + 'DeltaTable.forPath(spark, "estoque").update("q = 1", {"q": "q + 1"})\n'
      + 'v0 = spark.read.format("delta").option("versionAsOf", 0).load("estoque").first().q\n');
    expect(r.erro).toBeNull();
    expect(r.variaveis.v0).toBe(1);
    expect(r.deltas.estoque).toEqual({ versao: 1, operacoes: ['WRITE', 'UPDATE'], colunas: ['p', 'q'] });
  }, 120_000);
```

- [ ] **Step 2:** rodar e ver falhar (falta `deltas` no resultado).

- [ ] **Step 3: `python/diverge_runtime/deltas.py`**

```python
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
```

O `resumo()` roda no fim do `executar`, ainda com o diretório na pasta do aluno. No `execucao.py`,
chame o `deltas.resumo()` **antes** de `os.chdir(antigo_cwd)`: guarde-o numa variável dentro do
`try`, depois de `_tabelas`, e use essa variável no `return`.

- [ ] **Step 4:** rodar o `test_runtime.py`, o `spark.test.js` e a suíte inteira (pytest e
  vitest), e ver passar; commit "Runtime: tabelas Delta no resultado da execução".

### Task 7: Conformidade com o delta-spark real

**Files:**
- Modify: `python/conformidade/_comum.py` (`sessao_delta()`)
- Create: `python/conformidade/c11_delta.py` e `python/conformidade/c11.esperado`
- Modify: `python/tests/test_conformidade.py` (o total passa a 11) e
  `.github/workflows/pages.yml` (`pip install pyspark==4.0.1 delta-spark==4.0.0`)

- [ ] **Step 1: `sessao_delta()`** em `_comum.py`:

```python
def sessao_delta():
    """Sessão com o Delta: no PySpark real, as extensões e os jars do delta-spark; aqui, a mesma sessão."""
    from delta import configure_spark_with_delta_pip
    from pyspark.sql import SparkSession
    construtor = (SparkSession.builder.master('local[4]').appName('conformidade')
                  .config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension')
                  .config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog')
                  .config('spark.sql.shuffle.partitions', '4')
                  .config('spark.default.parallelism', '4')
                  .config('spark.sql.adaptive.enabled', 'false')
                  .config('spark.sql.session.timeZone', 'UTC')
                  .config('spark.ui.enabled', 'false'))
    spark = configure_spark_with_delta_pip(construtor).getOrCreate()
    spark.sparkContext.setLogLevel('ERROR')
    return spark
```

- [ ] **Step 2: `c11_delta.py`.** Imprime só o que é estável entre os dois lados: contagens, linhas
  ordenadas, colunas, a sequência de operações, o `mode` dos `WRITE`, o tipo de exceção e um trecho
  fixo das mensagens.

```python
"""Delta Lake: escrita, versões, time travel, update, delete, merge, schema, vacuum e optimize."""
import os

from pyspark.sql import functions as F

from _comum import sessao_delta, tmp

spark = sessao_delta()
from delta.tables import DeltaTable  # noqa: E402 — depois da sessão, como no delta-spark

caminho = os.path.join(tmp(), 'estoque')
linhas = lambda df: sorted(tuple(r) for r in df.collect())  # noqa: E731

estoque = spark.createDataFrame([('arroz', 10, 24.9), ('feijao', 4, 8.5), ('cafe', 7, 19.9)], ['produto', 'qtd', 'preco'])
estoque.write.format('delta').save(caminho)
spark.createDataFrame([('milho', 3, 5.0)], ['produto', 'qtd', 'preco']).write.format('delta').mode('append').save(caminho)
t = DeltaTable.forPath(spark, caminho)
print(t.toDF().count(), spark.read.format('delta').option('versionAsOf', 0).load(caminho).count())

t.update('produto = "cafe"', {'preco': 'preco * 2'})
t.delete(F.col('qtd') < 5)
print(linhas(t.toDF()))

dia = spark.createDataFrame([('cafe', 9, 21.0), ('sal', 2, 2.0)], ['produto', 'qtd', 'preco'])
(t.alias('e').merge(dia.alias('d'), 'e.produto = d.produto')
  .whenMatchedUpdate(set={'qtd': 'e.qtd + d.qtd', 'preco': 'd.preco'})
  .whenNotMatchedInsertAll().execute())
print(linhas(t.toDF()))

novo = spark.createDataFrame([('sal', 1, 2.0, 'Crato')], ['produto', 'qtd', 'preco', 'cidade'])
try:
    novo.write.format('delta').mode('append').save(caminho)
except Exception as e:  # noqa: BLE001
    print(type(e).__name__, 'schema mismatch' in str(e).lower())
novo.write.format('delta').mode('append').option('mergeSchema', 'true').save(caminho)
print(t.toDF().columns, linhas(t.toDF().select('produto', 'cidade')))

h = t.history().orderBy('version').collect()
print([(r.version, r.operation) for r in h])
print([r.operationParameters['mode'] for r in h if r.operation == 'WRITE'])
print(spark.read.format('delta').option('versionAsOf', 2).load(caminho).count())

try:
    t.vacuum(0)
except Exception as e:  # noqa: BLE001
    print('vacuum recusou', 'retention' in str(e).lower())

for i in range(3):
    spark.createDataFrame([(f'p{i}', i, 1.0, None)], 'produto STRING, qtd BIGINT, preco DOUBLE, cidade STRING') \
        .write.format('delta').mode('append').save(caminho)
t.optimize().executeCompaction()
print(t.history(1).first().operation, t.toDF().count())

spark.stop()
```

- [ ] **Step 3:** gravar o esperado com o nosso
  (`python python/conformidade/rodar.py --gravar c11_delta`) e conferir à mão se cada linha bate
  com o que o Delta real faria (seção 1.1 da spec). Rodar `python python/conformidade/rodar.py`
  (os 11 iguais) e o `test_conformidade.py` (com o total ajustado para 11).
- [ ] **Step 4:** no `pages.yml`, troque `python -m pip install pyspark==4.0.1` por
  `python -m pip install pyspark==4.0.1 delta-spark==4.0.0`. Commit "Conformidade: Delta Lake
  contra o delta-spark 4.0".
- [ ] **Step 5 (só com o "sim"): conferir no CI.**
  - Faça o push do branch `fase5` e abra um **PR em rascunho** para o `main`, que roda a
    conformidade sem publicar o site.
  - Se o `c11` divergir do Delta real, ajuste o nosso Delta para dar a saída real, e não o
    contrário. Repita até a conformidade passar.
  - O PR continua em rascunho: a fase 5 só vai para o `main` no fim do plano 4, com o "sim".
