// 📊 Python para dados: compreensões, tuplas, conjuntos, ordenação, Counter e
// defaultdict, CSV, JSON, datas, geradores, map/filter/reduce e itertools.
// Os exercícios com arquivos (CSV, JSON) e os de datas, geradores e itertools ficam
// em dados-arquivos.js; aqui eles entram depois da lição de cada assunto.
import { py, main, assinatura } from './util.js';

const comCollections = (def) => main(`from collections import Counter, defaultdict\n\n\ndef ${def}:\n    pass\n`);

const licoes = {
  comprehensions: {
    id: 'licao-comprehensions',
    tipo: 'licao',
    titulo: 'Compreensões (comprehensions)',
    resumo: `
      <p>Uma <b>compreensão de lista</b> monta uma lista numa linha: <code>[n * 2 for n in numeros]</code>.
        É como dizer à cozinha "um suco de cada fruta da cesta" em vez de pedir um por um.</p>
      <p>Dá para filtrar com <code>if</code> no fim: <code>[n for n in numeros if n &gt; 0]</code>.
        A mesma ideia vale para dicionários (<code>{k: v for ...}</code>) e conjuntos (<code>{x for ...}</code>).</p>`,
    arquivos: main(py`
      numeros = [3, -1, 4, 0, 5]
      dobros = [n * 2 for n in numeros]
      positivos = [n for n in numeros if n > 0]
      print(dobros)
      print(positivos)

      precos = {"arroz": 24.9, "feijão": 8.5}
      com_frete = {produto: round(valor + 5, 2) for produto, valor in precos.items()}
      print(com_frete)

      letras = {letra for letra in "sertão"}
      print(sorted(letras))
    `),
  },
  tuplas: {
    id: 'licao-tuplas',
    tipo: 'licao',
    titulo: 'Tuplas e desempacotamento',
    resumo: `
      <p>Uma <b>tupla</b> é como uma lista que não muda: <code>ponto = (3, 4)</code>. Serve para agrupar coisas que andam juntas,
        como latitude e longitude.</p>
      <p><b>Desempacotar</b> é abrir o pacote em variáveis: <code>x, y = ponto</code>. Uma função pode devolver duas coisas
        assim: <code>return menor, maior</code>.</p>
      <p><code>zip</code> anda em duas listas lado a lado, e <code>enumerate</code> numera os itens.</p>`,
    arquivos: main(py`
      ponto = (3, 4)
      x, y = ponto
      print("x =", x, "e y =", y)

      def extremos(valores):
          return min(valores), max(valores)

      menor, maior = extremos([7, 2, 9])
      print(menor, maior)

      nomes = ["Ana", "Bia"]
      notas = [8, 9]
      for nome, nota in zip(nomes, notas):
          print(nome, nota)

      for i, fruta in enumerate(["umbu", "caju"], start=1):
          print(f"{i}. {fruta}")
    `),
  },
  conjuntos: {
    id: 'licao-conjuntos',
    tipo: 'licao',
    titulo: 'Conjuntos',
    resumo: `
      <p>Um <b>conjunto</b> (<code>set</code>) guarda cada valor uma vez só e responde rápido se algo está dentro (<code>in</code>).
        Pense na lista de convidados da portaria: cada nome entra uma vez.</p>
      <p>As operações vêm da matemática: <code>&amp;</code> (os dois têm), <code>|</code> (algum tem), <code>-</code> (só o primeiro tem)
        e <code>^</code> (só um dos dois tem). O conjunto não tem ordem: use <code>sorted</code> para mostrar.</p>`,
    arquivos: main(py`
      turma_a = {"Ana", "Bia", "Caio"}
      turma_b = {"Bia", "Davi"}
      print(sorted(turma_a & turma_b))
      print(sorted(turma_a | turma_b))
      print(sorted(turma_a - turma_b))
      print(sorted(turma_a ^ turma_b))
      print("Ana" in turma_a)

      repetidos = [1, 2, 2, 3, 3, 3]
      print(sorted(set(repetidos)))
    `),
  },
  ordenacao: {
    id: 'licao-ordenacao',
    tipo: 'licao',
    titulo: 'Ordenar com key',
    resumo: `
      <p><code>sorted(lista)</code> devolve uma lista nova em ordem. O parâmetro <code>key</code> diz <b>por qual valor</b> comparar:
        <code>sorted(palavras, key=len)</code> ordena pelo tamanho.</p>
      <p>Para ordenar por dois critérios, a chave devolve uma tupla: <code>key=lambda a: (-a[1], a[0])</code> põe a maior nota primeiro
        e, no empate, o nome em ordem alfabética. É como organizar a fila por idade e, entre gêmeos, pelo nome.</p>
      <p><code>max</code> e <code>min</code> também aceitam <code>key</code>.</p>`,
    arquivos: main(py`
      palavras = ["umbu", "ata", "pequi", "caju"]
      print(sorted(palavras))
      print(sorted(palavras, key=len))
      print(sorted(palavras, key=len, reverse=True))

      alunos = [("Caio", 8), ("Ana", 9), ("Bia", 8)]
      print(sorted(alunos, key=lambda a: (-a[1], a[0])))

      cidades = {"Petrolina": 386791, "Juazeiro": 237821}
      print(max(cidades, key=cidades.get))
    `),
  },
  collections: {
    id: 'licao-collections',
    tipo: 'licao',
    titulo: 'Counter e defaultdict',
    resumo: `
      <p><code>Counter</code> conta quantas vezes cada coisa aparece: <code>Counter(["a", "b", "a"])</code> dá
        <code>{"a": 2, "b": 1}</code>, e <code>most_common(2)</code> devolve os dois mais frequentes. É a urna da votação já apurada.</p>
      <p><code>defaultdict(list)</code> é um dicionário que cria uma lista vazia quando a chave ainda não existe,
        ótimo para <b>agrupar</b>: <code>grupos[uf].append(cidade)</code>.</p>
      <p>Os dois vêm de <code>from collections import Counter, defaultdict</code>.</p>`,
    arquivos: main(py`
      from collections import Counter, defaultdict

      votos = ["umbu", "caju", "umbu", "pequi", "umbu"]
      contagem = Counter(votos)
      print(contagem)
      print(contagem.most_common(2))

      cidades = [("Sobral", "CE"), ("Petrolina", "PE"), ("Crato", "CE")]
      por_uf = defaultdict(list)
      for cidade, uf in cidades:
          por_uf[uf].append(cidade)
      print(dict(por_uf))
    `),
  },
  csv: {
    id: 'licao-csv',
    tipo: 'licao',
    titulo: 'Ler e gravar CSV',
    resumo: `
      <p>CSV é uma tabela em texto: cada linha é um registro e as colunas são separadas por vírgula.
        A primeira linha costuma ser o <b>cabeçalho</b>, com o nome das colunas. Veja o <code>exemplo.csv</code> na aba <b>📦 Dados</b>.</p>
      <p><code>csv.DictReader</code> lê cada linha como um dicionário (<code>linha["cidade"]</code>). Tudo chega como <b>texto</b>:
        converta com <code>int()</code> ou <code>float()</code> antes de fazer conta.</p>
      <p><code>csv.writer</code> grava: <code>escritor.writerow(["nome", "nota"])</code>. Abra o arquivo com <code>newline=""</code>.</p>`,
    dados: { 'exemplo.csv': 'cidade,uf,habitantes\nPetrolina,PE,386791\nJuazeiro,BA,237821\nSobral,CE,212437\n' },
    arquivos: main(py`
      import csv

      with open("exemplo.csv") as arquivo:
          linhas = list(csv.DictReader(arquivo))

      total = 0
      for linha in linhas:
          print(linha["cidade"], "-", linha["uf"])
          total += int(linha["habitantes"])
      print("Total:", total)

      with open("grandes.csv", "w", newline="") as arquivo:
          escritor = csv.writer(arquivo)
          escritor.writerow(["cidade"])
          for linha in linhas:
              if int(linha["habitantes"]) > 230000:
                  escritor.writerow([linha["cidade"]])
      print(open("grandes.csv").read())
    `),
  },
  json: {
    id: 'licao-json',
    tipo: 'licao',
    titulo: 'JSON',
    resumo: `
      <p>JSON é o formato de dados mais usado na internet. Ele parece um dicionário do Python: chaves entre aspas, listas entre colchetes.</p>
      <p><code>json.load(arquivo)</code> lê o arquivo e devolve dicionários e listas; <code>json.dumps(dados, indent=2, ensure_ascii=False)</code>
        transforma de volta em texto, com acentos e recuo. É como traduzir uma carta para outra língua e voltar sem perder nada.</p>`,
    dados: { 'exemplo.json': '{"curso": "Python", "alunos": ["Ana", "Bia"], "carga": 20}' },
    arquivos: main(py`
      import json

      with open("exemplo.json") as arquivo:
          dados = json.load(arquivo)

      print(dados["curso"], "tem", len(dados["alunos"]), "alunos")
      dados["alunos"].append("Caio")
      print(json.dumps(dados, indent=2, ensure_ascii=False))

      with open("copia.json", "w") as arquivo:
          json.dump(dados, arquivo, ensure_ascii=False)
    `),
  },
  datas: {
    id: 'licao-datas',
    tipo: 'licao',
    titulo: 'Datas com datetime',
    resumo: `
      <p><code>date.fromisoformat("2026-10-13")</code> transforma o texto numa data. Subtrair duas datas dá um <code>timedelta</code>,
        que tem <code>.days</code>; somar <code>timedelta(days=7)</code> anda uma semana.</p>
      <p><code>weekday()</code> diz o dia da semana (0 é segunda, 6 é domingo). O <code>strftime("%d/%m/%Y")</code> formata.
        O nome do dia com <code>%A</code> sai em inglês, então use uma lista em português.</p>
      <p>Datas no formato <code>AAAA-MM-DD</code> já ficam em ordem quando comparadas como texto, como os volumes numerados de uma coleção.</p>`,
    arquivos: main(py`
      from datetime import date, timedelta

      DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]

      hoje = date.fromisoformat("2026-10-13")
      prova = date.fromisoformat("2026-12-01")
      print("Faltam", (prova - hoje).days, "dias")
      print("Daqui a uma semana:", hoje + timedelta(days=7))
      print(DIAS[hoje.weekday()], hoje.strftime("%d/%m/%Y"))
      print("2026-01-05" < "2026-10-13")
    `),
  },
  geradores: {
    id: 'licao-geradores',
    tipo: 'licao',
    titulo: 'Geradores',
    resumo: `
      <p>Um <b>gerador</b> é uma função com <code>yield</code>: em vez de montar a lista inteira, ele entrega um valor de cada vez,
        quando alguém pede. É a torneira aberta, e não o balde cheio: economiza memória com muitos dados.</p>
      <p><code>next(gerador)</code> pede o próximo; o <code>for</code> pede todos. Um gerador pode até ser infinito:
        <code>itertools.islice(gerador, 5)</code> pega só os 5 primeiros.</p>`,
    arquivos: main(py`
      from itertools import islice

      def contagem(ate):
          n = 1
          while n <= ate:
              yield n
              n += 1

      g = contagem(3)
      print(next(g))
      print(list(g))

      def naturais():
          n = 0
          while True:
              yield n
              n += 1

      print(list(islice(naturais(), 5)))
      print(sum(n * n for n in range(1, 4)))
    `),
  },
  funcional: {
    id: 'licao-funcional',
    tipo: 'licao',
    titulo: 'map, filter, reduce e itertools',
    resumo: `
      <p><code>map(funcao, lista)</code> aplica a função em cada item; <code>filter(funcao, lista)</code> fica com os itens em que ela dá
        verdadeiro. Uma <code>lambda</code> é uma função curta, sem nome: <code>lambda x: x * 2</code>.</p>
      <p><code>functools.reduce</code> junta tudo num valor só, passo a passo, como uma calculadora que vai somando a fita.</p>
      <p><code>itertools</code> tem ferramentas prontas: <code>combinations</code> (todas as duplas), <code>accumulate</code> (somas acumuladas)
        e <code>groupby</code> (agrupa itens seguidos iguais).</p>`,
    arquivos: main(py`
      from functools import reduce
      from itertools import accumulate, combinations, groupby

      numeros = [3, -1, 4, 0, 5]
      print(list(map(lambda x: x * 2, numeros)))
      print(list(filter(lambda x: x > 0, numeros)))
      print(reduce(lambda a, b: a + b, numeros, 0))

      print(list(combinations(["Ana", "Bia", "Caio"], 2)))
      print(list(accumulate([10, 20, 30])))
      for letra, grupo in groupby("aaabbc"):
          print(letra, len(list(grupo)))
    `),
  },
};

const exerciciosCompreensoes = [
  {
    id: 'dd-quadrados',
    tipo: 'problema',
    titulo: 'Quadrados',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>quadrados(n)</code>, que devolve <code>[1, 4, 9, …, n²]</code> usando uma <b>compreensão de lista</b>.</p><p><code>quadrados(4)</code> devolve <code>[1, 4, 9, 16]</code>.</p>',
    dica: '[i * i for i in range(1, n + 1)]',
    arquivos: assinatura('quadrados(n)'),
    solucao: main(py`
      def quadrados(n):
          return [i * i for i in range(1, n + 1)]
    `),
    testes: [
      { descricao: 'até 4', regras: [{ funcao: 'quadrados', args: [4], igual: [1, 4, 9, 16] }, { codigo: '\\[.+ for .+ in .+\\]', msg: 'O código usa uma compreensão de lista' }] },
      { descricao: 'zero e um', oculto: true, regras: [{ funcao: 'quadrados', args: [0], igual: [] }, { funcao: 'quadrados', args: [1], igual: [1] }] },
    ],
  },
  {
    id: 'dd-notas-aprovadas',
    tipo: 'problema',
    titulo: 'Notas aprovadas',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>notas_aprovadas(notas)</code>, que devolve só as notas maiores ou iguais a 7, na mesma ordem.</p>',
    dica: 'Filtre com if no fim da compreensão: [n for n in notas if n >= 7].',
    arquivos: assinatura('notas_aprovadas(notas)'),
    solucao: main(py`
      def notas_aprovadas(notas):
          return [n for n in notas if n >= 7]
    `),
    testes: [
      { descricao: 'quatro notas', regras: [{ funcao: 'notas_aprovadas', args: [[5, 7, 9.5, 6.9]], igual: [7, 9.5] }] },
      { descricao: 'vazia e uma nota', oculto: true, regras: [{ funcao: 'notas_aprovadas', args: [[]], igual: [] }, { funcao: 'notas_aprovadas', args: [[10]], igual: [10] }] },
    ],
  },
  {
    id: 'dd-desconto',
    tipo: 'problema',
    titulo: 'Preços com desconto',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>precos_com_desconto(precos, pct)</code>: recebe um dicionário produto → preço e devolve outro com o preço menos <code>pct</code>%, com 2 casas.</p><p><code>precos_com_desconto({"arroz": 10}, 10)</code> devolve <code>{"arroz": 9.0}</code>.</p>',
    dica: 'Compreensão de dicionário: {p: round(v * (100 - pct) / 100, 2) for p, v in precos.items()}.',
    arquivos: assinatura('precos_com_desconto(precos, pct)'),
    solucao: main(py`
      def precos_com_desconto(precos, pct):
          return {p: round(v * (100 - pct) / 100, 2) for p, v in precos.items()}
    `),
    testes: [
      { descricao: 'arroz e feijão', regras: [{ funcao: 'precos_com_desconto', args: [{ arroz: 10, feijão: 8 }, 10], igual: { arroz: 9, feijão: 7.2 } }] },
      { descricao: 'vazio e metade', oculto: true, regras: [{ funcao: 'precos_com_desconto', args: [{}, 5], igual: {} }, { funcao: 'precos_com_desconto', args: [{ café: 19.9 }, 50], igual: { café: 9.95 } }] },
    ],
  },
  {
    id: 'dd-transpor',
    tipo: 'problema',
    titulo: 'Transpor matriz',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>transpor(m)</code>: as linhas da matriz viram colunas.</p><p><code>transpor([[1, 2, 3], [4, 5, 6]])</code> devolve <code>[[1, 4], [2, 5], [3, 6]]</code>.</p>',
    dica: 'zip(*m) junta o primeiro de cada linha, depois o segundo... Transforme cada tupla em lista.',
    arquivos: assinatura('transpor(m)'),
    solucao: main(py`
      def transpor(m):
          return [list(coluna) for coluna in zip(*m)]
    `),
    testes: [
      { descricao: '2 × 3', regras: [{ funcao: 'transpor', args: [[[1, 2, 3], [4, 5, 6]]], igual: [[1, 4], [2, 5], [3, 6]] }] },
      { descricao: '1 × 1 e vazia', oculto: true, regras: [{ funcao: 'transpor', args: [[[1]]], igual: [[1]] }, { funcao: 'transpor', args: [[]], igual: [] }] },
    ],
  },
];

const exerciciosTuplas = [
  {
    id: 'dd-min-max',
    tipo: 'problema',
    titulo: 'Menor e maior',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>min_max(lista)</code>, que devolve a tupla <code>(menor, maior)</code>.</p>',
    dica: 'return min(lista), max(lista) devolve uma tupla.',
    arquivos: assinatura('min_max(lista)'),
    solucao: main(py`
      def min_max(lista):
          return min(lista), max(lista)
    `),
    testes: [
      { descricao: '3, 1 e 2', regras: [{ funcao: 'min_max', args: [[3, 1, 2]], igual: [1, 3] }] },
      { descricao: 'um item e negativos', oculto: true, regras: [{ funcao: 'min_max', args: [[5]], igual: [5, 5] }, { funcao: 'min_max', args: [[-2, 8, 0]], igual: [-2, 8] }] },
    ],
  },
  {
    id: 'dd-ponto-distante',
    tipo: 'problema',
    titulo: 'Ponto mais distante',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>mais_distante(pontos)</code>: recebe pontos <code>(x, y)</code> e devolve, como tupla, o mais longe da origem (o primeiro, se houver empate).</p>',
    dica: 'max(pontos, key=lambda p: p[0] ** 2 + p[1] ** 2) e depois tuple(...).',
    arquivos: assinatura('mais_distante(pontos)'),
    solucao: main(py`
      def mais_distante(pontos):
          return tuple(max(pontos, key=lambda p: p[0] ** 2 + p[1] ** 2))
    `),
    testes: [
      { descricao: 'três pontos', regras: [{ funcao: 'mais_distante', args: [[[1, 1], [3, 4], [0, 2]]], igual: [3, 4] }] },
      { descricao: 'origem e negativos', oculto: true, regras: [{ funcao: 'mais_distante', args: [[[0, 0]]], igual: [0, 0] }, { funcao: 'mais_distante', args: [[[-5, 0], [3, 3]]], igual: [-5, 0] }] },
    ],
  },
  {
    id: 'dd-boletim',
    tipo: 'problema',
    titulo: 'Boletim com zip',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>boletim(nomes, notas)</code>, que devolve um dicionário nome → nota, juntando as duas listas na mesma posição.</p>',
    dica: 'dict(zip(nomes, notas))',
    arquivos: assinatura('boletim(nomes, notas)'),
    solucao: main(py`
      def boletim(nomes, notas):
          return dict(zip(nomes, notas))
    `),
    testes: [
      { descricao: 'Ana e Bia', regras: [{ funcao: 'boletim', args: [['Ana', 'Bia'], [8, 9]], igual: { Ana: 8, Bia: 9 } }] },
      { descricao: 'vazias e uma', oculto: true, regras: [{ funcao: 'boletim', args: [[], []], igual: {} }, { funcao: 'boletim', args: [['Caio'], [5.5]], igual: { Caio: 5.5 } }] },
    ],
  },
  {
    id: 'dd-numerar',
    tipo: 'problema',
    titulo: 'Lista numerada',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>numerar(itens)</code>, que devolve <code>["1. arroz", "2. feijão"]</code>, usando <code>enumerate</code>.</p>',
    dica: 'enumerate(itens, start=1) começa a contar do 1.',
    arquivos: assinatura('numerar(itens)'),
    solucao: main(py`
      def numerar(itens):
          return [f"{i}. {item}" for i, item in enumerate(itens, start=1)]
    `),
    testes: [
      { descricao: 'arroz e feijão', regras: [{ funcao: 'numerar', args: [['arroz', 'feijão']], igual: ['1. arroz', '2. feijão'] }, { codigo: 'enumerate', msg: 'O código usa enumerate' }] },
      { descricao: 'vazia e um item', oculto: true, regras: [{ funcao: 'numerar', args: [[]], igual: [] }, { funcao: 'numerar', args: [['café']], igual: ['1. café'] }] },
    ],
  },
];

const exerciciosConjuntos = [
  {
    id: 'dd-em-comum',
    tipo: 'problema',
    titulo: 'Em comum',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>em_comum(a, b)</code>, que devolve os itens que estão nas duas listas, sem repetir e em ordem crescente.</p>',
    dica: 'sorted(set(a) & set(b))',
    arquivos: assinatura('em_comum(a, b)'),
    solucao: main(py`
      def em_comum(a, b):
          return sorted(set(a) & set(b))
    `),
    testes: [
      { descricao: 'números', regras: [{ funcao: 'em_comum', args: [[1, 2, 3], [2, 3, 4]], igual: [2, 3] }] },
      { descricao: 'nada em comum e textos', oculto: true, regras: [{ funcao: 'em_comum', args: [[1], [2]], igual: [] }, { funcao: 'em_comum', args: [['pe', 'ba', 'sp'], ['ba', 'pe']], igual: ['ba', 'pe'] }] },
    ],
  },
  {
    id: 'dd-so-em-um',
    tipo: 'problema',
    titulo: 'Só em um dos dois',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>so_em_um(a, b)</code>, que devolve os itens que estão em <b>só uma</b> das listas, em ordem crescente.</p>',
    dica: 'A diferença simétrica de conjuntos é o operador ^.',
    arquivos: assinatura('so_em_um(a, b)'),
    solucao: main(py`
      def so_em_um(a, b):
          return sorted(set(a) ^ set(b))
    `),
    testes: [
      { descricao: 'números', regras: [{ funcao: 'so_em_um', args: [[1, 2, 3], [3, 4]], igual: [1, 2, 4] }] },
      { descricao: 'vazias e iguais', oculto: true, regras: [{ funcao: 'so_em_um', args: [[], []], igual: [] }, { funcao: 'so_em_um', args: [['a'], ['a']], igual: [] }] },
    ],
  },
  {
    id: 'dd-letra-repetida',
    tipo: 'problema',
    titulo: 'Letra repetida',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>tem_repetida(palavra)</code>, que devolve <code>True</code> se alguma letra aparece mais de uma vez (maiúscula e minúscula contam como letras diferentes).</p>',
    dica: 'Se o conjunto das letras é menor que a palavra, alguma se repetiu: len(set(palavra)) != len(palavra).',
    arquivos: assinatura('tem_repetida(palavra)'),
    solucao: main(py`
      def tem_repetida(palavra):
          return len(set(palavra)) != len(palavra)
    `),
    testes: [
      { descricao: 'sertão e arara', regras: [{ funcao: 'tem_repetida', args: ['sertão'], igual: false }, { funcao: 'tem_repetida', args: ['arara'], igual: true }] },
      { descricao: 'vazia e maiúscula', oculto: true, regras: [{ funcao: 'tem_repetida', args: [''], igual: false }, { funcao: 'tem_repetida', args: ['Aa'], igual: false }] },
    ],
  },
  {
    id: 'dd-cidades-novas',
    tipo: 'problema',
    titulo: 'Cidades novas',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>cidades_novas(visitadas, roteiro)</code>, que devolve as cidades do roteiro que ainda não foram visitadas, na ordem do roteiro e sem repetir.</p>',
    dica: 'Comece com vistas = set(visitadas); para cada cidade do roteiro que não está em vistas, guarde e adicione em vistas.',
    arquivos: assinatura('cidades_novas(visitadas, roteiro)'),
    solucao: main(py`
      def cidades_novas(visitadas, roteiro):
          vistas = set(visitadas)
          novas = []
          for cidade in roteiro:
              if cidade not in vistas:
                  novas.append(cidade)
                  vistas.add(cidade)
          return novas
    `),
    testes: [
      { descricao: 'roteiro com repetição', regras: [{ funcao: 'cidades_novas', args: [['Recife'], ['Recife', 'Natal', 'Natal', 'Caruaru']], igual: ['Natal', 'Caruaru'] }] },
      { descricao: 'vazio e repetida', oculto: true, regras: [{ funcao: 'cidades_novas', args: [[], []], igual: [] }, { funcao: 'cidades_novas', args: [['Sobral'], ['Crato', 'Sobral', 'Crato']], igual: ['Crato'] }] },
    ],
  },
];

const exerciciosOrdenacao = [
  {
    id: 'dd-ranking',
    tipo: 'problema',
    titulo: 'Ranking',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>ranking(alunos)</code>: recebe uma lista de <code>[nome, nota]</code> e devolve os nomes da maior para a menor nota. Em empate, em ordem alfabética.</p>',
    dica: 'sorted(alunos, key=lambda a: (-a[1], a[0])) e depois só os nomes.',
    arquivos: assinatura('ranking(alunos)'),
    solucao: main(py`
      def ranking(alunos):
          return [nome for nome, _ in sorted(alunos, key=lambda a: (-a[1], a[0]))]
    `),
    testes: [
      { descricao: 'três alunos', regras: [{ funcao: 'ranking', args: [[['Ana', 8], ['Bia', 9], ['Caio', 8]]], igual: ['Bia', 'Ana', 'Caio'] }] },
      { descricao: 'vazio e empate', oculto: true, regras: [{ funcao: 'ranking', args: [[]], igual: [] }, { funcao: 'ranking', args: [[['Zé', 7], ['Al', 7]]], igual: ['Al', 'Zé'] }] },
    ],
  },
  {
    id: 'dd-por-tamanho',
    tipo: 'problema',
    titulo: 'Por tamanho',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>por_tamanho(palavras)</code>, que ordena da palavra menor para a maior; com o mesmo tamanho, em ordem alfabética.</p>',
    dica: 'key=lambda p: (len(p), p)',
    arquivos: assinatura('por_tamanho(palavras)'),
    solucao: main(py`
      def por_tamanho(palavras):
          return sorted(palavras, key=lambda p: (len(p), p))
    `),
    testes: [
      { descricao: 'frutas', regras: [{ funcao: 'por_tamanho', args: [['umbu', 'caju', 'pequi', 'ata']], igual: ['ata', 'caju', 'umbu', 'pequi'] }] },
      { descricao: 'vazia e empate', oculto: true, regras: [{ funcao: 'por_tamanho', args: [[]], igual: [] }, { funcao: 'por_tamanho', args: [['bb', 'a', 'aa']], igual: ['a', 'aa', 'bb'] }] },
    ],
  },
  {
    id: 'dd-mais-populosa',
    tipo: 'problema',
    titulo: 'Mais populosa',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>mais_populosa(cidades)</code>: recebe um dicionário cidade → habitantes e devolve o nome da mais populosa. Sem cidades, devolva <code>None</code>.</p>',
    dica: 'max(cidades, key=cidades.get), mas só se o dicionário não estiver vazio.',
    arquivos: assinatura('mais_populosa(cidades)'),
    solucao: main(py`
      def mais_populosa(cidades):
          return max(cidades, key=cidades.get) if cidades else None
    `),
    testes: [
      { descricao: 'duas cidades', regras: [{ funcao: 'mais_populosa', args: [{ Petrolina: 386791, Juazeiro: 237821 }], igual: 'Petrolina' }] },
      { descricao: 'vazio e uma', oculto: true, regras: [{ funcao: 'mais_populosa', args: [{}], igual: null }, { funcao: 'mais_populosa', args: [{ Sobral: 212437 }], igual: 'Sobral' }] },
    ],
  },
  {
    id: 'dd-ordenar-datas',
    tipo: 'problema',
    titulo: 'Datas em ordem',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>ordenar_datas(datas)</code>: recebe datas no formato <code>dd/mm/aaaa</code> e devolve da mais antiga para a mais nova.</p>',
    dica: 'Ordene pela chave (ano, mês, dia): key=lambda d: (d[6:], d[3:5], d[:2]).',
    arquivos: assinatura('ordenar_datas(datas)'),
    solucao: main(py`
      def ordenar_datas(datas):
          return sorted(datas, key=lambda d: (d[6:], d[3:5], d[:2]))
    `),
    testes: [
      { descricao: 'três datas', regras: [{ funcao: 'ordenar_datas', args: [['10/02/2024', '01/12/2023', '05/02/2024']], igual: ['01/12/2023', '05/02/2024', '10/02/2024'] }] },
      { descricao: 'vazia e virada do ano', oculto: true, regras: [{ funcao: 'ordenar_datas', args: [[]], igual: [] }, { funcao: 'ordenar_datas', args: [['01/01/2000', '31/12/1999']], igual: ['31/12/1999', '01/01/2000'] }] },
    ],
  },
];

const exerciciosCollections = [
  {
    id: 'dd-vencedor',
    tipo: 'problema',
    titulo: 'Votação',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>vencedor(votos)</code>, que devolve a opção mais votada. Em empate, a primeira em ordem alfabética. Sem votos, <code>None</code>.</p>',
    dica: 'c = Counter(votos); min(c, key=lambda v: (-c[v], v)) escolhe o mais votado e desempata pelo nome.',
    arquivos: comCollections('vencedor(votos)'),
    solucao: main(py`
      from collections import Counter


      def vencedor(votos):
          c = Counter(votos)
          return min(c, key=lambda v: (-c[v], v)) if c else None
    `),
    testes: [
      { descricao: 'umbu ganha', regras: [{ funcao: 'vencedor', args: [['umbu', 'caju', 'umbu']], igual: 'umbu' }, { codigo: 'Counter', msg: 'O código usa Counter' }] },
      { descricao: 'empate e sem votos', oculto: true, regras: [{ funcao: 'vencedor', args: [['b', 'a']], igual: 'a' }, { funcao: 'vencedor', args: [[]], igual: null }] },
    ],
  },
  {
    id: 'dd-top3-produtos',
    tipo: 'problema',
    titulo: 'Três mais vendidos',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>top3(pedidos)</code>: recebe uma lista de <code>[produto, quantidade]</code> e devolve <code>[[produto, total]]</code> dos 3 maiores totais. Em empate, ordem alfabética.</p>',
    dica: 'Some num Counter (c[produto] += qtd) e ordene os pares com key=lambda p: (-p[1], p[0]).',
    arquivos: comCollections('top3(pedidos)'),
    solucao: main(py`
      from collections import Counter


      def top3(pedidos):
          c = Counter()
          for produto, qtd in pedidos:
              c[produto] += qtd
          return [[p, t] for p, t in sorted(c.items(), key=lambda p: (-p[1], p[0]))[:3]]
    `),
    testes: [
      {
        descricao: 'cinco pedidos',
        regras: [{ funcao: 'top3', args: [[['arroz', 2], ['feijão', 1], ['arroz', 1], ['café', 5], ['milho', 1]]], igual: [['café', 5], ['arroz', 3], ['feijão', 1]] }],
      },
      { descricao: 'vazio e um', oculto: true, regras: [{ funcao: 'top3', args: [[]], igual: [] }, { funcao: 'top3', args: [[['x', 1]]], igual: [['x', 1]] }] },
    ],
  },
  {
    id: 'dd-agrupar-uf',
    tipo: 'problema',
    titulo: 'Cidades por estado',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>agrupar(cidades)</code>: recebe uma lista de <code>[cidade, uf]</code> e devolve <code>{uf: [cidades em ordem alfabética]}</code>, com as UFs também em ordem alfabética.</p>',
    dica: 'Agrupe com defaultdict(list) e monte o resultado com {uf: sorted(v) for uf, v in sorted(grupos.items())}.',
    arquivos: comCollections('agrupar(cidades)'),
    solucao: main(py`
      from collections import defaultdict


      def agrupar(cidades):
          grupos = defaultdict(list)
          for cidade, uf in cidades:
              grupos[uf].append(cidade)
          return {uf: sorted(lista) for uf, lista in sorted(grupos.items())}
    `),
    testes: [
      {
        descricao: 'Ceará e Pernambuco',
        regras: [
          { funcao: 'agrupar', args: [[['Sobral', 'CE'], ['Petrolina', 'PE'], ['Crato', 'CE']]], igual: { CE: ['Crato', 'Sobral'], PE: ['Petrolina'] } },
          { codigo: 'defaultdict', msg: 'O código usa defaultdict' },
        ],
      },
      { descricao: 'vazio e uma cidade', oculto: true, regras: [{ funcao: 'agrupar', args: [[]], igual: {} }, { funcao: 'agrupar', args: [[['Natal', 'RN']]], igual: { RN: ['Natal'] } }] },
    ],
  },
  {
    id: 'dd-indice-invertido',
    tipo: 'problema',
    titulo: 'Índice invertido',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>indice(frases)</code>, que devolve <code>{palavra: [posições das frases em que ela aparece]}</code>. Palavras em minúsculas, sem repetir posição, e as chaves em ordem alfabética.</p><p><code>indice(["Sol e mar", "mar azul"])</code> devolve <code>{"azul": [1], "e": [0], "mar": [0, 1], "sol": [0]}</code>.</p>',
    dica: 'Para cada i, frase em enumerate(frases), percorra set(frase.lower().split()) e faça grupos[palavra].append(i).',
    arquivos: comCollections('indice(frases)'),
    solucao: main(py`
      from collections import defaultdict


      def indice(frases):
          grupos = defaultdict(list)
          for i, frase in enumerate(frases):
              for palavra in set(frase.lower().split()):
                  grupos[palavra].append(i)
          return {palavra: grupos[palavra] for palavra in sorted(grupos)}
    `),
    testes: [
      { descricao: 'duas frases', regras: [{ funcao: 'indice', args: [['Sol e mar', 'mar azul']], igual: { azul: [1], e: [0], mar: [0, 1], sol: [0] } }] },
      { descricao: 'vazia e palavra repetida', oculto: true, regras: [{ funcao: 'indice', args: [[]], igual: {} }, { funcao: 'indice', args: [['a a']], igual: { a: [0] } }] },
    ],
  },
];

export const moduloDados = {
  id: 'dados',
  titulo: 'Python para dados',
  icone: '📊',
  descricao: 'Comprehensions, tuplas, conjuntos, ordenação, Counter, CSV, JSON, datas, geradores e itertools.',
  itens: [
    licoes.comprehensions,
    ...exerciciosCompreensoes,
    licoes.tuplas,
    ...exerciciosTuplas,
    licoes.conjuntos,
    ...exerciciosConjuntos,
    licoes.ordenacao,
    ...exerciciosOrdenacao,
    licoes.collections,
    ...exerciciosCollections,
    licoes.csv,
    licoes.json,
    licoes.datas,
    licoes.geradores,
    licoes.funcional,
  ],
};
