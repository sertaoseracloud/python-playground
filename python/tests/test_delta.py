"""Delta Lake do DivergePython: log de transações, versões, time travel, update/delete/merge,
schema, vacuum e optimize, sobre o relógio virtual."""
import datetime as dt
import json
import os

import pytest

from diverge_runtime import estagios, relogio
from pyspark.errors import AnalysisException, IllegalArgumentException
from pyspark.sql import Row, SparkSession  # noqa: F401
from pyspark.sql import functions as F


@pytest.fixture
def spark(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    estagios.zerar()
    return SparkSession.builder.getOrCreate()


def tuplas(df, *ordem):
    return [tuple(r) for r in (df.orderBy(*ordem) if ordem else df).collect()]


def test_relogio_comeca_em_2026_e_so_anda_quando_pedem():
    relogio.avancar(5)
    estagios.zerar()  # cada execução começa do zero
    assert relogio.agora() == dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    assert relogio.avancar(90) == dt.datetime(2026, 1, 1, 0, 1, 30, tzinfo=dt.timezone.utc)
    assert relogio.em_ms() == relogio.em_ms(relogio.agora())
    assert relogio.em_ms(relogio.INICIO) == 1767225600000


def test_illegal_argument_exception():
    with pytest.raises(ValueError):
        raise IllegalArgumentException('requirement failed')
