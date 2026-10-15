# Fase 6, plano 1: 🏗️ Projetos de DataFrame e SQL (0.6.0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o módulo 🏗️ Projetos com os 6 projetos de DataFrame e SQL (30 etapas), o modelo `criarProjeto` em Python e as três peças que faltam no motor (percentis, arquivo inteiro e timestamp em segundos), na versão 0.6.0.

**Architecture:** `src/conteudo/projetos/base.js` monta cada projeto como no DivergePHP: uma lição "Visão geral" e 5 etapas; a solução da etapa N é a da N-1 mais o trecho novo do `main.py` (`codigo`) ou os arquivos trocados (`alteracoes`), e o código inicial da etapa N é a solução da N-1. Cada projeto fica num arquivo; `projetos/index.js` monta o `moduloProjetos`. O motor ganha `F.percentile_approx`, `sc.wholeTextFiles` e o CAST de TIMESTAMP para BIGINT, conferidos contra o PySpark real no CI (`c16`). A tela já continua do código do aluno; falta só não desenhar troféu num módulo sem certificado.

**Tech Stack:** JavaScript (ES modules), Vite, vitest, eslint; Python 3.14 (Pyodide no site, CPython nos testes), pytest; o `pyspark` próprio em `python/pyspark/`.

**Spec:** `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md` (seções 1 "0.6.0", 2, 3, 5, 6 e 7).

## Global Constraints

- Módulo `projetos`, título "Projetos", ícone 🏗️; sai de `PROXIMOS_MODULOS` (a lista fica vazia) e vem depois de `alem`.
- 6 projetos, nesta ordem: `palavras` 📚, `vendas-regiao` 🛒, `logs` 📜, `funil` 🧺, `painel` 📊, `notas` 📝.
- Cada projeto: a lição `<id>-visao-geral` e as etapas `<id>-1` a `<id>-5`, com as dificuldades **fácil, médio, médio, difícil, difícil**.
- Todo dado é escrito à mão, pequeno, com tema brasileiro; cada etapa tem um caso oculto com outros dados e **os mesmos nomes de arquivo** (o oculto não traz arquivo que o visível não tenha).
- Os textos dos livros são versos curtos escritos por nós, no estilo do cordel; nenhum trecho de obra publicada.
- Sem regra de correção nova: `dataframe` (com `ordem` quando a ordem importa), `plano`, `arquivo`, `stream`, `modelo`, `delta`.
- Os projetos não têm certificado próprio; o módulo não ganha troféu na trilha. O certificado final fica para a 1.0.0.
- Versão **0.6.0**. Publicar (push, PR, merge, tag) só com o "sim" do usuário.
- Commits como `Cláudio Raposo <engcfraposo@gmail.com>` (via `git -c user.name=... -c user.email=...`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O valor de `CERTIFICADO_SEGREDO` nunca aparece no código nem no site; o build local usa um valor aleatório: `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.
- Neste Windows o `rtk` esconde saídas: use `rtk proxy <comando>`; leia o pytest de um arquivo, com `PYTHONIOENCODING=utf-8`. Código JS com barra invertida vai pelo Edit/Write, nunca por heredoc.
- Código Python dentro de template literal do JS: toda barra invertida do Python é escrita dobrada (`\\s+` no JS vira `\s+` no Python).

## Review Focus

1. **Caso oculto com menos arquivos que o visível**: o arquivo do visível que o oculto não troca continua valendo no oculto (o `corrigir` junta os dois). Só pode acontecer de propósito (`vazias.txt`, `produtos.csv`, `clientes.csv` e `metas.csv` são trocados ou compartilhados de propósito). Teste na Task 3 (`tests/projetos.test.js`: as chaves do oculto são um subconjunto das do visível).
2. **Etapa anterior resolvida, mas sem rascunho salvo** (outro navegador, dados apagados): o editor abre com a solução de referência da etapa anterior, sem quebrar. Teste na Task 3 (`tests/projetos-ui.test.js`).
3. **`percentile_approx` com nulos, grupo vazio e percentual fora de [0, 1]** (o aluno escreve `95` em vez de `0.95`): nulos não contam, grupo vazio dá `None`, e o percentual errado dá `AnalysisException`, como no Spark. Testes na Task 1.
4. **`wholeTextFiles` numa pasta que não existe**: preguiçoso como o `textFile`; o erro `PATH_NOT_FOUND` só aparece na ação. Teste na Task 1.
5. **Módulo sem certificado nas telas** (trilha, landing, painel do jogador): sem troféu, sem `CERTIFICADOS[undefined]`, e a contagem de certificados da landing continua certa. Testes na Task 3.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `python/pyspark/sql/agregacoes.py` | Acumulador `Percentil` e a agregação `percentile_approx` (tipo, entrada, acumulador). |
| `python/pyspark/sql/functions.py` | `F.percentile_approx(col, percentage, accuracy=10000)`. |
| `python/pyspark/context.py` | `sc.wholeTextFiles(path)`: pares `(file:/caminho, conteúdo)`, um arquivo por partição. |
| `python/pyspark/sql/column.py` | CAST de TIMESTAMP para inteiro: segundos desde 1970. |
| `python/tests/test_spark_projetos.py` (novo) | Testes das três peças do motor. |
| `python/conformidade/c16_projetos.py` + `c16.esperado` (novos) | As mesmas peças, comparadas com o PySpark real no CI. |
| `src/conteudo/projetos/base.js` (novo) | `criarProjeto`. |
| `src/conteudo/projetos/palavras.js`, `vendas-regiao.js`, `logs.js`, `funil.js`, `painel.js`, `notas.js` (novos) | Um projeto cada: dados, lição e 5 etapas. |
| `src/conteudo/projetos/index.js` (novo) | `moduloProjetos`. |
| `src/conteudo/trilha.js` | O módulo na trilha; `PROXIMOS_MODULOS` vazio. |
| `src/ui/inicio.js` | Certificado do módulo pelo id; sem troféu quando o módulo não tem certificado. |
| `src/conteudo/glossario.js` | Termos dos projetos: percentil, palavras vazias, funil. |
| `tests/projetos-base.test.js`, `tests/projetos.test.js`, `tests/projetos-ui.test.js` (novos) | O modelo, a estrutura do módulo e a tela. |
| `tests/conteudo.test.js`, `tests/landing.test.js`, `tests/glossario.test.js` | Ajustes para o módulo novo. |
| Documentação | README, novidades 0.6.0, spec, `package.json`, capa. |

---

### Task 1: O motor ganha percentis, arquivos inteiros e timestamp em segundos

**Files:**
- Create: `python/tests/test_spark_projetos.py`, `python/conformidade/c16_projetos.py`, `python/conformidade/c16.esperado`
- Modify: `python/pyspark/sql/agregacoes.py`, `python/pyspark/sql/functions.py`, `python/pyspark/context.py`, `python/pyspark/sql/column.py`

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `F.percentile_approx(col, percentage, accuracy=10000)` (percentage `float` ou lista; devolve o tipo da coluna, ou `array<tipo>` para lista); `spark.sparkContext.wholeTextFiles(path)` → RDD de `(str 'file:/…/nome.txt', str conteúdo)`; `F.col(ts).cast("long")` → segundos (`bigint`). As Tasks 3, 5 e 8 usam as três.

- [ ] **Step 1: Write the failing tests**

Crie `python/tests/test_spark_projetos.py`:

```python
"""O que os projetos usam do motor: percentile_approx, wholeTextFiles e o CAST de timestamp para segundos."""
import pytest

from diverge_runtime import estagios
from pyspark.errors import AnalysisException
from pyspark.sql import SparkSession, Window
from pyspark.sql import functions as F

NOTAS = [('A', 9.0), ('A', 7.0), ('A', 5.0), ('B', 6.0), ('B', 8.0), ('B', 4.0), ('C', 10.0), ('C', 3.0)]


@pytest.fixture
def spark():
    estagios.zerar()
    return SparkSession.builder.appName('teste').getOrCreate()


def test_percentil_como_o_spark(spark):
    # O valor de posição ceil(p * n) na lista ordenada (exato com poucos dados, como no Spark).
    notas = spark.createDataFrame(NOTAS, ['turma', 'nota'])
    linha = notas.agg(*[F.percentile_approx('nota', p).alias(f'p{i}') for i, p in enumerate((0.0, 0.25, 0.5, 0.75, 0.9, 1.0))]).first()
    assert list(linha) == [3.0, 4.0, 6.0, 8.0, 10.0, 10.0]
    medianas = notas.groupBy('turma').agg(F.percentile_approx('nota', 0.5).alias('m')).orderBy('turma').collect()
    assert [(r.turma, r.m) for r in medianas] == [('A', 7.0), ('B', 6.0), ('C', 3.0)]
    assert notas.agg(F.percentile_approx('nota', [0.1, 0.5, 0.95])).first()[0] == [3.0, 6.0, 10.0]


def test_percentil_tipo_nulos_e_grupo_vazio(spark):
    ms = spark.createDataFrame([(120,), (100,), (None,), (30,), (140,)], 'ms INT')
    r = ms.agg(F.percentile_approx('ms', 0.95).alias('p95'))
    assert r.dtypes == [('p95', 'int')]
    assert r.first().p95 == 140
    assert ms.agg(F.percentile_approx('ms', [0.5]).alias('l')).dtypes == [('l', 'array<int>')]
    assert spark.createDataFrame([], 'x DOUBLE').agg(F.percentile_approx('x', 0.5)).first()[0] is None


def test_percentil_fora_de_0_a_1_e_coluna_de_texto(spark):
    ms = spark.createDataFrame([(1,)], 'ms INT')
    with pytest.raises(AnalysisException, match='between'):
        ms.agg(F.percentile_approx('ms', 95)).collect()
    with pytest.raises(AnalysisException, match='NUMERIC'):
        spark.createDataFrame([('a',)], ['t']).agg(F.percentile_approx('t', 0.5)).collect()


def test_whole_text_files(spark, tmp_path):
    livros = tmp_path / 'livros'
    livros.mkdir()
    (livros / 'b.txt').write_text('mar\n', encoding='utf-8')
    (livros / 'a.txt').write_text('sertão\nseca\n', encoding='utf-8')
    pares = spark.sparkContext.wholeTextFiles(str(livros)).collect()
    assert sorted((c.rsplit('/', 1)[-1], t) for c, t in pares) == [('a.txt', 'sertão\nseca\n'), ('b.txt', 'mar\n')]
    assert all(c.startswith('file:') and '\\' not in c for c, _ in pares)
    df = spark.sparkContext.wholeTextFiles(str(livros)).toDF(['caminho', 'texto'])
    nomes = df.select(F.regexp_extract('caminho', r'([^/]+)\.txt$', 1).alias('livro')).collect()
    assert sorted(r.livro for r in nomes) == ['a', 'b']


def test_whole_text_files_numa_pasta_que_nao_existe(spark, tmp_path):
    rdd = spark.sparkContext.wholeTextFiles(str(tmp_path / 'nada'))  # preguiçoso: ainda não leu
    with pytest.raises(AnalysisException, match='PATH_NOT_FOUND|Path does not exist'):
        rdd.collect()


def test_timestamp_em_segundos(spark):
    t = (spark.createDataFrame([('x', '2026-10-15 09:00:05'), ('x', '2026-10-15 09:10:00'), ('x', '2026-10-15 10:40:00')], ['ip', 'm'])
         .withColumn('m', F.to_timestamp('m')))
    s = F.col('m').cast('long')
    intervalos = t.select((s - F.lag(s).over(Window.partitionBy('ip').orderBy('m'))).alias('i')).collect()
    assert [r.i for r in intervalos] == [None, 595, 5400]
    assert t.select(s.alias('s')).dtypes == [('s', 'bigint')]
    assert t.select(s.alias('s')).first().s == 1792054805  # 2026-10-15 09:00:05 contado como UTC
```

- [ ] **Step 2: Run them to verify they fail**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests/test_spark_projetos.py -q -p no:randomly > $TEMP/pt.txt 2>&1; tail -8 $TEMP/pt.txt`
Expected: 6 failed — `AttributeError: module 'pyspark.sql.functions' has no attribute 'percentile_approx'`, `AttributeError: 'SparkContext' object has no attribute 'wholeTextFiles'` e `NumberFormatException: [CAST_INVALID_INPUT] ... TIMESTAMP ... BIGINT`.

- [ ] **Step 3: percentile_approx**

Em `python/pyspark/sql/agregacoes.py`, logo antes de `class ComFiltro(Acumulador):`, acrescente:

```python
class Percentil(Acumulador):
    """percentile_approx: guarda os valores e, no fim, pega o de posição ceil(p * n) da lista
    ordenada, como o QuantileSummaries do Spark (exato enquanto houver até `accuracy` valores)."""

    def __init__(self, percentis):
        self.percentis = percentis  # um float ou uma lista de floats

    def zero(self):
        return []

    def somar(self, acc, v):
        return acc if v is None else acc + [v]

    def juntar(self, a, b):
        return a + b

    def fim(self, acc):
        if not acc:
            return None
        ordenados = sorted(acc)
        n = len(ordenados)

        def um(p):
            return ordenados[min(n - 1, max(0, math.ceil(p * n) - 1))]
        return [um(p) for p in self.percentis] if isinstance(self.percentis, list) else um(self.percentis)
```

Ainda em `agregacoes.py`, na classe `Agg`:

1. Em `tipo(self, e)`, logo antes de `if f in ('collect_list', 'collect_set'):`, acrescente:

```python
        if f == 'percentile_approx':
            if not isinstance(t, T.NUMERICOS):
                raise _tipo_errado(self, t, 'NUMERIC')
            return T.ArrayType(t, False) if isinstance(self.args[1].valor, list) else t
```

2. Em `acumulador(self, e)`, troque a linha `base = {` por:

```python
        if f == 'percentile_approx':
            base = Percentil(self.args[1].valor)
        else:
            base = {
```

e indente o dicionário inteiro mais 4 espaços, terminando em `}[f]` (a linha `}[f]` também indentada dentro do `else:`).

3. Em `entrada_do_valor(self, e)`, troque `fs = [a.compilar(e) for a in self.args]` por:

```python
        # O percentil e a precisão do percentile_approx são constantes: só a coluna entra no acumulador.
        args = self.args[:1] if self.funcao == 'percentile_approx' else self.args
        fs = [a.compilar(e) for a in args]
```

Em `python/pyspark/sql/functions.py`, logo depois de `approxCountDistinct = approx_count_distinct`, acrescente:

```python


def percentile_approx(col, percentage, accuracy=10000):
    """O percentil (ou a lista de percentis) da coluna: o menor valor da lista ordenada com pelo menos
    essa fração dos valores menores ou iguais a ele. Com poucos dados, é exato, como no Spark."""
    from ..errors import AnalysisException
    from .agregacoes import Agg
    lista = isinstance(percentage, (list, tuple))
    valores = [float(p) for p in percentage] if lista else [float(percentage)]
    fora = next((p for p in valores if not 0.0 <= p <= 1.0), None)
    if fora is not None:
        raise AnalysisException(
            f'Cannot resolve "percentile_approx({para_expr(col).nome()}, {percentage}, {accuracy})" due to data type mismatch: '
            f'The percentage must be between [0.0, 1.0], but got {percentage}.',
            'DATATYPE_MISMATCH.VALUE_OUT_OF_RANGE', {}, '42K09')
    return Column(Agg('percentile_approx', [para_expr(col), Lit(valores if lista else valores[0]), Lit(int(accuracy))]))
```

(`para_expr`, `Column` e `Lit` já estão importados no topo de `functions.py`; confira com `grep -n "^from\|^import" python/pyspark/sql/functions.py`. Se `para_expr` não estiver, importe de `.column`, como os outros.)

- [ ] **Step 4: wholeTextFiles**

Em `python/pyspark/context.py`, logo depois do método `textFile`, acrescente:

```python
    def wholeTextFiles(self, path, minPartitions=None, use_unicode=True):
        """Pares (caminho, conteúdo), um por arquivo da pasta. O caminho vem como no Spark: file:/... ."""
        caminho = os.path.abspath(path)
        return _Fonte(self, 'wholeTextFiles', carregar=_LerInteiros(caminho), n=max(1, len(_arquivos(caminho))))
```

e, logo depois da classe `_LerLinhas`, a classe:

```python
class _LerInteiros:
    """Lê no processo principal: cada arquivo inteiro numa partição, com o caminho como no Spark."""

    def __init__(self, caminho):
        self.caminho = caminho

    def __call__(self):
        if not os.path.exists(self.caminho):
            raise caminho_nao_existe(self.caminho)
        particoes = []
        for arquivo in _arquivos(self.caminho):
            with open(arquivo, encoding='utf-8', newline='') as f:
                particoes.append([('file:' + arquivo.replace('\\', '/'), f.read())])
        return particoes
```

- [ ] **Step 5: CAST de TIMESTAMP para inteiro**

Em `python/pyspark/sql/column.py`, acrescente `import calendar` aos imports do topo (em ordem alfabética, antes de `import datetime`). Em `converter`, no ramo `if isinstance(para, (T.IntegerType, T.LongType, T.ShortType, T.ByteType)):`, logo antes de `if isinstance(valor, str):`, acrescente:

```python
        if isinstance(valor, datetime.datetime):
            # TIMESTAMP → segundos desde 1970. O relógio daqui não tem fuso: a hora conta como UTC.
            return calendar.timegm(valor.timetuple())
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests/test_spark_projetos.py -q -p no:randomly > $TEMP/pt.txt 2>&1; tail -3 $TEMP/pt.txt`
Expected: `6 passed`.

- [ ] **Step 7: Conformidade com o PySpark real**

Crie `python/conformidade/c16_projetos.py`:

```python
"""Projetos: percentile_approx, wholeTextFiles e o CAST de timestamp para segundos."""
import os

from pyspark.sql import Window
from pyspark.sql import functions as F

from _comum import sessao, tmp

spark = sessao()
pasta = tmp()

notas = spark.createDataFrame([('A', 9.0), ('A', 7.0), ('A', 5.0), ('B', 6.0), ('B', 8.0), ('B', 4.0), ('C', 10.0), ('C', 3.0)], ['turma', 'nota'])
notas.agg(*[F.percentile_approx('nota', p).alias(f'p{i}') for i, p in enumerate((0.0, 0.25, 0.5, 0.75, 0.9, 1.0))]).show()
notas.groupBy('turma').agg(F.percentile_approx('nota', 0.5).alias('mediana')).orderBy('turma').show()
print(notas.agg(F.percentile_approx('nota', [0.1, 0.5, 0.95])).first()[0])
ms = spark.createDataFrame([(120,), (100,), (None,), (30,), (140,)], 'ms INT')
r = ms.agg(F.percentile_approx('ms', 0.95).alias('p95'))
print(r.dtypes, r.first().p95)
print(spark.createDataFrame([], 'x DOUBLE').agg(F.percentile_approx('x', 0.5)).first()[0])

livros = os.path.join(pasta, 'livros')
os.makedirs(livros)
for nome, texto in (('b.txt', 'mar\n'), ('a.txt', 'sertão\nseca\n')):
    with open(os.path.join(livros, nome), 'w', encoding='utf-8') as f:
        f.write(texto)
pares = spark.sparkContext.wholeTextFiles(livros).collect()
print(sorted((caminho.rsplit('/', 1)[-1], texto) for caminho, texto in pares))
print(all(c.startswith('file:') for c, _ in pares))
df = spark.sparkContext.wholeTextFiles(livros).toDF(['caminho', 'texto'])
df.select(F.regexp_extract('caminho', r'([^/]+)\.txt$', 1).alias('livro')).orderBy('livro').show()

t = (spark.createDataFrame([('x', '2026-10-15 09:00:05'), ('x', '2026-10-15 09:10:00'), ('x', '2026-10-15 10:40:00')], ['ip', 'm'])
     .withColumn('m', F.to_timestamp('m')))
s = F.col('m').cast('long')
t.select((s - F.lag(s).over(Window.partitionBy('ip').orderBy('m'))).alias('intervalo')).show()
print(t.select(s.alias('s')).dtypes)

spark.stop()
```

(Não imprime o valor absoluto dos segundos: no Spark real ele depende do fuso da sessão; a diferença entre dois momentos, não.)

Run: `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py --gravar c16_projetos > $TEMP/c.txt 2>&1; tail -3 $TEMP/c.txt; cat python/conformidade/c16.esperado`
Expected: o arquivo `c16.esperado` gravado, com as tabelas `p0..p5` = `3.0|4.0|6.0|8.0|10.0|10.0`, medianas `A 7.0 / B 6.0 / C 3.0`, `[3.0, 6.0, 10.0]`, `[('p95', 'int')] 140`, `None`, `[('a.txt', 'sertão\nseca\n'), ('b.txt', 'mar\n')]`, `True`, os livros `a` e `b`, os intervalos `NULL / 595 / 5400` e `[('s', 'bigint')]`.

Depois: `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py > $TEMP/c.txt 2>&1; tail -2 $TEMP/c.txt`
Expected: `16/16` programas iguais ao esperado.

(O CI roda o `c16` no PySpark 4.0.1 real e compara com este esperado. Se o CI acusar diferença, o real manda: ajuste o motor, nunca o esperado à mão.)

- [ ] **Step 8: A suíte Python inteira continua verde**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > $TEMP/pt.txt 2>&1; tail -2 $TEMP/pt.txt`
Expected: `passed`, nenhum `failed`.

- [ ] **Step 9: Commit**

```bash
git add python/pyspark/sql/agregacoes.py python/pyspark/sql/functions.py python/pyspark/context.py python/pyspark/sql/column.py python/tests/test_spark_projetos.py python/conformidade/c16_projetos.py python/conformidade/c16.esperado
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "PySpark: percentile_approx, wholeTextFiles e timestamp em segundos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: O modelo `criarProjeto`

**Files:**
- Create: `src/conteudo/projetos/base.js`, `tests/projetos-base.test.js`

**Interfaces:**
- Consumes: `programa(app, codigo)` de `src/conteudo/pyspark-comum.js` (devolve `{ 'main.py': sessão + '\n' + codigo }`).
- Produces: `criarProjeto({ id, titulo, icone, descricao, resumo, dados, oculto, inicial, etapas })` → `{ grupo, itens }`.
  - `inicial`: o código depois da SparkSession (string). `dados` e `oculto`: `{ nome: conteúdo }`.
  - Cada etapa: `{ titulo, dificuldade, enunciado, dica, codigo?, alteracoes?, regras, regrasOcultas? }`. `codigo` entra no fim do `main.py`, depois de uma linha em branco; `alteracoes` troca arquivos (`null` apaga).
  - Itens: a lição `{ id: '<id>-visao-geral', tipo: 'licao', grupo, titulo: 'Visão geral do projeto', resumo, arquivos, dados }` e as etapas `{ id: '<id>-N', tipo: 'problema', grupo, projeto: grupo, etapa: N, totalEtapas, etapaAnterior, titulo: 'Etapa N: …', dificuldade, enunciado, dica, dados, arquivos, solucao, testes }`, com `testes = [{ descricao: <primeiro arquivo de dados>, regras }, { descricao: 'outros dados', oculto: true, dados: oculto, regras: regrasOcultas ?? regras }]`.

- [ ] **Step 1: Write the failing test**

Crie `tests/projetos-base.test.js`:

```js
// O modelo dos projetos: cada etapa parte da solução da anterior.
import { describe, it, expect } from 'vitest';
import { criarProjeto } from '../src/conteudo/projetos/base.js';
import { programa } from '../src/conteudo/pyspark-comum.js';

const projeto = () => criarProjeto({
  id: 'teste',
  titulo: 'Teste',
  icone: '🧪',
  descricao: 'Um projeto de teste.',
  resumo: '<p>Resumo.</p>',
  dados: { 'a.csv': 'x\n1\n', 'b.csv': 'y\n2\n' },
  oculto: { 'a.csv': 'x\n9\n' },
  inicial: 'print(1)\n',
  etapas: [
    { titulo: 'Um', dificuldade: 'facil', enunciado: '<p>1</p>', dica: 'd1', codigo: 'a = 1\n', regras: [{ variavel: 'a', igual: 1 }] },
    { titulo: 'Dois', dificuldade: 'medio', enunciado: '<p>2</p>', dica: 'd2', alteracoes: { 'aaa.py': 'X = 2\n' }, regras: [{ variavel: 'b', igual: 2 }], regrasOcultas: [{ variavel: 'b', igual: 3 }] },
    { titulo: 'Três', dificuldade: 'dificil', enunciado: '<p>3</p>', dica: 'd3', alteracoes: { 'aaa.py': null }, codigo: 'c = 3', regras: [{ variavel: 'c', igual: 3 }] },
  ],
});

describe('criarProjeto', () => {
  it('o grupo e a lição de visão geral, com o código inicial e os dados', () => {
    const { grupo, itens } = projeto();
    expect(grupo).toEqual({ id: 'teste', titulo: 'Teste', icone: '🧪', descricao: 'Um projeto de teste.' });
    expect(itens).toHaveLength(4);
    expect(itens[0]).toEqual({
      id: 'teste-visao-geral', tipo: 'licao', grupo: 'teste', titulo: 'Visão geral do projeto', resumo: '<p>Resumo.</p>',
      arquivos: programa('teste', 'print(1)\n'), dados: { 'a.csv': 'x\n1\n', 'b.csv': 'y\n2\n' },
    });
  });

  it('a solução de cada etapa é a anterior com o trecho novo; o código inicial é a solução da anterior', () => {
    const [, um, dois, tres] = projeto().itens;
    expect(um.arquivos).toEqual(programa('teste', 'print(1)\n'));
    expect(um.solucao).toEqual(programa('teste', 'print(1)\n\na = 1\n'));
    expect(dois.arquivos).toEqual(um.solucao);
    expect(Object.keys(dois.solucao)).toEqual(['main.py', 'aaa.py']); // main.py sempre primeiro
    expect(tres.arquivos).toEqual(dois.solucao);
    expect(tres.solucao).toEqual(programa('teste', 'print(1)\n\na = 1\n\nc = 3\n'));
  });

  it('as etapas sabem o projeto, a posição e a anterior', () => {
    const [, um, dois, tres] = projeto().itens;
    expect(um).toMatchObject({ id: 'teste-1', tipo: 'problema', grupo: 'teste', etapa: 1, totalEtapas: 3, etapaAnterior: null, titulo: 'Etapa 1: Um', dificuldade: 'facil' });
    expect(dois).toMatchObject({ id: 'teste-2', etapa: 2, etapaAnterior: 'teste-1', titulo: 'Etapa 2: Dois' });
    expect(tres.etapaAnterior).toBe('teste-2');
    expect(um.projeto).toEqual(projeto().grupo);
    expect(um.dados).toEqual({ 'a.csv': 'x\n1\n', 'b.csv': 'y\n2\n' });
  });

  it('um caso visível com os dados e um oculto com os outros dados', () => {
    const [, um, dois] = projeto().itens;
    expect(um.testes).toEqual([
      { descricao: 'a.csv', regras: [{ variavel: 'a', igual: 1 }] },
      { descricao: 'outros dados', oculto: true, dados: { 'a.csv': 'x\n9\n' }, regras: [{ variavel: 'a', igual: 1 }] },
    ]);
    expect(dois.testes[1].regras).toEqual([{ variavel: 'b', igual: 3 }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/projetos-base.test.js > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |Error" $TEMP/v.txt | head -5`
Expected: FAIL, `Failed to load url ../src/conteudo/projetos/base.js` (o arquivo não existe).

- [ ] **Step 3: Write the implementation**

Crie `src/conteudo/projetos/base.js`:

```js
// Monta um projeto com etapas encadeadas (o mesmo modelo do DivergePHP).
//
// Cada etapa declara só o que muda: `codigo` entra no fim do main.py, e `alteracoes` troca
// arquivos (null apaga um arquivo). A solução da etapa N é a da etapa N-1 com essas mudanças,
// e o código inicial da etapa N é a solução da N-1. Assim o aluno constrói o pipeline aos
// poucos. Na tela, quem resolveu a etapa anterior continua do próprio código (src/ui/item.js).
import { programa } from '../pyspark-comum.js';

const comFimDeLinha = (texto) => texto.replace(/\n*$/, '\n');

function aplicar(base, { codigo, alteracoes = {} }) {
  const resultado = { ...base };
  if (codigo) resultado['main.py'] = `${comFimDeLinha(resultado['main.py'])}\n${comFimDeLinha(codigo)}`;
  for (const [nome, conteudo] of Object.entries(alteracoes)) {
    if (conteudo === null) delete resultado[nome];
    else resultado[nome] = conteudo;
  }
  // main.py sempre primeiro: é o arquivo que roda.
  const { 'main.py': principal, ...resto } = resultado;
  return principal === undefined ? resultado : { 'main.py': principal, ...resto };
}

export function criarProjeto({ id, titulo, icone, descricao, resumo, dados, oculto, inicial, etapas }) {
  const grupo = { id, titulo, icone, descricao };
  const arquivos = programa(id, inicial);
  const itens = [{ id: `${id}-visao-geral`, tipo: 'licao', grupo: id, titulo: 'Visão geral do projeto', resumo, arquivos, dados }];

  let anterior = arquivos;
  let idAnterior = null;
  etapas.forEach((etapa, i) => {
    const solucao = aplicar(anterior, etapa);
    const item = {
      id: `${id}-${i + 1}`,
      tipo: 'problema',
      grupo: id,
      projeto: grupo,
      etapa: i + 1,
      totalEtapas: etapas.length,
      etapaAnterior: idAnterior,
      titulo: `Etapa ${i + 1}: ${etapa.titulo}`,
      dificuldade: etapa.dificuldade,
      enunciado: etapa.enunciado,
      dica: etapa.dica,
      dados,
      arquivos: anterior,
      solucao,
      testes: [
        { descricao: Object.keys(dados)[0], regras: etapa.regras },
        { descricao: 'outros dados', oculto: true, dados: oculto, regras: etapa.regrasOcultas ?? etapa.regras },
      ],
    };
    itens.push(item);
    anterior = solucao;
    idAnterior = item.id;
  });

  return { grupo, itens };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `rtk proxy npx vitest run tests/projetos-base.test.js > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests " $TEMP/v.txt`
Expected: `Tests  4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/projetos/base.js tests/projetos-base.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: o modelo criarProjeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: O módulo 🏗️ Projetos na trilha, com 📚 Contagem de palavras

**Files:**
- Create: `src/conteudo/projetos/palavras.js`, `src/conteudo/projetos/index.js`, `tests/projetos.test.js`, `tests/projetos-ui.test.js`
- Modify: `src/conteudo/trilha.js`, `src/ui/inicio.js:118-135,181,280`, `tests/conteudo.test.js:18-31`, `tests/landing.test.js:7`

**Interfaces:**
- Consumes: `criarProjeto` (Task 2); `F.percentile_approx` não; `sc.wholeTextFiles` (Task 1); `py` de `src/conteudo/util.js`.
- Produces: `projetoPalavras` (`{ grupo, itens }`); `moduloProjetos` em `src/conteudo/projetos/index.js`, com `PROJETOS` (a lista de projetos, que as Tasks 4 a 8 aumentam); `tests/projetos.test.js` com a constante `IDS` (que as Tasks 4 a 8 aumentam).

- [ ] **Step 1: Write the failing tests**

Crie `tests/projetos.test.js`:

```js
// Módulo 🏗️ Projetos: cada projeto tem a visão geral e 5 etapas encadeadas.
import { describe, it, expect } from 'vitest';
import { modulos, PROXIMOS_MODULOS } from '../src/conteudo/trilha.js';

// Os projetos já publicados, na ordem da trilha.
const IDS = ['palavras'];
const m = modulos.find((x) => x.id === 'projetos');
const doProjeto = (id) => m.itens.filter((i) => i.grupo === id);
const etapas = (id) => doProjeto(id).filter((i) => i.tipo === 'problema');

describe('módulo projetos', () => {
  it('vem por último, e não há mais módulos "em breve"', () => {
    expect(modulos.at(-1)).toBe(m);
    expect(m).toMatchObject({ titulo: 'Projetos', icone: '🏗️' });
    expect(m.grupos.map((g) => g.id)).toEqual(IDS);
    expect(PROXIMOS_MODULOS).toEqual([]);
  });

  it.each(IDS)('%s: visão geral e 5 etapas (fácil, médio, médio, difícil, difícil)', (id) => {
    expect(doProjeto(id)[0]).toMatchObject({ id: `${id}-visao-geral`, tipo: 'licao' });
    expect(etapas(id).map((i) => i.dificuldade)).toEqual(['facil', 'medio', 'medio', 'dificil', 'dificil']);
  });

  it.each(IDS)('%s: cada etapa começa da solução da anterior, com o main.py primeiro', (id) => {
    etapas(id).forEach((e, n) => {
      expect(e.etapaAnterior).toBe(n ? etapas(id)[n - 1].id : null);
      if (n) expect(e.arquivos).toEqual(etapas(id)[n - 1].solucao);
      expect(Object.keys(e.solucao)[0]).toBe('main.py');
    });
  });

  it.each(IDS)('%s: o caso oculto só troca arquivos que o visível tem', (id) => {
    for (const e of etapas(id)) {
      const oculto = e.testes.find((t) => t.oculto);
      expect(Object.keys(oculto.dados).every((nome) => nome in e.dados)).toBe(true);
    }
  });
});
```

Crie `tests/projetos-ui.test.js`:

```js
// @vitest-environment happy-dom
// Os projetos na tela: a etapa continua do código do aluno, e o módulo não tem troféu.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';
import { renderInicio } from '../src/ui/inicio.js';
import { marcar, gravarRascunho } from '../src/progresso.js';
import { buscarItem } from '../src/conteudo/trilha.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

function montar() {
  document.body.innerHTML = corpo;
  const pedidos = [];
  const motor = {
    executar: async (arquivos, opcoes) => { pedidos.push({ ...opcoes, arquivos }); return { ms: 5, retornos: [], variaveis: {}, saida: '', erro: null }; },
    interromper() {},
  };
  const tela = criarTelaItem({ motor, layout: { aplicar() {}, mostrarDescricao() {} }, definirStatus: () => {}, aoMudarProgresso: () => {} });
  tela.aoMudarEstadoPython(true);
  return { tela, pedidos };
}

async function executar(tela, id) {
  tela.abrir(id);
  await new Promise((r) => setTimeout(r, 20));
  document.getElementById('btn-executar').click();
  await new Promise((r) => setTimeout(r, 30));
}

describe('projetos na tela', () => {
  beforeEach(() => localStorage.clear());

  it('quem resolveu a etapa anterior continua do próprio código', async () => {
    const { tela, pedidos } = montar();
    const meu = { 'main.py': '# o meu código da etapa 1\n' };
    marcar('palavras-1', 'resolvido');
    gravarRascunho('palavras-1', meu);
    await executar(tela, 'palavras-2');
    expect(document.querySelector('.etapa-info').textContent).toContain('seu código');
    expect(pedidos[0].arquivos['main.py']).toBe(meu['main.py']);
  });

  it('etapa anterior resolvida, mas sem rascunho neste navegador: começa da solução de referência', async () => {
    const { tela, pedidos } = montar();
    marcar('palavras-1', 'resolvido');
    await executar(tela, 'palavras-2');
    expect(pedidos[0].arquivos['main.py']).toBe(buscarItem('palavras-1').solucao['main.py']);
  });

  it('a trilha mostra os projetos sem troféu de certificado', () => {
    document.body.innerHTML = '<main id="tela"></main>';
    const el = document.getElementById('tela');
    renderInicio(el);
    const bloco = el.querySelector('#unidade-projetos');
    expect(bloco.querySelector('.subunidade').textContent).toContain('Contagem de palavras');
    expect(bloco.querySelector('.trofeu')).toBeNull();
    expect(el.querySelector('#unidade-alem .trofeu')).not.toBeNull();
  });
});
```

Em `tests/conteudo.test.js`:
- troque `expect(modulos.map((x) => x.id).slice(-2)).toEqual(['pyspark', 'alem']);` por `expect(modulos.map((x) => x.id).slice(-3)).toEqual(['pyspark', 'alem', 'projetos']);`;
- o `it.each` da linha 27 (exercícios e lições por módulo) só ganha os projetos na Task 9, quando o módulo estiver completo; até lá, `tests/projetos.test.js` confere a estrutura.

Em `tests/landing.test.js`, troque a constante e o comentário:

```js
// Um certificado por módulo que tem certificado (os projetos não têm) e, quando a trilha tiver o final, mais um.
const TOTAL_CERTIFICADOS = Object.keys(CERTIFICADOS).length;
```

- [ ] **Step 2: Run them to verify they fail**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/projetos-ui.test.js > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |TypeError|AssertionError" $TEMP/v.txt | head -8`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'grupos')` (o módulo ainda não existe) e `buscarItem('palavras-1')` indefinido.

- [ ] **Step 3: O projeto 📚 Contagem de palavras**

Crie `src/conteudo/projetos/palavras.js`:

```js
// 📚 Contagem de palavras em livros: o "olá, mundo" do Spark, de ponta a ponta. Os livros são
// versos curtos escritos por nós, no estilo do cordel.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const SECA = 'No sertão a seca é dura,\na seca racha o chão.\nMas o povo do sertão\nespera a chuva, chuva no sertão!\n';
const MAR = 'O mar é grande, o mar é bom.\nJangada vai no mar\ne volta com o peixe, peixe bom!\n';
const SECA_OCULTO = 'Choveu no sertão, choveu!\nO rio voltou a correr.\n';
const MAR_OCULTO = 'A rede no mar, a rede na areia.\n';
const VAZIAS = ['a', 'o', 'e', 'é', 'de', 'do', 'da', 'no', 'na', 'que', 'um', 'uma', 'com', 'em', 'mas'].join('\n') + '\n';

const SECA_ID = 'cordel-da-seca';
const MAR_ID = 'cordel-do-mar';

export const projetoPalavras = criarProjeto({
  id: 'palavras',
  titulo: 'Contagem de palavras em livros',
  icone: '📚',
  descricao: 'Ler livros de cordel, limpar o texto, contar as palavras e achar as mais usadas de cada livro.',
  resumo: `
    <p>O clássico do Spark, de ponta a ponta: quais palavras mais aparecem em cada livro? Os livros são versos curtos,
      no estilo do cordel, na pasta <code>livros/</code>; a lista de <b>palavras vazias</b> (a, o, de, que…) está em
      <code>vazias.txt</code>. Veja os arquivos na aba <b>📦 Dados</b>.</p>
    <p>Cada etapa continua do código da anterior, como num pipeline de verdade:</p>
    <ol>
      <li>ler os livros, um por linha da tabela;</li>
      <li>normalizar o texto (minúsculas, sem pontuação) e quebrar em palavras;</li>
      <li>contar as palavras de cada livro;</li>
      <li>tirar as palavras vazias;</li>
      <li>ficar com as 3 mais frequentes de cada livro.</li>
    </ol>
    <p>A correção roda o seu pipeline com estes livros e, no envio, com outros livros de mesmo nome.</p>`,
  dados: { [`livros/${SECA_ID}.txt`]: SECA, [`livros/${MAR_ID}.txt`]: MAR, 'vazias.txt': VAZIAS },
  oculto: { [`livros/${SECA_ID}.txt`]: SECA_OCULTO, [`livros/${MAR_ID}.txt`]: MAR_OCULTO },
  inicial: py`
    import os

    print(sorted(os.listdir("livros")))
  `,
  etapas: [
    {
      titulo: 'Ler os livros',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia cada arquivo da pasta <code>livros</code> inteiro e guarde em <code>livros</code> um DataFrame com as colunas
          <code>livro</code> (o nome do arquivo, sem a pasta e sem o <code>.txt</code>) e <code>texto</code> (o conteúdo).</p>
        <p>Uma linha por livro: <code>cordel-da-seca</code> e <code>cordel-do-mar</code>.</p>`,
      dica: 'spark.sparkContext.wholeTextFiles("livros") dá pares (caminho, texto); .toDF(["caminho", "texto"]) e F.regexp_extract("caminho", r"([^/]+)\\.txt$", 1) tiram o nome.',
      codigo: py`
        arquivos = spark.sparkContext.wholeTextFiles("livros")
        livros = arquivos.toDF(["caminho", "texto"]).select(
            F.regexp_extract("caminho", r"([^/]+)\\.txt$", 1).alias("livro"), "texto")
        livros.select("livro").show()
      `,
      regras: [{ dataframe: 'livros', colunas: ['livro', 'texto'], linhas: [[SECA_ID, SECA], [MAR_ID, MAR]] }],
      regrasOcultas: [{ dataframe: 'livros', colunas: ['livro', 'texto'], linhas: [[SECA_ID, SECA_OCULTO], [MAR_ID, MAR_OCULTO]] }],
    },
    {
      titulo: 'Normalizar e quebrar em palavras',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>palavras</code> uma linha por palavra, com as colunas <code>livro</code> e <code>palavra</code>.</p>
        <p>Antes de quebrar, passe o texto para minúsculas e tire a pontuação (<code>. , ; : ! ?</code>). Quebre nos
          espaços e nas quebras de linha, e não deixe palavra vazia.</p>`,
      dica: 'F.lower, F.regexp_replace(texto, r"[.,;:!?]", ""), F.split(texto, r"\\s+") e F.explode; depois, filter(F.col("palavra") != "").',
      codigo: py`
        limpo = F.regexp_replace(F.lower("texto"), r"[.,;:!?]", "")
        palavras = (livros
            .select("livro", F.explode(F.split(limpo, r"\\s+")).alias("palavra"))
            .filter(F.col("palavra") != ""))
        palavras.show()
      `,
      regras: [{ dataframe: 'palavras', colunas: ['livro', 'palavra'], total: 41 }],
      regrasOcultas: [{ dataframe: 'palavras', colunas: ['livro', 'palavra'], total: 17 }],
    },
    {
      titulo: 'Contar as palavras',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>contagem</code> quantas vezes cada palavra aparece em cada livro: as colunas <code>livro</code>,
          <code>palavra</code> e <code>count</code>.</p>`,
      dica: 'palavras.groupBy("livro", "palavra").count()',
      codigo: py`
        contagem = palavras.groupBy("livro", "palavra").count()
        contagem.orderBy(F.desc("count")).show()
      `,
      regras: [{ dataframe: 'contagem', colunas: ['livro', 'palavra', 'count'], total: 26 }],
      regrasOcultas: [{ dataframe: 'contagem', colunas: ['livro', 'palavra', 'count'], total: 14 }],
    },
    {
      titulo: 'Tirar as palavras vazias',
      dificuldade: 'dificil',
      enunciado: `
        <p>As palavras vazias (a, o, de, que…) aparecem muito e não dizem nada sobre o livro. Elas estão em
          <code>vazias.txt</code>, uma por linha.</p>
        <p>Guarde em <code>relevantes</code> a contagem sem elas, com as colunas <code>livro</code>, <code>palavra</code> e
          <code>count</code>, nessa ordem.</p>`,
      dica: 'spark.read.text("vazias.txt") tem a coluna value; renomeie para palavra e use join(vazias, "palavra", "left_anti"). O join muda a ordem das colunas: termine com select.',
      codigo: py`
        vazias = spark.read.text("vazias.txt").withColumnRenamed("value", "palavra")
        relevantes = (contagem.join(vazias, "palavra", "left_anti")
            .select("livro", "palavra", "count"))
        relevantes.orderBy("livro", F.desc("count")).show()
      `,
      regras: [{
        dataframe: 'relevantes',
        colunas: ['livro', 'palavra', 'count'],
        linhas: [
          [SECA_ID, 'sertão', 3], [SECA_ID, 'seca', 2], [SECA_ID, 'chuva', 2], [SECA_ID, 'dura', 1], [SECA_ID, 'racha', 1],
          [SECA_ID, 'chão', 1], [SECA_ID, 'povo', 1], [SECA_ID, 'espera', 1],
          [MAR_ID, 'mar', 3], [MAR_ID, 'bom', 2], [MAR_ID, 'peixe', 2], [MAR_ID, 'grande', 1], [MAR_ID, 'jangada', 1],
          [MAR_ID, 'vai', 1], [MAR_ID, 'volta', 1],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'relevantes',
        colunas: ['livro', 'palavra', 'count'],
        linhas: [
          [SECA_ID, 'choveu', 2], [SECA_ID, 'sertão', 1], [SECA_ID, 'rio', 1], [SECA_ID, 'voltou', 1], [SECA_ID, 'correr', 1],
          [MAR_ID, 'rede', 2], [MAR_ID, 'mar', 1], [MAR_ID, 'areia', 1],
        ],
      }],
    },
    {
      titulo: 'As 3 mais frequentes de cada livro',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>top</code> as 3 palavras mais frequentes de cada livro, com as colunas <code>livro</code>,
          <code>palavra</code>, <code>count</code> e <code>posicao</code> (1, 2 e 3).</p>
        <p>No empate, vem antes a palavra em ordem alfabética.</p>`,
      dica: 'Uma janela por livro: Window.partitionBy("livro").orderBy(F.desc("count"), "palavra"); F.row_number().over(janela) e filter(posicao <= 3).',
      codigo: py`
        from pyspark.sql import Window

        por_livro = Window.partitionBy("livro").orderBy(F.desc("count"), "palavra")
        top = (relevantes.withColumn("posicao", F.row_number().over(por_livro))
            .filter(F.col("posicao") <= 3))
        top.orderBy("livro", "posicao").show()
      `,
      regras: [{
        dataframe: 'top',
        colunas: ['livro', 'palavra', 'count', 'posicao'],
        linhas: [[SECA_ID, 'sertão', 3, 1], [SECA_ID, 'chuva', 2, 2], [SECA_ID, 'seca', 2, 3], [MAR_ID, 'mar', 3, 1], [MAR_ID, 'bom', 2, 2], [MAR_ID, 'peixe', 2, 3]],
      }],
      regrasOcultas: [{
        dataframe: 'top',
        colunas: ['livro', 'palavra', 'count', 'posicao'],
        linhas: [[SECA_ID, 'choveu', 2, 1], [SECA_ID, 'correr', 1, 2], [SECA_ID, 'rio', 1, 3], [MAR_ID, 'rede', 2, 1], [MAR_ID, 'areia', 1, 2], [MAR_ID, 'mar', 1, 3]],
      }],
    },
  ],
});
```

(Conta de cabeça, para conferir: o livro da seca tem 22 palavras e 14 distintas; o do mar, 19 e 12. Sem as vazias: 8 e 7. Nos ocultos: 9 e 8 palavras, 8 e 6 distintas, 5 e 3 sem as vazias.)

- [ ] **Step 4: O módulo e a trilha**

Crie `src/conteudo/projetos/index.js`:

```js
// 🏗️ Projetos: pipelines de dados de ponta a ponta com PySpark. Cada projeto (um arquivo nesta
// pasta) tem a visão geral e 5 etapas; cada etapa continua do código da anterior (base.js).
import { projetoPalavras } from './palavras.js';

export const PROJETOS = [projetoPalavras];

export const moduloProjetos = {
  id: 'projetos',
  titulo: 'Projetos',
  icone: '🏗️',
  descricao: `Pipelines de dados de ponta a ponta com PySpark: ler, limpar, juntar, agregar e entregar. Cada projeto tem 5 etapas, e cada etapa continua do código da anterior. Já estão no ar ${PROJETOS.length} dos 18 projetos (DataFrame e SQL); os outros chegam nas próximas versões.`,
  grupos: PROJETOS.map((p) => p.grupo),
  itens: PROJETOS.flatMap((p) => p.itens),
};
```

Em `src/conteudo/trilha.js`:
- acrescente `import { moduloProjetos } from './projetos/index.js';` depois do import de `moduloAlem`;
- `export const modulos = [moduloBasico, moduloDados, moduloParalelismo, moduloPyspark, moduloAlem, moduloProjetos];`
- `export const PROXIMOS_MODULOS = [];` (o comentário de cima continua valendo).

- [ ] **Step 5: Módulo sem certificado na trilha**

Em `src/ui/inicio.js`:
- em `renderInicio`, troque `unidade(m, j.modulos[i - 1], m.id === atual, certs[i])` por `unidade(m, j.modulos[i - 1], m.id === atual, certs.find((c) => c.id === m.id))` (a cadeia de certificados não tem um por módulo: os projetos não têm);
- em `unidade`, troque `${nos}${trofeu(m, cert)}` por `${nos}${cert ? trofeu(m, cert) : ''}`.

Confira que nenhum outro lugar indexa certificado pelo módulo sem proteção:
Run: `grep -rnF "CERTIFICADOS[m" src; grep -rn "certs\[i\]\|certificados\[i\]" src`
Expected: só `inicio.js:119` (dentro de `trofeu`, que agora só roda com certificado) e a linha 158 (já protegida com `CERTIFICADOS[m.id] ?`).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/projetos-ui.test.js tests/landing.test.js tests/gamificacao.test.js > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL" $TEMP/v.txt`
Expected: tudo verde. (Com `PROXIMOS_MODULOS` vazio, o teste "o último nível é alcançável com a trilha real" passa a rodar e deve passar.)

Run: `rtk proxy npx vitest run tests/conteudo.test.js -t "palavras|estrutura" > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL|faltou|sobrou|esperad" $TEMP/v.txt | head -20`
Expected: verde — a lição `palavras-visao-geral` roda sem erro; as 5 soluções passam no visível e no oculto; os 5 códigos iniciais falham no visível. Se uma linha esperada não bater, refaça a conta de cabeça com os versos acima antes de mexer no código: o esperado vem dos dados.

- [ ] **Step 7: Commit**

```bash
git add src/conteudo/projetos/palavras.js src/conteudo/projetos/index.js src/conteudo/trilha.js src/ui/inicio.js tests/projetos.test.js tests/projetos-ui.test.js tests/conteudo.test.js tests/landing.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: o módulo na trilha, com a contagem de palavras em livros

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 🛒 Vendas por região

**Files:**
- Create: `src/conteudo/projetos/vendas-regiao.js`
- Modify: `src/conteudo/projetos/index.js`, `tests/projetos.test.js`

**Interfaces:**
- Consumes: `criarProjeto` (Task 2); `PROJETOS` em `index.js` e `IDS` em `tests/projetos.test.js` (Task 3).
- Produces: `projetoVendasRegiao`.

- [ ] **Step 1: Write the failing test**

Em `tests/projetos.test.js`: `const IDS = ['palavras', 'vendas-regiao'];`

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |AssertionError" $TEMP/v.txt | head -4`
Expected: FAIL em "vem por último" (`grupos` é `['palavras']`).

- [ ] **Step 3: O projeto**

Crie `src/conteudo/projetos/vendas-regiao.js`:

```js
// 🛒 Vendas por região: ler com schema, calcular a receita, juntar com o catálogo, agregar e
// montar o ranking das regiões com a participação de cada uma.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const VENDAS = `id,data,produto,regiao,quantidade,preco
1,2026-03-02,P1,Nordeste,2,24.90
2,2026-03-02,P2,Sudeste,3,8.50
3,2026-03-03,P3,Nordeste,1,19.90
4,2026-03-03,P4,Norte,10,2.50
5,2026-03-04,P1,Sul,1,25.00
6,2026-03-04,P2,Nordeste,4,8.00
7,2026-03-05,P9,Sul,1,5.00
`;
const VENDAS_OCULTO = `id,data,produto,regiao,quantidade,preco
1,2026-04-01,P2,Norte,2,9.00
2,2026-04-01,P3,Norte,1,20.00
3,2026-04-02,P4,Sul,4,2.50
4,2026-04-02,P8,Nordeste,3,4.00
5,2026-04-03,P1,Sul,2,25.00
`;
const PRODUTOS = `produto,nome,categoria
P1,Arroz 5kg,Mercearia
P2,Feijão 1kg,Mercearia
P3,Café 500g,Bebidas
P4,Rapadura,Doces
`;

const TIPOS = ['int', 'date', 'string', 'string', 'int', 'double'];

export const projetoVendasRegiao = criarProjeto({
  id: 'vendas-regiao',
  titulo: 'Vendas por região',
  icone: '🛒',
  descricao: 'Das vendas do mercadinho ao ranking das regiões: schema, receita, join com o catálogo e participação.',
  resumo: `
    <p>Um mercadinho vende para todo o Brasil. Em <code>vendas.csv</code> está cada venda (produto, região, quantidade e
      preço) e em <code>produtos.csv</code>, o catálogo (nome e categoria). Uma venda pode ser de um produto que saiu do
      catálogo: ela não entra no relatório.</p>
    <ol>
      <li>ler as vendas com o schema certo;</li>
      <li>calcular a receita de cada venda;</li>
      <li>juntar com o catálogo;</li>
      <li>somar a receita por região e categoria;</li>
      <li>montar o ranking das regiões, com a participação de cada uma no total.</li>
    </ol>`,
  dados: { 'vendas.csv': VENDAS, 'produtos.csv': PRODUTOS },
  oculto: { 'vendas.csv': VENDAS_OCULTO },
  inicial: py`
    vendas = spark.read.csv("vendas.csv", header=True)
    vendas.printSchema()
  `,
  etapas: [
    {
      titulo: 'Ler com schema',
      dificuldade: 'facil',
      enunciado: `
        <p>Sem schema, todas as colunas chegam como texto. Leia <code>vendas.csv</code> de novo em <code>vendas</code>, com o
          schema <code>id INT, data DATE, produto STRING, regiao STRING, quantidade INT, preco DOUBLE</code>.</p>
        <p>Aproveite e leia <code>produtos.csv</code> em <code>produtos</code> (com <code>inferSchema=True</code>): ele entra na etapa 3.</p>`,
      dica: 'spark.read.csv("vendas.csv", header=True, schema="id INT, data DATE, ...")',
      codigo: py`
        ESQUEMA = "id INT, data DATE, produto STRING, regiao STRING, quantidade INT, preco DOUBLE"
        vendas = spark.read.csv("vendas.csv", header=True, schema=ESQUEMA)
        produtos = spark.read.csv("produtos.csv", header=True, inferSchema=True)
        vendas.printSchema()
      `,
      regras: [{ dataframe: 'vendas', tipos: TIPOS, total: 7 }],
      regrasOcultas: [{ dataframe: 'vendas', tipos: TIPOS, total: 5 }],
    },
    {
      titulo: 'A receita de cada venda',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>receitas</code> as colunas <code>id</code>, <code>regiao</code>, <code>produto</code> e
          <code>receita</code> (quantidade × preço, arredondada em 2 casas).</p>`,
      dica: 'vendas.select("id", "regiao", "produto", F.round(F.col("quantidade") * F.col("preco"), 2).alias("receita"))',
      codigo: py`
        receitas = vendas.select("id", "regiao", "produto",
            F.round(F.col("quantidade") * F.col("preco"), 2).alias("receita"))
        receitas.show()
      `,
      regras: [{
        dataframe: 'receitas',
        colunas: ['id', 'regiao', 'produto', 'receita'],
        linhas: [[1, 'Nordeste', 'P1', 49.8], [2, 'Sudeste', 'P2', 25.5], [3, 'Nordeste', 'P3', 19.9], [4, 'Norte', 'P4', 25.0], [5, 'Sul', 'P1', 25.0], [6, 'Nordeste', 'P2', 32.0], [7, 'Sul', 'P9', 5.0]],
      }],
      regrasOcultas: [{
        dataframe: 'receitas',
        colunas: ['id', 'regiao', 'produto', 'receita'],
        linhas: [[1, 'Norte', 'P2', 18.0], [2, 'Norte', 'P3', 20.0], [3, 'Sul', 'P4', 10.0], [4, 'Nordeste', 'P8', 12.0], [5, 'Sul', 'P1', 50.0]],
      }],
    },
    {
      titulo: 'Juntar com o catálogo',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>detalhe</code> as receitas juntadas com <code>produtos</code> pela coluna <code>produto</code>,
          com as colunas <code>id</code>, <code>regiao</code>, <code>nome</code>, <code>categoria</code> e
          <code>receita</code>. A venda de produto fora do catálogo fica de fora.</p>`,
      dica: 'receitas.join(produtos, "produto") é um inner join: quem não casa sai. Termine com select nas colunas pedidas.',
      codigo: py`
        detalhe = receitas.join(produtos, "produto").select("id", "regiao", "nome", "categoria", "receita")
        detalhe.show()
      `,
      regras: [{
        dataframe: 'detalhe',
        colunas: ['id', 'regiao', 'nome', 'categoria', 'receita'],
        linhas: [
          [1, 'Nordeste', 'Arroz 5kg', 'Mercearia', 49.8], [2, 'Sudeste', 'Feijão 1kg', 'Mercearia', 25.5], [3, 'Nordeste', 'Café 500g', 'Bebidas', 19.9],
          [4, 'Norte', 'Rapadura', 'Doces', 25.0], [5, 'Sul', 'Arroz 5kg', 'Mercearia', 25.0], [6, 'Nordeste', 'Feijão 1kg', 'Mercearia', 32.0],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'detalhe',
        colunas: ['id', 'regiao', 'nome', 'categoria', 'receita'],
        linhas: [[1, 'Norte', 'Feijão 1kg', 'Mercearia', 18.0], [2, 'Norte', 'Café 500g', 'Bebidas', 20.0], [3, 'Sul', 'Rapadura', 'Doces', 10.0], [5, 'Sul', 'Arroz 5kg', 'Mercearia', 50.0]],
      }],
    },
    {
      titulo: 'Receita por região e categoria',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>por_categoria</code>, para cada região e categoria, o número de vendas (<code>vendas</code>) e a
          receita somada (<code>receita</code>, em 2 casas): as colunas <code>regiao</code>, <code>categoria</code>,
          <code>vendas</code> e <code>receita</code>.</p>
        <p>Deixe em ordem de região e, dentro de cada região, da maior receita para a menor.</p>`,
      dica: 'groupBy("regiao", "categoria").agg(F.count("*").alias("vendas"), F.round(F.sum("receita"), 2).alias("receita")), e orderBy("regiao", F.desc("receita")) no próprio por_categoria.',
      codigo: py`
        por_categoria = (detalhe.groupBy("regiao", "categoria")
            .agg(F.count("*").alias("vendas"), F.round(F.sum("receita"), 2).alias("receita"))
            .orderBy("regiao", F.desc("receita")))
        por_categoria.show()
      `,
      regras: [{
        dataframe: 'por_categoria',
        colunas: ['regiao', 'categoria', 'vendas', 'receita'],
        ordem: true,
        linhas: [['Nordeste', 'Mercearia', 2, 81.8], ['Nordeste', 'Bebidas', 1, 19.9], ['Norte', 'Doces', 1, 25.0], ['Sudeste', 'Mercearia', 1, 25.5], ['Sul', 'Mercearia', 1, 25.0]],
      }],
      regrasOcultas: [{
        dataframe: 'por_categoria',
        colunas: ['regiao', 'categoria', 'vendas', 'receita'],
        ordem: true,
        linhas: [['Norte', 'Bebidas', 1, 20.0], ['Norte', 'Mercearia', 1, 18.0], ['Sul', 'Mercearia', 1, 50.0], ['Sul', 'Doces', 1, 10.0]],
      }],
    },
    {
      titulo: 'O ranking das regiões',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>ranking</code> uma linha por região, com as colunas <code>posicao</code> (1 para a maior receita;
          empate fica na mesma posição), <code>regiao</code>, <code>receita</code> (em 2 casas) e <code>participacao</code>
          (a porcentagem da receita total, em 1 casa).</p>`,
      dica: 'Some por região a partir de detalhe; o total sai de por_regiao.agg(F.sum("receita")).first()[0]. A posição é F.rank().over(Window.orderBy(F.desc("receita"))).',
      codigo: py`
        from pyspark.sql import Window

        por_regiao = detalhe.groupBy("regiao").agg(F.round(F.sum("receita"), 2).alias("receita"))
        total = por_regiao.agg(F.sum("receita")).first()[0]
        ranking = por_regiao.select(
            F.rank().over(Window.orderBy(F.desc("receita"))).alias("posicao"), "regiao", "receita",
            F.round(F.col("receita") * 100 / total, 1).alias("participacao"))
        ranking.orderBy("posicao").show()
      `,
      regras: [{
        dataframe: 'ranking',
        colunas: ['posicao', 'regiao', 'receita', 'participacao'],
        linhas: [[1, 'Nordeste', 101.7, 57.4], [2, 'Sudeste', 25.5, 14.4], [3, 'Norte', 25.0, 14.1], [3, 'Sul', 25.0, 14.1]],
      }],
      regrasOcultas: [{
        dataframe: 'ranking',
        colunas: ['posicao', 'regiao', 'receita', 'participacao'],
        linhas: [[1, 'Sul', 60.0, 61.2], [2, 'Norte', 38.0, 38.8]],
      }],
    },
  ],
});
```

Em `src/conteudo/projetos/index.js`: `import { projetoVendasRegiao } from './vendas-regiao.js';` e `export const PROJETOS = [projetoPalavras, projetoVendasRegiao];`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "vendas-regiao|vem por último" > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL|faltou|sobrou|esperad" $TEMP/v.txt | head -20`
Expected: verde (a visão geral roda; 5 soluções passam no visível e no oculto; 5 iniciais falham no visível).

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/projetos/vendas-regiao.js src/conteudo/projetos/index.js tests/projetos.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: vendas por região

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 📜 Análise de logs

**Files:**
- Create: `src/conteudo/projetos/logs.js`
- Modify: `src/conteudo/projetos/index.js`, `tests/projetos.test.js`

**Interfaces:**
- Consumes: `criarProjeto`; `F.percentile_approx` e o CAST de TIMESTAMP para `long` (Task 1).
- Produces: `projetoLogs`.

- [ ] **Step 1: Write the failing test**

Em `tests/projetos.test.js`: `const IDS = ['palavras', 'vendas-regiao', 'logs'];`

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |AssertionError" $TEMP/v.txt | head -4`
Expected: FAIL em "vem por último".

- [ ] **Step 3: O projeto**

Crie `src/conteudo/projetos/logs.js`:

```js
// 📜 Análise de logs: quebrar as linhas do servidor web com regex, contar status por hora, achar
// as rotas com erro e as mais lentas (percentil 95) e contar as sessões de cada visitante.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const linha = (ip, momento, metodo, rota, status, ms) => `${ip} - - [${momento}] "${metodo} ${rota} HTTP/1.1" ${status} ${ms}\n`;

const LOG_1 = [
  linha('10.0.0.1', '2026-10-15 09:00:05', 'GET', '/produtos', 200, 120),
  linha('10.0.0.2', '2026-10-15 09:05:10', 'GET', '/carrinho', 200, 80),
  linha('10.0.0.1', '2026-10-15 09:10:00', 'POST', '/pagamento', 500, 900),
  linha('10.0.0.3', '2026-10-15 09:20:30', 'GET', '/produtos', 200, 100),
  linha('10.0.0.1', '2026-10-15 09:50:00', 'GET', '/produtos', 404, 30),
].join('');
const LOG_2 = [
  linha('10.0.0.2', '2026-10-15 10:00:00', 'POST', '/pagamento', 200, 700),
  linha('10.0.0.3', '2026-10-15 10:02:00', 'POST', '/pagamento', 503, 1200),
  linha('10.0.0.2', '2026-10-15 10:15:00', 'GET', '/produtos', 200, 140),
  linha('10.0.0.1', '2026-10-15 10:40:00', 'GET', '/carrinho', 500, 60),
].join('');
const LOG_1_OCULTO = [
  linha('10.0.0.7', '2026-10-16 14:00:00', 'GET', '/busca', 200, 50),
  linha('10.0.0.7', '2026-10-16 14:20:00', 'GET', '/busca', 502, 400),
  linha('10.0.0.8', '2026-10-16 14:30:00', 'GET', '/produtos', 200, 90),
].join('');
const LOG_2_OCULTO = [
  linha('10.0.0.7', '2026-10-16 15:00:00', 'GET', '/produtos', 200, 110),
  linha('10.0.0.8', '2026-10-16 15:05:00', 'GET', '/busca', 200, 70),
].join('');

const COLUNAS = ['ip', 'momento', 'metodo', 'rota', 'status', 'ms'];
const TIPOS = ['string', 'timestamp', 'string', 'string', 'int', 'int'];

export const projetoLogs = criarProjeto({
  id: 'logs',
  titulo: 'Análise de logs',
  icone: '📜',
  descricao: 'Os logs do servidor da loja: regex, status por hora, erros, rotas lentas (percentil 95) e sessões.',
  resumo: `
    <p>O servidor da loja grava uma linha por acesso nos arquivos da pasta <code>logs/</code>: o IP, o momento, o
      método e a rota, o status da resposta e quanto tempo ela levou, em milissegundos.</p>
    <pre><code>10.0.0.1 - - [2026-10-15 09:00:05] "GET /produtos HTTP/1.1" 200 120</code></pre>
    <ol>
      <li>quebrar cada linha nas colunas, com uma expressão regular;</li>
      <li>contar os status por hora;</li>
      <li>contar os erros 5xx de cada rota;</li>
      <li>achar as rotas mais lentas pelo percentil 95;</li>
      <li>contar as sessões de cada IP (uma pausa de mais de 30 minutos começa outra).</li>
    </ol>`,
  dados: { 'logs/acesso-1.log': LOG_1, 'logs/acesso-2.log': LOG_2 },
  oculto: { 'logs/acesso-1.log': LOG_1_OCULTO, 'logs/acesso-2.log': LOG_2_OCULTO },
  inicial: py`
    # Cada linha: ip - - [momento] "MÉTODO rota protocolo" status ms
    PADRAO = r'^(\\S+) - - \\[(.+?)\\] "(\\S+) (\\S+) \\S+" (\\d+) (\\d+)$'

    linhas = spark.read.text("logs")
    linhas.show(3, truncate=False)
  `,
  etapas: [
    {
      titulo: 'Quebrar as linhas',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>acessos</code> uma linha por acesso, com as colunas <code>ip</code>, <code>momento</code>
          (timestamp), <code>metodo</code>, <code>rota</code>, <code>status</code> (int) e <code>ms</code> (int).</p>
        <p>O <code>PADRAO</code> do código já tem um grupo para cada coluna, na ordem.</p>`,
      dica: 'F.regexp_extract("value", PADRAO, 1) pega o primeiro grupo; F.to_timestamp para o momento e .cast("int") para os números.',
      codigo: py`
        parte = lambda i: F.regexp_extract("value", PADRAO, i)
        acessos = linhas.select(
            parte(1).alias("ip"),
            F.to_timestamp(parte(2)).alias("momento"),
            parte(3).alias("metodo"),
            parte(4).alias("rota"),
            parte(5).cast("int").alias("status"),
            parte(6).cast("int").alias("ms"))
        acessos.show()
      `,
      regras: [{
        dataframe: 'acessos',
        colunas: COLUNAS,
        tipos: TIPOS,
        linhas: [
          ['10.0.0.1', '2026-10-15 09:00:05', 'GET', '/produtos', 200, 120], ['10.0.0.2', '2026-10-15 09:05:10', 'GET', '/carrinho', 200, 80],
          ['10.0.0.1', '2026-10-15 09:10:00', 'POST', '/pagamento', 500, 900], ['10.0.0.3', '2026-10-15 09:20:30', 'GET', '/produtos', 200, 100],
          ['10.0.0.1', '2026-10-15 09:50:00', 'GET', '/produtos', 404, 30], ['10.0.0.2', '2026-10-15 10:00:00', 'POST', '/pagamento', 200, 700],
          ['10.0.0.3', '2026-10-15 10:02:00', 'POST', '/pagamento', 503, 1200], ['10.0.0.2', '2026-10-15 10:15:00', 'GET', '/produtos', 200, 140],
          ['10.0.0.1', '2026-10-15 10:40:00', 'GET', '/carrinho', 500, 60],
        ],
      }],
      regrasOcultas: [{ dataframe: 'acessos', colunas: COLUNAS, tipos: TIPOS, total: 5 }],
    },
    {
      titulo: 'Status por hora',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_hora</code> quantos acessos houve de cada status em cada hora do dia: as colunas
          <code>hora</code>, <code>status</code> e <code>count</code>.</p>`,
      dica: 'acessos.groupBy(F.hour("momento").alias("hora"), "status").count()',
      codigo: py`
        por_hora = acessos.groupBy(F.hour("momento").alias("hora"), "status").count()
        por_hora.orderBy("hora", "status").show()
      `,
      regras: [{ dataframe: 'por_hora', colunas: ['hora', 'status', 'count'], linhas: [[9, 200, 3], [9, 404, 1], [9, 500, 1], [10, 200, 2], [10, 500, 1], [10, 503, 1]] }],
      regrasOcultas: [{ dataframe: 'por_hora', colunas: ['hora', 'status', 'count'], linhas: [[14, 200, 2], [14, 502, 1], [15, 200, 2]] }],
    },
    {
      titulo: 'Erros 5xx por rota',
      dificuldade: 'medio',
      enunciado: `
        <p>Os status 500 e acima são erros do servidor. Guarde em <code>erros</code> quantos erros teve cada rota (só as
          que tiveram algum): as colunas <code>rota</code> e <code>erros</code>, da rota com mais erros para a com menos e,
          no empate, em ordem de rota.</p>`,
      dica: 'filter(F.col("status") >= 500), groupBy("rota").agg(F.count("*").alias("erros")) e orderBy(F.desc("erros"), "rota").',
      codigo: py`
        erros = (acessos.filter(F.col("status") >= 500)
            .groupBy("rota").agg(F.count("*").alias("erros"))
            .orderBy(F.desc("erros"), "rota"))
        erros.show()
      `,
      regras: [{ dataframe: 'erros', colunas: ['rota', 'erros'], ordem: true, linhas: [['/pagamento', 2], ['/carrinho', 1]] }],
      regrasOcultas: [{ dataframe: 'erros', colunas: ['rota', 'erros'], ordem: true, linhas: [['/busca', 1]] }],
    },
    {
      titulo: 'As rotas mais lentas',
      dificuldade: 'dificil',
      enunciado: `
        <p>A média esconde os acessos lentos; o <b>percentil 95</b> mostra o tempo que só 5% dos acessos passam. Guarde em
          <code>lentas</code>, para cada rota, o percentil 95 do tempo (<code>p95</code>) e o número de acessos
          (<code>acessos</code>), da rota mais lenta para a mais rápida.</p>`,
      dica: 'F.percentile_approx("ms", 0.95).alias("p95") dentro do agg, e orderBy(F.desc("p95")).',
      codigo: py`
        lentas = (acessos.groupBy("rota")
            .agg(F.percentile_approx("ms", 0.95).alias("p95"), F.count("*").alias("acessos"))
            .orderBy(F.desc("p95")))
        lentas.show()
      `,
      regras: [{ dataframe: 'lentas', colunas: ['rota', 'p95', 'acessos'], ordem: true, linhas: [['/pagamento', 1200, 3], ['/produtos', 140, 4], ['/carrinho', 80, 2]] }],
      regrasOcultas: [{ dataframe: 'lentas', colunas: ['rota', 'p95', 'acessos'], ordem: true, linhas: [['/busca', 400, 3], ['/produtos', 110, 2]] }],
    },
    {
      titulo: 'Sessões por IP',
      dificuldade: 'dificil',
      enunciado: `
        <p>Uma <b>sessão</b> é uma sequência de acessos do mesmo IP sem pausa de mais de 30 minutos; uma pausa maior começa
          outra sessão. Guarde em <code>sessoes</code> quantas sessões teve cada IP: as colunas <code>ip</code> e
          <code>sessoes</code>.</p>`,
      dica: 'Numa janela por IP em ordem de momento, F.lag dá o acesso anterior; F.col("momento").cast("long") vira segundos. Marque 1 no primeiro acesso e quando a pausa passar de 30 * 60, e some as marcas por IP.',
      codigo: py`
        from pyspark.sql import Window

        por_ip = Window.partitionBy("ip").orderBy("momento")
        segundos = F.col("momento").cast("long")
        marcados = (acessos
            .withColumn("intervalo", segundos - F.lag(segundos).over(por_ip))
            .withColumn("nova", F.when(F.col("intervalo").isNull() | (F.col("intervalo") > 30 * 60), 1).otherwise(0)))
        sessoes = marcados.groupBy("ip").agg(F.sum("nova").alias("sessoes"))
        sessoes.orderBy("ip").show()
      `,
      regras: [{ dataframe: 'sessoes', colunas: ['ip', 'sessoes'], linhas: [['10.0.0.1', 3], ['10.0.0.2', 2], ['10.0.0.3', 2]] }],
      regrasOcultas: [{ dataframe: 'sessoes', colunas: ['ip', 'sessoes'], linhas: [['10.0.0.7', 2], ['10.0.0.8', 2]] }],
    },
  ],
});
```

(Conta de cabeça: o p95 de 4 valores é o 4º da lista ordenada, ceil(0,95 × 4) = 4; de 3 valores, o 3º; de 2, o 2º. As sessões do 10.0.0.1: 09:00:05 → 09:10:00 (10 min) → 09:50:00 (40 min, nova) → 10:40:00 (50 min, nova) = 3.)

Em `src/conteudo/projetos/index.js`: `import { projetoLogs } from './logs.js';` e `PROJETOS = [projetoPalavras, projetoVendasRegiao, projetoLogs]`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "logs|vem por último" > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL|faltou|sobrou|esperad" $TEMP/v.txt | head -20`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/projetos/logs.js src/conteudo/projetos/index.js tests/projetos.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: análise de logs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 🧺 Funil de e-commerce

**Files:**
- Create: `src/conteudo/projetos/funil.js`
- Modify: `src/conteudo/projetos/index.js`, `tests/projetos.test.js`

**Interfaces:**
- Consumes: `criarProjeto`.
- Produces: `projetoFunil`.

- [ ] **Step 1: Write the failing test**

Em `tests/projetos.test.js`: `const IDS = ['palavras', 'vendas-regiao', 'logs', 'funil'];`

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |AssertionError" $TEMP/v.txt | head -4`
Expected: FAIL em "vem por último".

- [ ] **Step 3: O projeto**

Crie `src/conteudo/projetos/funil.js`:

```js
// 🧺 Funil de e-commerce: quantos visitantes chegam ao carrinho e à compra, por canal, e quem
// abandonou o carrinho.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const EVENTOS = `usuario,evento,canal,momento
ana,visita,busca,2026-10-15 08:00:00
ana,carrinho,busca,2026-10-15 08:05:00
ana,compra,busca,2026-10-15 08:10:00
bia,visita,social,2026-10-15 09:00:00
bia,carrinho,social,2026-10-15 09:03:00
caio,visita,busca,2026-10-15 09:30:00
davi,visita,social,2026-10-15 10:00:00
davi,visita,social,2026-10-15 10:20:00
davi,carrinho,social,2026-10-15 10:25:00
davi,compra,social,2026-10-15 10:40:00
edu,visita,email,2026-10-15 11:00:00
edu,carrinho,email,2026-10-15 11:02:00
`;
const EVENTOS_OCULTO = `usuario,evento,canal,momento
gil,visita,busca,2026-10-16 08:00:00
gil,carrinho,busca,2026-10-16 08:10:00
hana,visita,busca,2026-10-16 09:00:00
hana,carrinho,busca,2026-10-16 09:05:00
hana,compra,busca,2026-10-16 09:20:00
ivo,visita,social,2026-10-16 10:00:00
jade,visita,social,2026-10-16 10:30:00
jade,carrinho,social,2026-10-16 10:31:00
jade,carrinho,social,2026-10-16 10:45:00
`;

const TIPOS = ['string', 'string', 'string', 'timestamp'];
const CANAL = ['canal', 'visita', 'carrinho', 'compra', 'taxa'];

export const projetoFunil = criarProjeto({
  id: 'funil',
  titulo: 'Funil de e-commerce',
  icone: '🧺',
  descricao: 'Visita, carrinho e compra: o funil da loja, a conversão entre as etapas, os canais e os carrinhos abandonados.',
  resumo: `
    <p>Em <code>eventos.csv</code> está tudo o que os clientes fizeram na loja: cada linha é uma <b>visita</b>, um
      produto posto no <b>carrinho</b> ou uma <b>compra</b>, com o canal de onde o cliente veio (busca, rede social ou
      e-mail). O funil conta <b>pessoas</b>, não cliques: quem visitou duas vezes conta uma.</p>
    <ol>
      <li>ler e tipar os eventos;</li>
      <li>contar as pessoas em cada etapa do funil;</li>
      <li>calcular a conversão entre as etapas;</li>
      <li>montar o funil de cada canal;</li>
      <li>achar quem abandonou o carrinho.</li>
    </ol>`,
  dados: { 'eventos.csv': EVENTOS },
  oculto: { 'eventos.csv': EVENTOS_OCULTO },
  inicial: py`
    eventos = spark.read.csv("eventos.csv", header=True)
    eventos.printSchema()
  `,
  etapas: [
    {
      titulo: 'Ler e tipar',
      dificuldade: 'facil',
      enunciado: `
        <p>Do jeito que está, o <code>momento</code> chega como texto. Leia <code>eventos.csv</code> de novo em
          <code>eventos</code>, de modo que <code>momento</code> seja um timestamp.</p>`,
      dica: 'inferSchema=True reconhece "2026-10-15 08:00:00" como timestamp.',
      codigo: py`
        eventos = spark.read.csv("eventos.csv", header=True, inferSchema=True)
        eventos.printSchema()
      `,
      regras: [{ dataframe: 'eventos', colunas: ['usuario', 'evento', 'canal', 'momento'], tipos: TIPOS, total: 12 }],
      regrasOcultas: [{ dataframe: 'eventos', colunas: ['usuario', 'evento', 'canal', 'momento'], tipos: TIPOS, total: 9 }],
    },
    {
      titulo: 'Pessoas em cada etapa',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_etapa</code> quantas <b>pessoas diferentes</b> chegaram a cada etapa: as colunas
          <code>evento</code> e <code>usuarios</code>.</p>`,
      dica: 'groupBy("evento").agg(F.countDistinct("usuario").alias("usuarios")): o count contaria a visita repetida duas vezes.',
      codigo: py`
        por_etapa = eventos.groupBy("evento").agg(F.countDistinct("usuario").alias("usuarios"))
        por_etapa.show()
      `,
      regras: [{ dataframe: 'por_etapa', colunas: ['evento', 'usuarios'], linhas: [['visita', 5], ['carrinho', 4], ['compra', 2]] }],
      regrasOcultas: [{ dataframe: 'por_etapa', colunas: ['evento', 'usuarios'], linhas: [['visita', 4], ['carrinho', 3], ['compra', 1]] }],
    },
    {
      titulo: 'A conversão entre as etapas',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>conversao</code> um DataFrame de uma linha com as porcentagens, em 1 casa:
          <code>visita_carrinho</code> (das pessoas que visitaram, quantas puseram no carrinho), <code>carrinho_compra</code>
          e <code>visita_compra</code>.</p>`,
      dica: 'Traga os números para o Python: {r.evento: r.usuarios for r in por_etapa.collect()}; depois, spark.createDataFrame([(…, …, …)], [nomes]).',
      codigo: py`
        n = {linha.evento: linha.usuarios for linha in por_etapa.collect()}
        taxa = lambda de, para: round(100 * n[para] / n[de], 1)
        conversao = spark.createDataFrame(
            [(taxa("visita", "carrinho"), taxa("carrinho", "compra"), taxa("visita", "compra"))],
            ["visita_carrinho", "carrinho_compra", "visita_compra"])
        conversao.show()
      `,
      regras: [{ dataframe: 'conversao', colunas: ['visita_carrinho', 'carrinho_compra', 'visita_compra'], linhas: [[80.0, 50.0, 40.0]] }],
      regrasOcultas: [{ dataframe: 'conversao', colunas: ['visita_carrinho', 'carrinho_compra', 'visita_compra'], linhas: [[75.0, 33.3, 25.0]] }],
    },
    {
      titulo: 'O funil de cada canal',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>por_canal</code> uma linha por canal, com as pessoas de cada etapa em colunas
          (<code>visita</code>, <code>carrinho</code> e <code>compra</code>, nessa ordem; 0 quando ninguém chegou) e a
          <code>taxa</code> de compra (compra ÷ visita, em %, 1 casa).</p>`,
      dica: 'groupBy("canal").pivot("evento", ["visita", "carrinho", "compra"]).agg(F.countDistinct("usuario")), depois fillna(0) e a coluna taxa.',
      codigo: py`
        ETAPAS = ["visita", "carrinho", "compra"]
        por_canal = (eventos.groupBy("canal").pivot("evento", ETAPAS)
            .agg(F.countDistinct("usuario")).fillna(0)
            .withColumn("taxa", F.round(F.col("compra") * 100 / F.col("visita"), 1)))
        por_canal.orderBy("canal").show()
      `,
      regras: [{ dataframe: 'por_canal', colunas: CANAL, linhas: [['busca', 2, 1, 1, 50.0], ['email', 1, 1, 0, 0.0], ['social', 2, 2, 1, 50.0]] }],
      regrasOcultas: [{ dataframe: 'por_canal', colunas: CANAL, linhas: [['busca', 2, 2, 1, 50.0], ['social', 2, 1, 0, 0.0]] }],
    },
    {
      titulo: 'Quem abandonou o carrinho',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>abandonos</code> as pessoas que puseram algo no carrinho e não compraram, com as colunas
          <code>usuario</code>, <code>canal</code> e <code>ultimo_carrinho</code> (a hora do último carrinho, no formato
          <code>HH:mm</code>). É a lista para o e-mail de "esqueceu alguma coisa?".</p>`,
      dica: 'Dos carrinhos, groupBy("usuario", "canal") com F.date_format(F.max("momento"), "HH:mm"); depois, join com quem comprou usando "left_anti".',
      codigo: py`
        carrinhos = (eventos.filter(F.col("evento") == "carrinho")
            .groupBy("usuario", "canal")
            .agg(F.date_format(F.max("momento"), "HH:mm").alias("ultimo_carrinho")))
        compras = eventos.filter(F.col("evento") == "compra").select("usuario")
        abandonos = carrinhos.join(compras, "usuario", "left_anti")
        abandonos.show()
      `,
      regras: [{ dataframe: 'abandonos', colunas: ['usuario', 'canal', 'ultimo_carrinho'], linhas: [['bia', 'social', '09:03'], ['edu', 'email', '11:02']] }],
      regrasOcultas: [{ dataframe: 'abandonos', colunas: ['usuario', 'canal', 'ultimo_carrinho'], linhas: [['gil', 'busca', '08:10'], ['jade', 'social', '10:45']] }],
    },
  ],
});
```

Em `src/conteudo/projetos/index.js`: `import { projetoFunil } from './funil.js';` e acrescente `projetoFunil` no fim de `PROJETOS`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "funil|vem por último" > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL|faltou|sobrou|esperad" $TEMP/v.txt | head -20`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/projetos/funil.js src/conteudo/projetos/index.js tests/projetos.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: funil de e-commerce

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 📊 Painel de indicadores

**Files:**
- Create: `src/conteudo/projetos/painel.js`
- Modify: `src/conteudo/projetos/index.js`, `tests/projetos.test.js`

**Interfaces:**
- Consumes: `criarProjeto`.
- Produces: `projetoPainel`.

- [ ] **Step 1: Write the failing test**

Em `tests/projetos.test.js`: `const IDS = ['palavras', 'vendas-regiao', 'logs', 'funil', 'painel'];`

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |AssertionError" $TEMP/v.txt | head -4`
Expected: FAIL em "vem por último".

- [ ] **Step 3: O projeto**

Crie `src/conteudo/projetos/painel.js`:

```js
// 📊 Painel de indicadores: pedidos, receita e ticket médio por dia, clientes novos e
// recorrentes, a meta do dia e tudo junto numa tabela só.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const PEDIDOS = `pedido,cliente,dia,valor
1,c1,2026-10-13,100.00
2,c2,2026-10-13,50.00
3,c1,2026-10-14,80.00
4,c3,2026-10-14,40.00
5,c3,2026-10-14,60.00
6,c4,2026-10-15,200.00
7,c2,2026-10-14,20.00
`;
const CLIENTES = `cliente,nome,cadastro
c1,Ana,2026-10-13
c2,Bia,2026-09-01
c3,Caio,2026-10-14
c4,Davi,2026-10-15
`;
const METAS = `dia,meta
2026-10-13,200.00
2026-10-14,180.00
2026-10-15,250.00
2026-10-16,100.00
`;
const PEDIDOS_OCULTO = `pedido,cliente,dia,valor
1,c5,2026-10-20,30.00
2,c5,2026-10-21,70.00
3,c6,2026-10-21,50.00
`;
const CLIENTES_OCULTO = `cliente,nome,cadastro
c5,Edu,2026-10-20
c6,Fia,2026-01-10
`;
const METAS_OCULTO = `dia,meta
2026-10-20,50.00
2026-10-21,100.00
2026-10-22,80.00
`;

const META = ['dia', 'pedidos', 'receita', 'ticket', 'meta', 'atingiu', 'bateu'];
const PAINEL = ['dia', 'pedidos', 'receita', 'ticket', 'novos', 'recorrentes', 'meta', 'atingiu', 'bateu'];

export const projetoPainel = criarProjeto({
  id: 'painel',
  titulo: 'Painel de indicadores',
  icone: '📊',
  descricao: 'Os números do dia da loja: pedidos, receita, ticket médio, clientes novos e recorrentes e a meta.',
  resumo: `
    <p>A gerente da loja quer abrir o painel de manhã e ver, para cada dia, como foram as vendas. Os dados estão em três
      arquivos: <code>pedidos.csv</code>, <code>clientes.csv</code> (com o dia do cadastro) e <code>metas.csv</code> (a
      meta de receita de cada dia).</p>
    <ol>
      <li>os indicadores do dia: pedidos e receita;</li>
      <li>o ticket médio;</li>
      <li>os clientes novos e os recorrentes;</li>
      <li>a comparação com a meta, inclusive nos dias sem venda;</li>
      <li>o painel inteiro numa tabela só.</li>
    </ol>`,
  dados: { 'pedidos.csv': PEDIDOS, 'clientes.csv': CLIENTES, 'metas.csv': METAS },
  oculto: { 'pedidos.csv': PEDIDOS_OCULTO, 'clientes.csv': CLIENTES_OCULTO, 'metas.csv': METAS_OCULTO },
  inicial: py`
    pedidos = spark.read.csv("pedidos.csv", header=True, inferSchema=True)
    clientes = spark.read.csv("clientes.csv", header=True, inferSchema=True)
    metas = spark.read.csv("metas.csv", header=True, inferSchema=True)
    pedidos.show()
  `,
  etapas: [
    {
      titulo: 'Os indicadores do dia',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>por_dia</code>, para cada dia, o número de pedidos (<code>pedidos</code>) e a receita somada
          (<code>receita</code>, em 2 casas): as colunas <code>dia</code>, <code>pedidos</code> e <code>receita</code>.</p>`,
      dica: 'pedidos.groupBy("dia").agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("receita"))',
      codigo: py`
        por_dia = pedidos.groupBy("dia").agg(F.count("*").alias("pedidos"), F.round(F.sum("valor"), 2).alias("receita"))
        por_dia.orderBy("dia").show()
      `,
      regras: [{ dataframe: 'por_dia', colunas: ['dia', 'pedidos', 'receita'], linhas: [['2026-10-13', 2, 150.0], ['2026-10-14', 4, 200.0], ['2026-10-15', 1, 200.0]] }],
      regrasOcultas: [{ dataframe: 'por_dia', colunas: ['dia', 'pedidos', 'receita'], linhas: [['2026-10-20', 1, 30.0], ['2026-10-21', 2, 120.0]] }],
    },
    {
      titulo: 'O ticket médio',
      dificuldade: 'medio',
      enunciado: `
        <p>O <b>ticket médio</b> é quanto cada pedido rendeu, em média. Guarde em <code>ticket</code> o
          <code>por_dia</code> com mais a coluna <code>ticket</code> (receita ÷ pedidos, em 2 casas).</p>`,
      dica: 'por_dia.withColumn("ticket", F.round(F.col("receita") / F.col("pedidos"), 2))',
      codigo: py`
        ticket = por_dia.withColumn("ticket", F.round(F.col("receita") / F.col("pedidos"), 2))
        ticket.orderBy("dia").show()
      `,
      regras: [{ dataframe: 'ticket', colunas: ['dia', 'pedidos', 'receita', 'ticket'], linhas: [['2026-10-13', 2, 150.0, 75.0], ['2026-10-14', 4, 200.0, 50.0], ['2026-10-15', 1, 200.0, 200.0]] }],
      regrasOcultas: [{ dataframe: 'ticket', colunas: ['dia', 'pedidos', 'receita', 'ticket'], linhas: [['2026-10-20', 1, 30.0, 30.0], ['2026-10-21', 2, 120.0, 60.0]] }],
    },
    {
      titulo: 'Clientes novos e recorrentes',
      dificuldade: 'medio',
      enunciado: `
        <p>Um cliente é <b>novo</b> no dia em que se cadastrou e <b>recorrente</b> nos outros. Guarde em
          <code>clientes_dia</code>, para cada dia com pedido, quantos clientes diferentes eram novos e quantos eram
          recorrentes: as colunas <code>dia</code>, <code>novos</code> e <code>recorrentes</code>.</p>`,
      dica: 'Junte pedidos e clientes pelo cliente e compare cadastro com dia. F.countDistinct(F.when(condição, F.col("cliente"))) conta só quem passa na condição.',
      codigo: py`
        com_cadastro = pedidos.join(clientes, "cliente").withColumn("novo", F.col("cadastro") == F.col("dia"))
        clientes_dia = com_cadastro.groupBy("dia").agg(
            F.countDistinct(F.when(F.col("novo"), F.col("cliente"))).alias("novos"),
            F.countDistinct(F.when(~F.col("novo"), F.col("cliente"))).alias("recorrentes"))
        clientes_dia.orderBy("dia").show()
      `,
      regras: [{ dataframe: 'clientes_dia', colunas: ['dia', 'novos', 'recorrentes'], linhas: [['2026-10-13', 1, 1], ['2026-10-14', 1, 2], ['2026-10-15', 1, 0]] }],
      regrasOcultas: [{ dataframe: 'clientes_dia', colunas: ['dia', 'novos', 'recorrentes'], linhas: [['2026-10-20', 1, 0], ['2026-10-21', 0, 2]] }],
    },
    {
      titulo: 'A meta do dia',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>contra_meta</code> uma linha por dia de <code>metas.csv</code>, <b>inclusive os dias sem
          pedido</b> (com pedidos, receita e ticket 0), com as colunas <code>dia</code>, <code>pedidos</code>,
          <code>receita</code>, <code>ticket</code>, <code>meta</code>, <code>atingiu</code> (receita ÷ meta, em %, 1 casa)
          e <code>bateu</code> (verdadeiro se a receita chegou à meta).</p>`,
      dica: 'metas.join(ticket, "dia", "left") mantém todos os dias da meta; fillna(0) zera o que faltou. Termine com select na ordem pedida.',
      codigo: py`
        contra_meta = (metas.join(ticket, "dia", "left").fillna(0)
            .withColumn("atingiu", F.round(F.col("receita") * 100 / F.col("meta"), 1))
            .withColumn("bateu", F.col("receita") >= F.col("meta"))
            .select("dia", "pedidos", "receita", "ticket", "meta", "atingiu", "bateu"))
        contra_meta.orderBy("dia").show()
      `,
      regras: [{
        dataframe: 'contra_meta',
        colunas: META,
        linhas: [
          ['2026-10-13', 2, 150.0, 75.0, 200.0, 75.0, false], ['2026-10-14', 4, 200.0, 50.0, 180.0, 111.1, true],
          ['2026-10-15', 1, 200.0, 200.0, 250.0, 80.0, false], ['2026-10-16', 0, 0, 0, 100.0, 0, false],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'contra_meta',
        colunas: META,
        linhas: [['2026-10-20', 1, 30.0, 30.0, 50.0, 60.0, false], ['2026-10-21', 2, 120.0, 60.0, 100.0, 120.0, true], ['2026-10-22', 0, 0, 0, 80.0, 0, false]],
      }],
    },
    {
      titulo: 'O painel numa tabela só',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>painel</code> o <code>contra_meta</code> com os clientes do dia (0 nos dias sem pedido), em ordem
          de dia, com as colunas <code>dia</code>, <code>pedidos</code>, <code>receita</code>, <code>ticket</code>,
          <code>novos</code>, <code>recorrentes</code>, <code>meta</code>, <code>atingiu</code> e <code>bateu</code>.</p>`,
      dica: 'contra_meta.join(clientes_dia, "dia", "left"), fillna(0, ["novos", "recorrentes"]), select na ordem pedida e orderBy("dia").',
      codigo: py`
        painel = (contra_meta.join(clientes_dia, "dia", "left").fillna(0, ["novos", "recorrentes"])
            .select("dia", "pedidos", "receita", "ticket", "novos", "recorrentes", "meta", "atingiu", "bateu")
            .orderBy("dia"))
        painel.show()
      `,
      regras: [{
        dataframe: 'painel',
        colunas: PAINEL,
        ordem: true,
        linhas: [
          ['2026-10-13', 2, 150.0, 75.0, 1, 1, 200.0, 75.0, false], ['2026-10-14', 4, 200.0, 50.0, 1, 2, 180.0, 111.1, true],
          ['2026-10-15', 1, 200.0, 200.0, 1, 0, 250.0, 80.0, false], ['2026-10-16', 0, 0, 0, 0, 0, 100.0, 0, false],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'painel',
        colunas: PAINEL,
        ordem: true,
        linhas: [
          ['2026-10-20', 1, 30.0, 30.0, 1, 0, 50.0, 60.0, false], ['2026-10-21', 2, 120.0, 60.0, 0, 2, 100.0, 120.0, true],
          ['2026-10-22', 0, 0, 0, 0, 0, 80.0, 0, false],
        ],
      }],
    },
  ],
});
```

(Os dias são `date` com o `inferSchema`, e a correção os recebe como texto `AAAA-MM-DD`, como no `show`.)

Em `src/conteudo/projetos/index.js`: `import { projetoPainel } from './painel.js';` e acrescente `projetoPainel` no fim de `PROJETOS`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "painel|vem por último" > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL|faltou|sobrou|esperad" $TEMP/v.txt | head -20`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/projetos/painel.js src/conteudo/projetos/index.js tests/projetos.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: painel de indicadores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 📝 Notas de exame

**Files:**
- Create: `src/conteudo/projetos/notas.js`
- Modify: `src/conteudo/projetos/index.js`, `tests/projetos.test.js`

**Interfaces:**
- Consumes: `criarProjeto`; `F.percentile_approx` (Task 1).
- Produces: `projetoNotas`.

- [ ] **Step 1: Write the failing test**

Em `tests/projetos.test.js`: `const IDS = ['palavras', 'vendas-regiao', 'logs', 'funil', 'painel', 'notas'];`

- [ ] **Step 2: Run it to verify it fails**

Run: `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |AssertionError" $TEMP/v.txt | head -4`
Expected: FAIL em "vem por último".

- [ ] **Step 3: O projeto**

Crie `src/conteudo/projetos/notas.js`:

```js
// 📝 Notas de exame (sintéticas): tirar as faltas, médias por turma, percentis da escola, a faixa
// de cada aluno e as turmas acima da mediana.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const NOTAS = `aluno,turma,nota
Ana,A,9.0
Bia,A,7.0
Caio,A,
Davi,A,5.0
Edu,B,6.0
Fia,B,8.0
Gil,B,4.0
Hana,B,
Ivo,C,10.0
Jade,C,3.0
`;
const NOTAS_OCULTO = `aluno,turma,nota
Lia,A,6.0
Mel,A,
Nina,B,9.0
Olga,B,7.0
Paulo,B,8.0
Rui,C,5.0
`;

const PERCENTIS = ['p25', 'p50', 'p75', 'p90'];

export const projetoNotas = criarProjeto({
  id: 'notas',
  titulo: 'Notas de exame',
  icone: '📝',
  descricao: 'As notas de uma escola (inventadas): faltas, médias, percentis, a faixa de cada aluno e as turmas acima da mediana.',
  resumo: `
    <p>A escola quer entender as notas do exame. Em <code>notas.csv</code> está a nota de cada aluno; quem faltou está
      com a nota vazia. As notas são inventadas para o exercício.</p>
    <p>A média é puxada por notas muito altas ou muito baixas; os <b>percentis</b> contam outra história: o percentil 25 é
      a nota que deixa um quarto da turma abaixo, e o 50 é a <b>mediana</b>.</p>
    <ol>
      <li>ler e tirar as faltas;</li>
      <li>a média de cada turma;</li>
      <li>os percentis 25, 50, 75 e 90 da escola;</li>
      <li>a faixa de cada aluno;</li>
      <li>as turmas acima da mediana da escola.</li>
    </ol>`,
  dados: { 'notas.csv': NOTAS },
  oculto: { 'notas.csv': NOTAS_OCULTO },
  inicial: py`
    notas = spark.read.csv("notas.csv", header=True, inferSchema=True)
    notas.show()
  `,
  etapas: [
    {
      titulo: 'Tirar as faltas',
      dificuldade: 'facil',
      enunciado: '<p>Guarde em <code>presentes</code> só os alunos que fizeram o exame (com nota), com as mesmas colunas.</p>',
      dica: 'notas.dropna(subset=["nota"])',
      codigo: py`
        presentes = notas.dropna(subset=["nota"])
        presentes.show()
      `,
      regras: [{
        dataframe: 'presentes',
        colunas: ['aluno', 'turma', 'nota'],
        linhas: [['Ana', 'A', 9.0], ['Bia', 'A', 7.0], ['Davi', 'A', 5.0], ['Edu', 'B', 6.0], ['Fia', 'B', 8.0], ['Gil', 'B', 4.0], ['Ivo', 'C', 10.0], ['Jade', 'C', 3.0]],
      }],
      regrasOcultas: [{
        dataframe: 'presentes',
        colunas: ['aluno', 'turma', 'nota'],
        linhas: [['Lia', 'A', 6.0], ['Nina', 'B', 9.0], ['Olga', 'B', 7.0], ['Paulo', 'B', 8.0], ['Rui', 'C', 5.0]],
      }],
    },
    {
      titulo: 'A média de cada turma',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>medias</code>, para cada turma, a média das notas (<code>media</code>, em 2 casas) e quantos alunos
          fizeram o exame (<code>alunos</code>): as colunas <code>turma</code>, <code>media</code> e <code>alunos</code>.</p>`,
      dica: 'presentes.groupBy("turma").agg(F.round(F.avg("nota"), 2).alias("media"), F.count("*").alias("alunos"))',
      codigo: py`
        medias = presentes.groupBy("turma").agg(F.round(F.avg("nota"), 2).alias("media"), F.count("*").alias("alunos"))
        medias.orderBy("turma").show()
      `,
      regras: [{ dataframe: 'medias', colunas: ['turma', 'media', 'alunos'], linhas: [['A', 7.0, 3], ['B', 6.0, 3], ['C', 6.5, 2]] }],
      regrasOcultas: [{ dataframe: 'medias', colunas: ['turma', 'media', 'alunos'], linhas: [['A', 6.0, 1], ['B', 8.0, 3], ['C', 5.0, 1]] }],
    },
    {
      titulo: 'Os percentis da escola',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>percentis</code> um DataFrame de uma linha com os percentis 25, 50, 75 e 90 das notas da escola
          toda: as colunas <code>p25</code>, <code>p50</code>, <code>p75</code> e <code>p90</code>.</p>`,
      dica: 'presentes.agg(F.percentile_approx("nota", 0.25).alias("p25"), …): o percentual vai de 0 a 1.',
      codigo: py`
        percentis = presentes.agg(
            F.percentile_approx("nota", 0.25).alias("p25"),
            F.percentile_approx("nota", 0.5).alias("p50"),
            F.percentile_approx("nota", 0.75).alias("p75"),
            F.percentile_approx("nota", 0.9).alias("p90"))
        percentis.show()
      `,
      regras: [{ dataframe: 'percentis', colunas: PERCENTIS, linhas: [[4.0, 6.0, 8.0, 10.0]] }],
      regrasOcultas: [{ dataframe: 'percentis', colunas: PERCENTIS, linhas: [[6.0, 7.0, 8.0, 9.0]] }],
    },
    {
      titulo: 'A faixa de cada aluno',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>faixas</code> as colunas <code>aluno</code>, <code>turma</code>, <code>nota</code> e
          <code>faixa</code>, com a faixa pelos percentis da escola:</p>
        <ul>
          <li>abaixo do p25: <code>reforço</code>;</li>
          <li>abaixo do p50: <code>regular</code>;</li>
          <li>abaixo do p75: <code>bom</code>;</li>
          <li>do p75 para cima: <code>ótimo</code>.</li>
        </ul>`,
      dica: 'presentes.crossJoin(percentis) põe os percentis em toda linha; depois, F.when(…).when(…).otherwise("ótimo").',
      codigo: py`
        faixa = (F.when(F.col("nota") < F.col("p25"), "reforço")
            .when(F.col("nota") < F.col("p50"), "regular")
            .when(F.col("nota") < F.col("p75"), "bom")
            .otherwise("ótimo"))
        faixas = presentes.crossJoin(percentis).select("aluno", "turma", "nota", faixa.alias("faixa"))
        faixas.show()
      `,
      regras: [{
        dataframe: 'faixas',
        colunas: ['aluno', 'turma', 'nota', 'faixa'],
        linhas: [
          ['Ana', 'A', 9.0, 'ótimo'], ['Bia', 'A', 7.0, 'bom'], ['Davi', 'A', 5.0, 'regular'], ['Edu', 'B', 6.0, 'bom'],
          ['Fia', 'B', 8.0, 'ótimo'], ['Gil', 'B', 4.0, 'regular'], ['Ivo', 'C', 10.0, 'ótimo'], ['Jade', 'C', 3.0, 'reforço'],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'faixas',
        colunas: ['aluno', 'turma', 'nota', 'faixa'],
        linhas: [['Lia', 'A', 6.0, 'regular'], ['Nina', 'B', 9.0, 'ótimo'], ['Olga', 'B', 7.0, 'bom'], ['Paulo', 'B', 8.0, 'ótimo'], ['Rui', 'C', 5.0, 'reforço']],
      }],
    },
    {
      titulo: 'Turmas acima da mediana',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>acima</code> as turmas cuja mediana passa da mediana da escola (o <code>p50</code>), com as
          colunas <code>turma</code>, <code>mediana</code> e <code>diferenca</code> (a mediana da turma menos a da
          escola).</p>`,
      dica: 'A mediana da escola sai de percentis.first().p50; a de cada turma, de groupBy("turma") com F.percentile_approx("nota", 0.5).',
      codigo: py`
        mediana_geral = percentis.first().p50
        acima = (presentes.groupBy("turma")
            .agg(F.percentile_approx("nota", 0.5).alias("mediana"))
            .filter(F.col("mediana") > mediana_geral)
            .withColumn("diferenca", F.col("mediana") - mediana_geral))
        acima.show()
      `,
      regras: [{ dataframe: 'acima', colunas: ['turma', 'mediana', 'diferenca'], linhas: [['A', 7.0, 1.0]] }],
      regrasOcultas: [{ dataframe: 'acima', colunas: ['turma', 'mediana', 'diferenca'], linhas: [['B', 8.0, 1.0]] }],
    },
  ],
});
```

(Conta de cabeça: as 8 notas em ordem são 3, 4, 5, 6, 7, 8, 9, 10; o p25 é a 2ª (ceil(0,25 × 8) = 2), o p50 a 4ª, o p75 a 6ª e o p90 a 8ª (ceil(7,2) = 8). Nas turmas: A = 5, 7, 9 → mediana 7; B = 4, 6, 8 → 6 (não passa de 6); C = 3, 10 → 3.)

Em `src/conteudo/projetos/index.js`: `import { projetoNotas } from './notas.js';` e acrescente `projetoNotas` no fim de `PROJETOS`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "notas|vem por último" > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL|faltou|sobrou|esperad" $TEMP/v.txt | head -20`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo/projetos/notas.js src/conteudo/projetos/index.js tests/projetos.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Projetos: notas de exame

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Glossário, documentação, versão 0.6.0 e a conferência final

**Files:**
- Modify: `src/conteudo/glossario.js`, `tests/glossario.test.js`, `tests/conteudo.test.js:27`, `README.md`, `src/novidades.js`, `package.json`, `package-lock.json`, `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md`, a capa (`og-capa.png`, gerada)

**Interfaces:**
- Consumes: tudo das Tasks 1 a 8.
- Produces: a versão 0.6.0 pronta para publicar (com o "sim").

- [ ] **Step 1: Write the failing tests**

Em `tests/glossario.test.js`, antes do `});` final, acrescente:

```js
  it('os termos dos projetos só aparecem no módulo projetos', () => {
    const texto = 'O percentil 95 das rotas; as palavras vazias saem antes; o funil de conversão da loja';
    expect(ids(texto, 'projetos')).toEqual(expect.arrayContaining(['percentil', 'palavras-vazias', 'funil']));
    expect(ids(texto, 'alem')).not.toContain('percentil');
    expect(ids(texto, 'alem')).not.toContain('funil');
  });
```

Em `tests/conteudo.test.js`, acrescente `['projetos', 30, 6]` no fim da lista do `it.each` da linha 27 (o módulo tem 30 etapas e 6 lições de visão geral).

- [ ] **Step 2: Run them to verify they fail**

Run: `rtk proxy npx vitest run tests/glossario.test.js > $TEMP/v.txt 2>&1; grep -E "Tests |AssertionError" $TEMP/v.txt | head -4`
Expected: FAIL em "os termos dos projetos" (os termos ainda não existem). (O `['projetos', 30, 6]` já passa: as Tasks 3 a 8 montaram o módulo inteiro; ele fica para travar a contagem.)

- [ ] **Step 3: Glossário**

Em `src/conteudo/glossario.js`, no fim do array `GLOSSARIO` (logo antes do `];` da linha 492), acrescente:

```js
  // ---------- Projetos ----------
  {
    id: 'percentil', termo: 'Percentil', padroes: ['percentis?', 'p95', 'mediana'],
    definicao: 'O valor que deixa uma fração dos dados abaixo dele: o percentil 90 é maior ou igual a 90% dos valores. A mediana é o percentil 50.',
    analogia: 'A fila da merenda por altura: o percentil 90 é quem só tem 10% da fila mais alta que ele.',
    exemplo: 'df.agg(F.percentile_approx("ms", 0.95))',
  },
  {
    id: 'palavras-vazias', termo: 'Palavras vazias (stop words)', padroes: ['palavras? vazias?', 'stop ?words?'],
    definicao: 'Palavras muito comuns (a, o, de, que) que quase não dizem nada sobre o texto; saem antes de contar.',
    analogia: 'O "é..." e o "tipo assim" de quem conversa: aparecem toda hora, mas não contam a história.',
    exemplo: 'contagem.join(vazias, "palavra", "left_anti")',
  },
  {
    id: 'funil', termo: 'Funil de conversão', padroes: ['funil', 'funis', 'convers(ão|ões)'],
    definicao: 'As etapas por que o cliente passa até comprar (visita, carrinho, compra) e quantos chegam a cada uma.',
    analogia: 'A peneira do garimpo: entra muita areia, e a cada peneira fica menos, até sobrar o ouro.',
    exemplo: 'eventos.groupBy("evento").agg(F.countDistinct("usuario"))',
  },
```

e em `INICIO_DO_NIVEL` acrescente `projetos: 'percentil'`:

```js
const INICIO_DO_NIVEL = { basico: 'variavel', dados: 'comprehension', paralelismo: 'paralelismo', pyspark: 'spark', alem: 'micro-lote', projetos: 'percentil' };
```

Run: `rtk proxy npx vitest run tests/glossario.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt`
Expected: `Tests  5 passed (5)`.

- [ ] **Step 4: README**

Rode `grep -n "12 lições e 36 exercícios" README.md` para achar o item do módulo 🌊 e acrescente, logo depois do parágrafo dele, no mesmo formato:

```markdown
- **🏗️ Projetos** (0.6.0): **6 projetos de 5 etapas** (30 etapas), pipelines de dados de ponta a ponta com PySpark,
  em que cada etapa continua do código da anterior: contagem de palavras em livros de cordel, vendas por região,
  análise de logs (com percentil 95 e sessões), funil de e-commerce, painel de indicadores e notas de exame. Os
  outros 12 projetos (Spark avançado e além do batch) e o certificado final da trilha chegam nas próximas versões.
```

Se o README tiver o total de exercícios ou de módulos (`grep -n "exercícios\|módulos" README.md | head -20`), atualize para 226 exercícios (196 + 30 etapas) e 6 módulos.

- [ ] **Step 5: Novidades e versão**

Em `src/novidades.js`, no começo de `RELEASES`:

```js
  {
    versao: '0.6.0',
    data: '2026-10-15',
    titulo: 'Projetos',
    resumo: 'O último módulo da trilha começou: projetos de dados de ponta a ponta com PySpark, em que cada etapa continua do código da anterior.',
    grupos: [
      { titulo: '🏗️ Módulo novo', itens: ['6 projetos de 5 etapas: contagem de palavras em livros de cordel, vendas por região, análise de logs, funil de e-commerce, painel de indicadores e notas de exame.', 'Quem resolve uma etapa continua do próprio código na seguinte.', 'Os outros 12 projetos e o certificado final da trilha chegam nas próximas versões.'] },
      { titulo: '✨ PySpark', itens: ['Percentis com percentile_approx, livros inteiros com wholeTextFiles e o momento em segundos com cast("long"), conferidos com o PySpark de verdade.'] },
      { titulo: '📖 Glossário', itens: ['Termos novos: percentil, palavras vazias e funil de conversão.'] },
    ],
  },
```

`package.json` e `package-lock.json` (só as duas primeiras ocorrências, as do próprio pacote): `"version": "0.5.0"` → `"version": "0.6.0"`.

- [ ] **Step 6: Capa**

Run: `rtk proxy npm run badges > $TEMP/b.txt 2>&1; tail -3 $TEMP/b.txt; git status --short`
Expected: `ícones e capa ok`; a capa (`og-capa.png`) muda, com "226 exercícios · 6 projetos". Os badges dos certificados não mudam (nenhum certificado novo); se o `git status` mostrar badges alterados só por bytes, descarte-os com `git checkout -- <arquivo>` e acrescente só a capa.

- [ ] **Step 7: Atualizar a spec**

Em `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md`:
- tabela "Decisões", linha "Certificado": troque "(como no DivergePHP)" por "(no DivergePHP há um certificado de projetos; aqui não, porque os projetos chegam em três versões e um certificado emitido não muda de conteúdo)";
- tabela da 0.6.0, linha 📚: troque "as 10 mais frequentes por livro" por "as 3 mais frequentes por livro (os livros são curtos)";
- §2, primeiro item: troque a assinatura por `criarProjeto({ id, titulo, icone, descricao, resumo, dados, oculto, inicial, etapas })` e acrescente: "Cada etapa traz `codigo` (o trecho que entra no fim do `main.py`) ou `alteracoes` (os arquivos que troca)."
- §2, novo item no fim: "O motor ganha o que os projetos da 0.6.0 usam: `F.percentile_approx`, `sc.wholeTextFiles` e o CAST de TIMESTAMP para segundos, conferidos com o PySpark real (`c16`)."
- §2, item da tela: acrescente "Na trilha, um módulo sem certificado não tem troféu."

- [ ] **Step 8: Conferência inteira**

Run, em ordem (cada um precisa terminar verde):
- `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > $TEMP/pt.txt 2>&1; tail -2 $TEMP/pt.txt`
- `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py > $TEMP/c.txt 2>&1; tail -2 $TEMP/c.txt` → 16/16
- `rtk proxy npx vitest run > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests " $TEMP/v.txt`
- `rtk proxy npx eslint -f json -o $TEMP/eslint.json .; node -e "const r=require(process.argv[1]);console.log(r.reduce((s,f)=>s+f.errorCount+f.warningCount,0))" $(cygpath -m $TEMP/eslint.json)` → 0
- `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") rtk proxy npm run build > $TEMP/b.txt 2>&1; tail -3 $TEMP/b.txt`

Depois, o preview (`preview_start` com o nome `python-playground`):
- abra `#/trilha`: o módulo 🏗️ aparece depois do 🌊, com o cenário `cidade`, os 6 projetos como subunidades, sem troféu e sem a faixa "em breve";
- abra `#/` (landing): 6 módulos, "6 projetos · 30 etapas" no cartão dos projetos, e nenhum cartão "em breve";
- abra `#/item/palavras-2` (ou a rota de item que o site usa: `grep -n "linkItem" src/ui/*.js | head -2`), confira a caixa "📚 Contagem de palavras em livros · etapa 2 de 5" e rode a solução de referência da etapa (cole o `main.py` da solução no editor): os testes visíveis passam;
- rode o axe (`https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`, injetado pela página) na trilha e num item de projeto, nos temas `dracula`, `claro`, `suave` e `alto-contraste`, com `runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']`: nenhuma violação nova (o `label-content-name-mismatch` dos troféus é conhecido e anterior);
- com a largura de 375px (`resize_window` preset `mobile`), a trilha e o item de projeto não têm rolagem horizontal.

- [ ] **Step 9: Commit**

```bash
git add src/conteudo/glossario.js tests/glossario.test.js tests/conteudo.test.js README.md src/novidades.js package.json package-lock.json docs/superpowers/specs/2026-10-15-fase6-projetos-design.md public/og-capa.png
git status --short
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 0.6.0: Projetos de DataFrame e SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Confira no `git status --short` que nada de fora desta lista ficou de fora ou entrou por engano.)

- [ ] **Step 10 (só com o "sim"): publicar**

Peça o "sim" ao usuário. Com ele: `git push -u origin fase6` (do checkout principal, não de um worktree), abra o PR para `main` com o corpo terminando em "🤖 Generated with [Claude Code](https://claude.com/claude-code)", confira o CI (a conformidade roda os 16 programas no PySpark real, inclusive o `c16`), e faça o merge com rebase, como os anteriores. Depois do deploy, confira o site no ar (`#/trilha` e um item de projeto).
