"""MLlib do DivergePython: vetores, features, pipeline, modelos e avaliadores, com o treino
distribuído pelos workers."""
import math

import pytest

from diverge_runtime import estagios
from pyspark.errors import IllegalArgumentException, SparkRuntimeException
from pyspark.sql import SparkSession
from pyspark.ml.feature import OneHotEncoder, StandardScaler, StringIndexer, VectorAssembler
from pyspark.ml.classification import LogisticRegression
from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator, RegressionEvaluator
from pyspark.ml.linalg import DenseVector, SparseVector, Vectors
from pyspark.ml.regression import LinearRegression


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
