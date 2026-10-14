"""Funções de coluna: condicionais, texto, datas, números e nulos."""
from pyspark.sql import functions as F

from _comum import erro, sessao

spark = sessao()

pessoas = spark.createDataFrame(
    [('  ana maria ', 17, '2026-03-05', 'Recife', 7.25), ('BIA', 30, '2025-12-31', None, None), ('caio', 65, '2000-01-15', 'natal', 8.5)],
    'nome string, idade bigint, nascimento string, cidade string, nota double')

pessoas.select(
    F.initcap(F.trim('nome')).alias('nome'),
    F.when(F.col('idade') < 18, 'jovem').when(F.col('idade') < 60, 'adulto').otherwise('idoso').alias('faixa'),
    F.upper('cidade').alias('cidade'),
    F.length(F.trim('nome')).alias('tam'),
    F.concat_ws('-', F.lower(F.trim('nome')), F.col('idade')).alias('chave'),
).orderBy('idade').show()

pessoas.select(
    F.to_date('nascimento').alias('data'),
    F.year(F.to_date('nascimento')).alias('ano'),
    F.month('nascimento').alias('mes'),
    F.dayofmonth('nascimento').alias('dia'),
    F.datediff(F.to_date(F.lit('2026-03-10')), F.to_date('nascimento')).alias('dias'),
    F.date_add(F.to_date('nascimento'), 10).alias('mais_10'),
    F.date_format(F.to_date('nascimento'), 'dd/MM/yyyy').alias('br'),
).orderBy('data').show()

pessoas.select(
    F.substring('nascimento', 1, 4).alias('ano_txt'),
    F.split('nascimento', '-').alias('partes'),
    F.regexp_replace('nascimento', '-', '/').alias('barras'),
    F.lpad(F.col('idade').cast('string'), 4, '0').alias('pad'),
    F.round('nota', 1).alias('nota1'),
    F.round(F.lit(2.5), 0).alias('meio'),
    F.coalesce('cidade', F.lit('sem cidade')).alias('cidade'),
).orderBy('ano_txt').show(truncate=False)

print(pessoas.select(F.substring('nascimento', 1, 4), F.round('nota', 1), F.coalesce('cidade', F.lit('?')), F.year('nascimento'),
                     F.datediff(F.lit('2026-01-01'), F.col('nascimento')), F.split('nascimento', '-')).columns)

pessoas.na.fill({'cidade': 'Não informada', 'nota': 0.0}).orderBy('idade').show()
print(pessoas.na.drop().count(), pessoas.na.drop(how='all').count(), pessoas.dropna(subset=['cidade']).count())
pessoas.fillna(0).orderBy('idade').select('nome', 'nota').show()
print(pessoas.filter(F.col('nota') > 7.5).count(), pessoas.filter(F.col('cidade').isNull()).count())

erro(lambda: pessoas.select((F.col('idade') / 0).alias('x')).collect())
erro(lambda: pessoas.select(F.col('nome').cast('int')).collect())
print(pessoas.select((F.col('idade') / 4).alias('q')).orderBy('q').collect())

spark.stop()
