import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dist, modo, opcao, outro] = process.argv.slice(2);
if (!dist || !['principal', 'homologacao'].includes(modo)) {
  console.error('uso: node scripts/conferir-build.mjs <dist> <principal|homologacao> [--comparar <outro-dist>]');
  process.exit(2);
}

const erros = [];
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const bundle = readdirSync(join(dist, 'assets'))
  .filter((arquivo) => arquivo.endsWith('.js'))
  .map((arquivo) => readFileSync(join(dist, 'assets', arquivo), 'utf8'))
  .join('\n');
const sitemap = existsSync(join(dist, 'sitemap.xml'));
const noindex = html.includes('<meta name="robots" content="noindex">');

if (modo === 'principal') {
  if (!sitemap) erros.push('falta o sitemap.xml');
  if (noindex) erros.push('o index.html tem noindex');
  if (!/["'`]python-playground:["'`]/.test(bundle)) erros.push('o bundle não usa o prefixo python-playground:');
  if (bundle.includes('python-playground-homologacao:')) erros.push('o bundle traz o prefixo da homologação');
} else {
  if (sitemap) erros.push('a homologação não pode ter sitemap.xml');
  if (!noindex) erros.push('falta o noindex no index.html');
  if (!bundle.includes('python-playground-homologacao:')) erros.push('o bundle não usa o prefixo python-playground-homologacao:');
}

if (opcao === '--comparar') {
  const chave = (diretorio) => readFileSync(join(diretorio, 'chave-publica-ed25519.txt'), 'utf8').trim();
  if (chave(dist) === chave(outro)) erros.push(`a chave pública dos certificados é a mesma de ${outro}`);
}

if (erros.length) {
  console.error(`conferir-build (${modo}, ${dist}):\n  - ${erros.join('\n  - ')}`);
  process.exit(1);
}
console.log(`conferir-build (${modo}, ${dist}): ok`);
