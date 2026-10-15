// Cenários da trilha: o fundo de mapa e os personagens de cada módulo. É pura decoração:
// a camada inteira fica escondida do leitor de tela (aria-hidden) e não recebe clique nem
// foco; as cores vêm de variáveis CSS (src/cenarios.css), para cada tema ajustar sem mexer
// no desenho. As animações são só de CSS e param com "reduzir movimento".
import { sertao } from './sertao.js';
import { vale } from './vale.js';
import { gelo } from './gelo.js';
import { fogo } from './fogo.js';
import { rio } from './rio.js';
import { cidade } from './cidade.js';
import { jardim } from './jardim.js';

export const CENARIOS = Object.fromEntries([sertao, vale, gelo, fogo, rio, cidade, jardim].map((c) => [c.id, c]));

/** Camada decorativa do cenário (ou '' se o módulo não tem cenário). */
export function htmlDoCenario(id) {
  const c = CENARIOS[id];
  if (!c) return '';
  const personagens = c.personagens.map((p, i) => `
    <span class="personagem personagem-${i + 1} mov-${p.movimento}"><span class="corpo">${p.svg}</span></span>`).join('');
  // O palco tem a altura da tela e acompanha a rolagem: o módulo tem milhares de pixels.
  return `<div class="cenario cenario-${c.id}" aria-hidden="true"><div class="cenario-palco"><div class="cenario-fundo">${c.fundo}</div>${personagens}</div></div>`;
}
