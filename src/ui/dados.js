// Aba 📦 Dados: os arquivos de entrada do exercício (o aluno lê, não edita). CSV vira
// tabela com legenda e cabeçalho (o leitor de tela anuncia as colunas); o resto, texto.
import { esc } from './util.js';

const MAX_LINHAS = 50;

/** Lê CSV com aspas ("a, b") e aspas dobradas (""). */
export function lerCsv(texto) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === ',') {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

function tabela(nome, texto) {
  const [cabecalho = [], ...corpo] = lerCsv(texto);
  const visiveis = corpo.slice(0, MAX_LINHAS);
  return `
    <div class="tabela-rolagem" tabindex="0" role="region" aria-label="${esc(nome)}">
      <table class="tabela-dados">
        <caption>${esc(nome)} <small>(${corpo.length} ${corpo.length === 1 ? 'linha' : 'linhas'})</small></caption>
        <thead><tr>${cabecalho.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${visiveis.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    ${corpo.length > MAX_LINHAS ? `<p class="nota-dados">… e mais ${corpo.length - MAX_LINHAS} linhas no arquivo.</p>` : ''}`;
}

export function htmlDosDados(dados = {}) {
  return `
    <p class="nota-dados">Arquivos que o seu programa pode abrir com <code>open("nome")</code>. Nos casos ocultos, eles têm outros dados.</p>
    ${Object.entries(dados).map(([nome, texto]) => (nome.endsWith('.csv')
      ? tabela(nome, texto)
      : `<h2 class="titulo-dado">${esc(nome)}</h2><pre class="trecho" tabindex="0" aria-label="${esc(nome)}">${esc(texto)}</pre>`)).join('')}`;
}
