"""PySpark do DivergePython: uma implementação para aprender, em Python puro, com a API do
PySpark 4 — não é o Spark. As partições rodam de verdade em paralelo nos workers do navegador
(veja _motor.py); o show(), o schema, o explain() e os erros seguem o formato do Spark, e os
testes de conformidade comparam com o PySpark real."""
from .context import SparkConf, SparkContext
from .rdd import RDD
from .storagelevel import StorageLevel

__version__ = '4.0.1'

__all__ = ['SparkConf', 'SparkContext', 'RDD', 'StorageLevel', '__version__']
