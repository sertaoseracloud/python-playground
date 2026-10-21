// Falas dos moradores dos cenários da trilha (src/ui/cenarios): clicar ou tocar num personagem, ou
// abrir "Conhecer a vila", mostra a definição curta de um conceito do curso, para revisar. Texto
// simples, sem resposta de exercício e sem detalhe de como a correção funciona. Cada site tem as suas.
export const FALAS_DA_VILA = {
  vaqueiro: { nome: 'Vaqueiro', falas: ['Variável: um nome que aponta para um valor; em Python, nasce na primeira atribuição.', 'Função: um bloco com nome, criado com def, que recebe argumentos e devolve um resultado.', 'Indentação: os espaços no começo da linha, que em Python dizem o que está dentro de cada bloco.'] },
  cabrita: { nome: 'Cabrita', falas: ['Lista: uma sequência de valores que pode mudar, escrita entre colchetes.', 'Dicionário: pares chave-valor, escritos entre chaves, para achar um valor pelo nome.'] },
  calango: { nome: 'Calango', falas: ['for: o laço que passa por cada item de uma sequência, um de cada vez.'] },
  agricultora: { nome: 'Agricultora', falas: ['DataFrame: uma tabela de dados com linhas e colunas nomeadas, como no pandas.', 'Série: uma coluna de dados com índice, a peça que forma o DataFrame.'] },
  jumento: { nome: 'Jumento', falas: ['Agrupar: juntar as linhas que têm o mesmo valor numa coluna para resumir cada grupo, como no groupby.'] },
  'asa-branca': { nome: 'Asa-branca', falas: ['CSV: um arquivo de texto com valores separados por vírgula, uma linha por registro.'] },
  pinguim: { nome: 'Pinguim', falas: ['Thread: uma linha de execução dentro do mesmo programa, que divide a memória com as outras.', 'Processo: um programa em execução, com memória própria, separado dos outros.'] },
  'raposa-do-artico': { nome: 'Raposa-do-ártico', falas: ['GIL: a trava do CPython que deixa só uma thread rodar código Python por vez.'] },
  'coruja-das-neves': { nome: 'Coruja-das-neves', falas: ['asyncio: o jeito do Python de esperar várias tarefas de entrada e saída ao mesmo tempo, com async e await.'] },
  salamandra: { nome: 'Salamandra', falas: ['Spark: um motor que processa muitos dados dividindo o trabalho entre várias máquinas.', 'RDD: a coleção distribuída básica do Spark, dividida em partes espalhadas pelo cluster.'] },
  ferreiro: { nome: 'Ferreiro', falas: ['Transformação: uma operação do Spark que descreve um novo conjunto de dados, como filter ou map.', 'Ação: a operação que faz o Spark executar o plano e devolver um resultado, como count ou collect.'] },
  fenix: { nome: 'Fênix', falas: ['Avaliação preguiçosa: o Spark só calcula quando uma ação pede, e assim otimiza o caminho todo.'] },
  jangadeiro: { nome: 'Jangadeiro', falas: ['Módulo: um arquivo .py com código que outros arquivos podem importar.', 'Ambiente virtual: uma pasta com um Python e pacotes só para um projeto, criada com venv.'] },
  peixe: { nome: 'Peixe', falas: ['pip: o instalador de pacotes do Python.'] },
  garca: { nome: 'Garça', falas: ['Exceção: o erro que interrompe o programa, a menos que um try/except o trate.'] },
  jardineira: { nome: 'Jardineira', falas: ['Classe: o molde que define os dados e os métodos de um tipo de objeto.', 'Objeto: um valor criado a partir de uma classe, com os seus próprios dados.'] },
  borboleta: { nome: 'Borboleta', falas: ['Método: uma função que pertence a uma classe e recebe o próprio objeto como self.'] },
  'beija-flor': { nome: 'Beija-flor', falas: ['Compreensão de lista: um jeito curto de criar uma lista a partir de outra, numa linha só.'] },
  operaria: { nome: 'Operária da noite', falas: ['Teste: código que confere se outro código faz o que deveria, como os do pytest.', 'Refatorar: mudar a estrutura do código sem mudar o que ele faz.'] },
  robozinho: { nome: 'Robozinho', falas: ['Script: um arquivo Python feito para rodar do começo ao fim e automatizar uma tarefa.'] },
  gato: { nome: 'Gato da cidade', falas: ['f-string: um texto com f na frente, que mostra valores de variáveis entre chaves.'] },
};

/** Emojis das conversas, por cenário (o balão de quem conversa). */
export const EMOJIS_DA_CONVERSA = {
  sertao: ['🐍', '🌵', '☀️'],
  vale: ['📊', '🌾', '🐼'],
  gelo: ['🧵', '❄️', '⏳'],
  fogo: ['🔥', '✨', '⚡'],
  rio: ['📦', '🌊', '🐍'],
  jardim: ['🌸', '🐍', '🌿'],
  cidade: ['🌙', '🏗️', '💡'],
};
