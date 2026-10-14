"""Erros no formato do PySpark 4: `[CLASSE] mensagem SQLSTATE: XXXXX`.

Os erros de análise (coluna ou tabela que não existe) levam também o plano lógico,
depois de `;` e de uma quebra de linha, como no Spark."""


class PySparkException(Exception):
    def __init__(self, message='', errorClass=None, messageParameters=None, sqlState=None, plano=None):
        self._mensagem = message
        self._classe = errorClass
        self._parametros = dict(messageParameters or {})
        self._sqlstate = sqlState
        self._plano = plano
        super().__init__(self._texto())

    def _texto(self):
        texto = f'[{self._classe}] {self._mensagem}' if self._classe else self._mensagem
        if self._sqlstate:
            texto += f' SQLSTATE: {self._sqlstate}'
        if self._plano is not None:
            texto += f';\n{self._plano}'
        return texto

    def __str__(self):
        return self._texto()

    def getErrorClass(self):
        return self._classe

    def getCondition(self):
        return self._classe

    def getMessageParameters(self):
        return dict(self._parametros)

    def getSqlState(self):
        return self._sqlstate

    def getMessage(self):
        return self._texto()


class AnalysisException(PySparkException):
    """Erro de análise: o plano pede algo que não existe (coluna, tabela, caminho...)."""


class ParseException(AnalysisException):
    """SQL ou expressão que não dá para ler (a mensagem do Spark começa com uma quebra de linha)."""

    def _texto(self):
        return '\n' + super()._texto()


class PySparkValueError(PySparkException, ValueError):
    pass


class PySparkTypeError(PySparkException, TypeError):
    pass


class PySparkRuntimeError(PySparkException, RuntimeError):
    pass


class PySparkNotImplementedError(PySparkException, NotImplementedError):
    pass


class ArithmeticException(PySparkException, ArithmeticError):
    """Erro de conta com o ANSI ligado (o padrão do Spark 4), como a divisão por zero."""


class NumberFormatException(PySparkException, ValueError):
    """Texto que não vira número num CAST (com o ANSI ligado)."""


class DateTimeException(PySparkException, ValueError):
    """Texto que não vira data (com o ANSI ligado)."""


class SparkRuntimeException(PySparkException, RuntimeError):
    pass


def divisao_por_zero():
    return ArithmeticException(
        'Division by zero. Use `try_divide` to tolerate divisor being 0 and return NULL instead. '
        'If necessary set "spark.sql.ansi.enabled" to "false" to bypass this error.', 'DIVIDE_BY_ZERO', {}, '22012')


def cast_invalido(valor, de, para):
    return NumberFormatException(
        f"The value '{valor}' of the type \"{de}\" cannot be cast to \"{para}\" because it is malformed. "
        'Correct the value as per the syntax, or change its target type. Use `try_cast` to tolerate malformed input and '
        'return NULL instead.', 'CAST_INVALID_INPUT', {'expression': f"'{valor}'"}, '22018')


def data_invalida(texto):
    return DateTimeException(
        f"Text '{texto}' could not be parsed at index 0. Use `try_to_timestamp` to tolerate invalid input string and "
        'return NULL instead.', 'CANNOT_PARSE_TIMESTAMP', {'message': texto}, '22007')


def caminho_nao_existe(caminho):
    return AnalysisException(f'Path does not exist: file:{caminho}.', 'PATH_NOT_FOUND', {'path': f'file:{caminho}'}, '42K03')


__all__ = [
    'PySparkException', 'AnalysisException', 'ParseException', 'PySparkValueError', 'PySparkTypeError',
    'PySparkRuntimeError', 'PySparkNotImplementedError', 'ArithmeticException', 'NumberFormatException',
    'DateTimeException', 'SparkRuntimeException',
]
