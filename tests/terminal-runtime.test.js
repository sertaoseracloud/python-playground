// input() interativo e saída ao vivo, com o Python de verdade (Pyodide no Node, JSPI ligado).
import { describe, it, expect } from 'vitest';
import { iniciarPython } from './python-node.js';

const sessao = iniciarPython().then((s) => s.sessao);

describe('terminal: runtime', () => {
  it('a saída chega antes do input() e a resposta digitada continua o programa', async () => {
    const eventos = [];
    const r = await (await sessao).executar({ 'main.py': 'print("antes")\nn = input("Nome: ")\nprint("Olá,", n)\n' }, {
      interativo: true,
      aoSaida: (t) => eventos.push(['saida', t]),
      aoPedirEntrada: async () => { eventos.push(['pediu']); return 'Ana'; },
    });
    expect(r.erro).toBeNull();
    expect(eventos.findIndex((e) => e[0] === 'pediu')).toBeGreaterThan(eventos.findIndex((e) => e[1]?.includes('Nome: ')));
    expect(r.saida).toBe('antes\nNome: Ana\nOlá, Ana\n');
  });

  it('EOF (Ctrl+D) vira EOFError no programa', async () => {
    const r = await (await sessao).executar({ 'main.py': 'input()\n' }, { interativo: true, aoSaida: () => {}, aoPedirEntrada: async () => null });
    expect(r.erro.tipo).toBe('EOFError');
  });

  it('sem JSPI: devolve precisa_entrada com a saída até ali', async () => {
    const r = await (await sessao).executar({ 'main.py': 'print(1)\ninput("x? ")\n' }, { interativo: true, semJSPI: true, aoSaida: () => {}, aoPedirEntrada: async () => 'nunca' });
    expect(r.precisa_entrada).toBe(true);
    expect(r.saida).toBe('1\nx? ');
  });

  it('REPL: linha a linha, com o escopo do programa (python -i)', async () => {
    const s = await sessao;
    await s.executar({ 'main.py': 'nome = "Ana"' });
    await s.repl({ acao: 'iniciar', doPrograma: true });
    expect((await s.repl({ acao: 'linha', texto: 'nome.upper()' })).saida).toBe("'ANA'\n");
    expect((await s.repl({ acao: 'linha', texto: 'if True:' })).continua).toBe(true);
  });
});
