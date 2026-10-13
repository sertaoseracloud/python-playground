// Regras usadas pelos exercícios para conferir a página gerada pelo aluno.
// Cada regra é um objeto com uma das chaves abaixo e, opcionalmente, `msg`:
//   { contem: 'texto' }              o texto visível da página contém 'texto'
//   { naoContem: 'texto' }           o texto visível NÃO contém 'texto'
//   { seletor: 'css', min, max, igual }  quantidade de elementos que casam com o seletor
//   { seletor: 'css', texto: 'x' }   algum elemento do seletor contém o texto 'x'
//   { codigo: 'regex' }              o código-fonte do aluno casa com a regex
//   { semErros: true }               o PHP não emitiu erros nem avisos

function documento(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function normalizar(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

export function textoVisivel(html) {
  const doc = documento(html);
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  return normalizar(doc.body?.textContent ?? '');
}

function resultado(ok, regra, padrao, detalhe) {
  return { ok, mensagem: regra.msg ?? padrao, detalhe };
}

export function verificarRegra(regra, { html, erros, codigo }) {
  if ('contem' in regra) {
    const ok = textoVisivel(html).includes(normalizar(regra.contem));
    return resultado(ok, regra, `A página deve mostrar "${regra.contem}"`, ok ? undefined : 'texto não encontrado');
  }
  if ('naoContem' in regra) {
    const ok = !textoVisivel(html).includes(normalizar(regra.naoContem));
    return resultado(ok, regra, `A página não deve mostrar "${regra.naoContem}"`, ok ? undefined : 'texto encontrado');
  }
  if ('seletor' in regra && 'texto' in regra) {
    const esperado = normalizar(regra.texto);
    const elementos = [...documento(html).querySelectorAll(regra.seletor)];
    const ok = elementos.some((e) => normalizar(e.textContent).includes(esperado));
    return resultado(ok, regra, `Um elemento "${regra.seletor}" deve conter "${regra.texto}"`,
      ok ? undefined : `nenhum "${regra.seletor}" com esse texto`);
  }
  if ('seletor' in regra) {
    const qtd = documento(html).querySelectorAll(regra.seletor).length;
    const { min, max, igual } = regra;
    let ok;
    let padrao;
    if (igual !== undefined) {
      ok = qtd === igual;
      padrao = `A página deve ter exatamente ${igual} elemento(s) "${regra.seletor}"`;
    } else {
      ok = qtd >= (min ?? 1) && (max === undefined || qtd <= max);
      padrao = max === undefined
        ? `A página deve ter pelo menos ${min ?? 1} elemento(s) "${regra.seletor}"`
        : `A página deve ter entre ${min ?? 0} e ${max} elemento(s) "${regra.seletor}"`;
    }
    return resultado(ok, regra, padrao, ok ? undefined : `encontrei ${qtd} elemento(s) "${regra.seletor}"`);
  }
  if ('codigo' in regra) {
    const ok = new RegExp(regra.codigo, 'i').test(codigo);
    return resultado(ok, regra, `O código deve usar ${regra.codigo}`);
  }
  if ('semErros' in regra) {
    const ok = !erros || erros.trim() === '';
    return resultado(ok, regra, 'O PHP não deve mostrar erros nem avisos', ok ? undefined : erros.trim().split('\n')[0]);
  }
  throw new Error(`Regra desconhecida: ${JSON.stringify(regra)}`);
}

// ---------- detalhes para a aba Testes ----------
//
// Além de "passou / não passou", cada verificação mostra a categoria, o que a página
// tinha de fato (também quando passa) e, quando falha, uma dica de onde mexer.

export function categoriaDe(regra) {
  if ('contem' in regra || 'naoContem' in regra) return 'Texto da página';
  if ('seletor' in regra) return 'Elemento HTML';
  if ('codigo' in regra) return 'Código';
  if ('semErros' in regra) return 'Execução';
  return 'Verificação';
}

const corta = (t, n = 140) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Trecho do texto em volta de `alvo`, para mostrar onde ele aparece. */
function trechoEmVolta(texto, alvo) {
  const i = texto.indexOf(alvo);
  if (i < 0) return '';
  const ini = Math.max(0, i - 40);
  const fim = Math.min(texto.length, i + alvo.length + 40);
  return `${ini > 0 ? '…' : ''}${texto.slice(ini, fim)}${fim < texto.length ? '…' : ''}`;
}

const primeiraLinhaDoErro = (erros) => (erros ?? '').trim().split('\n').find((l) => l.trim()) ?? '';

/** O que a página (ou o código) tinha de fato, para o ponto que a regra confere. */
function obtidoDe(regra, { html, erros, codigo }) {
  if ('semErros' in regra) return erros?.trim() ? corta(primeiraLinhaDoErro(erros)) : 'nenhum erro nem aviso';
  if ('contem' in regra || 'naoContem' in regra) {
    const texto = textoVisivel(html ?? '');
    if (!texto) return 'a página saiu vazia';
    const alvo = normalizar(regra.contem ?? regra.naoContem);
    return texto.includes(alvo) ? `“${trechoEmVolta(texto, alvo)}”` : `a página mostra: “${corta(texto, 120)}”`;
  }
  if ('seletor' in regra) {
    const elementos = [...documento(html ?? '').querySelectorAll(regra.seletor)];
    if (!elementos.length) return `nenhum elemento "${regra.seletor}"`;
    if ('texto' in regra) return elementos.slice(0, 3).map((e) => `“${corta(normalizar(e.textContent), 50)}”`).join(', ') + (elementos.length > 3 ? ` e mais ${elementos.length - 3}` : '');
    return `${elementos.length} elemento(s) "${regra.seletor}"`;
  }
  if ('codigo' in regra) {
    const linha = (codigo ?? '').split('\n').find((l) => new RegExp(regra.codigo, 'i').test(l));
    return linha ? `linha: ${corta(linha.trim(), 100)}` : 'não aparece no código';
  }
  return undefined;
}

function dicaDe(regra, { erros }) {
  if (!('semErros' in regra) && /Fatal error|Parse error/i.test(erros ?? '')) return 'O PHP parou com erro antes de terminar a página: corrija esse erro primeiro (a mensagem diz o arquivo e a linha).';
  if ('semErros' in regra) return 'Leia a mensagem: ela diz o tipo (Warning, Notice, Fatal error), o arquivo e a linha. Variável não definida e índice inexistente são os mais comuns.';
  if ('contem' in regra) return 'Confira o texto exato (acentos, maiúsculas e espaços) e se o echo está no lugar certo. Veja a aba 🧾 HTML gerado.';
  if ('naoContem' in regra) return 'Esse texto não deveria aparecer neste cenário: confira o if, o filtro da consulta (WHERE) ou o htmlspecialchars.';
  if ('seletor' in regra && 'texto' in regra) return `Confira o texto dentro dos elementos "${regra.seletor}" e de onde ele vem (variável, $_GET, banco).`;
  if ('seletor' in regra) return `Confira as tags geradas (aba 🧾 HTML gerado): o laço que cria os "${regra.seletor}", a consulta SQL e as classes.`;
  if ('codigo' in regra) return 'O enunciado pede essa forma de escrever (por exemplo prepare, foreach ou include): releia o passo correspondente.';
  return undefined;
}

/** O resultado da regra com categoria, valor obtido e dica (para a aba Testes). */
export function detalharRegra(regra, pagina) {
  const base = verificarRegra(regra, pagina);
  const obtido = obtidoDe(regra, pagina);
  return {
    ...base,
    categoria: categoriaDe(regra),
    ...(obtido !== undefined ? { obtido } : {}),
    ...(base.ok ? {} : { dica: dicaDe(regra, pagina) }),
  };
}

export { primeiraLinhaDoErro };

/**
 * A regra em linguagem simples, para a seção "Como saber que deu certo".
 * Regras de código sem `msg` são regex e ficariam confusas: devolve null.
 */
export function descreverRegra(regra) {
  if (regra.msg) return regra.msg;
  if ('contem' in regra) return `A página mostra "${regra.contem}"`;
  if ('naoContem' in regra) return `A página não mostra "${regra.naoContem}"`;
  if ('seletor' in regra && 'texto' in regra) return `Tem um elemento ${regra.seletor} com o texto "${regra.texto}"`;
  if ('seletor' in regra) {
    const { min, max, igual } = regra;
    if (igual !== undefined) return `Tem exatamente ${igual} elemento(s) ${regra.seletor}`;
    if (max !== undefined) return `Tem de ${min ?? 0} a ${max} elemento(s) ${regra.seletor}`;
    return (min ?? 1) === 1 ? `Tem um elemento ${regra.seletor}` : `Tem pelo menos ${min} elementos ${regra.seletor}`;
  }
  if ('semErros' in regra) return 'O PHP roda sem erros nem avisos';
  return null;
}
