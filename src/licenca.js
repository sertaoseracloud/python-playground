// Política de licenciamento (copyleft). A página #/licenca e o README usam estes dados;
// tests/licenca.test.js confere que toda dependência do site está na lista de terceiros.
//
// Por que AGPL: é a mesma licença copyleft do DivergeTerraform e do DivergePHP, da mesma
// organização. Ela exige publicar o código de versões modificadas oferecidas pela
// internet, que é exatamente como este site é usado. O Python no navegador (Pyodide) é
// MPL-2.0 e o cloudpickle é BSD-3-Clause, ambos compatíveis.

export const ATUALIZADA_EM = '2026-10-12';
export const TITULAR = 'Sertão será cloud';
export const REPOSITORIO = 'https://github.com/sertaoseracloud/python-playground';

export const CODIGO = {
  nome: 'GNU Affero General Public License v3.0 ou posterior',
  spdx: 'AGPL-3.0-or-later',
  url: 'https://www.gnu.org/licenses/agpl-3.0.html',
  arquivo: `${REPOSITORIO}/blob/main/LICENSE`,
};

export const CONTEUDO = {
  nome: 'Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional',
  spdx: 'CC-BY-SA-4.0',
  url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br',
  arquivo: `${REPOSITORIO}/blob/main/LICENSE-CONTEUDO.md`,
  atribuicao: 'DivergePython, Sertão será cloud (CC BY-SA 4.0)',
};

/** Componentes de terceiros que vão junto com o site, com a licença de cada um. */
export const TERCEIROS = [
  { nome: 'Python no navegador (Pyodide)', pacotes: ['pyodide'], licenca: 'MPL-2.0' },
  { nome: 'Envio de funções entre workers (cloudpickle, em python/vendor)', pacotes: [], licenca: 'BSD-3-Clause' },
  { nome: 'Editor de código (CodeMirror)', pacotes: ['codemirror', '@codemirror/lang-python', '@codemirror/language', '@codemirror/state', '@codemirror/view', '@lezer/highlight'], licenca: 'MIT' },
  { nome: 'Assinatura digital (@noble/ed25519, @noble/hashes)', pacotes: ['@noble/ed25519', '@noble/hashes'], licenca: 'MIT' },
  { nome: 'Fontes Fira Code e Atkinson Hyperlegible', pacotes: ['@fontsource/fira-code', '@fontsource/atkinson-hyperlegible'], licenca: 'OFL-1.1' },
  { nome: 'QR Code do PIX (qrcode-generator)', pacotes: ['qrcode-generator'], licenca: 'MIT' },
  { nome: 'Cores do tema Dracula', pacotes: [], licenca: 'MIT' },
];
