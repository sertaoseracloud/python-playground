"""Monta os planos das operações largas: agregação, janelas, ordenação, joins e union.

Aqui fica a parte "otimizador" do DivergePython, só com o essencial: escolher broadcast
quando um lado é pequeno (ou tem a dica F.broadcast) e não repetir o shuffle de janelas
com a mesma partição."""
from .. import _motor as m
from ..errors import AnalysisException
from . import plano as P
from . import plano_largo as L
from . import types as T
from .agregacoes import agregacoes_de
from .column import Alias, Atributo, Binario, Cast, Col, EhNulo, Entrada, Lit, Ordem, Ref, sem_alias, substituir


def _ansi(plano):
    return plano.ansi


def _particoes_de_shuffle(plano):
    return int(plano.sessao.conf.get('spark.sql.shuffle.partitions'))


def projetar(plano, exprs, operacao='select'):
    """select/withColumn: com agregação vira HashAggregate; com janela, Window; senão, Project."""
    from .gerador import gerar, tem_gerador
    if any(tem_gerador(x) for x in exprs):
        return gerar(plano, exprs, operacao)
    tem_janela = any(x.tem(lambda n: n.eh_janela) for x in exprs)
    if any(agregacoes_de(x) for x in exprs) and not tem_janela:
        return agregar(plano, [], exprs, operacao)
    if tem_janela:
        return janelas(plano, exprs, operacao)
    return P.Project(plano, exprs, operacao)


def _mesma(a, b, e):
    try:
        return a.explicar(e) == b.explicar(e)
    except AnalysisException:
        return False


def agregar(plano, chaves, saidas, operacao='groupBy'):
    e = Entrada(plano.saida, _ansi(plano))
    for c in chaves:
        c.tipo(e)
    atributos_chave = [P.atributo_de_saida(c, e) for c in chaves]
    achadas = {}

    def troca(no):
        if no.eh_agregacao:
            k = no.explicar(e)
            if k not in achadas:
                achadas[k] = (no, Atributo(no.nome(), no.tipo(e), anulavel=no.anulavel(e)))
            return Ref(achadas[k][1])
        if no.eh_janela or isinstance(no, Lit):
            return None
        for c, a in zip(chaves, atributos_chave):
            if _mesma(no, c, e):
                return Ref(a)
        return None
    novas = [substituir(x, troca) for x in saidas]
    aggs = [a for a, _ in achadas.values()]
    atributos_agg = [at for _, at in achadas.values()]
    e2 = Entrada(atributos_chave + atributos_agg, _ansi(plano))
    for original, x in zip(saidas, novas):
        try:
            x.tipo(e2)
        except AnalysisException as erro:
            if not erro.getErrorClass().startswith('UNRESOLVED_COLUMN'):
                raise
            nome = next((n.nome() for n in x.percorrer() if isinstance(n, (Col, Ref))), original.nome())
            raise AnalysisException(
                f'The non-aggregating expression `{nome}` is based on columns which are not participating in the GROUP BY clause. '
                f'Add the columns or the expression to the GROUP BY, aggregate the expression, or use `any_value({nome})` if you do not '
                'care which of the values within a group is returned.', 'MISSING_AGGREGATION',
                {'expression': f'`{nome}`'}, '42803') from None
    atributos_saida = [P.atributo_de_saida(x, e2) for x in novas]
    parcial = L.HashAggregate(plano, chaves, atributos_chave, aggs, atributos_agg, None, None, False, plano, operacao)
    troca_ = L.Exchange(parcial, 'hash' if chaves else 'single', _particoes_de_shuffle(plano), chave=m.chave_do_par,
                        atributos=atributos_chave, operacao=operacao)
    return L.HashAggregate(troca_, chaves, atributos_chave, aggs, atributos_agg, novas, atributos_saida, True, plano, operacao)


def janelas(plano, exprs, operacao='select'):
    from .window import Sobre
    grupos, mapa = {}, {}
    e = Entrada(plano.saida, _ansi(plano))
    for x in exprs:
        for no in x.percorrer():
            if isinstance(no, Sobre):
                k = no.explicar(e)
                if k not in mapa:
                    mapa[k] = None
                    grupos.setdefault(no.janela.chave(), []).append(no)
    atual = plano
    ultima = None
    for chave, sobres in grupos.items():
        spec = sobres[0].janela
        e_atual = Entrada(atual.saida, _ansi(plano))
        if ultima is None or ultima != chave[0]:
            if spec.particao:
                atributos = [L._atributo_da_chave(p, e_atual) for p in spec.particao]
                atual = L.Exchange(atual, 'hash', _particoes_de_shuffle(plano), chave=L.ChaveLinha([p.compilar(e_atual) for p in spec.particao]),
                                   atributos=atributos, operacao='Window')
            else:
                atual = L.Exchange(atual, 'single', 1, operacao='Window')
        atual = L.Sort(atual, [Ordem(p) for p in spec.particao] + list(spec.ordem), False)
        e_atual = Entrada(atual.saida, _ansi(plano))
        atributos = [Atributo(s.nome(), s.tipo(e_atual), anulavel=s.anulavel(e_atual)) for s in sobres]
        for s, a in zip(sobres, atributos):
            mapa[s.explicar(e)] = a
        atual = L.Window(atual, sobres, atributos, spec)
        ultima = chave[0]

    def troca(no):
        if isinstance(no, Sobre):
            return Ref(mapa[no.explicar(e)])
        return None
    return P.Project(atual, [substituir(x, troca) for x in exprs], operacao)


def ordenar(plano, ordens, operacao='orderBy'):
    e = Entrada(plano.saida, _ansi(plano))
    for o in ordens:
        o.tipo(e)
    troca = L.Exchange(plano, 'range', _particoes_de_shuffle(plano), ordens=ordens, operacao=operacao)
    return L.Sort(troca, ordens, True)


# ---------- joins ----------

_TIPOS = {
    'inner': 'inner', 'cross': 'cross', 'left': 'left', 'leftouter': 'left', 'left_outer': 'left',
    'right': 'right', 'rightouter': 'right', 'right_outer': 'right', 'full': 'full', 'outer': 'full',
    'fullouter': 'full', 'full_outer': 'full', 'semi': 'semi', 'leftsemi': 'semi', 'left_semi': 'semi',
    'anti': 'anti', 'leftanti': 'anti', 'left_anti': 'anti',
}


def tipo_do_join(how):
    tipo = _TIPOS.get(str(how).lower().replace(' ', ''))
    if tipo is None:
        from ..errors import PySparkValueError
        raise PySparkValueError(f'Unsupported join type: \'{how}\'. Supported join types include: inner, outer, full, fullouter, '
                                'full_outer, leftouter, left, left_outer, rightouter, right, right_outer, leftsemi, left_semi, semi, '
                                'leftanti, left_anti, anti, cross.', 'UNSUPPORTED_JOIN_TYPE')
    return tipo


def _so_de(expr, atributos):
    """A expressão só usa colunas destes atributos?"""
    ids = {a.id for a in atributos}
    nomes = [a.nome.lower() for a in atributos]
    usadas = False
    for no in expr.percorrer():
        if isinstance(no, Ref):
            usadas = True
            if no.atributo.id not in ids:
                return False
        elif isinstance(no, Col):
            usadas = True
            if nomes.count(no.nome_col.lower()) != 1 and not any(
                    (a.qualificador or '').lower() == (no.qualificador or '#').lower() and a.nome.lower() == no.nome_col.lower() for a in atributos):
                return False
            if no.qualificador and not any((a.qualificador or '').lower() == no.qualificador.lower() for a in atributos):
                return False
    return usadas


def _conjuncoes(expr):
    if isinstance(expr, Binario) and expr.op == 'and':
        return _conjuncoes(expr.a) + _conjuncoes(expr.b)
    return [expr]


def juntar(esq, dir, on, how):
    tipo = tipo_do_join(how or 'inner')
    usando = None
    condicao = None
    if isinstance(on, str):
        usando = [on]
    elif isinstance(on, (list, tuple)) and on and all(isinstance(x, str) for x in on):
        usando = list(on)
    elif isinstance(on, (list, tuple)) and on:
        condicao = on[0]._expr
        for c in on[1:]:
            condicao = Binario('and', condicao, c._expr)
    elif on is not None:
        condicao = on._expr
    chaves_esq, chaves_dir, resto = [], [], []
    if usando:
        e_esq, e_dir = Entrada(esq.saida, esq.ansi), Entrada(dir.saida, dir.ansi)
        for nome in usando:
            for lado, e_lado in (('left', e_esq), ('right', e_dir)):
                try:
                    e_lado.achar(nome)
                except AnalysisException:
                    colunas = ', '.join(f'`{a.nome}`' for a in e_lado.atributos)
                    raise AnalysisException(f'USING column `{nome}` cannot be resolved on the {lado} side of the join. '
                                            f'The {lado}-side columns: [{colunas}].', 'UNRESOLVED_USING_COLUMN_FOR_JOIN',
                                            {'colName': f'`{nome}`', 'side': lado}, '42703') from None
            chaves_esq.append(Ref(e_esq.atributos[e_esq.achar(nome)]))
            chaves_dir.append(Ref(e_dir.atributos[e_dir.achar(nome)]))
    elif condicao is not None:
        tudo = Entrada(list(esq.saida) + list(dir.saida), esq.ansi)
        condicao.tipo(tudo)
        for c in _conjuncoes(condicao):
            if isinstance(c, Binario) and c.op == '==':
                if _so_de(c.a, esq.saida) and _so_de(c.b, dir.saida):
                    chaves_esq.append(c.a)
                    chaves_dir.append(c.b)
                    continue
                if _so_de(c.b, esq.saida) and _so_de(c.a, dir.saida):
                    chaves_esq.append(c.b)
                    chaves_dir.append(c.a)
                    continue
            resto.append(c)
    residual = None
    for c in resto:
        residual = c if residual is None else Binario('and', residual, c)
    if tipo == 'cross' and (chaves_esq or residual is not None):
        tipo = 'inner'
    if not chaves_esq:
        no = L.BroadcastNestedLoopJoin(esq, dir, tipo if tipo != 'cross' else 'inner', residual)
        if tipo == 'cross':
            no.tipo = 'cross'
    else:
        no = _escolher(esq, dir, 'inner' if tipo == 'cross' else tipo, chaves_esq, chaves_dir, residual)
    if not usando:
        return no
    return _projetar_usando(no, esq, dir, tipo, chaves_esq, chaves_dir)


def _escolher(esq, dir, tipo, chaves_esq, chaves_dir, residual):
    limite = int(esq.sessao.conf.get('spark.sql.autoBroadcastJoinThreshold'))
    pode_dir = tipo in ('inner', 'left', 'semi', 'anti')
    pode_esq = tipo in ('inner', 'right')
    if pode_dir and L.tem_dica(dir):
        return L.BroadcastHashJoin(esq, dir, tipo, chaves_esq, chaves_dir, residual, False)
    if pode_esq and L.tem_dica(esq):
        return L.BroadcastHashJoin(esq, dir, tipo, chaves_esq, chaves_dir, residual, True)

    def cabe(p):
        return limite >= 0 and p.tamanho() <= limite
    cabe_dir, cabe_esq = pode_dir and cabe(dir), pode_esq and cabe(esq)
    if cabe_dir and cabe_esq:
        construir_esquerda = esq.tamanho() < dir.tamanho()
        return L.BroadcastHashJoin(esq, dir, tipo, chaves_esq, chaves_dir, residual, construir_esquerda)
    if cabe_dir:
        return L.BroadcastHashJoin(esq, dir, tipo, chaves_esq, chaves_dir, residual, False)
    if cabe_esq:
        return L.BroadcastHashJoin(esq, dir, tipo, chaves_esq, chaves_dir, residual, True)
    return L.SortMergeJoin(esq, dir, tipo, chaves_esq, chaves_dir, residual)


def _projetar_usando(no, esq, dir, tipo, chaves_esq, chaves_dir):
    """join(..., on='id'): a coluna da chave sai uma vez, no começo (no full, o coalesce dos dois lados)."""
    from .functions import coalesce
    from .column import Column
    ids_esq = {k.atributo.id for k in chaves_esq}
    ids_dir = {k.atributo.id for k in chaves_dir}
    saida_join = {a.id: a for a in no.saida}
    exprs = []
    for ke, kd in zip(chaves_esq, chaves_dir):
        if tipo == 'right':
            exprs.append(Ref(saida_join[kd.atributo.id]))
        elif tipo == 'full':
            exprs.append(Alias(coalesce(Column(Ref(saida_join[ke.atributo.id])), Column(Ref(saida_join[kd.atributo.id])))._expr, ke.atributo.nome))
        else:
            exprs.append(Ref(saida_join[ke.atributo.id]))
    exprs += [Ref(saida_join[a.id]) for a in esq.saida if a.id not in ids_esq]
    if tipo not in ('semi', 'anti'):
        exprs += [Ref(saida_join[a.id]) for a in dir.saida if a.id not in ids_dir]
    return P.Project(no, exprs, 'join')


# ---------- union ----------

def unir(planos):
    primeiro = planos[0]
    for p in planos[1:]:
        if len(p.saida) != len(primeiro.saida):
            raise AnalysisException(
                f'UNION can only be performed on inputs with the same number of columns, but the first input has '
                f'{len(primeiro.saida)} columns and the second input has {len(p.saida)} columns.',
                'NUM_COLUMNS_MISMATCH', {}, '42826')
    tipos = []
    for i in range(len(primeiro.saida)):
        t = T.NullType()
        for p in planos:
            t = T.tipo_mais_largo(t, p.saida[i].tipo)
        tipos.append(t)
    ajustados = []
    for p in planos:
        if any(a.tipo != t for a, t in zip(p.saida, tipos)):
            p = P.Project(p, [Ref(a) if a.tipo == t else Alias(Cast(Ref(a), t), a.nome) for a, t in zip(p.saida, tipos)], 'union')
        ajustados.append(p)
    saida = [a.com(anulavel=any(p.saida[i].anulavel for p in ajustados)) for i, a in enumerate(ajustados[0].saida)]
    return L.Union(ajustados, saida)


def por_nome(esq, dir, faltantes):
    nomes_esq = [a.nome.lower() for a in esq.saida]
    nomes_dir = [a.nome.lower() for a in dir.saida]
    if not faltantes:
        falta = [a.nome for a in esq.saida if a.nome.lower() not in nomes_dir]
        if falta or len(nomes_esq) != len(nomes_dir):
            raise AnalysisException(f'Cannot resolve column name "{(falta or [dir.saida[0].nome])[0]}" among ({", ".join(a.nome for a in dir.saida)}).',
                                    'NUM_COLUMNS_MISMATCH', {}, '42826')
    novos_esq = list(esq.saida)
    extras = [a for a in dir.saida if a.nome.lower() not in nomes_esq]
    if extras:
        esq = P.Project(esq, [Ref(a) for a in esq.saida] + [Alias(Cast(Lit(None), a.tipo), a.nome) for a in extras], 'unionByName')
        novos_esq = list(esq.saida)
    exprs = []
    for a in novos_esq:
        if a.nome.lower() in nomes_dir:
            exprs.append(Ref(dir.saida[nomes_dir.index(a.nome.lower())]))
        else:
            exprs.append(Alias(Cast(Lit(None), a.tipo), a.nome))
    return unir([esq, P.Project(dir, exprs, 'unionByName')])


def filtro_de_pivo(coluna, valor):
    return EhNulo(coluna) if valor is None else Binario('==', coluna, Lit(valor))


__all__ = ['projetar', 'agregar', 'janelas', 'ordenar', 'juntar', 'unir', 'por_nome', 'sem_alias']
