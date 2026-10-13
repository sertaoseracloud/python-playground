"""A regra do `if __name__ == "__main__":`, como no Python real com início spawn."""
import ast
import sys

MENSAGEM = (
    'An attempt has been made to start a new process before the\n'
    'current process has finished its bootstrapping phase.\n\n'
    'This probably means that you are not using fork to start your\n'
    'child processes and you have forgotten to use the proper idiom\n'
    'in the main module:\n\n'
    "    if __name__ == '__main__':\n"
    '        freeze_support()\n'
    '        ...'
)
_PRINCIPAL = 'main.py'
_BLOCOS = []  # (primeira, última) linha de cada `if __name__ == "__main__":`


def _eh_teste_main(no):
    if not isinstance(no, ast.Compare) or len(no.ops) != 1 or not isinstance(no.ops[0], ast.Eq):
        return False
    lados = [no.left, no.comparators[0]]
    nomes = [x.id for x in lados if isinstance(x, ast.Name)]
    textos = [x.value for x in lados if isinstance(x, ast.Constant)]
    return nomes == ['__name__'] and textos == ['__main__']


def configurar(principal, fonte):
    global _PRINCIPAL
    _PRINCIPAL = principal
    _BLOCOS.clear()
    try:
        arvore = ast.parse(fonte)
    except SyntaxError:
        return
    for no in ast.walk(arvore):
        if isinstance(no, ast.If) and _eh_teste_main(no.test) and no.body:
            _BLOCOS.append((no.body[0].lineno, no.body[-1].end_lineno))


def exigir_main():
    """Erro do Python real se o processo nasce no nível do módulo, fora do bloco do main."""
    quadro = sys._getframe(1)
    while quadro is not None:
        codigo = quadro.f_code
        if codigo.co_filename == _PRINCIPAL and codigo.co_name == '<module>':
            if not any(inicio <= quadro.f_lineno <= fim for inicio, fim in _BLOCOS):
                raise RuntimeError(MENSAGEM)
            return
        quadro = quadro.f_back
