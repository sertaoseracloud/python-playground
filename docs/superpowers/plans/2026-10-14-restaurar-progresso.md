# Restaurar o progresso pelo certificado — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao validar um certificado válido pelo link ou código, o aluno com o mesmo nome salvo
no navegador restaura o módulo certificado e os anteriores da cadeia, e o site volta a emitir o
mesmo certificado.

**Architecture:**
- `src/restaurar.js` (novo, puro) calcula o que volta.
- `restaurarItens` (em `src/progresso.js`) grava os itens.
- `blocoRestaurar` (em `src/ui/validador.js`) mostra o bloco e liga o botão.
- Os três arquivos são **idênticos nos três repositórios**. Só a versão e o texto das novidades
  mudam de um repo para o outro.

**Tech Stack:** JavaScript (ES modules), Vite, Vitest 3 com happy-dom, Node 24.

**Spec:** `python-playground/docs/superpowers/specs/2026-10-14-restaurar-progresso-design.md`

## Global Constraints

- **Nome:** a comparação é `lerNome().trim() === cert.nome.trim()`. Maiúsculas e acentos contam.
  - O diálogo do nome **não** vem preenchido com o nome do certificado, porque isso anularia a
    comparação.
- **Onde aparece:** o bloco só existe para selo `confere` e só na validação por link ou código.
  Ele não aparece no impresso nem no XML.
- **O que volta:** volta cada elo de `[...cert.cadeia, { modulo: cert.modulo, data: cert.data }]`.
  - O `final` não tem itens e é pulado.
  - Cada item (lição e problema) do módulo fica `resolvido`, com `datas[id] = data do elo`.
  - A data é sobrescrita mesmo em item que já estava resolvido.
- **O que não muda:** nada é apagado ou rebaixado, e os módulos fora da cadeia ficam como estão.
  - Restaurar **não** chama `registrarAtividade`, então a 🔥 não muda.
  - Rascunhos não voltam.
- **Versões:**

  | Repo | Versão |
  |---|---|
  | python-playground | 0.4.1 |
  | php-playground | 1.6.0 |
  | terraform-playground | 1.7.0 |

- **Commits:** autor via
  `git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit`. A mensagem
  termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Publicação:** nada de push, tag ou release sem o "sim" do usuário.
- **Build local:** usa um segredo descartável:
  `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.
- **Ferramentas:**
  - O rtk esconde a saída do eslint. Use `npx eslint . -f json -o $TEMP/lint.json` e leia o JSON.
  - Código com barra invertida vai pelo Write ou pelo Edit, nunca por heredoc.
- **Textos:** em português, com acentos. Os rótulos de botão começam com emoji.

## Review Focus

1. **Nome com espaços nas pontas** (no navegador ou no link): conta como igual. O teste fica na
   Task 1, em `situacaoDoNome`.
2. **Item já resolvido neste navegador numa data mais nova que a do certificado:** depois de
   restaurar, o certificado sai igual. É o teste de ida e volta com `marcar` antes, na Task 1.
3. **Navegador que não deixa gravar** (aba anônima com bloqueio): a tela diz que não deu certo e
   não mostra a confirmação. O teste de `restaurarItens` devolver `false` fica na Task 1, e o da
   mensagem de erro, na Task 2.
4. **O aluno salva o nome pelo botão do bloco:** o bloco é redesenhado na hora, já com o botão de
   restaurar, sem precisar validar de novo. O redesenho fica na Task 2.
   - É o único caminho sem teste automatizado: o happy-dom não tem `showModal`. A conferência é
     manual, no preview, na Task 3.
5. **Certificado `final`** (DivergePHP e DivergeTerraform): a jornada recalculada libera o final
   com a mesma data. Fica no teste `it.each(ORDEM)` da Task 1, que roda para todos os
   certificados de cada repo.

---

### Task 1: Funções puras e gravação (python-playground)

**Files:**
- Create: `src/restaurar.js`
- Modify: `src/progresso.js` (nova função depois de `dataDe`)
- Test: `tests/restaurar.test.js` (novo)

**Interfaces:**
- Consumes:
  - `modulos` de `src/conteudo/trilha.js`: `[{ id, titulo, itens: [{ id, tipo: 'licao'|'problema' }] }]`.
  - `CERTIFICADOS` de `src/certificados.js`.
  - O `cert` de `decodificarCertificado(codigo)`: `{ nome, modulo, data, cadeia: [{ modulo, data, ... }], selo }`.
- Produces:
  - `planoDeRestauracao(cert, modulos) → [{ modulo, titulo, data, licoes, exercicios, ids }]`.
    O `titulo` é o do certificado (`CERTIFICADOS[modulo].titulo`).
  - `situacaoDoNome(cert, nomeSalvo) → 'sem-nome' | 'nome-diferente' | 'pode'`.
  - `itensDoPlano(plano) → [{ id, data }]`.
  - `restaurarItens(itens) → boolean`: `true` se o que foi gravado está lá quando é lido de volta.

- [ ] **Step 1: Escrever o teste que falha**

`tests/restaurar.test.js`:

```js
// @vitest-environment happy-dom
// Restaurar o progresso pelo certificado: o que volta, a regra do nome e a ida e volta
// (restaurar num navegador vazio e emitir de novo o mesmo certificado).
import { describe, it, expect, beforeEach } from 'vitest';
import { ORDEM, anteriores, codificarCertificado, decodificarCertificado, CERTIFICADOS } from '../src/certificados.js';
import { modulos } from '../src/conteudo/trilha.js';
import { planoDeRestauracao, situacaoDoNome, itensDoPlano } from '../src/restaurar.js';
import { restaurarItens, statusDe, dataDe, marcar, diasAtivos } from '../src/progresso.js';
import { certificadosDaJornada } from '../src/ui/inicio.js';

const NOME = 'Maria da Conceição';
const dia = (n) => `2026-10-${String(n).padStart(2, '0')}`;

/** Certificado emitido de verdade (com a chave dos testes): cadeia em dias seguidos. */
function emitido(modulo, nome = NOME) {
  const cadeia = anteriores(modulo).map((_, i) => dia(i + 1));
  // O final é concluído no dia do último módulo (a data dele é a mais recente dos módulos).
  const data = modulo === 'final' ? cadeia.at(-1) : dia(cadeia.length + 1);
  const codigo = codificarCertificado({ nome, modulo, data, cadeia });
  return { codigo, cert: decodificarCertificado(codigo) };
}

const reemitido = (cert, modulo) => {
  const c = certificadosDaJornada().find((x) => x.id === modulo);
  return { liberado: c.liberado, codigo: codificarCertificado({ nome: cert.nome, modulo, data: c.data, cadeia: c.cadeia }) };
};

beforeEach(() => localStorage.clear());

describe('planoDeRestauracao', () => {
  it('um bloco por módulo da cadeia, com os itens e a data de cada um', () => {
    const ultimo = ORDEM.at(-1);
    const { cert } = emitido(ultimo);
    const plano = planoDeRestauracao(cert, modulos);
    const comItens = ORDEM.filter((id) => modulos.some((m) => m.id === id));
    expect(plano.map((b) => b.modulo)).toEqual(comItens); // o final não traz itens
    for (const b of plano) {
      const m = modulos.find((x) => x.id === b.modulo);
      expect(b.titulo).toBe(CERTIFICADOS[b.modulo].titulo);
      expect(b.ids).toEqual(m.itens.map((i) => i.id));
      expect(b.exercicios).toBe(m.itens.filter((i) => i.tipo === 'problema').length);
      expect(b.licoes).toBe(m.itens.filter((i) => i.tipo === 'licao').length);
    }
    expect(plano[0].data).toBe(dia(1));
  });

  it('o primeiro certificado da trilha devolve só o próprio módulo', () => {
    const { cert } = emitido(ORDEM[0]);
    expect(planoDeRestauracao(cert, modulos).map((b) => b.modulo)).toEqual([ORDEM[0]]);
  });

  it('itensDoPlano: cada id com a data do seu módulo', () => {
    const plano = [{ modulo: 'a', data: dia(1), ids: ['x', 'y'] }, { modulo: 'b', data: dia(2), ids: ['z'] }];
    expect(itensDoPlano(plano)).toEqual([{ id: 'x', data: dia(1) }, { id: 'y', data: dia(1) }, { id: 'z', data: dia(2) }]);
  });
});

describe('situacaoDoNome', () => {
  it('sem nome, nome igual (espaços nas pontas não contam) e nome diferente (acento e maiúscula contam)', () => {
    const cert = { nome: 'Conceição' };
    expect(situacaoDoNome(cert, '')).toBe('sem-nome');
    expect(situacaoDoNome(cert, '   ')).toBe('sem-nome');
    expect(situacaoDoNome(cert, null)).toBe('sem-nome');
    expect(situacaoDoNome(cert, '  Conceição ')).toBe('pode');
    expect(situacaoDoNome({ nome: ' Conceição ' }, 'Conceição')).toBe('pode');
    expect(situacaoDoNome(cert, 'Conceicao')).toBe('nome-diferente');
    expect(situacaoDoNome(cert, 'conceição')).toBe('nome-diferente');
  });
});

describe('restaurarItens', () => {
  it('marca como resolvido na data dada, sobrescreve a data e não mexe no resto nem na 🔥', () => {
    const [m1, m2] = modulos;
    const [a, b] = m1.itens;
    const outro = m2.itens[0].id;
    marcar(a.id, 'resolvido'); // hoje
    marcar(outro, 'tentado');
    // Zera a atividade que o marcar criou, para ver que restaurar não a recria (sem citar o nome do repo).
    const prefixo = Object.keys(localStorage).find((k) => k.endsWith(':progresso')).replace('progresso', '');
    localStorage.removeItem(`${prefixo}atividade`);
    expect(restaurarItens([{ id: a.id, data: dia(1) }, { id: b.id, data: dia(1) }])).toBe(true);
    expect(statusDe(a.id)).toBe('resolvido');
    expect(dataDe(a.id)).toBe(dia(1));
    expect(statusDe(b.id)).toBe('resolvido');
    expect(statusDe(outro)).toBe('tentado');
    expect(diasAtivos()).toEqual([]);
  });

  it('sem armazenamento, devolve false', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('bloqueado'); };
    try {
      expect(restaurarItens([{ id: modulos[0].itens[0].id, data: dia(1) }])).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('ida e volta: restaurar e emitir de novo o mesmo certificado', () => {
  it.each(ORDEM)('%s', (modulo) => {
    const { codigo, cert } = emitido(modulo);
    expect(cert.selo).toBe('confere');
    expect(restaurarItens(itensDoPlano(planoDeRestauracao(cert, modulos)))).toBe(true);
    expect(reemitido(cert, modulo)).toEqual({ liberado: true, codigo });
  });

  it('com um exercício do primeiro módulo já resolvido hoje (data mais nova), o certificado sai igual', () => {
    const modulo = ORDEM[1];
    const primeiro = modulos.find((m) => m.id === ORDEM[0]).itens.find((i) => i.tipo === 'problema');
    marcar(primeiro.id, 'resolvido');
    const { codigo, cert } = emitido(modulo);
    restaurarItens(itensDoPlano(planoDeRestauracao(cert, modulos)));
    expect(reemitido(cert, modulo)).toEqual({ liberado: true, codigo });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/restaurar.test.js`
Expected: FAIL, com `Failed to resolve import "../src/restaurar.js"`.

- [ ] **Step 3: Implementar `src/restaurar.js`**

```js
// Restaurar o progresso pelo certificado (#/validar/<código>). Um certificado válido prova
// que o aluno concluiu o módulo e os anteriores da cadeia, cada um numa data. O que ele
// prova volta para este navegador, se o nome salvo aqui for igual ao do certificado.
// Funções puras; quem grava é restaurarItens (progresso.js).
import { CERTIFICADOS } from './certificados.js';

/**
 * Um bloco por módulo da cadeia (o certificado final não tem itens próprios e fica de fora).
 * `modulos` é o de conteudo/trilha.js.
 */
export function planoDeRestauracao(cert, modulos) {
  const elos = [...cert.cadeia, { modulo: cert.modulo, data: cert.data }];
  return elos.flatMap(({ modulo, data }) => {
    const m = modulos.find((x) => x.id === modulo);
    if (!m) return [];
    return [{
      modulo,
      titulo: CERTIFICADOS[modulo].titulo,
      data,
      licoes: m.itens.filter((i) => i.tipo === 'licao').length,
      exercicios: m.itens.filter((i) => i.tipo === 'problema').length,
      ids: m.itens.map((i) => i.id),
    }];
  });
}

/** O nome salvo neste navegador tem de ser igual ao do certificado (só as pontas são aparadas). */
export function situacaoDoNome(cert, nomeSalvo) {
  const salvo = String(nomeSalvo ?? '').trim();
  if (!salvo) return 'sem-nome';
  return salvo === cert.nome.trim() ? 'pode' : 'nome-diferente';
}

/** Os itens do plano, cada um com a data do seu módulo. */
export const itensDoPlano = (plano) => plano.flatMap((b) => b.ids.map((id) => ({ id, data: b.data })));
```

- [ ] **Step 4: Implementar `restaurarItens` em `src/progresso.js`**

Coloque logo depois de `dataDe`:

```js
/**
 * Restaura itens resolvidos (pelo certificado, em #/validar): cada um fica resolvido na
 * data dada, mesmo se já estava resolvido em outro dia, porque a data do certificado é a
 * que vale. Não conta como atividade do dia (a 🔥 não muda). Devolve false se o navegador
 * não deixou gravar.
 */
export function restaurarItens(itens) {
  const progresso = ler('progresso', {});
  const datas = ler('datas', {});
  for (const { id, data } of itens) {
    progresso[id] = 'resolvido';
    datas[id] = data;
  }
  gravar('progresso', progresso);
  gravar('datas', datas);
  const salvo = ler('progresso', {});
  return itens.every(({ id }) => salvo[id] === 'resolvido');
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/restaurar.test.js`
Expected: PASS, com todos os casos, incluindo um `it.each` por certificado de `ORDEM`.

- [ ] **Step 6: Commit**

```bash
git add src/restaurar.js src/progresso.js tests/restaurar.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Restaurar o progresso: o que o certificado devolve e a gravação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: O bloco no validador (python-playground)

**Files:**
- Modify: `src/ui/validador.js`, que ganha os imports, `blocoRestaurar` e a ligação no `renderValidador`.
- Modify: `src/ui/inicio.js`, onde `function pedirNome` passa a `export function pedirNome`.
- Modify: `src/main.js:149`, que passa a chamar `renderValidador(telaValidador, rota.codigo, { aoRestaurar: atualizarProgressoTopo })`.
- Modify: `src/caminho.css`, com os estilos novos depois de `.nota-validacao` (linha 662).
- Test: `tests/restaurar-ui.test.js` (novo, happy-dom)

**Interfaces:**
- Consumes:
  - Da Task 1: `planoDeRestauracao`, `situacaoDoNome`, `itensDoPlano` e `restaurarItens`.
  - `lerNome` e `pedirNome({ obrigatorio })`, que devolve `Promise<string|null>`.
  - `anunciar(texto)` de `./anuncios.js`.
- Produces:
  - `blocoRestaurar(cert, codigo, nomeSalvo = lerNome()) → string` (HTML).
  - `renderValidador(el, codigoInicial = '', { aoRestaurar = () => {} } = {})`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/restaurar-ui.test.js`:

```js
// @vitest-environment happy-dom
// O bloco "Restaurar o progresso" no validador: só com selo válido, só com o nome igual.
import { describe, it, expect, beforeEach } from 'vitest';
import { ORDEM, anteriores, codificarCertificado, decodificarCertificado, certificadoXml } from '../src/certificados.js';
import { renderValidador, resultadoDoXml } from '../src/ui/validador.js';
import { gravarNome, statusDe } from '../src/progresso.js';
import { modulos } from '../src/conteudo/trilha.js';

const NOME = 'Maria da Conceição';
const MODULO = ORDEM[1];
const codigo = codificarCertificado({ nome: NOME, modulo: MODULO, data: '2026-10-02', cadeia: anteriores(MODULO).map(() => '2026-10-01') });

function abrir(texto = codigo, opcoes) {
  document.body.innerHTML = '<main id="tela"></main><div id="anuncio" aria-live="polite"></div>';
  renderValidador(document.getElementById('tela'), texto, opcoes);
  return document.querySelector('#resultado-inicial .restaurar-progresso');
}

beforeEach(() => localStorage.clear());

describe('restaurar o progresso no validador', () => {
  it('selo que não confere: sem bloco', () => {
    const dados = JSON.parse(Buffer.from(codigo, 'base64url').toString());
    const alterado = Buffer.from(JSON.stringify({ ...dados, d: '2026-10-03' })).toString('base64url');
    gravarNome(NOME);
    expect(abrir(alterado)).toBeNull();
  });

  it('sem nome salvo: explica e oferece salvar o nome, sem botão de restaurar', () => {
    const bloco = abrir();
    expect(bloco.textContent).toContain('exatamente como está no certificado');
    expect(bloco.querySelector('[data-nome-restaurar]')).not.toBeNull();
    expect(bloco.querySelector('[data-restaurar]')).toBeNull();
  });

  it('nome diferente (acento): mostra os dois nomes, sem botão de restaurar', () => {
    gravarNome('Maria da Conceicao');
    const bloco = abrir();
    expect(bloco.textContent).toContain(NOME);
    expect(bloco.textContent).toContain('Maria da Conceicao');
    expect(bloco.querySelector('[data-restaurar]')).toBeNull();
  });

  it('nome igual: lista os módulos, restaura, anuncia e avisa o topo', async () => {
    gravarNome(NOME);
    let avisado = 0;
    const bloco = abrir(codigo, { aoRestaurar: () => { avisado += 1; } });
    expect(bloco.querySelectorAll('li')).toHaveLength(2);
    bloco.querySelector('[data-restaurar]').click();
    await new Promise((r) => setTimeout(r, 120));
    const ids = modulos.filter((m) => [ORDEM[0], MODULO].includes(m.id)).flatMap((m) => m.itens.map((i) => i.id));
    expect(ids.every((id) => statusDe(id) === 'resolvido')).toBe(true);
    expect(avisado).toBe(1);
    const depois = document.querySelector('#resultado-inicial .restaurar-progresso');
    expect(depois.querySelector('a[href="#/trilha"]')).not.toBeNull();
    expect(document.getElementById('anuncio').textContent).toContain('voltaram para este navegador');
  });

  it('a aba "Link ou código" também mostra o bloco', () => {
    gravarNome(NOME);
    abrir('');
    document.getElementById('campo-link').value = codigo;
    document.getElementById('form-link').onsubmit({ preventDefault() {} });
    expect(document.querySelector('#saida-link [data-restaurar]')).not.toBeNull();
  });

  it('o resultado do XML não tem o bloco', () => {
    gravarNome(NOME);
    expect(resultadoDoXml(certificadoXml(decodificarCertificado(codigo)))).not.toContain('restaurar-progresso');
  });

  it('se o navegador não deixa gravar, avisa em vez de confirmar', async () => {
    gravarNome(NOME);
    const bloco = abrir();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('bloqueado'); };
    try {
      bloco.querySelector('[data-restaurar]').click();
      await new Promise((r) => setTimeout(r, 120));
    } finally {
      Storage.prototype.setItem = original;
    }
    const depois = document.querySelector('#resultado-inicial .restaurar-progresso');
    expect(depois.textContent).toContain('não deixou o site guardar');
    expect(depois.querySelector('a[href="#/trilha"]')).toBeNull();
  });
});
```

Se `certificadoXml(cert)` precisar de mais campos do que o `cert` decodificado tem, copie a forma
que `tests/validador.test.js` usa no teste "o validador aceita o XML e detecta edição no arquivo".

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/restaurar-ui.test.js`
Expected: FAIL. O teste "selo que não confere" passa, e os outros falham porque `.restaurar-progresso` é `null`.

- [ ] **Step 3: Exportar `pedirNome` em `src/ui/inicio.js`**

Troque `function pedirNome({ obrigatorio = false } = {}) {` por
`export function pedirNome({ obrigatorio = false } = {}) {`.

- [ ] **Step 4: Implementar o bloco em `src/ui/validador.js`**

Acrescente aos imports do topo:

```js
import { modulos } from '../conteudo/trilha.js';
import { lerNome, restaurarItens } from '../progresso.js';
import { planoDeRestauracao, situacaoDoNome, itensDoPlano } from '../restaurar.js';
import { pedirNome } from './inicio.js';
import { anunciar } from './anuncios.js';
```

Depois de `resultadoDoImpresso`, acrescente:

```js
const contar = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * Bloco "Restaurar o progresso" de um certificado válido. O progresso só volta se o nome
 * salvo neste navegador for igual ao do certificado (acentos e maiúsculas contam).
 */
export function blocoRestaurar(cert, codigo, nomeSalvo = lerNome()) {
  const situacao = situacaoDoNome(cert, nomeSalvo);
  let corpo;
  if (situacao === 'sem-nome') {
    corpo = `
      <p>Este certificado pode trazer o seu progresso de volta para este navegador. Antes, salve aqui o seu nome
        <b>exatamente como está no certificado</b>, com os mesmos acentos e maiúsculas.</p>
      <p><button type="button" class="btn btn-roxo btn-pequeno" data-nome-restaurar>✏️ Salvar o meu nome</button></p>`;
  } else if (situacao === 'nome-diferente') {
    corpo = `
      <p>O progresso só volta quando o nome salvo neste navegador é igual ao do certificado, com os mesmos acentos e maiúsculas.</p>
      <dl class="dados-validacao">
        <div class="largo"><dt>No certificado</dt><dd>${esc(cert.nome)}</dd></div>
        <div class="largo"><dt>Neste navegador</dt><dd>${esc(String(nomeSalvo).trim())}</dd></div>
      </dl>
      <p><button type="button" class="btn btn-roxo btn-pequeno" data-nome-restaurar>✏️ Trocar o nome deste navegador</button></p>`;
  } else {
    const plano = planoDeRestauracao(cert, modulos);
    corpo = `
      <p>Estes módulos voltam como concluídos, nas datas do certificado. Nada do que já está neste navegador é apagado.</p>
      <ul class="lista-restaurar">
        ${plano.map((b) => `<li><b>${esc(b.titulo)}</b> · ${contar(b.exercicios, 'exercício', 'exercícios')} e ${contar(b.licoes, 'lição', 'lições')} · concluído em ${dataCurta(b.data)}</li>`).join('')}
      </ul>
      <p><button type="button" class="btn btn-verde" data-restaurar>↩️ Restaurar o meu progresso neste navegador</button></p>`;
  }
  return `
    <section class="restaurar-progresso" data-codigo="${esc(codigo)}">
      <h3 tabindex="-1">↩️ Restaurar o progresso neste navegador</h3>
      ${corpo}
    </section>`;
}

/** Resultado do link com o bloco de restaurar (só quando o selo confere). */
function resultadoComRestauracao(texto) {
  const codigo = extrairCodigo(texto);
  const cert = codigo && decodificarCertificado(codigo);
  return resultadoDoLink(texto) + (cert?.selo === 'confere' ? blocoRestaurar(cert, codigo) : '');
}

/** Cliques do bloco: salvar o nome (e redesenhar) ou restaurar. */
function ligarRestauracao(el, aoRestaurar) {
  el.onclick = async (e) => {
    const bloco = e.target.closest('.restaurar-progresso');
    if (!bloco) return;
    const { codigo } = bloco.dataset;
    const cert = decodificarCertificado(codigo);
    const redesenhar = () => {
      bloco.outerHTML = blocoRestaurar(cert, codigo);
      el.querySelector(`.restaurar-progresso[data-codigo="${CSS.escape(codigo)}"] h3`)?.focus();
    };
    if (e.target.closest('[data-nome-restaurar]')) {
      await pedirNome();
      redesenhar();
      return;
    }
    if (!e.target.closest('[data-restaurar]')) return;
    if (situacaoDoNome(cert, lerNome()) !== 'pode') { redesenhar(); return; } // o nome mudou noutra aba
    const plano = planoDeRestauracao(cert, modulos);
    const ok = restaurarItens(itensDoPlano(plano));
    const texto = ok
      ? `Pronto: ${contar(plano.length, 'módulo voltou', 'módulos voltaram')} para este navegador, com as datas do certificado.`
      : 'Este navegador não deixou o site guardar o progresso (aba anônima ou dados bloqueados). Tente numa janela normal.';
    bloco.innerHTML = `
      <h3 tabindex="-1">↩️ Restaurar o progresso neste navegador</h3>
      <p>${ok ? '✅' : '⚠️'} ${esc(texto)}</p>
      ${ok ? '<p><a class="btn btn-roxo btn-pequeno" href="#/trilha">Ir para a trilha</a></p>' : ''}`;
    // Foco no próximo passo: o link da trilha; se não deu certo, o título do aviso.
    (bloco.querySelector('a') ?? bloco.querySelector('h3')).focus();
    anunciar(texto);
    if (ok) aoRestaurar();
  };
}
```

No `renderValidador`:
- Troque a assinatura por
  `export function renderValidador(el, codigoInicial = '', { aoRestaurar = () => {} } = {}) {`.
- Logo depois de `ligarAbas(el);`, acrescente `ligarRestauracao(el, aoRestaurar);`.
- No `form-link`, troque `mostrar(saidaLink, resultadoDoLink(campoLink.value));` por
  `mostrar(saidaLink, resultadoComRestauracao(campoLink.value));`.
- Na última linha, troque `resultadoDoLink(codigoInicial)` por
  `resultadoComRestauracao(codigoInicial)`.

- [ ] **Step 5: Ligar o topo em `src/main.js`**

Troque `renderValidador(telaValidador, rota.codigo);` por
`renderValidador(telaValidador, rota.codigo, { aoRestaurar: atualizarProgressoTopo });`.

- [ ] **Step 6: Estilo em `src/caminho.css`**

Depois de `.nota-validacao { … }`:

```css
.restaurar-progresso {
  margin: 16px 0 0;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-left: 4px solid var(--verde);
  border-radius: 12px;
}
.restaurar-progresso h3 { margin: 0 0 8px; }
.restaurar-progresso h3:focus { outline: none; }
.lista-restaurar { margin: 8px 0 12px; padding-left: 1.2rem; }
.lista-restaurar li { margin: 4px 0; }
```

O `h3:focus` sem contorno vale só para o foco feito por script (o `h3` tem `tabindex="-1"`). O
contorno dos botões e links continua o do site.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run tests/restaurar-ui.test.js tests/validador.test.js tests/restaurar.test.js`
Expected: PASS.

- [ ] **Step 8: Suíte inteira e lint**

- Run: `npm test`
  Expected: tudo passa. Os testes do Pyodide demoram; feche os previews se faltar RAM.
- Run: `npx eslint . -f json -o $TEMP/lint.json` e depois
  `node -e "const r=require(process.env.TEMP+'/lint.json');console.log(r.reduce((s,f)=>s+f.errorCount+f.warningCount,0))"`.
  Expected: `0`.

- [ ] **Step 9: Commit**

```bash
git add src/ui/validador.js src/ui/inicio.js src/main.js src/caminho.css tests/restaurar-ui.test.js
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Validador: restaurar o progresso com o nome igual ao do certificado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Versão 0.4.1 do DivergePython e conferência no navegador

**Files:**
- Modify: `package.json` e `package-lock.json`, com a versão `0.4.1` (`npm version 0.4.1 --no-git-tag-version`).
- Modify: `src/novidades.js`, com uma release nova no topo de `RELEASES`.
- Modify: `README.md`, com uma linha na lista de recursos sobre restaurar pelo certificado. Siga o estilo da seção de certificados que já existe.
- Modify: `src/ui/declaracao-acessibilidade.js`, com `ATUALIZADA_EM = '2026-10-14'`, que já é a data atual. Só mexa se outra coisa mudar.

- [ ] **Step 1: Release nas novidades**

No topo de `RELEASES`:

```js
  {
    versao: '0.4.1',
    data: '2026-10-14',
    titulo: 'O certificado traz o progresso de volta',
    resumo: 'Trocou de computador ou limpou o navegador? Valide o seu certificado aqui e o progresso dos módulos dele volta.',
    grupos: [
      { titulo: '↩️ Restaurar o progresso', itens: ['Ao validar um certificado pelo link ou código, aparece o botão "Restaurar o meu progresso neste navegador".', 'O progresso só volta se o nome salvo neste navegador for igual ao do certificado, com os mesmos acentos e maiúsculas.', 'Voltam o módulo do certificado e os anteriores da trilha, nas datas do certificado: o certificado emitido de novo é o mesmo. Nada do que já está no navegador é apagado.'] },
    ],
  },
```

- [ ] **Step 2: Versão**

Run: `npm version 0.4.1 --no-git-tag-version`
Expected: `v0.4.1`.

- [ ] **Step 3: Suíte e build**

- Run: `npm test`
  Expected: tudo passa, inclusive o teste das novidades que compara com o `package.json`.
- Run: `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`
  Expected: o build termina sem erros.

- [ ] **Step 4: Conferência manual no preview**

O build tem uma chave descartável, então os certificados válidos são os emitidos nele mesmo.

1. Num navegador limpo do preview, resolva o módulo de propósito com `restaurarItens` pelo
   console. Ou emita o primeiro certificado de outra forma rápida.
2. Abra o certificado e copie o link.
3. Apague os dados pelo painel de privacidade (LGPD).
4. Abra `#/validar/<código>`. Sem nome, o bloco pede o nome. Clique em "✏️ Salvar o meu nome" e
   salve um nome com outro acento: o bloco é redesenhado e mostra os dois nomes.
5. Troque para o nome certo e clique em "↩️ Restaurar". Confira a confirmação, o foco no link
   "Ir para a trilha", o contador do topo e o certificado de novo na trilha, com o **mesmo código**.
6. Rode o axe-core (WCAG 2.2 AA) no validador com o bloco aberto, nos 4 temas, como nas rodadas
   anteriores.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/novidades.js README.md
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 0.4.1: o certificado traz o progresso de volta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: DivergePHP 1.6.0 (php-playground)

O código é o mesmo das Tasks 1 e 2. Os arquivos `src/progresso.js`, `src/ui/validador.js` e
`src/certificados.js` já têm a mesma API nos três repos. O `validador.js` é idêntico; o
`progresso.js` só muda nas seções do fim (banco do livre).

**Files:**
- Create: `src/restaurar.js`, `tests/restaurar.test.js` e `tests/restaurar-ui.test.js`, cópias exatas dos do python-playground.
- Create: `docs/superpowers/specs/2026-10-14-restaurar-progresso-design.md`, cópia da spec. A pasta ainda não existe nesse repo.
- Modify: `src/progresso.js`, com a mesma função `restaurarItens` depois de `dataDe`.
- Modify: `src/ui/validador.js`, com as mesmas mudanças da Task 2, Step 4. Depois delas, ele deve ficar idêntico ao do python: confira com `diff`.
- Modify: `src/ui/inicio.js`, com `export function pedirNome`.
- Modify: `src/main.js`, com o `renderValidador(..., { aoRestaurar: atualizarProgressoTopo })`.
- Modify: o CSS do validador. Ache-o com `grep -rln "nota-validacao" src --include=*.css` e acrescente os mesmos estilos.
- Modify: `package.json`, `src/novidades.js` e `README.md`, com a versão `1.6.0`.

- [ ] **Step 1: Copiar os testes e ver falhar**

```bash
cp ../python-playground/tests/restaurar.test.js ../python-playground/tests/restaurar-ui.test.js tests/
npx vitest run tests/restaurar.test.js tests/restaurar-ui.test.js
```

Expected: FAIL, com `Failed to resolve import "../src/restaurar.js"`.

- [ ] **Step 2: Aplicar o código**

```bash
cp ../python-playground/src/restaurar.js src/
mkdir -p docs/superpowers/specs && cp ../python-playground/docs/superpowers/specs/2026-10-14-restaurar-progresso-design.md docs/superpowers/specs/
```

Depois, aplique pelo Edit:
- em `src/progresso.js`, a função `restaurarItens` da Task 1, Step 4;
- as mudanças da Task 2, Steps 3 a 6.

Ao terminar, o `validador.js` deve ser idêntico ao do python:
`diff src/ui/validador.js ../python-playground/src/ui/validador.js` não mostra nada.

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run tests/restaurar.test.js tests/restaurar-ui.test.js tests/validador.test.js`
Expected: PASS. O `it.each(ORDEM)` roda `html`, `w3css`, `php`, `pdo`, `projetos` e `final`.

- [ ] **Step 4: Release 1.6.0**

- No topo de `RELEASES` em `src/novidades.js`, a mesma entrada da Task 3, com `versao: '1.6.0'`.
- Run: `npm version 1.6.0 --no-git-tag-version`.
- Na lista de recursos do README, a mesma linha da Task 3.

- [ ] **Step 5: Suíte, lint, build e conferência**

Os mesmos comandos da Task 2, Step 8, e da Task 3, Steps 3 e 4. Na conferência, emita e restaure
também o certificado `final`.

- [ ] **Step 6: Commits**

```bash
git add src tests/restaurar.test.js tests/restaurar-ui.test.js docs/superpowers/specs
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Validador: restaurar o progresso com o nome igual ao do certificado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add package.json package-lock.json src/novidades.js README.md
git -c user.name="Cláudio Raposo" -c user.email=engcfraposo@gmail.com commit -m "Versão 1.6.0: o certificado traz o progresso de volta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: DivergeTerraform 1.7.0 (terraform-playground)

É a Task 4 no repo `terraform-playground`, com estas diferenças:
- A versão é `1.7.0`.
- A spec vai para `docs/superpowers/specs/`, que já existe.
- O `it.each(ORDEM)` roda `basico`, `aws`, `azure`, `projetos` e `final`.

- [ ] **Step 1: Copiar os testes e ver falhar**

```bash
cp ../python-playground/tests/restaurar.test.js ../python-playground/tests/restaurar-ui.test.js tests/
npx vitest run tests/restaurar.test.js tests/restaurar-ui.test.js
```

Expected: FAIL, com `Failed to resolve import "../src/restaurar.js"`.

- [ ] **Step 2: Aplicar o código**

```bash
cp ../python-playground/src/restaurar.js src/
cp ../python-playground/docs/superpowers/specs/2026-10-14-restaurar-progresso-design.md docs/superpowers/specs/
```

Depois, aplique pelo Edit:
- `restaurarItens` em `src/progresso.js`;
- as mudanças da Task 2, Steps 3 a 6 (`validador.js`, `inicio.js`, `main.js` e o CSS achado com
  `grep -rln "nota-validacao" src --include=*.css`).

Confira o resultado com `diff src/ui/validador.js ../python-playground/src/ui/validador.js`, que
não deve mostrar nada.

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run tests/restaurar.test.js tests/restaurar-ui.test.js tests/validador.test.js`
Expected: PASS.

- [ ] **Step 4: Release 1.7.0**

- A mesma entrada de `RELEASES`, com `versao: '1.7.0'`.
- Run: `npm version 1.7.0 --no-git-tag-version`.
- A mesma linha no README.

- [ ] **Step 5: Suíte, lint, build e conferência**

Os mesmos comandos da Task 2, Step 8, e da Task 3, Steps 3 e 4. O preview do Terraform é o
`terraform-playground-preview` (porta 4174) do `.claude/launch.json`. Restaure também o `final`.

- [ ] **Step 6: Commits**

Os mesmos dois commits da Task 4, Step 6, com a mensagem `Versão 1.7.0: o certificado traz o
progresso de volta`.

### Task 6: Publicar (só com o "sim")

- [ ] Apresentar ao usuário:
  - os commits de cada repo;
  - o resultado das suítes;
  - a conferência manual;
  - o axe.
- [ ] Com o "sim", em cada repo: `git push origin main`, depois `git tag vX.Y.Z` e `git push origin vX.Y.Z`.
  - Siga o mesmo fluxo das versões anteriores, inclusive a release no GitHub, se for o costume.
- [ ] Conferir o site publicado de cada um. Com o segredo de verdade, um certificado emitido no
  site publicado deve ser restaurado num navegador limpo.
