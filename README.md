# 🐘 DivergePython

Trilha de exercícios no estilo LeetCode para ensinar **HTML → W3.CSS → PHP → PHP + PDO** em aula.
O Python 3.14 roda **dentro do navegador** (WebAssembly), inclusive com banco de dados **SQLite via PDO**.
Não há servidor, instalação nem custo: o site é estático e fica no GitHub Pages.

**Acesse:** https://sertaoseracloud.github.io/python-playground/

**Acessível para todas as pessoas.** O nome vem de *neurodivergente*: a plataforma foi feita para pessoas cegas (o leitor de tela fala o resultado de cada teste), surdas e mudas (nada depende de som ou de voz, com tradução para Libras pelo VLibras) e neurodivergentes (perfis para TDAH, dislexia, autismo e ansiedade). A meta é a WCAG 2.2 nível AA, conferida com o axe-core a cada versão. Detalhes na página **Acessibilidade** do site (`#/acessibilidade`).

## O que tem

- **Landing page** (`#/`): apresenta o projeto, a trilha, os certificados e os recursos de
  acessibilidade. Os números (exercícios, módulos, projetos) vêm do próprio conteúdo. A trilha fica
  em `#/trilha`, e quem já começou vê "▶ Continuar" no topo.

- **40 problemas** (10 por módulo) com dificuldade Fácil/Médio/Difícil, mais **lições** de conceito
  no começo de cada assunto:
  1. **HTML**: estrutura, títulos, ênfase, links, imagens, listas, tabelas, formulários e semântica.
  2. **W3.CSS**: cores, botões, painéis, tags, cards, barra de navegação, grade, tabelas, formulários e landing page.
  3. **PHP**: variáveis, condicionais, laços (FizzBuzz, tabuada), arrays, funções, `$_GET`, `$_POST` e `include`.
  4. **PHP + PDO**: conectar, `COUNT`, `ORDER BY`, `prepare` contra SQL injection, `fetch`, `JOIN` + `GROUP BY`,
     `INSERT`, paginação com `LIMIT`/`OFFSET` e `LEFT JOIN`.
- **🏗️ Módulo extra: Projetos** — 6 sistemas completos construídos em **etapas encadeadas** (33 etapas).
  O código de partida de cada etapa é o **código do próprio aluno** na etapa anterior (ou a referência,
  se ele não a resolveu):

  | Projeto | Etapas | Destaques |
  | --- | --- | --- |
  | ✅ Lista de tarefas (CRUD) | 5 | criar, listar, concluir, editar, excluir |
  | 📝 Blog | 6 | JOIN, comentários, login com `password_verify`, publicar, excluir só o que é seu |
  | 🐦 Rede social | 6 | perfil, seguir, feed com subconsulta, curtidas, busca, "quem seguir" |
  | 🛍️ Loja virtual | 6 | filtros, carrinho na sessão, checkout com **transação**, relatório de vendas |
  | 📚 Biblioteca escolar | 5 | disponibilidade com LEFT JOIN, empréstimos, atrasos e multas com datas |
  | 💬 Fórum de perguntas | 5 | respostas, votos com **upsert**, melhor resposta só pelo autor |

  Os testes dos projetos simulam um usuário de verdade: um caso pode ter vários **passos** que
  compartilham sessão e banco (login → publicar → ver o feed), e os redirecionamentos
  (`header('Location: ...')`) são seguidos. No preview, clicar em links e enviar formulários mantém o
  banco e a sessão; **▶ Executar** começa do zero.
- **Como no LeetCode**: **▶ Executar** roda os casos visíveis; **⬆ Enviar** roda todos, inclusive os
  **casos ocultos**. Os ocultos usam outros valores e outro banco, então resposta fixa no código não passa.
  O resultado sai como "Aceito" ou "Resposta errada", mostrando o caso que falhou.
- **👨‍🏫 Quem é o instrutor?** (`#/instrutor` e seção na landing): perfil de Cláudio Filipe Lima Rapôso
  (atuação, reconhecimentos, certificações e formação), com a foto servida pelo próprio site
  (`public/instrutor.webp`). Os dados ficam em `src/instrutor.js`, sem telefone nem endereço.
- **☕ Apoie o projeto** (`#/apoie`): PIX de qualquer valor para a conta PicPay do instrutor, por **QR Code**
  ou **copia e cola** (com botão de copiar). O código segue o BR Code do Banco Central (campos EMV e
  CRC16) e é montado no navegador por `src/apoio.js`; o QR Code sai da biblioteca `qrcode-generator` (MIT).
  A chave fica em `PIX.chave`: sem ela, o apoio aparece como "em breve".
- **Casos de teste detalhados** (aba 🧪 Testes): cada caso mostra o **cenário** como requisições HTTP
  (`GET /index.php?pagina=2`, `POST /login.php` com os campos do corpo, banco diferente do exemplo, passos
  com a mesma sessão), o placar e o tempo; cada verificação mostra a **categoria** (Texto da página,
  Elemento HTML, Código, Execução), o que a página tinha de fato (**obtido**: o trecho do texto, quantos
  elementos e quais textos, a linha do código) e, quando falha, o **motivo** e uma **💡 dica**. Antes de
  rodar, o caso lista o que vai conferir. Nos ocultos, os valores ficam escondidos e só aparece o que
  falhou. Os detalhes saem de `detalharRegra` em `src/verificacoes.js`.
- **Tela do problema**: descrição, código e preview. Os **🧪 Testes funcionais** ficam numa aba ao lado
  de Descrição, Banco e Solução, com cada caso de teste (⏳ pendente, ✅ passou, ❌ falhou e o motivo).
  A aba abre sozinha ao clicar em ▶ Executar ou ⬆ Enviar, e o resultado aparece no nome dela (✅ 3/3).
- **Posição do código e do preview**: a W3.CSS muda o layout em 601px e 993px, então o modo
  **Auto** só põe código e preview lado a lado quando o preview passa de 600px (ex.: telas de 1920px).
  Em telas menores (1366px, projetores) o código fica em cima e o preview embaixo, ambos na largura toda.
  Há botões para fixar ⇆/⇅, ocultar a descrição e um divisor arrastável
  (mouse ou setas do teclado). O **📐 medidor** mostra a largura do preview e a faixa da W3.CSS.
- **♿ Acessibilidade**: temas Dracula, Alto contraste e Claro; tamanho do texto (87,5% a 175%,
  editor incluído); fonte Atkinson Hyperlegible; mais espaçamento; links sublinhados e foco reforçado;
  reduzir animações; **🔊 Ouvir** o enunciado; atalhos de teclado; link "Pular para o conteúdo";
  rótulos e regiões `aria-live` para leitores de tela.
- **🧠 Neurodiversidade** (baseado nas recomendações do W3C para acessibilidade cognitiva, COGA):
  - **Perfis rápidos** no painel ♿: 🎯 Foco (TDAH), 📖 Leitura facilitada (dislexia),
    🌿 Calmo (autismo, sensibilidade sensorial) e 🤝 Sem pressão (ansiedade). Cada perfil só liga um
    conjunto de opções; dá para combinar e ajustar uma a uma.
  - **Modo foco**: o caminho mostra só o módulo atual e esconde contadores e textos extras.
  - **Lista de tarefas**: os pedidos do exercício viram caixas de marcar, com "2 de 4 feitas" e o
    próximo passo ("agora clique em ▶ Executar").
  - **Régua de leitura**, **linhas curtas**, tema **Suave** (cores calmas) e **lembrete de pausa**
    a cada 25 minutos de estudo contínuo.
  - **Sem pressão**: esconde XP, nível e sequência de dias e troca "Resposta errada" por mensagens
    que dizem quantos casos já funcionam e onde olhar.
- **Instruções com estrutura previsível**: todo desafio mostra a mesma sequência:
  - um roteiro curto (1. leia, 2. faça uma parte, 3. ▶ Executar, 4. confira, 5. ⬆ Enviar);
  - 🎯 **O que fazer**;
  - 📚 **Palavras técnicas**: até 6 termos do desafio, cada um com explicação simples,
    **analogia do dia a dia** e exemplo de código. O glossário fica em `src/conteudo/glossario.js`;
  - ✅ **Como saber que deu certo**: as regras dos testes visíveis em linguagem simples;
  - 💡 Dica.
- **❓ Tutorial** em modal, passo a passo, destacando cada parte da tela. Abre sozinho na primeira visita.
- **Progresso** por módulo e por dificuldade (✅ resolvido, ◐ tentado), salvo no navegador do aluno.
- **Aba Banco**: mostra as tabelas e os dados do problema. O banco é recriado a cada execução.
- **Playground livre** com banco SQLite que **fica salvo no navegador** e botão "Resetar banco".
- **Resultado** renderizado, aba **HTML gerado** e **barra de endereço** para testar `$_GET`.
  Formulários GET/POST e links funcionam dentro do resultado.
- Tema **Dracula** e fonte **Fira Code** (com ligaduras).
- **Compartilhar**: link com o código embutido. Nada é enviado a servidor.
- **Proteção contra laço infinito**: o PHP roda num Web Worker e é reiniciado depois de 8 s.

### Trilha gamificada e certificados

- A trilha (`#/trilha`) é um **caminho** em zigue-zague. Cada item vale **XP**: lição 5, fácil 10, médio 20 e difícil 40.
  O aluno sobe de **nível** (Iniciante → Mestre do PHP) e ganha uma **sequência de dias** 🔥.
- O próximo módulo **desbloqueia quando o atual chega a 70%**.
- Ao concluir 100% de um módulo, o 🏆 libera o **certificado do módulo**. Com todos os módulos
  (inclusive Projetos), o 🎓 libera o **certificado final**. Os certificados são emitidos pela
  **Sertão será cloud** e assinados por **Cláudio Raposo**.
- Cada certificado tem um **badge digital no estilo Credly** (hexágono com a cor do módulo). A página
  do certificado mostra o badge, as habilidades, o emissor e o código, e o documento para imprimir
  ou salvar em PDF (A4 paisagem).
- **Publicar no LinkedIn** abre a caixa de post com o texto pronto e o link do badge. O LinkedIn monta
  a prévia com a imagem do badge, como nos posts da Credly. **Adicionar ao perfil** preenche a seção
  Licenças e certificados.
- **Carga horária**: cada atividade tem um tempo estimado (lição 10 min, fácil 15, médio 30, difícil
  45), mostrado no exercício. O certificado de cada módulo vale a soma, arredondada para cima em horas e
  com o mínimo de 1 hora; o final soma os módulos (39 horas). As horas ficam fixas em
  `src/certificados.js` (não entram no selo, então certificados antigos continuam válidos) e
  `tests/carga-horaria.test.js` avisa quando o conteúdo mudar. A regra fica em `src/cargaHoraria.js`.
- **Selo de verificação**: cada certificado leva um **HMAC-SHA256** da data de obtenção, do emissor
  (Cláudio Raposo), da empresa (Sertão será cloud), do aluno e do módulo, calculado com uma
  **palavra secreta**. O selo vai no link, aparece no certificado (com o código `SSC-AAAA-XXXX-XXXX`
  tirado dele) e a página confere: se alguém editar o nome ou a data no link, aparece
  "⚠️ O selo não confere" e os botões de compartilhar somem.
- **Cadeia de certificados (como num blockchain)**: os certificados seguem a ordem HTML → W3.CSS →
  PHP → PDO → Projetos → Final, e cada um, menos o primeiro, inclui no selo o **hash do anterior**.
  O link leva as datas dos anteriores, e a página recalcula a cadeia inteira: mudar uma data ou um
  nome em qualquer ponto quebra o selo de todos os seguintes, e não dá para pular um módulo. Por
  isso um certificado só é liberado quando todos os anteriores também foram conquistados (na trilha
  aparece "🔗 Falta o certificado de …"). Links de módulos seguintes emitidos antes da cadeia
  aparecem como antigos, com orientação para gerar de novo; os de HTML continuam valendo.
- **🔎 Validador** (`#/validar`): três abas. Em **link ou código**, cole o link do certificado, o link do
  badge do LinkedIn ou o código, e a página recalcula a cadeia. Em **impresso ou PDF**, digite nome,
  certificado, data, selo e o hash "Anterior" do rodapé (com contador de caracteres). Em **arquivo XML**,
  use o arquivo baixado na página do certificado. Quem abre um link de validação
  (`#/validar/<código>`, botão "🔎 Validar" de cada certificado) vê o resultado primeiro, com o badge,
  os dados e a cadeia como linha do tempo. As cores separam "válido" (verde), "alterado" (vermelho),
  "não consegui ler / faltam dados" (âmbar) e "link antigo" (ciano), e mudar o texto apaga o resultado
  anterior.
- **📄 XML do certificado** (botão na página do certificado): traz aluno, emissor, empresa, módulo, data,
  código, selo, selo anterior, a cadeia inteira (cada bloco com selo, anterior e a mensagem assinada) e o
  link de validação, **sem o segredo nem a chave**. Outras páginas conferem sozinhas se a cadeia é
  coerente (cada "anterior" igual ao selo do bloco de antes); a conferência do selo, que precisa da chave,
  é feita no validador, que aceita o XML e avisa se o arquivo foi editado. Namespace:
  `https://sertaoseracloud.github.io/python-playground/certificado/v1`.
- **✍️ Assinatura digital Ed25519**: cada bloco da cadeia também é assinado com Ed25519. A **chave
  pública** fica no XML e publicada em
  [`chave-publica-ed25519.txt`](https://sertaoseracloud.github.io/python-playground/chave-publica-ed25519.txt)
  (e em `.json`, com JWK). Qualquer sistema confere o certificado **sem segredo e sem o site**, por
  exemplo em Node:

  ```js
  import { createPublicKey, verify } from 'node:crypto';
  const chave = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: '<jwk.x do .json>' }, format: 'jwk' });
  verify(null, Buffer.from(mensagemAssinada, 'utf8'), chave, Buffer.from(assinatura, 'hex')); // true
  ```

  Regra importante: compare a chave pública do XML com a publicada no site; um XML com outra chave
  não foi emitido pela Sertão será cloud. A semente da chave privada é derivada da mesma palavra
  secreta no build e, sem servidor, vai no JavaScript: a assinatura torna a **verificação** pública e
  independente, mas não impede quem extrair a semente de assinar. Para isso, só assinando num servidor.
- **A palavra secreta nunca entra no código nem no site.** Ela fica no secret
  `CERTIFICADO_SEGREDO` do GitHub Actions; o build injeta só um SHA-256 derivado dela
  (`vite.config.js`), e falha se o secret não existir. Para gerar o build localmente:
  `CERTIFICADO_SEGREDO='...' npm run build`. Trocar a palavra invalida os selos já emitidos.
- **Limite:** sem servidor, a chave derivada vai no JavaScript do site. O selo pega alterações no
  link, mas quem estudar o código publicado consegue gerar selos. Para impedir isso de verdade
  seria preciso um servidor assinando os certificados.

#### Como a prévia do LinkedIn funciona

O robô do LinkedIn não roda JavaScript nem lê o que vem depois do `#`. Por isso cada badge tem uma
página estática em `public/badge/<módulo>/` com as meta tags `og:` apontando para a imagem do badge
(`public/badges/<módulo>-card.png`, 1200×627). O link compartilhado é
`.../badge/<módulo>/?c=<código>`, e quem clica é levado ao certificado.

Esses arquivos saem de `src/badges.js` e `src/certificados.js`. Depois de mudar um deles, rode:

```bash
npm run badges
```

e faça commit de `public/`. O teste `tests/badges.test.js` falha se algum arquivo estiver faltando.

### SEO

- O build (`npm run build`) roda `scripts/prerender.mjs` depois do Vite: escreve no `<head>` o título,
  a descrição, o endereço canônico, Open Graph, Twitter e os **dados estruturados** (Organization,
  WebSite e Course, gratuito, em pt-BR), tudo de [`src/seo.js`](src/seo.js). Também deixa a
  **landing já em HTML**, para buscadores e redes sociais que não rodam JavaScript, e gera o
  `sitemap.xml`.
- As telas internas ficam depois do `#` (o GitHub Pages não tem servidor), então para os buscadores o
  site é uma página só. Cada tela atualiza título e descrição quando abre.
- Capa de compartilhamento (`og-capa.png`, 1200×630), ícones (`favicon.svg`, PNG 192/512/180) e
  `manifest.webmanifest` saem de `npm run badges`. As páginas de badge têm `noindex`.
- Um `robots.txt` só vale na raiz do domínio (`sertaoseracloud.github.io/robots.txt`), que é de outro
  repositório. Para o Google achar o sitemap, cadastre o site no Google Search Console e envie
  `https://sertaoseracloud.github.io/python-playground/sitemap.xml`.

### Privacidade, cookies e LGPD

A página **🔒 Privacidade** (`#/privacidade`) explica, em linguagem simples, como os dados são tratados:

- **Sem cookies e sem rastreamento**: não há analytics, anúncios nem servidor próprio. Por isso não
  existe banner de aceite; um aviso discreto na primeira visita só informa.
- **Dados só no navegador** (`localStorage`, prefixo `python-playground:`): progresso, datas, dias de
  estudo, nome do certificado, código, tarefas marcadas, banco do playground livre e preferências.
  A tabela completa fica em [`src/privacidade.js`](src/privacidade.js), e um teste falha se o código
  passar a gravar uma chave que não está documentada.
- **Cookies dos exercícios** (`PHPSESSID` dos projetos com login) são simulados na memória da aba.
- **Terceiros**: GitHub Pages (hospedagem), W3Schools (w3.css no preview), picsum.photos (imagens dos
  exercícios), GitHub (logo do certificado), LinkedIn (só ao clicar) e a voz do navegador (🔊 Ouvir).
  Outro teste falha se o conteúdo passar a baixar algo de um domínio que não está na lista.
- **LGPD**: finalidade e necessidade, base legal do nome (consentimento), segurança, direitos do art. 18
  com botões **📥 Baixar meus dados** (JSON) e **🗑️ Apagar meus dados**, e cuidado com menores (art. 14).
- **Nome no certificado**: o diálogo avisa que o nome vai no link e sugere só o primeiro nome para menores.

O canal de contato é o GitHub Issues do projeto (`CONTROLADOR.contato` em `src/privacidade.js`).
Se a Sertão será cloud tiver um e-mail de contato ou um encarregado de dados (DPO), troque lá.
O texto é informativo e vale uma revisão jurídica antes de uso institucional.

### Links diretos para a aula

- Landing: `https://sertaoseracloud.github.io/python-playground/`
- Trilha: `.../python-playground/#/trilha`
- Validar certificado: `.../python-playground/#/validar`
- Um problema: `.../python-playground/#/p/pdo-filtro-curso`
- Playground livre: `.../python-playground/#/livre`

## Banco de dados (PDO)

No navegador o banco é **SQLite**, porque o PHP WebAssembly não tem servidor MySQL. O código PDO é o mesmo;
muda só a linha de conexão:

```php
// No playground:
$pdo = new PDO('sqlite:/banco/escola.sqlite');

// Num servidor com MySQL:
$pdo = new PDO('mysql:host=localhost;dbname=escola;charset=utf8mb4', 'usuario', 'senha');
```

O banco `escola` tem as tabelas `cursos` e `alunos`. Veja os scripts em [`src/conteudo/bancos.js`](src/conteudo/bancos.js).

## Como adicionar conteúdo

Cada módulo fica num arquivo em [`src/conteudo/`](src/conteudo/) (`html.js`, `w3css.js`, `php.js`, `pdo.js`),
com uma lista `itens` de lições e problemas, na ordem em que aparecem.

Um problema tem `enunciado`, `dica`, `dificuldade`, `arquivos` (código inicial), `solucao`, `banco`
(SQL opcional) e `testes`. Cada teste faz uma requisição (`url`, `metodo`, `corpo`), pode trocar o banco
(`banco`) e ser oculto (`oculto: true`). Os testes aplicam as regras abaixo, documentadas em
[`src/verificacoes.js`](src/verificacoes.js):

| Regra | Confere |
| --- | --- |
| `{ contem }` / `{ naoContem }` | o texto visível da página |
| `{ seletor, min, max, igual }` | quantos elementos casam com o seletor CSS |
| `{ seletor, texto }` | algum elemento do seletor contém o texto |
| `{ codigo }` | regex no código do aluno (ex.: exigir `prepare`) |
| `{ semErros }` | o PHP não emitiu erros nem avisos |

Os testes do projeto rodam **toda a trilha** no mesmo PHP WebAssembly. Eles garantem que as lições não têm
erros, que cada solução passa em todos os casos e que cada código inicial ainda não passa.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local com recarga
npm run lint     # ESLint (regras em eslint.config.js)
npm test         # testes (regras, motor PHP, banco e toda a trilha)
npm run build    # gera dist/
npm run badges   # regenera as imagens e páginas dos badges em public/
```

A cada push na `main`, o GitHub Actions ([`.github/workflows/pages.yml`](.github/workflows/pages.yml))
roda o lint e os testes, faz o build e publica no GitHub Pages.

## Como funciona

```
Editor (CodeMirror) ──arquivos + seed SQL──▶ Web Worker: Python 3.14 (WebAssembly, @php-wasm/web)
        ▲                                     │ grava /www, cria /banco/escola.sqlite
        │                                     │ e simula a requisição HTTP
 formulários/links ◀── iframe isolado ◀── HTML gerado ──▶ regras de verificação (casos de teste)
```

O PHP vem do [WordPress Playground](https://github.com/WordPress/wordpress-playground)
(`@php-wasm/web`, licença GPL-2.0-or-later).

## Licença

O DivergePython é **software livre com copyleft**:

- **Código**: [GNU AGPL-3.0-or-later](LICENSE). Pode usar, estudar, modificar e distribuir; quem
  distribuir ou **oferecer pela internet** uma versão modificada precisa publicar o código dela sob a
  mesma licença. A AGPL também é compatível com o PHP no navegador (`@php-wasm`, GPL-2.0-or-later).
- **Conteúdo didático** (lições, exercícios, projetos, glossário): [CC BY-SA 4.0](LICENSE-CONTEUDO.md).
  Crédito sugerido: "DivergePython, Sertão será cloud (CC BY-SA 4.0)".
- **Fora da licença**: o nome, a marca e o logotipo da Sertão será cloud e a emissão de certificados
  em nome dela.

No site: [Licença](https://sertaoseracloud.github.io/python-playground/#/licenca) e
[Termos de uso](https://sertaoseracloud.github.io/python-playground/#/termos). A lista de componentes de
terceiros fica em `src/licenca.js`, e um teste confere a licença de cada dependência.

Copyright (C) 2026 Sertão será cloud.
