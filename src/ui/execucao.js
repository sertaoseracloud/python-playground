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

/** "00:10" (ou "00:10:30", quando há segundos), do momento ISO do Spark. */
const hora = (iso) => {
  const [, h, m, s] = /T(\d\d):(\d\d):(\d\d)/.exec(iso ?? '') ?? [];
  return h ? `${h}:${m}${s === '00' ? '' : `:${s}`}` : '';
};
const nomeDaConsulta = (c, i) => `consulta ${c.nome ?? i + 1}`;

/** "1 consulta, 4 micro-lotes, 12 linhas lidas, 2 descartadas, marca d'água em 00:10". */
export function falaDoStreaming(streaming) {
  const lotes = streaming.consultas.flatMap((c) => c.lotes);
  const lidas = lotes.reduce((soma, l) => soma + l.entrada, 0);
  const descartadas = lotes.reduce((soma, l) => soma + l.descartadas, 0);
  const marcas = streaming.consultas.map((c) => c.lotes.at(-1)?.marcaDagua).filter(Boolean);
  const partes = [plural(streaming.consultas.length, 'consulta', 'consultas'), plural(lotes.length, 'micro-lote', 'micro-lotes'),
    plural(lidas, 'linha lida', 'linhas lidas')];
  if (descartadas) partes.push(plural(descartadas, 'descartada', 'descartadas'));
  if (marcas.length) partes.push(`marca d'água em ${hora(marcas.at(-1))}`);
  return partes.join(', ');
}

function linhaDosLotes(c) {
  const blocos = c.lotes.map((l) => `<li class="lote-bloco"><span class="lote-id">Lote ${l.id}</span>`
    + `<span>⬇ ${l.entrada}</span><span>🗃 ${l.estado}</span>${l.marcaDagua ? `<span>⏱ ${hora(l.marcaDagua)}</span>` : ''}`
    + `<span>⬆ ${l.saida}</span>${l.descartadas ? `<span class="descartadas">✕ ${l.descartadas}</span>` : ''}</li>`).join('');
  return `<ol class="linha-dos-lotes" aria-hidden="true">${blocos}</ol>`;
}

function tabelaDosLotes(c, i) {
  const corpo = c.lotes.map((l) => `<tr><td>${l.id}</td><td class="arquivos">${esc(l.arquivos.join(', ') || '—')}</td>`
    + `<td>${l.entrada}</td><td>${l.estado}</td><td>${l.marcaDagua ? hora(l.marcaDagua) : '—'}</td><td>${l.saida}</td>`
    + `<td>${l.descartadas}</td></tr>`).join('');
  return `<table class="tabela-execucao tabela-lotes"><caption>Micro-lotes da ${esc(nomeDaConsulta(c, i))}</caption>
    <thead><tr><th scope="col">Lote</th><th scope="col">Arquivos</th><th scope="col">Linhas lidas</th><th scope="col">Estado</th><th scope="col">Marca d'água</th><th scope="col">Linhas emitidas</th><th scope="col">Descartadas</th></tr></thead>
    <tbody>${corpo}</tbody></table>`;
}

/** A parte 🌊 Micro-lotes: o resumo e, por consulta, a linha dos lotes (visual) e a tabela. */
export function htmlDosMicroLotes(streaming) {
  const consultas = streaming.consultas.map((c, i) => {
    const id = `consulta-${i + 1}-titulo`;
    const titulo = `Consulta ${c.nome ?? i + 1} · ${c.modo} · ${c.formato}`;
    return `<section class="consulta-stream" aria-labelledby="${id}"><h4 id="${id}">${esc(titulo)}</h4>${linhaDosLotes(c)}${tabelaDosLotes(c, i)}</section>`;
  }).join('');
  return `<section class="micro-lotes" aria-labelledby="micro-lotes-titulo"><h3 id="micro-lotes-titulo">🌊 Micro-lotes</h3>`
    + `<p class="resumo-streaming">${esc(falaDoStreaming(streaming))}</p>${consultas}</section>`;
}

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

/** O conteúdo da aba: os micro-lotes (com streaming), o resumo, um bloco por job e a nota. */
export function htmlDaExecucao(spark, streaming = null) {
  const lotes = streaming?.consultas?.length ? htmlDosMicroLotes(streaming) : '';
  if (!spark?.jobs?.length) return lotes;
  const jobs = spark.jobs.map((job) => {
    const id = `job-${job.id}-titulo`;
    return `<section class="job" aria-labelledby="${id}"><h3 id="${id}">${esc(tituloDoJob(job))}</h3>${linhaDoTempo(job)}${tabela(job)}</section>`;
  }).join('');
  return `${lotes}<p class="resumo-execucao">${esc(textoDaExecucao(spark))}</p>${jobs}
    <p class="nota-execucao">No Spark de verdade, um shuffle usa 200 partições por padrão; aqui são 4, para caber no navegador.
      O tempo varia de um computador para outro (por isso a correção nunca confere tempo).</p>`;
}
