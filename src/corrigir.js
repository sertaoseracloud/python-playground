import { detalharRegra, primeiraLinhaDoErro } from './verificacoes.js';

const agora = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

/** Como a chamada aparece no relatório: dobro(3), saudacao("Ana", "Oi"). */
export const textoDaChamada = (r) => `${r.funcao}(${(r.args ?? []).map((a) => JSON.stringify(a)).join(', ')})`;

/**
 * Roda os casos de teste do problema com os arquivos do aluno.
 * - "Executar" usa só os casos visíveis; "Enviar" inclui os ocultos (`oculto: true`).
 * - Cada caso tem `dados` (arquivos que trocam os do exercício), `entrada` (as linhas do input()) e `regras`; as regras `funcao`
 *   viram chamadas feitas depois do programa rodar, no mesmo escopo.
 * `executar(arquivos, { entrada, chamadas })` devolve o resultado do runtime.
 */
export async function corrigir(problema, arquivos, executar, { incluirOcultos = true } = {}) {
  const codigo = Object.values(arquivos).join('\n');
  const relatorio = [];
  for (const teste of problema.testes.filter((t) => incluirOcultos || !t.oculto)) {
    const inicio = agora();
    const regrasDeFuncao = teste.regras.filter((r) => 'funcao' in r);
    const chamadas = regrasDeFuncao.map((r) => ({ funcao: r.funcao, args: r.args ?? [] }));
    // Os dados do exercício e os do caso valem mais que um arquivo de mesmo nome do aluno.
    const dadosDoCaso = teste.dados ?? {};
    // As métricas das regras `modelo` são calculadas pelo executor, depois do programa, nos dados de teste do caso.
    const avaliacoes = teste.regras.filter((r) => 'modelo' in r && r.metrica)
      .map((r) => ({ variavel: r.modelo, nome: r.metrica.nome, dados: r.metrica.dados, ...(r.metrica.preparar ? { preparar: r.metrica.preparar } : {}) }));
    const r = await executar({ ...arquivos, ...(problema.dados ?? {}), ...dadosDoCaso }, { entrada: teste.entrada ?? [], chamadas, avaliacoes });
    const resultados = teste.regras.map((regra) => detalharRegra(regra, {
      saida: r.saida, erro: r.erro, variaveis: r.variaveis, codigo, arquivos: r.arquivos_gerados ?? {}, paralelismo: r.paralelismo,
      tabelas: r.tabelas ?? {},
      streaming: r.streaming ?? null, deltas: r.deltas ?? {}, modelos: r.modelos ?? {},
      retorno: r.retornos?.[regrasDeFuncao.indexOf(regra)],
    }));
    const erroExecucao = primeiraLinhaDoErro(r.erro) || undefined;
    relatorio.push({
      descricao: teste.descricao,
      oculto: Boolean(teste.oculto),
      ok: resultados.every((x) => x.ok),
      resultados,
      cenario: { entrada: teste.entrada ?? [], chamadas: regrasDeFuncao.map(textoDaChamada), dados: Object.keys(dadosDoCaso) },
      ...(erroExecucao ? { erroExecucao } : {}),
      ms: Math.max(1, Math.round(agora() - inicio)),
    });
  }
  return { aprovado: relatorio.every((t) => t.ok), relatorio };
}
