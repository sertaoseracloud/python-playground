import { detalharRegra, primeiraLinhaDoErro } from './verificacoes.js';

const agora = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

/**
 * Roda os casos de teste do problema com os arquivos do aluno.
 *
 * - "Executar" usa só os casos visíveis; "Enviar" inclui os ocultos (`oculto: true`).
 * - Cada caso pode trocar o banco (`banco: 'SQL'`); senão usa o banco do problema.
 *   Bancos diferentes nos casos ocultos impedem respostas fixas no código.
 * - Um caso pode ter `passos`: uma sequência de requisições que compartilham
 *   sessão ($_SESSION) e banco, como um usuário de verdade (login → publicar →
 *   ver o feed). Cada passo pode ter as próprias `regras`.
 *
 * `executar(arquivos, { url, metodo, corpo }, banco, { novaSessao, manterBanco, contexto })`
 * deve devolver { html, erros }.
 *
 * Cada caso do relatório traz, além do resultado das regras (com categoria, valor
 * obtido e dica; veja detalharRegra), o cenário (as requisições feitas), se usou um
 * banco diferente do exemplo, o primeiro erro do PHP e o tempo.
 */
export async function corrigir(problema, arquivos, executar, { incluirOcultos = true } = {}) {
  const codigo = Object.values(arquivos).join('\n');
  const casos = problema.testes.filter((t) => incluirOcultos || !t.oculto);
  const relatorio = [];
  for (const teste of casos) {
    const inicio = agora();
    const seed = teste.banco ?? problema.banco;
    const banco = seed ? { seed } : undefined;
    const passos = teste.passos ?? [teste];
    const resultados = [];
    const cenario = [];
    let erroExecucao;
    for (const [i, passo] of passos.entries()) {
      const resposta = await executar(
        arquivos,
        { url: passo.url, metodo: passo.metodo, corpo: passo.corpo },
        banco,
        { novaSessao: i === 0, manterBanco: i > 0, contexto: 'testes' },
      );
      const pagina = { html: resposta.html, erros: resposta.erros, codigo };
      cenario.push({ metodo: passo.metodo ?? 'GET', url: passo.url ?? 'index.php', ...(passo.corpo ? { corpo: passo.corpo } : {}) });
      erroExecucao ??= primeiraLinhaDoErro(resposta.erros) || undefined;
      resultados.push(...(passo.regras ?? []).map((regra) => detalharRegra(regra, pagina)));
    }
    relatorio.push({
      descricao: teste.descricao,
      oculto: Boolean(teste.oculto),
      ok: resultados.every((r) => r.ok),
      resultados,
      cenario,
      bancoProprio: Boolean(teste.banco),
      ...(erroExecucao ? { erroExecucao } : {}),
      ms: Math.max(1, Math.round(agora() - inicio)),
    });
  }
  return { aprovado: relatorio.every((t) => t.ok), relatorio };
}
