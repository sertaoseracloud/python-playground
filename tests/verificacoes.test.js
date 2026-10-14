// Regras de correção: cada tipo passa quando deve e falha com um motivo útil.
import { describe, it, expect } from 'vitest';
import { verificarRegra, detalharRegra, categoriaDe } from '../src/verificacoes.js';

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

  it('regra desconhecida é erro de quem escreveu o exercício', () => {
    expect(() => verificarRegra({ inventada: 1 }, ctx())).toThrow('Regra desconhecida');
  });
});
