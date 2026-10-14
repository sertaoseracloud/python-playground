"""Leitura e escrita: CSV com e sem inferência, schema DDL, JSON e gravar/ler de volta."""
import os

from pyspark.sql import functions as F

from _comum import sessao, tmp

spark = sessao()
pasta = tmp()

csv = os.path.join(pasta, 'vendas.csv')
with open(csv, 'w', encoding='utf-8') as f:
    f.write('data,produto,quantidade,preco,ativo\n2026-01-05,Arroz,2,24.90,true\n2026-02-10,"Café, torrado",,19.90,false\n'
            '2026-02-11,Rapadura,10,2.50,true\n')

com = spark.read.csv(csv, header=True, inferSchema=True)
print(com.dtypes)
com.printSchema()
com.show()
sem = spark.read.option('header', True).csv(csv)
print(sem.dtypes)
print(spark.read.csv(csv).columns, spark.read.csv(csv).count())
ddl = spark.read.schema('data DATE, produto STRING, quantidade INT, preco DOUBLE, ativo BOOLEAN').csv(csv, header=True)
print(ddl.dtypes)
ddl.show()
print(spark.read.format('csv').option('header', 'true').load(csv).count(), com.rdd.getNumPartitions())

js = os.path.join(pasta, 'notas.json')
with open(js, 'w', encoding='utf-8') as f:
    f.write('{"nome": "Ana", "nota": 9.5, "turma": 1, "tags": ["a"]}\n{"turma": 2, "nome": "Bia", "nota": 7}\n{"nome": "Caio"}\n')
notas = spark.read.json(js)
print(notas.dtypes)
notas.printSchema()
notas.orderBy('nome').show()

saida = os.path.join(pasta, 'saida')
com.filter(F.col('ativo')).coalesce(1).write.mode('overwrite').csv(saida, header=True)
print('_SUCCESS' in os.listdir(saida), len([n for n in os.listdir(saida) if n.startswith('part-') and n.endswith('.csv')]))
relidas = spark.read.csv(saida, header=True, inferSchema=True)
print(relidas.count(), relidas.dtypes)
relidas.orderBy('produto').show()

com.select('produto', 'quantidade').write.mode('overwrite').json(os.path.join(pasta, 'j'))
print(spark.read.json(os.path.join(pasta, 'j')).orderBy('produto').collect())

spark.stop()
