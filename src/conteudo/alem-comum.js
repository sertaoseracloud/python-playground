// Auxiliares do módulo 🌊 Spark além do batch (alem-delta.js, alem-streaming.js e alem-mllib.js).
import { programa } from './pyspark-comum.js';

/**
 * Template para código Python, como o `py` de util.js, mas a indentação comum sai só do texto do
 * template: um trecho interpolado com várias linhas sem indentação (${ESTOQUE}${ENTRADA}) entra como está.
 */
export function bloco(partes, ...valores) {
  const texto = partes.join('').replace(/^\n/, '');
  const margem = Math.min(...texto.split('\n').filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  let i = 0;
  return texto.split('\n').map((l) => l.slice(margem)).join('\n').replace(/\s*$/, '\n').replace(//g, () => valores[i++] ?? '');
}

/** A linha que lê um CSV com cabeçalho e tipos. */
export const LER = (arquivo, variavel) => `${variavel} = spark.read.csv("${arquivo}", header=True, inferSchema=True)\n`;

/**
 * Um exercício do módulo: o programa começa pela SparkSession; o caso visível usa `dados`, e o
 * oculto, `oculto` (outros dados, com os mesmos nomes de arquivo) com `regrasOcultas`.
 */
export function exercicioAlem({ id, titulo, dificuldade, enunciado, dica, inicial, solucao, dados, oculto, regras, regrasOcultas = regras }) {
  return {
    id,
    tipo: 'problema',
    titulo,
    dificuldade,
    enunciado,
    dica,
    arquivos: programa(id, inicial),
    solucao: programa(id, solucao),
    ...(dados ? { dados } : {}),
    testes: [
      { descricao: dados ? Object.keys(dados)[0] : 'execução', regras },
      { descricao: 'outros dados', oculto: true, ...(oculto ? { dados: oculto } : {}), regras: regrasOcultas },
    ],
  };
}
