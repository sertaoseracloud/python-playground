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
  {
    id: 'none', termo: 'None', padroes: ['None'],
    definicao: 'O valor que significa "nada". Uma função sem return devolve None.',
    analogia: 'Uma caixa vazia de propósito: existe, mas não tem nada dentro.',
    exemplo: 'def achar(lista):\n    return lista[0] if lista else None\nprint(achar([]))',
  },
  {
    id: 'conjunto', termo: 'Conjunto (set)', padroes: ['conjuntos?', 'set'],
    definicao: 'Uma coleção sem repetição e sem ordem garantida. Bom para saber rápido se um valor já apareceu.',
    analogia: 'A lista de convidados na portaria: cada nome entra uma vez só.',
    exemplo: 'vistos = set()\nvistos.add("umbu")\nprint("umbu" in vistos)',
  },
  {
    id: 'ordenar', termo: 'Ordenar (sorted)', padroes: ['orde(m|nar|nada|nado|nados|nadas)', 'sorted', 'alfabétic(a|o)'],
    definicao: 'sorted(colecao) devolve uma lista nova em ordem. key= diz por qual valor comparar.',
    analogia: 'Arrumar as cartas na mão: do menor para o maior, ou pelo critério que você escolher.',
    exemplo: 'print(sorted([3, 1, 2]))\nprint(sorted(["bia", "Al"], key=str.lower))',
  },
  {
    id: 'argumento-padrao', termo: 'Argumento padrão', padroes: ['argumentos? padrão', 'valor padrão'],
    definicao: 'Um parâmetro com valor já definido, usado quando quem chama a função não passa esse argumento.',
    analogia: 'O "sem açúcar" que vem marcado no pedido do café: só muda se você pedir.',
    exemplo: 'def ola(nome, cumprimento="Olá"):\n    return f"{cumprimento}, {nome}!"\nprint(ola("Ana"))',
  },
  {
    id: 'busca-binaria', termo: 'Busca binária', padroes: ['busca binária'],
    definicao: 'Procura numa lista ordenada olhando o meio e descartando metade a cada passo.',
    analogia: 'Achar uma palavra no dicionário de papel: abre no meio e decide se vai para a frente ou para trás.',
    exemplo: 'inicio, fim = 0, len(lista) - 1\nmeio = (inicio + fim) // 2',
  },

  // ---------- Python para dados ----------
  {
    id: 'comprehension', termo: 'Compreensão de lista', padroes: ['compreens(ão|ões)', 'comprehensions?'],
    definicao: 'Um jeito curto de montar uma lista (ou dicionário, ou conjunto) a partir de outra, com for e if dentro dos colchetes.',
    analogia: 'Pedir "um suco de cada fruta madura da cesta" de uma vez, em vez de pedir fruta por fruta.',
    exemplo: 'dobros = [n * 2 for n in [1, 2, 3]]\nprint(dobros)',
  },
  {
    id: 'desempacotar', termo: 'Desempacotar', padroes: ['desempacot(ar|amento)', 'zip', 'enumerate'],
    definicao: 'Abrir uma tupla ou lista em várias variáveis de uma vez. zip e enumerate entregam tuplas prontas para desempacotar.',
    analogia: 'Abrir a sacola da feira e pôr cada coisa no seu lugar: o arroz no armário, o feijão na prateleira.',
    exemplo: 'x, y = (3, 4)\nfor i, nome in enumerate(["Ana", "Bia"], start=1):\n    print(i, nome)',
  },
  {
    id: 'counter', termo: 'Counter', padroes: ['Counter', 'most_common'],
    definicao: 'Um dicionário que conta quantas vezes cada valor aparece. most_common(n) devolve os n mais frequentes.',
    analogia: 'A urna da votação já apurada: cada candidato com o seu número de votos.',
    exemplo: 'from collections import Counter\nprint(Counter("arara").most_common(1))',
  },
  {
    id: 'defaultdict', termo: 'defaultdict', padroes: ['defaultdict', 'agrup(ar|e|a)'],
    definicao: 'Um dicionário que cria um valor padrão (uma lista vazia, um zero) quando a chave ainda não existe. Ótimo para agrupar.',
    analogia: 'Um arquivo de pastas em que, ao chegar um papel de um assunto novo, já aparece uma pasta vazia com o nome dele.',
    exemplo: 'from collections import defaultdict\ngrupos = defaultdict(list)\ngrupos["CE"].append("Sobral")',
  },
  {
    id: 'csv', termo: 'CSV', padroes: ['CSV', 'DictReader', 'csv\\.writer', 'cabeçalho'],
    definicao: 'Uma tabela em texto: cada linha é um registro e as colunas são separadas por vírgula. A primeira linha costuma ser o cabeçalho.',
    analogia: 'Uma planilha impressa em papel, com vírgulas no lugar das linhas que separam as colunas.',
    exemplo: 'import csv\nwith open("vendas.csv") as f:\n    for linha in csv.DictReader(f):\n        print(linha["produto"])',
  },
  {
    id: 'json-termo', termo: 'JSON', padroes: ['JSON', 'json\\.load', 'json\\.dump'],
    definicao: 'Um formato de texto para guardar e trocar dados, parecido com dicionários e listas do Python.',
    analogia: 'Um formulário padrão que qualquer sistema sabe preencher e ler, em qualquer língua de programação.',
    exemplo: 'import json\ndados = json.loads(\'{"nome": "Ana"}\')\nprint(dados["nome"])',
  },
  {
    id: 'datetime', termo: 'Datas (datetime)', padroes: ['datetime', 'timedelta', 'fromisoformat', 'weekday', 'datas?'],
    definicao: 'O módulo datetime representa datas: dá para subtrair (o resultado é um timedelta) e saber o dia da semana.',
    analogia: 'Um calendário de parede que também faz as contas de quantos dias faltam.',
    exemplo: 'from datetime import date\nprint((date(2026, 12, 25) - date(2026, 10, 13)).days)',
  },
  {
    id: 'gerador', termo: 'Gerador (yield)', padroes: ['geradore?s?', 'yield'],
    definicao: 'Uma função com yield, que entrega um valor de cada vez, só quando alguém pede, em vez de montar a lista inteira.',
    analogia: 'A torneira aberta, e não o balde cheio: a água sai conforme você precisa.',
    exemplo: 'def contar(n):\n    for i in range(n):\n        yield i\nprint(list(contar(3)))',
  },
  {
    id: 'lambda', termo: 'lambda', padroes: ['lambda'],
    definicao: 'Uma função curta, sem nome, escrita numa linha. Muito usada como key do sorted e com map e filter.',
    analogia: 'Um bilhete com uma instrução rápida, em vez de um manual completo.',
    exemplo: 'dobro = lambda x: x * 2\nprint(sorted(["bb", "a"], key=lambda p: len(p)))',
  },
  {
    id: 'map-filter', termo: 'map e filter', padroes: ['map', 'filter'],
    definicao: 'map aplica uma função em cada item; filter fica só com os itens em que a função dá verdadeiro.',
    analogia: 'Na esteira da fábrica, map embala cada peça; filter tira as peças com defeito.',
    exemplo: 'print(list(map(str.upper, ["a", "b"])))\nprint(list(filter(lambda n: n > 0, [-1, 2])))',
  },
  {
    id: 'reduce', termo: 'reduce', padroes: ['reduce'],
    definicao: 'Junta todos os itens num valor só, aplicando a função passo a passo: primeiro com os dois primeiros, depois com o resultado e o próximo.',
    analogia: 'A calculadora de fita que vai somando item por item até o total.',
    exemplo: 'from functools import reduce\nprint(reduce(lambda a, b: a * b, [2, 3, 4], 1))',
  },
  {
    id: 'itertools', termo: 'itertools', padroes: ['itertools', 'combinations', 'islice', 'accumulate', 'groupby'],
    definicao: 'Um módulo com ferramentas prontas para percorrer dados: combinações, fatias de geradores, somas acumuladas e grupos.',
    analogia: 'Uma caixa de ferramentas de marceneiro: cada peça faz um corte específico, sem precisar inventar.',
    exemplo: 'from itertools import combinations\nprint(list(combinations("abc", 2)))',
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
const INICIO_DO_NIVEL = { basico: 'variavel', dados: 'comprehension' };
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
