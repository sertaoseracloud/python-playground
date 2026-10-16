// @vitest-environment happy-dom
// Os projetos na tela: a etapa continua do código do aluno, e o módulo não tem troféu.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';
import { renderInicio } from '../src/ui/inicio.js';
import { marcar, gravarRascunho } from '../src/progresso.js';
import { buscarItem } from '../src/conteudo/trilha.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

function montar() {
  document.body.innerHTML = corpo;
  const pedidos = [];
  const motor = {
    executar: async (arquivos, opcoes) => { pedidos.push({ ...opcoes, arquivos }); return { ms: 5, retornos: [], variaveis: {}, saida: '', erro: null }; },
    interromper() {},
  };
  const tela = criarTelaItem({ motor, layout: { aplicar() {}, mostrarDescricao() {} }, definirStatus: () => {}, aoMudarProgresso: () => {} });
  tela.aoMudarEstadoPython(true);
  return { tela, pedidos };
}

async function executar(tela, id) {
  tela.abrir(id);
  await new Promise((r) => setTimeout(r, 20));
  document.getElementById('btn-executar').click();
  await new Promise((r) => setTimeout(r, 30));
}

describe('projetos na tela', () => {
  beforeEach(() => localStorage.clear());

  it('quem resolveu a etapa anterior continua do próprio código', async () => {
    const { tela, pedidos } = montar();
    const meu = { 'main.py': '# o meu código da etapa 1\n' };
    marcar('palavras-1', 'resolvido');
    gravarRascunho('palavras-1', meu);
    await executar(tela, 'palavras-2');
    expect(document.querySelector('.etapa-info').textContent).toContain('seu código');
    expect(pedidos[0].arquivos['main.py']).toBe(meu['main.py']);
  });

  it('etapa anterior resolvida, mas sem rascunho neste navegador: começa da solução de referência', async () => {
    const { tela, pedidos } = montar();
    marcar('palavras-1', 'resolvido');
    await executar(tela, 'palavras-2');
    expect(pedidos[0].arquivos['main.py']).toBe(buscarItem('palavras-1').solucao['main.py']);
  });

  it('a trilha mostra os projetos sem troféu de certificado', () => {
    document.body.innerHTML = '<main id="tela"></main>';
    const el = document.getElementById('tela');
    renderInicio(el);
    const bloco = el.querySelector('#unidade-projetos');
    expect(bloco.querySelector('.subunidade').textContent).toContain('Contagem de palavras');
    expect(bloco.querySelector('.trofeu')).toBeNull();
    expect(el.querySelector('#unidade-alem .trofeu')).not.toBeNull();
  });
});
