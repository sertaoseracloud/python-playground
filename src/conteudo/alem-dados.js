// Dados do módulo 🌊 Spark além do batch (aba 📦 Dados). Pequenos e escritos à mão: cada valor
// esperado dos exercícios dá para conferir de cabeça. O caso oculto troca todos os arquivos.

// ---------- 🔺 Delta Lake: a cooperativa ----------
const ASSOCIADOS = `id,nome,cidade,ativo
1,Ana,Petrolina,true
2,Bento,Juazeiro,true
3,Cida,Crato,false
4,Dora,Sobral,true
`;
const ASSOCIADOS_OCULTO = `id,nome,cidade,ativo
1,Edu,Mossoró,true
2,Fia,Crato,false
3,Gil,Petrolina,true
`;
const ESTOQUE = `produto,qtd,preco
mel,10,25.0
farinha,40,6.5
rapadura,25,3.0
`;
const ESTOQUE_OCULTO = `produto,qtd,preco
mel,4,27.0
queijo,12,30.0
`;
// A entrada do dia: o que chegou na cooperativa (para o append e o merge).
const ENTRADA = `produto,qtd,preco
mel,15,25.0
feijao,30,8.0
`;
const ENTRADA_OCULTO = `produto,qtd,preco
queijo,20,31.0
milho,50,2.5
`;

export const coopAssociados = { 'associados.csv': ASSOCIADOS };
export const coopAssociadosOculto = { 'associados.csv': ASSOCIADOS_OCULTO };
export const coopEstoque = { 'estoque.csv': ESTOQUE, 'entrada-dia-1.csv': ENTRADA };
export const coopEstoqueOculto = { 'estoque.csv': ESTOQUE_OCULTO, 'entrada-dia-1.csv': ENTRADA_OCULTO };

// ---------- 🌊 Structured Streaming: as estações do sertão ----------
// Um arquivo por lote. A última linha do lote-03 visível (Crato, 07:40) e a do lote-04 oculto
// (Sobral, 13:50) chegam atrasadas: a janela delas já fechou na marca d'água do lote anterior, e a
// marca d'água de 5 minutos descarta as duas.
const lote = (...linhas) => `estacao,momento,temperatura,umidade,chuva_mm\n${linhas.map((l) => `${l}\n`).join('')}`;
export const estacoes = {
  'leituras/lote-01.csv': lote('Petrolina,2026-03-10 08:01:00,31.0,40,0.0', 'Crato,2026-03-10 08:03:00,27.5,70,12.0', 'Sobral,2026-03-10 08:04:00,33.5,35,0.0'),
  'leituras/lote-02.csv': lote('Petrolina,2026-03-10 08:12:00,34.0,38,0.0', 'Crato,2026-03-10 08:14:00,26.0,80,25.0'),
  'leituras/lote-03.csv': lote('Juazeiro,2026-03-10 08:21:00,35.5,30,0.0', 'Crato,2026-03-10 07:40:00,25.0,85,30.0'),
};
export const estacoesOculto = {
  'leituras/lote-01.csv': lote('Mossoró,2026-03-11 14:02:00,36.0,25,0.0', 'Sobral,2026-03-11 14:06:00,29.0,60,8.0'),
  'leituras/lote-02.csv': lote('Mossoró,2026-03-11 14:11:00,37.5,22,0.0'),
  'leituras/lote-03.csv': lote('Crato,2026-03-11 14:25:00,24.0,90,40.0', 'Sobral,2026-03-11 14:08:00,28.0,65,5.0', 'Mossoró,2026-03-11 14:26:00,38.0,20,0.0'),
  'leituras/lote-04.csv': lote('Juazeiro,2026-03-11 14:31:00,34.0,33,0.0', 'Sobral,2026-03-11 13:50:00,27.0,70,3.0'),
};

// ---------- 🤖 MLlib: a safra ----------
// Visível: producao_t = 3 + 0,01·chuva_mm + 2·area_ha + 1,5·irrigado (exata, sem ruído).
// Oculto:  producao_t = 1 + 0,02·chuva_mm + 1·area_ha + 3·irrigado.
// O risco (0 ou 1) cai com a chuva e com a irrigação, com exceções (Serra Talhada, Picos, Pau dos
// Ferros, Russas): sem separação perfeita, a regressão logística tem coeficientes finitos.
const SAFRA = 'municipio,cultura,chuva_mm,area_ha,irrigado,producao_t,risco\n';
const SAFRA_TREINO = `${SAFRA}Petrolina,uva,300,5,1,17.5,0
Juazeiro,manga,350,4,1,16.0,0
Crato,milho,800,3,0,17.0,0
Sobral,feijao,400,2,0,11.0,1
Mossoró,melao,250,6,1,19.0,0
Iguatu,milho,700,2,0,14.0,0
Quixadá,feijao,350,1,0,8.5,1
Arcoverde,milho,450,3,0,13.5,1
Serra Talhada,feijao,380,2,0,10.8,0
Picos,milho,600,4,0,17.0,1
Caicó,feijao,300,1,0,8.0,1
Barbalha,milho,900,2,0,16.0,0
`;
const SAFRA_TESTE = `${SAFRA}Ouricuri,feijao,320,2,0,10.2,1
Salgueiro,milho,750,3,0,16.5,0
Petrolina,uva,280,6,1,19.3,0
Tauá,feijao,360,1,0,8.6,1
Crato,milho,850,4,0,19.5,0
Sobral,feijao,500,2,0,12.0,1
`;
const SAFRA_TREINO_OCULTO = `${SAFRA}Afogados,feijao,400,2,0,11.0,1
Petrolândia,uva,300,4,1,14.0,0
Ouricuri,milho,350,3,0,11.0,1
Iguatu,milho,750,2,0,18.0,0
Juazeiro,uva,280,5,1,14.6,0
Crateús,feijao,420,1,0,10.4,1
Limoeiro,milho,800,3,0,20.0,0
Pau dos Ferros,feijao,390,2,0,10.8,0
Russas,milho,650,2,0,16.0,1
Lavras,feijao,500,1,0,12.0,1
`;
const SAFRA_TESTE_OCULTO = `${SAFRA}Arcoverde,feijao,330,2,0,9.6,1
Petrolina,uva,260,6,1,15.2,0
Barbalha,milho,900,2,0,21.0,0
Tauá,feijao,370,1,0,9.4,1
Sobral,milho,520,3,0,14.4,1
`;
export const safra = { 'safra-treino.csv': SAFRA_TREINO, 'safra-teste.csv': SAFRA_TESTE };
export const safraOculto = { 'safra-treino.csv': SAFRA_TREINO_OCULTO, 'safra-teste.csv': SAFRA_TESTE_OCULTO };

// Municípios para o KMeans: grupos bem separados pela chuva (sertão seco, serra, litoral).
const MUNICIPIOS = `municipio,chuva_anual,temperatura
Petrolina,480,28.0
Juazeiro,510,27.5
Mossoró,560,28.5
Recife,1600,26.0
Fortaleza,1450,26.5
Natal,1500,26.5
Garanhuns,1100,21.0
Triunfo,1150,20.5
Guaramiranga,1250,19.5
`;
const MUNICIPIOS_OCULTO = `municipio,chuva_anual,temperatura
Arcoverde,650,24.0
Sobral,700,27.5
Salvador,1700,25.5
João Pessoa,1650,26.0
Maceió,1750,25.5
Crato,1050,24.5
Ubajara,1150,22.0
Areia,1200,21.5
Tianguá,1100,22.0
`;
export const municipios = { 'municipios.csv': MUNICIPIOS };
export const municipiosOculto = { 'municipios.csv': MUNICIPIOS_OCULTO };
