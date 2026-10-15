"""A árvore de decisão (classificação) do DivergePython, como a do Spark:
- os cortes de cada feature saem do findSplitsForContinuousFeature: os pontos médios entre valores
  vizinhos, ou, com mais valores que cortes, os pontos escolhidos pelo passo n / (cortes + 1);
- o melhor corte é o de maior ganho de gini (no empate, o primeiro), e o nó vira folha se o ganho
  for 0 ou se chegar ao maxDepth;
- no fim, a poda junta dois irmãos folhas que preveem a mesma classe.

Cada nível da árvore é um job: as partições contam, nos workers, as classes por corte de cada nó."""
import bisect


def cortes_continuos(contagens, num_cortes):
    """Os limiares de uma feature. contagens: [(valor, n)] em ordem de valor."""
    possiveis = len(contagens) - 1
    if possiveis <= 0:
        return []
    if possiveis <= num_cortes:
        return [(contagens[i - 1][0] + contagens[i][0]) / 2.0 for i in range(1, len(contagens))]
    passo = sum(c for _, c in contagens) / (num_cortes + 1)
    cortes, atual, alvo = [], contagens[0][1], passo
    for i in range(1, len(contagens)):
        anterior = atual
        atual += contagens[i][1]
        if abs(anterior - alvo) < abs(atual - alvo):
            cortes.append((contagens[i - 1][0] + contagens[i][0]) / 2.0)
            alvo += passo
    return cortes


def gini(contagem):
    total = sum(contagem)
    return 1.0 - sum((c / total) ** 2 for c in contagem) if total else 0.0


class NoArvore:
    def __init__(self, contagem):
        self.contagem = contagem
        self.feature = self.limiar = self.esq = self.dir = None
        self.ganho = 0.0

    @property
    def folha(self):
        return self.esq is None

    @property
    def previsao(self):
        return float(self.contagem.index(max(self.contagem)))


class _Valores:
    """Numa partição: as contagens de cada valor de cada feature e as das classes."""

    def __call__(self, linhas):
        valores, classes = None, {}
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray()
            if valores is None:
                valores = [{} for _ in x]
            for j, xj in enumerate(x):
                valores[j][xj] = valores[j].get(xj, 0) + 1
            classes[y] = classes.get(y, 0) + 1
        return [(valores, classes)] if valores is not None else []


class _ContarNivel:
    """Numa partição: para cada nó em aberto, as classes por intervalo de corte de cada feature."""

    def __init__(self, internos, abertos, cortes, num_classes):
        self.internos, self.abertos, self.cortes, self.num_classes = internos, set(abertos), cortes, num_classes

    def __call__(self, linhas):
        saida = {}
        for v, y in linhas:
            if v is None or y is None:
                continue
            x = v.toArray()
            no = 0
            while no in self.internos:
                feature, limiar = self.internos[no]
                no = 2 * no + 1 if x[feature] <= limiar else 2 * no + 2
            if no not in self.abertos:
                continue
            tabela = saida.setdefault(no, [[[0] * self.num_classes for _ in range(len(c) + 1)] for c in self.cortes])
            for j, cortes in enumerate(self.cortes):
                tabela[j][bisect.bisect_left(cortes, x[j])][int(y)] += 1
        return [saida]


def _melhor_corte(no, tabela, cortes, min_instancias):
    total = no.contagem
    n = sum(total)
    pai = gini(total)
    melhor = None
    for j, intervalos in enumerate(tabela):
        esq = [0] * len(total)
        for b in range(len(cortes[j])):
            esq = [a + c for a, c in zip(esq, intervalos[b])]
            dir_ = [t - a for t, a in zip(total, esq)]
            ne, nd = sum(esq), sum(dir_)
            if ne < min_instancias or nd < min_instancias:
                continue
            ganho = pai - (ne / n) * gini(esq) - (nd / n) * gini(dir_)
            if melhor is None or ganho > melhor[0]:
                melhor = (ganho, j, cortes[j][b], esq, dir_)
    return melhor


def treinar(dados, max_profundidade, max_bins, min_instancias, nome):
    from .base import por_particao
    partes = por_particao(dados, _Valores(), f'fit {nome} (cortes)')
    num_features = len(partes[0][0])
    valores = [{} for _ in range(num_features)]
    classes = {}
    for vs, cs in partes:
        for j, mapa in enumerate(vs):
            for valor, c in mapa.items():
                valores[j][valor] = valores[j].get(valor, 0) + c
        for y, c in cs.items():
            classes[y] = classes.get(y, 0) + c
    n = sum(classes.values())
    num_classes = int(max(classes)) + 1
    num_cortes = min(max_bins, n) - 1
    cortes = [cortes_continuos(sorted(v.items()), num_cortes) for v in valores]
    raiz = NoArvore([classes.get(float(c), 0) for c in range(num_classes)])
    nos, internos, nivel = {0: raiz}, {}, [0]
    for profundidade in range(max_profundidade):
        abertos = [i for i in nivel if gini(nos[i].contagem) > 0]
        if not abertos:
            break
        contagens = por_particao(dados, _ContarNivel(dict(internos), abertos, cortes, num_classes),
                                 f'fit {nome} (nível {profundidade + 1})')
        juntas = {}
        for parte in contagens:
            for i, tabela in parte.items():
                if i not in juntas:
                    juntas[i] = tabela
                    continue
                for j, intervalos in enumerate(tabela):
                    for b, cls in enumerate(intervalos):
                        juntas[i][j][b] = [a + c for a, c in zip(juntas[i][j][b], cls)]
        proximo = []
        for i in abertos:
            melhor = _melhor_corte(nos[i], juntas[i], cortes, min_instancias)
            if melhor is None or melhor[0] <= 0:
                continue
            no = nos[i]
            no.ganho, no.feature, no.limiar = melhor[0], melhor[1], melhor[2]
            no.esq, no.dir = NoArvore(melhor[3]), NoArvore(melhor[4])
            nos[2 * i + 1], nos[2 * i + 2] = no.esq, no.dir
            internos[i] = (no.feature, no.limiar)
            proximo += [2 * i + 1, 2 * i + 2]
        nivel = proximo
    podar(raiz)
    return raiz, num_classes, num_features


def podar(no):
    """Como o Spark: dois irmãos folhas com a mesma previsão viram uma folha só (o pai)."""
    if no.folha:
        return
    podar(no.esq)
    podar(no.dir)
    if no.esq.folha and no.dir.folha and no.esq.previsao == no.dir.previsao:
        no.esq = no.dir = no.feature = no.limiar = None
        no.ganho = 0.0


def profundidade(no):
    return 0 if no.folha else 1 + max(profundidade(no.esq), profundidade(no.dir))


def contar(no):
    return 1 if no.folha else 1 + contar(no.esq) + contar(no.dir)


def importancias(raiz, num_features):
    """O ganho × as linhas do nó, somado por feature e normalizado (o featureImportances do Spark)."""
    soma = [0.0] * num_features
    pilha = [raiz]
    while pilha:
        no = pilha.pop()
        if not no.folha:
            soma[no.feature] += no.ganho * sum(no.contagem)
            pilha += [no.esq, no.dir]
    total = sum(soma)
    return [s / total for s in soma] if total else soma


def folha_de(raiz, x):
    no = raiz
    while not no.folha:
        no = no.esq if x[no.feature] <= no.limiar else no.dir
    return no


def texto(no, recuo):
    from ..sql.mostrar import java_double
    p = ' ' * recuo
    if no.folha:
        return f'{p}Predict: {java_double(no.previsao)}\n'
    limiar = java_double(no.limiar)
    return (f'{p}If (feature {no.feature} <= {limiar})\n' + texto(no.esq, recuo + 1)
            + f'{p}Else (feature {no.feature} > {limiar})\n' + texto(no.dir, recuo + 1))
