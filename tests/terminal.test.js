// @vitest-environment happy-dom
// A tela do terminal: prompt e campo na mesma linha, histórico, teclas e leitor de tela.
import { describe, it, expect, beforeEach } from 'vitest';
import { criarTerminal, Cancelado } from '../src/ui/terminal.js';

let t;
let historico;
const campo = () => document.getElementById('campo-terminal');
const saida = () => document.getElementById('saida-terminal').textContent;
const tecla = (key, extra = {}) => campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
const digitar = (texto) => { campo().value = texto; tecla('Enter'); };

beforeEach(() => {
  document.body.innerHTML = '<div id="terminal"><pre id="saida-terminal" role="log"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal"></div></div><button id="depois">depois</button>';
  historico = [];
  t = criarTerminal(document.getElementById('terminal'), { historico: [], aoMudarHistorico: (h) => { historico = h; }, completar: (texto) => ['python', 'pip'].filter((c) => c.startsWith(texto)) });
});

describe('terminal', () => {
  it('o prompt e o campo ficam na mesma linha; o digitado fica na saída', async () => {
    t.escrever('Olá\n');
    const lido = t.ler({ prompt: 'Nome: ', rotulo: 'Resposta para o input()' });
    expect(document.getElementById('prompt-terminal').textContent).toBe('Nome: ');
    expect(campo().getAttribute('aria-label')).toBe('Resposta para o input()');
    digitar('Ana');
    expect(await lido).toBe('Ana');
    expect(saida()).toBe('Olá\nNome: Ana\n');
  });

  it('histórico com as setas e salvo', async () => {
    let p = t.ler({ prompt: '$ ' });
    digitar('python main.py');
    await p;
    p = t.ler({ prompt: '$ ' });
    tecla('ArrowUp');
    expect(campo().value).toBe('python main.py');
    tecla('ArrowDown');
    expect(campo().value).toBe('');
    digitar('ls');
    await p;
    expect(historico).toEqual(['python main.py', 'ls']);
  });

  it('a resposta de um input() não entra no histórico', async () => {
    const p = t.ler({ prompt: 'Nome: ', rotulo: 'Resposta para o input()', historico: false });
    digitar('Ana');
    await p;
    expect(historico).toEqual([]);
  });

  it('Tab completa, Ctrl+C cancela, Ctrl+D é EOF, Ctrl+L limpa', async () => {
    let p = t.ler({ prompt: '$ ' });
    campo().value = 'py';
    tecla('Tab');
    expect(campo().value).toBe('python ');
    tecla('c', { ctrlKey: true });
    await expect(p).rejects.toBeInstanceOf(Cancelado);
    expect(saida()).toContain('$ python ^C');
    p = t.ler({ prompt: '' });
    tecla('d', { ctrlKey: true });
    expect(await p).toBeNull();
    t.escrever('lixo\n');
    t.ler({ prompt: '$ ' });
    tecla('l', { ctrlKey: true });
    expect(saida()).toBe('');
  });

  it('Tab com várias opções lista as opções na saída', () => {
    t.ler({ prompt: '$ ' });
    campo().value = 'p';
    tecla('Tab');
    expect(saida()).toContain('python  pip');
    expect(campo().value).toBe('p');
  });

  it('Esc tira o foco do terminal (Tab completa, então ninguém fica preso)', () => {
    t.ler({ prompt: '$ ' });
    campo().focus();
    tecla('Escape');
    expect(document.activeElement).not.toBe(campo());
  });

  it('colar várias linhas: a primeira responde agora, as outras ficam na fila', async () => {
    const p = t.ler({ prompt: 'A: ' });
    campo().dispatchEvent(Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: { getData: () => '1\n2\n3' } }));
    expect(await p).toBe('1');
    expect(await t.ler({ prompt: 'B: ' })).toBe('2');
    expect(await t.ler({ prompt: 'C: ' })).toBe('3');
    expect(saida()).toBe('A: 1\nB: 2\nC: 3\n');
  });

  it('cancelarLeitura rejeita a leitura aberta e desabilita o campo', async () => {
    const p = t.ler({ prompt: '$ ' });
    expect(t.ocupado).toBe(true);
    t.cancelarLeitura();
    await expect(p).rejects.toBeInstanceOf(Cancelado);
    expect(t.ocupado).toBe(false);
    expect(campo().disabled).toBe(true);
  });

  it('guarda no máximo 5000 linhas', () => {
    t.escrever(Array.from({ length: 6000 }, (_, i) => `linha ${i}`).join('\n') + '\n');
    const linhas = saida().split('\n').filter(Boolean);
    expect(linhas).toHaveLength(5000);
    expect(linhas.at(-1)).toBe('linha 5999');
  });

  it('sem prompt, o fim da última linha (o "Nome: " do input()) vira o prompt, na mesma linha', async () => {
    t.escrever('oi\nNome: ');
    const p = t.ler({ rotulo: 'Resposta para o input()', historico: false });
    expect(document.getElementById('prompt-terminal').textContent).toBe('Nome: ');
    expect(saida()).toBe('oi\n');
    digitar('Ana');
    await p;
    expect(saida()).toBe('oi\nNome: Ana\n');
  });

  it('Ctrl+C sem leitura aberta (programa rodando) chama aoInterromper', () => {
    let interrompeu = false;
    t.aoInterromper = () => { interrompeu = true; };
    document.getElementById('terminal').dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    expect(interrompeu).toBe(true);
  });

  it('erro sai pintado', () => {
    t.escrever('Traceback\n', 'erro');
    expect(document.querySelector('#saida-terminal .erro').textContent).toBe('Traceback\n');
  });
});
