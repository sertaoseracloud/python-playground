// @vitest-environment happy-dom
// A trilha com cenários: cada módulo tem o seu, o caminho continua igual para o leitor de tela,
// e o CSS para os personagens com "reduzir movimento".
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulos } from '../src/conteudo/trilha.js';
import { CENARIO_DO_MODULO } from '../src/conteudo/cenarios.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';
import { renderInicio } from '../src/ui/inicio.js';

const css = readFileSync(resolve(process.cwd(), 'src/cenarios.css'), 'utf8');
const estilo = readFileSync(resolve(process.cwd(), 'src/estilo.css'), 'utf8');

beforeAll(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(document.getElementById('tela-inicio'));
});

describe('cenários na trilha', () => {
  it('todo módulo tem um cenário, e todo cenário do mapa existe', () => {
    for (const m of modulos) expect(CENARIO_DO_MODULO[m.id], m.id).toBeTruthy();
    for (const id of Object.values(CENARIO_DO_MODULO)) expect(CENARIOS[id], id).toBeTruthy();
  });

  it('cada bloco de módulo tem o seu cenário como primeira camada', () => {
    for (const m of modulos) {
      const bloco = document.getElementById(`unidade-${m.id}`);
      expect(bloco.classList.contains('com-cenario')).toBe(true);
      expect(bloco.firstElementChild.classList.contains(`cenario-${CENARIO_DO_MODULO[m.id]}`)).toBe(true);
      expect(bloco.firstElementChild.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('o caminho continua o mesmo: os nós e os rótulos não ganham nada do cenário', () => {
    const nos = [...document.querySelectorAll('.no .alvo')];
    expect(nos.length).toBeGreaterThan(0);
    for (const alvo of nos) expect(alvo.closest('.cenario')).toBeNull();
    expect(document.querySelectorAll('.cenario [aria-label], .cenario a, .cenario button')).toHaveLength(0);
    for (const m of modulos) expect(document.getElementById(`trilha-${m.id}`)).not.toBeNull();
  });

  it('o CSS não rouba o clique e para os personagens quando pedem menos movimento', () => {
    expect(css).toMatch(/\.cenario\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.personagem[^{]*\{[^}]*animation:\s*none/);
    expect(css).toMatch(/\[data-tema="alto-contraste"\][^{]*\.personagem[^{]*\{[^}]*animation:\s*none/);
    expect(css).toMatch(/\.com-cenario \.legenda[^{]*\{[^}]*background/);
    expect(estilo).toMatch(/:root\.a11y-sem-movimento \*[\s\S]*animation:\s*none !important/);
  });
});
