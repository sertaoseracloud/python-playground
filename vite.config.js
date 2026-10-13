import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chavePublicaDe } from './src/ed25519.js';
import { pluginHistorico, versaoDoPacote } from './scripts/plugin-historico.mjs';

const stub = fileURLToPath(new URL('./src/php-stub.js', import.meta.url));

// A extensão intl (intl.so + dados ICU, ~43 MB) só é baixada com withIntl,
// que o site não usa. Os imports dela viram um módulo vazio para não irem ao deploy.
const SEM_INTL = /(\/intl\.so\?url|\/icu\.dat)$/;
const VAZIO = 'virtual:sem-intl';
const semIntl = {
  name: 'sem-intl',
  enforce: 'pre',
  resolveId: (id) => (SEM_INTL.test(id) ? VAZIO : null),
  load: (id) => (id === VAZIO ? 'export default "";' : null),
};

// Os pacotes @php-wasm importam .wasm/.dat/.so esperando receber a URL do arquivo.
// O Vite 8 (Rolldown) trata .wasm como módulo WebAssembly; aqui eles voltam a ser URL.
const ARQUIVOS_PHP = /\.(wasm|dat|so|la)$/;
const ativosPhp = {
  name: 'ativos-php-como-url',
  enforce: 'pre',
  async resolveId(id, importer) {
    if (!ARQUIVOS_PHP.test(id) || !importer?.includes('@php-wasm')) return null;
    const resolvido = await this.resolve(id, importer, { skipSelf: true });
    return resolvido ? `${resolvido.id}?url` : null;
  },
};

/**
 * Chaves dos certificados. A palavra secreta vem da variável de ambiente
 * CERTIFICADO_SEGREDO (no CI, do secret do GitHub) e nunca entra no código nem no
 * site: o bundle recebe só valores derivados dela (SHA-256 com rótulos diferentes):
 *   - a chave do selo (HMAC-SHA256);
 *   - a semente Ed25519 (assinatura) e a chave pública correspondente.
 * Sem a variável, o build de produção falha; o modo dev usa um valor próprio e os
 * testes têm as chaves deles em vitest.config.js.
 */
function segredo(command) {
  const valor = process.env.CERTIFICADO_SEGREDO;
  if (valor) return valor;
  if (command === 'serve') return 'segredo-de-desenvolvimento';
  throw new Error('Defina CERTIFICADO_SEGREDO para gerar o build (veja o README, seção Certificados).');
}
const derivar = (rotulo, valor) => createHash('sha256').update(`python-playground:${rotulo}:${valor}`, 'utf8').digest('hex');

/** Publica a chave pública Ed25519 junto com o site, para quem verifica fora dele. */
const publicarChave = (chavePublica) => ({
  name: 'chave-publica-ed25519',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'chave-publica-ed25519.txt', source: `${chavePublica}\n` });
    this.emitFile({
      type: 'asset',
      fileName: 'chave-publica-ed25519.json',
      source: `${JSON.stringify({
        algoritmo: 'Ed25519',
        emissor: 'Sertão será cloud',
        chavePublicaHex: chavePublica,
        jwk: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(chavePublica, 'hex').toString('base64url') },
      }, null, 2)}\n`,
    });
  },
});

export default defineConfig(({ command }) => {
  const valor = segredo(command);
  const semente = derivar('ed25519', valor);
  const chavePublica = chavePublicaDe(semente);
  return {
    base: './',
    plugins: [semIntl, ativosPhp, publicarChave(chavePublica), pluginHistorico()],
    define: {
      __CHAVE_CERTIFICADO__: JSON.stringify(derivar('certificado', valor)),
      __SEMENTE_ED25519__: JSON.stringify(semente),
      __CHAVE_PUBLICA_ED25519__: JSON.stringify(chavePublica),
      __VERSAO__: JSON.stringify(versaoDoPacote()),
    },
    assetsInclude: [/\.dat$/, /\.wasm$/, /\.so$/, /\.la$/],
    optimizeDeps: { exclude: ['@php-wasm/web'] },
    resolve: {
      // Só o Python 3.14 entra no site; as outras versões ocupariam ~300 MB.
      alias: [{ find: /^@php-wasm\/web-(5-2|7-4|8-0|8-1|8-2|8-3|8-5)$/, replacement: stub }],
    },
    worker: { format: 'es', plugins: () => [semIntl, ativosPhp] },
    build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  };
});
