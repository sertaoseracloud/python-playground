"""Nós largos do plano físico: agregação, Exchange (shuffle), Sort, joins, janelas, union e cache."""
from .. import _motor as m
from ..rdd import _EstreitoTardio, _Estreito, _Largo, _Ordenado, _Uniao
from .column import Entrada, compilar_ordem, novo_id
from .plano import INFINITO, No, tamanho_da_linha

# ---------- funções que rodam nas tarefas ----------


class ChaveLinha:
    def __init__(self, funcoes):
        self.funcoes = funcoes

    def __call__(self, linha):
        return tuple(f(linha) for f in self.funcoes)


def _hashavel(k):
    return tuple(tuple(x) if isinstance(x, list) else x for x in k)


class AgregarParcial:
    def __init__(self, chaves, valores, acumuladores):
        self.chaves, self.valores, self.acumuladores = chaves, valores, acumuladores

    def __call__(self, linhas):
        grupos = {}
        for linha in linhas:
            k = _hashavel(tuple(f(linha) for f in self.chaves))
            accs = grupos.get(k)
            if accs is None:
                accs = grupos[k] = [a.zero() for a in self.acumuladores]
            for i, (f, a) in enumerate(zip(self.valores, self.acumuladores)):
                accs[i] = a.somar(accs[i], f(linha))
        return list(grupos.items())


class AgregarFinal:
    def __init__(self, acumuladores, saidas, sem_chaves):
        self.acumuladores, self.saidas, self.sem_chaves = acumuladores, saidas, sem_chaves

    def __call__(self, itens):
        grupos = {}
        for k, accs in itens:
            if k in grupos:
                grupos[k] = [a.juntar(x, y) for a, x, y in zip(self.acumuladores, grupos[k], accs)]
            else:
                grupos[k] = list(accs)
        if not grupos and self.sem_chaves:
            grupos[()] = [a.zero() for a in self.acumuladores]
        saida = []
        for k, accs in grupos.items():
            base = k + tuple(a.fim(x) for a, x in zip(self.acumuladores, accs))
            saida.append(tuple(f(base) for f in self.saidas))
        return saida


class OrdenarLinhas:
    def __init__(self, chave):
        self.chave = chave

    def __call__(self, linhas):
        return sorted(linhas, key=self.chave)


class JuntarPorChave:
    """Junta as linhas da esquerda com as da direita que têm a mesma chave (NULL nunca casa)."""

    def __init__(self, tipo, chave_esq, chave_dir, residual, n_esq, n_dir):
        self.tipo, self.chave_esq, self.chave_dir = tipo, chave_esq, chave_dir
        self.residual, self.n_esq, self.n_dir = residual, n_esq, n_dir

    def __call__(self, lados):
        esquerda, direita = lados
        tabela = {}
        for r in direita:
            k = self.chave_dir(r)
            if None not in k:
                tabela.setdefault(k, []).append(r)
        usados, saida = set(), []
        for linha in esquerda:
            k = self.chave_esq(linha)
            pares = [] if None in k else tabela.get(k, [])
            if self.residual is not None:
                pares = [r for r in pares if self.residual(linha + r) is True]
            if self.tipo == 'semi':
                if pares:
                    saida.append(linha)
                continue
            if self.tipo == 'anti':
                if not pares:
                    saida.append(linha)
                continue
            for r in pares:
                saida.append(linha + r)
                usados.add(id(r))
            if not pares and self.tipo in ('left', 'full'):
                saida.append(linha + (None,) * self.n_dir)
        if self.tipo in ('right', 'full'):
            saida.extend((None,) * self.n_esq + r for r in direita if id(r) not in usados)
        return saida


class JuntarComTabela:
    """Broadcast: cada partição do lado grande junta com a tabela inteira do lado pequeno."""

    def __init__(self, juntar, tabela, construida_na_esquerda):
        self.juntar, self.tabela, self.esquerda = juntar, tabela, construida_na_esquerda

    def __call__(self, linhas):
        if self.esquerda:
            return self.juntar((self.tabela, linhas))
        return self.juntar((linhas, self.tabela))


class JuntarLaco:
    """Sem chave de igualdade: cada linha com cada linha (nested loop), com a condição."""

    def __init__(self, tipo, condicao, n_esq, n_dir):
        self.tipo, self.condicao, self.n_esq, self.n_dir = tipo, condicao, n_esq, n_dir

    def __call__(self, lados):
        esquerda, direita = lados
        usados, saida = set(), []
        for linha in esquerda:
            pares = [r for r in direita if self.condicao is None or self.condicao(linha + r) is True]
            if self.tipo == 'semi':
                if pares:
                    saida.append(linha)
                continue
            if self.tipo == 'anti':
                if not pares:
                    saida.append(linha)
                continue
            for r in pares:
                saida.append(linha + r)
                usados.add(id(r))
            if not pares and self.tipo in ('left', 'full'):
                saida.append(linha + (None,) * self.n_dir)
        if self.tipo in ('right', 'full'):
            saida.extend((None,) * self.n_esq + r for r in direita if id(r) not in usados)
        return saida


class CalcularJanela:
    """As funções de janela de uma partição já ordenada por (partição, ordem)."""

    def __init__(self, chave_particao, chave_ordem, calculos):
        self.chave_particao, self.chave_ordem, self.calculos = chave_particao, chave_ordem, calculos

    def __call__(self, linhas):
        saida = []
        inicio = 0
        while inicio < len(linhas):
            k = self.chave_particao(linhas[inicio])
            fim = inicio
            while fim < len(linhas) and self.chave_particao(linhas[fim]) == k:
                fim += 1
            grupo = linhas[inicio:fim]
            colunas = [c(grupo, self.chave_ordem) for c in self.calculos]
            saida.extend(linha + tuple(col[i] for col in colunas) for i, linha in enumerate(grupo))
            inicio = fim
        return saida


def _pares(grupo, chave):
    """Para cada linha: (primeira, última) posição das linhas com a mesma ordem (empates)."""
    chaves = [chave(linha) for linha in grupo] if chave else [None] * len(grupo)
    inicios, fins = [0] * len(grupo), [0] * len(grupo)
    i = 0
    while i < len(grupo):
        j = i
        while j + 1 < len(grupo) and (chave is None or chaves[j + 1] == chaves[i]):
            j += 1
        for k in range(i, j + 1):
            inicios[k], fins[k] = i, j
        i = j + 1
    return inicios, fins


class Ranking:
    def __init__(self, nome, n=None):
        self.nome, self.n = nome, n

    def __call__(self, grupo, chave):
        total = len(grupo)
        if self.nome == 'row_number':
            return list(range(1, total + 1))
        inicios, fins = _pares(grupo, chave)
        if self.nome == 'rank':
            return [i + 1 for i in inicios]
        if self.nome == 'dense_rank':
            saida, atual, anterior = [], 0, None
            for i in inicios:
                if i != anterior:
                    atual += 1
                    anterior = i
                saida.append(atual)
            return saida
        if self.nome == 'percent_rank':
            return [0.0 if total <= 1 else i / (total - 1) for i in inicios]
        if self.nome == 'cume_dist':
            return [(f + 1) / total for f in fins]
        if self.nome == 'ntile':
            n = self.n
            base, resto = divmod(total, n)
            saida = []
            for balde in range(n):
                saida.extend([balde + 1] * (base + (1 if balde < resto else 0)))
            return saida[:total]
        raise ValueError(self.nome)


class Deslocar:
    def __init__(self, valor, offset, padrao, para_frente):
        self.valor, self.offset, self.padrao, self.para_frente = valor, offset, padrao, para_frente

    def __call__(self, grupo, chave):
        saida = []
        for i, linha in enumerate(grupo):
            j = i + self.offset if self.para_frente else i - self.offset
            saida.append(self.valor(grupo[j]) if 0 <= j < len(grupo) else self.padrao(linha))
        return saida


class AgregarNoQuadro:
    """sum/avg/count... sobre o quadro de cada linha (ROWS, RANGE ou a partição inteira)."""

    def __init__(self, valor, acumulador, quadro, tem_ordem, chave_numerica, crescente):
        self.valor, self.acumulador, self.quadro = valor, acumulador, quadro
        self.tem_ordem, self.chave_numerica, self.crescente = tem_ordem, chave_numerica, crescente

    def _faixa(self, i, n, inicios, fins, numeros):
        from .window import _ILIMITADO
        if self.quadro is None:
            return (0, fins[i]) if self.tem_ordem else (0, n - 1)
        tipo, a, b = self.quadro
        if tipo == 'rows':
            de = 0 if a <= -_ILIMITADO else max(0, i + a)
            ate = n - 1 if b >= _ILIMITADO else min(n - 1, i + b)
            return de, ate
        de = 0 if a <= -_ILIMITADO else (inicios[i] if a == 0 else None)
        ate = n - 1 if b >= _ILIMITADO else (fins[i] if b == 0 else None)
        if de is None or ate is None:
            k = numeros[i]
            sinal = 1 if self.crescente else -1
            dentro = [j for j in range(n) if numeros[j] is not None and k is not None
                      and (de is not None or sinal * (numeros[j] - k) >= a) and (ate is not None or sinal * (numeros[j] - k) <= b)]
            de = de if de is not None else (min(dentro) if dentro else i + 1)
            ate = ate if ate is not None else (max(dentro) if dentro else i)
        return de, ate

    def __call__(self, grupo, chave):
        n = len(grupo)
        inicios, fins = _pares(grupo, chave if self.tem_ordem else None)
        valores = [self.valor(linha) for linha in grupo]
        numeros = [self.chave_numerica(linha) for linha in grupo] if self.chave_numerica else [None] * n
        a = self.acumulador
        saida = []
        for i in range(n):
            de, ate = self._faixa(i, n, inicios, fins, numeros)
            acc = a.zero()
            for j in range(de, ate + 1):
                acc = a.somar(acc, valores[j])
            saida.append(a.fim(acc))
        return saida


# ---------- nós ----------

def _refs(atributos):
    return ', '.join(a.ref() for a in atributos)


class HashAggregate(No):
    """Agregação em duas fases. `final=False`: o lado do map (soma o que cada partição tem)."""

    def __init__(self, filho, chaves, atributos_chave, aggs, atributos_agg, saidas, atributos_saida, final, base, operacao='groupBy'):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.chaves, self.atributos_chave, self.aggs, self.atributos_agg = chaves, atributos_chave, aggs, atributos_agg
        self.saidas, self.final, self.base, self.operacao = saidas, final, base, operacao
        self.saida = atributos_saida if final else list(atributos_chave) + list(atributos_agg)

    def linha(self, raiz=False):
        e = Entrada(self.base.saida, self.ansi)
        funcoes = [a.explicar(e) if self.final else a.explicar_parcial(e) for a in self.aggs]
        return f"HashAggregate(keys=[{_refs(self.atributos_chave)}], functions=[{', '.join(funcoes)}])"

    def tamanho(self):
        if not self.chaves:
            return tamanho_da_linha(self.saida)
        return self.filhos[0].tamanho()

    def rdd(self):
        filho = self.filhos[0].rdd()
        if not self.final:
            e = Entrada(self.base.saida, self.ansi)
            funcao = AgregarParcial([c.compilar(e) for c in self.chaves], [a.entrada_do_valor(e) for a in self.aggs],
                                    [a.acumulador(e) for a in self.aggs])
            return _Estreito(filho, funcao, self.operacao)
        e_base = Entrada(self.base.saida, self.ansi)
        e = Entrada(list(self.atributos_chave) + list(self.atributos_agg), self.ansi)
        funcao = AgregarFinal([a.acumulador(e_base) for a in self.aggs], [s.compilar(e) for s in self.saidas], not self.chaves)
        return _Estreito(filho, funcao, self.operacao)


class Exchange(No):
    """Shuffle: hashpartitioning, rangepartitioning, SinglePartition ou RoundRobinPartitioning."""

    def __init__(self, filho, tipo, n, chave=None, atributos=(), ordens=(), motivo='ENSURE_REQUIREMENTS', operacao='shuffle'):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.tipo, self.n, self.chave, self.atributos, self.ordens = tipo, (1 if tipo == 'single' else n), chave, list(atributos), list(ordens)
        self.motivo, self.operacao = motivo, operacao
        self.saida = filho.saida
        self.plan_id = novo_id()

    def linha(self, raiz=False):
        if self.tipo == 'hash':
            return f'Exchange hashpartitioning({_refs(self.atributos)}, {self.n}), {self.motivo}, [plan_id={self.plan_id}]'
        if self.tipo == 'range':
            e = self.entrada()
            return f"Exchange rangepartitioning({', '.join(o.explicar(e) for o in self.ordens)}, {self.n}), ENSURE_REQUIREMENTS, [plan_id={self.plan_id}]"
        if self.tipo == 'single':
            return f'Exchange SinglePartition, ENSURE_REQUIREMENTS, [plan_id={self.plan_id}]'
        return f'Exchange RoundRobinPartitioning({self.n}), REPARTITION_BY_NUM, [plan_id={self.plan_id}]'

    def num_particoes(self):
        return self.n

    def rdd(self):
        filho = self.filhos[0].rdd()
        if self.tipo == 'hash':
            return _Largo([filho], self.n, [m.Particionar(self.n, chave=self.chave)], None, self.operacao)
        if self.tipo == 'single':
            return _Largo([filho], 1, [m.Particionar(1, chave=_zero)], None, self.operacao)
        if self.tipo == 'roundrobin':
            return _Largo([filho], self.n, [m.ParticionarCircular(self.n)], None, self.operacao)
        return _Ordenado(filho, compilar_ordem(self.ordens, self.entrada()), True, self.n, self.operacao)


def _zero(_):
    return 0


class Sort(No):
    def __init__(self, filho, ordens, global_):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.ordens, self.global_ = list(ordens), global_
        self.saida = filho.saida

    def linha(self, raiz=False):
        e = self.entrada()
        return f"Sort [{', '.join(o.explicar(e) for o in self.ordens)}], {'true' if self.global_ else 'false'}, 0"

    def rdd(self):
        return _Estreito(self.filhos[0].rdd(), OrdenarLinhas(compilar_ordem(self.ordens, self.entrada())), 'sort')


class Coalesce(No):
    def __init__(self, filho, n):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.n = n
        self.saida = filho.saida

    def linha(self, raiz=False):
        return f'Coalesce {self.n}'

    def num_particoes(self):
        return min(self.n, self.filhos[0].num_particoes())

    def rdd(self):
        return self.filhos[0].rdd().coalesce(self.n)


class Union(No):
    def __init__(self, filhos, saida):
        super().__init__(filhos[0].sessao)
        self.filhos = tuple(filhos)
        self.saida = saida

    def linha(self, raiz=False):
        return 'Union'

    def num_particoes(self):
        return sum(f.num_particoes() for f in self.filhos)

    def tamanho(self):
        return sum(f.tamanho() for f in self.filhos)

    def rdd(self):
        return _Uniao([f.rdd() for f in self.filhos])


class ComDica(No):
    """F.broadcast(df): marca o DataFrame como pequeno (não aparece no explain)."""

    def __init__(self, filho):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.saida = filho.saida

    def transparente(self):
        return True

    def linha(self, raiz=False):
        return self.filhos[0].linha(raiz)

    def rdd(self):
        return self.filhos[0].rdd()


def tem_dica(no):
    while True:
        if isinstance(no, ComDica):
            return True
        if not no.transparente():
            return False
        no = no.filhos[0]


_NOMES_DO_JOIN = {'inner': 'Inner', 'left': 'LeftOuter', 'right': 'RightOuter', 'full': 'FullOuter',
                  'semi': 'LeftSemi', 'anti': 'LeftAnti', 'cross': 'Cross'}


class BroadcastExchange(No):
    def __init__(self, filho, atributos):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.atributos = atributos
        self.saida = filho.saida
        self.plan_id = novo_id()

    def linha(self, raiz=False):
        modo = f"HashedRelationBroadcastMode(List({_refs(self.atributos)}),false)" if self.atributos else 'IdentityBroadcastMode'
        return f'BroadcastExchange {modo}, [plan_id={self.plan_id}]'

    def rdd(self):
        return self.filhos[0].rdd()


class _Join(No):
    def __init__(self, esq, dir, tipo, chaves_esq, chaves_dir, residual):
        super().__init__(esq.sessao)
        self.esq, self.dir, self.tipo = esq, dir, tipo
        self.chaves_esq, self.chaves_dir, self.residual = chaves_esq, chaves_dir, residual
        anula_esq, anula_dir = tipo in ('right', 'full'), tipo in ('left', 'full')
        if tipo in ('semi', 'anti'):
            self.saida = list(esq.saida)
        else:
            self.saida = [a.com(anulavel=a.anulavel or anula_esq) for a in esq.saida] + [a.com(anulavel=a.anulavel or anula_dir) for a in dir.saida]

    def _compilar(self):
        e_esq, e_dir = Entrada(self.esq.saida, self.ansi), Entrada(self.dir.saida, self.ansi)
        e_tudo = Entrada(list(self.esq.saida) + list(self.dir.saida), self.ansi)
        chave_esq = ChaveLinha([c.compilar(e_esq) for c in self.chaves_esq])
        chave_dir = ChaveLinha([c.compilar(e_dir) for c in self.chaves_dir])
        residual = self.residual.compilar(e_tudo) if self.residual is not None else None
        return JuntarPorChave(self.tipo, chave_esq, chave_dir, residual, len(self.esq.saida), len(self.dir.saida))

    def _texto_chaves(self):
        e_esq, e_dir = Entrada(self.esq.saida, self.ansi), Entrada(self.dir.saida, self.ansi)
        return f"[{', '.join(c.explicar(e_esq) for c in self.chaves_esq)}], [{', '.join(c.explicar(e_dir) for c in self.chaves_dir)}]"

    def _texto_residual(self):
        if self.residual is None:
            return ''
        e = Entrada(list(self.esq.saida) + list(self.dir.saida), self.ansi)
        return f', {self.residual.explicar(e)}'

    def tamanho(self):
        if self.tipo in ('semi', 'anti'):
            return self.esq.tamanho()
        a, b = self.esq.tamanho(), self.dir.tamanho()
        return INFINITO if INFINITO in (a, b) else a * b


class BroadcastHashJoin(_Join):
    def __init__(self, esq, dir, tipo, chaves_esq, chaves_dir, residual, construir_esquerda):
        super().__init__(esq, dir, tipo, chaves_esq, chaves_dir, residual)
        self.construir_esquerda = construir_esquerda
        if construir_esquerda:
            self.filhos = (BroadcastExchange(esq, []), dir)
        else:
            self.filhos = (esq, BroadcastExchange(dir, []))
        e = Entrada((esq if construir_esquerda else dir).saida, self.ansi)
        lado = self.filhos[0] if construir_esquerda else self.filhos[1]
        lado.atributos = [_atributo_da_chave(c, e) for c in (self.chaves_esq if construir_esquerda else self.chaves_dir)]

    def linha(self, raiz=False):
        return (f"BroadcastHashJoin {self._texto_chaves()}, {_NOMES_DO_JOIN[self.tipo]}, "
                f"{'BuildLeft' if self.construir_esquerda else 'BuildRight'}, false{self._texto_residual()}")

    def num_particoes(self):
        return (self.dir if self.construir_esquerda else self.esq).num_particoes()

    def rdd(self):
        juntar = self._compilar()
        construido = self.esq if self.construir_esquerda else self.dir
        grande = self.dir if self.construir_esquerda else self.esq

        def fabrica():
            tabela = [x for p in construido.rdd()._executar('broadcast') for x in p]
            return JuntarComTabela(juntar, tabela, self.construir_esquerda)
        return _EstreitoTardio(grande.rdd(), fabrica, 'join')


def _atributo_da_chave(c, e):
    from .column import Col, Ref
    if isinstance(c, Col):
        return e.atributos[e.achar(c.nome_col, c.qualificador)]
    if isinstance(c, Ref):
        return e.atributos[e.achar_atributo(c.atributo)]
    from .column import Atributo
    return Atributo(c.nome(), c.tipo(e))


class SortMergeJoin(_Join):
    def __init__(self, esq, dir, tipo, chaves_esq, chaves_dir, residual):
        super().__init__(esq, dir, tipo, chaves_esq, chaves_dir, residual)
        from .column import Ordem
        n = int(self.conf('spark.sql.shuffle.partitions'))
        self.n = n
        lados = []
        for filho, chaves in ((esq, chaves_esq), (dir, chaves_dir)):
            e = Entrada(filho.saida, self.ansi)
            atributos = [_atributo_da_chave(c, e) for c in chaves]
            troca = Exchange(filho, 'hash', n, atributos=atributos, operacao='join')
            lados.append(Sort(troca, [Ordem(c) for c in chaves], False))
        self.filhos = tuple(lados)

    def linha(self, raiz=False):
        return f'SortMergeJoin {self._texto_chaves()}, {_NOMES_DO_JOIN[self.tipo]}{self._texto_residual()}'

    def num_particoes(self):
        return self.n

    def rdd(self):
        e_esq, e_dir = Entrada(self.esq.saida, self.ansi), Entrada(self.dir.saida, self.ansi)
        chave_esq = ChaveLinha([c.compilar(e_esq) for c in self.chaves_esq])
        chave_dir = ChaveLinha([c.compilar(e_dir) for c in self.chaves_dir])
        return _Largo([self.esq.rdd(), self.dir.rdd()], self.n,
                      [m.Particionar(self.n, chave=chave_esq), m.Particionar(self.n, chave=chave_dir)], self._compilar(), 'join')


class BroadcastNestedLoopJoin(_Join):
    def __init__(self, esq, dir, tipo, condicao):
        super().__init__(esq, dir, tipo, [], [], condicao)
        self.filhos = (esq, BroadcastExchange(dir, []))

    def linha(self, raiz=False):
        cond = self._texto_residual()
        return f'BroadcastNestedLoopJoin BuildRight, {_NOMES_DO_JOIN[self.tipo]}{cond}'

    def num_particoes(self):
        return 1 if self.tipo in ('right', 'full') else self.esq.num_particoes()

    def rdd(self):
        e = Entrada(list(self.esq.saida) + list(self.dir.saida), self.ansi)
        condicao = self.residual.compilar(e) if self.residual is not None else None
        juntar = JuntarLaco(self.tipo, condicao, len(self.esq.saida), len(self.dir.saida))
        if self.tipo in ('right', 'full'):  # precisa ver todas as linhas dos dois lados juntas
            return _Largo([self.esq.rdd(), self.dir.rdd()], 1, [m.Particionar(1, chave=_zero), m.Particionar(1, chave=_zero)], juntar, 'join')
        direita = self.dir

        def fabrica():
            tabela = [x for p in direita.rdd()._executar('broadcast') for x in p]
            return JuntarComTabela(juntar, tabela, False)
        return _EstreitoTardio(self.esq.rdd(), fabrica, 'join')


class Window(No):
    def __init__(self, filho, sobres, atributos, especificacao):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.sobres, self.atributos, self.spec = sobres, atributos, especificacao
        self.saida = list(filho.saida) + list(atributos)

    def linha(self, raiz=False):
        e = self.entrada()
        itens = ', '.join(f'{s.explicar(e)} AS {a.ref()}' for s, a in zip(self.sobres, self.atributos))
        particao = ', '.join(p.explicar(e) for p in self.spec.particao)
        ordem = ', '.join(o.explicar(e) for o in self.spec.ordem)
        return f'Window [{itens}], [{particao}], [{ordem}]'

    def rdd(self):
        from .window import FuncaoDeJanela
        e = self.entrada()
        chave_particao = ChaveLinha([p.compilar(e) for p in self.spec.particao])
        chave_ordem = compilar_ordem(self.spec.ordem, e) if self.spec.ordem else None
        calculos = []
        for s in self.sobres:
            f = s.funcao
            if isinstance(f, FuncaoDeJanela):
                if f.nome_func in ('lag', 'lead'):
                    calculos.append(Deslocar(f.args[0].compilar(e), f.args[1].valor, f.args[2].compilar(e), f.nome_func == 'lead'))
                else:
                    calculos.append(Ranking(f.nome_func, f.args[0].valor if f.args else None))
            else:
                numerica = None
                crescente = True
                if s.janela.quadro and s.janela.quadro[0] == 'range' and s.janela.ordem:
                    numerica = s.janela.ordem[0].compilar(e)
                    crescente = s.janela.ordem[0].crescente
                calculos.append(AgregarNoQuadro(f.entrada_do_valor(e), f.acumulador(e), s.janela.quadro, bool(s.janela.ordem), numerica, crescente))
        return _Estreito(self.filhos[0].rdd(), CalcularJanela(chave_particao, chave_ordem, calculos), 'Window')


class Guardado:
    """O que o cache de um DataFrame guarda: o plano e o RDD em cache (calculado na primeira ação)."""

    def __init__(self, plano):
        self.plano = plano
        self.rdd = None

    @property
    def calculado(self):
        return self.rdd is not None and self.rdd._guardado is not None

    def linha(self):
        return f"InMemoryRelation [{_refs(self.plano.saida)}], StorageLevel(disk, memory, deserialized, 1 replicas)"


class InMemoryTableScan(No):
    def __init__(self, guardado):
        super().__init__(guardado.plano.sessao)
        self.interno = guardado
        self.saida = guardado.plano.saida

    def filhos_no_explain(self):
        return ()

    def linha(self, raiz=False):
        return f'InMemoryTableScan [{_refs(self.saida)}]'

    def num_particoes(self):
        return self.interno.plano.num_particoes()

    def tamanho(self):
        return self.interno.plano.tamanho()

    def rdd(self):
        if self.interno.rdd is None:
            self.interno.rdd = self.interno.plano.rdd().cache()
        return self.interno.rdd


def eh_shuffle(no):
    return isinstance(no, Exchange)

