// Tela de uma lição, problema ou do playground livre.
import { minutosDoItem } from '../cargaHoraria.js';
import { buscarItem, modulos, vizinhos, DIFICULDADES } from '../conteudo/trilha.js';
import { TempoEsgotado } from '../php/motor.js';
import { SCRIPT_PONTE, montarRequisicao, normalizarUrl } from '../navegacao.js';
import { linkItem, linkCompartilhado } from '../compartilhar.js';
import { corrigir } from '../corrigir.js';
import {
  statusDe, marcar, lerRascunho, gravarRascunho, apagarRascunho,
  lerBancoLivre, gravarBancoLivre, apagarBancoLivre,
} from '../progresso.js';
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
    resetarBanco: $('btn-resetar-banco'),
    restaurar: $('btn-restaurar'),
    compartilhar: $('btn-compartilhar'),
    abaBanco: $('aba-banco'),
    abaSolucao: $('aba-solucao'),
    abaTestes: $('aba-testes'),
    resumoTestes: $('resumo-testes'),
    enunciado: $('desc-enunciado'),
    banco: $('desc-banco'),
    solucao: $('desc-solucao'),
    barra: $('barra-endereco'),
    url: $('url'),
    resultado: $('resultado'),
    fonte: $('saida-fonte'),
    testes: $('saida-testes'),
    erros: $('erros'),
  };

  // previewAtivo: o preview já rodou para este item, então o banco do contexto 'preview' vale.
  const estado = { item: null, url: '/index.php', phpPronto: false, ocupado: false, previewAtivo: false, origem: null };

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

  // 🔊 Ouvir: lê a aba visível do painel de descrição.
  const leitura = iniciarLeitura($('btn-ouvir'), () =>
    [el.titulo.textContent, ...Object.values(paineisDescricao()).filter((p) => !p.hidden).map((p) => p.innerText)].join('. '));
  const paineisDescricao = () => paineisDesc;

  const ehProblema = () => estado.item?.tipo === 'problema';
  const ehLivre = () => estado.item?.tipo === 'livre';

  // ---------- abas ----------
  const paineisDesc = { enunciado: el.enunciado, banco: el.banco, solucao: el.solucao, testes: $('desc-testes') };
  function mostrarDesc(nome) {
    for (const [chave, painel] of Object.entries(paineisDesc)) painel.hidden = chave !== nome;
    document.querySelectorAll('[data-desc]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.desc === nome);
      b.setAttribute('aria-selected', String(b.dataset.desc === nome));
    });
    if (nome === 'banco') renderBanco();
  }
  document.querySelectorAll('[data-desc]').forEach((b) => { b.onclick = () => mostrarDesc(b.dataset.desc); });

  const saidas = { resultado: $('saida-resultado'), fonte: el.fonte };
  function mostrarSaida(nome) {
    for (const [chave, painel] of Object.entries(saidas)) painel.hidden = chave !== nome;
    document.querySelectorAll('[data-saida]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.saida === nome);
      b.setAttribute('aria-selected', String(b.dataset.saida === nome));
    });
  }
  document.querySelectorAll('[data-saida]').forEach((b) => { b.onclick = () => mostrarSaida(b.dataset.saida); });

  // ---------- banco ----------
  function bancoAtual() {
    const item = estado.item;
    if (!item?.banco) return undefined;
    if (ehLivre()) {
      const bytes = lerBancoLivre();
      return bytes ? { bytes } : { seed: item.banco };
    }
    return { seed: item.banco };
  }

  async function renderBanco() {
    if (!estado.item?.banco || el.banco.hidden) return;
    if (!estado.phpPronto) {
      el.banco.innerHTML = '<p>Carregando o PHP…</p>';
      return;
    }
    try {
      const tabelas = await motor.inspecionar(bancoAtual(), { contexto: 'preview', manterBanco: estado.previewAtivo });
      const valor = (v) => (v === null ? '<i>NULL</i>' : esc(v));
      el.banco.innerHTML = `
        <p>Conecte com <code>new PDO('sqlite:/banco/escola.sqlite')</code>.
        ${ehLivre() ? 'No playground livre, as mudanças ficam salvas no seu navegador.' : 'O banco volta ao original quando você clica em ▶ Executar. Cliques em links e formulários do preview mantêm as mudanças.'}</p>
        ${tabelas.map((t) => `
          <div class="tabela-banco">
            <h3>${esc(t.nome)} <small>(${t.total} ${t.total === 1 ? 'linha' : 'linhas'})</small></h3>
            <div class="tabela-rolagem"><table>
              <tr>${t.colunas.map((c) => `<th>${c.pk ? '🔑 ' : ''}${esc(c.nome)}<span class="tipo">${esc(c.tipo)}</span></th>`).join('')}</tr>
              ${t.linhas.map((l) => `<tr>${l.map((v) => `<td class="${typeof v === 'number' ? 'numero' : ''}">${valor(v)}</td>`).join('')}</tr>`).join('')}
            </table></div>
          </div>`).join('')}
        ${ehLivre() ? '' : `<details><summary>Ver o script SQL que cria o banco</summary><pre class="trecho">${esc(estado.item.banco.trim())}</pre></details>`}`;
    } catch (erro) {
      el.banco.innerHTML = `<p>Não foi possível ler o banco: ${esc(erro.message)}</p>`;
    }
  }

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
      <details><summary>💡 Dica</summary><p><code>${esc(item.dica)}</code></p></details>`;
    aplicarChecklist(el.enunciado, item.id);
    $('btn-referencia')?.addEventListener('click', () => {
      if (!confirm('Trocar o seu código pelo código de referência desta etapa?')) return;
      editor.carregar(item.arquivos);
      gravarRascunho(item.id, item.arquivos);
      estado.origem = 'referencia';
      renderDescricao();
      executar({ url: `/${editor.principal}` });
    });
  }

  /** "Como saber que deu certo": as regras dos casos visíveis, em linguagem simples. */
  function comoConferir(testes) {
    const blocos = testes.filter((t) => !t.oculto).map((t) => {
      const regras = t.regras.map(descreverRegra).filter(Boolean);
      if (!regras.length) return '';
      const soCodigo = t.regras.every((r) => 'codigo' in r);
      const onde = t.url || t.metodo
        ? `Ao abrir <code>${esc(t.descricao ?? `${t.metodo ?? 'GET'} ${t.url}`)}</code>`
        : soCodigo ? 'No seu código' : 'Ao executar';
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
    estado.previewAtivo = false;
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
    estado.url = `/${editor.principal}`;
    el.url.value = estado.url;

    renderCabecalho();
    renderDescricao();
    el.enviar.hidden = !ehProblema();
    el.resetarBanco.hidden = !ehLivre();
    el.abaBanco.hidden = !item.banco;
    el.abaSolucao.hidden = !ehProblema();
    el.abaTestes.hidden = !ehProblema();
    layout.aplicar();
    leitura.parar();
    if (ehProblema()) {
      renderSolucao();
      renderTestesPendentes();
    }
    el.resultado.srcdoc = '';
    el.fonte.textContent = '';
    mostrarErros('');
    mostrarDesc('enunciado');
    mostrarSaida('resultado');
    if (estado.phpPronto) executar();
    return true;
  }

  // ---------- execução ----------
  function mostrarErros(texto) {
    el.erros.hidden = !texto;
    el.erros.textContent = texto ?? '';
  }

  function tratarErro(erro) {
    if (erro instanceof TempoEsgotado) {
      el.resultado.srcdoc = `<p style="font-family:sans-serif;padding:1em;color:#b71c1c">⏱️ ${esc(erro.message)}<br>
        Verifique se algum laço (for/while) nunca termina.</p>`;
    }
    mostrarErros(String(erro?.message ?? erro));
    definirStatus('Erro ao executar', { falar: frase(`Erro ao executar: ${erro?.message ?? erro}`) });
  }

  /** O resultado da execução, falado: HTTP, título da página gerada e erros do PHP. */
  function falaDoPhp(r) {
    const titulo = r.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const erros = r.erros.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const lidos = leitorDeTela() ? erros.slice(0, 5) : erros.slice(0, 1);
    return [
      `Página gerada: HTTP ${r.status}${titulo ? `, título ${titulo}` : ''}.`,
      erros.length ? `O PHP mostrou ${erros.length} ${erros.length === 1 ? 'mensagem' : 'mensagens'} de erro.` : 'Sem erros do PHP.',
      ...lidos.map(frase),
      'O resultado está na aba Resultado e o HTML em HTML gerado.',
    ].join(' ');
  }

  const executarNoMotor = (arquivos, req, banco, opcoes) => motor.executar(arquivos, req, banco, opcoes);

  /**
   * ▶ Executar começa do zero (banco recriado, sessão nova). Cliques em links e
   * formulários do preview (`navegacao`) continuam com o mesmo banco e sessão,
   * como num site de verdade: o post publicado continua lá no próximo clique.
   */
  /** Executar pedido pelo aluno (botão ou Ctrl+Enter): mostra a aba de testes com o resultado. */
  const executarPeloAluno = () => executar(undefined, { abrirTestes: true, falar: true });

  /** Abre a aba 🧪 Testes (e a descrição, se estiver oculta). */
  function abrirAbaTestes() {
    if (!ehProblema()) return;
    layout.mostrarDescricao();
    mostrarDesc('testes');
  }

  // `falar`: só quando a pessoa pediu (botão, atalho ou clique na prévia); as execuções
  // automáticas (abrir o exercício, restaurar) não interrompem o leitor de tela.
  async function executar(req = { url: estado.url }, { navegacao = false, abrirTestes = false, falar = navegacao } = {}) {
    if (!estado.phpPronto || !estado.item) return;
    const item = estado.item;
    const arquivos = { ...editor.arquivos };
    definirStatus('Executando…', { falar: false });
    try {
      const banco = bancoAtual();
      const continuar = navegacao && estado.previewAtivo;
      const r = await motor.executar(
        arquivos,
        req,
        ehLivre() && banco ? { ...banco, devolver: true } : banco,
        { contexto: 'preview', novaSessao: !continuar, manterBanco: continuar },
      );
      if (estado.item !== item) return;
      estado.previewAtivo = true;
      estado.url = r.url ?? req.url ?? `/${editor.principal}`;
      el.url.value = estado.url;
      el.resultado.srcdoc = r.html + SCRIPT_PONTE;
      el.fonte.textContent = r.html;
      mostrarErros(r.erros.trim());
      const fala = falaDoPhp(r);
      const comTestes = item.tipo === 'problema' && !navegacao;
      definirStatus(`Python 3.14 · ${req.metodo === 'POST' ? 'POST ' : ''}HTTP ${r.status} · ${r.ms} ms`, { falar: falar && !comTestes && fala });

      if (ehLivre() && r.bancoBytes) {
        gravarBancoLivre(r.bancoBytes);
        renderBanco();
      }
      if (item.tipo === 'licao' && !statusDe(item.id)) {
        marcar(item.id, 'resolvido');
        aoMudarProgresso();
      }
      if (comTestes) {
        const resultado = await rodarTestes({ incluirOcultos: false });
        if (estado.item !== item) return;
        if (falar) anunciar(`${fala} ${falarTestes(resultado, false)}`);
        if (abrirTestes) abrirAbaTestes();
      }
      if (!el.banco.hidden) renderBanco();
    } catch (erro) {
      tratarErro(erro);
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
  // Cada caso vira um card: o cenário (as requisições que o teste faz, como num
  // navegador), o placar e cada verificação com categoria, o que a página tinha e, se
  // falhar, motivo e dica. Nos casos ocultos, os valores e o que passou ficam escondidos.

  /** As requisições de um caso, como linhas de HTTP: GET /index.php?..., POST /login.php. */
  function linhasDoCenario(cenario, { ocultar = false, bancoProprio = false } = {}) {
    const linhas = [];
    if (bancoProprio) linhas.push('# banco com dados diferentes do exemplo');
    if (cenario.length > 1) linhas.push('# os passos compartilham a mesma sessão e o mesmo banco');
    // Campos "a=1&b=2": os nomes aparecem; os valores somem nos ocultos e são cortados se longos.
    const campos = (texto) => String(texto).split('&').map((par) => {
      const [nome, ...resto] = par.split('=');
      const valor = resto.join('=');
      return `${nome}=${ocultar ? '…' : valor.length > 40 ? `${valor.slice(0, 39)}…` : valor}`;
    }).join('&');
    for (const { metodo = 'GET', url = 'index.php', corpo } of cenario) {
      const [caminho, consulta] = String(url).split('?');
      linhas.push(`${metodo} /${caminho.replace(/^\//, '')}${consulta ? `?${campos(consulta)}` : ''}`);
      if (corpo) linhas.push(`  corpo: ${campos(typeof corpo === 'string' ? corpo : new URLSearchParams(corpo).toString())}`);
    }
    return linhas;
  }

  const cenarioDoTeste = (t) => (t.passos ?? [t]).map((p) => ({ metodo: p.metodo ?? 'GET', url: p.url ?? 'index.php', corpo: p.corpo }));

  const verificacoesPrevistas = (t) => (t.passos ?? [t]).flatMap((p) => p.regras ?? [])
    .map((regra) => ({ mensagem: descreverRegra(regra) ?? 'Verificação no código', categoria: categoriaDe(regra) }));

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
    const descricao = oculto ? (resultado ? 'caso oculto' : 'rode ⬆ Enviar') : teste.descricao ?? 'código e página';
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
          <pre class="cenario">${linhasDoCenario(cenario, { ocultar: oculto, bancoProprio: resultado?.bancoProprio ?? Boolean(teste.banco) }).map(esc).join('\n')}</pre>
          ${resultado?.erroExecucao && !oculto ? `<p class="erro-execucao">⛔ O PHP mostrou: <code>${esc(resultado.erroExecucao)}</code></p>` : ''}
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
    if (!estado.phpPronto || !ehProblema() || estado.ocupado) return;
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
      el.enviar.disabled = !estado.phpPronto;
    }
  }

  // ---------- eventos ----------
  window.addEventListener('message', (e) => {
    if (e.source !== el.resultado.contentWindow || !e.data?.__phpPlayground) return;
    executar(montarRequisicao(estado.url, e.data), { navegacao: true });
  });

  el.barra.addEventListener('submit', (e) => {
    e.preventDefault();
    executar({ url: normalizarUrl(el.url.value, editor.principal) }, { navegacao: true });
  });

  el.executar.onclick = () => executarPeloAluno();
  el.enviar.onclick = () => enviar();

  el.restaurar.onclick = () => {
    if (!confirm('Voltar ao código original? Suas alterações serão perdidas.')) return;
    apagarRascunho(estado.item.id);
    editor.carregar(estado.item.arquivos);
    executar({ url: `/${editor.principal}` });
  };

  el.resetarBanco.onclick = () => {
    if (!confirm('Apagar as mudanças no banco e voltar aos dados originais?')) return;
    apagarBancoLivre();
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
    redesenharDescricao: () => estado.item && renderDescricao(),
    aoMudarEstadoPhp(pronto) {
      const primeiraVez = pronto && !estado.jaIniciou;
      estado.phpPronto = pronto;
      el.executar.disabled = !pronto;
      el.enviar.disabled = !pronto;
      if (primeiraVez) {
        estado.jaIniciou = true;
        if (estado.item) {
          executar();
          renderBanco();
        }
      }
    },
  };
}
