// A trilha completa, na ordem das aulas. Os módulos já publicados ficam em `modulos`; os
// próximos módulos aparecem na landing como "em breve" (PROXIMOS_MODULOS).
import { moduloBasico } from './basico.js';
import { moduloDados } from './dados.js';
import { moduloParalelismo } from './paralelismo.js';
import { moduloPyspark } from './pyspark.js';
import { moduloAlem } from './alem.js';
import { moduloProjetos } from './projetos/index.js';

export const modulos = [moduloBasico, moduloDados, moduloParalelismo, moduloPyspark, moduloAlem, moduloProjetos];

/** Módulos das próximas versões (só título e ícone, para a landing e a trilha). */
export const PROXIMOS_MODULOS = [];

export const DIFICULDADES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

/** Playground livre: o código fica salvo no navegador. */
export const LIVRE = {
  id: 'livre',
  tipo: 'livre',
  titulo: 'Playground livre',
  resumo: `
    <p>Escreva o Python que quiser. Use o <b>+</b> para criar arquivos e importá-los com <code>import</code>.</p>
    <p>Se o código usar <code>input()</code>, digite a resposta no próprio terminal e aperte Enter. No terminal também dá para rodar <code>python main.py</code>, abrir o modo interativo com <code>python</code> e ver os comandos com <code>help</code>.</p>
    <p>Na aba <b>📦 Dados</b> há um <code>vendas.csv</code> de exemplo: abra com <code>open("vendas.csv")</code>.</p>
    <p>O PySpark também funciona aqui: <code>from pyspark.sql import SparkSession</code>. Depois de uma ação (<code>show</code>, <code>count</code>), veja a aba <b>⚡ Execução</b>.</p>`,
  arquivos: { 'main.py': 'nome = input("Qual é o seu nome? ")\nprint(f"Olá, {nome}!")\n' },
  dados: {
    'vendas.csv': 'produto,regiao,quantidade,preco\nArroz 5kg,Nordeste,2,24.90\nFeijão 1kg,Sudeste,3,8.50\nCafé 500g,Nordeste,1,19.90\nRapadura,Norte,10,2.50\n',
  },
};

export const itens = modulos.flatMap((m) => m.itens.map((item) => ({ ...item, modulo: m.id })));
export const problemas = itens.filter((i) => i.tipo === 'problema');

const porId = new Map([...itens, LIVRE].map((i) => [i.id, i]));
export const buscarItem = (id) => porId.get(id);

/** Item anterior e próximo na trilha (para os botões ‹ ›). */
export function vizinhos(id) {
  const i = itens.findIndex((item) => item.id === id);
  return { anterior: itens[i - 1], proximo: itens[i + 1] };
}
