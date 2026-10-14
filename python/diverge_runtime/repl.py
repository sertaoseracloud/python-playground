"""O modo interativo do Python (>>>): uma linha por vez, com o escopo da sessão."""
import builtins
import codeop
import json
import sys

from . import execucao
from .execucao import _Saida, _erro, _input

_escopo = {}
_buffer = []
_json_dumps = json.dumps  # referência própria: um json.py do aluno não pode trocar isto


def iniciar(do_programa=False):
    """Começa uma sessão do REPL: escopo vazio (`python`) ou o do último programa (`python -i`)."""
    global _escopo
    _buffer.clear()
    base = execucao.ULTIMO_ESCOPO if do_programa else None
    _escopo = base if base is not None else {'__name__': '__main__', '__builtins__': builtins}


def _mostrar(valor):
    if valor is not None:
        _escopo['_'] = valor
        print(repr(valor))


def linha(texto, interativo=False):
    """Uma linha digitada no >>> (ou no ...). `continua` = o bloco ainda não terminou."""
    _buffer.append(texto)
    fonte = '\n'.join(_buffer)
    try:
        codigo = codeop.compile_command(fonte, '<stdin>', 'single')
    except (SyntaxError, OverflowError, ValueError) as e:
        _buffer.clear()
        return {'saida': '', 'erro': _erro(e, {'<stdin>': fonte}), 'continua': False}
    if codigo is None:
        if texto.strip() == '' and len(_buffer) > 1:  # linha vazia termina um bloco que não fecha
            _buffer.clear()
            try:
                compile(fonte, '<stdin>', 'single')
            except SyntaxError as e:
                return {'saida': '', 'erro': _erro(e, {'<stdin>': fonte}), 'continua': False}
            return {'saida': '', 'erro': None, 'continua': False}
        if texto.strip() == '' and len(_buffer) == 1:  # Enter sozinho no >>>
            _buffer.clear()
            return {'saida': '', 'erro': None, 'continua': False}
        return {'saida': '', 'erro': None, 'continua': True}
    _buffer.clear()
    saida = _Saida()
    terminal = execucao._terminal_js() if interativo else None
    saida.ao_escrever = terminal.escrever if terminal is not None else None
    antigos = sys.stdout, sys.stderr, sys.displayhook, builtins.input
    erro = None
    try:
        sys.stdout = sys.stderr = saida
        sys.displayhook = _mostrar
        builtins.input = _input([], saida, interativo)
        exec(codigo, _escopo)
    except execucao._PrecisaDeEntrada:
        erro = {'tipo': 'EOFError', 'mensagem': 'EOF when reading a line', 'linha': 1,
                'traceback': 'EOFError: o input() no >>> precisa de um navegador com JSPI (Chrome ou Edge)\n'}
    except BaseException as e:  # o erro do aluno vira resultado, como no REPL de verdade
        erro = _erro(e, {'<stdin>': fonte})
    finally:
        sys.stdout, sys.stderr, sys.displayhook, builtins.input = antigos
    return {'saida': saida.getvalue(), 'erro': erro, 'continua': False}


def repl_json(args):
    """Ponto de entrada chamado pelo JS (sessao.js)."""
    args = args.to_py() if hasattr(args, 'to_py') else args
    if args.get('acao') == 'iniciar':
        iniciar(bool(args.get('doPrograma', False)))
        return _json_dumps({'saida': '', 'erro': None, 'continua': False})
    return _json_dumps(linha(args.get('texto', ''), bool(args.get('interativo', False))), ensure_ascii=False)
