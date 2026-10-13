// corrigir(): roda cada caso com o runtime de verdade (Pyodide no Node).
import { describe, it, expect, beforeAll } from 'vitest';
import { corrigir } from '../src/corrigir.js';
import { iniciarPython } from './python-node.js';

let executar;
beforeAll(async () => { const { sessao } = await iniciarPython(); executar = (a, o) => sessao.executar(a, o); });

const problema = {
  testes: [
    { descricao: 'Ana', entrada: ['Ana'], regras: [{ saida: 'Olá, Ana!' }] },
    { descricao: 'dobro(3)', regras: [{ funcao: 'dobro', args: [3], igual: 6 }] },
    { descricao: 'oculto', oculto: true, entrada: ['Bia'], regras: [{ saida: 'Olá, Bia!' }, { funcao: 'dobro', args: [-1], igual: -2 }] },
  ],
};
const certo = { 'main.py': 'def dobro(n):\n    return n * 2\nnome = input()\nprint(f"Olá, {nome}!")' };

describe('corrigir', () => {
  it('aprova a solução certa, com os ocultos', async () => {
    const { aprovado, relatorio } = await corrigir(problema, certo, executar);
    expect(aprovado).toBe(true);
    expect(relatorio).toHaveLength(3);
    expect(relatorio[2]).toMatchObject({ oculto: true, cenario: { entrada: ['Bia'], chamadas: ['dobro(-1)'] } });
  });

  it('sem ocultos quando incluirOcultos é false', async () => {
    expect((await corrigir(problema, certo, executar, { incluirOcultos: false })).relatorio).toHaveLength(2);
  });

  it('reprova e mostra o erro de execução', async () => {
    const { aprovado, relatorio } = await corrigir(problema, { 'main.py': 'print(1/0)' }, executar);
    expect(aprovado).toBe(false);
    expect(relatorio[0].erroExecucao).toBe('linha 1: ZeroDivisionError: division by zero');
  });

  it('usa os dados do exercício e os do caso, que valem mais que um arquivo do aluno', async () => {
    const comDados = {
      dados: { 'n.txt': '1' },
      testes: [
        { descricao: 'padrão', regras: [{ saidaIgual: '1' }] },
        { descricao: 'outros', oculto: true, dados: { 'n.txt': '2' }, regras: [{ saidaIgual: '2' }] },
      ],
    };
    const aluno = { 'main.py': 'print(open("n.txt").read())', 'n.txt': '99' };
    const { aprovado, relatorio } = await corrigir(comDados, aluno, executar);
    expect(aprovado).toBe(true);
    expect(relatorio[1].cenario.dados).toEqual(['n.txt']);
  });
});
