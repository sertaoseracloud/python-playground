// O runtime que roda o código do aluno no Pyodide (python/diverge_runtime): saída,
// erros com a linha certa, input(), variáveis, chamadas de função e limites.
import { describe, it, expect, beforeAll } from 'vitest';
import { iniciarPython } from './python-node.js';

let sessao;
beforeAll(async () => { ({ sessao } = await iniciarPython()); });
const rodar = (codigo, opcoes = {}) => sessao.executar({ 'main.py': codigo, ...(opcoes.arquivos ?? {}) }, opcoes);

describe('diverge_runtime', () => {
  it('captura o print', async () => {
    expect((await rodar('print("Olá")\nprint(1 + 2)')).saida).toBe('Olá\n3\n');
  });

  it('erro com tipo, mensagem e a linha do aluno (sem linhas do runtime)', async () => {
    const { erro } = await rodar('x = 1\ny = x + "a"\n');
    expect(erro).toMatchObject({ tipo: 'TypeError', linha: 2 });
    expect(erro.traceback).toContain('File "main.py", line 2');
    expect(erro.traceback).not.toContain('diverge_runtime');
  });

  it('input() lê as linhas da entrada e mostra o prompt', async () => {
    const r = await rodar('n = input("Nome: ")\nprint("Oi", n)', { entrada: ['Ana'] });
    expect(r.saida).toBe('Nome: Oi Ana\n');
  });

  it('input() sem entrada dá EOFError, como o Python', async () => {
    expect((await rodar('input()')).erro).toMatchObject({ tipo: 'EOFError', mensagem: 'EOF when reading a line' });
  });

  it('variáveis globais simples voltam como JSON', async () => {
    const { variaveis } = await rodar('a = 3\nb = [1, (2, 3)]\nc = {"x": {1, 2}}\n_oculta = 1\nimport math');
    expect(variaveis).toEqual({ a: 3, b: [1, [2, 3]], c: { x: [1, 2] } });
  });

  it('chama funções do aluno e devolve retorno ou erro', async () => {
    const r = await rodar('def dobro(n):\n    return n * 2\ndef quebra():\n    raise ValueError("ops")', {
      chamadas: [{ funcao: 'dobro', args: [4] }, { funcao: 'quebra', args: [] }, { funcao: 'nao_existe', args: [] }],
    });
    expect(r.retornos[0]).toMatchObject({ ok: true, valor: 8 });
    expect(r.retornos[1]).toMatchObject({ ok: false, erro: { tipo: 'ValueError', mensagem: 'ops' } });
    expect(r.retornos[2]).toMatchObject({ ok: false, erro: { tipo: 'NameError' } });
  });

  it('retorno que não vira JSON vem com repr', async () => {
    const [r] = (await rodar('def f():\n    return print', { chamadas: [{ funcao: 'f', args: [] }] })).retornos;
    expect(r).toMatchObject({ ok: true, valor: null, repr: '<built-in function print>' });
  });

  it('saída gigante é cortada', async () => {
    const { saida } = await rodar('for i in range(200000):\n    print(i)');
    expect(saida.length).toBeLessThanOrEqual(100100);
    expect(saida).toMatch(/… \(saída cortada\)\n$/);
  });

  it('um arquivo json.py do aluno não quebra o runtime', async () => {
    const r = await rodar('import json\nprint(json.VALOR)', { arquivos: { 'json.py': 'VALOR = 42\n' } });
    expect(r.saida).toBe('42\n');
  });

  it('cada execução começa do zero (módulos do aluno recarregados)', async () => {
    await rodar('import util\nprint(util.X)', { arquivos: { 'util.py': 'X = 1\n' } });
    const r = await rodar('import util\nprint(util.X)', { arquivos: { 'util.py': 'X = 2\n' } });
    expect(r.saida).toBe('2\n');
  });

  it('lê arquivo de dados com acento e devolve o arquivo que o programa gravou', async () => {
    const r = await sessao.executar({
      'main.py': 'linhas = open("vendas.csv").read().splitlines()\nprint(linhas[1])\nopen("saida.txt", "w").write("ok")\n',
      'vendas.csv': 'produto\nFeijão\n',
    });
    expect(r.saida).toBe('Feijão\n');
    expect(r.arquivos_gerados).toEqual({ 'saida.txt': 'ok' });
  });
});
