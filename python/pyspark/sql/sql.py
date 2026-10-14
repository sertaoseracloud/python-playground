"""Spark SQL do DivergePython: o tokenizador, o parser (descida recursiva) e a montagem do
DataFrame. As mesmas expressões servem para F.expr, selectExpr e filter("...").

Precedência: OR < AND < NOT < comparações (=, <>, IS NULL, IN, BETWEEN, LIKE) < + - || < * / % < unário."""
import datetime
import re

from ..errors import AnalysisException, ParseException
from . import functions as F
from . import types as T
from .column import (
    Alias, Binario, Caso, Cast, Col, Column, EhNulo, Em, Estrela, Like, Lit, Nao, Negativo, Ordem, Ref,
)

_PALAVRAS = {
    'select', 'from', 'where', 'group', 'by', 'having', 'order', 'limit', 'as', 'and', 'or', 'not', 'is', 'null',
    'in', 'between', 'like', 'rlike', 'ilike', 'case', 'when', 'then', 'else', 'end', 'cast', 'join', 'inner', 'left', 'right',
    'full', 'outer', 'cross', 'semi', 'anti', 'on', 'using', 'distinct', 'all', 'union', 'asc', 'desc', 'nulls',
    'first', 'last', 'true', 'false', 'over', 'partition', 'rows', 'range', 'unbounded', 'preceding', 'following',
    'current', 'row', 'with', 'date', 'timestamp', 'interval',
}

_TOKEN = re.compile(r"""
    (?P<espaco>\s+|--[^\n]*)
  | (?P<numero>\d+\.\d*(?:[eE][+-]?\d+)?[dD]?|\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+)?[LlDd]?)
  | (?P<texto>'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.)*")
  | (?P<crase>`[^`]+`)
  | (?P<nome>[A-Za-z_][A-Za-z_0-9]*)
  | (?P<op><=>|<=|>=|<>|!=|==|\|\||[=<>+\-*/%(),.;])
""", re.VERBOSE)


class Token:
    __slots__ = ('tipo', 'valor', 'pos')

    def __init__(self, tipo, valor, pos):
        self.tipo, self.valor, self.pos = tipo, valor, pos

    def __repr__(self):
        return f'{self.tipo}:{self.valor}'


def _erro(texto, token):
    perto = token.valor if token.tipo != 'fim' else 'end of input'
    return ParseException(f"Syntax error at or near '{perto}'.", 'PARSE_SYNTAX_ERROR', {'error': f"'{perto}'"}, '42601')


def tokenizar(texto):
    tokens, i = [], 0
    while i < len(texto):
        m = _TOKEN.match(texto, i)
        if not m:
            raise ParseException(f"Syntax error at or near '{texto[i]}'.", 'PARSE_SYNTAX_ERROR', {}, '42601')
        tipo = m.lastgroup
        valor = m.group()
        if tipo == 'nome' and valor.lower() in _PALAVRAS:
            tokens.append(Token('palavra', valor.lower(), i))
        elif tipo != 'espaco':
            tokens.append(Token(tipo, valor, i))
        i = m.end()
    tokens.append(Token('fim', '', len(texto)))
    return tokens


def _texto_literal(bruto):
    aspas = bruto[0]
    miolo = bruto[1:-1]
    if aspas == "'":
        miolo = miolo.replace("''", "'")
    return re.sub(r'\\(.)', lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), miolo)


# Argumentos que as funções do Python recebem como valor (não como coluna).
_LITERAIS = {
    'round': {1}, 'bround': {1}, 'substring': {1, 2}, 'substr': {1, 2}, 'split': {1, 2}, 'regexp_replace': {1, 2},
    'regexp_extract': {1, 2}, 'lpad': {1, 2}, 'rpad': {1, 2}, 'concat_ws': {0}, 'date_format': {1}, 'to_date': {1},
    'to_timestamp': {1}, 'sort_array': {1}, 'ntile': {0}, 'lag': {1, 2}, 'lead': {1, 2}, 'instr': {1}, 'repeat': {1},
    'element_at': {1}, 'array_join': {1}, 'first': {1}, 'last': {1}, 'date_add': {1}, 'date_sub': {1},
}
_SINONIMOS = {'substr': 'substring', 'nvl': 'coalesce', 'ifnull': 'coalesce', 'mean': 'avg', 'std': 'stddev',
              'char_length': 'length', 'character_length': 'length', 'ucase': 'upper', 'lcase': 'lower', 'day': 'dayofmonth',
              'power': 'pow', 'ceiling': 'ceil', 'count_distinct': 'countDistinct'}


class Parser:
    def __init__(self, texto, sessao=None):
        self.tokens = tokenizar(texto)
        self.i = 0
        self.sessao = sessao
        self.ctes = {}

    # ---------- básico ----------
    @property
    def atual(self):
        return self.tokens[self.i]

    def ver(self, *palavras, desloca=0):
        t = self.tokens[min(self.i + desloca, len(self.tokens) - 1)]
        return t.tipo == 'palavra' and t.valor in palavras

    def ver_op(self, *ops):
        return self.atual.tipo == 'op' and self.atual.valor in ops

    def pegar(self):
        t = self.atual
        self.i += 1
        return t

    def esperar(self, *palavras):
        if not self.ver(*palavras):
            raise _erro(None, self.atual)
        return self.pegar()

    def esperar_op(self, op):
        if not self.ver_op(op):
            raise _erro(None, self.atual)
        return self.pegar()

    def aceitar(self, *palavras):
        if self.ver(*palavras):
            return self.pegar()
        return None

    def aceitar_op(self, op):
        if self.ver_op(op):
            return self.pegar()
        return None

    def nome(self):
        t = self.atual
        if t.tipo == 'nome':
            self.i += 1
            return t.valor
        if t.tipo == 'crase':
            self.i += 1
            return t.valor[1:-1]
        if t.tipo == 'palavra' and t.valor not in ('from', 'where', 'group', 'order', 'having', 'limit', 'on', 'join',
                                                  'union', 'inner', 'left', 'right', 'full', 'cross', 'using', 'as',
                                                  'when', 'then', 'else', 'end', 'and', 'or'):
            self.i += 1
            return t.valor
        raise _erro(None, t)

    def fim(self):
        self.aceitar_op(';')
        if self.atual.tipo != 'fim':
            raise _erro(None, self.atual)

    # ---------- expressões ----------
    def expressao(self):
        return self.ou()

    def ou(self):
        e = self.e()
        while self.aceitar('or'):
            e = Binario('or', e, self.e())
        return e

    def e(self):
        e = self.nao()
        while self.aceitar('and'):
            e = Binario('and', e, self.nao())
        return e

    def nao(self):
        if self.aceitar('not'):
            return Nao(self.nao())
        return self.comparacao()

    def comparacao(self):
        e = self.soma()
        while True:
            if self.atual.tipo == 'op' and self.atual.valor in ('=', '==', '!=', '<>', '<', '<=', '>', '>=', '<=>'):
                op = self.pegar().valor
                d = self.soma()
                if op in ('!=', '<>'):
                    e = Nao(Binario('==', e, d))
                else:
                    e = Binario('==' if op == '=' else op, e, d)
                continue
            if self.ver('is'):
                self.pegar()
                negado = bool(self.aceitar('not'))
                self.esperar('null')
                e = EhNulo(e, negado)
                continue
            negado = False
            if self.ver('not') and self.ver('in', 'between', 'like', 'rlike', 'ilike', desloca=1):
                self.pegar()
                negado = True
            if self.aceitar('in'):
                self.esperar_op('(')
                valores = [self.expressao()]
                while self.aceitar_op(','):
                    valores.append(self.expressao())
                self.esperar_op(')')
                e = Em(e, valores)
            elif self.aceitar('between'):
                baixo = self.soma()
                self.esperar('and')
                alto = self.soma()
                e = Binario('and', Binario('>=', e, baixo), Binario('<=', e, alto))
            elif self.ver('like', 'rlike', 'ilike'):
                tipo = self.pegar().valor
                padrao = self.primario()
                texto = padrao.valor if isinstance(padrao, Lit) else ''
                e = Like(e, texto, regex=tipo == 'rlike', ilike=tipo == 'ilike')
            else:
                if negado:
                    raise _erro(None, self.atual)
                return e
            if negado:
                e = Nao(e)

    def soma(self):
        e = self.produto()
        while self.ver_op('+', '-', '||'):
            op = self.pegar().valor
            d = self.produto()
            e = F.concat(Column(e), Column(d))._expr if op == '||' else Binario(op, e, d)
        return e

    def produto(self):
        e = self.unario()
        while self.ver_op('*', '/', '%'):
            op = self.pegar().valor
            e = Binario(op, e, self.unario())
        return e

    def unario(self):
        if self.aceitar_op('-'):
            x = self.unario()
            if isinstance(x, Lit) and isinstance(x.valor, (int, float)) and not isinstance(x.valor, bool):
                return Lit(-x.valor)
            return Negativo(x)
        if self.aceitar_op('+'):
            return self.unario()
        return self.primario()

    def primario(self):
        t = self.atual
        if t.tipo == 'numero':
            self.i += 1
            v = t.valor
            if v[-1] in 'Ll':
                return Lit(int(v[:-1]), T.LongType())
            if v[-1] in 'Dd':
                return Lit(float(v[:-1]))
            if re.fullmatch(r'\d+', v):
                return Lit(int(v))
            return Lit(float(v))
        if t.tipo == 'texto':
            self.i += 1
            return Lit(_texto_literal(t.valor))
        if self.aceitar('null'):
            return Lit(None)
        if self.aceitar('true'):
            return Lit(True)
        if self.aceitar('false'):
            return Lit(False)
        if self.ver('date', 'timestamp') and self.tokens[self.i + 1].tipo == 'texto':
            tipo = self.pegar().valor
            texto = _texto_literal(self.pegar().valor)
            if tipo == 'date':
                return Lit(datetime.date.fromisoformat(texto))
            return Lit(datetime.datetime.fromisoformat(texto))
        if self.aceitar('case'):
            return self.caso()
        if self.aceitar('cast'):
            self.esperar_op('(')
            x = self.expressao()
            self.esperar('as')
            tipo = self.tipo()
            self.esperar_op(')')
            return Cast(x, tipo)
        if self.aceitar_op('('):
            x = self.expressao()
            self.esperar_op(')')
            return x
        if self.ver_op('*'):
            self.pegar()
            return Estrela()
        if t.tipo in ('nome', 'crase') or (t.tipo == 'palavra' and t.valor in ('first', 'last', 'left', 'right', 'date', 'timestamp', 'row')):
            nome = self.nome()
            if self.ver_op('(') and t.tipo != 'crase':
                return self.funcao(nome)
            if self.aceitar_op('.'):
                if self.aceitar_op('*'):
                    return Estrela(nome)
                return Col(self.nome(), qualificador=nome)
            return Col(nome, qualificador=None) if '.' not in nome else Col(nome)
        raise _erro(None, t)

    def tipo(self):
        texto = self.nome()
        if self.ver_op('<'):
            profundidade = 0
            while True:
                tok = self.pegar()
                texto += tok.valor if tok.tipo != 'palavra' else tok.valor
                if tok.valor == '<':
                    profundidade += 1
                elif tok.valor == '>':
                    profundidade -= 1
                    if profundidade == 0:
                        break
                if tok.tipo == 'fim':
                    raise _erro(None, tok)
        elif self.aceitar_op('('):
            while not self.aceitar_op(')'):
                self.pegar()
        return T.ler_tipo(texto)

    def caso(self):
        base = None
        if not self.ver('when'):
            base = self.expressao()
        ramos = []
        while self.aceitar('when'):
            c = self.expressao()
            if base is not None:
                c = Binario('==', base, c)
            self.esperar('then')
            ramos.append((c, self.expressao()))
        senao = self.expressao() if self.aceitar('else') else None
        self.esperar('end')
        return Caso(ramos, senao)

    def funcao(self, nome):
        self.esperar_op('(')
        baixo = nome.lower()
        distinto = bool(self.aceitar('distinct'))
        args = []
        if baixo == 'count' and self.ver_op('*'):
            self.pegar()
            args = [Lit(1)]
        elif not self.ver_op(')'):
            args.append(self.expressao())
            while self.aceitar_op(','):
                args.append(self.expressao())
        self.esperar_op(')')
        col = self._chamar(baixo, nome, args, distinto)
        if self.aceitar('over'):
            col = col.over(self.janela())
        return col._expr

    def _chamar(self, baixo, nome, args, distinto):
        if baixo == 'count' and distinto:
            return F.countDistinct(*[Column(a) for a in args])
        if baixo == 'sum' and distinto:
            return F.sum_distinct(Column(args[0]))
        if baixo == 'count' and args and isinstance(args[0], Lit):
            return F.count('*')
        if baixo == 'if' and len(args) == 3:
            return F.when(Column(args[0]), Column(args[1])).otherwise(Column(args[2]))
        if baixo == 'nullif' and len(args) == 2:
            return F.when(Column(Binario('==', args[0], args[1])), Column(Lit(None))).otherwise(Column(args[0]))
        if self.sessao is not None and baixo in getattr(self.sessao, '_udfs', {}):
            return self.sessao._udfs[baixo](*[Column(a) for a in args])
        nome_f = _SINONIMOS.get(baixo, baixo)
        funcao = getattr(F, nome_f, None) if not nome_f.startswith('_') else None
        if funcao is None or not callable(funcao) or nome_f in ('col', 'lit', 'expr', 'broadcast', 'udf'):
            raise AnalysisException(
                f'Cannot resolve function `{nome}` on search path [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`].',
                'UNRESOLVED_ROUTINE', {'routineName': f'`{nome}`'}, '42883')
        literais = _LITERAIS.get(baixo, set()) | _LITERAIS.get(nome_f, set())
        valores = []
        for i, a in enumerate(args):
            if i in literais and isinstance(a, Lit):
                valores.append(a.valor)
            else:
                valores.append(Column(a))
        return funcao(*valores)

    def janela(self):
        from .window import Window, WindowSpec
        self.esperar_op('(')
        spec = WindowSpec()
        if self.aceitar('partition'):
            self.esperar('by')
            cols = [Column(self.expressao())]
            while self.aceitar_op(','):
                cols.append(Column(self.expressao()))
            spec = spec.partitionBy(*cols)
        if self.aceitar('order'):
            self.esperar('by')
            spec = spec.orderBy(*[Column(o) for o in self.ordens()])
        if self.ver('rows', 'range'):
            tipo = self.pegar().valor
            self.esperar('between')
            a = self.ponta(Window)
            self.esperar('and')
            b = self.ponta(Window)
            spec = spec.rowsBetween(a, b) if tipo == 'rows' else spec.rangeBetween(a, b)
        self.esperar_op(')')
        return spec

    def ponta(self, Window):
        if self.aceitar('unbounded'):
            return Window.unboundedPreceding if self.pegar().valor == 'preceding' else Window.unboundedFollowing
        if self.aceitar('current'):
            self.esperar('row')
            return Window.currentRow
        n = self.primario()
        lado = self.pegar().valor
        return -n.valor if lado == 'preceding' else n.valor

    def ordens(self):
        lista = [self.ordem()]
        while self.aceitar_op(','):
            lista.append(self.ordem())
        return lista

    def ordem(self):
        x = self.expressao()
        crescente = True
        if self.aceitar('desc'):
            crescente = False
        else:
            self.aceitar('asc')
        nulos = None
        if self.aceitar('nulls'):
            nulos = self.pegar().valor == 'first'
        return Ordem(x, crescente, nulos)

    def item(self):
        x = self.expressao()
        if isinstance(x, Estrela):  # * não tem alias
            return x
        if self.aceitar('as'):
            return Alias(x, self.nome())
        if self.atual.tipo in ('nome', 'crase'):
            return Alias(x, self.nome())
        return x

    # ---------- consultas ----------
    def consulta(self):
        if self.aceitar('with'):
            while True:
                nome = self.nome()
                self.esperar('as')
                self.esperar_op('(')
                df = self.consulta()
                self.esperar_op(')')
                self.ctes[nome.lower()] = df
                if not self.aceitar_op(','):
                    break
        df = self.select()
        while self.aceitar('union'):
            todos = bool(self.aceitar('all'))
            self.aceitar('distinct')
            outro = self.select(sem_ordem=True)
            df = df.union(outro)
            if not todos:
                df = df.distinct()
        return df

    def tabela(self):
        if self.aceitar_op('('):
            df = self.consulta()
            self.esperar_op(')')
            self.aceitar('as')
            return df.alias(self.nome())
        nome = self.nome()
        while self.aceitar_op('.'):
            nome = self.nome()
        df = self.ctes.get(nome.lower())
        if df is None:
            df = self.sessao.table(nome)
        alias = nome
        if self.aceitar('as'):
            alias = self.nome()
        elif self.atual.tipo in ('nome', 'crase'):
            alias = self.nome()
        return df.alias(alias)

    def juncoes(self, df):
        while True:
            como = None
            if self.aceitar('join'):
                como = 'inner'
            elif self.ver('inner') and self.ver('join', desloca=1):
                self.pegar()
                self.pegar()
                como = 'inner'
            elif self.ver('cross'):
                self.pegar()
                self.esperar('join')
                como = 'cross'
            elif self.ver('left', 'right', 'full'):
                lado = self.pegar().valor
                if lado == 'left' and self.ver('semi', 'anti'):
                    como = 'left_' + self.pegar().valor
                else:
                    self.aceitar('outer')
                    como = lado
                self.esperar('join')
            elif self.aceitar_op(','):
                como = 'cross'
            else:
                return df
            outro = self.tabela()
            if self.aceitar('on'):
                df = df.join(outro, Column(self.expressao()), como)
            elif self.aceitar('using'):
                self.esperar_op('(')
                cols = [self.nome()]
                while self.aceitar_op(','):
                    cols.append(self.nome())
                self.esperar_op(')')
                df = df.join(outro, cols, como)
            else:
                df = df.crossJoin(outro) if como == 'cross' else df.join(outro, None, como)

    def select(self, sem_ordem=False):
        from .agregacoes import agregacoes_de
        from .dataframe import DataFrame
        from .plano import UmaLinha
        self.esperar('select')
        distinto = bool(self.aceitar('distinct'))
        self.aceitar('all')
        itens = [self.item()]
        while self.aceitar_op(','):
            itens.append(self.item())
        if self.aceitar('from'):
            df = self.juncoes(self.tabela())
        else:
            df = DataFrame(UmaLinha(self.sessao), self.sessao)
        if self.aceitar('where'):
            df = df.filter(Column(self.expressao()))
        grupo = None
        if self.aceitar('group'):
            self.esperar('by')
            grupo = [self.expressao()]
            while self.aceitar_op(','):
                grupo.append(self.expressao())
        having = self.expressao() if self.aceitar('having') else None
        ordens = None
        if not sem_ordem and self.aceitar('order'):
            self.esperar('by')
            ordens = self.ordens()
        limite = None
        if not sem_ordem and self.aceitar('limit'):
            limite = self.primario().valor
        agregado = grupo is not None or having is not None or any(agregacoes_de(x) for x in itens)
        if agregado:
            df = self._agregado(df, itens, grupo or [], having, ordens)
        else:
            df = self._simples(df, itens, ordens)
        if distinto:
            df = df.distinct()
        if limite is not None:
            df = df.limit(limite)
        return df

    @staticmethod
    def _aliases(itens):
        return {x.alias.lower(): x.filho for x in itens if isinstance(x, Alias)}

    def _trocar_aliases(self, expr, aliases, df):
        """HAVING e ORDER BY podem usar os aliases do SELECT (se não forem colunas da tabela)."""
        from .column import substituir
        nomes = {a.nome.lower() for a in df._plano.saida}

        def troca(no):
            if isinstance(no, Col) and no.qualificador is None and no.nome_col.lower() in aliases and no.nome_col.lower() not in nomes:
                return aliases[no.nome_col.lower()]
            return None
        return substituir(expr, troca)

    def _agregado(self, df, itens, grupo, having, ordens):
        from .avancado import agregar
        aliases = self._aliases(itens)
        chaves = []
        for g in grupo:
            if isinstance(g, Lit) and isinstance(g.valor, int):
                g = itens[g.valor - 1]
                g = g.filho if isinstance(g, Alias) else g
            chaves.append(self._trocar_aliases(g, aliases, df))
        expandidos = []
        e = df._entrada()
        for x in itens:
            if isinstance(x, Estrela):
                expandidos.extend(x.expandir(e))
            else:
                expandidos.append(x)
        extras = []
        if having is not None:
            extras.append(Alias(self._trocar_aliases(having, aliases, df), '__having'))
        nomes_saida = [x.nome().lower() for x in expandidos]
        ordens_finais = []
        for i, o in enumerate(ordens or []):
            base = o.filho
            if isinstance(base, Col) and base.qualificador is None and base.nome_col.lower() in nomes_saida:
                ordens_finais.append(Ordem(Col(base.nome_col), o.crescente, o.nulos_primeiro))
            else:
                extras.append(Alias(self._trocar_aliases(base, aliases, df), f'__ordem{i}'))
                ordens_finais.append(Ordem(Col(f'__ordem{i}'), o.crescente, o.nulos_primeiro))
        plano = agregar(df._plano, chaves, expandidos + extras, 'groupBy')
        df = df._novo(plano)
        if having is not None:
            df = df.filter(Column(Col('__having')))
        if ordens_finais:
            df = df.orderBy(*[Column(o) for o in ordens_finais])
        if extras:
            df = df.select(*[Column(Ref(a)) for a in df._plano.saida[:len(expandidos)]])
        return df

    def _simples(self, df, itens, ordens):
        if not ordens:
            return df.select(*[Column(x) for x in itens])
        projetado = df.select(*[Column(x) for x in itens])
        try:
            return projetado.orderBy(*[Column(o) for o in ordens])
        except AnalysisException:
            aliases = self._aliases(itens)
            ordenado = df.orderBy(*[Column(Ordem(self._trocar_aliases(o.filho, aliases, df), o.crescente, o.nulos_primeiro)) for o in ordens])
            return ordenado.select(*[Column(x) for x in itens])


def ler_expressao(texto):
    p = Parser(texto)
    x = p.item()
    p.fim()
    return x


def executar(sessao, texto):
    p = Parser(texto, sessao)
    df = p.consulta()
    p.fim()
    return df


def tabela_nao_existe(nome):
    return AnalysisException(
        f'The table or view `{nome}` cannot be found. Verify the spelling and correctness of the schema and catalog.\n'
        'If you did not qualify the name with a schema, verify the current_schema() output, or qualify the name with the '
        'correct schema and catalog.\nTo tolerate the error on drop use DROP VIEW IF EXISTS or DROP TABLE IF EXISTS.',
        'TABLE_OR_VIEW_NOT_FOUND', {'relationName': f'`{nome}`'}, '42P01')
