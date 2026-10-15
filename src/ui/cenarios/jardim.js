// 🌸 Jardim florido: canteiros de flores coloridas e um arco (as cores e o estilo do CSS).
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const flor = (x, y, cor) => `<g transform="translate(${x} ${y})"><path d="M0 0 V22" style="stroke:#5c8a4f;stroke-width:2"/>
  <circle cx="-5" cy="0" r="5" style="fill:${cor}"/><circle cx="5" cy="0" r="5" style="fill:${cor}"/>
  <circle cx="0" cy="-5" r="5" style="fill:${cor}"/><circle cx="0" cy="5" r="5" style="fill:${cor}"/><circle r="3" ${f(5)}/></g>`;
const CORES = ['var(--cen-3)', '#f08a5d', '#b983ff', '#f9ed69'];
const flores = Array.from({ length: 12 }, (_, i) => flor(20 + (i % 6) * 72, 430 + Math.floor(i / 6) * 70 + (i % 2) * 12, CORES[i % 4])).join('');

export const jardim = {
  id: 'jardim',
  nome: 'Jardim florido',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <path d="M0 330 Q100 280 200 320 T400 300 V600 H0Z" ${f(2)}/>
  <path d="M150 400 V250 Q200 190 250 250 V400" style="stroke:#9b7653;stroke-width:8;fill:none"/>
  <g style="fill:var(--cen-3)"><circle cx="160" cy="250" r="8"/><circle cx="200" cy="216" r="8"/><circle cx="240" cy="250" r="8"/></g>
  <rect y="400" width="400" height="200" ${f(4)}/>
  ${flores}
</svg>`,
  personagens: [
    { id: 'jardineira', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="8" rx="11" ry="3" style="fill:#e9c46a"/><circle cx="20" cy="12" r="4" style="fill:#c68b59"/>
  <path d="M14 16 L26 16 L28 32 L12 32Z" ${p(1)}/><rect x="15" y="32" width="3" height="6" style="fill:#5a3e2b"/>
  <rect x="22" y="32" width="3" height="6" style="fill:#5a3e2b"/><path d="M27 20 L35 26 L32 30 Z" style="fill:#4caf50"/></svg>` },
    { id: 'borboleta', movimento: 'voar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="13" cy="15" rx="8" ry="7" ${p(2)}/><ellipse cx="27" cy="15" rx="8" ry="7" ${p(2)}/>
  <ellipse cx="14" cy="27" rx="6" ry="5" ${p(1)}/><ellipse cx="26" cy="27" rx="6" ry="5" ${p(1)}/>
  <rect x="19" y="10" width="2" height="22" rx="1" style="fill:#333"/></svg>` },
    { id: 'beija-flor', movimento: 'voar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="18" cy="22" rx="8" ry="4" ${p(3)}/><circle cx="26" cy="19" r="3" ${p(3)}/>
  <path d="M28 19 L39 17" style="stroke:#333;stroke-width:1.5"/><path d="M16 20 Q14 6 22 4 Q20 12 20 20Z" style="fill:#7fdbda"/>
  <path d="M10 23 L3 20 L5 27Z" ${p(3)}/></svg>` },
  ],
};
