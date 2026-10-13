# 🐍 DivergePython

Trilha de exercícios no estilo LeetCode para ensinar **Python, do primeiro `print` até PySpark, com foco
em dados em paralelo**. O Python 3.14 roda **dentro do navegador** (WebAssembly, com o
[Pyodide](https://pyodide.org)), e o paralelismo é **de verdade**: um pool de Web Workers, cada um com o
seu Python, usa os núcleos do computador. Não há servidor, instalação nem custo: o site é estático e
fica no GitHub Pages.

**Acesse:** https://sertaoseracloud.github.io/python-playground/

**Acessível para todas as pessoas.** O nome vem de *neurodivergente*: a plataforma foi feita para pessoas cegas (o leitor de tela fala o resultado de cada teste), surdas e mudas (nada depende de som ou de voz, com tradução para Libras pelo VLibras) e neurodivergentes (perfis para TDAH, dislexia, autismo e ansiedade). A meta é a WCAG 2.2 nível AA, conferida com o axe-core a cada versão. Detalhes na página **Acessibilidade** do site (`#/acessibilidade`).

## O que tem

- **Landing page** (`#/`): apresenta o projeto, a trilha, os certificados e os recursos de
  acessibilidade. Os números (exercícios, lições, módulos) vêm do próprio conteúdo. A trilha fica
  em `#/trilha`, e quem já começou vê "▶ Continuar" no topo.
- **🐍 Python básico** (versão 0.1.0): **10 lições e 40 exercícios** com dificuldade Fácil/Médio/Difícil:
  variáveis e tipos, strings, `input()`, condições, laços, funções, listas, dicionários e exceções.
- **Em breve**, nas próximas versões (aparecem na landing e no fim da trilha como "em breve"):
  📊 Python para dados, ⚡ Paralelismo, ✨ PySpark, 🌊 Spark além do batch (Streaming, MLlib e Delta)
  e 🏗️ Projetos.
- **Como no LeetCode**: **▶ Executar** roda os casos visíveis; **⬆ Enviar** roda todos, inclusive os
  **casos ocultos**, que usam outros valores, então resposta fixa no código não passa.
- **Tela do exercício**: descrição, editor e **🖥️ Terminal** com a saída e o traceback. As respostas
  do `input()` ficam na aba **⌨️ Entrada**, uma por linha (salvas por exercício). Quando o código pede um
  `input()` sem resposta, o terminal explica onde escrever.
- **Casos de teste detalhados** (aba 🧪 Testes): cada caso mostra o **cenário** como uma sessão de
  terminal (`$ python main.py`, as entradas `> …` e as chamadas `>>> area(3, 4)`), o placar, cada
  verificação com a **categoria** (Saída, Função, Variável, Execução, Código), o que o programa fez de
  fato (**obtido**) e, quando falha, o **motivo** e uma **💡 dica**.
- **Editor** CodeMirror com Python, recuo de 4 espaços, abas de arquivos (`import` entre eles) e atalhos
  (Ctrl+Enter executa, Ctrl+Shift+Enter envia, Ctrl+] recua).
- **Proteção contra laço infinito**: o Python roda num Web Worker, e o motor o reinicia depois de 10 s.
  O tempo de abrir o pool de workers não conta (com um teto de 60 s).
- **👨‍🏫 Quem é o instrutor?** (`#/instrutor`), **☕ Apoie o projeto** (`#/apoie`, PIX) e
  **❓ Tutorial** passo a passo, como nos outros sites Diverge.
- **♿ Acessibilidade e 🧠 neurodiversidade**: temas Dracula, Alto contraste, Claro e Suave; texto até
  175%; fonte Atkinson Hyperlegible; perfis 🎯 Foco, 📖 Leitura facilitada, 🌿 Calmo e 🤝 Sem pressão;
  lista de tarefas, régua de leitura, lembrete de pausa; **🔊 Ouvir**; avisos falados para leitores de
  tela; Libras pelo VLibras.
- **Instruções com estrutura previsível**: roteiro curto, 🎯 O que fazer, 📚 Palavras técnicas (com
  analogia e exemplo, de `src/conteudo/glossario.js`), ✅ Como saber que deu certo e 💡 Dica.
- **Playground livre** (`#/livre`) com o código e as respostas do `input()` salvos no navegador.
- **Compartilhar**: link com o código embutido. Nada é enviado a servidor.

### Paralelismo

`diverge_runtime.pool.mapear(funcao, itens)` serializa a função e cada item com o
[cloudpickle](https://github.com/cloudpipe/cloudpickle) e manda as tarefas para o pool
(`src/python/pool.js`, até 4 workers, ou núcleos − 1). O Python do aluno espera o resultado com
`pyodide.ffi.run_sync`, que depende do **JSPI** (JavaScript Promise Integration) do navegador.

- Conferido no Chromium do app Claude (8 núcleos): 4 workers, 6 tarefas de 0,5 s em 1,03 s (3 s em
  sequência). No Node 24, os testes ligam o JSPI com `--experimental-wasm-jspi` (`vitest.config.js`).
- **Sem JSPI**, `mapear` roda em sequência, com o mesmo resultado, e `pool.ULTIMA["paralelo"]` fica
  `False` (o módulo ⚡ Paralelismo vai mostrar isso ao aluno).
- A primeira chamada abre os workers (cada um carrega o seu Pyodide, alguns segundos); a barra de
  status avisa, e esse tempo não conta no limite de 10 s.

### Trilha gamificada e certificados

- A trilha (`#/trilha`) é um **caminho** em zigue-zague. Cada item vale **XP**: lição 5, fácil 10, médio 20 e difícil 40.
  O aluno sobe de **nível** (Iniciante → Aprendiz → Pythonista → Analista de dados → Engenheiro de dados →
  Arquiteto de dados → Mestre do Spark) e ganha uma **sequência de dias** 🔥.
- O próximo módulo **desbloqueia quando o atual chega a 70%**.
- Ao concluir 100% de um módulo, o 🏆 libera o **certificado do módulo**, emitido pela
  **Sertão será cloud** e assinado por **Cláudio Raposo**. O certificado final (trilha completa) chega
  com o último módulo.
- Cada certificado tem um **badge digital no estilo Credly**, página própria, PDF (A4 paisagem),
  **Publicar no LinkedIn** e **Adicionar ao perfil**.
- **Carga horária**: lição 10 min, fácil 15, médio 30, difícil 45; o certificado do módulo vale a soma,
  arredondada para cima em horas (Fundamentos de Python: 19 horas). A regra fica em `src/cargaHoraria.js`
  e `tests/carga-horaria.test.js` avisa quando o conteúdo mudar.
- **Selo de verificação** (HMAC-SHA256), **cadeia de certificados** (cada um inclui o hash do anterior,
  como num blockchain), **🔎 Validador** (`#/validar`: link, código, impresso ou XML), **📄 XML do
  certificado** e **✍️ assinatura Ed25519** com a chave pública em
  [`chave-publica-ed25519.txt`](https://sertaoseracloud.github.io/python-playground/chave-publica-ed25519.txt).
  Namespace do XML: `https://sertaoseracloud.github.io/python-playground/certificado/v1`.

### Certificados: a palavra secreta

**A palavra secreta nunca entra no código nem no site.** Ela fica no secret `CERTIFICADO_SEGREDO` do
GitHub Actions; o build injeta só um SHA-256 derivado dela (`vite.config.js`) e falha se o secret não
existir. Para gerar o build localmente: `CERTIFICADO_SEGREDO='...' npm run build`. Trocar a palavra
invalida os selos já emitidos.

**Limite:** sem servidor, a chave derivada vai no JavaScript do site. O selo pega alterações no link,
mas quem estudar o código publicado consegue gerar selos. Para impedir isso de verdade seria preciso um
servidor assinando os certificados.

#### Como a prévia do LinkedIn funciona

O robô do LinkedIn não roda JavaScript nem lê o que vem depois do `#`. Por isso cada badge tem uma
página estática em `public/badge/<módulo>/` com as meta tags `og:` apontando para a imagem do badge
(`public/badges/<módulo>-card.png`, 1200×627). Depois de mudar `src/badges.js` ou `src/certificados.js`, rode
`npm run badges` e faça commit de `public/`. O teste `tests/badges.test.js` falha se faltar algum arquivo.

### SEO

O build roda `scripts/prerender.mjs` depois do Vite: escreve no `<head>` o título, a descrição, o
endereço canônico, Open Graph, Twitter e os dados estruturados (Organization, WebSite e Course), tudo de
[`src/seo.js`](src/seo.js), deixa a landing já em HTML e gera o `sitemap.xml`. Capa (`og-capa.png`),
ícones e `manifest.webmanifest` saem de `npm run badges`.

### Privacidade, cookies e LGPD

- **Sem cookies e sem rastreamento**: não há analytics, anúncios nem servidor próprio.
- **Dados só no navegador** (`localStorage`, prefixo `python-playground:`): progresso, datas, dias de
  estudo, nome do certificado, código, respostas da aba ⌨️ Entrada, tarefas marcadas e preferências.
  A tabela fica em [`src/privacidade.js`](src/privacidade.js), e um teste falha se o código gravar uma
  chave que não está documentada.
- **O Pyodide é servido pelo próprio site** (`/pyodide/`), sem CDN de terceiros.
- **Terceiros**: GitHub Pages (hospedagem), GitHub (logo do certificado), LinkedIn (só ao clicar),
  VLibras (só se ligado) e a voz do navegador (🔊 Ouvir).
- **LGPD**: direitos do art. 18 com **📥 Baixar meus dados** e **🗑️ Apagar meus dados**. O texto é
  informativo e vale uma revisão jurídica antes de uso institucional.

### Links diretos para a aula

- Landing: `https://sertaoseracloud.github.io/python-playground/`
- Trilha: `.../python-playground/#/trilha`
- Um exercício: `.../python-playground/#/p/py-fizzbuzz`
- Playground livre: `.../python-playground/#/livre`
- Validar certificado: `.../python-playground/#/validar`

## Como adicionar conteúdo

Cada módulo fica em [`src/conteudo/`](src/conteudo/) (hoje `basico.js` e `basico-colecoes.js`), com uma
lista `itens` de lições (`{ id, tipo: 'licao', titulo, resumo, arquivos, entrada? }`) e problemas
(`{ id, tipo: 'problema', titulo, dificuldade, enunciado, dica, arquivos, solucao, testes }`). O código
fica no template `py` de `util.js`, que tira a indentação comum.

Cada teste tem `entrada` (as linhas do `input()`), `regras` e pode ser `oculto: true`. As regras ficam em
[`src/verificacoes.js`](src/verificacoes.js):

| Regra | Confere |
| --- | --- |
| `{ saida }` / `{ saidaIgual }` | a saída contém o texto / é exatamente igual |
| `{ funcao, args, igual }` (`aprox`) | chama a função e compara o retorno |
| `{ funcao, args, erro }` | a chamada levanta essa exceção |
| `{ variavel, igual }` | o valor final de uma variável |
| `{ erro }` / `{ semErros }` | o programa termina com essa exceção / sem exceção |
| `{ codigo }` / `{ semCodigo }` | regex no código do aluno (ex.: proibir `sum(`) |

`tests/conteudo.test.js` roda **toda a trilha** no Python de verdade: as lições rodam sem erro, cada
solução passa em todos os casos e cada código inicial ainda não passa.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local com recarga
npm run lint     # ESLint
npm test         # testes do site e de toda a trilha (Pyodide no Node 24, com JSPI)
python -m pytest # testes do runtime Python (python/diverge_runtime) no CPython
npm run build    # gera dist/ (precisa de CERTIFICADO_SEGREDO)
npm run badges   # regenera badges, capa e ícones em public/
```

A cada push na `main`, o GitHub Actions ([`.github/workflows/pages.yml`](.github/workflows/pages.yml))
roda o lint, o pytest e os testes, faz o build e publica no GitHub Pages.

## Como funciona

```
Editor (CodeMirror) ──arquivos + entrada──▶ Web Worker: Python 3.14 (Pyodide)
        ▲                                    │ grava os arquivos, roda main.py,
        │                                    │ chama as funções dos testes
 🖥️ Terminal ◀── saída, traceback ◀──────────┤
 🧪 Testes   ◀── regras de verificação ◀─────┘
                                             │ pool.mapear(...)  (run_sync + JSPI)
                                             ▼
                              Pool de Web Workers, um Pyodide em cada (cloudpickle)
```

O runtime Python (`python/diverge_runtime`) é montado no sistema de arquivos do Pyodide em `/lib/diverge`.

## Licença

O DivergePython é **software livre com copyleft**:

- **Código**: [GNU AGPL-3.0-or-later](LICENSE). Pode usar, estudar, modificar e distribuir; quem
  distribuir ou **oferecer pela internet** uma versão modificada precisa publicar o código dela sob a
  mesma licença. Componentes de terceiros: Pyodide (MPL-2.0) e cloudpickle (BSD-3-Clause, em
  `python/vendor/cloudpickle`).
- **Conteúdo didático** (lições, exercícios, projetos, glossário): [CC BY-SA 4.0](LICENSE-CONTEUDO.md).
  Crédito sugerido: "DivergePython, Sertão será cloud (CC BY-SA 4.0)".
- **Fora da licença**: o nome, a marca e o logotipo da Sertão será cloud e a emissão de certificados
  em nome dela.

No site: [Licença](https://sertaoseracloud.github.io/python-playground/#/licenca) e
[Termos de uso](https://sertaoseracloud.github.io/python-playground/#/termos). A lista de componentes de
terceiros fica em `src/licenca.js`, e um teste confere a licença de cada dependência.

Copyright (C) 2026 Sertão será cloud.
