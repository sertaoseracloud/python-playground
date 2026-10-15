"""Relógio virtual do streaming e do Delta Lake.

Cada execução começa em 2026-01-01 00:00:00 UTC, e o tempo só anda quando o streaming ou o
Delta pedem (cada commit do Delta avança 1 s). Assim o histórico, o time travel e as janelas
dão sempre o mesmo resultado. O time e o datetime do aluno continuam com a hora real."""
import contextlib
import datetime as _dt

from . import estagios

INICIO = _dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc)
_EPOCA = _dt.datetime(1970, 1, 1, tzinfo=_dt.timezone.utc)
_agora = INICIO
_virtual = 0


def zerar():
    global _agora, _virtual
    _agora = INICIO
    _virtual = 0


def agora():
    return _agora


def avancar(segundos):
    global _agora
    _agora += _dt.timedelta(seconds=segundos)
    return _agora


def em_ms(momento=None):
    """Milissegundos desde 1970 (o formato dos timestamps do log do Delta)."""
    return int(((momento or _agora) - _EPOCA).total_seconds() * 1000)


@contextlib.contextmanager
def virtual():
    """Dentro do streaming e do Delta, o current_timestamp() do Spark lê este relógio."""
    global _virtual
    _virtual += 1
    try:
        yield
    finally:
        _virtual -= 1


def agora_local():
    """O relógio virtual sem fuso (como os timestamps do Spark na sessão em UTC)."""
    return _agora.replace(tzinfo=None)


def momento_do_spark():
    """O current_timestamp() do Spark: o relógio virtual no streaming e no Delta; fora deles, a hora real."""
    if _virtual:
        return agora_local()
    return _dt.datetime.now().replace(microsecond=0)


def iso(momento):
    """Como o Spark escreve os momentos no progresso: 2026-01-01T00:10:00.000Z."""
    if momento.tzinfo is not None:
        momento = momento.astimezone(_dt.timezone.utc).replace(tzinfo=None)
    return momento.strftime('%Y-%m-%dT%H:%M:%S.') + f'{momento.microsecond // 1000:03d}Z'


estagios.AO_ZERAR.append(zerar)
