"""Ajudantes dos programas de conformidade (rodam no PySpark real e no nosso)."""
import contextlib
import io
import os
import re

# Só os operadores que mudam a forma do plano: Project, Filter e scans variam entre o Spark e o nosso.
OPERADORES = ('HashAggregate', 'SortMergeJoin', 'BroadcastHashJoin', 'BroadcastExchange', 'Sort',
              'Window', 'InMemoryTableScan', 'BatchEvalPython', 'Exchange')


def operadores(texto):
    """Os operadores do explain(), em ordem, com o tipo de particionamento do Exchange."""
    if not isinstance(texto, str):  # um DataFrame
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            texto.explain()
        texto = saida.getvalue()
    achados = []
    for linha in texto.splitlines():
        m = re.match(r'^[\s:+\-|]*(?:\*\(\d+\)\s*)?([A-Za-z]+)(?:\s+(\w+))?', linha)
        if not m or m.group(1) not in OPERADORES:
            continue
        nome = m.group(1)
        if nome == 'Exchange':
            nome += ' ' + (m.group(2) or '')
        achados.append(nome.strip())
    return achados


def tmp():
    """Pasta temporária do programa (o executor cria uma para cada um)."""
    pasta = os.environ.get('CONFORMIDADE_TMP') or os.path.join(os.getcwd(), '_tmp')
    os.makedirs(pasta, exist_ok=True)
    return pasta


def primeira_linha(erro):
    """A primeira linha da mensagem, sem os caminhos desta máquina."""
    texto = str(erro).splitlines()[0]
    for caminho, troca in ((tmp(), '<tmp>'), (os.getcwd(), '<cwd>')):
        for variante in {caminho, caminho.replace('\\', '/'), os.path.realpath(caminho), os.path.realpath(caminho).replace('\\', '/')}:
            texto = texto.replace(variante, troca)
    texto = re.sub(r'file:/+(?=<)', 'file:', texto)
    return re.sub(r'(<tmp>|<cwd>)[^ ]*', lambda m: m.group().replace(chr(92), '/'), texto)  # chr(92) é a barra invertida


def sessao():
    from pyspark.sql import SparkSession
    spark = (SparkSession.builder.master('local[4]').appName('conformidade')
             .config('spark.sql.shuffle.partitions', '4')
             .config('spark.default.parallelism', '4')
             .config('spark.sql.adaptive.enabled', 'false')
             .config('spark.sql.session.timeZone', 'UTC')
             .config('spark.ui.enabled', 'false')
             .getOrCreate())
    spark.sparkContext.setLogLevel('ERROR')
    return spark


def erro(funcao):
    """Roda e mostra o tipo e a primeira linha do erro (o programa continua)."""
    try:
        funcao()
    except Exception as e:  # noqa: BLE001 — é o que o programa quer mostrar
        print(type(e).__name__, '|', primeira_linha(e))
    else:
        print('sem erro')


def sessao_delta():
    """Sessão com o Delta: no PySpark real, as extensões e os jars do delta-spark; aqui, a mesma sessão."""
    from delta import configure_spark_with_delta_pip
    from pyspark.sql import SparkSession
    construtor = (SparkSession.builder.master('local[4]').appName('conformidade')
                  .config('spark.sql.extensions', 'io.delta.sql.DeltaSparkSessionExtension')
                  .config('spark.sql.catalog.spark_catalog', 'org.apache.spark.sql.delta.catalog.DeltaCatalog')
                  .config('spark.sql.shuffle.partitions', '4')
                  .config('spark.default.parallelism', '4')
                  .config('spark.sql.adaptive.enabled', 'false')
                  .config('spark.sql.session.timeZone', 'UTC')
                  .config('spark.ui.enabled', 'false'))
    spark = configure_spark_with_delta_pip(construtor).getOrCreate()
    spark.sparkContext.setLogLevel('ERROR')
    return spark
