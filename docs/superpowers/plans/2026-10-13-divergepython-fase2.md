# DivergePython fase 2 (📊 Python para dados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versão 0.2.0 do DivergePython com o módulo 📊 Python para dados (10 lições e 40 exercícios), arquivos de dados por exercício (aba 📦 Dados) e o certificado "Python para Dados".

**Architecture:** O runtime Python passa a limpar a pasta inteira entre execuções, devolver os arquivos que o programa gravou e materializar geradores (até 1000 itens) para a correção. Cada item e cada caso de teste pode ter `dados` (arquivos de entrada que o aluno não edita); os casos ocultos trocam esses arquivos. O conteúdo segue o formato da fase 1 (`py`, `main`, `assinatura` de `src/conteudo/util.js`).

**Tech Stack:** Pyodide 314.0.7 (Python 3.14), vitest 5 com `--experimental-wasm-jspi` (Node 24), pytest 8.4.2, happy-dom, axe-core 4.14.0, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-13-divergepython-design.md` (seções 6, 7, 8 e 11, fase 2)

## Global Constraints

- Versão publicada: **0.2.0** (`package.json` e `src/novidades.js`).
- Módulo `dados`: **40 exercícios** e **10 lições**; desbloqueio aos 70% do 🐍 Python básico (regra existente).
- Certificado emitido por "Sertão será cloud", assinado por "Cláudio Raposo"; carga horária pela regra: lição 10 min, fácil 15, médio 30, difícil 45, soma arredondada para cima em horas, mínimo 1 h.
- Dados pequenos, determinísticos, com tema brasileiro; os casos ocultos usam outros dados.
- Nada de data do dia (`date.today()`) nos exercícios: a data de referência vem por parâmetro.
- Todo texto em português do Brasil, com acentos; termos técnicos explicados com analogia (glossário).
- Acessibilidade: axe-core sem violações (WCAG 2.2 AA + best-practice) nos 4 temas, a 1280 px e 320 px.
- Publicação só depois do "sim" do usuário. Commits como "Cláudio Raposo" <engcfraposo@gmail.com>, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O valor de `CERTIFICADO_SEGREDO` nunca aparece no código nem no site (o secret já existe no repositório).

## Review Focus

- Um arquivo que o programa grava numa **subpasta** não pode sobrar para o próximo caso de teste: a pasta é limpa por inteiro (teste no pytest da Task 1).
- Uma função do aluno que devolve um **gerador infinito** não pode travar a correção: só os primeiros 1000 itens são lidos (teste no pytest da Task 1).
- Arquivo de dados com **acentos** (`Feijão`) lido com `open(nome)` sem `encoding`: precisa funcionar (teste no runtime da Task 1).
- O aluno cria um arquivo com o **mesmo nome** de um arquivo de dados: valem os dados do exercício (teste no `corrigir.test.js` da Task 2).
- CSV gravado com `csv.writer` termina as linhas com `\r\n`: a regra `arquivo` compara sem diferenciar `\r\n` de `\n` (teste no `verificacoes.test.js` da Task 2).

---

### Task 1: Runtime: pasta limpa, arquivos gerados e geradores

**Files:**
- Modify: `python/diverge_runtime/execucao.py`, `python/diverge_runtime/valores.py`
- Test: `python/tests/test_runtime.py`, `tests/runtime.test.js`

**Interfaces:**
- Produces: o resultado de `executar(...)` ganha `arquivos_gerados: { [nome]: texto }` (arquivos que não são `.py`, novos ou com conteúdo diferente do enviado; no máximo 20 arquivos e 100 000 caracteres cada). `descrever(gerador)` devolve a lista dos primeiros 1000 itens em `valor`.

- [ ] **Step 1: Testes que falham (pytest)**

Acrescente em `python/tests/test_runtime.py`:

```python
def test_subpasta_nao_sobra_entre_execucoes():
    execucao.executar({'main.py': 'import os\nos.makedirs("saida", exist_ok=True)\nopen("saida/x.txt", "w").write("1")\n'})
    r = execucao.executar({'main.py': 'import os\nprint(os.path.exists("saida/x.txt"))\n'})
    assert r['saida'] == 'False\n'


def test_arquivos_gerados():
    r = execucao.executar({
        'main.py': 'open("novo.csv", "w").write("a,b\\n")\nopen("dados.txt", "a").write("2")\n',
        'dados.txt': '1',
        'igual.txt': 'x',
    })
    assert r['arquivos_gerados'] == {'novo.csv': 'a,b\n', 'dados.txt': '12'}


def test_gerador_infinito_vira_lista_limitada():
    r = rodar('def contar():\n    n = 0\n    while True:\n        yield n\n        n += 1\n',
              chamadas=[{'funcao': 'contar', 'args': []}])
    assert r['retornos'][0]['valor'][:3] == [0, 1, 2]
    assert len(r['retornos'][0]['valor']) == 1000


def test_map_e_filter_viram_lista():
    assert descrever(map(str, [1, 2]))['valor'] == ['1', '2']
    assert descrever(filter(None, [0, 3]))['valor'] == [3]
```

Run: `python -m pytest -q`
Expected: FAIL nos quatro testes novos.

- [ ] **Step 2: Implementar**

`valores.py`, no começo de `para_json` (depois do limite de profundidade):

```python
import itertools
import types

LIMITE_ITENS = 1000
_PREGUICOSOS = (types.GeneratorType, map, filter, zip, enumerate, reversed)


def _preguicoso(valor):
    """Geradores e iteradores de map/filter/zip/itertools: a correção lê os primeiros itens."""
    return isinstance(valor, _PREGUICOSOS) or type(valor).__module__ == 'itertools'
```

e, dentro de `para_json`, antes de `return SEM_JSON` final:

```python
    if _preguicoso(valor):
        return para_json(list(itertools.islice(valor, LIMITE_ITENS)), profundidade + 1)
```

Atualize a docstring do módulo: "Geradores e iteradores viram lista (só os primeiros 1000 itens)".

`execucao.py`:

```python
import shutil

LIMITE_ARQUIVOS = 20


def _gravar(arquivos):
    shutil.rmtree(PASTA, ignore_errors=True)  # subpastas também: nada sobra da execução anterior
    os.makedirs(PASTA, exist_ok=True)
    for nome, fonte in arquivos.items():
        caminho = os.path.join(PASTA, nome)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(fonte)


def _gerados(arquivos):
    """Arquivos que o programa criou ou mudou (fora os .py), para as regras `arquivo`."""
    gerados = {}
    for raiz, _, nomes in os.walk(PASTA):
        for nome in sorted(nomes):
            caminho = os.path.join(raiz, nome)
            relativo = os.path.relpath(caminho, PASTA).replace(os.sep, '/')
            if relativo.endswith('.py') or len(gerados) >= LIMITE_ARQUIVOS:
                continue
            with open(caminho, encoding='utf-8', errors='replace') as f:
                texto = f.read(LIMITE_SAIDA)
            if arquivos.get(relativo) != texto:
                gerados[relativo] = texto
    return gerados
```

Em `executar`, depois de restaurar `stdout`/`cwd` no `finally`, inclua no retorno `'arquivos_gerados': _gerados(arquivos)`.

- [ ] **Step 3: Teste no Pyodide (vitest)**

Em `tests/runtime.test.js`, acrescente:

```js
  it('lê arquivo de dados com acento e devolve o arquivo que o programa gravou', async () => {
    const r = await sessao.executar({
      'main.py': 'linhas = open("vendas.csv").read().splitlines()\nprint(linhas[1])\nopen("saida.txt", "w").write("ok")\n',
      'vendas.csv': 'produto\nFeijão\n',
    });
    expect(r.saida).toBe('Feijão\n');
    expect(r.arquivos_gerados).toEqual({ 'saida.txt': 'ok' });
  });
```

Run: `python -m pytest -q && npx vitest run tests/runtime.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add python tests/runtime.test.js
git commit -m "Runtime: pasta limpa entre execuções, arquivos gerados e geradores na correção"
```

---

### Task 2: Dados por exercício, regra `arquivo` e aba 📦 Dados

**Files:**
- Create: `src/ui/dados.js`, `tests/dados-ui.test.js`
- Modify: `src/corrigir.js`, `src/verificacoes.js`, `src/ui/item.js`, `index.html`, `src/estilo.css`, `src/conteudo/trilha.js` (`LIVRE.dados`), `src/ui/tutorial-passos.js` (passo do enunciado cita a aba 📦 Dados)
- Test: `tests/corrigir.test.js`, `tests/verificacoes.test.js`, `tests/item-python.test.js`

**Interfaces:**
- Consumes: `arquivos_gerados` (Task 1).
- Produces: `item.dados` e `teste.dados` (`{ [nome]: texto }`); `corrigir` executa com `{ ...arquivos, ...problema.dados, ...teste.dados }`; `cenario.dados: string[]` (nomes dos arquivos trocados pelo caso); regras `{ arquivo, igual }` e `{ arquivo, json }`; `htmlDosDados(dados): string`.

- [ ] **Step 1: Testes que falham**

`tests/verificacoes.test.js`:

```js
  it('arquivo: compara o texto sem diferenciar \\r\\n e o JSON pelo valor', () => {
    const arquivos = { 'aprovados.csv': 'nome,nota\r\nAna,8\r\n', 'resumo.json': '{\n  "total": 2\n}' };
    expect(verificarRegra({ arquivo: 'aprovados.csv', igual: 'nome,nota\nAna,8' }, { arquivos }).ok).toBe(true);
    expect(verificarRegra({ arquivo: 'resumo.json', json: { total: 2 } }, { arquivos }).ok).toBe(true);
    const falta = verificarRegra({ arquivo: 'outro.csv', igual: 'x' }, { arquivos });
    expect(falta).toMatchObject({ ok: false, detalhe: 'o arquivo outro.csv não foi criado' });
    expect(categoriaDe({ arquivo: 'x', igual: '' })).toBe('Arquivo');
  });
```

`tests/corrigir.test.js`:

```js
  it('usa os dados do exercício e os do caso, que valem mais que um arquivo do aluno', async () => {
    const comDados = {
      dados: { 'n.txt': '1' },
      testes: [
        { descricao: 'padrão', regras: [{ saidaIgual: '1' }] },
        { descricao: 'outros', oculto: true, dados: { 'n.txt': '2' }, regras: [{ saidaIgual: '2' }] },
      ],
    };
    const aluno = { 'main.py': 'print(open("n.txt").read())', 'n.txt': '99' };
    const { aprovado, relatorio } = await corrigir(comDados, aluno, executar);
    expect(aprovado).toBe(true);
    expect(relatorio[1].cenario.dados).toEqual(['n.txt']);
  });
```

`tests/dados-ui.test.js`:

```js
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { htmlDosDados } from '../src/ui/dados.js';

describe('aba 📦 Dados', () => {
  it('CSV vira tabela com legenda e cabeçalho; aspas e vírgulas dentro de aspas funcionam', () => {
    const el = document.createElement('div');
    el.innerHTML = htmlDosDados({ 'vendas.csv': 'produto,preco\n"Arroz, 5kg",24.90\n' });
    expect(el.querySelector('caption').textContent).toContain('vendas.csv');
    expect([...el.querySelectorAll('th')].map((t) => t.textContent)).toEqual(['produto', 'preco']);
    expect(el.querySelector('td').textContent).toBe('Arroz, 5kg');
  });

  it('mostra até 50 linhas e avisa quantas faltam; outros arquivos vão em bloco de texto', () => {
    const csv = ['n', ...Array.from({ length: 60 }, (_, i) => String(i))].join('\n');
    const el = document.createElement('div');
    el.innerHTML = htmlDosDados({ 'muitos.csv': csv, 'pedidos.json': '[1]' });
    expect(el.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(el.textContent).toContain('e mais 10 linhas');
    expect(el.querySelector('pre').textContent).toBe('[1]');
  });
});
```

Em `tests/item-python.test.js`:

```js
  it('o livre mostra a aba 📦 Dados e envia os dados junto com o código', async () => {
    const { tela, pedidos } = montar({ saida: '', erro: null });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('aba-dados').hidden).toBe(false);
    expect(Object.keys(pedidos.at(-1).arquivos)).toContain('vendas.csv');
  });
```

e troque o motor falso de `montar` para guardar os arquivos: `executar: async (arquivos, opcoes) => { pedidos.push({ ...opcoes, arquivos }); ... }`.

Run: `npx vitest run tests/verificacoes.test.js tests/corrigir.test.js tests/dados-ui.test.js tests/item-python.test.js`
Expected: FAIL nos testes novos.

- [ ] **Step 2: Regra `arquivo` em `src/verificacoes.js`**

Na lista de regras do comentário do topo: `//   { arquivo: 'nome', igual | json }      o arquivo que o programa gravou`. Em `verificarRegra`, o contexto recebe `arquivos = {}` e, antes de `'funcao' in regra`:

```js
  if ('arquivo' in regra) {
    const texto = arquivos[regra.arquivo];
    if (texto === undefined) return res(regra, `O programa grava ${regra.arquivo}`, false, `o arquivo ${regra.arquivo} não foi criado`);
    if ('json' in regra) {
      let valor;
      try { valor = JSON.parse(texto); } catch { return res(regra, `${regra.arquivo} tem os dados pedidos`, false, `${regra.arquivo} não é um JSON válido`, texto.slice(0, 200)); }
      return res(regra, `${regra.arquivo} tem os dados pedidos`, iguais(valor, regra.json), `esperado ${json(regra.json)}, veio ${json(valor)}`, json(valor));
    }
    const [obtidas, esperadas] = [linhas(texto.replace(/\r\n/g, '\n')), linhas(regra.igual)];
    const i = esperadas.findIndex((l, n) => obtidas[n] !== l);
    const sobra = i < 0 && obtidas.length > esperadas.length;
    const detalhe = sobra ? `sobrou a linha ${esperadas.length + 1}: "${obtidas[esperadas.length]}"`
      : `linha ${i + 1}: esperado "${esperadas[i]}", veio ${obtidas[i] === undefined ? 'nada' : `"${obtidas[i]}"`}`;
    return res(regra, `${regra.arquivo} tem exatamente o conteúdo pedido`, i < 0 && !sobra, detalhe, texto.trimEnd());
  }
```

Em `CATEGORIAS`, acrescente `['arquivo', 'Arquivo']` antes de `['funcao', 'Função']`. Em `DICAS` (de `detalharRegra`), acrescente `arquivo: 'Confira o nome do arquivo, o cabeçalho e se cada linha termina como pedido. Abra o arquivo no terminal com print(open(nome).read()).'`.

- [ ] **Step 3: `src/corrigir.js`**

```js
    const dadosDoCaso = teste.dados ?? {};
    const r = await executar({ ...arquivos, ...(problema.dados ?? {}), ...dadosDoCaso }, { entrada: teste.entrada ?? [], chamadas });
    const resultados = teste.regras.map((regra) => detalharRegra(regra, {
      saida: r.saida, erro: r.erro, variaveis: r.variaveis, codigo, arquivos: r.arquivos_gerados ?? {},
      retorno: r.retornos?.[regrasDeFuncao.indexOf(regra)],
    }));
```

e no `cenario`: `dados: Object.keys(dadosDoCaso)`. A string `codigo` continua só com os arquivos do aluno.

- [ ] **Step 4: Aba 📦 Dados**

`src/ui/dados.js`:

```js
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
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
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
```

`index.html`, no grupo de abas da descrição, depois de `#aba-solucao`:

```html
            <button class="aba" data-desc="dados" id="aba-dados" role="tab" aria-selected="false" hidden>📦 Dados</button>
```

e o painel, depois de `#desc-solucao`:

```html
          <div class="conteudo-desc" id="desc-dados" role="tabpanel" aria-label="Arquivos de dados do exercício" hidden></div>
```

`src/ui/item.js`: `paineisDesc` ganha `dados: $('desc-dados')`; em `abrir`, `$('aba-dados').hidden = !item.dados; $('desc-dados').innerHTML = item.dados ? htmlDosDados(item.dados) : '';`; em `executar`, `motor.executar({ ...editor.arquivos, ...(item.dados ?? {}) }, ...)`; `linhasDoCenario` recebe `dados = []` e, se houver, começa com `# dados deste caso: ${ocultar ? 'outros arquivos' : dados.join(', ')}`; `cenarioDoTeste(t)` inclui `dados: Object.keys(t.dados ?? {})`.

`src/estilo.css`: `.tabela-dados { border-collapse: collapse; font-family: var(--fonte-codigo); font-size: 0.85rem; } .tabela-dados caption { text-align: left; font-weight: 700; padding: 6px 0; } .tabela-dados th, .tabela-dados td { border: 1px solid var(--linha); padding: 3px 8px; text-align: left; } .nota-dados { color: var(--suave); font-size: 0.85rem; } .titulo-dado { font-size: 1rem; }` (a `.tabela-rolagem` já existe no CSS herdado; confira e, se não existir, `overflow-x: auto`).

`src/conteudo/trilha.js`, no `LIVRE`: `dados: { 'vendas.csv': 'produto,regiao,quantidade,preco\nArroz 5kg,Nordeste,2,24.90\nFeijão 1kg,Sudeste,3,8.50\nCafé 500g,Nordeste,1,19.90\nRapadura,Norte,10,2.50\n' }` e, no `resumo`, um parágrafo: `<p>Na aba <b>📦 Dados</b> há um <code>vendas.csv</code> de exemplo: abra com <code>open("vendas.csv")</code>.</p>`.

`src/ui/tutorial-passos.js`, passo "O enunciado": "Na aba <b>📦 Dados</b> (quando houver) ficam os arquivos que o programa lê, e na aba <b>Solução</b>, a resposta, para quando você travar."

- [ ] **Step 5: Rodar**

Run: `npx vitest run && npx eslint .`
Expected: PASS (inclusive `acessibilidade-telas`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Dados por exercício: aba 📦 Dados, casos com outros dados e regra de arquivo"
```

---

### Task 3: Módulo 📊 Python para dados — lições e exercícios 1 a 20

**Files:**
- Create: `src/conteudo/dados.js` (`moduloDados`, lições e exercícios 1–20)
- Modify: `src/conteudo/trilha.js` (`modulos = [moduloBasico, moduloDados]`; `PROXIMOS_MODULOS` sem `dados`), `tests/conteudo.test.js`

**Interfaces:**
- Consumes: `py`, `main`, `assinatura` (`src/conteudo/util.js`); regras da Task 2.
- Produces: `moduloDados = { id: 'dados', titulo: 'Python para dados', icone: '📊', descricao: 'Comprehensions, tuplas, conjuntos, ordenação, Counter, CSV, JSON, datas, geradores e itertools.', itens }`.

- [ ] **Step 1: Testes de conteúdo**

Em `tests/conteudo.test.js`: troque o teste de estrutura por um por módulo:

```js
  it.each([['basico', 40, 10], ['dados', 40, 10]])('o módulo %s tem %i exercícios e %i lições', (id, exercicios, licoes) => {
    const m = modulos.find((x) => x.id === id);
    expect(m.itens.filter((i) => i.tipo === 'problema')).toHaveLength(exercicios);
    expect(m.itens.filter((i) => i.tipo === 'licao')).toHaveLength(licoes);
  });

  it('ids únicos na trilha toda', () => {
    expect(new Set(itens.map((i) => i.id)).size).toBe(itens.length);
  });
```

e as lições rodam com os dados: `executar({ ...l.arquivos, ...(l.dados ?? {}) }, { entrada: ... })`.

Run: `npx vitest run tests/conteudo.test.js`
Expected: FAIL ("dados" não existe).

- [ ] **Step 2: As 10 lições**

Cada lição: `resumo` com 2 a 4 parágrafos curtos, um exemplo e uma analogia; `arquivos` com um `main.py` que roda sem erro.

| id | título | o `main.py` mostra |
| --- | --- | --- |
| `licao-comprehensions` | Comprehensions | lista, dicionário e conjunto por compreensão, com `if` |
| `licao-tuplas` | Tuplas e desempacotamento | `x, y = ponto`, `zip`, `enumerate(start=1)`, devolver duas coisas |
| `licao-conjuntos` | Conjuntos | `set`, `&`, `|`, `-`, `^`, `in` rápido |
| `licao-ordenacao` | Ordenar com key | `sorted(..., key=lambda)`, `reverse`, chave dupla `(-nota, nome)`, `max(key=)` |
| `licao-collections` | Counter e defaultdict | `Counter.most_common`, `defaultdict(list)` |
| `licao-csv` | Ler e gravar CSV | `csv.DictReader` de `exemplo.csv` e `csv.writer`; a lição leva `dados: { 'exemplo.csv': 'cidade,uf,habitantes\nPetrolina,PE,386791\nJuazeiro,BA,237821\nSobral,CE,212437\n' }` |
| `licao-json` | JSON | `json.load` de `exemplo.json`, `json.dumps(indent=2, ensure_ascii=False)`; `dados: { 'exemplo.json': '{"curso": "Python", "alunos": ["Ana", "Bia"]}' }` |
| `licao-datas` | Datas com datetime | `date.fromisoformat`, subtração dá `timedelta`, `weekday()`, `strftime("%d/%m/%Y")`; nome do dia da semana por lista em português (o `%A` sai em inglês) |
| `licao-geradores` | Geradores | `yield`, `next`, gerador infinito com `itertools.islice`, por que economiza memória |
| `licao-funcional` | map, filter, reduce e itertools | `map`, `filter`, `functools.reduce`, `itertools.combinations`, `accumulate`, `groupby` |

- [ ] **Step 3: Exercícios 1 a 20**

Mesmo formato da fase 1: `arquivos` = código inicial que não passa (para função, `assinatura(...)`), `solucao`, `dica` de uma linha, `enunciado` em HTML com um exemplo. Nos testes, tuplas são comparadas como listas (o runtime converte). Ordem na trilha: a lição do assunto e, depois, os exercícios dele.

| # | id | título | dif. | o que pede | solução de referência | visíveis | ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `dd-quadrados` | Quadrados | fácil | `quadrados(n)` → `[1, 4, …, n²]` com compreensão | `return [i * i for i in range(1, n + 1)]` | `[4] → [1,4,9,16]`; `codigo '\\[.+ for .+ in .+\\]'` | `[0] → []`; `[1] → [1]` |
| 2 | `dd-notas-aprovadas` | Notas aprovadas | fácil | `notas_aprovadas(notas)` → notas ≥ 7, na ordem | `return [n for n in notas if n >= 7]` | `[[5,7,9.5,6.9]] → [7,9.5]` | `[[]] → []`; `[[10]] → [10]` |
| 3 | `dd-desconto` | Preços com desconto | médio | `precos_com_desconto(precos, pct)` → dicionário com o preço menos `pct`%, 2 casas | `return {p: round(v * (100 - pct) / 100, 2) for p, v in precos.items()}` | `[{"arroz":10,"feijão":8},10] → {"arroz":9,"feijão":7.2}` | `[{},5] → {}`; `[{"café":19.9},50] → {"café":9.95}` |
| 4 | `dd-transpor` | Transpor matriz | difícil | `transpor(m)`: linhas viram colunas | `return [list(c) for c in zip(*m)]` | `[[[1,2,3],[4,5,6]]] → [[1,4],[2,5],[3,6]]` | `[[[1]]] → [[1]]`; `[[]] → []` |
| 5 | `dd-min-max` | Menor e maior | fácil | `min_max(lista)` → tupla `(menor, maior)` | `return min(lista), max(lista)` | `[[3,1,2]] → [1,3]` | `[[5]] → [5,5]`; `[[-2,8,0]] → [-2,8]` |
| 6 | `dd-ponto-distante` | Ponto mais distante | médio | `mais_distante(pontos)` → o ponto `(x, y)` mais longe da origem (o primeiro, se empatar) | `return tuple(max(pontos, key=lambda p: p[0] ** 2 + p[1] ** 2))` | `[[[1,1],[3,4],[0,2]]] → [3,4]` | `[[[0,0]]] → [0,0]`; `[[[-5,0],[3,3]]] → [-5,0]` |
| 7 | `dd-boletim` | Boletim com zip | fácil | `boletim(nomes, notas)` → dicionário nome → nota | `return dict(zip(nomes, notas))` | `[["Ana","Bia"],[8,9]] → {"Ana":8,"Bia":9}` | `[[],[]] → {}`; `[["Caio"],[5.5]] → {"Caio":5.5}` |
| 8 | `dd-numerar` | Lista numerada | fácil | `numerar(itens)` → `["1. arroz", "2. feijão"]` com `enumerate` | `return [f"{i}. {item}" for i, item in enumerate(itens, start=1)]` | `[["arroz","feijão"]] → ["1. arroz","2. feijão"]`; `codigo 'enumerate'` | `[[]] → []`; `[["café"]] → ["1. café"]` |
| 9 | `dd-em-comum` | Em comum | fácil | `em_comum(a, b)` → itens dos dois, em ordem crescente | `return sorted(set(a) & set(b))` | `[[1,2,3],[2,3,4]] → [2,3]` | `[[1],[2]] → []`; `[["pe","ba","sp"],["ba","pe"]] → ["ba","pe"]` |
| 10 | `dd-so-em-um` | Só em um dos dois | médio | `so_em_um(a, b)` → itens que estão em só uma das listas, ordenados | `return sorted(set(a) ^ set(b))` | `[[1,2,3],[3,4]] → [1,2,4]` | `[[],[]] → []`; `[["a"],["a"]] → []` |
| 11 | `dd-letra-repetida` | Letra repetida | fácil | `tem_repetida(palavra)` (maiúscula e minúscula são diferentes) | `return len(set(palavra)) != len(palavra)` | `["sertão"] → false`; `["arara"] → true` | `[""] → false`; `["Aa"] → false` |
| 12 | `dd-cidades-novas` | Cidades novas | médio | `cidades_novas(visitadas, roteiro)` → cidades do roteiro ainda não visitadas, na ordem do roteiro, sem repetir | conjunto `vistas` começando com `set(visitadas)` e laço no roteiro | `[["Recife"],["Recife","Natal","Natal","Caruaru"]] → ["Natal","Caruaru"]` | `[[],[]] → []`; `[["Sobral"],["Crato","Sobral","Crato"]] → ["Crato"]` |
| 13 | `dd-ranking` | Ranking | médio | `ranking(alunos)` (lista de `[nome, nota]`) → nomes da maior para a menor nota; empate em ordem alfabética | `return [n for n, _ in sorted(alunos, key=lambda a: (-a[1], a[0]))]` | `[[["Ana",8],["Bia",9],["Caio",8]]] → ["Bia","Ana","Caio"]` | `[[]] → []`; `[[["Zé",7],["Al",7]]] → ["Al","Zé"]` |
| 14 | `dd-por-tamanho` | Por tamanho | fácil | `por_tamanho(palavras)` → da menor para a maior; mesmo tamanho em ordem alfabética | `return sorted(palavras, key=lambda p: (len(p), p))` | `[["umbu","caju","pequi","ata"]] → ["ata","caju","umbu","pequi"]` | `[[]] → []`; `[["bb","a","aa"]] → ["a","aa","bb"]` |
| 15 | `dd-mais-populosa` | Mais populosa | fácil | `mais_populosa(cidades)` (nome → habitantes) → o nome; vazio → `None` | `return max(cidades, key=cidades.get) if cidades else None` | `[{"Petrolina":386791,"Juazeiro":237821}] → "Petrolina"` | `[{}] → null`; `[{"Sobral":212437}] → "Sobral"` |
| 16 | `dd-ordenar-datas` | Datas em ordem | médio | `ordenar_datas(datas)` (`"dd/mm/aaaa"`) → da mais antiga para a mais nova | `return sorted(datas, key=lambda d: (d[6:], d[3:5], d[:2]))` | `[["10/02/2024","01/12/2023","05/02/2024"]] → ["01/12/2023","05/02/2024","10/02/2024"]` | `[[]] → []`; `[["31/12/1999","01/01/2000"]] → ["31/12/1999","01/01/2000"]` |
| 17 | `dd-vencedor` | Votação | médio | `vencedor(votos)` → o mais votado; empate: o primeiro em ordem alfabética; sem votos → `None` | `c = Counter(votos)`; `return min(c, key=lambda v: (-c[v], v)) if c else None` | `[["umbu","caju","umbu"]] → "umbu"`; `codigo 'Counter'` | `[["b","a"]] → "a"`; `[[]] → null` |
| 18 | `dd-top3-produtos` | Três mais vendidos | difícil | `top3(pedidos)` (lista de `[produto, qtd]`) → `[[produto, total]]` dos 3 maiores totais; empate em ordem alfabética | somar num `Counter` e `sorted(c.items(), key=lambda p: (-p[1], p[0]))[:3]`, em listas | `[[["arroz",2],["feijão",1],["arroz",1],["café",5],["milho",1]]] → [["café",5],["arroz",3],["feijão",1]]` | `[[]] → []`; `[[["x",1]]] → [["x",1]]` |
| 19 | `dd-agrupar-uf` | Cidades por estado | médio | `agrupar(cidades)` (lista de `[cidade, uf]`) → `{uf: [cidades em ordem alfabética]}`, com as UFs em ordem alfabética | `defaultdict(list)`, depois `{uf: sorted(v) for uf, v in sorted(g.items())}` | `[[["Sobral","CE"],["Petrolina","PE"],["Crato","CE"]]] → {"CE":["Crato","Sobral"],"PE":["Petrolina"]}`; `codigo 'defaultdict'` | `[[]] → {}`; `[[["Natal","RN"]]] → {"RN":["Natal"]}` |
| 20 | `dd-indice-invertido` | Índice invertido | difícil | `indice(frases)` → `{palavra: [índices das frases]}`, palavras em minúsculas, sem repetir índice, chaves em ordem alfabética | `defaultdict(list)`; para cada `i, frase` e cada palavra de `set(frase.lower().split())`, `append(i)`; ordenar chaves | `[["Sol e mar","mar azul"]] → {"azul":[1],"e":[0],"mar":[0,1],"sol":[0]}` | `[[]] → {}`; `[["a a"]] → {"a":[0]}` |

`Counter` e `defaultdict` vêm de `from collections import Counter, defaultdict` na solução; o código inicial dos exercícios 17 a 20 já traz esse import.

- [ ] **Step 4: Trilha e testes**

`src/conteudo/trilha.js`: `import { moduloDados } from './dados.js'`; `modulos = [moduloBasico, moduloDados]`; tire `dados` de `PROXIMOS_MODULOS`.

Run: `npx vitest run tests/conteudo.test.js -t "dd-"`
Expected: os 20 exercícios passam nos dois testes (solução aprova, código inicial reprova). O teste "dados tem 40 exercícios" falha até a Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/conteudo tests/conteudo.test.js
git commit -m "Python para dados: 10 lições e exercícios 1 a 20"
```

---

### Task 4: Módulo 📊 Python para dados — exercícios 21 a 40 e glossário

**Files:**
- Create: `src/conteudo/dados-arquivos.js` (exercícios 21–40, exportados em blocos `exerciciosCsv`, `exerciciosJson`, `exerciciosDatas`, `exerciciosIteradores`)
- Modify: `src/conteudo/dados.js` (espalha os blocos depois das lições), `src/conteudo/glossario.js`

**Interfaces:**
- Consumes: `item.dados`, `teste.dados`, regra `arquivo` (Task 2); geradores materializados (Task 1).

- [ ] **Step 1: Exercícios 21 a 40**

Arquivos de dados (`dados` do exercício = casos visíveis; `dados` do caso oculto = outros arquivos). Nos exercícios de arquivo, o código inicial é `import csv` (ou `import json`) e um comentário, que não imprime nada.

| # | id | título | dif. | o que pede | dados visíveis | resultado visível | casos ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 21 | `dd-csv-total` | Total das vendas | fácil | ler `vendas.csv` (`produto,quantidade,preco_unitario`) e mostrar `Total: <valor com 2 casas>` | `Arroz 5kg,2,24.90` · `Feijão 1kg,3,8.50` · `Café 500g,1,19.90` | `saidaIgual 'Total: 95.20'`; `codigo 'csv\\.'` | `Farinha de mandioca,4,6.75` · `Rapadura,10,2.50` → `'Total: 52.00'`; só o cabeçalho → `'Total: 0.00'` |
| 22 | `dd-csv-por-regiao` | Vendas por região | médio | ler `vendas.csv` (`regiao,valor`) e mostrar `Região: total` (2 casas), regiões em ordem alfabética | `Nordeste,1000.50` · `Sudeste,800` · `Nordeste,499.50` · `Norte,120` | `saidaIgual 'Nordeste: 1500.00\nNorte: 120.00\nSudeste: 800.00'` | `Sul,10` · `Centro-Oeste,5.25` · `Sul,0.75` → `'Centro-Oeste: 5.25\nSul: 10.75'` |
| 23 | `dd-csv-aprovados` | Gravar os aprovados | médio | ler `alunos.csv` (`nome,nota`) e gravar `aprovados.csv` com o mesmo cabeçalho e só as linhas com nota ≥ 7, na ordem | `Ana,8.5` · `Bia,6` · `Caio,7` | `arquivo 'aprovados.csv' igual 'nome,nota\nAna,8.5\nCaio,7'` | `Davi,6.9` → `'nome,nota'`; `José,9.0` · `Íris,10` → `'nome,nota\nJosé,9.0\nÍris,10'` |
| 24 | `dd-csv-media-coluna` | Média de uma coluna | médio | `media_coluna(caminho, coluna)` → média da coluna do CSV, 2 casas | `notas.csv`: `aluno,matematica,portugues` · `Ana,8,9.5` · `Bia,7,6` · `Caio,9,8` | `funcao ['notas.csv','matematica'] → 8`; `['notas.csv','portugues'] → 7.83` | `Davi,10,4` · `Eva,5,5` → `matematica 7.5`, `portugues 4.5` |
| 25 | `dd-csv-invalidas` | Linhas inválidas | difícil | `linhas_invalidas(caminho)`: arquivo **sem cabeçalho** (`sensor,valor`); conta linhas com campo vazio ou valor que não é número; linhas vazias não contam | `leituras.csv`: `s1,22.5` · `s2,` · `s3,abc` · `s4,19` | `funcao ['leituras.csv'] → 2` | `s1,1` → `0`; `,` · (linha vazia) · `x,1` → `1` |
| 26 | `dd-json-pedidos` | Total por cliente | médio | ler `pedidos.json` e mostrar `Cliente: total` (2 casas), clientes em ordem alfabética | `[{"cliente":"Bia","itens":[{"produto":"Café","preco":19.9,"qtd":2}]},{"cliente":"Ana","itens":[{"produto":"Arroz","preco":24.9,"qtd":1},{"produto":"Feijão","preco":8.5,"qtd":2}]},{"cliente":"Bia","itens":[{"produto":"Milho","preco":3,"qtd":1}]}]` | `saidaIgual 'Ana: 41.90\nBia: 42.80'`; `codigo 'json\\.'` | `[]` → `saidaIgual ''`; `[{"cliente":"Zé","itens":[]}]` → `'Zé: 0.00'` |
| 27 | `dd-json-resumo` | Gravar um resumo | difícil | ler `pedidos.json` (mesmo formato) e gravar `resumo.json` com `total_pedidos`, `clientes` (sem repetir, em ordem) e `faturamento` (2 casas) | os mesmos do 26 | `arquivo 'resumo.json' json {"total_pedidos":3,"clientes":["Ana","Bia"],"faturamento":84.7}` | `[]` → `{"total_pedidos":0,"clientes":[],"faturamento":0}` |
| 28 | `dd-json-caminho` | Navegar no JSON | difícil | `valor(dados, caminho)`: caminho como `"a.b.0"` (número = posição na lista); se não existir, `None` | — | `[{"a":{"b":[10,20]}},"a.b.1"] → 20` | `[{"x":1},"y"] → null`; `[{"lista":[{"nome":"Ana"}]},"lista.0.nome"] → "Ana"`; `[{"a":[1]},"a.5"] → null` |
| 29 | `dd-json-valido` | JSON válido? | fácil | `eh_json_valido(texto)` com `try/except` | — | `['{"a": 1}'] → true`; `["{a: 1}"] → false`; `codigo 'except'` | `[""] → false`; `["[1, 2]"] → true` |
| 30 | `dd-idade` | Idade | médio | `idade(nascimento, hoje)` (datas `AAAA-MM-DD`) → anos completos | `date.fromisoformat`; subtrair 1 se `(hoje.month, hoje.day) < (nasc.month, nasc.day)` | `["2000-10-13","2026-10-13"] → 26` | `["2000-10-14","2026-10-13"] → 25`; `["2004-02-29","2025-02-28"] → 20` |
| 31 | `dd-dias-entre` | Dias entre datas | fácil | `dias_entre(a, b)` → quantos dias (sempre positivo) | `return abs((date.fromisoformat(b) - date.fromisoformat(a)).days)` | `["2026-01-01","2026-03-01"] → 59` | `["2024-03-01","2024-02-01"] → 29`; `["2026-10-13","2026-10-13"] → 0` |
| 32 | `dd-data-extenso` | Data por extenso | médio | `por_extenso(iso)` → `"terça-feira, 13/10/2026"` | lista `DIAS = ["segunda-feira", …, "domingo"]` com `weekday()` e `strftime("%d/%m/%Y")` | `["2026-10-13"] → "terça-feira, 13/10/2026"` | `["2026-10-17"] → "sábado, 17/10/2026"`; `["2000-01-01"] → "sábado, 01/01/2000"` |
| 33 | `dd-contas-vencidas` | Contas vencidas | médio | `vencidas(contas, hoje)` (lista de `[nome, "AAAA-MM-DD"]`) → nomes vencidos antes de `hoje`, da mais antiga para a mais nova (empate: alfabética) | filtrar `venc < hoje` (texto ISO compara certo) e ordenar por `(venc, nome)` | `[[["luz","2026-10-10"],["água","2026-10-20"],["internet","2026-10-01"]],"2026-10-13"] → ["internet","luz"]` | `[[],"2026-01-01"] → []`; `[[["b","2026-01-01"],["a","2026-01-01"]],"2026-01-02"] → ["a","b"]` |
| 34 | `dd-dia-util` | Próximo dia útil | médio | `proximo_dia_util(iso)`: sábado e domingo passam para a segunda; dia de semana fica igual | somar `timedelta(days=…)` conforme `weekday()` | `["2026-10-17"] → "2026-10-19"` | `["2026-10-18"] → "2026-10-19"`; `["2026-10-13"] → "2026-10-13"` |
| 35 | `dd-gerador-pares` | Gerador de pares | fácil | `pares(limite)`: gerador com `yield` dos pares de 0 até `limite` (inclusive) | `for n in range(0, limite + 1, 2): yield n` | `[6] → [0,2,4,6]`; `codigo 'yield'` | `[0] → [0]`; `[-1] → []`; `[7] → [0,2,4,6]` |
| 36 | `dd-lotes` | Em lotes | médio | `lotes(itens, tamanho)`: gerador de listas com até `tamanho` itens | `for i in range(0, len(itens), tamanho): yield itens[i:i + tamanho]` | `[[1,2,3,4,5],2] → [[1,2],[3,4],[5]]`; `codigo 'yield'` | `[[],3] → []`; `[[1,2],5] → [[1,2]]` |
| 37 | `dd-fibonacci` | Fibonacci sem fim | difícil | `fibonacci()` gerador infinito e `primeiros(n)` → lista com os `n` primeiros, usando `islice` | `a, b = 0, 1` / `while True: yield a; a, b = b, a + b`; `return list(islice(fibonacci(), n))` | `primeiros [8] → [0,1,1,2,3,5,8,13]`; `codigo 'yield'`; `codigo 'islice'` | `[0] → []`; `[1] → [0]` |
| 38 | `dd-map-filter` | Positivos em dobro | fácil | `positivos_dobrados(numeros)` com `filter` e `map` | `return list(map(lambda x: x * 2, filter(lambda x: x > 0, numeros)))` | `[[3,-1,0,5]] → [6,10]`; `codigo 'map\\('`; `codigo 'filter\\('` | `[[]] → []`; `[[-2]] → []`; `[[0.5]] → [1]` |
| 39 | `dd-reduce` | Produto com reduce | médio | `produto(lista)` com `functools.reduce`; vazia → 1 | `return reduce(lambda a, b: a * b, lista, 1)` | `[[2,3,4]] → 24`; `codigo 'reduce\\('` | `[[]] → 1`; `[[5]] → 5` |
| 40 | `dd-duplas` | Todas as duplas | médio | `duplas(nomes)` → `"Ana & Bia"` para cada par, na ordem da lista, com `itertools.combinations` | `return [f"{a} & {b}" for a, b in combinations(nomes, 2)]` | `[["Ana","Bia","Caio"]] → ["Ana & Bia","Ana & Caio","Bia & Caio"]`; `codigo 'combinations'` | `[["Zé"]] → []`; `[[]] → []` |

O `·` separa as linhas de dados; cada CSV começa pela linha de cabeçalho da coluna "o que pede" (o 25 não tem cabeçalho). Nos exercícios 24, 25 e 28 a 40, os dados chegam pelos argumentos ou pelo arquivo indicado no argumento; o oculto troca o arquivo pelo `dados` do caso.

- [ ] **Step 2: Glossário**

Em `src/conteudo/glossario.js`, depois do bloco do Python básico, um bloco `// ---------- Python para dados ----------` com `INICIO_DO_NIVEL.dados = 'comprehension'` e os termos (formato existente: `id, termo, padroes, definicao, analogia, exemplo`): `comprehension` (Compreensão de lista), `tupla-desempacotar` (Desempacotar), `counter` (Counter), `defaultdict`, `csv` (CSV), `json-termo` (JSON), `datetime` (Datas com datetime), `gerador` (Gerador e yield), `lambda`, `map-filter` (map e filter), `reduce`, `itertools`. Confira antes se o id `tupla` ou `conjunto` já existe e reaproveite.

- [ ] **Step 3: Rodar**

Run: `npx vitest run tests/conteudo.test.js && npx eslint .`
Expected: PASS, inclusive "dados tem 40 exercícios e 10 lições".

- [ ] **Step 4: Commit**

```bash
git add src/conteudo
git commit -m "Python para dados: exercícios 21 a 40 (CSV, JSON, datas, geradores, itertools) e glossário"
```

---

### Task 5: Certificado, badge, trilha, versão 0.2.0 e publicação

**Files:**
- Modify: `src/certificados.js`, `src/badges.js`, `src/novidades.js`, `package.json`, `README.md`, `src/ui/declaracao-acessibilidade.js` (data), `public/` (via `npm run badges`)
- Test: os herdados (`certificados`, `badges`, `carga-horaria`, `landing`, `gamificacao`) — com dois módulos, os testes de cadeia voltam a rodar

- [ ] **Step 1: Certificado e badge**

`CERTIFICADOS.dados = { titulo: 'Python para Dados', cargaHoraria: 20, resumo: 'concluiu o módulo Python para dados, resolvendo os 40 problemas práticos', hashtags: ['Python', 'Dados'], conteudos: ['Comprehensions, tuplas e conjuntos', 'Ordenação, Counter e defaultdict', 'CSV, JSON e datas', 'Geradores, map, filter e itertools'] }`. A carga é 20 h: 10 lições × 10 min + 14 fáceis × 15 + 19 médios × 30 + 7 difíceis × 45 = 1195 min (19,9 h, arredondado para cima). Confira com `horasDosItens(modulos[1].itens)` de `src/cargaHoraria.js`.

`BADGES.dados = { cor: '#8be9fd', simbolo: '{ }', faixa: 'DADOS' }` (ciano, como o card da landing). `tests/carga-horaria.test.js`: acrescente o caso do `dados` igual ao do `basico`.

Run: `npm run badges && npx vitest run`
Expected: PASS; os testes de cadeia (`landing`, `certificados`) rodam (não ficam mais "skipped") e passam; `public/badges/dados.png` e `dados-card.png` gerados; a capa mostra "80 exercícios".

- [ ] **Step 2: Versão e textos**

`package.json`: `"version": "0.2.0"`. `src/novidades.js`, nova entrada no topo:

```js
  {
    versao: '0.2.0',
    data: '2026-10-13', // a data do dia da publicação
    titulo: 'Python para dados',
    resumo: 'O segundo módulo da trilha: dados de verdade em CSV e JSON, datas, geradores e itertools.',
    grupos: [
      { titulo: '📊 Python para dados', itens: ['10 lições e 40 exercícios: compreensões, tuplas, conjuntos, ordenação, Counter, CSV, JSON, datas, geradores, map, filter, reduce e itertools.', 'Certificado Python para Dados.'] },
      { titulo: '📦 Aba Dados', itens: ['Os arquivos de cada exercício aparecem numa tabela acessível; os casos ocultos usam outros dados.', 'O playground livre ganhou um vendas.csv de exemplo.'] },
      { titulo: '✅ Correção', itens: ['Exercícios que gravam arquivos são conferidos pelo conteúdo do arquivo.', 'Funções que devolvem geradores também são corrigidas.'] },
    ],
  },
```

`README.md`: o módulo 📊 sai de "Em breve" e entra em "O que tem"; a regra `arquivo` e o campo `dados` entram em "Como adicionar conteúdo"; a aba 📦 Dados na lista de recursos.

- [ ] **Step 3: Auditoria**

Run: `npx eslint . && npx vitest run && python -m pytest -q && CERTIFICADO_SEGREDO=<valor aleatório descartável> npm run build`
Expected: tudo verde, build sem avisos.

No navegador (build + preview): axe-core em `#/`, `#/trilha`, `#/p/licao-csv`, `#/p/dd-csv-total` (antes e depois de Executar e Enviar, com a aba 📦 Dados aberta), `#/p/dd-json-resumo`, `#/livre`, nos 4 temas a 1280 px e a 320 px. Expected: zero violações, sem rolagem horizontal.

- [ ] **Step 4: Pedir o "sim"**

Mostre o resumo (o que entra na 0.2.0, testes e auditoria) e pergunte se pode publicar. Não siga sem o "sim".

- [ ] **Step 5: Publicar (depois do "sim")**

```bash
git push origin main
gh run watch $(gh run list -R sertaoseracloud/python-playground --limit 1 --json databaseId -q '.[0].databaseId') -R sertaoseracloud/python-playground --exit-status
git tag -a v0.2.0 -m "Versão 0.2.0"
git push --follow-tags
gh release create v0.2.0 -R sertaoseracloud/python-playground --verify-tag --title "v0.2.0 · Python para dados" --notes-file ../notas-0.2.0.md
```

`../notas-0.2.0.md` (fora do repositório): título "Python para dados" e os três grupos da entrada 0.2.0 em Markdown.

- [ ] **Step 6: Conferir o site publicado**

`curl -s https://sertaoseracloud.github.io/python-playground/ | grep -o "80 exercícios"` e, no navegador, `#/p/dd-csv-total`: aba 📦 Dados com a tabela, Executar, Enviar com a solução → "Aceito! 🎉".
