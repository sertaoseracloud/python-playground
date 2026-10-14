"""Roda o código do aluno: grava os arquivos, executa o principal como __main__,
captura a saída, o erro (só com as linhas do aluno), as variáveis e as chamadas de função."""
import builtins
import io
import json
import os
import shutil
import sys
import traceback

from diverge_paralelo.instalar import instalar as instalar_paralelo

from . import estagios, pool
from .valores import descrever

PASTA = '/home/pyodide/exercicio'
LIMITE_SAIDA = 100_000
LIMITE_ARQUIVOS = 20
_json_dumps = json.dumps  # referência própria: um json.py do aluno não pode trocar isto
ULTIMO_ESCOPO = None  # as variáveis do último programa, para o `python -i` (repl.py)


class _Saida(io.StringIO):
    """stdout que para de guardar depois do limite (a execução continua)."""

    def __init__(self):
        super().__init__()
        self.cortada = False
        self.ao_escrever = None  # o terminal da página (saída ao vivo)

    def write(self, texto):
        if self.ao_escrever is not None:
            self.ao_escrever(texto)
        if self.cortada:
            return len(texto)
        restante = LIMITE_SAIDA - self.tell()
        if len(texto) > restante:
            super().write(texto[:max(restante, 0)])
            super().write('\n… (saída cortada)\n')
            self.cortada = True
            return len(texto)
        return super().write(texto)

    def eco(self, texto):
        """O que a pessoa digitou: entra na saída guardada, mas não vai ao vivo (o terminal já mostrou)."""
        ao_escrever, self.ao_escrever = self.ao_escrever, None
        try:
            self.write(texto)
        finally:
            self.ao_escrever = ao_escrever


class _PrecisaDeEntrada(BaseException):
    """O input() precisa de uma resposta e não dá para esperar (sem JSPI): a página pede e roda de novo."""


def _terminal_js():
    try:
        import diverge_terminal_js
    except ImportError:
        return None
    return diverge_terminal_js


def _pode_esperar():
    try:
        from pyodide.ffi import can_run_sync
    except ImportError:
        return False
    return can_run_sync()


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


def _input(entrada, saida, interativo=False):
    linhas = iter(entrada)
    terminal = _terminal_js() if interativo else None
    fila_acabou = False

    def ler(prompt=''):
        nonlocal fila_acabou
        saida.write(str(prompt))
        if not fila_acabou:
            try:
                resposta = next(linhas)
            except StopIteration:
                fila_acabou = True
            else:
                if resposta is None:  # Ctrl+D numa execução repetida (sem JSPI)
                    raise EOFError('EOF when reading a line')
                if terminal is not None:
                    saida.eco(resposta + '\n')  # como se tivesse sido digitada
                return resposta
        if terminal is None:
            raise EOFError('EOF when reading a line') from None
        if terminal.sem_jspi() or not _pode_esperar():
            raise _PrecisaDeEntrada()
        from pyodide.ffi import run_sync
        resposta = run_sync(terminal.pedir())
        if resposta is None:
            raise EOFError('EOF when reading a line')
        saida.eco(str(resposta) + '\n')
        return str(resposta)
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


def _tabelas(escopo):
    """DataFrames nas variáveis do aluno, calculados aqui mesmo (sem pool e sem aparecer na aba ⚡ Execução)."""
    tabelas = {}
    for nome, valor in list(escopo.items()):
        if nome.startswith('_') or not callable(getattr(type(valor), '_diverge_tabela', None)):
            continue
        try:
            with estagios.local():
                tabelas[nome] = valor._diverge_tabela(1000)
        except Exception as e:  # o DataFrame que falha ao calcular vira motivo na correção
            tabelas[nome] = {'erro': {'tipo': type(e).__name__, 'mensagem': str(e)}}
    return tabelas


def executar(arquivos, principal='main.py', entrada=(), chamadas=(), interativo=False, argv=None):
    _gravar(arquivos)
    _esquecer_modulos_do_aluno(arquivos)
    pool.zerar(PASTA)
    estagios.zerar()
    saida = _Saida()
    antigo_stdout, antigo_stderr, antigo_input = sys.stdout, sys.stderr, builtins.input
    antigo_path, antigo_cwd, antigo_argv = list(sys.path), os.getcwd(), sys.argv
    escopo = {'__name__': '__main__', '__file__': principal, '__builtins__': builtins}
    erro = None
    precisa = False
    retornos = []
    tabelas = {}
    terminal = _terminal_js() if interativo else None
    saida.ao_escrever = terminal.escrever if terminal is not None else None
    # multiprocessing e concurrent.futures do DivergePython, só durante esta execução.
    desfazer_paralelo = instalar_paralelo(principal, arquivos.get(principal, ''))
    try:
        sys.stdout = sys.stderr = saida
        fila = iter(entrada)  # a mesma fila segue para as chamadas da correção
        builtins.input = _input(fila, saida, interativo)
        sys.argv = [principal, *(argv or [])]
        sys.path.insert(0, PASTA)
        os.chdir(PASTA)
        try:
            codigo = compile(arquivos.get(principal, ''), principal, 'exec')
            exec(codigo, escopo)
        except _PrecisaDeEntrada:
            precisa = True
        except BaseException as e:  # SystemExit e KeyboardInterrupt também viram erro do aluno
            erro = _erro(e, arquivos)
        builtins.input = _input(fila, saida)  # as chamadas da correção nunca esperam digitação
        saida.ao_escrever = None
        if not precisa:
            for chamada in chamadas:
                retornos.append(_chamar(escopo, chamada))
        tabelas = {} if precisa else _tabelas(escopo)
    finally:
        try:
            desfazer_paralelo()  # ainda com a saída do aluno: o print dos processos não esperados entra nela
        finally:
            sys.stdout, sys.stderr, builtins.input = antigo_stdout, antigo_stderr, antigo_input
        sys.path[:] = antigo_path
        sys.argv = antigo_argv
        os.chdir(antigo_cwd)
    global ULTIMO_ESCOPO
    ULTIMO_ESCOPO = escopo
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
        'paralelismo': pool.resumo(),
        'spark': estagios.resumo(),
        'tabelas': tabelas,
        'precisa_entrada': precisa,
    }


def executar_json(args):
    """Ponto de entrada chamado pelo JS (sessao.js)."""
    args = args.to_py() if hasattr(args, 'to_py') else args
    resultado = executar(
        args['arquivos'],
        args.get('principal', 'main.py'),
        args.get('entrada', []),
        args.get('chamadas', []),
        bool(args.get('interativo', False)),
        list(args.get('argv', None) or []),
    )
    return _json_dumps(resultado, ensure_ascii=False)
