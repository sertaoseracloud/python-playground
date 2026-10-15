"""Operadores com estado do streaming: a agregação (complete, update e append com marca d'água) e o
dropDuplicates.

O estado fica no processo principal, entre um lote e outro. Para cada chave, guarda os acumuladores
da agregação parcial, os mesmos do HashAggregate do lote. Cada lote roda a parte parcial nos workers,
só com as linhas novas, junta o resultado ao estado e emite as linhas do modo de saída.

A marca d'água é o maior tempo de evento já visto menos o atraso, recalculada no fim de cada lote. A
chave cujo tempo (o fim da janela, ou a própria coluna) não passa da marca d'água está vencida: o lote
a descarta e conta, e o estado a esquece. Como no Spark, o descarte conta as linhas depois da agregação
parcial."""
import copy
import datetime as dt

from diverge_runtime import estagios

from ...errors import AnalysisException
from .. import plano as P
from .. import types as T
from ..column import Col, Entrada, Ref
from ..plano_largo import AgregarFinal, HashAggregate
from .fonte import MarcaDagua

DEDUPLICAR = ('dropDuplicates', 'distinct')


def topo(no):
    while no.transparente():
        no = no.filhos[0]
    return no


def trocar(no, alvo, novo):
    """Uma cópia do caminho da raiz até `alvo`, com `novo` no lugar dele (o resto do plano é o mesmo)."""
    if no is alvo:
        return novo
    filhos = tuple(trocar(f, alvo, novo) for f in no.filhos)
    if all(a is b for a, b in zip(filhos, no.filhos)):
        return no
    copia = copy.copy(no)
    copia.filhos = filhos
    return copia


class _Linhas(P.No):
    """As linhas que o estado emitiu, no lugar da agregação, para o resto do plano (orderBy, select...)."""

    def __init__(self, sessao, saida, linhas):
        super().__init__(sessao)
        self.saida, self.linhas = saida, linhas

    def linha(self, raiz=False):
        return f'LocalTableScan [{P.lista_de_atributos(self.saida)}]'

    def num_particoes(self):
        return 1

    def tamanho(self):
        return P.INFINITO

    def rdd(self):
        return self.sessao.sparkContext.parallelize(self.linhas, 1)


def _nome(x):
    if isinstance(x, Col):
        return x.nome_col
    if isinstance(x, Ref):
        return x.atributo.nome
    return None


def temporais(fin, marca):
    """As chaves que dizem o tempo do evento: [(posição, é_janela)]. A janela vale pelo fim dela."""
    if marca is None:
        return []
    saida = []
    for i, (c, a) in enumerate(zip(fin.chaves, fin.atributos_chave)):
        if isinstance(a.tipo, T.StructType) and a.tipo.names == ['start', 'end']:
            saida.append((i, True))
        elif any(_nome(x) == marca.atributo.nome for x in c.percorrer()):
            saida.append((i, False))
    return saida


def analisar(plano, modo):
    """As regras do Spark para o estado. Devolve a agregação (ou None) e a marca d'água (ou None)."""
    finais = [n for n in P.nos(plano) if isinstance(n, HashAggregate) and n.final]
    if len(finais) > 1:
        raise AnalysisException('Multiple streaming aggregations are not supported with streaming DataFrames/Datasets;')
    marca = next((n for n in P.nos(plano) if isinstance(n, MarcaDagua)), None)
    if not finais:
        return None, marca
    fin = finais[0]
    if fin.operacao not in DEDUPLICAR and modo == 'append' and not temporais(fin, marca):
        raise AnalysisException('Append output mode not supported when there are streaming aggregations on streaming '
                                'DataFrames/DataSets without watermark;')
    return fin, marca


class ComEstado:
    def __init__(self, consulta, fin, marca):
        self.consulta, self.fin, self.wm = consulta, fin, marca
        self.dedup = fin.operacao in DEDUPLICAR
        e_base = Entrada(fin.base.saida, fin.ansi)
        self.acumuladores = [a.acumulador(e_base) for a in fin.aggs]
        e = Entrada(list(fin.atributos_chave) + list(fin.atributos_agg), fin.ansi)
        self.final = AgregarFinal(self.acumuladores, [s.compilar(e) for s in fin.saidas], not fin.chaves)
        self.temporais = temporais(fin, marca)
        self.no_topo = topo(consulta._plano) is fin
        self.estado = {}
        self.marca = None            # a marca d'água atual (sem fuso); None antes do primeiro tempo de evento
        self.marca_do_ultimo = None  # a que o último lote usou

    def _tempo(self, chave):
        tempos = [(chave[i][1] if janela else chave[i]) for i, janela in self.temporais if chave[i] is not None]
        return min(tempos) if tempos else None

    def _vencida(self, chave, marca):
        t = self._tempo(chave)
        return marca is not None and t is not None and t <= marca

    def lote(self, acao):
        from ..dataframe import DataFrame
        fin, marca, modo = self.fin, self.marca, self.consulta._modo
        pares = [par for p in fin.filhos[0].rdd()._executar(acao) for par in p]  # a agregação parcial, com o shuffle
        descartadas, novas, atualizadas = 0, [], {}
        for chave, accs in pares:
            if self._vencida(chave, marca):
                descartadas += 1
                continue
            atual = self.estado.get(chave)
            if atual is None:
                novas.append(chave)
                self.estado[chave] = list(accs)
            elif not self.dedup:
                self.estado[chave] = [a.juntar(x, y) for a, x, y in zip(self.acumuladores, atual, accs)]
            atualizadas[chave] = True
        if self.dedup:
            emitir = novas
        elif modo == 'complete':
            emitir = list(self.estado)
        elif modo == 'update':
            emitir = list(atualizadas)
        else:  # append: só a janela que a marca d'água fechou
            emitir = [k for k in self.estado if self._vencida(k, marca)]
        linhas = self.final([(k, self.estado[k]) for k in emitir]) if emitir else []
        removidas = 0
        if modo != 'complete':
            for k in [k for k in self.estado if self._vencida(k, marca)]:
                del self.estado[k]
                removidas += 1
        if not self.no_topo:
            plano = trocar(self.consulta._plano, fin, _Linhas(fin.sessao, fin.saida, linhas))
            linhas = DataFrame(plano, fin.sessao)._linhas(acao)
        self.marca_do_ultimo = marca
        self._atualizar_marca()
        return linhas, {'operador': 'dedupe' if self.dedup else 'stateStoreSave', 'estado': len(self.estado),
                        'atualizadas': len(novas) if self.dedup else len(atualizadas), 'removidas': removidas,
                        'descartadas': descartadas, 'marca_usada': marca, 'marca': self.marca}

    def _atualizar_marca(self):
        """O maior tempo de evento do lote menos o atraso (a marca d'água só anda para a frente)."""
        from ..dataframe import DataFrame
        if self.wm is None:
            return
        filho = self.wm.filhos[0]
        i = [a.id for a in filho.saida].index(self.wm.atributo.id)
        with estagios.local():
            tempos = [linha[i] for linha in DataFrame(filho, filho.sessao)._linhas('marca') if linha[i] is not None]
        if tempos:
            nova = max(tempos) - dt.timedelta(microseconds=self.wm.atraso)
            if self.marca is None or nova > self.marca:
                self.marca = nova

    def precisa_lote_vazio(self):
        """Como o Spark: se a marca d'água andou desde o último lote, um lote sem dados emite e limpa o estado."""
        return (bool(self.temporais) and self.consulta._modo != 'complete' and self.marca is not None
                and self.marca != self.marca_do_ultimo)
