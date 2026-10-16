// Monta um projeto com etapas encadeadas (o mesmo modelo do DivergePHP).
//
// Cada etapa declara só o que muda: `codigo` entra no fim do main.py, e `alteracoes` troca
// arquivos (null apaga um arquivo). A solução da etapa N é a da etapa N-1 com essas mudanças,
// e o código inicial da etapa N é a solução da N-1. Assim o aluno constrói o pipeline aos
// poucos. Na tela, quem resolveu a etapa anterior continua do próprio código (src/ui/item.js).
import { programa } from '../pyspark-comum.js';

const comFimDeLinha = (texto) => texto.replace(/\n*$/, '\n');

function aplicar(base, { codigo, alteracoes = {} }) {
  const resultado = { ...base };
  if (codigo) resultado['main.py'] = `${comFimDeLinha(resultado['main.py'])}\n${comFimDeLinha(codigo)}`;
  for (const [nome, conteudo] of Object.entries(alteracoes)) {
    if (conteudo === null) delete resultado[nome];
    else resultado[nome] = conteudo;
  }
  // main.py sempre primeiro: é o arquivo que roda.
  const { 'main.py': principal, ...resto } = resultado;
  return principal === undefined ? resultado : { 'main.py': principal, ...resto };
}

export function criarProjeto({ id, titulo, icone, descricao, resumo, dados, oculto, inicial, etapas }) {
  const grupo = { id, titulo, icone, descricao };
  const arquivos = programa(id, inicial);
  const itens = [{ id: `${id}-visao-geral`, tipo: 'licao', grupo: id, titulo: 'Visão geral do projeto', resumo, arquivos, dados }];

  let anterior = arquivos;
  let idAnterior = null;
  etapas.forEach((etapa, i) => {
    const solucao = aplicar(anterior, etapa);
    const item = {
      id: `${id}-${i + 1}`,
      tipo: 'problema',
      grupo: id,
      projeto: grupo,
      etapa: i + 1,
      totalEtapas: etapas.length,
      etapaAnterior: idAnterior,
      titulo: `Etapa ${i + 1}: ${etapa.titulo}`,
      dificuldade: etapa.dificuldade,
      enunciado: etapa.enunciado,
      dica: etapa.dica,
      dados,
      arquivos: anterior,
      solucao,
      testes: [
        { descricao: Object.keys(dados)[0], regras: etapa.regras },
        { descricao: 'outros dados', oculto: true, dados: oculto, regras: etapa.regrasOcultas ?? etapa.regras },
      ],
    };
    itens.push(item);
    anterior = solucao;
    idAnterior = item.id;
  });

  return { grupo, itens };
}
