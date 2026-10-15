// 🌃 Cidade à noite: prédios em construção, janelas acesas e um guindaste.
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const PREDIOS = [[10, 300, 60], [80, 240, 50], [140, 330, 70], [220, 200, 55], [285, 280, 60], [350, 320, 50]];
const predios = PREDIOS.map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${600 - y}"/>`).join('');
const janelas = PREDIOS.flatMap(([x, y, w], i) => Array.from({ length: 5 }, (_, k) => (k + i) % 3 === 0 ? ''
  : `<rect x="${x + 8 + (k % 2) * (w / 2 - 4)}" y="${y + 16 + Math.floor(k / 2) * 34}" width="9" height="12"/>`)).join('');
const estrelas = [[40, 50], [130, 90], [200, 40], [310, 70], [370, 130], [90, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join('');

export const cidade = {
  id: 'cidade',
  nome: 'Cidade à noite',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <circle cx="330" cy="90" r="24" style="fill:#f4f1de"/><g style="fill:#f4f1de">${estrelas}</g>
  <g ${f(2)}>${predios}</g>
  <g style="fill:var(--cen-5)">${janelas}</g>
  <path d="M250 200 V60 H380 M250 80 L290 60 M370 60 V120" style="stroke:var(--cen-5);stroke-width:4;fill:none"/>
  <rect x="360" y="120" width="20" height="14" ${f(5)}/>
  <rect y="520" width="400" height="80" ${f(4)}/>
  <rect y="548" width="400" height="4" ${f(3)}/>
</svg>`,
  personagens: [
    { id: 'operaria', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <path d="M13 9 Q20 1 27 9Z" style="fill:#f5c518"/><rect x="12" y="8" width="16" height="3" rx="1" style="fill:#f5c518"/>
  <circle cx="20" cy="14" r="4" style="fill:#8d5a3b"/><rect x="14" y="18" width="12" height="11" rx="3" ${p(1)}/>
  <rect x="14" y="29" width="5" height="9" style="fill:#2f3e5c"/><rect x="21" y="29" width="5" height="9" style="fill:#2f3e5c"/></svg>` },
    { id: 'robozinho', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <rect x="11" y="8" width="18" height="13" rx="3" ${p(2)}/><circle cx="16" cy="14" r="2" style="fill:#4dd0e1"/>
  <circle cx="24" cy="14" r="2" style="fill:#4dd0e1"/><path d="M20 8 V3" style="stroke:var(--per-2);stroke-width:2"/>
  <circle cx="20" cy="3" r="1.6" style="fill:#ff5252"/><rect x="13" y="22" width="14" height="10" rx="2" ${p(2)}/>
  <circle cx="15" cy="35" r="3" ${p(3)}/><circle cx="25" cy="35" r="3" ${p(3)}/></svg>` },
    { id: 'gato', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="18" cy="27" rx="10" ry="6" ${p(3)}/><circle cx="29" cy="21" r="5" ${p(3)}/>
  <path d="M25 18 L26 12 L29 16 M30 16 L33 12 L33 19" style="fill:var(--per-3)"/>
  <circle cx="31" cy="21" r="1" style="fill:#c6ff00"/><path d="M8 26 Q2 20 6 14" style="stroke:var(--per-3);stroke-width:3;fill:none"/>
  <rect x="11" y="31" width="3" height="7" ${p(3)}/><rect x="21" y="31" width="3" height="7" ${p(3)}/></svg>` },
  ],
};
