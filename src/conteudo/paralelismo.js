// ⚡ Paralelismo: dividir o trabalho, partições, map-reduce, speedup e Lei de Amdahl,
// processos (Pool, ProcessPoolExecutor, Process e Queue), asyncio e condições de corrida.
// Os processos rodam de verdade no pool de workers (diverge_paralelo); os exercícios com
// processos são conferidos pela regra `paralelo` (quantos workers trabalharam, nunca o tempo).
// Os exercícios 18 a 35 ficam em paralelismo-processos.js.
import { py, main, assinatura } from './util.js';

const licoes = {
  dividir: {
    id: 'licao-dividir',
    tipo: 'licao',
    titulo: 'Dividir o trabalho',
    resumo: `
      <p>Paralelizar começa por <b>dividir</b>: uma lista grande vira partes menores, e cada parte pode ir para um trabalhador diferente.
        É como dividir a colheita de um roçado entre três pessoas: cada uma pega um pedaço, e no fim junta tudo.</p>
      <p>As partes devem ter tamanhos parecidos. Se uma parte for muito maior, todo mundo fica esperando a pessoa que pegou mais.</p>`,
    arquivos: main(py`
      numeros = list(range(1, 11))
      n = 3
      base, extra = divmod(len(numeros), n)
      partes = []
      inicio = 0
      for i in range(n):
          tamanho = base + (1 if i < extra else 0)
          partes.append(numeros[inicio:inicio + tamanho])
          inicio += tamanho
      print(partes)

      somas = [sum(parte) for parte in partes]
      print("Soma de cada parte:", somas)
      print("Total:", sum(somas))
    `),
  },
  particoes: {
    id: 'licao-particoes',
    tipo: 'licao',
    titulo: 'Partições por hash e por intervalo',
    resumo: `
      <p>Uma <b>partição</b> é a parte dos dados que vai para um trabalhador. Por <b>hash</b>, uma conta com a chave decide a partição:
        a mesma chave cai sempre no mesmo lugar, como cartas separadas pela primeira letra do nome.</p>
      <p>O <code>hash()</code> do Python muda a cada execução, então aqui usamos uma conta fixa: a soma dos códigos das letras.
        Por <b>intervalo</b>, a partição depende da faixa do valor (até 10, até 20...).</p>
      <p>Quando uma partição fica com muito mais dados que as outras, há <b>desequilíbrio</b> (skew).</p>`,
    arquivos: main(py`
      from bisect import bisect_right

      def particao_hash(chave, n):
          return sum(ord(c) for c in chave) % n

      for nome in ["ana", "bia", "caio", "davi"]:
          print(nome, "-> partição", particao_hash(nome, 2))

      limites = [10, 20]
      for valor in [3, 10, 15, 42]:
          print(valor, "-> faixa", bisect_right(limites, valor))
    `),
  },
  mapReduce: {
    id: 'licao-map-reduce',
    tipo: 'licao',
    titulo: 'Map-reduce à mão',
    resumo: `
      <p><b>Map-reduce</b> é a receita do processamento de dados em paralelo: no <b>map</b>, cada parte é processada sozinha
        (cada pessoa conta as palavras do seu capítulo); no <b>reduce</b>, os resultados parciais são juntados (alguém soma as contagens).</p>
      <p>Como o map de uma parte não depende das outras, ele pode rodar ao mesmo tempo em vários processos. É a ideia por trás do Spark.</p>`,
    arquivos: main(py`
      from collections import Counter

      capitulos = ["o sertão vai virar mar", "e o mar vai virar sertão"]

      parciais = [Counter(texto.split()) for texto in capitulos]  # map
      print(parciais)

      total = Counter()
      for parcial in parciais:  # reduce
          total.update(parcial)
      print(dict(sorted(total.items())))
    `),
  },
  speedup: {
    id: 'licao-speedup',
    tipo: 'licao',
    titulo: 'Speedup e Lei de Amdahl',
    resumo: `
      <p><b>Speedup</b> é quantas vezes ficou mais rápido: tempo em sequência ÷ tempo em paralelo. A <b>eficiência</b> divide o speedup
        pelo número de trabalhadores: 4 workers com speedup 3 dão 75%.</p>
      <p>A <b>Lei de Amdahl</b> diz que a parte que não dá para paralelizar limita tudo: se 10% do trabalho é em sequência, nem com mil
        workers passa de 10 vezes. É como um ônibus que só sai quando o último passageiro paga a passagem na catraca.</p>
      <p>Mandar dados para outro processo também custa tempo (serializar e copiar). Com tarefas muito pequenas, o paralelo pode ficar mais lento.</p>`,
    arquivos: main(py`
      def amdahl(p, n):
          return 1 / ((1 - p) + p / n)

      for workers in [1, 2, 4, 8]:
          s = amdahl(0.9, workers)
          print(f"{workers} workers: speedup {s:.2f}, eficiência {s / workers * 100:.0f}%")
    `),
  },
  processos: {
    id: 'licao-processos',
    tipo: 'licao',
    titulo: 'Processos com Pool',
    resumo: `
      <p>Um <b>processo</b> é um programa Python separado, com a sua própria memória. O <code>Pool</code> do <code>multiprocessing</code>
        abre alguns processos e divide o trabalho entre eles: <code>pool.map(funcao, itens)</code>.</p>
      <p>Aqui, cada processo é um <b>worker</b> do navegador com o seu próprio Python, rodando nos núcleos do seu computador ao mesmo tempo.</p>
      <p>Regra importante: o código que cria processos fica dentro de <code>if __name__ == "__main__":</code>. Sem ele, o Python dá
        <code>RuntimeError</code>, porque cada processo novo relê o arquivo e criaria processos sem fim.</p>`,
    arquivos: main(py`
      from multiprocessing import Pool, cpu_count

      def quadrado(x):
          print("calculando", x)
          return x * x

      if __name__ == "__main__":
          print("Núcleos:", cpu_count())
          with Pool(4) as pool:
              resultados = pool.map(quadrado, range(6))
          print(resultados)
    `),
  },
  futures: {
    id: 'licao-futures',
    tipo: 'licao',
    titulo: 'ProcessPoolExecutor',
    resumo: `
      <p><code>concurrent.futures.ProcessPoolExecutor</code> faz o mesmo que o Pool, com outra cara: <code>submit</code> manda uma tarefa
        e devolve um <b>future</b>, uma promessa do resultado; <code>result()</code> espera por ele.</p>
      <p><code>as_completed</code> entrega os futures na ordem em que <b>terminam</b>, que muda de uma execução para outra. É a fila do
        restaurante: quem pediu primeiro nem sempre recebe primeiro.</p>`,
    arquivos: main(py`
      from concurrent.futures import ProcessPoolExecutor, as_completed

      def dobro(x):
          return x * 2

      if __name__ == "__main__":
          with ProcessPoolExecutor() as ex:
              futuros = [ex.submit(dobro, x) for x in range(5)]
              print([f.result() for f in futuros])
              print(sorted(f.result() for f in as_completed(futuros)))
              print(list(ex.map(dobro, [10, 20])))
    `),
  },
  processoFila: {
    id: 'licao-processo-fila',
    tipo: 'licao',
    titulo: 'Process e Queue',
    resumo: `
      <p><code>Process(target=funcao, args=(...))</code> cria um processo para uma função; <code>start()</code> começa e <code>join()</code>
        espera terminar.</p>
      <p>Processos não dividem variáveis: cada um tem a sua memória. Para devolver resultados, use uma <code>Queue</code> (fila):
        o filho faz <code>put</code> e o pai faz <code>get</code>, como bilhetes deixados numa caixa de correio.</p>
      <p>Memória compartilhada (<code>Value</code>, <code>Array</code>) existe no Python, mas precisa de um recurso que o GitHub Pages não libera;
        aqui ela fica como conceito.</p>`,
    arquivos: main(py`
      from multiprocessing import Process, Queue

      def somar(fila, inicio, fim):
          fila.put(sum(range(inicio, fim)))

      if __name__ == "__main__":
          fila = Queue()
          processos = [Process(target=somar, args=(fila, 0, 50)), Process(target=somar, args=(fila, 50, 101))]
          for p in processos:
              p.start()
          total = fila.get() + fila.get()
          for p in processos:
              p.join()
          print("Total:", total)
    `),
  },
  asyncio: {
    id: 'licao-asyncio',
    tipo: 'licao',
    titulo: 'asyncio: esperar sem parar',
    resumo: `
      <p>Muito programa passa o tempo <b>esperando</b>: a internet, o disco, o banco. Com <code>asyncio</code>, enquanto uma tarefa espera,
        outra anda. Uma função <code>async def</code> pausa no <code>await</code> e deixa as outras rodarem.</p>
      <p><code>asyncio.gather</code> roda várias juntas e <code>asyncio.run</code> começa tudo. É o cozinheiro que põe o feijão no fogo e,
        enquanto ele cozinha, corta a cebola, em vez de ficar olhando a panela.</p>`,
    arquivos: main(py`
      import asyncio
      import time

      async def baixar(nome, segundos):
          await asyncio.sleep(segundos)
          return f"{nome} pronto"

      async def main():
          inicio = time.perf_counter()
          resultados = await asyncio.gather(baixar("a", 0.2), baixar("b", 0.2))
          print(resultados)
          print(f"Levou {time.perf_counter() - inicio:.1f} s, e não 0.4 s")

      asyncio.run(main())
    `),
  },
  corrida: {
    id: 'licao-corrida',
    tipo: 'licao',
    titulo: 'Condição de corrida e Lock',
    resumo: `
      <p>Quando duas tarefas mexem no mesmo dado e uma pausa no meio, uma pode apagar o trabalho da outra: é a <b>condição de corrida</b>.
        Duas pessoas leem o saldo 100, as duas somam 10 e gravam 110: um depósito sumiu.</p>
      <p>Um <code>asyncio.Lock</code> deixa só uma tarefa por vez no trecho perigoso, como a chave do único banheiro do posto.
        Um <code>Semaphore(k)</code> deixa no máximo <code>k</code> ao mesmo tempo.</p>`,
    arquivos: main(py`
      import asyncio

      saldo = 0

      async def depositar_sem_trava():
          global saldo
          x = saldo
          await asyncio.sleep(0)
          saldo = x + 1

      async def depositar_com_trava(trava):
          global saldo
          async with trava:
              x = saldo
              await asyncio.sleep(0)
              saldo = x + 1

      async def main():
          global saldo
          await asyncio.gather(*[depositar_sem_trava() for _ in range(10)])
          print("Sem trava:", saldo)
          saldo = 0
          trava = asyncio.Lock()
          await asyncio.gather(*[depositar_com_trava(trava) for _ in range(10)])
          print("Com trava:", saldo)

      asyncio.run(main())
    `),
  },
  gilThreads: {
    id: 'licao-gil-threads',
    tipo: 'licao',
    titulo: 'GIL e threads',
    resumo: `
      <p>No Python, o <b>GIL</b> (trava global do interpretador) deixa só uma thread por vez rodar código Python. Por isso, threads
        ajudam quando o programa <b>espera</b> (rede, disco), mas não deixam uma conta pesada mais rápida: para calcular em paralelo, use processos.</p>
      <p>No navegador, o Python não consegue criar threads: <code>Thread.start()</code> dá erro. Aqui, a espera se ensina com <code>asyncio</code>
        e o cálculo com processos. Resumindo: <b>esperar</b> → asyncio (ou threads); <b>calcular</b> → processos.</p>`,
    arquivos: main(py`
      import threading

      def tarefa():
          print("rodando numa thread")

      try:
          t = threading.Thread(target=tarefa)
          t.start()
          t.join()
      except RuntimeError as erro:
          print("Neste navegador não há threads:", erro)
      print("Para esperar: asyncio. Para calcular: processos.")
    `),
  },
};

// ---------- exercícios 1 a 11: dividir, particionar, map-reduce e medir ----------

const exerciciosDividir = [
  {
    id: 'pl-dividir',
    tipo: 'problema',
    titulo: 'Dividir em partes',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>dividir(lista, n)</code>, que devolve <code>n</code> partes contínuas da lista. Quando não divide exato, as primeiras partes ficam com 1 item a mais.</p><p><code>dividir([1, 2, 3, 4, 5, 6, 7], 3)</code> devolve <code>[[1, 2, 3], [4, 5], [6, 7]]</code>.</p>',
    dica: 'base, extra = divmod(len(lista), n): a parte i tem base + 1 itens se i < extra.',
    arquivos: assinatura('dividir(lista, n)'),
    solucao: main(py`
      def dividir(lista, n):
          base, extra = divmod(len(lista), n)
          partes, inicio = [], 0
          for i in range(n):
              tamanho = base + (1 if i < extra else 0)
              partes.append(lista[inicio:inicio + tamanho])
              inicio += tamanho
          return partes
    `),
    testes: [
      { descricao: '7 itens em 3', regras: [{ funcao: 'dividir', args: [[1, 2, 3, 4, 5, 6, 7], 3], igual: [[1, 2, 3], [4, 5], [6, 7]] }] },
      { descricao: 'vazia e mais partes que itens', oculto: true, regras: [{ funcao: 'dividir', args: [[], 2], igual: [[], []] }, { funcao: 'dividir', args: [[1, 2], 4], igual: [[1], [2], [], []] }] },
    ],
  },
  {
    id: 'pl-intervalos',
    tipo: 'problema',
    titulo: 'Intervalos de trabalho',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>intervalos(total, n)</code>, que divide <code>0..total</code> em <code>n</code> intervalos <code>[início, fim)</code>, com as primeiras partes 1 maior quando não divide exato.</p><p><code>intervalos(10, 3)</code> devolve <code>[[0, 4], [4, 7], [7, 10]]</code>.</p>',
    dica: 'Mesma conta do exercício anterior: acumule o início e some o tamanho de cada parte.',
    arquivos: assinatura('intervalos(total, n)'),
    solucao: main(py`
      def intervalos(total, n):
          base, extra = divmod(total, n)
          resultado, inicio = [], 0
          for i in range(n):
              fim = inicio + base + (1 if i < extra else 0)
              resultado.append([inicio, fim])
              inicio = fim
          return resultado
    `),
    testes: [
      { descricao: '10 em 3', regras: [{ funcao: 'intervalos', args: [10, 3], igual: [[0, 4], [4, 7], [7, 10]] }] },
      { descricao: 'zero e 5 em 5', oculto: true, regras: [{ funcao: 'intervalos', args: [0, 2], igual: [[0, 0], [0, 0]] }, { funcao: 'intervalos', args: [5, 5], igual: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] }] },
    ],
  },
  {
    id: 'pl-particao-hash',
    tipo: 'problema',
    titulo: 'Partição por hash',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>particionar_hash(chaves, n)</code>, que devolve <code>n</code> listas. Cada chave vai para a partição <code>sum(ord(c) for c in chave) % n</code>, na ordem em que chegou.</p>',
    dica: 'Comece com [[] for _ in range(n)] e faça append na partição de cada chave.',
    arquivos: assinatura('particionar_hash(chaves, n)'),
    solucao: main(py`
      def particionar_hash(chaves, n):
          particoes = [[] for _ in range(n)]
          for chave in chaves:
              particoes[sum(ord(c) for c in chave) % n].append(chave)
          return particoes
    `),
    testes: [
      { descricao: 'três nomes em 3', regras: [{ funcao: 'particionar_hash', args: [['ana', 'bia', 'caio'], 3], igual: [['bia'], ['ana', 'caio'], []] }] },
      { descricao: 'vazia e letras', oculto: true, regras: [{ funcao: 'particionar_hash', args: [[], 2], igual: [[], []] }, { funcao: 'particionar_hash', args: [['a', 'b', 'c'], 2], igual: [['b'], ['a', 'c']] }] },
    ],
  },
  {
    id: 'pl-particao-intervalo',
    tipo: 'problema',
    titulo: 'Partição por intervalo',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>particionar_intervalo(valores, limites)</code>. Com os limites em ordem, há <code>len(limites) + 1</code> partições; cada valor vai para a partição <code>bisect_right(limites, valor)</code>.</p><p><code>particionar_intervalo([5, 10, 15, 20, 25], [10, 20])</code> devolve <code>[[5], [10, 15], [20, 25]]</code>.</p>',
    dica: 'from bisect import bisect_right: ela diz quantos limites são menores ou iguais ao valor.',
    arquivos: main('from bisect import bisect_right\n\n\ndef particionar_intervalo(valores, limites):\n    pass\n'),
    solucao: main(py`
      from bisect import bisect_right


      def particionar_intervalo(valores, limites):
          particoes = [[] for _ in range(len(limites) + 1)]
          for valor in valores:
              particoes[bisect_right(limites, valor)].append(valor)
          return particoes
    `),
    testes: [
      { descricao: 'cinco valores, dois limites', regras: [{ funcao: 'particionar_intervalo', args: [[5, 10, 15, 20, 25], [10, 20]], igual: [[5], [10, 15], [20, 25]] }] },
      { descricao: 'vazia e no limite', oculto: true, regras: [{ funcao: 'particionar_intervalo', args: [[], [0]], igual: [[], []] }, { funcao: 'particionar_intervalo', args: [[-1, 0, 1], [0]], igual: [[-1], [0, 1]] }] },
    ],
  },
  {
    id: 'pl-contar-palavras',
    tipo: 'problema',
    titulo: 'Map: contar palavras',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>contar_palavras(texto)</code>, que devolve <code>{palavra: vezes}</code> com as palavras em minúsculas e as chaves em ordem alfabética.</p>',
    dica: 'Counter(texto.lower().split()) conta; dict(sorted(...items())) ordena as chaves.',
    arquivos: main('from collections import Counter\n\n\ndef contar_palavras(texto):\n    pass\n'),
    solucao: main(py`
      from collections import Counter


      def contar_palavras(texto):
          return dict(sorted(Counter(texto.lower().split()).items()))
    `),
    testes: [
      { descricao: 'Sol e sol', regras: [{ funcao: 'contar_palavras', args: ['Sol e sol'], igual: { e: 1, sol: 2 } }] },
      { descricao: 'vazio e repetida', oculto: true, regras: [{ funcao: 'contar_palavras', args: [''], igual: {} }, { funcao: 'contar_palavras', args: ['a b a'], igual: { a: 2, b: 1 } }] },
    ],
  },
  {
    id: 'pl-somar-contagens',
    tipo: 'problema',
    titulo: 'Reduce: juntar contagens',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>somar_contagens(contagens)</code>: recebe uma lista de dicionários palavra → vezes e devolve um só, com as somas e as chaves em ordem alfabética.</p>',
    dica: 'Comece com total = Counter() e faça total.update(c) para cada dicionário.',
    arquivos: main('from collections import Counter\n\n\ndef somar_contagens(contagens):\n    pass\n'),
    solucao: main(py`
      from collections import Counter


      def somar_contagens(contagens):
          total = Counter()
          for contagem in contagens:
              total.update(contagem)
          return dict(sorted(total.items()))
    `),
    testes: [
      { descricao: 'duas contagens', regras: [{ funcao: 'somar_contagens', args: [[{ a: 1 }, { a: 2, b: 1 }]], igual: { a: 3, b: 1 } }] },
      { descricao: 'nenhuma e uma vazia', oculto: true, regras: [{ funcao: 'somar_contagens', args: [[]], igual: {} }, { funcao: 'somar_contagens', args: [[{ z: 1 }, {}]], igual: { z: 1 } }] },
    ],
  },
  {
    id: 'pl-map-reduce',
    tipo: 'problema',
    titulo: 'Map-reduce completo',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>contagem_total(textos)</code> usando duas funções suas: <code>contar_palavras(texto)</code> (o map, como no exercício anterior) e <code>somar_contagens(contagens)</code> (o reduce).</p><p><code>contagem_total(["sol e mar", "mar"])</code> devolve <code>{"e": 1, "mar": 2, "sol": 1}</code>.</p>',
    dica: 'contagem_total é só somar_contagens([contar_palavras(t) for t in textos]).',
    arquivos: assinatura('contagem_total(textos)', 'Escreva também contar_palavras e somar_contagens'),
    solucao: main(py`
      from collections import Counter


      def contar_palavras(texto):
          return dict(sorted(Counter(texto.lower().split()).items()))


      def somar_contagens(contagens):
          total = Counter()
          for contagem in contagens:
              total.update(contagem)
          return dict(sorted(total.items()))


      def contagem_total(textos):
          return somar_contagens([contar_palavras(t) for t in textos])
    `),
    testes: [
      {
        descricao: 'duas frases',
        regras: [
          { funcao: 'contagem_total', args: [['sol e mar', 'mar']], igual: { e: 1, mar: 2, sol: 1 } },
          { codigo: 'def contar_palavras', msg: 'O código tem a função contar_palavras (map)' },
          { codigo: 'def somar_contagens', msg: 'O código tem a função somar_contagens (reduce)' },
        ],
      },
      { descricao: 'nenhum texto e maiúsculas', oculto: true, regras: [{ funcao: 'contagem_total', args: [[]], igual: {} }, { funcao: 'contagem_total', args: [['A a']], igual: { a: 2 } }] },
    ],
  },
  {
    id: 'pl-desequilibrio',
    tipo: 'problema',
    titulo: 'Desequilíbrio (skew)',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>desequilibrio(particoes)</code>: o tamanho da maior partição dividido pela média de itens por partição, com 2 casas. Sem nenhum item, devolva <code>1.0</code>.</p><p>Com <code>[[1, 2, 3], [4], [5, 6]]</code>: maior 3, média 2, resultado <code>1.5</code>.</p>',
    dica: 'total = sum(len(p) for p in particoes); média = total / len(particoes).',
    arquivos: assinatura('desequilibrio(particoes)'),
    solucao: main(py`
      def desequilibrio(particoes):
          total = sum(len(p) for p in particoes)
          if total == 0:
              return 1.0
          media = total / len(particoes)
          return round(max(len(p) for p in particoes) / media, 2)
    `),
    testes: [
      { descricao: 'três partições', regras: [{ funcao: 'desequilibrio', args: [[[1, 2, 3], [4], [5, 6]]], igual: 1.5 }] },
      {
        descricao: 'equilibrado, vazio e tudo numa só',
        oculto: true,
        regras: [
          { funcao: 'desequilibrio', args: [[[1], [2]]], igual: 1 },
          { funcao: 'desequilibrio', args: [[[], []]], igual: 1 },
          { funcao: 'desequilibrio', args: [[[1, 2, 3, 4], [], [], []]], igual: 4 },
        ],
      },
    ],
  },
  {
    id: 'pl-speedup',
    tipo: 'problema',
    titulo: 'Speedup',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>speedup(t_seq, t_par)</code>: quantas vezes o paralelo foi mais rápido (tempo em sequência ÷ tempo em paralelo), com 2 casas.</p>',
    dica: 'round(t_seq / t_par, 2). Menor que 1 quer dizer que o paralelo ficou mais lento.',
    arquivos: assinatura('speedup(t_seq, t_par)'),
    solucao: main(py`
      def speedup(t_seq, t_par):
          return round(t_seq / t_par, 2)
    `),
    testes: [
      { descricao: '12 s para 4 s', regras: [{ funcao: 'speedup', args: [12, 4], igual: 3 }] },
      { descricao: 'dízima e paralelo mais lento', oculto: true, regras: [{ funcao: 'speedup', args: [10, 3], igual: 3.33 }, { funcao: 'speedup', args: [5, 10], igual: 0.5 }] },
    ],
  },
  {
    id: 'pl-amdahl',
    tipo: 'problema',
    titulo: 'Lei de Amdahl',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>amdahl(p, n)</code>: o speedup máximo com a fração <code>p</code> do trabalho paralelizável e <code>n</code> workers, <code>1 / ((1 - p) + p / n)</code>, com 2 casas.</p>',
    dica: 'Escreva a fórmula como está e arredonde com round(..., 2).',
    arquivos: assinatura('amdahl(p, n)'),
    solucao: main(py`
      def amdahl(p, n):
          return round(1 / ((1 - p) + p / n), 2)
    `),
    testes: [
      { descricao: '90% em 4 workers', regras: [{ funcao: 'amdahl', args: [0.9, 4], igual: 3.08 }] },
      {
        descricao: 'nada paralelo, tudo paralelo e mil workers',
        oculto: true,
        regras: [{ funcao: 'amdahl', args: [0, 8], igual: 1 }, { funcao: 'amdahl', args: [1, 4], igual: 4 }, { funcao: 'amdahl', args: [0.5, 1000], igual: 2 }],
      },
    ],
  },
  {
    id: 'pl-eficiencia',
    tipo: 'problema',
    titulo: 'Eficiência',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>eficiencia(speedup, workers)</code>: a porcentagem do ideal que foi alcançada (speedup ÷ workers × 100), com 1 casa.</p>',
    dica: 'round(speedup / workers * 100, 1)',
    arquivos: assinatura('eficiencia(speedup, workers)'),
    solucao: main(py`
      def eficiencia(speedup, workers):
          return round(speedup / workers * 100, 1)
    `),
    testes: [
      { descricao: 'speedup 3 com 4 workers', regras: [{ funcao: 'eficiencia', args: [3, 4], igual: 75 }] },
      { descricao: 'ideal e baixa', oculto: true, regras: [{ funcao: 'eficiencia', args: [4, 4], igual: 100 }, { funcao: 'eficiencia', args: [1.5, 8], igual: 18.8 }] },
    ],
  },
];

// ---------- exercícios 12 a 17 e 24: processos com Pool ----------

const MAIN = 'if __name__ == "__main__":';

const exerciciosPool = [
  {
    id: 'pl-pool-map',
    tipo: 'problema',
    titulo: 'Pool.map',
    dificuldade: 'facil',
    enunciado: `<p>Leia <code>n</code> e calcule <code>resultados</code>, a lista com o quadrado de cada número de <code>range(n)</code>, usando <code>pool.map</code> com um <code>Pool(4)</code>.</p><p>O código inicial já calcula em sequência: passe o trabalho para o Pool, dentro do <code>${MAIN}</code>.</p>`,
    dica: 'with Pool(4) as pool: resultados = pool.map(quadrado, range(n)), tudo dentro do if __name__ == "__main__":.',
    arquivos: main(py`
      from multiprocessing import Pool


      def quadrado(x):
          return x * x


      n = int(input())
      resultados = [quadrado(x) for x in range(n)]
      print(resultados)
    `),
    solucao: main(py`
      from multiprocessing import Pool


      def quadrado(x):
          return x * x


      if __name__ == "__main__":
          n = int(input())
          with Pool(4) as pool:
              resultados = pool.map(quadrado, range(n))
          print(resultados)
    `),
    testes: [
      {
        descricao: 'n = 8',
        entrada: ['8'],
        regras: [
          { variavel: 'resultados', igual: [0, 1, 4, 9, 16, 25, 36, 49] },
          { paralelo: { workers: 2 } },
          { codigo: '__name__', msg: 'O código usa o if __name__ == "__main__":' },
        ],
      },
      { descricao: 'n = 3', oculto: true, entrada: ['3'], regras: [{ variavel: 'resultados', igual: [0, 1, 4] }, { paralelo: { workers: 2 } }] },
    ],
  },
  {
    id: 'pl-sem-main',
    tipo: 'problema',
    titulo: 'Esqueceram o __main__',
    dificuldade: 'facil',
    enunciado: '<p>O código inicial cria o <code>Pool</code> fora do bloco <code>if __name__ == "__main__":</code> e o Python responde com <code>RuntimeError</code>. Conserte: ele lê <code>n</code> e calcula <code>total</code>, a soma do triplo de cada número de <code>range(n)</code>.</p>',
    dica: 'Mova o que vem depois das funções (input, Pool e total) para dentro do if __name__ == "__main__":.',
    arquivos: main(py`
      from multiprocessing import Pool


      def triplo(x):
          return 3 * x


      n = int(input())
      with Pool(4) as pool:
          total = sum(pool.map(triplo, range(n)))
      print(total)
    `),
    solucao: main(py`
      from multiprocessing import Pool


      def triplo(x):
          return 3 * x


      if __name__ == "__main__":
          n = int(input())
          with Pool(4) as pool:
              total = sum(pool.map(triplo, range(n)))
          print(total)
    `),
    testes: [
      { descricao: 'n = 5', entrada: ['5'], regras: [{ semErros: true }, { variavel: 'total', igual: 30 }, { paralelo: { workers: 2 } }] },
      { descricao: 'n = 1', oculto: true, entrada: ['1'], regras: [{ variavel: 'total', igual: 0 }] },
    ],
  },
  {
    id: 'pl-starmap',
    tipo: 'problema',
    titulo: 'starmap',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>k</code> e depois <code>k</code> linhas com <code>base expoente</code>. Calcule <code>potencias</code> com <code>pool.starmap(pow, pares)</code>: o starmap abre cada par em dois argumentos.</p>',
    dica: 'pares = [tuple(map(int, input().split())) for _ in range(k)] e depois pool.starmap(pow, pares).',
    arquivos: main(py`
      from multiprocessing import Pool

      k = int(input())
      pares = [tuple(map(int, input().split())) for _ in range(k)]
      potencias = [pow(base, exp) for base, exp in pares]
      print(potencias)
    `),
    solucao: main(py`
      from multiprocessing import Pool

      if __name__ == "__main__":
          k = int(input())
          pares = [tuple(map(int, input().split())) for _ in range(k)]
          with Pool(4) as pool:
              potencias = pool.starmap(pow, pares)
          print(potencias)
    `),
    testes: [
      {
        descricao: 'três potências',
        entrada: ['3', '2 3', '3 2', '10 0'],
        regras: [{ variavel: 'potencias', igual: [8, 9, 1] }, { paralelo: { workers: 2 } }, { codigo: 'starmap', msg: 'O código usa starmap' }],
      },
      { descricao: 'uma potência', oculto: true, entrada: ['1', '5 2'], regras: [{ variavel: 'potencias', igual: [25] }] },
    ],
  },
  {
    id: 'pl-apply-async',
    tipo: 'problema',
    titulo: 'apply_async',
    dificuldade: 'medio',
    enunciado: '<p>Leia números numa linha e calcule <code>fatoriais</code>: para cada número, mande <code>math.factorial</code> ao pool com <code>apply_async</code> e depois junte os resultados com <code>.get()</code>, na mesma ordem.</p>',
    dica: 'pendentes = [pool.apply_async(math.factorial, (n,)) for n in numeros]; fatoriais = [p.get() for p in pendentes].',
    arquivos: main(py`
      import math
      from multiprocessing import Pool

      numeros = list(map(int, input().split()))
      fatoriais = [math.factorial(n) for n in numeros]
      print(fatoriais)
    `),
    solucao: main(py`
      import math
      from multiprocessing import Pool

      if __name__ == "__main__":
          numeros = list(map(int, input().split()))
          with Pool(4) as pool:
              pendentes = [pool.apply_async(math.factorial, (n,)) for n in numeros]
              fatoriais = [p.get() for p in pendentes]
          print(fatoriais)
    `),
    testes: [
      {
        descricao: '5, 3 e 0',
        entrada: ['5 3 0'],
        regras: [{ variavel: 'fatoriais', igual: [120, 6, 1] }, { paralelo: { workers: 2 } }, { codigo: 'apply_async', msg: 'O código usa apply_async' }],
      },
      { descricao: 'um número', oculto: true, entrada: ['10'], regras: [{ variavel: 'fatoriais', igual: [3628800] }, { paralelo: { workers: 1 } }] },
    ],
  },
  {
    id: 'pl-imap',
    tipo: 'problema',
    titulo: 'imap na ordem',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>n</code> e, para cada número de 1 a <code>n</code>, mostre <code>x → cubo</code>, recebendo os cubos com <code>pool.imap(cubo, ...)</code>, que entrega os resultados na ordem, um de cada vez.</p>',
    dica: 'for x, c in zip(numeros, pool.imap(cubo, numeros)): print(f"{x} → {c}")',
    arquivos: main(py`
      from multiprocessing import Pool


      def cubo(x):
          return x ** 3


      n = int(input())
      for x in range(1, n + 1):
          print(f"{x} → {cubo(x)}")
    `),
    solucao: main(py`
      from multiprocessing import Pool


      def cubo(x):
          return x ** 3


      if __name__ == "__main__":
          n = int(input())
          numeros = range(1, n + 1)
          with Pool(4) as pool:
              for x, c in zip(numeros, pool.imap(cubo, numeros)):
                  print(f"{x} → {c}")
    `),
    testes: [
      { descricao: 'até 3', entrada: ['3'], regras: [{ saidaIgual: '1 → 1\n2 → 8\n3 → 27' }, { paralelo: { workers: 2 } }, { codigo: 'imap', msg: 'O código usa imap' }] },
      { descricao: 'até 1', oculto: true, entrada: ['1'], regras: [{ saidaIgual: '1 → 1' }, { paralelo: { workers: 1 } }] },
    ],
  },
  {
    id: 'pl-primos-paralelo',
    tipo: 'problema',
    titulo: 'Primos em paralelo',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>n</code> e conte quantos números primos há em <code>range(n)</code>, em paralelo: divida <code>0..n</code> em 4 intervalos (como no exercício "Intervalos de trabalho"), conte os primos de cada intervalo com <code>pool.map(contar_primos, intervalos)</code> e guarde a soma em <code>total</code>.</p>',
    dica: 'contar_primos recebe um intervalo [inicio, fim) e testa cada número; total = sum(pool.map(contar_primos, intervalos(n, 4))).',
    arquivos: main(py`
      from multiprocessing import Pool


      def eh_primo(x):
          if x < 2:
              return False
          return all(x % d for d in range(2, int(x ** 0.5) + 1))


      n = int(input())
      total = sum(1 for x in range(n) if eh_primo(x))
      print(total)
    `),
    solucao: main(py`
      from multiprocessing import Pool


      def eh_primo(x):
          if x < 2:
              return False
          return all(x % d for d in range(2, int(x ** 0.5) + 1))


      def contar_primos(intervalo):
          inicio, fim = intervalo
          return sum(1 for x in range(inicio, fim) if eh_primo(x))


      def intervalos(total, n):
          base, extra = divmod(total, n)
          resultado, inicio = [], 0
          for i in range(n):
              fim = inicio + base + (1 if i < extra else 0)
              resultado.append((inicio, fim))
              inicio = fim
          return resultado


      if __name__ == "__main__":
          n = int(input())
          with Pool(4) as pool:
              total = sum(pool.map(contar_primos, intervalos(n, 4)))
          print(total)
    `),
    testes: [
      { descricao: 'até 100', entrada: ['100'], regras: [{ variavel: 'total', igual: 25 }, { paralelo: { workers: 2 } }] },
      { descricao: 'até 10 e até 2', oculto: true, entrada: ['10'], regras: [{ variavel: 'total', igual: 4 }] },
      { descricao: 'até 2', oculto: true, entrada: ['2'], regras: [{ variavel: 'total', igual: 0 }] },
    ],
  },
];

export const moduloParalelismo = {
  id: 'paralelismo',
  titulo: 'Paralelismo',
  icone: '⚡',
  descricao: 'Dividir o trabalho, map-reduce, partições, processos (Pool e ProcessPoolExecutor), asyncio, condições de corrida, speedup e Lei de Amdahl.',
  itens: [
    licoes.dividir,
    exerciciosDividir[0], exerciciosDividir[1],
    licoes.particoes,
    exerciciosDividir[2], exerciciosDividir[3], exerciciosDividir[7],
    licoes.mapReduce,
    exerciciosDividir[4], exerciciosDividir[5], exerciciosDividir[6],
    licoes.speedup,
    exerciciosDividir[8], exerciciosDividir[9], exerciciosDividir[10],
    licoes.processos,
    ...exerciciosPool,
    licoes.futures,
    licoes.processoFila,
    licoes.asyncio,
    licoes.corrida,
    licoes.gilThreads,
  ],
};
