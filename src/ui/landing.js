// Landing page (#/): apresenta o projeto e leva para a trilha (#/trilha).
// Os números e os módulos vêm do conteúdo da trilha, então nunca ficam desatualizados.
import { modulos, itens, problemas, buscarItem, PROXIMOS_MODULOS } from '../conteudo/trilha.js';
import { CERTIFICADOS, EMISSOR } from '../certificados.js';
import { svgBadge } from '../badges.js';
import { secaoInstrutor } from './instrutor.js';
import { linkItem } from '../compartilhar.js';
import { jornadaAtual } from './inicio.js';
import { esc } from './util.js';
// Versão injetada pelo Vite (e pelo prerender); sem importar o histórico, que só existe no build.
const VERSAO = typeof __VERSAO__ === 'undefined' ? '' : __VERSAO__;

const REPOSITORIO = 'https://github.com/sertaoseracloud/python-playground';

/** Números do topo: tudo calculado a partir do conteúdo. */
export function numerosDaTrilha() {
  const projetos = modulos.find((m) => m.grupos)?.grupos.length ?? 0;
  return {
    exercicios: problemas.length,
    licoes: itens.filter((i) => i.tipo === 'licao').length,
    modulos: modulos.length,
    projetos,
    certificados: Object.keys(CERTIFICADOS).length,
  };
}

// Mini editor do topo: a solução de referência do FizzBuzz, lida do próprio conteúdo
// (nunca fica diferente do exercício), com cores simples de sintaxe.
const PALAVRAS = new Set(['def', 'for', 'in', 'if', 'elif', 'else', 'return', 'while', 'import', 'from']);
const FUNCOES = new Set(['range', 'append', 'str', 'print', 'len']);
function colorir(codigo) {
  return codigo.replace(/("[^"\n]*")|\b([A-Za-z_]\w*)\b|\b(\d+)\b|([^"\w]+)/g, (_, texto, nome, numero, resto) => {
    if (texto) return `<span class="t-str">${esc(texto)}</span>`;
    if (numero) return `<span class="t-num">${numero}</span>`;
    if (nome && PALAVRAS.has(nome)) return `<span class="t-tag">${nome}</span>`;
    if (nome && FUNCOES.has(nome)) return `<span class="t-fn">${nome}</span>`;
    return esc(nome ?? resto);
  });
}
const CODIGO_EXEMPLO = colorir(buscarItem('py-fizzbuzz').solucao['main.py'].trimEnd());

export function renderLanding(el) {
  const n = numerosDaTrilha();
  const j = jornadaAtual();
  const temProgresso = j.xp > 0;
  const continuar = j.proximo
    ? `<a class="btn btn-verde btn-grande" href="${linkItem(j.proximo.id)}">▶ Continuar: ${esc(j.proximo.titulo)}</a>`
    : '<a class="btn btn-verde btn-grande" href="#/trilha">🎓 Ver meus certificados</a>';

  el.innerHTML = `
    <div class="landing">
      <section class="hero" aria-labelledby="landing-titulo">
        <div class="hero-texto">
          <p class="hero-selo">☁️ ${esc(EMISSOR.organizacao)} apresenta</p>
          <h1 id="landing-titulo">Aprenda <span class="destaque">Python</span> do zero, com acessibilidade para todas as pessoas</h1>
          <p class="hero-selo-a11y">🦯 Leitor de tela · 🤟 Libras · ⌨️ Só teclado · 🧠 TDAH e dislexia</p>
          <p class="hero-sub">Uma trilha gamificada do Python ao PySpark, com dados em paralelo: você escreve o código, clica em
            <b>▶ Executar</b> e os testes dizem na hora se acertou. Sem instalar nada, sem cadastro.</p>
          <div class="hero-acoes">
            ${temProgresso ? continuar : '<a class="btn btn-verde btn-grande" href="#/trilha">🚀 Começar a trilha</a>'}
            <a class="btn btn-fantasma btn-grande" href="#/trilha">🗺️ Ver a trilha</a>
            <a class="btn btn-fantasma btn-grande" href="#/livre">🧪 Playground livre</a>
          </div>
          <ul class="hero-numeros" aria-label="A trilha em números">
            <li><b>${n.exercicios}</b> exercícios</li>
            <li><b>${n.licoes}</b> lições</li>
            ${n.projetos ? `<li><b>${n.projetos}</b> projetos completos</li>` : ''}
            <li><b>${n.certificados}</b> certificados</li>
          </ul>
        </div>
        <div class="hero-demo" aria-hidden="true">
          <div class="janela">
            <div class="janela-barra"><span></span><span></span><span></span><b>main.py</b></div>
            <pre class="janela-codigo">${CODIGO_EXEMPLO}</pre>
          </div>
          <div class="janela janela-resultado">
            <div class="janela-barra"><span></span><span></span><span></span><b>🖥️ Terminal</b></div>
            <pre class="terminal-demo">&gt;&gt;&gt; fizzbuzz(5)
['1', '2', 'Fizz', '4', 'Buzz']</pre>
            <p class="teste-demo">✅ 2/2 casos passaram</p>
          </div>
        </div>
      </section>

      <section class="faixa" aria-labelledby="como-titulo">
        <h2 id="como-titulo">Como funciona</h2>
        <ol class="passos-landing">
          <li><span aria-hidden="true">📖</span><b>Leia o desafio</b><p>Instruções curtas, sempre na mesma ordem, com as palavras técnicas explicadas por analogias.</p></li>
          <li><span aria-hidden="true">⌨️</span><b>Escreva o código</b><p>Editor de verdade, com cores e atalhos. Seu código fica salvo no navegador.</p></li>
          <li><span aria-hidden="true">▶️</span><b>Execute</b><p>O Python 3.14 roda no próprio navegador, com <code>input()</code>, arquivos e dados em paralelo de verdade, nos núcleos do seu computador.</p></li>
          <li><span aria-hidden="true">✅</span><b>Veja os testes</b><p>Testes funcionais conferem o que o seu código mostra e devolve, na hora, e dizem o que falta, como no LeetCode.</p></li>
        </ol>
      </section>

      <section class="faixa" aria-labelledby="trilha-titulo">
        <h2 id="trilha-titulo">A trilha</h2>
        <p class="faixa-sub">${n.modulos} ${n.modulos === 1 ? 'módulo disponível' : 'módulos disponíveis'}${PROXIMOS_MODULOS.length ? ` e ${PROXIMOS_MODULOS.length} a caminho` : ''}. Cada módulo abre quando você faz 70% do anterior.</p>
        <ol class="modulos-landing">
          ${modulos.map((m, i) => {
            const qtd = m.itens.filter((x) => x.tipo === 'problema').length;
            return `
              <li class="modulo-card" data-modulo="${m.id}">
                <span class="modulo-numero">${m.extra ? 'Extra' : i + 1}</span>
                <span class="modulo-icone" aria-hidden="true">${m.icone}</span>
                <h3>${esc(m.titulo)}</h3>
                <p>${esc(m.descricao)}</p>
                <small>${m.grupos ? `${m.grupos.length} projetos · ${qtd} etapas` : `${qtd} exercícios`}</small>
              </li>`;
          }).join('')}
          ${PROXIMOS_MODULOS.map((m, i) => `
              <li class="modulo-card em-breve" data-modulo="${m.id}">
                <span class="modulo-numero">${modulos.length + i + 1}</span>
                <span class="modulo-icone" aria-hidden="true">${m.icone}</span>
                <h3>${esc(m.titulo)}</h3>
                <span class="chip">em breve</span>
              </li>`).join('')}
        </ol>
      </section>

      <section class="faixa faixa-certificados" aria-labelledby="cert-titulo">
        <div>
          <h2 id="cert-titulo">Certificados e badges</h2>
          <p>Cada módulo concluído vale um <b>badge digital</b>${CERTIFICADOS.final ? ', e a trilha completa vale o certificado final,' : ''}
            emitido pela <b>${esc(EMISSOR.organizacao)}</b>.${CERTIFICADOS.final ? '' : ' Quando a trilha estiver completa, ela também vai valer um certificado final.'}</p>
          <ul class="lista-check">
            <li>Publique no <b>LinkedIn</b> com a imagem do badge, como na Credly.</li>
            <li>Adicione em <b>Licenças e certificados</b> do seu perfil.</li>
            <li>Imprima ou salve em <b>PDF</b> (A4 paisagem).</li>
            <li>Cada certificado tem um <b>selo de autenticidade</b> e pode ser conferido na página <a href="#/validar">Validar certificado</a>.</li>
          </ul>
        </div>
        <div class="vitrine-badges" aria-label="Badges da trilha">
          ${Object.keys(CERTIFICADOS).map((id) => `<span title="${esc(CERTIFICADOS[id].titulo)}">${svgBadge(id, { tamanho: 96 })}</span>`).join('')}
        </div>
      </section>

      <section class="faixa" aria-labelledby="todos-titulo">
        <h2 id="todos-titulo">Feito para todo mundo aprender</h2>
        <div class="cartoes">
          <article><h3>🦯 Pessoas cegas</h3><p>O leitor de tela fala o resultado de cada teste, com o motivo e a dica. Navegação completa pelo teclado, alto contraste e texto até 175%.</p></article>
          <article><h3>🤟 Pessoas surdas e mudas</h3><p>Nada depende de som nem de voz. Tradução para Libras com o VLibras, do Governo Federal. <a href="#/acessibilidade">Veja tudo sobre acessibilidade</a>.</p></article>
          <article><h3>🧠 Neurodiversidade</h3><p>Perfis prontos para TDAH, dislexia, autismo e ansiedade: modo foco, lista de tarefas, régua de leitura, lembrete de pausa e mensagens gentis.</p></article>
          <article><h3>🔒 Privado</h3><p>Sem cookies, sem rastreamento, sem cadastro. Seu progresso fica só no seu navegador. <a href="#/privacidade">Saiba mais</a>.</p></article>
          <article><h3>👩‍🏫 Para a sala de aula</h3><p>Funciona em qualquer computador com um navegador atualizado, inclusive no projetor. Mande o link direto de um exercício para a turma.</p></article>
        </div>
      </section>

      ${secaoInstrutor()}

      <section class="cta-final" aria-labelledby="cta-titulo">
        <h2 id="cta-titulo">Pronto para escrever seu primeiro código?</h2>
        <p>Comece pelo primeiro <code>print</code>. Em poucos minutos o seu primeiro programa está rodando, aqui mesmo.</p>
        ${temProgresso ? continuar : '<a class="btn btn-verde btn-grande" href="#/trilha">🚀 Começar agora</a>'}
      </section>

      <footer class="rodape-landing">
        <p><b>${esc(EMISSOR.organizacao)}</b> · ${esc(EMISSOR.curso)} · <a href="#/novidades">Versão ${esc(VERSAO)} · Novidades</a></p>
        <p><a href="#/instrutor">Quem é o instrutor?</a> · <a href="#/apoie">☕ Apoie o projeto</a> · <a href="#/validar">Validar certificado</a> · <a href="#/acessibilidade">Acessibilidade</a> · <a href="#/termos">Termos de uso</a> · <a href="#/privacidade">Privacidade e cookies</a> · <a href="#/licenca">Licença (AGPL-3.0 e CC BY-SA 4.0)</a> · <a href="${REPOSITORIO}" target="_blank" rel="noopener noreferrer">Código no GitHub</a></p>
      </footer>
    </div>`;
}
