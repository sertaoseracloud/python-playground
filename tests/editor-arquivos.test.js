// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { language, syntaxTree } from '@codemirror/language';
import { undo } from '@codemirror/commands';
import { EditorArquivos } from '../src/ui/editor.js';

const principal = 'main.py';
const codigo = 'print("inicial")';
const casos = [
  ['main.py', codigo, 'Python', 'python'],
  ['dados.csv', 'nome,total\nAna,2', 'CSV (texto simples)', null],
  ['dados.json', '{"x":1}', 'JSON', 'json'],
  ['notas.txt', 'anotações', 'texto simples', null],
];

describe('editor de arquivos', () => {
  let editor;
  const mudar = vi.fn();
  // happy-dom dispara selectionchange síncrono; navegadores o enfileiram.
  const selecaoSincrona = (evento) => evento.stopImmediatePropagation();
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="abas"></div><div id="editor"></div><div id="anuncio"></div>';
    document.addEventListener('selectionchange', selecaoSincrona);
    editor = new EditorArquivos({ abas: document.getElementById('abas'), editor: document.getElementById('editor'), aoMudar: mudar });
    editor.carregar(Object.fromEntries(casos.map(([nome, texto]) => [nome, texto])));
    mudar.mockClear();
  });
  afterEach(() => {
    editor.view.destroy();
    document.removeEventListener('selectionchange', selecaoSincrona);
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  it.each(casos)('%s tem modo e nome acessível próprios', (nome, texto, rotulo, modo) => {
    editor.abrir(nome);
    expect(editor.view.contentDOM.getAttribute('aria-label')).toBe(`Editor de ${rotulo}: ${nome}`);
    expect(editor.view.state.facet(language)?.name ?? null).toBe(modo);
    expect(editor.view.state.doc.toString()).toBe(texto);
    if (modo) expect(syntaxTree(editor.view.state).length).toBe(texto.length);
  });

  it('mantém seleção e histórico ao alternar abas', () => {
    editor.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: 'alterado' }, selection: { anchor: 3 } });
    editor.abrir('dados.json');
    editor.abrir(principal);
    expect(editor.view.state.selection.main.anchor).toBe(3);
    expect(editor.view.state.doc.toString()).toBe('alterado');
    expect(undo(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe(codigo);
  });

  it.each([true, false])('excluir arquivo ativo=%s devolve foco ao editor atual e anuncia', (ativo) => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    if (ativo) editor.abrir('dados.json');
    const excluir = document.querySelector('[aria-label="Excluir dados.json"]');
    excluir.focus();
    excluir.click();
    expect(editor.arquivos['dados.json']).toBeUndefined();
    expect(editor.atual).toBe(principal);
    expect(document.activeElement).toBe(editor.view.contentDOM);
    expect(mudar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(80);
    expect(document.getElementById('anuncio').textContent).toBe(`Arquivo dados.json excluído. Editor de ${principal} ativo.`);
  });

  it('cancelar exclusão mantém arquivo e botão focado', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const excluir = document.querySelector('[aria-label="Excluir dados.json"]');
    excluir.focus();
    excluir.click();
    expect(document.activeElement).toBe(excluir);
    expect(editor.arquivos['dados.json']).toBeDefined();
    expect(mudar).not.toHaveBeenCalled();
  });
});
