// Versão do site e resumo das alterações de cada release (página #/novidades e CHANGELOG.md).
// A versão vem do package.json (injetada pelo Vite); o histórico completo vem do git
// (scripts/plugin-historico.mjs).
import historico from 'virtual:historico';

export const VERSAO = typeof __VERSAO__ === 'undefined' ? '0.0.0' : __VERSAO__;
export const HISTORICO = historico;
export const REPOSITORIO = 'https://github.com/sertaoseracloud/python-playground';

/** Releases, da mais nova para a mais antiga. Escritas para quem usa o site, sem jargão. */
export const RELEASES = [
  {
    versao: '1.0.1',
    data: '2026-10-16',
    titulo: 'Tudo cabe no celular',
    resumo: 'No iPhone e em outros celulares, a trilha e o tutorial ficavam um pouco para fora da tela, deslocados para a direita.',
    grupos: [
      { titulo: '📱 Celular', itens: ['O painel do jogador e o cabeçalho de cada módulo cabem na largura da tela, com a mesma margem dos dois lados.', 'Os contadores do módulo (exercícios, lições e horas) quebram linha em vez de passar da borda.', 'Os botões do tutorial quebram linha, e o Próximo não fica mais escondido na borda.'] },
    ],
  },
  {
    versao: '1.0.0',
    data: '2026-10-16',
    titulo: 'A trilha completa',
    resumo: 'Os últimos 6 projetos chegaram, e com eles o certificado final: do primeiro print ao streaming, Delta Lake e MLlib.',
    grupos: [
      { titulo: '🏗️ Projetos novos', itens: ['Sensores do sertão e streaming de música (Structured Streaming), ETL bronze → prata → ouro e qualidade de dados com SCD tipo 2 (Delta Lake), recomendação e detecção de fraude (MLlib).', 'Agora são 18 projetos de 5 etapas: o módulo 🏗️ está completo.'] },
      { titulo: '🎓 Certificado final', itens: ['"Engenharia de dados com Python e Spark: trilha completa", de 155 horas, com o badge ★, quando todos os módulos e todos os projetos estiverem concluídos.', 'O certificado final também restaura o progresso em outro navegador, inclusive os projetos.'] },
      { titulo: '📖 Glossário', itens: ['Termos novos: arquitetura medalhão e SCD tipo 2.'] },
    ],
  },
  {
    versao: '0.7.0',
    data: '2026-10-16',
    titulo: 'Projetos de Spark avançado',
    resumo: 'Mais 6 projetos no módulo 🏗️: distorção e salting, média móvel, pivot, séries com falhas, JSON com listas e broadcast.',
    grupos: [
      { titulo: '🏗️ Projetos novos', itens: ['Mobilidade urbana, saúde pública, agronegócio, energia solar, hashtags e seguidores, e logística: 6 projetos de 5 etapas.', 'Já são 12 dos 18 projetos. Os últimos 6 e o certificado final da trilha chegam na 1.0.0.'] },
      { titulo: '✨ PySpark', itens: ['unpivot (e melt), para voltar do formato largo ao longo, conferido com o PySpark de verdade.'] },
      { titulo: '📖 Glossário', itens: ['Termos novos: salting, média móvel e pivot.'] },
    ],
  },
  {
    versao: '0.6.0',
    data: '2026-10-15',
    titulo: 'Projetos',
    resumo: 'O último módulo da trilha começou: projetos de dados de ponta a ponta com PySpark, em que cada etapa continua do código da anterior.',
    grupos: [
      { titulo: '🏗️ Módulo novo', itens: ['6 projetos de 5 etapas: contagem de palavras em livros de cordel, vendas por região, análise de logs, funil de e-commerce, painel de indicadores e notas de exame.', 'Quem resolve uma etapa continua do próprio código na seguinte.', 'Os outros 12 projetos e o certificado final da trilha chegam nas próximas versões.'] },
      { titulo: '✨ PySpark', itens: ['Percentis com percentile_approx, livros inteiros com wholeTextFiles e o momento em segundos com cast("long"), conferidos com o PySpark de verdade.'] },
      { titulo: '📖 Glossário', itens: ['Termos novos: percentil, palavras vazias e funil de conversão.'] },
    ],
  },
  {
    versao: '0.5.0',
    data: '2026-10-15',
    titulo: 'Spark além do batch',
    resumo: 'O quinto módulo chegou: tabelas Delta com versões, dados que chegam aos poucos (Structured Streaming) e aprendizado de máquina com o MLlib, tudo no navegador.',
    grupos: [
      { titulo: '🌊 Módulo novo', itens: ['12 lições e 36 exercícios, com a cooperativa (Delta Lake), as estações do sertão (streaming) e a safra (MLlib).', 'Certificado "Streaming, Machine Learning e Delta Lake com Spark", de 20 horas, com o badge 🌊.', 'Termos novos no glossário: micro-lote, marca d\'água, pipeline, time travel, upsert e outros.'] },
      { titulo: '🏘️ Vila', itens: ['O mapa de cada módulo ocupa a tela toda, e a estrada faz curvas pelo caminho dos exercícios.', 'A cada exercício resolvido, alguém constrói uma casa, nasce um filho ou um animal tem um filhote. A vila sai do seu progresso, sem nada a mais guardado no navegador.'] },
      { titulo: '⚡ Aba Execução', itens: ['A parte 🌊 Micro-lotes mostra cada lote: o que entrou, o estado, a marca d\'água e o que saiu, em visual, em tabela e no resumo falado.', 'Cada fit do MLlib aparece como job, com as iterações.'] },
      { titulo: '♿ Acessibilidade', itens: ['O streaming roda num relógio simulado: o resultado não depende do tempo real, nem da velocidade do computador.'] },
    ],
  },
  {
    versao: '0.4.2',
    data: '2026-10-15',
    titulo: 'A trilha virou um mapa',
    resumo: 'Cada módulo da trilha tem agora o seu cenário em pixel art, do tamanho do módulo inteiro, com personagens andando por ele de quadradinho em quadradinho.',
    grupos: [
      { titulo: '🗺️ Cenários', itens: ['Básico no sertão, Dados num vale verde, Paralelismo no gelo, PySpark no fogo e Projetos na cidade à noite.', 'O mapa é feito de tiles em pixel art, como nos RPGs clássicos, cobre o módulo de cima a baixo e rola junto com a página.', 'Personagens andam pelo mapa um passo de cada vez, sem entrar na água nem pisar no caminho: vaqueiro, jumento, pinguim, salamandra, robozinho e outros. Há sempre alguns à vista, em qualquer parte do módulo.'] },
      { titulo: '♿ Acessibilidade', itens: ['Os cenários são só decoração: o leitor de tela não os lê e o caminho mantém as cores e o contraste.', 'Com "reduzir movimento" (no sistema ou no painel ♿), os personagens ficam parados. No alto contraste, o mapa vira contorno.'] },
    ],
  },
  {
    versao: '0.4.1',
    data: '2026-10-14',
    titulo: 'O certificado traz o progresso de volta',
    resumo: 'Trocou de computador ou limpou o navegador? Valide o seu certificado aqui e o progresso dos módulos dele volta.',
    grupos: [
      { titulo: '↩️ Restaurar o progresso', itens: ['Ao validar um certificado pelo link ou código, aparece o botão "Restaurar o meu progresso neste navegador".', 'O progresso só volta se o nome salvo neste navegador for igual ao do certificado, com os mesmos acentos e maiúsculas.', 'Voltam o módulo do certificado e os anteriores da trilha, nas datas do certificado: o certificado emitido de novo é o mesmo. Nada do que já está no navegador é apagado.'] },
    ],
  },
  {
    versao: '0.4.0',
    data: '2026-10-14',
    titulo: 'PySpark no navegador',
    resumo: 'O quarto módulo: RDD, DataFrame, joins, janelas e Spark SQL, com as partições rodando em paralelo no seu computador.',
    grupos: [
      { titulo: '✨ PySpark', itens: ['14 lições e 45 exercícios: RDD, DataFrame, nulos, agregações, joins e broadcast, Window, leitura e escrita, Spark SQL, partições, shuffle, cache, explain e UDF.', 'Certificado PySpark para Dados.'] },
      { titulo: '⚡ Execução', itens: ['Uma aba nova mostra os estágios, as tarefas de cada partição e a linha do tempo dos workers, com uma tabela equivalente.', 'show(), printSchema(), explain() e as mensagens de erro saem no formato do Spark, conferidas com o PySpark real a cada versão.'] },
      { titulo: '♿ Acessibilidade', itens: ['O leitor de tela fala o resumo da execução: estágios, shuffles, tarefas e workers.'] },
    ],
  },
  {
    versao: '0.3.2',
    data: '2026-10-14',
    titulo: 'Um terminal de verdade',
    resumo: 'O input() é respondido no próprio terminal, o print aparece na hora, e dá para digitar comandos e usar o Python interativo (>>>).',
    grupos: [
      { titulo: '🖥️ Terminal', itens: ['O programa para no input() e você digita a resposta no terminal, na mesma linha da pergunta.', 'O print aparece na hora em que roda.', 'Depois que o programa termina, o prompt $ aceita python main.py, python (o modo >>>), python -i, ls, cat, clear e help.', 'Setas para o histórico, Tab para completar, Ctrl+C para interromper, Ctrl+D para o fim da entrada, Ctrl+L para limpar.', 'A aba ⌨️ Entrada saiu: tudo acontece no terminal. O ▶ Executar roda os testes visíveis e depois o programa, no terminal.'] },
      { titulo: '♿ Acessibilidade', itens: ['O campo do terminal tem rótulo (comando, resposta do input() ou linha do Python) e a saída nova é anunciada sem reler tudo.', 'Esc tira o foco do terminal (o Tab completa comandos).'] },
    ],
  },
  {
    versao: '0.3.1',
    data: '2026-10-14',
    titulo: 'Solução só depois de tentar',
    resumo: 'A aba Solução aparece depois do tempo estimado de cada exercício, e só enquanto ele não estiver resolvido.',
    grupos: [
      {
        titulo: '🧠 Aprender tentando',
        itens: [
          'A aba Solução aparece depois do tempo estimado do exercício (o ⏱ ~15, 30 ou 45 min ao lado da dificuldade). Até lá, a descrição diz quanto falta.',
          'O tempo conta só com o exercício aberto e a aba do navegador visível, e soma as vezes em que você voltou a ele.',
          'Depois que o exercício é resolvido, a aba Solução não aparece mais.',
          'No perfil sem pressão, o aviso não mostra contagem de minutos; o leitor de tela avisa quando a solução fica disponível.',
        ],
      },
    ],
  },
  {
    versao: '0.3.0',
    data: '2026-10-13',
    titulo: 'Paralelismo de verdade',
    resumo: 'O terceiro módulo: processos que rodam ao mesmo tempo nos núcleos do seu computador, asyncio e condições de corrida.',
    grupos: [
      { titulo: '⚡ Paralelismo', itens: ['10 lições e 35 exercícios: dividir o trabalho, partições, map-reduce, Pool, ProcessPoolExecutor, Process e Queue, asyncio, Lock, speedup e Lei de Amdahl.', 'Certificado Paralelismo em Python.'] },
      { titulo: '🧵 Processos no navegador', itens: ['multiprocessing e concurrent.futures funcionam como no Python, com workers de verdade.', 'Sem o if __name__ == "__main__": o erro é o mesmo do Python real.', 'A barra de status mostra quantas tarefas rodaram em quantos workers.'] },
      { titulo: '♿ Acessibilidade', itens: ['Onde o navegador não roda Python em paralelo, o terminal e o leitor de tela avisam que as tarefas rodaram em sequência.'] },
    ],
  },
  {
    versao: '0.2.0',
    data: '2026-10-13',
    titulo: 'Python para dados',
    resumo: 'O segundo módulo da trilha: dados de verdade em CSV e JSON, datas, geradores e itertools.',
    grupos: [
      { titulo: '📊 Python para dados', itens: ['10 lições e 40 exercícios: compreensões, tuplas, conjuntos, ordenação, Counter, CSV, JSON, datas, geradores, map, filter, reduce e itertools.', 'Certificado Python para Dados.'] },
      { titulo: '📦 Aba Dados', itens: ['Os arquivos de cada exercício aparecem numa tabela acessível; os casos ocultos usam outros dados.', 'O playground livre ganhou um vendas.csv de exemplo.'] },
      { titulo: '✅ Correção', itens: ['Exercícios que gravam arquivos são conferidos pelo conteúdo do arquivo.', 'Funções que devolvem geradores também são corrigidas.'] },
    ],
  },
  {
    versao: '0.1.0',
    data: '2026-10-13',
    titulo: 'Chegou o DivergePython',
    resumo: 'Python de verdade no navegador, com o primeiro módulo da trilha que vai até o PySpark.',
    grupos: [
      { titulo: '🐍 Python básico', itens: ['10 lições e 40 exercícios corrigidos na hora, com casos ocultos.', 'Certificado Fundamentos de Python.'] },
      { titulo: '🧪 Playground livre', itens: ['Python 3.14 à vontade, com input() pela aba ⌨️ Entrada.'] },
      { titulo: '♿ Acessível para todas as pessoas', itens: ['Leitor de tela, Libras (VLibras), teclado e perfis para TDAH, dislexia, autismo e ansiedade, como nos outros sites Diverge.'] },
      { titulo: '🔧 Por dentro', itens: ['Pyodide servido pelo próprio site, sem CDN de terceiros.', 'Base do paralelismo real (pool de workers), que entra na trilha no módulo ⚡ Paralelismo.'] },
    ],
  },
];
