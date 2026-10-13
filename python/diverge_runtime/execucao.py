"""Roda o código do aluno: grava os arquivos, executa o principal como __main__,
captura a saída, o erro (só com as linhas do aluno), as variáveis e as chamadas de função."""
import builtins
import io
import json
import os
import shutil
import sys
import traceback

from .valores import descrever

PASTA = '/home/pyodide/exercicio'
LIMITE_SAIDA = 100_000
LIMITE_ARQUIVOS = 20
_json_dumps = json.dumps  # referência própria: um json.py do aluno não pode trocar isto


class _Saida(io.StringIO):
    """stdout que para de guardar depois do limite (a execução continua)."""

    def __init__(self):
        super().__init__()
        self.cortada = False

    def write(self, texto):
        if self.cortada:
            return len(texto)
        restante = LIMITE_SAIDA - self.tell()
        if len(texto) > restante:
            super().write(texto[:max(restante, 0)])
            super().write('\n… (saída cortada)\n')
            self.cortada = True
            return len(texto)
        return super().write(texto)


def _gravar(arquivos):
    shutil.rmtree(PASTA, ignore_errors=True)  # subpastas também: nada sobra da execução anterior
    os.makedirs(PASTA, exist_ok=True)
    for nome, fonte in arquivos.items():
        caminho = os.path.join(PASTA, nome)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(fonte)


def _gerados(arquivos):
    """Arquivos que o programa criou ou mudou (fora os .py), para as regras `arquivo`."""
    gerados = {}
    for raiz, _, nomes in os.walk(PASTA):
        for nome in sorted(nomes):
            caminho = os.path.join(raiz, nome)
            relativo = os.path.relpath(caminho, PASTA).replace(os.sep, '/')
            if relativo.endswith('.py') or len(gerados) >= LIMITE_ARQUIVOS:
                continue
            with open(caminho, encoding='utf-8', errors='replace') as f:
                texto = f.read(LIMITE_SAIDA)
            if arquivos.get(relativo) != texto:
                gerados[relativo] = texto
    return gerados


def _esquecer_modulos_do_aluno(arquivos):
    """Remove de sys.modules os módulos que vieram dos arquivos do aluno (e os que o
    aluno sombreou, como json.py), para cada execução começar do zero."""
    nomes = {nome[:-3].replace('/', '.') for nome in arquivos if nome.endswith('.py')}
    for nome in list(sys.modules):
        modulo = sys.modules[nome]
        arquivo = getattr(modulo, '__file__', '') or ''
        if nome in nomes or arquivo.startswith(PASTA):
            del sys.modules[nome]


def _erro(excecao, arquivos):
    te = traceback.TracebackException.from_exception(excecao)
    do_aluno = [q for q in te.stack if os.path.basename(q.filename) in arquivos or q.filename in arquivos]
    te.stack = traceback.StackSummary.from_list(do_aluno)
    linha = do_aluno[-1].lineno if do_aluno else getattr(excecao, 'lineno', None)
    return {
        'tipo': type(excecao).__name__,
        'mensagem': str(excecao),
        'linha': linha,
        'traceback': ''.join(te.format()),
    }


def _input(entrada, saida):
    linhas = iter(entrada)

    def ler(prompt=''):
        saida.write(str(prompt))
        try:
            return next(linhas)
        except StopIteration:
            raise EOFError('EOF when reading a line') from None
    return ler


def _chamar(escopo, chamada):
    nome = chamada['funcao']
    funcao = escopo.get(nome)
    if funcao is None:
        return {'ok': False, 'valor': None, 'repr': '', 'erro': {'tipo': 'NameError', 'mensagem': f"name '{nome}' is not defined"}}
    try:
        valor = funcao(*chamada.get('args', []))
    except BaseException as e:  # o erro da função do aluno vira resultado, não derruba a correção
        return {'ok': False, 'valor': None, 'repr': '', 'erro': {'tipo': type(e).__name__, 'mensagem': str(e)}}
    d = descrever(valor)
    return {'ok': True, 'valor': d['valor'], 'repr': d['repr'], 'erro': None}


def executar(arquivos, principal='main.py', entrada=(), chamadas=()):
    _gravar(arquivos)
    _esquecer_modulos_do_aluno(arquivos)
    saida = _Saida()
    antigo_stdout, antigo_stderr, antigo_input = sys.stdout, sys.stderr, builtins.input
    antigo_path, antigo_cwd = list(sys.path), os.getcwd()
    escopo = {'__name__': '__main__', '__file__': principal, '__builtins__': builtins}
    erro = None
    retornos = []
    try:
        sys.stdout = sys.stderr = saida
        builtins.input = _input(entrada, saida)
        sys.path.insert(0, PASTA)
        os.chdir(PASTA)
        try:
            codigo = compile(arquivos.get(principal, ''), principal, 'exec')
            exec(codigo, escopo)
        except BaseException as e:  # SystemExit e KeyboardInterrupt também viram erro do aluno
            erro = _erro(e, arquivos)
        for chamada in chamadas:
            retornos.append(_chamar(escopo, chamada))
    finally:
        sys.stdout, sys.stderr, builtins.input = antigo_stdout, antigo_stderr, antigo_input
        sys.path[:] = antigo_path
        os.chdir(antigo_cwd)
    variaveis = {}
    for nome, valor in escopo.items():
        if nome.startswith('_') or callable(valor) or type(valor).__name__ == 'module':
            continue
        d = descrever(valor)
        if d['json']:
            variaveis[nome] = d['valor']
    return {
        'saida': saida.getvalue(), 'erro': erro, 'variaveis': variaveis, 'retornos': retornos,
        'arquivos_gerados': _gerados(arquivos),
    }


def executar_json(args):
    """Ponto de entrada chamado pelo JS (sessao.js)."""
    args = args.to_py() if hasattr(args, 'to_py') else args
    resultado = executar(
        args['arquivos'],
        args.get('principal', 'main.py'),
        args.get('entrada', []),
        args.get('chamadas', []),
    )
    return _json_dumps(resultado, ensure_ascii=False)
