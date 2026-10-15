"""Structured Streaming: fontes, modos de saída, estado simples, memory e console."""
import os
import sys

from _comum import erro, sessao, tmp
from pyspark.sql import functions as F

sys.stdout.reconfigure(line_buffering=True)  # o console do streaming (no Spark real, a JVM) sai na ordem dos print
spark = sessao()
pasta = os.path.join(tmp(), 'leituras')
os.makedirs(pasta)
LOTES = {
    'lote-01.csv': ['Crato,2026-01-01 00:01:00,31.5', 'Sobral,2026-01-01 00:04:00,29.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-02.csv': ['Petrolina,2026-01-01 00:25:00,35.0', 'Crato,2026-01-01 00:03:00,30.0'],
    'lote-03.csv': ['Sobral,2026-01-01 00:41:00,28.0', 'Crato,2026-01-01 00:05:00,32.0'],
}
for nome, linhas in LOTES.items():
    with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
        f.write('estacao,momento,temperatura\n' + ''.join(x + '\n' for x in linhas))
SCHEMA = 'estacao STRING, momento TIMESTAMP, temperatura DOUBLE'


def leituras():
    return spark.readStream.schema(SCHEMA).option('maxFilesPerTrigger', 1).csv(pasta, header=True)


def rodar(df, nome, modo, formato='memory'):
    q = df.writeStream.format(formato).queryName(nome).outputMode(modo).trigger(availableNow=True).start()
    q.awaitTermination()
    return q


def tabela(nome):
    return sorted((tuple(r) for r in spark.table(nome).collect()), key=str)


def recusa(df, modo):
    try:
        df.writeStream.format('memory').queryName('recusada').outputMode(modo).start()
    except Exception as e:  # noqa: BLE001
        print(modo, type(e).__name__, 'output mode not supported' in str(e))


erro(lambda: spark.readStream.csv(pasta, header=True))
erro(lambda: spark.range(1).writeStream)
print(leituras().isStreaming, spark.read.schema(SCHEMA).csv(pasta, header=True).isStreaming)
try:
    leituras().count()
except Exception as e:  # noqa: BLE001
    print(type(e).__name__, 'writeStream.start()' in str(e))
recusa(leituras(), 'complete')
recusa(leituras().groupBy('estacao').count(), 'append')

q = rodar(leituras().filter(F.col('temperatura') > 30).select('estacao', 'temperatura'), 'quentes', 'append')
print(q.isActive, [p['numInputRows'] for p in q.recentProgress])
print(tabela('quentes'))

q = rodar(leituras().groupBy('estacao').count(), 'contagem', 'complete')
print([p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress], tabela('contagem'))

rodar(leituras().groupBy('estacao').agg(F.max('temperatura').alias('maxima')), 'maximas', 'update')
print(tabela('maximas'))

rodar(leituras().groupBy('estacao').count().orderBy('estacao'), 'console_contagem', 'complete', 'console')
spark.stop()
