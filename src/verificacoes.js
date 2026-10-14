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
//   { arquivo: 'nome', igual | json }      o arquivo que o programa gravou (texto ou JSON)
//   { paralelo: { workers, tarefas } }    quantos workers e tarefas o código usou (nunca o tempo)
//   { dataframe: 'df', colunas?, tipos?, linhas?, ordem?, aprox?, total? }
//                                          o DataFrame df no fim do programa (sem `ordem`, as linhas
//                                          são comparadas em qualquer ordem, como no Spark)
//   { plano: 'df', shuffles?, broadcast?, cache?, particoes?, estagios? }
//                                          o plano físico de df (o que o df.explain() mostra)
const json = (v) => JSON.stringify(v);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const iguais = (a, b) => json(a) === json(b);
const chamada = (r) => `${r.funcao}(${(r.args ?? []).map(json).join(', ')})`;
const linhas = (t) => String(t).replace(/\n$/, '').split('\n').map((l) => l.replace(/\s+$/, ''));

export const primeiraLinhaDoErro = (erro) => (erro ? `${erro.linha ? `linha ${erro.linha}: ` : ''}${erro.tipo}: ${erro.mensagem}` : '');

const res = (regra, padrao, ok, detalhe, obtido) => ({ ok, mensagem: regra.msg ?? padrao, detalhe: ok ? undefined : detalhe, obtido });

/** Compara linha a linha (sem espaços no fim) e diz a primeira diferença. */
function compararLinhas(texto, esperado) {
  const [obtidas, esperadas] = [linhas(texto), linhas(esperado)];
  const i = esperadas.findIndex((l, n) => obtidas[n] !== l);
  const sobra = i < 0 && obtidas.length > esperadas.length;
  const detalhe = sobra ? `sobrou a linha ${esperadas.length + 1}: "${obtidas[esperadas.length]}"`
    : `linha ${i + 1}: esperado "${esperadas[i]}", veio ${obtidas[i] === undefined ? 'nada' : `"${obtidas[i]}"`}`;
  return { ok: i < 0 && !sobra, detalhe };
}

function aproximado(valor, esperado, tolerancia) {
  if (typeof esperado === 'number') return typeof valor === 'number' && Math.abs(valor - esperado) <= tolerancia;
  if (Array.isArray(esperado)) return Array.isArray(valor) && valor.length === esperado.length && esperado.every((e, i) => aproximado(valor[i], e, tolerancia));
  return iguais(valor, esperado);
}

/** A tabela do DataFrame `nome`, ou o motivo de não dar para conferir. */
function tabelaDe(nome, tabelas, variaveis) {
  const tabela = tabelas[nome];
  if (!tabela) return { motivo: nome in variaveis ? `${nome} não é um DataFrame` : `a variável ${nome} não existe no fim do programa` };
  if (tabela.erro) return { motivo: `calcular ${nome} deu ${tabela.erro.tipo}: ${tabela.erro.mensagem}` };
  return { tabela };
}

const textoDoValor = (v) => (v === null || v === undefined ? 'null' : typeof v === 'object' ? json(v) : String(v));

/** As colunas e até 5 linhas, numa linha só: "regiao | total · Sul | 1 · Nordeste | 3 …". */
function resumoDaTabela(t) {
  const partes = [t.colunas.map((c) => c.nome).join(' | '), ...t.linhas.slice(0, 5).map((l) => l.map(textoDoValor).join(' | '))];
  return `${partes.join(' · ')}${t.linhas.length > 5 ? ' …' : ''}`;
}

function verificarDataFrame(regra, tabelas, variaveis) {
  const nome = regra.dataframe;
  const mensagem = `O DataFrame ${nome} tem o resultado pedido`;
  const { tabela, motivo } = tabelaDe(nome, tabelas, variaveis);
  if (motivo) return res(regra, mensagem, false, motivo);
  const obtido = resumoDaTabela(tabela);
  const falha = (detalhe) => res(regra, mensagem, false, detalhe, obtido);
  const nomes = tabela.colunas.map((c) => c.nome);
  if (regra.colunas && !iguais(nomes, regra.colunas)) return falha(`colunas esperadas [${regra.colunas.join(', ')}], vieram [${nomes.join(', ')}]`);
  const tipos = tabela.colunas.map((c) => c.tipo);
  if (regra.tipos && !iguais(tipos, regra.tipos)) return falha(`tipos esperados [${regra.tipos.join(', ')}], vieram [${tipos.join(', ')}]`);
  const total = regra.total ?? regra.linhas?.length;
  if (total !== undefined && tabela.total !== total) {
    return falha(`${total === 1 ? 'esperada 1 linha' : `esperadas ${total} linhas`}, ${tabela.total === 1 ? 'veio 1' : `vieram ${tabela.total}`}`);
  }
  if (regra.linhas) {
    const tolerancia = regra.aprox ?? 1e-9;
    const parecida = (a, b) => aproximado(a, b, tolerancia);
    if (regra.ordem) {
      const i = regra.linhas.findIndex((l, n) => !parecida(tabela.linhas[n], l));
      if (i >= 0) return falha(`linha ${i + 1}: esperado ${json(regra.linhas[i])}, veio ${json(tabela.linhas[i])}`);
    } else {
      // Em qualquer ordem: cada linha esperada casa com uma linha obtida ainda livre.
      const livres = [...tabela.linhas];
      for (const esperada of regra.linhas) {
        const achou = livres.findIndex((l) => parecida(l, esperada));
        if (achou < 0) return falha(`faltou a linha ${json(esperada)}`);
        livres.splice(achou, 1);
      }
      if (livres.length) return falha(`sobrou a linha ${json(livres[0])}`);
    }
  }
  return res(regra, mensagem, true, undefined, obtido);
}

function verificarPlano(regra, tabelas, variaveis) {
  const nome = regra.plano;
  const pedidos = [
    'shuffles' in regra && plural(regra.shuffles, 'shuffle', 'shuffles'),
    'broadcast' in regra && (regra.broadcast ? 'broadcast' : 'sem broadcast'),
    'cache' in regra && (regra.cache ? 'em cache' : 'sem cache'),
    'particoes' in regra && plural(regra.particoes, 'partição', 'partições'),
    'estagios' in regra && plural(regra.estagios, 'estágio', 'estágios'),
  ].filter(Boolean);
  const mensagem = `O plano de ${nome} tem ${pedidos.join(', ') || 'o pedido'}`;
  const { tabela, motivo } = tabelaDe(nome, tabelas, variaveis);
  if (motivo) return res(regra, mensagem, false, motivo);
  const p = tabela.plano ?? {};
  const obtido = [
    plural(p.shuffles ?? 0, 'shuffle', 'shuffles'), p.broadcast ? 'com broadcast' : 'sem broadcast', p.cache ? 'em cache' : 'sem cache',
    plural(p.particoes ?? 0, 'partição', 'partições'), plural(p.estagios ?? 0, 'estágio', 'estágios'),
  ].join(' · ');
  const detalhe = [
    'shuffles' in regra && p.shuffles !== regra.shuffles && `o plano tem ${plural(p.shuffles, 'shuffle', 'shuffles')}; o pedido é ${regra.shuffles}`,
    'broadcast' in regra && Boolean(p.broadcast) !== regra.broadcast && (regra.broadcast ? 'o join não usou broadcast' : 'o join usou broadcast; o pedido é sem broadcast'),
    'cache' in regra && Boolean(p.cache) !== regra.cache && (regra.cache ? 'o DataFrame não está em cache' : 'o DataFrame está em cache; o pedido é sem cache'),
    'particoes' in regra && p.particoes !== regra.particoes && `o DataFrame tem ${plural(p.particoes, 'partição', 'partições')}; o pedido é ${regra.particoes}`,
    'estagios' in regra && p.estagios !== regra.estagios && `o plano tem ${plural(p.estagios, 'estágio', 'estágios')}; o pedido é ${regra.estagios}`,
  ].find(Boolean);
  return res(regra, mensagem, !detalhe, detalhe, obtido);
}

export function verificarRegra(regra, { saida = '', erro = null, variaveis = {}, retorno, codigo = '', arquivos = {}, paralelismo = null, tabelas = {} }) {
  if ('dataframe' in regra) return verificarDataFrame(regra, tabelas, variaveis);
  if ('plano' in regra) return verificarPlano(regra, tabelas, variaveis);
  if ('saidaIgual' in regra) {
    const { ok, detalhe } = compararLinhas(saida, regra.saidaIgual);
    return res(regra, 'A saída é exatamente a pedida', ok, detalhe, saida.trimEnd());
  }
  if ('paralelo' in regra) {
    const { workers: minimo, tarefas } = regra.paralelo;
    const p = paralelismo ?? { disponivel: false, maximo: 1, tarefas: 0, workers: 0 };
    const obtido = `${p.tarefas} ${p.tarefas === 1 ? 'tarefa' : 'tarefas'} em ${p.workers} ${p.workers === 1 ? 'worker' : 'workers'}`;
    if (!p.tarefas) return res(regra, 'O trabalho roda em outros processos', false, 'o código não mandou nenhuma tarefa para outro processo', obtido);
    if (tarefas !== undefined && p.tarefas !== tarefas) {
      return res(regra, `O trabalho foi dividido em ${tarefas} tarefas`, false, `foram ${p.tarefas} tarefas`, obtido);
    }
    if (minimo !== undefined) {
      // Sem JSPI (ou com um núcleo só) não há como usar mais workers: não é culpa do código.
      const possivel = p.disponivel ? Math.min(minimo, p.maximo) : 1;
      return res(regra, `As tarefas rodam em ${minimo} ou mais workers ao mesmo tempo`, p.workers >= possivel,
        `só ${p.workers} ${p.workers === 1 ? 'worker trabalhou' : 'workers trabalharam'}`,
        p.disponivel ? obtido : `${obtido} (neste navegador não há paralelismo)`);
    }
    return res(regra, `O trabalho foi dividido em ${tarefas} tarefas`, true, '', obtido);
  }
  if ('arquivo' in regra) {
    const nome = regra.arquivo;
    const texto = arquivos[nome];
    if (texto === undefined) return res(regra, `O programa grava ${nome}`, false, `o arquivo ${nome} não foi criado`);
    if ('json' in regra) {
      const mensagem = `${nome} tem os dados pedidos`;
      let valor;
      try {
        valor = JSON.parse(texto);
      } catch {
        return res(regra, mensagem, false, `${nome} não é um JSON válido`, texto.slice(0, 200));
      }
      return res(regra, mensagem, iguais(valor, regra.json), `esperado ${json(regra.json)}, veio ${json(valor)}`, json(valor));
    }
    // csv.writer termina as linhas com \r\n: conta só o conteúdo de cada linha.
    const { ok, detalhe } = compararLinhas(texto.replace(/\r\n/g, '\n'), regra.igual);
    return res(regra, `${nome} tem exatamente o conteúdo pedido`, ok, detalhe, texto.trimEnd());
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
  ['saidaIgual', 'Saída'], ['saida', 'Saída'], ['arquivo', 'Arquivo'], ['paralelo', 'Paralelismo'],
  ['dataframe', 'DataFrame'], ['plano', 'Plano'], ['funcao', 'Função'], ['variavel', 'Variável'],
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
  Paralelismo: 'Use Pool, Process ou ProcessPoolExecutor dentro do if __name__ == "__main__": e mande várias tarefas de uma vez (map, submit).',
  Arquivo: 'Confira o nome do arquivo, o cabeçalho e cada linha. Para ver o que foi gravado, use print(open(nome).read()).',
  DataFrame: 'Confira as colunas (nomes e alias), os tipos e as linhas. Use df.show() e df.printSchema() para ver o que o seu DataFrame tem.',
  Plano: 'Use df.explain() para ver o plano: cada Exchange é um shuffle, e BroadcastHashJoin é o join com broadcast.',
};

/** verificarRegra + categoria e dica, para a aba Testes. */
export function detalharRegra(regra, ctx) {
  const r = verificarRegra(regra, ctx);
  const categoria = categoriaDe(regra);
  return { ...r, categoria, dica: r.ok ? undefined : regra.dica ?? DICAS[categoria] };
}
