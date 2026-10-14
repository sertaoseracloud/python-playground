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
