// @vitest-environment happy-dom
// A posição do código e do terminal na tela do exercício: botões de modo, descrição oculta,
// divisor pelo teclado (com limites) e a escolha salva no navegador.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarLayout } from '../src/ui/layout.js';
import { lerPreferencia } from '../src/progresso.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const tecla = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('layout da tela do exercício', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = corpo;
    window.innerWidth = 1400;
  });

  it('modo fixo pelos botões, com aria-pressed e salvo', () => {
    const layout = criarLayout();
    layout.aplicar();
    document.querySelector('[data-layout="empilhado"]')?.click();
    const area = document.getElementById('area');
    expect(area.dataset.modo).toBe('empilhado');
    expect(document.querySelector('[data-layout="empilhado"]').getAttribute('aria-pressed')).toBe('true');
    expect(lerPreferencia('layout', {}).modo).toBe('empilhado');
    document.querySelector('[data-layout="lado"]').click();
    expect(area.dataset.modo).toBe('lado');
    expect(document.getElementById('divisor').getAttribute('aria-orientation')).toBe('vertical');
  });

  it('ocultar a descrição e voltar a mostrar (a aba Testes precisa dela)', () => {
    const layout = criarLayout();
    layout.aplicar();
    const botao = document.getElementById('btn-descricao');
    botao.click();
    expect(document.getElementById('painel-descricao').hidden).toBe(true);
    expect(botao.getAttribute('aria-label')).toBe('Mostrar descrição');
    layout.mostrarDescricao();
    expect(document.getElementById('painel-descricao').hidden).toBe(false);
    layout.mostrarDescricao(); // já visível: nada muda
    expect(botao.getAttribute('aria-pressed')).toBe('true');
  });

  it('divisor pelo teclado: setas, Home, End e duplo clique, entre 20% e 80%', () => {
    const layout = criarLayout();
    layout.aplicar();
    document.querySelector('[data-layout="lado"]').click();
    const divisor = document.getElementById('divisor');
    tecla(divisor, 'ArrowRight');
    expect(divisor.getAttribute('aria-valuenow')).toBe('55');
    tecla(divisor, 'End');
    tecla(divisor, 'ArrowRight');
    expect(divisor.getAttribute('aria-valuenow')).toBe('80');
    tecla(divisor, 'Home');
    expect(divisor.getAttribute('aria-valuenow')).toBe('20');
    tecla(divisor, 'a'); // outra tecla: nada muda
    expect(divisor.getAttribute('aria-valuenow')).toBe('20');
    divisor.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(divisor.getAttribute('aria-valuenow')).toBe('50');
    expect(lerPreferencia('layout', {}).divisao).toBe(50);
  });

  it('no celular, empilha e esconde o divisor', () => {
    window.innerWidth = 400;
    const layout = criarLayout();
    layout.aplicar();
    expect(document.getElementById('area').dataset.modo).toBe('celular');
    expect(document.getElementById('divisor').hidden).toBe(true);
  });
});
