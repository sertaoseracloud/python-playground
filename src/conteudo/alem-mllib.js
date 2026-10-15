// 🤖 MLlib (módulo 🌊 Spark além do batch): 4 lições e 12 exercícios com a safra do sertão. O
// pyspark.ml do DivergePython é Python puro, com a API do Spark: os números ficam muito perto
// dos do Spark, e as regras `modelo` usam tolerância. As métricas da regra são calculadas pelo
// executor nos dados de teste (safra-teste.csv), com o modelo do aluno.
import { programa } from './pyspark-comum.js';
import { exercicioAlem, bloco, LER } from './alem-comum.js';
import { safra, safraOculto, municipios, municipiosOculto } from './alem-dados.js';

const TREINO = LER('safra-treino.csv', 'treino');
const TESTE = LER('safra-teste.csv', 'teste');
const FEATURES = 'from pyspark.ml.feature import VectorAssembler\n';
const MONTADOR = 'montador = VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado"], outputCol="features")\n';
const RISCO = 'montador = VectorAssembler(inputCols=["chuva_mm", "irrigado"], outputCol="features")\n';
const COLUNAS = ['municipio', 'cultura', 'chuva_mm', 'area_ha', 'irrigado', 'producao_t', 'risco'];
const COEF = [[0.01, 2, 1.5], [0.02, 1, 3]];
const INTERCEPTO = [3, 1];
const PIPELINE = `from pyspark.ml import Pipeline
from pyspark.ml.feature import StringIndexer, OneHotEncoder, VectorAssembler
from pyspark.ml.regression import LinearRegression

etapas = [
    StringIndexer(inputCol="cultura", outputCol="cultura_idx"),
    OneHotEncoder(inputCols=["cultura_idx"], outputCols=["cultura_vec"]),
    VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado", "cultura_vec"], outputCol="features"),
    LinearRegression(labelCol="producao_t"),
]
`;

const dados = { dados: safra, oculto: safraOculto };
const nosDois = (regra) => ({ regras: [regra(0)], regrasOcultas: [regra(1)] });

export const licoesMllib = {
  features: {
    id: 'licao-features',
    tipo: 'licao',
    titulo: 'Features, vetores e VectorAssembler',
    resumo: `
      <p>Um modelo aprende com <b>features</b> (as características: chuva, área, irrigação) para prever um <b>rótulo</b>
        (a produção, o risco). No MLlib, as features de cada linha vão juntas num <b>vetor</b>, numa coluna só.</p>
      <p>O <code>VectorAssembler(inputCols=[...], outputCol="features")</code> monta esse vetor. É a ficha do agricultor:
        em vez de folhas soltas, um cartão com todos os números da roça.</p>`,
    arquivos: programa('features', bloco`
      ${FEATURES}from pyspark.ml.linalg import Vectors

      ${TREINO}
      ${MONTADOR}
      com_features = montador.transform(treino)
      com_features.select("municipio", "features", "producao_t").show(truncate=False)
      print(Vectors.dense([300.0, 5.0, 1.0]))
    `),
    dados: safra,
  },
  pipeline: {
    id: 'licao-pipeline',
    tipo: 'licao',
    titulo: 'Transformadores, estimadores e Pipeline',
    resumo: `
      <p>Um <b>transformador</b> muda o DataFrame com <code>transform</code> (o <code>VectorAssembler</code>). Um
        <b>estimador</b> primeiro aprende com os dados (<code>fit</code>) e devolve um <b>modelo</b>, que é um transformador
        (o <code>StringIndexer</code> aprende os números de cada cultura).</p>
      <p>O <b>Pipeline</b> junta as etapas em ordem: <code>Pipeline(stages=[...]).fit(treino)</code> devolve um
        <code>PipelineModel</code>, que faz tudo de uma vez nos dados novos. <code>OneHotEncoder</code> transforma o índice
        da cultura num vetor de zeros e uns, para o modelo não achar que "uva" (4) vale mais que "milho" (0).</p>`,
    arquivos: programa('pipeline', bloco`
      ${PIPELINE}
      ${TREINO}
      modelo = Pipeline(stages=etapas).fit(treino)
      modelo.transform(treino).select("cultura", "cultura_idx", "cultura_vec", "prediction").show(truncate=False)
    `),
    dados: safra,
  },
  modelos: {
    id: 'licao-regressao-classificacao',
    tipo: 'licao',
    titulo: 'Regressão e classificação',
    resumo: `
      <p>A <b>regressão</b> prevê um número: <code>LinearRegression(labelCol="producao_t")</code> aprende um peso
        (<code>coefficients</code>) para cada feature, mais o <code>intercept</code>.</p>
      <p>A <b>classificação</b> prevê uma classe: <code>LogisticRegression(labelCol="risco")</code> dá a
        <code>probability</code> de cada classe e a <code>prediction</code>. A <code>DecisionTreeClassifier</code> faz
        perguntas em sequência ("choveu menos de 650 mm?"); o <code>maxDepth</code> limita quantas.</p>`,
    arquivos: programa('modelos', bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.classification import LogisticRegression

      ${TREINO}
      ${MONTADOR}
      dados = montador.transform(treino)
      producao = LinearRegression(labelCol="producao_t").fit(dados)
      print("pesos:", producao.coefficients, "intercepto:", round(producao.intercept, 3))
      risco = LogisticRegression(labelCol="risco").fit(dados)
      risco.transform(dados).select("municipio", "probability", "prediction").show(truncate=False)
    `),
    dados: safra,
  },
  avaliacao: {
    id: 'licao-avaliacao',
    tipo: 'licao',
    titulo: 'Avaliação, treino e teste, e agrupamento',
    resumo: `
      <p>Um modelo se avalia com dados que ele <b>não viu</b> no treino. Se ele vai bem no treino e mal no teste, decorou
        em vez de aprender: é o <b>overfitting</b>. <code>randomSplit([0.8, 0.2], seed=1)</code> separa os dois.</p>
      <p>Os <b>avaliadores</b> dão uma nota: <code>RegressionEvaluator</code> (rmse, r2), <code>BinaryClassificationEvaluator</code>
        (área sob a curva ROC: 1 é perfeito, 0,5 é chute) e <code>ClusteringEvaluator</code> (silhueta).</p>
      <p>O <b>KMeans</b> agrupa sem rótulo nenhum: <code>KMeans(k=3, seed=1)</code> acha 3 grupos de municípios parecidos.</p>`,
    arquivos: programa('avaliacao', bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.clustering import KMeans
      from pyspark.ml.evaluation import RegressionEvaluator, ClusteringEvaluator

      ${TREINO}${TESTE}
      ${MONTADOR}
      modelo = LinearRegression(labelCol="producao_t").fit(montador.transform(treino))
      rmse = RegressionEvaluator(labelCol="producao_t", metricName="rmse").evaluate(modelo.transform(montador.transform(teste)))
      print("RMSE no teste:", round(rmse, 4))
      cidades = spark.read.csv("municipios.csv", header=True, inferSchema=True)
      pontos = VectorAssembler(inputCols=["chuva_anual", "temperatura"], outputCol="features").transform(cidades)
      grupos = KMeans(k=3, seed=1).fit(pontos)
      print("tamanhos:", sorted(grupos.summary.clusterSizes))
      print("silhueta:", round(ClusteringEvaluator().evaluate(grupos.transform(pontos)), 3))
    `),
    dados: { ...safra, ...municipios },
  },
};

export const exerciciosMllib = [
  exercicioAlem({
    id: 'ml-vetor',
    titulo: 'O vetor de features',
    dificuldade: 'facil',
    enunciado: '<p>Guarde em <code>com_features</code> a safra de treino com uma coluna nova, <code>features</code>, com o vetor de <code>chuva_mm</code>, <code>area_ha</code> e <code>irrigado</code>.</p>',
    dica: 'VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado"], outputCol="features").transform(treino)',
    ...dados,
    inicial: `${FEATURES}${TREINO}com_features = treino\ncom_features.show()\n`,
    solucao: bloco`
      ${FEATURES}${TREINO}
      ${MONTADOR}
      com_features = montador.transform(treino)
      com_features.show(truncate=False)
    `,
    regras: [{ dataframe: 'com_features', colunas: [...COLUNAS, 'features'], total: 12 }],
    regrasOcultas: [{ dataframe: 'com_features', colunas: [...COLUNAS, 'features'], total: 10 }],
  }),
  exercicioAlem({
    id: 'ml-indexer',
    titulo: 'Culturas em números',
    dificuldade: 'facil',
    enunciado: '<p>Transforme a <code>cultura</code> em <code>cultura_idx</code> (com <code>StringIndexer</code>) e depois em <code>cultura_vec</code> (com <code>OneHotEncoder</code>), guardando o resultado em <code>codificado</code>. Guarde em <code>indices</code> os pares distintos de <code>cultura</code> e <code>cultura_idx</code>.</p>',
    dica: 'StringIndexer(inputCol="cultura", outputCol="cultura_idx").fit(treino); OneHotEncoder(inputCols=["cultura_idx"], outputCols=["cultura_vec"]).fit(...)',
    ...dados,
    inicial: `from pyspark.ml.feature import StringIndexer, OneHotEncoder\n${TREINO}codificado = treino\nindices = treino.select("cultura").distinct()\nindices.show()\n`,
    solucao: bloco`
      from pyspark.ml.feature import StringIndexer, OneHotEncoder

      ${TREINO}
      indexado = StringIndexer(inputCol="cultura", outputCol="cultura_idx").fit(treino).transform(treino)
      codificado = OneHotEncoder(inputCols=["cultura_idx"], outputCols=["cultura_vec"]).fit(indexado).transform(indexado)
      indices = codificado.select("cultura", "cultura_idx").distinct()
      indices.show()
    `,
    regras: [{ dataframe: 'codificado', colunas: [...COLUNAS, 'cultura_idx', 'cultura_vec'] }, { dataframe: 'indices', linhas: [['milho', 0], ['feijao', 1], ['manga', 2], ['melao', 3], ['uva', 4]] }],
    regrasOcultas: [{ dataframe: 'indices', linhas: [['feijao', 0], ['milho', 1], ['uva', 2]] }],
  }),
  exercicioAlem({
    id: 'ml-scaler',
    titulo: 'Tudo na mesma escala',
    dificuldade: 'facil',
    enunciado: '<p>A chuva vai a 900 e a irrigação, só a 1. Treine em <code>escalador</code> um <code>StandardScaler</code> com média 0 e desvio 1 (<code>withMean=True</code>, <code>withStd=True</code>) sobre a coluna <code>features</code>, e guarde em <code>escalado</code> o resultado, na coluna <code>escalado</code>.</p>',
    dica: 'StandardScaler(inputCol="features", outputCol="escalado", withMean=True, withStd=True).fit(com_features)',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.feature import StandardScaler\n${TREINO}${MONTADOR}com_features = montador.transform(treino)\nescalador = StandardScaler(inputCol="features", outputCol="escalado")\nescalado = com_features\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.feature import StandardScaler

      ${TREINO}
      ${MONTADOR}
      com_features = montador.transform(treino)
      escalador = StandardScaler(inputCol="features", outputCol="escalado", withMean=True, withStd=True).fit(com_features)
      escalado = escalador.transform(com_features)
      escalado.select("municipio", "escalado").show(truncate=False)
    `,
    regras: [{ modelo: 'escalador', tipo: 'StandardScalerModel' }, { dataframe: 'escalado', total: 12 }, { codigo: 'withMean\\s*=\\s*True' }],
    regrasOcultas: [{ modelo: 'escalador', tipo: 'StandardScalerModel' }, { dataframe: 'escalado', total: 10 }],
  }),
  exercicioAlem({
    id: 'ml-linear',
    titulo: 'Quanto a roça produz',
    dificuldade: 'medio',
    enunciado: '<p>Treine em <code>modelo</code> uma regressão linear que prevê <code>producao_t</code> a partir de <code>chuva_mm</code>, <code>area_ha</code> e <code>irrigado</code>. Imprima os pesos (<code>coefficients</code>) e o <code>intercept</code>.</p>',
    dica: 'LinearRegression(featuresCol="features", labelCol="producao_t").fit(montador.transform(treino))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\n${TREINO}${MONTADOR}modelo = LinearRegression(labelCol="risco").fit(montador.transform(treino))\nprint(modelo.coefficients, modelo.intercept)\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression

      ${TREINO}
      ${MONTADOR}
      modelo = LinearRegression(featuresCol="features", labelCol="producao_t").fit(montador.transform(treino))
      print(modelo.coefficients, modelo.intercept)
    `,
    ...nosDois((i) => ({ modelo: 'modelo', tipo: 'LinearRegressionModel', coeficientes: COEF[i], intercepto: INTERCEPTO[i] })),
  }),
  exercicioAlem({
    id: 'ml-rmse',
    titulo: 'O erro no teste',
    dificuldade: 'medio',
    enunciado: '<p>O <code>modelo</code> usa só a chuva. Use as três features (<code>chuva_mm</code>, <code>area_ha</code>, <code>irrigado</code>) no <code>montador</code>, treine de novo e calcule em <code>rmse</code> o erro (RMSE) nos dados de <code>safra-teste.csv</code>, com o <code>RegressionEvaluator</code>.</p>',
    dica: 'RegressionEvaluator(labelCol="producao_t", metricName="rmse").evaluate(modelo.transform(montador.transform(teste)))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\nfrom pyspark.ml.evaluation import RegressionEvaluator\n${TREINO}${TESTE}montador = VectorAssembler(inputCols=["chuva_mm"], outputCol="features")\nmodelo = LinearRegression(labelCol="producao_t").fit(montador.transform(treino))\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.evaluation import RegressionEvaluator

      ${TREINO}${TESTE}
      ${MONTADOR}
      modelo = LinearRegression(labelCol="producao_t").fit(montador.transform(treino))
      print("RMSE no treino:", modelo.summary.rootMeanSquaredError)
      rmse = RegressionEvaluator(labelCol="producao_t", metricName="rmse").evaluate(modelo.transform(montador.transform(teste)))
      print("RMSE no teste:", rmse)
    `,
    regras: [{ modelo: 'modelo', tipo: 'LinearRegressionModel', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv', preparar: 'montador' } }, { codigo: 'RegressionEvaluator' }],
    regrasOcultas: [{ modelo: 'modelo', tipo: 'LinearRegressionModel', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv', preparar: 'montador' } }],
  }),
  exercicioAlem({
    id: 'ml-logistica',
    titulo: 'O risco da safra',
    dificuldade: 'medio',
    enunciado: '<p>O risco (0 ou 1) é uma classe, não um número. Treine em <code>risco</code> uma regressão <b>logística</b> com <code>chuva_mm</code> e <code>irrigado</code>, e guarde em <code>previsoes</code> as colunas <code>municipio</code>, <code>probability</code> e <code>prediction</code> do treino.</p>',
    dica: 'LogisticRegression(labelCol="risco").fit(montador.transform(treino))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\n${TREINO}${RISCO}risco = LinearRegression(labelCol="risco").fit(montador.transform(treino))\nprevisoes = risco.transform(montador.transform(treino)).select("municipio", "prediction")\nprevisoes.show()\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.classification import LogisticRegression

      ${TREINO}
      ${RISCO}
      risco = LogisticRegression(labelCol="risco").fit(montador.transform(treino))
      previsoes = risco.transform(montador.transform(treino)).select("municipio", "probability", "prediction")
      previsoes.show(truncate=False)
    `,
    regras: [{ modelo: 'risco', tipo: 'LogisticRegressionModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'probability', 'prediction'], total: 12 }],
    regrasOcultas: [{ modelo: 'risco', tipo: 'LogisticRegressionModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'probability', 'prediction'], total: 10 }],
  }),
  exercicioAlem({
    id: 'ml-auc',
    titulo: 'A nota do classificador',
    dificuldade: 'medio',
    enunciado: '<p>Treine em <code>risco</code> a regressão logística (com <code>chuva_mm</code> e <code>irrigado</code>) e calcule em <code>auc</code> a área sob a curva ROC nos dados de <code>safra-teste.csv</code>. A nota precisa ser de pelo menos 0,75.</p>',
    dica: 'BinaryClassificationEvaluator(labelCol="risco").evaluate(risco.transform(montador.transform(teste)))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.classification import LogisticRegression\nfrom pyspark.ml.evaluation import BinaryClassificationEvaluator\n${TREINO}${TESTE}${RISCO}risco = LogisticRegression(labelCol="risco")\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.classification import LogisticRegression
      from pyspark.ml.evaluation import BinaryClassificationEvaluator

      ${TREINO}${TESTE}
      ${RISCO}
      risco = LogisticRegression(labelCol="risco").fit(montador.transform(treino))
      auc = BinaryClassificationEvaluator(labelCol="risco").evaluate(risco.transform(montador.transform(teste)))
      print("AUC no teste:", round(auc, 3))
    `,
    regras: [{ modelo: 'risco', metrica: { nome: 'areaUnderROC', min: 0.75, dados: 'safra-teste.csv', preparar: 'montador' } }, { codigo: 'BinaryClassificationEvaluator' }],
    regrasOcultas: [{ modelo: 'risco', metrica: { nome: 'areaUnderROC', min: 0.75, dados: 'safra-teste.csv', preparar: 'montador' } }],
  }),
  exercicioAlem({
    id: 'ml-arvore',
    titulo: 'Três perguntas',
    dificuldade: 'medio',
    enunciado: '<p>Treine em <code>arvore</code> uma árvore de decisão que prevê o <code>risco</code> com chuva, área e irrigação, fazendo no máximo <b>três</b> perguntas em sequência (profundidade 3). Imprima a profundidade (<code>depth</code>) e o número de nós (<code>numNodes</code>).</p>',
    dica: 'DecisionTreeClassifier(labelCol="risco", maxDepth=3).fit(montador.transform(treino))',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.classification import DecisionTreeClassifier\n${TREINO}${MONTADOR}arvore = DecisionTreeClassifier(labelCol="risco", maxDepth=1).fit(montador.transform(treino))\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.classification import DecisionTreeClassifier

      ${TREINO}
      ${MONTADOR}
      arvore = DecisionTreeClassifier(labelCol="risco", maxDepth=3).fit(montador.transform(treino))
      print("profundidade:", arvore.depth, "nós:", arvore.numNodes)
    `,
    ...nosDois(() => ({ modelo: 'arvore', tipo: 'DecisionTreeClassificationModel', profundidade: 3 })),
  }),
  exercicioAlem({
    id: 'ml-kmeans',
    titulo: 'Municípios parecidos',
    dificuldade: 'medio',
    enunciado: '<p>Agrupe os municípios (<code>municipios.csv</code>) em <b>3</b> grupos pela <code>chuva_anual</code> e pela <code>temperatura</code>, com <code>KMeans(k=3, seed=1)</code>, guardando o modelo em <code>grupos</code>. Guarde em <code>tamanhos</code> o tamanho de cada grupo, em ordem crescente.</p>',
    dica: 'sorted(grupos.summary.clusterSizes)',
    dados: municipios,
    oculto: municipiosOculto,
    inicial: `${FEATURES}from pyspark.ml.clustering import KMeans\ncidades = spark.read.csv("municipios.csv", header=True, inferSchema=True)\npontos = VectorAssembler(inputCols=["chuva_anual", "temperatura"], outputCol="features").transform(cidades)\ngrupos = KMeans(k=2, seed=1).fit(pontos)\ntamanhos = sorted(grupos.summary.clusterSizes)\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.clustering import KMeans

      cidades = spark.read.csv("municipios.csv", header=True, inferSchema=True)
      pontos = VectorAssembler(inputCols=["chuva_anual", "temperatura"], outputCol="features").transform(cidades)
      grupos = KMeans(k=3, seed=1).fit(pontos)
      tamanhos = sorted(grupos.summary.clusterSizes)
      print(tamanhos)
      grupos.transform(pontos).select("municipio", "prediction").show()
    `,
    regras: [{ modelo: 'grupos', tipo: 'KMeansModel', k: 3 }, { variavel: 'tamanhos', igual: [3, 3, 3] }],
    regrasOcultas: [{ modelo: 'grupos', tipo: 'KMeansModel', k: 3 }, { variavel: 'tamanhos', igual: [2, 3, 4] }],
  }),
  exercicioAlem({
    id: 'ml-pipeline',
    titulo: 'O pipeline completo',
    dificuldade: 'dificil',
    enunciado: '<p>As <code>etapas</code> estão prontas: índice da cultura, one-hot, vetor de features (com a cultura) e a regressão. Treine em <code>modelo</code> um <code>Pipeline</code> com elas, usando a safra de treino. O RMSE nos dados de teste deve ficar abaixo de 0,001.</p>',
    dica: 'modelo = Pipeline(stages=etapas).fit(treino)',
    ...dados,
    inicial: `${PIPELINE}${TREINO}modelo = Pipeline(stages=etapas)\n`,
    solucao: bloco`
      ${PIPELINE}
      ${TREINO}
      modelo = Pipeline(stages=etapas).fit(treino)
      modelo.transform(treino).select("municipio", "producao_t", "prediction").show()
    `,
    ...nosDois(() => ({ modelo: 'modelo', tipo: 'PipelineModel', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv' } })),
  }),
  exercicioAlem({
    id: 'ml-comparar',
    titulo: 'Qual modelo é melhor',
    dificuldade: 'dificil',
    enunciado: '<p>Treine duas regressões da produção: uma só com a chuva, outra com chuva, área e irrigação. Calcule o RMSE de cada uma nos dados de teste, guarde em <code>melhor</code> o modelo de menor erro e em <code>venceu</code> o nome dele: <code>"simples"</code> ou <code>"completo"</code>.</p>',
    dica: 'Um VectorAssembler para cada modelo; avalie cada um com os dados de teste montados pelo seu VectorAssembler.',
    ...dados,
    inicial: `${FEATURES}from pyspark.ml.regression import LinearRegression\n${TREINO}${TESTE}simples = VectorAssembler(inputCols=["chuva_mm"], outputCol="features")\nmelhor = LinearRegression(labelCol="producao_t").fit(simples.transform(treino))\nvenceu = "simples"\n`,
    solucao: bloco`
      ${FEATURES}from pyspark.ml.regression import LinearRegression
      from pyspark.ml.evaluation import RegressionEvaluator

      ${TREINO}${TESTE}
      simples = VectorAssembler(inputCols=["chuva_mm"], outputCol="features")
      completo = VectorAssembler(inputCols=["chuva_mm", "area_ha", "irrigado"], outputCol="features")
      avaliador = RegressionEvaluator(labelCol="producao_t", metricName="rmse")
      m1 = LinearRegression(labelCol="producao_t").fit(simples.transform(treino))
      m2 = LinearRegression(labelCol="producao_t").fit(completo.transform(treino))
      rmse_simples = avaliador.evaluate(m1.transform(simples.transform(teste)))
      rmse_completo = avaliador.evaluate(m2.transform(completo.transform(teste)))
      melhor, venceu = (m2, "completo") if rmse_completo < rmse_simples else (m1, "simples")
      print(venceu, round(rmse_simples, 3), round(rmse_completo, 3))
    `,
    ...nosDois((i) => ({ modelo: 'melhor', coeficientes: COEF[i], intercepto: INTERCEPTO[i] })),
  }),
  exercicioAlem({
    id: 'ml-novos',
    titulo: 'A previsão para a próxima safra',
    dificuldade: 'dificil',
    enunciado: '<p>Treine o pipeline com as <code>etapas</code> e use-o nos municípios de <code>safra-teste.csv</code> <b>sem</b> as colunas <code>producao_t</code> e <code>risco</code> (como dados novos, que ainda não têm a resposta). Guarde em <code>previsoes</code> o <code>municipio</code> e a <code>producao_prevista</code> (a previsão com 1 casa decimal).</p>',
    dica: 'novos = teste.drop("producao_t", "risco"); modelo.transform(novos).select("municipio", F.round("prediction", 1).alias("producao_prevista"))',
    ...dados,
    inicial: `${PIPELINE}${TREINO}${TESTE}novos = teste.drop("producao_t", "risco")\nprevisoes = novos.select("municipio")\nprevisoes.show()\n`,
    solucao: bloco`
      ${PIPELINE}
      ${TREINO}${TESTE}
      modelo = Pipeline(stages=etapas).fit(treino)
      novos = teste.drop("producao_t", "risco")
      previsoes = modelo.transform(novos).select("municipio", F.round("prediction", 1).alias("producao_prevista"))
      previsoes.show()
    `,
    regras: [{ modelo: 'modelo', tipo: 'PipelineModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'producao_prevista'], aprox: 1e-9,
      linhas: [['Ouricuri', 10.2], ['Salgueiro', 16.5], ['Petrolina', 19.3], ['Tauá', 8.6], ['Crato', 19.5], ['Sobral', 12]] }],
    regrasOcultas: [{ modelo: 'modelo', tipo: 'PipelineModel' }, { dataframe: 'previsoes', colunas: ['municipio', 'producao_prevista'], aprox: 1e-9,
      linhas: [['Arcoverde', 9.6], ['Petrolina', 15.2], ['Barbalha', 21], ['Tauá', 9.4], ['Sobral', 14.4]] }],
  }),
];
