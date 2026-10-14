# DivergePython: terminal interativo

Especificação de design aprovada na conversa de 14/10/2026. Versão de entrega: **0.3.2**
(antes da fase 4, que depois incorpora o terminal).

## 1. Objetivo

O terminal do DivergePython deve funcionar o mais perto possível de um terminal de verdade:
o programa para no `input()` e a pessoa digita a resposta ali mesmo; depois que o programa
termina, há um prompt de comandos (`python main.py`, `python`, `ls`, `cat`...) e o modo
interativo do Python (`>>>`).

**Critérios de sucesso**

- O `input()` é respondido no próprio terminal, na mesma linha da pergunta, e o programa
  continua dali.
- O `print` aparece na hora em que roda (antes de um `input()`, por exemplo), não só no fim.
- O REPL `>>>` roda linha a linha, com `...` nos blocos, e mostra o `repr` do resultado.
- A aba ⌨️ Entrada deixa de existir; a correção automática não muda.
- Tudo funciona pelo teclado e com leitor de tela, como o resto do site (WCAG 2.2 AA nos
  quatro temas).

## 2. Decisões tomadas

| Pergunta | Decisão |
| --- | --- |
| Até onde imitar | `input()`, linha de comando e REPL (`python`, `python -i`) |
| Aba ⌨️ Entrada | Sai; tudo pelo terminal |
| Como o Python espera a digitação | Pausa de verdade com JSPI (`run_sync`), como o pool de processos já faz. Sem JSPI, o programa roda até o primeiro `input()` sem resposta, o terminal pede a resposta e o programa roda de novo desde o início com as respostas já dadas, mostrando só a saída nova (o terminal avisa que, nesse navegador, o programa é repetido) |
| Relógio de 10 s | Para enquanto o programa espera a digitação |
| Ctrl+C | Interrompe: o worker é reiniciado e o terminal mostra `KeyboardInterrupt` |
| Botão ▶ Executar | Roda os casos de teste visíveis (com as respostas de cada caso) e depois digita `python main.py` no terminal |
| Ordem | Versão 0.3.2 agora; a fase 4 (PySpark) incorpora depois |

## 3. O terminal (tela)

- O painel 🖥️ Terminal vira um console: a saída rola e, embaixo, o prompt
  `aluno@sertao:~/<exercício>$` com um campo de digitação na mesma linha e o cursor piscando
  (sem piscar com "reduzir animações").
- Clicar em qualquer lugar do terminal põe o foco no campo.
- Teclas: Enter roda; ↑/↓ percorrem o histórico (salvo no navegador, até 100 comandos);
  Tab completa comandos e nomes de arquivo; Ctrl+C interrompe (mostra `^C`); Ctrl+L limpa;
  Ctrl+D no `input()` dá `EOFError` e no REPL sai dele; Esc tira o foco do terminal.
- No `input("Nome: ")`, o texto `Nome: ` aparece e o campo fica logo depois dele, na mesma
  linha; o que foi digitado fica na saída, como num terminal.
- Acessibilidade: o campo tem rótulo ("Comando do terminal", "Resposta para o input()",
  "Linha do Python (>>>)"); a saída nova vai para uma região anunciada (`role="log"`) sem
  reler o terminal inteiro; a ajuda do terminal (comando `help` e a dica do editor) explica
  Esc e Tab.

## 4. Comandos

| Comando | Faz |
| --- | --- |
| `python <arquivo> [args...]` | Roda o arquivo; `args` vão para `sys.argv` |
| `python -i <arquivo>` | Roda e continua no REPL com as variáveis do programa |
| `python` | Abre o REPL `>>>`; `exit()`, `quit()` ou Ctrl+D saem |
| `ls` | Lista os arquivos do exercício (código e dados) |
| `cat <arquivo>` | Mostra o arquivo |
| `clear` | Limpa o terminal (o mesmo que Ctrl+L) |
| `help` | Os comandos e as teclas |
| `pip ...` | Explica que no navegador não dá para instalar pacotes |
| outro | `bash: <comando>: command not found` |

## 5. Arquitetura

```
Página
 ├─ src/ui/terminal.js     tela do terminal: saída, campo, histórico, teclas, leitor de tela
 ├─ src/ui/shell.js        interpreta os comandos e conversa com o motor
 └─ src/python/motor.js    + mensagens de saída ao vivo e de pedido de entrada; relógio pausa
Worker principal (src/python/worker.js)
 └─ diverge_runtime        input() interativo, stdout ao vivo, REPL (repl.py)
```

- **Saída ao vivo:** cada `write` no `sys.stdout` do aluno vai para a página por
  `postMessage({ tipo: 'saida', id, texto })` (juntando escritas em até 30 ms). O resultado
  final continua trazendo a saída inteira (a correção usa ela).
- **`input()` com JSPI:** sem respostas na fila (a correção continua mandando as dela), o
  `input()` manda `{ tipo: 'entrada', id, prompt }` e espera com `run_sync` a promessa que a
  página resolve com o texto digitado (ou com EOF). O motor para o relógio enquanto espera.
- **`input()` sem JSPI:** levanta uma exceção interna; o resultado volta com
  `precisa_entrada: true`. O shell guarda a resposta digitada e roda o programa de novo com
  todas as respostas até ali, escondendo a saída que já estava na tela.
- **REPL:** `diverge_runtime/repl.py` mantém um escopo por sessão de REPL;
  `codeop.compile_command` decide se a linha está completa (`>>>`) ou se o bloco continua
  (`...`); expressões mostram o `repr` (como o `sys.displayhook`); erros mostram o traceback só
  com as linhas do aluno. `python -i` usa o escopo do programa que acabou de rodar.
- **Ctrl+C:** o motor encerra o worker e cria outro (o JSPI não permite interromper o Python
  no meio de outra forma); o terminal mostra `KeyboardInterrupt` e o prompt volta quando o
  Python recarrega.

## 6. O que muda no resto

- `index.html`: sai a aba ⌨️ Entrada; o terminal ganha o campo de digitação.
- `src/progresso.js` e `src/privacidade.js`: saem `entrada:*`; entra `historico` (comandos do
  terminal).
- `src/ui/item.js`: ▶ Executar roda os testes visíveis e depois `python main.py` no terminal;
  abrir um exercício roda `python main.py` (como hoje); a fala do resultado continua.
- Lições com `entrada` (respostas de exemplo): o campo some; o texto da lição diz o que digitar.
- Correção (`corrigir.js`) e cenário dos casos: sem mudança.

## 7. Testes

- vitest + Pyodide no Node (JSPI ligado): `input()` interativo (o teste responde pela
  mensagem), saída ao vivo antes do `input()`, EOF com Ctrl+D, REPL (expressão, bloco com
  `...`, erro, `python -i`), `sys.argv`, e o caminho sem JSPI (repetir com as respostas).
- happy-dom: terminal (histórico, Tab, Ctrl+C, Ctrl+L, Esc, rótulos, região anunciada) e
  shell (cada comando, `command not found`).
- `item-python.test.js`: Executar roda os testes e depois o programa; a aba Entrada não existe.
- axe-core nos 4 temas com o terminal esperando uma resposta.

## 8. Riscos

| Risco | Mitigação |
| --- | --- |
| Navegador sem JSPI | Repetir a execução com as respostas já dadas (mesmo resultado em programas sem sorteio ou relógio; o terminal avisa) |
| Ctrl+C recarrega o Python (alguns segundos) | O terminal mostra que o Python está reiniciando; o histórico e o código ficam |
| Leitor de tela lendo saída demais | Só a saída nova é anunciada, em blocos, e o modo leitor de tela resume programas longos |
