# DivergePython fase 3 (⚡ Paralelismo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versão 0.3.0 com `multiprocessing` e `concurrent.futures` de verdade sobre o pool de workers, `asyncio` e o módulo ⚡ Paralelismo (10 lições e 35 exercícios), com a regra de correção `paralelo`.

**Architecture:** O pool de workers (já real) ganha tarefas avulsas (`submeter`), que devolvem uma promessa; o Python do aluno espera com `run_sync` (JSPI). Um pacote `diverge_paralelo` implementa `Pool`, `Process`, `Queue`, `ProcessPoolExecutor` e `as_completed` sobre essa ponte e é instalado em `sys.modules` só durante a execução do aluno. Cada tarefa devolve o valor (ou a exceção), o que imprimiu e o que pôs em filas; o runtime conta tarefas e workers usados (`paralelismo`), e a regra `paralelo` confere quantos workers trabalharam, nunca o tempo.

**Tech Stack:** Pyodide 314.0.7 (Python 3.14) com JSPI, cloudpickle 3.1.1, Web Workers / `worker_threads` nos testes, vitest 5 (Node 24, `--experimental-wasm-jspi`), pytest 8.4.2.

**Spec:** `docs/superpowers/specs/2026-10-13-divergepython-design.md` (seções 3.2, 3.3, 4, 6, 7 e 11, fase 3)

## Global Constraints

- Versão publicada: **0.3.0**. Módulo `paralelismo`: **35 exercícios** e **10 lições**; abre com 70% do 📊 Python para dados.
- Paralelismo real: nada de relógio virtual. Sem JSPI, as tarefas rodam em sequência no worker principal, com o mesmo resultado, e o site avisa.
- Regra mantida do Python real: sem `if __name__ == "__main__":`, criar `Pool`, iniciar `Process` ou enviar ao `ProcessPoolExecutor` dá o `RuntimeError` do Python real (início spawn).
- Threads: `threading.Thread.start()` e `ThreadPoolExecutor` dão o erro do próprio Pyodide (`RuntimeError: can't start new thread`); a concorrência de I/O é ensinada com `asyncio`, que roda de verdade (conferido: `gather` perde atualizações sem `Lock`).
- `multiprocessing.Value`/`Array` ficam como conceito (precisam de SharedArrayBuffer, que o GitHub Pages não libera): levantam `NotImplementedError` com a explicação.
- A regra `paralelo` confere quantos workers rodaram tarefas, nunca o tempo.
- Pool: até `min(4, núcleos − 1)` workers, abertos sob demanda; fecha os ociosos depois de 60 s.
- Certificado da Sertão será cloud, assinado por Cláudio Raposo; carga pela regra (lição 10, fácil 15, médio 30, difícil 45 min; arredonda para cima).
- Publicação só depois do "sim" do usuário; commits como "Cláudio Raposo" <engcfraposo@gmail.com> com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Uma função do aluno definida em **outro arquivo** (`funcoes.py`) e usada no `Pool.map` precisa funcionar no worker (o worker não tem os arquivos do aluno): os módulos do aluno são serializados por valor (teste no `paralelo.test.js` da Task 2).
- `print` dentro da função que roda no worker tem de aparecer no 🖥️ Terminal (teste no `pool.test.js` da Task 1).
- Uma exceção na função do worker sobe no processo principal com o mesmo tipo e mensagem, como no Python real (teste no `pool.test.js` da Task 1).
- `fila.get()` com a fila vazia e nenhum processo para preencher: no Python real o programa ficaria parado para sempre; aqui sai um erro que explica isso, em vez de travar até o limite de 10 s (teste no pytest da Task 2).
- `Pool` criado dentro de uma função chamada **de dentro** do `if __name__ == "__main__":` funciona; o mesmo `Pool` no nível do módulo, fora do bloco, dá o `RuntimeError` (teste no pytest da Task 2).

---

### Task 1: Pool com tarefas avulsas, saída e erros do worker e métricas

**Files:**
- Create: `python/diverge_runtime/tarefa.py`
- Modify: `src/python/pool.js`, `src/python/sessao.js`, `src/python/tarefa.js`, `src/python/worker.js`, `src/python/worker-tarefa.js`, `tests/worker-tarefa-node.js`, `python/diverge_runtime/pool.py`, `python/diverge_runtime/execucao.py`
- Create: `tests/pool-node.js` (o `workerNode` que hoje está em `tests/pool.test.js`)
- Test: `tests/pool.test.js`, `python/tests/test_runtime.py`

**Interfaces:**
- Produces (JS): `new PoolPython({ criarWorker, maximo, aoAbrir, ociosoMs = 60000 })`; `pool.submeter(tarefa: Uint8Array) → Promise<{ resultado: Uint8Array, worker: number }>`; `pool.mapear(tarefas) → Promise<{ resultados, tarefas: [{ worker }] }>` (mantido, sobre `submeter`); `pool.fechar()`; `pool.abertos` (quantos workers estão abertos). `criarSessao(pyodide, { pool })` registra o módulo JS `diverge_pool_js` com `submeter(bytes)`, `primeiro(promessas) → Promise<índice>`, `maximo()` e `nucleos()`.
- Produces (Python): `diverge_runtime.tarefa.rodar(pacote: bytes) → bytes` (resposta `cloudpickle` de `(situacao, valor_ou_excecao, saida, filas)`, com `situacao` `'ok'` ou `'erro'` e `filas = { id_da_fila: [itens] }`); `diverge_runtime.tarefa.FILAS_DA_TAREFA`; `diverge_runtime.pool`: `zerar(pasta)`, `submeter(funcao, args=(), kwargs=None) → promessa`, `esperar(promessa) → (situacao, valor)` (imprime a saída do worker e entrega as filas a `AO_RECEBER_FILAS`), `primeiro(promessas) → índice`, `maximo()`, `nucleos()`, `mapear(funcao, itens)`, `METRICAS = { disponivel, maximo, tarefas, workers: set }`. O resultado de `executar(...)` ganha `paralelismo: { disponivel, maximo, tarefas, workers }`.

- [ ] **Step 1: Testes que falham**

`tests/pool-node.js` (o `workerNode` sai de `pool.test.js` para ser usado também por `conteudo.test.js` e `paralelo.test.js`):

```js
// Worker do Node com a mesma cara do Web Worker (onmessage/postMessage/terminate), para o pool nos testes.
import { Worker } from 'node:worker_threads';
import { FONTES } from '../src/python/sessao.js';

export function workerNode() {
  const w = new Worker(new URL('./worker-tarefa-node.js', import.meta.url), { workerData: { fontes: FONTES } });
  const adaptador = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate(), onmessage: null, onerror: null };
  w.on('message', (data) => adaptador.onmessage?.({ data }));
  w.on('error', (e) => adaptador.onerror?.(e));
  return adaptador;
}
```

Em `tests/pool.test.js`: importe `workerNode` de `./pool-node.js`, crie `const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 })` e troque `iniciarPython({ mapear: (t) => pool.mapear(t) })` por `iniciarPython({ pool })`. Troque `info = pool.ULTIMA` no `CODIGO` por nada e confira `r.paralelismo`:

```js
  it('com JSPI: roda em paralelo em mais de um worker', async () => {
    const { sessao } = await iniciarPython({ pool });
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.erro).toBeNull();
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.paralelismo).toMatchObject({ disponivel: true, maximo: 4, tarefas: 4 });
    expect(r.paralelismo.workers).toBeGreaterThan(1);
  }, 120_000);

  it('o print do worker aparece no terminal e o erro do worker sobe com o mesmo tipo', async () => {
    const { sessao } = await iniciarPython({ pool });
    const codigo = 'from diverge_runtime import pool\n'
      + 'def f(x):\n    print("no worker", x)\n    if x < 0:\n        raise ValueError("negativo")\n    return x\n'
      + 'print(pool.mapear(f, [1, 2]))\n'
      + 'try:\n    pool.mapear(f, [-1])\nexcept ValueError as e:\n    print("pegou:", e)\n';
    const r = await sessao.executar({ 'main.py': codigo });
    expect(r.saida).toBe('no worker 1\nno worker 2\n[1, 2]\nno worker -1\npegou: negativo\n');
  }, 120_000);

  it('sem pool: mesmo resultado, em sequência, avisando que não houve paralelismo', async () => {
    const { sessao } = await iniciarPython();
    const r = await sessao.executar({ 'main.py': CODIGO });
    expect(r.variaveis.resultado).toEqual([1, 4, 9, 16]);
    expect(r.paralelismo).toMatchObject({ disponivel: false, maximo: 1, tarefas: 4, workers: 1 });
  });
```

e, com workers falsos:

```js
describe('tarefas avulsas e workers ociosos', () => {
  it('submeter usa o worker mais livre e abre só o que precisa', async () => {
    const p = new PoolPython({ criarWorker: () => workerFalso(), maximo: 3 });
    const [a, b] = await Promise.all([p.submeter(new Uint8Array([1])), p.submeter(new Uint8Array([2]))]);
    expect([a.resultado[0], b.resultado[0]]).toEqual([1, 2]);
    expect(new Set([a.worker, b.worker]).size).toBe(2);
    expect(p.abertos).toBe(2);
  });

  it('fecha os workers ociosos depois do tempo e reabre na próxima tarefa', async () => {
    vi.useFakeTimers();
    const avisos = [];
    const p = new PoolPython({ criarWorker: () => workerFalso({ abreEm: 1 }), maximo: 2, ociosoMs: 1000, aoAbrir: (a) => avisos.push(a) });
    const r = p.submeter(new Uint8Array([7]));
    await vi.advanceTimersByTimeAsync(5);
    await r;
    await vi.advanceTimersByTimeAsync(1001);
    expect(p.abertos).toBe(0);
    const r2 = p.submeter(new Uint8Array([8]));
    await vi.advanceTimersByTimeAsync(5);
    expect((await r2).resultado[0]).toBe(8);
    expect(avisos).toEqual([true, false, true, false]);
    vi.useRealTimers();
  });
});
```

(`workerFalso` já existe em `pool.test.js`; importe `vi` do vitest. Os testes "avisa enquanto os workers abrem" e "um worker que não abre" passam a usar `new PoolPython({ ..., aoAbrir })` em vez de `mapear(..., { aoAbrir })`.)

`python/tests/test_runtime.py`:

```python
def test_tarefa_devolve_saida_erro_e_filas():
    import cloudpickle
    from diverge_runtime import tarefa

    def f(x):
        print('oi', x)
        tarefa.FILAS_DA_TAREFA.setdefault(5, []).append(x * 2)
        return x + 1

    assert cloudpickle.loads(tarefa.rodar(cloudpickle.dumps((f, (1,), {})))) == ('ok', 2, 'oi 1\n', {5: [2]})
    situacao, erro, saida, filas = cloudpickle.loads(tarefa.rodar(cloudpickle.dumps((int, ('x',), {}))))
    assert situacao == 'erro' and isinstance(erro, ValueError) and saida == '' and filas == {}


def test_paralelismo_sem_pool_roda_em_sequencia():
    r = execucao.executar({'main.py': 'from diverge_runtime import pool\nprint(pool.mapear(abs, [-1, -2]))\n'})
    assert r['saida'] == '[1, 2]\n'
    assert r['paralelismo'] == {'disponivel': False, 'maximo': 1, 'tarefas': 2, 'workers': 1}
```

Run: `python -m pytest -q && npx vitest run tests/pool.test.js`
Expected: FAIL nos testes novos.

- [ ] **Step 2: `diverge_runtime/tarefa.py`**

```python
"""Roda uma tarefa num worker do pool (ou aqui mesmo, sem pool).

O pacote é (funcao, args, kwargs) serializado com cloudpickle. A resposta, também
serializada, é (situacao, valor ou exceção, o que a função imprimiu, itens que ela pôs
em filas do multiprocessing). Assim o print do worker chega ao terminal e o erro sobe no
processo principal com o mesmo tipo, como no Python de verdade."""
import contextlib
import io

import cloudpickle

FILAS_DA_TAREFA = {}  # id da fila -> itens postos durante esta tarefa (veja diverge_paralelo)


def rodar(pacote):
    funcao, args, kwargs = cloudpickle.loads(bytes(pacote))
    FILAS_DA_TAREFA.clear()
    saida = io.StringIO()
    try:
        with contextlib.redirect_stdout(saida):
            resposta = ('ok', funcao(*args, **kwargs))
    except BaseException as erro:  # o erro da função do aluno volta para o processo principal
        resposta = ('erro', erro)
    filas = {fila: list(itens) for fila, itens in FILAS_DA_TAREFA.items()}
    try:
        return cloudpickle.dumps((*resposta, saida.getvalue(), filas))
    except Exception as erro:  # valor ou exceção que não dá para serializar
        problema = RuntimeError(f'o resultado da tarefa não pôde ser enviado de volta: {erro}')
        return cloudpickle.dumps(('erro', problema, saida.getvalue(), filas))
```

- [ ] **Step 3: `diverge_runtime/pool.py` (troca o arquivo inteiro)**

```python
"""Ponte com o pool de workers (src/python/pool.js).

Com JSPI (run_sync), cada tarefa roda num worker, de verdade em paralelo, e o Python do aluno
espera a resposta. Sem JSPI (ou fora do navegador), a tarefa roda aqui mesmo, em sequência:
o resultado é o mesmo. METRICAS conta o que aconteceu na execução atual (zerar() a cada execução)."""
import os
import sys

import cloudpickle

from . import tarefa

METRICAS = {'disponivel': False, 'maximo': 1, 'tarefas': 0, 'workers': set()}
AO_RECEBER_FILAS = None  # diverge_paralelo entrega aqui os itens que as tarefas puseram em filas
_PASTA = None


def _modulo_js():
    try:
        import diverge_pool_js
    except ImportError:
        return None
    return diverge_pool_js


def _js():
    js = _modulo_js()
    if js is None:
        return None
    from pyodide.ffi import can_run_sync
    return js if can_run_sync() else None


def maximo():
    js = _js()
    return int(js.maximo()) if js else 1


def nucleos():
    js = _modulo_js()
    return int(js.nucleos()) if js else (os.cpu_count() or 1)


def zerar(pasta=None):
    global _PASTA
    _PASTA = pasta
    METRICAS.update(disponivel=_js() is not None, maximo=maximo(), tarefas=0, workers=set())


def resumo():
    return {**METRICAS, 'workers': len(METRICAS['workers'])}


class _Pronta:
    """Tarefa que já rodou aqui mesmo (sem pool)."""

    def __init__(self, resposta):
        self.resposta = resposta


def _registrar_modulos_do_aluno():
    """O worker não tem os arquivos do aluno: os módulos dele vão por valor."""
    if not _PASTA:
        return
    for nome, modulo in list(sys.modules.items()):
        arquivo = getattr(modulo, '__file__', '') or ''
        if nome != '__main__' and arquivo.startswith(_PASTA):
            cloudpickle.register_pickle_by_value(modulo)


def submeter(funcao, args=(), kwargs=None):
    _registrar_modulos_do_aluno()
    pacote = cloudpickle.dumps((funcao, tuple(args), kwargs or {}))
    METRICAS['tarefas'] += 1
    js = _js()
    if js is None:
        return _Pronta(tarefa.rodar(pacote))
    from pyodide.ffi import to_js
    return js.submeter(to_js(pacote))


def esperar(promessa):
    """Espera a tarefa: imprime o que ela imprimiu, entrega as filas e devolve (situacao, valor)."""
    if isinstance(promessa, _Pronta):
        resposta, worker = promessa.resposta, 0
    else:
        from pyodide.ffi import run_sync
        r = run_sync(promessa)
        resposta, worker = bytes(r.resultado.to_py()), int(r.worker)
    METRICAS['workers'].add(worker)
    situacao, valor, saida, filas = cloudpickle.loads(resposta)
    if saida:
        sys.stdout.write(saida)
    if filas and AO_RECEBER_FILAS:
        AO_RECEBER_FILAS(filas)
    return situacao, valor


def primeiro(promessas):
    """Índice da primeira tarefa a terminar (as que já rodaram aqui contam como prontas)."""
    for i, p in enumerate(promessas):
        if isinstance(p, _Pronta):
            return i
    from pyodide.ffi import run_sync, to_js
    return int(run_sync(_js().primeiro(to_js(list(promessas)))))


def mapear(funcao, itens):
    """funcao(item) para cada item, em paralelo; o primeiro erro sobe aqui."""
    promessas = [submeter(funcao, (item,)) for item in itens]
    resultados = []
    for p in promessas:
        situacao, valor = esperar(p)
        if situacao == 'erro':
            raise valor
        resultados.append(valor)
    return resultados
```

`execucao.py`: no começo de `executar`, depois de `_esquecer_modulos_do_aluno`, chame `pool.zerar(PASTA)` (`from . import pool`); no retorno, `'paralelismo': pool.resumo()`.

- [ ] **Step 4: Pool JS (`src/python/pool.js`, troca o arquivo inteiro)**

```js
// Pool de workers, cada um com o seu Pyodide: as tarefas rodam ao mesmo tempo nos núcleos do
// computador. Abre os workers sob demanda (até `maximo`), manda cada tarefa ao worker mais livre
// e fecha os ociosos depois de `ociosoMs` (cada worker ocupa uns 50 MB).
const workerDoSite = () => new Worker(new URL('./worker-tarefa.js', import.meta.url), { type: 'module' });

export const nucleosDoComputador = () => globalThis.navigator?.hardwareConcurrency ?? 2;
export const maximoDeWorkers = () => Math.max(1, Math.min(4, nucleosDoComputador() - 1));

export class PoolPython {
  constructor({ criarWorker = workerDoSite, maximo = maximoDeWorkers(), aoAbrir = () => {}, ociosoMs = 60_000 } = {}) {
    this.criarWorker = criarWorker;
    this.maximo = maximo;
    this.aoAbrir = aoAbrir;
    this.ociosoMs = ociosoMs;
    this.workers = [];
    this.proximoId = 1;
    this.abrindo = 0;
  }

  get abertos() {
    return this.workers.length;
  }

  /** Abre um worker; ele avisa { pronto: true } ou { falha } ao carregar. */
  #abrirUm() {
    const w = this.criarWorker();
    const registro = { w, pendentes: new Map(), aberto: false, indice: this.workers.length };
    if (this.abrindo++ === 0) this.aoAbrir(true);
    registro.pronto = new Promise((resolve, reject) => {
      const falhar = (mensagem) => {
        reject(new Error(mensagem));
        for (const responder of registro.pendentes.values()) responder({ erro: mensagem });
        registro.pendentes.clear();
      };
      w.onmessage = ({ data }) => {
        if (data.pronto) {
          registro.aberto = true;
          resolve();
        } else if (data.falha) {
          falhar(data.falha);
        } else {
          registro.pendentes.get(data.id)?.(data);
          registro.pendentes.delete(data.id);
          this.#talvezOcioso();
        }
      };
      w.onerror = (e) => falhar(e.message ?? 'um worker do pool não abriu');
    }).finally(() => {
      if (--this.abrindo === 0) this.aoAbrir(false);
    });
    registro.pronto.catch(() => {});
    this.workers.push(registro);
    return registro;
  }

  /** O worker mais livre; abre outro se todos estão ocupados e ainda cabe. */
  #escolher() {
    const livre = this.workers.find((r) => r.pendentes.size === 0);
    if (livre) return livre;
    if (this.workers.length < this.maximo) return this.#abrirUm();
    return this.workers.reduce((a, b) => (b.pendentes.size < a.pendentes.size ? b : a));
  }

  #talvezOcioso() {
    clearTimeout(this.relogioOcioso);
    if (this.workers.some((r) => r.pendentes.size)) return;
    this.relogioOcioso = setTimeout(() => this.fechar(), this.ociosoMs);
  }

  async submeter(tarefa) {
    clearTimeout(this.relogioOcioso);
    const registro = this.#escolher();
    const id = this.proximoId++;
    const resposta = new Promise((resolve, reject) => {
      registro.pendentes.set(id, (data) => (data.erro ? reject(new Error(data.erro)) : resolve(data.resultado)));
    });
    try {
      await registro.pronto;
    } catch (erro) {
      this.fechar(); // na próxima vez, tenta abrir de novo
      throw erro;
    }
    registro.w.postMessage({ id, tarefa: tarefa instanceof Uint8Array ? tarefa : new Uint8Array(tarefa) });
    return { resultado: await resposta, worker: registro.indice };
  }

  async mapear(tarefas) {
    const respostas = await Promise.all(Array.from(tarefas, (t) => this.submeter(t)));
    return { resultados: respostas.map((r) => r.resultado), tarefas: respostas.map((r) => ({ worker: r.worker })) };
  }

  fechar() {
    clearTimeout(this.relogioOcioso);
    for (const { w } of this.workers) w.terminate();
    this.workers = [];
  }
}
```

(Se um worker for fechado e reaberto, `indice` recomeça de 0: `workers` conta os distintos por execução, que é o que a regra usa.)

- [ ] **Step 5: Sessão, tarefa e workers**

`src/python/sessao.js`: `criarSessao(pyodide, { pool, fontes = FONTES } = {})`; depois de montar os pacotes:

```js
  if (pool) {
    pyodide.registerJsModule('diverge_pool_js', {
      submeter: (bytes) => pool.submeter(bytes),
      primeiro: (promessas) => Promise.race(Array.from(promessas, (p, i) => p.then(() => i, () => i))),
      maximo: () => pool.maximo,
      nucleos: () => nucleosDoComputador(),
    });
  }
```

(`import { nucleosDoComputador } from './pool.js'`; atualize o comentário do topo.)

`src/python/tarefa.js`: `criarTarefa(pyodide)` passa a usar `const rodar = pyodide.pyimport('diverge_runtime.tarefa').rodar;` e devolve `(bytes) => { const proxy = rodar(bytes); try { return proxy.toJs(); } finally { proxy.destroy(); } }`.

`src/python/worker.js`: `const pool = new PoolPython({ aoAbrir: (abrindo) => postMessage({ tipo: abrindo ? 'pool-abrindo' : 'pool-pronto' }) });` (o pool só abre workers quando recebe tarefa) e `criarSessao(pyodide, { pool })`.

`src/python/worker-tarefa.js` e `tests/worker-tarefa-node.js`: sem mudança de protocolo (mensagem `{ id, tarefa }` → `{ id, resultado }`).

Run: `python -m pytest -q && npx vitest run tests/pool.test.js tests/motor.test.js tests/runtime.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Pool: tarefas avulsas, saída e erros do worker, workers ociosos e métricas de paralelismo"
```

---

### Task 2: `diverge_paralelo`: multiprocessing, concurrent.futures e a regra do `__main__`

**Files:**
- Create: `python/diverge_paralelo/__init__.py`, `python/diverge_paralelo/guarda.py`, `python/diverge_paralelo/processos.py`, `python/diverge_paralelo/futuros.py`, `python/diverge_paralelo/multiprocessing.py`, `python/diverge_paralelo/instalar.py`
- Modify: `python/diverge_runtime/execucao.py`
- Test: `python/tests/test_paralelo.py`, `tests/paralelo.test.js`

**Interfaces:**
- Consumes: `diverge_runtime.pool` (`submeter`, `esperar`, `primeiro`, `nucleos`, `AO_RECEBER_FILAS`), `diverge_runtime.tarefa.FILAS_DA_TAREFA` (Task 1).
- Produces: `diverge_paralelo.instalar.instalar(principal: str, fonte: str) → desfazer()`, que põe em `sys.modules` os módulos `multiprocessing` e `concurrent.futures` do aluno e os tira no fim. API: `Pool(processes=None)` com `map`, `starmap`, `imap`, `imap_unordered`, `apply`, `apply_async` (`.get()`, `.ready()`), `map_async`, `close`, `terminate`, `join` e `with`; `Process(target, args, kwargs, name)` com `start`, `join`, `is_alive`, `exitcode`, `name`; `Queue` com `put`, `get`, `empty`, `qsize`; `cpu_count()`; `current_process().name`; `freeze_support()`; `Value`/`Array` → `NotImplementedError`. `ProcessPoolExecutor(max_workers=None)` com `submit`, `map`, `shutdown` e `with`; `Future` com `result`, `exception`, `done`; `as_completed(futuros)`.

- [ ] **Step 1: Testes que falham (pytest, sem pool: tudo em sequência)**

`python/tests/test_paralelo.py`:

```python
"""diverge_paralelo em CPython: sem o pool do navegador, tudo roda em sequência."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from diverge_runtime import execucao  # noqa: E402

execucao.PASTA = tempfile.mkdtemp()


def rodar(codigo, **kw):
    return execucao.executar({'main.py': codigo, **kw.pop('arquivos', {})}, **kw)


def test_pool_map_com_main():
    r = rodar('from multiprocessing import Pool\ndef q(x):\n    return x * x\n'
              'if __name__ == "__main__":\n    with Pool(2) as p:\n        r = p.map(q, range(5))\n')
    assert r['erro'] is None
    assert r['variaveis']['r'] == [0, 1, 4, 9, 16]
    assert r['paralelismo']['tarefas'] >= 1


def test_pool_sem_main_da_o_erro_do_python_real():
    r = rodar('from multiprocessing import Pool\np = Pool(2)\n')
    assert r['erro']['tipo'] == 'RuntimeError'
    assert 'bootstrapping phase' in r['erro']['mensagem']


def test_pool_numa_funcao_chamada_do_bloco_main():
    r = rodar('from multiprocessing import Pool\ndef calcular():\n    with Pool(2) as p:\n        return p.map(abs, [-1, -2])\n'
              'if __name__ == "__main__":\n    r = calcular()\n')
    assert r['erro'] is None and r['variaveis']['r'] == [1, 2]


def test_process_e_queue():
    r = rodar('from multiprocessing import Process, Queue\ndef soma(q, a, b):\n    q.put(sum(range(a, b)))\n'
              'if __name__ == "__main__":\n    q = Queue()\n    ps = [Process(target=soma, args=(q, 0, 5)), Process(target=soma, args=(q, 5, 10))]\n'
              '    for p in ps:\n        p.start()\n    total = q.get() + q.get()\n    for p in ps:\n        p.join()\n')
    assert r['erro'] is None and r['variaveis']['total'] == 45


def test_fila_vazia_sem_processo_explica_em_vez_de_travar():
    r = rodar('from multiprocessing import Queue\nif __name__ == "__main__":\n    Queue().get()\n')
    assert r['erro']['tipo'] == 'RuntimeError'
    assert 'ficaria parado para sempre' in r['erro']['mensagem']


def test_executor_as_completed_e_erro():
    r = rodar('from concurrent.futures import ProcessPoolExecutor, as_completed\n'
              'def inv(x):\n    return 1 / x\n'
              'if __name__ == "__main__":\n    with ProcessPoolExecutor() as ex:\n'
              '        fs = [ex.submit(inv, x) for x in (1, 2, 4)]\n        total = sum(f.result() for f in as_completed(fs))\n'
              '        try:\n            ex.submit(inv, 0).result()\n        except ZeroDivisionError:\n            pegou = True\n')
    assert r['erro'] is None
    assert r['variaveis']['total'] == 1.75 and r['variaveis']['pegou'] is True


def test_threads_continuam_reais_e_modulos_voltam_ao_normal():
    import multiprocessing
    import concurrent.futures
    rodar('import multiprocessing\n')
    assert sys.modules['multiprocessing'] is multiprocessing
    assert concurrent.futures.ProcessPoolExecutor.__module__ == 'concurrent.futures.process'


def test_value_e_array_explicam():
    r = rodar('from multiprocessing import Value\nif __name__ == "__main__":\n    Value("i", 0)\n')
    assert r['erro']['tipo'] == 'NotImplementedError'
    assert 'SharedArrayBuffer' in r['erro']['mensagem']
```

Run: `python -m pytest -q python/tests/test_paralelo.py`
Expected: FAIL (`multiprocessing` real do CPython, sem `paralelismo` de Pool etc.).

- [ ] **Step 2: Implementar**

`python/diverge_paralelo/__init__.py`:

```python
"""multiprocessing e concurrent.futures sobre o pool de workers do DivergePython.

O aluno escreve `from multiprocessing import Pool` como no Python de verdade; durante a
execução, `instalar()` troca esses módulos pelos daqui (veja instalar.py)."""
```

`python/diverge_paralelo/guarda.py`:

```python
"""A regra do `if __name__ == "__main__":`, como no Python real com início spawn."""
import ast
import sys

MENSAGEM = (
    'An attempt has been made to start a new process before the\n'
    'current process has finished its bootstrapping phase.\n\n'
    'This probably means that you are not using fork to start your\n'
    'child processes and you have forgotten to use the proper idiom\n'
    'in the main module:\n\n'
    "    if __name__ == '__main__':\n"
    '        freeze_support()\n'
    '        ...'
)
_PRINCIPAL = 'main.py'
_BLOCOS = []  # (primeira, última) linha de cada `if __name__ == "__main__":`


def _eh_teste_main(no):
    if not isinstance(no, ast.Compare) or len(no.ops) != 1 or not isinstance(no.ops[0], ast.Eq):
        return False
    lados = [no.left, no.comparators[0]]
    nomes = [x.id for x in lados if isinstance(x, ast.Name)]
    textos = [x.value for x in lados if isinstance(x, ast.Constant)]
    return nomes == ['__name__'] and textos == ['__main__']


def configurar(principal, fonte):
    global _PRINCIPAL
    _PRINCIPAL = principal
    _BLOCOS.clear()
    try:
        arvore = ast.parse(fonte)
    except SyntaxError:
        return
    for no in ast.walk(arvore):
        if isinstance(no, ast.If) and _eh_teste_main(no.test) and no.body:
            _BLOCOS.append((no.body[0].lineno, no.body[-1].end_lineno))


def exigir_main():
    """Erro do Python real se o processo nasce no nível do módulo, fora do bloco do main."""
    quadro = sys._getframe(1)
    while quadro is not None:
        codigo = quadro.f_code
        if codigo.co_filename == _PRINCIPAL and codigo.co_name == '<module>':
            if not any(inicio <= quadro.f_lineno <= fim for inicio, fim in _BLOCOS):
                raise RuntimeError(MENSAGEM)
            return
        quadro = quadro.f_back
```

`python/diverge_paralelo/processos.py`:

```python
"""Pool, Process e Queue (multiprocessing) sobre o pool de workers."""
import itertools
import traceback
from collections import deque

from diverge_runtime import pool, tarefa

from .guarda import exigir_main

_contador_filas = itertools.count(1)
_contador_processos = itertools.count(1)
FILAS = {}         # id -> Queue do processo principal
PENDENTES = []     # processos iniciados e ainda não esperados
MENSAGEM_FILA_VAZIA = (
    'a fila está vazia e nenhum processo vai colocar nada nela. '
    'No Python de verdade, o programa ficaria parado para sempre aqui.'
)


def zerar():
    FILAS.clear()
    PENDENTES.clear()


def _receber_filas(filas):
    for fila, itens in filas.items():
        if fila in FILAS:
            FILAS[fila]._itens.extend(itens)


pool.AO_RECEBER_FILAS = _receber_filas


def _valor(resposta):
    situacao, valor = resposta
    if situacao == 'erro':
        raise valor
    return valor


def _aplicar_lote(funcao, lote):
    return [funcao(item) for item in lote]


def _aplicar_lote_estrela(funcao, lote):
    return [funcao(*args) for args in lote]


def cpu_count():
    return pool.nucleos()


class Queue:
    def __init__(self, maxsize=0):
        self._id = next(_contador_filas)
        self._itens = deque()
        self._copia = False
        FILAS[self._id] = self

    def __getstate__(self):
        return {'_id': self._id}

    def __setstate__(self, estado):
        # Cópia que viaja para o worker: o que for posto nela volta junto com a resposta.
        self._id = estado['_id']
        self._itens = deque()
        self._copia = True

    def put(self, item, block=True, timeout=None):
        if self._copia:
            tarefa.FILAS_DA_TAREFA.setdefault(self._id, []).append(item)
        else:
            self._itens.append(item)

    def get(self, block=True, timeout=None):
        while not self._itens:
            if not PENDENTES:
                raise RuntimeError(MENSAGEM_FILA_VAZIA)
            PENDENTES[0].join()
        return self._itens.popleft()

    def empty(self):
        return not self._itens

    def qsize(self):
        return len(self._itens)


class Process:
    def __init__(self, group=None, target=None, name=None, args=(), kwargs=None):
        self._target, self._args, self._kwargs = target, tuple(args), kwargs or {}
        self.name = name or f'Process-{next(_contador_processos)}'
        self.exitcode = None
        self._promessa = None

    def start(self):
        exigir_main()
        self._promessa = pool.submeter(self._target or (lambda: None), self._args, self._kwargs)
        PENDENTES.append(self)

    def join(self, timeout=None):
        if self._promessa is None:
            return
        promessa, self._promessa = self._promessa, None
        PENDENTES.remove(self)
        situacao, valor = pool.esperar(promessa)
        if situacao == 'erro':
            # Como no Python real: o erro do filho é impresso, e o pai continua.
            print(f'Process {self.name}:')
            print(''.join(traceback.format_exception_only(valor)), end='')
            self.exitcode = 1
        else:
            self.exitcode = 0

    def is_alive(self):
        return self._promessa is not None


class AsyncResult:
    def __init__(self, obter):
        self._obter = obter
        self._pronto = False

    def get(self, timeout=None):
        if not self._pronto:
            self._valor = self._obter()
            self._pronto = True
        return self._valor

    def ready(self):
        return self._pronto

    def wait(self, timeout=None):
        self.get()


class Pool:
    def __init__(self, processes=None, initializer=None, initargs=()):
        exigir_main()
        self._processos = max(1, processes or cpu_count())
        self._aberto = True

    def __enter__(self):
        return self

    def __exit__(self, *erro):
        self.terminate()

    def _conferir(self):
        if not self._aberto:
            raise ValueError('Pool not running')

    def _lotes(self, itens, chunksize):
        itens = list(itens)
        if chunksize is None:
            chunksize, resto = divmod(len(itens), self._processos * 4)
            if resto:
                chunksize += 1
        chunksize = max(1, chunksize)
        return [itens[i:i + chunksize] for i in range(0, len(itens), chunksize)]

    def _rodar_lotes(self, aplicar, funcao, itens, chunksize):
        """No máximo `processes` lotes ao mesmo tempo, como os processos de um Pool real."""
        self._conferir()
        lotes = self._lotes(itens, chunksize)
        janela = deque()
        resultados = []
        for lote in lotes:
            if len(janela) == self._processos:
                resultados.extend(_valor(pool.esperar(janela.popleft())))
            janela.append(pool.submeter(aplicar, (funcao, lote)))
        while janela:
            resultados.extend(_valor(pool.esperar(janela.popleft())))
        return resultados

    def map(self, func, iterable, chunksize=None):
        return self._rodar_lotes(_aplicar_lote, func, iterable, chunksize)

    def starmap(self, func, iterable, chunksize=None):
        return self._rodar_lotes(_aplicar_lote_estrela, func, iterable, chunksize)

    def imap(self, func, iterable, chunksize=1):
        yield from self.map(func, iterable, chunksize)

    def imap_unordered(self, func, iterable, chunksize=1):
        yield from self.map(func, iterable, chunksize)

    def map_async(self, func, iterable, chunksize=None):
        return AsyncResult(lambda: self.map(func, iterable, chunksize))

    def apply_async(self, func, args=(), kwds=None):
        self._conferir()
        promessa = pool.submeter(func, args, kwds)
        return AsyncResult(lambda: _valor(pool.esperar(promessa)))

    def apply(self, func, args=(), kwds=None):
        return self.apply_async(func, args, kwds).get()

    def close(self):
        self._aberto = False

    def terminate(self):
        self._aberto = False

    def join(self):
        pass


class _Atual:
    name = 'MainProcess'


def current_process():
    return _Atual()


def freeze_support():
    pass


def set_start_method(metodo, force=False):
    pass


def _sem_memoria_compartilhada(*args, **kwargs):
    raise NotImplementedError(
        'Value e Array precisam de memória compartilhada (SharedArrayBuffer), que o GitHub Pages não libera. '
        'Aqui, troque dados entre processos com Queue ou com os resultados de Pool.map.'
    )


Value = Array = _sem_memoria_compartilhada
```

`python/diverge_paralelo/multiprocessing.py`:

```python
"""O módulo `multiprocessing` que o aluno importa durante a execução."""
from .processos import (  # noqa: F401
    Array, AsyncResult, Pool, Process, Queue, Value, cpu_count, current_process, freeze_support, set_start_method,
)
```

`python/diverge_paralelo/futuros.py`:

```python
"""ProcessPoolExecutor, Future e as_completed (concurrent.futures) sobre o pool de workers."""
import concurrent.futures as _reais
import types

from diverge_runtime import pool

from .guarda import exigir_main


class Future:
    def __init__(self, promessa):
        self._promessa = promessa
        self._pronto = False

    def _esperar(self):
        if not self._pronto:
            self._situacao, self._valor = pool.esperar(self._promessa)
            self._pronto = True

    def result(self, timeout=None):
        self._esperar()
        if self._situacao == 'erro':
            raise self._valor
        return self._valor

    def exception(self, timeout=None):
        self._esperar()
        return self._valor if self._situacao == 'erro' else None

    def done(self):
        return self._pronto


class ProcessPoolExecutor:
    def __init__(self, max_workers=None, *args, **kwargs):
        self._futuros = []

    def __enter__(self):
        return self

    def __exit__(self, *erro):
        self.shutdown()

    def submit(self, fn, /, *args, **kwargs):
        exigir_main()
        futuro = Future(pool.submeter(fn, args, kwargs))
        self._futuros.append(futuro)
        return futuro

    def map(self, fn, *iterables, timeout=None, chunksize=1):
        futuros = [self.submit(fn, *args) for args in zip(*iterables)]
        return (f.result() for f in futuros)

    def shutdown(self, wait=True, *, cancel_futures=False):
        if wait:
            for futuro in self._futuros:
                futuro._esperar()


def as_completed(fs, timeout=None):
    """Na ordem em que as tarefas terminam (a ordem muda de uma execução para outra)."""
    restantes = list(fs)
    while restantes:
        prontos = [i for i, f in enumerate(restantes) if f.done()]
        i = prontos[0] if prontos else pool.primeiro([f._promessa for f in restantes])
        futuro = restantes.pop(i)
        futuro._esperar()
        yield futuro


def modulo():
    """concurrent.futures do aluno: o real, com os processos trocados pelos daqui."""
    m = types.ModuleType('concurrent.futures')
    m.__dict__.update({k: v for k, v in vars(_reais).items() if not k.startswith('__')})
    m.ProcessPoolExecutor, m.Future, m.as_completed = ProcessPoolExecutor, Future, as_completed
    return m
```

`python/diverge_paralelo/instalar.py`:

```python
"""Troca `multiprocessing` e `concurrent.futures` pelos do DivergePython só durante a execução do aluno."""
import sys

from . import futuros, guarda, processos
from . import multiprocessing as mp


def instalar(principal, fonte):
    guarda.configurar(principal, fonte)
    processos.zerar()
    import concurrent
    antigos = {nome: sys.modules.get(nome) for nome in ('multiprocessing', 'concurrent.futures')}
    atributo = getattr(concurrent, 'futures', None)
    sys.modules['multiprocessing'] = mp
    sys.modules['concurrent.futures'] = concurrent.futures = futuros.modulo()

    def desfazer():
        # Processos que o aluno iniciou e não esperou: espera agora, para o print deles não se perder.
        for processo in list(processos.PENDENTES):
            processo.join()
        for nome, modulo in antigos.items():
            if modulo is None:
                sys.modules.pop(nome, None)
            else:
                sys.modules[nome] = modulo
        if atributo is not None:
            concurrent.futures = atributo

    return desfazer
```

`execucao.py`: `from diverge_paralelo.instalar import instalar as instalar_paralelo`; em `executar`, logo antes do `try` que roda o aluno: `desfazer_paralelo = instalar_paralelo(principal, arquivos.get(principal, ''))`, e no `finally`: `desfazer_paralelo()`. (O `desfazer()` espera os processos que o aluno iniciou e não esperou, para o print deles não se perder.)

- [ ] **Step 3: Testes com o pool de verdade (vitest)**

`tests/paralelo.test.js`:

```js
// multiprocessing e concurrent.futures com o pool de verdade (workers do Node).
import { describe, it, expect, afterAll } from 'vitest';
import { PoolPython } from '../src/python/pool.js';
import { iniciarPython } from './python-node.js';
import { workerNode } from './pool-node.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
const sessao = iniciarPython({ pool }).then((s) => s.sessao);

describe('processos de verdade', () => {
  it('Pool.map usa mais de um worker', async () => {
    const r = await (await sessao).executar({ 'main.py': 'from multiprocessing import Pool\ndef q(x):\n    return x * x\nif __name__ == "__main__":\n    with Pool(4) as p:\n        r = p.map(q, range(8))\n' });
    expect(r.erro).toBeNull();
    expect(r.variaveis.r).toEqual([0, 1, 4, 9, 16, 25, 36, 49]);
    expect(r.paralelismo.workers).toBeGreaterThan(1);
  }, 120_000);

  it('função de outro arquivo do aluno funciona no worker', async () => {
    const r = await (await sessao).executar({
      'main.py': 'from multiprocessing import Pool\nfrom funcoes import dobro\nif __name__ == "__main__":\n    with Pool(2) as p:\n        r = p.map(dobro, [1, 2, 3])\n',
      'funcoes.py': 'def dobro(x):\n    return x * 2\n',
    });
    expect(r.erro).toBeNull();
    expect(r.variaveis.r).toEqual([2, 4, 6]);
  }, 120_000);

  it('Process com Queue e ProcessPoolExecutor com as_completed', async () => {
    const r = await (await sessao).executar({
      'main.py': 'from multiprocessing import Process, Queue\nfrom concurrent.futures import ProcessPoolExecutor, as_completed\n'
        + 'def soma(q, a, b):\n    q.put(sum(range(a, b)))\ndef q2(x):\n    return x * x\n'
        + 'if __name__ == "__main__":\n    q = Queue()\n    ps = [Process(target=soma, args=(q, 0, 50)), Process(target=soma, args=(q, 50, 100))]\n'
        + '    for p in ps:\n        p.start()\n    total = q.get() + q.get()\n    for p in ps:\n        p.join()\n'
        + '    with ProcessPoolExecutor() as ex:\n        quadrados = sorted(f.result() for f in as_completed([ex.submit(q2, x) for x in range(4)]))\n',
    });
    expect(r.erro).toBeNull();
    expect(r.variaveis).toMatchObject({ total: 4950, quadrados: [0, 1, 4, 9] });
    expect(r.paralelismo.workers).toBeGreaterThan(1);
  }, 120_000);
});
```

Run: `python -m pytest -q && npx vitest run tests/paralelo.test.js tests/pool.test.js tests/runtime.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "multiprocessing e concurrent.futures de verdade sobre o pool, com a regra do __main__"
```

---

### Task 3: Regra `paralelo`, avisos na tela e o pool nos testes de conteúdo

**Files:**
- Modify: `src/verificacoes.js`, `src/corrigir.js`, `src/ui/item.js`, `tests/conteudo.test.js`
- Test: `tests/verificacoes.test.js`, `tests/corrigir.test.js`, `tests/item-python.test.js`

**Interfaces:**
- Consumes: `paralelismo: { disponivel, maximo, tarefas, workers }` (Task 1).
- Produces: regra `{ paralelo: { workers?: n, tarefas?: n } }` (categoria "Paralelismo"); contexto da regra `paralelismo`.

- [ ] **Step 1: Testes que falham**

`tests/verificacoes.test.js`:

```js
  it('paralelo: confere workers e tarefas, e não cobra paralelismo onde ele não existe', () => {
    const regra = { paralelo: { workers: 2 } };
    const p = (x) => ({ paralelismo: { disponivel: true, maximo: 4, tarefas: 4, workers: 1, ...x } });
    expect(verificarRegra(regra, p({ workers: 3 })).ok).toBe(true);
    expect(verificarRegra(regra, p({})).ok).toBe(false);
    expect(verificarRegra(regra, p({ maximo: 1 })).ok).toBe(true); // computador com 1 worker
    expect(verificarRegra(regra, p({ disponivel: false })).ok).toBe(true); // navegador sem JSPI
    expect(verificarRegra(regra, p({ tarefas: 0, workers: 0 }))).toMatchObject({ ok: false, detalhe: 'o código não mandou nenhuma tarefa para outro processo' });
    expect(verificarRegra({ paralelo: { tarefas: 10 } }, p({ tarefas: 10 })).ok).toBe(true);
    expect(verificarRegra({ paralelo: { tarefas: 10 } }, p({ tarefas: 8 })).ok).toBe(false);
    expect(categoriaDe(regra)).toBe('Paralelismo');
  });
```

`tests/item-python.test.js`:

```js
  it('sem paralelismo no navegador, o terminal avisa que rodou em sequência', async () => {
    const { tela } = montar({ saida: '[1, 4]\n', erro: null, paralelismo: { disponivel: false, maximo: 1, tarefas: 2, workers: 1 } });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('saida-terminal').textContent).toContain('rodaram uma depois da outra');
  });
```

Run: `npx vitest run tests/verificacoes.test.js tests/item-python.test.js`
Expected: FAIL.

- [ ] **Step 2: Implementar**

`src/verificacoes.js` (contexto ganha `paralelismo = null`; comentário do topo ganha `//   { paralelo: { workers, tarefas } }    quantos workers e tarefas o código usou (nunca o tempo)`), antes de `'funcao' in regra`:

```js
  if ('paralelo' in regra) {
    const { workers: minimo, tarefas } = regra.paralelo;
    const p = paralelismo ?? { disponivel: false, maximo: 1, tarefas: 0, workers: 0 };
    const obtido = `${p.tarefas} ${p.tarefas === 1 ? 'tarefa' : 'tarefas'} em ${p.workers} ${p.workers === 1 ? 'worker' : 'workers'}`;
    if (!p.tarefas) return res(regra, 'O trabalho roda em outros processos', false, 'o código não mandou nenhuma tarefa para outro processo', obtido);
    if (tarefas !== undefined && p.tarefas !== tarefas) {
      return res(regra, `O trabalho foi dividido em ${tarefas} tarefas`, false, `foram ${p.tarefas} tarefas`, obtido);
    }
    if (minimo !== undefined) {
      // Sem JSPI (ou com um núcleo só) não há como usar mais workers: não é culpa do código.
      const possivel = p.disponivel ? Math.min(minimo, p.maximo) : 1;
      const ok = p.workers >= possivel;
      return res(regra, `As tarefas rodam em ${minimo} ou mais workers ao mesmo tempo`, ok,
        `só ${p.workers} ${p.workers === 1 ? 'worker trabalhou' : 'workers trabalharam'}`,
        p.disponivel ? obtido : `${obtido} (neste navegador não há paralelismo)`);
    }
    return res(regra, `O trabalho foi dividido em ${tarefas} tarefas`, true, '', obtido);
  }
```

`CATEGORIAS`: `['paralelo', 'Paralelismo']` antes de `['funcao', 'Função']`; `DICAS.Paralelismo`: `'Use Pool, Process ou ProcessPoolExecutor dentro do if __name__ == "__main__": e mande várias tarefas de uma vez (map, submit).'`.

`src/corrigir.js`: no contexto de `detalharRegra`, `paralelismo: r.paralelismo`.

`src/ui/item.js`, em `mostrarTerminal(r)`, depois de montar o texto:

```js
    const p = r.paralelismo;
    if (p?.tarefas && (!p.disponivel || p.maximo < 2)) {
      el.terminal.textContent += `\nℹ️ ${p.disponivel
        ? 'Este computador abre só 1 worker'
        : 'Este navegador não roda Python em paralelo (falta o recurso JSPI)'}: as ${p.tarefas} tarefas rodaram uma depois da outra. O resultado é o mesmo, só mais devagar.`;
    }
```

e, no `definirStatus` de `executar`, acrescente ao texto `${r.paralelismo?.tarefas ? ` · ⚡ ${r.paralelismo.tarefas} tarefas em ${r.paralelismo.workers} workers` : ''}`; a mesma informação entra na fala (`falaDoPython`): `Rodou ${p.tarefas} tarefas em ${p.workers} workers.` quando `p.tarefas`.

`tests/conteudo.test.js`: o Python dos testes passa a ter o pool de verdade:

```js
import { afterAll } from 'vitest';
import { PoolPython } from '../src/python/pool.js';
import { workerNode } from './pool-node.js';

const pool = new PoolPython({ criarWorker: workerNode, maximo: 4 });
afterAll(() => pool.fechar());
beforeAll(async () => { const { sessao } = await iniciarPython({ pool }); executar = (a, o) => sessao.executar(a, o); }, 120_000);
```

Run: `npx vitest run && npx eslint .`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Regra paralelo, aviso de execução em sequência e pool de verdade nos testes de conteúdo"
```

---

### Task 4: Módulo ⚡ Paralelismo — lições e exercícios 1 a 17

**Files:**
- Create: `src/conteudo/paralelismo.js` (`moduloParalelismo`, as 10 lições e os exercícios 1–17)
- Modify: `src/conteudo/trilha.js` (`modulos = [moduloBasico, moduloDados, moduloParalelismo]`; `PROXIMOS_MODULOS` sem `paralelismo`), `src/certificados.js` (`CERTIFICADOS.paralelismo`), `src/badges.js` (`BADGES.paralelismo`), `public/` (`npm run badges`), `tests/conteudo.test.js` (`['paralelismo', 35, 10]`), `tests/carga-horaria.test.js`
- Test: `tests/conteudo.test.js`

**Interfaces:**
- Consumes: `py`, `main`, `assinatura` (`src/conteudo/util.js`); regras `paralelo`, `saidaIgual`, `variavel`, `funcao`, `codigo`, `semErros`, `erro` e `item.dados`.
- Produces: `moduloParalelismo = { id: 'paralelismo', titulo: 'Paralelismo', icone: '⚡', descricao: 'Dividir o trabalho, map-reduce, partições, processos (Pool e ProcessPoolExecutor), asyncio, condições de corrida, speedup e Lei de Amdahl.', itens }`.

O certificado e o badge entram nesta task porque a trilha não abre com um módulo sem certificado (ruling da fase 2): `CERTIFICADOS.paralelismo = { titulo: 'Paralelismo em Python', cargaHoraria: 19, resumo: 'concluiu o módulo Paralelismo, resolvendo os 35 problemas práticos', hashtags: ['Python', 'Paralelismo'], conteudos: ['Dividir o trabalho, partições e map-reduce', 'Processos com Pool e ProcessPoolExecutor', 'asyncio, condições de corrida e Lock', 'Speedup, Lei de Amdahl e custo de serializar'] }` (carga: 10 lições × 10 + 11 fáceis × 15 + 17 médios × 30 + 7 difíceis × 45 = 1090 min → 19 h); `BADGES.paralelismo = { cor: '#ffb86c', simbolo: '|||', faixa: 'PARALELISMO' }`. Os testes de carga e de "N problemas" ficam vermelhos até a Task 5.

- [ ] **Step 1: Teste de conteúdo**

`tests/conteudo.test.js`: o `it.each` de estrutura ganha `['paralelismo', 35, 10]`.

Run: `npx vitest run tests/conteudo.test.js`
Expected: FAIL (o módulo não existe).

- [ ] **Step 2: As 10 lições**

Cada lição tem `resumo` (2 a 4 parágrafos curtos, com um exemplo e uma analogia) e um `main.py` que roda sem erro. As lições com processos usam `if __name__ == "__main__":`.

| id | título | o `main.py` mostra |
| --- | --- | --- |
| `licao-dividir` | Dividir o trabalho | dividir uma lista em 3 partes de tamanhos parecidos; somar cada parte e somar as somas |
| `licao-particoes` | Partições por hash e por intervalo | `sum(map(ord, chave)) % n` (o `hash()` do Python muda a cada execução) e `bisect.bisect_right(limites, valor)`; partições desequilibradas (skew) |
| `licao-map-reduce` | Map-reduce à mão | contar palavras por parte (map) e juntar os dicionários (reduce) |
| `licao-processos` | Processos com Pool | `Pool.map` dentro do `if __name__ == "__main__":`, `multiprocessing.cpu_count()`, `print` no worker; o texto explica que sem o `if` o Python dá `RuntimeError` |
| `licao-futures` | ProcessPoolExecutor | `submit`, `result`, `as_completed` (a ordem muda a cada execução) e `map` |
| `licao-processo-fila` | Process e Queue | dois `Process` pondo resultados numa `Queue`, `start`/`join`; memória compartilhada (`Value`) fica como conceito |
| `licao-asyncio` | asyncio: esperar sem parar | `async def`, `await asyncio.sleep`, `asyncio.gather` e `asyncio.run`; dois `sleep(0.2)` juntos levam 0,2 s |
| `licao-corrida` | Condição de corrida e Lock | o saldo com `x = saldo; await asyncio.sleep(0); saldo = x + 1` em 10 tarefas dá 1; com `asyncio.Lock`, 10; `Semaphore` limita quantas rodam juntas |
| `licao-gil-threads` | GIL e threads | conceito: o GIL deixa uma thread por vez rodar Python, então threads servem para esperar (I/O) e processos para calcular; o `main.py` tenta `threading.Thread(...).start()` dentro de `try/except RuntimeError` e mostra a mensagem do navegador |
| `licao-speedup` | Speedup e Lei de Amdahl | `speedup = t_seq / t_par`, eficiência, Amdahl `1 / ((1 - p) + p / n)` numa tabela para 1, 2, 4 e 8 workers; custo de serializar (mandar dados para o worker também leva tempo) |

- [ ] **Step 3: Exercícios 1 a 17**

Mesmo formato das fases anteriores. Nos exercícios com processos, a solução fica dentro de `if __name__ == "__main__":` e lê a entrada com `input()` (os casos ocultos mandam outra entrada); o código inicial faz a conta em sequência, sem processos, e por isso falha na regra `paralelo`.

| # | id | título | dif. | o que pede | solução de referência | visíveis | ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `pl-dividir` | Dividir em partes | médio | `dividir(lista, n)` → `n` partes contínuas; as primeiras ficam com 1 item a mais quando não divide exato | `base, extra = divmod(len(lista), n)`; percorre montando fatias de `base + (1 if i < extra else 0)` | `[[1,2,3,4,5,6,7],3] → [[1,2,3],[4,5],[6,7]]` | `[[],2] → [[],[]]`; `[[1,2],4] → [[1],[2],[],[]]` |
| 2 | `pl-intervalos` | Intervalos de trabalho | fácil | `intervalos(total, n)` → `[[início, fim), …]` cobrindo `0..total` com o mesmo critério do 1 | acumular `inicio` e somar o tamanho de cada parte | `[10,3] → [[0,4],[4,7],[7,10]]` | `[0,2] → [[0,0],[0,0]]`; `[5,5] → [[0,1],[1,2],[2,3],[3,4],[4,5]]` |
| 3 | `pl-particao-hash` | Partição por hash | médio | `particionar_hash(chaves, n)` → `n` listas; a chave vai para `sum(ord(c) for c in chave) % n`, na ordem de chegada | lista de listas e `append` | `[["ana","bia","caio"],3] → [["bia"],["ana","caio"],[]]` | `[[],2] → [[],[]]`; `[["a","b","c"],2] → [["b"],["a","c"]]` |
| 4 | `pl-particao-intervalo` | Partição por intervalo | médio | `particionar_intervalo(valores, limites)` (limites em ordem) → `len(limites) + 1` listas; o valor vai para `bisect_right(limites, valor)` | `bisect.bisect_right` | `[[5,10,15,20,25],[10,20]] → [[5],[10,15],[20,25]]` | `[[],[0]] → [[],[]]`; `[[-1,0,1],[0]] → [[-1],[0,1]]` |
| 5 | `pl-contar-palavras` | Map: contar palavras | fácil | `contar_palavras(texto)` → `{palavra: vezes}`, minúsculas, chaves em ordem alfabética | `Counter(texto.lower().split())` e `dict(sorted(...))` | `["Sol e sol"] → {"e":1,"sol":2}` | `[""] → {}`; `["a b a"] → {"a":2,"b":1}` |
| 6 | `pl-somar-contagens` | Reduce: juntar contagens | médio | `somar_contagens(contagens)` (lista de dicionários) → um dicionário com as somas, chaves em ordem alfabética | `Counter` com `update` | `[[{"a":1},{"a":2,"b":1}]] → {"a":3,"b":1}` | `[[]] → {}`; `[[{"z":1},{}]] → {"z":1}` |
| 7 | `pl-map-reduce` | Map-reduce completo | médio | `contagem_total(textos)` usando `contar_palavras` (map) e `somar_contagens` (reduce) | as duas funções acima | `[["sol e mar","mar"]] → {"e":1,"mar":2,"sol":1}`; `codigo 'def contar_palavras'`; `codigo 'def somar_contagens'` | `[[]] → {}`; `[["A a"]] → {"a":2}` |
| 8 | `pl-desequilibrio` | Desequilíbrio (skew) | médio | `desequilibrio(particoes)` → maior partição ÷ média de itens por partição, 2 casas; sem itens, `1.0` | `total = sum(map(len, particoes))`; `round(max(map(len, particoes)) / (total / len(particoes)), 2)` | `[[[1,2,3],[4],[5,6]]] → 1.5` | `[[[1],[2]]] → 1`; `[[[],[]]] → 1`; `[[[1,2,3,4],[],[],[]]] → 4` |
| 9 | `pl-speedup` | Speedup | fácil | `speedup(t_seq, t_par)` → `t_seq / t_par`, 2 casas | `round(t_seq / t_par, 2)` | `[12,4] → 3` | `[10,3] → 3.33`; `[5,10] → 0.5` |
| 10 | `pl-amdahl` | Lei de Amdahl | médio | `amdahl(p, n)` → `1 / ((1 - p) + p / n)`, 2 casas | a fórmula | `[0.9,4] → 3.08` | `[0,8] → 1`; `[1,4] → 4`; `[0.5,1000] → 2` |
| 11 | `pl-eficiencia` | Eficiência | fácil | `eficiencia(speedup, workers)` → porcentagem com 1 casa | `round(speedup / workers * 100, 1)` | `[3,4] → 75` | `[4,4] → 100`; `[1.5,8] → 18.8` |
| 12 | `pl-pool-map` | Pool.map | fácil | ler `n`; `resultados = pool.map(quadrado, range(n))` com `Pool(4)` | o código das lições | entrada `['8']` → `variavel resultados [0,1,4,9,16,25,36,49]`; `paralelo {workers: 2}`; `codigo '__name__'` | `['3'] → [0,1,4]` com `paralelo {workers: 2}` |
| 13 | `pl-sem-main` | Esqueceram o `__main__` | fácil | o código inicial cria o `Pool` fora do bloco do main e dá `RuntimeError`: conserte. Ele lê `n` e calcula `total = sum(pool.map(triplo, range(n)))` | mover o `with Pool` para dentro do `if __name__ == "__main__":` | `['5'] → semErros; variavel total 30; paralelo {workers: 2}` | `['1'] → total 0` |
| 14 | `pl-starmap` | starmap | médio | ler `k` e depois `k` linhas `base expoente`; `potencias = pool.starmap(pow, pares)` | `pares = [tuple(map(int, input().split())) for _ in range(k)]` | `['3','2 3','3 2','10 0'] → variavel potencias [8,9,1]`; `paralelo {workers: 2}`; `codigo 'starmap'` | `['1','5 2'] → [25]` |
| 15 | `pl-apply-async` | apply_async | médio | ler números numa linha; `fatoriais` com `apply_async(math.factorial, (n,))` para cada um e `.get()` | lista de `AsyncResult` e depois `[r.get() for r in ...]` | `['5 3 0'] → variavel fatoriais [120,6,1]`; `paralelo {workers: 2}`; `codigo 'apply_async'` | `['10'] → [3628800]` com `paralelo {workers: 1}` |
| 16 | `pl-imap` | imap na ordem | médio | ler `n`; para cada `x, c` em `zip(range(1, n + 1), pool.imap(cubo, range(1, n + 1)))` mostrar `x → c` | `print(f"{x} → {c}")` | `['3'] → saidaIgual '1 → 1\n2 → 8\n3 → 27'`; `paralelo {workers: 2}`; `codigo 'imap'` | `['1'] → '1 → 1'` com `paralelo {workers: 1}` |
| 17 | `pl-primos-paralelo` | Primos em paralelo | difícil | ler `n`; dividir `range(n)` em 4 intervalos (como no 2) e somar `pool.map(contar_primos, intervalos)` em `total` | `contar_primos(intervalo)` testa cada número do intervalo | `['100'] → variavel total 25`; `paralelo {workers: 2}` | `['10'] → 4`; `['2'] → 0` |

- [ ] **Step 4: Trilha, certificado e badge**

`src/conteudo/trilha.js`: importe `moduloParalelismo`, acrescente em `modulos` e tire `paralelismo` de `PROXIMOS_MODULOS`. Acrescente `CERTIFICADOS.paralelismo` e `BADGES.paralelismo` (valores acima), rode `npm run badges` e coloque o badge na capa (`svgCapa`) junto dos outros (os três em diagonal: `basico` em `(740, 40, 220)`, `dados` em `(870, 205, 220)`, `paralelismo` em `(740, 370, 220)`).

Run: `npm run badges && npx vitest run tests/conteudo.test.js -t "pl-"`
Expected: os 17 exercícios passam nos dois testes (solução aprova, código inicial reprova).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Paralelismo: 10 lições e exercícios 1 a 17, certificado e badge"
```

---

### Task 5: Módulo ⚡ Paralelismo — exercícios 18 a 35 e glossário

**Files:**
- Create: `src/conteudo/paralelismo-processos.js` (exercícios 18–35 em blocos `exerciciosFuturos`, `exerciciosFilas`, `exerciciosAsyncio`, `exerciciosConceitos`)
- Modify: `src/conteudo/paralelismo.js` (espalha os blocos depois das lições), `src/conteudo/glossario.js`, `tests/carga-horaria.test.js`

- [ ] **Step 1: Exercícios 18 a 35**

| # | id | título | dif. | o que pede | solução de referência | visíveis | ocultos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 18 | `pl-executor-submit` | submit e result | fácil | ler números numa linha; `dobros = [f.result() for f in futuros]` com `ProcessPoolExecutor` e `submit(dobro, x)` | `with ProcessPoolExecutor() as ex:` | `['1 2 3 4'] → variavel dobros [2,4,6,8]`; `paralelo {workers: 2}`; `codigo 'submit'` | `['7'] → [14]` com `paralelo {workers: 1}` |
| 19 | `pl-executor-map` | executor.map | fácil | ler palavras numa linha; `maiusculas = list(ex.map(str.upper, palavras))` | `ex.map` | `['umbu caju pequi'] → variavel maiusculas ["UMBU","CAJU","PEQUI"]`; `paralelo {workers: 2}` | `['ata'] → ["ATA"]` com `paralelo {workers: 1}` |
| 20 | `pl-as-completed` | as_completed | médio | ler números; `total` = soma de `quadrado(x)` recebidos com `as_completed` (a ordem não importa) | `sum(f.result() for f in as_completed(futuros))` | `['1 2 3'] → variavel total 14`; `codigo 'as_completed'`; `paralelo {workers: 2}` | `['10'] → 100` com `paralelo {workers: 1}` |
| 21 | `pl-erro-no-worker` | Erro no worker | médio | ler números; `raiz(x)` levanta `ValueError("número negativo")` se `x < 0`; com `pool.map`, mostrar a lista de raízes ou `Erro: <mensagem>` | `try/except ValueError as e` em volta do `map` | `['4 -1 9'] → saidaIgual 'Erro: número negativo'` | `['4 9'] → '[2.0, 3.0]'` |
| 22 | `pl-process-queue` | Process e Queue | difícil | ler `n`; dois `Process` somam `range(0, n // 2)` e `range(n // 2, n + 1)` e põem na mesma `Queue`; `total` = as duas somas | `q.get() + q.get()` e `join` | `['100'] → variavel total 5050`; `paralelo {workers: 2}`; `codigo 'Process'`; `codigo 'Queue'` | `['1'] → 1`; `['0'] → 0` |
| 23 | `pl-map-reduce-paralelo` | Map-reduce em paralelo | difícil | ler `textos.txt` (aba 📦 Dados, uma frase por linha); `pool.map(contar_palavras, linhas)` e juntar em `contagem` (chaves em ordem alfabética) | `contar_palavras` do 5 e soma com `Counter` | dados `sol e mar · mar azul · sol` → `variavel contagem {"azul":1,"e":1,"mar":2,"sol":2}`; `paralelo {workers: 2}` | dados `a b · b` → `{"a":1,"b":2}` |
| 24 | `pl-chunksize` | Tamanho do lote | médio | ler `n`; `soma = sum(pool.map(dobro, range(n), chunksize=100))` | `chunksize=100` | `['1000'] → variavel soma 999000`; `paralelo {tarefas: 10}`; `codigo 'chunksize'` | `['250'] → 62250` com `paralelo {tarefas: 3}` |
| 25 | `pl-async-dobro` | gather | fácil | ler números; `async def dobro(x)` com `await asyncio.sleep(0)`; `resultados = asyncio.run(main(numeros))`, com `main` usando `gather` | `return await asyncio.gather(*(dobro(x) for x in numeros))` | `['1 2 3'] → variavel resultados [2,4,6]`; `codigo 'gather'`; `codigo 'async def'` | `['5'] → [10]` |
| 26 | `pl-async-ordem` | Quem termina primeiro | médio | ler `nome:tempo` numa linha; `baixar(nome, tempo)` dorme `tempo / 20` s e mostra o nome ao terminar; depois mostrar a lista que o `gather` devolveu | o `gather` devolve na ordem dos argumentos; os `print` saem na ordem em que terminam | `['c:3 a:1 b:2'] → saidaIgual 'a\nb\nc\n[\'c\', \'a\', \'b\']'` | `['x:1'] → 'x\n[\'x\']'` |
| 27 | `pl-create-task` | create_task | fácil | ler `a` e `b`; `total = asyncio.run(main(a, b))`, em que `main` cria duas tarefas com `asyncio.create_task(dobro(...))` e soma | `t1 = asyncio.create_task(...)`; `return await t1 + await t2` | `['2','3'] → variavel total 10`; `codigo 'create_task'` | `['0','0'] → 0` |
| 28 | `pl-corrida-lock` | Conserte a corrida | médio | o código inicial faz `n` depósitos com `x = saldo; await asyncio.sleep(0); saldo = x + 1` e perde atualizações; use `asyncio.Lock` para chegar a `saldo == n` | `async with trava:` em volta das três linhas | `['100'] → variavel saldo 100`; `codigo 'Lock'` | `['7'] → 7` |
| 29 | `pl-semaforo` | No máximo k ao mesmo tempo | difícil | ler `k` e `n`; `n` tarefas que contam quantas estão rodando juntas; com `asyncio.Semaphore(k)`, `maximo_simultaneo` (o maior número visto) tem de ser `k` | contador `ativos` dentro do `async with sem:`, `await asyncio.sleep(0.01)` | `['2','6'] → variavel maximo_simultaneo 2`; `codigo 'Semaphore'` | `['3','10'] → 3` |
| 30 | `pl-wait-for` | Tempo limite | médio | ler `limite` (segundos) e `duracao`; `lento()` dorme `duracao`; com `asyncio.wait_for`, mostrar `Pronto` ou `Demorou demais` | `except TimeoutError` | `['0.05','0.5'] → saidaIgual 'Demorou demais'`; `codigo 'wait_for'` | `['1','0.05'] → 'Pronto'` |
| 31 | `pl-produtor-consumidor` | Produtor e consumidor | difícil | ler `n`; um produtor põe `1..n` e depois `None` numa `asyncio.Queue`; o consumidor guarda o quadrado de cada número até o `None`; `consumidos` é a lista | `await fila.put(...)` / `await fila.get()` e `gather(produtor, consumidor)` | `['4'] → variavel consumidos [1,4,9,16]`; `codigo 'asyncio.Queue'` | `['0'] → []` |
| 32 | `pl-escolher` | Processo ou asyncio? | fácil | `escolher_ferramenta(tipo)`: `"cpu"` → `"processos"`, `"io"` → `"asyncio"`, outro → `ValueError` | `if/elif/raise` | `["cpu"] → "processos"`; `["io"] → "asyncio"` | `["gpu"]` → `erro ValueError` |
| 33 | `pl-vale-paralelizar` | Vale a pena paralelizar? | médio | `vale_paralelizar(t, n, workers, custo)` → `True` se `ceil(n / workers) * t + n * custo` for **menor** que `n * t` | `math.ceil` | `[1,100,4,0.01] → true` | `[0.001,100,4,0.01] → false`; `[1,1,4,0] → false` |
| 34 | `pl-tempo-estimado` | Tempo total estimado | difícil | `tempo_estimado(tempos, workers)`: cada tarefa, na ordem, vai para o worker com menos trabalho acumulado; devolve o maior total | lista de cargas e `min` | `[[4,3,2,1],2] → 5` | `[[],3] → 0`; `[[5],3] → 5`; `[[1,1,1,1],2] → 2` |
| 35 | `pl-vendas-paralelo` | Vendas por região em paralelo | difícil | ler `vendas.csv` (`regiao,valor`); dividir as linhas em partes (o 1), somar cada parte por região com `pool.map` e juntar; mostrar `Região: total` (2 casas), em ordem alfabética | `defaultdict(float)` por parte e soma das partes | dados `Nordeste,10.5 · Sul,4 · Nordeste,9.5 · Norte,1` → `saidaIgual 'Nordeste: 20.00\nNorte: 1.00\nSul: 4.00'`; `paralelo {workers: 2}` | dados `Sul,1 · Sul,2` → `'Sul: 3.00'` com `paralelo {workers: 1}` |

Ordem na trilha: `licao-dividir` (1, 2), `licao-particoes` (3, 4, 8), `licao-map-reduce` (5, 6, 7), `licao-speedup` (9, 10, 11, 33, 34), `licao-processos` (12, 13, 14, 15, 16, 17, 24), `licao-futures` (18, 19, 20, 21), `licao-processo-fila` (22, 23, 35), `licao-asyncio` (25, 26, 27, 30, 31), `licao-corrida` (28, 29), `licao-gil-threads` (32).

Dificuldades: fácil 2, 5, 9, 11, 12, 13, 18, 19, 25, 27, 32 (11); difícil 17, 22, 23, 29, 31, 34, 35 (7); os outros 17 são médios. Carga: 19 h (Task 4).

- [ ] **Step 2: Glossário**

Bloco `// ---------- Paralelismo ----------` em `src/conteudo/glossario.js`, com `INICIO_DO_NIVEL.paralelismo = 'paralelismo'`: `paralelismo`, `particao` (Partição), `map-reduce` (Map-reduce), `processo` (Processo e Pool), `main-guarda` (`if __name__ == "__main__"`), `serializar` (Serializar / pickle), `asyncio` (asyncio e await), `condicao-corrida` (Condição de corrida), `lock` (Lock), `semaforo` (Semáforo), `gil` (GIL), `speedup` (Speedup), `amdahl` (Lei de Amdahl), `skew` (Desequilíbrio / skew). Formato existente (`id, termo, padroes, definicao, analogia, exemplo`).

- [ ] **Step 3: Rodar**

`tests/carga-horaria.test.js`: caso do `paralelismo` igual aos outros.

Run: `npx vitest run && npx eslint . && python -m pytest -q`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Paralelismo: exercícios 18 a 35 (futures, filas, asyncio e conceitos) e glossário"
```

---

### Task 6: Versão 0.3.0, textos e publicação

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/novidades.js`, `README.md`, `src/ui/declaracao-acessibilidade.js`, `src/ui/tutorial-passos.js` (o passo da trilha cita o ⚡ Paralelismo, se ele falar dos módulos publicados)

- [ ] **Step 1: Versão e textos**

`"version": "0.3.0"`. `src/novidades.js`, no topo:

```js
  {
    versao: '0.3.0',
    data: '2026-10-13', // a data do dia da publicação
    titulo: 'Paralelismo de verdade',
    resumo: 'O terceiro módulo: processos que rodam ao mesmo tempo nos núcleos do seu computador, asyncio e condições de corrida.',
    grupos: [
      { titulo: '⚡ Paralelismo', itens: ['10 lições e 35 exercícios: dividir o trabalho, partições, map-reduce, Pool, ProcessPoolExecutor, Process e Queue, asyncio, Lock, speedup e Lei de Amdahl.', 'Certificado Paralelismo em Python.'] },
      { titulo: '🧵 Processos no navegador', itens: ['multiprocessing e concurrent.futures funcionam como no Python, com workers de verdade.', 'Sem o if __name__ == "__main__": o erro é o mesmo do Python real.', 'A barra de status mostra quantas tarefas rodaram em quantos workers.'] },
      { titulo: '♿ Acessibilidade', itens: ['Onde o navegador não roda Python em paralelo, o terminal e o leitor de tela avisam que as tarefas rodaram em sequência.'] },
    ],
  },
```

`README.md`: ⚡ Paralelismo sai de "Em breve" e entra em "O que tem"; a seção "Paralelismo" passa a descrever `multiprocessing`/`concurrent.futures` sobre o pool, a regra do `__main__`, `asyncio`, threads (erro do Pyodide), `Value`/`Array` (conceito) e workers ociosos; a regra `paralelo` entra na tabela de regras.

`declaracao-acessibilidade.js`, "Limites conhecidos": o item do JSPI passa a dizer que `asyncio.run` também depende dele; `ATUALIZADA_EM` com a data do dia.

- [ ] **Step 2: Auditoria**

Run: `npx eslint . && npx vitest run && python -m pytest -q && CERTIFICADO_SEGREDO=<valor aleatório descartável> npm run build`
Expected: tudo verde, build sem avisos.

No navegador (build + preview): `#/p/pl-pool-map` com a solução (Executar → status com "⚡ … tarefas em … workers", Enviar → Aceito), `#/p/pl-sem-main` (código inicial → `RuntimeError` no terminal), `#/p/pl-corrida-lock`, `#/livre` com um `Pool.map`; axe-core sem violações nos 4 temas a 1280 px e a 320 px em `#/`, `#/trilha`, `#/p/licao-processos`, `#/p/pl-pool-map`, `#/p/pl-vendas-paralelo` (aba 📦 Dados aberta) e `#/livre`.

- [ ] **Step 3: Pedir o "sim" do usuário**

Mostre o resumo (o que entra na 0.3.0, testes e auditoria) e pergunte se pode publicar. Não siga sem o "sim".

- [ ] **Step 4: Publicar (depois do "sim")**

```bash
git checkout main && git merge --ff-only fase-3 && git push origin main
gh run watch $(gh run list -R sertaoseracloud/python-playground --limit 1 --json databaseId -q '.[0].databaseId') -R sertaoseracloud/python-playground --exit-status
git tag -a v0.3.0 -m "Versão 0.3.0" && git push --follow-tags
gh release create v0.3.0 -R sertaoseracloud/python-playground --verify-tag --title "v0.3.0 · Paralelismo" --notes-file ../notas-0.3.0.md
```

(confira que o run acompanhado é o do commit novo; `../notas-0.3.0.md` com o título e os três grupos da entrada 0.3.0.)

- [ ] **Step 5: Conferir o site publicado**

`curl -s https://sertaoseracloud.github.io/python-playground/ | grep -o "115 exercícios"` e, no navegador, `#/p/pl-pool-map`: Enviar com a solução → "Aceito! 🎉" e status com os workers.
