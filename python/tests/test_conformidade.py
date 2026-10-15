"""Os programas de conformidade dão, no nosso pyspark, a saída esperada (a mesma do PySpark real, conferida no CI)."""
import pathlib
import subprocess
import sys

import pytest

PASTA = pathlib.Path(__file__).resolve().parents[1] / 'conformidade'
PROGRAMAS = sorted(p.stem for p in PASTA.glob('c[0-9][0-9]_*.py'))


def test_ha_programas():
    assert len(PROGRAMAS) == 15


@pytest.mark.parametrize('nome', PROGRAMAS)
def test_programa(nome):
    r = subprocess.run([sys.executable, str(PASTA / 'rodar.py'), nome], capture_output=True, text=True, encoding='utf-8', timeout=300)
    assert r.returncode == 0, r.stdout + r.stderr
