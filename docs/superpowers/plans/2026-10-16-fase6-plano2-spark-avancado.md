# Fase 6, plano 2: 🏗️ Projetos de Spark avançado (0.7.0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao módulo 🏗️ Projetos os 6 projetos de Spark avançado (30 etapas), com o `DataFrame.unpivot` no motor, na versão 0.7.0.

**Architecture:** Os projetos seguem o modelo `criarProjeto` da 0.6.0 (`src/conteudo/projetos/base.js`): um arquivo por projeto, registrado em `PROJETOS` (`src/conteudo/projetos/index.js`). Os dados são gerados por funções pequenas no próprio arquivo, a partir de listas escritas à mão. O motor ganha `unpivot`/`melt`, montado com `explode` de uma lista de `struct` (a mesma ordem de linhas do Spark), conferido contra o PySpark real no CI (`c17`).

**Tech Stack:** JavaScript (ES modules), vitest, eslint; Python 3.14 (Pyodide no site, CPython nos testes), pytest; o `pyspark` próprio em `python/pyspark/`.

**Spec:** `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md` (seção 1 "0.7.0", 2, 3, 5, 6 e 7). Plano anterior: `docs/superpowers/plans/2026-10-15-fase6-plano1-dataframe-sql.md`.

## Global Constraints

- 6 projetos novos, nesta ordem, depois dos 6 da 0.6.0: `mobilidade` 🚌, `saude` 🏥, `agro` 🌾, `energia` ☀️, `hashtags` #️⃣, `logistica` 🚚.
- Cada projeto: a lição `<id>-visao-geral` e as etapas `<id>-1` a `<id>-5`, com as dificuldades **fácil, médio, médio, difícil, difícil**.
- Dados escritos à mão, pequenos, com tema brasileiro; o caso oculto troca só arquivos que o visível tem, com os mesmos nomes.
- Sem regra de correção nova. A ordem das partições não é conferida: o hash do nosso `repartition` não é o do Spark.
- A configuração do Spark (`spark.conf.set`) volta ao padrão a cada execução (conferido: `autoBroadcastJoinThreshold` não vaza de uma execução para a outra).
- Versão **0.7.0**. Publicar (push, PR, merge) só com o "sim" do usuário.
- Commits como `Cláudio Raposo <engcfraposo@gmail.com>` (via `git -c user.name=... -c user.email=...`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O valor de `CERTIFICADO_SEGREDO` nunca aparece no código nem no site; o build local usa um valor aleatório: `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.
- Neste Windows o `rtk` esconde saídas: use `rtk proxy <comando>`; leia o pytest de um arquivo, com `PYTHONIOENCODING=utf-8`. Código JS com barra invertida vai pelo Edit/Write, nunca por heredoc. Arquivos de teste gravados no Python usam `newline=''`/`newline='\n'`.
- Os blocos de código deste plano saem para os arquivos com `python /tmp/scr/blocos7.py <índice> <destino>` (cópia do `blocos6.py` apontando para este plano).

## Review Focus

1. **`unpivot` com colunas de tipos diferentes** (int e bigint, int e double): o tipo do valor é o mais largo, como no Spark; texto com número dá `AnalysisException`. Testes na Task 1.
2. **`unpivot` sem `values`** (`None`): usa todas as colunas que não são id. Teste na Task 1.
3. **Hashtags com usuário sem seguidores** (lista vazia): o `explode` some com ele, sem erro, e o alcance não conta ninguém a mais. Coberto pelos dados do projeto (`davi` e `gil` sem seguidores).
4. **Energia com hora que não chegou e leitura vazia na mesma série**: a lacuna e o preenchimento são coisas diferentes; a hora que falta não é preenchida. Coberto pelos dados (Juazeiro tem as duas no dia 2).
5. **Logística depois de desligar o broadcast automático**: o `broadcast()` explícito continua valendo. Regra `plano` na etapa 4 confere os dois.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `python/pyspark/sql/dataframe.py` | `DataFrame.unpivot(ids, values, variableColumnName, valueColumnName)` e `melt`. |
| `python/tests/test_spark_projetos.py` | Testes do `unpivot`. |
| `python/conformidade/c17_unpivot.py` + `c17.esperado` (novos) | O `unpivot` comparado com o PySpark real. |
| `python/tests/test_conformidade.py` | 17 programas. |
| `src/conteudo/projetos/mobilidade.js`, `saude.js`, `agro.js`, `energia.js`, `hashtags.js`, `logistica.js` (novos) | Um projeto cada. |
| `src/conteudo/projetos/index.js`, `tests/projetos.test.js` | Os projetos registrados e a lista `IDS`. |
| `src/conteudo/glossario.js`, `tests/glossario.test.js` | Salting, média móvel e pivot. |
| `tests/conteudo.test.js` | `['projetos', 60, 12]`. |
| Documentação | README, novidades 0.7.0, spec, `package.json`, capa. |

---

### Task 1: `DataFrame.unpivot` no motor

**Files:**
- Modify: `python/pyspark/sql/dataframe.py`, `python/tests/test_spark_projetos.py`, `python/tests/test_conformidade.py`
- Create: `python/conformidade/c17_unpivot.py`, `python/conformidade/c17.esperado`

**Interfaces:**
- Consumes: `F.explode`, `F.array`, `F.struct`, `F.lit` (já existem).
- Produces: `df.unpivot(ids, values, variableColumnName, valueColumnName)` → DataFrame com as colunas de `ids`, a coluna de nome (string) e a de valor; `df.melt` é o mesmo. A Task 4 (agro) usa.

- [ ] **Step 1: Write the failing tests**

No fim de `python/tests/test_spark_projetos.py`, acrescente:

```python
def test_unpivot_volta_ao_formato_longo(spark):
    largo = spark.createDataFrame([('soja', 36, 41), ('milho', 23, 25)], ['cultura', '2023', '2024'])
    longo = largo.unpivot('cultura', ['2023', '2024'], 'ano', 'toneladas')
    assert longo.dtypes == [('cultura', 'string'), ('ano', 'string'), ('toneladas', 'bigint')]
    assert [tuple(r) for r in longo.collect()] == [('soja', '2023', 36), ('soja', '2024', 41), ('milho', '2023', 23), ('milho', '2024', 25)]
    assert [tuple(r) for r in largo.melt(['cultura'], None, 'ano', 't').collect()] == [tuple(r) for r in longo.collect()]


def test_unpivot_tipos_diferentes(spark):
    df = spark.createDataFrame([(1, 2, 2.5)], 'id INT, a INT, b DOUBLE')
    assert df.unpivot('id', ['a', 'b'], 'k', 'v').dtypes == [('id', 'int'), ('k', 'string'), ('v', 'double')]
    misto = spark.createDataFrame([(1, 'x', 2)], 'id INT, a STRING, b INT')
    with pytest.raises(AnalysisException, match='UNPIVOT_VALUE_DATA_TYPE_MISMATCH'):
        misto.unpivot('id', ['a', 'b'], 'k', 'v')
```

Em `python/tests/test_conformidade.py`: `assert len(PROGRAMAS) == 17`.

Crie `python/conformidade/c17_unpivot.py`:

```python
"""unpivot e melt: do formato largo para o longo, com a ordem das linhas e os tipos do Spark."""
from pyspark.sql import functions as F

from _comum import sessao

spark = sessao()

largo = spark.createDataFrame([('soja', 36, 41, 43), ('milho', 23, 25, 30)], ['cultura', '2023', '2024', '2025'])
longo = largo.unpivot('cultura', ['2023', '2024', '2025'], 'ano', 'toneladas')
print(longo.dtypes)
longo.show()
longo.withColumn('ano', F.col('ano').cast('int')).orderBy('ano', 'cultura').show()
print(largo.melt(['cultura'], None, 'ano', 'toneladas').count())
misto = spark.createDataFrame([(1, 2, 2.5)], 'id INT, a INT, b DOUBLE')
print(misto.unpivot('id', ['a', 'b'], 'k', 'v').dtypes, misto.unpivot('id', ['a', 'b'], 'k', 'v').collect())

spark.stop()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests/test_spark_projetos.py python/tests/test_conformidade.py::test_ha_programas -q -p no:randomly > $TEMP/pt.txt 2>&1; grep -E "Error|passed|failed" $TEMP/pt.txt | tail -5`
Expected: 2 testes de unpivot falham com `AttributeError: 'DataFrame' object has no attribute 'unpivot'`; `test_ha_programas` passa (17 programas).

- [ ] **Step 3: Implement**

Em `python/pyspark/sql/dataframe.py`, logo depois do método `crossJoin`, acrescente:

```python
    def unpivot(self, ids, values, variableColumnName, valueColumnName):
        """Do formato largo para o longo: cada coluna de `values` vira uma linha (nome e valor). As
        linhas saem na ordem do Spark (cada linha de entrada, coluna a coluna), com o tipo de valor
        mais largo entre as colunas."""
        from . import functions as F
        from ..errors import AnalysisException
        ids = [ids] if isinstance(ids, str) else list(ids)
        if values is None:
            values = [c for c in self.columns if c not in ids]
        values = [values] if isinstance(values, str) else list(values)
        tipos = dict(self.dtypes)
        distintos = {tipos[v] for v in values}
        if len(distintos) == 1:
            alvo = distintos.pop()
        elif distintos <= {'tinyint', 'smallint', 'int', 'bigint'}:
            alvo = 'bigint'
        elif distintos <= {'tinyint', 'smallint', 'int', 'bigint', 'float', 'double'}:
            alvo = 'double'
        else:
            raise AnalysisException(
                f'[UNPIVOT_VALUE_DATA_TYPE_MISMATCH] Unpivot value columns must share a least common type, some types do not: '
                f'[{", ".join(f"{chr(34)}{tipos[v].upper()}{chr(34)}" for v in values)}].',
                'UNPIVOT_VALUE_DATA_TYPE_MISMATCH', {}, '42K09')
        pares = [F.struct(F.lit(v).alias(variableColumnName), F.col(f'`{v}`').cast(alvo).alias(valueColumnName)) for v in values]
        return (self.select(*ids, F.explode(F.array(*pares)).alias('__unpivot'))
                .select(*ids, f'__unpivot.{variableColumnName}', f'__unpivot.{valueColumnName}'))

    melt = unpivot
```

(Os nomes `2023` precisam de crase em `F.col`, porque começam com dígito; confira com o teste. Se o nosso `F.col` não aceitar crase, use `self[v]`.)

- [ ] **Step 4: Run them to verify they pass**

Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests/test_spark_projetos.py -q -p no:randomly > $TEMP/pt.txt 2>&1; grep -E "passed|failed" $TEMP/pt.txt | tail -1`
Expected: `8 passed`.

- [ ] **Step 5: Conformidade**

Run: `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py --gravar c17_unpivot > $TEMP/c.txt 2>&1; cat python/conformidade/c17.esperado`
Expected: `[('cultura', 'string'), ('ano', 'string'), ('toneladas', 'bigint')]`; a primeira tabela com as linhas soja 2023/2024/2025 e depois milho; a segunda em ordem de ano; `6`; `[('id', 'int'), ('k', 'string'), ('v', 'double')] [Row(id=1, k='a', v=2.0), Row(id=1, k='b', v=2.5)]`.

Run: `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py > $TEMP/c.txt 2>&1; tail -1 $TEMP/c.txt` → `17/17`.
Run: `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > $TEMP/pt.txt 2>&1; grep -E "passed|failed" $TEMP/pt.txt | tail -1` → nenhum `failed`.

- [ ] **Step 6: Commit**

```bash
git add python/pyspark/sql/dataframe.py python/tests/test_spark_projetos.py python/tests/test_conformidade.py python/conformidade/c17_unpivot.py python/conformidade/c17.esperado
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "PySpark: unpivot e melt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

Em cada uma das Tasks 2 a 7, os passos são os mesmos (só mudam o arquivo, o nome e o filtro):

1. **Test first:** acrescente o id no fim de `IDS` em `tests/projetos.test.js` (`python /tmp/scr/proj.py ids <id>`).
2. **Run, expect fail:** `rtk proxy npx vitest run tests/projetos.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt` → `2 failed` ("vem por último" e a visão geral do id novo).
3. **Implement:** grave o bloco do projeto em `src/conteudo/projetos/<arquivo>.js` e registre-o (`python /tmp/scr/proj.py registra <arquivo> <Nome>`: import e fim de `PROJETOS`).
4. **Run, expect pass:** `rtk proxy npx vitest run tests/projetos.test.js tests/conteudo.test.js -t "<filtro>|vem por último" --reporter=verbose > $TEMP/v.txt 2>&1; grep -E "Tests |×|faltou|sobrou|esperad" $TEMP/v.txt | head -20` → só verdes: a visão geral roda, as 5 soluções passam no visível e no oculto, os 5 códigos iniciais falham no visível.
5. **Commit:** `git add src/conteudo/projetos/<arquivo>.js src/conteudo/projetos/index.js tests/projetos.test.js` e `git commit -m "Projetos: <título>"` com o autor e o Co-Authored-By das restrições.

Os valores esperados de cada etapa foram rodados no motor (com os dados abaixo) antes de entrar no plano.

### Task 2: 🚌 Mobilidade urbana

**Files:** Create `src/conteudo/projetos/mobilidade.js`; Modify `src/conteudo/projetos/index.js`, `tests/projetos.test.js`.
**Interfaces:** Consumes `criarProjeto`, `py`. Produces `projetoMobilidade`. Filtro: `mobilidade`.

```js
// 🚌 Mobilidade urbana: um terminal com muito mais viagens que os outros desequilibra o groupBy.
// O "salting" espalha a chave grande em pedaços e a agregação em dois passos junta de volta.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (viagens) => `id,linha,terminal,minutos\n${viagens.map((v, i) => `${i + 1},${v.join(',')}\n`).join('')}`;

const VIAGENS = csv([
  [101, 'Centro', 30], [101, 'Centro', 25], [102, 'Centro', 40], [102, 'Centro', 35], [103, 'Centro', 20], [101, 'Centro', 30],
  [104, 'Praia', 50], [101, 'Centro', 28], [102, 'Centro', 33], [103, 'Centro', 22], [104, 'Praia', 45], [105, 'Bairro Novo', 15],
  [101, 'Centro', 27], [103, 'Centro', 21], [105, 'Bairro Novo', 18], [102, 'Centro', 38],
]);
const VIAGENS_OCULTO = csv([
  [201, 'Rodoviária', 10], [201, 'Rodoviária', 12], [202, 'Aeroporto', 40], [201, 'Rodoviária', 11], [203, 'Rodoviária', 9],
  [202, 'Aeroporto', 44], [203, 'Rodoviária', 13], [201, 'Rodoviária', 10], [202, 'Aeroporto', 42], [203, 'Rodoviária', 8],
]);

export const projetoMobilidade = criarProjeto({
  id: 'mobilidade',
  titulo: 'Mobilidade urbana',
  icone: '🚌',
  descricao: 'As viagens de ônibus da cidade: um terminal muito cheio desequilibra o trabalho, e o salting reparte.',
  resumo: `
    <p>Em <code>viagens.csv</code> está cada viagem de ônibus: a linha, o terminal de onde saiu e quantos minutos levou.
      Quase tudo sai do <b>Centro</b>. No Spark, todas as linhas de uma mesma chave vão para a mesma tarefa: a tarefa do
      Centro fica com quase todo o trabalho enquanto as outras esperam. É a <b>distorção</b> (skew).</p>
    <p>O <b>salting</b> acrescenta à chave um "sal" (aqui, o resto da divisão do id por 4): o Centro vira 4 chaves menores,
      que vão para tarefas diferentes. Depois, uma segunda agregação junta os pedaços.</p>
    <ol>
      <li>as viagens e o tempo médio de cada linha;</li>
      <li>medir o desequilíbrio entre os terminais;</li>
      <li>salgar a chave e contar por terminal e sal;</li>
      <li>juntar os pedaços de volta;</li>
      <li>comparar a maior tarefa e os planos, com e sem sal.</li>
    </ol>`,
  dados: { 'viagens.csv': VIAGENS },
  oculto: { 'viagens.csv': VIAGENS_OCULTO },
  inicial: py`
    viagens = spark.read.csv("viagens.csv", header=True, inferSchema=True)
    viagens.show()
  `,
  etapas: [
    {
      titulo: 'Viagens por linha',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>por_linha</code>, para cada linha, o número de viagens (<code>viagens</code>) e o tempo médio
          (<code>media</code>, em 1 casa): as colunas <code>linha</code>, <code>viagens</code> e <code>media</code>.</p>`,
      dica: 'viagens.groupBy("linha").agg(F.count("*").alias("viagens"), F.round(F.avg("minutos"), 1).alias("media"))',
      codigo: py`
        por_linha = viagens.groupBy("linha").agg(F.count("*").alias("viagens"), F.round(F.avg("minutos"), 1).alias("media"))
        por_linha.orderBy("linha").show()
      `,
      regras: [{ dataframe: 'por_linha', colunas: ['linha', 'viagens', 'media'], linhas: [[101, 5, 28.0], [102, 4, 36.5], [103, 3, 21.0], [104, 2, 47.5], [105, 2, 16.5]] }],
      regrasOcultas: [{ dataframe: 'por_linha', colunas: ['linha', 'viagens', 'media'], linhas: [[201, 4, 10.8], [202, 3, 42.0], [203, 3, 10.0]] }],
    },
    {
      titulo: 'O desequilíbrio',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_terminal</code> as viagens de cada terminal (<code>groupBy("terminal").count()</code>) e em
          <code>desequilibrio</code> quantas vezes o terminal mais cheio passa da média dos terminais (em 2 casas).</p>
        <p>Com 12, 2 e 2 viagens, a média é 16 ÷ 3 e o desequilíbrio é 12 ÷ (16 ÷ 3) = 2,25: a maior tarefa trabalha 2,25
          vezes a média.</p>`,
      dica: 'Traga as contagens com [linha["count"] for linha in por_terminal.collect()] e use max, sum e len do Python.',
      codigo: py`
        por_terminal = viagens.groupBy("terminal").count()
        contagens = [linha["count"] for linha in por_terminal.collect()]
        desequilibrio = round(max(contagens) / (sum(contagens) / len(contagens)), 2)
        print("desequilíbrio:", desequilibrio)
      `,
      regras: [
        { dataframe: 'por_terminal', colunas: ['terminal', 'count'], linhas: [['Centro', 12], ['Bairro Novo', 2], ['Praia', 2]] },
        { variavel: 'desequilibrio', igual: 2.25 },
      ],
      regrasOcultas: [
        { dataframe: 'por_terminal', colunas: ['terminal', 'count'], linhas: [['Rodoviária', 7], ['Aeroporto', 3]] },
        { variavel: 'desequilibrio', igual: 1.4 },
      ],
    },
    {
      titulo: 'Salgar a chave',
      dificuldade: 'medio',
      enunciado: `
        <p>Acrescente às viagens a coluna <code>sal</code> (o id módulo 4) e guarde em <code>parcial</code> a contagem por
          terminal e sal: as colunas <code>terminal</code>, <code>sal</code> e <code>count</code>. O Centro, que era uma
          chave só, vira quatro.</p>`,
      dica: 'viagens.withColumn("sal", F.col("id") % 4).groupBy("terminal", "sal").count()',
      codigo: py`
        parcial = (viagens.withColumn("sal", F.col("id") % 4)
            .groupBy("terminal", "sal").count())
        parcial.orderBy("terminal", "sal").show()
      `,
      regras: [{
        dataframe: 'parcial',
        colunas: ['terminal', 'sal', 'count'],
        linhas: [['Centro', 0, 3], ['Centro', 1, 4], ['Centro', 2, 4], ['Centro', 3, 1], ['Praia', 3, 2], ['Bairro Novo', 0, 1], ['Bairro Novo', 3, 1]],
      }],
      regrasOcultas: [{
        dataframe: 'parcial',
        colunas: ['terminal', 'sal', 'count'],
        linhas: [['Rodoviária', 0, 2], ['Rodoviária', 1, 2], ['Rodoviária', 2, 2], ['Rodoviária', 3, 1], ['Aeroporto', 1, 1], ['Aeroporto', 2, 1], ['Aeroporto', 3, 1]],
      }],
    },
    {
      titulo: 'Juntar os pedaços',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>total</code> as viagens de cada terminal somando os pedaços de <code>parcial</code>: as colunas
          <code>terminal</code> e <code>viagens</code>. O resultado é o mesmo do <code>por_terminal</code>, mas o plano tem
          dois shuffles: um para cada agregação.</p>`,
      dica: 'parcial.groupBy("terminal").agg(F.sum("count").alias("viagens")); veja os dois Exchange no total.explain().',
      codigo: py`
        total = parcial.groupBy("terminal").agg(F.sum("count").alias("viagens"))
        total.show()
      `,
      regras: [
        { dataframe: 'total', colunas: ['terminal', 'viagens'], linhas: [['Centro', 12], ['Bairro Novo', 2], ['Praia', 2]] },
        { plano: 'total', shuffles: 2 },
      ],
      regrasOcultas: [
        { dataframe: 'total', colunas: ['terminal', 'viagens'], linhas: [['Rodoviária', 7], ['Aeroporto', 3]] },
        { plano: 'total', shuffles: 2 },
      ],
    },
    {
      titulo: 'Comparar a maior tarefa',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>maior_direto</code> o maior grupo do <code>por_terminal</code> (as linhas que a tarefa mais cheia
          recebe sem sal) e em <code>maior_salgado</code> o maior grupo do <code>parcial</code> (com sal).</p>
        <p>Compare também os planos: <code>por_terminal</code> tem um shuffle; <code>total</code>, dois. O sal troca um
          shuffle a mais por tarefas mais parecidas.</p>`,
      dica: 'por_terminal.agg(F.max("count")).first()[0]; o mesmo no parcial. por_terminal.explain() e total.explain().',
      codigo: py`
        maior_direto = por_terminal.agg(F.max("count")).first()[0]
        maior_salgado = parcial.agg(F.max("count")).first()[0]
        por_terminal.explain()
        total.explain()
        print("maior tarefa:", maior_direto, "→", maior_salgado)
      `,
      regras: [{ variavel: 'maior_direto', igual: 12 }, { variavel: 'maior_salgado', igual: 4 }, { plano: 'por_terminal', shuffles: 1 }],
      regrasOcultas: [{ variavel: 'maior_direto', igual: 7 }, { variavel: 'maior_salgado', igual: 2 }, { plano: 'por_terminal', shuffles: 1 }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra mobilidade projetoMobilidade`.

### Task 3: 🏥 Saúde pública

**Files:** Create `src/conteudo/projetos/saude.js`; Modify `index.js`, `tests/projetos.test.js`.
**Interfaces:** Produces `projetoSaude`. Filtro: `saude`.

```js
// 🏥 Saúde pública: os atendimentos de cada município, a média móvel de 7 dias, a variação da
// semana, os municípios em alta e o ranking de cada região.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const dia = (d) => `2026-10-${String(d + 1).padStart(2, '0')}`;
const csv = (municipios) => `municipio,regiao,dia,casos\n${Object.entries(municipios)
  .flatMap(([municipio, [regiao, casos]]) => casos.map((c, d) => `${municipio},${regiao},${dia(d)},${c}\n`)).join('')}`;
const porDia = (totais) => totais.map((c, d) => [dia(d), c]);

const ATENDIMENTOS = csv({
  Crato: ['Cariri', [5, 6, 5, 7, 6, 8, 7, 9, 10, 9, 11, 12, 11, 13]],
  Juazeiro: ['Cariri', [10, 12, 11, 10, 13, 12, 11, 10, 9, 11, 10, 9, 10, 8]],
  Barbalha: ['Cariri', [2, 3, 2, 2, 3, 2, 3, 3, 4, 3, 4, 5, 4, 5]],
  Sobral: ['Norte', [8, 8, 9, 8, 7, 8, 9, 8, 9, 8, 8, 9, 8, 8]],
});
const ATENDIMENTOS_OCULTO = csv({
  Iguatu: ['Centro-Sul', [3, 3, 4, 3, 4, 3, 4, 5, 6, 5, 7, 6, 7, 8]],
  Quixadá: ['Sertão Central', [6, 6, 5, 6, 7, 6, 6, 5, 5, 4, 5, 4, 4, 3]],
});

const MOVEL = ['municipio', 'dia', 'casos', 'media7'];
const VARIACAO = ['municipio', 'regiao', 'semana', 'anterior', 'variacao'];
const RANKING = ['regiao', 'municipio', 'media7', 'posicao'];

export const projetoSaude = criarProjeto({
  id: 'saude',
  titulo: 'Saúde pública',
  icone: '🏥',
  descricao: 'Os atendimentos dos municípios do Ceará: média móvel, variação da semana, municípios em alta e ranking.',
  resumo: `
    <p>A secretaria de saúde acompanha os atendimentos de um tipo de doença em cada município, dia a dia, em
      <code>atendimentos.csv</code> (14 dias, dados inventados). Um dia sozinho engana: um feriado derruba os números, e
      uma segunda-feira os infla. A <b>média móvel de 7 dias</b> alisa a curva.</p>
    <ol>
      <li>os casos de cada dia no estado;</li>
      <li>a média móvel de 7 dias de cada município;</li>
      <li>a variação da última semana sobre a anterior;</li>
      <li>os municípios em alta;</li>
      <li>o ranking de cada região pela média móvel.</li>
    </ol>`,
  dados: { 'atendimentos.csv': ATENDIMENTOS },
  oculto: { 'atendimentos.csv': ATENDIMENTOS_OCULTO },
  inicial: py`
    atendimentos = spark.read.csv("atendimentos.csv", header=True, inferSchema=True)
    atendimentos.show(5)
  `,
  etapas: [
    {
      titulo: 'Casos por dia',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>por_dia</code> os casos de cada dia somando todos os municípios, em ordem de dia: as colunas
          <code>dia</code> e <code>casos</code>.</p>`,
      dica: 'atendimentos.groupBy("dia").agg(F.sum("casos").alias("casos")).orderBy("dia")',
      codigo: py`
        por_dia = atendimentos.groupBy("dia").agg(F.sum("casos").alias("casos")).orderBy("dia")
        por_dia.show(14)
      `,
      regras: [{ dataframe: 'por_dia', colunas: ['dia', 'casos'], ordem: true, linhas: porDia([25, 29, 27, 27, 29, 30, 30, 30, 32, 31, 33, 35, 33, 34]) }],
      regrasOcultas: [{ dataframe: 'por_dia', colunas: ['dia', 'casos'], ordem: true, linhas: porDia([9, 9, 9, 9, 11, 9, 10, 10, 11, 9, 12, 10, 11, 11]) }],
    },
    {
      titulo: 'A média móvel de 7 dias',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>movel</code>, para cada município e dia, a média dos casos daquele dia e dos 6 anteriores
          (<code>media7</code>, em 1 casa): as colunas <code>municipio</code>, <code>dia</code>, <code>casos</code> e
          <code>media7</code>.</p>
        <p>Fique só com os dias que já têm 7 dias de histórico: nos 6 primeiros, a média ainda não é de uma semana.</p>`,
      dica: 'Uma janela Window.partitionBy("municipio").orderBy("dia").rowsBetween(-6, 0): F.avg e F.count sobre ela; filtre count == 7.',
      codigo: py`
        from pyspark.sql import Window

        sete = Window.partitionBy("municipio").orderBy("dia").rowsBetween(-6, 0)
        movel = (atendimentos
            .withColumn("media7", F.round(F.avg("casos").over(sete), 1))
            .withColumn("dias", F.count("casos").over(sete))
            .filter(F.col("dias") == 7)
            .select("municipio", "dia", "casos", "media7"))
        movel.show()
      `,
      regras: [{ dataframe: 'movel', colunas: MOVEL, total: 32 }],
      regrasOcultas: [{ dataframe: 'movel', colunas: MOVEL, total: 16 }],
    },
    {
      titulo: 'A variação da semana',
      dificuldade: 'medio',
      enunciado: `
        <p>No último dia, compare os casos dos últimos 7 dias (<code>semana</code>) com os dos 7 dias antes deles
          (<code>anterior</code>). Guarde em <code>variacao</code> uma linha por município, com as colunas
          <code>municipio</code>, <code>regiao</code>, <code>semana</code>, <code>anterior</code> e <code>variacao</code>
          (a diferença em %, 1 casa).</p>`,
      dica: 'F.sum("casos").over(sete) dá a semana; F.lag("semana", 7) numa janela por município em ordem de dia dá a anterior. O último dia sai de atendimentos.agg(F.max("dia")).first()[0].',
      codigo: py`
        ordem = Window.partitionBy("municipio").orderBy("dia")
        ultimo = atendimentos.agg(F.max("dia")).first()[0]
        variacao = (atendimentos
            .withColumn("semana", F.sum("casos").over(sete))
            .withColumn("anterior", F.lag("semana", 7).over(ordem))
            .filter(F.col("dia") == ultimo)
            .select("municipio", "regiao", "semana", "anterior",
                    F.round((F.col("semana") - F.col("anterior")) * 100 / F.col("anterior"), 1).alias("variacao")))
        variacao.show()
      `,
      regras: [{
        dataframe: 'variacao',
        colunas: VARIACAO,
        linhas: [['Crato', 'Cariri', 75, 44, 70.5], ['Barbalha', 'Cariri', 28, 17, 64.7], ['Sobral', 'Norte', 58, 57, 1.8], ['Juazeiro', 'Cariri', 67, 79, -15.2]],
      }],
      regrasOcultas: [{
        dataframe: 'variacao',
        colunas: VARIACAO,
        linhas: [['Quixadá', 'Sertão Central', 30, 42, -28.6], ['Iguatu', 'Centro-Sul', 44, 24, 83.3]],
      }],
    },
    {
      titulo: 'Municípios em alta',
      dificuldade: 'dificil',
      enunciado: `
        <p>Um município está <b>em alta</b> quando a semana passou da anterior em mais de 10%. Guarde em <code>em_alta</code>
          esses municípios, com as colunas <code>municipio</code> e <code>variacao</code>, da maior alta para a menor.</p>`,
      dica: 'variacao.filter(F.col("variacao") > 10).select("municipio", "variacao").orderBy(F.desc("variacao"))',
      codigo: py`
        em_alta = (variacao.filter(F.col("variacao") > 10)
            .select("municipio", "variacao")
            .orderBy(F.desc("variacao")))
        em_alta.show()
      `,
      regras: [{ dataframe: 'em_alta', colunas: ['municipio', 'variacao'], ordem: true, linhas: [['Crato', 70.5], ['Barbalha', 64.7]] }],
      regrasOcultas: [{ dataframe: 'em_alta', colunas: ['municipio', 'variacao'], ordem: true, linhas: [['Iguatu', 83.3]] }],
    },
    {
      titulo: 'O ranking de cada região',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>ranking</code> a posição de cada município na sua região pela média móvel do último dia (1 para a
          maior): as colunas <code>regiao</code>, <code>municipio</code>, <code>media7</code> e <code>posicao</code>.</p>`,
      dica: 'Do movel, fique com o último dia e junte a região (atendimentos.select("municipio", "regiao").distinct()); F.rank() numa janela por região em ordem decrescente de media7.',
      codigo: py`
        regioes = atendimentos.select("municipio", "regiao").distinct()
        hoje = movel.filter(F.col("dia") == ultimo).join(regioes, "municipio")
        ranking = hoje.select("regiao", "municipio", "media7",
            F.rank().over(Window.partitionBy("regiao").orderBy(F.desc("media7"))).alias("posicao"))
        ranking.orderBy("regiao", "posicao").show()
      `,
      regras: [{
        dataframe: 'ranking',
        colunas: RANKING,
        linhas: [['Norte', 'Sobral', 8.3, 1], ['Cariri', 'Crato', 10.7, 1], ['Cariri', 'Juazeiro', 9.6, 2], ['Cariri', 'Barbalha', 4.0, 3]],
      }],
      regrasOcultas: [{
        dataframe: 'ranking',
        colunas: RANKING,
        linhas: [['Centro-Sul', 'Iguatu', 6.3, 1], ['Sertão Central', 'Quixadá', 4.3, 1]],
      }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra saude projetoSaude`.

### Task 4: 🌾 Agronegócio

**Files:** Create `src/conteudo/projetos/agro.js`; Modify `index.js`, `tests/projetos.test.js`.
**Interfaces:** Consumes `df.unpivot` (Task 1). Produces `projetoAgro`. Filtro: `agro`.

```js
// 🌾 Agronegócio: as safras do Nordeste por cultura, estado e ano. Pivot para a tabela cultura ×
// ano, crescimento ano a ano, os estados líderes e o unpivot de volta para o formato longo.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (safras) => `cultura,estado,ano,toneladas\n${Object.entries(safras).flatMap(([chave, valores]) => {
  const [cultura, estado] = chave.split('/');
  return valores.map((t, i) => `${cultura},${estado},${2023 + i},${t}\n`);
}).join('')}`;

const SAFRAS = csv({
  'milho/BA': [10, 12, 15], 'milho/CE': [5, 4, 6], 'milho/PI': [8, 9, 9],
  'soja/BA': [20, 22, 21], 'soja/CE': [1, 1, 2], 'soja/PI': [15, 18, 20],
  'feijão/BA': [3, 3, 4], 'feijão/CE': [6, 7, 5], 'feijão/PI': [2, 3, 3],
});
const SAFRAS_OCULTO = csv({
  'algodão/MA': [4, 5, 7], 'algodão/RN': [2, 2, 1],
  'mandioca/MA': [9, 8, 10], 'mandioca/RN': [6, 7, 7],
});

const LARGO = ['cultura', '2023', '2024', '2025'];

export const projetoAgro = criarProjeto({
  id: 'agro',
  titulo: 'Agronegócio',
  icone: '🌾',
  descricao: 'As safras do Nordeste: pivot de cultura por ano, crescimento, estados líderes e unpivot.',
  resumo: `
    <p>Em <code>safras.csv</code> está a produção de cada cultura em cada estado e ano, em mil toneladas (números
      inventados). É o formato <b>longo</b>: uma linha por combinação. Para ler de olho, o relatório quer o formato
      <b>largo</b>: uma linha por cultura, uma coluna por ano. O <code>pivot</code> faz a ida, e o <code>unpivot</code>
      (no SQL do Spark, <code>stack</code>), a volta.</p>
    <ol>
      <li>a produção total de cada cultura;</li>
      <li>a tabela cultura × ano, com <code>pivot</code>;</li>
      <li>o crescimento de cada ano sobre o anterior;</li>
      <li>o estado líder de cada cultura;</li>
      <li>de volta ao formato longo, com <code>unpivot</code>.</li>
    </ol>`,
  dados: { 'safras.csv': SAFRAS },
  oculto: { 'safras.csv': SAFRAS_OCULTO },
  inicial: py`
    safras = spark.read.csv("safras.csv", header=True, inferSchema=True)
    safras.show()
  `,
  etapas: [
    {
      titulo: 'Produção por cultura',
      dificuldade: 'facil',
      enunciado: '<p>Guarde em <code>por_cultura</code> a produção somada de cada cultura: as colunas <code>cultura</code> e <code>toneladas</code>.</p>',
      dica: 'safras.groupBy("cultura").agg(F.sum("toneladas").alias("toneladas"))',
      codigo: py`
        por_cultura = safras.groupBy("cultura").agg(F.sum("toneladas").alias("toneladas"))
        por_cultura.show()
      `,
      regras: [{ dataframe: 'por_cultura', colunas: ['cultura', 'toneladas'], linhas: [['milho', 78], ['soja', 120], ['feijão', 36]] }],
      regrasOcultas: [{ dataframe: 'por_cultura', colunas: ['cultura', 'toneladas'], linhas: [['algodão', 21], ['mandioca', 47]] }],
    },
    {
      titulo: 'Cultura × ano',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>por_ano</code> uma linha por cultura e uma coluna por ano (<code>2023</code>, <code>2024</code> e
          <code>2025</code>, nessa ordem), com a produção somada dos estados.</p>`,
      dica: 'safras.groupBy("cultura").pivot("ano", [2023, 2024, 2025]).sum("toneladas"): passar os anos fixa as colunas e a ordem.',
      codigo: py`
        por_ano = safras.groupBy("cultura").pivot("ano", [2023, 2024, 2025]).sum("toneladas")
        por_ano.show()
      `,
      regras: [{ dataframe: 'por_ano', colunas: LARGO, linhas: [['soja', 36, 41, 43], ['feijão', 11, 13, 12], ['milho', 23, 25, 30]] }],
      regrasOcultas: [{ dataframe: 'por_ano', colunas: LARGO, linhas: [['mandioca', 15, 15, 17], ['algodão', 6, 7, 8]] }],
    },
    {
      titulo: 'Crescimento ano a ano',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>crescimento</code>, para cada cultura e ano a partir de 2024, a produção do ano e quanto ela cresceu
          sobre o ano anterior (em %, 1 casa): as colunas <code>cultura</code>, <code>ano</code>, <code>toneladas</code> e
          <code>crescimento</code>.</p>`,
      dica: 'Some por cultura e ano; F.lag("toneladas") numa janela por cultura em ordem de ano dá o ano anterior. Tire o primeiro ano (anterior nulo).',
      codigo: py`
        from pyspark.sql import Window

        total_ano = safras.groupBy("cultura", "ano").agg(F.sum("toneladas").alias("toneladas"))
        por_cultura_ano = Window.partitionBy("cultura").orderBy("ano")
        crescimento = (total_ano
            .withColumn("anterior", F.lag("toneladas").over(por_cultura_ano))
            .filter(F.col("anterior").isNotNull())
            .select("cultura", "ano", "toneladas",
                    F.round((F.col("toneladas") - F.col("anterior")) * 100 / F.col("anterior"), 1).alias("crescimento")))
        crescimento.orderBy("cultura", "ano").show()
      `,
      regras: [{
        dataframe: 'crescimento',
        colunas: ['cultura', 'ano', 'toneladas', 'crescimento'],
        linhas: [['soja', 2024, 41, 13.9], ['soja', 2025, 43, 4.9], ['feijão', 2024, 13, 18.2], ['feijão', 2025, 12, -7.7], ['milho', 2024, 25, 8.7], ['milho', 2025, 30, 20.0]],
      }],
      regrasOcultas: [{
        dataframe: 'crescimento',
        colunas: ['cultura', 'ano', 'toneladas', 'crescimento'],
        linhas: [['mandioca', 2024, 15, 0.0], ['mandioca', 2025, 17, 13.3], ['algodão', 2024, 7, 16.7], ['algodão', 2025, 8, 14.3]],
      }],
    },
    {
      titulo: 'Os estados líderes',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>lideres</code> o estado que mais produziu cada cultura nos três anos somados: as colunas
          <code>cultura</code>, <code>estado</code> e <code>toneladas</code>. No empate, vence o estado em ordem alfabética.</p>`,
      dica: 'Some por cultura e estado; F.row_number() numa janela por cultura em ordem decrescente de toneladas (e estado); fique com o 1.',
      codigo: py`
        por_estado = safras.groupBy("cultura", "estado").agg(F.sum("toneladas").alias("toneladas"))
        lider = Window.partitionBy("cultura").orderBy(F.desc("toneladas"), "estado")
        lideres = (por_estado.withColumn("n", F.row_number().over(lider))
            .filter(F.col("n") == 1)
            .select("cultura", "estado", "toneladas"))
        lideres.show()
      `,
      regras: [{ dataframe: 'lideres', colunas: ['cultura', 'estado', 'toneladas'], linhas: [['soja', 'BA', 63], ['feijão', 'CE', 18], ['milho', 'BA', 37]] }],
      regrasOcultas: [{ dataframe: 'lideres', colunas: ['cultura', 'estado', 'toneladas'], linhas: [['mandioca', 'MA', 27], ['algodão', 'MA', 16]] }],
    },
    {
      titulo: 'De volta ao formato longo',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>longo</code> o <code>por_ano</code> de volta ao formato longo, com as colunas <code>cultura</code>,
          <code>ano</code> (inteiro) e <code>toneladas</code>, em ordem de ano e de cultura.</p>`,
      dica: 'por_ano.unpivot("cultura", ["2023", "2024", "2025"], "ano", "toneladas"); o ano sai como texto: .cast("int").',
      codigo: py`
        longo = (por_ano.unpivot("cultura", ["2023", "2024", "2025"], "ano", "toneladas")
            .withColumn("ano", F.col("ano").cast("int"))
            .orderBy("ano", "cultura"))
        longo.show()
      `,
      regras: [{
        dataframe: 'longo',
        colunas: ['cultura', 'ano', 'toneladas'],
        tipos: ['string', 'int', 'bigint'],
        ordem: true,
        linhas: [
          ['feijão', 2023, 11], ['milho', 2023, 23], ['soja', 2023, 36], ['feijão', 2024, 13], ['milho', 2024, 25], ['soja', 2024, 41],
          ['feijão', 2025, 12], ['milho', 2025, 30], ['soja', 2025, 43],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'longo',
        colunas: ['cultura', 'ano', 'toneladas'],
        tipos: ['string', 'int', 'bigint'],
        ordem: true,
        linhas: [['algodão', 2023, 6], ['mandioca', 2023, 15], ['algodão', 2024, 7], ['mandioca', 2024, 15], ['algodão', 2025, 8], ['mandioca', 2025, 17]],
      }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra agro projetoAgro`.

### Task 5: ☀️ Energia solar

**Files:** Create `src/conteudo/projetos/energia.js`; Modify `index.js`, `tests/projetos.test.js`.
**Interfaces:** Produces `projetoEnergia`. Filtro: `energia`.

```js
// ☀️ Energia solar: a geração de hora em hora de duas usinas, com horas que não chegaram (lacunas)
// e leituras vazias, que são preenchidas com a última leitura boa.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

// Cada série: usina, dia e as leituras das 9h às 14h. null = leitura vazia; FALTA = a hora não chegou.
const FALTA = 'falta';
const hora = (h) => String(9 + h).padStart(2, '0');
const csv = (series) => `usina,momento,kwh\n${series.flatMap(([usina, dia, leituras]) => leituras
  .map((kwh, h) => (kwh === FALTA ? '' : `${usina},2026-10-${dia} ${hora(h)}:00:00,${kwh ?? ''}\n`))).join('')}`;

const GERACAO = csv([
  ['Juazeiro', '01', [10, 20, 30, 35, 25, 15]],
  ['Juazeiro', '02', [12, null, 28, FALTA, 30, 18]],
  ['Tauá', '01', [8, 16, 24, null, 22, FALTA]],
  ['Tauá', '02', [9, 18, 27, 33, 26, 14]],
]);
const GERACAO_OCULTO = csv([
  ['Quixadá', '01', [5, null, 15, 20, null, 10]],
  ['Quixadá', '02', [6, 12, FALTA, 22, 18, FALTA]],
]);

export const projetoEnergia = criarProjeto({
  id: 'energia',
  titulo: 'Energia solar',
  icone: '☀️',
  descricao: 'A geração das usinas solares do sertão: por dia, o pico, as lacunas, o preenchimento e o acumulado.',
  resumo: `
    <p>As usinas solares mandam a geração de hora em hora, das 9h às 14h, em <code>geracao.csv</code> (kWh, números
      inventados). Mas a rede falha: às vezes a hora <b>não chega</b> (uma lacuna na série) e às vezes chega
      <b>vazia</b> (o sensor não leu).</p>
    <ol>
      <li>a geração de cada usina por dia;</li>
      <li>a hora de pico de cada dia;</li>
      <li>as horas que não chegaram;</li>
      <li>as leituras vazias, preenchidas com a última leitura boa;</li>
      <li>o acumulado do mês, com as leituras preenchidas.</li>
    </ol>`,
  dados: { 'geracao.csv': GERACAO },
  oculto: { 'geracao.csv': GERACAO_OCULTO },
  inicial: py`
    geracao = spark.read.csv("geracao.csv", header=True, inferSchema=True)
    geracao.show()
  `,
  etapas: [
    {
      titulo: 'Geração por dia',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>leituras</code> a geração com mais duas colunas: <code>dia</code> (a data do momento) e
          <code>hora</code>. Depois, guarde em <code>por_dia</code> o total de cada usina em cada dia: as colunas
          <code>usina</code>, <code>dia</code> e <code>kwh</code>. A leitura vazia não soma.</p>`,
      dica: 'F.to_date("momento") e F.hour("momento"); depois groupBy("usina", "dia").agg(F.sum("kwh").alias("kwh")).',
      codigo: py`
        leituras = geracao.withColumn("dia", F.to_date("momento")).withColumn("hora", F.hour("momento"))
        por_dia = leituras.groupBy("usina", "dia").agg(F.sum("kwh").alias("kwh"))
        por_dia.orderBy("usina", "dia").show()
      `,
      regras: [{
        dataframe: 'por_dia',
        colunas: ['usina', 'dia', 'kwh'],
        linhas: [['Juazeiro', '2026-10-01', 135], ['Juazeiro', '2026-10-02', 88], ['Tauá', '2026-10-01', 70], ['Tauá', '2026-10-02', 127]],
      }],
      regrasOcultas: [{ dataframe: 'por_dia', colunas: ['usina', 'dia', 'kwh'], linhas: [['Quixadá', '2026-10-01', 50], ['Quixadá', '2026-10-02', 58]] }],
    },
    {
      titulo: 'O pico do dia',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>picos</code> a hora em que cada usina mais gerou em cada dia: as colunas <code>usina</code>,
          <code>dia</code>, <code>hora</code> e <code>kwh</code>.</p>`,
      dica: 'F.row_number() numa janela por usina e dia em ordem decrescente de kwh; fique com a linha 1.',
      codigo: py`
        from pyspark.sql import Window

        maior = Window.partitionBy("usina", "dia").orderBy(F.desc("kwh"))
        picos = (leituras.withColumn("n", F.row_number().over(maior))
            .filter(F.col("n") == 1)
            .select("usina", "dia", "hora", "kwh"))
        picos.show()
      `,
      regras: [{
        dataframe: 'picos',
        colunas: ['usina', 'dia', 'hora', 'kwh'],
        linhas: [['Juazeiro', '2026-10-01', 12, 35], ['Juazeiro', '2026-10-02', 13, 30], ['Tauá', '2026-10-01', 11, 24], ['Tauá', '2026-10-02', 12, 33]],
      }],
      regrasOcultas: [{ dataframe: 'picos', colunas: ['usina', 'dia', 'hora', 'kwh'], linhas: [['Quixadá', '2026-10-01', 12, 20], ['Quixadá', '2026-10-02', 12, 22]] }],
    },
    {
      titulo: 'As lacunas',
      dificuldade: 'medio',
      enunciado: `
        <p>Toda usina deveria mandar as 6 horas (9h a 14h) de cada dia. Guarde em <code>lacunas</code> as horas que não
          chegaram: as colunas <code>usina</code>, <code>dia</code> e <code>hora</code>. A hora que chegou vazia não é
          lacuna.</p>`,
      dica: 'Monte a grade esperada: leituras.select("usina", "dia").distinct().crossJoin(spark.range(9, 15).withColumnRenamed("id", "hora")); depois, left_anti com o que chegou.',
      codigo: py`
        grade = (leituras.select("usina", "dia").distinct()
            .crossJoin(spark.range(9, 15).withColumnRenamed("id", "hora")))
        lacunas = grade.join(leituras.select("usina", "dia", "hora"), ["usina", "dia", "hora"], "left_anti")
        lacunas.show()
      `,
      regras: [{ dataframe: 'lacunas', colunas: ['usina', 'dia', 'hora'], linhas: [['Juazeiro', '2026-10-02', 12], ['Tauá', '2026-10-01', 14]] }],
      regrasOcultas: [{ dataframe: 'lacunas', colunas: ['usina', 'dia', 'hora'], linhas: [['Quixadá', '2026-10-02', 11], ['Quixadá', '2026-10-02', 14]] }],
    },
    {
      titulo: 'Preencher com a última leitura',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>preenchida</code> as leituras com a coluna <code>kwh_ok</code>: o próprio kWh ou, se ele estiver
          vazio, a última leitura boa da mesma usina antes dele. Depois, guarde em <code>consertadas</code> só as linhas
          que estavam vazias, com as colunas <code>usina</code>, <code>momento</code> e <code>kwh_ok</code>.</p>`,
      dica: 'F.last("kwh", ignorenulls=True) numa janela por usina em ordem de momento, de Window.unboundedPreceding até 0; F.coalesce("kwh", …).',
      codigo: py`
        ate_agora = Window.partitionBy("usina").orderBy("momento").rowsBetween(Window.unboundedPreceding, 0)
        preenchida = leituras.withColumn("kwh_ok", F.coalesce("kwh", F.last("kwh", ignorenulls=True).over(ate_agora)))
        consertadas = preenchida.filter(F.col("kwh").isNull()).select("usina", "momento", "kwh_ok")
        consertadas.show()
      `,
      regras: [{
        dataframe: 'consertadas',
        colunas: ['usina', 'momento', 'kwh_ok'],
        linhas: [['Juazeiro', '2026-10-02 10:00:00', 12], ['Tauá', '2026-10-01 12:00:00', 24]],
      }],
      regrasOcultas: [{
        dataframe: 'consertadas',
        colunas: ['usina', 'momento', 'kwh_ok'],
        linhas: [['Quixadá', '2026-10-01 10:00:00', 5], ['Quixadá', '2026-10-01 13:00:00', 20]],
      }],
    },
    {
      titulo: 'O acumulado do mês',
      dificuldade: 'dificil',
      enunciado: `
        <p>Com as leituras preenchidas, guarde em <code>acumulado</code> a geração de cada usina por dia (<code>kwh</code>) e o
          total desde o começo do mês até aquele dia (<code>acumulado</code>): as colunas <code>usina</code>,
          <code>dia</code>, <code>kwh</code> e <code>acumulado</code>.</p>`,
      dica: 'Some kwh_ok por usina e dia; depois F.sum("kwh").over(Window.partitionBy("usina").orderBy("dia").rowsBetween(Window.unboundedPreceding, 0)).',
      codigo: py`
        dia_ok = preenchida.groupBy("usina", "dia").agg(F.sum("kwh_ok").alias("kwh"))
        no_mes = Window.partitionBy("usina").orderBy("dia").rowsBetween(Window.unboundedPreceding, 0)
        acumulado = dia_ok.withColumn("acumulado", F.sum("kwh").over(no_mes))
        acumulado.orderBy("usina", "dia").show()
      `,
      regras: [{
        dataframe: 'acumulado',
        colunas: ['usina', 'dia', 'kwh', 'acumulado'],
        linhas: [['Juazeiro', '2026-10-01', 135, 135], ['Juazeiro', '2026-10-02', 100, 235], ['Tauá', '2026-10-01', 94, 94], ['Tauá', '2026-10-02', 127, 221]],
      }],
      regrasOcultas: [{
        dataframe: 'acumulado',
        colunas: ['usina', 'dia', 'kwh', 'acumulado'],
        linhas: [['Quixadá', '2026-10-01', 75, 75], ['Quixadá', '2026-10-02', 58, 133]],
      }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra energia projetoEnergia`.

### Task 6: #️⃣ Hashtags e seguidores

**Files:** Create `src/conteudo/projetos/hashtags.js`; Modify `index.js`, `tests/projetos.test.js`.
**Interfaces:** Produces `projetoHashtags`. Filtro: `hashtags`.

```js
// #️⃣ Hashtags e seguidores: posts em JSON com listas. explode das hashtags, as mais usadas de cada
// dia, quem segue quem (outra lista) e o alcance de cada hashtag.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const jsonl = (objetos) => objetos.map((o) => `${JSON.stringify(o)}\n`).join('');
const post = (autor, dia, hashtags) => ({ autor, dia: `2026-10-${dia}`, hashtags });

const POSTS = jsonl([
  post('ana', '14', ['sertao', 'chuva']), post('bia', '14', ['chuva']), post('caio', '14', ['forro', 'sertao']),
  post('ana', '15', ['forro']), post('davi', '15', ['forro', 'chuva']), post('bia', '15', ['sertao']),
]);
const USUARIOS = jsonl([
  { usuario: 'ana', seguidores: ['bia'] }, { usuario: 'bia', seguidores: ['ana'] },
  { usuario: 'caio', seguidores: ['ana', 'davi'] }, { usuario: 'davi', seguidores: [] },
]);
const POSTS_OCULTO = jsonl([post('eva', '20', ['praia']), post('fia', '20', ['praia', 'sol']), post('eva', '21', ['sol'])]);
const USUARIOS_OCULTO = jsonl([
  { usuario: 'eva', seguidores: ['fia', 'gil'] }, { usuario: 'fia', seguidores: ['eva'] }, { usuario: 'gil', seguidores: [] },
]);

const COLUNAS = ['autor', 'dia', 'hashtags'];
const TIPOS = ['string', 'string', 'array<string>'];

export const projetoHashtags = criarProjeto({
  id: 'hashtags',
  titulo: 'Hashtags e seguidores',
  icone: '#️⃣',
  descricao: 'Posts em JSON com listas: explode, as hashtags do dia, quem segue quem e o alcance de cada hashtag.',
  resumo: `
    <p>Uma rede social pequena guarda os posts em <code>posts.json</code>, um JSON por linha, e cada post tem uma
      <b>lista</b> de hashtags. Os usuários estão em <code>usuarios.json</code>, cada um com a lista de seguidores.</p>
    <p>Lista dentro de uma coluna não dá para agrupar: o <code>explode</code> faz uma linha para cada item.</p>
    <ol>
      <li>ler o JSON;</li>
      <li>uma linha por hashtag;</li>
      <li>as hashtags mais usadas de cada dia;</li>
      <li>quem segue quem;</li>
      <li>o alcance de cada hashtag: quantas pessoas diferentes seguem quem a usou.</li>
    </ol>`,
  dados: { 'posts.json': POSTS, 'usuarios.json': USUARIOS },
  oculto: { 'posts.json': POSTS_OCULTO, 'usuarios.json': USUARIOS_OCULTO },
  inicial: py`
    posts = spark.read.text("posts.json")
    posts.show(truncate=False)
  `,
  etapas: [
    {
      titulo: 'Ler o JSON',
      dificuldade: 'facil',
      enunciado: `
        <p>Lido como texto, cada post é uma linha só. Leia <code>posts.json</code> como JSON em <code>posts</code>: as colunas
          <code>autor</code>, <code>dia</code> e <code>hashtags</code> (uma lista de textos).</p>`,
      dica: 'spark.read.json("posts.json"): o Spark lê um JSON por linha e descobre os tipos, inclusive a lista.',
      codigo: py`
        posts = spark.read.json("posts.json")
        posts.printSchema()
      `,
      regras: [{ dataframe: 'posts', colunas: COLUNAS, tipos: TIPOS, total: 6 }],
      regrasOcultas: [{ dataframe: 'posts', colunas: COLUNAS, tipos: TIPOS, total: 3 }],
    },
    {
      titulo: 'Uma linha por hashtag',
      dificuldade: 'medio',
      enunciado: '<p>Guarde em <code>marcacoes</code> uma linha por hashtag de cada post: as colunas <code>autor</code>, <code>dia</code> e <code>hashtag</code>.</p>',
      dica: 'posts.select("autor", "dia", F.explode("hashtags").alias("hashtag"))',
      codigo: py`
        marcacoes = posts.select("autor", "dia", F.explode("hashtags").alias("hashtag"))
        marcacoes.show()
      `,
      regras: [{
        dataframe: 'marcacoes',
        colunas: ['autor', 'dia', 'hashtag'],
        linhas: [
          ['ana', '2026-10-14', 'sertao'], ['ana', '2026-10-14', 'chuva'], ['bia', '2026-10-14', 'chuva'], ['caio', '2026-10-14', 'forro'],
          ['caio', '2026-10-14', 'sertao'], ['ana', '2026-10-15', 'forro'], ['davi', '2026-10-15', 'forro'], ['davi', '2026-10-15', 'chuva'],
          ['bia', '2026-10-15', 'sertao'],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'marcacoes',
        colunas: ['autor', 'dia', 'hashtag'],
        linhas: [['eva', '2026-10-20', 'praia'], ['fia', '2026-10-20', 'praia'], ['fia', '2026-10-20', 'sol'], ['eva', '2026-10-21', 'sol']],
      }],
    },
    {
      titulo: 'As mais usadas de cada dia',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>top_dia</code> a hashtag mais usada de cada dia (todas, se houver empate): as colunas
          <code>dia</code>, <code>hashtag</code> e <code>count</code>.</p>`,
      dica: 'Conte por dia e hashtag; F.rank() numa janela por dia em ordem decrescente de count dá 1 para todas as empatadas no topo.',
      codigo: py`
        from pyspark.sql import Window

        contagem = marcacoes.groupBy("dia", "hashtag").count()
        no_dia = Window.partitionBy("dia").orderBy(F.desc("count"))
        top_dia = (contagem.withColumn("posicao", F.rank().over(no_dia))
            .filter(F.col("posicao") == 1)
            .select("dia", "hashtag", "count"))
        top_dia.show()
      `,
      regras: [{ dataframe: 'top_dia', colunas: ['dia', 'hashtag', 'count'], linhas: [['2026-10-14', 'chuva', 2], ['2026-10-14', 'sertao', 2], ['2026-10-15', 'forro', 2]] }],
      regrasOcultas: [{ dataframe: 'top_dia', colunas: ['dia', 'hashtag', 'count'], linhas: [['2026-10-20', 'praia', 2], ['2026-10-21', 'sol', 1]] }],
    },
    {
      titulo: 'Quem segue quem',
      dificuldade: 'dificil',
      enunciado: `
        <p>Leia <code>usuarios.json</code> e guarde em <code>segue</code> uma linha por par: as colunas <code>usuario</code>
          (quem é seguido) e <code>seguidor</code>. Quem não tem seguidores não aparece.</p>`,
      dica: 'spark.read.json("usuarios.json").select("usuario", F.explode("seguidores").alias("seguidor")): a lista vazia não gera linha.',
      codigo: py`
        usuarios = spark.read.json("usuarios.json")
        segue = usuarios.select("usuario", F.explode("seguidores").alias("seguidor"))
        segue.show()
      `,
      regras: [{ dataframe: 'segue', colunas: ['usuario', 'seguidor'], linhas: [['ana', 'bia'], ['bia', 'ana'], ['caio', 'ana'], ['caio', 'davi']] }],
      regrasOcultas: [{ dataframe: 'segue', colunas: ['usuario', 'seguidor'], linhas: [['eva', 'fia'], ['eva', 'gil'], ['fia', 'eva']] }],
    },
    {
      titulo: 'O alcance de cada hashtag',
      dificuldade: 'dificil',
      enunciado: `
        <p>O <b>alcance</b> de uma hashtag é quantas pessoas diferentes seguem alguém que a usou. Guarde em
          <code>alcance</code> as colunas <code>hashtag</code> e <code>alcance</code>, do maior alcance para o menor e, no
          empate, em ordem de hashtag.</p>`,
      dica: 'marcacoes.join(segue, marcacoes.autor == segue.usuario), groupBy("hashtag") com F.countDistinct("seguidor"), e orderBy(F.desc("alcance"), "hashtag").',
      codigo: py`
        alcance = (marcacoes.join(segue, marcacoes.autor == segue.usuario)
            .groupBy("hashtag").agg(F.countDistinct("seguidor").alias("alcance"))
            .orderBy(F.desc("alcance"), "hashtag"))
        alcance.show()
      `,
      regras: [{ dataframe: 'alcance', colunas: ['hashtag', 'alcance'], ordem: true, linhas: [['forro', 3], ['sertao', 3], ['chuva', 2]] }],
      regrasOcultas: [{ dataframe: 'alcance', colunas: ['hashtag', 'alcance'], ordem: true, linhas: [['praia', 3], ['sol', 3]] }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra hashtags projetoHashtags`.

### Task 7: 🚚 Logística

**Files:** Create `src/conteudo/projetos/logistica.js`; Modify `index.js`, `tests/projetos.test.js`.
**Interfaces:** Produces `projetoLogistica`. Filtro: `logistica`.

```js
// 🚚 Logística: as entregas das transportadoras, juntadas com uma tabela pequena de cidades
// (broadcast) e com os prazos. Atrasos, o plano com e sem broadcast e o relatório.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (entregas) => `id,destino,transportadora,saida,chegada\n${entregas
  .map(([destino, transportadora, saida, chegada], i) => `${i + 1},${destino},${transportadora},2026-10-${saida},2026-10-${chegada}\n`).join('')}`;

const ENTREGAS = csv([
  ['Crato', 'Rapidão', '01', '03'], ['Sobral', 'Rapidão', '01', '06'], ['Recife', 'Asa Branca', '02', '04'],
  ['Crato', 'Asa Branca', '02', '06'], ['Natal', 'Rapidão', '03', '07'], ['Recife', 'Rapidão', '03', '08'],
]);
const ENTREGAS_OCULTO = csv([['Natal', 'Asa Branca', '10', '12'], ['Recife', 'Asa Branca', '10', '11'], ['Sobral', 'Rapidão', '11', '17']]);
const CIDADES = 'destino,uf\nCrato,CE\nSobral,CE\nRecife,PE\nNatal,RN\n';
const ROTAS = 'destino,prazo\nCrato,3\nSobral,4\nRecife,2\nNatal,3\n';

const PRAZO = ['id', 'destino', 'uf', 'transportadora', 'dias', 'prazo'];
const RELATORIO = ['transportadora', 'entregas', 'atrasadas', 'media_dias', 'pct_atraso'];

export const projetoLogistica = criarProjeto({
  id: 'logistica',
  titulo: 'Logística',
  icone: '🚚',
  descricao: 'As entregas das transportadoras: broadcast da tabela pequena, prazos, atrasos e o relatório.',
  resumo: `
    <p>Em <code>entregas.csv</code> está cada entrega: o destino, a transportadora e as datas de saída e de chegada.
      <code>cidades.csv</code> diz o estado de cada destino, e <code>rotas.csv</code>, o prazo em dias.</p>
    <p>As cidades são uma tabela <b>pequena</b>: em vez de embaralhar as entregas pela rede para o join (shuffle), o
      Spark manda uma cópia dela para cada tarefa, o <b>broadcast</b>.</p>
    <ol>
      <li>juntar com as cidades, por broadcast;</li>
      <li>os dias de viagem e o prazo de cada entrega;</li>
      <li>as entregas atrasadas;</li>
      <li>o plano com e sem broadcast;</li>
      <li>o relatório de cada transportadora.</li>
    </ol>`,
  dados: { 'entregas.csv': ENTREGAS, 'cidades.csv': CIDADES, 'rotas.csv': ROTAS },
  oculto: { 'entregas.csv': ENTREGAS_OCULTO },
  inicial: py`
    entregas = spark.read.csv("entregas.csv", header=True, inferSchema=True)
    cidades = spark.read.csv("cidades.csv", header=True, inferSchema=True)
    rotas = spark.read.csv("rotas.csv", header=True, inferSchema=True)
    entregas.show()
  `,
  etapas: [
    {
      titulo: 'Juntar com as cidades (broadcast)',
      dificuldade: 'facil',
      enunciado: `
        <p>Guarde em <code>com_cidade</code> as entregas juntadas com <code>cidades</code> pelo <code>destino</code>,
          mandando as cidades por <b>broadcast</b>. Veja no <code>explain()</code> o <code>BroadcastHashJoin</code>.</p>`,
      dica: 'entregas.join(F.broadcast(cidades), "destino")',
      codigo: py`
        com_cidade = entregas.join(F.broadcast(cidades), "destino")
        com_cidade.explain()
      `,
      regras: [{ plano: 'com_cidade', broadcast: true }, { dataframe: 'com_cidade', total: 6 }],
      regrasOcultas: [{ plano: 'com_cidade', broadcast: true }, { dataframe: 'com_cidade', total: 3 }],
    },
    {
      titulo: 'Dias de viagem e prazo',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>com_prazo</code> o <code>com_cidade</code> juntado com <code>rotas</code> e os dias de viagem
          (chegada menos saída): as colunas <code>id</code>, <code>destino</code>, <code>uf</code>,
          <code>transportadora</code>, <code>dias</code> e <code>prazo</code>.</p>`,
      dica: 'join(rotas, "destino"), F.datediff("chegada", "saida").alias("dias") e select na ordem pedida.',
      codigo: py`
        com_prazo = (com_cidade.join(rotas, "destino")
            .withColumn("dias", F.datediff("chegada", "saida"))
            .select("id", "destino", "uf", "transportadora", "dias", "prazo"))
        com_prazo.show()
      `,
      regras: [{
        dataframe: 'com_prazo',
        colunas: PRAZO,
        linhas: [
          [1, 'Crato', 'CE', 'Rapidão', 2, 3], [2, 'Sobral', 'CE', 'Rapidão', 5, 4], [3, 'Recife', 'PE', 'Asa Branca', 2, 2],
          [4, 'Crato', 'CE', 'Asa Branca', 4, 3], [5, 'Natal', 'RN', 'Rapidão', 4, 3], [6, 'Recife', 'PE', 'Rapidão', 5, 2],
        ],
      }],
      regrasOcultas: [{
        dataframe: 'com_prazo',
        colunas: PRAZO,
        linhas: [[1, 'Natal', 'RN', 'Asa Branca', 2, 3], [2, 'Recife', 'PE', 'Asa Branca', 1, 2], [3, 'Sobral', 'CE', 'Rapidão', 6, 4]],
      }],
    },
    {
      titulo: 'As entregas atrasadas',
      dificuldade: 'medio',
      enunciado: `
        <p>Guarde em <code>atrasadas</code> as entregas que levaram mais dias que o prazo, com as colunas <code>id</code>,
          <code>destino</code>, <code>transportadora</code> e <code>atraso</code> (os dias além do prazo).</p>`,
      dica: 'filter(F.col("dias") > F.col("prazo")) e (F.col("dias") - F.col("prazo")).alias("atraso").',
      codigo: py`
        atrasadas = (com_prazo.filter(F.col("dias") > F.col("prazo"))
            .select("id", "destino", "transportadora", (F.col("dias") - F.col("prazo")).alias("atraso")))
        atrasadas.show()
      `,
      regras: [{
        dataframe: 'atrasadas',
        colunas: ['id', 'destino', 'transportadora', 'atraso'],
        linhas: [[2, 'Sobral', 'Rapidão', 1], [4, 'Crato', 'Asa Branca', 1], [5, 'Natal', 'Rapidão', 1], [6, 'Recife', 'Rapidão', 3]],
      }],
      regrasOcultas: [{ dataframe: 'atrasadas', colunas: ['id', 'destino', 'transportadora', 'atraso'], linhas: [[3, 'Sobral', 'Rapidão', 2]] }],
    },
    {
      titulo: 'O plano sem broadcast',
      dificuldade: 'dificil',
      enunciado: `
        <p>O Spark manda por broadcast, sozinho, as tabelas abaixo de 10 MB. Desligue isso
          (<code>spark.sql.autoBroadcastJoinThreshold</code> = -1) e guarde em <code>sem_broadcast</code> o join das
          entregas com as cidades <b>sem</b> o <code>broadcast()</code>. Compare os planos: o <code>com_cidade</code>, que
          pediu o broadcast, continua com ele; o <code>sem_broadcast</code> embaralha as duas tabelas (dois shuffles).</p>`,
      dica: 'spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1) antes do join; depois sem_broadcast.explain() e com_cidade.explain().',
      codigo: py`
        spark.conf.set("spark.sql.autoBroadcastJoinThreshold", -1)
        sem_broadcast = entregas.join(cidades, "destino")
        sem_broadcast.explain()
        com_cidade.explain()
      `,
      regras: [{ plano: 'sem_broadcast', broadcast: false, shuffles: 2 }, { plano: 'com_cidade', broadcast: true }],
    },
    {
      titulo: 'O relatório por transportadora',
      dificuldade: 'dificil',
      enunciado: `
        <p>Guarde em <code>relatorio</code>, para cada transportadora, as colunas <code>transportadora</code>,
          <code>entregas</code>, <code>atrasadas</code>, <code>media_dias</code> (em 1 casa) e <code>pct_atraso</code> (a
          porcentagem de atrasadas, em 1 casa).</p>`,
      dica: 'Do com_prazo: F.count("*"), F.sum(F.when(F.col("dias") > F.col("prazo"), 1).otherwise(0)) e F.round(F.avg("dias"), 1); a porcentagem vem depois, com withColumn.',
      codigo: py`
        relatorio = (com_prazo.groupBy("transportadora").agg(
                F.count("*").alias("entregas"),
                F.sum(F.when(F.col("dias") > F.col("prazo"), 1).otherwise(0)).alias("atrasadas"),
                F.round(F.avg("dias"), 1).alias("media_dias"))
            .withColumn("pct_atraso", F.round(F.col("atrasadas") * 100 / F.col("entregas"), 1)))
        relatorio.show()
      `,
      regras: [{ dataframe: 'relatorio', colunas: RELATORIO, linhas: [['Asa Branca', 2, 1, 3.0, 50.0], ['Rapidão', 4, 3, 4.0, 75.0]] }],
      regrasOcultas: [{ dataframe: 'relatorio', colunas: RELATORIO, linhas: [['Asa Branca', 2, 0, 1.5, 0.0], ['Rapidão', 1, 1, 6.0, 100.0]] }],
    },
  ],
});
```

Registro: `python /tmp/scr/proj.py registra logistica projetoLogistica`.

---

### Task 8: Glossário, documentação, versão 0.7.0 e a conferência final

**Files:**
- Modify: `src/conteudo/glossario.js`, `tests/glossario.test.js`, `tests/conteudo.test.js`, `README.md`, `src/novidades.js`, `package.json`, `package-lock.json`, `public/og-capa.png` (gerada), `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md`

**Interfaces:**
- Consumes: tudo das Tasks 1 a 7.
- Produces: a versão 0.7.0 pronta para publicar (com o "sim").

- [ ] **Step 1: Write the failing tests**

Em `tests/glossario.test.js`, antes do `});` final:

```js
  it('salting, média móvel e pivot aparecem nos projetos', () => {
    const texto = 'O salting reparte a chave; a média móvel alisa a curva; o pivot vira as linhas em colunas';
    expect(ids(texto, 'projetos')).toEqual(expect.arrayContaining(['salting', 'media-movel', 'pivot']));
    expect(ids(texto, 'alem')).not.toContain('salting');
  });
```

Em `tests/conteudo.test.js`, troque `['projetos', 30, 6]` por `['projetos', 60, 12]`.

Run: `rtk proxy npx vitest run tests/glossario.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt`
Expected: `1 failed | 5 passed`.

- [ ] **Step 2: Glossário**

Em `src/conteudo/glossario.js`, logo depois do termo `funil` (o último), acrescente:

```js
  {
    id: 'salting', termo: 'Salting (sal na chave)', padroes: ['salting', 'salgar', 'salgad[ao]s?'],
    definicao: 'Acrescentar à chave de um groupBy ou join um pedaço a mais (o sal) para repartir uma chave grande em várias tarefas; depois, uma segunda agregação junta os pedaços.',
    analogia: 'A fila única do banco virando quatro caixas: o mesmo povo, atendido em paralelo.',
    exemplo: 'df.withColumn("sal", F.col("id") % 4).groupBy("terminal", "sal").count()',
  },
  {
    id: 'media-movel', termo: 'Média móvel', padroes: ['médias? móve(l|is)'],
    definicao: 'A média de uma janela que anda junto com o tempo: a de hoje usa hoje e os dias anteriores. Alisa os altos e baixos de um dia só.',
    analogia: 'Olhar a chuva da semana, e não a de um dia: um temporal isolado não muda tudo.',
    exemplo: 'F.avg("casos").over(Window.partitionBy("municipio").orderBy("dia").rowsBetween(-6, 0))',
  },
  {
    id: 'pivot', termo: 'Pivot e unpivot', padroes: ['pivot', 'unpivot', 'formato (largo|longo)'],
    definicao: 'O pivot vira os valores de uma coluna em colunas (do formato longo para o largo); o unpivot faz a volta.',
    analogia: 'A tabela da merenda: uma linha por dia e uma coluna por turma, em vez de uma linha para cada dia e turma.',
    exemplo: 'df.groupBy("cultura").pivot("ano").sum("toneladas")',
  },
```

Run: `rtk proxy npx vitest run tests/glossario.test.js > $TEMP/v.txt 2>&1; grep -E "Tests " $TEMP/v.txt` → `6 passed`.

- [ ] **Step 3: README, novidades e versão**

No `README.md`, troque o item dos projetos (que começa com `- **🏗️ Projetos** (0.6.0)`) por:

```markdown
- **🏗️ Projetos** (0.6.0 e 0.7.0): **12 projetos de 5 etapas** (60 etapas), pipelines de dados de ponta a ponta com
  PySpark, em que cada etapa continua do código da anterior. DataFrame e SQL: contagem de palavras em livros de cordel,
  vendas por região, análise de logs, funil de e-commerce, painel de indicadores e notas de exame. Spark avançado:
  mobilidade urbana (distorção e salting), saúde pública (média móvel), agronegócio (pivot e unpivot), energia solar
  (lacunas e preenchimento), hashtags e seguidores (JSON e explode) e logística (broadcast). Os últimos 6 projetos
  (além do batch) e o certificado final da trilha chegam na 1.0.0.
```

Em `src/novidades.js`, no começo de `RELEASES`:

```js
  {
    versao: '0.7.0',
    data: '2026-10-16',
    titulo: 'Projetos de Spark avançado',
    resumo: 'Mais 6 projetos no módulo 🏗️: distorção e salting, média móvel, pivot, séries com falhas, JSON com listas e broadcast.',
    grupos: [
      { titulo: '🏗️ Projetos novos', itens: ['Mobilidade urbana, saúde pública, agronegócio, energia solar, hashtags e seguidores, e logística: 6 projetos de 5 etapas.', 'Já são 12 dos 18 projetos. Os últimos 6 e o certificado final da trilha chegam na 1.0.0.'] },
      { titulo: '✨ PySpark', itens: ['unpivot (e melt), para voltar do formato largo ao longo, conferido com o PySpark de verdade.'] },
      { titulo: '📖 Glossário', itens: ['Termos novos: salting, média móvel e pivot.'] },
    ],
  },
```

`package.json` e `package-lock.json` (as duas primeiras ocorrências): `"version": "0.6.0"` → `"version": "0.7.0"`.

A descrição do módulo (`src/conteudo/projetos/index.js`) já usa `PROJETOS.length`; troque "(DataFrame e SQL)" por "(DataFrame e SQL, e Spark avançado)".

- [ ] **Step 4: Capa**

Run: `rtk proxy npm run badges > $TEMP/b.txt 2>&1; tail -1 $TEMP/b.txt; git status --short`
Expected: `ícones e capa ok`; só `public/og-capa.png` muda entre os arquivos gerados ("256 exercícios · 12 projetos"); descarte badges alterados só por bytes.

- [ ] **Step 5: Spec**

Em `docs/superpowers/specs/2026-10-15-fase6-projetos-design.md`:
- na tabela da 0.7.0, linha 🚌: troque "viagens por linha; o desequilíbrio no `explain` e nas partições; salting da chave; agregar de volta; comparar os planos" por "viagens por linha; o desequilíbrio entre os terminais; salting da chave; agregar de volta; comparar a maior tarefa e os planos (a ordem das partições não é conferida: o hash do nosso `repartition` não é o do Spark)";
- linha 🚚: troque "`entregas.csv`, `cidades.csv` (pequena), `rotas.csv`" por "`entregas.csv`, `cidades.csv` (pequena, com a UF), `rotas.csv` (o prazo)";
- §2, no item do motor: acrescente "Na 0.7.0, `DataFrame.unpivot`/`melt` (`c17`); o `stack` do SQL fica de fora."

- [ ] **Step 6: Conferência inteira**

Run, em ordem (cada um verde):
- `PYTHONIOENCODING=utf-8 python -m pytest python/tests -q -p no:randomly > $TEMP/pt.txt 2>&1; grep -E "passed|failed" $TEMP/pt.txt | tail -1`
- `PYTHONIOENCODING=utf-8 python python/conformidade/rodar.py > $TEMP/c.txt 2>&1; tail -1 $TEMP/c.txt` → 17/17
- `rtk proxy npx vitest run > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL" $TEMP/v.txt`
- `rtk proxy npx eslint -f json -o $TEMP/eslint.json .; node -e "const r=require(process.argv[1]);console.log(r.reduce((s,f)=>s+f.errorCount+f.warningCount,0))" $(cygpath -m $TEMP/eslint.json)` → 0
- `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") rtk proxy npm run build > $TEMP/b.txt 2>&1; tail -2 $TEMP/b.txt`

Preview (`preview_start` com `python-playground`):
- `#/trilha`: 12 subunidades no módulo 🏗️; `#/`: "12 projetos · 60 etapas";
- grave no `localStorage` (`python-playground:rascunho:energia-4`, o JSON do `solucao` do item) a solução da etapa 4 de energia, abra `#/p/energia-4` e rode: os casos visíveis passam no navegador;
- axe (`https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`) na trilha e em `#/p/agro-2`, nos temas `dracula`, `claro`, `suave` e `alto-contraste`, com `runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']`: nenhuma violação;
- 375 px (`resize_window` preset `mobile`): `#/trilha` e `#/p/hashtags-5` sem rolagem horizontal.

- [ ] **Step 7: Commit**

```bash
git add src/conteudo/glossario.js tests/glossario.test.js tests/conteudo.test.js src/conteudo/projetos/index.js README.md src/novidades.js package.json package-lock.json public/og-capa.png docs/superpowers/specs/2026-10-15-fase6-projetos-design.md
git status --short
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 0.7.0: Projetos de Spark avançado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8 (só com o "sim"): publicar**

Com o "sim": `git push -u origin fase6-2`, PR para `main` (corpo terminando em "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), CI verde (inclusive a conformidade `c17` no PySpark real), merge com rebase e conferência do site no ar.
