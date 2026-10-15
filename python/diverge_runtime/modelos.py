"""Os modelos do MLlib nas variáveis do aluno, para a regra `modelo` (src/verificacoes.js).

Cada modelo treinado vira {tipo, coeficientes, intercepto, k, profundidade}, conforme o tipo; um
estimador sem fit vira {tipo, treinado: False}. Um PipelineModel é descrito pelo último estágio que
é modelo (o da previsão). As métricas pedidas pela correção (`avaliacoes`) rodam aqui, depois do
programa, fora da aba ⚡ Execução."""
import sys

from . import estagios

_TIPOS_DE_METRICA = {
    'rmse': 'regressao', 'mse': 'regressao', 'mae': 'regressao', 'r2': 'regressao',
    'areaUnderROC': 'binaria', 'areaUnderPR': 'binaria',
    'accuracy': 'multiclasse', 'f1': 'multiclasse',
    'silhouette': 'agrupamento',
}


def _ultimo(modelo):
    from pyspark.ml.base import Model
    from pyspark.ml.pipeline import PipelineModel
    if isinstance(modelo, PipelineModel):
        treinados = [s for s in modelo.stages if isinstance(s, Model)]
        return treinados[-1] if treinados else modelo
    return modelo


def descrever(modelo):
    alvo = _ultimo(modelo)
    d = {'tipo': type(modelo).__name__}
    if alvo is not modelo:
        d['ultimo'] = type(alvo).__name__
    if hasattr(alvo, 'coefficients'):
        d['coeficientes'] = [float(x) for x in alvo.coefficients.toArray()]
        d['intercepto'] = float(alvo.intercept)
    if hasattr(alvo, 'clusterCenters'):
        d['k'] = len(alvo.clusterCenters())
    if hasattr(alvo, 'depth'):
        d['profundidade'] = int(alvo.depth)
    return d


def _avaliador(alvo, nome):
    from pyspark.ml import evaluation as E
    tipo = _TIPOS_DE_METRICA[nome]
    previsao = alvo.getOrDefault('predictionCol')
    if tipo == 'agrupamento':
        return E.ClusteringEvaluator(featuresCol=alvo.getOrDefault('featuresCol'), predictionCol=previsao)
    rotulo = alvo.getOrDefault('labelCol')
    if tipo == 'regressao':
        return E.RegressionEvaluator(labelCol=rotulo, predictionCol=previsao, metricName=nome)
    if tipo == 'binaria':
        return E.BinaryClassificationEvaluator(labelCol=rotulo, rawPredictionCol=alvo.getOrDefault('rawPredictionCol'), metricName=nome)
    return E.MulticlassClassificationEvaluator(labelCol=rotulo, predictionCol=previsao, metricName=nome)


def avaliar(escopo, pedido):
    """Lê `pedido['dados']` (CSV com cabeçalho), aplica `preparar` (um transformador do aluno), o
    modelo e o avaliador da métrica `pedido['nome']`."""
    from pyspark.sql import SparkSession
    modelo = escopo[pedido['variavel']]
    df = SparkSession.builder.getOrCreate().read.csv(pedido['dados'], header=True, inferSchema=True)
    if pedido.get('preparar'):
        df = escopo[pedido['preparar']].transform(df)
    return float(_avaliador(_ultimo(modelo), pedido['nome']).evaluate(modelo.transform(df)))


def resumo(escopo, avaliacoes=()):
    if 'pyspark.ml.base' not in sys.modules:
        return {}  # o aluno não usou o MLlib: não há modelo nenhum
    from pyspark.ml.base import Estimator, Model
    saida = {}
    for nome, valor in list(escopo.items()):
        if nome.startswith('_'):
            continue
        if isinstance(valor, Model):
            saida[nome] = {**descrever(valor), 'metricas': {}}
        elif isinstance(valor, Estimator):
            saida[nome] = {'tipo': type(valor).__name__, 'treinado': False, 'metricas': {}}
    for pedido in avaliacoes:
        alvo = saida.get(pedido['variavel'])
        if alvo is None or alvo.get('treinado') is False:
            continue
        chave = f"{pedido['nome']}@{pedido['dados']}"
        try:
            with estagios.local():
                alvo['metricas'][chave] = avaliar(escopo, pedido)
        except Exception as e:  # a métrica que falha vira motivo na correção
            alvo['metricas'][chave] = {'erro': {'tipo': type(e).__name__, 'mensagem': str(e)}}
    return saida
