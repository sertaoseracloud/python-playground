# Fase 5, plano 3: MLlib — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O `pyspark` do DivergePython ganha o `pyspark.ml`:
- vetores densos e esparsos;
- `VectorAssembler`, `StringIndexer`, `OneHotEncoder` e `StandardScaler`;
- `Pipeline`;
- os modelos `LinearRegression`, `LogisticRegression`, `DecisionTreeClassifier` e `KMeans`;
- os quatro avaliadores e o `randomSplit`.

Tudo em Python puro, com o treino distribuído pelos workers. O PySpark 4.0.1 real confere os números no CI, com tolerância.

**Architecture:**
- **Vetores** (`pyspark/ml/linalg`): `DenseVector` e `SparseVector` com o tipo `VectorUDT`, um
  `UserDefinedType` novo no `types.py`.
  - O `print` do Python mostra os vetores como o PySpark: `[1.0,2.0]`.
  - O `show()` mostra como o Scala: `1.0E-5`, `(4,[1,3],[2.0,1.0])`.
- **Estágios** (`pyspark/ml/base.py`):
  - Têm parâmetros como no PySpark: `Estagio(param=…)`, `setParam`, `getParam`.
  - O `transform` acrescenta uma coluna calculada nos workers (uma `Func`).
  - O `fit` usa `por_particao`: cada partição devolve as suas somas, num job com o nome
    "fit Modelo", e o processo principal junta.
- **Modelos:**
  - a linear resolve as equações normais;
  - a logística usa o método de Newton, com um job por iteração;
  - a árvore monta um nível por job, com a poda do Spark;
  - o KMeans faz Lloyd, com um job por iteração.
- **Avaliadores** (`evaluation.py`): calculam as métricas no processo principal, sobre as colunas
  coletadas.

**Tech Stack:** Python 3.14 puro (CPython nos testes, Pyodide no site), sem numpy; pytest 8.4.2,
vitest; no CI, PySpark 4.0.1 com Java 17.

**Spec:** `python-playground/docs/superpowers/specs/2026-10-15-fase5-alem-do-batch-design.md`
(seções 1.4, 4 e 6). O bloco `modelos` do resultado da execução (spec 3) fica no plano 4, junto da
regra `modelo` que o lê.

## Global Constraints

- **API** (spec 1.4):
  - `linalg`: `Vectors.dense`, `Vectors.sparse`, `DenseVector` e `SparseVector`, que aparecem no
    `show()` como no Spark.
  - `feature`:
    - `VectorAssembler` (`inputCols`, `outputCol`, `handleInvalid`);
    - `StringIndexer`, com o índice em ordem de frequência e o empate pela ordem alfabética;
    - `OneHotEncoder` com `dropLast=True`, que gera vetores esparsos;
    - `StandardScaler` (`withMean`, `withStd`).
  - **Modelos:**
    - `LinearRegression`, com `regParam`, `elasticNetParam=0` e a solução exata. Tem
      `coefficients`, `intercept` e `summary` (`rootMeanSquaredError`, `r2`).
    - `LogisticRegression`, binária, com `regParam`, pelo método de Newton. Tem `coefficients`,
      `intercept`, `probability`, `prediction` e `summary.areaUnderROC`.
    - `DecisionTreeClassifier`, com `maxDepth`, `maxBins=32`, gini e os cortes como no Spark. Tem
      `depth`, `numNodes` e `featureImportances`.
    - `KMeans`, com `k`, `seed` e `maxIter`, a inicialização determinística pela semente,
      `clusterCenters()` e `summary.trainingCost`.
  - `Pipeline` e `PipelineModel`.
  - **Avaliadores:**
    - `RegressionEvaluator`: rmse, mse, mae e r2;
    - `BinaryClassificationEvaluator`: areaUnderROC e areaUnderPR;
    - `MulticlassClassificationEvaluator`: accuracy e f1;
    - `ClusteringEvaluator`: silhouette.
  - `randomSplit(pesos, seed)`: determinístico pela semente, mas não sorteia as mesmas linhas do
    Spark.
- **Treino distribuído:**
  - cada partição calcula num worker as suas estatísticas, e o processo principal junta;
  - cada `fit` vira jobs na aba ⚡ Execução: "fit LinearRegression", "fit KMeans (iteração 3)"…
- **Números:** Python puro, com `float`, sem numpy.
- **Conformidade** (spec 4):
  - coeficientes e intercepto com `abs ≤ 1e-4` na linear e `≤ 1e-3` na logística;
  - métricas com `≤ 1e-3`;
  - árvore: mesma profundidade e mesmas previsões;
  - KMeans com grupos bem separados: os mesmos grupos, em qualquer ordem, e o custo com `≤ 1e-3`
    relativo;
  - `randomSplit`: os tamanhos com `±15%`.
- **Fora do escopo:**
  - L1 (`elasticNetParam > 0`), a logística multinomial, florestas, GBT e `CrossValidator`.
  - Quem pede algo disso recebe um `NotImplementedError` em português.
- **Commits:** autor via
  `git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit`, e a mensagem
  termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Publicação:** push só com o "sim". O PR em rascunho
  [sertaoseracloud/python-playground#2](https://github.com/sertaoseracloud/python-playground/pull/2)
  recebe os pushes.
- **Ferramentas:**
  - pytest com
    `PYTHONIOENCODING=utf-8 python -m pytest python/tests/<arquivo> -q -p no:randomly > $TEMP/py.txt 2>&1`;
  - vitest com `rtk proxy npx vitest run …`;
  - eslint com `-f json -o $TEMP/lint.json`;
  - código com `\n` vai pelo Edit/Write, nunca por heredoc.
- **Branch:** `fase5`.

## Review Focus

1. **Coluna com `null` no `VectorAssembler`:** dá o erro do Spark com o `handleInvalid` padrão. Com
   `skip`, a linha sai; com `keep`, o valor vira `NaN`. O teste fica na Task 2,
   `test_vector_assembler_e_os_nulos`.
2. **Categoria nova no `transform` do `StringIndexer`** (um município que não estava no treino):
   dá o erro "Unseen label" do Spark. Com `keep`, recebe o índice seguinte. O teste fica na Task 2,
   `test_string_indexer_rotulo_novo`.
3. **Coluna de features que não é vetor** (passar `chuva_mm` direto ao `LinearRegression`): dá um
   `IllegalArgumentException` que diz que a coluna precisa ser um vetor, e não um erro obscuro do
   Python. O teste fica na Task 3, `test_features_precisam_ser_vetor`.
4. **Features colineares na regressão linear** (a mesma coluna duas vezes): o `fit` não quebra com
   divisão por zero. A coluna repetida fica com coeficiente 0, e as previsões continuam certas. O
   teste fica na Task 3, `test_features_colineares_nao_quebram`.
5. **DataFrame com vetores na correção e no show:** `df.show()`, `printSchema` e a tabela da
   correção (`_diverge_tabela`) não quebram com uma coluna `vector`. O teste fica na Task 1,
   `test_vetor_na_tabela_da_correcao`.

---

### Task 1: Vetores, o tipo `vector` e o `randomSplit`

**Files:**
- Create: `python/pyspark/ml/__init__.py` (vazio por ora, com uma docstring), `python/pyspark/ml/linalg/__init__.py`
- Modify:
  - `python/pyspark/sql/types.py`: `UserDefinedType`, `inferir_tipo` e `conferir`;
  - `python/pyspark/sql/mostrar.py`: `texto_do_valor`;
  - `python/pyspark/sql/dataframe.py`: `_para_json` e `randomSplit`.
- Test: `python/tests/test_mllib.py` (novo; recebe também os testes das Tasks 2 a 6)

**Interfaces:**
- Produces:
  - `linalg.Vector`, `DenseVector(ar)` (`.values`, `.size`, `.toArray()`, `.dot`,
    `.squared_distance`, `.norm`, `.numNonzeros`) e
    `SparseVector(size, indices, values | dict | pares)` (`.indices`, `.values`);
  - `Vectors.dense`, `Vectors.sparse`, `Vectors.zeros`, `Vectors.squared_distance` e
    `Vectors.norm`;
  - `linalg.comprimido(valores) -> Vector`;
  - `linalg.VectorUDT`;
  - o método `_texto_do_spark()` de cada vetor (o texto do `show()`);
  - `types.UserDefinedType(DataType)`, com `.aceita(valor)`;
  - `DataFrame.randomSplit(weights, seed=None) -> [DataFrame]`.

- [ ] **Step 1: Testes que falham.** `python/tests/test_mllib.py`:

```python
"""MLlib do DivergePython: vetores, features, pipeline, modelos e avaliadores, com o treino
distribuído pelos workers."""
import math

import pytest

from diverge_runtime import estagios
from pyspark.errors import IllegalArgumentException
from pyspark.sql import SparkSession
from pyspark.ml.linalg import DenseVector, SparseVector, Vectors


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def acoes():
    return [j['acao'] for j in estagios.resumo()['jobs']]


def test_vetores_como_o_pyspark():
    d = Vectors.dense([1.0, 0.0, 3.5])
    s = Vectors.sparse(4, [1, 3], [2.0, 1.0])
    assert str(d) == '[1.0,0.0,3.5]' and repr(d) == 'DenseVector([1.0, 0.0, 3.5])'
    assert str(s) == '(4,[1,3],[2.0,1.0])' and repr(s) == 'SparseVector(4, {1: 2.0, 3: 1.0})'
    assert s.toArray() == [0.0, 2.0, 0.0, 1.0] and s[1] == 2.0 and s[0] == 0.0 and len(s) == 4
    assert Vectors.dense(1, 2) == DenseVector([1.0, 2.0]) and Vectors.sparse(2, {0: 1.0}) == Vectors.dense([1.0, 0.0])
    assert d.dot([1, 1, 2]) == 8.0 and Vectors.squared_distance(d, [0, 0, 0]) == 13.25 and s.numNonzeros() == 2
    assert Vectors.dense([1e-5])._texto_do_spark() == '[1.0E-5]' and str(Vectors.dense([1e-5])) == '[1e-05]'


def test_vetor_no_dataframe(spark, capsys):
    df = spark.createDataFrame([(Vectors.dense([1.0, 2.0]), Vectors.sparse(3, [2], [1.0]))], ['d', 's'])
    assert df.dtypes == [('d', 'vector'), ('s', 'vector')]
    df.printSchema()
    df.show()
    saida = capsys.readouterr().out
    assert ' |-- d: vector (nullable = true)' in saida
    assert '|[1.0,2.0]|(3,[2],[1.0])|' in saida
    assert df.first().s == SparseVector(3, [2], [1.0])


def test_vetor_na_tabela_da_correcao(spark):
    df = spark.createDataFrame([(Vectors.dense([1.0, 2.0]),)], ['features'])
    tabela = df._diverge_tabela(10)
    assert tabela['colunas'] == [{'nome': 'features', 'tipo': 'vector'}]
    assert tabela['linhas'] == [['[1.0,2.0]']]


def test_random_split_deterministico_e_sem_sobra(spark):
    df = spark.range(200)
    a, b = df.randomSplit([0.7, 0.3], seed=42)
    ida, idb = {r.id for r in a.collect()}, {r.id for r in b.collect()}
    assert not ida & idb and len(ida) + len(idb) == 200
    assert 0.55 <= len(ida) / 200 <= 0.85
    assert {r.id for r in df.randomSplit([0.7, 0.3], seed=42)[0].collect()} == ida
    assert {r.id for r in df.randomSplit([0.7, 0.3], seed=7)[0].collect()} != ida
    with pytest.raises(ValueError, match='Weights must be positive'):
        df.randomSplit([0.5, -1.0])
```

- [ ] **Step 2:** rodar e ver falhar (falta `pyspark.ml`).

- [ ] **Step 3: `types.py`.** Antes de `def _criar_row`:

```python
class UserDefinedType(DataType):
    """Tipo de uma classe do Python, como o VectorUDT do pyspark.ml (a classe aponta para ele em __UDT__)."""

    def aceita(self, valor):
        return True
```

Em `inferir_tipo`, antes do `raise` final:

```python
    udt = getattr(type(valor), '__UDT__', None)
    if udt is not None:
        return udt
```

Em `conferir`, antes do `return valor` final:

```python
    if isinstance(tipo, UserDefinedType):
        if not tipo.aceita(valor):
            raise erro()
        return valor
```

Acrescente `'UserDefinedType'` ao `__all__`.

- [ ] **Step 4: `mostrar.py`.** Em `texto_do_valor`, logo depois do `if valor is None`:

```python
    if hasattr(valor, '_texto_do_spark'):  # os vetores do pyspark.ml: o toString do Scala
        return valor._texto_do_spark()
```

- [ ] **Step 5: `pyspark/ml/__init__.py`** (por ora, só a docstring; a Task 2 acrescenta os imports):

```python
"""pyspark.ml do DivergePython: vetores, features, pipelines, modelos e avaliadores, em Python puro."""
```

`pyspark/ml/linalg/__init__.py`:

```python
"""pyspark.ml.linalg: vetores densos e esparsos.

O print do Python mostra os vetores como o PySpark ([1.0,2.0]); o show() mostra como o toString do
Scala (1.0E-5, (4,[1,3],[2.0,1.0])). O Spark devolve arrays do numpy no toArray(); aqui, listas."""
from ...sql import types as T
from ...sql.mostrar import java_double


class VectorUDT(T.UserDefinedType):
    _simples = 'vector'
    _nome = 'vector'

    def aceita(self, valor):
        return isinstance(valor, Vector)


class Vector:
    __UDT__ = VectorUDT()

    def __len__(self):
        return self.size

    def __iter__(self):
        return iter(self.toArray())

    def __eq__(self, outro):
        return isinstance(outro, Vector) and self.size == outro.size and self.toArray() == outro.toArray()

    def __hash__(self):
        return hash((self.size, tuple(self.toArray())))

    @staticmethod
    def _lista(outro):
        return outro.toArray() if isinstance(outro, Vector) else [float(x) for x in outro]

    def dot(self, outro):
        return sum(x * y for x, y in zip(self.toArray(), self._lista(outro)))

    def squared_distance(self, outro):
        return sum((x - y) ** 2 for x, y in zip(self.toArray(), self._lista(outro)))

    def norm(self, p):
        a = self.toArray()
        if p == float('inf'):
            return max((abs(x) for x in a), default=0.0)
        return sum(abs(x) ** p for x in a) ** (1 / p)

    def numNonzeros(self):
        return sum(1 for x in self.toArray() if x != 0)


class DenseVector(Vector):
    def __init__(self, ar):
        self.values = [float(x) for x in ar]

    @property
    def size(self):
        return len(self.values)

    def __getitem__(self, i):
        return self.values[i]

    def toArray(self):
        return list(self.values)

    def __str__(self):
        return '[' + ','.join(str(x) for x in self.values) + ']'

    def __repr__(self):
        return f"DenseVector([{', '.join(repr(x) for x in self.values)}])"

    def _texto_do_spark(self):
        return '[' + ','.join(java_double(x) for x in self.values) + ']'


class SparseVector(Vector):
    def __init__(self, size, *args):
        self.size = int(size)
        if len(args) == 1:
            pares = sorted(args[0].items() if isinstance(args[0], dict) else args[0])
            self.indices, self.values = [int(i) for i, _ in pares], [float(v) for _, v in pares]
        else:
            self.indices, self.values = [int(i) for i in args[0]], [float(v) for v in args[1]]

    def __getitem__(self, i):
        if i < 0:
            i += self.size
        if not 0 <= i < self.size:
            raise IndexError(f'Index {i} out of bounds.')
        return self.values[self.indices.index(i)] if i in self.indices else 0.0

    def toArray(self):
        a = [0.0] * self.size
        for i, v in zip(self.indices, self.values):
            a[i] = v
        return a

    def __str__(self):
        return f"({self.size},[{','.join(map(str, self.indices))}],[{','.join(str(v) for v in self.values)}])"

    def __repr__(self):
        return f"SparseVector({self.size}, {{{', '.join(f'{i}: {v!r}' for i, v in zip(self.indices, self.values))}}})"

    def _texto_do_spark(self):
        return f"({self.size},[{','.join(map(str, self.indices))}],[{','.join(java_double(v) for v in self.values)}])"


class Vectors:
    @staticmethod
    def dense(*elements):
        if len(elements) == 1 and not isinstance(elements[0], (int, float)):
            elements = elements[0]
        return DenseVector(elements)

    @staticmethod
    def sparse(size, *args):
        return SparseVector(size, *args)

    @staticmethod
    def zeros(size):
        return DenseVector([0.0] * size)

    @staticmethod
    def squared_distance(v1, v2):
        return (v1 if isinstance(v1, Vector) else DenseVector(v1)).squared_distance(v2)

    @staticmethod
    def norm(vector, p):
        return (vector if isinstance(vector, Vector) else DenseVector(vector)).norm(p)


def comprimido(valores):
    """Como o Vector.compressed do Spark: esparso quando ocupa menos (1,5 × (nnz + 1) < tamanho)."""
    nnz = sum(1 for v in valores if v != 0)
    if 1.5 * (nnz + 1.0) < len(valores):
        return SparseVector(len(valores), [(i, v) for i, v in enumerate(valores) if v != 0])
    return DenseVector(valores)


__all__ = ['Vector', 'DenseVector', 'SparseVector', 'Vectors', 'VectorUDT']
```

- [ ] **Step 6: `dataframe.py`.** Em `_para_json`, logo no começo:

```python
    if hasattr(v, '_texto_do_spark'):  # vetor do pyspark.ml: o texto do show
        return v._texto_do_spark()
```

Acrescente `import random` no topo e, depois de `coalesce`:

```python
    def randomSplit(self, weights, seed=None):
        """Divide as linhas ao acaso, pelos pesos. A mesma semente dá a mesma divisão (mas não as
        mesmas linhas do Spark, que usa outro gerador)."""
        for w in weights:
            if w < 0:
                raise PySparkValueError(f'Weights must be positive. Found weight value: {w}', 'VALUE_NOT_POSITIVE',
                                        {'arg_name': 'weights', 'arg_value': str(w)})
        total = float(sum(weights))
        limites = [0.0]
        for w in weights:
            limites.append(limites[-1] + w / total)
        semente = int(seed) if seed is not None else random.randrange(2**31)
        partes = []
        for de, ate in zip(limites, limites[1:]):
            rdd = _Estreito(self._plano.rdd(), None, 'randomSplit', com_indice=_Sorteio(semente, de, ate))
            partes.append(DataFrame(P.ScanRDD(self.sparkSession, rdd, list(self._plano.saida)), self.sparkSession))
        return partes
```

Depois de `class _FazerRow`:

```python
class _Sorteio:
    """As linhas cujo número sorteado (pela semente e pela partição) cai em [de, ate)."""

    def __init__(self, semente, de, ate):
        self.semente, self.de, self.ate = semente, de, ate

    def __call__(self, indice, linhas):
        sorteio = random.Random(self.semente * 1000003 + indice)
        return [linha for linha in linhas if self.de <= sorteio.random() < self.ate]
```

- [ ] **Step 7:** rodar o `test_mllib.py` e ver passar, mais a suíte inteira do pytest e a
conformidade (13 iguais). Commit "MLlib: vetores, o tipo vector e o randomSplit".

### Task 2: Estágios, features e `Pipeline`

**Files:**
- Create: `python/pyspark/ml/base.py`, `python/pyspark/ml/feature.py`, `python/pyspark/ml/pipeline.py`
- Modify: `python/pyspark/ml/__init__.py`
- Test: `python/tests/test_mllib.py`

**Interfaces:**
- Consumes: `linalg` (Task 1); `Func`, `Column` e `para_expr` de `column.py`; `rdd._Estreito`.
- Produces:
  - `base.Params` (`_padroes`, `_definir`, `getOrDefault`, `setParams` e `setX`/`getX`
    automáticos), `Transformer.transform`, `Estimator.fit` e `Model`;
  - `base.por_particao(df, funcao, acao) -> [resultado]`;
  - `base.coluna_nova(df, nome, impl, entradas, tipo) -> DataFrame`;
  - `base.exigir_vetor(df, coluna)`;
  - `feature.media_e_desvio(partes) -> (n, media, desvio)` e o `feature._SomasVetor`;
  - `VectorAssembler`, `StringIndexer`, `StringIndexerModel` (`labels`, `labelsArray`),
    `OneHotEncoder`, `OneHotEncoderModel` (`categorySizes`), `StandardScaler` e
    `StandardScalerModel` (`mean`, `std`);
  - `Pipeline(stages=[...])` e `PipelineModel` (`stages`).

- [ ] **Step 1: Testes que falham** (no fim de `test_mllib.py`; acrescente
`from pyspark.errors import SparkRuntimeException` e
`from pyspark.ml.feature import OneHotEncoder, StandardScaler, StringIndexer, VectorAssembler`):

```python
def test_params_como_o_pyspark():
    va = VectorAssembler(inputCols=['a'], outputCol='v')
    assert va.getInputCols() == ['a'] and va.setOutputCol('w') is va and va.getOutputCol() == 'w'
    assert va.getHandleInvalid() == 'error'
    with pytest.raises(TypeError, match='unexpected keyword'):
        VectorAssembler(colunas=['a'])


def test_vector_assembler_denso_e_esparso(spark):
    df = spark.createDataFrame([(1.0, 2, True, Vectors.dense([3.0, 4.0])), (0.0, 0, False, Vectors.dense([0.0, 5.0]))],
                               ['a', 'b', 'c', 'd'])
    r = VectorAssembler(inputCols=['a', 'b', 'c', 'd'], outputCol='v').transform(df).collect()
    assert r[0].v == DenseVector([1.0, 2.0, 1.0, 3.0, 4.0])
    assert isinstance(r[1].v, SparseVector) and str(r[1].v) == '(5,[4],[5.0])'  # comprimido como no Spark
    with pytest.raises(IllegalArgumentException, match='Data type string of column e is not supported'):
        VectorAssembler(inputCols=['e'], outputCol='v').transform(spark.createDataFrame([('x',)], ['e']))


def test_vector_assembler_e_os_nulos(spark):
    df = spark.createDataFrame([(1.0, 2.0), (None, 3.0)], 'a DOUBLE, b DOUBLE')
    with pytest.raises(SparkRuntimeException, match='Encountered null while assembling a row'):
        VectorAssembler(inputCols=['a', 'b'], outputCol='v').transform(df).collect()
    assert VectorAssembler(inputCols=['a', 'b'], outputCol='v', handleInvalid='skip').transform(df).count() == 1
    mantido = VectorAssembler(inputCols=['a', 'b'], outputCol='v', handleInvalid='keep').transform(df).collect()[1].v
    assert math.isnan(mantido[0]) and mantido[1] == 3.0


def test_string_indexer_por_frequencia_e_alfabeto(spark):
    df = spark.createDataFrame([(c,) for c in 'babcab'] + [('x',), ('y',)], ['c'])
    modelo = StringIndexer(inputCol='c', outputCol='i').fit(df)
    assert modelo.labels == ['b', 'a', 'c', 'x', 'y']  # b 3×, a 2×, depois o empate em ordem alfabética
    assert [r.i for r in modelo.transform(df).collect()][:3] == [0.0, 1.0, 0.0]
    assert 'fit StringIndexer' in acoes()
    alfabetica = StringIndexer(inputCol='c', outputCol='i', stringOrderType='alphabetAsc').fit(df)
    assert alfabetica.labels == ['a', 'b', 'c', 'x', 'y']


def test_string_indexer_rotulo_novo(spark):
    modelo = StringIndexer(inputCol='c', outputCol='i').fit(spark.createDataFrame([('a',), ('b',)], ['c']))
    novo = spark.createDataFrame([('a',), ('z',)], ['c'])
    with pytest.raises(SparkRuntimeException, match='Unseen label: z'):
        modelo.transform(novo).collect()
    assert [r.i for r in modelo.setHandleInvalid('keep').transform(novo).collect()] == [0.0, 2.0]
    assert modelo.setHandleInvalid('skip').transform(novo).count() == 1


def test_one_hot_encoder_dropa_o_ultimo(spark):
    df = spark.createDataFrame([(0.0,), (1.0,), (2.0,)], ['i'])
    modelo = OneHotEncoder(inputCols=['i'], outputCols=['v']).fit(df)
    assert modelo.categorySizes == [3]
    assert [str(r.v) for r in modelo.transform(df).collect()] == ['(2,[0],[1.0])', '(2,[1],[1.0])', '(2,[],[])']
    inteiro = OneHotEncoder(inputCol='i', outputCol='v', dropLast=False).fit(df).transform(df).collect()
    assert str(inteiro[2].v) == '(3,[2],[1.0])'


def test_standard_scaler_com_desvio_amostral(spark):
    df = spark.createDataFrame([(Vectors.dense([x, 10.0]),) for x in (1.0, 2.0, 3.0, 4.0)], ['x'])
    modelo = StandardScaler(inputCol='x', outputCol='s').fit(df)
    assert modelo.mean.toArray() == [2.5, 10.0]
    assert modelo.std[0] == pytest.approx(math.sqrt(5 / 3)) and modelo.std[1] == 0.0
    escalado = modelo.transform(df).first().s
    assert escalado[0] == pytest.approx(1 / math.sqrt(5 / 3)) and escalado[1] == 0.0  # desvio 0: o Spark dá 0
    centrado = StandardScaler(inputCol='x', outputCol='s', withMean=True).fit(df).transform(df).first().s
    assert centrado[0] == pytest.approx(-1.5 / math.sqrt(5 / 3))


def test_pipeline_treina_e_passa_adiante(spark):
    from pyspark.ml import Pipeline, PipelineModel
    df = spark.createDataFrame([('milho', 1.0), ('feijao', 2.0), ('milho', 3.0)], ['cultura', 'chuva'])
    pipe = Pipeline(stages=[StringIndexer(inputCol='cultura', outputCol='ci'),
                            OneHotEncoder(inputCols=['ci'], outputCols=['cv']),
                            VectorAssembler(inputCols=['chuva', 'cv'], outputCol='features')])
    modelo = pipe.fit(df)
    assert isinstance(modelo, PipelineModel)
    assert [type(s).__name__ for s in modelo.stages] == ['StringIndexerModel', 'OneHotEncoderModel', 'VectorAssembler']
    assert [str(r.features) for r in modelo.transform(df).collect()] == ['[1.0,1.0]', '[2.0,0.0]', '[3.0,1.0]']
    with pytest.raises(TypeError, match='Cannot recognize a pipeline stage'):
        Pipeline(stages=['x']).fit(df)
```

- [ ] **Step 2:** rodar e ver falhar (falta `pyspark.ml.feature`).

- [ ] **Step 3: `pyspark/ml/base.py`**

```python
"""A base do pyspark.ml do DivergePython: parâmetros, transformadores, estimadores e modelos.

Os parâmetros são como no PySpark: Estagio(param=valor), setParam(valor) e getParam(). O treino é
distribuído: por_particao roda uma função em cada partição (nos workers), num job com o nome do
fit, e o processo principal junta os resultados."""
import uuid

from ..errors import IllegalArgumentException
from ..rdd import _Estreito
from ..sql.column import Column, Func, para_expr


class Params:
    _padroes = {}

    def __init__(self, **kw):
        self._valores = dict(self._padroes)
        self.uid = f'{type(self).__name__}_{uuid.uuid4().hex[:12]}'
        self._definir(kw)

    def _definir(self, kw):
        for k, v in kw.items():
            if k not in self._padroes:
                raise TypeError(f"{type(self).__name__}() got an unexpected keyword argument '{k}'")
            self._valores[k] = v
        return self

    def setParams(self, **kw):
        return self._definir(kw)

    def getOrDefault(self, param):
        return self._valores[param]

    def explainParams(self):
        return '\n'.join(f'{k}: (atual: {v!r})' for k, v in sorted(self._valores.items()))

    def __getattr__(self, nome):
        """setMaxIter(10), getMaxIter(): os setters e getters do PySpark, para cada parâmetro."""
        if nome.startswith('_') or len(nome) < 4 or nome[:3] not in ('set', 'get'):
            raise AttributeError(nome)
        param = nome[3].lower() + nome[4:]
        if param not in self._padroes:
            raise AttributeError(nome)
        if nome.startswith('set'):
            return lambda valor: self._definir({param: valor})
        return lambda: self._valores[param]

    def __repr__(self):
        return self.uid


class Transformer(Params):
    def transform(self, dataset, params=None):
        return self._transform(dataset)


class Estimator(Params):
    def fit(self, dataset, params=None):
        return self._fit(dataset)


class Model(Transformer):
    pass


def por_particao(df, funcao, acao):
    """Roda `funcao(linhas) -> [resultado]` em cada partição (nos workers), num job chamado `acao`."""
    rdd = _Estreito(df._plano.rdd(), funcao, 'fit')
    return [r for parte in rdd._executar(acao) for r in parte]


def coluna_nova(df, nome, impl, entradas, tipo):
    """O df com a coluna `nome` = impl(valores das `entradas`), calculada nos workers."""
    func = Func(nome, [para_expr(c) for c in entradas], impl, lambda _tipos: tipo, propaga_nulo=False)
    return df.withColumn(nome, Column(func))


def tipo_da_coluna(df, coluna):
    e = df._entrada()
    return e.atributos[e.achar(coluna)].tipo


def exigir_vetor(df, coluna):
    from .linalg import VectorUDT
    tipo = tipo_da_coluna(df, coluna)
    if not isinstance(tipo, VectorUDT):
        raise IllegalArgumentException(
            f'requirement failed: Column {coluna} must be of type struct<type:tinyint,size:int,indices:array<int>,'
            f'values:array<double>> but was actually {tipo.simpleString()}.')
```

- [ ] **Step 4: `pyspark/ml/feature.py`**

```python
"""pyspark.ml.feature: VectorAssembler, StringIndexer, OneHotEncoder e StandardScaler."""
import math

from ..errors import IllegalArgumentException, SparkRuntimeException
from ..sql import functions as F
from ..sql import types as T
from ..sql.column import Column, Func, para_expr
from ..sql.mostrar import texto_do_valor
from .base import Estimator, Model, Transformer, coluna_nova, exigir_vetor, por_particao, tipo_da_coluna
from .linalg import DenseVector, SparseVector, VectorUDT, comprimido

_VETOR = VectorUDT()
_NUMEROS = (T.IntegerType, T.LongType, T.ShortType, T.ByteType, T.DoubleType, T.FloatType, T.BooleanType)


def _pares(estagio):
    """[(entrada, saída)]: o inputCols/outputCols ou o inputCol/outputCol."""
    if estagio.getOrDefault('inputCols'):
        return list(zip(estagio.getOrDefault('inputCols'), estagio.getOrDefault('outputCols')))
    return [(estagio.getOrDefault('inputCol'), estagio.getOrDefault('outputCol'))]


def _texto(v):
    return v if isinstance(v, str) else texto_do_valor(v)


# ---------- VectorAssembler ----------

class _Montar:
    def __init__(self, invalido):
        self.invalido = invalido

    def __call__(self, *valores):
        saida = []
        for v in valores:
            if v is None:
                if self.invalido == 'keep':
                    saida.append(float('nan'))
                    continue
                raise SparkRuntimeException('Encountered null while assembling a row with handleInvalid = "error". Consider '
                                            'removing nulls from dataset or using handleInvalid = "keep" or "skip".')
            saida.extend(v.toArray() if hasattr(v, '_texto_do_spark') else [float(v)])
        return comprimido(saida)


class VectorAssembler(Transformer):
    _padroes = {'inputCols': None, 'outputCol': None, 'handleInvalid': 'error'}

    def _transform(self, df):
        colunas = list(self.getOrDefault('inputCols') or [])
        for c in colunas:
            tipo = tipo_da_coluna(df, c)
            if not isinstance(tipo, _NUMEROS + (VectorUDT,)):
                raise IllegalArgumentException(f'Data type {tipo.simpleString()} of column {c} is not supported.')
        invalido = self.getOrDefault('handleInvalid')
        if invalido == 'skip':
            df = df.dropna(subset=colunas)
        return coluna_nova(df, self.getOrDefault('outputCol') or f'{self.uid}__output', _Montar(invalido), colunas, _VETOR)


# ---------- StringIndexer ----------

_ORDENS = {
    'frequencyDesc': lambda pares: sorted(pares, key=lambda p: (-p[1], p[0])),
    'frequencyAsc': lambda pares: sorted(pares, key=lambda p: (p[1], p[0])),
    'alphabetAsc': lambda pares: sorted(pares),
    'alphabetDesc': lambda pares: sorted(pares, reverse=True),
}


class StringIndexer(Estimator):
    _padroes = {'inputCol': None, 'outputCol': None, 'inputCols': None, 'outputCols': None,
                'handleInvalid': 'error', 'stringOrderType': 'frequencyDesc'}

    def _fit(self, df):
        rotulos = []
        for entrada, _ in _pares(self):
            contagens = {}
            for valor, n in df.groupBy(entrada).count()._linhas('fit StringIndexer'):
                if valor is not None:
                    contagens[_texto(valor)] = contagens.get(_texto(valor), 0) + n
            rotulos.append([r for r, _ in _ORDENS[self.getOrDefault('stringOrderType')](list(contagens.items()))])
        return StringIndexerModel(rotulos, _pares(self), self.getOrDefault('handleInvalid'))


class _Indexar:
    def __init__(self, rotulos, invalido):
        self.mapa, self.n, self.invalido = {r: float(i) for i, r in enumerate(rotulos)}, len(rotulos), invalido

    def __call__(self, v):
        if v is None:
            if self.invalido == 'keep':
                return float(self.n)
            raise SparkRuntimeException('StringIndexer encountered NULL value. To handle or skip NULLS, try setting '
                                        'StringIndexer.handleInvalid.')
        texto = _texto(v)
        if texto in self.mapa:
            return self.mapa[texto]
        if self.invalido == 'keep':
            return float(self.n)
        raise SparkRuntimeException(f'Unseen label: {texto}. To handle unseen labels, set Param handleInvalid to keep.')


class _Conhecido:
    def __init__(self, rotulos):
        self.rotulos = set(rotulos)

    def __call__(self, v):
        return v is not None and _texto(v) in self.rotulos


class StringIndexerModel(Model):
    _padroes = {'handleInvalid': 'error'}

    def __init__(self, rotulos, pares, invalido):
        super().__init__(handleInvalid=invalido)
        self.labelsArray, self._entradas = rotulos, pares

    @property
    def labels(self):
        return self.labelsArray[0]

    def _transform(self, df):
        invalido = self.getOrDefault('handleInvalid')
        for (entrada, saida), rotulos in zip(self._entradas, self.labelsArray):
            if invalido == 'skip':
                df = df.filter(Column(Func('conhecido', [para_expr(entrada)], _Conhecido(rotulos), lambda _t: T.BooleanType(),
                                           propaga_nulo=False)))
            df = coluna_nova(df, saida, _Indexar(rotulos, invalido), [entrada], T.DoubleType())
        return df


# ---------- OneHotEncoder ----------

class OneHotEncoder(Estimator):
    _padroes = {'inputCol': None, 'outputCol': None, 'inputCols': None, 'outputCols': None,
                'dropLast': True, 'handleInvalid': 'error'}

    def _fit(self, df):
        pares = _pares(self)
        maiores = df.select(*[F.max(e) for e, _ in pares])._linhas('fit OneHotEncoder')[0]
        tamanhos = [int(m) + 1 if m is not None else 0 for m in maiores]
        return OneHotEncoderModel(tamanhos, pares, self.getOrDefault('dropLast'), self.getOrDefault('handleInvalid'))


class _Codificar:
    def __init__(self, tamanho, sem_ultimo, invalido):
        self.tamanho, self.sem_ultimo, self.invalido = tamanho, sem_ultimo, invalido

    def __call__(self, v):
        total = self.tamanho + (1 if self.invalido == 'keep' else 0)  # o keep ganha uma categoria no fim
        saida = total - 1 if self.sem_ultimo else total
        if v is None or v != int(v) or not 0 <= v < self.tamanho:
            if self.invalido != 'keep':
                raise SparkRuntimeException(f'Unseen value: {v}. To handle unseen values, set Param handleInvalid to keep.')
            i = self.tamanho
        else:
            i = int(v)
        return SparseVector(saida, [], []) if i >= saida else SparseVector(saida, [i], [1.0])


class OneHotEncoderModel(Model):
    _padroes = {'dropLast': True, 'handleInvalid': 'error'}

    def __init__(self, tamanhos, pares, sem_ultimo, invalido):
        super().__init__(dropLast=sem_ultimo, handleInvalid=invalido)
        self.categorySizes, self._entradas = tamanhos, pares

    def _transform(self, df):
        for (entrada, saida), tamanho in zip(self._entradas, self.categorySizes):
            impl = _Codificar(tamanho, self.getOrDefault('dropLast'), self.getOrDefault('handleInvalid'))
            df = coluna_nova(df, saida, impl, [entrada], _VETOR)
        return df


# ---------- StandardScaler ----------

class _SomasVetor:
    """Numa partição: (n, Σx, Σx²) de cada posição do vetor."""

    def __call__(self, linhas):
        n, somas, quadrados = 0, None, None
        for (v, *_) in linhas:
            if v is None:
                continue
            a = v.toArray()
            if somas is None:
                somas, quadrados = [0.0] * len(a), [0.0] * len(a)
            n += 1
            for i, x in enumerate(a):
                somas[i] += x
                quadrados[i] += x * x
        return [(n, somas, quadrados)] if n else []


def media_e_desvio(partes):
    """A média e o desvio-padrão amostral (n − 1), como o summarizer do Spark."""
    n = sum(p[0] for p in partes)
    tamanho = len(partes[0][1])
    somas = [sum(p[1][i] for p in partes) for i in range(tamanho)]
    quadrados = [sum(p[2][i] for p in partes) for i in range(tamanho)]
    media = [s / n for s in somas]
    desvio = [math.sqrt(max((q - n * m * m) / (n - 1), 0.0)) if n > 1 else 0.0 for q, m in zip(quadrados, media)]
    return n, media, desvio


class StandardScaler(Estimator):
    _padroes = {'inputCol': None, 'outputCol': None, 'withMean': False, 'withStd': True}

    def _fit(self, df):
        entrada = self.getOrDefault('inputCol')
        exigir_vetor(df, entrada)
        _, media, desvio = media_e_desvio(por_particao(df.select(entrada), _SomasVetor(), 'fit StandardScaler'))
        return StandardScalerModel(DenseVector(media), DenseVector(desvio), self)


class _Escalar:
    def __init__(self, media, desvio, com_media, com_desvio):
        self.media, self.com_media = media, com_media
        self.fator = [(1.0 / d if d else 0.0) if com_desvio else 1.0 for d in desvio]

    def __call__(self, v):
        if v is None:
            return None
        if isinstance(v, SparseVector) and not self.com_media:
            return SparseVector(v.size, v.indices, [x * self.fator[i] for i, x in zip(v.indices, v.values)])
        return DenseVector([((x - self.media[i]) if self.com_media else x) * self.fator[i] for i, x in enumerate(v.toArray())])


class StandardScalerModel(Model):
    _padroes = StandardScaler._padroes

    def __init__(self, media, desvio, estimador):
        super().__init__(**estimador._valores)
        self.mean, self.std = media, desvio

    def _transform(self, df):
        impl = _Escalar(self.mean.toArray(), self.std.toArray(), self.getOrDefault('withMean'), self.getOrDefault('withStd'))
        return coluna_nova(df, self.getOrDefault('outputCol'), impl, [self.getOrDefault('inputCol')], _VETOR)
```

- [ ] **Step 5: `pyspark/ml/pipeline.py`**

```python
"""Pipeline e PipelineModel: os estágios em ordem. O fit treina cada estimador e passa os dados
transformados ao estágio seguinte (até o último estimador, como o Spark)."""
from .base import Estimator, Model, Transformer


class Pipeline(Estimator):
    _padroes = {'stages': None}

    def getStages(self):
        return list(self.getOrDefault('stages') or [])

    def _fit(self, df):
        estagios = self.getStages()
        for s in estagios:
            if not isinstance(s, (Estimator, Transformer)):
                raise TypeError(f'Cannot recognize a pipeline stage of type {type(s)}.')
        ultimo = max((i for i, s in enumerate(estagios) if isinstance(s, Estimator)), default=-1)
        modelos, atual = [], df
        for i, s in enumerate(estagios):
            modelo = s.fit(atual) if isinstance(s, Estimator) else s
            modelos.append(modelo)
            if i < ultimo:
                atual = modelo.transform(atual)
        return PipelineModel(modelos)


class PipelineModel(Model):
    def __init__(self, stages):
        super().__init__()
        self.stages = list(stages)

    def _transform(self, df):
        for s in self.stages:
            df = s.transform(df)
        return df
```

`pyspark/ml/__init__.py` passa a ser:

```python
"""pyspark.ml do DivergePython: vetores, features, pipelines, modelos e avaliadores, em Python puro."""
from .base import Estimator, Model, Transformer
from .pipeline import Pipeline, PipelineModel

__all__ = ['Estimator', 'Model', 'Transformer', 'Pipeline', 'PipelineModel']
```

- [ ] **Step 6:** rodar e ver passar, mais a suíte inteira do pytest. Commit "MLlib: features e
Pipeline".

### Task 3: `LinearRegression` e `RegressionEvaluator`

**Files:**
- Create: `python/pyspark/ml/_algebra.py`, `python/pyspark/ml/regression.py`, `python/pyspark/ml/evaluation.py`
- Test: `python/tests/test_mllib.py`

**Interfaces:**
- Consumes: `por_particao`, `coluna_nova`, `exigir_vetor`, `Estimator` e `Model` (Task 2);
  `DenseVector` (Task 1).
- Produces:
  - `_algebra.resolver(a, b) -> [float]`;
  - `evaluation.Evaluator`, `metricas_de_regressao(pares) -> dict` (`rmse`, `mse`, `mae`, `r2`,
    `var`) e `RegressionEvaluator`;
  - `regression.LinearRegression`, `LinearRegressionModel` (`coefficients`, `intercept`,
    `numFeatures`, `summary`, `evaluate`, `predict`) e `LinearRegressionSummary`.

- [ ] **Step 1: Testes que falham** (acrescente
`from pyspark.ml.regression import LinearRegression` e
`from pyspark.ml.evaluation import RegressionEvaluator`):

```python
def treino_linear(spark, pontos):
    """pontos: [(x1, x2, ..., y)] → DataFrame com features e label."""
    nomes = [f'x{i}' for i in range(len(pontos[0]) - 1)]
    df = spark.createDataFrame([tuple(float(v) for v in p) for p in pontos], nomes + ['label'])
    return VectorAssembler(inputCols=nomes, outputCol='features').transform(df)


def test_linear_exata_e_resumo(spark):
    treino = treino_linear(spark, [(a, b, 1 + 2 * a - b) for a in range(4) for b in range(3)])
    m = LinearRegression().fit(treino)
    assert m.coefficients.toArray() == pytest.approx([2.0, -1.0]) and m.intercept == pytest.approx(1.0)
    assert m.summary.rootMeanSquaredError == pytest.approx(0.0, abs=1e-9) and m.summary.r2 == pytest.approx(1.0)
    assert m.numFeatures == 2 and m.predict(Vectors.dense([1.0, 1.0])) == pytest.approx(2.0)
    assert 'fit LinearRegression' in acoes()


def test_linear_com_reg_param_como_o_spark(spark):
    treino = treino_linear(spark, [(x, 1 + 2 * x) for x in range(4)])
    m = LinearRegression(regParam=0.1).fit(treino)
    # λ / σy · σx² na diagonal, com os desvios da população: w = 2 / (1 + 0,1 / √5)
    w = 2 / (1 + 0.1 / math.sqrt(5))
    assert m.coefficients[0] == pytest.approx(w) and m.intercept == pytest.approx(4 - 1.5 * w)


def test_features_precisam_ser_vetor(spark):
    df = spark.createDataFrame([(1.0, 2.0)], ['chuva_mm', 'label'])
    with pytest.raises(IllegalArgumentException, match='Column chuva_mm must be of type'):
        LinearRegression(featuresCol='chuva_mm').fit(df)
    with pytest.raises(NotImplementedError, match='L2'):
        LinearRegression(elasticNetParam=0.5).fit(treino_linear(spark, [(1, 2), (2, 3)]))


def test_features_colineares_nao_quebram(spark):
    treino = treino_linear(spark, [(x, x, 3 * x + 1) for x in range(5)])
    m = LinearRegression().fit(treino)
    assert m.summary.rootMeanSquaredError == pytest.approx(0.0, abs=1e-9)
    assert sum(m.coefficients.toArray()) == pytest.approx(3.0)


def test_regression_evaluator(spark):
    df = spark.createDataFrame([(1.0, 1.5), (2.0, 2.0), (3.0, 2.5)], ['label', 'prediction'])
    av = RegressionEvaluator()
    assert av.evaluate(df) == pytest.approx(math.sqrt(0.5 / 3))
    assert RegressionEvaluator(metricName='mae').evaluate(df) == pytest.approx(1 / 3)
    assert RegressionEvaluator(metricName='r2').evaluate(df) == pytest.approx(1 - 0.5 / 2)
    assert not av.isLargerBetter() and RegressionEvaluator(metricName='r2').isLargerBetter()
```

- [ ] **Step 2:** rodar e ver falhar.

- [ ] **Step 3: `pyspark/ml/_algebra.py`**

```python
"""Álgebra linear pequena, em Python puro: o sistema A x = b, por Gauss-Jordan com pivô."""


def resolver(a, b):
    """O x de A x = b. Uma coluna que depende das outras (pivô quase zero) fica com 0, sem quebrar."""
    n = len(b)
    m = [[float(x) for x in linha] + [float(bi)] for linha, bi in zip(a, b)]
    escala = max((abs(x) for linha in a for x in linha), default=1.0) or 1.0
    pivos, linha = [], 0
    for coluna in range(n):
        if linha == n:
            break
        p = max(range(linha, n), key=lambda i: abs(m[i][coluna]))
        if abs(m[p][coluna]) <= 1e-12 * escala:
            continue
        m[linha], m[p] = m[p], m[linha]
        for i in range(n):
            if i != linha and m[i][coluna] != 0:
                fator = m[i][coluna] / m[linha][coluna]
                m[i] = [x - fator * y for x, y in zip(m[i], m[linha])]
        pivos.append((linha, coluna))
        linha += 1
    x = [0.0] * n
    for lin, col in pivos:
        x[col] = m[lin][n] / m[lin][col]
    return x
```

- [ ] **Step 4: `pyspark/ml/evaluation.py`** (a regressão agora; as Tasks 4 e 6 acrescentam o
resto):

```python
"""pyspark.ml.evaluation: os avaliadores. As métricas são calculadas no processo principal, sobre
as colunas de previsão e rótulo (coletadas num job com o nome do avaliador)."""
import math

from .base import Params


class Evaluator(Params):
    def evaluate(self, dataset, params=None):
        return self._avaliar(dataset)

    def isLargerBetter(self):
        return True


def metricas_de_regressao(pares):
    """pares: [(previsão, rótulo)] → rmse, mse, mae, r2 e var (a variância explicada)."""
    n = len(pares)
    media = sum(y for _, y in pares) / n
    sse = sum((y - p) ** 2 for p, y in pares)
    sst = sum((y - media) ** 2 for _, y in pares)
    return {'rmse': math.sqrt(sse / n), 'mse': sse / n, 'mae': sum(abs(y - p) for p, y in pares) / n,
            'r2': 1 - sse / sst if sst else float('nan'), 'var': sum((p - media) ** 2 for p, _ in pares) / n}


class RegressionEvaluator(Evaluator):
    _padroes = {'predictionCol': 'prediction', 'labelCol': 'label', 'metricName': 'rmse', 'weightCol': None,
                'throughOrigin': False}

    def _avaliar(self, df):
        pares = df.select(self.getOrDefault('predictionCol'), self.getOrDefault('labelCol'))._linhas('evaluate RegressionEvaluator')
        return metricas_de_regressao([(p, y) for p, y in pares if p is not None and y is not None])[self.getOrDefault('metricName')]

    def isLargerBetter(self):
        return self.getOrDefault('metricName') in ('r2', 'var')
```

- [ ] **Step 5: `pyspark/ml/regression.py`**

```python
"""pyspark.ml.regression: LinearRegression pelas equações normais (o solver "normal" do Spark).

Cada partição soma, num worker, n, Σx, Σy, Σxxᵀ, Σxy e Σy²; o processo principal junta e resolve o
sistema. Com regParam, a penalidade L2 é a do Spark: λ/σy · ½ Σ (σj wj)², com os desvios da
população e a padronização ligada (o padrão)."""
import math

from ..errors import IllegalArgumentException
from ..sql import types as T
from ._algebra import resolver
from .base import Estimator, Model, coluna_nova, exigir_vetor, por_particao
from .evaluation import metricas_de_regressao
from .linalg import DenseVector


class _SomasLineares:
    def __call__(self, linhas):
        n, sx, sy, sxx, sxy, syy = 0, None, 0.0, None, None, 0.0
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray()
            if sx is None:
                p = len(x)
                sx, sxy, sxx = [0.0] * p, [0.0] * p, [[0.0] * p for _ in range(p)]
            n += 1
            sy += y
            syy += y * y
            for i, xi in enumerate(x):
                sx[i] += xi
                sxy[i] += xi * y
                linha = sxx[i]
                for j in range(i, len(x)):  # só a metade de cima: a matriz é simétrica
                    linha[j] += xi * x[j]
        return [(n, sx, sy, sxx, sxy, syy)] if n else []


def _juntar(partes):
    p = len(partes[0][1])
    n = sum(q[0] for q in partes)
    sx = [sum(q[1][i] for q in partes) for i in range(p)]
    sxx = [[sum(q[3][i][j] for q in partes) if j >= i else 0.0 for j in range(p)] for i in range(p)]
    for i in range(p):
        for j in range(i):
            sxx[i][j] = sxx[j][i]
    sxy = [sum(q[4][i] for q in partes) for i in range(p)]
    return n, sx, sum(q[2] for q in partes), sxx, sxy, sum(q[5] for q in partes)


class LinearRegression(Estimator):
    _padroes = {'featuresCol': 'features', 'labelCol': 'label', 'predictionCol': 'prediction', 'maxIter': 100,
                'regParam': 0.0, 'elasticNetParam': 0.0, 'tol': 1e-6, 'fitIntercept': True, 'standardization': True,
                'solver': 'auto', 'weightCol': None, 'loss': 'squaredError', 'aggregationDepth': 2}

    def _fit(self, df):
        if self.getOrDefault('elasticNetParam'):
            raise NotImplementedError('O DivergePython treina só com a penalidade L2 (elasticNetParam=0).')
        f, rotulo = self.getOrDefault('featuresCol'), self.getOrDefault('labelCol')
        exigir_vetor(df, f)
        partes = por_particao(df.select(f, rotulo), _SomasLineares(), 'fit LinearRegression')
        if not partes:
            raise IllegalArgumentException('requirement failed: Nothing has been added to this summarizer.')
        n, sx, sy, sxx, sxy, syy = _juntar(partes)
        p = len(sx)
        mx, my = [s / n for s in sx], sy / n
        com_intercepto = self.getOrDefault('fitIntercept')
        if com_intercepto:
            a = [[sxx[i][j] / n - mx[i] * mx[j] for j in range(p)] for i in range(p)]
            b = [sxy[i] / n - mx[i] * my for i in range(p)]
        else:
            a = [[sxx[i][j] / n for j in range(p)] for i in range(p)]
            b = [sxy[i] / n for i in range(p)]
        desvio_y = math.sqrt(max(syy / n - my * my, 0.0))
        lam = self.getOrDefault('regParam')
        if lam and desvio_y > 0:
            efetivo = lam / desvio_y
            for i in range(p):
                a[i][i] += efetivo * ((sxx[i][i] / n - mx[i] ** 2) if self.getOrDefault('standardization') else 1.0)
        w = resolver(a, b) if desvio_y > 0 else [0.0] * p  # rótulo constante: só o intercepto, como o Spark
        intercepto = my - sum(wi * m for wi, m in zip(w, mx)) if com_intercepto else 0.0
        return LinearRegressionModel(DenseVector(w), intercepto, self, df)


class _Prever:
    def __init__(self, coeficientes, intercepto):
        self.coeficientes, self.intercepto = coeficientes, intercepto

    def __call__(self, v):
        if v is None:
            return None
        return sum(c * x for c, x in zip(self.coeficientes, v.toArray())) + self.intercepto


class LinearRegressionModel(Model):
    _padroes = LinearRegression._padroes

    def __init__(self, coeficientes, intercepto, estimador, treino):
        super().__init__(**estimador._valores)
        self.coefficients, self.intercept, self._treino, self._resumo = coeficientes, intercepto, treino, None

    @property
    def numFeatures(self):
        return self.coefficients.size

    def predict(self, value):
        return _Prever(self.coefficients.toArray(), self.intercept)(value)

    def _transform(self, df):
        impl = _Prever(self.coefficients.toArray(), self.intercept)
        return coluna_nova(df, self.getOrDefault('predictionCol'), impl, [self.getOrDefault('featuresCol')], T.DoubleType())

    @property
    def hasSummary(self):
        return True

    @property
    def summary(self):
        if self._resumo is None:
            self._resumo = self.evaluate(self._treino)
        return self._resumo

    def evaluate(self, dataset):
        return LinearRegressionSummary(self.transform(dataset), self.getOrDefault('predictionCol'), self.getOrDefault('labelCol'))


class LinearRegressionSummary:
    """As métricas no treino (ou no evaluate), calculadas na primeira vez que alguém pede."""

    def __init__(self, predictions, previsao, rotulo):
        self.predictions, self.predictionCol, self.labelCol = predictions, previsao, rotulo
        self._m = None

    def _metricas(self):
        if self._m is None:
            pares = self.predictions.select(self.predictionCol, self.labelCol)._linhas('resumo LinearRegression')
            self._m = metricas_de_regressao(pares)
        return self._m

    rootMeanSquaredError = property(lambda self: self._metricas()['rmse'])
    meanSquaredError = property(lambda self: self._metricas()['mse'])
    meanAbsoluteError = property(lambda self: self._metricas()['mae'])
    r2 = property(lambda self: self._metricas()['r2'])
    explainedVariance = property(lambda self: self._metricas()['var'])

    @property
    def numInstances(self):
        return self.predictions.count()
```

- [ ] **Step 6:** rodar e ver passar, mais a suíte inteira do pytest. Commit "MLlib: regressão
linear e RegressionEvaluator".

### Task 4: `LogisticRegression` e os avaliadores de classificação

**Files:**
- Create: `python/pyspark/ml/classification.py`
- Modify: `python/pyspark/ml/evaluation.py`
- Test: `python/tests/test_mllib.py`

**Interfaces:**
- Consumes: `_algebra.resolver` (Task 3); `feature._SomasVetor` e `feature.media_e_desvio`
  (Task 2).
- Produces:
  - `classification.LogisticRegression` e `LogisticRegressionModel` (`coefficients`,
    `intercept`, `numClasses`, `summary.areaUnderROC`, `summary.accuracy`,
    `summary.totalIterations`, `predict`, `predictProbability` e `evaluate`);
  - `evaluation.area_roc(pares)`, `area_pr(pares)` e `metricas_de_classes(pares)`;
  - `BinaryClassificationEvaluator` e `MulticlassClassificationEvaluator`.

- [ ] **Step 1: Testes que falham** (acrescente
`from pyspark.ml.classification import LogisticRegression` e
`from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator`):

```python
def test_logistica_no_otimo(spark):
    xs, ys = [0, 1, 2, 3, 4, 5], [0, 0, 1, 0, 1, 1]
    treino = treino_linear(spark, list(zip(xs, ys)))
    m = LogisticRegression().fit(treino)
    w, b = m.coefficients[0], m.intercept
    p = [1 / (1 + math.exp(-(w * x + b))) for x in xs]
    # no ótimo (sem regParam), o gradiente é zero: Σ(p − y) = 0 e Σ x(p − y) = 0
    assert sum(pi - y for pi, y in zip(p, ys)) == pytest.approx(0, abs=1e-9)
    assert sum(x * (pi - y) for x, pi, y in zip(xs, p, ys)) == pytest.approx(0, abs=1e-9)
    linha = m.transform(treino).collect()[5]
    assert linha.probability[1] == pytest.approx(p[5]) and sum(linha.probability) == pytest.approx(1.0)
    assert linha.prediction == 1.0 and linha.rawPrediction[1] == pytest.approx(w * 5 + b)
    assert 'fit LogisticRegression (iteração 1)' in acoes()
    forte = LogisticRegression(regParam=1.0).fit(treino)
    assert 0 < forte.coefficients[0] < w  # a penalidade encolhe o coeficiente


def test_logistica_so_binaria(spark):
    with pytest.raises(NotImplementedError, match='binária'):
        LogisticRegression().fit(treino_linear(spark, [(0, 0), (1, 1), (2, 2)]))


def test_auc_e_area_pr(spark):
    df = spark.createDataFrame([(0.9, 1.0), (0.8, 0.0), (0.7, 1.0), (0.6, 0.0)], ['rawPrediction', 'label'])
    assert BinaryClassificationEvaluator().evaluate(df) == pytest.approx(0.75)
    pr = BinaryClassificationEvaluator(metricName='areaUnderPR').evaluate(df)
    assert pr == pytest.approx(0.5 + 0.5 * (0.5 + 2 / 3) / 2)  # começa em (0, precisão do primeiro limiar)


def test_multiclasse_acuracia_e_f1_ponderado(spark):
    df = spark.createDataFrame([(0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 1.0), (2.0, 2.0)], ['label', 'prediction'])
    assert MulticlassClassificationEvaluator(metricName='accuracy').evaluate(df) == pytest.approx(0.8)
    assert MulticlassClassificationEvaluator().evaluate(df) == pytest.approx(0.4 * 2 / 3 + 0.4 * 0.8 + 0.2 * 1.0)
```

- [ ] **Step 2:** rodar e ver falhar.

- [ ] **Step 3: `evaluation.py`** (no fim):

```python
def _curva(pares):
    """(pontos, positivos, negativos): os pontos (fp, tp) acumulados por limiar, do maior escore ao menor."""
    pares = sorted(pares, key=lambda p: -p[0])
    pontos, tp, fp, i = [], 0, 0, 0
    while i < len(pares):
        escore = pares[i][0]
        while i < len(pares) and pares[i][0] == escore:
            if pares[i][1] > 0.5:
                tp += 1
            else:
                fp += 1
            i += 1
        pontos.append((fp, tp))
    return pontos, tp, fp


def _trapezios(xs, ys):
    return sum((x1 - x0) * (y0 + y1) / 2 for x0, x1, y0, y1 in zip(xs, xs[1:], ys, ys[1:]))


def area_roc(pares):
    """pares: [(escore, rótulo)]. A curva vai de (0, 0) a (1, 1), como o BinaryClassificationMetrics."""
    pontos, positivos, negativos = _curva(pares)
    if not positivos or not negativos:
        return float('nan')
    return _trapezios([0.0] + [fp / negativos for fp, _ in pontos], [0.0] + [tp / positivos for _, tp in pontos])


def area_pr(pares):
    """A curva precisão × revocação, começando em (0, a precisão do primeiro limiar), como o Spark."""
    pontos, positivos, _ = _curva(pares)
    if not positivos:
        return float('nan')
    revocacao = [tp / positivos for _, tp in pontos]
    precisao = [tp / (tp + fp) for fp, tp in pontos]
    return _trapezios([0.0] + revocacao, [precisao[0]] + precisao)


class BinaryClassificationEvaluator(Evaluator):
    _padroes = {'rawPredictionCol': 'rawPrediction', 'labelCol': 'label', 'metricName': 'areaUnderROC',
                'weightCol': None, 'numBins': 1000}

    def _avaliar(self, df):
        linhas = df.select(self.getOrDefault('rawPredictionCol'), self.getOrDefault('labelCol'))._linhas(
            'evaluate BinaryClassificationEvaluator')
        pares = [(s[1] if hasattr(s, '_texto_do_spark') else float(s), float(y)) for s, y in linhas if s is not None and y is not None]
        return area_roc(pares) if self.getOrDefault('metricName') == 'areaUnderROC' else area_pr(pares)


def metricas_de_classes(pares):
    """pares: [(previsão, rótulo)] → accuracy e as médias ponderadas pelo rótulo (f1, precisão, revocação)."""
    n = len(pares)
    saida = {'accuracy': sum(1 for p, y in pares if p == y) / n, 'f1': 0.0, 'weightedPrecision': 0.0, 'weightedRecall': 0.0}
    for c in sorted({y for _, y in pares}):
        tp = sum(1 for p, y in pares if p == c and y == c)
        previstos = sum(1 for p, _ in pares if p == c)
        reais = sum(1 for _, y in pares if y == c)
        precisao = tp / previstos if previstos else 0.0
        revocacao = tp / reais
        f1 = 2 * precisao * revocacao / (precisao + revocacao) if precisao + revocacao else 0.0
        peso = reais / n
        saida['f1'] += peso * f1
        saida['weightedPrecision'] += peso * precisao
        saida['weightedRecall'] += peso * revocacao
    return saida


class MulticlassClassificationEvaluator(Evaluator):
    _padroes = {'predictionCol': 'prediction', 'labelCol': 'label', 'metricName': 'f1', 'weightCol': None,
                'metricLabel': 0.0, 'beta': 1.0, 'probabilityCol': 'probability', 'eps': 1e-15}

    def _avaliar(self, df):
        pares = df.select(self.getOrDefault('predictionCol'), self.getOrDefault('labelCol'))._linhas(
            'evaluate MulticlassClassificationEvaluator')
        return metricas_de_classes(pares)[self.getOrDefault('metricName')]
```

- [ ] **Step 4: `pyspark/ml/classification.py`**

```python
"""pyspark.ml.classification: a regressão logística binária (pelo método de Newton) e a árvore de
decisão (a Task 5 acrescenta).

A logística minimiza a perda média mais λ/2 Σ (σj wj)², a penalidade do Spark com a padronização
ligada (σ amostral). Cada iteração de Newton é um job: as partições somam o gradiente e a hessiana
nos workers, e o processo principal resolve o passo."""
import math

from ..errors import IllegalArgumentException
from ..sql import types as T
from ._algebra import resolver
from .base import Estimator, Model, coluna_nova, exigir_vetor, por_particao
from .evaluation import area_roc, metricas_de_classes
from .feature import _SomasVetor, media_e_desvio
from .linalg import DenseVector, VectorUDT

_VETOR = VectorUDT()
MAX_NEWTON = 100


def _sigmoide(m):
    if m >= 0:
        return 1.0 / (1.0 + math.exp(-m))
    e = math.exp(m)
    return e / (1.0 + e)


class _Newton:
    """Numa partição: n, o gradiente e a hessiana (metade de cima) da perda logística em θ = [w..., b]."""

    def __init__(self, theta):
        self.theta = theta

    def __call__(self, linhas):
        k = len(self.theta)
        g, h, n = [0.0] * k, [[0.0] * k for _ in range(k)], 0
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray() + [1.0]
            p = _sigmoide(sum(t * xi for t, xi in zip(self.theta, x)))
            for i, xi in enumerate(x):
                g[i] += (p - y) * xi
                peso = p * (1 - p) * xi
                linha = h[i]
                for j in range(i, k):
                    linha[j] += peso * x[j]
            n += 1
        return [(n, g, h)] if n else []


class LogisticRegression(Estimator):
    _padroes = {'featuresCol': 'features', 'labelCol': 'label', 'predictionCol': 'prediction',
                'probabilityCol': 'probability', 'rawPredictionCol': 'rawPrediction', 'maxIter': 100, 'regParam': 0.0,
                'elasticNetParam': 0.0, 'tol': 1e-6, 'fitIntercept': True, 'threshold': 0.5, 'standardization': True,
                'family': 'auto', 'weightCol': None, 'aggregationDepth': 2}

    def _fit(self, df):
        if self.getOrDefault('elasticNetParam'):
            raise NotImplementedError('O DivergePython treina só com a penalidade L2 (elasticNetParam=0).')
        f, rotulo = self.getOrDefault('featuresCol'), self.getOrDefault('labelCol')
        exigir_vetor(df, f)
        dados = df.select(f, rotulo)
        classes = {r[0] for r in dados.select(rotulo).distinct()._linhas('fit LogisticRegression (classes)') if r[0] is not None}
        if self.getOrDefault('family') == 'multinomial' or any(c not in (0.0, 1.0) for c in classes):
            if any(c < 0 or c != int(c) for c in classes):
                raise IllegalArgumentException(f'Classification labels should be in [0 to 1]. Found {len(classes)} invalid labels.')
            raise NotImplementedError('O DivergePython faz só a regressão logística binária (rótulos 0 e 1).')
        _, _, desvio = media_e_desvio(por_particao(dados.select(f), _SomasVetor(), 'fit LogisticRegression (resumo)'))
        lam = self.getOrDefault('regParam')
        penalidade = [lam * (d * d if self.getOrDefault('standardization') else 1.0) for d in desvio] + [0.0]
        theta = [0.0] * (len(desvio) + 1)
        iteracoes = 0
        for iteracoes in range(1, MAX_NEWTON + 1):
            partes = por_particao(dados, _Newton(theta), f'fit LogisticRegression (iteração {iteracoes})')
            n = sum(q[0] for q in partes)
            k = len(theta)
            g = [sum(q[1][i] for q in partes) / n + penalidade[i] * theta[i] for i in range(k)]
            h = [[0.0] * k for _ in range(k)]
            for i in range(k):
                for j in range(i, k):
                    h[i][j] = h[j][i] = sum(q[2][i][j] for q in partes) / n + (penalidade[i] if i == j else 0.0)
            passo = resolver(h, g)
            theta = [t - d for t, d in zip(theta, passo)]
            if max(abs(d) for d in passo) < 1e-10:
                break
        return LogisticRegressionModel(DenseVector(theta[:-1]), theta[-1], iteracoes, self, df)


class _Margem:
    """O que o modelo logístico põe em cada linha: 'raw' ([−m, m]), 'prob' ([1 − p, p]) ou 'pred'."""

    def __init__(self, coeficientes, intercepto, limiar, parte):
        self.coeficientes, self.intercepto, self.limiar, self.parte = coeficientes, intercepto, limiar, parte

    def __call__(self, v):
        if v is None:
            return None
        m = sum(c * x for c, x in zip(self.coeficientes, v.toArray())) + self.intercepto
        if self.parte == 'raw':
            return DenseVector([-m, m])
        p = _sigmoide(m)
        if self.parte == 'prob':
            return DenseVector([1 - p, p])
        return 1.0 if p > self.limiar else 0.0


class LogisticRegressionModel(Model):
    _padroes = LogisticRegression._padroes
    numClasses = 2

    def __init__(self, coeficientes, intercepto, iteracoes, estimador, treino):
        super().__init__(**estimador._valores)
        self.coefficients, self.intercept = coeficientes, intercepto
        self._iteracoes, self._treino, self._resumo = iteracoes, treino, None

    @property
    def numFeatures(self):
        return self.coefficients.size

    def _margem(self, parte):
        return _Margem(self.coefficients.toArray(), self.intercept, self.getOrDefault('threshold'), parte)

    def predict(self, value):
        return self._margem('pred')(value)

    def predictProbability(self, value):
        return self._margem('prob')(value)

    def predictRaw(self, value):
        return self._margem('raw')(value)

    def _transform(self, df):
        f = [self.getOrDefault('featuresCol')]
        df = coluna_nova(df, self.getOrDefault('rawPredictionCol'), self._margem('raw'), f, _VETOR)
        df = coluna_nova(df, self.getOrDefault('probabilityCol'), self._margem('prob'), f, _VETOR)
        return coluna_nova(df, self.getOrDefault('predictionCol'), self._margem('pred'), f, T.DoubleType())

    @property
    def hasSummary(self):
        return True

    @property
    def summary(self):
        if self._resumo is None:
            self._resumo = self.evaluate(self._treino)
            self._resumo.totalIterations = self._iteracoes
        return self._resumo

    def evaluate(self, dataset):
        return BinaryLogisticRegressionSummary(self.transform(dataset), self)


class BinaryLogisticRegressionSummary:
    def __init__(self, predictions, modelo):
        self.predictions = predictions
        self.probabilityCol, self.labelCol = modelo.getOrDefault('probabilityCol'), modelo.getOrDefault('labelCol')
        self.predictionCol = modelo.getOrDefault('predictionCol')
        self.totalIterations = 0
        self._linhas = None

    def _dados(self):
        if self._linhas is None:
            self._linhas = self.predictions.select(self.probabilityCol, self.predictionCol, self.labelCol)._linhas(
                'resumo LogisticRegression')
        return self._linhas

    @property
    def areaUnderROC(self):
        return area_roc([(prob[1], y) for prob, _, y in self._dados()])

    @property
    def accuracy(self):
        return metricas_de_classes([(p, y) for _, p, y in self._dados()])['accuracy']
```

- [ ] **Step 5:** rodar e ver passar, mais a suíte inteira do pytest. Commit "MLlib: regressão
logística e avaliadores de classificação".

### Task 5: `DecisionTreeClassifier`

**Files:**
- Create: `python/pyspark/ml/_arvore.py`
- Modify: `python/pyspark/ml/classification.py`
- Test: `python/tests/test_mllib.py`

**Interfaces:**
- Consumes: `por_particao`, `coluna_nova` e `exigir_vetor` (Task 2); `DenseVector` e
  `SparseVector` (Task 1).
- Produces:
  - `_arvore.cortes_continuos(contagens, num_cortes) -> [limiar]`;
  - `_arvore.NoArvore`;
  - `_arvore.treinar(dados, max_profundidade, max_bins, min_instancias, nome) -> (raiz, num_classes, num_features)`;
  - `_arvore.podar(raiz)`;
  - `classification.DecisionTreeClassifier` e `DecisionTreeClassificationModel` (`depth`,
    `numNodes`, `numClasses`, `numFeatures`, `featureImportances`, `toDebugString` e `predict`).

- [ ] **Step 1: Testes que falham** (acrescente `DecisionTreeClassifier` ao import de
`classification`):

```python
def test_cortes_continuos_como_o_spark():
    from pyspark.ml._arvore import cortes_continuos
    assert cortes_continuos([(1.0, 1), (3.0, 2), (10.0, 1)], 31) == [2.0, 6.5]  # poucos valores: os pontos médios
    contagens = [(float(v), 1) for v in range(10)]
    assert cortes_continuos(contagens, 3) == [1.5, 4.5, 7.5]  # muitos: pelo passo n / (cortes + 1)


def test_arvore_um_corte(spark):
    treino = treino_linear(spark, [(1, 0), (2, 0), (3, 0), (10, 1), (11, 1), (12, 1)])
    m = DecisionTreeClassifier().fit(treino)
    assert (m.depth, m.numNodes, m.numClasses, m.numFeatures) == (1, 3, 2, 1)
    assert str(m.featureImportances) == '(1,[0],[1.0])'
    assert m.toDebugString.splitlines()[1:] == ['  If (feature 0 <= 6.5)', '   Predict: 0.0', '  Else (feature 0 > 6.5)', '   Predict: 1.0']
    r = m.transform(treino).collect()
    assert [x.prediction for x in r] == [0.0] * 3 + [1.0] * 3 and r[0].probability == DenseVector([1.0, 0.0])
    assert 'fit DecisionTreeClassifier (nível 1)' in acoes()


def test_arvore_poda_os_irmaos_iguais(spark):
    ys = [0, 0, 1, 0, 0, 1, 1, 1]  # x = 1..8: a raiz corta em 5,5; o lado esquerdo cortaria em 2,5 com as duas folhas prevendo 0
    m = DecisionTreeClassifier(maxDepth=2).fit(treino_linear(spark, [(x + 1, y) for x, y in enumerate(ys)]))
    assert (m.depth, m.numNodes) == (1, 3)
    assert m.toDebugString.splitlines()[1] == '  If (feature 0 <= 5.5)'


def test_arvore_escolhe_a_feature_que_separa(spark):
    pontos = [(a, b, 1 if b > 5 else 0) for a in range(4) for b in (1, 2, 8, 9)]
    m = DecisionTreeClassifier(maxDepth=3).fit(treino_linear(spark, pontos))
    assert m.depth == 1 and str(m.featureImportances) == '(2,[1],[1.0])'
```

- [ ] **Step 2:** rodar e ver falhar.

- [ ] **Step 3: `pyspark/ml/_arvore.py`**

```python
"""A árvore de decisão (classificação) do DivergePython, como a do Spark:
- os cortes de cada feature saem do findSplitsForContinuousFeature: os pontos médios entre valores
  vizinhos, ou, com mais valores que cortes, os pontos escolhidos pelo passo n / (cortes + 1);
- o melhor corte é o de maior ganho de gini (no empate, o primeiro), e o nó vira folha se o ganho
  for 0 ou se chegar ao maxDepth;
- no fim, a poda junta dois irmãos folhas que preveem a mesma classe.

Cada nível da árvore é um job: as partições contam, nos workers, as classes por corte de cada nó."""
import bisect


def cortes_continuos(contagens, num_cortes):
    """Os limiares de uma feature. contagens: [(valor, n)] em ordem de valor."""
    possiveis = len(contagens) - 1
    if possiveis <= 0:
        return []
    if possiveis <= num_cortes:
        return [(contagens[i - 1][0] + contagens[i][0]) / 2.0 for i in range(1, len(contagens))]
    passo = sum(c for _, c in contagens) / (num_cortes + 1)
    cortes, atual, alvo = [], contagens[0][1], passo
    for i in range(1, len(contagens)):
        anterior = atual
        atual += contagens[i][1]
        if abs(anterior - alvo) < abs(atual - alvo):
            cortes.append((contagens[i - 1][0] + contagens[i][0]) / 2.0)
            alvo += passo
    return cortes


def gini(contagem):
    total = sum(contagem)
    return 1.0 - sum((c / total) ** 2 for c in contagem) if total else 0.0


class NoArvore:
    def __init__(self, contagem):
        self.contagem = contagem
        self.feature = self.limiar = self.esq = self.dir = None
        self.ganho = 0.0

    @property
    def folha(self):
        return self.esq is None

    @property
    def previsao(self):
        return float(self.contagem.index(max(self.contagem)))


class _Valores:
    """Numa partição: as contagens de cada valor de cada feature e as das classes."""

    def __call__(self, linhas):
        valores, classes = None, {}
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray()
            if valores is None:
                valores = [{} for _ in x]
            for j, xj in enumerate(x):
                valores[j][xj] = valores[j].get(xj, 0) + 1
            classes[y] = classes.get(y, 0) + 1
        return [(valores, classes)] if valores is not None else []


class _ContarNivel:
    """Numa partição: para cada nó em aberto, as classes por intervalo de corte de cada feature."""

    def __init__(self, internos, abertos, cortes, num_classes):
        self.internos, self.abertos, self.cortes, self.num_classes = internos, set(abertos), cortes, num_classes

    def __call__(self, linhas):
        saida = {}
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray()
            no = 0
            while no in self.internos:
                feature, limiar = self.internos[no]
                no = 2 * no + 1 if x[feature] <= limiar else 2 * no + 2
            if no not in self.abertos:
                continue
            tabela = saida.setdefault(no, [[[0] * self.num_classes for _ in range(len(c) + 1)] for c in self.cortes])
            for j, cortes in enumerate(self.cortes):
                tabela[j][bisect.bisect_left(cortes, x[j])][int(y)] += 1
        return [saida]


def _melhor_corte(no, tabela, cortes, min_instancias):
    total = no.contagem
    n = sum(total)
    pai = gini(total)
    melhor = None
    for j, intervalos in enumerate(tabela):
        esq = [0] * len(total)
        for b in range(len(cortes[j])):
            esq = [a + c for a, c in zip(esq, intervalos[b])]
            dir_ = [t - a for t, a in zip(total, esq)]
            ne, nd = sum(esq), sum(dir_)
            if ne < min_instancias or nd < min_instancias:
                continue
            ganho = pai - (ne / n) * gini(esq) - (nd / n) * gini(dir_)
            if melhor is None or ganho > melhor[0]:
                melhor = (ganho, j, cortes[j][b], esq, dir_)
    return melhor


def treinar(dados, max_profundidade, max_bins, min_instancias, nome):
    from .base import por_particao
    partes = por_particao(dados, _Valores(), f'fit {nome} (cortes)')
    num_features = len(partes[0][0])
    valores = [{} for _ in range(num_features)]
    classes = {}
    for vs, cs in partes:
        for j, mapa in enumerate(vs):
            for valor, c in mapa.items():
                valores[j][valor] = valores[j].get(valor, 0) + c
        for y, c in cs.items():
            classes[y] = classes.get(y, 0) + c
    n = sum(classes.values())
    num_classes = int(max(classes)) + 1
    num_cortes = min(max_bins, n) - 1
    cortes = [cortes_continuos(sorted(v.items()), num_cortes) for v in valores]
    raiz = NoArvore([classes.get(float(c), 0) for c in range(num_classes)])
    nos, internos, nivel = {0: raiz}, {}, [0]
    for profundidade in range(max_profundidade):
        abertos = [i for i in nivel if gini(nos[i].contagem) > 0]
        if not abertos:
            break
        contagens = por_particao(dados, _ContarNivel(dict(internos), abertos, cortes, num_classes),
                                 f'fit {nome} (nível {profundidade + 1})')
        juntas = {}
        for parte in contagens:
            for i, tabela in parte.items():
                if i not in juntas:
                    juntas[i] = tabela
                    continue
                for j, intervalos in enumerate(tabela):
                    for b, cls in enumerate(intervalos):
                        juntas[i][j][b] = [a + c for a, c in zip(juntas[i][j][b], cls)]
        proximo = []
        for i in abertos:
            melhor = _melhor_corte(nos[i], juntas[i], cortes, min_instancias)
            if melhor is None or melhor[0] <= 0:
                continue
            no = nos[i]
            no.ganho, no.feature, no.limiar = melhor[0], melhor[1], melhor[2]
            no.esq, no.dir = NoArvore(melhor[3]), NoArvore(melhor[4])
            nos[2 * i + 1], nos[2 * i + 2] = no.esq, no.dir
            internos[i] = (no.feature, no.limiar)
            proximo += [2 * i + 1, 2 * i + 2]
        nivel = proximo
    podar(raiz)
    return raiz, num_classes, num_features


def podar(no):
    """Como o Spark: dois irmãos folhas com a mesma previsão viram uma folha só (o pai)."""
    if no.folha:
        return
    podar(no.esq)
    podar(no.dir)
    if no.esq.folha and no.dir.folha and no.esq.previsao == no.dir.previsao:
        no.esq = no.dir = no.feature = no.limiar = None
        no.ganho = 0.0


def profundidade(no):
    return 0 if no.folha else 1 + max(profundidade(no.esq), profundidade(no.dir))


def contar(no):
    return 1 if no.folha else 1 + contar(no.esq) + contar(no.dir)


def importancias(raiz, num_features):
    """O ganho × as linhas do nó, somado por feature e normalizado (o featureImportances do Spark)."""
    soma = [0.0] * num_features
    pilha = [raiz]
    while pilha:
        no = pilha.pop()
        if not no.folha:
            soma[no.feature] += no.ganho * sum(no.contagem)
            pilha += [no.esq, no.dir]
    total = sum(soma)
    return [s / total for s in soma] if total else soma


def folha_de(raiz, x):
    no = raiz
    while not no.folha:
        no = no.esq if x[no.feature] <= no.limiar else no.dir
    return no


def texto(no, recuo):
    from ..sql.mostrar import java_double
    p = ' ' * recuo
    if no.folha:
        return f'{p}Predict: {java_double(no.previsao)}\n'
    limiar = java_double(no.limiar)
    return (f'{p}If (feature {no.feature} <= {limiar})\n' + texto(no.esq, recuo + 1)
            + f'{p}Else (feature {no.feature} > {limiar})\n' + texto(no.dir, recuo + 1))
```

- [ ] **Step 4: `classification.py`** (no fim):

```python
# ---------- árvore de decisão ----------

class DecisionTreeClassifier(Estimator):
    _padroes = {'featuresCol': 'features', 'labelCol': 'label', 'predictionCol': 'prediction',
                'probabilityCol': 'probability', 'rawPredictionCol': 'rawPrediction', 'maxDepth': 5, 'maxBins': 32,
                'minInstancesPerNode': 1, 'minInfoGain': 0.0, 'impurity': 'gini', 'seed': None, 'weightCol': None}

    def _fit(self, df):
        from . import _arvore
        if self.getOrDefault('impurity') != 'gini':
            raise NotImplementedError('O DivergePython treina a árvore só com gini.')
        f, rotulo = self.getOrDefault('featuresCol'), self.getOrDefault('labelCol')
        exigir_vetor(df, f)
        raiz, num_classes, num_features = _arvore.treinar(
            df.select(f, rotulo), self.getOrDefault('maxDepth'), self.getOrDefault('maxBins'),
            self.getOrDefault('minInstancesPerNode'), 'DecisionTreeClassifier')
        return DecisionTreeClassificationModel(raiz, num_classes, num_features, self)


class _Folha:
    def __init__(self, raiz, parte):
        self.raiz, self.parte = raiz, parte

    def __call__(self, v):
        from ._arvore import folha_de
        if v is None:
            return None
        folha = folha_de(self.raiz, v.toArray())
        if self.parte == 'pred':
            return folha.previsao
        contagem = [float(c) for c in folha.contagem]
        if self.parte == 'raw':
            return DenseVector(contagem)
        total = sum(contagem)
        return DenseVector([c / total for c in contagem])


class DecisionTreeClassificationModel(Model):
    _padroes = DecisionTreeClassifier._padroes

    def __init__(self, raiz, num_classes, num_features, estimador):
        super().__init__(**estimador._valores)
        self._raiz, self.numClasses, self.numFeatures = raiz, num_classes, num_features

    @property
    def depth(self):
        from ._arvore import profundidade
        return profundidade(self._raiz)

    @property
    def numNodes(self):
        from ._arvore import contar
        return contar(self._raiz)

    @property
    def featureImportances(self):
        from ._arvore import importancias
        from .linalg import SparseVector
        valores = importancias(self._raiz, self.numFeatures)
        return SparseVector(self.numFeatures, [(i, v) for i, v in enumerate(valores) if v])

    @property
    def toDebugString(self):
        from ._arvore import texto
        return (f'DecisionTreeClassificationModel: uid={self.uid}, depth={self.depth}, numNodes={self.numNodes}, '
                f'numClasses={self.numClasses}, numFeatures={self.numFeatures}\n' + texto(self._raiz, 2))

    def predict(self, value):
        return _Folha(self._raiz, 'pred')(value)

    def _transform(self, df):
        f = [self.getOrDefault('featuresCol')]
        df = coluna_nova(df, self.getOrDefault('rawPredictionCol'), _Folha(self._raiz, 'raw'), f, _VETOR)
        df = coluna_nova(df, self.getOrDefault('probabilityCol'), _Folha(self._raiz, 'prob'), f, _VETOR)
        return coluna_nova(df, self.getOrDefault('predictionCol'), _Folha(self._raiz, 'pred'), f, T.DoubleType())
```

- [ ] **Step 5:** rodar e ver passar, mais a suíte inteira do pytest. Commit "MLlib: árvore de
decisão".

### Task 6: `KMeans` e `ClusteringEvaluator`

**Files:**
- Create: `python/pyspark/ml/clustering.py`
- Modify: `python/pyspark/ml/evaluation.py`
- Test: `python/tests/test_mllib.py`

**Interfaces:**
- Consumes: `por_particao`, `coluna_nova` e `exigir_vetor` (Task 2); `DenseVector` (Task 1).
- Produces:
  - `clustering.KMeans` e `KMeansModel`. O modelo tem `clusterCenters() -> [DenseVector]`,
    `summary.trainingCost`, `summary.clusterSizes`, `summary.k`, `summary.numIter`, `predict` e
    `transform`, que põe a `prediction` como int;
  - `evaluation.ClusteringEvaluator`, com o silhouette no quadrado da distância euclidiana.

- [ ] **Step 1: Testes que falham** (acrescente `from pyspark.ml.clustering import KMeans` e
`from pyspark.ml.evaluation import ClusteringEvaluator`):

```python
def pontos(spark, lista):
    return spark.createDataFrame([(Vectors.dense(p),) for p in lista], ['features'])


def test_kmeans_grupos_separados(spark):
    grupos = [(0, 0), (0, 1), (1, 0), (10, 10), (10, 11), (11, 10)]
    df = pontos(spark, grupos)
    m = KMeans(k=2, seed=1).fit(df)
    centros = sorted(c.toArray() for c in m.clusterCenters())
    assert centros == [pytest.approx([1 / 3, 1 / 3]), pytest.approx([31 / 3, 31 / 3])]
    assert m.summary.trainingCost == pytest.approx(2 * (1 / 9 + 1 / 9 + 4 / 9 + 1 / 9 + 4 / 9 + 1 / 9))
    assert sorted(m.summary.clusterSizes) == [3, 3]
    previsoes = [r.prediction for r in m.transform(df).collect()]
    assert len(set(previsoes[:3])) == 1 and len(set(previsoes[3:])) == 1 and previsoes[0] != previsoes[3]
    assert m.transform(df).dtypes[-1] == ('prediction', 'int')
    assert 'fit KMeans (iteração 1)' in acoes()
    assert [c.toArray() for c in KMeans(k=2, seed=1).fit(df).clusterCenters()] == [c.toArray() for c in m.clusterCenters()]


def test_silhouette_como_o_spark(spark):
    df = spark.createDataFrame([(Vectors.dense([x]), g) for x, g in ((0, 0), (1, 0), (10, 1), (11, 1))], ['features', 'prediction'])
    esperado = ((1 - 1 / 110.5) + (1 - 1 / 90.5)) / 2
    assert ClusteringEvaluator().evaluate(df) == pytest.approx(esperado)
```

A conta do `trainingCost`: cada grupo tem distâncias ao quadrado de 2/9, 5/9 e 5/9 até o centro,
ou seja, 12/9 por grupo e 24/9 no total. É o que `2 * (1/9 + 1/9 + 4/9 + 1/9 + 4/9 + 1/9)` dá.

- [ ] **Step 2:** rodar e ver falhar.

- [ ] **Step 3: `pyspark/ml/clustering.py`**

```python
"""pyspark.ml.clustering: KMeans pelo algoritmo de Lloyd.

A inicialização é o k-means++ com a semente (o Spark usa o k-means||, que sorteia de outro jeito:
os centros iniciais mudam, mas, com grupos bem separados, os grupos finais são os mesmos). Cada
iteração é um job: as partições somam os pontos de cada centro nos workers, e o processo principal
calcula os centros novos, até nenhum mudar mais que tol ou chegar ao maxIter. O trainingCost é o da
última iteração, como no Spark."""
import random

from ..sql import types as T
from .base import Estimator, Model, coluna_nova, exigir_vetor, por_particao
from .linalg import DenseVector


def _mais_perto(centros, x):
    melhor, distancia = 0, float('inf')
    for i, c in enumerate(centros):
        d = sum((a - b) ** 2 for a, b in zip(c, x))
        if d < distancia:
            melhor, distancia = i, d
    return melhor, distancia


class _SomasKMeans:
    def __init__(self, centros):
        self.centros = centros

    def __call__(self, linhas):
        k = len(self.centros)
        somas, contagens, custo = [None] * k, [0] * k, 0.0
        for (v,) in linhas:
            if v is None:
                continue
            x = v.toArray()
            i, d = _mais_perto(self.centros, x)
            custo += d
            contagens[i] += 1
            somas[i] = list(x) if somas[i] is None else [a + b for a, b in zip(somas[i], x)]
        return [(somas, contagens, custo)]


class KMeans(Estimator):
    _padroes = {'featuresCol': 'features', 'predictionCol': 'prediction', 'k': 2, 'maxIter': 20, 'seed': None,
                'tol': 1e-4, 'initMode': 'k-means||', 'initSteps': 2, 'distanceMeasure': 'euclidean', 'weightCol': None}

    def _fit(self, df):
        if self.getOrDefault('distanceMeasure') != 'euclidean':
            raise NotImplementedError('O DivergePython agrupa só pela distância euclidiana.')
        f = self.getOrDefault('featuresCol')
        exigir_vetor(df, f)
        dados = df.select(f)
        pontos = [v.toArray() for (v,) in dados._linhas('fit KMeans (início)') if v is not None]
        semente = self.getOrDefault('seed')
        sorteio = random.Random(semente if semente is not None else 20260101)
        centros = [pontos[sorteio.randrange(len(pontos))]]
        while len(centros) < self.getOrDefault('k'):  # k-means++: o próximo centro sai pela distância ao quadrado
            distancias = [_mais_perto(centros, p)[1] for p in pontos]
            total = sum(distancias)
            if total == 0:
                break  # menos pontos distintos que k: como o Spark, menos centros
            alvo, acumulado = sorteio.random() * total, 0.0
            for p, d in zip(pontos, distancias):
                acumulado += d
                if acumulado >= alvo:
                    centros.append(p)
                    break
        tol2 = self.getOrDefault('tol') ** 2
        custo, iteracao = 0.0, 0
        for iteracao in range(1, self.getOrDefault('maxIter') + 1):
            partes = por_particao(dados, _SomasKMeans(centros), f'fit KMeans (iteração {iteracao})')
            custo = sum(p[2] for p in partes)
            novos = []
            for i, c in enumerate(centros):
                n = sum(p[1][i] for p in partes)
                somas = [p[0][i] for p in partes if p[0][i] is not None]
                novos.append([sum(s[j] for s in somas) / n for j in range(len(c))] if n else c)
            mudou = any(sum((a - b) ** 2 for a, b in zip(novo, velho)) > tol2 for novo, velho in zip(novos, centros))
            centros = novos
            if not mudou:
                break
        return KMeansModel([DenseVector(c) for c in centros], custo, iteracao, self, df)


class _Grupo:
    def __init__(self, centros):
        self.centros = centros

    def __call__(self, v):
        return None if v is None else _mais_perto(self.centros, v.toArray())[0]


class KMeansModel(Model):
    _padroes = KMeans._padroes

    def __init__(self, centros, custo, iteracoes, estimador, treino):
        super().__init__(**estimador._valores)
        self._centros, self._custo, self._iteracoes, self._treino, self._resumo = centros, custo, iteracoes, treino, None

    def clusterCenters(self):
        """Os centros (o Spark devolve arrays do numpy; aqui, DenseVector)."""
        return list(self._centros)

    def predict(self, value):
        return _Grupo([c.toArray() for c in self._centros])(value)

    def _transform(self, df):
        impl = _Grupo([c.toArray() for c in self._centros])
        return coluna_nova(df, self.getOrDefault('predictionCol'), impl, [self.getOrDefault('featuresCol')], T.IntegerType())

    @property
    def hasSummary(self):
        return True

    @property
    def summary(self):
        if self._resumo is None:
            self._resumo = KMeansSummary(self.transform(self._treino), self)
        return self._resumo


class KMeansSummary:
    def __init__(self, predictions, modelo):
        self.predictions = predictions
        self.predictionCol = modelo.getOrDefault('predictionCol')
        self.k, self.trainingCost, self.numIter = len(modelo._centros), modelo._custo, modelo._iteracoes
        self._tamanhos = None

    @property
    def clusterSizes(self):
        if self._tamanhos is None:
            contagem = [0] * self.k
            for (g,) in self.predictions.select(self.predictionCol)._linhas('resumo KMeans'):
                contagem[g] += 1
            self._tamanhos = contagem
        return self._tamanhos

    @property
    def cluster(self):
        return self.predictions.select(self.predictionCol)
```

- [ ] **Step 4: `evaluation.py`** (no fim):

```python
def silhouette(pontos):
    """pontos: [(vetor, grupo)]. O silhouette do Spark, com a distância euclidiana ao quadrado: a é a
    média até os outros pontos do grupo, b a menor média até outro grupo; s = 1 − a/b (ou b/a − 1)."""
    grupos = {}
    for v, g in pontos:
        grupos.setdefault(g, []).append(v.toArray())
    if len(grupos) < 2:
        from ..errors import IllegalArgumentException
        raise IllegalArgumentException('Number of clusters must be greater than one.')

    def media(x, outros, menos_um):
        soma = sum(sum((a - b) ** 2 for a, b in zip(x, y)) for y in outros)
        return soma / (len(outros) - 1 if menos_um else len(outros))
    total = 0.0
    for g, membros in grupos.items():
        for x in membros:
            if len(membros) == 1:
                continue  # sozinho no grupo: 0, como no Spark
            a = media(x, membros, True)
            b = min(media(x, outros, False) for h, outros in grupos.items() if h != g)
            total += 1 - a / b if a < b else (b / a - 1 if a > b else 0.0)
    return total / len(pontos)


class ClusteringEvaluator(Evaluator):
    _padroes = {'featuresCol': 'features', 'predictionCol': 'prediction', 'metricName': 'silhouette',
                'distanceMeasure': 'squaredEuclidean', 'weightCol': None}

    def _avaliar(self, df):
        if self.getOrDefault('distanceMeasure') != 'squaredEuclidean':
            raise NotImplementedError('O DivergePython calcula o silhouette só com a distância euclidiana ao quadrado.')
        linhas = df.select(self.getOrDefault('featuresCol'), self.getOrDefault('predictionCol'))._linhas(
            'evaluate ClusteringEvaluator')
        return silhouette(linhas)
```

- [ ] **Step 5:** rodar e ver passar, mais a suíte inteira do pytest. Commit "MLlib: KMeans e
silhouette".

### Task 7: O MLlib no Pyodide e a conformidade com o PySpark real

**Files:**
- Modify: `tests/spark.test.js`
- Create: `python/conformidade/c14_mllib_features.py`, `python/conformidade/c14.esperado`
- Create: `python/conformidade/c15_mllib_modelos.py`, `python/conformidade/c15.esperado`
- Modify: `python/tests/test_conformidade.py`, com o total ajustado de 13 para 15

- [ ] **Step 1: Teste no Pyodide** (em `tests/spark.test.js`, depois do teste do streaming):

```js
  it('o MLlib treina no Pyodide, com o fit como job da aba Execução', async () => {
    const r = await rodar(`${INICIO}from pyspark.ml.feature import VectorAssembler\nfrom pyspark.ml.regression import LinearRegression\n`
      + 'df = spark.createDataFrame([(float(x), 2.0 + 3.0 * x) for x in range(8)], ["x", "label"])\n'
      + 'treino = VectorAssembler(inputCols=["x"], outputCol="features").transform(df)\n'
      + 'm = LinearRegression().fit(treino)\n'
      + 'coef = [round(c, 6) for c in m.coefficients]\nb = round(m.intercept, 6)\n');
    expect(r.erro).toBeNull();
    expect(r.variaveis.coef).toEqual([3]);
    expect(r.variaveis.b).toBe(2);
    expect(r.spark.jobs.map((j) => j.acao)).toContain('fit LinearRegression');
    expect(r.tabelas.treino.colunas.at(-1)).toEqual({ nome: 'features', tipo: 'vector' });
  }, 120_000);
```

Rodar e ver passar (o código Python já existe; se falhar, o motivo é do Pyodide e precisa de
conserto).

- [ ] **Step 2: `c14_mllib_features.py`**

```python
"""MLlib: vetores, features, regressão linear, avaliação e randomSplit (com tolerância nos números)."""
import random

from _comum import sessao
from pyspark.ml import Pipeline
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.feature import OneHotEncoder, StandardScaler, StringIndexer, VectorAssembler
from pyspark.ml.linalg import Vectors
from pyspark.ml.regression import LinearRegression

spark = sessao()
sorteio = random.Random(7)
BASE = {'milho': 3.0, 'feijao': 1.0, 'mandioca': 5.0}
linhas = []
for i in range(60):
    cultura = list(BASE)[i % 3]
    chuva, area, irrigado = round(sorteio.uniform(300, 900), 1), round(sorteio.uniform(1, 20), 1), i % 4 == 0
    producao = round(0.004 * chuva + 1.8 * area + (2.5 if irrigado else 0.0) + BASE[cultura] + sorteio.gauss(0, 0.8), 2)
    linhas.append((f'm{i % 7}', cultura, chuva, area, irrigado, producao))
safra = spark.createDataFrame(linhas, 'municipio STRING, cultura STRING, chuva_mm DOUBLE, area_ha DOUBLE, irrigado BOOLEAN, producao_t DOUBLE')


def r4(xs):
    return [round(float(x), 4) for x in xs]


v = spark.createDataFrame([(Vectors.dense([1.0, 0.0, 3.5]), Vectors.sparse(4, [1, 3], [2.0, 1.0]))], ['d', 's'])
v.show(truncate=False)
print(v.dtypes)
print(VectorAssembler(inputCols=['chuva_mm', 'area_ha'], outputCol='x').transform(safra).select('x').first().x)
VectorAssembler(inputCols=['a', 'b', 'c', 'd'], outputCol='v').transform(
    spark.createDataFrame([(0.0, 0.0, 0.0, 5.0)], ['a', 'b', 'c', 'd'])).show(truncate=False)

indexador = StringIndexer(inputCol='cultura', outputCol='ci').fit(safra)
print(indexador.labels)
indexada = indexador.transform(safra)
OneHotEncoder(inputCols=['ci'], outputCols=['cv']).fit(indexada).transform(indexada) \
    .select('cultura', 'cv').distinct().orderBy('cultura').show(truncate=False)

montada = VectorAssembler(inputCols=['chuva_mm', 'area_ha'], outputCol='x').transform(safra)
escala = StandardScaler(inputCol='x', outputCol='xs', withMean=True).fit(montada)
print(r4(escala.mean), r4(escala.std))

treino = VectorAssembler(inputCols=['chuva_mm', 'area_ha'], outputCol='features').transform(safra) \
    .withColumnRenamed('producao_t', 'label')
m = LinearRegression().fit(treino)
print(r4(m.coefficients), round(m.intercept, 4), round(m.summary.rootMeanSquaredError, 4), round(m.summary.r2, 4))
m2 = LinearRegression(regParam=0.5).fit(treino)
print(r4(m2.coefficients), round(m2.intercept, 4))
previsoes = m.transform(treino)
print([round(RegressionEvaluator(metricName=n).evaluate(previsoes), 4) for n in ('rmse', 'mse', 'mae', 'r2')])

pipe = Pipeline(stages=[StringIndexer(inputCol='cultura', outputCol='ci'), OneHotEncoder(inputCols=['ci'], outputCols=['cv']),
                        VectorAssembler(inputCols=['chuva_mm', 'area_ha', 'cv'], outputCol='features'),
                        LinearRegression(labelCol='producao_t')]).fit(safra)
print([type(s).__name__ for s in pipe.stages], [round(float(c), 3) for c in pipe.stages[-1].coefficients])
a, b = safra.randomSplit([0.7, 0.3], seed=42)
print(a.count() + b.count(), abs(a.count() / 60 - 0.7) <= 0.15)
spark.stop()
```

- [ ] **Step 3: `c15_mllib_modelos.py`**

```python
"""MLlib: regressão logística, árvore de decisão, KMeans e os avaliadores (com tolerância nos números)."""
import math
import random

from _comum import sessao
from pyspark.ml.classification import DecisionTreeClassifier, LogisticRegression
from pyspark.ml.clustering import KMeans
from pyspark.ml.evaluation import BinaryClassificationEvaluator, ClusteringEvaluator, MulticlassClassificationEvaluator
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.linalg import Vectors

spark = sessao()
sorteio = random.Random(11)


def safra(n):
    linhas = []
    for _ in range(n):
        chuva, irrigado = round(sorteio.uniform(200, 900), 1), float(sorteio.random() < 0.3)
        logito = 4.0 - 0.009 * chuva - 2.0 * irrigado
        risco = 1.0 if sorteio.random() < 1 / (1 + math.exp(-logito)) else 0.0
        linhas.append((chuva, irrigado, risco))
    df = spark.createDataFrame(linhas, ['chuva_mm', 'irrigado', 'label'])
    return VectorAssembler(inputCols=['chuva_mm', 'irrigado'], outputCol='features').transform(df)


treino, teste = safra(120), safra(40)
lr = LogisticRegression().fit(treino)
print([round(float(c), 3) for c in lr.coefficients], round(lr.intercept, 3), round(lr.summary.areaUnderROC, 3))
lr2 = LogisticRegression(regParam=0.1).fit(treino)
print([round(float(c), 3) for c in lr2.coefficients], round(lr2.intercept, 3))
p = lr.transform(teste)
print([round(float(x), 3) for x in p.first().probability], p.first().prediction)
print(round(BinaryClassificationEvaluator().evaluate(p), 3),
      round(BinaryClassificationEvaluator(metricName='areaUnderPR').evaluate(p), 3))
print(round(MulticlassClassificationEvaluator(metricName='accuracy').evaluate(p), 3),
      round(MulticlassClassificationEvaluator().evaluate(p), 3))

arvore = DecisionTreeClassifier(maxDepth=3).fit(treino)
print(arvore.depth, arvore.numNodes, [r.prediction for r in arvore.transform(teste).collect()])
print([round(float(x), 3) for x in arvore.featureImportances.toArray()])

centros = [(0.0, 0.0), (10.0, 10.0), (0.0, 10.0)]
pontos = spark.createDataFrame([(Vectors.dense([cx + sorteio.gauss(0, 0.5), cy + sorteio.gauss(0, 0.5)]),)
                                for cx, cy in centros for _ in range(20)], ['features'])
km = KMeans(k=3, seed=1).fit(pontos)
print(sorted(km.summary.clusterSizes), sorted([round(float(x), 1) for x in c] for c in km.clusterCenters()))
print(f'{km.summary.trainingCost:.4g}', round(ClusteringEvaluator().evaluate(km.transform(pontos)), 3))
spark.stop()
```

- [ ] **Step 4: gravar e conferir o esperado.**
  1. Grave com o nosso:
     `python python/conformidade/rodar.py --gravar c14_mllib_features c15_mllib_modelos`.
  2. Confira à mão o que dá para conferir:
     - o `show` dos vetores (`[1.0,0.0,3.5]` e `(4,[1,3],[2.0,1.0])`);
     - os `dtypes` com `vector`;
     - o vetor esparso do `VectorAssembler`, `(4,[3],[5.0])`;
     - os rótulos do `StringIndexer` em ordem de frequência;
     - o one-hot com o último zerado;
     - os coeficientes da linear perto de `0.004` e `1.8`;
     - os três tamanhos de grupo do KMeans iguais a 20.
  3. Rode `python python/conformidade/rodar.py` (os 15 iguais) e o `test_conformidade.py`.

  Commit "Conformidade: MLlib contra o PySpark 4.0".

- [ ] **Step 5:** a suíte inteira (pytest, conformidade, vitest e eslint), a revisão final e o
apagar da área de trabalho do SDD.

- [ ] **Step 6 (só com o "sim"): conferir no CI.**
  - Faça o push do `fase5`. O PR em rascunho
    [sertaoseracloud/python-playground#2](https://github.com/sertaoseracloud/python-playground/pull/2)
    roda o `c14` e o `c15`.
  - Se divergirem além da tolerância, ajuste o nosso MLlib para dar a saída real.
  - Os pontos mais prováveis de divergir são:
    - a penalidade da linear e da logística (desvio da população × amostral);
    - os cortes da árvore;
    - o `str` do vetor no `print`.
  - Uma diferença impossível de evitar, como o sorteio do `randomSplit`, já sai da comparação. A
    tolerância segue a spec 4.
