# Cenários da trilha — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada módulo da trilha ganha um cenário de mapa (sertão, vale, gelo, fogo, rio, cidade,
jardim) atrás do seu trecho do caminho, com três personagens andando, nos três sites.

**Architecture:** O componente fica em `src/ui/cenarios/`, idêntico nos três repos: um arquivo
por cenário, com o SVG do fundo e dos personagens, mais `index.js`. O mapa `módulo → cenário`
fica em `src/conteudo/cenarios.js`, o único arquivo próprio de cada site. A trilha
(`src/ui/inicio.js`) põe a camada decorativa como primeiro filho de cada `section.bloco-unidade`.
As animações ficam em `src/cenarios.css` e são só de CSS.

**Tech Stack:** JavaScript (ES modules), SVG inline, CSS, Vite, Vitest com happy-dom.

**Spec:** `python-playground/docs/superpowers/specs/2026-10-15-cenarios-da-trilha-design.md`

## Global Constraints

- **Acessibilidade da camada:** toda a camada tem `aria-hidden="true"`, sem texto, sem `<title>`,
  sem `<text>` e sem elemento focável. O leitor de tela não ouve nada novo.
- **Movimento:**
  - os personagens param com `prefers-reduced-motion: reduce` e com a classe `a11y-sem-movimento`;
  - no tema `alto-contraste`, os personagens também param;
  - a animação é só `transform` em CSS, sem JavaScript por quadro.
- **Temas:**
  - `alto-contraste`: o cenário vira contorno fino na cor `--suave`, sem preenchimento;
  - `suave`: `filter: saturate(.5) brightness(.9)`.
- **Contraste da trilha:** o caminho, os nós e os rótulos não mudam de cor. A legenda de cada nó e
  o cabeçalho do módulo ganham um véu de fundo, para manter o contraste AA.
- **Tamanho:** cada cenário, com o fundo e os 3 personagens, tem no máximo 12 KB (12 288 caracteres
  somados). Sem imagens externas.
- **Celular:** abaixo de 600px de largura, só o personagem 1 aparece.
- **Módulo bloqueado:** os personagens ficam parados, e o cenário fica desbotado (`grayscale(1)`,
  `opacity: .2`).
- **O que não muda:** o cartão "em breve" (`PROXIMOS_MODULOS`) não tem cenário.
- **Versões:** DivergePython 0.5.0 (sai junto com a fase 5, sem versão própria agora), DivergePHP
  1.7.0 e DivergeTerraform 1.8.0.
- **Commits:** autor via
  `git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit`, e a mensagem
  termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Publicação:** push, tag e release só com o "sim".
- **Ferramentas:**
  - vitest pelo `rtk proxy npx vitest run …` (o rtk esconde a saída);
  - eslint com `-f json -o $TEMP/lint.json`;
  - build local com `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.

## Review Focus

1. **Legenda de nó sobre uma parte escura ou clara do cenário:** o texto continua legível.
   - Teste: a regra CSS `.com-cenario .legenda` com o véu de fundo existe (Task 2).
   - Conferência: o axe e o olho, nos 4 temas (Task 3).
2. **Personagem passando por cima de um nó e "roubando" o clique:** o clique sempre chega ao nó.
   - Teste: `.cenario` tem `pointer-events: none` no CSS (Task 2).
3. **Trilha com o módulo atual lá embaixo:** o "📍 Passo atual" e a rolagem automática continuam
   funcionando.
   - Teste: a trilha renderizada mantém `#trilha-<id>` e os `.no` com os mesmos rótulos (Task 2).
4. **Tema trocado com a trilha aberta:** o cenário muda na hora, porque é só CSS por
   `[data-tema]`. Fica coberto pela conferência nos 4 temas (Task 3).
5. **Módulo de um site sem cenário no mapa** (por exemplo, um módulo novo): a trilha não quebra.
   - Teste: `htmlDoCenario` de um id desconhecido devolve `''` (Task 1).

### Uma escolha deste plano: a arte

O código SVG de cada cenário é **desenho**, e não lógica. O plano fixa a estrutura, a paleta, a
composição de cada cenário e o desenho completo do `sertao`, como referência. Os outros seis
cenários são escritos na execução seguindo essa referência. Os portões são os testes (estrutura,
`aria-hidden`, sem texto, tamanho) e a conferência visual da Task 3.

---

### Task 1: Os 7 cenários e `htmlDoCenario` (python-playground)

**Files:**
- Create: `src/ui/cenarios/index.js`, `src/ui/cenarios/sertao.js`, `vale.js`, `gelo.js`, `fogo.js`,
  `rio.js`, `cidade.js` e `jardim.js`
- Test: `tests/cenarios.test.js`

**Interfaces:**
- Produces:
  - `CENARIOS: { [id]: { id, nome, fundo: string (SVG), personagens: [{ id, svg: string, movimento: 'andar'|'voar'|'nadar'|'saltar' }] } }`;
  - `htmlDoCenario(id) → string` (HTML da camada, ou `''` se o id não existe).

**Estrutura de cada arquivo de cenário:**
- **Fundo:** `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">`.
  - As cores vêm de variáveis CSS do cenário (`style="fill:var(--cen-1)"` … `--cen-5`), para o
    tema mudar a cor sem mudar o SVG.
  - Sem `<title>`, sem `<text>` e sem `id` dentro do SVG (ids repetidos quebrariam a página).
- **Personagem:** `<svg viewBox="0 0 40 40" focusable="false">`, com as cores em `var(--per-1)`
  … `var(--per-3)`.

**Paleta** (os valores vão para o CSS na Task 2):

| Cenário | `--cen-1` céu | `--cen-2` fundo distante | `--cen-3` meio | `--cen-4` chão | `--cen-5` detalhe |
|---|---|---|---|---|---|
| sertao | #f6c56b | #c8794a | #8a9a4b | #d9a066 | #3f7d3a (mandacaru) |
| vale | #a8d8ea | #6fa86a | #8fc46a | #7a5c3a | #3d8bd9 (açude) |
| gelo | #cfe8f5 | #9cc3dc | #e8f4fa | #ffffff | #7fb3d5 (cristais) |
| fogo | #3b1a1a | #6b2a1f | #a0391e | #2a1410 | #ff8c1a (lava) |
| rio | #9fd3e6 | #5c8f5a | #3b8fc2 | #6a8f4f | #e8f6ff (espuma) |
| cidade | #1b1f3a | #2d3358 | #3e4675 | #222640 | #ffd166 (janelas) |
| jardim | #f2e6f7 | #a6d49f | #e98fb5 | #7fae6e | #f5c542 (miolo) |

**Composição:**

| Cenário | Fundo | Personagens: 1, 2 e 3 (movimento) |
|---|---|---|
| sertao | sol, serra em 2 planos, chão, 3 mandacarus | vaqueiro (andar), cabrita (andar), calango (andar) |
| vale | céu, morros verdes, canteiros em faixas, cerca, açude | agricultora (andar), jumento (andar), asa-branca (voar) |
| gelo | céu, montanhas geladas, cristais hexagonais lado a lado, neve (círculos) | pinguim (andar), raposa-do-ártico (andar), coruja-das-neves (voar) |
| fogo | céu escuro, vulcão, rios de lava, faíscas (círculos) | salamandra (andar), ferreiro (andar), fênix (voar) |
| rio | céu, mata das margens, cachoeira, correnteza em faixas, pedras | jangadeiro (nadar), peixe (saltar), garça (andar) |
| cidade | céu noturno, prédios com janelas acesas, guindaste | operária (andar), robozinho (andar), gato (andar) |
| jardim | céu claro, canteiros de flores, arco | jardineira (andar), borboleta (voar), beija-flor (voar) |

- [ ] **Step 1: Escrever o teste que falha**

`tests/cenarios.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `rtk proxy npx vitest run tests/cenarios.test.js`
Expected: FAIL, com `Failed to resolve import "../src/ui/cenarios/index.js"`.

- [ ] **Step 3: `src/ui/cenarios/index.js`**

```js
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
  return `<div class="cenario cenario-${c.id}" aria-hidden="true"><div class="cenario-fundo">${c.fundo}</div>${personagens}</div>`;
}
```

- [ ] **Step 4: `src/ui/cenarios/sertao.js` (a referência de estilo)**

```js
// 🌵 Sertão (o cenário "normal"): sol, serra, chão de terra e mandacarus.
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const mandacaru = (x, y, e) => `<g transform="translate(${x} ${y}) scale(${e})" ${f(5)}>
  <rect x="-6" y="-60" width="12" height="60" rx="6"/><rect x="-22" y="-42" width="10" height="26" rx="5"/>
  <rect x="-22" y="-22" width="20" height="8" rx="4"/><rect x="12" y="-50" width="10" height="30" rx="5"/>
  <rect x="2" y="-26" width="20" height="8" rx="4"/></g>`;

export const sertao = {
  id: 'sertao',
  nome: 'Sertão',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <circle cx="320" cy="90" r="38" style="fill:#fff3c4;opacity:.8"/>
  <path d="M0 260 L70 190 L130 240 L210 170 L290 230 L350 185 L400 220 V600 H0Z" ${f(2)}/>
  <path d="M0 330 L90 280 L170 320 L260 270 L340 310 L400 290 V600 H0Z" ${f(3)}/>
  <path d="M0 380 Q200 350 400 380 V600 H0Z" ${f(4)}/>
  ${mandacaru(40, 470, 1)}${mandacaru(360, 430, 0.8)}${mandacaru(330, 560, 1.1)}
</svg>`,
  personagens: [
    { id: 'vaqueiro', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="9" rx="11" ry="3" ${p(1)}/><path d="M13 9 Q20 0 27 9Z" ${p(1)}/>
  <circle cx="20" cy="13" r="4" style="fill:#c68b59"/><rect x="15" y="17" width="10" height="11" rx="3" ${p(2)}/>
  <rect x="15" y="28" width="4" height="10" ${p(3)}/><rect x="21" y="28" width="4" height="10" ${p(3)}/></svg>` },
    { id: 'cabrita', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="18" cy="22" rx="11" ry="7" style="fill:#f1ece2"/><circle cx="30" cy="16" r="5" style="fill:#f1ece2"/>
  <path d="M30 11 L27 5 M32 11 L33 5" style="stroke:#7a5c3a;stroke-width:2"/>
  <rect x="10" y="27" width="3" height="10" style="fill:#7a5c3a"/><rect x="23" y="27" width="3" height="10" style="fill:#7a5c3a"/></svg>` },
    { id: 'calango', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="28" rx="10" ry="4" style="fill:#7c9a3d"/><circle cx="31" cy="27" r="3.5" style="fill:#7c9a3d"/>
  <path d="M10 28 Q2 30 1 36" style="stroke:#7c9a3d;stroke-width:3;fill:none"/>
  <path d="M15 31 L13 36 M25 31 L27 36" style="stroke:#5d7a2b;stroke-width:2"/></svg>` },
  ],
};
```

- [ ] **Step 5: Os outros seis cenários**

Para `vale.js`, `gelo.js`, `fogo.js`, `rio.js`, `cidade.js` e `jardim.js`, escreva cada arquivo
com a mesma estrutura do `sertao.js`:
- os helpers `f` e `p`;
- `export const <id> = { id, nome, fundo, personagens }`;
- a composição e os movimentos da tabela da Task 1.

Os nomes são "Vale verde", "Gelo", "Fogo", "Rio e cachoeira", "Cidade à noite" e "Jardim
florido". Os personagens são desenhos simples (círculo, elipse, retângulo, caminho), de 40×40,
legíveis em 48px.

- [ ] **Step 6: Rodar e ver passar**

Run: `rtk proxy npx vitest run tests/cenarios.test.js`
Expected: PASS em todos, com os 7 cenários e o caso do id desconhecido.

- [ ] **Step 7: Commit**

```bash
git add src/ui/cenarios tests/cenarios.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Cenários da trilha: os 7 cenários e seus personagens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Cenários na trilha, CSS e mapa (python-playground)

**Files:**
- Create: `src/conteudo/cenarios.js` (o mapa deste site) e `src/cenarios.css`
- Modify:
  - `src/main.js`: `import './cenarios.css';` depois de `import './caminho.css';`;
  - `src/ui/inicio.js`: a função `unidade(m, anterior, atual, cert)`, que gera a `section.bloco-unidade`.
- Test: `tests/cenarios-trilha.test.js`

**Interfaces:**
- Consumes: `htmlDoCenario(id)` da Task 1.
- Produces: `CENARIO_DO_MODULO: { [moduloId]: cenarioId }` em `src/conteudo/cenarios.js`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/cenarios-trilha.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `rtk proxy npx vitest run tests/cenarios-trilha.test.js`
Expected: FAIL, com `Failed to resolve import "../src/conteudo/cenarios.js"`.

- [ ] **Step 3: O mapa do site, `src/conteudo/cenarios.js` (DivergePython)**

```js
// Cenário de mapa de cada módulo na trilha (src/ui/cenarios). Cada site tem o seu mapa;
// os módulos que ainda vão chegar já têm cenário reservado.
export const CENARIO_DO_MODULO = {
  basico: 'sertao',
  dados: 'vale',
  paralelismo: 'gelo',
  pyspark: 'fogo',
  alem: 'rio',
  projetos: 'cidade',
};
```

- [ ] **Step 4: A camada na trilha, em `src/ui/inicio.js`**

Nos imports:

```js
import { CENARIO_DO_MODULO } from '../conteudo/cenarios.js';
import { htmlDoCenario } from './cenarios/index.js';
```

Na função `unidade`, troque o `return` da `section`:

```js
  const cenario = htmlDoCenario(CENARIO_DO_MODULO[m.id]);
  return `
    <section class="bloco-unidade ${cenario ? 'com-cenario' : ''} ${m.desbloqueado ? '' : 'bloqueada'} ${atual ? 'unidade-atual' : ''}" id="unidade-${m.id}" aria-labelledby="titulo-${m.id}">
      ${cenario}
      ${cabecalho.replace('<h2>', `<h2 id="titulo-${m.id}">`)}
      <ol class="trilha" id="trilha-${m.id}">${nos}${trofeu(m, cert)}</ol>
    </section>`;
```

O `${cenario}` vem logo depois da tag de abertura, sem espaço em branco antes, para ser o
`firstElementChild`.

- [ ] **Step 5: `src/cenarios.css`**

```css
/* Cenários da trilha (src/ui/cenarios): decoração atrás do caminho de cada módulo. Nunca
   recebe clique nem foco, e o caminho, os nós e os rótulos mantêm as cores de sempre. */
.com-cenario { position: relative; isolation: isolate; padding-bottom: 18px; }
.cenario {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: 14px;
  pointer-events: none;
}
.cenario-fundo, .cenario-fundo svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.cenario-fundo { opacity: .45; }
/* Véu atrás do texto: o cabeçalho do módulo e a legenda de cada nó ficam legíveis sobre o desenho. */
.com-cenario .unidade { background: color-mix(in srgb, var(--cor) 10%, var(--fundo)); }
.com-cenario .legenda { background: color-mix(in srgb, var(--fundo) 88%, transparent); border-radius: 6px; padding: 0 6px; }

/* Personagens: três faixas fora da coluna do caminho; cada um vai e volta devagar. */
.personagem { position: absolute; width: 48px; height: 48px; will-change: transform; }
.personagem svg { width: 100%; height: 100%; display: block; }
.personagem-1 { left: 3%; top: 30%; --faixa: 18vw; animation: cen-andar 28s linear infinite alternate; }
.personagem-2 { right: 3%; top: 58%; --faixa: -16vw; animation: cen-andar 34s linear infinite alternate; animation-delay: -9s; }
.personagem-3 { left: 6%; top: 82%; --faixa: 14vw; animation: cen-andar 24s linear infinite alternate; animation-delay: -4s; }
.personagem .corpo { display: block; width: 100%; height: 100%; animation: cen-passo .6s ease-in-out infinite alternate; }
.mov-voar { top: 12%; }
.mov-voar .corpo { animation: cen-voo 3s ease-in-out infinite alternate; }
.mov-nadar .corpo { animation: cen-boia 2.4s ease-in-out infinite alternate; }
.mov-saltar .corpo { animation: cen-salto 2s ease-in-out infinite; }
@media (min-width: 900px) {
  .personagem-1 { --faixa: 120px; }
  .personagem-2 { --faixa: -110px; }
  .personagem-3 { --faixa: 100px; }
}
@keyframes cen-andar { from { transform: translateX(0); } to { transform: translateX(var(--faixa)); } }
@keyframes cen-passo { from { transform: translateY(0); } to { transform: translateY(-2px); } }
@keyframes cen-voo { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-10px) rotate(3deg); } }
@keyframes cen-boia { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(3px) rotate(2deg); } }
@keyframes cen-salto { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-18px) rotate(-20deg); } }

@media (max-width: 599px) {
  .personagem-2, .personagem-3 { display: none; }
  .personagem-1 { --faixa: 10vw; width: 40px; height: 40px; }
}

/* Módulo bloqueado: cenário desbotado e personagens parados. */
.bloqueada .cenario { filter: grayscale(1); opacity: .2; }
.bloqueada .personagem, .bloqueada .personagem .corpo { animation: none; }

/* Menos movimento: tudo parado (o painel ♿ também zera tudo em estilo.css). */
@media (prefers-reduced-motion: reduce) {
  .personagem, .personagem .corpo { animation: none; }
}

/* Temas. */
[data-tema="suave"] .cenario { filter: saturate(.5) brightness(.9); }
[data-tema="alto-contraste"] .personagem, [data-tema="alto-contraste"] .personagem .corpo { animation: none; }
[data-tema="alto-contraste"] .cenario-fundo { opacity: 1; }
[data-tema="alto-contraste"] .cenario-fundo svg *,
[data-tema="alto-contraste"] .personagem svg * { fill: none !important; stroke: var(--suave) !important; stroke-width: 1px; }

/* Paleta de cada cenário (céu, distante, meio, chão, detalhe; e personagens). */
.cenario-sertao { --cen-1: #f6c56b; --cen-2: #c8794a; --cen-3: #8a9a4b; --cen-4: #d9a066; --cen-5: #3f7d3a; --per-1: #6b4226; --per-2: #b5562d; --per-3: #3d2a1c; }
.cenario-vale { --cen-1: #a8d8ea; --cen-2: #6fa86a; --cen-3: #8fc46a; --cen-4: #7a5c3a; --cen-5: #3d8bd9; --per-1: #f2c14e; --per-2: #8a8a8a; --per-3: #2f4f2f; }
.cenario-gelo { --cen-1: #cfe8f5; --cen-2: #9cc3dc; --cen-3: #e8f4fa; --cen-4: #ffffff; --cen-5: #7fb3d5; --per-1: #1d2b3a; --per-2: #f4f4f4; --per-3: #f2a03d; }
.cenario-fogo { --cen-1: #3b1a1a; --cen-2: #6b2a1f; --cen-3: #a0391e; --cen-4: #2a1410; --cen-5: #ff8c1a; --per-1: #ff6b35; --per-2: #8c4a2f; --per-3: #ffd23f; }
.cenario-rio { --cen-1: #9fd3e6; --cen-2: #5c8f5a; --cen-3: #3b8fc2; --cen-4: #6a8f4f; --cen-5: #e8f6ff; --per-1: #c9a66b; --per-2: #e86a33; --per-3: #f4f4f4; }
.cenario-cidade { --cen-1: #1b1f3a; --cen-2: #2d3358; --cen-3: #3e4675; --cen-4: #222640; --cen-5: #ffd166; --per-1: #f28c28; --per-2: #9aa5b1; --per-3: #3a3a3a; }
.cenario-jardim { --cen-1: #f2e6f7; --cen-2: #a6d49f; --cen-3: #e98fb5; --cen-4: #7fae6e; --cen-5: #f5c542; --per-1: #8e5bd1; --per-2: #ff8fab; --per-3: #2ec4b6; }
```

- [ ] **Step 6: Importar o CSS em `src/main.js`**

Depois de `import './caminho.css';`, acrescente `import './cenarios.css';`.

- [ ] **Step 7: Rodar e ver passar**

Run: `rtk proxy npx vitest run tests/cenarios-trilha.test.js tests/cenarios.test.js tests/tutorial.test.js`
Expected: PASS. O `tutorial.test.js` garante que os alvos do tutorial continuam existindo.

- [ ] **Step 8: Suíte, lint e commit**

- Run: `rtk proxy npm test`
  Expected: tudo passa.
- Run: `npx eslint . -f json -o $TEMP/lint.json`, depois conte os problemas.
  Expected: `0`.

```bash
git add src/conteudo/cenarios.js src/cenarios.css src/main.js src/ui/inicio.js tests/cenarios-trilha.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Trilha: cenário de mapa e personagens em cada módulo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Revisão de 2026-10-15: tiles estilo Tibia e física (Tasks 2a, 2b e 2c)

Na primeira conferência, o usuário pediu tiles em pixel art no estilo do Tibia e personagens andando
de tile em tile, com colisão. A spec foi revisada (seção "Como funciona"). As Tasks 1 e 2 já feitas
continuam valendo: o palco sticky, o mapa do site, a camada na trilha e os testes de acessibilidade.
As tarefas abaixo trocam o desenho vetorial pelos tiles e o deslize em CSS pela física. A Task 3
(conferência) roda depois delas.

**Interfaces novas** (todas em `src/ui/cenarios/`):
- `pixel.js`:
  - `LADO = 16`;
  - `sprite(paleta, texto) → { paleta, linhas }` (lança erro se não for 16×16 ou se usa cor fora da paleta);
  - `passo(sprite, movimento) → sprite` (o 2º quadro: pernas deslocadas 1px, ou asas 1px acima);
  - `desenharSprite(ctx, sprite, x, y, { escala = 2, espelhar = false, cor })`.
- `mapa.js`:
  - `TILE = 32`;
  - `sorteador(semente) → () => número em [0, 1)` (mulberry32 sobre o hash do texto);
  - `colunasDaEstrada(colunas, raio = 112) → número[]`;
  - `gerarMapa({ colunas, linhas, cenario, semente }) → { colunas, linhas, tiles: [{ tipo: 'chao'|'estrada'|'bloqueio'|'objeto', variante }] }`;
  - `tileEm(mapa, c, l) → tile | null`.
- `fisica.js`:
  - `podePisar(mapa, movimento, c, l) → boolean`;
  - `proximoPasso(p, mapa, sortear) → p'`, em que `p = { c, l, movimento, direcao: [dc, dl], quadro: 0|1, parado }`;
  - `posicoesIniciais(mapa, personagens, sortear) → (p | null)[]`.
- `palco.js`: `ligarCenarios(raiz, { janela = window } = {}) → { desligar() }`.
- **Cenário:**
  - `{ id, nome, chao: { cores: [base, escuro, claro], pesos: [6, 3, 1] }, estrada: { cores, padrao: 'terra'|'tabuas'|'pedras'|'liso' }, bloqueio: { cor, borda, brilho } | null, objetos: [sprite…], personagens: [{ id, movimento, quadros: [sprite, sprite] }] }`;
  - as variações do chão e da estrada são texturas geradas por código, com semente, a partir das cores;
  - só objetos e personagens são desenhados à mão.

#### Task 2a: Pixel art, mapa e física (puros)

**Files:** criar `src/ui/cenarios/pixel.js`, `mapa.js` e `fisica.js`; os testes ficam em
`tests/cenarios-mapa.test.js` e `tests/cenarios-fisica.test.js`.

- [ ] **Step 1: Testes que falham**

`tests/cenarios-mapa.test.js`:

```js
// Mapa de tiles dos cenários: determinístico, com a estrada embaixo dos nós e espaço livre dos dois lados.
import { describe, it, expect } from 'vitest';
import { gerarMapa, colunasDaEstrada, sorteador, tileEm, TILE } from '../src/ui/cenarios/mapa.js';
import { sprite, passo, LADO } from '../src/ui/cenarios/pixel.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';

const mapaDe = (id, colunas = 40, linhas = 25, semente = 'basico') => gerarMapa({ colunas, linhas, cenario: CENARIOS[id], semente });

describe('pixel art', () => {
  it('sprite valida 16×16 e as cores', () => {
    const linha = '.'.repeat(LADO);
    expect(() => sprite({ a: '#000' }, Array(LADO).fill(linha).join('\n'))).not.toThrow();
    expect(() => sprite({ a: '#000' }, Array(15).fill(linha).join('\n'))).toThrow('16×16');
    expect(() => sprite({ a: '#000' }, [...Array(15).fill(linha), `b${'.'.repeat(15)}`].join('\n'))).toThrow('fora da paleta');
  });

  it('o 2º quadro da caminhada é diferente do 1º e continua 16×16', () => {
    const s = CENARIOS.sertao.personagens[0].quadros[0];
    const b = passo(s, 'andar');
    expect(b.linhas).toHaveLength(LADO);
    expect(b.linhas.every((l) => l.length === LADO)).toBe(true);
    expect(b.linhas.join('')).not.toBe(s.linhas.join(''));
  });
});

describe('mapa', () => {
  it('sorteador é determinístico pela semente', () => {
    const a = sorteador('pyspark'); const b = sorteador('pyspark'); const c = sorteador('dados');
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
  });

  it('a mesma semente gera o mesmo mapa', () => {
    expect(mapaDe('sertao')).toEqual(mapaDe('sertao'));
    expect(mapaDe('sertao', 40, 25, 'outro')).not.toEqual(mapaDe('sertao'));
  });

  it('a estrada cobre a faixa dos nós (±112px do centro)', () => {
    const cols = colunasDaEstrada(40);
    const centro = (40 * TILE) / 2;
    expect(cols.some((c) => c * TILE <= centro - 100)).toBe(true);
    expect(cols.some((c) => (c + 1) * TILE >= centro + 100)).toBe(true);
  });

  it.each(Object.keys(CENARIOS))('%s: a estrada é só estrada, e há chão livre dos dois lados', (id) => {
    for (const [colunas, linhas] of [[40, 25], [11, 17]]) {
      const m = mapaDe(id, colunas, linhas);
      const estrada = new Set(colunasDaEstrada(colunas));
      for (let l = 0; l < linhas; l++) {
        for (let c = 0; c < colunas; c++) {
          expect(tileEm(m, c, l).tipo === 'estrada').toBe(estrada.has(c));
        }
      }
      const livres = (lado) => m.tiles.filter((t, i) => t.tipo === 'chao' && (lado ? i % colunas > Math.max(...estrada) : i % colunas < Math.min(...estrada))).length;
      expect(livres(false)).toBeGreaterThanOrEqual(linhas);
      expect(livres(true)).toBeGreaterThanOrEqual(linhas);
    }
  });

  it('cenários com área bloqueada têm manchas; os outros não', () => {
    for (const [id, c] of Object.entries(CENARIOS)) {
      const tem = mapaDe(id).tiles.some((t) => t.tipo === 'bloqueio');
      expect(tem, id).toBe(Boolean(c.bloqueio));
    }
  });
});
```

`tests/cenarios-fisica.test.js`:

```js
// Física dos personagens: um tile por passo, nas 4 direções, sem pisar onde não pode.
import { describe, it, expect } from 'vitest';
import { gerarMapa, sorteador, tileEm } from '../src/ui/cenarios/mapa.js';
import { proximoPasso, posicoesIniciais, podePisar } from '../src/ui/cenarios/fisica.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';

function simular(id, passos = 2000) {
  const c = CENARIOS[id];
  const mapa = gerarMapa({ colunas: 40, linhas: 25, cenario: c, semente: id });
  const sortear = sorteador(`fisica-${id}`);
  let ps = posicoesIniciais(mapa, c.personagens, sortear);
  const historico = ps.map((p) => (p ? [p] : []));
  for (let i = 0; i < passos; i++) {
    ps = ps.map((p, k) => {
      if (!p) return p;
      const q = proximoPasso(p, mapa, sortear);
      historico[k].push(q);
      return q;
    });
  }
  return { mapa, historico, c };
}

describe('física', () => {
  it.each(Object.keys(CENARIOS))('%s: ninguém pisa onde não pode, e todo passo é para um vizinho', (id) => {
    const { mapa, historico, c } = simular(id);
    historico.forEach((h, k) => {
      const mov = c.personagens[k].movimento;
      for (let i = 0; i < h.length; i++) {
        const p = h[i];
        expect(podePisar(mapa, mov, p.c, p.l), `${id}/${c.personagens[k].id} em ${p.c},${p.l}`).toBe(true);
        expect(tileEm(mapa, p.c, p.l).tipo).not.toBe('estrada');
        if (i > 0) expect(Math.abs(p.c - h[i - 1].c) + Math.abs(p.l - h[i - 1].l)).toBeLessThanOrEqual(1);
      }
    });
  });

  it('quem anda nunca entra na água; voadores podem; peixe e jangadeiro nunca saem dela', () => {
    const { mapa } = simular('rio', 1);
    const agua = mapa.tiles.findIndex((t) => t.tipo === 'bloqueio');
    const [c, l] = [agua % mapa.colunas, Math.floor(agua / mapa.colunas)];
    expect(podePisar(mapa, 'andar', c, l)).toBe(false);
    expect(podePisar(mapa, 'voar', c, l)).toBe(true);
    expect(podePisar(mapa, 'nadar', c, l)).toBe(true);
    const chao = mapa.tiles.findIndex((t) => t.tipo === 'chao');
    expect(podePisar(mapa, 'nadar', chao % mapa.colunas, Math.floor(chao / mapa.colunas))).toBe(false);
  });

  it('os personagens se mexem (não ficam parados para sempre) e viram para onde andam', () => {
    const { historico } = simular('sertao', 200);
    const vaqueiro = historico[0];
    const andou = new Set(vaqueiro.map((p) => `${p.c},${p.l}`)).size;
    expect(andou).toBeGreaterThan(10);
    const passo = vaqueiro.find((p, i) => i > 0 && !p.parado);
    expect(Math.abs(passo.direcao[0]) + Math.abs(passo.direcao[1])).toBe(1);
  });
});
```

- [ ] **Step 2:** rodar e ver falhar: `rtk proxy npx vitest run tests/cenarios-mapa.test.js tests/cenarios-fisica.test.js` (os módulos não existem).

- [ ] **Step 3: Implementar.**
  - `pixel.js`: o `sprite` divide o texto em linhas aparadas, valida 16×16 e a paleta (`.` é
    transparente). O `passo` desloca 1px para os lados, alternado, as 4 últimas linhas (pernas) no
    `andar` e no `nadar`, e sobe 1px as linhas 4 a 9 (asas) no `voar` e no `saltar`. O
    `desenharSprite` usa `fillRect` por pixel.
  - `mapa.js`:
    - estrada nas colunas de `colunasDaEstrada`;
    - chão com a variante sorteada pelos pesos;
    - quando há `bloqueio`, de 2 a 3 manchas elípticas de raio 1 a 2 tiles, só em tiles de chão a
      ≥ 2 colunas da estrada;
    - objetos em ~6% dos tiles de chão restantes, também a ≥ 2 colunas da estrada.
  - `fisica.js`:
    - `podePisar`: estrada ou fora do mapa dá falso; `voar` pode o resto; `nadar` e `saltar` só no
      `bloqueio`; `andar` só no `chao`;
    - `proximoPasso`: com 20% de chance fica parado; senão tenta a mesma direção (70%) e, depois, as
      outras em ordem sorteada; o 1º vizinho onde pode pisar vira o passo
      (`quadro = 1 - quadro`, `parado = false`); se nenhum der, fica parado;
    - `posicoesIniciais`: para cada personagem, sorteia um tile onde pode pisar (pares à esquerda
      da estrada, ímpares à direita), com até 200 tentativas; se não achar, devolve `null`.

- [ ] **Step 4:** rodar e ver passar; commit "Cenários: pixel art, mapa de tiles e física (puros)".

#### Task 2b: Os 7 cenários em pixel art

**Files:** reescrever `src/ui/cenarios/<id>.js` (os 7) e ajustar `tests/cenarios.test.js`.

- [ ] **Step 1: ajustar o teste** (falha com o formato antigo):
  - cada cenário tem `chao.cores` (3), `chao.pesos` (3), `estrada.padrao` em
    `['terra', 'tabuas', 'pedras', 'liso']`, `objetos` com 2 a 3 sprites válidos e 3 personagens
    com `quadros` de 2 sprites válidos;
  - os cenários com `bloqueio` são `sertao`, `vale`, `gelo`, `fogo` e `rio`;
  - o tamanho é `JSON.stringify(cenario).length ≤ 12 * 1024`;
  - `htmlDoCenario` continua com `aria-hidden`, sem texto, sem foco e sem ids, e traz
    `data-cenario` e `data-semente`.
- [ ] **Step 2:** reescrever os 7 arquivos com objetos e personagens 16×16 desenhados à mão (a
  tabela da spec). O 2º quadro de cada personagem é `passo(quadro1, movimento)`. O `htmlDoCenario`
  passa a devolver
  `<div class="cenario cenario-<id>" aria-hidden="true" data-cenario="<id>" data-semente="<moduloId ou id>"><div class="cenario-palco"></div></div>`,
  e `htmlDoCenario(id, semente = id)` recebe o id do módulo como semente.
- [ ] **Step 3:** rodar `tests/cenarios.test.js`, `tests/cenarios-mapa.test.js` e
  `tests/cenarios-fisica.test.js`, e ver passar; commit "Cenários: os 7 cenários em pixel art".

#### Task 2c: O palco no navegador (canvas, temporizador e CSS)

**Files:** criar `src/ui/cenarios/palco.js`; alterar `src/ui/inicio.js` (chamar `ligarCenarios`
e passar `m.id` como semente), `src/cenarios.css` e `tests/cenarios-trilha.test.js`.

- [ ] **Step 1: testes que falham** em `tests/cenarios-trilha.test.js`:
  - com uma `janela` falsa (`setInterval`/`clearInterval` contados, `IntersectionObserver` falso,
    `matchMedia` configurável e `innerWidth`), o `ligarCenarios` cria 1 temporizador no caso normal;
  - não cria nenhum temporizador com `prefers-reduced-motion`, com a classe `a11y-sem-movimento`,
    com `data-tema="alto-contraste"` nem sem `IntersectionObserver`;
  - o `desligar()` chama `clearInterval` e o `disconnect` dos observadores;
  - com `innerWidth` 375, só 1 personagem por cenário (`.personagem` dentro de cada palco);
  - o CSS tem `image-rendering: pixelated` no `.cenario-mapa` e no `.personagem canvas`, a
    `transition: transform` no `.personagem`, a regra que zera a transição com
    `prefers-reduced-motion`, e mantém `pointer-events: none`, o palco sticky e o véu da legenda.
- [ ] **Step 2: Implementar `palco.js`.**
  - Por camada:
    - cria `canvas.cenario-mapa` no palco, mede o palco (`clientWidth` e `clientHeight`, mínimo
      1 tile), gera o mapa e o desenha;
    - o chão e a estrada são texturas com semente; a área bloqueada tem cor, pontos de brilho e
      borda de 2px nos lados que tocam o chão; os objetos são sprites. No alto contraste, só o
      contorno das áreas bloqueadas e dos objetos, na cor `--suave`;
    - cria os personagens (`span.personagem.personagem-N.mov-X > canvas` de 32×32), nas posições
      iniciais, com `transform: translate(c*32px, l*32px)` (voadores 8px acima, com sombra pelo CSS).
  - Um `setInterval` de 400 ms para todas as camadas. A cada passo:
    - não faz nada se `document.hidden` estiver ligado, ou se o movimento reduzido foi ligado depois;
    - em cada camada visível e não bloqueada, aplica `proximoPasso`, atualiza o `transform`, troca
      o quadro e espelha o sprite pela direção;
    - de vez em quando, o peixe ganha a classe `saltando` por 400 ms.
  - O `IntersectionObserver` marca as camadas visíveis.
  - Um `resize` com espera de 200 ms refaz os mapas.
  - Um `MutationObserver` em `data-tema` e `class` do `<html>` redesenha (e para tudo se o
    movimento reduzido for ligado).
  - Sem `getContext('2d')` (happy-dom), pula o desenho, mas mantém a lógica.
- [ ] **Step 3: CSS.**
  - Sai: o deslize em `@keyframes`, a `.cenario-fundo` e as faixas `--faixa`.
  - Entra:
    - `.cenario-mapa` (absoluto, 100%, opacidade .45, pixelado);
    - `.personagem` (absoluto em 0,0, 32×32, `transition: transform .4s linear`);
    - `.personagem canvas` (pixelado);
    - `.mov-voar::after` (sombra oval);
    - `.saltando canvas` (`cen-salto` .4s);
    - a transição zerada com `prefers-reduced-motion`, `a11y-sem-movimento` e alto contraste.
  - Os temas, o véu e o palco continuam.
- [ ] **Step 4:** em `inicio.js`, `htmlDoCenario(CENARIO_DO_MODULO[m.id], m.id)`; no fim de
  `renderInicio`, `desligarCenarios?.(); desligarCenarios = ligarCenarios(el).desligar;`.
- [ ] **Step 5:** suíte inteira, lint e commit "Cenários: mapa em canvas e personagens andando de
  tile em tile".

### Task 3: Conferência visual e axe (python-playground)

**Files:** só os ajustes de `src/cenarios.css` e dos desenhos que a conferência pedir.

- [ ] **Step 1: Build e preview**

Run: o build com o segredo descartável e `preview_start` com o nome `python-playground` (porta 4176).
Expected: a trilha abre com os cenários.

- [ ] **Step 2: Conferência**

Com um progresso de teste que desbloqueie os 4 módulos:
1. Em cada um dos 4 temas, tire um screenshot de cada módulo. Confira:
   - legendas e cabeçalhos legíveis;
   - personagens fora da coluna dos nós;
   - nada cortado.
2. Rode o axe (WCAG 2.2 AA) na trilha nos 4 temas.
   Expected: 0 violações.
3. A 375px: só 1 personagem por cenário, sem rolagem horizontal
   (`document.documentElement.scrollWidth <= innerWidth`).
4. Ligue "reduzir movimento" no painel ♿ e confira que nada anima:
   `getComputedStyle(personagem).animationName === 'none'`.
5. Clique num nó por cima de onde passa um personagem e confira que abre o exercício.

- [ ] **Step 3: Ajustes e commit**

Se a conferência pedir ajuste de cor, posição ou opacidade, ajuste e repita os itens 1 e 2.

```bash
git add src/cenarios.css src/ui/cenarios
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Cenários: ajustes da conferência visual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Se nada precisar mudar, não há commit: registre "conferência sem ajustes" no ledger.

### Task 4: DivergePHP 1.7.0 (php-playground)

**Files:**
- Copy:
  - do python, iguais: `src/ui/cenarios/` (a pasta inteira), `src/cenarios.css`,
    `tests/cenarios.test.js` e `tests/cenarios-trilha.test.js`;
  - a spec, para `docs/superpowers/specs/`.
- Create: `src/conteudo/cenarios.js`, com o mapa do PHP.
- Modify:
  - `src/main.js`, com `import './cenarios.css';`;
  - `src/ui/inicio.js`, com os imports e o `return` da Task 2, Step 4;
  - `package.json`, `src/novidades.js` e `README.md`, com a versão 1.7.0.

- [ ] **Step 1: Copiar os testes e ver falhar**

```bash
mkdir -p tests && cp ../python-playground/tests/cenarios.test.js ../python-playground/tests/cenarios-trilha.test.js tests/
rtk proxy npx vitest run tests/cenarios.test.js tests/cenarios-trilha.test.js
```

Expected: FAIL, com `Failed to resolve import "../src/ui/cenarios/index.js"`.

- [ ] **Step 2: Aplicar**

```bash
cp -r ../python-playground/src/ui/cenarios src/ui/ && cp ../python-playground/src/cenarios.css src/
cp ../python-playground/docs/superpowers/specs/2026-10-15-cenarios-da-trilha-design.md docs/superpowers/specs/
```

`src/conteudo/cenarios.js`:

```js
// Cenário de mapa de cada módulo na trilha (src/ui/cenarios). Cada site tem o seu mapa.
export const CENARIO_DO_MODULO = {
  html: 'sertao',
  w3css: 'jardim',
  php: 'fogo',
  pdo: 'gelo',
  projetos: 'cidade',
};
```

Em `src/main.js` e `src/ui/inicio.js`, faça as mesmas mudanças da Task 2, Steps 4 e 6.

- [ ] **Step 3: Rodar e ver passar**

Run: `rtk proxy npx vitest run tests/cenarios.test.js tests/cenarios-trilha.test.js tests/tutorial.test.js`
Expected: PASS.

- [ ] **Step 4: Release 1.7.0**

No topo de `RELEASES` em `src/novidades.js`:

```js
  {
    versao: '1.7.0',
    data: '2026-10-15',
    titulo: 'A trilha virou um mapa',
    resumo: 'Cada módulo da trilha tem agora o seu cenário, com personagens andando por ele.',
    grupos: [
      { titulo: '🗺️ Cenários', itens: ['HTML no sertão, W3.CSS num jardim florido, PHP no fogo da forja, PDO no gelo e Projetos na cidade à noite.', 'Personagens andam por cada cenário: vaqueiro, borboleta, salamandra, pinguim, robozinho e outros.'] },
      { titulo: '♿ Acessibilidade', itens: ['Os cenários são só decoração: o leitor de tela não os lê e o caminho mantém as cores e o contraste.', 'Com "reduzir movimento" (no sistema ou no painel ♿), os personagens ficam parados. No alto contraste, o cenário vira contorno.'] },
    ],
  },
```

- Run: `npm version 1.7.0 --no-git-tag-version`.
- No README, perto da descrição da trilha: "**🗺️ Cenários**: cada módulo tem um cenário de mapa
  com personagens andando (decoração escondida do leitor de tela; para com 'reduzir movimento')."

- [ ] **Step 5: Suíte, lint, build e conferência**

Os mesmos comandos da Task 2, Step 8, e a conferência da Task 3, com o preview `php-playground`
(porta 4173).

- [ ] **Step 6: Commits**

```bash
git add src tests/cenarios.test.js tests/cenarios-trilha.test.js docs/superpowers/specs
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Trilha: cenário de mapa e personagens em cada módulo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add package.json package-lock.json src/novidades.js README.md
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 1.7.0: a trilha virou um mapa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: DivergeTerraform 1.8.0 (terraform-playground)

São os passos da Task 4 no `terraform-playground`, com estas diferenças:

- A versão é `1.8.0`, e a pasta `docs/superpowers/specs/` já existe.
- O mapa é:

```js
// Cenário de mapa de cada módulo na trilha (src/ui/cenarios). Cada site tem o seu mapa.
export const CENARIO_DO_MODULO = {
  basico: 'sertao',
  aws: 'fogo',
  azure: 'gelo',
  projetos: 'cidade',
};
```

- O primeiro item do grupo "🗺️ Cenários" nas novidades é: "Terraform básico no sertão, AWS no
  fogo de um vulcão, Azure no gelo de uma geleira e Projetos na cidade à noite."
- O preview é o `terraform-playground-preview` (porta 4174).

- [ ] **Step 1:** copie os testes e veja falhar (os comandos da Task 4, Step 1).
- [ ] **Step 2:** aplique (os comandos da Task 4, Step 2, com o mapa acima).
- [ ] **Step 3:** rode e veja passar (o comando da Task 4, Step 3).
- [ ] **Step 4:** release 1.8.0 (a entrada da Task 4, Step 4, com `versao: '1.8.0'` e o item do
  Terraform), `npm version 1.8.0 --no-git-tag-version` e a mesma linha no README.
- [ ] **Step 5:** suíte, lint, build e conferência.
- [ ] **Step 6:** os dois commits da Task 4, com a mensagem `Versão 1.8.0: a trilha virou um mapa`.

### Task 6: Publicar o DivergePHP e o DivergeTerraform (só com o "sim")

- [ ] Apresentar ao usuário as suítes, o axe, os screenshots e os commits.
- [ ] Com o "sim":
  - em cada um dos dois repos, merge no `main`, push, tag anotada `vX.Y.Z` ("Versão X.Y.Z") e
    `gh release create` com as notas da versão;
  - esperar o deploy do Pages e conferir o site publicado.
- [ ] O DivergePython **não** é publicado aqui. Os cenários dele saem na 0.5.0, junto com a fase 5.
