# DivergePython — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versão 0.1.0 do DivergePython: a plataforma completa (herdada do DivergePHP), Python real no navegador com Pyodide, a prova de conceito do pool de workers paralelos, o playground livre e o módulo 🐍 Python básico (40 exercícios + 10 lições).

**Architecture:** O repositório nasce de uma cópia dos arquivos versionados do `php-playground`. Sai o motor PHP (`src/php/`, prévia em iframe, banco SQLite); entra `src/python/` (motor no main thread, worker com Pyodide, sessão compartilhada com os testes no Node, pool de workers) e a pasta `python/` com o pacote `diverge_runtime`, montado no sistema de arquivos virtual do Pyodide. A correção passa a usar regras de Python (saída, variável, função, erro, código).

**Tech Stack:** Vite 8, vitest 5 (happy-dom), ESLint 10, CodeMirror 6 com `@codemirror/lang-python`, Pyodide `314.0.7` (Python 3.14), cloudpickle 3.1.1 (vendorizado), axe-core 4.14.0, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-13-divergepython-design.md`

## Global Constraints

- Nome do site: **DivergePython**. Repositório `sertaoseracloud/python-playground`. URL `https://sertaoseracloud.github.io/python-playground/`.
- Prefixo do localStorage: `python-playground:`. Rótulo de derivação das chaves: `python-playground:` (em `vite.config.js`).
- Pyodide exatamente `314.0.7`, servido pelo próprio site (nada de CDN de terceiros).
- Certificados emitidos por "Sertão será cloud", assinados por "Cláudio Raposo"; carga horária: lição 10 min, fácil 15, médio 30, difícil 45, soma arredondada para cima, mínimo 1 h.
- Textos do site em português do Brasil, com acentuação correta. Comentários de código em português, no estilo dos outros dois repositórios.
- Acessibilidade: WCAG 2.2 AA; o teste `tests/acessibilidade-telas.test.js` (axe-core) não pode ter violações.
- Commits como "Cláudio Raposo" <engcfraposo@gmail.com>, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nada é publicado (repositório no GitHub, push, release) sem o "sim" do usuário.
- Sem dependências novas além das listadas no Tech Stack.

## Review Focus

1. **Laço infinito no código do aluno** (`while True: pass`): depois de 10 s o worker é recriado, aparece "⏱️ O Python passou de 10 s e foi interrompido" e o próximo ▶ Executar funciona. Teste na Task 3.
2. **`input()` sem entrada suficiente:** dá `EOFError: EOF when reading a line`, como o Python real, sem travar. Teste na Task 2.
3. **Saída gigante** (`for i in range(10**6): print(i)`): a saída é cortada em 100.000 caracteres com o aviso "… (saída cortada)", e a página não trava. Teste na Task 2.
4. **Arquivo do aluno com nome de módulo da biblioteca padrão** (`json.py`, `random.py`): a correção continua funcionando, porque o runtime importa o que precisa antes e não depende do `sys.path` do aluno. Teste na Task 2.
5. **Retorno que não vira JSON** (função, objeto, `float('nan')`): a verificação falha com o `repr` no campo "Obtido" e um motivo claro, sem erro interno. Teste na Task 4.

---

## File Structure

```
python-playground/
├─ index.html                      (adaptado: painel de saída sem iframe/banco; aba ⌨️ Entrada)
├─ vite.config.js                  (adaptado: plugin que serve/copia o Pyodide; sem php-wasm)
├─ vitest.config.js                (adaptado: --experimental-wasm-jspi)
├─ package.json                    (python-playground 0.1.0; pyodide 314.0.7; lang-python)
├─ python/
│  ├─ diverge_runtime/__init__.py
│  ├─ diverge_runtime/execucao.py  (roda o código do aluno e devolve JSON)
│  ├─ diverge_runtime/valores.py   (Python → JSON com repr de reserva)
│  ├─ diverge_runtime/pool.py      (mapear(funcao, itens) no pool, com reserva sequencial)
│  ├─ vendor/cloudpickle/          (cloudpickle 3.1.1, BSD-3, com LICENSE)
│  └─ tests/test_runtime.py        (pytest em CPython)
├─ src/python/
│  ├─ motor.js                     (MotorPython: fila, tempo limite, reinício)
│  ├─ worker.js                    (worker principal: Pyodide + sessão + pool)
│  ├─ sessao.js                    (criarSessao(pyodide, { mapear }) — usada no worker e nos testes)
│  ├─ carregar.js                  (carregarPython(): Pyodide com indexURL certo, no navegador e no Node)
│  ├─ pool.js                      (PoolPython: distribui tarefas em N workers e mede tempos)
│  └─ worker-tarefa.js             (worker do pool: roda (funcao, item) serializados)
├─ src/corrigir.js, src/verificacoes.js   (reescritos para Python)
├─ src/conteudo/trilha.js, src/conteudo/basico.js, src/conteudo/glossario.js, src/conteudo/util.js
├─ src/ui/item.js                  (adaptado)
└─ tests/python-node.js, tests/runtime.test.js, tests/motor.test.js, tests/pool.test.js,
   tests/corrigir.test.js, tests/verificacoes.test.js, tests/conteudo.test.js (+ os herdados)
```

O `pool` fica **dentro do worker principal** (workers podem abrir workers), e não no main thread como no desenho da especificação. A interface é a mesma e evita um vai e volta pela página a cada tarefa.

---

### Task 1: Base copiada do DivergePHP, com a identidade do DivergePython

**Files:**
- Create: tudo o que o `git archive` do `php-playground` traz
- Delete: `src/php/`, `src/navegacao.js`, `src/php-stub.js`, `src/conteudo/*` (todo o conteúdo PHP), `tests/php-node.js`, `tests/sessao.test.js`, `tests/navegacao-compartilhar.test.js`, `tests/corrigir.test.js`, `tests/verificacoes.test.js`, `tests/conteudo.test.js`, `tests/testes-detalhados.test.js`, `tests/glossario.test.js`, `public/badges/*`
- Modify: `package.json`, `vite.config.js`, `src/seo.js`, `src/certificados.js`, `src/progresso.js`, `src/licenca.js`, `src/novidades.js`, `src/privacidade.js`, `public/manifest.webmanifest`, `README.md`, `LICENSE-CONTEUDO.md`, `index.html`, `src/ui/tutorial-passos.js`, `src/ui/paginas-legais.js`, `src/ui/privacidade.js`
- Create: `src/conteudo/trilha.js` (provisório, com 1 lição real), `src/conteudo/basico.js`

**Interfaces:**
- Produces: `modulos`, `itens`, `problemas`, `LIVRE`, `buscarItem(id)`, `vizinhos(id)`, `DIFICULDADES` em `src/conteudo/trilha.js` (mesma forma do PHP); `NOME = 'DivergePython'`; `SITE = 'https://sertaoseracloud.github.io/python-playground/'`.

- [ ] **Step 1: Copiar só os arquivos versionados do DivergePHP**

```bash
cd python-playground
git -C ../php-playground archive HEAD | tar -x -C .
git rm -q --cached -r . 2>/dev/null; git add docs
rm -rf src/php src/navegacao.js src/php-stub.js src/conteudo public/badges
rm -f tests/php-node.js tests/sessao.test.js tests/navegacao-compartilhar.test.js tests/corrigir.test.js \
      tests/verificacoes.test.js tests/conteudo.test.js tests/testes-detalhados.test.js tests/glossario.test.js
mkdir -p src/conteudo src/python python
```

- [ ] **Step 2: Trocar a identidade**

Substituições exatas (em todos os arquivos de `src/`, `scripts/`, `tests/`, `index.html`, `public/manifest.webmanifest`, `README.md`, `LICENSE-CONTEUDO.md`, `vite.config.js`, `package.json`):

| De | Para |
| --- | --- |
| `DivergePHP` | `DivergePython` |
| `php-playground` | `python-playground` |
| `PHP 8.4` (textos da interface) | `Python 3.14` |

Em seguida, ajustes manuais:
- `package.json`: `"name": "python-playground"`, `"version": "0.1.0"`, `"description": "DivergePython: Python até PySpark no navegador, com dados em paralelo e acessibilidade para pessoas cegas, surdas e neurodivergentes"`; remover `@codemirror/lang-php`, `@php-wasm/*`; adicionar `"@codemirror/lang-python": "6.2.1"`, `"pyodide": "314.0.7"`.
- `src/seo.js`: `PRINCIPAL.titulo = \`${NOME}: Python e PySpark acessíveis para todas as pessoas\``; `PRINCIPAL.descricao = \`Aprenda Python e PySpark grátis com acessibilidade: leitor de tela, Libras, teclado e perfis para TDAH e dislexia. ${problemas.length} exercícios com certificado.\``; `og:image:alt` → `${NOME}: Python acessível, com leitor de tela, Libras e perfis para neurodivergentes`; descrição do `Course` → `Trilha gamificada e acessível com ${totalLicoes} lições e ${problemas.length} exercícios corrigidos por testes automáticos: do Python básico ao PySpark, com dados em paralelo.`
- `src/certificados.js`: `EMISSOR.curso = 'DivergePython: do Python ao PySpark com dados em paralelo'`; `CERTIFICADOS = { basico: { titulo: 'Fundamentos de Python', ... } }` (veja a Task 9; por enquanto `titulo`, `resumo`, `conteudos` e `cargaHoraria` calculada). Remova o certificado `final` nesta fase (ver Step 4).
- `src/novidades.js`: `RELEASES` com uma única entrada `0.1.0` (texto na Task 10).
- `src/licenca.js`: trocar o pacote `@php-wasm/web` (GPL) por `pyodide` (MPL-2.0) e acrescentar `cloudpickle` (BSD-3-Clause) e `@codemirror/lang-python` (MIT) em `TERCEIROS`; o comentário "Por que AGPL" passa a citar os dois sites irmãos.

- [ ] **Step 3: Trilha provisória com uma lição real**

`src/conteudo/basico.js`:

```js
// 🐍 Python básico: variáveis, tipos, strings, condições, laços, funções, listas,
// dicionários e exceções. Lições (tipo 'licao') e problemas (tipo 'problema').
export const moduloBasico = {
  id: 'basico',
  titulo: 'Python básico',
  icone: '🐍',
  descricao: 'Variáveis, tipos, condições, laços, funções, listas, dicionários e exceções.',
  itens: [
    {
      id: 'licao-ola',
      tipo: 'licao',
      titulo: 'Olá, Python',
      texto: `
        <p>Em Python, <code>print</code> mostra um texto no terminal. Textos ficam entre aspas.</p>
        <p>Clique em <b>▶ Executar</b> e veja a saída na aba 🖥️ Terminal.</p>`,
      arquivos: { 'main.py': 'print("Olá, Sertão!")\nprint(2 + 3)\n' },
    },
  ],
};
```

`src/conteudo/trilha.js`:

```js
// A trilha completa, na ordem das aulas. Na fase 1 só existe o 🐍 Python básico; os
// próximos módulos aparecem na landing como "em breve" (PROXIMOS_MODULOS).
import { moduloBasico } from './basico.js';

export const modulos = [moduloBasico];

/** Módulos das próximas versões (só título e ícone, para a landing e a trilha). */
export const PROXIMOS_MODULOS = [
  { id: 'dados', icone: '📊', titulo: 'Python para dados' },
  { id: 'paralelismo', icone: '⚡', titulo: 'Paralelismo' },
  { id: 'pyspark', icone: '✨', titulo: 'PySpark' },
  { id: 'alem', icone: '🌊', titulo: 'Spark além do batch' },
  { id: 'projetos', icone: '🏗️', titulo: 'Projetos' },
];

export const DIFICULDADES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

/** Playground livre: o código fica salvo no navegador. */
export const LIVRE = {
  id: 'livre',
  tipo: 'livre',
  titulo: 'Playground livre',
  resumo: `
    <p>Escreva o Python que quiser. Use o <b>+</b> para criar arquivos e importá-los com <code>import</code>.</p>
    <p>Se o código usar <code>input()</code>, escreva as respostas na aba <b>⌨️ Entrada</b>, uma por linha.</p>`,
  arquivos: { 'main.py': 'nome = input("Qual é o seu nome? ")\nprint(f"Olá, {nome}!")\n' },
};

export const itens = modulos.flatMap((m) => m.itens.map((item) => ({ ...item, modulo: m.id })));
export const problemas = itens.filter((i) => i.tipo === 'problema');

const porId = new Map([...itens, LIVRE].map((i) => [i.id, i]));
export const buscarItem = (id) => porId.get(id);

/** Item anterior e próximo na trilha (para os botões ‹ ›). */
export function vizinhos(id) {
  const i = itens.findIndex((item) => item.id === id);
  return { anterior: itens[i - 1], proximo: itens[i + 1] };
}
```

`src/conteudo/glossario.js`: copie a estrutura do PHP (`TERMOS` e `termosDoTexto`) com estes termos iniciais: `variável`, `string`, `inteiro`, `float`, `lista`, `dicionário`, `função`, `laço`, `exceção`, `f-string`, `input`, `print`, `tupla`, `índice`, `retorno`. Cada termo com `explicacao`, `analogia` e `exemplo` em Python.

- [ ] **Step 4: Tirar o certificado final desta fase**

Run: `grep -rn "final" src/ui src/certificados.js src/badges.js src/cargaHoraria.js src/gamificacao.js | grep -v "finally\|// "`

Para cada uso de `CERTIFICADOS.final` ou `modulo === 'final'`: deixe o código funcionar quando `CERTIFICADOS.final` não existe (guarda `if (CERTIFICADOS.final)` ou `?.`). A landing e a trilha não mostram o certificado final; o validador continua aceitando a chave `final` (para a fase 6). Não apague a lógica: ela volta na fase 6.

- [ ] **Step 5: Rodar o que sobrou dos testes, o lint e o build**

Run: `npm install && npx eslint . && npx vitest run`
Expected: lint limpo; os testes herdados (seo, landing, certificados, validador, privacidade, licença, acessibilidade, cegos-surdos, instrutor, badges, carga horária, gamificação, novidades, layout, tutorial, neuro, sha256) passam. Corrija nos testes só o que é dado do PHP (ids de módulo `html`/`php` → `basico`, números de exercícios), nunca a regra testada.

Run: `CERTIFICADO_SEGREDO=build-local npm run build`
Expected: build sem avisos (vai falhar enquanto `src/ui/item.js` importar `../php/motor.js`; nesse caso, troque temporariamente o import por `../python/motor.js` e crie o arquivo vazio com `export class MotorPython {}` e `export class TempoEsgotado extends Error {}` — a Task 3 o completa).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Base do DivergePython a partir do DivergePHP, sem o motor PHP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Runtime Python (`diverge_runtime`) e sessão compartilhada

**Files:**
- Create: `python/diverge_runtime/__init__.py`, `python/diverge_runtime/execucao.py`, `python/diverge_runtime/valores.py`, `python/tests/test_runtime.py`
- Create: `src/python/carregar.js`, `src/python/sessao.js`, `tests/python-node.js`, `tests/runtime.test.js`
- Modify: `package.json` (dependência `pyodide`), `vitest.config.js`

**Interfaces:**
- Produces (Python): `executar_json(args: dict) -> str` em `diverge_runtime.execucao`, com `args = { 'arquivos': {nome: fonte}, 'principal': 'main.py', 'entrada': [str], 'chamadas': [{'funcao': str, 'args': list}] }` e retorno JSON:
  `{ "saida": str, "erro": null | { "tipo": str, "mensagem": str, "linha": int|null, "traceback": str }, "variaveis": { nome: valor }, "retornos": [ { "ok": bool, "valor": any, "repr": str, "erro": null|{tipo, mensagem} } ] }`
- Produces (JS): `carregarPython({ indexURL } = {}) -> Promise<PyodideInterface>`; `criarSessao(pyodide, { mapear } = {}) -> Promise<{ executar(arquivos, { principal, entrada, chamadas }) -> Promise<Resultado> }>`; `iniciarPython() -> Promise<{ pyodide, sessao }>` (tests/python-node.js).

- [ ] **Step 1: Instalar o Pyodide e ligar o JSPI nos testes**

```bash
npm install --save-exact pyodide@314.0.7 @codemirror/lang-python@6.2.1
```

`vitest.config.js` — dentro de `test`:

```js
  test: {
    testTimeout: 60000,
    hookTimeout: 120000,
    // O pool de workers do Pyodide precisa do JSPI (WebAssembly.Suspending), que no
    // Node 24 ainda fica atrás desta opção.
    pool: 'forks',
    execArgv: ['--experimental-wasm-jspi'],
  },
```

Run: `npx vitest --help | grep -i execArgv`
Expected: a opção existe. Se o vitest 5 usar outro nome (`poolOptions.forks.execArgv`), use o nome que a ajuda mostrar.

- [ ] **Step 2: Escrever os testes do runtime (falhando)**

`tests/runtime.test.js`:

```js
// O runtime que roda o código do aluno no Pyodide (python/diverge_runtime): saída,
// erros com a linha certa, input(), variáveis, chamadas de função e limites.
import { describe, it, expect, beforeAll } from 'vitest';
import { iniciarPython } from './python-node.js';

let sessao;
beforeAll(async () => { ({ sessao } = await iniciarPython()); });
const rodar = (codigo, opcoes = {}) => sessao.executar({ 'main.py': codigo, ...(opcoes.arquivos ?? {}) }, opcoes);

describe('diverge_runtime', () => {
  it('captura o print', async () => {
    expect((await rodar('print("Olá")\nprint(1 + 2)')).saida).toBe('Olá\n3\n');
  });

  it('erro com tipo, mensagem e a linha do aluno (sem linhas do runtime)', async () => {
    const { erro } = await rodar('x = 1\ny = x + "a"\n');
    expect(erro).toMatchObject({ tipo: 'TypeError', linha: 2 });
    expect(erro.traceback).toContain('File "main.py", line 2');
    expect(erro.traceback).not.toContain('diverge_runtime');
  });

  it('input() lê as linhas da entrada e mostra o prompt', async () => {
    const r = await rodar('n = input("Nome: ")\nprint("Oi", n)', { entrada: ['Ana'] });
    expect(r.saida).toBe('Nome: Oi Ana\n');
  });

  it('input() sem entrada dá EOFError, como o Python', async () => {
    expect((await rodar('input()')).erro).toMatchObject({ tipo: 'EOFError', mensagem: 'EOF when reading a line' });
  });

  it('variáveis globais simples voltam como JSON', async () => {
    const { variaveis } = await rodar('a = 3\nb = [1, (2, 3)]\nc = {"x": {1, 2}}\n_oculta = 1\nimport math');
    expect(variaveis).toEqual({ a: 3, b: [1, [2, 3]], c: { x: [1, 2] } });
  });

  it('chama funções do aluno e devolve retorno ou erro', async () => {
    const r = await rodar('def dobro(n):\n    return n * 2\ndef quebra():\n    raise ValueError("ops")', {
      chamadas: [{ funcao: 'dobro', args: [4] }, { funcao: 'quebra', args: [] }, { funcao: 'nao_existe', args: [] }],
    });
    expect(r.retornos[0]).toMatchObject({ ok: true, valor: 8 });
    expect(r.retornos[1]).toMatchObject({ ok: false, erro: { tipo: 'ValueError', mensagem: 'ops' } });
    expect(r.retornos[2]).toMatchObject({ ok: false, erro: { tipo: 'NameError' } });
  });

  it('retorno que não vira JSON vem com repr', async () => {
    const [r] = (await rodar('def f():\n    return print', { chamadas: [{ funcao: 'f', args: [] }] })).retornos;
    expect(r).toMatchObject({ ok: true, valor: null, repr: '<built-in function print>' });
  });

  it('saída gigante é cortada', async () => {
    const { saida } = await rodar('for i in range(200000):\n    print(i)');
    expect(saida.length).toBeLessThanOrEqual(100100);
    expect(saida).toMatch(/… \(saída cortada\)\n$/);
  });

  it('um arquivo json.py do aluno não quebra o runtime', async () => {
    const r = await rodar('import json\nprint(json.VALOR)', { arquivos: { 'json.py': 'VALOR = 42\n' } });
    expect(r.saida).toBe('42\n');
  });

  it('cada execução começa do zero (módulos do aluno recarregados)', async () => {
    await rodar('import util\nprint(util.X)', { arquivos: { 'util.py': 'X = 1\n' } });
    const r = await rodar('import util\nprint(util.X)', { arquivos: { 'util.py': 'X = 2\n' } });
    expect(r.saida).toBe('2\n');
  });
});
```

Run: `npx vitest run tests/runtime.test.js`
Expected: FAIL (`Cannot find module './python-node.js'`).

- [ ] **Step 3: Implementar o runtime em Python**

`python/diverge_runtime/__init__.py`:

```python
"""Runtime do DivergePython: roda o código do aluno no Pyodide e devolve o resultado em JSON."""
```

`python/diverge_runtime/valores.py`:

```python
"""Converte valores do Python para JSON (o site compara retornos e variáveis assim).

Tuplas viram listas; conjuntos viram listas ordenadas; chaves de dicionário viram texto.
O que não tem equivalente em JSON volta como None, e o `repr` vai junto para mostrar ao aluno.
"""
import math

SEM_JSON = object()


def para_json(valor, profundidade=0):
    if profundidade > 20:
        return SEM_JSON
    if valor is None or isinstance(valor, (bool, str)):
        return valor
    if isinstance(valor, int):
        return valor
    if isinstance(valor, float):
        return valor if math.isfinite(valor) else SEM_JSON
    if isinstance(valor, (list, tuple)):
        itens = [para_json(v, profundidade + 1) for v in valor]
        return SEM_JSON if any(i is SEM_JSON for i in itens) else itens
    if isinstance(valor, (set, frozenset)):
        try:
            ordenados = sorted(valor)
        except TypeError:
            return SEM_JSON
        return para_json(ordenados, profundidade + 1)
    if isinstance(valor, dict):
        saida = {}
        for chave, v in valor.items():
            convertido = para_json(v, profundidade + 1)
            if convertido is SEM_JSON:
                return SEM_JSON
            saida[str(chave)] = convertido
        return saida
    return SEM_JSON


def descrever(valor):
    """{'valor': json ou None, 'repr': texto} para mostrar no relatório."""
    convertido = para_json(valor)
    texto = repr(valor)
    if len(texto) > 500:
        texto = texto[:499] + '…'
    return {'valor': None if convertido is SEM_JSON else convertido, 'repr': texto, 'json': convertido is not SEM_JSON}
```

`python/diverge_runtime/execucao.py`:

```python
"""Roda o código do aluno: grava os arquivos, executa o principal como __main__,
captura a saída, o erro (só com as linhas do aluno), as variáveis e as chamadas de função."""
import builtins
import io
import json
import os
import sys
import traceback

from .valores import descrever

PASTA = '/home/pyodide/exercicio'
LIMITE_SAIDA = 100_000
_json_dumps = json.dumps  # referência própria: um json.py do aluno não pode trocar isto


class _Saida(io.StringIO):
    """stdout que para de guardar depois do limite (a execução continua)."""

    def __init__(self):
        super().__init__()
        self.cortada = False

    def write(self, texto):
        if self.cortada:
            return len(texto)
        restante = LIMITE_SAIDA - self.tell()
        if len(texto) > restante:
            super().write(texto[:max(restante, 0)])
            super().write('\n… (saída cortada)\n')
            self.cortada = True
            return len(texto)
        return super().write(texto)


def _gravar(arquivos):
    os.makedirs(PASTA, exist_ok=True)
    for nome in os.listdir(PASTA):
        caminho = os.path.join(PASTA, nome)
        if os.path.isfile(caminho):
            os.remove(caminho)
    for nome, fonte in arquivos.items():
        caminho = os.path.join(PASTA, nome)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(fonte)


def _esquecer_modulos_do_aluno(arquivos):
    """Remove de sys.modules os módulos que vieram dos arquivos do aluno (e os que o
    aluno sombreou, como json.py), para cada execução começar do zero."""
    nomes = {nome[:-3].replace('/', '.') for nome in arquivos if nome.endswith('.py')}
    for nome in list(sys.modules):
        modulo = sys.modules[nome]
        arquivo = getattr(modulo, '__file__', '') or ''
        if nome in nomes or arquivo.startswith(PASTA):
            del sys.modules[nome]


def _erro(excecao, arquivos):
    te = traceback.TracebackException.from_exception(excecao)
    do_aluno = [q for q in te.stack if os.path.basename(q.filename) in arquivos or q.filename in arquivos]
    te.stack = traceback.StackSummary.from_list(do_aluno)
    linha = do_aluno[-1].lineno if do_aluno else getattr(excecao, 'lineno', None)
    return {
        'tipo': type(excecao).__name__,
        'mensagem': str(excecao),
        'linha': linha,
        'traceback': ''.join(te.format()),
    }


def _input(entrada, saida):
    linhas = iter(entrada)

    def ler(prompt=''):
        saida.write(str(prompt))
        try:
            return next(linhas)
        except StopIteration:
            raise EOFError('EOF when reading a line') from None
    return ler


def executar(arquivos, principal='main.py', entrada=(), chamadas=()):
    _gravar(arquivos)
    _esquecer_modulos_do_aluno(arquivos)
    saida = _Saida()
    antigo_stdout, antigo_stderr, antigo_input = sys.stdout, sys.stderr, builtins.input
    antigo_path, antigo_cwd = list(sys.path), os.getcwd()
    escopo = {'__name__': '__main__', '__file__': principal, '__builtins__': builtins}
    erro = None
    retornos = []
    try:
        sys.stdout = sys.stderr = saida
        builtins.input = _input(entrada, saida)
        sys.path.insert(0, PASTA)
        os.chdir(PASTA)
        try:
            codigo = compile(arquivos.get(principal, ''), principal, 'exec')
            exec(codigo, escopo)
        except BaseException as e:  # SystemExit e KeyboardInterrupt também viram erro do aluno
            erro = _erro(e, arquivos)
        for chamada in chamadas:
            retornos.append(_chamar(escopo, chamada, arquivos))
    finally:
        sys.stdout, sys.stderr, builtins.input = antigo_stdout, antigo_stderr, antigo_input
        sys.path[:] = antigo_path
        os.chdir(antigo_cwd)
    variaveis = {}
    for nome, valor in escopo.items():
        if nome.startswith('_') or callable(valor) or type(valor).__name__ == 'module':
            continue
        d = descrever(valor)
        if d['json']:
            variaveis[nome] = d['valor']
    return {'saida': saida.getvalue(), 'erro': erro, 'variaveis': variaveis, 'retornos': retornos}


def _chamar(escopo, chamada, arquivos):
    nome = chamada['funcao']
    funcao = escopo.get(nome)
    if funcao is None:
        return {'ok': False, 'valor': None, 'repr': '', 'erro': {'tipo': 'NameError', 'mensagem': f"name '{nome}' is not defined"}}
    try:
        valor = funcao(*chamada.get('args', []))
    except BaseException as e:
        return {'ok': False, 'valor': None, 'repr': '', 'erro': {'tipo': type(e).__name__, 'mensagem': str(e)}}
    d = descrever(valor)
    return {'ok': True, 'valor': d['valor'], 'repr': d['repr'], 'erro': None}


def executar_json(args):
    """Ponto de entrada chamado pelo JS (sessao.js)."""
    args = args.to_py() if hasattr(args, 'to_py') else args
    resultado = executar(
        args['arquivos'],
        args.get('principal', 'main.py'),
        args.get('entrada', []),
        args.get('chamadas', []),
    )
    return _json_dumps(resultado, ensure_ascii=False)
```

- [ ] **Step 4: Carregador e sessão em JS**

`src/python/carregar.js`:

```js
// Carrega o Pyodide 314.0.7. No navegador os arquivos vêm do próprio site (pasta
// pyodide/, copiada no build pelo vite.config.js); no Node, do node_modules.
import { loadPyodide } from 'pyodide';

export function carregarPython({ indexURL } = {}) {
  return loadPyodide(indexURL ? { indexURL } : {});
}
```

`src/python/sessao.js`:

```js
// Sessão Python: monta o pacote diverge_runtime (pasta python/) no sistema de arquivos
// do Pyodide e roda o código do aluno. A mesma sessão é usada no worker do site e nos
// testes no Node (tests/python-node.js).
const FONTES = import.meta.glob(['../../python/**/*.py', '!../../python/tests/**'], {
  query: '?raw', import: 'default', eager: true,
});
const RAIZ = '/lib/diverge';

/**
 * `mapear(tarefas: Uint8Array[]) -> Promise<{ resultados: Uint8Array[], tarefas: object[] }>`
 * é o pool de workers (Task 5); sem ele, o paralelismo roda em sequência.
 */
export async function criarSessao(pyodide, { mapear } = {}) {
  for (const [caminho, fonte] of Object.entries(FONTES)) {
    const destino = `${RAIZ}/${caminho.replace(/^.*?python\//, '')}`;
    pyodide.FS.mkdirTree(destino.slice(0, destino.lastIndexOf('/')));
    pyodide.FS.writeFile(destino, fonte);
  }
  pyodide.runPython(`import sys\nsys.path.insert(0, '${RAIZ}')\nsys.path.insert(0, '${RAIZ}/vendor')\nimport diverge_runtime.execucao`);
  if (mapear) pyodide.registerJsModule('diverge_pool_js', { mapear });

  return {
    async executar(arquivos, { principal = 'main.py', entrada = [], chamadas = [] } = {}) {
      const args = pyodide.toPy({ arquivos, principal, entrada, chamadas });
      try {
        pyodide.globals.set('_diverge_args', args);
        const json = await pyodide.runPythonAsync('import diverge_runtime.execucao as _e\n_e.executar_json(_diverge_args)');
        return JSON.parse(json);
      } finally {
        args.destroy();
        pyodide.globals.delete('_diverge_args');
      }
    },
  };
}
```

`tests/python-node.js`:

```js
// Python 3.14 (Pyodide) no Node: a mesma sessão que o navegador usa.
import { carregarPython } from '../src/python/carregar.js';
import { criarSessao } from '../src/python/sessao.js';

let compartilhada;
/** Uma instância do Pyodide por arquivo de teste (carregar leva ~2 s). */
export function iniciarPython(opcoes) {
  if (opcoes) return carregarPython().then(async (pyodide) => ({ pyodide, sessao: await criarSessao(pyodide, opcoes) }));
  compartilhada ??= carregarPython().then(async (pyodide) => ({ pyodide, sessao: await criarSessao(pyodide) }));
  return compartilhada;
}
```

- [ ] **Step 5: Rodar os testes até passarem**

Run: `npx vitest run tests/runtime.test.js`
Expected: PASS (10 testes).

- [ ] **Step 6: pytest do runtime em CPython**

`python/tests/test_runtime.py`:

```python
"""Testes rápidos do runtime em CPython (no CI): a mesma lógica que roda no Pyodide."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from diverge_runtime import execucao  # noqa: E402
from diverge_runtime.valores import descrever  # noqa: E402

execucao.PASTA = tempfile.mkdtemp()


def rodar(codigo, **kw):
    return execucao.executar({'main.py': codigo}, **kw)


def test_print_e_erro_com_linha():
    r = rodar('print("oi")\n1/0\n')
    assert r['saida'] == 'oi\n'
    assert r['erro']['tipo'] == 'ZeroDivisionError'
    assert r['erro']['linha'] == 2


def test_chamada_de_funcao():
    r = rodar('def f(a, b):\n    return a + b\n', chamadas=[{'funcao': 'f', 'args': [2, 3]}])
    assert r['retornos'][0]['valor'] == 5


def test_descrever_valores():
    assert descrever((1, {2, 1}))['valor'] == [1, [1, 2]]
    assert descrever(float('nan'))['json'] is False


def test_executar_json():
    saida = json.loads(execucao.executar_json({'arquivos': {'main.py': 'x = 1'}}))
    assert saida['variaveis'] == {'x': 1}
```

Run: `python -m pytest python/tests -q`
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add python src/python tests/python-node.js tests/runtime.test.js package.json package-lock.json vitest.config.js
git commit -m "Runtime Python (Pyodide 314.0.7): saída, erros, input, variáveis e chamadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Motor no navegador (worker, tempo limite) e Pyodide servido pelo site

**Files:**
- Create: `src/python/motor.js`, `src/python/worker.js`, `tests/motor.test.js`
- Modify: `vite.config.js`

**Interfaces:**
- Consumes: `carregarPython`, `criarSessao` (Task 2).
- Produces: `class MotorPython { constructor({ aoMudarEstado, limiteMs = 10000, criarWorker }); executar(arquivos, opcoes) -> Promise<Resultado & { ms }>; }`, `class TempoEsgotado extends Error`. `aoMudarEstado(situacao: 'carregando'|'pronto'|'falha', erro?)`.

- [ ] **Step 1: Teste do motor com um worker falso (falhando)**

`tests/motor.test.js`:

```js
// MotorPython: fila de execuções, tempo limite e reinício do worker.
import { describe, it, expect, vi } from 'vitest';
import { MotorPython, TempoEsgotado } from '../src/python/motor.js';

/** Worker falso: responde "pronto" e devolve a saída pedida (ou nunca responde). */
function workerFalso({ travar = false } = {}) {
  const w = { terminado: false, postMessage(m) { if (!travar) setTimeout(() => w.onmessage({ data: { tipo: 'resposta', id: m.id, saida: m.arquivos['main.py'] } })); }, terminate() { w.terminado = true; } };
  setTimeout(() => w.onmessage({ data: { tipo: 'pronto' } }));
  return w;
}

describe('MotorPython', () => {
  it('executa em fila e mede o tempo', async () => {
    const motor = new MotorPython({ criarWorker: () => workerFalso() });
    const [a, b] = await Promise.all([motor.executar({ 'main.py': 'a' }), motor.executar({ 'main.py': 'b' })]);
    expect([a.saida, b.saida]).toEqual(['a', 'b']);
    expect(a.ms).toBeGreaterThanOrEqual(0);
  });

  it('laço infinito: estoura o tempo, recria o worker e o próximo funciona', async () => {
    vi.useFakeTimers();
    const criados = [];
    const motor = new MotorPython({ limiteMs: 1000, criarWorker: () => { const w = workerFalso({ travar: criados.length === 0 }); criados.push(w); return w; } });
    await vi.advanceTimersByTimeAsync(1);
    const travada = motor.executar({ 'main.py': 'while True: pass' });
    const expectativa = expect(travada).rejects.toThrow(TempoEsgotado);
    await vi.advanceTimersByTimeAsync(1001);
    await expectativa;
    expect(criados[0].terminado).toBe(true);
    const proxima = motor.executar({ 'main.py': 'print(1)' });
    await vi.advanceTimersByTimeAsync(10);
    expect((await proxima).saida).toBe('print(1)');
    vi.useRealTimers();
  });
});
```

Run: `npx vitest run tests/motor.test.js`
Expected: FAIL (`MotorPython` não existe ou incompleto).

- [ ] **Step 2: Implementar o motor**

`src/python/motor.js` (mesma lógica do `MotorPHP`, com o worker injetável para os testes):

```js
export class TempoEsgotado extends Error {}

const workerDoSite = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

/**
 * Cliente do worker Python. Executa uma tarefa por vez; se uma execução passar do
 * limite (um laço infinito, por exemplo), o worker é descartado e um novo é iniciado.
 */
export class MotorPython {
  constructor({ aoMudarEstado = () => {}, limiteMs = 10000, criarWorker = workerDoSite } = {}) {
    this.aoMudarEstado = aoMudarEstado;
    this.limiteMs = limiteMs;
    this.criarWorker = criarWorker;
    this.fila = Promise.resolve();
    this.proximoId = 1;
    this.iniciar();
  }

  iniciar() {
    this.worker?.terminate();
    this.pendentes = new Map();
    this.aoMudarEstado('carregando');
    this.worker = this.criarWorker();
    this.pronto = new Promise((resolve, reject) => {
      this.worker.onmessage = ({ data }) => {
        if (data.tipo === 'pronto') {
          this.aoMudarEstado('pronto');
          resolve();
        } else if (data.tipo === 'falha') {
          this.aoMudarEstado('falha', data.erro);
          reject(new Error(data.erro));
        } else if (data.tipo === 'resposta') {
          this.pendentes.get(data.id)?.(data);
          this.pendentes.delete(data.id);
        }
      };
      this.worker.onerror = (e) => {
        this.aoMudarEstado('falha', e.message);
        reject(new Error(e.message));
      };
    });
  }

  /** Roda os arquivos: `opcoes = { principal, entrada, chamadas }`. */
  executar(arquivos, opcoes = {}) {
    const tarefa = this.fila.then(() => this.#rodar({ arquivos, opcoes }));
    this.fila = tarefa.catch(() => {});
    return tarefa;
  }

  async #rodar(mensagem) {
    await this.pronto;
    const id = this.proximoId++;
    const inicio = performance.now();
    return new Promise((resolve, reject) => {
      const relogio = setTimeout(() => {
        this.pendentes.delete(id);
        this.iniciar();
        reject(new TempoEsgotado(`O Python passou de ${this.limiteMs / 1000} s e foi interrompido.`));
      }, this.limiteMs);
      this.pendentes.set(id, (resposta) => {
        clearTimeout(relogio);
        if (resposta.erroInterno) reject(new Error(resposta.erroInterno));
        else resolve({ ...resposta, ms: Math.round(performance.now() - inicio) });
      });
      this.worker.postMessage({ id, ...mensagem });
    });
  }
}
```

- [ ] **Step 3: Worker do site**

`src/python/worker.js`:

```js
// Roda o Python fora da thread da página: um laço infinito trava só o worker, que o
// motor encerra e recria (veja motor.js). O pool de workers paralelos (Task 5) fica aqui.
import { carregarPython } from './carregar.js';
import { criarSessao } from './sessao.js';

const indexURL = new URL('../pyodide/', import.meta.url).href;
const sessao = carregarPython({ indexURL }).then((pyodide) => criarSessao(pyodide));

sessao.then(
  () => postMessage({ tipo: 'pronto' }),
  (erro) => postMessage({ tipo: 'falha', erro: String(erro?.message ?? erro) }),
);

onmessage = async ({ data }) => {
  try {
    const resultado = await (await sessao).executar(data.arquivos, data.opcoes);
    postMessage({ tipo: 'resposta', id: data.id, ...resultado });
  } catch (erro) {
    postMessage({ tipo: 'resposta', id: data.id, erroInterno: String(erro?.message ?? erro) });
  }
};
```

- [ ] **Step 4: Servir e copiar os arquivos do Pyodide no Vite**

Em `vite.config.js`, remova `semIntl`, `ativosPhp`, o alias `@php-wasm` e `optimizeDeps`/`assetsInclude` do PHP. Acrescente:

```js
import { readFileSync, createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// O Pyodide é servido pelo próprio site (pasta pyodide/), sem CDN de terceiros: no dev,
// direto do node_modules; no build, copiado para dist/pyodide/.
const PASTA_PYODIDE = dirname(createRequire(import.meta.url).resolve('pyodide/package.json'));
const ARQUIVOS_PYODIDE = ['pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const pyodide = {
  name: 'pyodide-no-site',
  configureServer(servidor) {
    servidor.middlewares.use('/pyodide/', (req, res, proximo) => {
      const nome = req.url.split('?')[0].replace(/^\//, '');
      if (!ARQUIVOS_PYODIDE.includes(nome)) return proximo();
      if (nome.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
      createReadStream(join(PASTA_PYODIDE, nome)).pipe(res);
    });
  },
  generateBundle() {
    for (const nome of ARQUIVOS_PYODIDE) {
      this.emitFile({ type: 'asset', fileName: `pyodide/${nome}`, source: readFileSync(join(PASTA_PYODIDE, nome)) });
    }
  },
};
```

e use `plugins: [pyodide, publicarChave(chavePublica), pluginHistorico()]`, `optimizeDeps: { exclude: ['pyodide'] }`, `worker: { format: 'es' }`. O `derivar` passa a usar o rótulo `python-playground:`.

O worker fica em `dist/assets/worker-*.js`; `new URL('../pyodide/', import.meta.url)` aponta para `dist/pyodide/`. No dev, o worker é servido de `/src/python/worker.js`; ajuste o `indexURL` do worker para `import.meta.env.DEV ? '/pyodide/' : new URL('../pyodide/', import.meta.url).href`.

- [ ] **Step 5: Rodar testes e build**

Run: `npx vitest run tests/motor.test.js && CERTIFICADO_SEGREDO=build-local npm run build && ls dist/pyodide`
Expected: PASS; `dist/pyodide/` com os 4 arquivos; build sem avisos.

- [ ] **Step 6: Commit**

```bash
git add src/python/motor.js src/python/worker.js tests/motor.test.js vite.config.js
git commit -m "Motor Python no worker, com tempo limite, e Pyodide servido pelo site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Correção dos exercícios com regras de Python

**Files:**
- Create (reescrever): `src/verificacoes.js`, `src/corrigir.js`, `tests/verificacoes.test.js`, `tests/corrigir.test.js`

**Interfaces:**
- Consumes: `Resultado` do runtime (Task 2): `{ saida, erro, variaveis, retornos }`.
- Produces:
  - `verificarRegra(regra, ctx) -> { ok, mensagem, detalhe? }`, `detalharRegra(regra, ctx) -> { ok, mensagem, detalhe, categoria, obtido, dica }`, `descreverRegra(regra) -> string`, `categoriaDe(regra) -> string`, `primeiraLinhaDoErro(erro) -> string`.
  - `ctx = { saida, erro, variaveis, retorno, codigo }` (`retorno` = o item de `retornos` desta regra).
  - `corrigir(problema, arquivos, executar, { incluirOcultos = true }) -> Promise<{ aprovado, relatorio }>`, com `executar(arquivos, { entrada, chamadas })`.
  - Formato de um teste: `{ descricao, entrada?: string[], oculto?: true, regras: Regra[] }`.
  - Regras: `{ saida: 'texto' }` (contém), `{ saidaIgual: 'texto' }` (igual, ignorando espaços no fim das linhas e a quebra final), `{ variavel: 'nome', igual }`, `{ funcao: 'nome', args: [], igual }` / `{ ..., aprox: 0.01 }` / `{ ..., erro: 'ValueError' }`, `{ erro: 'Tipo' }` (o programa termina com essa exceção), `{ semErros: true }`, `{ codigo: 'regex' }`, `{ semCodigo: 'regex' }`; todas aceitam `msg` e `dica`.

- [ ] **Step 1: Testes das regras (falhando)**

`tests/verificacoes.test.js`:

```js
// Regras de correção: cada tipo passa quando deve e falha com um motivo útil.
import { describe, it, expect } from 'vitest';
import { verificarRegra, detalharRegra, categoriaDe } from '../src/verificacoes.js';

const ctx = (extra = {}) => ({ saida: '', erro: null, variaveis: {}, retorno: undefined, codigo: '', ...extra });

describe('verificarRegra', () => {
  it('saida (contém) e saidaIgual (linhas sem espaço no fim)', () => {
    expect(verificarRegra({ saida: 'Olá' }, ctx({ saida: 'Olá, Ana\n' })).ok).toBe(true);
    expect(verificarRegra({ saidaIgual: 'a\nb' }, ctx({ saida: 'a  \nb\n' })).ok).toBe(true);
    expect(verificarRegra({ saidaIgual: 'a\nb' }, ctx({ saida: 'a\nc\n' }))).toMatchObject({ ok: false, detalhe: 'linha 2: esperado "b", veio "c"' });
  });

  it('variavel', () => {
    expect(verificarRegra({ variavel: 'x', igual: [1, 2] }, ctx({ variaveis: { x: [1, 2] } })).ok).toBe(true);
    expect(verificarRegra({ variavel: 'y', igual: 1 }, ctx()).detalhe).toBe('a variável y não existe no fim do programa');
  });

  it('funcao: igual, aprox e erro esperado', () => {
    expect(verificarRegra({ funcao: 'f', args: [2], igual: 4 }, ctx({ retorno: { ok: true, valor: 4, repr: '4' } })).ok).toBe(true);
    expect(verificarRegra({ funcao: 'f', args: [], aprox: 0.01, igual: 0.33 }, ctx({ retorno: { ok: true, valor: 0.3333, repr: '0.3333' } })).ok).toBe(true);
    expect(verificarRegra({ funcao: 'f', args: [0], erro: 'ValueError' }, ctx({ retorno: { ok: false, erro: { tipo: 'ValueError', mensagem: 'x' } } })).ok).toBe(true);
    expect(verificarRegra({ funcao: 'f', args: [2], igual: 4 }, ctx({ retorno: { ok: false, erro: { tipo: 'NameError', mensagem: "name 'f' is not defined" } } })))
      .toMatchObject({ ok: false, detalhe: "f(2) deu NameError: name 'f' is not defined" });
  });

  it('retorno que não vira JSON: falha com o repr', () => {
    const r = detalharRegra({ funcao: 'f', args: [], igual: 1 }, ctx({ retorno: { ok: true, valor: null, repr: '<built-in function print>' } }));
    expect(r).toMatchObject({ ok: false, obtido: '<built-in function print>' });
  });

  it('erro esperado e semErros', () => {
    const erro = { tipo: 'ZeroDivisionError', mensagem: 'division by zero', linha: 3 };
    expect(verificarRegra({ erro: 'ZeroDivisionError' }, ctx({ erro })).ok).toBe(true);
    expect(verificarRegra({ semErros: true }, ctx({ erro })).detalhe).toBe('linha 3: ZeroDivisionError: division by zero');
  });

  it('codigo e semCodigo', () => {
    expect(verificarRegra({ codigo: 'for\\s' }, ctx({ codigo: 'for i in x:' })).ok).toBe(true);
    expect(verificarRegra({ semCodigo: 'sum\\(' }, ctx({ codigo: 'sum(x)' })).ok).toBe(false);
  });

  it('categorias', () => {
    expect(categoriaDe({ funcao: 'f' })).toBe('Função');
    expect(categoriaDe({ saidaIgual: 'x' })).toBe('Saída');
    expect(categoriaDe({ inventada: 1 })).toBe('Verificação');
  });

  it('regra desconhecida é erro de quem escreveu o exercício', () => {
    expect(() => verificarRegra({ inventada: 1 }, ctx())).toThrow('Regra desconhecida');
  });
});
```

`tests/corrigir.test.js`:

```js
// corrigir(): roda cada caso com o runtime de verdade (Pyodide no Node).
import { describe, it, expect, beforeAll } from 'vitest';
import { corrigir } from '../src/corrigir.js';
import { iniciarPython } from './python-node.js';

let executar;
beforeAll(async () => { const { sessao } = await iniciarPython(); executar = (a, o) => sessao.executar(a, o); });

const problema = {
  testes: [
    { descricao: 'Ana', entrada: ['Ana'], regras: [{ saida: 'Olá, Ana!' }] },
    { descricao: 'dobro(3)', regras: [{ funcao: 'dobro', args: [3], igual: 6 }] },
    { descricao: 'oculto', oculto: true, entrada: ['Bia'], regras: [{ saida: 'Olá, Bia!' }, { funcao: 'dobro', args: [-1], igual: -2 }] },
  ],
};
const certo = { 'main.py': 'def dobro(n):\n    return n * 2\nnome = input()\nprint(f"Olá, {nome}!")' };

describe('corrigir', () => {
  it('aprova a solução certa, com os ocultos', async () => {
    const { aprovado, relatorio } = await corrigir(problema, certo, executar);
    expect(aprovado).toBe(true);
    expect(relatorio).toHaveLength(3);
    expect(relatorio[2]).toMatchObject({ oculto: true, cenario: { entrada: ['Bia'], chamadas: ['dobro(-1)'] } });
  });

  it('sem ocultos quando incluirOcultos é false', async () => {
    expect((await corrigir(problema, certo, executar, { incluirOcultos: false })).relatorio).toHaveLength(2);
  });

  it('reprova e mostra o erro de execução', async () => {
    const { aprovado, relatorio } = await corrigir(problema, { 'main.py': 'print(1/0)' }, executar);
    expect(aprovado).toBe(false);
    expect(relatorio[0].erroExecucao).toBe('linha 1: ZeroDivisionError: division by zero');
  });
});
```

Run: `npx vitest run tests/verificacoes.test.js tests/corrigir.test.js`
Expected: FAIL.

- [ ] **Step 2: Implementar `src/verificacoes.js`**

```js
// Regras usadas pelos exercícios para conferir o resultado do Python.
// Cada regra é um objeto com uma das chaves abaixo e, opcionalmente, `msg` e `dica`:
//   { saida: 'texto' }                     a saída contém o texto
//   { saidaIgual: 'texto' }                a saída é igual (sem espaços no fim das linhas)
//   { variavel: 'x', igual }               valor final de uma variável global
//   { funcao: 'f', args, igual | aprox }   chama f(*args) e compara o retorno
//   { funcao: 'f', args, erro: 'Tipo' }    f(*args) levanta essa exceção
//   { erro: 'Tipo' }                       o programa termina com essa exceção
//   { semErros: true }                     o programa roda sem exceção
//   { codigo: 'regex' } / { semCodigo }    o código-fonte (todos os arquivos)
const json = (v) => JSON.stringify(v);
const iguais = (a, b) => json(a) === json(b);
const chamada = (r) => `${r.funcao}(${(r.args ?? []).map(json).join(', ').replace(/^\[|\]$/g, '')})`;
const linhas = (t) => String(t).replace(/\n$/, '').split('\n').map((l) => l.replace(/\s+$/, ''));

export const primeiraLinhaDoErro = (erro) => (erro ? `${erro.linha ? `linha ${erro.linha}: ` : ''}${erro.tipo}: ${erro.mensagem}` : '');

const res = (regra, padrao, ok, detalhe, obtido) => ({ ok, mensagem: regra.msg ?? padrao, detalhe: ok ? undefined : detalhe, obtido });

function aproximado(valor, esperado, tolerancia) {
  if (typeof esperado === 'number') return typeof valor === 'number' && Math.abs(valor - esperado) <= tolerancia;
  if (Array.isArray(esperado)) return Array.isArray(valor) && valor.length === esperado.length && esperado.every((e, i) => aproximado(valor[i], e, tolerancia));
  return iguais(valor, esperado);
}

export function verificarRegra(regra, { saida = '', erro = null, variaveis = {}, retorno, codigo = '' }) {
  if ('saidaIgual' in regra) {
    const [obtidas, esperadas] = [linhas(saida), linhas(regra.saidaIgual)];
    const i = esperadas.findIndex((l, n) => obtidas[n] !== l);
    const sobra = i < 0 && obtidas.length > esperadas.length;
    const detalhe = sobra ? `sobrou a linha ${esperadas.length + 1}: "${obtidas[esperadas.length]}"`
      : `linha ${i + 1}: esperado "${esperadas[i]}", veio ${obtidas[i] === undefined ? 'nada' : `"${obtidas[i]}"`}`;
    return res(regra, 'A saída é exatamente a pedida', i < 0 && !sobra, detalhe, saida.trimEnd());
  }
  if ('saida' in regra) {
    return res(regra, `A saída mostra "${regra.saida}"`, saida.includes(regra.saida), 'o texto não apareceu na saída', saida.trimEnd());
  }
  if ('funcao' in regra) {
    const nome = chamada(regra);
    if (!retorno) return res(regra, `${nome} funciona`, false, 'a função não foi chamada');
    if ('erro' in regra) {
      const ok = !retorno.ok && retorno.erro?.tipo === regra.erro;
      return res(regra, `${nome} levanta ${regra.erro}`, ok,
        retorno.ok ? `devolveu ${retorno.repr} em vez de levantar ${regra.erro}` : `levantou ${retorno.erro.tipo}: ${retorno.erro.mensagem}`,
        retorno.ok ? retorno.repr : retorno.erro.tipo);
    }
    if (!retorno.ok) return res(regra, `${nome} devolve ${json(regra.igual)}`, false, `${nome} deu ${retorno.erro.tipo}: ${retorno.erro.mensagem}`, retorno.erro.tipo);
    const ok = 'aprox' in regra ? aproximado(retorno.valor, regra.igual, regra.aprox) : iguais(retorno.valor, regra.igual);
    return res(regra, `${nome} devolve ${json(regra.igual)}`, ok, `esperado ${json(regra.igual)}, veio ${retorno.repr}`, retorno.repr);
  }
  if ('variavel' in regra) {
    const existe = regra.variavel in variaveis;
    const v = variaveis[regra.variavel];
    return res(regra, `${regra.variavel} vale ${json(regra.igual)}`, existe && iguais(v, regra.igual),
      existe ? `esperado ${json(regra.igual)}, veio ${json(v)}` : `a variável ${regra.variavel} não existe no fim do programa`, existe ? json(v) : undefined);
  }
  if ('erro' in regra) {
    return res(regra, `O programa termina com ${regra.erro}`, erro?.tipo === regra.erro,
      erro ? `terminou com ${primeiraLinhaDoErro(erro)}` : 'o programa terminou sem erro', erro?.tipo);
  }
  if ('semErros' in regra) return res(regra, 'O programa roda sem erros', !erro, primeiraLinhaDoErro(erro));
  if ('codigo' in regra) return res(regra, `O código usa ${regra.codigo}`, new RegExp(regra.codigo, 'm').test(codigo), 'não encontrei no código');
  if ('semCodigo' in regra) return res(regra, `O código não usa ${regra.semCodigo}`, !new RegExp(regra.semCodigo, 'm').test(codigo), 'encontrei no código');
  throw new Error(`Regra desconhecida: ${json(regra)}`);
}

const CATEGORIAS = [
  ['saidaIgual', 'Saída'], ['saida', 'Saída'], ['funcao', 'Função'], ['variavel', 'Variável'],
  ['erro', 'Execução'], ['semErros', 'Execução'], ['codigo', 'Código'], ['semCodigo', 'Código'],
];
export const categoriaDe = (regra) => CATEGORIAS.find(([chave]) => chave in regra)?.[1] ?? 'Verificação';

/** Mensagem da regra antes de rodar (aba Testes, casos pendentes). */
export function descreverRegra(regra) {
  try {
    return verificarRegra(regra, { saida: '', variaveis: {}, codigo: '' }).mensagem;
  } catch {
    return undefined;
  }
}

const DICAS = {
  Saída: 'Compare a saída com o pedido: maiúsculas, acentos, espaços e pontuação contam.',
  Função: 'Confira o nome da função, os parâmetros e o return (print não devolve valor).',
  Variável: 'A variável precisa existir no fim do programa, fora de funções.',
  Execução: 'Leia o traceback no 🖥️ Terminal: ele mostra a linha e o tipo do erro.',
  Código: 'O enunciado pede (ou proíbe) um recurso específico do Python.',
};

/** verificarRegra + categoria e dica, para a aba Testes. */
export function detalharRegra(regra, ctx) {
  const r = verificarRegra(regra, ctx);
  const categoria = categoriaDe(regra);
  return { ...r, categoria, dica: r.ok ? undefined : regra.dica ?? DICAS[categoria] };
}
```

- [ ] **Step 3: Implementar `src/corrigir.js`**

```js
import { detalharRegra, primeiraLinhaDoErro } from './verificacoes.js';

const agora = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
const textoDaChamada = (r) => `${r.funcao}(${JSON.stringify(r.args ?? []).slice(1, -1).replace(/,/g, ', ')})`;

/**
 * Roda os casos de teste do problema com os arquivos do aluno.
 * - "Executar" usa só os casos visíveis; "Enviar" inclui os ocultos (`oculto: true`).
 * - Cada caso tem `entrada` (as linhas do input()) e `regras`; as regras `funcao`
 *   viram chamadas feitas depois do programa rodar, no mesmo escopo.
 * `executar(arquivos, { entrada, chamadas })` devolve o resultado do runtime.
 */
export async function corrigir(problema, arquivos, executar, { incluirOcultos = true } = {}) {
  const codigo = Object.values(arquivos).join('\n');
  const relatorio = [];
  for (const teste of problema.testes.filter((t) => incluirOcultos || !t.oculto)) {
    const inicio = agora();
    const regrasDeFuncao = teste.regras.filter((r) => 'funcao' in r);
    const chamadas = regrasDeFuncao.map((r) => ({ funcao: r.funcao, args: r.args ?? [] }));
    const r = await executar(arquivos, { entrada: teste.entrada ?? [], chamadas });
    const resultados = teste.regras.map((regra) => detalharRegra(regra, {
      saida: r.saida, erro: r.erro, variaveis: r.variaveis, codigo,
      retorno: r.retornos?.[regrasDeFuncao.indexOf(regra)],
    }));
    const erroExecucao = primeiraLinhaDoErro(r.erro) || undefined;
    relatorio.push({
      descricao: teste.descricao,
      oculto: Boolean(teste.oculto),
      ok: resultados.every((x) => x.ok),
      resultados,
      cenario: { entrada: teste.entrada ?? [], chamadas: regrasDeFuncao.map(textoDaChamada) },
      ...(erroExecucao ? { erroExecucao } : {}),
      ms: Math.max(1, Math.round(agora() - inicio)),
    });
  }
  return { aprovado: relatorio.every((t) => t.ok), relatorio };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/verificacoes.test.js tests/corrigir.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/verificacoes.js src/corrigir.js tests/verificacoes.test.js tests/corrigir.test.js
git commit -m "Correção com regras de Python: saída, função, variável, erro e código

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Prova de conceito do pool de workers (paralelismo real com `run_sync`)

**Files:**
- Create: `src/python/pool.js`, `src/python/worker-tarefa.js`, `src/python/tarefa.js`, `python/diverge_runtime/pool.py`, `python/vendor/cloudpickle/` (cloudpickle 3.1.1 + `LICENSE`), `tests/pool.test.js`
- Modify: `src/python/worker.js`, `src/python/sessao.js`, `src/licenca.js` (já listado na Task 1)

**Interfaces:**
- Consumes: `criarSessao(pyodide, { mapear })` (Task 2).
- Produces:
  - `class PoolPython { constructor({ criarWorker, maximo }); mapear(tarefas: Uint8Array[]) -> Promise<{ resultados: Uint8Array[], tarefas: { worker: number, inicio: number, fim: number }[] }>; fechar() }`
  - `criarTarefa(pyodide)` em `src/python/tarefa.js`: `(bytes: Uint8Array) -> Uint8Array` (desserializa `(funcao, item)`, roda, serializa o retorno).
  - Python: `diverge_runtime.pool.mapear(funcao, itens) -> list` e `diverge_runtime.pool.ULTIMA = { 'paralelo': bool, 'workers': int, 'tarefas': [...] }`.
  - Nesta fase o `mapear` é interno (só a prova de conceito); a API para o aluno (`multiprocessing`) vem na fase 3.

- [ ] **Step 1: Vendorizar o cloudpickle**

```bash
mkdir -p python/vendor && cd python/vendor
python -m pip download cloudpickle==3.1.1 --no-deps --no-binary :all: -d /tmp/cp
tar -xzf /tmp/cp/cloudpickle-3.1.1.tar.gz -C /tmp/cp
cp -r /tmp/cp/cloudpickle-3.1.1/cloudpickle . && cp /tmp/cp/cloudpickle-3.1.1/LICENSE cloudpickle/LICENSE
cd ../..
```

Expected: `python/vendor/cloudpickle/__init__.py`, `cloudpickle.py`, `LICENSE`.

- [ ] **Step 2: Testes do pool (falhando)**

`tests/pool.test.js`:

```js
// Prova de conceito do paralelismo real: o Python do aluno chama mapear(), que espera
// (run_sync, com JSPI) o pool de workers rodar as tarefas ao mesmo tempo.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Worker } from 'node:worker_threads';
import { PoolPython } from '../src/python/pool.js';
import { iniciarPython } from './python-node.js';

/** Worker do Node com a mesma cara do Web Worker (onmessage/postMessage/terminate). */
function workerNode() {
  const w = new Worker(new URL('./worker-tarefa-node.js', import.meta.url), { execArgv: ['--experimental-wasm-jspi'] });
  const adaptador = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate(), onmessage: null };
  w.on('message', (data) => adaptador.onmessage?.({ data }));
  return adaptador;
}

const CODIGO = `
from diverge_runtime import pool
def quadrado(n):
    total = 0
    for _ in range(300_000):
        total += 1
    return n * n
resultado = pool.mapear(quadrado, [1, 2, 3, 4])
info = pool.ULTIMA
`;

let pool;
afterAll(() => pool?.fechar());

describe('pool de workers', () => {
  it('o Node tem JSPI ligado nos testes', () => {
    expect(typeof WebAssembly.Suspending).toBe('function');
  });

  it('com JSPI: roda em paralelo em mais de um worker', async () => {
    pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
    const { sessao } = await iniciarPython({ mapear: (t) => pool.mapear(t) });
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.erro).toBeNull();
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.variaveis.info.paralelo).toBe(true);
    expect(new Set(r.variaveis.info.tarefas.map((t) => t.worker)).size).toBeGreaterThan(1);
  });

  it('sem pool: mesmo resultado, em sequência, avisando que não houve paralelismo', async () => {
    const { sessao } = await iniciarPython();
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.variaveis.info).toMatchObject({ paralelo: false, workers: 1 });
  });

  it('função definida pelo aluno (lambda) também viaja para o worker', async () => {
    const { sessao } = await iniciarPython({ mapear: (t) => pool.mapear(t) });
    const r = await sessao.executar({ 'main.py': 'from diverge_runtime import pool\nx = pool.mapear(lambda v: v + 1, [1, 2])' });
    expect(r.variaveis.x).toEqual([2, 3]);
  });
});
```

`tests/worker-tarefa-node.js` (o mesmo código do worker do site, com o Pyodide do Node):

```js
// Worker do pool para os testes no Node (o do site é src/python/worker-tarefa.js).
import { parentPort } from 'node:worker_threads';
import { carregarPython } from '../src/python/carregar.js';
import { criarSessao } from '../src/python/sessao.js';
import { criarTarefa } from '../src/python/tarefa.js';

const rodar = carregarPython().then(async (pyodide) => { await criarSessao(pyodide); return criarTarefa(pyodide); });
parentPort.on('message', async ({ id, tarefa }) => {
  const rodarTarefa = await rodar;
  try {
    const resultado = rodarTarefa(tarefa);
    parentPort.postMessage({ id, resultado }, [resultado.buffer]);
  } catch (erro) {
    parentPort.postMessage({ id, erro: String(erro?.message ?? erro) });
  }
});
```

Observação: `criarSessao` usa `import.meta.glob`, que só existe sob o Vite/vitest. O worker do Node não passa pelo vitest; por isso a Task 5 troca a montagem dos arquivos em `sessao.js` por uma função `montarPacotes(pyodide, fontes)` exportada, e o worker do Node recebe as fontes já lidas pelo teste via `workerData`. Ajuste assim:

```js
// sessao.js
export function montarPacotes(pyodide, fontes = FONTES) { /* o laço de gravação que hoje está em criarSessao */ }
export async function criarSessao(pyodide, { mapear, fontes } = {}) { montarPacotes(pyodide, fontes); /* resto igual */ }
```

```js
// tests/pool.test.js — ao criar o worker:
import { FONTES } from '../src/python/sessao.js'; // exporte FONTES
new Worker(url, { execArgv: ['--experimental-wasm-jspi'], workerData: { fontes: FONTES } });
// tests/worker-tarefa-node.js:
import { workerData } from 'node:worker_threads';
await criarSessao(pyodide, { fontes: workerData.fontes });
```

Run: `npx vitest run tests/pool.test.js`
Expected: FAIL (`PoolPython` não existe).

- [ ] **Step 3: Implementar o lado Python**

`python/diverge_runtime/pool.py`:

```python
"""mapear(funcao, itens): roda funcao(item) para cada item no pool de workers, de verdade em
paralelo, quando o navegador permite que o Python espere o JavaScript (run_sync, com JSPI).
Sem isso, roda em sequência aqui mesmo: o resultado é o mesmo e ULTIMA avisa."""
import time

import cloudpickle

ULTIMA = {'paralelo': False, 'workers': 1, 'tarefas': []}


def _pool_js():
    try:
        import diverge_pool_js
        from pyodide.ffi import can_run_sync
    except ImportError:
        return None
    return diverge_pool_js if can_run_sync() else None


def mapear(funcao, itens):
    itens = list(itens)
    js = _pool_js()
    if js is None:
        return _em_sequencia(funcao, itens)
    from pyodide.ffi import run_sync, to_js
    pacotes = [cloudpickle.dumps((funcao, item)) for item in itens]
    resposta = run_sync(js.mapear(to_js(pacotes))).to_py()
    resultados = [cloudpickle.loads(bytes(r)) for r in resposta['resultados']]
    tarefas = resposta['tarefas']
    ULTIMA.update(paralelo=True, workers=len({t['worker'] for t in tarefas}), tarefas=tarefas)
    return resultados


def _em_sequencia(funcao, itens):
    inicio = time.perf_counter()
    resultados, tarefas = [], []
    for item in itens:
        comeco = (time.perf_counter() - inicio) * 1000
        resultados.append(funcao(item))
        tarefas.append({'worker': 0, 'inicio': comeco, 'fim': (time.perf_counter() - inicio) * 1000})
    ULTIMA.update(paralelo=False, workers=1, tarefas=tarefas)
    return resultados
```

`src/python/tarefa.js`:

```js
// Roda uma tarefa do pool: (funcao, item) serializados com cloudpickle → retorno serializado.
export function criarTarefa(pyodide) {
  pyodide.runPython(`
import cloudpickle
def _diverge_tarefa(pacote):
    funcao, item = cloudpickle.loads(bytes(pacote))
    return cloudpickle.dumps(funcao(item))
`);
  const rodar = pyodide.globals.get('_diverge_tarefa');
  return (bytes) => {
    const proxy = rodar(bytes);
    try {
      return proxy.toJs();
    } finally {
      proxy.destroy();
    }
  };
}
```

- [ ] **Step 4: Implementar o pool e o worker de tarefas do site**

`src/python/pool.js`:

```js
// Pool de workers, cada um com o seu Pyodide: as tarefas rodam ao mesmo tempo nos
// núcleos do computador. Abre os workers sob demanda (até `maximo`) e mede o início e
// o fim de cada tarefa, em ms desde o começo do mapear().
const workerDoSite = () => new Worker(new URL('./worker-tarefa.js', import.meta.url), { type: 'module' });

export const maximoDeWorkers = () => {
  const nucleos = globalThis.navigator?.hardwareConcurrency ?? 2;
  return Math.max(1, Math.min(4, nucleos - 1));
};

export class PoolPython {
  constructor({ criarWorker = workerDoSite, maximo = maximoDeWorkers() } = {}) {
    this.criarWorker = criarWorker;
    this.maximo = maximo;
    this.workers = [];
    this.proximoId = 1;
  }

  #abrir(quantos) {
    while (this.workers.length < quantos) {
      const w = this.criarWorker();
      const registro = { w, pendentes: new Map() };
      w.onmessage = ({ data }) => {
        registro.pendentes.get(data.id)?.(data);
        registro.pendentes.delete(data.id);
      };
      this.workers.push(registro);
    }
  }

  #rodar(registro, tarefa) {
    const id = this.proximoId++;
    return new Promise((resolve, reject) => {
      registro.pendentes.set(id, (data) => (data.erro ? reject(new Error(data.erro)) : resolve(data.resultado)));
      registro.w.postMessage({ id, tarefa });
    });
  }

  async mapear(tarefas) {
    const lista = Array.from(tarefas, (t) => (t instanceof Uint8Array ? t : new Uint8Array(t)));
    this.#abrir(Math.min(this.maximo, lista.length));
    const inicio = performance.now();
    const resultados = new Array(lista.length);
    const registros = [];
    let proxima = 0;
    // Cada worker pega a próxima tarefa livre assim que termina a anterior.
    await Promise.all(this.workers.slice(0, Math.min(this.maximo, lista.length)).map(async (registro, worker) => {
      while (proxima < lista.length) {
        const i = proxima++;
        const comeco = performance.now() - inicio;
        resultados[i] = await this.#rodar(registro, lista[i]);
        registros[i] = { worker, inicio: comeco, fim: performance.now() - inicio };
      }
    }));
    return { resultados, tarefas: registros };
  }

  fechar() {
    for (const { w } of this.workers) w.terminate();
    this.workers = [];
  }
}
```

`src/python/worker-tarefa.js`:

```js
// Worker do pool: um Pyodide que só roda tarefas (funcao, item) serializadas.
import { carregarPython } from './carregar.js';
import { montarPacotes } from './sessao.js';
import { criarTarefa } from './tarefa.js';

const indexURL = import.meta.env.DEV ? '/pyodide/' : new URL('../pyodide/', import.meta.url).href;
const rodar = carregarPython({ indexURL }).then((pyodide) => {
  montarPacotes(pyodide);
  return criarTarefa(pyodide);
});

onmessage = async ({ data }) => {
  const rodarTarefa = await rodar;
  try {
    const resultado = rodarTarefa(data.tarefa);
    postMessage({ id: data.id, resultado }, [resultado.buffer]);
  } catch (erro) {
    postMessage({ id: data.id, erro: String(erro?.message ?? erro) });
  }
};
```

`montarPacotes` precisa também colocar `RAIZ` e `RAIZ/vendor` no `sys.path` (mova essa linha de `criarSessao` para `montarPacotes`).

No `src/python/worker.js`, crie o pool sob demanda e passe para a sessão:

```js
import { PoolPython } from './pool.js';
let pool;
const mapear = (tarefas) => (pool ??= new PoolPython()).mapear(tarefas);
const sessao = carregarPython({ indexURL }).then((pyodide) => criarSessao(pyodide, { mapear }));
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/pool.test.js`
Expected: PASS (4 testes). Se o terceiro falhar porque o worker não acha `__main__.<lambda>`, confirme que o `cloudpickle` serializa por valor as funções de `__main__` (o padrão do cloudpickle) e que o runtime executa com `__name__ == '__main__'`.

- [ ] **Step 6: Conferir no navegador**

Run: `npm run dev` (configuração `python-playground-dev` em `.claude/launch.json`, porta 5176) e, no console do playground livre, rode um exercício com o código de `CODIGO` acima.
Expected no Chrome/Edge: `info.paralelo == True` e mais de um worker. Registre no README (seção "Paralelismo") os navegadores conferidos e que, sem JSPI, o resultado é o mesmo e em sequência. Firefox e Safari não estão disponíveis neste ambiente: anote como "a conferir" e não afirme suporte.

- [ ] **Step 7: Commit**

```bash
git add python/vendor python/diverge_runtime/pool.py src/python tests/pool.test.js tests/worker-tarefa-node.js
git commit -m "Prova de conceito do pool: paralelismo real com run_sync, e reserva em sequência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Interface do exercício para Python

**Files:**
- Modify: `index.html` (painel de saída, aba Banco, botão Resetar banco, barra de endereço), `src/ui/item.js`, `src/ui/editor.js`, `src/main.js`, `src/progresso.js` (remover `BancoLivre`), `src/privacidade.js` (`DADOS_LOCAIS` sem o banco; com `entrada:*`), `src/estilo.css` (`.resultado`, `.barra-endereco`, `.erros` → `.terminal-python`, `.entrada-python`)
- Test: `tests/item-python.test.js`, `tests/acessibilidade-telas.test.js` (sem mudanças: precisa continuar passando)

**Interfaces:**
- Consumes: `MotorPython` (Task 3), `corrigir` e `descreverRegra/categoriaDe` (Task 4).
- Produces: `criarTelaItem({ motor, layout, definirStatus, aoMudarProgresso })` com o mesmo retorno de antes (`abrir`, `sair`, `redesenharDescricao`, `aoMudarEstadoPython(pronto)`).

- [ ] **Step 1: Painel de saída no `index.html`**

Troque a `section.painel-preview` do PHP por:

```html
        <section class="painel painel-preview" aria-label="Saída do Python">
          <div class="abas">
            <div class="abas-grupo" role="tablist" aria-label="Saída">
              <button class="aba ativa" data-saida="terminal" role="tab" aria-selected="true">🖥️ Terminal</button>
              <button class="aba" data-saida="entrada" role="tab" aria-selected="false" title="Respostas para o input(), uma por linha">⌨️ Entrada</button>
            </div>
          </div>
          <pre id="saida-terminal" class="terminal terminal-python" data-saida-painel="terminal" tabindex="0" aria-label="Saída do terminal" aria-busy="false"></pre>
          <div class="entrada-python" data-saida-painel="entrada" hidden>
            <label for="entrada">Respostas para o <code>input()</code>, uma por linha</label>
            <textarea id="entrada" rows="6" spellcheck="false"></textarea>
          </div>
        </section>
```

Remova `#aba-banco`, `#desc-banco`, `#btn-resetar-banco`, a barra de endereço e o `iframe#resultado`. O `#ajuda-editor` passa a dizer "Control Enter executa e roda os testes visíveis".

- [ ] **Step 2: Teste da tela (falhando)**

`tests/item-python.test.js`:

```js
// @vitest-environment happy-dom
// Tela do exercício com um motor falso: Executar mostra a saída e o traceback no
// terminal, usa a aba ⌨️ Entrada e roda os casos visíveis.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

function montar(resposta) {
  document.body.innerHTML = corpo;
  const pedidos = [];
  const motor = { executar: async (arquivos, opcoes) => { pedidos.push(opcoes); return { ms: 5, retornos: [], variaveis: {}, ...resposta }; } };
  const layout = { aplicar() {}, mostrarDescricao() {} };
  const tela = criarTelaItem({ motor, layout, definirStatus: () => {}, aoMudarProgresso: () => {} });
  tela.aoMudarEstadoPython(true);
  return { tela, pedidos };
}

describe('tela do exercício (Python)', () => {
  beforeEach(() => localStorage.clear());

  it('a saída aparece no terminal', async () => {
    const { tela } = montar({ saida: 'Olá, Sertão!\n', erro: null });
    tela.abrir('licao-ola');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('saida-terminal').textContent).toContain('Olá, Sertão!');
  });

  it('o traceback aparece no terminal, depois da saída', async () => {
    const { tela } = montar({ saida: 'antes\n', erro: { tipo: 'ZeroDivisionError', mensagem: 'division by zero', linha: 2, traceback: 'Traceback (most recent call last):\n  File "main.py", line 2\nZeroDivisionError: division by zero\n' } });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    const texto = document.getElementById('saida-terminal').textContent;
    expect(texto.indexOf('antes')).toBeLessThan(texto.indexOf('ZeroDivisionError'));
  });

  it('as linhas da aba ⌨️ Entrada vão para o input()', async () => {
    const { tela, pedidos } = montar({ saida: '', erro: null });
    tela.abrir('livre');
    document.getElementById('entrada').value = 'Ana\nBia';
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidos.at(-1).entrada).toEqual(['Ana', 'Bia']);
  });
});
```

Run: `npx vitest run tests/item-python.test.js`
Expected: FAIL.

- [ ] **Step 3: Adaptar `src/ui/item.js`**

Alterações, nesta ordem:
1. Imports: troque `TempoEsgotado` de `../php/motor.js` por `../python/motor.js`; remova `navegacao.js` e as funções de banco de `progresso.js`.
2. `el`: remova `resetarBanco`, `abaBanco`, `banco`, `barra`, `url`, `resultado`, `fonte`, `erros`; acrescente `terminal: $('saida-terminal')`, `entrada: $('entrada')`.
3. `estado`: `{ item: null, pythonPronto: false, ocupado: false, origem: null }`.
4. Apague `bancoAtual`, `renderBanco`, `SCRIPT_PONTE` e os ouvintes de `message` e `submit` da barra.
5. `mostrarSaida(nome)`: mostra `[data-saida-painel]` com `dataset.saidaPainel === nome`.
6. Substitua `mostrarErros`, `tratarErro`, `falaDoPhp`, `executarNoMotor` e `executar` por:

```js
  const entradaAtual = () => el.entrada.value.split('\n').filter((l, i, todas) => i < todas.length - 1 || l !== '');

  function mostrarTerminal(r) {
    el.terminal.textContent = `${r.saida ?? ''}${r.erro ? r.erro.traceback : ''}` || '(o programa não imprimiu nada)';
    el.terminal.classList.toggle('com-erro', Boolean(r.erro));
  }

  function tratarErro(erro) {
    const tempo = erro instanceof TempoEsgotado;
    el.terminal.textContent = tempo
      ? `⏱️ ${erro.message}\nVerifique se algum laço (for/while) nunca termina.`
      : `Erro interno do DivergePython: ${erro?.message ?? erro}`;
    definirStatus(tempo ? 'Tempo esgotado' : 'Erro ao executar', { falar: frase(el.terminal.textContent) });
  }

  /** O resultado da execução, falado: saída curta ou o erro com a linha. */
  function falaDoPython(r) {
    if (r.erro) return frase(`O programa parou na linha ${r.erro.linha ?? 'desconhecida'} com ${r.erro.tipo}: ${r.erro.mensagem}`);
    const linhas = (r.saida ?? '').trimEnd().split('\n').filter(Boolean);
    if (!linhas.length) return 'O programa rodou sem erros e não imprimiu nada.';
    const lidas = leitorDeTela() ? linhas.slice(0, 10) : linhas.slice(0, 2);
    return `O programa rodou sem erros. Saída: ${lidas.map(frase).join(' ')}${linhas.length > lidas.length ? ` E mais ${linhas.length - lidas.length} linhas no terminal.` : ''}`;
  }

  const executarNoMotor = (arquivos, opcoes) => motor.executar(arquivos, opcoes);
  const executarPeloAluno = () => executar({ abrirTestes: true, falar: true });

  // `falar`: só quando a pessoa pediu (botão ou atalho); as execuções automáticas
  // (abrir o exercício, restaurar) não interrompem o leitor de tela.
  async function executar({ abrirTestes = false, falar = false } = {}) {
    if (!estado.pythonPronto || !estado.item) return;
    const item = estado.item;
    definirStatus('Executando…', { falar: false });
    el.terminal.setAttribute('aria-busy', 'true');
    try {
      const r = await motor.executar({ ...editor.arquivos }, { entrada: entradaAtual() });
      if (estado.item !== item) return;
      mostrarTerminal(r);
      const fala = falaDoPython(r);
      const comTestes = item.tipo === 'problema';
      definirStatus(`Python 3.14 · ${r.erro ? r.erro.tipo : 'ok'} · ${r.ms} ms`, { falar: falar && !comTestes && fala });
      if (item.tipo === 'licao' && !r.erro && !statusDe(item.id)) {
        marcar(item.id, 'resolvido');
        aoMudarProgresso();
      }
      if (comTestes) {
        const resultado = await rodarTestes({ incluirOcultos: false });
        if (estado.item !== item) return;
        if (falar) anunciar(`${fala} ${falarTestes(resultado, false, { codigoComErro: Boolean(r.erro) })}`);
        if (abrirTestes) abrirAbaTestes();
      }
    } catch (erro) {
      tratarErro(erro);
    } finally {
      el.terminal.setAttribute('aria-busy', 'false');
    }
  }
```

7. `rodarTestes`: `corrigir(item, { ...editor.arquivos }, executarNoMotor, { incluirOcultos })`.
8. `linhasDoCenario(cenario, { ocultar })`: devolve `['$ python main.py', ...entrada.map((l) => `> ${ocultar ? '…' : l}`), ...chamadas.map((c) => `>>> ${ocultar ? c.replace(/\(.*\)/, '(…)') : c}`)]`; `cenarioDoTeste(t) = { entrada: t.entrada ?? [], chamadas: t.regras.filter((r) => 'funcao' in r).map(textoDaChamada) }` (copie `textoDaChamada` de `corrigir.js` exportando-o de lá).
9. `abrir`: remova as linhas de URL, banco e iframe; limpe `el.terminal.textContent` e `el.entrada.value` (o livre restaura a entrada salva em `lerRascunho('livre:entrada')`); chame `if (estado.pythonPronto) executar();`.
10. Renomeie `aoMudarEstadoPhp` → `aoMudarEstadoPython` e `phpPronto` → `pythonPronto` (também em `src/main.js`, que passa a criar `new MotorPython({ aoMudarEstado })` com os textos "Carregando o Python… (só demora na primeira vez)", "Python 3.14 pronto" e "Não foi possível carregar o Python: …").

`src/ui/editor.js`: `import { python as linguagemPython } from '@codemirror/lang-python'`; `NOME_VALIDO = /^[\w-]+\.(py|txt|csv|json)$/`; novo arquivo com prompt `'Nome do novo arquivo (ex.: funcoes.py, dados.csv):'`, valor inicial `'funcoes.py'`, conteúdo `''`; `aria-label` `'Editor de código Python'`; `EditorState.tabSize.of(4)` e `indentUnit.of('    ')` (de `@codemirror/language`), porque o Python usa 4 espaços. Mantenha o Tab fora do editor (sem `indentWithTab`); o `#ajuda-editor` explica Ctrl+] para recuar.

- [ ] **Step 4: Rodar a suíte**

Run: `npx vitest run && npx eslint .`
Expected: tudo passa, inclusive `tests/acessibilidade-telas.test.js` e `tests/cegos-surdos.test.js` (atualize neles só as referências a textos do PHP, como "HTML gerado").

- [ ] **Step 5: Conferir no navegador**

Run: `npm run dev` e abra `#/livre` e `#/p/licao-ola`.
Expected: "Python 3.14 pronto" na barra; Executar mostra a saída; `input()` lê a aba ⌨️ Entrada; `while True: pass` mostra o aviso de tempo depois de 10 s e o próximo Executar funciona; axe sem violações (injete o axe-core como nas auditorias anteriores).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Tela do exercício para Python: terminal, entrada do input() e testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Módulo 🐍 Python básico — lições e exercícios 1 a 20

**Files:**
- Modify: `src/conteudo/basico.js`
- Create: `src/conteudo/util.js` (`py` = template que tira a indentação comum), `tests/conteudo.test.js`

**Interfaces:**
- Consumes: formato de teste e regras da Task 4.
- Produces: itens em `moduloBasico.itens`: lições `{ id, tipo: 'licao', titulo, texto, arquivos }` e problemas `{ id, tipo: 'problema', titulo, dificuldade, enunciado, dica, arquivos, solucao, testes }`.

- [ ] **Step 1: Teste do conteúdo (vai falhar enquanto faltar exercício)**

`tests/conteudo.test.js`:

```js
// Todo o conteúdo da trilha: a solução de cada exercício passa em todos os casos
// (inclusive os ocultos), o código inicial falha em algum caso visível, e as lições
// rodam sem erro. Usa o Python de verdade (Pyodide no Node).
import { describe, it, expect, beforeAll } from 'vitest';
import { modulos, itens, problemas, LIVRE } from '../src/conteudo/trilha.js';
import { corrigir } from '../src/corrigir.js';
import { iniciarPython } from './python-node.js';

let executar;
beforeAll(async () => { const { sessao } = await iniciarPython(); executar = (a, o) => sessao.executar(a, o); });

describe('estrutura', () => {
  it('o 🐍 Python básico tem 40 exercícios e 10 lições, com ids únicos', () => {
    const basico = modulos.find((m) => m.id === 'basico');
    expect(basico.itens.filter((i) => i.tipo === 'problema')).toHaveLength(40);
    expect(basico.itens.filter((i) => i.tipo === 'licao')).toHaveLength(10);
    expect(new Set(itens.map((i) => i.id)).size).toBe(itens.length);
  });

  it.each(problemas.map((p) => [p.id, p]))('%s tem os campos e casos visíveis e ocultos', (_id, p) => {
    expect(p.titulo).toBeTruthy();
    expect(['facil', 'medio', 'dificil']).toContain(p.dificuldade);
    expect(p.enunciado).toContain('<');
    expect(p.dica).toBeTruthy();
    expect(p.testes.some((t) => !t.oculto)).toBe(true);
    expect(p.testes.some((t) => t.oculto)).toBe(true);
  });
});

describe('lições e playground livre rodam sem erro', () => {
  it.each([...itens.filter((i) => i.tipo === 'licao'), LIVRE].map((l) => [l.id, l]))('%s', async (_id, l) => {
    const r = await executar(l.arquivos, { entrada: l.id === 'livre' ? ['Ana'] : l.entrada ?? [] });
    expect(r.erro).toBeNull();
  });
});

describe('exercícios', () => {
  it.each(problemas.map((p) => [p.id, p]))('%s: a solução passa em todos os casos', async (_id, p) => {
    const { aprovado, relatorio } = await corrigir(p, p.solucao, executar);
    expect(relatorio.flatMap((c) => c.resultados.filter((r) => !r.ok).map((r) => `[${c.descricao}] ${r.mensagem}: ${r.detalhe}`))).toEqual([]);
    expect(aprovado).toBe(true);
  });

  it.each(problemas.map((p) => [p.id, p]))('%s: o código inicial ainda não passa', async (_id, p) => {
    expect((await corrigir(p, p.arquivos, executar, { incluirOcultos: false })).aprovado).toBe(false);
  });
});
```

`src/conteudo/util.js`:

```js
/** Template para código Python: tira a indentação comum e a primeira quebra de linha. */
export function py(partes, ...valores) {
  const texto = partes.reduce((acc, parte, i) => acc + parte + (valores[i] ?? ''), '').replace(/^\n/, '');
  const margem = Math.min(...texto.split('\n').filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return texto.split('\n').map((l) => l.slice(margem)).join('\n').replace(/\s*$/, '\n');
}
export const main = (codigo) => ({ 'main.py': codigo });
```

- [ ] **Step 2: Escrever as 10 lições**

Cada lição tem `texto` (2 a 4 parágrafos curtos, com um exemplo e uma analogia) e `arquivos` com um `main.py` que roda sem erro. Ids e assuntos:

| id | título | o `main.py` mostra |
| --- | --- | --- |
| `licao-ola` | Olá, Python | `print` de texto e de conta (já existe) |
| `licao-variaveis` | Variáveis e tipos | `nome = "Ana"`, `idade = 30`, `altura = 1.65`, `type()` de cada |
| `licao-strings` | Textos (strings) | f-string, `.upper()`, `.strip()`, `len`, fatiamento `[0:3]` |
| `licao-input` | Lendo dados com input() | `input()` com `int()` (lição com `entrada: ['7']`) |
| `licao-condicoes` | Decisões com if | `if/elif/else` com nota |
| `licao-lacos` | Repetindo com for e while | `for i in range(3)`, `while` com contador |
| `licao-funcoes` | Funções | `def`, parâmetros, `return` x `print` |
| `licao-listas` | Listas | `append`, índice, `for` em lista, `len` |
| `licao-dicionarios` | Dicionários | chaves, `get`, `items()` |
| `licao-excecoes` | Erros e exceções | `try/except ValueError`, `raise` |

A lição `licao-input` leva `entrada: ['7']` no objeto (o teste de conteúdo usa `l.entrada`).

- [ ] **Step 3: Escrever os exercícios 1 a 20**

Modelo completo (o primeiro). Todos os outros seguem o mesmo formato, com `arquivos` = código inicial que não passa (geralmente a assinatura com `pass` ou um `print` vazio), `solucao`, e os testes da tabela:

```js
{
  id: 'py-ola',
  tipo: 'problema',
  titulo: 'Olá, Sertão!',
  dificuldade: 'facil',
  enunciado: '<p>Mostre exatamente <code>Olá, Sertão!</code> no terminal.</p>',
  dica: 'print("texto") mostra o texto. Acentos e pontuação contam.',
  arquivos: main(py`
    # Escreva o seu código aqui
  `),
  solucao: main(py`
    print("Olá, Sertão!")
  `),
  testes: [
    { descricao: 'saída', regras: [{ saidaIgual: 'Olá, Sertão!' }, { semErros: true }] },
    { descricao: 'nada a mais', oculto: true, regras: [{ saidaIgual: 'Olá, Sertão!' }] },
  ],
},
```

| # | id | título | dif. | o que pede | solução de referência | testes visíveis | testes ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `py-ola` | Olá, Sertão! | fácil | modelo acima | — | — | — |
| 2 | `py-saudacao` | Saudação | fácil | ler o nome com `input()` e mostrar `Olá, <nome>!` | `nome = input()`<br>`print(f"Olá, {nome}!")` | entrada `['Ana']` → `saidaIgual 'Olá, Ana!'` | entrada `['José Maria']` → `saidaIgual 'Olá, José Maria!'` |
| 3 | `py-soma-dois` | Soma de dois números | fácil | ler dois inteiros (um por linha) e mostrar a soma | `a = int(input())`<br>`b = int(input())`<br>`print(a + b)` | `['2','3']` → `saidaIgual '5'` | `['-10','4']` → `'-6'`; `['0','0']` → `'0'` |
| 4 | `py-area-retangulo` | Área do retângulo | fácil | `area(base, altura)` devolve a área | `def area(base, altura):`<br>`    return base * altura` | `funcao area [3,4] → 12` | `area [2.5,2] → 5.0`; `area [0,9] → 0` |
| 5 | `py-celsius` | Celsius para Fahrenheit | fácil | `celsius_para_fahrenheit(c)` = c × 9/5 + 32 | `return c * 9 / 5 + 32` | `[0] → 32`, `[100] → 212` | `[-40] → -40`, `[36.6] aprox 0.01 → 97.88` |
| 6 | `py-media` | Média de três notas | médio | `media(n1, n2, n3)` com 1 casa (`round`) | `return round((n1 + n2 + n3) / 3, 1)` | `[8,6,7] → 7.0` | `[10,9,8.5] → 9.2`; `[0,0,1] → 0.3` |
| 7 | `py-iniciais` | Iniciais do nome | médio | `iniciais(nome)`: primeira letra maiúscula de cada palavra com 3+ letras | `return "".join(p[0].upper() for p in nome.split() if len(p) >= 3)` | `["Maria da Silva"] → "MS"` | `["josé de alencar"] → "JA"`; `["Ana"] → "A"` |
| 8 | `py-inverter` | Texto ao contrário | fácil | `inverter(texto)` | `return texto[::-1]` | `["sertão"] → "oãtres"` | `[""] → ""`; `["ab c"] → "c ba"` |
| 9 | `py-palindromo` | Palíndromo | médio | `eh_palindromo(texto)` ignorando espaços e maiúsculas | `t = texto.replace(" ", "").lower()`<br>`return t == t[::-1]` | `["Ame a ema"] → true`, `["sertão"] → false` | `["Socorram me subi no onibus em Marrocos"] → true`; `["a"] → true` |
| 10 | `py-formatar-preco` | Preço em reais | médio | `formatar_preco(valor)` → `"R$ 1.234,50"` | `t = f"{valor:,.2f}"`<br>`return "R$ " + t.replace(",", "X").replace(".", ",").replace("X", ".")` | `[1234.5] → "R$ 1.234,50"` | `[0] → "R$ 0,00"`; `[1000000] → "R$ 1.000.000,00"` |
| 11 | `py-par-impar` | Par ou ímpar | fácil | `par_ou_impar(n)` → `"par"` / `"ímpar"` | `return "par" if n % 2 == 0 else "ímpar"` | `[4] → "par"`, `[7] → "ímpar"` | `[0] → "par"`; `[-3] → "ímpar"` |
| 12 | `py-maior-de-tres` | Maior de três (sem max) | fácil | `maior(a, b, c)` sem usar `max` | `if/elif` | `[1,5,3] → 5`; `semCodigo 'max\\('` | `[-1,-5,-3] → -1`; `[2,2,1] → 2` |
| 13 | `py-fizzbuzz` | FizzBuzz | médio | `fizzbuzz(n)` → lista de 1 a n com "Fizz", "Buzz", "FizzBuzz" ou o número em texto | laço com `% 15` primeiro | `[5] → ["1","2","Fizz","4","Buzz"]` | `[15]` → 15 itens, o último `"FizzBuzz"`; `[1] → ["1"]` |
| 14 | `py-tabuada` | Tabuada | fácil | ler `n` e mostrar `n x 1 = n` até `n x 10` | `for i in range(1, 11): print(f"{n} x {i} = {n * i}")` | `['7']` → `saidaIgual` das 10 linhas da tabuada do 7 | `['1']` → 10 linhas; `['12']` → 10 linhas |
| 15 | `py-soma-ate` | Soma até n | fácil | `soma_ate(n)` = 1 + 2 + … + n, com laço | `total = 0`<br>`for i in range(1, n + 1): total += i`<br>`return total` | `[4] → 10`; `codigo 'for\\s|while\\s'` | `[1] → 1`; `[100] → 5050`; `[0] → 0` |
| 16 | `py-contagem-regressiva` | Contagem regressiva | fácil | ler `n` e mostrar de `n` até 1 e depois `Fogo!` | `while n > 0: print(n); n -= 1`<br>`print("Fogo!")` | `['3']` → `saidaIgual '3\n2\n1\nFogo!'` | `['1']` → `'1\nFogo!'`; `['0']` → `'Fogo!'` |
| 17 | `py-primo` | Número primo | médio | `eh_primo(n)` | testar divisores até `int(n ** 0.5)` | `[7] → true`, `[8] → false` | `[1] → false`; `[2] → true`; `[97] → true`; `[91] → false` |
| 18 | `py-fatorial` | Fatorial | médio | `fatorial(n)`, com `fatorial(0) == 1` | laço multiplicando | `[5] → 120` | `[0] → 1`; `[10] → 3628800` |
| 19 | `py-bissexto` | Ano bissexto | médio | `bissexto(ano)`: divisível por 4 e não por 100, ou por 400 | `return ano % 4 == 0 and (ano % 100 != 0 or ano % 400 == 0)` | `[2024] → true`, `[2023] → false` | `[1900] → false`; `[2000] → true` |
| 20 | `py-imc` | Classificação do IMC | difícil | `classificar_imc(peso, altura)`: `< 18.5` "abaixo do peso", `< 25` "normal", `< 30` "sobrepeso", senão "obesidade" | calcular `peso / altura ** 2` e comparar | `[70, 1.75] → "normal"` | `[50, 1.70] → "abaixo do peso"`; `[80, 1.70] → "sobrepeso"`; `[100, 1.70] → "obesidade"`; `[72.25, 1.70] → "sobrepeso"` (IMC 25,0 exato) |

Nos exercícios de função, o código inicial é a assinatura com `pass` (por exemplo `def area(base, altura):\n    pass`), que devolve `None` e não passa. Cada exercício tem `dica` de uma linha, como no modelo.

- [ ] **Step 4: Rodar o teste de conteúdo dos 20 primeiros**

Run: `npx vitest run tests/conteudo.test.js -t "py-"`
Expected: os 20 exercícios passam nos dois testes (solução aprova, código inicial reprova). O teste "40 exercícios e 10 lições" continua falhando até a Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo tests/conteudo.test.js
git commit -m "Python básico: 10 lições e exercícios 1 a 20

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Módulo 🐍 Python básico — exercícios 21 a 40

**Files:**
- Modify: `src/conteudo/basico.js`, `src/conteudo/glossario.js` (termos usados nos enunciados novos)

- [ ] **Step 1: Escrever os exercícios 21 a 40**

Mesmo formato da Task 7.

| # | id | título | dif. | o que pede | solução de referência | testes visíveis | testes ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 21 | `py-soma-lista` | Soma da lista (sem sum) | fácil | `soma(lista)` sem usar `sum` | laço acumulando | `[[1,2,3]] → 6`; `semCodigo 'sum\\('` | `[[]] → 0`; `[[-1,1,5]] → 5` |
| 22 | `py-maior-lista` | Maior da lista | fácil | `maior_da_lista(lista)`; lista vazia → `None` | `return max(lista) if lista else None` | `[[3,9,2]] → 9` | `[[]] → null`; `[[-5,-2]] → -2` |
| 23 | `py-pares` | Só os pares | fácil | `somente_pares(lista)` mantendo a ordem | `return [n for n in lista if n % 2 == 0]` | `[[1,2,3,4]] → [2,4]` | `[[]] → []`; `[[7,0,-2]] → [0,-2]` |
| 24 | `py-media-lista` | Média da lista | médio | `media(lista)` com 2 casas; vazia → 0 | `return round(sum(lista) / len(lista), 2) if lista else 0` | `[[7,8,9]] → 8.0` | `[[]] → 0`; `[[1,2]] → 1.5`; `[[1,1,2]] → 1.33` |
| 25 | `py-sem-duplicados` | Sem duplicados | médio | `sem_duplicados(lista)` mantendo a ordem da primeira aparição | laço com conjunto `vistos` | `[[1,2,1,3,2]] → [1,2,3]` | `[[]] → []`; `[["b","a","b"]] → ["b","a"]` |
| 26 | `py-segundo-maior` | Segundo maior | médio | `segundo_maior(lista)` entre valores distintos; menos de 2 distintos → `None` | `d = sorted(set(lista))`<br>`return d[-2] if len(d) >= 2 else None` | `[[4,9,9,7]] → 7` | `[[5,5]] → null`; `[[1]] → null`; `[[-1,-3]] → -3` |
| 27 | `py-rotacionar` | Rotacionar lista | médio | `rotacionar(lista, k)`: os últimos `k` vão para o começo (k pode ser maior que o tamanho) | `if not lista: return []`<br>`k %= len(lista)`<br>`return lista[-k:] + lista[:-k] if k else lista[:]` | `[[1,2,3,4], 1] → [4,1,2,3]` | `[[1,2,3], 4] → [3,1,2]`; `[[], 3] → []`; `[[1,2], 0] → [1,2]` |
| 28 | `py-achatar` | Achatar lista | difícil | `achatar(listas)`: junta as sublistas (um nível) | `return [x for sub in listas for x in sub]` | `[[[1,2],[3]]] → [1,2,3]` | `[[[],[1],[]]] → [1]`; `[[]] → []` |
| 29 | `py-argumento-padrao` | Argumento padrão | médio | `saudacao(nome, cumprimento="Olá")` → `"Olá, Ana!"` | `return f"{cumprimento}, {nome}!"` | `["Ana"] → "Olá, Ana!"` | `["Bia","Bom dia"] → "Bom dia, Bia!"` |
| 30 | `py-busca-binaria` | Busca binária | difícil | `busca_binaria(lista, alvo)` em lista ordenada → índice ou -1, sem `index` | laço com `inicio`, `fim`, `meio` | `[[1,3,5,7,9],7] → 3`; `semCodigo '\\.index\\('` | `[[1,3,5],4] → -1`; `[[],1] → -1`; `[[2],2] → 0` |
| 31 | `py-contar-letras` | Contar letras | médio | `contar_letras(texto)` → dicionário só com letras, em minúsculas | `for c in texto.lower(): if c.isalpha(): d[c] = d.get(c, 0) + 1` | `["Aba!"] → {"a":2,"b":1}` | `[""] → {}`; `["Ção ç"] → {"ç":2,"ã":1,"o":1}` |
| 32 | `py-estoque` | Estoque | fácil | `adicionar(estoque, item, quantidade)` soma ao que já existe e devolve o dicionário | `estoque[item] = estoque.get(item, 0) + quantidade`<br>`return estoque` | `[{"milho":2},"milho",3] → {"milho":5}` | `[{},"feijão",1] → {"feijão":1}` |
| 33 | `py-aprovados` | Alunos aprovados | médio | `aprovados(notas)` (nome → nota) → nomes com nota ≥ 7, em ordem alfabética | `return sorted(n for n, v in notas.items() if v >= 7)` | `[{"Ana":8,"Bia":6,"Caio":7}] → ["Ana","Caio"]` | `[{}] → []`; `[{"Zé":10,"Al":7}] → ["Al","Zé"]` |
| 34 | `py-inverter-dicionario` | Inverter dicionário | médio | `inverter_dict(d)`: valores viram chaves | `return {v: k for k, v in d.items()}` | `[{"a":"1","b":"2"}] → {"1":"a","2":"b"}` | `[{}] → {}` |
| 35 | `py-agenda` | Agenda | médio | `buscar_telefone(agenda, nome)` ignorando maiúsculas → telefone ou `"não encontrado"` | percorrer com `nome.lower()` | `[{"Ana":"9999"},"ana"] → "9999"` | `[{},"Ana"] → "não encontrado"`; `[{"BIA":"1"},"bia"] → "1"` |
| 36 | `py-top-palavras` | Palavras mais frequentes | difícil | `top_palavras(texto, n)` → lista de `[palavra, contagem]`, da mais frequente para a menos; empate em ordem alfabética; palavras em minúsculas, separadas por espaço | contar com dicionário e `sorted(..., key=lambda p: (-p[1], p[0]))[:n]` | `["a b a c b a", 2] → [["a",3],["b",2]]` | `["", 3] → []`; `["Sol sol LUA", 5] → [["sol",2],["lua",1]]` |
| 37 | `py-para-inteiro` | Converter com segurança | fácil | `para_inteiro(texto)` → `int` ou `None` quando não for número, com `try/except` | `try: return int(texto)`<br>`except ValueError: return None` | `["42"] → 42`; `["abc"] → null`; `codigo 'try:'` | `[" 7 "] → 7`; `["4.5"] → null` |
| 38 | `py-divisao-segura` | Divisão segura | médio | `dividir(a, b)`; com `b == 0` levanta `ValueError("divisão por zero")` | `if b == 0: raise ValueError("divisão por zero")`<br>`return a / b` | `[10,4] → 2.5`; `[1,0] erro ValueError` | `[0,5] → 0.0`; `[-9,3] → -3.0` |
| 39 | `py-validar-idade` | Validar idade | médio | `validar_idade(texto)` → `int`; levanta `ValueError` se não for número ou estiver fora de 0 a 130 | `idade = int(texto)` (o próprio `int` levanta)<br>`if not 0 <= idade <= 130: raise ValueError("idade fora do intervalo")` | `["30"] → 30`; `["abc"] erro ValueError` | `["131"] erro ValueError`; `["-1"] erro ValueError`; `["0"] → 0` |
| 40 | `py-carrinho` | Total do carrinho | difícil | `total_carrinho(itens, cupom=None)`: soma `preco * qtd`; cupom `"SERTAO10"` dá 10%; outro cupom levanta `ValueError`; resultado com 2 casas | `total = sum(i["preco"] * i["qtd"] for i in itens)`<br>`if cupom is not None:`<br>`    if cupom != "SERTAO10": raise ValueError("cupom inválido")`<br>`    total *= 0.9`<br>`return round(total, 2)` | `[[{"preco":10,"qtd":2}]] → 20`; `[[{"preco":10,"qtd":2}],"SERTAO10"] → 18.0` | `[[]] → 0`; `[[{"preco":9.99,"qtd":3}],"SERTAO10"] → 26.97`; `[[{"preco":1,"qtd":1}],"X"] erro ValueError` |

- [ ] **Step 2: Rodar o teste de conteúdo completo**

Run: `npx vitest run tests/conteudo.test.js`
Expected: PASS, inclusive "40 exercícios e 10 lições".

- [ ] **Step 3: Commit**

```bash
git add src/conteudo
git commit -m "Python básico: exercícios 21 a 40 e glossário

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Certificado, badges, landing, trilha e tutorial do DivergePython

**Files:**
- Modify: `src/certificados.js`, `src/badges.js`, `src/ui/landing.js`, `src/landing.css`, `src/ui/inicio.js`, `src/caminho.css`, `src/ui/tutorial-passos.js`, `src/gamificacao.js` (níveis), `public/favicon.svg`, `src/instrutor.js` (sem mudança de conteúdo; só conferir), `scripts/gerar-badges.mjs`
- Test: os herdados (`tests/landing.test.js`, `tests/certificados.test.js`, `tests/badges.test.js`, `tests/carga-horaria.test.js`, `tests/seo.test.js`, `tests/gamificacao.test.js`) com os dados do Python

- [ ] **Step 1: Ajustar os testes herdados para o DivergePython**

Exemplos do que mudar (só dados, nunca a regra):
- `tests/landing.test.js`: `numerosDaTrilha().modulos === 1`, `exercicios === 40`; a seção "em breve" lista os 5 `PROXIMOS_MODULOS`.
- `tests/badges.test.js`: `svgBadge('basico')`.
- `tests/carga-horaria.test.js`: carga do `basico` = soma das atividades (10 lições × 10 min + 40 exercícios pelos minutos da dificuldade), arredondada para cima, em horas.
- `tests/seo.test.js`: `NOME === 'DivergePython'`; título `DivergePython: Python e PySpark acessíveis para todas as pessoas` (≤ 60 caracteres: confira; se passar, use `DivergePython: Python acessível para todas as pessoas`).

Run: `npx vitest run`
Expected: FAIL nos pontos ajustados.

- [ ] **Step 2: Implementar**

- `certificados.js`: `CERTIFICADOS = { basico: { titulo: 'Fundamentos de Python', resumo: 'domina variáveis, condições, laços, funções, listas, dicionários e exceções em Python', conteudos: ['Variáveis, tipos e strings', 'Condições e laços', 'Funções e listas', 'Dicionários e exceções'], cargaHoraria: cargaDoModulo('basico') } }`, `ORDEM = ['basico']`.
- `badges.js`: o desenho do `basico` usa o símbolo `py` (fonte mono, como o `php` do DivergePHP), cor amarela (`#f1fa8c`) e faixa "PYTHON"; a capa (`svgCapa`) com `Diverge<tspan>Python</tspan>`, "Aprenda Python e PySpark com / acessibilidade para todas as pessoas." e "Leitor de tela, Libras, teclado e perfis para TDAH."; selo dos badges `DIVERGEPYTHON`.
- `gamificacao.js`: níveis `Aprendiz 100`, `Pythonista 250`, `Analista de dados 450`, `Engenheiro de dados 700`, `Arquiteto de dados 1000`, `Mestre do Spark 1400`.
- `landing.js`: h1 `Aprenda <span class="destaque">Python</span> do zero, com acessibilidade para todas as pessoas`; `hero-sub`: "Uma trilha gamificada do Python ao PySpark, com dados em paralelo: você escreve o código, clica em <b>▶ Executar</b> e os testes dizem na hora se acertou. Sem instalar nada, sem cadastro."; código de exemplo: a solução do `py-fizzbuzz`; seção "A trilha" mostra os módulos de `modulos` e, depois, os de `PROXIMOS_MODULOS` com o selo "em breve" (`<span class="chip">em breve</span>`, sem link); cores de `.modulo-card[data-modulo="basico"]` e das próximas em `landing.css`/`caminho.css`.
- `inicio.js`: a trilha termina com um bloco "Em breve" listando `PROXIMOS_MODULOS` (texto, sem botão), e não mostra o certificado final.
- `tutorial-passos.js`: troque as menções a "Resultado", "HTML gerado" e "Banco" por "🖥️ Terminal" e "⌨️ Entrada"; o passo do editor fala de Python e de recuo com 4 espaços.
- `public/favicon.svg`: o mesmo estilo dos irmãos, com `py`.

Run: `npm run badges && npx vitest run && npx eslint .`
Expected: tudo passa; `public/badges/basico.png`, `basico-card.png` e `og-capa.png` gerados.

- [ ] **Step 3: Conferir a capa**

Abra `public/og-capa.png` e confira: nome DivergePython, frase de acessibilidade, "40 exercícios", badge do Python. Ajuste posições se algo encostar nos badges.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Certificado, badges, landing e trilha do DivergePython

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Auditoria, CI e publicação da 0.1.0

**Files:**
- Modify: `.github/workflows/pages.yml` (pytest antes do build), `src/novidades.js`, `README.md`, `src/ui/declaracao-acessibilidade.js` (limite conhecido: paralelismo depende de JSPI)

- [ ] **Step 1: Novidades e README**

`src/novidades.js`, `RELEASES`:

```js
  {
    versao: '0.1.0',
    data: '<data da publicação, AAAA-MM-DD>',
    titulo: 'Chegou o DivergePython',
    resumo: 'Python de verdade no navegador, com o primeiro módulo da trilha que vai até o PySpark.',
    grupos: [
      { titulo: '🐍 Python básico', itens: ['10 lições e 40 exercícios corrigidos na hora, com casos ocultos.', 'Certificado Fundamentos de Python.'] },
      { titulo: '🧪 Playground livre', itens: ['Python 3.14 à vontade, com input() pela aba ⌨️ Entrada.'] },
      { titulo: '♿ Acessível para todas as pessoas', itens: ['Leitor de tela, Libras (VLibras), teclado e perfis para TDAH, dislexia, autismo e ansiedade, como nos outros sites Diverge.'] },
      { titulo: '🔧 Por dentro', itens: ['Pyodide servido pelo próprio site, sem CDN de terceiros.', 'Base do paralelismo real (pool de workers), que entra na trilha no módulo ⚡ Paralelismo.'] },
    ],
  },
```

A data é a do dia da publicação (Step 5). `README.md`: título `# 🐍 DivergePython`, parágrafo de acessibilidade igual ao dos irmãos, "Em breve" com os 5 próximos módulos, seção "Paralelismo" com os navegadores conferidos na Task 5, seção "Certificados" (secret `CERTIFICADO_SEGREDO`).

`declaracao-acessibilidade.js`, em "Limites conhecidos": `O paralelismo real usa um recurso novo dos navegadores (JSPI). Onde ele não existe, o código roda em sequência, com o mesmo resultado, e o site avisa.`

- [ ] **Step 2: CI com pytest**

Em `.github/workflows/pages.yml`, antes do `npm test`:

```yaml
      - uses: actions/setup-python@v6
        with:
          python-version: '3.14'
      - run: python -m pip install pytest==8.4.2 && python -m pytest python/tests -q
```

- [ ] **Step 3: Auditoria completa local**

Run: `npx eslint . && npx vitest run && python -m pytest python/tests -q && CERTIFICADO_SEGREDO=build-local npm run build`
Expected: tudo verde, build sem avisos.

No navegador (dev): axe-core (WCAG 2.2 AA + best-practice) em `#/`, `#/trilha`, `#/p/licao-ola`, `#/p/py-fizzbuzz` (antes e depois de Executar e Enviar), `#/livre`, `#/validar`, `#/acessibilidade`, `#/instrutor`, `#/novidades`, nos 4 temas e em 320 px. Expected: zero violações (exceto a recomendação `region` do VLibras, já conhecida).

- [ ] **Step 4: Pedir o "sim" do usuário**

Mostre o resumo (o que entra na 0.1.0, os testes, a auditoria) e pergunte se pode publicar. **Não siga sem o "sim".**

- [ ] **Step 5: Publicar (depois do "sim")**

```bash
gh repo create sertaoseracloud/python-playground --public --description "DivergePython: Python até PySpark no navegador, com dados em paralelo e acessibilidade para todas as pessoas" --homepage https://sertaoseracloud.github.io/python-playground/ --source . --push
gh api -X POST repos/sertaoseracloud/python-playground/pages -f build_type=workflow
```

O secret `CERTIFICADO_SEGREDO` precisa existir antes do primeiro deploy. Pergunte ao usuário se ele quer definir o valor (`gh secret set CERTIFICADO_SEGREDO -R sertaoseracloud/python-playground`, digitado por ele) ou se você gera um valor aleatório que ninguém vê (`openssl rand -hex 32 | gh secret set CERTIFICADO_SEGREDO -R sertaoseracloud/python-playground`). Avise que, se o secret mudar depois, os certificados emitidos até ali deixam de ser validados.

```bash
git tag -a v0.1.0 -m "Versão 0.1.0"
git push --follow-tags
gh release create v0.1.0 --verify-tag --title "v0.1.0 · DivergePython" --notes-file <notas>
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

- [ ] **Step 6: Conferir o site publicado**

Run: `curl -s https://sertaoseracloud.github.io/python-playground/ | grep -o "<title>[^<]*</title>"` e, no navegador, `#/p/py-ola`: Executar, Enviar, leitor de tela (`#anuncio`), `#/acessibilidade`, `pyodide/pyodide.asm.wasm` com status 200.
Expected: título do DivergePython; exercício aprovado com a solução; `pyodide.asm.wasm` servido pelo próprio site.
