# Fase 6: 🏗️ Projetos — design

Data: 2026-10-15 · Site: DivergePython · Versões: 0.6.0, 0.7.0 e 1.0.0 · Spec mestre: `2026-10-13-divergepython-design.md` (seção 7)

## Objetivo

O último módulo da trilha junta tudo em **18 projetos de 5 etapas** (90 etapas), todos em
PySpark, como pipelines reais: ler, limpar, juntar, agregar e entregar. Cada etapa parte da
solução da anterior. Na 1.0.0 entra o certificado final, "trilha completa".

Critério de sucesso:
- a solução de cada etapa passa nos casos visível e oculto, e o código inicial (a solução da etapa
  anterior) falha no visível;
- o aluno que resolveu a etapa anterior continua do próprio código;
- o certificado final só sai com todos os módulos e todos os projetos;
- axe sem violações (WCAG 2.2 AA) nos 4 temas e nenhuma rolagem horizontal a 375 px.

## Decisões (respostas do usuário)

| Pergunta | Decisão |
|---|---|
| Quantos projetos? | Os 18 × 5 do spec mestre, em 3 entregas de 6 projetos: 0.6.0, 0.7.0 e 1.0.0. |
| Como as etapas evoluem? | Tudo em PySpark: as 5 etapas são partes de um pipeline. |
| Certificado | Os projetos não têm certificado próprio (no DivergePHP há um certificado de projetos; aqui não, porque os projetos chegam em três versões e um certificado emitido não muda de conteúdo); o final vem na 1.0.0. |

## 1. As entregas e os projetos

Cada projeto tem uma lição "Visão geral" e 5 etapas: **1 fácil, 2 médias e 2 difíceis**, nessa ordem
(fácil, médio, médio, difícil, difícil). Os dados são escritos à mão, pequenos, com tema brasileiro,
e cada resposta esperada pode ser conferida de cabeça (como na fase 5). Cada etapa tem um caso oculto
com outros dados e os mesmos nomes de arquivo.

### 0.6.0 — DataFrame e SQL

| Projeto | Dados | Etapas |
|---|---|---|
| 📚 Contagem de palavras em livros | versos curtos escritos por nós, no estilo do cordel (`livros/*.txt`) | ler os textos; normalizar (minúsculas, sem pontuação); contar palavras; tirar as palavras vazias; as 3 mais frequentes por livro (os livros são curtos) |
| 🛒 Vendas por região | `vendas.csv`, `produtos.csv` | ler com schema; receita por venda; juntar com produtos; receita por região e categoria; ranking com a participação de cada região |
| 📜 Análise de logs | `logs/acesso-*.log` (formato de servidor web) | quebrar as linhas com regex; status por hora; erros 5xx por rota; as rotas mais lentas (percentil 95); sessões por IP |
| 🧺 Funil de e-commerce | `eventos.csv` (visita, carrinho, compra) | ler e tipar; eventos por etapa do funil; conversão entre etapas; funil por canal; quem abandonou o carrinho |
| 📊 Painel de indicadores | `pedidos.csv`, `clientes.csv`, `metas.csv` | indicadores do dia; ticket médio; clientes novos e recorrentes; comparação com a meta; o painel em uma tabela só |
| 📝 Notas de exame | `notas.csv` (sintéticas) | ler e limpar faltas; média por turma; percentis (25, 50, 75 e 90); faixa de cada aluno; turmas acima da mediana geral |

### 0.7.0 — Spark avançado

| Projeto | Dados | Etapas |
|---|---|---|
| 🚌 Mobilidade urbana | `viagens.csv` (um terminal com muito mais viagens) | viagens por linha; o desequilíbrio no `explain` e nas partições; salting da chave; agregar de volta; comparar os planos |
| 🏥 Saúde pública | `atendimentos.csv` por município e dia | casos por dia; média móvel de 7 dias (janela); variação semanal; municípios em alta; ranking por região |
| 🌾 Agronegócio | `safras.csv` por cultura, estado e ano | produção por cultura; `pivot` cultura × ano; crescimento ano a ano; os estados líderes; o relatório com `unpivot` (`stack`) |
| ☀️ Energia solar | `geracao.csv` de hora em hora | geração por dia; pico do dia; lacunas na série; preencher com a última leitura; acumulado do mês |
| #️⃣ Hashtags e seguidores | `posts.json` (com listas) | ler JSON; `explode` das hashtags; as mais usadas por dia; quem segue quem (`explode` duplo); alcance por hashtag |
| 🚚 Logística | `entregas.csv`, `cidades.csv` (pequena), `rotas.csv` | juntar com as cidades (broadcast); prazo por rota; atrasos; o plano com e sem broadcast; o relatório por transportadora |

### 1.0.0 — além do batch e o certificado final

| Projeto | Dados | Etapas |
|---|---|---|
| 🌡️ Sensores do sertão | `leituras/lote-*.csv` | a consulta de streaming; contagem por estação; janela de 10 minutos; marca d'água; alerta na memória com SQL |
| 🎵 Streaming de música | `plays/lote-*.json` | ler o stream; plays por música; top da semana (janela de 7 dias); `update` só do que mudou; o top em uma tabela de memória |
| 🥉🥈🥇 ETL bronze → prata → ouro | `bruto/*.csv` | bronze em Delta (como chegou); prata (limpa e tipada); ouro (agregada); `merge` da carga do dia; time travel para conferir |
| 🧹 Qualidade de dados e SCD tipo 2 | `clientes-dia-N.csv` | regras de qualidade; quarentena das linhas ruins; tabela de clientes em Delta; SCD tipo 2 com `merge` (início, fim, atual); a versão de uma data |
| 🎯 Recomendação | `avaliacoes.csv` (usuário, filme, nota) | preparar as features; agrupar usuários com KMeans; nota média por grupo; recomendar o que o grupo gosta; avaliar no teste |
| 🕵️ Detecção de fraude | `transacoes.csv` | features (valor, hora, distância); `Pipeline` com `StandardScaler`; regressão logística; AUC no teste; árvore de decisão e comparação |

## 2. Estrutura

- `src/conteudo/projetos/base.js`: `criarProjeto({ id, titulo, icone, descricao, resumo, dados, oculto, inicial, etapas })`,
  o mesmo modelo do DivergePHP adaptado ao Python: cada etapa declara só os arquivos que muda
  (`alteracoes`), a solução da etapa N é a da N-1 com essas alterações, e o código inicial da
  etapa N é a solução da N-1; `main.py` fica sempre primeiro. Cada etapa traz `codigo` (o trecho que entra
  no fim do `main.py`) ou `alteracoes` (os arquivos que troca).
- Um arquivo por projeto em `src/conteudo/projetos/`, e `src/conteudo/projetos/index.js` com o
  `moduloProjetos` (`id: 'projetos'`, `grupos`, `itens`).
- A tela (`src/ui/item.js`, `src/ui/inicio.js`) já trata `etapaAnterior` e `grupos`, herdados do
  DivergePHP: o aluno que resolveu a etapa anterior continua do próprio código. Conferir com teste.
  Na trilha, um módulo sem certificado não tem troféu.
- O módulo sai de `PROXIMOS_MODULOS` na 0.6.0. Até a 1.0.0, a descrição do módulo diz quantos
  projetos já estão no ar e que os próximos chegam nas versões seguintes.
- O motor ganha o que os projetos da 0.6.0 usam: `F.percentile_approx`, `sc.wholeTextFiles` e o CAST de
  TIMESTAMP para segundos, conferidos com o PySpark real (`c16`).

## 3. Correção

Sem regra nova: `dataframe` (com `ordem` e `aprox` quando preciso), `plano` (broadcast, shuffles),
`arquivo`, `stream`, `modelo` e `delta`. Uma etapa pode ter mais de uma regra, e a última
etapa de cada projeto confere o resultado final do pipeline.

## 4. Certificado final (1.0.0)

- `CERTIFICADOS.final`: "Engenharia de dados com Python e Spark: trilha completa", com a carga
  somada de todos os módulos (os projetos entram na soma) e o resumo "concluiu a trilha completa:
  os 5 módulos, 196 problemas práticos e 18 projetos (90 etapas)".
- Só sai com todos os módulos e todos os projetos concluídos; entra no fim da cadeia.
- O badge ★ ("TRILHA COMPLETA") já existe em `src/badges.js`; o teste de carga horária do final
  (`skipIf(!CERTIFICADOS.final)`) passa a rodar.

**Carga horária dos projetos:** por projeto, 10 (lição) + 15 + 30 + 30 + 45 + 45 = 175 min; 18
projetos = 3150 min = **52,5 h**.

## 5. Testes

- Os testes de conteúdo de sempre (`tests/conteudo.test.js`): a solução de cada etapa passa nos
  casos visível e oculto, e o código inicial falha no visível; ids únicos.
- `criarProjeto`: a solução da etapa N é a da N-1 com as alterações; o código inicial é a solução
  da anterior; `main.py` primeiro.
- A tela: com a etapa anterior resolvida, o editor abre com o código do aluno.
- Certificado final (1.0.0): só com tudo concluído; carga = soma dos módulos.
- Conferência manual: preview, axe nos 4 temas, 375 px.

## 6. Documentação e versão

- README, novidades e o número de exercícios na capa a cada entrega (0.6.0, 0.7.0 e 1.0.0).
- Na 1.0.0, a página de validação e a declaração de acessibilidade citam o certificado final.
- Publica só com o "sim" do usuário, uma entrega por vez.

## 7. Planos

Um plano por entrega: **0.6.0** (o modelo `criarProjeto` e os 6 projetos de DataFrame e SQL),
**0.7.0** (6 projetos de Spark avançado) e **1.0.0** (6 projetos de além do batch e o certificado
final). Cada plano termina com a suíte inteira verde.

## Fora do escopo

Projetos em Python puro ou com paralelismo sem Spark; certificado por projeto; dados reais
baixados da internet (todos os dados são escritos à mão).
