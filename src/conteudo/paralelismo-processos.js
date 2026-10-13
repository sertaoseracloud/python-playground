// ⚡ Paralelismo, segunda parte (exercícios 18 a 35): ProcessPoolExecutor, Process e Queue,
// asyncio, condições de corrida e conceitos (speedup, custo e escolha da ferramenta).
// Cada bloco entra na trilha depois da lição do assunto (veja paralelismo.js).
import { py, main, assinatura } from './util.js';

export const exerciciosMedir = [
  {
    id: 'pl-vale-paralelizar',
    tipo: 'problema',
    titulo: 'Vale a pena paralelizar?',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>vale_paralelizar(t, n, workers, custo)</code>: <code>n</code> tarefas de <code>t</code> segundos. Em sequência levam <code>n * t</code>; em paralelo, <code>ceil(n / workers) * t</code> mais o custo de mandar cada tarefa (<code>n * custo</code>). Devolva <code>True</code> só se o paralelo for <b>menor</b>.</p>',
    dica: 'import math; paralelo = math.ceil(n / workers) * t + n * custo; return paralelo < n * t.',
    arquivos: main('import math\n\n\ndef vale_paralelizar(t, n, workers, custo):\n    pass\n'),
    solucao: main(py`
      import math


      def vale_paralelizar(t, n, workers, custo):
          paralelo = math.ceil(n / workers) * t + n * custo
          return paralelo < n * t
    `),
    testes: [
      { descricao: 'tarefas de 1 s', regras: [{ funcao: 'vale_paralelizar', args: [1, 100, 4, 0.01], igual: true }] },
      {
        descricao: 'tarefas minúsculas e uma tarefa só',
        oculto: true,
        regras: [{ funcao: 'vale_paralelizar', args: [0.001, 100, 4, 0.01], igual: false }, { funcao: 'vale_paralelizar', args: [1, 1, 4, 0], igual: false }],
      },
    ],
  },
  {
    id: 'pl-tempo-estimado',
    tipo: 'problema',
    titulo: 'Tempo total estimado',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>tempo_estimado(tempos, workers)</code>: cada tarefa, na ordem da lista, vai para o worker com <b>menos trabalho acumulado</b> até ali. Devolva o maior total, que é quando tudo termina.</p><p><code>tempo_estimado([4, 3, 2, 1], 2)</code> devolve <code>5</code> (4 + 1 e 3 + 2).</p>',
    dica: 'cargas = [0] * workers; para cada tempo, some no índice de min(cargas). Sem tarefas, devolva 0.',
    arquivos: assinatura('tempo_estimado(tempos, workers)'),
    solucao: main(py`
      def tempo_estimado(tempos, workers):
          cargas = [0] * workers
          for tempo in tempos:
              cargas[cargas.index(min(cargas))] += tempo
          return max(cargas)
    `),
    testes: [
      { descricao: 'quatro tarefas, 2 workers', regras: [{ funcao: 'tempo_estimado', args: [[4, 3, 2, 1], 2], igual: 5 }] },
      {
        descricao: 'sem tarefas, uma só e iguais',
        oculto: true,
        regras: [
          { funcao: 'tempo_estimado', args: [[], 3], igual: 0 },
          { funcao: 'tempo_estimado', args: [[5], 3], igual: 5 },
          { funcao: 'tempo_estimado', args: [[1, 1, 1, 1], 2], igual: 2 },
        ],
      },
    ],
  },
];

export const exercicioChunksize = {
  id: 'pl-chunksize',
  tipo: 'problema',
  titulo: 'Tamanho do lote',
  dificuldade: 'medio',
  enunciado: '<p>Leia <code>n</code> e calcule <code>soma</code>, a soma do dobro de cada número de <code>range(n)</code>, com <code>pool.map(dobro, range(n), chunksize=100)</code>. O <code>chunksize</code> diz quantos números vão juntos em cada tarefa: menos tarefas, menos custo de envio.</p>',
  dica: 'soma = sum(pool.map(dobro, range(n), chunksize=100)), dentro do if __name__ == "__main__":.',
  arquivos: main(py`
    from multiprocessing import Pool


    def dobro(x):
        return 2 * x


    n = int(input())
    soma = sum(dobro(x) for x in range(n))
    print(soma)
  `),
  solucao: main(py`
    from multiprocessing import Pool


    def dobro(x):
        return 2 * x


    if __name__ == "__main__":
        n = int(input())
        with Pool(4) as pool:
            soma = sum(pool.map(dobro, range(n), chunksize=100))
        print(soma)
  `),
  testes: [
    { descricao: 'n = 1000', entrada: ['1000'], regras: [{ variavel: 'soma', igual: 999000 }, { paralelo: { tarefas: 10 } }, { codigo: 'chunksize', msg: 'O código usa chunksize' }] },
    { descricao: 'n = 250', oculto: true, entrada: ['250'], regras: [{ variavel: 'soma', igual: 62250 }, { paralelo: { tarefas: 3 } }] },
  ],
};

export const exerciciosFuturos = [
  {
    id: 'pl-executor-submit',
    tipo: 'problema',
    titulo: 'submit e result',
    dificuldade: 'facil',
    enunciado: '<p>Leia números numa linha e calcule <code>dobros</code> com um <code>ProcessPoolExecutor</code>: <code>submit(dobro, x)</code> para cada número e depois <code>result()</code> de cada future, na ordem.</p>',
    dica: 'futuros = [ex.submit(dobro, x) for x in numeros]; dobros = [f.result() for f in futuros].',
    arquivos: main(py`
      from concurrent.futures import ProcessPoolExecutor


      def dobro(x):
          return 2 * x


      numeros = list(map(int, input().split()))
      dobros = [dobro(x) for x in numeros]
      print(dobros)
    `),
    solucao: main(py`
      from concurrent.futures import ProcessPoolExecutor


      def dobro(x):
          return 2 * x


      if __name__ == "__main__":
          numeros = list(map(int, input().split()))
          with ProcessPoolExecutor() as ex:
              futuros = [ex.submit(dobro, x) for x in numeros]
              dobros = [f.result() for f in futuros]
          print(dobros)
    `),
    testes: [
      { descricao: 'quatro números', entrada: ['1 2 3 4'], regras: [{ variavel: 'dobros', igual: [2, 4, 6, 8] }, { paralelo: { workers: 2 } }, { codigo: 'submit', msg: 'O código usa submit' }] },
      { descricao: 'um número', oculto: true, entrada: ['7'], regras: [{ variavel: 'dobros', igual: [14] }, { paralelo: { workers: 1 } }] },
    ],
  },
  {
    id: 'pl-executor-map',
    tipo: 'problema',
    titulo: 'executor.map',
    dificuldade: 'facil',
    enunciado: '<p>Leia palavras numa linha e calcule <code>maiusculas</code> com <code>list(ex.map(str.upper, palavras))</code> num <code>ProcessPoolExecutor</code>.</p>',
    dica: 'O map do executor devolve os resultados na ordem; transforme em lista.',
    arquivos: main(py`
      from concurrent.futures import ProcessPoolExecutor

      palavras = input().split()
      maiusculas = [p.upper() for p in palavras]
      print(maiusculas)
    `),
    solucao: main(py`
      from concurrent.futures import ProcessPoolExecutor

      if __name__ == "__main__":
          palavras = input().split()
          with ProcessPoolExecutor() as ex:
              maiusculas = list(ex.map(str.upper, palavras))
          print(maiusculas)
    `),
    testes: [
      { descricao: 'três frutas', entrada: ['umbu caju pequi'], regras: [{ variavel: 'maiusculas', igual: ['UMBU', 'CAJU', 'PEQUI'] }, { paralelo: { workers: 2 } }] },
      { descricao: 'uma fruta', oculto: true, entrada: ['ata'], regras: [{ variavel: 'maiusculas', igual: ['ATA'] }, { paralelo: { workers: 1 } }] },
    ],
  },
  {
    id: 'pl-as-completed',
    tipo: 'problema',
    titulo: 'as_completed',
    dificuldade: 'medio',
    enunciado: '<p>Leia números numa linha e calcule <code>total</code>, a soma dos quadrados, recebendo cada resultado com <code>as_completed</code> assim que ele fica pronto (a ordem muda a cada execução, mas a soma não).</p>',
    dica: 'total = sum(f.result() for f in as_completed(futuros)).',
    arquivos: main(py`
      from concurrent.futures import ProcessPoolExecutor, as_completed


      def quadrado(x):
          return x * x


      numeros = list(map(int, input().split()))
      total = sum(quadrado(x) for x in numeros)
      print(total)
    `),
    solucao: main(py`
      from concurrent.futures import ProcessPoolExecutor, as_completed


      def quadrado(x):
          return x * x


      if __name__ == "__main__":
          numeros = list(map(int, input().split()))
          with ProcessPoolExecutor() as ex:
              futuros = [ex.submit(quadrado, x) for x in numeros]
              total = sum(f.result() for f in as_completed(futuros))
          print(total)
    `),
    testes: [
      { descricao: '1, 2 e 3', entrada: ['1 2 3'], regras: [{ variavel: 'total', igual: 14 }, { codigo: 'as_completed\\(', msg: 'O código usa as_completed' }, { paralelo: { workers: 2 } }] },
      { descricao: 'um número', oculto: true, entrada: ['10'], regras: [{ variavel: 'total', igual: 100 }, { paralelo: { workers: 1 } }] },
    ],
  },
  {
    id: 'pl-erro-no-worker',
    tipo: 'problema',
    titulo: 'Erro no worker',
    dificuldade: 'medio',
    enunciado: '<p>Leia números numa linha. <code>raiz(x)</code> levanta <code>ValueError("número negativo")</code> quando <code>x &lt; 0</code>. Calcule as raízes com <code>pool.map</code> e mostre a lista, ou <code>Erro: &lt;mensagem&gt;</code> se algum número for negativo.</p><p>O erro que acontece no worker sobe no processo principal com o mesmo tipo: dá para pegar com <code>try/except</code>.</p>',
    dica: 'Coloque o pool.map dentro de try e use except ValueError as erro: print(f"Erro: {erro}").',
    arquivos: main(py`
      import math
      from multiprocessing import Pool


      def raiz(x):
          if x < 0:
              raise ValueError("número negativo")
          return math.sqrt(x)


      numeros = list(map(int, input().split()))
      print([raiz(x) for x in numeros])
    `),
    solucao: main(py`
      import math
      from multiprocessing import Pool


      def raiz(x):
          if x < 0:
              raise ValueError("número negativo")
          return math.sqrt(x)


      if __name__ == "__main__":
          numeros = list(map(int, input().split()))
          with Pool(4) as pool:
              try:
                  print(pool.map(raiz, numeros))
              except ValueError as erro:
                  print(f"Erro: {erro}")
    `),
    testes: [
      { descricao: 'com negativo', entrada: ['4 -1 9'], regras: [{ saidaIgual: 'Erro: número negativo' }] },
      { descricao: 'sem negativo', oculto: true, entrada: ['4 9'], regras: [{ saidaIgual: '[2.0, 3.0]' }] },
    ],
  },
];

export const exerciciosFilas = [
  {
    id: 'pl-process-queue',
    tipo: 'problema',
    titulo: 'Process e Queue',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>n</code>. Crie dois <code>Process</code>: um soma <code>range(0, n // 2)</code> e o outro <code>range(n // 2, n + 1)</code>, e os dois põem o resultado na mesma <code>Queue</code>. No processo principal, <code>total</code> é a soma dos dois resultados.</p>',
    dica: 'def somar(fila, inicio, fim): fila.put(sum(range(inicio, fim))). Depois de start(), total = fila.get() + fila.get(), e join() nos dois.',
    arquivos: main(py`
      from multiprocessing import Process, Queue

      n = int(input())
      total = sum(range(0, n // 2)) + sum(range(n // 2, n + 1))
      print(total)
    `),
    solucao: main(py`
      from multiprocessing import Process, Queue


      def somar(fila, inicio, fim):
          fila.put(sum(range(inicio, fim)))


      if __name__ == "__main__":
          n = int(input())
          fila = Queue()
          processos = [Process(target=somar, args=(fila, 0, n // 2)), Process(target=somar, args=(fila, n // 2, n + 1))]
          for p in processos:
              p.start()
          total = fila.get() + fila.get()
          for p in processos:
              p.join()
          print(total)
    `),
    testes: [
      {
        descricao: 'n = 100',
        entrada: ['100'],
        regras: [
          { variavel: 'total', igual: 5050 },
          { paralelo: { workers: 2 } },
          { codigo: 'Process\\(', msg: 'O código usa Process' },
          { codigo: 'Queue\\(', msg: 'O código usa Queue' },
        ],
      },
      { descricao: 'n = 1', oculto: true, entrada: ['1'], regras: [{ variavel: 'total', igual: 1 }] },
      { descricao: 'n = 0', oculto: true, entrada: ['0'], regras: [{ variavel: 'total', igual: 0 }] },
    ],
  },
  {
    id: 'pl-map-reduce-paralelo',
    tipo: 'problema',
    titulo: 'Map-reduce em paralelo',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>textos.txt</code> (aba 📦 Dados), uma frase por linha. Conte as palavras de cada linha em paralelo com <code>pool.map(contar_palavras, linhas)</code> e junte tudo em <code>contagem</code>, com as palavras em minúsculas e as chaves em ordem alfabética.</p>',
    dica: 'linhas = [l for l in open("textos.txt").read().splitlines() if l.strip()]; some os Counter que o map devolver.',
    dados: { 'textos.txt': 'sol e mar\nmar azul\nsol\n' },
    arquivos: main(py`
      from collections import Counter
      from multiprocessing import Pool

      linhas = [l for l in open("textos.txt").read().splitlines() if l.strip()]
      total = Counter()
      for linha in linhas:
          total.update(linha.lower().split())
      contagem = dict(sorted(total.items()))
      print(contagem)
    `),
    solucao: main(py`
      from collections import Counter
      from multiprocessing import Pool


      def contar_palavras(texto):
          return Counter(texto.lower().split())


      if __name__ == "__main__":
          linhas = [l for l in open("textos.txt").read().splitlines() if l.strip()]
          with Pool(4) as pool:
              parciais = pool.map(contar_palavras, linhas)
          total = Counter()
          for parcial in parciais:
              total.update(parcial)
          contagem = dict(sorted(total.items()))
          print(contagem)
    `),
    testes: [
      { descricao: 'três frases', regras: [{ variavel: 'contagem', igual: { azul: 1, e: 1, mar: 2, sol: 2 } }, { paralelo: { workers: 2 } }] },
      { descricao: 'outro texto', oculto: true, dados: { 'textos.txt': 'a b\nb\n' }, regras: [{ variavel: 'contagem', igual: { a: 1, b: 2 } }] },
    ],
  },
  {
    id: 'pl-vendas-paralelo',
    tipo: 'problema',
    titulo: 'Vendas por região em paralelo',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>vendas.csv</code> (colunas <code>regiao,valor</code>), divida as linhas em 4 partes, some cada parte por região com <code>pool.map</code> e junte os resultados. Mostre <code>Região: total</code> (2 casas), com as regiões em ordem alfabética.</p>',
    dica: 'Cada parte devolve um dicionário região → soma; no fim, some os dicionários num defaultdict(float).',
    dados: { 'vendas.csv': 'regiao,valor\nNordeste,10.5\nSul,4\nNordeste,9.5\nNorte,1\n' },
    arquivos: main(py`
      import csv
      from collections import defaultdict
      from multiprocessing import Pool

      with open("vendas.csv", newline="") as arquivo:
          linhas = list(csv.DictReader(arquivo))
      totais = defaultdict(float)
      for linha in linhas:
          totais[linha["regiao"]] += float(linha["valor"])
      for regiao in sorted(totais):
          print(f"{regiao}: {totais[regiao]:.2f}")
    `),
    solucao: main(py`
      import csv
      from collections import defaultdict
      from multiprocessing import Pool


      def dividir(lista, n):
          base, extra = divmod(len(lista), n)
          partes, inicio = [], 0
          for i in range(n):
              tamanho = base + (1 if i < extra else 0)
              partes.append(lista[inicio:inicio + tamanho])
              inicio += tamanho
          return partes


      def somar_parte(linhas):
          parcial = defaultdict(float)
          for linha in linhas:
              parcial[linha["regiao"]] += float(linha["valor"])
          return dict(parcial)


      if __name__ == "__main__":
          with open("vendas.csv", newline="") as arquivo:
              linhas = list(csv.DictReader(arquivo))
          with Pool(4) as pool:
              parciais = pool.map(somar_parte, dividir(linhas, 4))
          totais = defaultdict(float)
          for parcial in parciais:
              for regiao, valor in parcial.items():
                  totais[regiao] += valor
          for regiao in sorted(totais):
              print(f"{regiao}: {totais[regiao]:.2f}")
    `),
    testes: [
      { descricao: 'quatro vendas', regras: [{ saidaIgual: 'Nordeste: 20.00\nNorte: 1.00\nSul: 4.00' }, { paralelo: { workers: 2 } }] },
      { descricao: 'outra planilha', oculto: true, dados: { 'vendas.csv': 'regiao,valor\nSul,1\nSul,2\n' }, regras: [{ saidaIgual: 'Sul: 3.00' }, { paralelo: { workers: 1 } }] },
    ],
  },
];

export const exerciciosAsyncio = [
  {
    id: 'pl-async-dobro',
    tipo: 'problema',
    titulo: 'gather',
    dificuldade: 'facil',
    enunciado: '<p>Leia números numa linha. Escreva <code>async def dobro(x)</code>, que faz <code>await asyncio.sleep(0)</code> e devolve o dobro, e uma <code>async def main(numeros)</code> que roda todos com <code>asyncio.gather</code>. Guarde em <code>resultados</code> o que <code>asyncio.run(main(numeros))</code> devolver.</p>',
    dica: 'return await asyncio.gather(*(dobro(x) for x in numeros)). O gather devolve na ordem dos argumentos.',
    arquivos: main(py`
      import asyncio

      numeros = list(map(int, input().split()))
      resultados = [x * 2 for x in numeros]
      print(resultados)
    `),
    solucao: main(py`
      import asyncio


      async def dobro(x):
          await asyncio.sleep(0)
          return x * 2


      async def main(numeros):
          return await asyncio.gather(*(dobro(x) for x in numeros))


      numeros = list(map(int, input().split()))
      resultados = asyncio.run(main(numeros))
      print(resultados)
    `),
    testes: [
      { descricao: '1, 2 e 3', entrada: ['1 2 3'], regras: [{ variavel: 'resultados', igual: [2, 4, 6] }, { codigo: 'gather', msg: 'O código usa asyncio.gather' }, { codigo: 'async def', msg: 'O código usa async def' }] },
      { descricao: 'um número', oculto: true, entrada: ['5'], regras: [{ variavel: 'resultados', igual: [10] }] },
    ],
  },
  {
    id: 'pl-async-ordem',
    tipo: 'problema',
    titulo: 'Quem termina primeiro',
    dificuldade: 'medio',
    enunciado: '<p>Leia uma linha com <code>nome:tempo</code> separados por espaço. <code>baixar(nome, tempo)</code> dorme <code>tempo / 20</code> segundos, mostra o nome e devolve o nome. Rode todos juntos com <code>gather</code> e, no fim, mostre a lista que o <code>gather</code> devolveu.</p><p>Os nomes saem na ordem em que <b>terminam</b>; a lista vem na ordem dos argumentos.</p>',
    dica: 'pares = [p.split(":") for p in input().split()]; await asyncio.gather(*(baixar(n, int(t)) for n, t in pares)).',
    arquivos: main(py`
      import asyncio

      pares = [p.split(":") for p in input().split()]
      nomes = []
      for nome, tempo in pares:
          print(nome)
          nomes.append(nome)
      print(nomes)
    `),
    solucao: main(py`
      import asyncio


      async def baixar(nome, tempo):
          await asyncio.sleep(tempo / 20)
          print(nome)
          return nome


      async def main(pares):
          return await asyncio.gather(*(baixar(nome, int(tempo)) for nome, tempo in pares))


      pares = [p.split(":") for p in input().split()]
      print(asyncio.run(main(pares)))
    `),
    testes: [
      { descricao: 'c, a e b', entrada: ['c:3 a:1 b:2'], regras: [{ saidaIgual: "a\nb\nc\n['c', 'a', 'b']" }] },
      { descricao: 'um só', oculto: true, entrada: ['x:1'], regras: [{ saidaIgual: "x\n['x']" }, { codigo: 'gather' }] },
    ],
  },
  {
    id: 'pl-create-task',
    tipo: 'problema',
    titulo: 'create_task',
    dificuldade: 'facil',
    enunciado: '<p>Leia <code>a</code> e <code>b</code> (um por linha). Escreva <code>async def dobro(x)</code> e uma <code>async def main(a, b)</code> que cria duas tarefas com <code>asyncio.create_task(dobro(...))</code> e devolve a soma delas. Guarde o resultado em <code>total</code>.</p>',
    dica: 't1 = asyncio.create_task(dobro(a)); t2 = asyncio.create_task(dobro(b)); return await t1 + await t2.',
    arquivos: main(py`
      import asyncio

      a = int(input())
      b = int(input())
      total = 2 * a + 2 * b
      print(total)
    `),
    solucao: main(py`
      import asyncio


      async def dobro(x):
          await asyncio.sleep(0)
          return 2 * x


      async def main(a, b):
          t1 = asyncio.create_task(dobro(a))
          t2 = asyncio.create_task(dobro(b))
          return await t1 + await t2


      a = int(input())
      b = int(input())
      total = asyncio.run(main(a, b))
      print(total)
    `),
    testes: [
      { descricao: '2 e 3', entrada: ['2', '3'], regras: [{ variavel: 'total', igual: 10 }, { codigo: 'create_task', msg: 'O código usa asyncio.create_task' }] },
      { descricao: 'zeros', oculto: true, entrada: ['0', '0'], regras: [{ variavel: 'total', igual: 0 }] },
    ],
  },
  {
    id: 'pl-wait-for',
    tipo: 'problema',
    titulo: 'Tempo limite',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>limite</code> e <code>duracao</code> (segundos, um por linha). <code>lento()</code> dorme <code>duracao</code> segundos. Com <code>asyncio.wait_for(lento(), timeout=limite)</code>, mostre <code>Pronto</code> se deu tempo ou <code>Demorou demais</code> se estourou.</p>',
    dica: 'try: await asyncio.wait_for(lento(), timeout=limite); print("Pronto") / except TimeoutError: print("Demorou demais").',
    arquivos: main(py`
      import asyncio

      limite = float(input())
      duracao = float(input())


      async def lento():
          await asyncio.sleep(duracao)


      async def main():
          await lento()
          print("Pronto")


      asyncio.run(main())
    `),
    solucao: main(py`
      import asyncio

      limite = float(input())
      duracao = float(input())


      async def lento():
          await asyncio.sleep(duracao)


      async def main():
          try:
              await asyncio.wait_for(lento(), timeout=limite)
              print("Pronto")
          except TimeoutError:
              print("Demorou demais")


      asyncio.run(main())
    `),
    testes: [
      { descricao: 'limite curto', entrada: ['0.05', '0.5'], regras: [{ saidaIgual: 'Demorou demais' }, { codigo: 'wait_for', msg: 'O código usa asyncio.wait_for' }] },
      { descricao: 'deu tempo', oculto: true, entrada: ['1', '0.05'], regras: [{ saidaIgual: 'Pronto' }] },
    ],
  },
  {
    id: 'pl-produtor-consumidor',
    tipo: 'problema',
    titulo: 'Produtor e consumidor',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>n</code>. Um <b>produtor</b> põe os números de 1 a <code>n</code> numa <code>asyncio.Queue</code> e, no fim, <code>None</code>. Um <b>consumidor</b> tira da fila e guarda o quadrado de cada número em <code>consumidos</code>, até receber <code>None</code>. Rode os dois juntos com <code>gather</code>.</p>',
    dica: 'consumidor: while True: x = await fila.get(); if x is None: break; consumidos.append(x * x).',
    arquivos: main(py`
      import asyncio

      n = int(input())
      consumidos = [x * x for x in range(1, n + 1)]
      print(consumidos)
    `),
    solucao: main(py`
      import asyncio

      n = int(input())
      consumidos = []


      async def produtor(fila):
          for x in range(1, n + 1):
              await fila.put(x)
          await fila.put(None)


      async def consumidor(fila):
          while True:
              x = await fila.get()
              if x is None:
                  break
              consumidos.append(x * x)


      async def main():
          fila = asyncio.Queue()
          await asyncio.gather(produtor(fila), consumidor(fila))


      asyncio.run(main())
      print(consumidos)
    `),
    testes: [
      { descricao: 'n = 4', entrada: ['4'], regras: [{ variavel: 'consumidos', igual: [1, 4, 9, 16] }, { codigo: 'asyncio\\.Queue', msg: 'O código usa asyncio.Queue' }] },
      { descricao: 'n = 0', oculto: true, entrada: ['0'], regras: [{ variavel: 'consumidos', igual: [] }] },
    ],
  },
];

export const exerciciosCorrida = [
  {
    id: 'pl-corrida-lock',
    tipo: 'problema',
    titulo: 'Conserte a corrida',
    dificuldade: 'medio',
    enunciado: '<p>O código inicial faz <code>n</code> depósitos ao mesmo tempo, e cada um lê o saldo, espera e grava <code>saldo + 1</code>. Rode e veja: o saldo final fica muito menor que <code>n</code>. Use um <code>asyncio.Lock</code> para que o saldo final seja exatamente <code>n</code>.</p>',
    dica: 'Crie trava = asyncio.Lock() dentro do main e envolva as três linhas do depósito com async with trava:.',
    arquivos: main(py`
      import asyncio

      n = int(input())
      saldo = 0


      async def depositar():
          global saldo
          x = saldo
          await asyncio.sleep(0)
          saldo = x + 1


      async def main():
          await asyncio.gather(*[depositar() for _ in range(n)])


      asyncio.run(main())
      print(saldo)
    `),
    solucao: main(py`
      import asyncio

      n = int(input())
      saldo = 0


      async def depositar(trava):
          global saldo
          async with trava:
              x = saldo
              await asyncio.sleep(0)
              saldo = x + 1


      async def main():
          trava = asyncio.Lock()
          await asyncio.gather(*[depositar(trava) for _ in range(n)])


      asyncio.run(main())
      print(saldo)
    `),
    testes: [
      { descricao: '100 depósitos', entrada: ['100'], regras: [{ variavel: 'saldo', igual: 100 }, { codigo: 'Lock\\(', msg: 'O código usa asyncio.Lock' }] },
      { descricao: '7 depósitos', oculto: true, entrada: ['7'], regras: [{ variavel: 'saldo', igual: 7 }] },
    ],
  },
  {
    id: 'pl-semaforo',
    tipo: 'problema',
    titulo: 'No máximo k ao mesmo tempo',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>k</code> e <code>n</code>. Rode <code>n</code> tarefas que contam quantas estão ativas ao mesmo tempo e guardam o maior número visto em <code>maximo_simultaneo</code>. Com <code>asyncio.Semaphore(k)</code>, esse máximo tem de ser <code>k</code>.</p>',
    dica: 'Dentro de async with semaforo: ativos += 1; maximo_simultaneo = max(...); await asyncio.sleep(0.01); ativos -= 1.',
    arquivos: main(py`
      import asyncio

      k = int(input())
      n = int(input())
      ativos = 0
      maximo_simultaneo = 0


      async def tarefa():
          global ativos, maximo_simultaneo
          ativos += 1
          maximo_simultaneo = max(maximo_simultaneo, ativos)
          await asyncio.sleep(0.01)
          ativos -= 1


      async def main():
          await asyncio.gather(*[tarefa() for _ in range(n)])


      asyncio.run(main())
      print(maximo_simultaneo)
    `),
    solucao: main(py`
      import asyncio

      k = int(input())
      n = int(input())
      ativos = 0
      maximo_simultaneo = 0


      async def tarefa(semaforo):
          global ativos, maximo_simultaneo
          async with semaforo:
              ativos += 1
              maximo_simultaneo = max(maximo_simultaneo, ativos)
              await asyncio.sleep(0.01)
              ativos -= 1


      async def main():
          semaforo = asyncio.Semaphore(k)
          await asyncio.gather(*[tarefa(semaforo) for _ in range(n)])


      asyncio.run(main())
      print(maximo_simultaneo)
    `),
    testes: [
      { descricao: 'k = 2, n = 6', entrada: ['2', '6'], regras: [{ variavel: 'maximo_simultaneo', igual: 2 }, { codigo: 'Semaphore\\(', msg: 'O código usa asyncio.Semaphore' }] },
      { descricao: 'k = 3, n = 10', oculto: true, entrada: ['3', '10'], regras: [{ variavel: 'maximo_simultaneo', igual: 3 }] },
    ],
  },
];

export const exercicioFerramenta = {
  id: 'pl-escolher',
  tipo: 'problema',
  titulo: 'Processo ou asyncio?',
  dificuldade: 'facil',
  enunciado: '<p>Escreva <code>escolher_ferramenta(tipo)</code>: para trabalho de cálculo (<code>"cpu"</code>), devolva <code>"processos"</code>; para trabalho de espera (<code>"io"</code>), devolva <code>"asyncio"</code>; para qualquer outro tipo, levante <code>ValueError</code>.</p>',
  dica: 'if tipo == "cpu": ... elif tipo == "io": ... else: raise ValueError(...)',
  arquivos: assinatura('escolher_ferramenta(tipo)'),
  solucao: main(py`
    def escolher_ferramenta(tipo):
        if tipo == "cpu":
            return "processos"
        if tipo == "io":
            return "asyncio"
        raise ValueError(f"tipo desconhecido: {tipo}")
  `),
  testes: [
    { descricao: 'cálculo e espera', regras: [{ funcao: 'escolher_ferramenta', args: ['cpu'], igual: 'processos' }, { funcao: 'escolher_ferramenta', args: ['io'], igual: 'asyncio' }] },
    { descricao: 'tipo desconhecido', oculto: true, regras: [{ funcao: 'escolher_ferramenta', args: ['gpu'], erro: 'ValueError' }] },
  ],
};
