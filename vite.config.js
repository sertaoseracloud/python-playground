import { defineConfig } from 'vite';
import { readFileSync, createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { chavePublicaDe } from './src/ed25519.js';
import { pluginHistorico, versaoDoPacote } from './scripts/plugin-historico.mjs';

// O Pyodide é servido pelo próprio site (pasta pyodide/), sem CDN de terceiros: no dev,
// direto do node_modules; no build, copiado para dist/pyodide/.
const PASTA_PYODIDE = dirname(createRequire(import.meta.url).resolve('pyodide/package.json'));
const ARQUIVOS_PYODIDE = ['pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const pyodide = {
  name: 'pyodide-no-site',
  configureServer(servidor) {
    servidor.middlewares.use('/pyodide/', (req, res, proximo) => {
      const nome = req.url.split('?')[0].replace(/^\//, '');
      if (!ARQUIVOS_PYODIDE.includes(nome)) return proximo();
      if (nome.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
      if (nome.endsWith('.mjs')) res.setHeader('Content-Type', 'text/javascript');
      createReadStream(join(PASTA_PYODIDE, nome)).pipe(res);
    });
  },
  generateBundle() {
    for (const nome of ARQUIVOS_PYODIDE) {
      this.emitFile({ type: 'asset', fileName: `pyodide/${nome}`, source: readFileSync(join(PASTA_PYODIDE, nome)) });
    }
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
    plugins: [pyodide, publicarChave(chavePublica), pluginHistorico()],
    define: {
      __CHAVE_CERTIFICADO__: JSON.stringify(derivar('certificado', valor)),
      __SEMENTE_ED25519__: JSON.stringify(semente),
      __CHAVE_PUBLICA_ED25519__: JSON.stringify(chavePublica),
      __VERSAO__: JSON.stringify(versaoDoPacote()),
    },
    optimizeDeps: { exclude: ['pyodide'] },
    worker: { format: 'es' },
    build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  };
});
