// A tela do terminal: a saída rola e, embaixo, o prompt com o campo de digitação na mesma
// linha. Quem lê (o shell, o input() do programa, o >>>) chama ler(); o resto é teclado:
// Enter, ↑/↓ histórico, Tab completa, Ctrl+C/D/L, Esc sai do terminal, colar várias linhas.

/** A leitura foi cancelada (Ctrl+C ou cancelarLeitura). */
export class Cancelado extends Error {}

const LIMITE_LINHAS = 5000;
const LIMITE_HISTORICO = 100;
const ROTULO_PADRAO = 'Comando do terminal';
const FOCAVEIS = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

const contarLinhas = (texto) => {
  let n = 0;
  for (let i = texto.indexOf('\n'); i !== -1; i = texto.indexOf('\n', i + 1)) n++;
  return n;
};

/** Prefixo comum das opções do Tab (para completar até onde todas concordam). */
const prefixoComum = (opcoes) => opcoes.reduce((p, o) => {
  let i = 0;
  while (i < p.length && p[i] === o[i]) i++;
  return p.slice(0, i);
});

export function criarTerminal(elemento, { historico = [], aoMudarHistorico = () => {}, completar = () => [] } = {}) {
  const pre = elemento.querySelector('#saida-terminal') ?? elemento.querySelector('pre');
  const rotulo = elemento.querySelector('#prompt-terminal');
  const campo = elemento.querySelector('#campo-terminal');
  if (!elemento.hasAttribute('tabindex')) elemento.tabIndex = -1; // recebe o Ctrl+C enquanto o programa roda
  let lista = [...historico];
  let posicao = lista.length;
  let leitura = null;
  let linhas = 0;
  let tinhaFoco = false;
  const fila = [];
  campo.disabled = true;

  function aparar() {
    let excesso = linhas - LIMITE_LINHAS;
    while (excesso > 0 && pre.firstChild) {
      const no = pre.firstChild;
      const texto = no.textContent;
      const n = contarLinhas(texto);
      if (n <= excesso) {
        no.remove();
        excesso -= n;
        linhas -= n;
        continue;
      }
      let corte = -1;
      for (let k = 0; k < excesso; k++) corte = texto.indexOf('\n', corte + 1);
      no.textContent = texto.slice(corte + 1);
      linhas -= excesso;
      excesso = 0;
    }
  }

  function escrever(texto, classe) {
    if (!texto) return;
    const noFim = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 8;
    const ultimo = pre.lastChild;
    if (classe) {
      const span = document.createElement('span');
      span.className = classe;
      span.textContent = texto;
      pre.append(span);
    } else if (ultimo?.nodeType === 3) {
      ultimo.appendData(texto);
    } else {
      pre.append(document.createTextNode(texto));
    }
    linhas += contarLinhas(texto);
    aparar();
    if (noFim) elemento.scrollTop = elemento.scrollHeight;
  }

  /** Tira da saída o fim da última linha (o "Nome: " do input()) para ele virar o prompt. */
  function tirarLinhaParcial() {
    let parcial = '';
    while (pre.lastChild) {
      const no = pre.lastChild;
      const texto = no.textContent;
      const i = texto.lastIndexOf('\n');
      if (i === -1) {
        parcial = texto + parcial;
        no.remove();
        continue;
      }
      parcial = texto.slice(i + 1) + parcial;
      if (i + 1 < texto.length) no.textContent = texto.slice(0, i + 1);
      break;
    }
    return parcial;
  }

  function limpar() {
    pre.textContent = '';
    linhas = 0;
  }

  function terminar() {
    const atual = leitura;
    leitura = null;
    tinhaFoco = document.activeElement === campo;
    campo.value = '';
    rotulo.textContent = '';
    campo.disabled = true;
    campo.setAttribute('aria-label', ROTULO_PADRAO);
    if (tinhaFoco) elemento.focus();
    return atual;
  }

  function guardar(texto) {
    if (!texto.trim() || lista.at(-1) === texto) return;
    lista = [...lista, texto].slice(-LIMITE_HISTORICO);
    aoMudarHistorico(lista);
  }

  function enviar() {
    if (!leitura) return;
    const texto = campo.value;
    escrever(`${leitura.prompt}${texto}\n`);
    if (leitura.historico) guardar(texto);
    terminar().resolve(texto);
  }

  function ler({ prompt, rotulo: nome = ROTULO_PADRAO, historico: noHistorico = true } = {}) {
    if (leitura) terminar().reject(new Cancelado());
    const texto = prompt ?? tirarLinhaParcial();
    if (fila.length) {
      const resposta = fila.shift();
      escrever(`${texto}${resposta}\n`);
      if (noHistorico) guardar(resposta);
      return Promise.resolve(resposta);
    }
    rotulo.textContent = texto;
    campo.setAttribute('aria-label', nome);
    campo.value = '';
    campo.disabled = false;
    posicao = lista.length;
    if (tinhaFoco || document.activeElement === elemento) campo.focus();
    return new Promise((resolve, reject) => {
      leitura = { prompt: texto, historico: noHistorico, resolve, reject };
    });
  }

  function cancelarLeitura() {
    if (leitura) terminar().reject(new Cancelado());
  }

  function tab() {
    const opcoes = completar(campo.value);
    if (!opcoes.length) return;
    if (opcoes.length === 1) {
      campo.value = opcoes[0].endsWith('/') ? opcoes[0] : `${opcoes[0]} `;
      return;
    }
    const comum = prefixoComum(opcoes);
    if (comum.length > campo.value.length) {
      campo.value = comum;
      return;
    }
    // Várias opções: lista como o bash (só a palavra que muda).
    const nomes = opcoes.map((o) => o.slice(o.lastIndexOf(' ', o.length - 2) + 1));
    escrever(`${leitura.prompt}${campo.value}\n${nomes.join('  ')}\n`);
  }

  function sair() {
    const focaveis = [...document.querySelectorAll(FOCAVEIS)].filter((e) => !elemento.contains(e) && !e.disabled && !e.closest('[hidden]'));
    const depois = focaveis.find((e) => elemento.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
    tinhaFoco = false;
    const alvo = depois ?? focaveis[0];
    if (alvo) alvo.focus();
    else campo.blur();
  }

  const api = {
    escrever, ler, limpar, cancelarLeitura,
    focar() { (leitura ? campo : elemento).focus(); },
    get ocupado() { return leitura !== null; },
    fila,
    /** Chamado no Ctrl+C sem leitura aberta (o programa está rodando). */
    aoInterromper: null,
  };

  elemento.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const tecla = e.key.toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      sair();
    } else if (ctrl && tecla === 'l') {
      e.preventDefault();
      limpar();
    } else if (ctrl && tecla === 'c') {
      if (campo.selectionStart !== campo.selectionEnd) return; // com texto selecionado, é copiar
      e.preventDefault();
      if (leitura) {
        escrever(`${leitura.prompt}${campo.value}^C\n`);
        terminar().reject(new Cancelado());
      } else {
        api.aoInterromper?.();
      }
    } else if (!leitura) {
      return;
    } else if (ctrl && tecla === 'd') {
      if (campo.value) return;
      e.preventDefault();
      escrever(`${leitura.prompt}\n`);
      terminar().resolve(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      enviar();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      tab();
    } else if (e.key === 'ArrowUp' && leitura.historico) {
      e.preventDefault();
      if (posicao > 0) campo.value = lista[--posicao];
    } else if (e.key === 'ArrowDown' && leitura.historico) {
      e.preventDefault();
      if (posicao < lista.length) posicao++;
      campo.value = lista[posicao] ?? '';
    }
  });

  campo.addEventListener('paste', (e) => {
    const colado = e.clipboardData?.getData('text') ?? '';
    if (!leitura || !/[\r\n]/.test(colado)) return;
    e.preventDefault();
    const partes = colado.replace(/\r\n?/g, '\n').split('\n');
    if (partes.at(-1) === '') partes.pop();
    campo.value += partes.shift() ?? '';
    fila.push(...partes);
    enviar();
  });

  // Clicar no terminal põe o foco no campo (mas deixa selecionar texto para copiar).
  elemento.addEventListener('click', () => {
    if (leitura && !String(globalThis.getSelection?.() ?? '')) campo.focus();
  });

  return api;
}
