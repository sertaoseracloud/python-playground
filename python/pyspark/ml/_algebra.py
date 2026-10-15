"""Álgebra linear pequena, em Python puro: o sistema A x = b, por Gauss-Jordan com pivô."""


def resolver(a, b):
    """O x de A x = b. Uma coluna que depende das outras (pivô quase zero) fica com 0, sem quebrar."""
    n = len(b)
    m = [[float(x) for x in linha] + [float(bi)] for linha, bi in zip(a, b)]
    escala = max((abs(x) for linha in a for x in linha), default=1.0) or 1.0
    pivos, linha = [], 0
    for coluna in range(n):
        if linha == n:
            break
        p = max(range(linha, n), key=lambda i: abs(m[i][coluna]))
        if abs(m[p][coluna]) <= 1e-12 * escala:
            continue
        m[linha], m[p] = m[p], m[linha]
        for i in range(n):
            if i != linha and m[i][coluna] != 0:
                fator = m[i][coluna] / m[linha][coluna]
                m[i] = [x - fator * y for x, y in zip(m[i], m[linha])]
        pivos.append((linha, coluna))
        linha += 1
    x = [0.0] * n
    for lin, col in pivos:
        x[col] = m[lin][n] / m[lin][col]
    return x
