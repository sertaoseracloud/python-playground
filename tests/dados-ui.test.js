// @vitest-environment happy-dom
// Aba 📦 Dados: CSV vira tabela acessível; os outros arquivos, bloco de texto.
import { describe, it, expect } from 'vitest';
import { htmlDosDados } from '../src/ui/dados.js';

describe('aba 📦 Dados', () => {
  it('CSV vira tabela com legenda e cabeçalho; aspas e vírgulas dentro de aspas funcionam', () => {
    const el = document.createElement('div');
    el.innerHTML = htmlDosDados({ 'vendas.csv': 'produto,preco\n"Arroz, 5kg",24.90\n' });
    expect(el.querySelector('caption').textContent).toContain('vendas.csv');
    expect([...el.querySelectorAll('th')].map((t) => t.textContent)).toEqual(['produto', 'preco']);
    expect(el.querySelector('td').textContent).toBe('Arroz, 5kg');
  });

  it('mostra até 50 linhas e avisa quantas faltam; outros arquivos vão em bloco de texto', () => {
    const csv = ['n', ...Array.from({ length: 60 }, (_, i) => String(i))].join('\n');
    const el = document.createElement('div');
    el.innerHTML = htmlDosDados({ 'muitos.csv': csv, 'pedidos.json': '[1]' });
    expect(el.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(el.textContent).toContain('e mais 10 linhas');
    expect(el.querySelector('pre').textContent).toBe('[1]');
  });
});
