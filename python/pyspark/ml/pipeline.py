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
