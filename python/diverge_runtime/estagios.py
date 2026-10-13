"""Jobs, estágios e tarefas do Spark na execução atual (para a aba ⚡ Execução).

O pyspark do DivergePython registra aqui cada ação (job), cada estágio e cada tarefa,
com o worker que rodou e os tempos medidos. `local()` é usado quando o próprio site
calcula um DataFrame (para a correção): isso não aparece para o aluno."""
import contextlib
import time

LIMITE_JOBS = 50
JOBS = []
AO_ZERAR = []  # funções chamadas a cada execução (o pyspark reinicia a sessão por aqui)
T0 = 0.0
_local = 0
_proximo_estagio = 0


def zerar():
    global T0, _proximo_estagio
    JOBS.clear()
    T0 = time.time() * 1000
    _proximo_estagio = 0
    for funcao in AO_ZERAR:
        funcao()


def em_local():
    return _local > 0


@contextlib.contextmanager
def local():
    global _local
    _local += 1
    try:
        yield
    finally:
        _local -= 1


def novo_job(acao):
    job = {'id': len(JOBS) + 1, 'acao': acao, 'estagios': []}
    if not em_local() and len(JOBS) < LIMITE_JOBS:
        JOBS.append(job)
    return job


def novo_estagio(job, nome, tipo):
    global _proximo_estagio
    _proximo_estagio += 1
    estagio = {'id': _proximo_estagio, 'nome': nome, 'tipo': tipo, 'tarefas': [], 'linhas_embaralhadas': 0}
    job['estagios'].append(estagio)
    return estagio


def registrar_tarefa(estagio, particao, linhas, info):
    estagio['tarefas'].append({
        'particao': particao, 'worker': info['worker'], 'linhas': linhas,
        'inicio': round(info['inicio'] - T0, 1), 'fim': round(info['fim'] - T0, 1),
    })


def _numero(x):
    return int(x) if x == int(x) else x


def resumo():
    if not JOBS:
        return None
    estagios = [e for j in JOBS for e in j['estagios']]
    tarefas = [t for e in estagios for t in e['tarefas']]
    ms = round(max((t['fim'] for t in tarefas), default=0) - min((t['inicio'] for t in tarefas), default=0), 1)
    return {
        'jobs': JOBS, 'estagios': len(estagios), 'shuffles': sum(e['tipo'] == 'shuffle' for e in estagios),
        'tarefas': len(tarefas), 'workers': len({t['worker'] for t in tarefas}), 'ms': _numero(ms),
    }
