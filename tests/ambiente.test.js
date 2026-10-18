import { describe, expect, it } from 'vitest';
import { configurarAmbiente, HOMOLOGACAO, PREFIXO_ARMAZENAMENTO, SITE_ATUAL } from '../src/ambiente.js';

describe('ambientes', () => {
  it('mantém produção e homologação com armazenamento e URL separados', () => {
    expect(configurarAmbiente(false)).toEqual({
      homologacao: false,
      prefixo: 'python-playground:',
      site: 'https://sertaoseracloud.github.io/python-playground/',
    });
    expect(configurarAmbiente(true)).toEqual({
      homologacao: true,
      prefixo: 'python-playground-homologacao:',
      site: 'https://sertaoseracloud.github.io/python-playground/homologacao/',
    });
  });

  it('os testes usam o ambiente principal', () => {
    expect(HOMOLOGACAO).toBe(false);
    expect(PREFIXO_ARMAZENAMENTO).toBe('python-playground:');
    expect(SITE_ATUAL).toBe('https://sertaoseracloud.github.io/python-playground/');
  });
});
