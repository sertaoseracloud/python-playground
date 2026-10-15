// 💧 Rio e cachoeira: a correnteza que não para, como o streaming.
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const correnteza = Array.from({ length: 5 }, (_, i) => `<path d="M${-10 + (i % 2) * 40} ${430 + i * 30} q50 -10 100 0 t100 0 t100 0 t100 0" style="stroke:var(--cen-5);stroke-width:3;fill:none;opacity:.7"/>`).join('');
const pedras = [[60, 520, 22], [330, 500, 18], [250, 560, 14]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" style="fill:#7d7466"/>`).join('');

export const rio = {
  id: 'rio',
  nome: 'Rio e cachoeira',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <path d="M0 250 Q50 200 100 230 Q140 190 170 230 L170 400 L0 400Z" ${f(2)}/>
  <path d="M230 230 Q270 190 320 220 Q360 195 400 225 L400 400 L230 400Z" ${f(2)}/>
  <rect x="165" y="215" width="70" height="200" ${f(3)}/>
  <path d="M175 220 V400 M195 220 V400 M215 220 V400" style="stroke:var(--cen-5);stroke-width:3;opacity:.8"/>
  <path d="M0 390 Q200 370 400 390 V600 H0Z" ${f(3)}/>
  <ellipse cx="200" cy="405" rx="60" ry="10" ${f(5)}/>
  ${correnteza}
  <path d="M0 385 Q30 370 60 385 L60 395 L0 395Z M340 385 Q370 370 400 385 L400 395 L340 395Z" ${f(4)}/>
  ${pedras}
</svg>`,
  personagens: [
    { id: 'jangadeiro', movimento: 'nadar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <path d="M4 32 L36 32 L32 36 L8 36Z" ${p(1)}/><path d="M20 30 L20 4" style="stroke:#6b4a35;stroke-width:2"/>
  <path d="M21 5 L34 26 L21 26Z" style="fill:#f4efe4"/><circle cx="13" cy="20" r="3.5" style="fill:#9a6440"/>
  <rect x="10" y="23" width="7" height="9" rx="2" ${p(2)}/></svg>` },
    { id: 'peixe', movimento: 'saltar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="22" rx="11" ry="6" ${p(2)}/><path d="M9 22 L2 16 L2 28Z" ${p(2)}/>
  <circle cx="26" cy="20" r="1.5" style="fill:#222"/><path d="M16 17 Q19 12 23 16" ${p(2)}/></svg>` },
    { id: 'garca', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="17" cy="20" rx="8" ry="5" ${p(3)}/><path d="M23 18 Q28 10 25 4" style="stroke:var(--per-3);stroke-width:3;fill:none"/>
  <circle cx="25" cy="4" r="2.5" ${p(3)}/><path d="M27 4 L35 6 L27 6Z" style="fill:#e6a23c"/>
  <path d="M15 24 L14 38 M19 24 L20 38" style="stroke:#555;stroke-width:1.5"/></svg>` },
  ],
};
