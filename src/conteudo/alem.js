// 🌊 Spark além do batch: 12 lições e 36 exercícios em três áreas, na ordem Delta Lake →
// Structured Streaming → MLlib (alem-delta.js, alem-streaming.js e alem-mllib.js).
import { licoesDelta, exerciciosDelta } from './alem-delta.js';
import { licoesStreaming, exerciciosStreaming } from './alem-streaming.js';
import { licoesMllib, exerciciosMllib } from './alem-mllib.js';

const ex = Object.fromEntries([...exerciciosDelta, ...exerciciosStreaming, ...exerciciosMllib].map((e) => [e.id, e]));
const itens = (...ids) => ids.map((id) => ex[id]);

export const moduloAlem = {
  id: 'alem',
  titulo: 'Spark além do batch',
  icone: '🌊',
  descricao: "Delta Lake (versões, merge e time travel), Structured Streaming (micro-lotes, janelas e marca d'água) e MLlib (pipelines, regressão, classificação e agrupamento). Uma implementação para aprender, com a API do Spark, rodando no seu navegador.",
  itens: [
    licoesDelta.tabela, ...itens('dl-gravar', 'dl-append'),
    licoesDelta.historico, ...itens('dl-versao', 'dl-voltar'),
    licoesDelta.merge, ...itens('dl-update', 'dl-delete', 'dl-merge', 'dl-historico', 'dl-desfazer'),
    licoesDelta.manutencao, ...itens('dl-schema', 'dl-vacuum', 'dl-optimize'),
    licoesStreaming.microLotes, ...itens('st-rate', 'st-ler'),
    licoesStreaming.fontes, ...itens('st-filtro', 'st-max-files', 'st-sql'),
    licoesStreaming.modos, ...itens('st-complete', 'st-update', 'st-alerta'),
    licoesStreaming.janelas, ...itens('st-janela', 'st-deslizante', 'st-marca', 'st-fechadas'),
    licoesMllib.features, ...itens('ml-vetor', 'ml-scaler'),
    licoesMllib.pipeline, ...itens('ml-indexer', 'ml-pipeline'),
    licoesMllib.modelos, ...itens('ml-linear', 'ml-logistica', 'ml-arvore'),
    licoesMllib.avaliacao, ...itens('ml-rmse', 'ml-auc', 'ml-kmeans', 'ml-comparar', 'ml-novos'),
  ],
};
