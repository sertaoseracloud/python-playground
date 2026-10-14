// @vitest-environment happy-dom
// Aba ⚡ Execução: estágios, tarefas e linha do tempo, com a tabela equivalente para o leitor de tela.
import { describe, it, expect } from 'vitest';
import { htmlDaExecucao, falaDaExecucao, textoDaExecucao } from '../src/ui/execucao.js';

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
