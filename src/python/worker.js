// Roda o Python fora da thread da página: um laço infinito trava só o worker, que o
// motor encerra e recria (veja motor.js). O pool de workers paralelos (pool.js) também
// fica aqui e só abre na primeira vez que o código pede paralelismo.
import { carregarPython } from './carregar.js';
import { criarSessao } from './sessao.js';
import { PoolPython } from './pool.js';

// No dev o Vite serve o Pyodide em /pyodide/; no build ele fica em dist/pyodide/ (copiado pelo
// plugin do vite.config.js, por isso o Vite não acha a pasta: @vite-ignore).
const indexURL = import.meta.env.DEV ? '/pyodide/' : new URL(/* @vite-ignore */ '../pyodide/', import.meta.url).href;
let pool;
// Enquanto os workers do pool carregam, o motor para o relógio (veja motor.js).
const aoAbrir = (abrindo) => postMessage({ tipo: abrindo ? 'pool-abrindo' : 'pool-pronto' });
const mapear = (tarefas) => (pool ??= new PoolPython()).mapear(tarefas, { aoAbrir });
const sessao = carregarPython({ indexURL }).then((pyodide) => criarSessao(pyodide, { mapear }));

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
