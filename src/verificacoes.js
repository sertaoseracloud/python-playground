// Regras usadas pelos exercícios para conferir o resultado do Python.
// Cada regra é um objeto com uma das chaves abaixo e, opcionalmente, `msg` e `dica`:
//   { saida: 'texto' }                     a saída contém o texto
//   { saidaIgual: 'texto' }                a saída é igual (sem espaços no fim das linhas)
//   { variavel: 'x', igual }               valor final de uma variável global
//   { funcao: 'f', args, igual | aprox }   chama f(*args) e compara o retorno
//   { funcao: 'f', args, erro: 'Tipo' }    f(*args) levanta essa exceção
//   { erro: 'Tipo' }                       o programa termina com essa exceção
//   { semErros: true }                     o programa roda sem exceção
//   { codigo: 'regex' } / { semCodigo }    o código-fonte (todos os arquivos)
const json = (v) => JSON.stringify(v);
const iguais = (a, b) => json(a) === json(b);
const chamada = (r) => `${r.funcao}(${(r.args ?? []).map(json).join(', ')})`;
const linhas = (t) => String(t).replace(/\n$/, '').split('\n').map((l) => l.replace(/\s+$/, ''));

export const primeiraLinhaDoErro = (erro) => (erro ? `${erro.linha ? `linha ${erro.linha}: ` : ''}${erro.tipo}: ${erro.mensagem}` : '');

const res = (regra, padrao, ok, detalhe, obtido) => ({ ok, mensagem: regra.msg ?? padrao, detalhe: ok ? undefined : detalhe, obtido });

function aproximado(valor, esperado, tolerancia) {
  if (typeof esperado === 'number') return typeof valor === 'number' && Math.abs(valor - esperado) <= tolerancia;
  if (Array.isArray(esperado)) return Array.isArray(valor) && valor.length === esperado.length && esperado.every((e, i) => aproximado(valor[i], e, tolerancia));
  return iguais(valor, esperado);
}

export function verificarRegra(regra, { saida = '', erro = null, variaveis = {}, retorno, codigo = '' }) {
  if ('saidaIgual' in regra) {
    const [obtidas, esperadas] = [linhas(saida), linhas(regra.saidaIgual)];
    const i = esperadas.findIndex((l, n) => obtidas[n] !== l);
    const sobra = i < 0 && obtidas.length > esperadas.length;
    const detalhe = sobra ? `sobrou a linha ${esperadas.length + 1}: "${obtidas[esperadas.length]}"`
      : `linha ${i + 1}: esperado "${esperadas[i]}", veio ${obtidas[i] === undefined ? 'nada' : `"${obtidas[i]}"`}`;
    return res(regra, 'A saída é exatamente a pedida', i < 0 && !sobra, detalhe, saida.trimEnd());
  }
  if ('saida' in regra) {
    return res(regra, `A saída mostra "${regra.saida}"`, saida.includes(regra.saida), 'o texto não apareceu na saída', saida.trimEnd());
  }
  if ('funcao' in regra) {
    const nome = chamada(regra);
    if (!retorno) return res(regra, `${nome} funciona`, false, 'a função não foi chamada');
    if ('erro' in regra) {
      const ok = !retorno.ok && retorno.erro?.tipo === regra.erro;
      return res(regra, `${nome} levanta ${regra.erro}`, ok,
        retorno.ok ? `devolveu ${retorno.repr} em vez de levantar ${regra.erro}` : `levantou ${retorno.erro.tipo}: ${retorno.erro.mensagem}`,
        retorno.ok ? retorno.repr : retorno.erro.tipo);
    }
    if (!retorno.ok) return res(regra, `${nome} devolve ${json(regra.igual)}`, false, `${nome} deu ${retorno.erro.tipo}: ${retorno.erro.mensagem}`, retorno.erro.tipo);
    const ok = 'aprox' in regra ? aproximado(retorno.valor, regra.igual, regra.aprox) : iguais(retorno.valor, regra.igual);
    return res(regra, `${nome} devolve ${json(regra.igual)}`, ok, `esperado ${json(regra.igual)}, veio ${retorno.repr}`, retorno.repr);
  }
  if ('variavel' in regra) {
    const existe = regra.variavel in variaveis;
    const v = variaveis[regra.variavel];
    return res(regra, `${regra.variavel} vale ${json(regra.igual)}`, existe && iguais(v, regra.igual),
      existe ? `esperado ${json(regra.igual)}, veio ${json(v)}` : `a variável ${regra.variavel} não existe no fim do programa`, existe ? json(v) : undefined);
  }
  if ('erro' in regra) {
    return res(regra, `O programa termina com ${regra.erro}`, erro?.tipo === regra.erro,
      erro ? `terminou com ${primeiraLinhaDoErro(erro)}` : 'o programa terminou sem erro', erro?.tipo);
  }
  if ('semErros' in regra) return res(regra, 'O programa roda sem erros', !erro, primeiraLinhaDoErro(erro));
  if ('codigo' in regra) return res(regra, `O código usa ${regra.codigo}`, new RegExp(regra.codigo, 'm').test(codigo), 'não encontrei no código');
  if ('semCodigo' in regra) return res(regra, `O código não usa ${regra.semCodigo}`, !new RegExp(regra.semCodigo, 'm').test(codigo), 'encontrei no código');
  throw new Error(`Regra desconhecida: ${json(regra)}`);
}

const CATEGORIAS = [
  ['saidaIgual', 'Saída'], ['saida', 'Saída'], ['funcao', 'Função'], ['variavel', 'Variável'],
  ['erro', 'Execução'], ['semErros', 'Execução'], ['codigo', 'Código'], ['semCodigo', 'Código'],
];
export const categoriaDe = (regra) => CATEGORIAS.find(([chave]) => chave in regra)?.[1] ?? 'Verificação';

/** Mensagem da regra antes de rodar (aba Testes, casos pendentes). */
export function descreverRegra(regra) {
  try {
    return verificarRegra(regra, { saida: '', variaveis: {}, codigo: '' }).mensagem;
  } catch {
    return undefined;
  }
}

const DICAS = {
  Saída: 'Compare a saída com o pedido: maiúsculas, acentos, espaços e pontuação contam.',
  Função: 'Confira o nome da função, os parâmetros e o return (print não devolve valor).',
  Variável: 'A variável precisa existir no fim do programa, fora de funções.',
  Execução: 'Leia o traceback no 🖥️ Terminal: ele mostra a linha e o tipo do erro.',
  Código: 'O enunciado pede (ou proíbe) um recurso específico do Python.',
};

/** verificarRegra + categoria e dica, para a aba Testes. */
export function detalharRegra(regra, ctx) {
  const r = verificarRegra(regra, ctx);
  const categoria = categoriaDe(regra);
  return { ...r, categoria, dica: r.ok ? undefined : regra.dica ?? DICAS[categoria] };
}
