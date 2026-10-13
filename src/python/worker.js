// Roda o Python fora da thread da página: um laço infinito trava só o worker, que o
// motor encerra e recria (veja motor.js).
import { carregarPython } from './carregar.js';
import { criarSessao } from './sessao.js';

// No dev o Vite serve o Pyodide em /pyodide/; no build ele fica em dist/pyodide/.
const indexURL = import.meta.env.DEV ? '/pyodide/' : new URL('../pyodide/', import.meta.url).href;
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
