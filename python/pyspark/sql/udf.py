"""UDF: uma função Python do aluno usada como coluna. Ela roda dentro das tarefas, nos workers.

No Spark real, a UDF em Python é mais lenta: cada linha sai da JVM, vai para um processo Python
e volta (o BatchEvalPython do explain). Aqui tudo já é Python, mas o plano mostra o mesmo nó
para a lição comparar com as funções prontas."""
import datetime

from . import types as T
from .column import Column, Expr, para_expr
from .plano import No


def _ajustar(valor, tipo):
    """O valor da UDF no tipo declarado; se não combina, NULL (como no PySpark)."""
    if valor is None:
        return None
    if isinstance(tipo, (T.IntegerType, T.LongType, T.ShortType, T.ByteType)):
        return valor if isinstance(valor, int) and not isinstance(valor, bool) else None
    if isinstance(tipo, (T.DoubleType, T.FloatType)):
        return valor if isinstance(valor, float) else None
    if isinstance(tipo, T.BooleanType):
        return valor if isinstance(valor, bool) else None
    if isinstance(tipo, T.StringType):
        return valor if isinstance(valor, str) else str(valor)
    if isinstance(tipo, T.DateType):
        return valor if isinstance(valor, datetime.date) else None
    if isinstance(tipo, T.TimestampType):
        return valor if isinstance(valor, datetime.datetime) else None
    if isinstance(tipo, T.ArrayType):
        return [_ajustar(v, tipo.elementType) for v in valor] if isinstance(valor, (list, tuple)) else None
    if isinstance(tipo, T.StructType):
        if isinstance(valor, dict):
            valor = [valor.get(n) for n in tipo.names]
        if isinstance(valor, (list, tuple)):
            return T._criar_row(tipo.names, [_ajustar(v, f.dataType) for v, f in zip(valor, tipo.fields)])
        return None
    return valor


class Udf(Expr):
    eh_udf = True

    def __init__(self, funcao, tipo, args, nome):
        self.funcao, self._tipo, self.args, self.nome_udf = funcao, tipo, list(args), nome

    def filhos(self):
        return tuple(self.args)

    def com_filhos(self, filhos):
        return Udf(self.funcao, self._tipo, filhos, self.nome_udf)

    def _formatar(self, partes):
        return f"{self.nome_udf}({', '.join(partes)})"

    def tipo(self, e):
        for a in self.args:
            a.tipo(e)
        return self._tipo

    def anulavel(self, e):
        return True

    def compilar(self, e):
        fs = [a.compilar(e) for a in self.args]
        funcao, tipo = self.funcao, self._tipo

        def chamar(linha):
            return _ajustar(funcao(*[f(linha) for f in fs]), tipo)
        return chamar


class UserDefinedFunction:
    def __init__(self, funcao, tipo, nome=None):
        self.func = funcao
        self.returnType = T.tipo_do_texto(tipo) if isinstance(tipo, str) else tipo
        self._name = nome or getattr(funcao, '__name__', 'udf')

    def __call__(self, *cols):
        return Column(Udf(self.func, self.returnType, [para_expr(c) for c in cols], self._name))

    def asNondeterministic(self):
        return self


def udf(f=None, returnType=None):
    if returnType is None and (f is None or isinstance(f, (str, T.DataType))):
        tipo = f if f is not None else T.StringType()
        return lambda funcao: UserDefinedFunction(funcao, tipo)
    if f is None:
        return lambda funcao: UserDefinedFunction(funcao, returnType)
    return UserDefinedFunction(f, returnType or T.StringType())


class UDFRegistration:
    """spark.udf.register('nome', funcao, tipo): a UDF passa a valer no spark.sql."""

    def __init__(self, sessao):
        self.sessao = sessao

    def register(self, nome, f, returnType=None):
        u = f if isinstance(f, UserDefinedFunction) else UserDefinedFunction(f, returnType or T.StringType(), nome)
        u._name = nome
        self.sessao._udfs[nome.lower()] = u
        return u


class BatchEvalPython(No):
    """Só aparece no explain: as UDFs do Project acima são calculadas linha a linha em Python."""

    def __init__(self, filho, udfs):
        super().__init__(filho.sessao)
        self.filhos = (filho,)
        self.udfs = udfs
        self.saida = filho.saida

    def linha(self, raiz=False):
        e = self.entrada()
        itens = ', '.join(u.explicar(e) for u in self.udfs)
        return f"BatchEvalPython [{itens}], [{', '.join(f'pythonUDF{i}' for i in range(len(self.udfs)))}]"

    def rdd(self):
        return self.filhos[0].rdd()
