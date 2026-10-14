// Tela de uma lição, problema ou do playground livre.
import { minutosDoItem } from '../cargaHoraria.js';
import { buscarItem, modulos, vizinhos, DIFICULDADES } from '../conteudo/trilha.js';
import { TempoEsgotado } from '../python/motor.js';
import { linkItem, linkCompartilhado } from '../compartilhar.js';
import { htmlDosDados } from './dados.js';
import { corrigir, textoDaChamada } from '../corrigir.js';
import {
  statusDe, marcar, lerRascunho, gravarRascunho, apagarRascunho, lerHistorico, gravarHistorico,
} from '../progresso.js';
import { criarTerminal } from './terminal.js';
import { criarShell } from './shell.js';
import { EditorArquivos } from './editor.js';
import { iniciarLeitura } from './acessibilidade.js';
import { aplicarChecklist } from './neuro.js';
import { termosDoTexto } from '../conteudo/glossario.js';
import { descreverRegra, categoriaDe } from '../verificacoes.js';
import { jornadaAtual, certificadosDaJornada } from './inicio.js';
import { CERTIFICADOS } from '../certificados.js';
import { LIMITE_DESBLOQUEIO } from '../gamificacao.js';
import { $, esc } from './util.js';
import { anunciar, falaDosTestes, leitorDeTela, frase } from './anuncios.js';
import { solucaoLiberada, minutosQueFaltam, criarCronometro } from './solucao.js';

const semPressao = () => document.documentElement.classList.contains('a11y-sem-pressao');

export function criarTelaItem({ motor, layout, definirStatus, aoMudarProgresso }) {
  const el = {
    anterior: $('item-anterior'),
    proximo: $('item-proximo'),
    modulo: $('item-modulo'),
    titulo: $('item-titulo'),
    dificuldade: $('item-dificuldade'),
    status: $('item-status'),
    executar: $('btn-executar'),
    enviar: $('btn-enviar'),
    restaurar: $('btn-restaurar'),
    compartilhar: $('btn-compartilhar'),
    abaSolucao: $('aba-solucao'),
    abaTestes: $('aba-testes'),
    resumoTestes: $('resumo-testes'),
    enunciado: $('desc-enunciado'),
    solucao: $('desc-solucao'),
    testes: $('saida-testes'),
    terminal: $('saida-terminal'),
  };

  const estado = { item: null, pythonPronto: false, ocupado: false, origem: null, vez: 0 };

  let salvarTimer;
  const editor = new EditorArquivos({
    abas: $('abas-arquivos'),
    editor: $('editor'),
    aoExecutar: () => executarPeloAluno(),
    aoEnviar: () => enviar(),
    aoMudar: (arquivos) => {
      clearTimeout(salvarTimer);
      const id = estado.item.id;
      salvarTimer = setTimeout(() => gravarRascunho(id, arquivos), 300);
    },
  });

  // 🖥️ O terminal: o shell (python, ls, cat...) com os arquivos do editor e os dados do exercício.
  const arquivosDoTerminal = () => ({ ...editor.arquivos, ...(estado.item?.dados ?? {}) });
  const terminal = criarTerminal($('terminal'), {
    historico: lerHistorico(),
    aoMudarHistorico: gravarHistorico,
    completar: (texto) => shell.completar(texto),
  });
  const shell = criarShell({
    terminal,
    motor,
    arquivos: arquivosDoTerminal,
    pasta: () => estado.item?.id ?? 'livre',
    aoTerminar: (r) => aoTerminarPrograma(r),
    aoErro: (erro) => tratarErro(erro),
  });

  // 🔊 Ouvir: lê a aba visível do painel de descrição.
  const leitura = iniciarLeitura($('btn-ouvir'), () =>
    [el.titulo.textContent, ...Object.values(paineisDescricao()).filter((p) => !p.hidden).map((p) => p.innerText)].join('. '));
  const paineisDescricao = () => paineisDesc;

  const ehProblema = () => estado.item?.tipo === 'problema';
  const ehLivre = () => estado.item?.tipo === 'livre';

  // ---------- abas ----------
  const paineisDesc = { enunciado: el.enunciado, solucao: el.solucao, dados: $('desc-dados'), testes: $('desc-testes') };
  function mostrarDesc(nome) {
    for (const [chave, painel] of Object.entries(paineisDesc)) painel.hidden = chave !== nome;
    document.querySelectorAll('[data-desc]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.desc === nome);
      b.setAttribute('aria-selected', String(b.dataset.desc === nome));
    });
  }
  document.querySelectorAll('[data-desc]').forEach((b) => { b.onclick = () => mostrarDesc(b.dataset.desc); });

  // ---------- aba Solução: só depois do tempo estimado e se não resolvido (veja solucao.js) ----------
  function avisoDaSolucao(item) {
    if (item?.tipo !== 'problema' || solucaoLiberada(item) || statusDe(item.id) === 'resolvido') return '';
    const quando = semPressao()
      ? 'depois de um tempo tentando'
      : `depois de ~${minutosDoItem(item)} min tentando (faltam ${minutosQueFaltam(item)} min)`;
    return `<p class="licao-chip aviso-solucao" id="aviso-solucao">🔒 A solução aparece ${quando}. Tentar antes é o que faz aprender.</p>`;
  }

  function atualizarSolucao({ avisar = false } = {}) {
    const item = estado.item;
    if (!item) return;
    const liberada = solucaoLiberada(item);
    const estava = !el.abaSolucao.hidden;
    el.abaSolucao.hidden = !liberada;
    if (!liberada && !paineisDesc.solucao.hidden) mostrarDesc('enunciado');
    const aviso = document.getElementById('aviso-solucao');
    if (aviso) aviso.outerHTML = avisoDaSolucao(item);
    if (liberada && !estava && avisar) anunciar('A solução deste exercício está disponível na aba Solução.');
  }

  // Conta o tempo de tentativa só com a tela do exercício na frente.
  const cronometro = criarCronometro({
    ativo: () => Boolean(estado.item) && !el.titulo.closest('[hidden]'),
    aoMudar: () => atualizarSolucao({ avisar: true }),
  });

  function mostrarSaida(nome) {
    document.querySelectorAll('[data-saida-painel]').forEach((p) => { p.hidden = p.dataset.saidaPainel !== nome; });
    document.querySelectorAll('[data-saida]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.saida === nome);
      b.setAttribute('aria-selected', String(b.dataset.saida === nome));
    });
  }
  document.querySelectorAll('[data-saida]').forEach((b) => { b.onclick = () => mostrarSaida(b.dataset.saida); });

  // ---------- descrição e solução ----------
  function renderDescricao() {
    const item = estado.item;
    const moduloNoCaminho = jornadaAtual().modulos.find((m) => m.id === item.modulo);
    const avisoBloqueio = moduloNoCaminho && !moduloNoCaminho.desbloqueado ? `
      <div class="etapa-info">🔒 Este módulo ainda está bloqueado no caminho: resolva ${LIMITE_DESBLOQUEIO}% do módulo anterior.
        Você pode praticar aqui, mas siga a trilha na ordem para aproveitar melhor.</div>` : '';
    if (item.tipo !== 'problema') {
      el.enunciado.innerHTML = avisoBloqueio + item.resumo + glossario(item, item.titulo, item.resumo);
      aplicarChecklist(el.enunciado, item.id);
      return;
    }
    const etapa = item.projeto ? `
      <div class="etapa-info">
        <p><b>${esc(item.projeto.icone)} ${esc(item.projeto.titulo)}</b> · etapa ${item.etapa} de ${item.totalEtapas}</p>
        ${estado.origem === 'aluno'
          ? `<p>Você continua do <b>seu código</b> da etapa anterior.
              <button class="btn btn-fantasma btn-pequeno" id="btn-referencia">Usar o código de referência</button></p>`
          : item.etapaAnterior ? '<p>O código inicial é a solução de referência da etapa anterior.</p>' : ''}
      </div>` : '';
    const ocultos = item.testes.filter((t) => t.oculto).length;
    el.enunciado.innerHTML = `
      ${avisoBloqueio}
      ${etapa}
      <ol class="roteiro" aria-label="Como resolver" tabindex="0">
        <li>Leia o que fazer</li><li>Faça uma parte</li><li>▶ Executar</li><li>Confira os ✅</li><li>⬆ Enviar</li>
      </ol>
      <section class="secao secao-fazer"><h2>🎯 O que fazer</h2>${item.enunciado}</section>
      ${glossario(item, item.titulo, item.enunciado, item.dica)}
      ${comoConferir(item.testes)}
      ${ocultos ? `<p class="licao-chip">+ ${ocultos} caso(s) oculto(s) rodam quando você clica em ⬆ Enviar. Eles usam outros dados, para conferir que o seu código não está "decorado".</p>` : ''}
      ${avisoDaSolucao(item)}
      <details><summary>💡 Dica</summary><p><code>${esc(item.dica)}</code></p></details>`;
    aplicarChecklist(el.enunciado, item.id);
    $('btn-referencia')?.addEventListener('click', () => {
      if (!confirm('Trocar o seu código pelo código de referência desta etapa?')) return;
      editor.carregar(item.arquivos);
      gravarRascunho(item.id, item.arquivos);
      estado.origem = 'referencia';
      renderDescricao();
      executar();
    });
  }

  /** "Como saber que deu certo": as regras dos casos visíveis, em linguagem simples. */
  function comoConferir(testes) {
    const blocos = testes.filter((t) => !t.oculto).map((t) => {
      const regras = t.regras.map(descreverRegra).filter(Boolean);
      if (!regras.length) return '';
      const soCodigo = t.regras.every((r) => 'codigo' in r);
      const onde = soCodigo ? 'No seu código'
        : t.entrada?.length ? `Respondendo <code>${esc(t.entrada.join(' / '))}</code> ao <code>input()</code>`
          : 'Ao executar';
      return `<p class="caso-exemplo"><span class="rotulo">${onde}:</span></p>
        <ul>${regras.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
    }).join('');
    return blocos ? `<section class="secao secao-conferir"><h2>✅ Como saber que deu certo</h2>${blocos}</section>` : '';
  }

  /** Palavras técnicas do desafio, cada uma com explicação, analogia e exemplo. */
  function glossario(item, ...textos) {
    const div = document.createElement('div');
    div.innerHTML = textos.join(' ');
    const termos = termosDoTexto(div.textContent, { modulo: item.modulo });
    if (!termos.length) return '';
    return `
      <section class="secao glossario">
        <h2>📚 Palavras técnicas</h2>
        <p class="glossario-ajuda">Toque numa palavra para ver o que ela significa, com uma comparação do dia a dia.</p>
        ${termos.map((t) => `
          <details class="termo">
            <summary><b>${esc(t.termo)}</b><span>${esc(t.definicao)}</span></summary>
            <p class="analogia"><span aria-hidden="true">🧠</span> <b>Pense assim:</b> ${esc(t.analogia)}</p>
            ${t.exemplo ? `<pre class="trecho exemplo-termo"><code>${esc(t.exemplo)}</code></pre>` : ''}
          </details>`).join('')}
      </section>`;
  }

  function renderSolucao() {
    const item = estado.item;
    el.solucao.innerHTML = `
      <p>Tente resolver sozinho antes! Se travar, veja a dica na aba Descrição.</p>
      <button class="btn btn-fantasma" id="btn-revelar">👀 Mostrar solução</button>`;
    $('btn-revelar').onclick = () => {
      el.solucao.innerHTML = `
        ${Object.entries(item.solucao).map(([nome, codigo]) => `<h2>${esc(nome)}</h2><pre class="codigo-solucao">${esc(codigo)}</pre>`).join('')}
        <button class="btn btn-roxo" id="btn-usar-solucao">Copiar para o editor</button>`;
      $('btn-usar-solucao').onclick = () => {
        if (!confirm('Substituir o seu código pela solução?')) return;
        editor.carregar(item.solucao);
        gravarRascunho(item.id, item.solucao);
        executar();
      };
    };
  }

  function renderCabecalho() {
    const item = estado.item;
    const modulo = modulos.find((m) => m.id === item.modulo);
    el.modulo.textContent = item.projeto
      ? `${item.projeto.icone} ${item.projeto.titulo} · ${item.etapa}/${item.totalEtapas}`
      : modulo ? `${modulo.icone} ${modulo.titulo}` : '🧪 Livre';
    el.titulo.textContent = item.titulo;
    el.dificuldade.className = item.tipo === 'problema' ? `dificuldade ${item.dificuldade}` : 'licao-chip';
    el.dificuldade.textContent = item.tipo === 'problema' ? DIFICULDADES[item.dificuldade] : item.tipo === 'licao' ? 'Lição' : '';
    const minutos = minutosDoItem(item);
    if (minutos) el.dificuldade.textContent += ` · ⏱ ~${minutos} min`;
    el.dificuldade.title = minutos ? `Tempo estimado: cerca de ${minutos} minutos (conta na carga horária do certificado)` : '';
    const status = statusDe(item.id);
    el.status.textContent = item.tipo === 'problema' && status === 'resolvido' ? '✅ Resolvido' : status === 'tentado' ? '◐ Tentado' : '';
    el.status.className = 'chip';
    el.status.hidden = !el.status.textContent;

    const { anterior, proximo } = ehLivre() ? {} : vizinhos(item.id);
    for (const [botao, alvo] of [[el.anterior, anterior], [el.proximo, proximo]]) {
      botao.classList.toggle('desativado', !alvo);
      botao.href = alvo ? linkItem(alvo.id) : '#';
      botao.title = alvo ? alvo.titulo : '';
      botao.hidden = ehLivre();
    }
  }

  // ---------- abrir ----------
  function abrir(id, arquivosCompartilhados) {
    const item = buscarItem(id);
    if (!item) return false;
    estado.item = item;
    estado.origem = null;
    let arquivos = arquivosCompartilhados ?? lerRascunho(id);
    // Etapa de projeto: quem resolveu a etapa anterior continua do próprio código.
    if (!arquivos && item.etapaAnterior && statusDe(item.etapaAnterior) === 'resolvido') {
      const anterior = lerRascunho(item.etapaAnterior);
      if (anterior) {
        arquivos = anterior;
        estado.origem = 'aluno';
        gravarRascunho(id, anterior);
      }
    }
    editor.carregar(arquivos ?? item.arquivos);

    renderCabecalho();
    renderDescricao();
    el.enviar.hidden = !ehProblema();
    el.abaSolucao.hidden = !solucaoLiberada(item);
    cronometro.iniciar(item);
    el.abaTestes.hidden = !ehProblema();
    $('aba-dados').hidden = !item.dados;
    paineisDesc.dados.innerHTML = item.dados ? htmlDosDados(item.dados) : '';
    layout.aplicar();
    leitura.parar();
    if (ehProblema()) {
      renderSolucao();
      renderTestesPendentes();
    }
    el.terminal.classList.remove('com-erro');
    mostrarDesc('enunciado');
    mostrarSaida('terminal');
    // O programa do exercício anterior (esperando um input(), por exemplo) é interrompido antes.
    if (estado.pythonPronto) executar({ limpar: true });
    else terminal.limpar();
    return true;
  }

  // ---------- execução ----------
  /** Depois de cada programa (pelo ▶ Executar ou digitado no terminal): avisos, status e progresso. */
  function aoTerminarPrograma(r) {
    el.terminal.classList.toggle('com-erro', Boolean(r.erro));
    if (r.erro?.tipo === 'EOFError') terminal.escrever('💡 O programa pediu um input() e recebeu Ctrl+D (fim da entrada).\n', 'aviso');
    const aviso = avisoSemParalelismo(r.paralelismo);
    if (aviso) terminal.escrever(`ℹ️ ${aviso}\n`, 'aviso');
    const paralelo = textoDoParalelismo(r.paralelismo);
    definirStatus(`Python 3.14 · ${r.erro ? r.erro.tipo : 'ok'} · ${r.ms ?? 0} ms${paralelo ? ` · ⚡ ${paralelo}` : ''}`, { falar: false });
    const item = estado.item;
    if (item?.tipo === 'licao' && !r.erro && !statusDe(item.id)) {
      marcar(item.id, 'resolvido');
      aoMudarProgresso();
    }
  }

  /** Onde não deu para rodar em paralelo, o resultado é o mesmo: o terminal (e a fala) explicam. */
  function avisoSemParalelismo(p) {
    if (!p?.tarefas || (p.disponivel && p.maximo >= 2)) return '';
    const motivo = p.disponivel ? 'Este computador abre só 1 worker' : 'Este navegador não roda Python em paralelo (falta o recurso JSPI)';
    return `${motivo}: as ${p.tarefas} tarefas rodaram uma depois da outra. O resultado é o mesmo, só mais devagar.`;
  }

  const textoDoParalelismo = (p) => (p?.tarefas
    ? `${p.tarefas} ${p.tarefas === 1 ? 'tarefa' : 'tarefas'} em ${p.workers} ${p.workers === 1 ? 'worker' : 'workers'}`
    : '');

  function tratarErro(erro) {
    const tempo = erro instanceof TempoEsgotado;
    const texto = tempo
      ? `⏱️ ${erro.message}\nVerifique se algum laço (for/while) nunca termina.`
      : `Erro interno do DivergePython: ${erro?.message ?? erro}`;
    terminal.escrever(`${texto}\n`, 'erro');
    el.terminal.classList.add('com-erro');
    mostrarSaida('terminal');
    definirStatus(tempo ? 'Tempo esgotado' : 'Erro ao executar', { falar: frase(texto) });
  }

  /** O resultado da execução, falado: a saída (curta) ou o erro com a linha. */
  function falaDoPython(r) {
    const paralelo = textoDoParalelismo(r.paralelismo);
    const extra = [paralelo && `Rodou ${paralelo}.`, avisoSemParalelismo(r.paralelismo)].filter(Boolean).join(' ');
    const texto = falaDoResultado(r);
    return extra ? `${texto} ${extra}` : texto;
  }

  function falaDoResultado(r) {
    if (r.erro) {
      const parou = frase(`O programa parou na linha ${r.erro.linha ?? 'desconhecida'} com ${r.erro.tipo}: ${r.erro.mensagem}`);
      return r.erro.tipo === 'EOFError' ? `${parou} O input recebeu o fim da entrada, com Control D.` : parou;
    }
    const linhas = (r.saida ?? '').trimEnd().split('\n').filter(Boolean);
    if (!linhas.length) return 'O programa rodou sem erros e não imprimiu nada.';
    const lidas = leitorDeTela() ? linhas.slice(0, 10) : linhas.slice(0, 2);
    return `O programa rodou sem erros. Saída: ${lidas.map(frase).join(' ')}${linhas.length > lidas.length ? ` E mais ${linhas.length - lidas.length} linhas no terminal.` : ''}`;
  }

  const executarNoMotor = (arquivos, opcoes) => motor.executar(arquivos, opcoes);

  /** Executar pedido pelo aluno (botão ou Ctrl+Enter): mostra a aba de testes com o resultado. */
  const executarPeloAluno = () => executar({ abrirTestes: true, falar: true });

  /** Abre a aba 🧪 Testes (e a descrição, se estiver oculta). */
  function abrirAbaTestes() {
    if (!ehProblema()) return;
    layout.mostrarDescricao();
    mostrarDesc('testes');
  }

  // ▶ Executar: (1) para o que estiver no terminal (um programa esperando input(), o >>>);
  // (2) roda os casos visíveis; (3) digita `python main.py` no terminal e roda, interativo;
  // (4) o terminal volta ao prompt. `falar`: só quando a pessoa pediu (botão ou atalho); as
  // execuções automáticas (abrir o exercício, restaurar) não interrompem o leitor de tela.
  async function executar({ abrirTestes = false, falar = false, limpar = false } = {}) {
    if (!estado.pythonPronto || !estado.item) return;
    const item = estado.item;
    const vez = ++estado.vez;
    const valendo = () => vez === estado.vez && estado.item === item;
    await shell.parar();
    if (!valendo()) return;
    if (limpar) terminal.limpar();
    definirStatus('Executando…', { falar: false });
    el.terminal.setAttribute('aria-busy', 'true');
    try {
      const comTestes = item.tipo === 'problema';
      const resultado = comTestes ? await rodarTestes({ incluirOcultos: false }) : null;
      if (!valendo()) return;
      if (comTestes && abrirTestes) abrirAbaTestes();
      el.terminal.setAttribute('aria-busy', 'false');
      const r = await shell.executarPrograma('main.py', [], { eco: true, focar: falar });
      if (!valendo() || !r) return;
      const fala = falaDoPython(r);
      if (falar) anunciar(comTestes ? `${fala} ${falarTestes(resultado, false, { codigoComErro: Boolean(r.erro) })}` : fala);
    } catch (erro) {
      if (valendo()) tratarErro(erro);
    } finally {
      el.terminal.setAttribute('aria-busy', 'false');
      if (vez === estado.vez) shell.iniciar();
    }
  }

  async function rodarTestes({ incluirOcultos }) {
    const item = estado.item;
    const resultado = await corrigir(item, { ...editor.arquivos }, executarNoMotor, { incluirOcultos });
    if (estado.item !== item) return resultado;
    renderTestes(resultado, incluirOcultos);
    return resultado;
  }

  // ---------- casos de teste ----------
  // Cada caso vira um card: o cenário (o comando, as respostas do input() e as
  // chamadas de função), o placar e cada verificação com categoria, o que o programa
  // fez e, se falhar, motivo e dica. Nos casos ocultos, os valores ficam escondidos.

  /** O cenário de um caso, como numa sessão de terminal. */
  function linhasDoCenario({ entrada = [], chamadas = [], dados = [] }, { ocultar = false } = {}) {
    return [
      ...(dados.length ? [`# dados deste caso: ${ocultar ? 'outros arquivos' : dados.join(', ')}`] : []),
      '$ python main.py',
      ...entrada.map((l) => `> ${ocultar ? '…' : l}`),
      ...chamadas.map((c) => `>>> ${ocultar ? c.replace(/\(.*\)/s, '(…)') : c}`),
    ];
  }

  const cenarioDoTeste = (t) => ({
    entrada: t.entrada ?? [],
    chamadas: t.regras.filter((r) => 'funcao' in r).map(textoDaChamada),
    dados: Object.keys(t.dados ?? {}),
  });

  const verificacoesPrevistas = (t) => t.regras.map((regra) => ({ mensagem: descreverRegra(regra) ?? 'Verificação no código', categoria: categoriaDe(regra) }));

  function itemVerificacao(r, situacao) {
    const marca = { ok: '✅', falha: '❌', pendente: '⏳' }[situacao];
    const extras = [
      r.obtido !== undefined && situacao !== 'pendente' ? `<span class="obtido"><b>Obtido:</b> <code>${esc(r.obtido)}</code></span>` : '',
      situacao === 'falha' && r.detalhe ? `<span class="detalhe"><b>Motivo:</b> ${esc(r.detalhe)}</span>` : '',
      situacao === 'falha' && r.dica ? `<span class="dica">💡 ${esc(r.dica)}</span>` : '',
    ].join('');
    return `
      <li class="verificacao ${situacao}">
        <span class="marca" aria-hidden="true">${marca}</span>
        <div>
          <span class="chip-categoria">${esc(r.categoria ?? 'Verificação')}</span>
          <span class="sr">${{ ok: 'passou', falha: 'falhou', pendente: 'ainda não rodou' }[situacao]}: </span>${esc(r.mensagem)}
          ${extras}
        </div>
      </li>`;
  }

  function cardCaso({ nome, teste, resultado }) {
    const oculto = Boolean(teste.oculto);
    const situacao = resultado ? (resultado.ok ? 'ok' : 'falha') : 'pendente';
    const icone = { ok: '✅', falha: '❌', pendente: '⏳' }[situacao];
    const descricao = oculto ? (resultado ? 'caso oculto' : 'rode ⬆ Enviar') : teste.descricao ?? 'código e saída';
    const cenario = resultado?.cenario ?? cenarioDoTeste(teste);
    const verificacoes = resultado
      ? resultado.resultados.map((r) => ({ ...r, situacao: r.ok ? 'ok' : 'falha' }))
      : verificacoesPrevistas(teste).map((r) => ({ ...r, situacao: 'pendente' }));
    const visiveis = oculto ? verificacoes.filter((r) => r.situacao === 'falha') : verificacoes;
    const passaram = verificacoes.filter((r) => r.situacao === 'ok').length;
    const placar = resultado
      ? `${passaram}/${verificacoes.length} verificações · ${resultado.ms} ms`
      : oculto ? '' : `${verificacoes.length} verificações`;
    return `
      <details class="caso ${situacao}" ${situacao === 'falha' ? 'open' : ''}>
        <summary>${icone} ${nome}<span class="url">${esc(descricao)}</span>${placar ? `<span class="placar">${placar}</span>` : ''}</summary>
        <div class="corpo-caso">
          <p class="rotulo-caso">Cenário${oculto ? ' (valores ocultos)' : ''}</p>
          <pre class="cenario">${linhasDoCenario(cenario, { ocultar: oculto }).map(esc).join('\n')}</pre>
          ${resultado?.erroExecucao && !oculto ? `<p class="erro-execucao">⛔ O Python parou com: <code>${esc(resultado.erroExecucao)}</code></p>` : ''}
          ${visiveis.length ? `<p class="rotulo-caso">${resultado ? 'Verificações' : 'O que este caso confere'}</p>
          <ul class="verificacoes">${visiveis.map((r) => itemVerificacao(r, r.situacao)).join('')}</ul>` : ''}
          ${oculto && resultado?.ok ? '<p class="nota-caso">Todas as verificações deste caso passaram.</p>' : ''}
        </div>
      </details>`;
  }

  function nomesDosCasos(testes) {
    let visivel = 0;
    let oculto = 0;
    return testes.map((t) => (t.oculto ? `🔒 Oculto ${++oculto}` : `Caso ${++visivel}`));
  }

  /** Resumo no nome da aba: curto ("✅ 3/3"); o texto completo vai na dica e no leitor de tela. */
  function definirResumo(texto, classe = '') {
    const curto = texto.match(/^[✅❌]\s*\d+\/\d+/)?.[0] ?? (texto.startsWith('rodando') ? '⏳' : '');
    el.resumoTestes.textContent = curto;
    el.resumoTestes.className = `resumo-testes ${classe}`;
    el.abaTestes.title = `Testes funcionais: ${texto}`;
    el.abaTestes.setAttribute('aria-label', `Testes funcionais: ${texto}`);
  }

  /** Antes de executar: lista todos os casos como pendentes. */
  function renderTestesPendentes() {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    el.testes.innerHTML = `
      <p class="veredito-sub"><b>▶ Executar</b> roda os casos visíveis. <b>⬆ Enviar</b> roda todos, inclusive os ocultos, e marca a questão como resolvida.</p>
      <div class="casos">${testes.map((t, i) => cardCaso({ nome: nomes[i], teste: t })).join('')}</div>`;
    definirResumo(`${testes.length} casos · ainda não executado`);
  }

  function renderTestes({ aprovado, relatorio }, envio) {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    const porTeste = new Map(relatorio.map((r, i) => [envio ? testes[i] : testes.filter((t) => !t.oculto)[i], r]));
    const cards = testes.map((t, i) => cardCaso({ nome: nomes[i], teste: t, resultado: porTeste.get(t) })).join('');

    const passaram = relatorio.filter((t) => t.ok).length;
    const gentil = semPressao();
    const titulo = aprovado
      ? (envio ? 'Aceito 🎉 Você acertou a questão!' : 'Casos visíveis passaram')
      : (gentil ? 'Ainda não passou, e tudo bem: errar faz parte' : 'Resposta errada');
    const sub = aprovado && !envio
      ? 'Agora clique em ⬆ Enviar para rodar também os casos ocultos.'
      : gentil && !aprovado
        ? `${passaram} de ${relatorio.length} casos já funcionam. Abra o caso marcado abaixo para ver o próximo ajuste.`
        : `${passaram}/${relatorio.length} casos passaram${envio ? ' (incluindo os ocultos)' : ''}.`;
    const { proximo } = vizinhos(estado.item.id);
    el.testes.innerHTML = `
      <p class="veredito ${aprovado ? 'ok' : 'falha'}">${titulo}</p>
      <p class="veredito-sub">${sub}
      ${aprovado && envio && proximo ? `<a class="btn btn-roxo btn-pequeno proximo-problema" href="${linkItem(proximo.id)}">Próximo: ${esc(proximo.titulo)} ›</a>` : ''}</p>
      <div class="casos">${cards}</div>`;
    definirResumo(
      `${aprovado ? '✅' : '❌'} ${passaram}/${relatorio.length} ${envio ? 'casos (todos)' : 'casos visíveis'}`,
      aprovado ? 'ok' : 'falha',
    );
  }

  /** O que o leitor de tela fala sobre os testes (com os nomes da aba Testes). */
  function falarTestes(resultado, envio, extras = {}) {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    const rodados = envio ? testes : testes.filter((t) => !t.oculto);
    return falaDosTestes(resultado, {
      envio,
      gentil: semPressao(),
      detalhado: leitorDeTela(),
      nomes: rodados.map((t) => nomes[testes.indexOf(t)]),
      ...extras,
    });
  }

  async function enviar() {
    if (!estado.pythonPronto || !ehProblema() || estado.ocupado) return;
    estado.ocupado = true;
    el.enviar.disabled = true;
    el.testes.innerHTML = '<p class="veredito-sub">Rodando todos os casos de teste…</p>';
    abrirAbaTestes();
    definirResumo('rodando…');
    definirStatus('Enviando…');
    try {
      const resultado = await rodarTestes({ incluirOcultos: true });
      const { aprovado } = resultado;
      let conquista = '';
      marcar(estado.item.id, aprovado ? 'resolvido' : 'tentado');
      renderCabecalho();
      atualizarSolucao();
      aoMudarProgresso();
      const jornada = jornadaAtual();
      const modulo = jornada.modulos.find((m) => m.id === estado.item.modulo);
      if (aprovado && modulo?.concluido) {
        // O certificado só sai se a cadeia até aqui estiver completa (o selo leva o hash do anterior).
        const cert = certificadosDaJornada(jornada).find((c) => c.id === modulo.id);
        const aviso = cert?.liberado
          ? 'Seu certificado da Sertão será cloud está liberado.'
          : `Os certificados são liberados na ordem da trilha: conclua também <b>${esc(CERTIFICADOS[cert?.falta]?.titulo ?? '')}</b> para receber o seu.`;
        conquista = `Você concluiu o módulo ${modulo.titulo}! ${aviso.replace(/<[^>]+>/g, '')}`;
        el.testes.insertAdjacentHTML('afterbegin', `
          <div class="comemoracao">🏆 Você concluiu o módulo <b>${esc(modulo.titulo)}</b>!
            ${aviso}
            <a class="btn btn-roxo btn-pequeno" href="#/trilha">Ver no caminho</a></div>`);
      }
      definirStatus(aprovado ? 'Aceito! 🎉' : semPressao() ? 'Ainda não passou: veja o que falta' : 'Resposta errada', {
        falar: `${falarTestes(resultado, true)} ${conquista}`.trim(),
      });
    } catch (erro) {
      tratarErro(erro);
      el.testes.innerHTML = `<p class="veredito falha">Erro</p><p class="veredito-sub">${esc(erro.message)}</p>`;
    } finally {
      estado.ocupado = false;
      el.enviar.disabled = !estado.pythonPronto;
    }
  }

  // ---------- eventos ----------
  el.executar.onclick = () => executarPeloAluno();
  el.enviar.onclick = () => enviar();

  el.restaurar.onclick = () => {
    if (!confirm('Voltar ao código original? Suas alterações serão perdidas.')) return;
    apagarRascunho(estado.item.id);
    editor.carregar(estado.item.arquivos);
    executar();
  };

  el.compartilhar.onclick = async () => {
    const link = `${location.origin}${location.pathname}${linkCompartilhado({ item: estado.item.id, arquivos: editor.arquivos })}`;
    try {
      await navigator.clipboard.writeText(link);
      definirStatus('🔗 Link copiado!');
    } catch {
      prompt('Copie o link:', link);
    }
  };

  return {
    abrir,
    terminal,
    redesenharDescricao: () => estado.item && renderDescricao(),
    aoMudarEstadoPython(pronto) {
      const primeiraVez = pronto && !estado.jaIniciou;
      estado.pythonPronto = pronto;
      el.executar.disabled = !pronto;
      el.enviar.disabled = !pronto;
      if (primeiraVez) {
        estado.jaIniciou = true;
        if (estado.item) executar();
      }
    },
  };
}
