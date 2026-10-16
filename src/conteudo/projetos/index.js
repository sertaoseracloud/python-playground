// 🏗️ Projetos: pipelines de dados de ponta a ponta com PySpark. Cada projeto (um arquivo nesta
// pasta) tem a visão geral e 5 etapas; cada etapa continua do código da anterior (base.js).
import { projetoPalavras } from './palavras.js';
import { projetoVendasRegiao } from './vendas-regiao.js';
import { projetoLogs } from './logs.js';
import { projetoFunil } from './funil.js';
import { projetoPainel } from './painel.js';
import { projetoNotas } from './notas.js';
import { projetoMobilidade } from './mobilidade.js';
import { projetoSaude } from './saude.js';
import { projetoAgro } from './agro.js';
import { projetoEnergia } from './energia.js';
import { projetoHashtags } from './hashtags.js';
import { projetoLogistica } from './logistica.js';
import { projetoSensores } from './sensores.js';
import { projetoMusica } from './musica.js';
import { projetoEtl } from './etl.js';
import { projetoQualidade } from './qualidade.js';
import { projetoRecomendacao } from './recomendacao.js';
import { projetoFraude } from './fraude.js';

export const PROJETOS = [projetoPalavras, projetoVendasRegiao, projetoLogs, projetoFunil, projetoPainel, projetoNotas, projetoMobilidade, projetoSaude, projetoAgro, projetoEnergia, projetoHashtags, projetoLogistica, projetoSensores, projetoMusica, projetoEtl, projetoQualidade, projetoRecomendacao, projetoFraude];

export const moduloProjetos = {
  id: 'projetos',
  titulo: 'Projetos',
  icone: '🏗️',
  descricao: 'Pipelines de dados de ponta a ponta com PySpark: ler, limpar, juntar, agregar e entregar. São 18 projetos de 5 etapas, em que cada etapa continua do código da anterior: DataFrame e SQL, Spark avançado e além do batch (streaming, Delta e MLlib).',
  grupos: PROJETOS.map((p) => p.grupo),
  itens: PROJETOS.flatMap((p) => p.itens),
};
