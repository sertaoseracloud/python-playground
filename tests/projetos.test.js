// Módulo 🏗️ Projetos: cada projeto tem a visão geral e 5 etapas encadeadas.
import { describe, it, expect } from 'vitest';
import { modulos, PROXIMOS_MODULOS } from '../src/conteudo/trilha.js';

// Os projetos já publicados, na ordem da trilha.
const IDS = ['palavras', 'vendas-regiao', 'logs', 'funil', 'painel', 'notas', 'mobilidade', 'saude', 'agro', 'energia', 'hashtags', 'logistica', 'sensores'];
const m = modulos.find((x) => x.id === 'projetos');
const doProjeto = (id) => m.itens.filter((i) => i.grupo === id);
const etapas = (id) => doProjeto(id).filter((i) => i.tipo === 'problema');

describe('módulo projetos', () => {
  it('vem por último, e não há mais módulos "em breve"', () => {
    expect(modulos.at(-1)).toBe(m);
    expect(m).toMatchObject({ titulo: 'Projetos', icone: '🏗️' });
    expect(m.grupos.map((g) => g.id)).toEqual(IDS);
    expect(PROXIMOS_MODULOS).toEqual([]);
  });

  it.each(IDS)('%s: visão geral e 5 etapas (fácil, médio, médio, difícil, difícil)', (id) => {
    expect(doProjeto(id)[0]).toMatchObject({ id: `${id}-visao-geral`, tipo: 'licao' });
    expect(etapas(id).map((i) => i.dificuldade)).toEqual(['facil', 'medio', 'medio', 'dificil', 'dificil']);
  });

  it.each(IDS)('%s: cada etapa começa da solução da anterior, com o main.py primeiro', (id) => {
    etapas(id).forEach((e, n) => {
      expect(e.etapaAnterior).toBe(n ? etapas(id)[n - 1].id : null);
      if (n) expect(e.arquivos).toEqual(etapas(id)[n - 1].solucao);
      expect(Object.keys(e.solucao)[0]).toBe('main.py');
    });
  });

  it.each(IDS)('%s: o caso oculto só troca arquivos que o visível tem', (id) => {
    for (const e of etapas(id)) {
      const oculto = e.testes.find((t) => t.oculto);
      expect(Object.keys(oculto.dados).every((nome) => nome in e.dados)).toBe(true);
    }
  });
});
