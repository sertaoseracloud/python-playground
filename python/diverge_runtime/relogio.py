"""Relógio virtual do streaming e do Delta Lake.

Cada execução começa em 2026-01-01 00:00:00 UTC, e o tempo só anda quando o streaming ou o
Delta pedem (cada commit do Delta avança 1 s). Assim o histórico, o time travel e as janelas
dão sempre o mesmo resultado. O time e o datetime do aluno continuam com a hora real."""
import datetime as _dt

from . import estagios

INICIO = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)
_EPOCA = _dt.datetime(1970, 1, 1, tzinfo=_dt.timezone.utc)
_agora = INICIO


def zerar():
    global _agora
    _agora = INICIO


def agora():
    return _agora


def avancar(segundos):
    global _agora
    _agora += _dt.timedelta(seconds=segundos)
    return _agora


def em_ms(momento=None):
    """Milissegundos desde 1970 (o formato dos timestamps do log do Delta)."""
    return int(((momento or _agora) - _EPOCA).total_seconds() * 1000)


estagios.AO_ZERAR.append(zerar)
