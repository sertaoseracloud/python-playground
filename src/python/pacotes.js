// Grava os pacotes da pasta python/ (diverge_runtime e vendor/) no sistema de arquivos do
// Pyodide e os coloca no sys.path. `fontes` = { 'caminho/.../python/x.py': 'código' }.
// Fica separado de sessao.js porque o worker de testes no Node roda fora do Vite (sem
// import.meta.glob) e recebe as fontes prontas.
export const RAIZ = '/lib/diverge';

export function montarPacotes(pyodide, fontes) {
  for (const [caminho, fonte] of Object.entries(fontes)) {
    const destino = `${RAIZ}/${caminho.replace(/^.*?python\//, '')}`;
    pyodide.FS.mkdirTree(destino.slice(0, destino.lastIndexOf('/')));
    pyodide.FS.writeFile(destino, fonte);
  }
  pyodide.runPython(`import sys\nfor _p in ('${RAIZ}/vendor', '${RAIZ}'):\n    if _p not in sys.path: sys.path.insert(0, _p)`);
}
