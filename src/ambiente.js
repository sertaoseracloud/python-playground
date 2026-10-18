const ENDERECO = 'https://sertaoseracloud.github.io/python-playground/';
const PRINCIPAL = { homologacao: false, prefixo: 'python-playground:', site: ENDERECO };
const TESTE = { homologacao: true, prefixo: 'python-playground-homologacao:', site: `${ENDERECO}homologacao/` };

export const configurarAmbiente = (homologacao) => ({ ...(homologacao ? TESTE : PRINCIPAL) });

export const HOMOLOGACAO = typeof __HOMOLOGACAO__ !== 'undefined' && __HOMOLOGACAO__ === true;
export const PREFIXO_ARMAZENAMENTO = HOMOLOGACAO ? TESTE.prefixo : PRINCIPAL.prefixo;
export const SITE_ATUAL = HOMOLOGACAO ? TESTE.site : PRINCIPAL.site;
