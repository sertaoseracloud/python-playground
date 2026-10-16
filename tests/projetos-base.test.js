// O modelo dos projetos: cada etapa parte da solução da anterior.
import { describe, it, expect } from 'vitest';
import { criarProjeto } from '../src/conteudo/projetos/base.js';
import { programa } from '../src/conteudo/pyspark-comum.js';

const projeto = () => criarProjeto({
  id: 'teste',
  titulo: 'Teste',
  icone: '🧪',
  descricao: 'Um projeto de teste.',
  resumo: '<p>Resumo.</p>',
  dados: { 'a.csv': 'x\n1\n', 'b.csv': 'y\n2\n' },
  oculto: { 'a.csv': 'x\n9\n' },
  inicial: 'print(1)\n',
  etapas: [
    { titulo: 'Um', dificuldade: 'facil', enunciado: '<p>1</p>', dica: 'd1', codigo: 'a = 1\n', regras: [{ variavel: 'a', igual: 1 }] },
    { titulo: 'Dois', dificuldade: 'medio', enunciado: '<p>2</p>', dica: 'd2', alteracoes: { 'aaa.py': 'X = 2\n' }, regras: [{ variavel: 'b', igual: 2 }], regrasOcultas: [{ variavel: 'b', igual: 3 }] },
    { titulo: 'Três', dificuldade: 'dificil', enunciado: '<p>3</p>', dica: 'd3', alteracoes: { 'aaa.py': null }, codigo: 'c = 3', regras: [{ variavel: 'c', igual: 3 }] },
  ],
});

describe('criarProjeto', () => {
  it('o grupo e a lição de visão geral, com o código inicial e os dados', () => {
    const { grupo, itens } = projeto();
    expect(grupo).toEqual({ id: 'teste', titulo: 'Teste', icone: '🧪', descricao: 'Um projeto de teste.' });
    expect(itens).toHaveLength(4);
    expect(itens[0]).toEqual({
      id: 'teste-visao-geral', tipo: 'licao', grupo: 'teste', titulo: 'Visão geral do projeto', resumo: '<p>Resumo.</p>',
      arquivos: programa('teste', 'print(1)\n'), dados: { 'a.csv': 'x\n1\n', 'b.csv': 'y\n2\n' },
    });
  });

  it('a solução de cada etapa é a anterior com o trecho novo; o código inicial é a solução da anterior', () => {
    const [, um, dois, tres] = projeto().itens;
    expect(um.arquivos).toEqual(programa('teste', 'print(1)\n'));
    expect(um.solucao).toEqual(programa('teste', 'print(1)\n\na = 1\n'));
    expect(dois.arquivos).toEqual(um.solucao);
    expect(Object.keys(dois.solucao)).toEqual(['main.py', 'aaa.py']); // main.py sempre primeiro
    expect(tres.arquivos).toEqual(dois.solucao);
    expect(tres.solucao).toEqual(programa('teste', 'print(1)\n\na = 1\n\nc = 3\n'));
  });

  it('as etapas sabem o projeto, a posição e a anterior', () => {
    const [, um, dois, tres] = projeto().itens;
    expect(um).toMatchObject({ id: 'teste-1', tipo: 'problema', grupo: 'teste', etapa: 1, totalEtapas: 3, etapaAnterior: null, titulo: 'Etapa 1: Um', dificuldade: 'facil' });
    expect(dois).toMatchObject({ id: 'teste-2', etapa: 2, etapaAnterior: 'teste-1', titulo: 'Etapa 2: Dois' });
    expect(tres.etapaAnterior).toBe('teste-2');
    expect(um.projeto).toEqual(projeto().grupo);
    expect(um.dados).toEqual({ 'a.csv': 'x\n1\n', 'b.csv': 'y\n2\n' });
  });

  it('um caso visível com os dados e um oculto com os outros dados', () => {
    const [, um, dois] = projeto().itens;
    expect(um.testes).toEqual([
      { descricao: 'a.csv', regras: [{ variavel: 'a', igual: 1 }] },
      { descricao: 'outros dados', oculto: true, dados: { 'a.csv': 'x\n9\n' }, regras: [{ variavel: 'a', igual: 1 }] },
    ]);
    expect(dois.testes[1].regras).toEqual([{ variavel: 'b', igual: 3 }]);
  });
});
