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
