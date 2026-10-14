// Roda o Python fora da thread da página: um laço infinito trava só o worker, que o
// motor encerra e recria (veja motor.js). O pool de workers paralelos (pool.js) também
// fica aqui e só abre na primeira vez que o código pede paralelismo.
import { carregarPython } from './carregar.js';
import { criarSessao } from './sessao.js';
import { PoolPython } from './pool.js';

// No dev o Vite serve o Pyodide em /pyodide/; no build ele fica em dist/pyodide/ (copiado pelo
// plugin do vite.config.js, por isso o Vite não acha a pasta: @vite-ignore).
const indexURL = import.meta.env.DEV ? '/pyodide/' : new URL(/* @vite-ignore */ '../pyodide/', import.meta.url).href;
// O pool só abre workers quando recebe tarefa. Enquanto eles carregam, o motor para o relógio (veja motor.js).
const pool = new PoolPython({ aoAbrir: (abrindo) => postMessage({ tipo: abrindo ? 'pool-abrindo' : 'pool-pronto' }) });
const sessao = carregarPython({ indexURL }).then((pyodide) => criarSessao(pyodide, { pool }));

sessao.then(
  () => postMessage({ tipo: 'pronto' }),
  (erro) => postMessage({ tipo: 'falha', erro: String(erro?.message ?? erro) }),
);

const esperando = new Map(); // id → resolve da resposta do input()

onmessage = async ({ data }) => {
  if (data.tipo === 'resposta-entrada') {
    esperando.get(data.id)?.(data.texto);
    esperando.delete(data.id);
    return;
  }
  // A saída ao vivo vai para a página em blocos de até 30 ms (um print por mensagem seria lento).
  let pendente = '';
  let timer = null;
  const despejar = () => {
    clearTimeout(timer);
    timer = null;
    if (pendente) postMessage({ tipo: 'saida', id: data.id, texto: pendente });
    pendente = '';
  };
  const opcoes = {
    ...data.opcoes,
    aoSaida: (texto) => { pendente += texto; timer ??= setTimeout(despejar, 30); },
    aoPedirEntrada: data.opcoes?.interativo
      ? () => { despejar(); postMessage({ tipo: 'entrada', id: data.id }); return new Promise((r) => esperando.set(data.id, r)); }
      : undefined,
  };
  try {
    const s = await sessao;
    const resultado = data.tipo === 'repl' ? await s.repl(opcoes) : await s.executar(data.arquivos, opcoes);
    despejar();
    postMessage({ tipo: 'resposta', id: data.id, ...resultado });
  } catch (erro) {
    despejar();
    postMessage({ tipo: 'resposta', id: data.id, erroInterno: String(erro?.message ?? erro) });
  }
};
