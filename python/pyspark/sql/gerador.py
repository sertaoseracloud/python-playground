"""Geradores (explode): uma linha de entrada vira zero ou mais linhas de saída."""


def tem_gerador(expr):
    return expr.tem(lambda n: n.eh_gerador)


def gerar(plano, exprs, operacao):
    raise NotImplementedError('explode chega na próxima etapa')
