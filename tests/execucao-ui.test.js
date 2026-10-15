// @vitest-environment happy-dom
// Aba ⚡ Execução: estágios, tarefas e linha do tempo, com a tabela equivalente para o leitor de tela.
import { describe, it, expect } from 'vitest';
import { htmlDaExecucao, falaDaExecucao, falaDoStreaming, textoDaExecucao } from '../src/ui/execucao.js';

const tarefa = (particao, worker, inicio, fim) => ({ particao, worker, linhas: 2, inicio, fim });
const SPARK = {
  jobs: [{
    id: 1, acao: 'show',
    estagios: [
      { id: 1, nome: 'csv → groupBy', tipo: 'shuffle', linhas_embaralhadas: 6, tarefas: [tarefa(0, 0, 0, 10)] },
      { id: 2, nome: 'groupBy', tipo: 'resultado', linhas_embaralhadas: 0, tarefas: [0, 1, 2, 3].map((p) => tarefa(p, p, 12, 20)) },
    ],
  }],
  estagios: 2, shuffles: 1, tarefas: 5, workers: 4, ms: 20,
};

describe('aba ⚡ Execução', () => {
  it('fala o resumo', () => {
    expect(falaDaExecucao(SPARK)).toBe('2 estágios, 1 shuffle, 5 tarefas em 4 workers.');
    expect(falaDaExecucao({ ...SPARK, estagios: 1, shuffles: 0, tarefas: 1, workers: 1 })).toBe('1 estágio, 0 shuffles, 1 tarefa em 1 worker.');
    expect(textoDaExecucao(SPARK)).toBe('2 estágios, 1 shuffle, 5 tarefas em 4 workers · 20 ms');
  });

  it('mostra cada job com a linha do tempo escondida do leitor e a tabela equivalente', () => {
    document.body.innerHTML = `<div id="x">${htmlDaExecucao(SPARK)}</div>`;
    expect(document.querySelector('h3').textContent).toBe('Job 1 · show()');
    expect(document.querySelector('.linha-do-tempo').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('.linha-do-tempo .faixa')).toHaveLength(4);
    expect(document.querySelectorAll('.linha-do-tempo .barra')).toHaveLength(5);
    expect(document.querySelector('caption').textContent).toBe('Tarefas do job 1');
    expect(document.querySelectorAll('tbody tr.tarefa')).toHaveLength(5);
    expect(document.querySelector('tbody tr.estagio').textContent).toContain('6 linhas embaralhadas');
    expect(document.getElementById('x').textContent).toContain('200 partições');
    expect(document.querySelector('section').getAttribute('aria-labelledby')).toBe(document.querySelector('h3').id);
  });

  it('a barra fica na posição do tempo dela dentro do job e diz estágio, partição, linhas e duração', () => {
    document.body.innerHTML = htmlDaExecucao(SPARK);
    const barra = document.querySelector('.linha-do-tempo .barra');
    expect(barra.style.left).toBe('0%');
    expect(barra.style.width).toBe('50%');
    expect(barra.getAttribute('title')).toBe('Estágio 1, partição 0: 2 linhas em 10 ms');
  });

  it('o estágio que reaproveitou um shuffle aparece como pulado, sem tarefas', () => {
    const comPulado = {
      ...SPARK,
      jobs: [{ id: 2, acao: 'collect', estagios: [{ id: 3, nome: 'csv → groupBy', tipo: 'pulado', linhas_embaralhadas: 0, tarefas: [] }, ...SPARK.jobs[0].estagios.slice(1)] }],
    };
    document.body.innerHTML = htmlDaExecucao(comPulado);
    expect(document.querySelector('tbody tr.estagio').textContent).toContain('pulado: o shuffle já tinha rodado');
  });

  it('job sem tarefas não quebra a linha do tempo', () => {
    const vazio = { jobs: [{ id: 1, acao: 'count', estagios: [] }], estagios: 0, shuffles: 0, tarefas: 0, workers: 0, ms: 0 };
    expect(() => htmlDaExecucao(vazio)).not.toThrow();
  });
});

const lote = (id, entrada, arquivos, estado, marca, saida, descartadas) => ({
  id, entrada, arquivos, estado, marcaDagua: marca && `2026-01-01T00:${marca}:00.000Z`, saida, descartadas,
});
const STREAM = {
  consultas: [{
    nome: 'janelas', modo: 'append', formato: 'memory',
    lotes: [lote(0, 3, ['lote-01.csv'], 2, '02', 0, 0), lote(1, 2, ['lote-02.csv'], 3, '15', 0, 0),
      lote(2, 2, ['lote-03.csv'], 3, '31', 1, 1), lote(3, 0, [], 1, '31', 2, 0)],
  }],
};

describe('aba ⚡ Execução: 🌊 Micro-lotes', () => {
  it('fala o resumo dos micro-lotes', () => {
    expect(falaDoStreaming(STREAM)).toBe("1 consulta, 4 micro-lotes, 7 linhas lidas, 1 descartada, marca d'água em 00:31");
    const simples = { consultas: [{ nome: null, modo: 'append', formato: 'console', lotes: [lote(0, 1, ['a.csv'], 0, null, 1, 0)] }] };
    expect(falaDoStreaming(simples)).toBe('1 consulta, 1 micro-lote, 1 linha lida');
  });

  it('mostra a linha dos lotes escondida do leitor e a tabela equivalente', () => {
    document.body.innerHTML = htmlDaExecucao(SPARK, STREAM);
    expect(document.querySelector('.micro-lotes h3').textContent).toBe('🌊 Micro-lotes');
    expect(document.querySelector('.micro-lotes h4').textContent).toBe('Consulta janelas · append · memory');
    expect(document.querySelector('.linha-dos-lotes').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('.linha-dos-lotes .lote-bloco')).toHaveLength(4);
    expect(document.querySelector('.tabela-lotes caption').textContent).toBe('Micro-lotes da consulta janelas');
    const colunas = [...document.querySelectorAll('.tabela-lotes thead th')].map((th) => th.textContent);
    expect(colunas).toEqual(['Lote', 'Arquivos', 'Linhas lidas', 'Estado', "Marca d'água", 'Linhas emitidas', 'Descartadas']);
    const ultima = [...document.querySelectorAll('.tabela-lotes tbody tr')].at(-1);
    expect([...ultima.children].map((td) => td.textContent)).toEqual(['3', '—', '0', '1', '00:31', '2', '0']);
    expect(document.querySelector('h3 + p.resumo-streaming')).not.toBeNull();
    expect(document.querySelector('.job')).not.toBeNull(); // os jobs continuam embaixo
  });

  it('sem jobs do Spark, mostra só os micro-lotes', () => {
    document.body.innerHTML = htmlDaExecucao(null, STREAM);
    expect(document.querySelector('.micro-lotes')).not.toBeNull();
    expect(document.querySelector('.resumo-execucao')).toBeNull();
  });
});
