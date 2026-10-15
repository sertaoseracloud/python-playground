// 🔥 Fogo: vulcão, rios de lava e faíscas subindo ("spark" quer dizer faísca).
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const faiscas = [[180, 120], [210, 90], [235, 130], [160, 60], [250, 70], [195, 40], [120, 170], [290, 150]]
  .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${2 + (i % 3)}"/>`).join('');

export const fogo = {
  id: 'fogo',
  nome: 'Fogo',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <path d="M0 360 L120 320 L170 190 L230 190 L280 320 L400 350 V600 H0Z" ${f(2)}/>
  <path d="M170 190 Q200 175 230 190 L222 205 Q200 196 178 205Z" ${f(5)}/>
  <path d="M195 200 Q180 280 150 330 Q190 300 205 240 Q215 300 255 330 Q220 280 205 200Z" ${f(5)}/>
  <path d="M0 420 Q200 390 400 420 V600 H0Z" ${f(3)}/>
  <path d="M0 470 Q90 450 160 490 T400 480 L400 500 Q300 520 160 510 T0 492Z" ${f(5)} />
  <rect y="530" width="400" height="70" ${f(4)}/>
  <g style="fill:var(--cen-5)">${faiscas}</g>
</svg>`,
  personagens: [
    { id: 'salamandra', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="28" rx="11" ry="4" ${p(1)}/><circle cx="32" cy="26" r="4" ${p(1)}/>
  <path d="M9 28 Q2 26 2 20" style="stroke:var(--per-1);stroke-width:3;fill:none"/>
  <circle cx="34" cy="25" r="1" style="fill:#222"/><circle cx="16" cy="26" r="1.5" ${p(3)}/><circle cx="23" cy="26" r="1.5" ${p(3)}/>
  <path d="M14 31 L12 36 M26 31 L28 36" style="stroke:var(--per-1);stroke-width:2"/></svg>` },
    { id: 'ferreiro', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <circle cx="18" cy="9" r="5" style="fill:#b97a4e"/><rect x="12" y="15" width="12" height="13" rx="3" ${p(2)}/>
  <rect x="13" y="20" width="10" height="9" style="fill:#3b2a20"/><rect x="13" y="28" width="4" height="10" style="fill:#3b2a20"/>
  <rect x="19" y="28" width="4" height="10" style="fill:#3b2a20"/><path d="M24 18 L32 10" style="stroke:#6b4a35;stroke-width:2.5"/>
  <rect x="29" y="5" width="8" height="5" rx="1" style="fill:#7d7d7d"/></svg>` },
    { id: 'fenix', movimento: 'voar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="22" rx="7" ry="4" ${p(1)}/><circle cx="28" cy="19" r="3" ${p(1)}/>
  <path d="M30 19 L35 20 L30 21Z" ${p(3)}/><path d="M16 21 Q10 6 2 8 Q10 13 19 22Z" ${p(3)}/>
  <path d="M20 22 Q26 6 34 6 Q27 14 22 23Z" ${p(1)}/><path d="M13 23 Q6 28 4 36 Q10 30 15 25Z" ${p(3)}/></svg>` },
  ],
};
