"""Structured Streaming com o tempo do evento: janelas, marca d'água, append, update e dropDuplicates."""
import os
import sys

from _comum import sessao, tmp
from pyspark.sql import functions as F

sys.stdout.reconfigure(line_buffering=True)  # o console do streaming (no Spark real, a JVM) sai na ordem dos print
spark = sessao()
pasta = os.path.join(tmp(), 'leituras')
os.makedirs(pasta)
LOTES = {
    'lote-01.csv': ['Crato,2026-01-01 00:01:00,31.5', 'Sobral,2026-01-01 00:04:00,29.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-02.csv': ['Petrolina,2026-01-01 00:25:00,35.0', 'Crato,2026-01-01 00:03:00,30.0', 'Crato,2026-01-01 00:12:00,33.0'],
    'lote-03.csv': ['Sobral,2026-01-01 00:41:00,28.0', 'Crato,2026-01-01 00:05:00,32.0'],
}
for nome, linhas in LOTES.items():
    with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
        f.write('estacao,momento,temperatura\n' + ''.join(x + '\n' for x in linhas))
# O Spark lê pela data de modificação: a ordem 3, 1, 2 faz o lote 2 chegar todo atrasado.
for i, nome in enumerate(('lote-03.csv', 'lote-01.csv', 'lote-02.csv')):
    os.utime(os.path.join(pasta, nome), (1_700_000_000 + i, 1_700_000_000 + i))
SCHEMA = 'estacao STRING, momento TIMESTAMP, temperatura DOUBLE'


def leituras():
    return spark.readStream.schema(SCHEMA).option('maxFilesPerTrigger', 1).csv(pasta, header=True)


def marcadas():
    return leituras().withWatermark('momento', '10 minutes')


def por_janela():
    return marcadas().groupBy(F.window('momento', '10 minutes')).count()


def rodar(df, nome, modo, formato='memory'):
    q = df.writeStream.format(formato).queryName(nome).outputMode(modo).trigger(availableNow=True).start()
    q.awaitTermination()
    return q


def janelas(nome):
    return sorted((str(r.window.start), str(r.window.end), r['count']) for r in spark.table(nome).collect())


q = rodar(por_janela(), 'janelas', 'append')
print([p['numInputRows'] for p in q.recentProgress])
print([p['eventTime']['watermark'] for p in q.recentProgress])
print([p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress])
print(janelas('janelas'))

q = rodar(por_janela(), 'janelas_update', 'update')
print([p['stateOperators'][0]['numRowsTotal'] for p in q.recentProgress], janelas('janelas_update'))

q = rodar(marcadas().dropDuplicates(['estacao', 'momento']), 'unicas', 'append')
print([p['stateOperators'][0]['numRowsDroppedByWatermark'] for p in q.recentProgress], len(spark.table('unicas').collect()))

rodar(leituras().groupBy(F.window('momento', '10 minutes', '5 minutes')).count(), 'deslizante', 'complete')
print(janelas('deslizante'))

rodar(por_janela().orderBy('window'), 'console_janelas', 'complete', 'console')
spark.stop()
