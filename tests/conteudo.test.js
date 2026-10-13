// Todo o conteúdo da trilha: a solução de cada exercício passa em todos os casos
// (inclusive os ocultos), o código inicial falha em algum caso visível, e as lições
// rodam sem erro. Usa o Python de verdade (Pyodide no Node).
import { describe, it, expect, beforeAll } from 'vitest';
import { modulos, itens, problemas, LIVRE } from '../src/conteudo/trilha.js';
import { corrigir } from '../src/corrigir.js';
import { iniciarPython } from './python-node.js';

let executar;
beforeAll(async () => { const { sessao } = await iniciarPython(); executar = (a, o) => sessao.executar(a, o); });

describe('estrutura', () => {
  it('o 🐍 Python básico tem 40 exercícios e 10 lições, com ids únicos', () => {
    const basico = modulos.find((m) => m.id === 'basico');
    expect(basico.itens.filter((i) => i.tipo === 'problema')).toHaveLength(40);
    expect(basico.itens.filter((i) => i.tipo === 'licao')).toHaveLength(10);
    expect(new Set(itens.map((i) => i.id)).size).toBe(itens.length);
  });

  it.each(problemas.map((p) => [p.id, p]))('%s tem os campos e casos visíveis e ocultos', (_id, p) => {
    expect(p.titulo).toBeTruthy();
    expect(['facil', 'medio', 'dificil']).toContain(p.dificuldade);
    expect(p.enunciado).toContain('<');
    expect(p.dica).toBeTruthy();
    expect(p.testes.some((t) => !t.oculto)).toBe(true);
    expect(p.testes.some((t) => t.oculto)).toBe(true);
  });
});

describe('lições e playground livre rodam sem erro', () => {
  it.each([...itens.filter((i) => i.tipo === 'licao'), LIVRE].map((l) => [l.id, l]))('%s', async (_id, l) => {
    const r = await executar(l.arquivos, { entrada: l.id === 'livre' ? ['Ana'] : l.entrada ?? [] });
    expect(r.erro).toBeNull();
  });
});

describe('exercícios', () => {
  it.each(problemas.map((p) => [p.id, p]))('%s: a solução passa em todos os casos', async (_id, p) => {
    const { aprovado, relatorio } = await corrigir(p, p.solucao, executar);
    expect(relatorio.flatMap((c) => c.resultados.filter((r) => !r.ok).map((r) => `[${c.descricao}] ${r.mensagem}: ${r.detalhe}`))).toEqual([]);
    expect(aprovado).toBe(true);
  });

  it.each(problemas.map((p) => [p.id, p]))('%s: o código inicial ainda não passa', async (_id, p) => {
    expect((await corrigir(p, p.arquivos, executar, { incluirOcultos: false })).aprovado).toBe(false);
  });
});
