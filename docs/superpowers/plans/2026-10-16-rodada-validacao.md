# Rodada da validação (php 1.9.3, terraform 1.10.3, python 1.0.2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir nos três playgrounds o que a validação de 2026-10-16 achou e ficou para esta rodada: botões flutuantes sobre o editor no celular, Python/PHP carregando já na landing, cartões dos badges cortando o nome do curso, e as dependências de teste desatualizadas.

**Architecture:** As mudanças são iguais nos três repositórios (`php-playground`, `terraform-playground`, `python-playground`, no mesmo diretório), exceto o runtime sob demanda, que só existe no php (`src/php/motor.js`) e no python (`src/python/motor.js`): o terraform simula em JavaScript, sem worker. Cada task é feita nos três (ou nos dois) antes do commit, num branch `rodada-validacao` em cada repositório.

**Tech Stack:** JavaScript (ES modules), Vite, vitest, happy-dom, eslint; Pyodide (python) e php-wasm (php) em Web Workers.

**Spec:** decisões da conversa de 2026-10-16 (o usuário pediu para pular as perguntas e deixar as escolhas comigo; validação registrada na memória do projeto):
- celular: os três botões flutuantes viram um único botão que abre e fecha o grupo, em todas as telas;
- o runtime (Python ou PHP) só começa a carregar ao abrir um exercício, uma lição ou o playground livre;
- o nome do curso no cartão do badge quebra em linhas, como o título;
- `vitest` 5.0.4 → 5.0.5 e `happy-dom` 20 → 21; `@noble/*` e `qrcode-generator` (versões maiores, mexem na assinatura e no QR dos certificados) ficam para depois.

## Global Constraints

- Celular = `@media (max-width: 760px)`, a mesma faixa que já recolhe os flutuantes em `src/estilo.css`.
- O botão novo: `id="btn-flutuantes"`, `aria-label="Ajuda e preferências"`, `aria-expanded` e `aria-controls="flutuantes-itens"`, ícone `⚙️` (aria-hidden); no desktop ele não aparece e os três botões continuam como hoje.
- Fechar o grupo: tocar no botão de novo, escolher um item, `Esc` (devolve o foco ao botão), tocar fora, ou mudar de página (`hashchange`).
- Status antes de carregar: python `Python 3.14 (carrega no 1º exercício)`; php `PHP 8.4 (carrega no 1º exercício)`.
- Versões: php **1.9.3**, terraform **1.10.3**, python **1.0.2**, com uma entrada nas novidades em cada um (data 2026-10-16, título "Mais leve no celular").
- Publicar (push, PR, merge) só com o "sim" do usuário. Commits como `Cláudio Raposo <engcfraposo@gmail.com>` com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O valor de `CERTIFICADO_SEGREDO` nunca aparece no código; build local com `CERTIFICADO_SEGREDO=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run build`.
- `rtk proxy` para ver saídas; feche os previews antes da suíte do python (estoura a memória com eles abertos).

## Review Focus

1. **Leitor de tela no celular:** com o grupo fechado, os três botões não podem ficar acessíveis só "visualmente escondidos" e focáveis; escondidos de verdade (`hidden`/`display: none`) e o botão anuncia aberto/fechado. Teste na Task 1 (`aria-expanded` e itens fora da ordem de foco).
2. **Desktop que vira celular (janela estreitada) com o grupo aberto, e o contrário:** o desktop sempre mostra os três; o estado "aberto" não pode esconder nada no desktop. Coberto pelo CSS (o botão e o fechamento só valem dentro do `@media`) e pelo teste de CSS da Task 1.
3. **Executar antes de o runtime ficar pronto** (abriu o exercício e clicou rápido): a execução espera o carregamento, não falha. Teste na Task 2 (`executar` chama `garantir` e espera o `pronto`).
4. **`interromper()` (Ctrl+C) antes de o runtime ter começado:** não pode criar um worker à toa nem quebrar. Teste na Task 2.
5. **Restaurar progresso/validar certificado na landing** não precisa do runtime: continua sem carregá-lo. Teste na Task 2 (o construtor não cria worker).

---

## File Structure

| Arquivo | Repos | Responsabilidade |
|---|---|---|
| `index.html` | 3 | O botão `#btn-flutuantes` e o contêiner `#flutuantes-itens` com os três botões. |
| `src/ui/menu.js` | 3 | `iniciarFlutuantes()`: abrir e fechar o grupo no celular. |
| `src/estilo.css` | 3 | O botão só no celular; os itens só com o grupo aberto, no celular. |
| `src/python/motor.js`, `src/php/motor.js` | python, php | `garantir()`: o worker só nasce na primeira necessidade. |
| `src/main.js` | python, php | Status inicial e `motor.garantir()` ao abrir um item. |
| `src/badges.js` | 3 | `svgCartao`: o nome do curso em várias linhas. |
| `package.json`, `package-lock.json` | 3 | vitest 5.0.5, happy-dom 21, versão. |
| `src/novidades.js` | 3 | A entrada da versão. |
| `tests/flutuantes.test.js` (novo), `tests/motor.test.js`, `tests/badges.test.js` | 3 / 2 / 3 | Os testes de cada task. |

---

### Task 1: Botões flutuantes recolhíveis no celular

**Files:** Modify `index.html` (bloco `<aside class="flutuantes">`), `src/ui/menu.js` (`iniciarFlutuantes`), `src/estilo.css` (bloco "Botões flutuantes"); Create `tests/flutuantes.test.js`. Nos três repositórios (o bloco é igual).

**Interfaces:**
- Produces: `#btn-flutuantes` (button) e `#flutuantes-itens` (div com os três botões, filho do `aside#flutuantes`); `iniciarFlutuantes()` continua sem parâmetros. `#flutuantes-itens` recebe `hidden` quando fechado **e** a tela é de celular (`matchMedia('(max-width: 760px)')`); no desktop nunca tem `hidden`.

- [ ] **Step 1: Write the failing tests** (`tests/flutuantes.test.js`, happy-dom; monta o `<body>` do `index.html` como `tests/item-python.test.js`, troca `window.matchMedia` por um falso que responde `matches` conforme o teste e chama `iniciarFlutuantes()`):
  - `'no celular, começa fechado: só o botão ⚙️, e os três itens fora da ordem de foco'` → `btn.getAttribute('aria-expanded') === 'false'`, `itens.hidden === true`.
  - `'tocar no botão abre; tocar de novo fecha'` → `'true'`/`hidden false`, depois `'false'`/`hidden true`.
  - `'escolher um item fecha'` → abre, `click()` em `#btn-acessibilidade`, `hidden === true`.
  - `'Esc fecha e devolve o foco ao botão'` → abre, foca `#btn-tutorial`, dispara `keydown` `Escape` no `document`: `hidden === true` e `document.activeElement === btn`.
  - `'tocar fora fecha'` → abre, `click()` em `document.body`: fechado.
  - `'no desktop, os três ficam sempre à mostra'` → `matches: false`: `itens.hidden === false`.
  - `'CSS: o botão só aparece no celular'` → lê `src/estilo.css`: fora do `@media (max-width: 760px)`, `#btn-flutuantes` tem `display: none`; dentro dele, `#btn-flutuantes` tem `display: grid`.

- [ ] **Step 2: Run, expect fail:** `rtk proxy npx vitest run tests/flutuantes.test.js` → falham (o botão não existe).

- [ ] **Step 3: Implement**
  - `index.html`: dentro de `<aside class="flutuantes" id="flutuantes">`, os três botões passam para `<div id="flutuantes-itens" class="flutuantes-itens">`, e antes dele vem `<button type="button" id="btn-flutuantes" class="flutuante" aria-expanded="false" aria-controls="flutuantes-itens" aria-label="Ajuda e preferências" data-rotulo="Ajuda e preferências"><span aria-hidden="true">⚙️</span></button>`. O botão fica **por último** visualmente (embaixo, no canto): use `order` no CSS ou ponha-o depois do div no HTML (prefira depois, para a ordem de foco seguir a visual).
  - `src/estilo.css`: `.flutuantes-itens { display: flex; flex-direction: column; gap: inherit; }`, `#btn-flutuantes { display: none; }`; no `@media (max-width: 760px)`: `#btn-flutuantes { display: grid; }` e `.flutuantes-itens[hidden] { display: none; }`.
  - `src/ui/menu.js`, em `iniciarFlutuantes()`: `const celular = window.matchMedia?.('(max-width: 760px)')`; `abrir(aberto)` põe `aria-expanded`, troca o ícone (`⚙️` / `✕`) e `itens.hidden = Boolean(celular?.matches) && !aberto`. Começa fechado. Clique no botão alterna; clique num item, `Esc` (com foco de volta no botão), clique fora do `aside` e `hashchange` fecham. Ouça `celular.addEventListener('change', …)` para refazer o `hidden` ao cruzar a faixa (Review Focus 2). O recolher-ao-rolar que já existe continua.

- [ ] **Step 4: Run, expect pass:** `rtk proxy npx vitest run tests/flutuantes.test.js tests/acessibilidade.test.js tests/tutorial.test.js tests/privacidade.test.js` → verdes (os testes que já abrem o tutorial, a acessibilidade e a privacidade pelos flutuantes continuam passando; se algum procurar os botões como filhos diretos do `aside`, ajuste o seletor e anote).

- [ ] **Step 5: Copy to the other two repos and run the same tests there** (o `index.html` de cada um tem o mesmo bloco; o `menu.js` e o CSS também). Commit nos três: `"Celular: os botões flutuantes viram um só"`.

### Task 2: O runtime só carrega na primeira necessidade (python e php)

**Files:** Modify `src/python/motor.js` e `src/main.js` (python); `src/php/motor.js` e `src/main.js` (php); Test `tests/motor.test.js` (python; no php, crie `tests/motor.test.js` com o mesmo `workerFalso` se não houver).

**Interfaces:**
- Produces: `MotorPython#garantir(): Promise<void>` e `MotorPHP#garantir(): Promise<void>` — criam o worker na primeira chamada (estado `'carregando'`) e devolvem o `pronto`; chamadas seguintes devolvem o mesmo `pronto`. O construtor **não** cria worker. `executar` e `repl` chamam `garantir()` antes de rodar. `interromper()` sem worker não faz nada.
- Para o php: o `MotorPHP` ganha `criarWorker` no construtor (padrão: o `new Worker(...)` de hoje), para o teste injetar o falso.

- [ ] **Step 1: Write the failing tests** (`tests/motor.test.js`):
  - `'não abre o worker antes de precisar'` → `const criados = []; new MotorPython({ criarWorker: () => { criados.push(1); return workerFalso(); } })`: `criados.length === 0`.
  - `'garantir abre uma vez só, e executar espera o carregamento'` → duas chamadas a `garantir()` e um `executar`: `criados.length === 1` e a execução devolve a saída.
  - `'interromper antes de começar não cria worker'` → `motor.interromper()`: `criados.length === 0`, sem exceção.
  - `'o estado carregando só é avisado ao garantir'` → `aoMudarEstado` espiado: nenhuma chamada após o construtor; `'carregando'` e depois `'pronto'` após `await motor.garantir()`.
  - Ajuste o teste de laço infinito, se ele contar com o worker criado no construtor: chame `motor.garantir()` antes do `advanceTimersByTimeAsync(1)`.

- [ ] **Step 2: Run, expect fail:** `rtk proxy npx vitest run tests/motor.test.js` → os quatro novos falham (o construtor cria o worker).

- [ ] **Step 3: Implement** nos dois motores: o `this.iniciar()` sai do construtor; `garantir()` chama `iniciar()` se `!this.worker` e devolve `this.pronto`; `#rodar` (python) e o equivalente no php fazem `await this.garantir()` no lugar de `await this.pronto`; `interromper()` retorna cedo se `!this.worker`.
  - `src/main.js` (python e php): `statusPadrao` começa com o texto das Global Constraints e o `definirStatus(statusPadrao)` inicial passa a usá-lo; no `if (rota.tela === 'item' && telaDoItem.abrir(...))`, chame `motor.garantir()` (sem `await`; o estado `'pronto'` habilita o Executar como hoje).

- [ ] **Step 4: Run, expect pass:** `rtk proxy npx vitest run tests/motor.test.js tests/item-python.test.js tests/shell.test.js tests/terminal.test.js` (python) e os equivalentes do php (`tests/item*.test.js`) → verdes.

- [ ] **Step 5: Verify in the preview** (python e php): `localStorage.clear()`, abrir `#/`, esperar 5 s: o status mostra o texto "carrega no 1º exercício" e `performance.getEntriesByType('resource')` não tem nenhum `worker-*.js`; abrir um exercício: o status passa a "Carregando…" e depois "pronto", e o Executar funciona. Commit nos dois: `"Runtime sob demanda: o Python (PHP) só carrega ao abrir um exercício"`.

### Task 3: O nome do curso no cartão do badge em várias linhas

**Files:** Modify `src/badges.js` (`svgCartao`); Test `tests/badges.test.js`. Nos três repositórios.

**Interfaces:**
- Consumes: `quebrar(texto, largura)` (já existe em `badges.js`, usado no título).
- Produces: `svgCartao(modulo)` com o curso em `quebrar(EMISSOR.curso, 40)` linhas, `font-size="24"`, uma `<text>` por linha, a 32 px uma da outra, depois do "Emitido por".

- [ ] **Step 1: Write the failing test** em `tests/badges.test.js`: `'o nome do curso cabe no cartão: nenhuma linha passa de 40 caracteres'` → para cada id de `ORDEM`, pegue os `<text ... font-size="24" ...>` de `svgCartao(id)`, junte os conteúdos: a concatenação (com espaço) é igual a `EMISSOR.curso`, e cada linha tem no máximo 40 caracteres.

- [ ] **Step 2: Run, expect fail:** `rtk proxy npx vitest run tests/badges.test.js` → falha (uma linha só, com mais de 40 caracteres).

- [ ] **Step 3: Implement** em `svgCartao`: as linhas de `quebrar(EMISSOR.curso, 40)` no lugar do `<text>` único do curso, a primeira em `y0 + linhas.length * 60 + 62`, as seguintes 32 px abaixo.

- [ ] **Step 4: Run, expect pass**, depois `rtk proxy npm run badges` e abra `public/badges/<um id>-card.png` com o Read: o nome do curso inteiro, em duas linhas, dentro do cartão. Copie para os outros dois repositórios (só a função `svgCartao` muda; o `BADGES` é diferente em cada um), rode o teste e o `npm run badges` em cada um. Commit nos três (com os PNGs dos cartões): `"Badges: o nome do curso cabe no cartão"`.

### Task 4: vitest 5.0.5 e happy-dom 21

**Files:** `package.json`, `package-lock.json` nos três.

- [ ] **Step 1:** `rtk proxy npm install -D vitest@5.0.5 happy-dom@21` em cada repositório.
- [ ] **Step 2:** `rtk proxy npx vitest run > $TEMP/v.txt 2>&1; grep -E "Test Files|Tests |FAIL" $TEMP/v.txt` em cada um → verde. Se o happy-dom 21 quebrar algum teste, leia a nota de versão dele (mudança de comportamento do DOM falso) e corrija o teste ou o código pela causa, com `Ruling:` no ledger; se a correção não for pequena, volte o happy-dom para 20 e anote.
- [ ] **Step 3:** commit nos três: `"Dependências: vitest 5.0.5 e happy-dom 21"`.

### Task 5: Versão, conferência e publicação

**Files:** `src/novidades.js`, `package.json`, `package-lock.json` nos três.

- [ ] **Step 1:** novidades (no começo de `RELEASES`) e versão (`1.9.2`→`1.9.3`, `1.10.2`→`1.10.3`, `1.0.1`→`1.0.2`), título "Mais leve no celular", grupos:
  - `📱 Celular`: "Os botões de ajuda, acessibilidade e privacidade viram um só (⚙️): no exercício, eles não cobrem mais o código."
  - `⚡ Mais rápido` (só php e python): "O Python (PHP) só é baixado quando você abre um exercício: a página inicial e a trilha abrem mais rápido no celular."
  - `🏅 Badges`: "No cartão do badge, o nome do curso aparece inteiro."
- [ ] **Step 2:** em cada repositório (previews fechados): `npx vitest run`, `eslint` (0) e o build. Depois os previews: a 393 px, os flutuantes viram o ⚙️ e não cobrem o editor; axe sem violações nos 4 temas na trilha e num exercício; no desktop os três botões continuam como antes.
- [ ] **Step 3:** commit da versão nos três. **Só com o "sim":** push de `rodada-validacao`, um PR em cada repositório (corpo terminando em "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), CI verde, merge com rebase e conferência dos três sites no ar.
