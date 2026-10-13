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
    """SQL ou expressão que não dá para ler."""


class PySparkValueError(PySparkException, ValueError):
    pass


class PySparkTypeError(PySparkException, TypeError):
    pass


class PySparkRuntimeError(PySparkException, RuntimeError):
    pass


class PySparkNotImplementedError(PySparkException, NotImplementedError):
    pass


def caminho_nao_existe(caminho):
    return AnalysisException(f'Path does not exist: file:{caminho}.', 'PATH_NOT_FOUND', {'path': f'file:{caminho}'}, '42K03')


__all__ = [
    'PySparkException', 'AnalysisException', 'ParseException', 'PySparkValueError', 'PySparkTypeError',
    'PySparkRuntimeError', 'PySparkNotImplementedError',
]
