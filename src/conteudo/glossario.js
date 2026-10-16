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

  // ---------- Paralelismo ----------
  {
    id: 'paralelismo', termo: 'Paralelismo', padroes: ['paralel(o|os|a|as|ismo|izar)', 'em paralelo'],
    definicao: 'Fazer várias partes do trabalho ao mesmo tempo, em núcleos diferentes do processador.',
    analogia: 'Três pessoas colhendo um roçado ao mesmo tempo, cada uma num pedaço, em vez de uma só fazendo tudo.',
    exemplo: 'with Pool(4) as pool:\n    resultados = pool.map(quadrado, range(8))',
  },
  {
    id: 'particao', termo: 'Partição', padroes: ['partiç(ão|ões)', 'particionar'],
    definicao: 'A parte dos dados que vai para um trabalhador. Pode ser decidida por hash (uma conta com a chave) ou por intervalo de valores.',
    analogia: 'As cartas separadas por letra do nome: cada carteiro leva um maço.',
    exemplo: 'particao = sum(ord(c) for c in "ana") % 3',
  },
  {
    id: 'map-reduce', termo: 'Map-reduce', padroes: ['map-reduce', 'mapreduce'],
    definicao: 'Uma receita em duas etapas: o map processa cada parte sozinha; o reduce junta os resultados parciais.',
    analogia: 'Cada pessoa conta os votos da sua urna (map); depois alguém soma as contagens de todas (reduce).',
    exemplo: 'parciais = [Counter(t.split()) for t in textos]  # map\ntotal = sum(parciais, Counter())  # reduce',
  },
  {
    id: 'processo', termo: 'Processo e Pool', padroes: ['processos?', 'Pool', 'ProcessPoolExecutor', 'workers?'],
    definicao: 'Um processo é um programa Python separado, com memória própria. O Pool abre alguns e divide o trabalho entre eles.',
    analogia: 'Uma cozinha com vários cozinheiros, cada um na sua bancada: não esbarram, mas precisam passar os pratos de mão em mão.',
    exemplo: 'from multiprocessing import Pool\nif __name__ == "__main__":\n    with Pool(2) as p:\n        print(p.map(abs, [-1, -2]))',
  },
  {
    id: 'main-guarda', termo: 'if __name__ == "__main__"', padroes: ['__main__', '__name__'],
    definicao: 'Um bloco que só roda quando o arquivo é o programa principal. Cada processo novo relê o arquivo, então quem cria processos fica dentro dele.',
    analogia: 'A placa "só para o gerente" na porta: os funcionários (processos filhos) passam pelo corredor, mas não entram.',
    exemplo: 'if __name__ == "__main__":\n    with Pool() as p:\n        print(p.map(abs, [-3]))',
  },
  {
    id: 'serializar', termo: 'Serializar (pickle)', padroes: ['serializ(ar|ação|ado)', 'pickle'],
    definicao: 'Transformar dados e funções em bytes para mandar a outro processo, que os monta de novo. Tem custo de tempo.',
    analogia: 'Desmontar um móvel para caber na caixa da mudança e montar de novo na casa nova.',
    exemplo: 'import pickle\ndados = pickle.dumps([1, 2, 3])\nprint(pickle.loads(dados))',
  },
  {
    id: 'asyncio', termo: 'asyncio e await', padroes: ['asyncio', 'await', 'async def', 'gather'],
    definicao: 'Uma forma de rodar várias tarefas que esperam (rede, disco): no await, a tarefa pausa e deixa outra andar.',
    analogia: 'O cozinheiro que põe o feijão no fogo e corta a cebola enquanto ele cozinha.',
    exemplo: 'async def main():\n    await asyncio.sleep(1)\nasyncio.run(main())',
  },
  {
    id: 'condicao-corrida', termo: 'Condição de corrida', padroes: ['condiç(ão|ões) de corrida', 'corrida'],
    definicao: 'Quando duas tarefas mexem no mesmo dado ao mesmo tempo e uma apaga o trabalho da outra, dependendo de quem chega primeiro.',
    analogia: 'Duas pessoas leem o saldo 100 no caderno, somam 10 cada uma e escrevem 110: um depósito sumiu.',
    exemplo: 'x = saldo\nawait asyncio.sleep(0)\nsaldo = x + 1  # outra tarefa pode ter mudado o saldo no meio',
  },
  {
    id: 'lock', termo: 'Lock (trava)', padroes: ['Lock', 'trava'],
    definicao: 'Uma trava que deixa só uma tarefa por vez num trecho do código.',
    analogia: 'A chave do único banheiro do posto: quem está com ela entra; os outros esperam.',
    exemplo: 'trava = asyncio.Lock()\nasync with trava:\n    saldo += 1',
  },
  {
    id: 'semaforo', termo: 'Semáforo', padroes: ['Semaphore', 'semáforos?'],
    definicao: 'Deixa no máximo k tarefas ao mesmo tempo num trecho do código.',
    analogia: 'O provador da loja com 3 cabines: a quarta pessoa espera alguém sair.',
    exemplo: 'sem = asyncio.Semaphore(3)\nasync with sem:\n    await baixar()',
  },
  {
    id: 'gil', termo: 'GIL', padroes: ['GIL', 'threads?'],
    definicao: 'A trava global do interpretador Python: só uma thread por vez roda código Python. Threads servem para esperar; para calcular em paralelo, use processos.',
    analogia: 'Uma cozinha com um único fogão: vários cozinheiros podem esperar ingredientes, mas só um cozinha por vez.',
    exemplo: '# esperar (rede, disco): asyncio ou threads\n# calcular: processos (Pool)',
  },
  {
    id: 'speedup', termo: 'Speedup', padroes: ['speedup', 'eficiência'],
    definicao: 'Quantas vezes o paralelo ficou mais rápido: tempo em sequência dividido pelo tempo em paralelo.',
    analogia: 'Se uma pessoa limpa a casa em 4 horas e quatro pessoas em 1 hora, o speedup é 4.',
    exemplo: 'speedup = 12 / 4  # 3 vezes mais rápido',
  },
  {
    id: 'amdahl', termo: 'Lei de Amdahl', padroes: ['Amdahl'],
    definicao: 'A parte do trabalho que não dá para paralelizar limita o ganho: com 10% em sequência, o speedup nunca passa de 10.',
    analogia: 'O ônibus só sai quando o último passageiro passa pela catraca: mais motoristas não adiantam.',
    exemplo: 'def amdahl(p, n):\n    return 1 / ((1 - p) + p / n)',
  },
  {
    id: 'skew', termo: 'Desequilíbrio (skew)', padroes: ['skew', 'desequilibr(io|ad[oa])'],
    definicao: 'Quando uma partição fica com muito mais dados que as outras e todo mundo espera por ela.',
    analogia: 'Na mudança, um carregador pega o piano e os outros, as almofadas: o caminhão só sai quando ele termina.',
    exemplo: 'tamanhos = [100, 2, 3]  # a primeira partição atrasa todas',
  },
  // ---------- PySpark ----------
  {
    id: 'spark', termo: 'Spark', padroes: ['spark', 'pyspark'],
    definicao: 'Um motor que divide o processamento de dados grandes entre vários computadores (os workers). O PySpark é o Spark usado pelo Python.',
    analogia: 'Um mutirão: o trabalho do roçado é dividido entre muita gente, e cada um faz a sua parte ao mesmo tempo.',
    exemplo: 'from pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()',
  },
  {
    id: 'sparksession', termo: 'SparkSession', padroes: ['SparkSession', 'sessão do spark'],
    definicao: 'O ponto de entrada do Spark: é por ela que você lê arquivos, cria DataFrames e roda SQL.',
    analogia: 'A recepção da empresa: tudo começa ali, e ela encaminha para o setor certo.',
    exemplo: 'spark = SparkSession.builder.appName("aula").getOrCreate()',
  },
  {
    id: 'rdd', termo: 'RDD', padroes: ['RDDs?'],
    definicao: 'A coleção distribuída do Spark: uma lista dividida em partições, que os workers processam em paralelo.',
    analogia: 'Uma colheita dividida em faixas do roçado: cada trabalhador cuida da sua faixa.',
    exemplo: 'rdd = sc.parallelize([1, 2, 3, 4])\nprint(rdd.map(lambda x: x * 2).collect())',
  },
  {
    id: 'dataframe', termo: 'DataFrame', padroes: ['DataFrames?'],
    definicao: 'Uma tabela distribuída, com colunas que têm nome e tipo. Você diz o que quer, e o Spark monta o plano.',
    analogia: 'Uma planilha gigante dividida entre vários computadores, que você usa como se fosse uma só.',
    exemplo: 'df = spark.createDataFrame([("Ana", 31)], ["nome", "idade"])\ndf.show()',
  },
  {
    id: 'preguicosa', termo: 'Avaliação preguiçosa: transformação e ação', padroes: ['preguiços[oa]', 'transformaç(ão|ões)', 'aç(ão|ões)'],
    definicao: 'Transformações (filter, select, groupBy) só anotam a receita; nada roda até uma ação (count, show, collect).',
    analogia: 'Anotar a lista de compras: ninguém sai de casa até alguém dizer "vai".',
    exemplo: 'pares = df.filter(df.id % 2 == 0)  # nada rodou\nprint(pares.count())  # agora roda',
  },
  {
    id: 'schema', termo: 'Schema', padroes: ['schemas?', 'printSchema'],
    definicao: 'A lista das colunas de um DataFrame, com o nome e o tipo de cada uma.',
    analogia: 'O cabeçalho de um formulário: diz o que vai em cada campo e de que jeito.',
    exemplo: 'df.printSchema()\n# |-- nome: string (nullable = true)',
  },
  {
    id: 'shuffle', termo: 'Shuffle', padroes: ['shuffles?', 'Exchange'],
    definicao: 'Quando os dados mudam de partição pela rede (groupBy, join, orderBy). É a parte cara de um job.',
    analogia: 'A apuração da eleição: os votos de todas as seções vão para a central para serem somados por candidato.',
    exemplo: 'df.groupBy("regiao").count().explain()  # o Exchange é o shuffle',
  },
  {
    id: 'estagio', termo: 'Estágio e tarefa', padroes: ['estágios?', 'tarefas?', 'jobs?'],
    definicao: 'Cada ação vira um job; o job se divide em estágios nos shuffles; cada estágio roda uma tarefa por partição.',
    analogia: 'Uma linha de produção: cada estação (estágio) tem vários operários (tarefas) fazendo a mesma coisa em peças diferentes.',
    exemplo: 'df.groupBy("regiao").count().show()  # veja a aba ⚡ Execução',
  },
  {
    id: 'broadcast', termo: 'Broadcast', padroes: ['broadcast', 'BroadcastHashJoin'],
    definicao: 'Mandar uma cópia de uma tabela pequena para cada worker, para o join não precisar de shuffle.',
    analogia: 'Dar a cada vendedor uma cópia da tabela de preços em vez de todo mundo ir perguntar no escritório.',
    exemplo: 'vendas.join(F.broadcast(regioes), "regiao")',
  },
  {
    id: 'join', termo: 'Join', padroes: ['joins?', 'SortMergeJoin', 'left_anti'],
    definicao: 'Juntar duas tabelas pelas linhas que têm a mesma chave. inner fica só com os pares; left fica com todas da esquerda.',
    analogia: 'Juntar a lista de alunos com a lista de notas pelo número da matrícula.',
    exemplo: 'pedidos.join(clientes, "id_cliente", "left")',
  },
  {
    id: 'janela', termo: 'Função de janela', padroes: ['janelas?', 'Window', 'row_number', 'rank'],
    definicao: 'Um cálculo que olha para as linhas vizinhas do mesmo grupo (posição, linha anterior, soma acumulada) sem juntar o grupo numa linha só.',
    analogia: 'O placar do campeonato: cada time sabe a sua posição e quantos pontos tinha na rodada passada.',
    exemplo: 'w = Window.partitionBy("regiao").orderBy("data")\nF.row_number().over(w)',
  },
  {
    id: 'spark-sql', termo: 'Spark SQL e view', padroes: ['spark\\.sql', 'Spark SQL', 'views?', 'createOrReplaceTempView'],
    definicao: 'Consultar DataFrames com SQL: a view dá um nome à tabela, e spark.sql devolve outro DataFrame.',
    analogia: 'Outra porta para a mesma loja: entrando pelo SQL ou pelo DataFrame, você chega às mesmas prateleiras.',
    exemplo: 'df.createOrReplaceTempView("vendas")\nspark.sql("SELECT regiao, COUNT(*) FROM vendas GROUP BY regiao").show()',
  },
  {
    id: 'cache', termo: 'Cache', padroes: ['cache', 'persist'],
    definicao: 'Guardar o resultado de um DataFrame na memória, para a próxima ação não refazer o caminho todo.',
    analogia: 'Deixar o feijão cozido na geladeira: no outro dia é só esquentar.',
    exemplo: 'caros = df.filter(df.preco > 10).cache()\ncaros.count()\ncaros.show()',
  },
  {
    id: 'explain', termo: 'Plano de execução (explain)', padroes: ['explain', 'plano de execução', 'plano físico'],
    definicao: 'O passo a passo que o Spark montou para rodar a consulta. df.explain() mostra: cada Exchange é um shuffle.',
    analogia: 'O roteiro da viagem antes de sair: dá para ver onde vai ter baldeação.',
    exemplo: 'df.groupBy("regiao").count().explain()',
  },
  {
    id: 'udf', termo: 'UDF', padroes: ['UDFs?'],
    definicao: 'Uma função Python sua usada dentro do Spark. É mais lenta que as funções prontas, porque cada valor passa pelo Python.',
    analogia: 'Um serviço terceirizado: resolve o que a casa não faz, mas cada pedido sai e volta pela portaria.',
    exemplo: '@F.udf("string")\ndef rotulo(x):\n    return "alto" if x > 10 else "baixo"',
  },
  {
    id: 'nulo', termo: 'Valor nulo (NULL)', padroes: ['NULL', 'nulos?', 'isNull'],
    definicao: 'Um valor que falta. NULL comparado com qualquer coisa não é verdadeiro nem falso: o filter descarta.',
    analogia: 'Uma resposta em branco no questionário: não dá para dizer se é sim ou não.',
    exemplo: 'df.filter(df.nota.isNull()).show()\ndf.na.fill({"nota": 0.0})',
  },
  // ---------- Spark além do batch ----------
  {
    id: 'micro-lote', termo: 'Micro-lote', padroes: ['micro-?lotes?'],
    definicao: 'Um pedaço dos dados que chegaram no streaming, processado de uma vez. O Structured Streaming roda um micro-lote atrás do outro.',
    analogia: 'A passada no pluviômetro: a cada visita você anota só o que choveu desde a última.',
    exemplo: 'q = df.writeStream.format("console").start()\nq.processAllAvailable()  # Batch: 0, Batch: 1...',
  },
  {
    id: 'estado-streaming', termo: 'Estado', padroes: ['estado'],
    definicao: 'O que uma consulta de streaming guarda entre um micro-lote e outro, como a contagem de cada chave até agora.',
    analogia: 'O caderno do apurador: a cada urna nova, ele soma aos totais que já anotou.',
    exemplo: 'contagem = leituras.groupBy("estacao").count()  # a contagem é o estado',
  },
  {
    id: 'marca-dagua', termo: "Marca d'água", padroes: ["marca d['’]água", 'watermark'],
    definicao: 'Até onde o streaming espera dados atrasados: o maior tempo de evento já visto menos o atraso aceito. O que chega antes dela é descartado.',
    analogia: 'O fim da feira: depois de certa hora, quem chega com mercadoria não monta mais a banca.',
    exemplo: 'df.withWatermark("momento", "5 minutes")',
  },
  {
    id: 'gatilho', termo: 'Gatilho', padroes: ['gatilhos?', 'trigger'],
    definicao: 'Quando a consulta de streaming roda um micro-lote: a cada intervalo, uma vez só, ou até acabar o que já chegou.',
    analogia: 'O despertador do vigia: ele faz a ronda a cada hora, ou uma vez antes de fechar.',
    exemplo: 'df.writeStream.trigger(availableNow=True).start()',
  },
  {
    id: 'modo-saida', termo: 'Modo de saída', padroes: ['modos? de saída', 'outputMode'],
    definicao: 'O que sai em cada micro-lote: append (só as linhas novas), complete (a tabela inteira) ou update (só o que mudou).',
    analogia: 'O boletim da chuva: só as cidades novas, a lista inteira de novo, ou só quem mudou desde o último.',
    exemplo: 'df.writeStream.outputMode("update")',
  },
  {
    id: 'tempo-evento', termo: 'Tempo do evento', padroes: ['tempo do evento'],
    definicao: 'A hora em que a coisa aconteceu (a leitura da estação), e não a hora em que o dado chegou ao Spark.',
    analogia: 'A data da carta é a do dia em que foi escrita, não a do dia em que o carteiro entregou.',
    exemplo: 'F.window("momento", "10 minutes")  # momento é o tempo do evento',
  },
  {
    id: 'feature', termo: 'Feature', padroes: ['features?'],
    definicao: 'Uma característica usada pelo modelo para prever: chuva, área, irrigação.',
    analogia: 'Os dados da ficha do agricultor que o agrônomo olha antes de dar o palpite da safra.',
    exemplo: 'VectorAssembler(inputCols=["chuva_mm", "area_ha"], outputCol="features")',
  },
  {
    id: 'vetor', termo: 'Vetor', padroes: ['vetor(es)?', 'DenseVector', 'SparseVector'],
    definicao: 'Uma lista de números numa coluna só. No MLlib, as features de cada linha vão juntas num vetor.',
    analogia: 'O cartão com todos os números da roça, em vez de folhas soltas.',
    exemplo: 'from pyspark.ml.linalg import Vectors\nVectors.dense([300.0, 5.0, 1.0])',
  },
  {
    id: 'estimador', termo: 'Estimador', padroes: ['estimador(es)?', 'Estimator'],
    definicao: 'Algo que aprende com os dados (fit) e devolve um modelo, como o LinearRegression ou o StringIndexer.',
    analogia: 'O aprendiz que observa a colheita e, depois, sabe dar o palpite sozinho.',
    exemplo: 'modelo = LinearRegression(labelCol="producao_t").fit(dados)',
  },
  {
    id: 'transformador', termo: 'Transformador', padroes: ['transformador(es)?', 'Transformer'],
    definicao: 'Algo que muda um DataFrame com transform: o VectorAssembler e todo modelo treinado.',
    analogia: 'A máquina de beneficiar: entra o grão, sai o grão limpo.',
    exemplo: 'com_features = montador.transform(treino)',
  },
  {
    id: 'pipeline', termo: 'Pipeline', padroes: ['pipelines?'],
    definicao: 'As etapas de preparo e o modelo em ordem: o fit treina tudo, e o modelo do pipeline faz tudo de uma vez nos dados novos.',
    analogia: 'A linha da casa de farinha: descascar, ralar, prensar e torrar, sempre na mesma ordem.',
    exemplo: 'Pipeline(stages=[indexador, montador, regressao]).fit(treino)',
  },
  {
    id: 'overfitting', termo: 'Overfitting', padroes: ['overfitting', 'sobreajuste'],
    definicao: 'Quando o modelo decora o treino em vez de aprender: vai muito bem nele e mal em dados que nunca viu.',
    analogia: 'O aluno que decorou as respostas da prova do ano passado e não sabe resolver a deste ano.',
    exemplo: 'treino, teste = df.randomSplit([0.8, 0.2], seed=1)',
  },
  {
    id: 'log-transacoes', termo: 'Log de transações', padroes: ['log de transaç(ão|ões)', '_delta_log'],
    definicao: 'A pasta _delta_log de uma tabela Delta: um arquivo por versão, dizendo o que entrou e o que saiu.',
    analogia: 'O livro-caixa da cooperativa: cada lançamento numa página nova, nada é apagado.',
    exemplo: 'os.listdir("estoque/_delta_log")',
  },
  {
    id: 'time-travel', termo: 'Time travel', padroes: ['time travel', 'versionAsOf', 'timestampAsOf'],
    definicao: 'Ler uma tabela Delta como ela era numa versão (ou numa hora) do passado.',
    analogia: 'Folhear o livro-caixa até a página de ontem.',
    exemplo: 'spark.read.format("delta").option("versionAsOf", 0).load("estoque")',
  },
  {
    id: 'upsert', termo: 'Upsert', padroes: ['upsert'],
    definicao: 'Atualizar o que já existe e inserir o que é novo, numa operação só (o merge do Delta).',
    analogia: 'Na chegada da mercadoria, o que já tem na prateleira soma, e o produto novo ganha prateleira.',
    exemplo: 'tabela.alias("e").merge(novos.alias("n"), "e.id = n.id").whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()',
  },
  {
    id: 'vacuum', termo: 'Vacuum', padroes: ['vacuum'],
    definicao: 'Apagar de verdade os arquivos que nenhuma versão recente de uma tabela Delta usa. Depois dele, o time travel para antes da retenção não funciona.',
    analogia: 'Jogar fora os rascunhos velhos: o armário esvazia, mas não dá mais para consultar.',
    exemplo: 'DeltaTable.forPath(spark, "estoque").vacuum(168)',
  },
  // ---------- Projetos ----------
  {
    id: 'percentil', termo: 'Percentil', padroes: ['percentil', 'percentis', 'p95', 'mediana'],
    definicao: 'O valor que deixa uma fração dos dados abaixo dele: o percentil 90 é maior ou igual a 90% dos valores. A mediana é o percentil 50.',
    analogia: 'A fila da merenda por altura: o percentil 90 é quem só tem 10% da fila mais alta que ele.',
    exemplo: 'df.agg(F.percentile_approx("ms", 0.95))',
  },
  {
    id: 'palavras-vazias', termo: 'Palavras vazias (stop words)', padroes: ['palavras? vazias?', 'stop ?words?'],
    definicao: 'Palavras muito comuns (a, o, de, que) que quase não dizem nada sobre o texto; saem antes de contar.',
    analogia: 'O "é..." e o "tipo assim" de quem conversa: aparecem toda hora, mas não contam a história.',
    exemplo: 'contagem.join(vazias, "palavra", "left_anti")',
  },
  {
    id: 'funil', termo: 'Funil de conversão', padroes: ['funil', 'funis', 'convers(ão|ões)'],
    definicao: 'As etapas por que o cliente passa até comprar (visita, carrinho, compra) e quantos chegam a cada uma.',
    analogia: 'A peneira do garimpo: entra muita areia, e a cada peneira fica menos, até sobrar o ouro.',
    exemplo: 'eventos.groupBy("evento").agg(F.countDistinct("usuario"))',
  },
  {
    id: 'salting', termo: 'Salting (sal na chave)', padroes: ['salting', 'salgar', 'salgad[ao]s?'],
    definicao: 'Acrescentar à chave de um groupBy ou join um pedaço a mais (o sal) para repartir uma chave grande em várias tarefas; depois, uma segunda agregação junta os pedaços.',
    analogia: 'A fila única do banco virando quatro caixas: o mesmo povo, atendido em paralelo.',
    exemplo: 'df.withColumn("sal", F.col("id") % 4).groupBy("terminal", "sal").count()',
  },
  {
    id: 'media-movel', termo: 'Média móvel', padroes: ['médias? móve(l|is)'],
    definicao: 'A média de uma janela que anda junto com o tempo: a de hoje usa hoje e os dias anteriores. Alisa os altos e baixos de um dia só.',
    analogia: 'Olhar a chuva da semana, e não a de um dia: um temporal isolado não muda tudo.',
    exemplo: 'F.avg("casos").over(Window.partitionBy("municipio").orderBy("dia").rowsBetween(-6, 0))',
  },
  {
    id: 'pivot', termo: 'Pivot e unpivot', padroes: ['pivot', 'unpivot', 'formato (largo|longo)'],
    definicao: 'O pivot vira os valores de uma coluna em colunas (do formato longo para o largo); o unpivot faz a volta.',
    analogia: 'A tabela da merenda: uma linha por dia e uma coluna por turma, em vez de uma linha para cada dia e turma.',
    exemplo: 'df.groupBy("cultura").pivot("ano").sum("toneladas")',
  },
  {
    id: 'medalhao', termo: 'Arquitetura medalhão (bronze, prata, ouro)', padroes: ['medalhão', 'camadas? (bronze|prata|ouro)'],
    definicao: 'Organizar o lago de dados em camadas: bronze guarda os dados como chegaram, prata limpos e tipados, ouro agregados para o relatório.',
    analogia: 'O caminho do algodão: o fardo que chega do roçado, o fio limpo e penteado, e o pano pronto para a costureira.',
    exemplo: 'bruto.write.format("delta").save("bronze")',
  },
  {
    id: 'scd2', termo: 'SCD tipo 2 (histórico)', padroes: ['scd( tipo)? ?2', 'dimens(ão|ões) que mudam? devagar'],
    definicao: 'Guardar o histórico de uma tabela: quando um valor muda, a linha antiga ganha a data de fim e uma linha nova entra com a data de início.',
    analogia: 'O caderno de endereços que não apaga: risca o endereço velho com a data da mudança e escreve o novo embaixo.',
    exemplo: 'whenMatchedUpdate(set={"fim": "e.dia", "atual": "false"})',
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
const INICIO_DO_NIVEL = { basico: 'variavel', dados: 'comprehension', paralelismo: 'paralelismo', pyspark: 'spark', alem: 'micro-lote', projetos: 'percentil' };
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
 * Termos do glossário que aparecem no texto, na ordem em que aparecem, até o nível do
 * módulo. Se passarem de `max`, ficam os do nível do módulo (ou o mais próximo dele).
 */
export function termosDoTexto(texto, { max = MAX_TERMOS, modulo } = {}) {
  const nivelItem = modulo ? ORDEM_MODULOS.indexOf(modulo) : Infinity;
  const prioridade = (t) => Math.min(NIVEL.get(t.id), nivelItem);
  return GLOSSARIO
    // Um termo de um módulo que vem depois não aparece antes (o "join" do str.join não é o join do Spark).
    .filter((t) => NIVEL.get(t.id) <= nivelItem)
    .map((t) => ({ termo: t, posicao: texto.search(REGEX.get(t.id)) }))
    .filter((x) => x.posicao >= 0)
    .sort((a, b) => prioridade(b.termo) - prioridade(a.termo) || a.posicao - b.posicao)
    .slice(0, max)
    .sort((a, b) => a.posicao - b.posicao)
    .map((x) => x.termo);
}
