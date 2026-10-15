// 🌱 Vale verde: morros, o roçado em canteiros (os dados em ordem), cerca e açude.
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const canteiros = Array.from({ length: 6 }, (_, i) => `<path d="M${-20 + i * 70} 600 L${60 + i * 52} 400 L${84 + i * 52} 400 L${30 + i * 70} 600Z" ${f(3)}/>`).join('');
const cerca = Array.from({ length: 9 }, (_, i) => `<rect x="${8 + i * 48}" y="368" width="5" height="26"/>`).join('');

export const vale = {
  id: 'vale',
  nome: 'Vale verde',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <circle cx="70" cy="80" r="26" style="fill:#fff6c9;opacity:.9"/>
  <path d="M0 300 Q60 200 130 260 Q210 180 290 250 Q350 205 400 240 V600 H0Z" ${f(2)}/>
  <rect y="390" width="400" height="210" ${f(4)}/>
  ${canteiros}
  <g style="fill:#8b6b45">${cerca}<rect x="0" y="374" width="400" height="4"/><rect x="0" y="386" width="400" height="4"/></g>
  <ellipse cx="320" cy="330" rx="62" ry="18" ${f(5)}/>
</svg>`,
  personagens: [
    { id: 'agricultora', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <path d="M8 10 L32 10 L26 4 L14 4Z" ${p(1)}/><circle cx="20" cy="13" r="4" style="fill:#a8714a"/>
  <path d="M14 17 L26 17 L29 33 L11 33Z" style="fill:#c0392b"/>
  <rect x="15" y="33" width="3" height="6" ${p(3)}/><rect x="22" y="33" width="3" height="6" ${p(3)}/>
  <path d="M28 18 L36 30" style="stroke:#7a5c3a;stroke-width:2"/></svg>` },
    { id: 'jumento', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="18" cy="22" rx="12" ry="7" ${p(2)}/><path d="M28 19 L34 10 L38 13 L33 22Z" ${p(2)}/>
  <path d="M34 10 L33 3 L36 9Z" ${p(2)}/><rect x="9" y="27" width="3" height="11" ${p(2)}/>
  <rect x="24" y="27" width="3" height="11" ${p(2)}/><path d="M6 20 Q2 24 4 30" style="stroke:#6b6b6b;stroke-width:2;fill:none"/></svg>` },
    { id: 'asa-branca', movimento: 'voar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="22" rx="8" ry="4" style="fill:#f4f4f4"/><circle cx="28" cy="20" r="3" style="fill:#f4f4f4"/>
  <path d="M30 20 L35 21 L30 22Z" style="fill:#e6a23c"/>
  <path d="M16 21 Q12 8 4 10 Q12 14 20 22Z" style="fill:#e8e8e8"/><path d="M20 22 Q24 10 30 9 Q26 16 22 23Z" style="fill:#d9d9d9"/></svg>` },
  ],
};
