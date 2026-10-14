// 🐍 Python básico: variáveis, tipos, strings, condições, laços, funções, listas,
// dicionários e exceções. Lições (tipo 'licao') e problemas (tipo 'problema').
// O código fica no template `py`, que tira a indentação comum (veja util.js).
import { py, main, assinatura } from './util.js';
import { exerciciosListas, exerciciosDicionarios, exerciciosExcecoes } from './basico-colecoes.js';

const tabuada = (n) => Array.from({ length: 10 }, (_, i) => `${n} x ${i + 1} = ${n * (i + 1)}`).join('\n');
const fizzbuzz = (n) => Array.from({ length: n }, (_, i) => {
  const v = i + 1;
  return v % 15 === 0 ? 'FizzBuzz' : v % 3 === 0 ? 'Fizz' : v % 5 === 0 ? 'Buzz' : String(v);
});

export const moduloBasico = {
  id: 'basico',
  titulo: 'Python básico',
  icone: '🐍',
  descricao: 'Variáveis, tipos, condições, laços, funções, listas, dicionários e exceções.',
  itens: [
    {
      id: 'licao-ola',
      tipo: 'licao',
      titulo: 'Olá, Python',
      resumo: `
        <p>Em Python, <code>print</code> mostra um texto no terminal. Textos ficam entre aspas.</p>
        <p>O <code>print</code> também faz contas: <code>print(2 + 3)</code> mostra <code>5</code>.
          Pense nele como o alto-falante do programa: tudo o que você quer que apareça passa por ele.</p>
        <p>Clique em <b>▶ Executar</b> e veja a saída na aba 🖥️ Terminal.</p>`,
      arquivos: main(py`
        print("Olá, Sertão!")
        print(2 + 3)
      `),
    },
    {
      id: 'licao-variaveis',
      tipo: 'licao',
      titulo: 'Variáveis e tipos',
      resumo: `
        <p>Uma <b>variável</b> é um nome que guarda um valor: <code>idade = 30</code>.
          É como uma etiqueta colada numa caixa: o nome fica, o conteúdo pode mudar.</p>
        <p>Cada valor tem um <b>tipo</b>: texto (<code>str</code>), número inteiro (<code>int</code>),
          número com vírgula (<code>float</code>, escrito com ponto: <code>1.65</code>) e verdadeiro/falso (<code>bool</code>).</p>
        <p><code>type(valor)</code> diz o tipo. Rode o código e compare.</p>`,
      arquivos: main(py`
        nome = "Ana"
        idade = 30
        altura = 1.65
        estudante = True
        print(nome, type(nome))
        print(idade, type(idade))
        print(altura, type(altura))
        print(estudante, type(estudante))
        idade = idade + 1
        print("Ano que vem:", idade)
      `),
    },
    {
      id: 'py-ola',
      tipo: 'problema',
      titulo: 'Olá, Sertão!',
      dificuldade: 'facil',
      enunciado: '<p>Mostre exatamente <code>Olá, Sertão!</code> no terminal.</p>',
      dica: 'print("texto") mostra o texto. Acentos e pontuação contam.',
      arquivos: main(py`
        # Escreva o seu código aqui
      `),
      solucao: main(py`
        print("Olá, Sertão!")
      `),
      testes: [
        { descricao: 'saída', regras: [{ saidaIgual: 'Olá, Sertão!' }, { semErros: true }] },
        { descricao: 'nada a mais', oculto: true, regras: [{ saidaIgual: 'Olá, Sertão!' }] },
      ],
    },
    {
      id: 'licao-input',
      tipo: 'licao',
      titulo: 'Lendo dados com input()',
      resumo: `
        <p><code>input()</code> espera a pessoa digitar uma linha e devolve o que foi digitado, sempre como texto.
          É a pergunta que o programa faz: no terminal, o programa para e espera você digitar a resposta e apertar Enter.</p>
        <p>Para fazer conta, converta o texto: <code>int(input())</code> vira número inteiro e <code>float(input())</code>, número com vírgula.</p>
        <p>Execute, digite <code>7</code> no terminal e aperte Enter. Depois rode de novo (no terminal, <code>python main.py</code>) com outro número.</p>`,
      entrada: ['7'],
      arquivos: main(py`
        n = int(input("Digite um número: "))
        print()
        print("O dobro é", n * 2)
        print("O próximo é", n + 1)
      `),
    },
    {
      id: 'py-saudacao',
      tipo: 'problema',
      titulo: 'Saudação',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia um nome com <code>input()</code> e mostre <code>Olá, &lt;nome&gt;!</code>.</p>
        <p>Com a entrada <code>Ana</code>, a saída é <code>Olá, Ana!</code>.</p>`,
      dica: 'Uma f-string junta texto e variável: f"Olá, {nome}!". Use input() sem texto de pergunta.',
      arquivos: main(py`
        nome = input()
        # Mostre a saudação
      `),
      solucao: main(py`
        nome = input()
        print(f"Olá, {nome}!")
      `),
      testes: [
        { descricao: 'Ana', entrada: ['Ana'], regras: [{ saidaIgual: 'Olá, Ana!' }] },
        { descricao: 'nome composto', oculto: true, entrada: ['José Maria'], regras: [{ saidaIgual: 'Olá, José Maria!' }] },
      ],
    },
    {
      id: 'py-soma-dois',
      tipo: 'problema',
      titulo: 'Soma de dois números',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia dois números inteiros, um por linha, e mostre a soma.</p>
        <p>Com as entradas <code>2</code> e <code>3</code>, a saída é <code>5</code>.</p>`,
      dica: 'input() devolve texto: "2" + "3" dá "23". Converta com int() antes de somar.',
      arquivos: main(py`
        a = input()
        b = input()
        print(a + b)
      `),
      solucao: main(py`
        a = int(input())
        b = int(input())
        print(a + b)
      `),
      testes: [
        { descricao: '2 + 3', entrada: ['2', '3'], regras: [{ saidaIgual: '5' }] },
        { descricao: 'negativo', oculto: true, entrada: ['-10', '4'], regras: [{ saidaIgual: '-6' }] },
        { descricao: 'zeros', oculto: true, entrada: ['0', '0'], regras: [{ saidaIgual: '0' }] },
      ],
    },
    {
      id: 'licao-funcoes',
      tipo: 'licao',
      titulo: 'Funções',
      resumo: `
        <p>Uma <b>função</b> é uma receita com nome: <code>def dobro(n):</code> define, <code>dobro(4)</code> usa.
          Os valores entre parênteses são os <b>parâmetros</b>.</p>
        <p><code>return</code> devolve o resultado para quem chamou; <code>print</code> só mostra na tela.
          É a diferença entre entregar o bolo na mão de alguém e só mostrar a foto dele.</p>
        <p>Nos exercícios de função, a correção chama a sua função com vários valores e confere o que ela <b>devolve</b>.</p>`,
      arquivos: main(py`
        def dobro(n):
            return n * 2

        def mostrar_dobro(n):
            print(n * 2)

        resultado = dobro(4)
        print("Guardei:", resultado)

        nada = mostrar_dobro(4)
        print("A função sem return devolve:", nada)
      `),
    },
    {
      id: 'py-area-retangulo',
      tipo: 'problema',
      titulo: 'Área do retângulo',
      dificuldade: 'facil',
      enunciado: '<p>Escreva <code>area(base, altura)</code>, que <b>devolve</b> a área do retângulo (base × altura).</p>',
      dica: 'Use return base * altura. print não devolve nada.',
      arquivos: assinatura('area(base, altura)', 'Devolva a área com return'),
      solucao: main(py`
        def area(base, altura):
            return base * altura
      `),
      testes: [
        { descricao: '3 × 4', regras: [{ funcao: 'area', args: [3, 4], igual: 12 }] },
        { descricao: 'decimais e zero', oculto: true, regras: [{ funcao: 'area', args: [2.5, 2], igual: 5 }, { funcao: 'area', args: [0, 9], igual: 0 }] },
      ],
    },
    {
      id: 'py-celsius',
      tipo: 'problema',
      titulo: 'Celsius para Fahrenheit',
      dificuldade: 'facil',
      enunciado: '<p>Escreva <code>celsius_para_fahrenheit(c)</code>, que devolve <code>c × 9 / 5 + 32</code>.</p>',
      dica: 'Em Python, a conta é c * 9 / 5 + 32.',
      arquivos: assinatura('celsius_para_fahrenheit(c)'),
      solucao: main(py`
        def celsius_para_fahrenheit(c):
            return c * 9 / 5 + 32
      `),
      testes: [
        {
          descricao: 'água congela e ferve',
          regras: [
            { funcao: 'celsius_para_fahrenheit', args: [0], igual: 32 },
            { funcao: 'celsius_para_fahrenheit', args: [100], igual: 212 },
          ],
        },
        {
          descricao: 'negativo e decimal',
          oculto: true,
          regras: [
            { funcao: 'celsius_para_fahrenheit', args: [-40], igual: -40 },
            { funcao: 'celsius_para_fahrenheit', args: [36.6], igual: 97.88, aprox: 0.01 },
          ],
        },
      ],
    },
    {
      id: 'py-media',
      tipo: 'problema',
      titulo: 'Média de três notas',
      dificuldade: 'medio',
      enunciado: '<p>Escreva <code>media(n1, n2, n3)</code>, que devolve a média das três notas com <b>uma casa decimal</b>.</p>',
      dica: 'round(valor, 1) arredonda para uma casa. Some as três notas e divida por 3.',
      arquivos: assinatura('media(n1, n2, n3)'),
      solucao: main(py`
        def media(n1, n2, n3):
            return round((n1 + n2 + n3) / 3, 1)
      `),
      testes: [
        { descricao: '8, 6 e 7', regras: [{ funcao: 'media', args: [8, 6, 7], igual: 7 }] },
        { descricao: 'arredondamento', oculto: true, regras: [{ funcao: 'media', args: [10, 9, 8.5], igual: 9.2 }, { funcao: 'media', args: [0, 0, 1], igual: 0.3 }] },
      ],
    },
    {
      id: 'licao-strings',
      tipo: 'licao',
      titulo: 'Textos (strings)',
      resumo: `
        <p>Um texto em Python é uma <b>string</b>. Ela é como um colar de contas: cada letra tem uma posição, começando do 0.</p>
        <p><code>texto[0:3]</code> pega as três primeiras letras (o <b>fatiamento</b>), <code>len(texto)</code> conta as letras,
          <code>.upper()</code> deixa maiúsculo e <code>.strip()</code> tira os espaços das pontas.</p>
        <p>A <b>f-string</b> (<code>f"..."</code>) coloca variáveis dentro do texto entre chaves.</p>`,
      arquivos: main(py`
        cidade = "  Petrolina  "
        limpa = cidade.strip()
        print(f"[{cidade}] vira [{limpa}]")
        print(limpa.upper(), len(limpa))
        print("Três primeiras:", limpa[0:3])
        print("Última letra:", limpa[-1])
        print("Ao contrário:", limpa[::-1])
      `),
    },
    {
      id: 'py-iniciais',
      tipo: 'problema',
      titulo: 'Iniciais do nome',
      dificuldade: 'medio',
      enunciado: `
        <p>Escreva <code>iniciais(nome)</code>, que devolve a primeira letra, em maiúscula, de cada palavra com <b>3 letras ou mais</b>.</p>
        <p><code>iniciais("Maria da Silva")</code> devolve <code>"MS"</code> (o "da" fica de fora).</p>`,
      dica: 'nome.split() separa as palavras; len(p) >= 3 filtra; p[0].upper() pega a inicial.',
      arquivos: assinatura('iniciais(nome)'),
      solucao: main(py`
        def iniciais(nome):
            return "".join(p[0].upper() for p in nome.split() if len(p) >= 3)
      `),
      testes: [
        { descricao: 'Maria da Silva', regras: [{ funcao: 'iniciais', args: ['Maria da Silva'], igual: 'MS' }] },
        { descricao: 'minúsculas e uma palavra', oculto: true, regras: [{ funcao: 'iniciais', args: ['josé de alencar'], igual: 'JA' }, { funcao: 'iniciais', args: ['Ana'], igual: 'A' }] },
      ],
    },
    {
      id: 'py-inverter',
      tipo: 'problema',
      titulo: 'Texto ao contrário',
      dificuldade: 'facil',
      enunciado: '<p>Escreva <code>inverter(texto)</code>, que devolve o texto de trás para a frente.</p>',
      dica: 'O fatiamento com passo -1 anda de trás para a frente: texto[::-1].',
      arquivos: assinatura('inverter(texto)'),
      solucao: main(py`
        def inverter(texto):
            return texto[::-1]
      `),
      testes: [
        { descricao: 'sertão', regras: [{ funcao: 'inverter', args: ['sertão'], igual: 'oãtres' }] },
        { descricao: 'vazio e com espaço', oculto: true, regras: [{ funcao: 'inverter', args: [''], igual: '' }, { funcao: 'inverter', args: ['ab c'], igual: 'c ba' }] },
      ],
    },
    {
      id: 'py-palindromo',
      tipo: 'problema',
      titulo: 'Palíndromo',
      dificuldade: 'medio',
      enunciado: `
        <p>Escreva <code>eh_palindromo(texto)</code>, que devolve <code>True</code> se o texto é igual lido de trás para a frente,
          <b>ignorando espaços e maiúsculas</b>.</p>
        <p><code>eh_palindromo("Ame a ema")</code> devolve <code>True</code>.</p>`,
      dica: 'Tire os espaços com .replace(" ", ""), passe para minúsculas com .lower() e compare com o texto invertido.',
      arquivos: assinatura('eh_palindromo(texto)'),
      solucao: main(py`
        def eh_palindromo(texto):
            t = texto.replace(" ", "").lower()
            return t == t[::-1]
      `),
      testes: [
        {
          descricao: 'frase e palavra',
          regras: [
            { funcao: 'eh_palindromo', args: ['Ame a ema'], igual: true },
            { funcao: 'eh_palindromo', args: ['sertão'], igual: false },
          ],
        },
        {
          descricao: 'frase longa e uma letra',
          oculto: true,
          regras: [
            { funcao: 'eh_palindromo', args: ['Socorram me subi no onibus em Marrocos'], igual: true },
            { funcao: 'eh_palindromo', args: ['a'], igual: true },
          ],
        },
      ],
    },
    {
      id: 'py-formatar-preco',
      tipo: 'problema',
      titulo: 'Preço em reais',
      dificuldade: 'medio',
      enunciado: `
        <p>Escreva <code>formatar_preco(valor)</code>, que devolve o valor no formato brasileiro:
          <code>formatar_preco(1234.5)</code> devolve <code>"R$ 1.234,50"</code>.</p>`,
      dica: 'f"{valor:,.2f}" dá "1,234.50". Depois troque vírgula por ponto e ponto por vírgula (use um caractere temporário).',
      arquivos: assinatura('formatar_preco(valor)'),
      solucao: main(py`
        def formatar_preco(valor):
            t = f"{valor:,.2f}"
            return "R$ " + t.replace(",", "X").replace(".", ",").replace("X", ".")
      `),
      testes: [
        { descricao: 'mil e pouco', regras: [{ funcao: 'formatar_preco', args: [1234.5], igual: 'R$ 1.234,50' }] },
        { descricao: 'zero e milhão', oculto: true, regras: [{ funcao: 'formatar_preco', args: [0], igual: 'R$ 0,00' }, { funcao: 'formatar_preco', args: [1000000], igual: 'R$ 1.000.000,00' }] },
      ],
    },
    {
      id: 'licao-condicoes',
      tipo: 'licao',
      titulo: 'Decisões com if',
      resumo: `
        <p><code>if</code> roda um bloco só quando a condição é verdadeira. <code>elif</code> testa outra condição e <code>else</code> pega o resto.
          É como uma bifurcação na estrada: o programa segue por um caminho só.</p>
        <p>O bloco é marcado pela <b>indentação</b> (4 espaços). As comparações são <code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;=</code>
          e se combinam com <code>and</code>, <code>or</code> e <code>not</code>.</p>`,
      arquivos: main(py`
        nota = 7.5
        if nota >= 9:
            print("Excelente")
        elif nota >= 7:
            print("Aprovado")
        else:
            print("Recuperação")

        idade = 17
        if idade >= 16 and idade < 18:
            print("Voto opcional")
      `),
    },
    {
      id: 'py-par-impar',
      tipo: 'problema',
      titulo: 'Par ou ímpar',
      dificuldade: 'facil',
      enunciado: '<p>Escreva <code>par_ou_impar(n)</code>, que devolve <code>"par"</code> ou <code>"ímpar"</code>.</p>',
      dica: 'n % 2 é o resto da divisão por 2: 0 quando o número é par.',
      arquivos: assinatura('par_ou_impar(n)'),
      solucao: main(py`
        def par_ou_impar(n):
            return "par" if n % 2 == 0 else "ímpar"
      `),
      testes: [
        { descricao: '4 e 7', regras: [{ funcao: 'par_ou_impar', args: [4], igual: 'par' }, { funcao: 'par_ou_impar', args: [7], igual: 'ímpar' }] },
        { descricao: 'zero e negativo', oculto: true, regras: [{ funcao: 'par_ou_impar', args: [0], igual: 'par' }, { funcao: 'par_ou_impar', args: [-3], igual: 'ímpar' }] },
      ],
    },
    {
      id: 'py-maior-de-tres',
      tipo: 'problema',
      titulo: 'Maior de três',
      dificuldade: 'facil',
      enunciado: '<p>Escreva <code>maior(a, b, c)</code>, que devolve o maior dos três números, <b>sem usar a função pronta</b> que acha o máximo.</p>',
      dica: 'Compare com if/elif: se a é maior ou igual aos outros dois, ele é o maior.',
      arquivos: assinatura('maior(a, b, c)'),
      solucao: main(py`
        def maior(a, b, c):
            if a >= b and a >= c:
                return a
            elif b >= c:
                return b
            return c
      `),
      testes: [
        {
          descricao: '1, 5 e 3',
          regras: [
            { funcao: 'maior', args: [1, 5, 3], igual: 5 },
            { semCodigo: 'max\\(', msg: 'O código não usa max()', dica: 'Resolva com if/elif comparando os números.' },
          ],
        },
        { descricao: 'negativos e empate', oculto: true, regras: [{ funcao: 'maior', args: [-1, -5, -3], igual: -1 }, { funcao: 'maior', args: [2, 2, 1], igual: 2 }] },
      ],
    },
    {
      id: 'py-bissexto',
      tipo: 'problema',
      titulo: 'Ano bissexto',
      dificuldade: 'medio',
      enunciado: `
        <p>Escreva <code>bissexto(ano)</code>, que devolve <code>True</code> se o ano é bissexto:
          divisível por 4 e não por 100, <b>ou</b> divisível por 400.</p>`,
      dica: 'ano % 4 == 0 and (ano % 100 != 0 or ano % 400 == 0).',
      arquivos: assinatura('bissexto(ano)'),
      solucao: main(py`
        def bissexto(ano):
            return ano % 4 == 0 and (ano % 100 != 0 or ano % 400 == 0)
      `),
      testes: [
        { descricao: '2024 e 2023', regras: [{ funcao: 'bissexto', args: [2024], igual: true }, { funcao: 'bissexto', args: [2023], igual: false }] },
        { descricao: 'viradas de século', oculto: true, regras: [{ funcao: 'bissexto', args: [1900], igual: false }, { funcao: 'bissexto', args: [2000], igual: true }] },
      ],
    },
    {
      id: 'py-imc',
      tipo: 'problema',
      titulo: 'Classificação do IMC',
      dificuldade: 'dificil',
      enunciado: `
        <p>Escreva <code>classificar_imc(peso, altura)</code>. O IMC é <code>peso / altura²</code>. Devolva:</p>
        <ul>
          <li>menor que 18,5: <code>"abaixo do peso"</code></li>
          <li>menor que 25: <code>"normal"</code></li>
          <li>menor que 30: <code>"sobrepeso"</code></li>
          <li>a partir de 30: <code>"obesidade"</code></li>
        </ul>`,
      dica: 'Calcule imc = peso / altura ** 2 e teste do menor limite para o maior com if/elif/else.',
      arquivos: assinatura('classificar_imc(peso, altura)'),
      solucao: main(py`
        def classificar_imc(peso, altura):
            imc = peso / altura ** 2
            if imc < 18.5:
                return "abaixo do peso"
            elif imc < 25:
                return "normal"
            elif imc < 30:
                return "sobrepeso"
            return "obesidade"
      `),
      testes: [
        { descricao: '70 kg, 1,75 m', regras: [{ funcao: 'classificar_imc', args: [70, 1.75], igual: 'normal' }] },
        {
          descricao: 'as outras faixas e o limite',
          oculto: true,
          regras: [
            { funcao: 'classificar_imc', args: [50, 1.7], igual: 'abaixo do peso' },
            { funcao: 'classificar_imc', args: [80, 1.7], igual: 'sobrepeso' },
            { funcao: 'classificar_imc', args: [100, 1.7], igual: 'obesidade' },
            { funcao: 'classificar_imc', args: [72.25, 1.7], igual: 'sobrepeso' },
          ],
        },
      ],
    },
    {
      id: 'licao-lacos',
      tipo: 'licao',
      titulo: 'Repetindo com for e while',
      resumo: `
        <p><code>for</code> repete para cada item de uma sequência: <code>for i in range(3)</code> roda com 0, 1 e 2.
          <code>range(1, 11)</code> vai de 1 a 10 (o fim não entra).</p>
        <p><code>while</code> repete <b>enquanto</b> a condição for verdadeira. Lembre de mudar a variável dentro do laço,
          senão ele nunca para, como um disco arranhado. (O DivergePython interrompe depois de 10 segundos.)</p>`,
      arquivos: main(py`
        for i in range(3):
            print("Volta", i)

        contador = 3
        while contador > 0:
            print("Faltam", contador)
            contador -= 1
        print("Pronto!")
      `),
    },
    {
      id: 'py-tabuada',
      tipo: 'problema',
      titulo: 'Tabuada',
      dificuldade: 'facil',
      enunciado: `
        <p>Leia um número <code>n</code> e mostre a tabuada dele de 1 a 10, uma linha por conta, no formato <code>7 x 1 = 7</code>.</p>`,
      dica: 'for i in range(1, 11): print(f"{n} x {i} = {n * i}")',
      arquivos: main(py`
        n = int(input())
        # Mostre a tabuada de n
      `),
      solucao: main(py`
        n = int(input())
        for i in range(1, 11):
            print(f"{n} x {i} = {n * i}")
      `),
      testes: [
        { descricao: 'tabuada do 7', entrada: ['7'], regras: [{ saidaIgual: tabuada(7) }] },
        { descricao: 'tabuada do 1', oculto: true, entrada: ['1'], regras: [{ saidaIgual: tabuada(1) }] },
        { descricao: 'tabuada do 12', oculto: true, entrada: ['12'], regras: [{ saidaIgual: tabuada(12) }] },
      ],
    },
    {
      id: 'py-soma-ate',
      tipo: 'problema',
      titulo: 'Soma até n',
      dificuldade: 'facil',
      enunciado: '<p>Escreva <code>soma_ate(n)</code>, que devolve 1 + 2 + … + n, <b>usando um laço</b>.</p>',
      dica: 'Comece com total = 0 e some cada i de range(1, n + 1).',
      arquivos: assinatura('soma_ate(n)'),
      solucao: main(py`
        def soma_ate(n):
            total = 0
            for i in range(1, n + 1):
                total += i
            return total
      `),
      testes: [
        {
          descricao: 'até 4',
          regras: [
            { funcao: 'soma_ate', args: [4], igual: 10 },
            { codigo: 'for\\s|while\\s', msg: 'O código usa um laço (for ou while)' },
          ],
        },
        {
          descricao: 'até 1, 100 e 0',
          oculto: true,
          regras: [
            { funcao: 'soma_ate', args: [1], igual: 1 },
            { funcao: 'soma_ate', args: [100], igual: 5050 },
            { funcao: 'soma_ate', args: [0], igual: 0 },
          ],
        },
      ],
    },
    {
      id: 'py-contagem-regressiva',
      tipo: 'problema',
      titulo: 'Contagem regressiva',
      dificuldade: 'facil',
      enunciado: '<p>Leia <code>n</code> e mostre os números de <code>n</code> até 1, um por linha, e depois <code>Fogo!</code>.</p>',
      dica: 'while n > 0: mostre n e diminua n em 1. Depois do laço, mostre "Fogo!".',
      arquivos: main(py`
        n = int(input())
        # Faça a contagem
      `),
      solucao: main(py`
        n = int(input())
        while n > 0:
            print(n)
            n -= 1
        print("Fogo!")
      `),
      testes: [
        { descricao: 'a partir de 3', entrada: ['3'], regras: [{ saidaIgual: '3\n2\n1\nFogo!' }] },
        { descricao: 'a partir de 1', oculto: true, entrada: ['1'], regras: [{ saidaIgual: '1\nFogo!' }] },
        { descricao: 'a partir de 0', oculto: true, entrada: ['0'], regras: [{ saidaIgual: 'Fogo!' }] },
      ],
    },
    {
      id: 'py-primo',
      tipo: 'problema',
      titulo: 'Número primo',
      dificuldade: 'medio',
      enunciado: '<p>Escreva <code>eh_primo(n)</code>, que devolve <code>True</code> se <code>n</code> só é divisível por 1 e por ele mesmo. 1 não é primo.</p>',
      dica: 'Números menores que 2 não são primos. Teste os divisores de 2 até int(n ** 0.5).',
      arquivos: assinatura('eh_primo(n)'),
      solucao: main(py`
        def eh_primo(n):
            if n < 2:
                return False
            for d in range(2, int(n ** 0.5) + 1):
                if n % d == 0:
                    return False
            return True
      `),
      testes: [
        { descricao: '7 e 8', regras: [{ funcao: 'eh_primo', args: [7], igual: true }, { funcao: 'eh_primo', args: [8], igual: false }] },
        {
          descricao: 'casos de borda',
          oculto: true,
          regras: [
            { funcao: 'eh_primo', args: [1], igual: false },
            { funcao: 'eh_primo', args: [2], igual: true },
            { funcao: 'eh_primo', args: [97], igual: true },
            { funcao: 'eh_primo', args: [91], igual: false },
          ],
        },
      ],
    },
    {
      id: 'py-fatorial',
      tipo: 'problema',
      titulo: 'Fatorial',
      dificuldade: 'medio',
      enunciado: '<p>Escreva <code>fatorial(n)</code>: 5! = 5 × 4 × 3 × 2 × 1 = 120. Por definição, <code>fatorial(0)</code> é 1.</p>',
      dica: 'Comece com resultado = 1 e multiplique por cada i de range(2, n + 1).',
      arquivos: assinatura('fatorial(n)'),
      solucao: main(py`
        def fatorial(n):
            resultado = 1
            for i in range(2, n + 1):
                resultado *= i
            return resultado
      `),
      testes: [
        { descricao: '5!', regras: [{ funcao: 'fatorial', args: [5], igual: 120 }] },
        { descricao: '0! e 10!', oculto: true, regras: [{ funcao: 'fatorial', args: [0], igual: 1 }, { funcao: 'fatorial', args: [10], igual: 3628800 }] },
      ],
    },
    {
      id: 'licao-listas',
      tipo: 'licao',
      titulo: 'Listas',
      resumo: `
        <p>Uma <b>lista</b> guarda vários valores em ordem: <code>frutas = ["umbu", "caju"]</code>. É como uma fila numerada, começando do 0.</p>
        <p><code>frutas[0]</code> pega o primeiro, <code>frutas.append("pinha")</code> põe no fim, <code>len(frutas)</code> conta
          e <code>for fruta in frutas:</code> passa por todos.</p>`,
      arquivos: main(py`
        frutas = ["umbu", "caju"]
        frutas.append("pinha")
        print(frutas)
        print("Primeira:", frutas[0], "| total:", len(frutas))
        for fruta in frutas:
            print("-", fruta.upper())

        quadrados = []
        for n in range(1, 4):
            quadrados.append(n * n)
        print(quadrados)
      `),
    },
    {
      id: 'py-fizzbuzz',
      tipo: 'problema',
      titulo: 'FizzBuzz',
      dificuldade: 'medio',
      enunciado: `
        <p>Escreva <code>fizzbuzz(n)</code>, que devolve uma <b>lista</b> com os números de 1 a <code>n</code> em texto, trocando:</p>
        <ul>
          <li>múltiplos de 3 e de 5 por <code>"FizzBuzz"</code>;</li>
          <li>múltiplos só de 3 por <code>"Fizz"</code>;</li>
          <li>múltiplos só de 5 por <code>"Buzz"</code>.</li>
        </ul>
        <p><code>fizzbuzz(5)</code> devolve <code>["1", "2", "Fizz", "4", "Buzz"]</code>.</p>`,
      dica: 'Teste i % 15 == 0 primeiro; senão o 15 vira só "Fizz". Os números entram como str(i).',
      arquivos: assinatura('fizzbuzz(n)'),
      solucao: main(py`
        def fizzbuzz(n):
            resultado = []
            for i in range(1, n + 1):
                if i % 15 == 0:
                    resultado.append("FizzBuzz")
                elif i % 3 == 0:
                    resultado.append("Fizz")
                elif i % 5 == 0:
                    resultado.append("Buzz")
                else:
                    resultado.append(str(i))
            return resultado
      `),
      testes: [
        { descricao: 'até 5', regras: [{ funcao: 'fizzbuzz', args: [5], igual: fizzbuzz(5) }] },
        { descricao: 'até 15 e até 1', oculto: true, regras: [{ funcao: 'fizzbuzz', args: [15], igual: fizzbuzz(15) }, { funcao: 'fizzbuzz', args: [1], igual: ['1'] }] },
      ],
    },
    ...exerciciosListas,
    {
      id: 'licao-dicionarios',
      tipo: 'licao',
      titulo: 'Dicionários',
      resumo: `
        <p>Um <b>dicionário</b> liga chaves a valores: <code>{"nome": "Ana", "idade": 30}</code>. É como uma agenda: você procura pelo nome, não pela posição.</p>
        <p><code>pessoa["nome"]</code> pega o valor (e dá <code>KeyError</code> se a chave não existe); <code>pessoa.get("email", "-")</code>
          devolve um valor padrão. <code>.items()</code> percorre chave e valor juntos.</p>`,
      arquivos: main(py`
        pessoa = {"nome": "Ana", "idade": 30}
        pessoa["cidade"] = "Juazeiro"
        print(pessoa["nome"])
        print(pessoa.get("email", "sem e-mail"))
        for chave, valor in pessoa.items():
            print(chave, "=", valor)

        votos = {}
        for fruta in ["umbu", "caju", "umbu"]:
            votos[fruta] = votos.get(fruta, 0) + 1
        print(votos)
      `),
    },
    ...exerciciosDicionarios,
    {
      id: 'licao-excecoes',
      tipo: 'licao',
      titulo: 'Erros e exceções',
      resumo: `
        <p>Quando algo dá errado, o Python levanta uma <b>exceção</b> (<code>ValueError</code>, <code>ZeroDivisionError</code>...) e mostra o
          <b>traceback</b> no terminal: a última linha diz o tipo do erro e a linha do código onde ele aconteceu.</p>
        <p><code>try/except</code> trata o erro sem parar o programa, como uma rede de proteção no trapézio.
          <code>raise</code> levanta um erro de propósito, quando um valor não faz sentido.</p>`,
      arquivos: main(py`
        def converter(texto):
            try:
                return int(texto)
            except ValueError:
                print(f"'{texto}' não é número; uso 0")
                return 0

        print(converter("42") + converter("quarenta"))

        def sacar(saldo, valor):
            if valor > saldo:
                raise ValueError("saldo insuficiente")
            return saldo - valor

        try:
            sacar(100, 500)
        except ValueError as erro:
            print("Não deu:", erro)
      `),
    },
    ...exerciciosExcecoes,
  ],
};
