// Os dados do módulo 🌊 seguem as regras que os exercícios usam: a produção é uma fórmula exata,
// os lotes de leituras estão em ordem de nome, e o caso oculto troca todos os arquivos do visível.
import { describe, it, expect } from 'vitest';
import { safra, safraOculto, estacoes, estacoesOculto, coopEstoque, coopEstoqueOculto, coopAssociados, coopAssociadosOculto, municipios, municipiosOculto } from '../src/conteudo/alem-dados.js';
import { exercicioAlem, bloco } from '../src/conteudo/alem-comum.js';

const linhas = (csv) => csv.trim().split('\n').slice(1).map((l) => l.split(','));

describe('dados do módulo além do batch', () => {
  it.each([
    ['visível', safra, (c, a, i) => 3 + 0.01 * c + 2 * a + 1.5 * i],
    ['oculto', safraOculto, (c, a, i) => 1 + 0.02 * c + 1 * a + 3 * i],
  ])('safra %s: producao_t segue a fórmula (a regressão acha os coeficientes exatos)', (_nome, dados, formula) => {
    for (const arquivo of ['safra-treino.csv', 'safra-teste.csv']) {
      for (const [, , chuva, area, irrigado, producao] of linhas(dados[arquivo])) {
        expect(Number(producao)).toBeCloseTo(formula(Number(chuva), Number(area), Number(irrigado)), 9);
      }
    }
  });

  it('as culturas do teste existem no treino (o StringIndexer do pipeline não erra)', () => {
    for (const d of [safra, safraOculto]) {
      const doTreino = new Set(linhas(d['safra-treino.csv']).map((l) => l[1]));
      for (const l of linhas(d['safra-teste.csv'])) expect(doTreino).toContain(l[1]);
    }
  });

  it('o caso oculto troca todos os arquivos do visível (nada do visível sobra)', () => {
    for (const [v, o] of [[safra, safraOculto], [estacoes, estacoesOculto], [coopEstoque, coopEstoqueOculto], [coopAssociados, coopAssociadosOculto], [municipios, municipiosOculto]]) {
      for (const nome of Object.keys(v)) expect(o).toHaveProperty(nome);
    }
  });

  it('os lotes estão em ordem de nome (a ordem em que são gravados e lidos)', () => {
    for (const d of [estacoes, estacoesOculto]) expect(Object.keys(d)).toEqual(Object.keys(d).sort());
    expect(Object.keys(estacoesOculto)).toHaveLength(4);
  });

  it('bloco: tira a indentação do template e mantém os trechos de várias linhas', () => {
    const DOIS = 'a = 1\nb = 2\n';
    expect(bloco`
      ${DOIS}
      if a:
          print(b)
    `).toBe('a = 1\nb = 2\n\nif a:\n    print(b)\n');
  });

  it('exercicioAlem monta o item com caso visível e oculto', () => {
    const p = exercicioAlem({ id: 'x', titulo: 'X', dificuldade: 'facil', enunciado: '<p>x</p>', dica: 'd', inicial: 'a = 1\n', solucao: 'a = 2\n',
      dados: coopEstoque, oculto: coopEstoqueOculto, regras: [{ variavel: 'a', igual: 2 }] });
    expect(p.tipo).toBe('problema');
    expect(p.arquivos['main.py']).toContain('SparkSession');
    expect(p.testes.map((t) => [t.descricao, Boolean(t.oculto)])).toEqual([['estoque.csv', false], ['outros dados', true]]);
    expect(p.testes[1].regras).toEqual([{ variavel: 'a', igual: 2 }]);
  });
});
