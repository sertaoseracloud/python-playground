# Fase 5, plano 2: Structured Streaming no relógio virtual — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O `pyspark` do DivergePython ganha o Structured Streaming: `readStream` de uma pasta e do
`rate`, `writeStream` para `console` e `memory`, os modos `append`, `complete` e `update`, os gatilhos,
o estado, as janelas de tempo, a marca d'água e o `dropDuplicates`. Tudo roda em micro-lotes num relógio
virtual, e o resultado da execução traz o bloco `streaming`, que a aba ⚡ Execução mostra na parte
🌊 Micro-lotes. O PySpark 4.0.1 real confere o resultado no CI.

**Architecture:**
- **A tabela sem fim:** `spark.readStream` devolve um DataFrame comum cuja folha do plano é um
  `FonteStream`. Essa folha só tem linhas enquanto um micro-lote roda: o executor põe as partições do
  lote nela, roda o plano e tira. Fora disso, qualquer ação de lote (`count`, `show`...) dá o erro do
  Spark.
- **O executor** (`pyspark/sql/streaming/consulta.py`):
  - escolhe a entrada de cada lote: os arquivos ainda não lidos, em ordem de nome, até
    `maxFilesPerTrigger`, ou as linhas do `rate` no tempo que passou;
  - roda o lote como um job comum, que aparece na aba ⚡ Execução;
  - entrega o resultado ao console ou à tabela de memória;
  - avança o relógio virtual 1 s por lote, ou o intervalo do `processingTime`.
- **O estado** (`pyspark/sql/streaming/estado.py`):
  - a agregação do lote roda só a parte parcial do `HashAggregate` (nos workers, com o shuffle);
  - o processo principal junta o resultado a um dicionário `chave → acumuladores`, que é o estado;
  - o modo de saída decide o que sai: tudo no `complete`, as chaves do lote no `update`, e as janelas
    que a marca d'água fechou no `append`;
  - o que vem depois da agregação (um `orderBy`, por exemplo) roda sobre as linhas emitidas;
  - o `dropDuplicates` usa o mesmo estado: só emite as chaves novas.
- **Tempo:**
  - `relogio.virtual()` faz o `current_timestamp()` do Spark ler o relógio virtual durante um lote;
  - `F.window` faz as janelas fixas e as deslizantes; a deslizante vira uma linha por janela antes do
    `groupBy`, como no Spark.
- **Resultado da execução:**
  - `python/diverge_runtime/streams.py` guarda as consultas;
  - no fim do programa, as consultas ainda ativas rodam a entrada disponível;
  - o resultado ganha `streaming`.

**Tech Stack:** Python 3.14 puro (CPython nos testes, Pyodide no site), pytest 8.4.2, vitest com
happy-dom; no CI, PySpark 4.0.1 com Java 17.

**Spec:** `python-playground/docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md`
(seções 1.2, 1.3, 2.1, 2.2, 2.3, 4 e 6).

## Global Constraints

- **Leitura** (spec 1.2):
  - `spark.readStream` lê `csv`, `json` e `text` de uma pasta. O `csv` e o `json` exigem
    `schema(...)` e, sem ele, dão o mesmo erro do Spark.
  - O formato `rate`, com `rowsPerSecond`, gera as colunas `timestamp` e `value`.
  - Vale a opção `maxFilesPerTrigger`.
- **Escrita:**
  - `df.writeStream` aceita `format("console" | "memory")` e
    `outputMode("append" | "complete" | "update")`;
  - aceita também `trigger(processingTime=…, once=True, availableNow=True)`, `queryName(...)`,
    `option("truncate", …)` e `start()`;
  - as combinações inválidas dão os mesmos erros do Spark. Por exemplo, `complete` sem agregação, e
    `append` com agregação mas sem marca d'água.
- **Objetos de consulta:**
  - `StreamingQuery` tem `processAllAvailable()`, `awaitTermination(timeout=None)`, `stop()`,
    `isActive`, `lastProgress`, `recentProgress`, `name` e `id`;
  - `spark.streams` tem `active` e `awaitAnyTermination`.
- **Estado e janelas:** `groupBy(...).agg(...)` com estado, `window(coluna, duracao, deslize)`,
  `withWatermark(coluna, atraso)` e `dropDuplicates` com marca d'água.
- **Execução** (relógio simulado):
  - **Entrada:** cada micro-lote pega os arquivos da pasta ainda não lidos, em ordem de nome, até
    `maxFilesPerTrigger`. Os arquivos que o programa grava entre um lote e outro também entram.
  - **Rate:** gera `rowsPerSecond` linhas por segundo do relógio virtual.
  - **Gatilhos:**
    - `processingTime` avança o relógio virtual a cada lote;
    - `availableNow` e `processAllAvailable()` rodam lotes até não sobrar entrada;
    - `once` roda um lote;
    - `awaitTermination(timeout)` roda até acabar a entrada ou estourar o tempo virtual;
    - um `start()` sem nada depois roda os lotes disponíveis quando o programa termina.
  - **Lote e estado:**
    - cada lote vira um DataFrame comum, no mesmo executor da fase 4;
    - o estado fica no processo principal, entre um lote e outro.
  - **Marca d'água:** é o maior tempo de evento menos o atraso, recalculada no fim de cada lote.
    - Janelas abaixo dela saem do estado.
    - No `append`, a janela só sai quando a marca d'água passa do seu fim.
    - A linha atrasada é ignorada e contada como descartada.
  - **Saídas:**
    - o `console` imprime `-------------------------------------------`, `Batch: N`, a mesma linha de
      traços e a tabela do `show()` (truncada a 20, a não ser com `truncate` em `false`);
    - a `memory` cria uma tabela temporária com o nome da consulta, que se lê com `spark.sql`.
- **Relógio** (spec 1.3): `current_timestamp()` e `now()` do Spark, dentro de streaming e Delta,
  usam o relógio virtual. O `time` e o `datetime` do aluno continuam com a hora real.
- **Resultado** (spec 2.1):
  - o motor devolve
    `streaming: { consultas: [{ nome, modo, formato, lotes: [{ id, entrada, arquivos, estado, marcaDagua, saida, descartadas }] }] }`,
    ou `null`;
  - no bloco, `entrada` e `saida` são números de linhas, `estado` é o número de chaves guardadas,
    `marcaDagua` é a data ISO (ou `null`) e `arquivos` é a lista de nomes.
- **Aba ⚡ Execução** (spec 2.2):
  - a parte 🌊 Micro-lotes aparece quando `streaming` não é `null`, mesmo sem jobs Spark;
  - a linha do tempo é só visual (`aria-hidden`);
  - a tabela tem as colunas Lote, Arquivos, Linhas lidas, Estado, Marca d'água, Linhas emitidas e
    Descartadas;
  - o resumo falado é como "1 consulta, 4 micro-lotes, 12 linhas lidas, 2 descartadas, marca d'água
    em 00:10".
- **Conformidade** (spec 4):
  - os arquivos já estão na pasta;
  - usa `maxFilesPerTrigger=1`, `trigger(availableNow=True)` e a saída `memory`;
  - os dois lados comparam a tabela de memória e o texto do console.
- **Fora do escopo:**
  - Kafka, socket e outras fontes;
  - `foreachBatch`, `writeStream` para arquivos ou Delta, e `mapGroupsWithState`;
  - join entre dois streams.
  - Quem pede algo disso recebe um `NotImplementedError` em português.
- **Python puro**, sem dependências novas.
- **Commits:** autor via
  `git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit`, e a mensagem
  termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Publicação:** push, PR, tag e release só com o "sim". O PR em rascunho
  ([sertaoseracloud/python-playground#2](https://github.com/sertaoseracloud/python-playground/pull/2))
  já existe e recebe os pushes do branch `fase5`.
- **Ferramentas:**
  - pytest com
    `PYTHONIOENCODING=utf-8 python -m pytest python/tests/<arquivo> -q -p no:randomly > $TEMP/py.txt 2>&1`,
    lido pelo arquivo, porque o rtk esconde a saída do pytest;
  - vitest com `rtk proxy npx vitest run …`;
  - eslint com `-f json -o $TEMP/lint.json`;
  - código com `\n` dentro de strings vai pelo Edit/Write, nunca por heredoc, porque o heredoc estraga
    as barras invertidas.
- **Branch:** `fase5`.

## Review Focus

1. **Ler a tabela `memory` logo depois do `start()`, antes de qualquer lote:** a tabela já existe,
   vazia, e não dá `TABLE_OR_VIEW_NOT_FOUND`. O teste fica na Task 3,
   `test_arquivo_novo_entra_no_lote_seguinte`.
2. **Arquivos com nome começando por `_` ou `.`, e subpastas, dentro da pasta do stream:** ficam de
   fora, como no Spark, sem quebrar. O teste fica na Task 3, no mesmo teste.
3. **Um DataFrame de streaming guardado numa variável do aluno:** a correção não tenta calcular a
   tabela dele, porque daria erro, e simplesmente o pula. O teste fica na Task 5,
   `test_streaming_no_resultado`.
4. **`rate` com `awaitTermination()` sem prazo:** o programa não fica preso para sempre. Roda um
   lote, e a consulta acaba. O teste fica na Task 3, `test_rate_gera_linhas_pelo_relogio`.
5. **Linha ruim num CSV do stream** (texto numa coluna `DOUBLE`, ou colunas faltando): vira `null`,
   como na leitura em lote, sem derrubar a consulta. O teste fica na Task 3,
   `test_csv_com_linha_ruim_vira_null`.

---

### Task 1: Relógio no Spark e janelas de tempo

**Files:**
- Modify: `python/diverge_runtime/relogio.py`
- Modify: `python/pyspark/sql/functions.py`, em `current_date` e `current_timestamp`, mais as janelas
  e as durações
- Modify: `python/pyspark/sql/group.py`, em `GroupedData._agregar`
- Modify: `python/delta/_escrita.py`, em `gravar_delta` e `reescrever`, que passam a rodar dentro de
  `relogio.virtual()`
- Test: `python/tests/test_streaming.py` (novo; recebe também os testes das Tasks 2 a 4)

**Interfaces:**
- Produces:
  - `relogio.virtual()`: um *context manager*; dentro dele, o Spark lê o relógio virtual;
  - `relogio.agora_local() -> datetime`: o relógio virtual sem fuso;
  - `relogio.momento_do_spark() -> datetime`: o virtual sem fuso dentro de `virtual()`, e a hora
    real (sem microssegundos) fora;
  - `relogio.iso(momento) -> str`: o formato do progresso do Spark, `2026-01-01T00:10:00.000Z`;
  - `functions.duracao_em_micros(texto) -> int`: lê `'10 minutes'`, `'1 hour 30 minutes'` e
    `'interval 5 seconds'`, e dá `IllegalArgumentException` no texto inválido;
  - `functions.window(timeColumn, windowDuration, slideDuration=None, startTime=None) -> Column`, com
    o nome de saída `window` e o tipo `struct<start: timestamp, end: timestamp>`;
  - `functions.now()`;
  - `functions._Janela(Func)`, com os atributos `duracao`, `deslize` e `inicio` em microssegundos;
  - `functions._VariasJanelas(duracao, deslize, inicio)`: uma função `ts -> [Row(start, end)]`;
  - `functions.JANELA`: o `StructType` da janela.

- [ ] **Step 1: Testes que falham**

`python/tests/test_streaming.py`:

```python
"""Structured Streaming do DivergePython: janelas de tempo, fontes, micro-lotes no relógio virtual,
estado, marca d'água e as saídas console e memory."""
import datetime as dt
import os

import pytest

from diverge_runtime import estagios, relogio
from pyspark.errors import AnalysisException, IllegalArgumentException
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

T0 = dt.datetime(2026, 1, 1)


def m(minutos):
    """T0 mais tantos minutos (sem fuso, como o Spark devolve os timestamps)."""
    return T0 + dt.timedelta(minutes=minutos)


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def eventos(spark, *minutos):
    return spark.createDataFrame([(m(x), i) for i, x in enumerate(minutos)], 'momento TIMESTAMP, v INT')


def janelas(df):
    return sorted((r.window.start, r.window.end, r['count']) for r in df.collect())


def test_window_fixa(spark):
    agrupado = eventos(spark, 1, 4, 12).groupBy(F.window('momento', '10 minutes')).count()
    assert agrupado.columns == ['window', 'count']
    assert agrupado.dtypes[0] == ('window', 'struct<start:timestamp,end:timestamp>')
    assert janelas(agrupado) == [(m(0), m(10), 2), (m(10), m(20), 1)]


def test_window_deslizante_poe_a_linha_em_varias_janelas(spark):
    agrupado = eventos(spark, 1, 4, 12).groupBy(F.window('momento', '10 minutes', '5 minutes')).count()
    assert janelas(agrupado) == [(m(-5), m(5), 2), (m(0), m(10), 2), (m(5), m(15), 1), (m(10), m(20), 1)]


def test_window_com_inicio_e_outra_chave(spark):
    df = eventos(spark, 1, 4, 12).withColumn('estacao', F.lit('Crato'))
    r = df.groupBy('estacao', F.window('momento', '10 minutes', startTime='2 minutes')).count().collect()
    assert sorted((x.estacao, x.window.start, x['count']) for x in r) == [
        ('Crato', m(-8), 1), ('Crato', m(2), 1), ('Crato', m(12), 1)]


def test_duracao_invalida(spark):
    with pytest.raises(IllegalArgumentException, match='did not correspond to a valid interval string'):
        F.window('momento', 'dez minutos')
    with pytest.raises(IllegalArgumentException, match='slide duration'):
        F.window('momento', '5 minutes', '10 minutes')
    assert F.duracao_em_micros('interval 1 hour 30 minutes') == 90 * 60 * 10**6


def test_janela_deslizante_fora_do_groupby_explica(spark):
    with pytest.raises(NotImplementedError, match='groupBy'):
        eventos(spark, 1).select(F.window('momento', '10 minutes', '5 minutes')).collect()


def test_current_timestamp_le_o_relogio_virtual_no_streaming(spark):
    df = spark.range(1).select(F.current_timestamp().alias('agora'), F.current_date().alias('hoje'), F.now().alias('n'))
    with relogio.virtual():
        relogio.avancar(90)
        assert tuple(df.first()) == (m(1.5), dt.date(2026, 1, 1), m(1.5))
        assert relogio.agora_local() == m(1.5)
    assert abs(df.first().agora - dt.datetime.now()) < dt.timedelta(minutes=5)  # fora: a hora real
    assert relogio.iso(m(10)) == '2026-01-01T00:10:00.000Z'
    assert relogio.iso(relogio.agora()) == '2026-01-01T00:01:30.000Z'
```

- [ ] **Step 2:** rodar e ver falhar (falta `F.window`).

- [ ] **Step 3: `relogio.py`.** Acrescente `import contextlib` aos imports, `_virtual = 0` depois de
`_agora = INICIO`, `_virtual = 0` no `zerar()` (com `global _agora, _virtual`) e, antes do
`estagios.AO_ZERAR.append(zerar)`:

```python
@contextlib.contextmanager
def virtual():
    """Dentro do streaming e do Delta, o current_timestamp() do Spark lê este relógio."""
    global _virtual
    _virtual += 1
    try:
        yield
    finally:
        _virtual -= 1


def agora_local():
    """O relógio virtual sem fuso (como os timestamps do Spark na sessão em UTC)."""
    return _agora.replace(tzinfo=None)


def momento_do_spark():
    """O current_timestamp() do Spark: o relógio virtual no streaming e no Delta; fora deles, a hora real."""
    if _virtual:
        return agora_local()
    return _dt.datetime.now().replace(microsecond=0)


def iso(momento):
    """Como o Spark escreve os momentos no progresso: 2026-01-01T00:10:00.000Z."""
    if momento.tzinfo is not None:
        momento = momento.astimezone(_dt.timezone.utc).replace(tzinfo=None)
    return momento.strftime('%Y-%m-%dT%H:%M:%S.') + f'{momento.microsecond // 1000:03d}Z'
```

- [ ] **Step 4: o relógio no Delta.** Em `python/delta/_escrita.py`, o corpo de `gravar_delta` e o de
`reescrever` passam a rodar dentro de `with relogio.virtual():`. Use
`from diverge_runtime import relogio`, que o módulo já pode ter. Assim, um `update` com
`current_timestamp()` grava o tempo do commit.

- [ ] **Step 5: `functions.py`.** Troque `current_date` e `current_timestamp` por:

```python
class _Agora(Func):
    """current_timestamp(), now() e current_date(): um valor só por consulta, lido ao montar o plano
    (no processo principal). No streaming e no Delta, vem do relógio virtual."""

    def com_filhos(self, filhos):
        return self

    def compilar(self, e):
        from diverge_runtime import relogio
        momento = relogio.momento_do_spark()
        valor = momento.date() if self.nome_func == 'current_date' else momento
        return lambda linha: valor


def current_date():
    return Column(_Agora('current_date', [], None, _fixo(T.DateType()), anulavel=False))


def current_timestamp():
    return Column(_Agora('current_timestamp', [], None, _fixo(T.TimestampType()), anulavel=False))


def now():
    return Column(_Agora('now', [], None, _fixo(T.TimestampType()), anulavel=False))
```

Acrescente `Alias` ao import de `.column` e, depois de `struct`:

```python
# ---------- janelas de tempo ----------

_UNIDADES = {'microsecond': 1, 'millisecond': 1000, 'second': 10**6, 'minute': 60 * 10**6,
             'hour': 3600 * 10**6, 'day': 86400 * 10**6, 'week': 7 * 86400 * 10**6}
_DURACAO = re.compile(r'(\d+)\s*(microsecond|millisecond|second|minute|hour|day|week)s?', re.IGNORECASE)
_EPOCA = datetime.datetime(1970, 1, 1)
JANELA = T.StructType([T.StructField('start', T.TimestampType()), T.StructField('end', T.TimestampType())])


def duracao_em_micros(texto):
    """'10 minutes', '1 hour 30 minutes' ou 'interval 5 seconds' em microssegundos, como o Spark lê."""
    limpo = str(texto).strip()
    if limpo.lower().startswith('interval '):
        limpo = limpo[9:]
    partes = _DURACAO.findall(limpo)
    if not partes or _DURACAO.sub('', limpo).strip():
        from ..errors import IllegalArgumentException
        raise IllegalArgumentException(f'The provided interval ({texto}) did not correspond to a valid interval string.')
    return sum(int(n) * _UNIDADES[u.lower()] for n, u in partes)


def _micros(ts):
    return (ts - _EPOCA) // datetime.timedelta(microseconds=1)


def _janela(inicio, duracao):
    return T._criar_row(['start', 'end'], (_EPOCA + datetime.timedelta(microseconds=inicio),
                                           _EPOCA + datetime.timedelta(microseconds=inicio + duracao)))


class _UmaJanela:
    def __init__(self, duracao, inicio):
        self.duracao, self.inicio = duracao, inicio

    def __call__(self, ts):
        t = _micros(ts)
        return _janela(t - (t - self.inicio) % self.duracao, self.duracao)


class _VariasJanelas:
    """As janelas deslizantes que contêm o momento (início <= ts < fim), da mais antiga à mais nova."""

    def __init__(self, duracao, deslize, inicio):
        self.duracao, self.deslize, self.inicio = duracao, deslize, inicio

    def __call__(self, ts):
        t = _micros(ts)
        s = t - (t - self.inicio) % self.deslize
        saida = []
        while s > t - self.duracao:
            saida.append(_janela(s, self.duracao))
            s -= self.deslize
        return saida[::-1]


class _Janela(Func):
    """window(coluna, duração, deslize, início): a janela fixa da linha (struct<start, end>). A
    deslizante só existe dentro do groupBy, que põe a linha em cada janela (group.py)."""

    def __init__(self, coluna, duracao, deslize, inicio):
        self.duracao, self.deslize, self.inicio = duracao, deslize, inicio
        super().__init__('window', [coluna], _UmaJanela(duracao, inicio), _fixo(JANELA), entradas=[T.TimestampType()],
                         formato=lambda p: f'window({p[0]}, {duracao}, {deslize}, {inicio})')

    def com_filhos(self, filhos):
        return _Janela(filhos[0], self.duracao, self.deslize, self.inicio)

    def compilar(self, e):
        if self.deslize != self.duracao:
            raise NotImplementedError('No DivergePython, a janela deslizante só funciona dentro do groupBy.')
        return super().compilar(e)


def window(timeColumn, windowDuration, slideDuration=None, startTime=None):
    duracao = duracao_em_micros(windowDuration)
    deslize = duracao_em_micros(slideDuration) if slideDuration else duracao
    inicio = duracao_em_micros(startTime) if startTime else 0
    if deslize > duracao:
        from ..errors import IllegalArgumentException
        raise IllegalArgumentException(f'The slide duration ({deslize}) must be less than or equal to the windowDuration ({duracao}).')
    return Column(Alias(_Janela(para_expr(timeColumn), duracao, deslize, inicio), 'window'))
```

- [ ] **Step 6: a deslizante no `groupBy`.** Em `group.py`, acrescente `Estrela` e `Func` ao import de
`.column`. `_agregar` passa a usar as chaves expandidas:

```python
    def _agregar(self, exprs):
        df, chaves = self._expandir_janelas()
        if self._pivo is not None:
            exprs = self._expandir_pivo(exprs)
        saidas = list(chaves) + list(exprs)
        return df._novo(agregar(df._plano, list(chaves), saidas, 'groupBy'))

    def _expandir_janelas(self):
        """A janela deslizante põe a linha em várias janelas: como o Spark, uma linha por janela antes de agrupar."""
        from .functions import JANELA, _Janela, _VariasJanelas, explode
        df, chaves = self._df, list(self._chaves)
        for i, c in enumerate(chaves):
            base = sem_alias(c)
            if isinstance(base, _Janela) and base.deslize != base.duracao:
                lista = Func('window', [base.args[0]], _VariasJanelas(base.duracao, base.deslize, base.inicio),
                             lambda _tipos: T.ArrayType(JANELA, False), entradas=[T.TimestampType()])
                df = df.select(Column(Estrela()), explode(Column(lista)).alias('window'))
                chaves[i] = Col('window')
        return df, chaves
```

Se `_expandir_pivo` ler `self._df`, ele continua lendo o DataFrame original. Isso está certo, porque
o pivô não muda com a expansão.

- [ ] **Step 7:** rodar o `test_streaming.py` e ver passar. Depois, rodar a suíte inteira do pytest e
o `rodar.py` da conformidade, os 11 iguais: `current_timestamp` e `_escrita` mudaram, e nada mais
pode mudar. Commit "Streaming: relógio no Spark e janelas de tempo".

### Task 2: `readStream`, as fontes e a marca d'água

**Files:**
- Create: `python/pyspark/sql/streaming/__init__.py`
- Create: `python/pyspark/sql/streaming/fonte.py`
- Modify: `python/pyspark/sql/session.py` (`readStream`)
- Modify: `python/pyspark/sql/dataframe.py` (`isStreaming` e `withWatermark`)
- Test: `python/tests/test_streaming.py`

**Interfaces:**
- Consumes: `functions.duracao_em_micros` (Task 1); `readwriter._formato(nome, opcoes)`, com o
  `.ler(caminho, schema)` de cada formato; `rdd._Fonte(sc, nome, particoes=[...])`.
- Produces:
  - `fonte.FonteStream(No)`: `.fonte`, `.saida`, e `.lote`, a lista de partições do lote em execução
    ou `None`; o `rdd()` dá o erro do Spark quando `lote` é `None`;
  - `fonte.FonteArquivos`: `.pasta`, `.nome`, `.maximo` (o `maxFilesPerTrigger`, ou `None`),
    `.descricao`, `.listar() -> [nomes]` e `.ler(nome) -> [tuplas]`;
  - `fonte.FonteRate`: `.nome = 'rate'`, `.por_segundo`, `.schema`, `.descricao` e
    `.linhas(inicio, de, ate) -> [(timestamp, value)]`;
  - `fonte.MarcaDagua(No)`: `.atributo` (a coluna do tempo do evento) e `.atraso` (em microssegundos);
  - `fonte.DataStreamReader`;
  - `DataFrame.isStreaming` e `DataFrame.withWatermark(eventTime, delayThreshold)`.

- [ ] **Step 1: Testes que falham** (no fim de `test_streaming.py`):

```python
CABECALHO = 'estacao,momento,temperatura\n'
SCHEMA = 'estacao STRING, momento TIMESTAMP, temperatura DOUBLE'
LOTES = {
    'lote-01.csv': ['Crato,2026-01-01 00:01:00,31.5', 'Sobral,2026-01-01 00:04:00,29.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-02.csv': ['Petrolina,2026-01-01 00:25:00,35.0', 'Crato,2026-01-01 00:03:00,30.0'],
    'lote-03.csv': ['Sobral,2026-01-01 00:41:00,28.0', 'Crato,2026-01-01 00:05:00,32.0'],
}


def gravar(nome, linhas, pasta='leituras'):
    os.makedirs(pasta, exist_ok=True)
    with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
        f.write(CABECALHO + ''.join(x + '\n' for x in linhas))


@pytest.fixture
def pasta(spark):
    for nome, linhas in LOTES.items():
        gravar(nome, linhas)
    return 'leituras'


def leituras(spark, maximo=1):
    leitor = spark.readStream.schema(SCHEMA)
    if maximo:
        leitor = leitor.option('maxFilesPerTrigger', maximo)
    return leitor.csv('leituras', header=True)


def test_readstream_le_a_pasta_com_schema(spark, pasta):
    df = leituras(spark)
    assert df.isStreaming and not spark.range(1).isStreaming
    assert df.dtypes == [('estacao', 'string'), ('momento', 'timestamp'), ('temperatura', 'double')]
    assert 'StreamingRelation csv' in '\n'.join(df._arvore())


def test_csv_e_json_sem_schema_dao_o_erro_do_spark(spark, pasta):
    for ler in (lambda: spark.readStream.csv(pasta, header=True), lambda: spark.readStream.format('json').load(pasta)):
        with pytest.raises(IllegalArgumentException, match='Schema must be specified when creating a streaming source DataFrame'):
            ler()


def test_text_e_rate_tem_o_schema_fixo(spark, pasta):
    assert spark.readStream.text(pasta).dtypes == [('value', 'string')]
    assert spark.readStream.format('rate').option('rowsPerSecond', 5).load().dtypes == [('timestamp', 'timestamp'), ('value', 'bigint')]


def test_acao_de_lote_num_stream_da_o_erro_do_spark(spark, pasta):
    df = leituras(spark).filter(F.col('temperatura') > 30)
    for acao in (df.count, df.collect, df.show):
        with pytest.raises(AnalysisException, match=r'writeStream\.start\(\)'):
            acao()


def test_pasta_que_nao_existe(spark):
    with pytest.raises(AnalysisException, match='PATH_NOT_FOUND'):
        spark.readStream.schema(SCHEMA).csv('nao-existe')


def test_with_watermark(spark, pasta):
    lote = eventos(spark, 1)
    assert lote.withWatermark('momento', '10 minutes') is lote  # num DataFrame de lote, o Spark ignora a marca d'água
    with pytest.raises(AnalysisException, match='EVENT_TIME_IS_NOT_ON_TIMESTAMP_TYPE'):
        leituras(spark).withWatermark('estacao', '10 minutes')
    marcado = leituras(spark).withWatermark('momento', '10 minutes')
    assert marcado.isStreaming and 'EventTimeWatermark momento' in '\n'.join(marcado._arvore())
```

- [ ] **Step 2:** rodar e ver falhar (o `readStream` ainda dá `NotImplementedError`).

- [ ] **Step 3: `streaming/fonte.py`**

```python
"""As fontes do streaming (os arquivos de uma pasta e o rate), o nó do plano que recebe cada micro-lote
e o withWatermark. A fonte não guarda o que já leu: cada consulta guarda o seu (consulta.py)."""
import datetime as dt
import os

from ...errors import AnalysisException, IllegalArgumentException, caminho_nao_existe
from ...rdd import _Fonte
from .. import types as T
from ..column import Atributo
from ..plano import INFINITO, No, lista_de_atributos
from ..readwriter import _formato

ERRO_EM_LOTE = 'Queries with streaming sources must be executed with writeStream.start();'
SEM_SCHEMA = ('Schema must be specified when creating a streaming source DataFrame. If some files already exist in the '
              "directory, then depending on the file format you may be able to create a static DataFrame on that directory "
              "with 'spark.read.load(directory)' and infer schema from it.")


class FonteStream(No):
    """A tabela sem fim: só tem linhas enquanto um micro-lote roda (o executor põe as partições em `lote`)."""

    def __init__(self, sessao, fonte):
        super().__init__(sessao)
        self.fonte = fonte
        self.saida = [Atributo(f.name, f.dataType, anulavel=f.nullable) for f in fonte.schema.fields]
        self.lote = None

    def linha(self, raiz=False):
        return f'StreamingRelation {self.fonte.nome}, [{lista_de_atributos(self.saida)}]'

    def num_particoes(self):
        return len(self.lote) if self.lote else 1

    def tamanho(self):
        return INFINITO

    def rdd(self):
        if self.lote is None:
            raise AnalysisException(ERRO_EM_LOTE)
        return _Fonte(self.sessao.sparkContext, 'stream', particoes=[list(p) for p in self.lote])


class MarcaDagua(No):
    """withWatermark: não muda as linhas; diz ao executor a coluna do tempo do evento e o atraso aceito."""

    def __init__(self, filho, atributo, atraso):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.atributo, self.atraso = atributo, atraso
        self.saida = filho.saida

    def linha(self, raiz=False):
        return f'EventTimeWatermark {self.atributo.ref()}, {self.atraso // 10**6} seconds'

    def rdd(self):
        return self.filhos[0].rdd()


class FonteArquivos:
    def __init__(self, pasta, nome, schema, opcoes):
        self.pasta, self.nome, self.schema = pasta, nome, schema
        self.formato = _formato(nome, opcoes)
        self.maximo = int(opcoes['maxFilesPerTrigger']) if 'maxFilesPerTrigger' in opcoes else None
        self.descricao = f'FileStreamSource[file:{pasta}]'

    def listar(self):
        """Os arquivos de dados da pasta, em ordem de nome (sem os que começam com _ ou ., e sem subpastas)."""
        if not os.path.isdir(self.pasta):
            return []
        return sorted(n for n in os.listdir(self.pasta)
                      if not n.startswith(('_', '.')) and os.path.isfile(os.path.join(self.pasta, n)))

    def ler(self, nome):
        return self.formato.ler(os.path.join(self.pasta, nome), self.schema)


class FonteRate:
    nome = 'rate'
    schema = T.StructType([T.StructField('timestamp', T.TimestampType()), T.StructField('value', T.LongType())])

    def __init__(self, opcoes):
        self.por_segundo = int(opcoes.get('rowsPerSecond', 1))
        if self.por_segundo <= 0:
            raise IllegalArgumentException(f"Invalid value '{self.por_segundo}'. The option 'rowsPerSecond' must be positive")
        self.descricao = f'RateStreamV2[rowsPerSecond={self.por_segundo}, rampUpTimeSeconds=0, numPartitions=default'

    def linhas(self, inicio, de, ate):
        """As linhas value = de..ate-1; a de número v nasce v / rowsPerSecond segundos depois do início."""
        return [(inicio + dt.timedelta(microseconds=v * 10**6 // self.por_segundo), v) for v in range(de, ate)]


class DataStreamReader:
    def __init__(self, sessao):
        self._sessao, self._formato, self._opcoes, self._schema = sessao, None, {}, None

    def format(self, source):
        self._formato = source
        return self

    def option(self, key, value):
        self._opcoes[key] = str(value).lower() if isinstance(value, bool) else str(value)
        return self

    def options(self, **opcoes):
        for k, v in opcoes.items():
            self.option(k, v)
        return self

    def schema(self, schema):
        self._schema = T.ler_ddl(schema) if isinstance(schema, str) else schema
        return self

    def load(self, path=None, format=None, schema=None, **opcoes):  # noqa: A002
        from ..dataframe import DataFrame
        if format:
            self._formato = format
        if schema is not None:
            self.schema(schema)
        self.options(**{k: v for k, v in opcoes.items() if v is not None})
        nome = (self._formato or 'parquet').lower()
        if nome == 'rate':
            fonte = FonteRate(self._opcoes)
        else:
            if path is None:
                raise IllegalArgumentException("'path' is not specified")
            pasta = os.path.abspath(path)
            if not os.path.exists(pasta):
                raise caminho_nao_existe(pasta)
            if nome in ('text', 'txt'):
                schema_da_fonte = T.StructType([T.StructField('value', T.StringType())])
            elif self._schema is None:
                raise IllegalArgumentException(SEM_SCHEMA)
            else:
                schema_da_fonte = self._schema
            fonte = FonteArquivos(pasta, nome, schema_da_fonte, self._opcoes)
        return DataFrame(FonteStream(self._sessao, fonte), self._sessao)

    def csv(self, path, schema=None, sep=None, header=None, **opcoes):
        self._formato = 'csv'
        for k, v in (('sep', sep), ('header', header)):
            if v is not None:
                self.option(k, v)
        return self.load(path, schema=schema, **opcoes)

    def json(self, path, schema=None, multiLine=None, **opcoes):
        self._formato = 'json'
        if multiLine is not None:
            self.option('multiLine', multiLine)
        return self.load(path, schema=schema, **opcoes)

    def text(self, path, **opcoes):
        self._formato = 'text'
        return self.load(path, **opcoes)
```

`streaming/__init__.py`:

```python
"""Structured Streaming do DivergePython: micro-lotes num relógio virtual."""
from .fonte import DataStreamReader

__all__ = ['DataStreamReader']
```

- [ ] **Step 4: a sessão e o DataFrame.** Em `session.py`, o `readStream` passa a ser:

```python
    @property
    def readStream(self):
        from .streaming import DataStreamReader
        return DataStreamReader(self)
```

Em `dataframe.py`, depois de `printSchema`:

```python
    @property
    def isStreaming(self):
        from .streaming.fonte import FonteStream
        return any(isinstance(n, FonteStream) for n in P.nos(self._plano))

    def withWatermark(self, eventTime, delayThreshold):
        from .functions import duracao_em_micros
        from .streaming.fonte import MarcaDagua
        e = self._entrada()
        atributo = e.atributos[e.achar(eventTime)]
        if not isinstance(atributo.tipo, T.TimestampType):
            raise AnalysisException(f'The event time `{eventTime}` has the invalid type "{atributo.tipo.simpleString().upper()}", '
                                    'but expected "TIMESTAMP".', 'EVENT_TIME_IS_NOT_ON_TIMESTAMP_TYPE', {}, '42K09')
        atraso = duracao_em_micros(delayThreshold)
        if not self.isStreaming:
            return self  # como no Spark: num DataFrame de lote, a marca d'água não faz nada
        return self._novo(MarcaDagua(self._plano, atributo, atraso))
```

- [ ] **Step 5:** rodar e ver passar, mais a suíte inteira do pytest. Commit "Streaming: readStream,
fontes e marca d'água".

### Task 3: `writeStream` e a consulta sem estado

**Files:**
- Create: `python/pyspark/sql/streaming/consulta.py`
- Create: `python/diverge_runtime/streams.py`
- Modify: `python/pyspark/sql/streaming/__init__.py`
- Modify: `python/pyspark/sql/session.py` (`streams`)
- Modify: `python/pyspark/sql/dataframe.py` (`writeStream`)
- Modify: `python/pyspark/errors/__init__.py` (`StreamingQueryException`)
- Test: `python/tests/test_streaming.py`

**Interfaces:**
- Consumes: `FonteStream.lote`, `FonteArquivos`, `FonteRate`, `MarcaDagua` (Task 2);
  `relogio.virtual`, `agora_local`, `avancar` e `iso` (Task 1); `mostrar.tabela`;
  `catalog.registrar_view`; `DataFrame._linhas(acao)`.
- Produces:
  - `consulta.DataStreamWriter`, `consulta.StreamingQuery`, `consulta.StreamingQueryManager` e
    `consulta.StreamingQueryProgress(dict)`;
  - `StreamingQuery._operador`, com `.lote(acao) -> (linhas, info)` e
    `.precisa_lote_vazio() -> bool`. O `info` tem as chaves `operador`, `estado`, `atualizadas`,
    `removidas`, `descartadas`, `marca_usada` e `marca`;
  - `StreamingQuery._escolher_operador()`, que a Task 4 troca;
  - `StreamingQuery._modo`, `._plano`, `._sessao` e `._lotes`;
  - `StreamingQuery._rodar(ate=None)`, `._fim_do_programa()` e `._resumo() -> dict`;
  - `streams.registrar(consulta)`, `streams.consultas()`, `streams.terminar()`,
    `streams.resumo() -> dict | None` e `streams.zerar()`, registrado em `AO_ZERAR`;
  - `pyspark.errors.StreamingQueryException(PySparkException)`.

- [ ] **Step 1: Testes que falham** (no fim de `test_streaming.py`; acrescente `StreamingQueryException`
ao import de `pyspark.errors`):

```python
def correr(df, nome='q', modo='append', formato='memory', gatilho=None, **opcoes):
    escritor = df.writeStream.format(formato).queryName(nome).outputMode(modo).options(**opcoes)
    q = escritor.trigger(**(gatilho or {'availableNow': True})).start()
    q.awaitTermination()
    return q


def tabela(spark, nome):
    return sorted((tuple(r) for r in spark.table(nome).collect()), key=str)


def test_append_sem_estado_um_lote_por_arquivo(spark, pasta):
    q = correr(leituras(spark).filter(F.col('temperatura') > 30).select('estacao', 'temperatura'), 'quentes')
    assert not q.isActive and q.name == 'quentes'
    assert [p['numInputRows'] for p in q.recentProgress] == [3, 2, 2]
    assert [p.batchId for p in q.recentProgress] == [0, 1, 2]
    assert q.lastProgress['sources'][0]['numInputRows'] == 2
    assert tabela(spark, 'quentes') == [('Crato', 31.5), ('Crato', 32.0), ('Crato', 33.0), ('Petrolina', 35.0)]
    assert spark.sql('select count(*) from quentes').first()[0] == 4


def test_console_imprime_como_o_spark(spark, pasta, capsys):
    correr(leituras(spark, maximo=None).filter(F.col('estacao') == 'Petrolina').select('estacao', 'temperatura'),
           formato='console')
    assert capsys.readouterr().out == (
        '-------------------------------------------\nBatch: 0\n-------------------------------------------\n'
        '+---------+-----------+\n|  estacao|temperatura|\n+---------+-----------+\n'
        '|Petrolina|       35.0|\n+---------+-----------+\n\n')


def test_console_sem_truncar(spark, capsys):
    gravar('a.csv', ['Estação Meteorológica de Petrolina,2026-01-01 00:01:00,30.0'])
    correr(spark.readStream.schema(SCHEMA).csv('leituras', header=True).select('estacao'), formato='console', truncate=False)
    assert '|Estação Meteorológica de Petrolina|' in capsys.readouterr().out


def test_await_any_termination(spark, pasta):
    q = leituras(spark).writeStream.format('memory').queryName('a').start()
    assert spark.streams.awaitAnyTermination(5) is False
    assert len(q.recentProgress) == 3 and q.isActive
    assert relogio.agora_local() == T0 + dt.timedelta(seconds=5)  # o resto do prazo passa sem dados
    assert spark.streams.awaitAnyTermination() is None and not q.isActive


def test_relogio_anda_por_lote(spark, pasta):
    q = correr(leituras(spark), gatilho={'processingTime': '10 seconds'})
    assert [p['timestamp'] for p in q.recentProgress] == [
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z', '2026-01-01T00:00:20.000Z']
    assert relogio.agora_local() == T0 + dt.timedelta(seconds=30)


def test_arquivo_novo_entra_no_lote_seguinte(spark, pasta):
    q = leituras(spark).writeStream.format('memory').queryName('todas').start()
    assert spark.table('todas').count() == 0  # a tabela existe desde o start
    q.processAllAvailable()
    assert q.isActive and len(q.recentProgress) == 3
    gravar('lote-04.csv', ['Mossoró,2026-01-01 00:50:00,36.0'])
    gravar('_temporario.csv', ['X,2026-01-01 00:50:00,1.0'])  # _ e . ficam de fora, como no Spark
    os.makedirs('leituras/sub', exist_ok=True)
    q.processAllAvailable()
    assert [p['numInputRows'] for p in q.recentProgress] == [3, 2, 2, 1]
    assert spark.table('todas').count() == 8
    assert spark.streams.active == [q]
    q.stop()
    assert not q.isActive and spark.streams.active == []


def test_once_le_tudo_num_lote_so(spark, pasta):
    q = correr(leituras(spark), gatilho={'once': True})
    assert [p['numInputRows'] for p in q.recentProgress] == [7] and not q.isActive


def test_available_now_fica_com_os_arquivos_do_start(spark, pasta):
    q = leituras(spark).writeStream.format('memory').queryName('fixas').trigger(availableNow=True).start()
    gravar('lote-04.csv', ['Mossoró,2026-01-01 00:50:00,36.0'])
    q.awaitTermination()
    assert [p['numInputRows'] for p in q.recentProgress] == [3, 2, 2]


def test_csv_com_linha_ruim_vira_null(spark):
    gravar('a.csv', ['Crato,2026-01-01 00:01:00,quente', 'Sobral'])
    correr(spark.readStream.schema(SCHEMA).csv('leituras', header=True), 'ruins')
    assert tabela(spark, 'ruins') == [('Crato', m(1), None), ('Sobral', None, None)]


def test_rate_gera_linhas_pelo_relogio(spark):
    q = spark.readStream.format('rate').option('rowsPerSecond', 2).load().writeStream.format('memory').queryName('taxa').start()
    assert q.awaitTermination(3) is False and q.isActive
    assert [p['numInputRows'] for p in q.recentProgress] == [0, 2, 2]
    assert tabela(spark, 'taxa') == [(T0 + dt.timedelta(seconds=v / 2), v) for v in range(4)]
    q.awaitTermination()  # sem prazo, o Spark esperaria para sempre: aqui roda um lote e acaba
    assert not q.isActive and len(q.recentProgress) == 4


def test_erros_do_spark_no_start(spark, pasta):
    df = leituras(spark)
    with pytest.raises(AnalysisException, match='Complete output mode not supported'):
        df.writeStream.format('memory').queryName('a').outputMode('complete').start()
    with pytest.raises(AnalysisException, match='Sorting is not supported'):
        df.orderBy('estacao').writeStream.format('memory').queryName('b').start()
    with pytest.raises(AnalysisException, match='queryName must be specified for memory sink'):
        df.writeStream.format('memory').start()
    with pytest.raises(IllegalArgumentException, match='Unknown output mode'):
        df.writeStream.outputMode('tudo')
    with pytest.raises(ValueError, match='Only allow single trigger'):
        df.writeStream.trigger(once=True, availableNow=True)
    with pytest.raises(AnalysisException, match='WRITE_STREAM_NOT_ALLOWED'):
        spark.range(1).writeStream  # noqa: B018
    df.writeStream.format('memory').queryName('c').start()
    with pytest.raises(IllegalArgumentException, match='already active'):
        df.writeStream.format('memory').queryName('c').start()
    with pytest.raises(NotImplementedError, match='console e memory'):
        df.writeStream.format('parquet').start('saida')


def test_erro_no_lote_derruba_a_consulta(spark, pasta):
    quebra = F.udf(lambda t: 1 // 0, 'int')
    q = leituras(spark).select(quebra('temperatura')).writeStream.format('memory').queryName('quebrada').start()
    with pytest.raises(StreamingQueryException, match=r'STREAM_FAILED.*division'):
        q.processAllAvailable()
    assert not q.isActive and isinstance(q.exception(), StreamingQueryException)


def test_cada_lote_e_um_job_na_aba_execucao(spark, pasta):
    correr(leituras(spark), 'jobs')
    assert [j['acao'] for j in estagios.resumo()['jobs']] == ['lote 0 de jobs', 'lote 1 de jobs', 'lote 2 de jobs']
```

- [ ] **Step 2:** rodar e ver falhar (o `writeStream` ainda dá `NotImplementedError`).

- [ ] **Step 3: `StreamingQueryException`.** Em `errors/__init__.py`, depois de
`SparkRuntimeException`:

```python
class StreamingQueryException(PySparkException):
    """A consulta de streaming parou porque um micro-lote falhou (a causa vem na mensagem)."""
```

Acrescente `'StreamingQueryException'` ao `__all__`.

- [ ] **Step 4: `diverge_runtime/streams.py`**

```python
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
```

- [ ] **Step 5: `streaming/consulta.py`**

```python
"""writeStream, StreamingQuery e spark.streams: os micro-lotes no relógio virtual.

Cada micro-lote pega a entrada nova da fonte: os arquivos ainda não lidos, em ordem de nome, até o
maxFilesPerTrigger, ou as linhas do rate no tempo que passou. Roda o plano como um DataFrame comum,
com as partições nos workers, e entrega o resultado à saída: o console imprime como o Spark, e a
memory guarda uma tabela temporária com o nome da consulta. O relógio virtual anda 1 s por lote, ou o
intervalo do processingTime."""
import datetime as dt
import uuid

from diverge_runtime import relogio, streams

from ...errors import AnalysisException, IllegalArgumentException, PySparkValueError, StreamingQueryException
from .. import mostrar
from .. import plano as P
from .. import types as T
from ..plano_largo import HashAggregate, Sort
from .fonte import FonteRate, FonteStream, MarcaDagua

MODOS = ('append', 'complete', 'update')
FORMATOS = ('console', 'memory')
LIMITE_LOTES = 200       # por chamada: uma fonte que nunca acaba não prende o programa
LIMITE_PROGRESSO = 100   # como o spark.sql.streaming.numRecentProgressUpdates
_EPOCA = dt.datetime(1970, 1, 1)
_TRACOS = '-' * 43


def _analisar(plano, modo):
    """As regras do Spark para as consultas de streaming (o UnsupportedOperationChecker); devolve a fonte."""
    nos = list(P.nos(plano))
    fontes = [n for n in nos if isinstance(n, FonteStream)]
    if len(fontes) != 1:
        raise NotImplementedError('O DivergePython roda uma fonte de streaming por consulta (sem join entre streams).')
    agregacoes = [n for n in nos if isinstance(n, HashAggregate) and n.final and n.operacao not in ('dropDuplicates', 'distinct')]
    if modo == 'complete' and not agregacoes:
        raise AnalysisException('Complete output mode not supported when there are no streaming aggregations on '
                                'streaming DataFrames/Datasets;')
    if any(isinstance(n, Sort) and n.global_ for n in nos) and not (modo == 'complete' and agregacoes):
        raise AnalysisException('Sorting is not supported on streaming DataFrames/Datasets, unless it is on aggregated '
                                'DataFrame/Dataset in Complete output mode;')
    return fontes[0]


class DataStreamWriter:
    def __init__(self, df):
        self._df = df
        self._formato, self._modo, self._nome, self._opcoes, self._gatilho = None, 'append', None, {}, None

    def format(self, source):
        self._formato = source.lower()
        return self

    def outputMode(self, outputMode):
        modo = str(outputMode).lower()
        if modo not in MODOS:
            raise IllegalArgumentException(f"Unknown output mode {outputMode}. Accepted output modes are 'append', "
                                           "'complete', 'update'")
        self._modo = modo
        return self

    def queryName(self, queryName):
        self._nome = queryName
        return self

    def option(self, key, value):
        self._opcoes[key] = str(value).lower() if isinstance(value, bool) else str(value)
        return self

    def options(self, **opcoes):
        for k, v in opcoes.items():
            self.option(k, v)
        return self

    def trigger(self, processingTime=None, once=None, continuous=None, availableNow=None):
        dados = [x for x in (processingTime, once, continuous, availableNow) if x is not None]
        if len(dados) != 1:
            raise PySparkValueError('Only allow single trigger.', 'ONLY_ALLOW_SINGLE_TRIGGER')
        if continuous is not None:
            raise NotImplementedError('O DivergePython roda o streaming em micro-lotes: o gatilho continuous fica de fora.')
        if processingTime is not None:
            from ..functions import duracao_em_micros
            self._gatilho = ('tempo', duracao_em_micros(processingTime) / 10**6)
        elif once:
            self._gatilho = ('once',)
        elif availableNow:
            self._gatilho = ('disponivel',)
        return self

    def foreachBatch(self, func):
        raise NotImplementedError('O foreachBatch fica fora do DivergePython: use a saída memory e leia a tabela com spark.sql.')

    foreach = foreachBatch

    def toTable(self, tableName, **_):
        raise NotImplementedError('O DivergePython grava o streaming só em console e memory.')

    def start(self, path=None, format=None, outputMode=None, partitionBy=None, queryName=None, **opcoes):  # noqa: A002
        if format:
            self.format(format)
        if outputMode:
            self.outputMode(outputMode)
        if queryName:
            self.queryName(queryName)
        self.options(**{k: v for k, v in opcoes.items() if v is not None})
        formato = self._formato or 'parquet'  # o padrão do Spark grava arquivos
        if formato not in FORMATOS:
            raise NotImplementedError(f'O DivergePython grava o streaming só em console e memory (pediram {formato}).')
        if formato == 'memory' and not self._nome:
            raise AnalysisException('queryName must be specified for memory sink')
        if self._nome and any(q.isActive and q.name == self._nome for q in streams.consultas()):
            raise IllegalArgumentException(f'Cannot start query with name {self._nome} as a query with that name is '
                                           'already active in this SparkSession')
        consulta = StreamingQuery(self._df, formato, self._modo, self._nome, dict(self._opcoes), self._gatilho)
        streams.registrar(consulta)
        return consulta


class StreamingQueryProgress(dict):
    """O progresso de um micro-lote, com as chaves do Spark (também como atributo: p.numInputRows)."""

    def __getattr__(self, nome):
        try:
            return self[nome]
        except KeyError:
            raise AttributeError(nome) from None


class _SemEstado:
    """Consulta sem agregação: cada lote roda o plano inteiro só com as linhas novas."""

    def __init__(self, consulta):
        self.consulta = consulta

    def lote(self, acao):
        from ..dataframe import DataFrame
        c = self.consulta
        linhas = DataFrame(c._plano, c._sessao)._linhas(acao)
        return linhas, {'operador': None, 'estado': None, 'atualizadas': 0, 'removidas': 0, 'descartadas': 0,
                        'marca_usada': None, 'marca': None}

    def precisa_lote_vazio(self):
        return False


class StreamingQuery:
    def __init__(self, df, formato, modo, nome, opcoes, gatilho):
        self._sessao, self._plano = df.sparkSession, df._plano
        self._no = _analisar(self._plano, modo)
        self._formato, self._modo, self._nome, self._opcoes, self._gatilho = formato, modo, nome, opcoes, gatilho
        self._id, self._run_id = str(uuid.uuid4()), str(uuid.uuid4())
        self._ativa, self._erro = True, None
        self._intervalo = gatilho[1] if gatilho and gatilho[0] == 'tempo' else 1
        self._colunas = [a.nome for a in self._plano.saida]
        self._tem_marca = any(isinstance(n, MarcaDagua) for n in P.nos(self._plano))
        self._lidos, self._fixos = set(), None
        self._inicio, self._gerados = relogio.agora_local(), 0  # o rate: quando começou e quantas linhas já deu
        self._proximo = 0
        self._lotes, self._progresso, self._memoria = [], [], []
        if gatilho == ('disponivel',) and not isinstance(self._no.fonte, FonteRate):
            self._fixos = set(self._no.fonte.listar())  # o availableNow processa o que existia no start
        self._operador = self._escolher_operador()
        if formato == 'memory':
            self._publicar()

    def _escolher_operador(self):
        return _SemEstado(self)

    # ---------- a API do Spark ----------
    @property
    def id(self):
        return self._id

    @property
    def runId(self):
        return self._run_id

    @property
    def name(self):
        return self._nome

    @property
    def isActive(self):
        return self._ativa

    @property
    def lastProgress(self):
        return self._progresso[-1] if self._progresso else None

    @property
    def recentProgress(self):
        return list(self._progresso)

    @property
    def status(self):
        return {'message': 'Waiting for data to arrive' if self._ativa else 'Stopped',
                'isDataAvailable': False, 'isTriggerActive': False}

    def processAllAvailable(self):
        self._rodar()
        self._levantar()

    def awaitTermination(self, timeout=None):
        if timeout is None:
            self._rodar()
            self._ativa = False  # o Spark esperaria para sempre: aqui a consulta acaba quando a entrada acaba
            self._levantar()
            return None
        self._rodar(relogio.agora_local() + dt.timedelta(seconds=float(timeout)))
        self._levantar()
        return not self._ativa

    def stop(self):
        self._ativa = False

    def exception(self):
        return self._erro

    def explain(self, extended=False):
        print('== Physical Plan ==\n' + '\n'.join(P.arvore(self._plano)) + '\n')

    # ---------- os micro-lotes ----------
    def _novos(self):
        fonte = self._no.fonte
        return [n for n in fonte.listar() if n not in self._lidos and (self._fixos is None or n in self._fixos)]

    def _tem_entrada(self):
        return isinstance(self._no.fonte, FonteRate) or bool(self._novos())

    def _entrada(self):
        """Os arquivos e as partições do próximo micro-lote (uma partição por arquivo, como o Spark)."""
        fonte = self._no.fonte
        if isinstance(fonte, FonteRate):
            ate = int((relogio.agora_local() - self._inicio).total_seconds() * fonte.por_segundo)
            linhas = fonte.linhas(self._inicio, self._gerados, ate)
            self._gerados = max(self._gerados, ate)
            return [], [linhas]
        nomes = self._novos()
        if fonte.maximo and self._gatilho != ('once',):  # o once lê tudo de uma vez
            nomes = nomes[:fonte.maximo]
        self._lidos.update(nomes)
        return nomes, [fonte.ler(n) for n in nomes]

    def _rodar(self, ate=None):
        """Roda micro-lotes enquanto houver entrada nova, ou um lote sem dados que o estado precise, sem
        passar do momento `ate` do relógio virtual. O rate entrega o tempo de um lote por vez: sem `ate`,
        roda um lote só. O once roda um lote; o once e o availableNow terminam a consulta."""
        if not self._ativa:
            return
        rate = isinstance(self._no.fonte, FonteRate)
        try:
            for _ in range(LIMITE_LOTES):
                if ate is not None and relogio.agora_local() >= ate:
                    break
                if self._gatilho != ('once',) and not self._tem_entrada() and not self._operador.precisa_lote_vazio():
                    break
                self._lote()
                if self._gatilho == ('once',) or (rate and ate is None):
                    break
        except Exception as e:  # noqa: BLE001 — o erro de um lote derruba a consulta, como no Spark
            self._falhar(e)
            return
        if self._gatilho in (('once',), ('disponivel',)):
            self._ativa = False
        elif ate is not None and relogio.agora_local() < ate:
            relogio.avancar((ate - relogio.agora_local()).total_seconds())  # o resto da espera passa sem dados

    def _lote(self):
        numero = self._proximo
        self._proximo += 1
        momento = relogio.agora_local()
        arquivos, particoes = self._entrada()
        entrada = sum(len(p) for p in particoes)
        acao = f'lote {numero} de {self._nome}' if self._nome else f'lote {numero}'
        self._no.lote = particoes or [[]]
        try:
            with relogio.virtual():
                linhas, info = self._operador.lote(acao)
        finally:
            self._no.lote = None
        self._entregar(numero, linhas)
        self._progresso.append(self._progresso_do_lote(numero, momento, entrada, len(linhas), info))
        del self._progresso[:-LIMITE_PROGRESSO]
        if len(self._lotes) < LIMITE_PROGRESSO:
            self._lotes.append({'id': numero, 'entrada': entrada, 'arquivos': arquivos, 'estado': info['estado'] or 0,
                                'marcaDagua': relogio.iso(info['marca']) if info['marca'] else None,
                                'saida': len(linhas), 'descartadas': info['descartadas']})
        relogio.avancar(self._intervalo)

    def _entregar(self, numero, linhas):
        if self._formato == 'console':
            n = int(self._opcoes.get('numRows', 20))
            truncate = self._opcoes.get('truncate', 'true')
            truncate = {'true': True, 'false': False}.get(truncate.lower(), truncate)
            print(f'{_TRACOS}\nBatch: {numero}\n{_TRACOS}')
            print(mostrar.tabela(self._colunas, linhas[:n], n, truncate, len(linhas) > n))
            return
        self._memoria = list(linhas) if self._modo == 'complete' else self._memoria + list(linhas)
        self._publicar()

    def _publicar(self):
        """A tabela temporária da saída memory, com o nome da consulta."""
        from ..catalog import registrar_view
        schema = T.StructType([T.StructField(a.nome, a.tipo, True) for a in self._plano.saida])
        registrar_view(self._sessao, self._nome, self._sessao.createDataFrame(self._memoria, schema))

    def _progresso_do_lote(self, numero, momento, entrada, saida, info):
        fonte = self._no.fonte
        estado = [] if info['operador'] is None else [{
            'operatorName': info['operador'], 'numRowsTotal': info['estado'], 'numRowsUpdated': info['atualizadas'],
            'numRowsRemoved': info['removidas'], 'numRowsDroppedByWatermark': info['descartadas']}]
        return StreamingQueryProgress({
            'id': self._id, 'runId': self._run_id, 'name': self._nome, 'timestamp': relogio.iso(momento),
            'batchId': numero, 'batchDuration': 0, 'numInputRows': entrada, 'inputRowsPerSecond': 0.0,
            'processedRowsPerSecond': 0.0, 'durationMs': {'addBatch': 0, 'triggerExecution': 0},
            'eventTime': {'watermark': relogio.iso(info['marca_usada'] or _EPOCA)} if self._tem_marca else {},
            'stateOperators': estado,
            'sources': [{'description': fonte.descricao, 'numInputRows': entrada}],
            'sink': {'description': 'MemorySink' if self._formato == 'memory' else
                     'org.apache.spark.sql.execution.streaming.ConsoleTable$', 'numOutputRows': saida},
        })

    def _falhar(self, causa):
        self._ativa = False
        self._erro = StreamingQueryException(
            f'Query [id = {self._id}, runId = {self._run_id}] terminated with exception: {causa}', 'STREAM_FAILED', {}, 'XXKST')
        self._erro.__cause__ = causa

    def _levantar(self):
        if self._erro is not None:
            raise self._erro

    # ---------- para o runtime ----------
    def _fim_do_programa(self):
        """O programa acabou com a consulta ativa: roda a entrada disponível (o resultado não depende do tempo real)."""
        if self._ativa:
            self._rodar()
            self._ativa = False
            self._levantar()

    def _resumo(self):
        return {'nome': self._nome, 'modo': self._modo, 'formato': self._formato, 'lotes': list(self._lotes)}


class StreamingQueryManager:
    def __init__(self, sessao):
        self._sessao = sessao

    @property
    def active(self):
        return [q for q in streams.consultas() if q.isActive and q._sessao is self._sessao]

    def get(self, id):  # noqa: A002
        return next((q for q in streams.consultas() if q.id == id), None)

    def awaitAnyTermination(self, timeout=None):
        """Roda a entrada disponível de cada consulta ativa. Sem prazo, as consultas acabam (o Spark
        esperaria para sempre); com prazo, o relógio vai até ele, e a volta diz se alguma terminou."""
        ativas = self.active
        ate = None if timeout is None else relogio.agora_local() + dt.timedelta(seconds=float(timeout))
        for q in ativas:
            q._rodar()
        if ate is None:
            for q in ativas:
                q._ativa = False
        elif relogio.agora_local() < ate:
            relogio.avancar((ate - relogio.agora_local()).total_seconds())
        for q in ativas:
            q._levantar()
        return None if timeout is None else any(not q.isActive for q in ativas)

    def resetTerminated(self):
        pass
```

`streaming/__init__.py` passa a ser:

```python
"""Structured Streaming do DivergePython: micro-lotes num relógio virtual."""
from .consulta import DataStreamWriter, StreamingQuery, StreamingQueryManager, StreamingQueryProgress
from .fonte import DataStreamReader

__all__ = ['DataStreamReader', 'DataStreamWriter', 'StreamingQuery', 'StreamingQueryManager', 'StreamingQueryProgress']
```

- [ ] **Step 6: a sessão e o DataFrame.** Em `session.py`, depois de `readStream`:

```python
    @property
    def streams(self):
        from .streaming import StreamingQueryManager
        return StreamingQueryManager(self)
```

Em `dataframe.py`, o `writeStream` passa a ser:

```python
    @property
    def writeStream(self):
        if not self.isStreaming:
            raise AnalysisException("'writeStream' can be called only on streaming Dataset/DataFrame.",
                                    'WRITE_STREAM_NOT_ALLOWED', {}, '42601')
        from .streaming import DataStreamWriter
        return DataStreamWriter(self)
```

- [ ] **Step 7:** rodar o `test_streaming.py` e ver passar, mais a suíte inteira do pytest. Commit
"Streaming: writeStream, console, memory e gatilhos".

### Task 4: Estado: agregação, marca d'água e `dropDuplicates`

**Files:**
- Create: `python/pyspark/sql/streaming/estado.py`
- Modify: `python/pyspark/sql/streaming/consulta.py` (`_escolher_operador`)
- Test: `python/tests/test_streaming.py`

**Interfaces:**
- Consumes:
  - `StreamingQuery._plano`, `._modo` e `._sessao` (Task 3);
  - `MarcaDagua.atributo` e `.atraso` (Task 2);
  - de `HashAggregate` (final): `.filhos[0]` (o Exchange com os pares `(chave, acumuladores)`),
    `.chaves`, `.atributos_chave`, `.atributos_agg`, `.aggs`, `.saidas`, `.base` e `.operacao`;
  - `AgregarFinal(acumuladores, saidas, sem_chaves)`.
- Produces:
  - `estado.analisar(plano, modo) -> (HashAggregate | None, MarcaDagua | None)`;
  - `estado.ComEstado(consulta, fin, marca)`, com a mesma interface do `_SemEstado`;
  - `estado.trocar(no, alvo, novo)` e `estado.topo(no)`.

- [ ] **Step 1: Testes que falham** (no fim de `test_streaming.py`):

```python
def test_complete_guarda_o_estado_entre_os_lotes(spark, pasta):
    q = correr(leituras(spark).groupBy('estacao').count(), 'contagem', 'complete')
    assert [p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress] == [2, 3, 3]
    assert [lote['estado'] for lote in q._lotes] == [2, 3, 3]
    assert tabela(spark, 'contagem') == [('Crato', 4), ('Petrolina', 1), ('Sobral', 2)]


def test_update_emite_so_as_chaves_do_lote(spark, pasta):
    q = correr(leituras(spark).groupBy('estacao').agg(F.max('temperatura').alias('maxima')), 'maximas', 'update')
    assert [p['sink']['numOutputRows'] for p in q.recentProgress] == [2, 2, 2]
    assert tabela(spark, 'maximas') == [('Crato', 33.0)] * 3 + [('Petrolina', 35.0)] + [('Sobral', 29.0)] * 2


def test_append_com_janela_e_marca_dagua(spark, pasta):
    por_janela = leituras(spark).withWatermark('momento', '10 minutes').groupBy(F.window('momento', '10 minutes')).count()
    q = correr(por_janela, 'janelas')
    progresso = q.recentProgress
    assert [p['numInputRows'] for p in progresso] == [3, 2, 2, 0]  # o último é o lote sem dados
    assert [p['eventTime']['watermark'] for p in progresso] == [
        '1970-01-01T00:00:00.000Z', '2026-01-01T00:02:00.000Z', '2026-01-01T00:15:00.000Z', '2026-01-01T00:31:00.000Z']
    assert [p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in progresso] == [0, 0, 1, 0]
    assert [lote['marcaDagua'] for lote in q._lotes] == [
        '2026-01-01T00:02:00.000Z', '2026-01-01T00:15:00.000Z', '2026-01-01T00:31:00.000Z', '2026-01-01T00:31:00.000Z']
    assert janelas(spark.table('janelas')) == [(m(0), m(10), 3), (m(10), m(20), 1), (m(20), m(30), 1)]


def test_erros_do_spark_com_estado(spark, pasta):
    with pytest.raises(AnalysisException, match='Append output mode not supported'):
        leituras(spark).groupBy('estacao').count().writeStream.format('memory').queryName('x').start()
    with pytest.raises(AnalysisException, match='Multiple streaming aggregations'):
        leituras(spark).groupBy('estacao').count().groupBy('count').count() \
            .writeStream.format('memory').queryName('y').outputMode('complete').start()


def test_drop_duplicates_com_marca_dagua(spark, pasta):
    gravar('lote-02.csv', LOTES['lote-02.csv'] + ['Crato,2026-01-01 00:12:00,33.0'])  # repetida do lote 1
    unicas = leituras(spark).withWatermark('momento', '10 minutes').dropDuplicates(['estacao', 'momento'])
    q = correr(unicas, 'unicas')
    assert [p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress] == [0, 0, 1, 0]
    assert q.recentProgress[0]['stateOperators'][0]['operatorName'] == 'dedupe'
    assert len(spark.table('unicas').collect()) == 6


def test_drop_duplicates_sem_marca_dagua_guarda_tudo(spark, pasta):
    q = correr(leituras(spark).dropDuplicates(['estacao']), 'estacoes')
    assert [p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress] == [2, 3, 3]
    assert sorted(r.estacao for r in spark.table('estacoes').collect()) == ['Crato', 'Petrolina', 'Sobral']


def test_janela_deslizante_no_complete(spark, pasta):
    correr(leituras(spark).groupBy(F.window('momento', '10 minutes', '5 minutes')).count(), 'deslizante', 'complete')
    assert janelas(spark.table('deslizante')) == [
        (m(-5), m(5), 3), (m(0), m(10), 4), (m(5), m(15), 2), (m(10), m(20), 1),
        (m(20), m(30), 1), (m(25), m(35), 1), (m(35), m(45), 1), (m(40), m(50), 1)]


def test_complete_com_order_by_depois_da_agregacao(spark, pasta, capsys):
    correr(leituras(spark).groupBy('estacao').count().orderBy('estacao'), modo='complete', formato='console',
           gatilho={'once': True})
    assert '|    Crato|    4|\n|Petrolina|    1|\n|   Sobral|    2|' in capsys.readouterr().out
```

A conta do teste do `append`: os eventos são 1, 4 e 12 no lote 0; 25 e 3 no lote 1; 41 e 5 no lote
2 (em minutos). A marca d'água usada em cada lote é a do fim do anterior:
- **lote 0** (marca 0): a janela [0,10) fica com 2 e a [10,20) com 1; nada fecha. A nova marca é
  12 − 10 = 2.
- **lote 1** (marca 2): o 25 vai para [20,30), e o 3 vai para [0,10), que ainda está aberta (fim 10
  > 2). Nada fecha. A nova marca é 25 − 10 = 15.
- **lote 2** (marca 15): o 41 vai para [40,50). O 5 iria para [0,10), mas ela já fechou (fim 10 ≤ 15):
  é descartado. A [0,10) sai com 3. A nova marca é 41 − 10 = 31.
- **lote 3** (sem dados, marca 31): saem a [10,20) e a [20,30).

- [ ] **Step 2:** rodar e ver falhar (o `complete` ainda agrega só o lote).

- [ ] **Step 3: `streaming/estado.py`**

```python
"""Operadores com estado do streaming: a agregação (complete, update e append com marca d'água) e o
dropDuplicates.

O estado fica no processo principal, entre um lote e outro. Para cada chave, guarda os acumuladores
da agregação parcial, os mesmos do HashAggregate do lote. Cada lote roda a parte parcial nos workers,
só com as linhas novas, junta o resultado ao estado e emite as linhas do modo de saída.

A marca d'água é o maior tempo de evento já visto menos o atraso, recalculada no fim de cada lote. A
chave cujo tempo (o fim da janela, ou a própria coluna) não passa da marca d'água está vencida: o lote
a descarta e conta, e o estado a esquece. Como no Spark, o descarte conta as linhas depois da agregação
parcial."""
import copy
import datetime as dt

from diverge_runtime import estagios

from ...errors import AnalysisException
from .. import plano as P
from .. import types as T
from ..column import Col, Entrada, Ref
from ..plano_largo import AgregarFinal, HashAggregate
from .fonte import MarcaDagua

DEDUPLICAR = ('dropDuplicates', 'distinct')


def topo(no):
    while no.transparente():
        no = no.filhos[0]
    return no


def trocar(no, alvo, novo):
    """Uma cópia do caminho da raiz até `alvo`, com `novo` no lugar dele (o resto do plano é o mesmo)."""
    if no is alvo:
        return novo
    filhos = tuple(trocar(f, alvo, novo) for f in no.filhos)
    if all(a is b for a, b in zip(filhos, no.filhos)):
        return no
    copia = copy.copy(no)
    copia.filhos = filhos
    return copia


class _Linhas(P.No):
    """As linhas que o estado emitiu, no lugar da agregação, para o resto do plano (orderBy, select...)."""

    def __init__(self, sessao, saida, linhas):
        super().__init__(sessao)
        self.saida, self.linhas = saida, linhas

    def linha(self, raiz=False):
        return f'LocalTableScan [{P.lista_de_atributos(self.saida)}]'

    def num_particoes(self):
        return 1

    def tamanho(self):
        return P.INFINITO

    def rdd(self):
        return self.sessao.sparkContext.parallelize(self.linhas, 1)


def _nome(x):
    if isinstance(x, Col):
        return x.nome_col
    if isinstance(x, Ref):
        return x.atributo.nome
    return None


def temporais(fin, marca):
    """As chaves que dizem o tempo do evento: [(posição, é_janela)]. A janela vale pelo fim dela."""
    if marca is None:
        return []
    saida = []
    for i, (c, a) in enumerate(zip(fin.chaves, fin.atributos_chave)):
        if isinstance(a.tipo, T.StructType) and a.tipo.names == ['start', 'end']:
            saida.append((i, True))
        elif any(_nome(x) == marca.atributo.nome for x in c.percorrer()):
            saida.append((i, False))
    return saida


def analisar(plano, modo):
    """As regras do Spark para o estado. Devolve a agregação (ou None) e a marca d'água (ou None)."""
    finais = [n for n in P.nos(plano) if isinstance(n, HashAggregate) and n.final]
    if len(finais) > 1:
        raise AnalysisException('Multiple streaming aggregations are not supported with streaming DataFrames/Datasets;')
    marca = next((n for n in P.nos(plano) if isinstance(n, MarcaDagua)), None)
    if not finais:
        return None, marca
    fin = finais[0]
    if fin.operacao not in DEDUPLICAR and modo == 'append' and not temporais(fin, marca):
        raise AnalysisException('Append output mode not supported when there are streaming aggregations on streaming '
                                'DataFrames/DataSets without watermark;')
    return fin, marca


class ComEstado:
    def __init__(self, consulta, fin, marca):
        self.consulta, self.fin, self.wm = consulta, fin, marca
        self.dedup = fin.operacao in DEDUPLICAR
        e_base = Entrada(fin.base.saida, fin.ansi)
        self.acumuladores = [a.acumulador(e_base) for a in fin.aggs]
        e = Entrada(list(fin.atributos_chave) + list(fin.atributos_agg), fin.ansi)
        self.final = AgregarFinal(self.acumuladores, [s.compilar(e) for s in fin.saidas], not fin.chaves)
        self.temporais = temporais(fin, marca)
        self.no_topo = topo(consulta._plano) is fin
        self.estado = {}
        self.marca = None            # a marca d'água atual (sem fuso); None antes do primeiro tempo de evento
        self.marca_do_ultimo = None  # a que o último lote usou

    def _tempo(self, chave):
        tempos = [(chave[i][1] if janela else chave[i]) for i, janela in self.temporais if chave[i] is not None]
        return min(tempos) if tempos else None

    def _vencida(self, chave, marca):
        t = self._tempo(chave)
        return marca is not None and t is not None and t <= marca

    def lote(self, acao):
        from ..dataframe import DataFrame
        fin, marca, modo = self.fin, self.marca, self.consulta._modo
        pares = [par for p in fin.filhos[0].rdd()._executar(acao) for par in p]  # a agregação parcial, com o shuffle
        descartadas, novas, atualizadas = 0, [], {}
        for chave, accs in pares:
            if self._vencida(chave, marca):
                descartadas += 1
                continue
            atual = self.estado.get(chave)
            if atual is None:
                novas.append(chave)
                self.estado[chave] = list(accs)
            elif not self.dedup:
                self.estado[chave] = [a.juntar(x, y) for a, x, y in zip(self.acumuladores, atual, accs)]
            atualizadas[chave] = True
        if self.dedup:
            emitir = novas
        elif modo == 'complete':
            emitir = list(self.estado)
        elif modo == 'update':
            emitir = list(atualizadas)
        else:  # append: só a janela que a marca d'água fechou
            emitir = [k for k in self.estado if self._vencida(k, marca)]
        linhas = self.final([(k, self.estado[k]) for k in emitir]) if emitir else []
        removidas = 0
        if modo != 'complete':
            for k in [k for k in self.estado if self._vencida(k, marca)]:
                del self.estado[k]
                removidas += 1
        if not self.no_topo:
            plano = trocar(self.consulta._plano, fin, _Linhas(fin.sessao, fin.saida, linhas))
            linhas = DataFrame(plano, fin.sessao)._linhas(acao)
        self.marca_do_ultimo = marca
        self._atualizar_marca()
        return linhas, {'operador': 'dedupe' if self.dedup else 'stateStoreSave', 'estado': len(self.estado),
                        'atualizadas': len(novas) if self.dedup else len(atualizadas), 'removidas': removidas,
                        'descartadas': descartadas, 'marca_usada': marca, 'marca': self.marca}

    def _atualizar_marca(self):
        """O maior tempo de evento do lote menos o atraso (a marca d'água só anda para a frente)."""
        from ..dataframe import DataFrame
        if self.wm is None:
            return
        filho = self.wm.filhos[0]
        i = [a.id for a in filho.saida].index(self.wm.atributo.id)
        with estagios.local():
            tempos = [linha[i] for linha in DataFrame(filho, filho.sessao)._linhas('marca') if linha[i] is not None]
        if tempos:
            nova = max(tempos) - dt.timedelta(microseconds=self.wm.atraso)
            if self.marca is None or nova > self.marca:
                self.marca = nova

    def precisa_lote_vazio(self):
        """Como o Spark: se a marca d'água andou desde o último lote, um lote sem dados emite e limpa o estado."""
        return (bool(self.temporais) and self.consulta._modo != 'complete' and self.marca is not None
                and self.marca != self.marca_do_ultimo)
```

- [ ] **Step 4: o operador na consulta.** Em `consulta.py`, `_escolher_operador` passa a ser:

```python
    def _escolher_operador(self):
        from .estado import ComEstado, analisar
        fin, marca = analisar(self._plano, self._modo)
        return _SemEstado(self) if fin is None else ComEstado(self, fin, marca)
```

- [ ] **Step 5:** rodar o `test_streaming.py` e ver passar, mais a suíte inteira do pytest. Commit
"Streaming: estado, marca d'água e dropDuplicates".

### Task 5: O streaming no resultado da execução (e no Pyodide)

**Files:**
- Modify: `python/diverge_runtime/execucao.py`
- Test: `python/tests/test_runtime.py`, `tests/spark.test.js`

**Interfaces:**
- Consumes: `streams.terminar()` e `streams.resumo()` (Task 3).
- Produces: o resultado de `executar` ganha `'streaming'`, com o resumo ou `None`.

- [ ] **Step 1: Testes que falham.** Em `python/tests/test_runtime.py`:

```python
def test_streaming_no_resultado():
    codigo = ('from pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()\n'
              'leituras = spark.readStream.schema("estacao STRING, temperatura DOUBLE").csv("leituras", header=True)\n'
              'leituras.writeStream.format("console").queryName("q").start()\n')
    r = execucao.executar({'main.py': codigo, 'leituras/a.csv': 'estacao,temperatura\nCrato,31.5\nSobral,29.0\n'})
    assert r['erro'] is None
    assert 'Batch: 0' in r['saida'] and '|  Crato|' in r['saida']  # o start() sem espera roda no fim do programa
    assert r['streaming'] == {'consultas': [{'nome': 'q', 'modo': 'append', 'formato': 'console', 'lotes': [
        {'id': 0, 'entrada': 2, 'arquivos': ['a.csv'], 'estado': 0, 'marcaDagua': None, 'saida': 2, 'descartadas': 0}]}]}
    assert 'leituras' not in r['tabelas']  # o DataFrame de streaming não tem linhas fora do writeStream
    assert rodar('x = 1\n')['streaming'] is None


def test_erro_do_streaming_no_fim_do_programa_vira_erro_do_aluno():
    codigo = ('from pyspark.sql import SparkSession, functions as F\nspark = SparkSession.builder.getOrCreate()\n'
              'quebra = F.udf(lambda t: 1 // 0, "int")\n'
              'spark.readStream.schema("t DOUBLE").csv("leituras").select(quebra("t")).writeStream.format("console").start()\n')
    r = execucao.executar({'main.py': codigo, 'leituras/a.csv': '1.0\n'})
    assert r['erro']['tipo'] == 'StreamingQueryException'
```

Em `tests/spark.test.js`, depois do teste do Delta:

```js
  it('o streaming roda no Pyodide e o resultado traz os micro-lotes', async () => {
    const r = await rodar(`${INICIO}q = (spark.readStream.schema("estacao STRING, temperatura DOUBLE")\n`
      + '  .option("maxFilesPerTrigger", 1).csv("leituras", header=True).groupBy("estacao").count()\n'
      + '  .writeStream.format("memory").queryName("contagem").outputMode("complete").start())\n'
      + 'q.processAllAvailable()\n'
      + 'total = sorted((r.estacao, r["count"]) for r in spark.table("contagem").collect())\n',
    {
      'leituras/lote-01.csv': 'estacao,temperatura\nCrato,31.5\nSobral,29.0\n',
      'leituras/lote-02.csv': 'estacao,temperatura\nCrato,33.0\n',
    });
    expect(r.erro).toBeNull();
    expect(r.variaveis.total).toEqual([['Crato', 2], ['Sobral', 1]]);
    expect(r.streaming.consultas[0].lotes.map((l) => [l.entrada, l.estado, l.saida])).toEqual([[2, 2, 2], [1, 2, 2]]);
    expect(r.spark.jobs.map((j) => j.acao)).toContain('lote 0 de contagem');
  }, 120_000);
```

- [ ] **Step 2:** rodar e ver falhar (falta `streaming` no resultado).

- [ ] **Step 3: `execucao.py`.** Acrescente `streams` ao import (`from . import deltas, estagios, pool, streams`).
Antes do `try`, junto de `resumo_deltas = {}`, ponha `resumo_streaming = None`. Logo depois do
`exec(codigo, escopo)`, no mesmo `try`, para que um erro ali vire erro do aluno:

```python
            streams.terminar()  # as consultas que ficaram ativas rodam a entrada disponível
```

Depois de `resumo_deltas = deltas.resumo()`:

```python
        resumo_streaming = streams.resumo()
```

No dicionário de volta, depois de `'deltas'`, entra `'streaming': resumo_streaming,`. Em `_tabelas`,
logo depois do `continue` que já existe:

```python
        if getattr(valor, 'isStreaming', False):
            continue  # um DataFrame de streaming não tem linhas fora do writeStream
```

- [ ] **Step 4:** rodar o `test_runtime.py`, o `spark.test.js` e a suíte inteira (pytest e vitest).
Commit "Runtime: micro-lotes do streaming no resultado da execução".

### Task 6: A aba ⚡ Execução ganha os 🌊 Micro-lotes

**Files:**
- Modify: `src/ui/execucao.js`
- Modify: `src/ui/item.js` (`mostrarExecucao` e `falaDoPython`)
- Modify: `src/estilo.css`, perto de `.linha-do-tempo`
- Test: `tests/execucao-ui.test.js`, `tests/item-python.test.js`

**Interfaces:**
- Consumes: `r.streaming` (Task 5).
- Produces: `falaDoStreaming(streaming) -> string`, `htmlDosMicroLotes(streaming) -> string` e
  `htmlDaExecucao(spark, streaming = null)`.

- [ ] **Step 1: Testes que falham.** Em `tests/execucao-ui.test.js`, acrescente `falaDoStreaming` ao
import e, no fim:

```js
const lote = (id, entrada, arquivos, estado, marca, saida, descartadas) => ({
  id, entrada, arquivos, estado, marcaDagua: marca && `2026-01-01T00:${marca}:00.000Z`, saida, descartadas,
});
const STREAM = {
  consultas: [{
    nome: 'janelas', modo: 'append', formato: 'memory',
    lotes: [lote(0, 3, ['lote-01.csv'], 2, '02', 0, 0), lote(1, 2, ['lote-02.csv'], 3, '15', 0, 0),
      lote(2, 2, ['lote-03.csv'], 3, '31', 1, 1), lote(3, 0, [], 1, '31', 2, 0)],
  }],
};

describe('aba ⚡ Execução: 🌊 Micro-lotes', () => {
  it('fala o resumo dos micro-lotes', () => {
    expect(falaDoStreaming(STREAM)).toBe("1 consulta, 4 micro-lotes, 7 linhas lidas, 1 descartada, marca d'água em 00:31");
    const simples = { consultas: [{ nome: null, modo: 'append', formato: 'console', lotes: [lote(0, 1, ['a.csv'], 0, null, 1, 0)] }] };
    expect(falaDoStreaming(simples)).toBe('1 consulta, 1 micro-lote, 1 linha lida');
  });

  it('mostra a linha dos lotes escondida do leitor e a tabela equivalente', () => {
    document.body.innerHTML = htmlDaExecucao(SPARK, STREAM);
    expect(document.querySelector('.micro-lotes h3').textContent).toBe('🌊 Micro-lotes');
    expect(document.querySelector('.micro-lotes h4').textContent).toBe('Consulta janelas · append · memory');
    expect(document.querySelector('.linha-dos-lotes').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('.linha-dos-lotes .lote-bloco')).toHaveLength(4);
    expect(document.querySelector('.tabela-lotes caption').textContent).toBe('Micro-lotes da consulta janelas');
    const colunas = [...document.querySelectorAll('.tabela-lotes thead th')].map((th) => th.textContent);
    expect(colunas).toEqual(['Lote', 'Arquivos', 'Linhas lidas', 'Estado', "Marca d'água", 'Linhas emitidas', 'Descartadas']);
    const ultima = [...document.querySelectorAll('.tabela-lotes tbody tr')].at(-1);
    expect([...ultima.children].map((td) => td.textContent)).toEqual(['3', '—', '0', '1', '00:31', '2', '0']);
    expect(document.querySelector('h3 + p.resumo-streaming')).not.toBeNull();
    expect(document.querySelector('.job')).not.toBeNull(); // os jobs continuam embaixo
  });

  it('sem jobs do Spark, mostra só os micro-lotes', () => {
    document.body.innerHTML = htmlDaExecucao(null, STREAM);
    expect(document.querySelector('.micro-lotes')).not.toBeNull();
    expect(document.querySelector('.resumo-execucao')).toBeNull();
  });
});
```

Em `tests/item-python.test.js`, depois do teste "com jobs do Spark, a aba ⚡ Execução aparece":

```js
  it('com streaming e sem jobs, a aba ⚡ Execução aparece com os micro-lotes e o resumo é falado', async () => {
    const streaming = { consultas: [{ nome: 'q', modo: 'append', formato: 'console', lotes: [{ id: 0, entrada: 2, arquivos: ['a.csv'], estado: 0, marcaDagua: null, saida: 2, descartadas: 0 }] }] };
    const motor = { executar: async () => ({ ms: 1, retornos: [], variaveis: {}, saida: '', erro: null, spark: null, streaming }), interromper() {} };
    const { tela } = montarCom(motor);
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('aba-execucao').hidden).toBe(false);
    expect(document.getElementById('saida-execucao').textContent).toContain('🌊 Micro-lotes');
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.getElementById('anuncio').textContent).toContain('No streaming: 1 consulta, 1 micro-lote, 2 linhas lidas.');
  });
```

- [ ] **Step 2:** rodar e ver falhar (falta `falaDoStreaming`).

- [ ] **Step 3: `src/ui/execucao.js`.** Depois de `falaDaExecucao`:

```js
/** "00:10" (ou "00:10:30", quando há segundos), do momento ISO do Spark. */
const hora = (iso) => {
  const [, h, m, s] = /T(\d\d):(\d\d):(\d\d)/.exec(iso ?? '') ?? [];
  return h ? `${h}:${m}${s === '00' ? '' : `:${s}`}` : '';
};
const nomeDaConsulta = (c, i) => `consulta ${c.nome ?? i + 1}`;

/** "1 consulta, 4 micro-lotes, 12 linhas lidas, 2 descartadas, marca d'água em 00:10". */
export function falaDoStreaming(streaming) {
  const lotes = streaming.consultas.flatMap((c) => c.lotes);
  const lidas = lotes.reduce((soma, l) => soma + l.entrada, 0);
  const descartadas = lotes.reduce((soma, l) => soma + l.descartadas, 0);
  const marcas = streaming.consultas.map((c) => c.lotes.at(-1)?.marcaDagua).filter(Boolean);
  const partes = [plural(streaming.consultas.length, 'consulta', 'consultas'), plural(lotes.length, 'micro-lote', 'micro-lotes'),
    plural(lidas, 'linha lida', 'linhas lidas')];
  if (descartadas) partes.push(plural(descartadas, 'descartada', 'descartadas'));
  if (marcas.length) partes.push(`marca d'água em ${hora(marcas.at(-1))}`);
  return partes.join(', ');
}

function linhaDosLotes(c) {
  const blocos = c.lotes.map((l) => `<li class="lote-bloco"><span class="lote-id">Lote ${l.id}</span>`
    + `<span>⬇ ${l.entrada}</span><span>🗃 ${l.estado}</span>${l.marcaDagua ? `<span>⏱ ${hora(l.marcaDagua)}</span>` : ''}`
    + `<span>⬆ ${l.saida}</span>${l.descartadas ? `<span class="descartadas">✕ ${l.descartadas}</span>` : ''}</li>`).join('');
  return `<ol class="linha-dos-lotes" aria-hidden="true">${blocos}</ol>`;
}

function tabelaDosLotes(c, i) {
  const corpo = c.lotes.map((l) => `<tr><td>${l.id}</td><td class="arquivos">${esc(l.arquivos.join(', ') || '—')}</td>`
    + `<td>${l.entrada}</td><td>${l.estado}</td><td>${l.marcaDagua ? hora(l.marcaDagua) : '—'}</td><td>${l.saida}</td>`
    + `<td>${l.descartadas}</td></tr>`).join('');
  return `<table class="tabela-execucao tabela-lotes"><caption>Micro-lotes da ${esc(nomeDaConsulta(c, i))}</caption>
    <thead><tr><th scope="col">Lote</th><th scope="col">Arquivos</th><th scope="col">Linhas lidas</th><th scope="col">Estado</th><th scope="col">Marca d'água</th><th scope="col">Linhas emitidas</th><th scope="col">Descartadas</th></tr></thead>
    <tbody>${corpo}</tbody></table>`;
}

/** A parte 🌊 Micro-lotes: o resumo e, por consulta, a linha dos lotes (visual) e a tabela. */
export function htmlDosMicroLotes(streaming) {
  const consultas = streaming.consultas.map((c, i) => {
    const id = `consulta-${i + 1}-titulo`;
    const titulo = `Consulta ${c.nome ?? i + 1} · ${c.modo} · ${c.formato}`;
    return `<section class="consulta-stream" aria-labelledby="${id}"><h4 id="${id}">${esc(titulo)}</h4>${linhaDosLotes(c)}${tabelaDosLotes(c, i)}</section>`;
  }).join('');
  return `<section class="micro-lotes" aria-labelledby="micro-lotes-titulo"><h3 id="micro-lotes-titulo">🌊 Micro-lotes</h3>`
    + `<p class="resumo-streaming">${esc(falaDoStreaming(streaming))}</p>${consultas}</section>`;
}
```

O `htmlDaExecucao` passa a ser:

```js
/** O conteúdo da aba: os micro-lotes (com streaming), o resumo, um bloco por job e a nota. */
export function htmlDaExecucao(spark, streaming = null) {
  const lotes = streaming?.consultas?.length ? htmlDosMicroLotes(streaming) : '';
  if (!spark?.jobs?.length) return lotes;
  const jobs = spark.jobs.map((job) => {
    const id = `job-${job.id}-titulo`;
    return `<section class="job" aria-labelledby="${id}"><h3 id="${id}">${esc(tituloDoJob(job))}</h3>${linhaDoTempo(job)}${tabela(job)}</section>`;
  }).join('');
  return `${lotes}<p class="resumo-execucao">${esc(textoDaExecucao(spark))}</p>${jobs}
    <p class="nota-execucao">No Spark de verdade, um shuffle usa 200 partições por padrão; aqui são 4, para caber no navegador.
      O tempo varia de um computador para outro (por isso a correção nunca confere tempo).</p>`;
}
```

- [ ] **Step 4: `src/ui/item.js`.** Acrescente `falaDoStreaming` ao import de `./execucao.js`. Em
`aoTerminarPrograma`, troque `mostrarExecucao(r.spark)` por `mostrarExecucao(r)`. A função passa a
ser:

```js
  /** A aba ⚡ Execução só existe quando o programa rodou algum job do Spark ou algum micro-lote. */
  function mostrarExecucao(r) {
    const tem = Boolean(r?.spark?.jobs?.length || r?.streaming?.consultas?.length);
    const estavaAberta = !$('saida-execucao').hidden;
    $('aba-execucao').hidden = !tem;
    $('saida-execucao').innerHTML = tem ? htmlDaExecucao(r.spark, r.streaming) : '';
    if (!tem && estavaAberta) mostrarSaida('terminal');
  }
```

Em `falaDoPython`, depois de `const spark = …`:

```js
    const stream = r.streaming?.consultas?.length ? `No streaming: ${falaDoStreaming(r.streaming)}.` : '';
```

E a lista do `extra` passa a ser
`[paralelo && !spark && \`Rodou ${paralelo}.\`, spark, stream, avisoSemParalelismo(r.paralelismo)]`.

- [ ] **Step 5: `src/estilo.css`**, depois das regras de `.linha-do-tempo`:

```css
.micro-lotes { margin-bottom: 18px; }
.linha-dos-lotes { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0 0 8px; }
.lote-bloco {
  display: grid; gap: 2px; min-width: 6.5em; padding: 4px 8px; border: 1px solid var(--linha); border-radius: 4px;
  background: var(--fundo-mais-escuro); font-family: var(--fonte-codigo); font-size: 0.85rem;
}
.lote-bloco .lote-id { font-weight: 700; }
.tabela-lotes td.arquivos { text-align: left; }
```

- [ ] **Step 6:** rodar o vitest (os dois arquivos e depois a suíte inteira) e o eslint. Conferir no
preview:
  - um programa com streaming abre a aba ⚡ Execução com os micro-lotes;
  - o axe (WCAG 2.2 AA) não acha nada nos 4 temas;
  - na largura de 375px, os blocos quebram linha sem rolagem horizontal da página. A tabela pode
    rolar dentro dela, como a de tarefas.

  Commit "Aba Execução: micro-lotes do streaming".

### Task 7: Conformidade com o PySpark real

**Files:**
- Create: `python/conformidade/c12_streaming.py`, `python/conformidade/c12.esperado`
- Create: `python/conformidade/c13_janelas.py`, `python/conformidade/c13.esperado`
- Modify: `python/tests/test_conformidade.py`, com o total ajustado de 11 para 13

- [ ] **Step 1: `c12_streaming.py`**

```python
"""Structured Streaming: fontes, modos de saída, estado simples, memory e console."""
import os
import sys

from _comum import erro, sessao, tmp
from pyspark.sql import functions as F

sys.stdout.reconfigure(line_buffering=True)  # o console do streaming (no Spark real, a JVM) sai na ordem dos print
spark = sessao()
pasta = os.path.join(tmp(), 'leituras')
os.makedirs(pasta)
LOTES = {
    'lote-01.csv': ['Crato,2026-01-01 00:01:00,31.5', 'Sobral,2026-01-01 00:04:00,29.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-02.csv': ['Petrolina,2026-01-01 00:25:00,35.0', 'Crato,2026-01-01 00:03:00,30.0'],
    'lote-03.csv': ['Sobral,2026-01-01 00:41:00,28.0', 'Crato,2026-01-01 00:05:00,32.0'],
}
for nome, linhas in LOTES.items():
    with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
        f.write('estacao,momento,temperatura\n' + ''.join(x + '\n' for x in linhas))
SCHEMA = 'estacao STRING, momento TIMESTAMP, temperatura DOUBLE'


def leituras():
    return spark.readStream.schema(SCHEMA).option('maxFilesPerTrigger', 1).csv(pasta, header=True)


def rodar(df, nome, modo, formato='memory'):
    q = df.writeStream.format(formato).queryName(nome).outputMode(modo).trigger(availableNow=True).start()
    q.awaitTermination()
    return q


def tabela(nome):
    return sorted((tuple(r) for r in spark.table(nome).collect()), key=str)


def recusa(df, modo):
    try:
        df.writeStream.format('memory').queryName('recusada').outputMode(modo).start()
    except Exception as e:  # noqa: BLE001
        print(modo, type(e).__name__, 'output mode not supported' in str(e))


erro(lambda: spark.readStream.csv(pasta, header=True))
erro(lambda: spark.range(1).writeStream)
print(leituras().isStreaming, spark.read.schema(SCHEMA).csv(pasta, header=True).isStreaming)
try:
    leituras().count()
except Exception as e:  # noqa: BLE001
    print(type(e).__name__, 'writeStream.start()' in str(e))
recusa(leituras(), 'complete')
recusa(leituras().groupBy('estacao').count(), 'append')

q = rodar(leituras().filter(F.col('temperatura') > 30).select('estacao', 'temperatura'), 'quentes', 'append')
print(q.isActive, [p['numInputRows'] for p in q.recentProgress])
print(tabela('quentes'))

q = rodar(leituras().groupBy('estacao').count(), 'contagem', 'complete')
print([p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress], tabela('contagem'))

rodar(leituras().groupBy('estacao').agg(F.max('temperatura').alias('maxima')), 'maximas', 'update')
print(tabela('maximas'))

rodar(leituras().groupBy('estacao').count().orderBy('estacao'), 'console_contagem', 'complete', 'console')
spark.stop()
```

- [ ] **Step 2: `c13_janelas.py`**, com as mesmas linhas de início (os imports, o
`reconfigure`, a sessão e a pasta) e as funções `leituras`, `rodar` e `tabela` do `c12`. O
`lote-02.csv` ganha uma linha repetida do lote 1, para o `dropDuplicates`:

```python
"""Structured Streaming com o tempo do evento: janelas, marca d'água, append, update e dropDuplicates."""
import os
import sys

from _comum import sessao, tmp
from pyspark.sql import functions as F

sys.stdout.reconfigure(line_buffering=True)  # o console do streaming (no Spark real, a JVM) sai na ordem dos print
spark = sessao()
pasta = os.path.join(tmp(), 'leituras')
os.makedirs(pasta)
LOTES = {
    'lote-01.csv': ['Crato,2026-01-01 00:01:00,31.5', 'Sobral,2026-01-01 00:04:00,29.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-02.csv': ['Petrolina,2026-01-01 00:25:00,35.0', 'Crato,2026-01-01 00:03:00,30.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-03.csv': ['Sobral,2026-01-01 00:41:00,28.0', 'Crato,2026-01-01 00:05:00,32.0'],
}
for nome, linhas in LOTES.items():
    with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
        f.write('estacao,momento,temperatura\n' + ''.join(x + '\n' for x in linhas))
SCHEMA = 'estacao STRING, momento TIMESTAMP, temperatura DOUBLE'


def leituras():
    return spark.readStream.schema(SCHEMA).option('maxFilesPerTrigger', 1).csv(pasta, header=True)


def marcadas():
    return leituras().withWatermark('momento', '10 minutes')


def por_janela():
    return marcadas().groupBy(F.window('momento', '10 minutes')).count()


def rodar(df, nome, modo, formato='memory'):
    q = df.writeStream.format(formato).queryName(nome).outputMode(modo).trigger(availableNow=True).start()
    q.awaitTermination()
    return q


def janelas(nome):
    return sorted((str(r.window.start), str(r.window.end), r['count']) for r in spark.table(nome).collect())


q = rodar(por_janela(), 'janelas', 'append')
print([p['numInputRows'] for p in q.recentProgress])
print([p['eventTime']['watermark'] for p in q.recentProgress])
print([p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress])
print(janelas('janelas'))

q = rodar(por_janela(), 'janelas_update', 'update')
print([p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress], janelas('janelas_update'))

q = rodar(marcadas().dropDuplicates(['estacao', 'momento']), 'unicas', 'append')
print([p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress], len(spark.table('unicas').collect()))

rodar(leituras().groupBy(F.window('momento', '10 minutes', '5 minutes')).count(), 'deslizante', 'complete')
print(janelas('deslizante'))

rodar(por_janela(), 'console_janelas', 'append', 'console')
spark.stop()
```

- [ ] **Step 3: gravar e conferir o esperado.** Grave com o nosso
(`python python/conformidade/rodar.py --gravar c12_streaming c13_janelas`) e confira à mão contra a
conta abaixo, que segue a seção 1.2 da spec. O `c12.esperado` tem que ter, nesta ordem:
  1. `IllegalArgumentException | Schema must be specified when creating a streaming source DataFrame. …`
     (a frase inteira do `SEM_SCHEMA`);
  2. `AnalysisException | [WRITE_STREAM_NOT_ALLOWED] 'writeStream' can be called only on streaming Dataset/DataFrame. SQLSTATE: 42601`;
  3. `True False`;
  4. `AnalysisException True`;
  5. `complete AnalysisException True`;
  6. `append AnalysisException True`;
  7. `False [3, 2, 2]`;
  8. `[('Crato', 31.5), ('Crato', 32.0), ('Crato', 33.0), ('Petrolina', 35.0)]`;
  9. `[2, 3, 3] [('Crato', 4), ('Petrolina', 1), ('Sobral', 2)]`;
  10. `[('Crato', 33.0), ('Crato', 33.0), ('Crato', 33.0), ('Petrolina', 35.0), ('Sobral', 29.0), ('Sobral', 29.0)]`;
  11. o console com `Batch: 0` (Crato 2, Sobral 1), `Batch: 1` (Crato 3, Petrolina 1, Sobral 1) e
      `Batch: 2` (Crato 4, Petrolina 1, Sobral 2).

  O `c13.esperado`:
  1. `[3, 3, 2, 0]`;
  2. `['1970-01-01T00:00:00.000Z', '2026-01-01T00:02:00.000Z', '2026-01-01T00:15:00.000Z', '2026-01-01T00:31:00.000Z']`;
  3. `[0, 0, 1, 0]`;
  4. as janelas `00:00–00:10` com 3, `00:10–00:20` com 2 e `00:20–00:30` com 1;
  5. `[2, 3, 3, 1]` e as linhas do update: `00:00–00:10` com 2 e com 3, `00:10–00:20` com 1 e com 2,
     `00:20–00:30` com 1, e `00:40–00:50` com 1;
  6. `[0, 0, 1, 0] 6`;
  7. a deslizante: `23:55–00:05` com 3, `00:00–00:10` com 4, `00:05–00:15` com 3, `00:10–00:20` com 2,
     e `00:20–00:30`, `00:25–00:35`, `00:35–00:45` e `00:40–00:50` com 1;
  8. o console dos quatro lotes do append:
     - os lotes 0 e 1 só com o cabeçalho;
     - o lote 2 com a janela `{2026-01-01 00:0...` e 3;
     - o lote 3 com duas linhas.

  Depois, rode `python python/conformidade/rodar.py` (os 13 iguais) e o `test_conformidade.py`.
  Commit "Conformidade: Structured Streaming contra o PySpark 4.0".

- [ ] **Step 4:** a suíte inteira:
  - pytest;
  - conformidade com o nosso `pyspark`;
  - vitest;
  - eslint.

  Revisão final. Depois, apagar a área de trabalho do SDD.

- [ ] **Step 5 (só com o "sim"): conferir no CI.**
  - Faça o push do branch `fase5`. O PR em rascunho
    [sertaoseracloud/python-playground#2](https://github.com/sertaoseracloud/python-playground/pull/2)
    roda a conformidade de novo, sem publicar o site.
  - Se o `c12` ou o `c13` divergirem do Spark real, ajuste o nosso streaming para dar a saída real, e
    não o contrário.
  - Uma diferença impossível de evitar vira nota na declaração de acessibilidade e na página sobre
    (spec 4, no plano 4), nunca um teste desligado sem explicação.
  - O PR continua em rascunho.
