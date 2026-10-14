"""Transformações largas do DataFrame: estágios, shuffles, broadcast, janelas e cache."""
import pytest

from _comum import operadores
from diverge_runtime import estagios
from pyspark.errors import AnalysisException
from pyspark.sql import Row, SparkSession, Window
from pyspark.sql import functions as F

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]


@pytest.fixture
def spark():
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def vendas(spark):
    return spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco'])


def tuplas(df):
    return [tuple(r) for r in df.collect()]


def test_group_by_e_agg(spark):
    r = (vendas(spark).groupBy('regiao')
         .agg(F.sum('quantidade'), F.round(F.avg('preco'), 2).alias('preco_medio'), F.count('*'), F.countDistinct('produto'))
         .orderBy('regiao'))
    assert r.columns == ['regiao', 'sum(quantidade)', 'preco_medio', 'count(1)', 'count(DISTINCT produto)']
    assert tuplas(r) == [('Nordeste', 3, 22.4, 2, 2), ('Norte', 10, 2.5, 1, 1), ('Sudeste', 3, 8.5, 1, 1)]
    assert r.dtypes[1] == ('sum(quantidade)', 'bigint') and r.dtypes[3] == ('count(1)', 'bigint')
    assert vendas(spark).groupBy('regiao').count().orderBy(F.desc('count'), 'regiao').first() == Row(regiao='Nordeste', count=2)
    assert vendas(spark).agg(F.max('preco').alias('m')).first().m == 24.9
    assert vendas(spark).groupBy('regiao').agg({'preco': 'max'}).columns == ['regiao', 'max(preco)']
    # com um dicionário, o Spark devolve as agregações em ordem de nome da coluna
    assert vendas(spark).groupBy('produto').agg({'quantidade': 'sum', 'preco': 'max'}).columns == ['produto', 'max(preco)', 'sum(quantidade)']
    listas = vendas(spark).groupBy('regiao').agg(F.sort_array(F.collect_list('produto')).alias('p')).orderBy('regiao')
    assert tuplas(listas)[0] == ('Nordeste', ['Arroz', 'Café'])


def test_pivot(spark):
    df = spark.createDataFrame([('caju', 'jan', 3), ('caju', 'fev', 1), ('umbu', 'jan', 2)], ['fruta', 'mes', 'qtd'])
    p = df.groupBy('fruta').pivot('mes').sum('qtd').orderBy('fruta')
    assert p.columns == ['fruta', 'fev', 'jan']
    assert tuplas(p) == [('caju', 1, 3), ('umbu', None, 2)]
    assert df.groupBy('fruta').pivot('mes', ['jan']).agg(F.sum('qtd')).orderBy('fruta').columns == ['fruta', 'jan']


def test_ordenacao_com_nulos(spark):
    df = spark.createDataFrame([(1, None), (2, 5), (3, 1)], 'id bigint, v bigint')
    assert [r.id for r in df.orderBy('v').collect()] == [1, 3, 2]
    assert [r.id for r in df.orderBy(F.desc('v')).collect()] == [2, 3, 1]
    assert [r.id for r in df.orderBy(['v', 'id'], ascending=[False, True]).collect()] == [2, 3, 1]


def test_joins(spark):
    cli = spark.createDataFrame([(1, 'Ana'), (2, 'Bia'), (3, 'Caio')], ['id', 'nome'])
    ped = spark.createDataFrame([(1, 50.0), (1, 20.0), (3, 10.0), (4, 5.0)], ['id', 'valor'])

    def linhas(df):
        return sorted(tuplas(df), key=str)

    assert linhas(cli.join(ped, 'id')) == [(1, 'Ana', 20.0), (1, 'Ana', 50.0), (3, 'Caio', 10.0)]
    assert (2, 'Bia', None) in linhas(cli.join(ped, 'id', 'left'))
    assert (4, None, 5.0) in linhas(cli.join(ped, ['id'], 'right'))
    assert len(linhas(cli.join(ped, 'id', 'full'))) == 5
    assert linhas(cli.join(ped, 'id', 'left_semi')) == [(1, 'Ana'), (3, 'Caio')]
    assert linhas(cli.join(ped, 'id', 'left_anti')) == [(2, 'Bia')]
    e = cli.join(ped, cli.id == ped.id)
    assert e.columns == ['id', 'nome', 'id', 'valor']
    assert linhas(e.select(cli.nome, ped.valor)) == [('Ana', 20.0), ('Ana', 50.0), ('Caio', 10.0)]
    with pytest.raises(AnalysisException) as erro:
        e.select('id')
    assert erro.value.getErrorClass() == 'AMBIGUOUS_REFERENCE'


def test_plano_broadcast_e_sort_merge(spark):
    cli = spark.createDataFrame([(1, 'Ana')], ['id', 'nome'])
    ped = spark.createDataFrame([(1, 5.0)], ['id', 'valor'])
    j = cli.join(ped, 'id')
    assert j._plano_resumo() == {'shuffles': 2, 'broadcast': False, 'cache': False, 'particoes': 4, 'estagios': 3}
    assert operadores(_explain(j)) == ['SortMergeJoin', 'Sort', 'Exchange hashpartitioning', 'Sort', 'Exchange hashpartitioning']
    b = cli.join(F.broadcast(ped), 'id')
    assert b._plano_resumo() == {'shuffles': 0, 'broadcast': True, 'cache': False, 'particoes': 4, 'estagios': 1}
    assert operadores(_explain(b)) == ['BroadcastHashJoin', 'BroadcastExchange']
    pequeno = spark.range(3)
    assert spark.range(10).join(pequeno, 'id')._plano_resumo()['broadcast'] is True
    spark.conf.set('spark.sql.autoBroadcastJoinThreshold', '-1')
    assert spark.range(10).join(pequeno, 'id')._plano_resumo()['broadcast'] is False
    assert sorted(r.id for r in b.collect()) == [1]


def _explain(df):
    import contextlib
    import io
    saida = io.StringIO()
    with contextlib.redirect_stdout(saida):
        df.explain()
    return saida.getvalue()


def test_explain_e_estagios_do_group_by(spark):
    df = vendas(spark).groupBy('regiao').sum('quantidade')
    texto = _explain(df)
    assert texto.startswith('== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- HashAggregate(keys=[regiao#')
    assert operadores(texto) == ['HashAggregate', 'Exchange hashpartitioning', 'HashAggregate']
    assert 'functions=[partial_sum(quantidade#' in texto
    assert operadores(_explain(vendas(spark).orderBy(F.desc('preco')))) == ['Sort', 'Exchange rangepartitioning']
    assert operadores(_explain(vendas(spark).repartition(3))) == ['Exchange RoundRobinPartitioning']
    spark.conf.set('spark.sql.adaptive.enabled', 'false')
    assert 'AdaptiveSparkPlan' not in _explain(df)
    estagios.zerar()
    spark = SparkSession.builder.getOrCreate()
    vendas(spark).groupBy('regiao').count().show()
    job = estagios.resumo()['jobs'][-1]
    assert job['acao'] == 'show'
    assert [e['tipo'] for e in job['estagios']] == ['shuffle', 'resultado']
    assert [len(e['tarefas']) for e in job['estagios']] == [4, 4]


def test_resumo_do_plano(spark):
    df = vendas(spark)
    assert df._plano_resumo() == {'shuffles': 0, 'broadcast': False, 'cache': False, 'particoes': 4, 'estagios': 1}
    assert df.groupBy('regiao').count().orderBy('count')._plano_resumo()['shuffles'] == 2
    assert df.repartition(3)._plano_resumo()['particoes'] == 3
    assert df.repartition(2, 'regiao').rdd.getNumPartitions() == 2
    assert df.coalesce(1)._plano_resumo() == {'shuffles': 0, 'broadcast': False, 'cache': False, 'particoes': 1, 'estagios': 1}
    spark.conf.set('spark.sql.shuffle.partitions', '8')
    assert df.groupBy('regiao').count()._plano_resumo()['particoes'] == 8
    assert df.distinct()._plano_resumo()['shuffles'] == 1


def test_cache(spark):
    c = vendas(spark).groupBy('regiao').count().cache()
    assert c.is_cached
    assert c.count() == 3
    assert c._plano_resumo()['cache'] is True
    assert c.orderBy('regiao')._plano_resumo()['shuffles'] == 1  # o shuffle do groupBy já está guardado
    assert 'InMemoryTableScan' in operadores(_explain(c))
    c.unpersist()
    assert not c.is_cached


def test_janelas(spark):
    df = spark.createDataFrame([('NE', 'a', 10), ('NE', 'b', 30), ('NE', 'c', 20), ('S', 'd', 5)], ['regiao', 'loja', 'receita'])
    w = Window.partitionBy('regiao').orderBy(F.desc('receita'))
    r = df.select('loja', F.row_number().over(w).alias('rn'), F.rank().over(w).alias('rk'),
                  F.dense_rank().over(w).alias('dr'), F.lag('receita').over(w).alias('ant')).orderBy('loja')
    assert tuplas(r) == [('a', 3, 3, 3, 20), ('b', 1, 1, 1, None), ('c', 2, 2, 2, 30), ('d', 1, 1, 1, None)]
    assert operadores(_explain(r))[:3] == ['Sort', 'Exchange rangepartitioning', 'Window']
    d = spark.createDataFrame([(1, 10), (2, 20), (3, 30), (4, 40)], ['dia', 'v'])
    w2 = Window.orderBy('dia')
    r2 = d.select('dia',
                  F.sum('v').over(w2.rowsBetween(Window.unboundedPreceding, Window.currentRow)).alias('acum'),
                  F.avg('v').over(w2.rowsBetween(-1, 0)).alias('media'),
                  F.lead('v', 1, 0).over(w2).alias('prox'))
    assert tuplas(r2.orderBy('dia')) == [(1, 10, 10.0, 20), (2, 30, 15.0, 30), (3, 60, 25.0, 40), (4, 100, 35.0, 0)]
    empates = spark.createDataFrame([(1, 1), (1, 2), (2, 3)], ['k', 'v'])
    assert [r.s for r in empates.select(F.sum('v').over(Window.orderBy('k')).alias('s')).collect()] == [3, 3, 6]
    total = df.withColumn('total_regiao', F.sum('receita').over(Window.partitionBy('regiao'))).orderBy('loja')
    assert [r.total_regiao for r in total.collect()] == [60, 60, 60, 5]
    with pytest.raises(AnalysisException):
        df.select(F.row_number().over(Window.partitionBy('regiao')))  # row_number precisa de orderBy


def test_union_distinct_e_duplicados(spark):
    a = spark.createDataFrame([(1, 'x')], ['id', 'v'])
    b = spark.createDataFrame([('y', 2)], ['v', 'id'])
    assert tuplas(a.unionByName(b)) == [(1, 'x'), (2, 'y')]
    assert a.union(a).distinct().count() == 1
    assert vendas(spark).dropDuplicates(['regiao']).count() == 3
    c = spark.createDataFrame([(3,)], ['id'])
    assert tuplas(a.unionByName(c, allowMissingColumns=True)) == [(1, 'x'), (3, None)]
    assert a.union(b).rdd.getNumPartitions() == 8


def test_tabela_para_a_correcao(spark):
    t = vendas(spark).groupBy('regiao').count()._diverge_tabela(1000)
    assert t['colunas'] == [{'nome': 'regiao', 'tipo': 'string'}, {'nome': 'count', 'tipo': 'bigint'}]
    assert sorted(t['linhas']) == [['Nordeste', 2], ['Norte', 1], ['Sudeste', 1]]
    assert (t['total'], t['ordenado'], t['plano']['shuffles']) == (3, False, 1)
    assert vendas(spark).orderBy('produto').select('produto')._diverge_tabela(2) == {
        'colunas': [{'nome': 'produto', 'tipo': 'string'}], 'linhas': [['Arroz'], ['Café']], 'total': 4, 'ordenado': True,
        'plano': {'shuffles': 1, 'broadcast': False, 'cache': False, 'particoes': 4, 'estagios': 2}}
    assert estagios.resumo() is None  # calcular para a correção não aparece para o aluno


def test_ordenar_e_filtrar_por_coluna_que_saiu_do_select(spark):
    # Como no Spark: a coluna que falta é procurada no DataFrame de antes do select.
    so_produto = vendas(spark).select('produto')
    assert [r.produto for r in so_produto.orderBy('preco').collect()] == ['Rapadura', 'Feijão', 'Café', 'Arroz']
    assert so_produto.orderBy('preco').columns == ['produto']
    assert so_produto.filter(F.col('preco') > 10).count() == 2
    with pytest.raises(AnalysisException):
        so_produto.orderBy('nao_existe')
