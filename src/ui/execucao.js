// Aba ⚡ Execução: o que o Spark fez para rodar o programa, como o Spark UI. Cada ação
// (show, count, collect...) é um job; cada job tem estágios separados pelos shuffles; cada
// estágio tem uma tarefa por partição, que roda num worker. A linha do tempo é só visual
// (aria-hidden): a tabela logo abaixo diz o mesmo para o leitor de tela.
import { esc } from './util.js';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const numero = (x) => String(Math.round(x * 10) / 10);
const porcento = (x) => `${Math.round(x * 100) / 100}%`;

/** "3 estágios, 1 shuffle, 4 tarefas em 4 workers" (+ os pulados, quando há). */
function resumo(spark) {
  const pulados = spark.pulados ? ` (${plural(spark.pulados, 'pulado', 'pulados')})` : '';
  return `${plural(spark.estagios, 'estágio', 'estágios')}${pulados}, ${plural(spark.shuffles, 'shuffle', 'shuffles')}, `
    + `${plural(spark.tarefas, 'tarefa', 'tarefas')} em ${plural(spark.workers, 'worker', 'workers')}`;
}

export const textoDaExecucao = (spark) => `${resumo(spark)} · ${numero(spark.ms)} ms`;
export const falaDaExecucao = (spark) => `${resumo(spark)}.`;

const tituloDoJob = (job) => `Job ${job.id} · ${/^\w+$/.test(job.acao) ? `${job.acao}()` : job.acao}`;

function descricaoDoEstagio(e) {
  const tipo = e.tipo === 'shuffle' ? `shuffle: ${plural(e.linhas_embaralhadas, 'linha embaralhada', 'linhas embaralhadas')}`
    : e.tipo === 'pulado' ? 'pulado: o shuffle já tinha rodado' : 'resultado';
  return `Estágio ${e.id} · ${e.nome} · ${tipo}`;
}

function linhaDoTempo(job) {
  const tarefas = job.estagios.flatMap((e) => e.tarefas.map((t) => ({ ...t, estagio: e.id })));
  if (!tarefas.length) return '';
  const inicio = Math.min(...tarefas.map((t) => t.inicio));
  const duracao = Math.max(...tarefas.map((t) => t.fim)) - inicio || 1;
  const workers = [...new Set(tarefas.map((t) => t.worker))].sort((a, b) => a - b);
  const faixas = workers.map((w) => {
    const barras = tarefas.filter((t) => t.worker === w).map((t) => {
      const largura = Math.max(((t.fim - t.inicio) / duracao) * 100, 0.6);
      const titulo = `Estágio ${t.estagio}, partição ${t.particao}: ${plural(t.linhas, 'linha', 'linhas')} em ${numero(t.fim - t.inicio)} ms`;
      return `<span class="barra cor-${t.estagio % 4}" style="left: ${porcento(((t.inicio - inicio) / duracao) * 100)}; width: ${porcento(largura)}" title="${esc(titulo)}">${largura >= 8 ? `E${t.estagio}·P${t.particao}` : ''}</span>`;
    }).join('');
    return `<div class="faixa"><span class="rotulo-worker">Worker ${w + 1}</span><div class="trilho">${barras}</div></div>`;
  }).join('');
  return `<div class="linha-do-tempo" aria-hidden="true">${faixas}</div>`;
}

function tabela(job) {
  const tarefas = job.estagios.flatMap((e) => e.tarefas);
  const inicio = tarefas.length ? Math.min(...tarefas.map((t) => t.inicio)) : 0;
  const corpo = job.estagios.map((e) => [
    `<tr class="estagio"><th scope="rowgroup" colspan="6">${esc(descricaoDoEstagio(e))}</th></tr>`,
    ...e.tarefas.map((t) => `<tr class="tarefa"><td>${e.id}</td><td>${t.particao}</td><td>${t.worker + 1}</td><td>${t.linhas}</td>`
      + `<td>${numero(t.inicio - inicio)}</td><td>${numero(t.fim - t.inicio)}</td></tr>`),
  ].join('')).join('');
  return `<table class="tabela-execucao"><caption>Tarefas do job ${job.id}</caption>
    <thead><tr><th scope="col">Estágio</th><th scope="col">Partição</th><th scope="col">Worker</th><th scope="col">Linhas</th><th scope="col">Início (ms)</th><th scope="col">Duração (ms)</th></tr></thead>
    <tbody>${corpo}</tbody></table>`;
}

/** O conteúdo da aba: o resumo, um bloco por job (linha do tempo + tabela) e a nota. */
export function htmlDaExecucao(spark) {
  const jobs = spark.jobs.map((job) => {
    const id = `job-${job.id}-titulo`;
    return `<section class="job" aria-labelledby="${id}"><h3 id="${id}">${esc(tituloDoJob(job))}</h3>${linhaDoTempo(job)}${tabela(job)}</section>`;
  }).join('');
  return `<p class="resumo-execucao">${esc(textoDaExecucao(spark))}</p>${jobs}
    <p class="nota-execucao">No Spark de verdade, um shuffle usa 200 partições por padrão; aqui são 4, para caber no navegador.
      O tempo varia de um computador para outro (por isso a correção nunca confere tempo).</p>`;
}
