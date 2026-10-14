"""Spark SQL: views, SELECT com WHERE/GROUP BY/HAVING/ORDER BY, JOIN, janelas, CTE e nomes das colunas."""
from _comum import sessao

spark = sessao()

VENDAS = [('Arroz', 'Nordeste', 2, 24.9), ('Feijão', 'Sudeste', 3, 8.5), ('Café', 'Nordeste', 1, 19.9), ('Rapadura', 'Norte', 10, 2.5)]
spark.createDataFrame(VENDAS, ['produto', 'regiao', 'quantidade', 'preco']).createOrReplaceTempView('vendas')
spark.createDataFrame([('Nordeste', 'Recife'), ('Norte', 'Belém')], ['regiao', 'capital']).createOrReplaceTempView('capitais')

spark.sql('SELECT produto, preco FROM vendas WHERE preco > 10 ORDER BY preco DESC').show()
spark.sql('''
    SELECT regiao, ROUND(SUM(quantidade * preco), 2) AS receita, COUNT(*) AS n
    FROM vendas WHERE preco > 2
    GROUP BY regiao HAVING COUNT(*) >= 1
    ORDER BY receita DESC''').show()
spark.sql('SELECT v.produto, c.capital FROM vendas v JOIN capitais c ON v.regiao = c.regiao ORDER BY v.produto').show()
spark.sql('SELECT v.produto, c.capital FROM vendas v LEFT JOIN capitais c ON v.regiao = c.regiao ORDER BY v.produto').show()
spark.sql('SELECT produto, ROW_NUMBER() OVER (PARTITION BY regiao ORDER BY preco DESC) AS pos FROM vendas ORDER BY produto').show()
spark.sql('WITH ne AS (SELECT * FROM vendas WHERE regiao = "Nordeste") SELECT COUNT(*) AS n FROM ne').show()
spark.sql('SELECT DISTINCT regiao FROM vendas ORDER BY regiao').show()
spark.sql("SELECT produto, CASE WHEN preco > 10 THEN 'caro' ELSE 'barato' END AS faixa FROM vendas ORDER BY produto").show()
spark.sql('SELECT regiao, SUM(quantidade) FROM vendas GROUP BY regiao ORDER BY regiao').show()
print(spark.sql('SELECT SUM(quantidade), COUNT(*), AVG(preco), MAX(produto) FROM vendas').columns)
print(spark.sql('SELECT 1 + 1 AS dois, UPPER(produto) FROM vendas LIMIT 1').columns)
print(spark.sql('SELECT produto FROM vendas WHERE regiao IN ("Norte", "Sul") OR quantidade BETWEEN 2 AND 3 ORDER BY produto').collect())
print(spark.sql("SELECT produto FROM vendas WHERE produto LIKE 'Ca%'").collect())
print([t.name for t in spark.catalog.listTables()])
print(spark.table('vendas').count())

spark.stop()
