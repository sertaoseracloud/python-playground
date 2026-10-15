// ❄️ Gelo: montanhas geladas, cristais iguais lado a lado (como processos em paralelo) e neve.
const f = (n) => `style="fill:var(--cen-${n})"`;
const p = (n) => `style="fill:var(--per-${n})"`;
const cristal = (x, y) => `<path d="M${x} ${y - 22} L${x + 13} ${y - 11} L${x + 13} ${y + 11} L${x} ${y + 22} L${x - 13} ${y + 11} L${x - 13} ${y - 11}Z"/>`;
const cristais = Array.from({ length: 7 }, (_, i) => cristal(28 + i * 57, 470)).join('');
const neve = [[40, 60], [120, 140], [210, 80], [300, 160], [360, 50], [80, 230], [250, 250], [170, 30], [330, 280]]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('');

export const gelo = {
  id: 'gelo',
  nome: 'Gelo',
  fundo: `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" focusable="false">
  <rect width="400" height="600" ${f(1)}/>
  <path d="M0 330 L80 200 L150 300 L230 160 L320 290 L400 210 V600 H0Z" ${f(2)}/>
  <path d="M80 200 L100 232 L60 232Z M230 160 L256 202 L204 202Z" style="fill:#fff"/>
  <path d="M0 400 Q200 370 400 400 V600 H0Z" ${f(3)}/>
  <g style="fill:var(--cen-5);opacity:.7">${cristais}</g>
  <rect y="520" width="400" height="80" ${f(4)}/>
  <g style="fill:#fff">${neve}</g>
</svg>`,
  personagens: [
    { id: 'pinguim', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="22" rx="10" ry="14" ${p(1)}/><ellipse cx="20" cy="25" rx="6" ry="10" style="fill:#fff"/>
  <circle cx="17" cy="12" r="1.5" style="fill:#fff"/><circle cx="23" cy="12" r="1.5" style="fill:#fff"/>
  <path d="M18 15 L22 15 L20 18Z" ${p(3)}/><path d="M14 36 L19 36 M21 36 L26 36" style="stroke:var(--per-3);stroke-width:3"/></svg>` },
    { id: 'raposa-do-artico', movimento: 'andar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="18" cy="24" rx="11" ry="6" ${p(2)}/><circle cx="30" cy="19" r="5" ${p(2)}/>
  <path d="M27 15 L28 9 L31 14 M31 14 L34 9 L34 16" style="fill:var(--per-2);stroke:#cfd8dc"/>
  <path d="M7 22 Q-1 18 3 10 Q6 18 10 20Z" ${p(2)}/><circle cx="35" cy="20" r="1.2" style="fill:#333"/>
  <rect x="11" y="28" width="3" height="9" ${p(2)}/><rect x="22" y="28" width="3" height="9" ${p(2)}/></svg>` },
    { id: 'coruja-das-neves', movimento: 'voar', svg: `<svg viewBox="0 0 40 40" focusable="false">
  <ellipse cx="20" cy="22" rx="8" ry="10" ${p(2)}/><path d="M12 20 Q2 12 2 24 Q8 22 13 26Z" ${p(2)}/>
  <path d="M28 20 Q38 12 38 24 Q32 22 27 26Z" ${p(2)}/><circle cx="17" cy="18" r="2.5" ${p(3)}/>
  <circle cx="23" cy="18" r="2.5" ${p(3)}/><path d="M19 22 L21 22 L20 24Z" style="fill:#555"/></svg>` },
  ],
};
