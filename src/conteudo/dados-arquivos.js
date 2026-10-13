// 📊 Python para dados, segunda metade: CSV, JSON, datas, geradores, map/filter/reduce
// e itertools (exercícios 21 a 40). Os arquivos de entrada ficam em `dados` (aba 📦 Dados);
// os casos ocultos trocam esses arquivos por outros, para a resposta não ficar "decorada".
import { py, main } from './util.js';

/** Código inicial de função com imports: só a assinatura, que devolve None. */
const comImports = (imports, ...defs) => main(`${imports}\n${defs.map((d) => `\n\ndef ${d}:\n    pass\n`).join('')}`);

const PEDIDOS = JSON.stringify([
  { cliente: 'Bia', itens: [{ produto: 'Café', preco: 19.9, qtd: 2 }] },
  { cliente: 'Ana', itens: [{ produto: 'Arroz', preco: 24.9, qtd: 1 }, { produto: 'Feijão', preco: 8.5, qtd: 2 }] },
  { cliente: 'Bia', itens: [{ produto: 'Milho', preco: 3, qtd: 1 }] },
]);

export const exerciciosCsv = [
  {
    id: 'dd-csv-total',
    tipo: 'problema',
    titulo: 'Total das vendas',
    dificuldade: 'facil',
    enunciado: '<p>Leia <code>vendas.csv</code> (aba 📦 Dados), com as colunas <code>produto,quantidade,preco_unitario</code>, e mostre <code>Total: </code> seguido da soma de quantidade × preço, com 2 casas.</p><p>Exemplo de saída: <code>Total: 95.20</code>.</p>',
    dica: 'csv.DictReader devolve textos: converta a quantidade com int() e o preço com float(). Formate com f"{total:.2f}".',
    dados: { 'vendas.csv': 'produto,quantidade,preco_unitario\nArroz 5kg,2,24.90\nFeijão 1kg,3,8.50\nCafé 500g,1,19.90\n' },
    arquivos: main(py`
      import csv

      # Leia vendas.csv e mostre o total
    `),
    solucao: main(py`
      import csv

      total = 0
      with open("vendas.csv", newline="") as arquivo:
          for linha in csv.DictReader(arquivo):
              total += int(linha["quantidade"]) * float(linha["preco_unitario"])
      print(f"Total: {total:.2f}")
    `),
    testes: [
      { descricao: 'vendas do exemplo', regras: [{ saidaIgual: 'Total: 95.20' }, { codigo: 'csv\\.', msg: 'O código usa o módulo csv' }] },
      { descricao: 'outras vendas', oculto: true, dados: { 'vendas.csv': 'produto,quantidade,preco_unitario\nFarinha de mandioca,4,6.75\nRapadura,10,2.50\n' }, regras: [{ saidaIgual: 'Total: 52.00' }] },
      { descricao: 'sem vendas', oculto: true, dados: { 'vendas.csv': 'produto,quantidade,preco_unitario\n' }, regras: [{ saidaIgual: 'Total: 0.00' }] },
    ],
  },
  {
    id: 'dd-csv-por-regiao',
    tipo: 'problema',
    titulo: 'Vendas por região',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>vendas.csv</code> (colunas <code>regiao,valor</code>) e mostre o total de cada região no formato <code>Região: total</code>, com 2 casas, com as regiões em ordem alfabética.</p>',
    dica: 'Some num defaultdict(float) e depois percorra sorted(totais).',
    dados: { 'vendas.csv': 'regiao,valor\nNordeste,1000.50\nSudeste,800\nNordeste,499.50\nNorte,120\n' },
    arquivos: main(py`
      import csv
      from collections import defaultdict

      # Leia vendas.csv e mostre o total por região
    `),
    solucao: main(py`
      import csv
      from collections import defaultdict

      totais = defaultdict(float)
      with open("vendas.csv", newline="") as arquivo:
          for linha in csv.DictReader(arquivo):
              totais[linha["regiao"]] += float(linha["valor"])
      for regiao in sorted(totais):
          print(f"{regiao}: {totais[regiao]:.2f}")
    `),
    testes: [
      { descricao: 'quatro vendas', regras: [{ saidaIgual: 'Nordeste: 1500.00\nNorte: 120.00\nSudeste: 800.00' }] },
      { descricao: 'outras regiões', oculto: true, dados: { 'vendas.csv': 'regiao,valor\nSul,10\nCentro-Oeste,5.25\nSul,0.75\n' }, regras: [{ saidaIgual: 'Centro-Oeste: 5.25\nSul: 10.75' }] },
    ],
  },
  {
    id: 'dd-csv-aprovados',
    tipo: 'problema',
    titulo: 'Gravar os aprovados',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>alunos.csv</code> (colunas <code>nome,nota</code>) e <b>grave</b> <code>aprovados.csv</code> com o mesmo cabeçalho e só as linhas com nota maior ou igual a 7, na mesma ordem. Copie a nota como está no arquivo.</p>',
    dica: 'Abra o arquivo novo com open("aprovados.csv", "w", newline="") e use csv.writer: writerow(["nome", "nota"]) e uma linha por aprovado.',
    dados: { 'alunos.csv': 'nome,nota\nAna,8.5\nBia,6\nCaio,7\n' },
    arquivos: main(py`
      import csv

      # Leia alunos.csv e grave aprovados.csv
    `),
    solucao: main(py`
      import csv

      with open("alunos.csv", newline="") as entrada:
          alunos = list(csv.DictReader(entrada))

      with open("aprovados.csv", "w", newline="") as saida:
          escritor = csv.writer(saida)
          escritor.writerow(["nome", "nota"])
          for aluno in alunos:
              if float(aluno["nota"]) >= 7:
                  escritor.writerow([aluno["nome"], aluno["nota"]])
    `),
    testes: [
      { descricao: 'Ana, Bia e Caio', regras: [{ arquivo: 'aprovados.csv', igual: 'nome,nota\nAna,8.5\nCaio,7' }] },
      { descricao: 'ninguém aprovado', oculto: true, dados: { 'alunos.csv': 'nome,nota\nDavi,6.9\n' }, regras: [{ arquivo: 'aprovados.csv', igual: 'nome,nota' }] },
      { descricao: 'nomes com acento', oculto: true, dados: { 'alunos.csv': 'nome,nota\nJosé,9.0\nÍris,10\n' }, regras: [{ arquivo: 'aprovados.csv', igual: 'nome,nota\nJosé,9.0\nÍris,10' }] },
    ],
  },
  {
    id: 'dd-csv-media-coluna',
    tipo: 'problema',
    titulo: 'Média de uma coluna',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>media_coluna(caminho, coluna)</code>, que abre o CSV, calcula a média da coluna pedida e devolve com 2 casas.</p><p>Com o <code>notas.csv</code> da aba 📦 Dados, <code>media_coluna("notas.csv", "matematica")</code> devolve <code>8.0</code>.</p>',
    dica: 'Monte a lista com [float(linha[coluna]) for linha in csv.DictReader(arquivo)] e divida a soma pelo tamanho.',
    dados: { 'notas.csv': 'aluno,matematica,portugues\nAna,8,9.5\nBia,7,6\nCaio,9,8\n' },
    arquivos: comImports('import csv', 'media_coluna(caminho, coluna)'),
    solucao: main(py`
      import csv


      def media_coluna(caminho, coluna):
          with open(caminho, newline="") as arquivo:
              valores = [float(linha[coluna]) for linha in csv.DictReader(arquivo)]
          return round(sum(valores) / len(valores), 2)
    `),
    testes: [
      {
        descricao: 'matemática e português',
        regras: [
          { funcao: 'media_coluna', args: ['notas.csv', 'matematica'], igual: 8 },
          { funcao: 'media_coluna', args: ['notas.csv', 'portugues'], igual: 7.83 },
        ],
      },
      {
        descricao: 'outra turma',
        oculto: true,
        dados: { 'notas.csv': 'aluno,matematica,portugues\nDavi,10,4\nEva,5,5\n' },
        regras: [
          { funcao: 'media_coluna', args: ['notas.csv', 'matematica'], igual: 7.5 },
          { funcao: 'media_coluna', args: ['notas.csv', 'portugues'], igual: 4.5 },
        ],
      },
    ],
  },
  {
    id: 'dd-csv-invalidas',
    tipo: 'problema',
    titulo: 'Linhas inválidas',
    dificuldade: 'dificil',
    enunciado: '<p>O arquivo <code>leituras.csv</code> <b>não tem cabeçalho</b>: cada linha é <code>sensor,valor</code>. Escreva <code>linhas_invalidas(caminho)</code>, que conta as linhas com algum campo vazio ou com um valor que não é número. Linhas totalmente vazias não contam.</p>',
    dica: 'Use csv.reader (sem cabeçalho). Pule as linhas vazias ([]); para saber se é número, tente float() dentro de try/except.',
    dados: { 'leituras.csv': 's1,22.5\ns2,\ns3,abc\ns4,19\n' },
    arquivos: comImports('import csv', 'linhas_invalidas(caminho)'),
    solucao: main(py`
      import csv


      def eh_numero(texto):
          try:
              float(texto)
              return True
          except ValueError:
              return False


      def linhas_invalidas(caminho):
          invalidas = 0
          with open(caminho, newline="") as arquivo:
              for linha in csv.reader(arquivo):
                  if not linha:
                      continue
                  campos = [c.strip() for c in linha]
                  if len(campos) < 2 or "" in campos or not eh_numero(campos[1]):
                      invalidas += 1
          return invalidas
    `),
    testes: [
      { descricao: 'quatro leituras', regras: [{ funcao: 'linhas_invalidas', args: ['leituras.csv'], igual: 2 }] },
      { descricao: 'tudo certo', oculto: true, dados: { 'leituras.csv': 's1,1\n' }, regras: [{ funcao: 'linhas_invalidas', args: ['leituras.csv'], igual: 0 }] },
      { descricao: 'vazios e linha em branco', oculto: true, dados: { 'leituras.csv': ',\n\nx,1\n' }, regras: [{ funcao: 'linhas_invalidas', args: ['leituras.csv'], igual: 1 }] },
    ],
  },
];

export const exerciciosJson = [
  {
    id: 'dd-json-pedidos',
    tipo: 'problema',
    titulo: 'Total por cliente',
    dificuldade: 'medio',
    enunciado: '<p>Leia <code>pedidos.json</code> (aba 📦 Dados): uma lista de pedidos, cada um com <code>cliente</code> e <code>itens</code> (<code>produto</code>, <code>preco</code>, <code>qtd</code>). Mostre <code>Cliente: total</code>, com 2 casas, com os clientes em ordem alfabética.</p>',
    dica: 'json.load(arquivo) devolve a lista. Some preco * qtd de cada item num defaultdict(float) por cliente.',
    dados: { 'pedidos.json': PEDIDOS },
    arquivos: main(py`
      import json

      # Leia pedidos.json e mostre o total de cada cliente
    `),
    solucao: main(py`
      import json
      from collections import defaultdict

      with open("pedidos.json") as arquivo:
          pedidos = json.load(arquivo)

      totais = defaultdict(float)
      for pedido in pedidos:
          totais[pedido["cliente"]] += sum(item["preco"] * item["qtd"] for item in pedido["itens"])
      for cliente in sorted(totais):
          print(f"{cliente}: {totais[cliente]:.2f}")
    `),
    testes: [
      { descricao: 'três pedidos', regras: [{ saidaIgual: 'Ana: 41.90\nBia: 42.80' }, { codigo: 'json\\.', msg: 'O código usa o módulo json' }] },
      { descricao: 'sem pedidos', oculto: true, dados: { 'pedidos.json': '[]' }, regras: [{ saidaIgual: '' }] },
      { descricao: 'pedido sem itens', oculto: true, dados: { 'pedidos.json': '[{"cliente": "Zé", "itens": []}]' }, regras: [{ saidaIgual: 'Zé: 0.00' }] },
    ],
  },
  {
    id: 'dd-json-resumo',
    tipo: 'problema',
    titulo: 'Gravar um resumo',
    dificuldade: 'dificil',
    enunciado: '<p>Leia <code>pedidos.json</code> e <b>grave</b> <code>resumo.json</code> com três chaves:</p><ul><li><code>total_pedidos</code>: quantos pedidos há;</li><li><code>clientes</code>: os clientes, sem repetir, em ordem alfabética;</li><li><code>faturamento</code>: a soma de <code>preco * qtd</code> de todos os itens, com 2 casas.</li></ul>',
    dica: 'Monte um dicionário e grave com json.dump(resumo, arquivo, ensure_ascii=False, indent=2). sorted({p["cliente"] for p in pedidos}) tira os repetidos.',
    dados: { 'pedidos.json': PEDIDOS },
    arquivos: main(py`
      import json

      # Leia pedidos.json e grave resumo.json
    `),
    solucao: main(py`
      import json

      with open("pedidos.json") as arquivo:
          pedidos = json.load(arquivo)

      faturamento = sum(item["preco"] * item["qtd"] for pedido in pedidos for item in pedido["itens"])
      resumo = {
          "total_pedidos": len(pedidos),
          "clientes": sorted({pedido["cliente"] for pedido in pedidos}),
          "faturamento": round(faturamento, 2),
      }
      with open("resumo.json", "w") as arquivo:
          json.dump(resumo, arquivo, ensure_ascii=False, indent=2)
    `),
    testes: [
      { descricao: 'três pedidos', regras: [{ arquivo: 'resumo.json', json: { total_pedidos: 3, clientes: ['Ana', 'Bia'], faturamento: 84.7 } }] },
      { descricao: 'sem pedidos', oculto: true, dados: { 'pedidos.json': '[]' }, regras: [{ arquivo: 'resumo.json', json: { total_pedidos: 0, clientes: [], faturamento: 0 } }] },
    ],
  },
  {
    id: 'dd-json-caminho',
    tipo: 'problema',
    titulo: 'Navegar no JSON',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>valor(dados, caminho)</code>: o caminho tem partes separadas por ponto, e uma parte com número é a posição numa lista. Se o caminho não existir, devolva <code>None</code>.</p><p><code>valor({"a": {"b": [10, 20]}}, "a.b.1")</code> devolve <code>20</code>.</p>',
    dica: 'Ande parte por parte: em lista, use int(parte) se couber; em dicionário, a chave se existir; senão, devolva None.',
    arquivos: comImports('# dados é um dicionário (como o que o json.load devolve)', 'valor(dados, caminho)'),
    solucao: main(py`
      def valor(dados, caminho):
          atual = dados
          for parte in caminho.split("."):
              if isinstance(atual, list) and parte.isdigit() and int(parte) < len(atual):
                  atual = atual[int(parte)]
              elif isinstance(atual, dict) and parte in atual:
                  atual = atual[parte]
              else:
                  return None
          return atual
    `),
    testes: [
      { descricao: 'a.b.1', regras: [{ funcao: 'valor', args: [{ a: { b: [10, 20] } }, 'a.b.1'], igual: 20 }] },
      {
        descricao: 'chave que falta, lista e posição que falta',
        oculto: true,
        regras: [
          { funcao: 'valor', args: [{ x: 1 }, 'y'], igual: null },
          { funcao: 'valor', args: [{ lista: [{ nome: 'Ana' }] }, 'lista.0.nome'], igual: 'Ana' },
          { funcao: 'valor', args: [{ a: [1] }, 'a.5'], igual: null },
        ],
      },
    ],
  },
  {
    id: 'dd-json-valido',
    tipo: 'problema',
    titulo: 'JSON válido?',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>eh_json_valido(texto)</code>, que devolve <code>True</code> se o texto é um JSON válido. Use <code>try/except</code>.</p>',
    dica: 'json.loads(texto) levanta json.JSONDecodeError quando o texto não é JSON.',
    arquivos: comImports('import json', 'eh_json_valido(texto)'),
    solucao: main(py`
      import json


      def eh_json_valido(texto):
          try:
              json.loads(texto)
              return True
          except json.JSONDecodeError:
              return False
    `),
    testes: [
      {
        descricao: 'válido e inválido',
        regras: [
          { funcao: 'eh_json_valido', args: ['{"a": 1}'], igual: true },
          { funcao: 'eh_json_valido', args: ['{a: 1}'], igual: false },
          { codigo: 'except', msg: 'O código usa try/except' },
        ],
      },
      { descricao: 'vazio e lista', oculto: true, regras: [{ funcao: 'eh_json_valido', args: [''], igual: false }, { funcao: 'eh_json_valido', args: ['[1, 2]'], igual: true }] },
    ],
  },
];

export const exerciciosDatas = [
  {
    id: 'dd-idade',
    tipo: 'problema',
    titulo: 'Idade',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>idade(nascimento, hoje)</code>, com as datas no formato <code>AAAA-MM-DD</code>, que devolve a idade em anos completos.</p><p><code>idade("2000-10-13", "2026-10-13")</code> devolve <code>26</code>.</p>',
    dica: 'Subtraia os anos e tire 1 se o aniversário ainda não chegou: (hoje.month, hoje.day) < (nasc.month, nasc.day).',
    arquivos: comImports('from datetime import date', 'idade(nascimento, hoje)'),
    solucao: main(py`
      from datetime import date


      def idade(nascimento, hoje):
          n = date.fromisoformat(nascimento)
          h = date.fromisoformat(hoje)
          anos = h.year - n.year
          if (h.month, h.day) < (n.month, n.day):
              anos -= 1
          return anos
    `),
    testes: [
      { descricao: 'no dia do aniversário', regras: [{ funcao: 'idade', args: ['2000-10-13', '2026-10-13'], igual: 26 }] },
      {
        descricao: 'véspera e 29 de fevereiro',
        oculto: true,
        regras: [
          { funcao: 'idade', args: ['2000-10-14', '2026-10-13'], igual: 25 },
          { funcao: 'idade', args: ['2004-02-29', '2025-02-28'], igual: 20 },
        ],
      },
    ],
  },
  {
    id: 'dd-dias-entre',
    tipo: 'problema',
    titulo: 'Dias entre datas',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>dias_entre(a, b)</code>, que devolve quantos dias há entre as duas datas (<code>AAAA-MM-DD</code>), sempre positivo.</p>',
    dica: 'A subtração de duas datas dá um timedelta; use .days e abs().',
    arquivos: comImports('from datetime import date', 'dias_entre(a, b)'),
    solucao: main(py`
      from datetime import date


      def dias_entre(a, b):
          return abs((date.fromisoformat(b) - date.fromisoformat(a)).days)
    `),
    testes: [
      { descricao: 'janeiro a março', regras: [{ funcao: 'dias_entre', args: ['2026-01-01', '2026-03-01'], igual: 59 }] },
      { descricao: 'ano bissexto ao contrário e mesmo dia', oculto: true, regras: [{ funcao: 'dias_entre', args: ['2024-03-01', '2024-02-01'], igual: 29 }, { funcao: 'dias_entre', args: ['2026-10-13', '2026-10-13'], igual: 0 }] },
    ],
  },
  {
    id: 'dd-data-extenso',
    tipo: 'problema',
    titulo: 'Data por extenso',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>por_extenso(iso)</code>, que devolve o dia da semana em português e a data: <code>por_extenso("2026-10-13")</code> devolve <code>"terça-feira, 13/10/2026"</code>.</p>',
    dica: 'weekday() vai de 0 (segunda) a 6 (domingo): use uma lista com os nomes em português. strftime("%d/%m/%Y") formata a data.',
    arquivos: comImports('from datetime import date', 'por_extenso(iso)'),
    solucao: main(py`
      from datetime import date

      DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]


      def por_extenso(iso):
          d = date.fromisoformat(iso)
          return f"{DIAS[d.weekday()]}, {d.strftime('%d/%m/%Y')}"
    `),
    testes: [
      { descricao: '13/10/2026', regras: [{ funcao: 'por_extenso', args: ['2026-10-13'], igual: 'terça-feira, 13/10/2026' }] },
      { descricao: 'sábados', oculto: true, regras: [{ funcao: 'por_extenso', args: ['2026-10-17'], igual: 'sábado, 17/10/2026' }, { funcao: 'por_extenso', args: ['2000-01-01'], igual: 'sábado, 01/01/2000' }] },
    ],
  },
  {
    id: 'dd-contas-vencidas',
    tipo: 'problema',
    titulo: 'Contas vencidas',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>vencidas(contas, hoje)</code>: <code>contas</code> é uma lista de <code>[nome, vencimento]</code> (datas <code>AAAA-MM-DD</code>). Devolva os nomes das contas que venceram antes de <code>hoje</code>, da mais antiga para a mais nova (no mesmo dia, em ordem alfabética).</p>',
    dica: 'Datas AAAA-MM-DD em texto já comparam na ordem certa. Ordene por (vencimento, nome) e filtre vencimento < hoje.',
    arquivos: comImports('# As datas vêm como texto AAAA-MM-DD', 'vencidas(contas, hoje)'),
    solucao: main(py`
      def vencidas(contas, hoje):
          return [nome for nome, venc in sorted(contas, key=lambda c: (c[1], c[0])) if venc < hoje]
    `),
    testes: [
      {
        descricao: 'três contas',
        regras: [{ funcao: 'vencidas', args: [[['luz', '2026-10-10'], ['água', '2026-10-20'], ['internet', '2026-10-01']], '2026-10-13'], igual: ['internet', 'luz'] }],
      },
      {
        descricao: 'sem contas e mesmo dia',
        oculto: true,
        regras: [
          { funcao: 'vencidas', args: [[], '2026-01-01'], igual: [] },
          { funcao: 'vencidas', args: [[['b', '2026-01-01'], ['a', '2026-01-01']], '2026-01-02'], igual: ['a', 'b'] },
        ],
      },
    ],
  },
  {
    id: 'dd-dia-util',
    tipo: 'problema',
    titulo: 'Próximo dia útil',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>proximo_dia_util(iso)</code>: se a data cair no sábado ou no domingo, devolva a segunda-feira seguinte; senão, a própria data (sempre no formato <code>AAAA-MM-DD</code>).</p>',
    dica: 'weekday() 5 é sábado e 6 é domingo: some timedelta(days=7 - weekday()). isoformat() volta para texto.',
    arquivos: comImports('from datetime import date, timedelta', 'proximo_dia_util(iso)'),
    solucao: main(py`
      from datetime import date, timedelta


      def proximo_dia_util(iso):
          d = date.fromisoformat(iso)
          if d.weekday() >= 5:
              d += timedelta(days=7 - d.weekday())
          return d.isoformat()
    `),
    testes: [
      { descricao: 'sábado', regras: [{ funcao: 'proximo_dia_util', args: ['2026-10-17'], igual: '2026-10-19' }] },
      { descricao: 'domingo e terça', oculto: true, regras: [{ funcao: 'proximo_dia_util', args: ['2026-10-18'], igual: '2026-10-19' }, { funcao: 'proximo_dia_util', args: ['2026-10-13'], igual: '2026-10-13' }] },
    ],
  },
];

export const exerciciosGeradores = [
  {
    id: 'dd-gerador-pares',
    tipo: 'problema',
    titulo: 'Gerador de pares',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>pares(limite)</code>, um <b>gerador</b> (com <code>yield</code>) dos números pares de 0 até <code>limite</code>, inclusive.</p><p><code>list(pares(6))</code> dá <code>[0, 2, 4, 6]</code>.</p>',
    dica: 'for n in range(0, limite + 1, 2): yield n',
    arquivos: comImports('# Use yield', 'pares(limite)'),
    solucao: main(py`
      def pares(limite):
          for n in range(0, limite + 1, 2):
              yield n
    `),
    testes: [
      { descricao: 'até 6', regras: [{ funcao: 'pares', args: [6], igual: [0, 2, 4, 6] }, { codigo: 'yield', msg: 'O código usa yield' }] },
      { descricao: 'zero, negativo e ímpar', oculto: true, regras: [{ funcao: 'pares', args: [0], igual: [0] }, { funcao: 'pares', args: [-1], igual: [] }, { funcao: 'pares', args: [7], igual: [0, 2, 4, 6] }] },
    ],
  },
  {
    id: 'dd-lotes',
    tipo: 'problema',
    titulo: 'Em lotes',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>lotes(itens, tamanho)</code>, um gerador que entrega listas com até <code>tamanho</code> itens, na ordem.</p><p><code>list(lotes([1, 2, 3, 4, 5], 2))</code> dá <code>[[1, 2], [3, 4], [5]]</code>.</p>',
    dica: 'for i in range(0, len(itens), tamanho): yield itens[i:i + tamanho]',
    arquivos: comImports('# Use yield', 'lotes(itens, tamanho)'),
    solucao: main(py`
      def lotes(itens, tamanho):
          for i in range(0, len(itens), tamanho):
              yield itens[i:i + tamanho]
    `),
    testes: [
      { descricao: 'cinco itens em lotes de 2', regras: [{ funcao: 'lotes', args: [[1, 2, 3, 4, 5], 2], igual: [[1, 2], [3, 4], [5]] }, { codigo: 'yield', msg: 'O código usa yield' }] },
      { descricao: 'vazia e lote maior', oculto: true, regras: [{ funcao: 'lotes', args: [[], 3], igual: [] }, { funcao: 'lotes', args: [[1, 2], 5], igual: [[1, 2]] }] },
    ],
  },
  {
    id: 'dd-fibonacci',
    tipo: 'problema',
    titulo: 'Fibonacci sem fim',
    dificuldade: 'dificil',
    enunciado: '<p>Escreva <code>fibonacci()</code>, um gerador <b>infinito</b> da sequência 0, 1, 1, 2, 3, 5, …, e <code>primeiros(n)</code>, que devolve a lista com os <code>n</code> primeiros usando <code>itertools.islice</code>.</p>',
    dica: 'a, b = 0, 1; while True: yield a; a, b = b, a + b. Em primeiros: list(islice(fibonacci(), n)).',
    arquivos: comImports('from itertools import islice', 'fibonacci()', 'primeiros(n)'),
    solucao: main(py`
      from itertools import islice


      def fibonacci():
          a, b = 0, 1
          while True:
              yield a
              a, b = b, a + b


      def primeiros(n):
          return list(islice(fibonacci(), n))
    `),
    testes: [
      {
        descricao: 'os 8 primeiros',
        regras: [
          { funcao: 'primeiros', args: [8], igual: [0, 1, 1, 2, 3, 5, 8, 13] },
          { codigo: 'yield', msg: 'O código usa yield' },
          { codigo: 'islice', msg: 'O código usa islice' },
        ],
      },
      { descricao: 'zero e um', oculto: true, regras: [{ funcao: 'primeiros', args: [0], igual: [] }, { funcao: 'primeiros', args: [1], igual: [0] }] },
    ],
  },
];

export const exerciciosFuncional = [
  {
    id: 'dd-map-filter',
    tipo: 'problema',
    titulo: 'Positivos em dobro',
    dificuldade: 'facil',
    enunciado: '<p>Escreva <code>positivos_dobrados(numeros)</code>, que fica só com os números maiores que zero e devolve o dobro de cada um, usando <code>filter</code> e <code>map</code>.</p>',
    dica: 'list(map(lambda x: x * 2, filter(lambda x: x > 0, numeros)))',
    arquivos: comImports('# Use filter e map', 'positivos_dobrados(numeros)'),
    solucao: main(py`
      def positivos_dobrados(numeros):
          return list(map(lambda x: x * 2, filter(lambda x: x > 0, numeros)))
    `),
    testes: [
      {
        descricao: 'quatro números',
        regras: [
          { funcao: 'positivos_dobrados', args: [[3, -1, 0, 5]], igual: [6, 10] },
          { codigo: 'map\\(', msg: 'O código usa map' },
          { codigo: 'filter\\(', msg: 'O código usa filter' },
        ],
      },
      { descricao: 'vazia, negativo e decimal', oculto: true, regras: [{ funcao: 'positivos_dobrados', args: [[]], igual: [] }, { funcao: 'positivos_dobrados', args: [[-2]], igual: [] }, { funcao: 'positivos_dobrados', args: [[0.5]], igual: [1] }] },
    ],
  },
  {
    id: 'dd-reduce',
    tipo: 'problema',
    titulo: 'Produto com reduce',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>produto(lista)</code>, que multiplica todos os números usando <code>functools.reduce</code>. Para a lista vazia, devolva 1.</p>',
    dica: 'reduce(lambda a, b: a * b, lista, 1): o 1 é o valor de partida.',
    arquivos: comImports('from functools import reduce', 'produto(lista)'),
    solucao: main(py`
      from functools import reduce


      def produto(lista):
          return reduce(lambda a, b: a * b, lista, 1)
    `),
    testes: [
      { descricao: '2 × 3 × 4', regras: [{ funcao: 'produto', args: [[2, 3, 4]], igual: 24 }, { codigo: 'reduce\\(', msg: 'O código usa reduce' }] },
      { descricao: 'vazia e um número', oculto: true, regras: [{ funcao: 'produto', args: [[]], igual: 1 }, { funcao: 'produto', args: [[5]], igual: 5 }] },
    ],
  },
  {
    id: 'dd-duplas',
    tipo: 'problema',
    titulo: 'Todas as duplas',
    dificuldade: 'medio',
    enunciado: '<p>Escreva <code>duplas(nomes)</code>, que devolve cada dupla possível como <code>"Ana &amp; Bia"</code>, na ordem da lista, usando <code>itertools.combinations</code>.</p>',
    dica: '[f"{a} & {b}" for a, b in combinations(nomes, 2)]',
    arquivos: comImports('from itertools import combinations', 'duplas(nomes)'),
    solucao: main(py`
      from itertools import combinations


      def duplas(nomes):
          return [f"{a} & {b}" for a, b in combinations(nomes, 2)]
    `),
    testes: [
      { descricao: 'três nomes', regras: [{ funcao: 'duplas', args: [['Ana', 'Bia', 'Caio']], igual: ['Ana & Bia', 'Ana & Caio', 'Bia & Caio'] }, { codigo: 'combinations', msg: 'O código usa combinations' }] },
      { descricao: 'um nome e nenhum', oculto: true, regras: [{ funcao: 'duplas', args: [['Zé']], igual: [] }, { funcao: 'duplas', args: [[]], igual: [] }] },
    ],
  },
];
