// Glossário: os termos que aparecem no texto, sem adiantar os de módulos que vêm depois.
import { describe, it, expect } from 'vitest';
import { termosDoTexto, GLOSSARIO } from '../src/conteudo/glossario.js';

const ids = (texto, modulo) => termosDoTexto(texto, { modulo }).map((t) => t.id);

describe('glossário', () => {
  it('ids únicos', () => {
    expect(new Set(GLOSSARIO.map((t) => t.id)).size).toBe(GLOSSARIO.length);
  });

  it('no PySpark, os termos do Spark aparecem', () => {
    expect(ids('Faça um join e veja o shuffle no explain', 'pyspark')).toEqual(expect.arrayContaining(['join', 'shuffle', 'explain']));
  });

  it('um termo de um módulo que vem depois não aparece antes (o join do str.join, as tarefas do Pool)', () => {
    expect(ids('Use ", ".join(nomes) para juntar a lista', 'basico')).not.toContain('join');
    expect(ids('O Pool divide as tarefas entre os processos', 'paralelismo')).not.toContain('estagio');
    expect(ids('O Pool divide as tarefas entre os processos', 'paralelismo')).toContain('processo');
  });

  it('os termos do streaming, do Delta e do MLlib só aparecem do módulo alem em diante', () => {
    const texto = "A marca d'água descarta o atrasado; o merge faz o upsert; o pipeline junta o estimador";
    expect(ids(texto, 'alem')).toEqual(expect.arrayContaining(['marca-dagua', 'upsert', 'pipeline', 'estimador']));
    expect(ids(texto, 'pyspark')).not.toContain('marca-dagua');
  });

  it('os termos dos projetos só aparecem no módulo projetos', () => {
    const texto = 'O percentil 95 das rotas; as palavras vazias saem antes; o funil de conversão da loja';
    expect(ids(texto, 'projetos')).toEqual(expect.arrayContaining(['percentil', 'palavras-vazias', 'funil']));
    expect(ids(texto, 'alem')).not.toContain('percentil');
    expect(ids(texto, 'alem')).not.toContain('funil');
  });

  it('salting, média móvel e pivot aparecem nos projetos', () => {
    const texto = 'O salting reparte a chave; a média móvel alisa a curva; o pivot vira as linhas em colunas';
    expect(ids(texto, 'projetos')).toEqual(expect.arrayContaining(['salting', 'media-movel', 'pivot']));
    expect(ids(texto, 'alem')).not.toContain('salting');
  });
});
