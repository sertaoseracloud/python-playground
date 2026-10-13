// Glossário: cada termo técnico com uma explicação simples, uma analogia do dia a
// dia e um exemplo curto. A descrição de cada desafio mostra os termos que aparecem
// no texto dele (até MAX_TERMOS, na ordem em que aparecem), para não sobrecarregar.
//
// `padroes` são regex (sem flags; usamos 'iu'), testadas no texto visível do desafio.
// Bordas de palavra são tratadas em `termosDoTexto`, porque \b não entende acentos.

export const MAX_TERMOS = 6;

export const GLOSSARIO = [
  // ---------- Python básico ----------
  {
    id: 'variavel', termo: 'Variável', padroes: ['variáve(l|is)'],
    definicao: 'Um nome que guarda um valor para usar depois.',
    analogia: 'Uma caixa com etiqueta: a etiqueta é o nome, e o que está dentro é o valor.',
    exemplo: 'idade = 30\nprint(idade)',
  },
  {
    id: 'print', termo: 'print', padroes: ['print'],
    definicao: 'Função que mostra um texto ou um valor no terminal.',
    analogia: 'O alto-falante do programa: tudo o que passa por ele, você ouve (vê) no terminal.',
    exemplo: 'print("Olá!")\nprint(2 + 3)',
  },
  {
    id: 'string', termo: 'String (texto)', padroes: ['strings?', 'textos?'],
    definicao: 'Um valor de texto, escrito entre aspas simples ou duplas.',
    analogia: 'Um colar de contas: cada letra é uma conta, na ordem certa.',
    exemplo: 'nome = "Sertão"\nprint(nome.upper())',
  },
  {
    id: 'fstring', termo: 'f-string', padroes: ['f-strings?'],
    definicao: 'Texto que começa com f e coloca valores no meio, dentro de { }.',
    analogia: 'Um formulário com lacunas: o Python preenche cada lacuna com o valor da variável.',
    exemplo: 'nome = "Ana"\nprint(f"Olá, {nome}!")',
  },
  {
    id: 'inteiro', termo: 'Inteiro (int)', padroes: ['inteiros?', 'int'],
    definicao: 'Número sem casas decimais. int("42") transforma um texto em número inteiro.',
    analogia: 'A contagem de pessoas numa fila: ninguém conta meia pessoa.',
    exemplo: 'idade = int("30")\nprint(idade + 1)',
  },
  {
    id: 'float', termo: 'Float (número com vírgula)', padroes: ['float', 'decimais?'],
    definicao: 'Número com casas decimais. Em Python, a vírgula decimal é um ponto: 1.5.',
    analogia: 'O preço no mercado: R$ 4,99 tem centavos, não é um número redondo.',
    exemplo: 'altura = 1.65\nprint(round(10 / 3, 2))',
  },
  {
    id: 'input', termo: 'input', padroes: ['input'],
    definicao: 'Função que lê uma linha digitada por quem usa o programa. Sempre devolve texto.',
    analogia: 'O balcão de atendimento: o programa pergunta e espera a resposta.',
    exemplo: 'nome = input("Seu nome: ")\nprint("Oi", nome)',
  },
  {
    id: 'condicao', termo: 'Condição (if)', padroes: ['if', 'condiç(ão|ões)', 'elif', 'else'],
    definicao: 'Escolhe o que fazer: se a condição for verdadeira, roda um bloco; senão, outro.',
    analogia: 'Uma bifurcação na estrada: se chover, pega o guarda-chuva; senão, o chapéu.',
    exemplo: 'if nota >= 7:\n    print("aprovado")\nelse:\n    print("recuperação")',
  },
  {
    id: 'laco', termo: 'Laço (for, while)', padroes: ['laços?', 'for', 'while', 'repeti(r|ção)'],
    definicao: 'Repete um bloco de código: for passa por cada item; while repete enquanto algo for verdade.',
    analogia: 'Dar a volta na quadra: for é "dê 3 voltas"; while é "corra até cansar".',
    exemplo: 'for i in range(3):\n    print(i)',
  },
  {
    id: 'funcao', termo: 'Função', padroes: ['funç(ão|ões)', 'def'],
    definicao: 'Um bloco de código com nome, que recebe valores (parâmetros) e pode devolver um resultado (return).',
    analogia: 'Uma receita: você entrega os ingredientes (parâmetros) e recebe o bolo (retorno).',
    exemplo: 'def dobro(n):\n    return n * 2\n\nprint(dobro(4))',
  },
  {
    id: 'retorno', termo: 'Retorno (return)', padroes: ['return', 'retorn(o|a|ar)', 'devolv(e|er)'],
    definicao: 'O valor que a função entrega para quem a chamou. print só mostra; return devolve.',
    analogia: 'A máquina de café: print é a luz que acende; return é o café que sai na xícara.',
    exemplo: 'def soma(a, b):\n    return a + b\n\ntotal = soma(2, 3)',
  },
  {
    id: 'lista', termo: 'Lista', padroes: ['listas?'],
    definicao: 'Uma sequência de valores entre [ ], na ordem em que foram colocados.',
    analogia: 'A lista de compras: cada item tem uma posição, e dá para riscar ou acrescentar.',
    exemplo: 'frutas = ["caju", "umbu"]\nfrutas.append("pitomba")',
  },
  {
    id: 'indice', termo: 'Índice', padroes: ['índices?', 'posiç(ão|ões)'],
    definicao: 'A posição de um item numa lista ou num texto. A contagem começa em 0.',
    analogia: 'O número da poltrona no ônibus, só que a primeira poltrona é a 0.',
    exemplo: 'frutas = ["caju", "umbu"]\nprint(frutas[0])  # caju',
  },
  {
    id: 'tupla', termo: 'Tupla', padroes: ['tuplas?'],
    definicao: 'Parecida com a lista, mas entre ( ) e sem poder mudar depois de criada.',
    analogia: 'Uma data de nascimento: dia, mês e ano juntos, que não mudam.',
    exemplo: 'ponto = (3, 4)\nx, y = ponto',
  },
  {
    id: 'dicionario', termo: 'Dicionário', padroes: ['dicionários?'],
    definicao: 'Guarda pares chave → valor entre { }. Você busca o valor pela chave.',
    analogia: 'Uma agenda de telefones: procura pelo nome (chave) e acha o número (valor).',
    exemplo: 'idades = {"Ana": 30}\nprint(idades["Ana"])',
  },
  {
    id: 'excecao', termo: 'Exceção', padroes: ['exceç(ão|ões)', 'try', 'except', 'raise', 'levant(a|ar)'],
    definicao: 'Um erro durante a execução. try/except trata o erro; raise cria um erro de propósito.',
    analogia: 'O alarme de incêndio: raise aperta o botão; except é a brigada que sabe o que fazer.',
    exemplo: 'try:\n    n = int("abc")\nexcept ValueError:\n    print("não é número")',
  },
];

// Letras (com acento), dígitos, _ e $ contam como parte de uma palavra.
const LETRA = '[\\p{L}\\p{N}_$]';
const REGEX = new Map(GLOSSARIO.map((t) => [
  t.id,
  new RegExp(`(?<!${LETRA})(?:${t.padroes.join('|')})(?!${LETRA})`, 'iu'),
]));

// Nível de cada termo: o módulo em que ele aparece primeiro (a ordem do glossário).
const ORDEM_MODULOS = ['basico', 'dados', 'paralelismo', 'pyspark', 'alem', 'projetos'];
const INICIO_DO_NIVEL = { basico: 'variavel' };
const NIVEL = new Map();
{
  let nivel = 0;
  for (const t of GLOSSARIO) {
    const novo = Object.entries(INICIO_DO_NIVEL).find(([, id]) => id === t.id);
    if (novo) nivel = ORDEM_MODULOS.indexOf(novo[0]);
    NIVEL.set(t.id, nivel);
  }
}

/**
 * Termos do glossário que aparecem no texto, na ordem em que aparecem.
 * Se passarem de `max`, ficam os do nível do módulo (ou o mais próximo dele).
 */
export function termosDoTexto(texto, { max = MAX_TERMOS, modulo } = {}) {
  const nivelItem = modulo ? ORDEM_MODULOS.indexOf(modulo) : Infinity;
  const prioridade = (t) => Math.min(NIVEL.get(t.id), nivelItem);
  return GLOSSARIO
    .map((t) => ({ termo: t, posicao: texto.search(REGEX.get(t.id)) }))
    .filter((x) => x.posicao >= 0)
    .sort((a, b) => prioridade(b.termo) - prioridade(a.termo) || a.posicao - b.posicao)
    .slice(0, max)
    .sort((a, b) => a.posicao - b.posicao)
    .map((x) => x.termo);
}
