// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EditorView } from 'codemirror';
import { criarTelaItem } from '../src/ui/item.js';
import { buscarItem, modulos } from '../src/conteudo/trilha.js';
import { lerRascunho, gravarRascunho, marcar } from '../src/progresso.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
const outro = modulos.flatMap((m) => m.itens).find((i) => i.tipo === 'problema').id;

describe('rascunhos integrados à tela do exercício', () => {
  let tela, view;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.body.innerHTML = corpo;
    tela = criarTelaItem({
      motor: { interromper() {} },
      layout: { aplicar() {}, mostrarDescricao() {} },
      definirStatus() {},
      aoMudarProgresso() {},
    });
    tela.abrir('livre');
    view = EditorView.findFromDOM(document.querySelector('.cm-content'));
  });
  afterEach(() => { view.destroy(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function editar(texto) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: texto } });
  }

  it('salva A antes de abrir B e não mistura seus arquivos no debounce', () => {
    const nomeA = Object.keys(buscarItem('livre').arquivos)[0];
    const nomeB = Object.keys(buscarItem(outro).arquivos)[0];
    editar('rascunho A');
    vi.advanceTimersByTime(100);
    tela.abrir(outro);
    expect(lerRascunho('livre')[nomeA]).toBe('rascunho A');
    editar('rascunho B');
    vi.advanceTimersByTime(300);
    expect(lerRascunho(outro)[nomeB]).toBe('rascunho B');
    tela.abrir('livre');
    expect(view.state.doc.toString()).toBe('rascunho A');
  });

  it('restaurar antes de 300 ms descarta definitivamente o rascunho pendente', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    editar('não deve voltar');
    vi.advanceTimersByTime(299);
    document.getElementById('btn-restaurar').click();
    vi.advanceTimersByTime(500);
    expect(lerRascunho('livre')).toBeNull();
    tela.abrir('livre');
    expect(view.state.doc.toString()).toBe(Object.values(buscarItem('livre').arquivos)[0]);
  });

  it('copiar solução invalida a gravação anterior', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    tela.abrir(outro);
    editar('não sobrescrever solução');
    document.getElementById('btn-revelar').click();
    document.getElementById('btn-usar-solucao').click();
    vi.advanceTimersByTime(500);
    expect(lerRascunho(outro)).toEqual(buscarItem(outro).solucao);
  });

  it('usar referência de projeto invalida a gravação anterior', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const etapa = modulos.flatMap((m) => m.itens).find((i) =>
      i.etapaAnterior && i.testes.filter((t) => !t.oculto).every((t) => t.regras));
    marcar(etapa.etapaAnterior, 'resolvido');
    gravarRascunho(etapa.etapaAnterior, etapa.arquivos);
    tela.abrir(etapa.id);
    editar('rascunho substituído');
    document.getElementById('btn-referencia').click();
    vi.advanceTimersByTime(500);
    expect(lerRascunho(etapa.id)).toEqual(etapa.arquivos);
  });

  it('cancelar restauração mantém a gravação pendente', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    editar('rascunho mantido');
    document.getElementById('btn-restaurar').click();
    vi.advanceTimersByTime(300);
    expect(Object.values(lerRascunho('livre'))).toContain('rascunho mantido');
  });

  it.each(['pagehide', 'hashchange'])('%s finaliza a gravação imediatamente', (evento) => {
    editar('antes de sair');
    window.dispatchEvent(new Event(evento));
    expect(Object.values(lerRascunho('livre'))).toContain('antes de sair');
  });

  it('ocultar a página finaliza a gravação imediatamente', () => {
    editar('antes de ocultar');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(Object.values(lerRascunho('livre'))).toContain('antes de ocultar');
  });

  it('falha de quota mantém o documento e mostra aviso persistente', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    editar('meu código');
    vi.advanceTimersByTime(300);
    expect(view.state.doc.toString()).toBe('meu código');
    expect(document.getElementById('aviso-armazenamento').hidden).toBe(false);
  });
});
