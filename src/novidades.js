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
