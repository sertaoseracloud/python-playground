// 🕵️ Detecção de fraude: as transações viram features (valor, hora, distância), um Pipeline com
// StandardScaler e regressão logística aprende a separar as fraudes, a AUC confere no teste, e uma
// árvore de decisão entra na comparação.
import { py } from '../util.js';
import { criarProjeto } from './base.js';

const csv = (linhas) => `valor,hora,distancia_km,fraude\n${linhas.map((l) => `${l.join(',')}\n`).join('')}`;

const DADOS = {
  'transacoes.csv': csv([
    [45, 10, 2, 0], [120, 14, 5, 0], [80, 9, 1, 0], [60, 19, 8, 0], [200, 12, 3, 0], [35, 16, 4, 0], [150, 11, 6, 0], [90, 20, 10, 0],
    [2500, 3, 450, 1], [1800, 2, 300, 1], [3000, 4, 600, 1], [950, 23, 120, 1], [2200, 1, 800, 1], [1200, 3, 90, 0], [400, 22, 350, 1], [70, 13, 3, 0],
  ]),
  'teste.csv': csv([[55, 15, 3, 0], [130, 10, 7, 0], [2700, 2, 500, 1], [300, 21, 280, 1], [1000, 12, 15, 0], [1600, 4, 200, 1], [40, 8, 1, 0], [800, 23, 60, 0]]),
};
const OCULTO = {
  'transacoes.csv': csv([
    [30, 9, 1, 0], [75, 15, 6, 0], [140, 18, 4, 0], [55, 11, 2, 0], [210, 13, 9, 0], [95, 10, 3, 0],
    [2800, 2, 700, 1], [1500, 3, 250, 1], [700, 1, 400, 1], [2100, 23, 520, 1], [1300, 14, 20, 0], [60, 4, 5, 0],
  ]),
  'teste.csv': csv([[65, 12, 4, 0], [1900, 3, 380, 1], [180, 17, 7, 0], [900, 2, 300, 1], [400, 15, 12, 0], [2500, 1, 650, 1]]),
};

export const projetoFraude = criarProjeto({
  id: 'fraude',
  titulo: 'Detecção de fraude',
  icone: '🕵️',
  descricao: 'Transações de cartão: features, Pipeline com StandardScaler, regressão logística, AUC e árvore de decisão.',
  resumo: `
    <p>O banco marcou, em <code>transacoes.csv</code>, quais compras foram <b>fraude</b> (1) e quais não (0), com o valor,
      a hora e a distância (em km) de onde o cliente costuma comprar. Os dados são inventados. Com eles, o MLlib aprende a
      separar uma da outra; <code>teste.csv</code> tem transações que o modelo nunca viu, para conferir.</p>
    <p>Valor (em reais) e hora (0 a 23) estão em escalas muito diferentes: o <b>StandardScaler</b> põe todas as features na
      mesma régua, e o <b>Pipeline</b> junta as etapas num modelo só.</p>
    <ol>
      <li>o vetor de features;</li>
      <li>o Pipeline com o StandardScaler;</li>
      <li>a regressão logística no Pipeline;</li>
      <li>a AUC nos dados de teste;</li>
      <li>uma árvore de decisão, e qual dos dois é melhor.</li>
    </ol>`,
  dados: DADOS,
  oculto: OCULTO,
  inicial: py`
    from pyspark.ml import Pipeline
    from pyspark.ml.feature import VectorAssembler, StandardScaler
    from pyspark.ml.classification import LogisticRegression, DecisionTreeClassifier
    from pyspark.ml.evaluation import BinaryClassificationEvaluator

    treino = spark.read.csv("transacoes.csv", header=True, inferSchema=True)
    teste = spark.read.csv("teste.csv", header=True, inferSchema=True)
    treino.show()
  `,
  etapas: [
    {
      titulo: 'O vetor de features',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie em <code>montador</code> um <code>VectorAssembler</code> que junta <code>valor</code>, <code>hora</code> e
          <code>distancia_km</code> na coluna <code>brutas</code>, e guarde em <code>com_features</code> o treino
          transformado.</p>`,
      dica: 'VectorAssembler(inputCols=["valor", "hora", "distancia_km"], outputCol="brutas").transform(treino)',
      codigo: py`
        montador = VectorAssembler(inputCols=["valor", "hora", "distancia_km"], outputCol="brutas")
        com_features = montador.transform(treino)
        com_features.show(truncate=False)
      `,
      regras: [{ dataframe: 'com_features', colunas: ['valor', 'hora', 'distancia_km', 'fraude', 'brutas'], total: 16 }],
      regrasOcultas: [{ dataframe: 'com_features', colunas: ['valor', 'hora', 'distancia_km', 'fraude', 'brutas'], total: 12 }],
    },
    {
      titulo: 'O Pipeline com o StandardScaler',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie em <code>escala</code> um <code>StandardScaler</code> de <code>brutas</code> para <code>features</code> e
          treine em <code>preparo</code> um <code>Pipeline</code> com o montador e a escala.</p>`,
      dica: 'escala = StandardScaler(inputCol="brutas", outputCol="features"); preparo = Pipeline(stages=[montador, escala]).fit(treino)',
      codigo: py`
        escala = StandardScaler(inputCol="brutas", outputCol="features")
        preparo = Pipeline(stages=[montador, escala]).fit(treino)
        preparo.transform(treino).select("brutas", "features").show(3, truncate=False)
      `,
      regras: [{ modelo: 'preparo', tipo: 'StandardScalerModel' }],
      regrasOcultas: [{ modelo: 'preparo', tipo: 'StandardScalerModel' }],
    },
    {
      titulo: 'A regressão logística',
      dificuldade: 'medio',
      enunciado: `
        <p>Treine em <code>modelo</code> um <code>Pipeline</code> com o montador, a escala e uma
          <code>LogisticRegression</code> que prevê a coluna <code>fraude</code>.</p>`,
      dica: 'Pipeline(stages=[montador, escala, LogisticRegression(labelCol="fraude")]).fit(treino)',
      codigo: py`
        modelo = Pipeline(stages=[montador, escala, LogisticRegression(labelCol="fraude")]).fit(treino)
        modelo.transform(teste).select("valor", "hora", "distancia_km", "fraude", "prediction").show()
      `,
      regras: [{ modelo: 'modelo', tipo: 'LogisticRegressionModel' }],
      regrasOcultas: [{ modelo: 'modelo', tipo: 'LogisticRegressionModel' }],
    },
    {
      titulo: 'A AUC no teste',
      dificuldade: 'dificil',
      enunciado: `
        <p>Calcule em <code>auc</code> a área sob a curva ROC do <code>modelo</code> nos dados de teste. Ela precisa ser de
          pelo menos 0,9: o modelo separa bem as fraudes de transações que nunca viu.</p>`,
      dica: 'avaliador = BinaryClassificationEvaluator(labelCol="fraude"); auc = avaliador.evaluate(modelo.transform(teste))',
      codigo: py`
        avaliador = BinaryClassificationEvaluator(labelCol="fraude")
        auc = avaliador.evaluate(modelo.transform(teste))
        print("AUC da regressão logística:", round(auc, 3))
      `,
      regras: [{ modelo: 'modelo', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } }, { variavel: 'auc', igual: 1.0 }],
      regrasOcultas: [{ modelo: 'modelo', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } }, { variavel: 'auc', igual: 1.0 }],
    },
    {
      titulo: 'A árvore de decisão',
      dificuldade: 'dificil',
      enunciado: `
        <p>Treine em <code>arvore</code> um <code>Pipeline</code> com o montador e uma <code>DecisionTreeClassifier</code>
          de profundidade máxima 2 (a árvore não precisa de escala), calcule em <code>auc_arvore</code> a AUC dela no teste e
          guarde em <code>melhor</code> o texto <code>"logística"</code> ou <code>"árvore"</code>, o de maior AUC (no empate,
          a logística).</p>`,
      dica: 'Pipeline(stages=[montador, DecisionTreeClassifier(labelCol="fraude", featuresCol="brutas", maxDepth=2)]).fit(treino); melhor = "logística" if auc >= auc_arvore else "árvore".',
      codigo: py`
        arvore = Pipeline(stages=[montador, DecisionTreeClassifier(labelCol="fraude", featuresCol="brutas", maxDepth=2)]).fit(treino)
        auc_arvore = avaliador.evaluate(arvore.transform(teste))
        melhor = "logística" if auc >= auc_arvore else "árvore"
        print("AUC da árvore:", round(auc_arvore, 3), "· melhor:", melhor)
      `,
      regras: [
        { modelo: 'arvore', tipo: 'DecisionTreeClassificationModel', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } },
        { variavel: 'melhor', igual: 'logística' },
      ],
      regrasOcultas: [
        { modelo: 'arvore', tipo: 'DecisionTreeClassificationModel', metrica: { nome: 'areaUnderROC', min: 0.9, dados: 'teste.csv' } },
        { variavel: 'melhor', igual: 'logística' },
      ],
    },
  ],
});
