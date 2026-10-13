// 🐍 Python básico, segunda metade: listas, dicionários e exceções (exercícios 21 a 40).
// Ficam aqui para o basico.js não virar um arquivo de mil linhas; a ordem na trilha
// é montada lá (cada bloco entra depois da lição do assunto).
import { py, main, assinatura } from './util.js';

export const exerciciosListas = [
  {
    id: 'py-soma-lista',
    tipo: 'problema',
    titulo: 'Soma da lista',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>soma(lista)</code>, que devolve a soma dos números da lista, <b>sem usar a função pronta</b> de somar.</p>',
    dica: 'Comece com total = 0 e some cada número num for.',
    arquivos: assinatura('soma(lista)'),
    solucao: main(py`
      def soma(lista):
          total = 0
          for n in lista:
              total += n
          return total
    `),
    testes: [
      {
        descricao: '1, 2 e 3',
        regras: [
          { funcao: 'soma', args: [[1, 2, 3]], igual: 6 },
          { semCodigo: 'sum\\(', msg: 'O código não usa sum()', dica: 'Some com um laço for.' },
        ],
      },
      { descricao: 'vazia e negativos', oculto: true, regras: [{ funcao: 'soma', args: [[]], igual: 0 }, { funcao: 'soma', args: [[-1, 1, 5]], igual: 5 }] },
    ],
  },
  {
    id: 'py-maior-lista',
    tipo: 'problema',
    titulo: 'Maior da lista',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>maior_da_lista(lista)</code>, que devolve o maior número. Se a lista estiver vazia, devolva <code>None</code>.</p>',
    dica: 'max(lista) acha o maior, mas dá erro com lista vazia: teste "if lista" antes.',
    arquivos: assinatura('maior_da_lista(lista)'),
    solucao: main(py`
      def maior_da_lista(lista):
          return max(lista) if lista else None
    `),
    testes: [
      { descricao: '3, 9 e 2', regras: [{ funcao: 'maior_da_lista', args: [[3, 9, 2]], igual: 9 }] },
      { descricao: 'vazia e negativos', oculto: true, regras: [{ funcao: 'maior_da_lista', args: [[]], igual: null }, { funcao: 'maior_da_lista', args: [[-5, -2]], igual: -2 }] },
    ],
  },
  {
    id: 'py-pares',
    tipo: 'problema',
    titulo: 'Só os pares',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>somente_pares(lista)</code>, que devolve uma lista nova só com os números pares, <b>na mesma ordem</b>.</p>',
    dica: 'Uma compreensão de lista filtra numa linha: [n for n in lista if n % 2 == 0].',
    arquivos: assinatura('somente_pares(lista)'),
    solucao: main(py`
      def somente_pares(lista):
          return [n for n in lista if n % 2 == 0]
    `),
    testes: [
      { descricao: '1 a 4', regras: [{ funcao: 'somente_pares', args: [[1, 2, 3, 4]], igual: [2, 4] }] },
      { descricao: 'vazia, zero e negativo', oculto: true, regras: [{ funcao: 'somente_pares', args: [[]], igual: [] }, { funcao: 'somente_pares', args: [[7, 0, -2]], igual: [0, -2] }] },
    ],
  },
  {
    id: 'py-media-lista',
    tipo: 'problema',
    titulo: 'Média da lista',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>media(lista)</code>, que devolve a média com <b>duas casas decimais</b>. Para a lista vazia, devolva <code>0</code>.</p>',
    dica: 'sum(lista) / len(lista) é a média; round(valor, 2) arredonda. Dividir por zero dá erro: trate a lista vazia antes.',
    arquivos: assinatura('media(lista)'),
    solucao: main(py`
      def media(lista):
          if not lista:
              return 0
          return round(sum(lista) / len(lista), 2)
    `),
    testes: [
      { descricao: '7, 8 e 9', regras: [{ funcao: 'media', args: [[7, 8, 9]], igual: 8 }] },
      {
        descricao: 'vazia e arredondamento',
        oculto: true,
        regras: [
          { funcao: 'media', args: [[]], igual: 0 },
          { funcao: 'media', args: [[1, 2]], igual: 1.5 },
          { funcao: 'media', args: [[1, 1, 2]], igual: 1.33 },
        ],
      },
    ],
  },
  {
    id: 'py-sem-duplicados',
    tipo: 'problema',
    titulo: 'Sem duplicados',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>sem_duplicados(lista)</code>, que tira os valores repetidos e mantém a <b>ordem da primeira aparição</b>.</p>',
    dica: 'Guarde o que já viu num conjunto (set) e só adicione ao resultado o que ainda não estava lá.',
    arquivos: assinatura('sem_duplicados(lista)'),
    solucao: main(py`
      def sem_duplicados(lista):
          vistos = set()
          resultado = []
          for valor in lista:
              if valor not in vistos:
                  vistos.add(valor)
                  resultado.append(valor)
          return resultado
    `),
    testes: [
      { descricao: 'números', regras: [{ funcao: 'sem_duplicados', args: [[1, 2, 1, 3, 2]], igual: [1, 2, 3] }] },
      { descricao: 'vazia e textos', oculto: true, regras: [{ funcao: 'sem_duplicados', args: [[]], igual: [] }, { funcao: 'sem_duplicados', args: [['b', 'a', 'b']], igual: ['b', 'a'] }] },
    ],
  },
  {
    id: 'py-segundo-maior',
    tipo: 'problema',
    titulo: 'Segundo maior',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>segundo_maior(lista)</code>, que devolve o segundo maior valor <b>diferente</b> do maior.
        Se não houver dois valores diferentes, devolva <code>None</code>.</p>
      <p><code>segundo_maior([4, 9, 9, 7])</code> devolve <code>7</code>.</p>`,
    dica: 'sorted(set(lista)) tira os repetidos e ordena; o segundo maior é o penúltimo.',
    arquivos: assinatura('segundo_maior(lista)'),
    solucao: main(py`
      def segundo_maior(lista):
          distintos = sorted(set(lista))
          return distintos[-2] if len(distintos) >= 2 else None
    `),
    testes: [
      { descricao: '4, 9, 9 e 7', regras: [{ funcao: 'segundo_maior', args: [[4, 9, 9, 7]], igual: 7 }] },
      {
        descricao: 'sem segundo e negativos',
        oculto: true,
        regras: [
          { funcao: 'segundo_maior', args: [[5, 5]], igual: null },
          { funcao: 'segundo_maior', args: [[1]], igual: null },
          { funcao: 'segundo_maior', args: [[-1, -3]], igual: -3 },
        ],
      },
    ],
  },
  {
    id: 'py-rotacionar',
    tipo: 'problema',
    titulo: 'Rotacionar lista',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>rotacionar(lista, k)</code>: os últimos <code>k</code> itens vão para o começo.
        <code>k</code> pode ser maior que o tamanho da lista.</p>
      <p><code>rotacionar([1, 2, 3, 4], 1)</code> devolve <code>[4, 1, 2, 3]</code>.</p>`,
    dica: 'k % len(lista) dá a rotação real. Junte as fatias lista[-k:] + lista[:-k]. Cuidado com a lista vazia e com k = 0.',
    arquivos: assinatura('rotacionar(lista, k)'),
    solucao: main(py`
      def rotacionar(lista, k):
          if not lista:
              return []
          k %= len(lista)
          return lista[-k:] + lista[:-k] if k else lista[:]
    `),
    testes: [
      { descricao: 'uma posição', regras: [{ funcao: 'rotacionar', args: [[1, 2, 3, 4], 1], igual: [4, 1, 2, 3] }] },
      {
        descricao: 'k grande, vazia e zero',
        oculto: true,
        regras: [
          { funcao: 'rotacionar', args: [[1, 2, 3], 4], igual: [3, 1, 2] },
          { funcao: 'rotacionar', args: [[], 3], igual: [] },
          { funcao: 'rotacionar', args: [[1, 2], 0], igual: [1, 2] },
        ],
      },
    ],
  },
  {
    id: 'py-achatar',
    tipo: 'problema',
    titulo: 'Achatar lista',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>achatar(listas)</code>, que junta as sublistas numa lista só (um nível): <code>[[1, 2], [3]]</code> vira <code>[1, 2, 3]</code>.</p>',
    dica: 'Dois for na mesma compreensão: [x for sub in listas for x in sub].',
    arquivos: assinatura('achatar(listas)'),
    solucao: main(py`
      def achatar(listas):
          return [x for sub in listas for x in sub]
    `),
    testes: [
      { descricao: '[[1, 2], [3]]', regras: [{ funcao: 'achatar', args: [[[1, 2], [3]]], igual: [1, 2, 3] }] },
      { descricao: 'sublistas vazias', oculto: true, regras: [{ funcao: 'achatar', args: [[[], [1], []]], igual: [1] }, { funcao: 'achatar', args: [[]], igual: [] }] },
    ],
  },
  {
    id: 'py-argumento-padrao',
    tipo: 'problema',
    titulo: 'Argumento padrão',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>saudacao(nome, cumprimento)</code>, que devolve <code>"&lt;cumprimento&gt;, &lt;nome&gt;!"</code>.
        O <code>cumprimento</code> é opcional: quando não for passado, vale <code>"Olá"</code> (um argumento padrão).</p>
      <p><code>saudacao("Ana")</code> devolve <code>"Olá, Ana!"</code>.</p>`,
    dica: 'Na assinatura: def saudacao(nome, cumprimento="Olá"):',
    arquivos: assinatura('saudacao(nome)', 'O cumprimento é opcional e vale "Olá"'),
    solucao: main(py`
      def saudacao(nome, cumprimento="Olá"):
          return f"{cumprimento}, {nome}!"
    `),
    testes: [
      { descricao: 'só o nome', regras: [{ funcao: 'saudacao', args: ['Ana'], igual: 'Olá, Ana!' }] },
      { descricao: 'com cumprimento', oculto: true, regras: [{ funcao: 'saudacao', args: ['Bia', 'Bom dia'], igual: 'Bom dia, Bia!' }] },
    ],
  },
  {
    id: 'py-busca-binaria',
    tipo: 'problema',
    titulo: 'Busca binária',
    dificuldade: 'dificil',
    enunciado: `
      <p>Escreva <code>busca_binaria(lista, alvo)</code>, que procura <code>alvo</code> numa lista <b>ordenada</b> e devolve o índice dele,
        ou <code>-1</code> se não estiver lá. Não use <code>.index()</code>: olhe o meio e descarte metade a cada passo.</p>`,
    dica: 'inicio = 0, fim = len(lista) - 1; enquanto inicio <= fim, meio = (inicio + fim) // 2 e ajuste inicio ou fim.',
    arquivos: assinatura('busca_binaria(lista, alvo)'),
    solucao: main(py`
      def busca_binaria(lista, alvo):
          inicio, fim = 0, len(lista) - 1
          while inicio <= fim:
              meio = (inicio + fim) // 2
              if lista[meio] == alvo:
                  return meio
              if lista[meio] < alvo:
                  inicio = meio + 1
              else:
                  fim = meio - 1
          return -1
    `),
    testes: [
      {
        descricao: 'acha o 7',
        regras: [
          { funcao: 'busca_binaria', args: [[1, 3, 5, 7, 9], 7], igual: 3 },
          { semCodigo: '\\.index\\(', msg: 'O código não usa .index()', dica: 'Faça a busca com o laço e o meio.' },
        ],
      },
      {
        descricao: 'não acha, vazia e um item',
        oculto: true,
        regras: [
          { funcao: 'busca_binaria', args: [[1, 3, 5], 4], igual: -1 },
          { funcao: 'busca_binaria', args: [[], 1], igual: -1 },
          { funcao: 'busca_binaria', args: [[2], 2], igual: 0 },
        ],
      },
    ],
  },
];

export const exerciciosDicionarios = [
  {
    id: 'py-contar-letras',
    tipo: 'problema',
    titulo: 'Contar letras',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>contar_letras(texto)</code>, que devolve um dicionário com quantas vezes cada <b>letra</b> aparece,
        em minúsculas e na ordem em que aparecem. Espaços, números e pontuação não contam.</p>
      <p><code>contar_letras("Aba!")</code> devolve <code>{"a": 2, "b": 1}</code>.</p>`,
    dica: 'Percorra texto.lower(); c.isalpha() diz se é letra; d[c] = d.get(c, 0) + 1 conta.',
    arquivos: assinatura('contar_letras(texto)'),
    solucao: main(py`
      def contar_letras(texto):
          contagem = {}
          for c in texto.lower():
              if c.isalpha():
                  contagem[c] = contagem.get(c, 0) + 1
          return contagem
    `),
    testes: [
      { descricao: 'Aba!', regras: [{ funcao: 'contar_letras', args: ['Aba!'], igual: { a: 2, b: 1 } }] },
      { descricao: 'vazio e acentos', oculto: true, regras: [{ funcao: 'contar_letras', args: [''], igual: {} }, { funcao: 'contar_letras', args: ['Ção ç'], igual: { ç: 2, ã: 1, o: 1 } }] },
    ],
  },
  {
    id: 'py-estoque',
    tipo: 'problema',
    titulo: 'Estoque',
    dificuldade: 'facil',
    enunciado: `
      <p>Escreva <code>adicionar(estoque, item, quantidade)</code>, que soma a quantidade ao que já existe do item
        (ou cria o item) e devolve o dicionário.</p>`,
    dica: 'estoque.get(item, 0) devolve 0 quando o item ainda não existe.',
    arquivos: assinatura('adicionar(estoque, item, quantidade)'),
    solucao: main(py`
      def adicionar(estoque, item, quantidade):
          estoque[item] = estoque.get(item, 0) + quantidade
          return estoque
    `),
    testes: [
      { descricao: 'item que já existe', regras: [{ funcao: 'adicionar', args: [{ milho: 2 }, 'milho', 3], igual: { milho: 5 } }] },
      { descricao: 'item novo', oculto: true, regras: [{ funcao: 'adicionar', args: [{}, 'feijão', 1], igual: { feijão: 1 } }] },
    ],
  },
  {
    id: 'py-aprovados',
    tipo: 'problema',
    titulo: 'Alunos aprovados',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>aprovados(notas)</code>. <code>notas</code> é um dicionário de nome para nota.
        Devolva a lista dos nomes com nota 7 ou mais, em ordem alfabética.</p>`,
    dica: 'Percorra notas.items() e use sorted() no fim.',
    arquivos: assinatura('aprovados(notas)'),
    solucao: main(py`
      def aprovados(notas):
          return sorted(nome for nome, nota in notas.items() if nota >= 7)
    `),
    testes: [
      { descricao: 'três alunos', regras: [{ funcao: 'aprovados', args: [{ Ana: 8, Bia: 6, Caio: 7 }], igual: ['Ana', 'Caio'] }] },
      { descricao: 'vazio e ordem', oculto: true, regras: [{ funcao: 'aprovados', args: [{}], igual: [] }, { funcao: 'aprovados', args: [{ Zé: 10, Al: 7 }], igual: ['Al', 'Zé'] }] },
    ],
  },
  {
    id: 'py-inverter-dicionario',
    tipo: 'problema',
    titulo: 'Inverter dicionário',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>inverter_dict(d)</code>, que devolve um dicionário novo em que os valores viram chaves e as chaves viram valores.</p>',
    dica: 'Uma compreensão de dicionário: {v: k for k, v in d.items()}.',
    arquivos: assinatura('inverter_dict(d)'),
    solucao: main(py`
      def inverter_dict(d):
          return {v: k for k, v in d.items()}
    `),
    testes: [
      { descricao: 'duas chaves', regras: [{ funcao: 'inverter_dict', args: [{ a: '1', b: '2' }], igual: { 1: 'a', 2: 'b' } }] },
      { descricao: 'vazio', oculto: true, regras: [{ funcao: 'inverter_dict', args: [{}], igual: {} }] },
    ],
  },
  {
    id: 'py-agenda',
    tipo: 'problema',
    titulo: 'Agenda',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>buscar_telefone(agenda, nome)</code>, que procura o nome <b>sem diferenciar maiúsculas</b> e devolve o telefone,
        ou <code>"não encontrado"</code>.</p>`,
    dica: 'Percorra agenda.items() comparando chave.lower() com nome.lower().',
    arquivos: assinatura('buscar_telefone(agenda, nome)'),
    solucao: main(py`
      def buscar_telefone(agenda, nome):
          for contato, telefone in agenda.items():
              if contato.lower() == nome.lower():
                  return telefone
          return "não encontrado"
    `),
    testes: [
      { descricao: 'ana em minúsculas', regras: [{ funcao: 'buscar_telefone', args: [{ Ana: '9999' }, 'ana'], igual: '9999' }] },
      {
        descricao: 'agenda vazia e maiúsculas',
        oculto: true,
        regras: [
          { funcao: 'buscar_telefone', args: [{}, 'Ana'], igual: 'não encontrado' },
          { funcao: 'buscar_telefone', args: [{ BIA: '1' }, 'bia'], igual: '1' },
        ],
      },
    ],
  },
  {
    id: 'py-top-palavras',
    tipo: 'problema',
    titulo: 'Palavras mais frequentes',
    dificuldade: 'dificil',
    enunciado: `
      <p>Escreva <code>top_palavras(texto, n)</code>, que devolve as <code>n</code> palavras mais frequentes como lista de
        <code>[palavra, contagem]</code>, da mais frequente para a menos. Em empate, a ordem é alfabética.
        As palavras são separadas por espaço e contam em minúsculas.</p>
      <p><code>top_palavras("a b a c b a", 2)</code> devolve <code>[["a", 3], ["b", 2]]</code>.</p>`,
    dica: 'Conte num dicionário e ordene os pares com key=lambda p: (-p[1], p[0]); depois fatie [:n].',
    arquivos: assinatura('top_palavras(texto, n)'),
    solucao: main(py`
      def top_palavras(texto, n):
          contagem = {}
          for palavra in texto.lower().split():
              contagem[palavra] = contagem.get(palavra, 0) + 1
          pares = sorted(contagem.items(), key=lambda p: (-p[1], p[0]))
          return [[palavra, total] for palavra, total in pares[:n]]
    `),
    testes: [
      { descricao: 'duas mais frequentes', regras: [{ funcao: 'top_palavras', args: ['a b a c b a', 2], igual: [['a', 3], ['b', 2]] }] },
      {
        descricao: 'vazio e maiúsculas',
        oculto: true,
        regras: [
          { funcao: 'top_palavras', args: ['', 3], igual: [] },
          { funcao: 'top_palavras', args: ['Sol sol LUA', 5], igual: [['sol', 2], ['lua', 1]] },
        ],
      },
    ],
  },
];

export const exerciciosExcecoes = [
  {
    id: 'py-para-inteiro',
    tipo: 'problema',
    titulo: 'Converter com segurança',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>para_inteiro(texto)</code>, que devolve o número inteiro, ou <code>None</code> quando o texto não for um número. Use <code>try/except</code>.</p>',
    dica: 'int("abc") levanta ValueError: pegue com except ValueError e devolva None.',
    arquivos: assinatura('para_inteiro(texto)'),
    solucao: main(py`
      def para_inteiro(texto):
          try:
              return int(texto)
          except ValueError:
              return None
    `),
    testes: [
      {
        descricao: 'número e texto',
        regras: [
          { funcao: 'para_inteiro', args: ['42'], igual: 42 },
          { funcao: 'para_inteiro', args: ['abc'], igual: null },
          { codigo: 'try:', msg: 'O código usa try/except' },
        ],
      },
      { descricao: 'espaços e decimal', oculto: true, regras: [{ funcao: 'para_inteiro', args: [' 7 '], igual: 7 }, { funcao: 'para_inteiro', args: ['4.5'], igual: null }] },
    ],
  },
  {
    id: 'py-divisao-segura',
    tipo: 'problema',
    titulo: 'Divisão segura',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>dividir(a, b)</code>, que devolve <code>a / b</code>. Quando <code>b</code> for zero, levante <code>ValueError("divisão por zero")</code>.</p>',
    dica: 'if b == 0: raise ValueError("divisão por zero")',
    arquivos: assinatura('dividir(a, b)'),
    solucao: main(py`
      def dividir(a, b):
          if b == 0:
              raise ValueError("divisão por zero")
          return a / b
    `),
    testes: [
      {
        descricao: '10 / 4 e divisão por zero',
        regras: [
          { funcao: 'dividir', args: [10, 4], igual: 2.5 },
          { funcao: 'dividir', args: [1, 0], erro: 'ValueError' },
        ],
      },
      { descricao: 'zero e negativo', oculto: true, regras: [{ funcao: 'dividir', args: [0, 5], igual: 0 }, { funcao: 'dividir', args: [-9, 3], igual: -3 }] },
    ],
  },
  {
    id: 'py-validar-idade',
    tipo: 'problema',
    titulo: 'Validar idade',
    dificuldade: 'medio',
    enunciado: `
      <p>Escreva <code>validar_idade(texto)</code>, que devolve a idade como número inteiro.
        Levante <code>ValueError</code> se o texto não for número ou se a idade estiver fora de 0 a 130.</p>`,
    dica: 'int(texto) já levanta ValueError para "abc". Depois, if not 0 <= idade <= 130: raise ValueError(...).',
    arquivos: assinatura('validar_idade(texto)'),
    solucao: main(py`
      def validar_idade(texto):
          idade = int(texto)
          if not 0 <= idade <= 130:
              raise ValueError("idade fora do intervalo")
          return idade
    `),
    testes: [
      {
        descricao: '30 e texto',
        regras: [
          { funcao: 'validar_idade', args: ['30'], igual: 30 },
          { funcao: 'validar_idade', args: ['abc'], erro: 'ValueError' },
        ],
      },
      {
        descricao: 'limites',
        oculto: true,
        regras: [
          { funcao: 'validar_idade', args: ['131'], erro: 'ValueError' },
          { funcao: 'validar_idade', args: ['-1'], erro: 'ValueError' },
          { funcao: 'validar_idade', args: ['0'], igual: 0 },
        ],
      },
    ],
  },
  {
    id: 'py-carrinho',
    tipo: 'problema',
    titulo: 'Total do carrinho',
    dificuldade: 'dificil',
    enunciado: `
      <p>Escreva <code>total_carrinho(itens, cupom=None)</code>. Cada item é um dicionário com <code>preco</code> e <code>qtd</code>.</p>
      <ul>
        <li>O total é a soma de <code>preco * qtd</code>, com duas casas decimais.</li>
        <li>O cupom <code>"SERTAO10"</code> dá 10% de desconto.</li>
        <li>Qualquer outro cupom levanta <code>ValueError</code>.</li>
      </ul>`,
    dica: 'Some com sum(i["preco"] * i["qtd"] for i in itens); aplique o cupom só quando ele não for None; round(total, 2) no fim.',
    arquivos: assinatura('total_carrinho(itens, cupom=None)'),
    solucao: main(py`
      def total_carrinho(itens, cupom=None):
          total = sum(i["preco"] * i["qtd"] for i in itens)
          if cupom is not None:
              if cupom != "SERTAO10":
                  raise ValueError("cupom inválido")
              total *= 0.9
          return round(total, 2)
    `),
    testes: [
      {
        descricao: 'sem e com cupom',
        regras: [
          { funcao: 'total_carrinho', args: [[{ preco: 10, qtd: 2 }]], igual: 20 },
          { funcao: 'total_carrinho', args: [[{ preco: 10, qtd: 2 }], 'SERTAO10'], igual: 18 },
        ],
      },
      {
        descricao: 'vazio, centavos e cupom inválido',
        oculto: true,
        regras: [
          { funcao: 'total_carrinho', args: [[]], igual: 0 },
          { funcao: 'total_carrinho', args: [[{ preco: 9.99, qtd: 3 }], 'SERTAO10'], igual: 26.97 },
          { funcao: 'total_carrinho', args: [[{ preco: 1, qtd: 1 }], 'X'], erro: 'ValueError' },
        ],
      },
    ],
  },
];
