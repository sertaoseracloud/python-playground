// 🐍 Python básico: variáveis, tipos, strings, condições, laços, funções, listas,
// dicionários e exceções. Lições (tipo 'licao') e problemas (tipo 'problema').
export const moduloBasico = {
  id: 'basico',
  titulo: 'Python básico',
  icone: '🐍',
  descricao: 'Variáveis, tipos, condições, laços, funções, listas, dicionários e exceções.',
  itens: [
    {
      id: 'licao-ola',
      tipo: 'licao',
      titulo: 'Olá, Python',
      resumo: `
        <p>Em Python, <code>print</code> mostra um texto no terminal. Textos ficam entre aspas.</p>
        <p>Clique em <b>▶ Executar</b> e veja a saída na aba 🖥️ Terminal.</p>`,
      arquivos: { 'main.py': 'print("Olá, Sertão!")\nprint(2 + 3)\n' },
    },
  ],
};
