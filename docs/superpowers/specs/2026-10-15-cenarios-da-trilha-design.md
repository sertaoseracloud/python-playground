# Cenários da trilha — design

Data: 2026-10-15 · Sites: DivergePython, DivergePHP e DivergeTerraform (o mesmo componente nos três)

## Objetivo

Hoje a trilha é um caminho em ziguezague sobre um fundo liso. A ideia é deixá-la parecida com o
mapa de um jogo:

- cada módulo ganha um **cenário** (sertão, gelo, fogo, rio…) atrás do seu trecho do caminho;
- **personagens** do cenário andam por ele.

O aluno sente que está atravessando regiões diferentes à medida que avança.

Critério de sucesso: ao rolar a trilha, cada módulo tem o seu cenário e personagens em movimento.
Nada disso atrapalha:
- o caminho continua com o mesmo contraste, as mesmas cores dos nós e o mesmo foco;
- o leitor de tela lê exatamente o que lê hoje;
- quem pede "reduzir movimento" vê tudo parado;
- a trilha continua leve no celular.

## Decisões (respostas do usuário)

- É **um cenário por módulo**, cada um ligado ao assunto do módulo. Os personagens andam por ele.
- Além de fogo, gelo e o normal, entram **outros cenários**.
- Os **três sites** recebem os cenários agora.
- O trabalho tem **spec e plano próprios**. Sai na DivergePython 0.5.0, junto com a fase 5, e numa
  versão nova dos outros dois sites.

## Cenários

| Id | Cenário | Elementos do fundo | Personagens |
|---|---|---|---|
| `sertao` | 🌵 Sertão (o normal) | serra, mandacarus, sol | vaqueiro, cabrita, calango |
| `vale` | 🌱 Vale verde | roçado em canteiros, cerca, açude | agricultora, jumento, asa-branca (voando) |
| `gelo` | ❄️ Gelo | geleira, cristais iguais lado a lado, neve caindo | pinguim, raposa-do-ártico, coruja-das-neves (voando) |
| `fogo` | 🔥 Fogo | vulcão, rios de lava, faíscas subindo | salamandra, ferreiro, fênix (voando) |
| `rio` | 💧 Rio e cachoeira | cachoeira, correnteza, pedras | jangadeiro (na água), peixe (saltando), garça |
| `cidade` | 🌃 Cidade à noite | prédios em construção, guindaste, janelas acesas | operária, robozinho, gato |
| `jardim` | 🌸 Jardim florido | canteiros de flores coloridas, arco | jardineira, borboleta (voando), beija-flor (voando) |

## Módulo → cenário

| Site | Módulo | Cenário |
|---|---|---|
| DivergePython | `basico` | `sertao` |
| | `dados` | `vale` |
| | `paralelismo` | `gelo` |
| | `pyspark` | `fogo` |
| | `alem` (fase 5) | `rio` |
| | `projetos` (fase 6) | `cidade` |
| DivergePHP | `html` | `sertao` |
| | `w3css` | `jardim` |
| | `php` | `fogo` |
| | `pdo` | `gelo` |
| | `projetos` | `cidade` |
| DivergeTerraform | `basico` | `sertao` |
| | `aws` | `fogo` |
| | `azure` | `gelo` |
| | `projetos` | `cidade` |

O cartão "em breve" dos módulos futuros (`PROXIMOS_MODULOS`) fica sem cenário. O cenário só
aparece quando o módulo existe.

## Como funciona

### Arquivos (idênticos nos três repos, menos o mapa)

- `src/ui/cenarios/` tem um arquivo por cenário (`sertao.js`, `gelo.js`…).
  - Cada um exporta `{ id, nome, fundo, personagens }`.
  - `fundo` é um SVG inline: as camadas de trás, sem texto.
  - `personagens` é uma lista de `{ id, svg, movimento: 'andar' | 'voar' | 'nadar' | 'saltar' }`.
- `src/ui/cenarios/index.js` tem `CENARIOS` (todos) e `htmlDoCenario(id)`, que devolve o HTML da
  camada decorativa.
- `src/conteudo/cenarios.js`, **por site**, guarda o mapa `{ [moduloId]: cenarioId }`. É o único
  arquivo que muda entre os repos.
- `src/cenarios.css` tem o posicionamento, as animações e os ajustes por tema.

### Na trilha (`src/ui/inicio.js`)

- Cada `section.bloco-unidade` ganha, como primeiro filho, a camada
  `<div class="cenario cenario-<id>" aria-hidden="true">…</div>`, mais a classe `com-cenario` na
  própria section.
- A camada fica atrás do caminho, com `position: absolute`, `inset: 0`, `z-index` abaixo do
  `ol.trilha` e `pointer-events: none`. Ela nunca recebe clique nem foco.
- O cabeçalho do módulo e os nós continuam por cima, com um véu semitransparente atrás do
  cabeçalho. Assim o texto mantém o contraste AA, seja qual for o cenário.

### Personagens

- Cada cenário tem 3 personagens, espalhados pela altura do bloco.
- Eles andam de um lado ao outro numa faixa fora da coluna do caminho, com idas e voltas lentas
  (20 a 40 s por volta) e atrasos diferentes, para não marcharem juntos.
- Os voadores fazem uma curva suave. O peixe salta.
- A animação é só `transform` em CSS, sem JavaScript por quadro.
- Os personagens de um módulo bloqueado ficam parados e desbotados, como o próprio módulo.
- **No celular** (largura < 600px), sobra só 1 personagem por cenário, numa faixa estreita, sem
  passar por cima dos nós.

### Acessibilidade e conforto

- Toda a camada tem `aria-hidden="true"`, e os SVGs não têm `<title>`. O leitor de tela não ouve
  nada novo.
- **"Reduzir movimento":** os personagens ficam parados quando o painel ♿ marca
  `a11y-sem-movimento`. A regra global de `estilo.css` já zera as animações, e um teste confirma
  isso. Os personagens também param com o `prefers-reduced-motion: reduce` do sistema.
- **Temas:**
  - `dracula` e `claro`: cores próprias de cada cenário, ajustadas para cada tema.
  - `suave`: saturação e brilho reduzidos (`filter: saturate(.5) brightness(.9)` ou uma paleta
    própria).
  - `alto-contraste`: o cenário vira um contorno de traço fino na cor do texto suave, sem
    preenchimento. Os personagens ficam parados.
- O caminho, os nós e os rótulos não mudam de cor por causa do cenário.
- O perfil "sem pressão" não muda nada aqui.

### Desempenho

- Um cenário (fundo mais os 3 personagens) tem no máximo **12 KB** de SVG, sem imagens externas.
- O CSS das animações usa `will-change: transform` só nos personagens.
- Um teste mede o tamanho de cada cenário.

## Testes (`tests/cenarios.test.js`, os mesmos nos três repos)

- Todo módulo de `conteudo/trilha.js` tem um cenário no mapa, e todo cenário do mapa existe em
  `CENARIOS`.
- `htmlDoCenario(id)` devolve uma camada com `aria-hidden="true"`, sem texto visível e sem
  elemento focável.
- Na trilha renderizada (happy-dom), cada `section.bloco-unidade` tem a camada do seu cenário, e o
  nome acessível de cada nó continua igual ao de antes.
- O CSS tem a regra que para os personagens com `prefers-reduced-motion`, e a classe
  `a11y-sem-movimento` continua zerando as animações.
- Cada cenário tem no máximo 12 KB.
- **Conferência manual:**
  - axe-core (WCAG 2.2 AA) na trilha, nos 4 temas;
  - conferência visual no desktop e a 375px;
  - "reduzir movimento" ligado e desligado.

## Versões

| Site | Versão |
|---|---|
| DivergePython | 0.5.0 (com a fase 5) |
| DivergePHP | 1.7.0 |
| DivergeTerraform | 1.8.0 |

O DivergePHP e o DivergeTerraform podem sair antes da DivergePython 0.5.0, assim que os cenários
estiverem prontos. Cada publicação espera o "sim".

## Fora do escopo

- Personagens interativos (clicar, falar) ou que reagem ao progresso.
- Som.
- Cenário na landing page e nas telas de exercício.
- Escolher o cenário no painel ♿. O cenário é do módulo.
