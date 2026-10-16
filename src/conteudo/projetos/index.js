// 🏗️ Projetos: pipelines de dados de ponta a ponta com PySpark. Cada projeto (um arquivo nesta
// pasta) tem a visão geral e 5 etapas; cada etapa continua do código da anterior (base.js).
import { projetoPalavras } from './palavras.js';
import { projetoVendasRegiao } from './vendas-regiao.js';
import { projetoLogs } from './logs.js';
import { projetoFunil } from './funil.js';
import { projetoPainel } from './painel.js';
import { projetoNotas } from './notas.js';
import { projetoMobilidade } from './mobilidade.js';

export const PROJETOS = [projetoPalavras, projetoVendasRegiao, projetoLogs, projetoFunil, projetoPainel, projetoNotas, projetoMobilidade];

export const moduloProjetos = {
  id: 'projetos',
  titulo: 'Projetos',
  icone: '🏗️',
  descricao: `Pipelines de dados de ponta a ponta com PySpark: ler, limpar, juntar, agregar e entregar. Cada projeto tem 5 etapas, e cada etapa continua do código da anterior. Já estão no ar ${PROJETOS.length} dos 18 projetos (DataFrame e SQL); os outros chegam nas próximas versões.`,
  grupos: PROJETOS.map((p) => p.grupo),
  itens: PROJETOS.flatMap((p) => p.itens),
};
