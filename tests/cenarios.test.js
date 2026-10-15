// @vitest-environment happy-dom
// Cenários da trilha: decoração pura (o leitor de tela não ouve nada), leve e completa.
import { describe, it, expect } from 'vitest';
import { CENARIOS, htmlDoCenario } from '../src/ui/cenarios/index.js';

const IDS = ['sertao', 'vale', 'gelo', 'fogo', 'rio', 'cidade', 'jardim'];
const camada = (id) => {
  const div = document.createElement('div');
  div.innerHTML = htmlDoCenario(id);
  return div.firstElementChild;
};

describe('cenários', () => {
  it('existem os 7 cenários, cada um com 3 personagens', () => {
    expect(Object.keys(CENARIOS).sort()).toEqual([...IDS].sort());
    for (const c of Object.values(CENARIOS)) {
      expect(c.personagens).toHaveLength(3);
      for (const p of c.personagens) expect(['andar', 'voar', 'nadar', 'saltar']).toContain(p.movimento);
    }
  });

  it.each(IDS)('%s: decoração escondida do leitor de tela, sem texto, sem foco e sem ids', (id) => {
    const el = camada(id);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains(`cenario-${id}`)).toBe(true);
    expect(el.textContent.trim()).toBe('');
    expect(el.querySelector('a, button, input, [tabindex], title, text, [id]')).toBeNull();
    expect(el.querySelectorAll('.personagem')).toHaveLength(3);
    // Fundo e personagens ficam juntos no palco (o pedaço que acompanha a rolagem).
    expect(el.querySelectorAll('.cenario-palco > .cenario-fundo, .cenario-palco > .personagem')).toHaveLength(4);
  });

  it.each(IDS)('%s: no máximo 12 KB', (id) => {
    const c = CENARIOS[id];
    const tamanho = c.fundo.length + c.personagens.reduce((s, p) => s + p.svg.length, 0);
    expect(tamanho).toBeLessThanOrEqual(12 * 1024);
  });

  it('id desconhecido não quebra a trilha', () => {
    expect(htmlDoCenario('inventado')).toBe('');
    expect(htmlDoCenario(undefined)).toBe('');
  });
});
