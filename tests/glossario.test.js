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
});
