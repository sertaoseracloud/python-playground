# DivergePython: terminal interativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versão 0.3.2 com um terminal de verdade: `input()` respondido no próprio terminal, saída ao vivo, linha de comando (`python`, `ls`, `cat`...) e o REPL `>>>`.

**Architecture:** O runtime Python ganha um modo interativo: o `stdout` do aluno é mandado à página enquanto o programa roda, e o `input()` sem respostas prontas pede a resposta à página e espera com `run_sync` (JSPI). Sem JSPI, o `input()` interrompe a execução e o shell roda o programa de novo com as respostas já dadas. Um REPL (`repl.py`) mantém um escopo por sessão. Na página, `terminal.js` é a tela (saída, campo, histórico, teclas) e `shell.js` interpreta os comandos e conversa com o motor.

**Tech Stack:** Pyodide 314.0.7 (Python 3.14) com JSPI, Web Workers, vitest 5 (Node 24, `--experimental-wasm-jspi`, happy-dom), pytest 8.4.2, axe-core 4.14.

**Spec:** `docs/superpowers/specs/2026-10-14-terminal-interativo-design.md`

## Global Constraints

- Versão publicada: **0.3.2** (a partir da `main`); depois, a `main` é incorporada ao branch `fase-4`.
- "O `input()` é respondido no próprio terminal, na mesma linha da pergunta, e o programa continua dali."
- "O `print` aparece na hora em que roda (antes de um `input()`, por exemplo), não só no fim."
- "A aba ⌨️ Entrada deixa de existir; a correção automática não muda."
- Relógio de 10 s: "Para enquanto o programa espera a digitação".
- Ctrl+C: "Interrompe: o worker é reiniciado e o terminal mostra `KeyboardInterrupt`".
- Botão ▶ Executar: "Roda os casos de teste visíveis (com as respostas de cada caso) e depois digita `python main.py` no terminal".
- Sem JSPI: "o programa roda até o primeiro `input()` sem resposta, o terminal pede a resposta e o programa roda de novo desde o início com as respostas já dadas, mostrando só a saída nova (o terminal avisa ...)".
- Acessibilidade: WCAG 2.2 AA nos quatro temas (axe-core); o campo tem rótulo; a saída nova vai para uma região `role="log"`; Esc tira o foco do terminal.
- Publicação só depois do "sim" do usuário; commits como "Cláudio Raposo" <engcfraposo@gmail.com> com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Um programa que imprime milhares de linhas (laço com `print`) não pode travar a página nem o leitor de tela: a saída ao vivo é juntada em blocos e o terminal guarda no máximo 5000 linhas (teste no `terminal.test.js` da Task 3).
- O aluno troca de exercício (ou clica ▶ Executar de novo) enquanto o programa espera um `input()`: a espera antiga é cancelada e o novo programa roda (teste no `item-python.test.js` da Task 4).
- `input()` dentro de uma função chamada pela correção (`chamadas`) ou pelos casos de teste nunca pede resposta à página: usa as respostas do caso e, sem elas, dá `EOFError`, como hoje (teste no `test_runtime.py` da Task 1).
- Colar várias linhas no campo do `input()`: a primeira vai para o `input()` atual e as outras ficam na fila para os próximos (teste no `terminal.test.js` da Task 3).
- Um erro de sintaxe no REPL (`>>> def f(`) não pode travar o prompt em `...` para sempre: uma linha vazia termina o bloco e mostra o `SyntaxError` (teste no `test_runtime.py` da Task 2).

---

### Task 1: Runtime — saída ao vivo e `input()` interativo

Antes de começar: `git checkout main && git pull && git checkout -b terminal` (o branch `terminal` já tem a spec).

**Files:**
- Modify: `python/diverge_runtime/execucao.py`, `src/python/sessao.js`, `src/python/worker.js`, `src/python/motor.js`
- Test: `python/tests/test_runtime.py`, `tests/terminal-runtime.test.js` (novo), `tests/motor.test.js`

**Interfaces:**
- Produces (Python): `executar(arquivos, principal='main.py', entrada=(), chamadas=(), interativo=False, argv=None)`. Com `interativo=True` e a fila `entrada` vazia, o `input(prompt)` escreve o prompt (que sai ao vivo) e chama `diverge_terminal_js.pedir()`; com JSPI espera com `run_sync` e recebe o texto (ou `None` = EOF → `EOFError`); sem JSPI (ou com `diverge_terminal_js.sem_jspi()` verdadeiro) levanta `_PrecisaDeEntrada`, e o resultado volta com `precisa_entrada: True`. As `chamadas` (funções chamadas pela correção) nunca são interativas. `argv` vira `sys.argv` (`[principal, *argv]`). Toda escrita no `stdout` do aluno também vai para `diverge_terminal_js.escrever(texto)` quando o módulo existe.
- Produces (JS) `criarSessao(pyodide, { pool })`: `sessao.executar(arquivos, { principal, entrada, chamadas, interativo, argv, aoSaida, aoPedirEntrada, semJSPI })`; `aoSaida(texto)`; `aoPedirEntrada() → Promise<string | null>`.
- Produces (worker): mensagens `{ tipo: 'saida', id, texto }` e `{ tipo: 'entrada', id }` para a página; a página responde `{ tipo: 'resposta-entrada', id, texto }` (`texto: null` = EOF).
- Produces (motor): `motor.executar(arquivos, opcoes, { aoSaida, aoPedirEntrada } = {})`; o relógio para entre `entrada` e `resposta-entrada`; `motor.interromper()` encerra o worker, recria e rejeita a execução atual com `new Interrompido()` (classe exportada).

- [ ] **Step 1: Testes que falham**

`python/tests/test_runtime.py` (o JS falso é um módulo instalado em `sys.modules`):

```python
import types


def _terminal_falso(respostas, sem_jspi=True):
    saidas = []
    modulo = types.ModuleType('diverge_terminal_js')
    modulo.escrever = saidas.append
    modulo.sem_jspi = lambda: sem_jspi
    modulo.pedir = lambda: None
    sys.modules['diverge_terminal_js'] = modulo
    return saidas


def test_saida_ao_vivo_e_input_sem_jspi_pede_resposta():
    saidas = _terminal_falso([])
    try:
        r = execucao.executar({'main.py': 'print("antes")\nnome = input("Nome: ")\nprint("Olá", nome)\n'}, interativo=True)
    finally:
        del sys.modules['diverge_terminal_js']
    assert r['precisa_entrada'] is True
    assert r['erro'] is None
    assert ''.join(saidas) == 'antes\nNome: '
    assert r['saida'] == 'antes\nNome: '


def test_input_interativo_usa_as_respostas_ja_dadas_antes_de_pedir():
    _terminal_falso([])
    try:
        r = execucao.executar({'main.py': 'a = input("A: ")\nb = input("B: ")\nprint(a + b)\n'}, entrada=['1'], interativo=True)
    finally:
        del sys.modules['diverge_terminal_js']
    assert r['precisa_entrada'] is True
    assert r['saida'] == 'A: 1\nB: '  # a resposta dada aparece como se tivesse sido digitada


def test_chamadas_da_correcao_nunca_pedem_resposta():
    _terminal_falso([])
    try:
        r = execucao.executar({'main.py': 'def f():\n    return input()\n'}, interativo=True, chamadas=[{'funcao': 'f', 'args': []}])
    finally:
        del sys.modules['diverge_terminal_js']
    assert r['retornos'][0]['erro']['tipo'] == 'EOFError'
    assert not r.get('precisa_entrada')


def test_argv():
    r = execucao.executar({'main.py': 'import sys\nprint(sys.argv)\n'}, argv=['a', 'b'])
    assert r['saida'] == "['main.py', 'a', 'b']\n"
```

`tests/terminal-runtime.test.js` (Pyodide no Node, com JSPI):

```js
// input() interativo e saída ao vivo, com o Python de verdade (Pyodide no Node, JSPI ligado).
import { describe, it, expect } from 'vitest';
import { iniciarPython } from './python-node.js';

const sessao = iniciarPython().then((s) => s.sessao);

describe('terminal: runtime', () => {
  it('a saída chega antes do input() e a resposta digitada continua o programa', async () => {
    const eventos = [];
    const r = await (await sessao).executar({ 'main.py': 'print("antes")\nn = input("Nome: ")\nprint("Olá,", n)\n' }, {
      interativo: true,
      aoSaida: (t) => eventos.push(['saida', t]),
      aoPedirEntrada: async () => { eventos.push(['pediu']); return 'Ana'; },
    });
    expect(r.erro).toBeNull();
    expect(eventos.findIndex((e) => e[0] === 'pediu')).toBeGreaterThan(eventos.findIndex((e) => e[1]?.includes('Nome: ')));
    expect(r.saida).toBe('antes\nNome: Ana\nOlá, Ana\n');
  });

  it('EOF (Ctrl+D) vira EOFError no programa', async () => {
    const r = await (await sessao).executar({ 'main.py': 'input()\n' }, { interativo: true, aoSaida: () => {}, aoPedirEntrada: async () => null });
    expect(r.erro.tipo).toBe('EOFError');
  });

  it('sem JSPI: devolve precisa_entrada com a saída até ali', async () => {
    const r = await (await sessao).executar({ 'main.py': 'print(1)\ninput("x? ")\n' }, { interativo: true, semJSPI: true, aoSaida: () => {}, aoPedirEntrada: async () => 'nunca' });
    expect(r.precisa_entrada).toBe(true);
    expect(r.saida).toBe('1\nx? ');
  });
});
```

`tests/motor.test.js` (no padrão do worker falso que o arquivo já usa):

```js
  it('o relógio para enquanto o programa espera o input() e a página responde', async () => {
    vi.useFakeTimers();
    try {
      const w = workerFalso();
      const motor = new MotorPython({ limiteMs: 1000, criarWorker: () => w });
      w.onmessage({ data: { tipo: 'pronto' } });
      const respostas = [];
      const pendente = motor.executar({}, {}, { aoPedirEntrada: async () => { respostas.push('pediu'); return 'Ana'; } });
      await vi.advanceTimersByTimeAsync(0);
      const { id } = w.enviadas.at(-1);
      w.onmessage({ data: { tipo: 'entrada', id } });
      await vi.advanceTimersByTimeAsync(5000); // esperando a digitação: não estoura
      expect(w.enviadas.at(-1)).toMatchObject({ tipo: 'resposta-entrada', id, texto: 'Ana' });
      w.onmessage({ data: { tipo: 'resposta', id, saida: 'ok' } });
      expect((await pendente).saida).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('interromper rejeita com Interrompido e recria o worker', async () => {
    const criados = [];
    const motor = new MotorPython({ criarWorker: () => { const w = workerFalso(); criados.push(w); return w; } });
    criados[0].onmessage({ data: { tipo: 'pronto' } });
    const pendente = motor.executar({}, {});
    await new Promise((r) => setTimeout(r));
    motor.interromper();
    await expect(pendente).rejects.toBeInstanceOf(Interrompido);
    expect(criados).toHaveLength(2);
  });
```

(Se `motor.test.js` não tiver um `workerFalso` com `enviadas`, crie no topo: `const workerFalso = () => { const w = { enviadas: [], onmessage: null, onerror: null, postMessage: (m) => w.enviadas.push(m), terminate() {} }; return w; };`.)

Run: `python -m pytest python/tests/test_runtime.py -q && npx vitest run tests/terminal-runtime.test.js tests/motor.test.js`
Expected: FAIL (parâmetros `interativo`/`argv` não existem; `Interrompido` não existe).

- [ ] **Step 2: Implementar o runtime Python**

`python/diverge_runtime/execucao.py`:

```python
class _PrecisaDeEntrada(BaseException):
    """O input() precisa de uma resposta e não dá para esperar (sem JSPI): a página pede e roda de novo."""


def _terminal_js():
    try:
        import diverge_terminal_js
    except ImportError:
        return None
    return diverge_terminal_js
```

`_Saida.write`: depois de gravar, `if self.ao_escrever: self.ao_escrever(texto)` (o atributo `ao_escrever` começa `None`; com o terminal presente, `saida.ao_escrever = terminal.escrever`).

`_input` passa a ser:

```python
def _input(entrada, saida, interativo):
    linhas = iter(entrada)
    terminal = _terminal_js() if interativo else None
    fila_acabou = False

    def ler(prompt=''):
        nonlocal fila_acabou
        saida.write(str(prompt))
        if not fila_acabou:
            try:
                resposta = next(linhas)
                if terminal is not None:
                    saida.write(resposta + '\n')  # como se tivesse sido digitada
                return resposta
            except StopIteration:
                fila_acabou = True
        if terminal is None:
            raise EOFError('EOF when reading a line') from None
        if terminal.sem_jspi() or not _pode_esperar():
            raise _PrecisaDeEntrada()
        from pyodide.ffi import run_sync
        resposta = run_sync(terminal.pedir())
        if resposta is None:
            raise EOFError('EOF when reading a line')
        saida.write(str(resposta) + '\n')
        return str(resposta)
    return ler


def _pode_esperar():
    try:
        from pyodide.ffi import can_run_sync
    except ImportError:
        return False
    return can_run_sync()
```

Em `executar(...)`: novos parâmetros `interativo=False, argv=None`; `sys.argv` salvo e trocado por `[principal, *(argv or [])]` (restaurado no `finally`); `saida.ao_escrever = _terminal_js().escrever if interativo and _terminal_js() else None`; o `except BaseException` do `exec` trata `_PrecisaDeEntrada` antes: `precisa = True` (sem erro); as `chamadas` rodam com `builtins.input = _input([], saida, False)` (nunca interativas) e não rodam quando `precisa`; o resultado ganha `'precisa_entrada': precisa`. `executar_json` repassa `interativo` e `argv`.

- [ ] **Step 3: Implementar a ponte JS (sessão, worker e motor)**

`src/python/sessao.js`, em `executar(arquivos, { principal = 'main.py', entrada = [], chamadas = [], interativo = false, argv = [], aoSaida, aoPedirEntrada, semJSPI = false } = {})`: antes de rodar, `pyodide.registerJsModule('diverge_terminal_js', { escrever: (t) => aoSaida?.(t), pedir: () => aoPedirEntrada?.() ?? Promise.resolve(null), sem_jspi: () => semJSPI || !aoPedirEntrada })`; no `finally`, `pyodide.unregisterJsModule('diverge_terminal_js')` e `pyodide.runPython("import sys; sys.modules.pop('diverge_terminal_js', None)")`. `interativo` e `argv` vão no `toPy` dos argumentos.

`src/python/worker.js`:

```js
const esperando = new Map(); // id → resolve da resposta do input()

onmessage = async ({ data }) => {
  if (data.tipo === 'resposta-entrada') {
    esperando.get(data.id)?.(data.texto);
    esperando.delete(data.id);
    return;
  }
  let pendente = '';
  let timer = null;
  const despejar = () => { if (pendente) postMessage({ tipo: 'saida', id: data.id, texto: pendente }); pendente = ''; timer = null; };
  const opcoes = {
    ...data.opcoes,
    aoSaida: (texto) => { pendente += texto; timer ??= setTimeout(despejar, 30); },
    aoPedirEntrada: data.opcoes?.interativo
      ? () => { despejar(); postMessage({ tipo: 'entrada', id: data.id }); return new Promise((r) => esperando.set(data.id, r)); }
      : undefined,
  };
  try {
    const resultado = await (await sessao).executar(data.arquivos, opcoes);
    clearTimeout(timer);
    despejar();
    postMessage({ tipo: 'resposta', id: data.id, ...resultado });
  } catch (erro) {
    postMessage({ tipo: 'resposta', id: data.id, erroInterno: String(erro?.message ?? erro) });
  }
};
```

(O `semJSPI` vem da página: `!('Suspending' in WebAssembly)`.)

`src/python/motor.js`: `export class Interrompido extends Error {}`; `executar(arquivos, opcoes = {}, ganchos = {})` guarda os ganchos com o `id` em `this.ganchos`; no `onmessage`: `tipo === 'saida'` → `this.ganchos.get(id)?.aoSaida?.(texto)`; `tipo === 'entrada'` → `this.armarRelogio?.(null)` (com `null`, só limpa o timeout) e `Promise.resolve(this.ganchos.get(id)?.aoPedirEntrada?.() ?? null).then((texto) => { this.armarRelogio?.(this.limiteMs); this.worker.postMessage({ tipo: 'resposta-entrada', id, texto }); })`. A mensagem de execução vira `{ tipo: 'executar', id, arquivos, opcoes }` (o worker trata qualquer mensagem sem `tipo === 'resposta-entrada'` como execução). `interromper()`: se há execução pendente, rejeita com `new Interrompido('KeyboardInterrupt')`, limpa o relógio e chama `this.iniciar()`.

Run: `python -m pytest python/tests -q && npx vitest run tests/terminal-runtime.test.js tests/motor.test.js tests/runtime.test.js tests/pool.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Runtime: saída ao vivo, input() interativo (JSPI ou repetir) e Ctrl+C no motor"
```

---

### Task 2: REPL (`python`, `python -i`)

**Files:**
- Create: `python/diverge_runtime/repl.py`
- Modify: `python/diverge_runtime/execucao.py` (guarda o escopo do último programa), `src/python/sessao.js`, `src/python/worker.js`, `src/python/motor.js`
- Test: `python/tests/test_runtime.py`, `tests/terminal-runtime.test.js`

**Interfaces:**
- Produces (Python) `diverge_runtime.repl`: `iniciar(do_programa=False) → None` (escopo novo, ou o do último `executar`); `linha(texto) → {'saida', 'erro', 'continua'}` (`continua=True` = bloco incompleto, prompt `...`); `erro` como em `execucao._erro` (traceback só com `<stdin>`). O valor de uma expressão sai com `repr` (como `sys.displayhook`) e vira `_`.
- Produces (JS): `sessao.repl({ acao: 'iniciar', doPrograma })` e `sessao.repl({ acao: 'linha', texto, aoSaida, aoPedirEntrada })` → `{ saida, erro, continua }`; worker: mensagem `{ tipo: 'repl', id, opcoes }`; motor: `motor.repl(opcoes, ganchos)` (mesma fila e relógio das execuções).

- [ ] **Step 1: Testes que falham**

`python/tests/test_runtime.py`:

```python
def test_repl_expressoes_blocos_e_erros():
    from diverge_runtime import repl
    repl.iniciar()
    assert repl.linha('x = 2') == {'saida': '', 'erro': None, 'continua': False}
    assert repl.linha('x * 21')['saida'] == '42\n'
    assert repl.linha('_ + 1')['saida'] == '43\n'
    assert repl.linha("'oi'")['saida'] == "'oi'\n"
    assert repl.linha('None')['saida'] == ''
    assert repl.linha('for i in range(2):')['continua'] is True
    assert repl.linha('    print(i)')['continua'] is True
    assert repl.linha('')['saida'] == '0\n1\n'
    r = repl.linha('1/0')
    assert r['erro']['tipo'] == 'ZeroDivisionError'
    assert 'File "<stdin>", line 1' in r['erro']['traceback']
    assert repl.linha('def f(')['continua'] is True
    r = repl.linha('')  # linha vazia termina o bloco: o erro aparece, o prompt volta a >>>
    assert r['continua'] is False and r['erro']['tipo'] == 'SyntaxError'


def test_repl_com_o_escopo_do_programa():
    from diverge_runtime import repl
    execucao.executar({'main.py': 'total = 10\n'})
    repl.iniciar(do_programa=True)
    assert repl.linha('total + 1')['saida'] == '11\n'
    repl.iniciar()
    assert repl.linha('total')['erro']['tipo'] == 'NameError'
```

`tests/terminal-runtime.test.js`:

```js
  it('REPL: linha a linha, com o escopo do programa (python -i)', async () => {
    const s = await sessao;
    await s.executar({ 'main.py': 'nome = "Ana"\n' });
    await s.repl({ acao: 'iniciar', doPrograma: true });
    expect((await s.repl({ acao: 'linha', texto: 'nome.upper()' })).saida).toBe("'ANA'\n");
    expect((await s.repl({ acao: 'linha', texto: 'if True:' })).continua).toBe(true);
  });
```

Run: `python -m pytest python/tests/test_runtime.py -q -k repl && npx vitest run tests/terminal-runtime.test.js`
Expected: FAIL (`No module named 'diverge_runtime.repl'`).

- [ ] **Step 2: Implementar**

`python/diverge_runtime/repl.py`:

```python
"""O modo interativo do Python (>>>): uma linha por vez, com o escopo da sessão."""
import builtins
import codeop
import sys

from . import execucao
from .execucao import _Saida, _erro, _input

_escopo = {}
_buffer = []


def iniciar(do_programa=False):
    global _escopo
    _buffer.clear()
    base = execucao.ULTIMO_ESCOPO if do_programa and execucao.ULTIMO_ESCOPO is not None else None
    _escopo = base if base is not None else {'__name__': '__main__', '__builtins__': builtins}


def _mostrar(valor):
    if valor is not None:
        _escopo['_'] = valor
        print(repr(valor))


def linha(texto, interativo=False):
    _buffer.append(texto)
    fonte = '\n'.join(_buffer)
    saida = _Saida()
    try:
        codigo = codeop.compile_command(fonte, '<stdin>', 'single')
    except (SyntaxError, OverflowError, ValueError) as e:
        _buffer.clear()
        return {'saida': '', 'erro': _erro(e, {'<stdin>': fonte}), 'continua': False}
    if codigo is None:
        if texto.strip() == '' and len(_buffer) > 1:  # linha vazia termina um bloco que não fecha
            _buffer.clear()
            try:
                compile(fonte, '<stdin>', 'single')
            except SyntaxError as e:
                return {'saida': '', 'erro': _erro(e, {'<stdin>': fonte}), 'continua': False}
            return {'saida': '', 'erro': None, 'continua': False}
        return {'saida': '', 'erro': None, 'continua': True}
    _buffer.clear()
    antigos = sys.stdout, sys.stderr, sys.displayhook, builtins.input
    erro = None
    terminal = execucao._terminal_js() if interativo else None
    saida.ao_escrever = terminal.escrever if terminal else None
    try:
        sys.stdout = sys.stderr = saida
        sys.displayhook = _mostrar
        builtins.input = _input([], saida, interativo)
        exec(codigo, _escopo)
    except BaseException as e:
        erro = _erro(e, {'<stdin>': fonte})
    finally:
        sys.stdout, sys.stderr, sys.displayhook, builtins.input = antigos
    return {'saida': saida.getvalue(), 'erro': erro, 'continua': False}
```

`execucao.py`: `ULTIMO_ESCOPO = None` no módulo; no fim de `executar`, `global ULTIMO_ESCOPO; ULTIMO_ESCOPO = escopo`. Em `_erro`, o filtro já aceita nomes de `arquivos` — `{'<stdin>': fonte}` faz o `<stdin>` entrar.

Sessão/worker/motor: `sessao.repl(opcoes)` chama `diverge_runtime.repl.iniciar(doPrograma)` ou `linha(texto, interativo=Boolean(aoPedirEntrada))` (com o `diverge_terminal_js` registrado como na Task 1) e devolve o JSON; worker trata `{ tipo: 'repl' }` com os mesmos ganchos de saída e entrada; `motor.repl(opcoes, ganchos)` entra na mesma fila de `executar`.

Run: `python -m pytest python/tests -q && npx vitest run tests/terminal-runtime.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "REPL: python e python -i, linha a linha, com blocos e o escopo do programa"
```

---

### Task 3: A tela do terminal (`terminal.js`)

**Files:**
- Create: `src/ui/terminal.js`
- Modify: `index.html` (o terminal: saída + linha do prompt; sai a aba ⌨️ Entrada), `src/estilo.css`
- Test: `tests/terminal.test.js` (novo)

**Interfaces:**
- Produces: `criarTerminal(elemento, { historico = [], aoMudarHistorico = () => {}, completar = () => [] })` →
  - `escrever(texto, classe?)`: acrescenta texto (sem quebra automática) à saída; `classe` `erro` pinta de vermelho;
  - `ler({ prompt, rotulo }) → Promise<string | null>`: mostra o prompt e o campo na mesma linha; resolve com a linha digitada (Enter), `null` com Ctrl+D; Ctrl+C rejeita com `new Cancelado()` (classe exportada); o texto digitado fica na saída;
  - `limpar()`; `cancelarLeitura()`; `focar()`; `ocupado` (getter: há uma leitura aberta);
  - `fila`: linhas coladas a mais (entregues às próximas leituras).
- HTML: `<div id="terminal" class="terminal terminal-python" role="region" aria-label="Terminal"><pre id="saida-terminal" class="saida-terminal" role="log" aria-live="polite"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal" autocomplete="off" spellcheck="false" aria-label="Comando do terminal"></div></div>`.

- [ ] **Step 1: Testes que falham**

`tests/terminal.test.js`:

```js
// @vitest-environment happy-dom
// A tela do terminal: prompt e campo na mesma linha, histórico, teclas e leitor de tela.
import { describe, it, expect, beforeEach } from 'vitest';
import { criarTerminal, Cancelado } from '../src/ui/terminal.js';

let t;
let historico;
const campo = () => document.getElementById('campo-terminal');
const saida = () => document.getElementById('saida-terminal').textContent;
const tecla = (key, extra = {}) => campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }));
const digitar = (texto) => { campo().value = texto; tecla('Enter'); };

beforeEach(() => {
  document.body.innerHTML = '<div id="terminal"><pre id="saida-terminal" role="log"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal"></div></div>';
  historico = [];
  t = criarTerminal(document.getElementById('terminal'), { historico: [], aoMudarHistorico: (h) => { historico = h; }, completar: (texto) => ['python', 'pip'].filter((c) => c.startsWith(texto)) });
});

describe('terminal', () => {
  it('o prompt e o campo ficam na mesma linha; o digitado fica na saída', async () => {
    t.escrever('Olá\n');
    const lido = t.ler({ prompt: 'Nome: ', rotulo: 'Resposta para o input()' });
    expect(document.getElementById('prompt-terminal').textContent).toBe('Nome: ');
    expect(campo().getAttribute('aria-label')).toBe('Resposta para o input()');
    digitar('Ana');
    expect(await lido).toBe('Ana');
    expect(saida()).toBe('Olá\nNome: Ana\n');
  });

  it('histórico com as setas e salvo', async () => {
    let p = t.ler({ prompt: '$ ' });
    digitar('python main.py');
    await p;
    p = t.ler({ prompt: '$ ' });
    tecla('ArrowUp');
    expect(campo().value).toBe('python main.py');
    tecla('ArrowDown');
    expect(campo().value).toBe('');
    digitar('ls');
    await p;
    expect(historico).toEqual(['python main.py', 'ls']);
  });

  it('Tab completa, Ctrl+C cancela, Ctrl+D é EOF, Ctrl+L limpa', async () => {
    let p = t.ler({ prompt: '$ ' });
    campo().value = 'py';
    tecla('Tab');
    expect(campo().value).toBe('python ');
    tecla('c', { ctrlKey: true });
    await expect(p).rejects.toBeInstanceOf(Cancelado);
    expect(saida()).toContain('$ python ^C');
    p = t.ler({ prompt: '' });
    tecla('d', { ctrlKey: true });
    expect(await p).toBeNull();
    t.escrever('lixo\n');
    t.ler({ prompt: '$ ' });
    tecla('l', { ctrlKey: true });
    expect(saida()).toBe('');
  });

  it('Esc tira o foco do terminal (Tab completa, então ninguém fica preso)', () => {
    t.ler({ prompt: '$ ' });
    campo().focus();
    tecla('Escape');
    expect(document.activeElement).not.toBe(campo());
  });

  it('colar várias linhas: a primeira responde agora, as outras ficam na fila', async () => {
    const p = t.ler({ prompt: 'A: ' });
    campo().dispatchEvent(Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: { getData: () => '1\n2\n3' } }));
    expect(await p).toBe('1');
    expect(await t.ler({ prompt: 'B: ' })).toBe('2');
    expect(await t.ler({ prompt: 'C: ' })).toBe('3');
  });

  it('guarda no máximo 5000 linhas', () => {
    t.escrever(Array.from({ length: 6000 }, (_, i) => `linha ${i}`).join('\n') + '\n');
    const linhas = saida().split('\n').filter(Boolean);
    expect(linhas).toHaveLength(5000);
    expect(linhas.at(-1)).toBe('linha 5999');
  });
});
```

Run: `npx vitest run tests/terminal.test.js`
Expected: FAIL (o módulo não existe).

- [ ] **Step 2: Implementar `src/ui/terminal.js`**

Pontos que os testes fixam: `escrever` acrescenta ao `textContent` do `<pre>` (com `classe`, num `<span>`), corta para as últimas 5000 linhas e rola para o fim só se a pessoa já estava no fim; `ler` troca o texto do `#prompt-terminal`, o `aria-label` do campo (padrão "Comando do terminal"), limpa o campo e devolve uma promessa resolvida no Enter (escreve `prompt + texto + '\n'` na saída); Enter numa leitura de comando grava o comando no histórico (sem repetir o último igual; até 100; chama `aoMudarHistorico`); ↑/↓ navegam; Tab chama `completar(valor)` — uma opção completa (com espaço no fim), várias escrevem a lista na saída; Ctrl+C escreve `prompt + valor + '^C\n'` e rejeita com `Cancelado`; Ctrl+D com o campo vazio resolve `null`; Ctrl+L chama `limpar()`; Esc tira o foco (`campo.blur()` e foco no próximo elemento focável da tela); colar com quebras de linha entrega a primeira e guarda o resto em `fila`, que `ler` consome antes de esperar o teclado; clicar no terminal (fora de texto selecionado) foca o campo; sem leitura aberta, o campo fica desabilitado.

`index.html`: o painel de saída fica só com a aba 🖥️ Terminal (sai a aba ⌨️ Entrada e o `<textarea id="entrada">`); o `<pre id="saida-terminal">` vai para dentro do `<div id="terminal">` com a linha do prompt (HTML da seção Interfaces). `src/estilo.css`: `.linha-prompt` (flex, mesma fonte do terminal), o campo sem borda e transparente, com `caret-color` da cor do texto; `.a11y-sem-movimento` sem animação no cursor; `:focus-visible` no campo com o contorno do site.

Run: `npx vitest run tests/terminal.test.js && npx eslint .`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Terminal: prompt e campo na mesma linha, histórico, Tab, Ctrl+C/D/L, Esc e colar várias linhas"
```

---

### Task 4: O shell e a tela do exercício

**Files:**
- Create: `src/ui/shell.js`
- Modify: `src/ui/item.js`, `src/progresso.js`, `src/privacidade.js`, `src/ui/tutorial-passos.js`, `src/ui/declaracao-acessibilidade.js`, `src/conteudo/trilha.js` (o texto do `LIVRE` sem a aba Entrada), as lições com `entrada` (o texto passa a dizer o que digitar)
- Test: `tests/shell.test.js` (novo), `tests/item-python.test.js`, `tests/privacidade.test.js`, `tests/acessibilidade-telas.test.js`

**Interfaces:**
- Consumes: `criarTerminal` (Task 3); `motor.executar(arquivos, opcoes, ganchos)`, `motor.repl`, `motor.interromper`, `Interrompido` (Tasks 1 e 2).
- Produces: `criarShell({ terminal, motor, arquivos: () => ({...}), pasta: () => 'py-ola', semJSPI = !('Suspending' in WebAssembly), aoTerminar = (r) => {} })` →
  - `rodar(linha) → Promise`: interpreta um comando (seção 4 da spec) e escreve a saída no terminal;
  - `iniciar()`: o laço do prompt (`aluno@sertao:~/<pasta>$ `), até `parar()`;
  - `parar()`; `executarPrograma(arquivo = 'main.py', argv = [])` (o que o ▶ Executar usa: escreve `$ python main.py` como se fosse digitado e roda);
  - `completar(texto) → string[]` (comandos e nomes de arquivo).
- `progresso.js`: saem `lerEntrada`/`gravarEntrada` (`entrada:*`); entram `lerHistorico()`/`gravarHistorico(lista)` (chave `historico`).

- [ ] **Step 1: Testes que falham**

`tests/shell.test.js`:

```js
// @vitest-environment happy-dom
// O shell: cada comando, o REPL, o input() (com e sem JSPI) e o Ctrl+C, com um motor falso.
import { describe, it, expect, beforeEach } from 'vitest';
import { criarTerminal } from '../src/ui/terminal.js';
import { criarShell } from '../src/ui/shell.js';
import { Interrompido } from '../src/python/motor.js';

let terminal;
const saida = () => document.getElementById('saida-terminal').textContent;
const campo = () => document.getElementById('campo-terminal');
const digitar = (texto) => { campo().value = texto; campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
const espera = () => new Promise((r) => setTimeout(r, 5));

function shell(motor, extra = {}) {
  return criarShell({ terminal, motor, arquivos: () => ({ 'main.py': 'print(1)\n', 'dados.csv': 'a,b\n' }), pasta: () => 'py-ola', semJSPI: false, ...extra });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="terminal"><pre id="saida-terminal"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal"></div></div>';
  terminal = criarTerminal(document.getElementById('terminal'));
});

describe('shell', () => {
  it('ls, cat, help, pip e comando desconhecido', async () => {
    const s = shell({});
    await s.rodar('ls');
    await s.rodar('cat dados.csv');
    await s.rodar('pip install pandas');
    await s.rodar('xyz');
    expect(saida()).toContain('dados.csv  main.py');
    expect(saida()).toContain('a,b');
    expect(saida()).toContain('não dá para instalar pacotes');
    expect(saida()).toContain('bash: xyz: command not found');
  });

  it('python arquivo args: saída ao vivo, argv e input() respondido no terminal', async () => {
    const motor = {
      executar: async (arquivos, opcoes, ganchos) => {
        ganchos.aoSaida('Nome: ');
        const nome = await ganchos.aoPedirEntrada();
        return { saida: `Nome: ${nome}\nOlá, ${nome}\n`, erro: null, argv: opcoes.argv, principal: opcoes.principal };
      },
    };
    const feito = shell(motor).rodar('python main.py a b');
    await espera();
    digitar('Ana');
    await feito;
    expect(saida()).toBe('Nome: Ana\nOlá, Ana\n');
  });

  it('sem JSPI: repete o programa com as respostas e mostra só a saída nova', async () => {
    const chamadas = [];
    const motor = {
      executar: async (arquivos, opcoes) => {
        chamadas.push(opcoes.entrada);
        if (!opcoes.entrada.length) return { saida: 'oi\nNome: ', erro: null, precisa_entrada: true };
        return { saida: `oi\nNome: ${opcoes.entrada[0]}\nfim\n`, erro: null };
      },
    };
    const feito = shell(motor, { semJSPI: true }).rodar('python main.py');
    await espera();
    digitar('Bia');
    await feito;
    expect(chamadas).toEqual([[], ['Bia']]);
    expect(saida()).toContain('oi\nNome: Bia\nfim\n');
    expect(saida().match(/oi/g)).toHaveLength(1);
    expect(saida()).toContain('neste navegador o programa roda de novo');
  });

  it('o traceback sai em vermelho e Ctrl+C mostra KeyboardInterrupt', async () => {
    let rejeitar;
    const motor = {
      executar: () => new Promise((_, r) => { rejeitar = r; }),
      interromper: () => rejeitar(new Interrompido('KeyboardInterrupt')),
    };
    const feito = shell(motor).rodar('python main.py');
    await espera();
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    await feito;
    expect(saida()).toContain('KeyboardInterrupt');
  });

  it('python abre o REPL; exit() sai', async () => {
    const linhas = [];
    const motor = { repl: async (opcoes) => { if (opcoes.acao === 'linha') linhas.push(opcoes.texto); return { saida: opcoes.texto === '1+1' ? '2\n' : '', erro: null, continua: opcoes.texto === 'if True:' }; } };
    const feito = shell(motor).rodar('python');
    await espera();
    digitar('1+1');
    await espera();
    digitar('if True:');
    await espera();
    expect(document.getElementById('prompt-terminal').textContent).toBe('... ');
    digitar('');
    await espera();
    digitar('exit()');
    await feito;
    expect(saida()).toContain('>>> 1+1\n2\n');
    expect(linhas).toEqual(['1+1', 'if True:', '']);
  });
});
```

`tests/item-python.test.js`: o teste "as linhas da aba ⌨️ Entrada vão para o input()" sai; entram:

```js
  it('não existe mais a aba ⌨️ Entrada', () => {
    montar({ saida: '', erro: null });
    expect(document.getElementById('entrada')).toBeNull();
    expect(document.querySelector('[data-saida="entrada"]')).toBeNull();
  });

  it('▶ Executar roda os testes visíveis e depois python main.py no terminal', async () => {
    const { tela, pedidos } = montar({ saida: 'Olá\n', erro: null });
    tela.abrir('py-ola');
    await new Promise((r) => setTimeout(r, 20));
    pedidos.length = 0;
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 30));
    const ultimo = pedidos.at(-1);
    expect(ultimo.interativo).toBe(true);
    expect(pedidos.slice(0, -1).every((p) => !p.interativo)).toBe(true);
    expect(document.getElementById('saida-terminal').textContent).toContain('$ python main.py');
  });

  it('trocar de exercício com o programa esperando um input() cancela a espera', async () => {
    const motor = { executar: async (a, o, g) => (o.interativo ? (await g.aoPedirEntrada(), { saida: '', erro: null }) : { saida: '', erro: null }), interromper() {} };
    const { tela } = montarCom(motor);
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(tela.terminal.ocupado).toBe(true);
    tela.abrir('py-ola');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('prompt-terminal').textContent).not.toBe('');
  });
```

(`montarCom(motor)` é o `montar` com um motor dado; `montar` passa a criar o motor falso com `executar(arquivos, opcoes, ganchos)` que registra `{ ...opcoes, arquivos }` e devolve a resposta; `criarTelaItem` expõe `terminal` para o teste.)

`tests/privacidade.test.js`: nada muda no teste (ele confere as chaves do `progresso.js`); o `privacidade.js` troca `entrada:*` por `historico`.

`tests/acessibilidade-telas.test.js`: um caso com o terminal esperando um `input()` (rótulo "Resposta para o input()") sem violações do axe-core nos 4 temas.

Run: `npx vitest run tests/shell.test.js tests/item-python.test.js tests/privacidade.test.js tests/acessibilidade-telas.test.js`
Expected: FAIL.

- [ ] **Step 2: Implementar `src/ui/shell.js`**

```js
// O shell do terminal: interpreta os comandos (python, ls, cat, clear, help, pip) e conversa
// com o motor. O input() do programa é lido no próprio terminal; sem JSPI, o programa roda de
// novo com as respostas já dadas e só a saída nova aparece.
import { Cancelado } from './terminal.js';
import { Interrompido } from '../python/motor.js';

const AJUDA = `Comandos:
  python <arquivo> [argumentos]   roda o arquivo (os argumentos vão para sys.argv)
  python -i <arquivo>             roda e continua no modo interativo (>>>)
  python                          modo interativo do Python; exit() ou Ctrl+D para sair
  ls / cat <arquivo>              lista os arquivos / mostra um arquivo
  clear                           limpa o terminal (Ctrl+L)
Teclas: ↑/↓ histórico · Tab completa · Ctrl+C interrompe · Esc sai do terminal
`;

export function dividir(linha) {
  const partes = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(linha))) partes.push(m[1] ?? m[2] ?? m[3]);
  return partes;
}

export function criarShell({ terminal, motor, arquivos, pasta, semJSPI = !('Suspending' in WebAssembly), aoTerminar = () => {} }) {
  let ativo = false;

  const prompt = () => `aluno@sertao:~/${pasta()}$ `;
  const escreverResultado = (r, jaMostrado = 0) => {
    if (r.saida && r.saida.length > jaMostrado) terminal.escrever(r.saida.slice(jaMostrado));
    if (r.erro) terminal.escrever(r.erro.traceback, 'erro');
  };

  async function lerEntrada() {
    try {
      return await terminal.ler({ prompt: '', rotulo: 'Resposta para o input()' });
    } catch (erro) {
      if (erro instanceof Cancelado) motor.interromper?.();
      throw erro;
    }
  }

  async function executarPrograma(arquivo = 'main.py', argv = [], { interativoDepois = false } = {}) {
    if (!arquivos()[arquivo]) {
      terminal.escrever(`python: can't open file '${arquivo}': [Errno 2] No such file or directory\n`, 'erro');
      return null;
    }
    const opcoes = { principal: arquivo, argv, interativo: true, entrada: [] };
    try {
      let r;
      let mostrado = 0;
      for (;;) {
        r = await motor.executar(arquivos(), opcoes, {
          aoSaida: (texto) => { terminal.escrever(texto); mostrado += texto.length; },
          aoPedirEntrada: semJSPI ? undefined : lerEntrada,
        });
        if (!r.precisa_entrada) break;
        if (!opcoes.avisado) {
          terminal.escrever('\n(neste navegador o programa roda de novo a cada resposta: o resultado é o mesmo)\n', 'aviso');
          opcoes.avisado = true;
          mostrado = r.saida.length;
        }
        if (mostrado < r.saida.length) { terminal.escrever(r.saida.slice(mostrado)); mostrado = r.saida.length; }
        const resposta = await lerEntrada();
        if (resposta === null) { opcoes.entrada.push(null); break; }
        opcoes.entrada = [...opcoes.entrada, resposta];
        mostrado = r.saida.length + resposta.length + 1;
      }
      escreverResultado(r, mostrado);
      aoTerminar(r);
      if (interativoDepois) await repl({ doPrograma: true });
      return r;
    } catch (erro) {
      if (erro instanceof Interrompido || erro instanceof Cancelado) {
        terminal.escrever('\nKeyboardInterrupt\n', 'erro');
        return null;
      }
      throw erro;
    }
  }

  async function repl({ doPrograma = false } = {}) {
    await motor.repl({ acao: 'iniciar', doPrograma });
    if (!doPrograma) terminal.escrever('Python 3.14 (Pyodide) no navegador\nDigite exit() ou Ctrl+D para sair.\n');
    let continua = false;
    for (;;) {
      let linha;
      try {
        linha = await terminal.ler({ prompt: continua ? '... ' : '>>> ', rotulo: 'Linha do Python' });
      } catch (erro) {
        if (erro instanceof Cancelado) { terminal.escrever('KeyboardInterrupt\n', 'erro'); continua = false; continue; }
        throw erro;
      }
      if (linha === null || (!continua && /^\s*(exit|quit)\(\)\s*$/.test(linha))) return;
      const r = await motor.repl({ acao: 'linha', texto: linha }, { aoSaida: () => {}, aoPedirEntrada: semJSPI ? undefined : lerEntrada });
      escreverResultado(r);
      continua = r.continua;
    }
  }

  async function rodar(linha) {
    const [comando, ...args] = dividir(linha);
    if (!comando) return;
    if (comando === 'clear') return terminal.limpar();
    if (comando === 'help') return terminal.escrever(AJUDA);
    if (comando === 'ls') return terminal.escrever(`${Object.keys(arquivos()).sort().join('  ')}\n`);
    if (comando === 'cat') {
      const texto = arquivos()[args[0]];
      return terminal.escrever(texto === undefined ? `cat: ${args[0] ?? ''}: No such file or directory\n` : texto.endsWith('\n') ? texto : `${texto}\n`, texto === undefined ? 'erro' : undefined);
    }
    if (comando === 'pip' || comando === 'pip3') return terminal.escrever('No DivergePython não dá para instalar pacotes: o Python roda no seu navegador, só com a biblioteca padrão.\n');
    if (comando === 'python' || comando === 'python3') {
      if (!args.length) return repl();
      if (args[0] === '-i') return executarPrograma(args[1] ?? 'main.py', args.slice(2), { interativoDepois: true });
      return executarPrograma(args[0], args.slice(1));
    }
    terminal.escrever(`bash: ${comando}: command not found\n`, 'erro');
  }

  async function iniciar() {
    ativo = true;
    while (ativo) {
      let linha;
      try {
        linha = await terminal.ler({ prompt: prompt(), rotulo: 'Comando do terminal' });
      } catch (erro) {
        if (erro instanceof Cancelado) continue;
        throw erro;
      }
      if (linha === null) continue;
      await rodar(linha);
    }
  }

  return {
    rodar, iniciar, executarPrograma,
    parar() { ativo = false; terminal.cancelarLeitura(); },
    completar(texto) {
      const palavras = dividir(texto);
      const ultima = texto.endsWith(' ') ? '' : palavras.at(-1) ?? '';
      const opcoes = palavras.length <= 1 && !texto.endsWith(' ')
        ? ['python', 'ls', 'cat', 'clear', 'help', 'pip']
        : Object.keys(arquivos());
      return opcoes.filter((o) => o.startsWith(ultima));
    },
  };
}
```

(`terminal.cancelarLeitura()` rejeita a leitura aberta com `Cancelado` sem escrever `^C`.)

- [ ] **Step 3: Ligar na tela do exercício (`src/ui/item.js`)**

- O terminal e o shell são criados uma vez (`criarTerminal($('terminal'), { historico: lerHistorico(), aoMudarHistorico: gravarHistorico, completar: (t) => shell.completar(t) })`) e expostos em `criarTelaItem(...).terminal`.
- `mostrarTerminal(r)` passa a escrever no terminal só para as execuções não interativas que não têm shell (a correção não escreve no terminal; ela vai para a aba 🧪 Testes).
- `executar({ abrirTestes, falar })`: (1) se o programa estiver esperando `input()`, `motor.interromper()` e espera o motor ficar pronto; (2) roda os testes visíveis (`rodarTestes({ incluirOcultos: false })`, como hoje); (3) `shell.executarPrograma('main.py')`, que escreve `$ python main.py` antes (com o prompt do shell) e roda interativo; (4) o status e a fala vêm do resultado do programa (`aoTerminar`), como hoje; (5) o laço do shell (`shell.iniciar()`) continua esperando comandos.
- `abrir(id)`: `shell.parar()`, `terminal.limpar()`, `motor.interromper()` se houver programa esperando, e depois `executar()` (sem testes, como hoje para lições).
- Sai tudo da aba ⌨️ Entrada (`entradaAtual`, `lerEntrada`, `gravarEntrada`, `el.entrada`, `DICA_EOF`). O `EOFError` do programa passa a ter a dica: `💡 O programa pediu um input() e recebeu Ctrl+D (fim da entrada).`
- `progresso.js`: `lerHistorico = () => ler('historico', [])`, `gravarHistorico = (lista) => gravar('historico', lista.slice(-100))`; saem `lerEntrada`/`gravarEntrada`.
- `privacidade.js`: `{ chave: 'historico', dado: 'Os últimos 100 comandos que você digitou no terminal', finalidade: 'As setas ↑/↓ do terminal' }` no lugar de `entrada:*`.
- Textos: tutorial (o passo do terminal explica que dá para digitar), `LIVRE.resumo` (sem a aba Entrada: "Se o código usar `input()`, digite a resposta no próprio terminal"), lições com `entrada` (o texto diz o que digitar), declaração de acessibilidade (o terminal tem campo com rótulo e Esc para sair).

Run: `npx vitest run && npx eslint . && python -m pytest -q`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Shell no terminal: python, REPL, ls, cat; Executar roda os testes e depois o programa; sai a aba Entrada"
```

---

### Task 5: Versão 0.3.2, auditoria e publicação

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/novidades.js`, `README.md`

- [ ] **Step 1: Versão e textos**

`npm version 0.3.2 --no-git-tag-version`. `src/novidades.js`, no topo:

```js
  {
    versao: '0.3.2',
    data: '2026-10-14', // a data do dia da publicação
    titulo: 'Um terminal de verdade',
    resumo: 'O input() é respondido no próprio terminal, o print aparece na hora, e dá para digitar comandos e usar o Python interativo (>>>).',
    grupos: [
      { titulo: '🖥️ Terminal', itens: ['O programa para no input() e você digita a resposta no terminal, na mesma linha da pergunta.', 'O print aparece na hora em que roda.', 'Depois que o programa termina, o prompt $ aceita python main.py, python (o modo >>>), python -i, ls, cat, clear e help.', 'Setas para o histórico, Tab para completar, Ctrl+C para interromper, Ctrl+L para limpar.', 'A aba ⌨️ Entrada saiu: tudo acontece no terminal.'] },
      { titulo: '♿ Acessibilidade', itens: ['O campo do terminal tem rótulo (comando, resposta do input() ou linha do Python) e a saída nova é anunciada sem reler tudo.', 'Esc tira o foco do terminal (o Tab completa comandos).'] },
    ],
  },
```

`README.md`: a seção do terminal passa a descrever o terminal interativo; sai a aba ⌨️ Entrada.

- [ ] **Step 2: Auditoria**

Run: `npx eslint . && npx vitest run && python -m pytest -q && CERTIFICADO_SEGREDO=<valor aleatório descartável> npm run build`
Expected: tudo verde, build sem avisos.

No navegador (build + preview): `#/p/py-ola` (▶ Executar → testes e depois o programa pedindo o nome no terminal; digitar e ver a saudação), `#/livre` (`python`, `1+1`, um `for` com `...`, `exit()`; Ctrl+C num `while True: pass`), um exercício com vários `input()`; axe-core sem violações nos 4 temas a 1280 px e a 320 px em `#/p/py-ola` (terminal esperando resposta) e `#/livre`.

- [ ] **Step 3: Pedir o "sim" do usuário e publicar**

Mostre o resumo e pergunte se pode publicar. Depois do "sim":

```bash
git checkout main && git merge --ff-only terminal && git push origin main
gh run watch $(gh run list -R sertaoseracloud/python-playground --branch main --limit 1 --json databaseId -q '.[0].databaseId') -R sertaoseracloud/python-playground --exit-status
git tag -a v0.3.2 -m "Versão 0.3.2" && git push origin v0.3.2
gh release create v0.3.2 -R sertaoseracloud/python-playground --verify-tag --title "v0.3.2 · Um terminal de verdade" --notes-file ../notas-0.3.2.md
git checkout fase-4 && git merge --no-edit main && git push
```
