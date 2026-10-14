"""Roda os programas de conformidade e compara a saída com o cNN.esperado de cada um.

    python python/conformidade/rodar.py            # com o pyspark do DivergePython
    python python/conformidade/rodar.py --real     # com o PySpark instalado (no CI, com Java)
    python python/conformidade/rodar.py --gravar c02_dataframe   # grava o esperado com o nosso

O esperado é a saída do PySpark real: o CI roda os mesmos programas no real e compara."""
import argparse
import difflib
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

PASTA = pathlib.Path(__file__).resolve().parent
RAIZ = PASTA.parent


def rodar(programa, real):
    tmp = tempfile.mkdtemp(prefix='conformidade-')
    env = dict(os.environ, CONFORMIDADE_TMP=tmp, PYTHONIOENCODING='utf-8', PYTHONHASHSEED='0')
    caminhos = [str(PASTA)] if real else [str(RAIZ), str(RAIZ / 'vendor'), str(PASTA)]
    env['PYTHONPATH'] = os.pathsep.join(caminhos)
    try:
        r = subprocess.run([sys.executable, str(programa)], cwd=PASTA, env=env, capture_output=True, text=True,
                           encoding='utf-8', timeout=900)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return r.returncode, r.stdout.replace('\r\n', '\n'), r.stderr


def main():
    sys.stdout.reconfigure(encoding='utf-8')  # o console do Windows não é UTF-8
    args = argparse.ArgumentParser()
    args.add_argument('--real', action='store_true')
    args.add_argument('--gravar', action='store_true')
    args.add_argument('nomes', nargs='*')
    opcoes = args.parse_args()
    programas = sorted(p for p in PASTA.glob('c[0-9][0-9]_*.py') if not opcoes.nomes or p.stem in opcoes.nomes)
    falhas = 0
    for programa in programas:
        codigo, saida, erros = rodar(programa, opcoes.real)
        # nome curto: a pasta do projeto no Windows desta máquina já passa de 230 caracteres (limite de 260)
        esperado = programa.with_name(programa.stem[:3] + '.esperado')
        if codigo:
            falhas += 1
            print(f'✗ {programa.stem}: saiu com {codigo}\n{erros[-3000:]}')
            continue
        if opcoes.gravar:
            esperado.write_bytes(saida.encode('utf-8'))
            print(f'gravado {esperado.name}')
            continue
        alvo = esperado.read_text(encoding='utf-8') if esperado.exists() else ''
        if saida == alvo:
            print(f'✓ {programa.stem}')
            continue
        falhas += 1
        print(f'✗ {programa.stem}')
        sys.stdout.writelines(difflib.unified_diff(alvo.splitlines(True), saida.splitlines(True), 'esperado', 'obtido'))
    print(f'{len(programas) - falhas}/{len(programas)} programas iguais ao esperado')
    return 1 if falhas else 0


if __name__ == '__main__':
    sys.exit(main())
