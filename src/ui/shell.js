// O shell do terminal: interpreta os comandos (python, ls, cat, clear, help, pip) e conversa
// com o motor. O input() do programa é lido no próprio terminal; sem JSPI, o programa roda de
// novo com as respostas já dadas e só a saída nova aparece.
import { Cancelado } from './terminal.js';
import { Interrompido } from '../python/motor.js';

const AJUDA = `Comandos:
  python <arquivo> [argumentos]   roda o arquivo (os argumentos vão para sys.argv)
  python -i <arquivo>             roda e continua no modo interativo (>>>)
  python                          modo interativo do Python; exit() ou Ctrl+D para sair
  ls                              lista os arquivos do exercício
  cat <arquivo>                   mostra um arquivo
  clear                           limpa o terminal (Ctrl+L)
Teclas: ↑/↓ histórico · Tab completa · Ctrl+C interrompe · Ctrl+D fim da entrada · Esc sai do terminal
`;

const COMANDOS = ['python', 'ls', 'cat', 'clear', 'help', 'pip'];
const ESPERA_EOF_MS = 1000;
const AVISO_SEM_JSPI ='(neste navegador o programa roda de novo a cada resposta do input(): o resultado é o mesmo)\n';

/** Divide a linha em palavras, respeitando aspas simples e duplas. */
export function dividir(linha) {
  const partes = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(linha))) partes.push(m[1] ?? m[2] ?? m[3]);
  return partes;
}

export function criarShell({
  terminal, motor, arquivos, pasta,
  semJSPI = !('Suspending' in WebAssembly), aoTerminar = () => {}, aoErro = (erro) => { throw erro; },
}) {
  let ativo = false;
  let parando = false;
  let laco = null;
  let rodando = 0; // programas ou linhas do REPL em execução

  const prompt = () => `aluno@sertao:~/${pasta()}$ `;
  const escreverResultado = (r, jaMostrado = 0) => {
    if (r.saida && r.saida.length > jaMostrado) terminal.escrever(r.saida.slice(jaMostrado));
    if (r.erro) terminal.escrever(r.erro.traceback, 'erro');
  };

  // Ctrl+C com o programa rodando (sem leitura aberta): o motor recria o worker.
  terminal.aoInterromper = () => { if (rodando) motor.interromper?.(); };

  /**
   * A resposta de um input(): o prompt é o fim da última linha da saída (fica na mesma linha).
   * Ctrl+C interrompe (o worker é recriado); parar() responde com EOF, e o programa termina
   * sozinho, sem recarregar o Python.
   */
  let lendoEntrada = false;
  async function lerEntrada({ focar = false } = {}) {
    const leitura = terminal.ler({ rotulo: 'Resposta para o input()', historico: false });
    if (focar) terminal.focar();
    lendoEntrada = true;
    try {
      return await leitura;
    } catch (erro) {
      if (!(erro instanceof Cancelado)) throw erro;
      if (parando) return null;
      motor.interromper?.();
      throw erro;
    } finally {
      lendoEntrada = false;
    }
  }

  /** O programa foi parado (parar()): no lugar do resultado dele, só o KeyboardInterrupt. */
  const descartar = () => {
    terminal.escrever('KeyboardInterrupt\n', 'erro');
    return null;
  };

  /** Os ganchos de uma execução com saída ao vivo; `contar` soma o que já está na tela. */
  function ganchosAoVivo(contar, opcoes) {
    if (semJSPI) return {};
    return {
      aoSaida: (texto) => { terminal.escrever(texto); contar(texto.length); },
      aoPedirEntrada: async () => {
        const resposta = await lerEntrada(opcoes);
        if (resposta !== null) contar(resposta.length + 1);
        return resposta;
      },
    };
  }

  async function comInterrupcao(tarefa) {
    rodando++;
    try {
      return await tarefa();
    } catch (erro) {
      if (erro instanceof Interrompido || erro instanceof Cancelado) {
        terminal.escrever('KeyboardInterrupt\n', 'erro');
        return null;
      }
      throw erro;
    } finally {
      rodando--;
    }
  }

  /**
   * Roda um arquivo como `python arquivo argv...`. `eco` escreve o comando como se tivesse
   * sido digitado (o ▶ Executar); `focar` põe o foco no terminal quando o programa pede input().
   */
  async function executarPrograma(arquivo = 'main.py', argv = [], { interativoDepois = false, eco = false, focar = false } = {}) {
    if (eco) terminal.escrever(`${prompt()}python ${interativoDepois ? '-i ' : ''}${[arquivo, ...argv].join(' ')}\n`);
    if (!(arquivo in arquivos())) {
      terminal.escrever(`python: can't open file '${arquivo}': [Errno 2] No such file or directory\n`, 'erro');
      return null;
    }
    const r = await comInterrupcao(async () => {
      const entrada = [];
      let mostrado = 0;
      const contar = (n) => { mostrado += n; };
      for (let avisado = false; ;) {
        const resultado = await motor.executar(arquivos(), { principal: arquivo, argv, interativo: true, entrada, semJSPI }, ganchosAoVivo(contar, { focar }));
        if (parando) return descartar();
        if (!resultado.precisa_entrada) {
          escreverResultado(resultado, mostrado);
          return resultado;
        }
        // Sem JSPI: mostra a saída nova, pede a resposta e roda de novo com todas as respostas.
        if (!avisado) terminal.escrever(AVISO_SEM_JSPI, 'aviso');
        avisado = true;
        terminal.escrever(resultado.saida.slice(mostrado));
        mostrado = resultado.saida.length;
        const resposta = await lerEntrada({ focar });
        entrada.push(resposta); // null = Ctrl+D: o Python dá EOFError
        if (resposta !== null) mostrado += resposta.length + 1;
      }
    });
    if (r) aoTerminar(r);
    if (interativoDepois) await repl({ doPrograma: true });
    return r;
  }

  /** O >>> do Python, até exit(), quit() ou Ctrl+D. */
  async function repl({ doPrograma = false } = {}) {
    await motor.repl({ acao: 'iniciar', doPrograma });
    if (!doPrograma) terminal.escrever('Python 3.14 (Pyodide) no seu navegador · exit() ou Ctrl+D para sair\n');
    let continua = false;
    for (;;) {
      let linha;
      try {
        linha = await terminal.ler({ prompt: continua ? '... ' : '>>> ', rotulo: 'Linha do Python (>>>)' });
      } catch (erro) {
        if (!(erro instanceof Cancelado) || parando) return; // parar(): trocar de exercício, ▶ Executar
        terminal.escrever('KeyboardInterrupt\n', 'erro');
        continua = false;
        continue;
      }
      if (linha === null || (!continua && /^\s*(exit|quit)\(\)\s*$/.test(linha))) return;
      let mostrado = 0;
      const r = await comInterrupcao(() => motor.repl(
        { acao: 'linha', texto: linha, interativo: !semJSPI },
        ganchosAoVivo((n) => { mostrado += n; }, {}),
      ));
      if (!r) return; // Ctrl+C no meio de uma linha: o Python foi reiniciado e o escopo do >>> se perdeu
      if (parando) return void descartar();
      escreverResultado(r, mostrado);
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
      if (texto === undefined) return terminal.escrever(`cat: ${args[0] ?? ''}: No such file or directory\n`, 'erro');
      return terminal.escrever(texto.endsWith('\n') || !texto ? texto : `${texto}\n`);
    }
    if (comando === 'pip' || comando === 'pip3') {
      return terminal.escrever('No DivergePython não dá para instalar pacotes: o Python roda no seu navegador, com a biblioteca padrão.\n');
    }
    if (comando === 'python' || comando === 'python3') {
      if (!args.length) return repl();
      if (args[0] === '-i') return executarPrograma(args[1] ?? 'main.py', args.slice(2), { interativoDepois: true });
      return executarPrograma(args[0], args.slice(1));
    }
    terminal.escrever(`bash: ${comando}: command not found\n`, 'erro');
  }

  // Comandos chamados de fora do laço (o ▶ Executar): parar() espera por eles.
  const emCurso = new Set();
  function acompanhar(tarefa) {
    parando = false;
    const promessa = tarefa();
    emCurso.add(promessa);
    promessa.finally(() => emCurso.delete(promessa)).catch(() => {});
    return promessa;
  }

  /** O laço do prompt, até parar(). */
  function iniciar() {
    if (laco) return laco;
    ativo = true;
    parando = false;
    laco = (async () => {
      while (ativo) {
        let linha;
        try {
          linha = await terminal.ler({ prompt: prompt(), rotulo: 'Comando do terminal' });
        } catch (erro) {
          if (erro instanceof Cancelado) continue;
          throw erro;
        }
        if (linha === null) continue;
        try {
          await rodar(linha);
        } catch (erro) {
          aoErro(erro);
        }
      }
    })().finally(() => { laco = null; });
    return laco;
  }

  return {
    rodar: (linha) => acompanhar(() => rodar(linha)),
    iniciar,
    executarPrograma: (...args) => acompanhar(() => executarPrograma(...args)),
    get rodando() { return rodando > 0; },
    /**
     * Para o laço, cancela a leitura aberta (o >>> sai) e interrompe o programa em andamento;
     * só resolve depois que tudo terminou de escrever (o KeyboardInterrupt sai antes de limpar).
     */
    async parar() {
      ativo = false;
      parando = true;
      const esperavaEntrada = lendoEntrada;
      terminal.cancelarLeitura();
      // Esperando um input(): o EOF já faz o programa terminar; se ele não terminar logo
      // (um laço que ignora o EOFError), o Python é reiniciado.
      let reserva;
      if (rodando && !esperavaEntrada) motor.interromper?.();
      else if (rodando) reserva = setTimeout(() => { if (rodando) motor.interromper?.(); }, ESPERA_EOF_MS);
      await Promise.allSettled([laco, ...emCurso]);
      clearTimeout(reserva);
    },
    completar(texto) {
      const palavras = dividir(texto);
      const nova = texto.endsWith(' ') || !texto;
      const ultima = nova ? '' : palavras.pop() ?? '';
      const antes = palavras.length ? `${palavras.join(' ')} ` : '';
      const opcoes = palavras.length ? Object.keys(arquivos()).sort() : COMANDOS;
      return opcoes.filter((o) => o.startsWith(ultima)).map((o) => antes + o);
    },
  };
}
