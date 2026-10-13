/** Template para código Python: tira a indentação comum e a primeira quebra de linha. */
export function py(partes, ...valores) {
  const texto = partes.reduce((acc, parte, i) => acc + parte + (valores[i] ?? ''), '').replace(/^\n/, '');
  const margem = Math.min(...texto.split('\n').filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return texto.split('\n').map((l) => l.slice(margem)).join('\n').replace(/\s*$/, '\n');
}
export const main = (codigo) => ({ 'main.py': codigo });
