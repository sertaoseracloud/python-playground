// @vitest-environment happy-dom
// Tela do exercício com um motor falso: Executar mostra a saída e o traceback no
// terminal, usa a aba ⌨️ Entrada e roda os casos visíveis.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

function montar(resposta) {
  document.body.innerHTML = corpo;
  const pedidos = [];
  const motor = { executar: async (arquivos, opcoes) => { pedidos.push({ ...opcoes, arquivos }); return { ms: 5, retornos: [], variaveis: {}, ...resposta }; } };
  const layout = { aplicar() {}, mostrarDescricao() {} };
  const tela = criarTelaItem({ motor, layout, definirStatus: () => {}, aoMudarProgresso: () => {} });
  tela.aoMudarEstadoPython(true);
  return { tela, pedidos };
}

describe('tela do exercício (Python)', () => {
  beforeEach(() => localStorage.clear());

  it('a saída aparece no terminal', async () => {
    const { tela } = montar({ saida: 'Olá, Sertão!\n', erro: null });
    tela.abrir('licao-ola');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('saida-terminal').textContent).toContain('Olá, Sertão!');
  });

  it('o traceback aparece no terminal, depois da saída', async () => {
    const { tela } = montar({ saida: 'antes\n', erro: { tipo: 'ZeroDivisionError', mensagem: 'division by zero', linha: 2, traceback: 'Traceback (most recent call last):\n  File "main.py", line 2\nZeroDivisionError: division by zero\n' } });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    const texto = document.getElementById('saida-terminal').textContent;
    expect(texto.indexOf('antes')).toBeLessThan(texto.indexOf('ZeroDivisionError'));
  });

  it('as linhas da aba ⌨️ Entrada vão para o input()', async () => {
    const { tela, pedidos } = montar({ saida: '', erro: null });
    tela.abrir('livre');
    document.getElementById('entrada').value = 'Ana\nBia';
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidos.at(-1).entrada).toEqual(['Ana', 'Bia']);
  });

  it('o livre mostra a aba 📦 Dados e envia os dados junto com o código', async () => {
    const { tela, pedidos } = montar({ saida: '', erro: null });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('aba-dados').hidden).toBe(false);
    expect(Object.keys(pedidos.at(-1).arquivos)).toContain('vendas.csv');
  });
});
