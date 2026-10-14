// Auxiliares e dados do módulo ✨ PySpark (pyspark.js e pyspark-avancado.js).
import { main } from './util.js';

/** O começo de todo programa: a SparkSession (e o sc, nos de RDD). */
export const sessao = (app, { rdd = false } = {}) => `from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder.appName("${app}").getOrCreate()
${rdd ? 'sc = spark.sparkContext\n' : ''}`;
export const programa = (app, codigo, opcoes) => main(`${sessao(app, opcoes)}\n${codigo}`);

// ---------- dados (aba 📦 Dados; os casos ocultos trocam por outros, com o mesmo cabeçalho) ----------
export const VENDAS = `data,regiao,produto,quantidade,preco
2026-01-05,Nordeste,Arroz 5kg,2,24.90
2026-01-12,Sudeste,Feijão 1kg,3,8.50
2026-01-20,Nordeste,Café 500g,1,19.90
2026-02-03,Norte,Rapadura,10,2.50
2026-02-14,Sul,Farinha de mandioca,4,6.80
2026-02-21,Nordeste,Queijo coalho,2,32.00
2026-03-02,Sudeste,Arroz 5kg,1,25.50
2026-03-15,Norte,Café 500g,5,18.90
`;
export const VENDAS_OCULTO = `data,regiao,produto,quantidade,preco
2026-04-01,Norte,Queijo coalho,3,30.00
2026-04-09,Nordeste,Rapadura,20,2.20
2026-04-18,Norte,Feijão 1kg,2,9.10
2026-05-02,Sudeste,Café 500g,4,21.00
2026-05-20,Nordeste,Arroz 5kg,1,23.40
2026-06-11,Sudeste,Farinha de mandioca,6,7.50
`;
export const FRASES = `o sertão vai virar mar
o mar vai virar sertão
a chuva chegou no sertão
Sertão é onde o pensamento da gente se forma
`;
export const FRASES_OCULTO = `a seca passou
a chuva voltou
e o rio voltou a correr
`;
export const PESSOAS = `nome,idade,cidade,nota
  Ana,31,Recife,8.5
bia ,15,Fortaleza,
CAIO,8,,7.0
davi,64,São Paulo,9.0
 Edu ,22,Curitiba,6.5
Fia,17,,
`;
export const PESSOAS_OCULTO = `nome,idade,cidade,nota
gil ,45,Salvador,7.5
 HANA,11,Rio de Janeiro,
Ivo,70,,8.0
jade,19,Natal,9.5
`;
export const CONTATOS = `nome,telefone,email
Ana,(81) 99999-0001,ana@exemplo.com
Bia,,bia@exemplo.com
Caio,,
Davi,(85) 98888-0002,
`;
export const CONTATOS_OCULTO = `nome,telefone,email
Edu,,edu@exemplo.com
Fia,(84) 97777-0003,fia@exemplo.com
Gil,,
`;

export const dadosVendas = { 'vendas.csv': VENDAS };
export const ocultoVendas = { 'vendas.csv': VENDAS_OCULTO };
export const dadosPessoas = { 'pessoas.csv': PESSOAS };
export const ocultoPessoas = { 'pessoas.csv': PESSOAS_OCULTO };
export const LER_VENDAS = 'df = spark.read.csv("vendas.csv", header=True, inferSchema=True)\n';
export const LER_PESSOAS = 'df = spark.read.csv("pessoas.csv", header=True, inferSchema=True)\n';

/**
 * Exercício de DataFrame: lê o arquivo; o inicial deixa a variável igual ao DataFrame lido.
 * `esperado`: as linhas do caso visível e as do oculto (com os dados de cada um).
 */
export function exercicioDf({ id, titulo, dificuldade, enunciado, dica, variavel, inicial, solucao, esperado, ler = LER_VENDAS, dados = dadosVendas, oculto = ocultoVendas, regras = {}, extras = [], extrasOcultos = [] }) {
  const regra = (linhas) => ({ dataframe: variavel, ...regras, linhas });
  return {
    id,
    tipo: 'problema',
    titulo,
    dificuldade,
    enunciado,
    dica,
    arquivos: programa(id, `${ler}${inicial ?? `${variavel} = df\n`}${variavel}.show()\n`),
    solucao: programa(id, `${ler}${solucao}${variavel}.show()\n`),
    dados,
    testes: [
      { descricao: Object.keys(dados)[0], regras: [regra(esperado[0]), ...extras] },
      { descricao: 'outros dados', oculto: true, dados: oculto, regras: [regra(esperado[1]), ...extrasOcultos] },
    ],
  };
}
