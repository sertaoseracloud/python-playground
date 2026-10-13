// Passos do tutorial. `tela` diz em qual tela o passo acontece ('inicio' ou 'item');
// `alvo` é o seletor do elemento destacado (sem alvo, o modal fica no centro).
// tests/tutorial.test.js confere que todos os alvos existem na página.

export const PROBLEMA_DO_TUTORIAL = 'html-primeira-pagina';

export const PASSOS = [
  {
    titulo: 'Bem-vindo ao DivergePython 🐍',
    texto: `<p>Aqui você aprende <b>HTML</b>, <b>W3.CSS</b>, <b>PHP</b> e <b>banco de dados com PDO</b>
      resolvendo problemas, no estilo do LeetCode.</p>
      <p>Tudo roda no seu navegador: não precisa instalar nada. Este tutorial leva 1 minuto.</p>`,
  },
  {
    tela: 'inicio',
    alvo: '#tela-inicio .bloco-unidade',
    titulo: 'O caminho',
    texto: `<p>A trilha é um caminho: HTML → W3.CSS → PHP → PHP + PDO e, de bônus, os Projetos.</p>
      <ul>
        <li>📖 <b>lições</b> e problemas ⭐ <span class="dificuldade facil">fácil</span>,
          🔥 <span class="dificuldade medio">médio</span> e 💎 <span class="dificuldade dificil">difícil</span>;</li>
        <li>o nó que pisca com <b>COMEÇAR</b> é o seu próximo passo;</li>
        <li>🔒 o próximo módulo abre quando você resolve <b>70%</b> do atual.</li>
      </ul>`,
  },
  {
    tela: 'inicio',
    alvo: '.painel-jogador',
    titulo: 'XP, nível e certificados',
    texto: `<p>Cada lição e problema resolvido dá <b>XP</b> e sobe o seu <b>nível</b>. Estudar em dias seguidos
      aumenta a sua sequência 🔥.</p>
      <p>Ao concluir um módulo, o 🏆 libera um <b>certificado</b> emitido pela <b>Sertão será cloud</b>, que você pode
      salvar em PDF e compartilhar no LinkedIn. Concluindo tudo, ganha o certificado final 🎓.</p>`,
  },
  {
    tela: 'inicio',
    alvo: '.menu',
    alvoCelular: '#btn-menu',
    titulo: 'Trilha e Playground livre',
    texto: `<p><b>Trilha</b> volta para este caminho. O <b>Playground livre</b> é para experimentar
      à vontade, com um banco de dados que fica salvo.</p>
      <p class="so-celular">No celular, eles ficam no menu <b>☰</b>, no canto de cima.</p>`,
  },
  {
    tela: 'item',
    alvo: '#painel-descricao',
    titulo: 'O enunciado',
    texto: `<p>Leia o que o problema pede. Nas abas há o <b>🗄️ Banco</b> (tabelas, nos problemas de PDO)
      e a <b>Solução</b>, para quando você travar.</p>
      <p>O botão <b>🔊 Ouvir</b> lê o enunciado em voz alta.</p>`,
  },
  {
    tela: 'item',
    alvo: '.painel-codigo',
    titulo: 'O editor de código',
    texto: `<p>Escreva aqui. O <b>+</b> cria outros arquivos (para usar <code>include</code>).
      Seu código é salvo sozinho enquanto você digita.</p>
      <p>Atalho: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> executa.</p>`,
  },
  {
    tela: 'item',
    alvo: '.painel-preview',
    titulo: 'O preview',
    texto: `<p>Mostra a página de verdade, como no navegador. A aba <b>HTML gerado</b> mostra o que o PHP produziu.</p>
      <p>Na barra de endereço, teste parâmetros como <code>?nome=Ana</code> e tecle Enter.
      O <b>📐 medidor</b> mostra a largura: a W3.CSS muda o layout em 601px e 993px.</p>`,
  },
  {
    tela: 'item',
    alvo: '#btn-executar',
    titulo: '▶ Executar',
    texto: `<p>Roda o seu código, atualiza o preview e confere os <b>casos de teste visíveis</b>.</p>`,
  },
  {
    tela: 'item',
    alvo: '#aba-testes',
    titulo: '🧪 Testes funcionais',
    texto: `<p>Os testes ficam nesta aba, ao lado da descrição. Ela abre sozinha quando você clica em
      <b>▶ Executar</b>, e o resultado aparece no nome da aba (ex.: ✅ 3/3).</p>
      <p>Cada cartão é um caso de teste: ⏳ ainda não rodou, ✅ passou, ❌ falhou.
      O cartão que falhou diz <b>o que faltou</b>, por exemplo "encontrei 0 elementos li".</p>`,
  },
  {
    tela: 'item',
    alvo: '#btn-enviar',
    titulo: '⬆ Enviar',
    texto: `<p>Roda <b>todos</b> os testes, inclusive os 🔒 ocultos, que usam outros valores.
      Se tudo passar, aparece <b>Aceito 🎉</b> e o problema fica marcado como resolvido.</p>
      <p>Atalho: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>.</p>`,
  },
  {
    tela: 'item',
    alvo: '#grupo-layout',
    soDesktop: true, // no celular o código e o preview sempre ficam empilhados
    titulo: 'Posição do código e do preview',
    texto: `<p><b>Auto</b> escolhe sozinho: lado a lado quando o preview fica com mais de 600px,
      senão o código fica em cima e o preview embaixo.</p>
      <p>Use <b>⇆</b> ou <b>⇅</b> para fixar, <b>📄</b> para ocultar a descrição e arraste
      a divisória entre código e preview para ajustar o tamanho.</p>`,
  },
  {
    alvo: '#btn-acessibilidade',
    titulo: '♿ Acessibilidade',
    texto: `<p>Mude o <b>tema</b>, o <b>tamanho do texto</b>, a fonte e o espaçamento.</p>
      <p>Há <b>perfis rápidos</b> para estudar do seu jeito: <b>🎯 Foco</b> (menos distrações, tarefas
      em lista, lembrete de pausa), <b>📖 Leitura facilitada</b> (fonte legível e régua de leitura),
      <b>🌿 Calmo</b> (cores suaves, nada se mexe) e <b>🤝 Sem pressão</b> (sem pontuação, mensagens gentis).</p>`,
  },
  {
    alvo: '#btn-tutorial',
    titulo: 'Pronto! 🚀',
    texto: `<p>Você pode rever este tutorial quando quiser no botão <b>❓</b>, no canto de baixo à direita.
      Ali também ficam <b>♿ Acessibilidade</b> e <b>🔒 Privacidade</b>.</p>
      <p>Comece pelo primeiro problema de HTML. Bons estudos!</p>`,
  },
];
