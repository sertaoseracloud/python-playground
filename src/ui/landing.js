// Landing page (#/): apresenta o projeto e leva para a trilha (#/trilha).
// Os números e os módulos vêm do conteúdo da trilha, então nunca ficam desatualizados.
import { modulos, itens, problemas } from '../conteudo/trilha.js';
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

// Mini editor do topo: o mesmo código PHP que o aluno escreve na primeira lição de PHP.
const CODIGO_EXEMPLO = `<span class="t-tag">&lt;?php</span>
<span class="t-var">$nome</span> = <span class="t-str">"Sertão"</span>;
<span class="t-var">$notas</span> = [<span class="t-num">8</span>, <span class="t-num">9.5</span>, <span class="t-num">7</span>];
<span class="t-var">$media</span> = <span class="t-fn">array_sum</span>(<span class="t-var">$notas</span>) / <span class="t-fn">count</span>(<span class="t-var">$notas</span>);
<span class="t-tag">?&gt;</span>
&lt;<span class="t-tag">h1</span>&gt;Olá, <span class="t-tag">&lt;?=</span> <span class="t-var">$nome</span> <span class="t-tag">?&gt;</span>!&lt;/<span class="t-tag">h1</span>&gt;
&lt;<span class="t-tag">p</span>&gt;Média: <span class="t-tag">&lt;?=</span> <span class="t-fn">round</span>(<span class="t-var">$media</span>, <span class="t-num">1</span>) <span class="t-tag">?&gt;</span>&lt;/<span class="t-tag">p</span>&gt;`;

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
          <h1 id="landing-titulo">Aprenda <span class="destaque">PHP</span> do zero, com acessibilidade para todas as pessoas</h1>
          <p class="hero-selo-a11y">🦯 Leitor de tela · 🤟 Libras · ⌨️ Só teclado · 🧠 TDAH e dislexia</p>
          <p class="hero-sub">Uma trilha gamificada do HTML ao banco de dados: você escreve o código, clica em
            <b>▶ Executar</b> e os testes dizem na hora se acertou. Sem instalar nada, sem cadastro.</p>
          <div class="hero-acoes">
            ${temProgresso ? continuar : '<a class="btn btn-verde btn-grande" href="#/trilha">🚀 Começar a trilha</a>'}
            <a class="btn btn-fantasma btn-grande" href="#/trilha">🗺️ Ver a trilha</a>
            <a class="btn btn-fantasma btn-grande" href="#/livre">🧪 Playground livre</a>
          </div>
          <ul class="hero-numeros" aria-label="A trilha em números">
            <li><b>${n.exercicios}</b> exercícios</li>
            <li><b>${n.licoes}</b> lições</li>
            <li><b>${n.projetos}</b> projetos completos</li>
            <li><b>${n.certificados}</b> certificados</li>
          </ul>
        </div>
        <div class="hero-demo" aria-hidden="true">
          <div class="janela">
            <div class="janela-barra"><span></span><span></span><span></span><b>index.php</b></div>
            <pre class="janela-codigo">${CODIGO_EXEMPLO}</pre>
          </div>
          <div class="janela janela-resultado">
            <div class="janela-barra"><span></span><span></span><span></span><b>localhost/index.php</b></div>
            <div class="resultado-demo"><p class="r-h1">Olá, Sertão!</p><p>Média: 8.2</p></div>
            <p class="teste-demo">✅ 3/3 casos passaram</p>
          </div>
        </div>
      </section>

      <section class="faixa" aria-labelledby="como-titulo">
        <h2 id="como-titulo">Como funciona</h2>
        <ol class="passos-landing">
          <li><span aria-hidden="true">📖</span><b>Leia o desafio</b><p>Instruções curtas, sempre na mesma ordem, com as palavras técnicas explicadas por analogias.</p></li>
          <li><span aria-hidden="true">⌨️</span><b>Escreva o código</b><p>Editor de verdade, com cores e atalhos. Seu código fica salvo no navegador.</p></li>
          <li><span aria-hidden="true">▶️</span><b>Execute</b><p>O Python 3.14 roda no próprio navegador, com banco SQLite, sessões e formulários.</p></li>
          <li><span aria-hidden="true">✅</span><b>Veja os testes</b><p>Testes funcionais conferem a página na hora e mostram o que falta, como no LeetCode.</p></li>
        </ol>
      </section>

      <section class="faixa" aria-labelledby="trilha-titulo">
        <h2 id="trilha-titulo">A trilha</h2>
        <p class="faixa-sub">${n.modulos} módulos em sequência. Cada um abre quando você faz 70% do anterior.</p>
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
        </ol>
      </section>

      <section class="faixa faixa-certificados" aria-labelledby="cert-titulo">
        <div>
          <h2 id="cert-titulo">Certificados e badges</h2>
          <p>Cada módulo concluído vale um <b>badge digital</b>, e a trilha completa vale o certificado final,
            emitidos pela <b>${esc(EMISSOR.organizacao)}</b>.</p>
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
        <p>Comece pelo HTML. Em poucos minutos sua primeira página está no ar, aqui mesmo.</p>
        ${temProgresso ? continuar : '<a class="btn btn-verde btn-grande" href="#/trilha">🚀 Começar agora</a>'}
      </section>

      <footer class="rodape-landing">
        <p><b>${esc(EMISSOR.organizacao)}</b> · ${esc(EMISSOR.curso)} · <a href="#/novidades">Versão ${esc(VERSAO)} · Novidades</a></p>
        <p><a href="#/instrutor">Quem é o instrutor?</a> · <a href="#/apoie">☕ Apoie o projeto</a> · <a href="#/validar">Validar certificado</a> · <a href="#/acessibilidade">Acessibilidade</a> · <a href="#/termos">Termos de uso</a> · <a href="#/privacidade">Privacidade e cookies</a> · <a href="#/licenca">Licença (AGPL-3.0 e CC BY-SA 4.0)</a> · <a href="${REPOSITORIO}" target="_blank" rel="noopener noreferrer">Código no GitHub</a></p>
      </footer>
    </div>`;
}
