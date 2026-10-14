// @vitest-environment happy-dom
// O shell: cada comando, o REPL, o input() (com e sem JSPI) e o Ctrl+C, com um motor falso.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { criarTerminal } from '../src/ui/terminal.js';
import { criarShell, dividir } from '../src/ui/shell.js';
import { Interrompido } from '../src/python/motor.js';

let terminal;
const saida = () => document.getElementById('saida-terminal').textContent;
const campo = () => document.getElementById('campo-terminal');
const prompt = () => document.getElementById('prompt-terminal').textContent;
const digitar = (texto) => { campo().value = texto; campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
const espera = () => new Promise((r) => setTimeout(r, 5));

function shell(motor, extra = {}) {
  return criarShell({ terminal, motor, arquivos: () => ({ 'main.py': 'print(1)\n', 'dados.csv': 'a,b\n' }), pasta: () => 'py-ola', semJSPI: false, ...extra });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="terminal"><pre id="saida-terminal"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal"></div></div>';
  terminal = criarTerminal(document.getElementById('terminal'));
});

describe('shell', () => {
  it('dividir respeita aspas', () => {
    expect(dividir(`python main.py "Ana Lia" 'x y' z`)).toEqual(['python', 'main.py', 'Ana Lia', 'x y', 'z']);
  });

  it('ls, cat, help, pip e comando desconhecido', async () => {
    const s = shell({});
    await s.rodar('ls');
    await s.rodar('cat dados.csv');
    await s.rodar('cat nada.txt');
    await s.rodar('help');
    await s.rodar('pip install pandas');
    await s.rodar('xyz');
    expect(saida()).toContain('dados.csv  main.py');
    expect(saida()).toContain('a,b');
    expect(saida()).toContain('cat: nada.txt: No such file or directory');
    expect(saida()).toContain('python -i <arquivo>');
    expect(saida()).toContain('não dá para instalar pacotes');
    expect(saida()).toContain('bash: xyz: command not found');
  });

  it('python arquivo args: saída ao vivo, argv e input() respondido no terminal, na mesma linha', async () => {
    let opcoesVistas;
    const motor = {
      executar: async (arquivos, opcoes, ganchos) => {
        opcoesVistas = opcoes;
        ganchos.aoSaida('Nome: ');
        const nome = await ganchos.aoPedirEntrada();
        return { saida: `Nome: ${nome}\nOlá, ${nome}\n`, erro: null };
      },
    };
    const feito = shell(motor).rodar('python main.py a b');
    await espera();
    expect(prompt()).toBe('Nome: ');
    digitar('Ana');
    await feito;
    expect(saida()).toBe('Nome: Ana\nOlá, Ana\n');
    expect(opcoesVistas).toMatchObject({ principal: 'main.py', argv: ['a', 'b'], interativo: true });
  });

  it('python com arquivo que não existe', async () => {
    await shell({}).rodar('python nada.py');
    expect(saida()).toContain("python: can't open file 'nada.py': [Errno 2] No such file or directory");
  });

  it('sem JSPI: repete o programa com as respostas e mostra só a saída nova', async () => {
    const chamadas = [];
    const motor = {
      executar: async (arquivos, opcoes) => {
        chamadas.push([...opcoes.entrada]);
        if (!opcoes.entrada.length) return { saida: 'oi\nNome: ', erro: null, precisa_entrada: true };
        return { saida: `oi\nNome: ${opcoes.entrada[0]}\nfim\n`, erro: null };
      },
    };
    const feito = shell(motor, { semJSPI: true }).rodar('python main.py');
    await espera();
    digitar('Bia');
    await feito;
    expect(chamadas).toEqual([[], ['Bia']]);
    expect(saida()).toContain('oi\nNome: Bia\nfim\n');
    expect(saida().match(/oi/g)).toHaveLength(1);
    expect(saida()).toContain('neste navegador o programa roda de novo');
  });

  it('sem JSPI: Ctrl+D vira um null na fila (o Python dá EOFError)', async () => {
    const chamadas = [];
    const motor = {
      executar: async (arquivos, opcoes) => {
        chamadas.push([...opcoes.entrada]);
        if (!opcoes.entrada.length) return { saida: 'A: ', erro: null, precisa_entrada: true };
        return { saida: 'A: ', erro: { tipo: 'EOFError', traceback: 'EOFError: EOF when reading a line\n' } };
      },
    };
    const feito = shell(motor, { semJSPI: true }).rodar('python main.py');
    await espera();
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    await feito;
    expect(chamadas).toEqual([[], [null]]);
    expect(saida()).toContain('EOFError');
  });

  it('o traceback sai em vermelho e Ctrl+C mostra KeyboardInterrupt', async () => {
    let rejeitar;
    const motor = {
      executar: () => new Promise((_, r) => { rejeitar = r; }),
      interromper: () => rejeitar(new Interrompido('KeyboardInterrupt')),
    };
    const feito = shell(motor).rodar('python main.py');
    await espera();
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    await feito;
    expect(saida()).toContain('KeyboardInterrupt');
    const erro = { tipo: 'ZeroDivisionError', traceback: 'ZeroDivisionError: division by zero\n' };
    await shell({ executar: async () => ({ saida: '', erro }) }).rodar('python main.py');
    expect(document.querySelector('#saida-terminal .erro').textContent).toContain('KeyboardInterrupt');
    expect([...document.querySelectorAll('#saida-terminal .erro')].at(-1).textContent).toContain('ZeroDivisionError');
  });

  it('python abre o REPL; exit() sai', async () => {
    const linhas = [];
    const motor = { repl: async (opcoes) => { if (opcoes.acao === 'linha') linhas.push(opcoes.texto); return { saida: opcoes.texto === '1+1' ? '2\n' : '', erro: null, continua: opcoes.texto === 'if True:' }; } };
    const feito = shell(motor).rodar('python');
    await espera();
    digitar('1+1');
    await espera();
    digitar('if True:');
    await espera();
    expect(prompt()).toBe('... ');
    digitar('');
    await espera();
    digitar('exit()');
    await feito;
    expect(saida()).toContain('>>> 1+1\n2\n');
    expect(linhas).toEqual(['1+1', 'if True:', '']);
  });

  it('python -i roda o programa e continua no REPL com as variáveis dele', async () => {
    const acoes = [];
    const motor = {
      executar: async () => ({ saida: 'pronto\n', erro: null }),
      repl: async (opcoes) => { acoes.push(opcoes); return { saida: '', erro: null, continua: false }; },
    };
    const feito = shell(motor).rodar('python -i main.py');
    await espera();
    expect(prompt()).toBe('>>> ');
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    await feito;
    expect(acoes[0]).toMatchObject({ acao: 'iniciar', doPrograma: true });
    expect(saida()).toContain('pronto\n');
  });

  it('o laço do prompt mostra aluno@sertao:~/<pasta>$ e para com parar()', async () => {
    const s = shell({});
    const laco = s.iniciar();
    await espera();
    expect(prompt()).toBe('aluno@sertao:~/py-ola$ ');
    digitar('ls');
    await espera();
    expect(saida()).toContain('aluno@sertao:~/py-ola$ ls\ndados.csv  main.py\n');
    await s.parar();
    await laco;
    expect(terminal.ocupado).toBe(false);
  });

  it('parar() espera o programa do ▶ Executar terminar de escrever (o KeyboardInterrupt sai antes)', async () => {
    // O motor de verdade rejeita depois de alguns saltos (fila, worker): aqui, no próximo ciclo.
    let rejeitar;
    const motor = {
      executar: (a, o, g) => new Promise((_, r) => { rejeitar = r; g.aoPedirEntrada().catch(() => {}); }),
      interromper: () => setTimeout(() => rejeitar(new Interrompido('KeyboardInterrupt'))),
    };
    const s = shell(motor);
    s.executarPrograma('main.py', [], { eco: true });
    await espera();
    await s.parar();
    expect(saida()).toContain('KeyboardInterrupt');
    terminal.limpar();
    await espera();
    expect(saida()).toBe('');
  });

  it('parar() com o programa esperando input(): manda EOF (sem reiniciar o Python) e não mostra o erro dele', async () => {
    let interrompeu = false;
    const motor = {
      executar: async (a, o, g) => {
        const resposta = await g.aoPedirEntrada();
        return resposta === null
          ? { saida: '', erro: { tipo: 'EOFError', traceback: 'EOFError: EOF when reading a line\n' } }
          : { saida: 'ok\n', erro: null };
      },
      interromper: () => { interrompeu = true; },
    };
    const s = shell(motor);
    s.executarPrograma('main.py', [], { eco: true });
    await espera();
    await s.parar();
    expect(interrompeu).toBe(false);
    expect(saida()).toContain('KeyboardInterrupt');
    expect(saida()).not.toContain('EOFError');
  });

  it('parar(): se o programa não termina depois do EOF, o Python é reiniciado', async () => {
    vi.useFakeTimers();
    try {
      let rejeitar;
      const motor = {
        executar: (a, o, g) => new Promise((_, r) => { rejeitar = r; g.aoPedirEntrada(); }), // ignora o EOF
        interromper: () => rejeitar(new Interrompido('KeyboardInterrupt')),
      };
      const s = shell(motor);
      s.executarPrograma('main.py');
      await vi.advanceTimersByTimeAsync(5);
      const parado = s.parar();
      await vi.advanceTimersByTimeAsync(1500);
      await parado;
      expect(saida()).toContain('KeyboardInterrupt');
    } finally {
      vi.useRealTimers();
    }
  });

  it('completar: comandos e arquivos', () => {
    const s = shell({});
    expect(s.completar('py')).toEqual(['python']);
    expect(s.completar('python ma')).toEqual(['python main.py']);
    expect(s.completar('cat d')).toEqual(['cat dados.csv']);
  });
});
