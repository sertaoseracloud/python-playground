// Regras de correção: cada tipo passa quando deve e falha com um motivo útil.
import { describe, it, expect } from 'vitest';
import { verificarRegra, detalharRegra, categoriaDe, descreverRegra } from '../src/verificacoes.js';

const ctx = (extra = {}) => ({ saida: '', erro: null, variaveis: {}, retorno: undefined, codigo: '', ...extra });

describe('verificarRegra', () => {
  it('saida (contém) e saidaIgual (linhas sem espaço no fim)', () => {
    expect(verificarRegra({ saida: 'Olá' }, ctx({ saida: 'Olá, Ana\n' })).ok).toBe(true);
    expect(verificarRegra({ saidaIgual: 'a\nb' }, ctx({ saida: 'a  \nb\n' })).ok).toBe(true);
    expect(verificarRegra({ saidaIgual: 'a\nb' }, ctx({ saida: 'a\nc\n' }))).toMatchObject({ ok: false, detalhe: 'linha 2: esperado "b", veio "c"' });
  });

  it('variavel', () => {
    expect(verificarRegra({ variavel: 'x', igual: [1, 2] }, ctx({ variaveis: { x: [1, 2] } })).ok).toBe(true);
    expect(verificarRegra({ variavel: 'y', igual: 1 }, ctx()).detalhe).toBe('a variável y não existe no fim do programa');
  });

  it('funcao: igual, aprox e erro esperado', () => {
    expect(verificarRegra({ funcao: 'f', args: [2], igual: 4 }, ctx({ retorno: { ok: true, valor: 4, repr: '4' } })).ok).toBe(true);
    expect(verificarRegra({ funcao: 'f', args: [], aprox: 0.01, igual: 0.33 }, ctx({ retorno: { ok: true, valor: 0.3333, repr: '0.3333' } })).ok).toBe(true);
    expect(verificarRegra({ funcao: 'f', args: [0], erro: 'ValueError' }, ctx({ retorno: { ok: false, erro: { tipo: 'ValueError', mensagem: 'x' } } })).ok).toBe(true);
    expect(verificarRegra({ funcao: 'f', args: [2], igual: 4 }, ctx({ retorno: { ok: false, erro: { tipo: 'NameError', mensagem: "name 'f' is not defined" } } })))
      .toMatchObject({ ok: false, detalhe: "f(2) deu NameError: name 'f' is not defined" });
  });

  it('retorno que não vira JSON: falha com o repr', () => {
    const r = detalharRegra({ funcao: 'f', args: [], igual: 1 }, ctx({ retorno: { ok: true, valor: null, repr: '<built-in function print>' } }));
    expect(r).toMatchObject({ ok: false, obtido: '<built-in function print>' });
  });

  it('erro esperado e semErros', () => {
    const erro = { tipo: 'ZeroDivisionError', mensagem: 'division by zero', linha: 3 };
    expect(verificarRegra({ erro: 'ZeroDivisionError' }, ctx({ erro })).ok).toBe(true);
    expect(verificarRegra({ semErros: true }, ctx({ erro })).detalhe).toBe('linha 3: ZeroDivisionError: division by zero');
  });

  it('codigo e semCodigo', () => {
    expect(verificarRegra({ codigo: 'for\\s' }, ctx({ codigo: 'for i in x:' })).ok).toBe(true);
    expect(verificarRegra({ semCodigo: 'sum\\(' }, ctx({ codigo: 'sum(x)' })).ok).toBe(false);
  });

  it('categorias', () => {
    expect(categoriaDe({ funcao: 'f' })).toBe('Função');
    expect(categoriaDe({ saidaIgual: 'x' })).toBe('Saída');
    expect(categoriaDe({ inventada: 1 })).toBe('Verificação');
  });

  it('arquivo: compara o texto sem diferenciar \\r\\n e o JSON pelo valor', () => {
    const arquivos = { 'aprovados.csv': 'nome,nota\r\nAna,8\r\n', 'resumo.json': '{\n  "total": 2\n}' };
    expect(verificarRegra({ arquivo: 'aprovados.csv', igual: 'nome,nota\nAna,8' }, { arquivos }).ok).toBe(true);
    expect(verificarRegra({ arquivo: 'resumo.json', json: { total: 2 } }, { arquivos }).ok).toBe(true);
    const falta = verificarRegra({ arquivo: 'outro.csv', igual: 'x' }, { arquivos });
    expect(falta).toMatchObject({ ok: false, detalhe: 'o arquivo outro.csv não foi criado' });
    expect(categoriaDe({ arquivo: 'x', igual: '' })).toBe('Arquivo');
  });

  it('paralelo: confere workers e tarefas, e não cobra paralelismo onde ele não existe', () => {
    const regra = { paralelo: { workers: 2 } };
    const p = (x) => ({ paralelismo: { disponivel: true, maximo: 4, tarefas: 4, workers: 1, ...x } });
    expect(verificarRegra(regra, p({ workers: 3 })).ok).toBe(true);
    expect(verificarRegra(regra, p({})).ok).toBe(false);
    expect(verificarRegra(regra, p({ maximo: 1 })).ok).toBe(true); // computador com 1 worker
    expect(verificarRegra(regra, p({ disponivel: false })).ok).toBe(true); // navegador sem JSPI
    expect(verificarRegra(regra, p({ tarefas: 0, workers: 0 }))).toMatchObject({ ok: false, detalhe: 'o código não mandou nenhuma tarefa para outro processo' });
    expect(verificarRegra({ paralelo: { tarefas: 10 } }, p({ tarefas: 10 })).ok).toBe(true);
    expect(verificarRegra({ paralelo: { tarefas: 10 } }, p({ tarefas: 8 })).ok).toBe(false);
    expect(categoriaDe(regra)).toBe('Paralelismo');
  });

  it('dataframe: colunas, tipos e linhas (sem ordem, a não ser que o exercício peça)', () => {
    const tabelas = {
      df: { colunas: [{ nome: 'regiao', tipo: 'string' }, { nome: 'total', tipo: 'bigint' }], linhas: [['Sul', 1], ['Nordeste', 3]], total: 2, ordenado: false, plano: {} },
      ruim: { erro: { tipo: 'ZeroDivisionError', mensagem: 'integer division or modulo by zero' } },
    };
    const v = (regra) => verificarRegra(regra, ctx({ tabelas, variaveis: { n: 1 } }));
    expect(v({ dataframe: 'df', colunas: ['regiao', 'total'], linhas: [['Nordeste', 3], ['Sul', 1]] }).ok).toBe(true);
    expect(v({ dataframe: 'df', linhas: [['Nordeste', 3], ['Sul', 1]], ordem: true })).toMatchObject({ ok: false, detalhe: 'linha 1: esperado ["Nordeste",3], veio ["Sul",1]' });
    expect(v({ dataframe: 'df', colunas: ['regiao', 'soma'] }).detalhe).toBe('colunas esperadas [regiao, soma], vieram [regiao, total]');
    expect(v({ dataframe: 'df', tipos: ['string', 'double'] }).detalhe).toBe('tipos esperados [string, double], vieram [string, bigint]');
    expect(v({ dataframe: 'df', linhas: [['Sul', 1], ['Norte', 2]] }).detalhe).toBe('faltou a linha ["Norte",2]');
    expect(v({ dataframe: 'df', linhas: [['Sul', 1]] }).detalhe).toBe('esperada 1 linha, vieram 2');
    expect(v({ dataframe: 'df', linhas: [['Sul', 1.0000000001], ['Nordeste', 3]] }).ok).toBe(true);
    expect(v({ dataframe: 'ruim', total: 1 }).detalhe).toBe('calcular ruim deu ZeroDivisionError: integer division or modulo by zero');
    expect(v({ dataframe: 'n', total: 1 }).detalhe).toBe('n não é um DataFrame');
    expect(v({ dataframe: 'x', total: 1 }).detalhe).toBe('a variável x não existe no fim do programa');
    expect(v({ dataframe: 'df', total: 2 }).obtido).toBe('regiao | total · Sul | 1 · Nordeste | 3');
    expect(categoriaDe({ dataframe: 'df' })).toBe('DataFrame');
  });

  it('plano: shuffles, broadcast, cache, partições e estágios', () => {
    const plano = { shuffles: 1, broadcast: false, cache: true, particoes: 4, estagios: 2 };
    const c = ctx({ tabelas: { df: { colunas: [], linhas: [], total: 0, plano } } });
    expect(verificarRegra({ plano: 'df', shuffles: 1, cache: true }, c).ok).toBe(true);
    expect(verificarRegra({ plano: 'df', shuffles: 0 }, c)).toMatchObject({ ok: false, detalhe: 'o plano tem 1 shuffle; o pedido é 0' });
    expect(verificarRegra({ plano: 'df', broadcast: true }, c).detalhe).toBe('o join não usou broadcast');
    expect(verificarRegra({ plano: 'df', particoes: 3 }, c).detalhe).toBe('o DataFrame tem 4 partições; o pedido é 3');
    expect(verificarRegra({ plano: 'df', estagios: 1 }, c).obtido).toBe('1 shuffle · sem broadcast · em cache · 4 partições · 2 estágios');
    expect(verificarRegra({ plano: 'df', estagios: 1 }, c).detalhe).toBe('o plano tem 2 estágios; o pedido é 1');
    expect(categoriaDe({ plano: 'df' })).toBe('Plano');
  });

  it('dicionários são iguais em qualquer ordem de chaves (como no Python)', () => {
    expect(verificarRegra({ variavel: 'd', igual: { Crato: 31.5, Sobral: 35 } }, ctx({ variaveis: { d: { Sobral: 35, Crato: 31.5 } } })).ok).toBe(true);
    expect(verificarRegra({ variavel: 'd', igual: { a: { x: 1, y: 2 } } }, ctx({ variaveis: { d: { a: { y: 2, x: 1 } } } })).ok).toBe(true);
    expect(verificarRegra({ variavel: 'l', igual: [1, 2] }, ctx({ variaveis: { l: [2, 1] } })).ok).toBe(false);
  });

  it('regra desconhecida é erro de quem escreveu o exercício', () => {
    expect(() => verificarRegra({ inventada: 1 }, ctx())).toThrow('Regra desconhecida');
  });
});

describe('regra stream', () => {
  const lote = (id, saida, marcaDagua = null, descartadas = 0) => ({ id, entrada: 2, arquivos: [], estado: 0, marcaDagua, saida, descartadas });
  const streaming = { consultas: [{ nome: 'janelas', modo: 'update', formato: 'memory', lotes: [lote(0, 1), lote(1, 1), lote(2, 1, '2026-03-10T08:16:00.000Z', 1)] }] };
  const ver = (regra) => verificarRegra(regra, { streaming });

  it('passa quando lotes, saída, modo, marca d\'água e descartadas batem', () => {
    const r = ver({ stream: 'janelas', modo: 'update', lotes: 3, saidaPorLote: [1, 1, 1], marcaDagua: '2026-03-10T08:16', descartadas: 1 });
    expect(r.ok).toBe(true);
    expect(r.obtido).toBe('3 lotes · saída por lote [1, 1, 1] · update');
  });

  it.each([
    [{ stream: 'alertas' }, 'a consulta alertas não existe (use .queryName("alertas") e .start())'],
    [{ stream: 'janelas', lotes: 1 }, 'esperado 1 lote, vieram 3'],
    [{ stream: 'janelas', saidaPorLote: [1, 3, 1] }, 'o lote 1 devia emitir 3 linhas, emitiu 1'],
    [{ stream: 'janelas', modo: 'complete' }, 'o modo devia ser complete, é update'],
    [{ stream: 'janelas', marcaDagua: '2026-03-10T08:10' }, "a marca d'água final devia ser 08:10, foi 08:16"],
    [{ stream: 'janelas', descartadas: 0 }, 'deviam ser descartadas 0 linhas atrasadas, foram 1'],
  ])('%j falha com o motivo', (regra, detalhe) => {
    expect(ver(regra)).toMatchObject({ ok: false, detalhe });
  });

  it('sem streaming nenhum (programa sem start): motivo, sem exceção', () => {
    expect(verificarRegra({ stream: 'x' }, {})).toMatchObject({ ok: false });
    expect(descreverRegra({ stream: 'x', lotes: 2 })).toBe('A consulta x rodou como pedido');
  });
});

describe('regra modelo', () => {
  const modelos = {
    m: { tipo: 'LinearRegressionModel', coeficientes: [0.0100000001, 2, 1.5], intercepto: 3, metricas: { 'rmse@safra-teste.csv': 0.00002, 'r2@x.csv': { erro: { tipo: 'AnalysisException', mensagem: 'Path does not exist' } } } },
    r: { tipo: 'LogisticRegressionModel', coeficientes: [-0.01, -3], intercepto: 4, metricas: { 'areaUnderROC@safra-teste.csv': 0.61 } },
    est: { tipo: 'LogisticRegression', treinado: false, metricas: {} },
    tubo: { tipo: 'PipelineModel', ultimo: 'LinearRegressionModel', coeficientes: [1], intercepto: 0, metricas: {} },
    g: { tipo: 'KMeansModel', k: 3, metricas: {} },
    a: { tipo: 'DecisionTreeClassificationModel', profundidade: 2, metricas: {} },
  };
  const ver = (regra, variaveis = {}) => verificarRegra(regra, { modelos, variaveis });

  it('passa com tipo, coeficientes aproximados, k, profundidade e métrica', () => {
    expect(ver({ modelo: 'm', tipo: 'LinearRegressionModel', coeficientes: [0.01, 2, 1.5], intercepto: 3 }).ok).toBe(true);
    expect(ver({ modelo: 'm', metrica: { nome: 'rmse', max: 0.001, dados: 'safra-teste.csv' } }).ok).toBe(true);
    expect(ver({ modelo: 'tubo', tipo: 'PipelineModel' }).ok).toBe(true);
    expect(ver({ modelo: 'tubo', tipo: 'LinearRegressionModel' }).ok).toBe(true); // o último estágio do pipeline
    expect(ver({ modelo: 'g', k: 3 }).ok).toBe(true);
    expect(ver({ modelo: 'a', profundidade: 2 }).ok).toBe(true);
  });

  it.each([
    [{ modelo: 'x' }, {}, 'a variável x não existe no fim do programa'],
    [{ modelo: 'n' }, { n: 3 }, 'n não é um modelo treinado (fit)'],
    [{ modelo: 'est' }, {}, 'est é um LogisticRegression sem treino: use est = LogisticRegression(...).fit(dados)'],
    [{ modelo: 'm', tipo: 'LogisticRegressionModel' }, {}, 'esperado LogisticRegressionModel, veio LinearRegressionModel'],
    [{ modelo: 'm', coeficientes: [0.02, 2, 1.5] }, {}, 'coeficientes esperados [0,02, 2, 1,5], vieram [0,01, 2, 1,5]'],
    [{ modelo: 'm', intercepto: 1 }, {}, 'intercepto esperado 1, veio 3'],
    [{ modelo: 'g', k: 2 }, {}, 'k esperado 2, veio 3'],
    [{ modelo: 'a', profundidade: 3 }, {}, 'profundidade esperada 3, veio 2'],
    [{ modelo: 'r', metrica: { nome: 'areaUnderROC', min: 0.8, dados: 'safra-teste.csv' } }, {}, 'areaUnderROC 0,61 em safra-teste.csv; o mínimo é 0,8'],
    [{ modelo: 'm', metrica: { nome: 'r2', min: 0.9, dados: 'x.csv' } }, {}, 'calcular r2 em x.csv deu AnalysisException: Path does not exist'],
    [{ modelo: 'm', metrica: { nome: 'mae', max: 1, dados: 'y.csv' } }, {}, 'não deu para calcular mae em y.csv'],
  ])('%j falha com o motivo', (regra, variaveis, detalhe) => {
    expect(ver(regra, variaveis)).toMatchObject({ ok: false, detalhe });
  });

  it('mensagens antes de rodar (contexto vazio)', () => {
    expect(descreverRegra({ modelo: 'm', tipo: 'LinearRegressionModel' })).toBe('m é o modelo treinado pedido');
    expect(descreverRegra({ modelo: 'r', metrica: { nome: 'areaUnderROC', min: 0.75, dados: 't.csv' } })).toBe('r tem areaUnderROC ≥ 0,75 em t.csv');
  });
});

describe('regra delta', () => {
  const deltas = { estoque: { versao: 2, operacoes: ['WRITE', 'MERGE', 'DELETE'], colunas: ['produto', 'qtd'], linhasPorVersao: [3, 4, 2] } };
  const ver = (regra) => verificarRegra(regra, { deltas });

  it('passa com versão, operações, colunas e linhas da versão', () => {
    expect(ver({ delta: 'estoque', versao: 2, operacoes: ['WRITE', 'MERGE', 'DELETE'], colunas: ['produto', 'qtd'], linhasNaVersao: { versao: 1, linhas: 4 } }).ok).toBe(true);
  });

  it.each([
    [{ delta: 'dados/estoque' }, 'não existe tabela Delta em dados/estoque'],
    [{ delta: 'estoque', versao: 3 }, 'a versão atual devia ser 3, é 2'],
    [{ delta: 'estoque', operacoes: ['WRITE', 'MERGE', 'DELETE', 'OPTIMIZE'] }, 'o histórico tem WRITE, MERGE, DELETE; faltou OPTIMIZE'],
    [{ delta: 'estoque', operacoes: ['WRITE', 'MERGE'] }, 'o histórico tem WRITE, MERGE, DELETE; sobrou DELETE'],
    [{ delta: 'estoque', operacoes: ['WRITE', 'UPDATE', 'DELETE'] }, 'a operação da versão 1 devia ser UPDATE, é MERGE'],
    [{ delta: 'estoque', colunas: ['produto', 'qtd', 'preco'] }, 'colunas esperadas [produto, qtd, preco], vieram [produto, qtd]'],
    [{ delta: 'estoque', linhasNaVersao: { versao: 0, linhas: 4 } }, 'a versão 0 devia ter 4 linhas, tem 3'],
    [{ delta: 'estoque', linhasNaVersao: { versao: 7, linhas: 1 } }, 'a tabela não tem a versão 7'],
  ])('%j falha com o motivo', (regra, detalhe) => {
    expect(ver(regra)).toMatchObject({ ok: false, detalhe });
  });

  it('categorias novas', () => {
    expect(categoriaDe({ stream: 'q' })).toBe('Streaming');
    expect(categoriaDe({ modelo: 'm' })).toBe('Modelo');
    expect(categoriaDe({ delta: 't' })).toBe('Delta');
  });
});
