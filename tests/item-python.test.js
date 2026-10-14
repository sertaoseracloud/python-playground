// @vitest-environment happy-dom
// Tela do exercício com um motor falso: Executar roda os casos visíveis e depois
// `python main.py` no terminal (o input() é respondido no próprio terminal).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';
import { marcar, somarTentativa } from '../src/progresso.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

function montarCom(motor) {
  document.body.innerHTML = corpo;
  const layout = { aplicar() {}, mostrarDescricao() {} };
  const tela = criarTelaItem({ motor, layout, definirStatus: () => {}, aoMudarProgresso: () => {} });
  tela.aoMudarEstadoPython(true);
  return { tela };
}

function montar(resposta) {
  const pedidos = [];
  const motor = {
    executar: async (arquivos, opcoes) => { pedidos.push({ ...opcoes, arquivos }); return { ms: 5, retornos: [], variaveis: {}, ...resposta }; },
    interromper() {},
  };
  return { ...montarCom(motor), pedidos };
}

describe('tela do exercício (Python)', () => {
  beforeEach(() => localStorage.clear());

  it('a saída aparece no terminal', async () => {
    const { tela } = montar({ saida: 'Olá, Sertão!\n', erro: null });
    tela.abrir('licao-ola');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('saida-terminal').textContent).toContain('Olá, Sertão!');
  });

  it('o traceback aparece no terminal, depois da saída', async () => {
    const { tela } = montar({ saida: 'antes\n', erro: { tipo: 'ZeroDivisionError', mensagem: 'division by zero', linha: 2, traceback: 'Traceback (most recent call last):\n  File "main.py", line 2\nZeroDivisionError: division by zero\n' } });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    const texto = document.getElementById('saida-terminal').textContent;
    expect(texto.indexOf('antes')).toBeLessThan(texto.indexOf('ZeroDivisionError'));
  });

  it('não existe mais a aba ⌨️ Entrada', () => {
    montar({ saida: '', erro: null });
    expect(document.getElementById('entrada')).toBeNull();
    expect(document.querySelector('[data-saida="entrada"]')).toBeNull();
  });

  it('▶ Executar roda os testes visíveis e depois python main.py no terminal', async () => {
    const { tela, pedidos } = montar({ saida: 'Olá\n', erro: null });
    tela.abrir('py-ola');
    await new Promise((r) => setTimeout(r, 20));
    pedidos.length = 0;
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 30));
    const ultimo = pedidos.at(-1);
    expect(ultimo.interativo).toBe(true);
    expect(pedidos.length).toBeGreaterThan(1);
    expect(pedidos.slice(0, -1).every((p) => !p.interativo)).toBe(true);
    expect(document.getElementById('saida-terminal').textContent).toContain('$ python main.py');
    expect(document.getElementById('prompt-terminal').textContent).toBe('aluno@sertao:~/py-ola$ ');
  });

  it('abrir o exercício não fala; o ▶ Executar fala o resultado do programa e dos testes', async () => {
    const { tela } = montar({ saida: 'Olá\n', erro: null });
    tela.abrir('py-ola');
    await new Promise((r) => setTimeout(r, 150));
    expect(document.getElementById('anuncio').textContent).toBe('');
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 150));
    expect(document.getElementById('anuncio').textContent).toMatch(/O programa rodou sem erros\..*caso/);
  });

  it('com jobs do Spark, a aba ⚡ Execução aparece; sem jobs, some (e volta para o Terminal)', async () => {
    const spark = { jobs: [{ id: 1, acao: 'count', estagios: [{ id: 1, nome: 'parallelize', tipo: 'resultado', linhas_embaralhadas: 0, tarefas: [{ particao: 0, worker: 0, linhas: 1, inicio: 0, fim: 1 }] }] }], estagios: 1, shuffles: 0, tarefas: 1, workers: 1, ms: 1 };
    let resposta = { saida: '1\n', erro: null, spark };
    const motor = { executar: async () => ({ ms: 1, retornos: [], variaveis: {}, ...resposta }), interromper() {} };
    const { tela } = montarCom(motor);
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('aba-execucao').hidden).toBe(false);
    expect(document.getElementById('saida-execucao').textContent).toContain('Job 1 · count()');
    document.getElementById('aba-execucao').click();
    expect(document.getElementById('saida-execucao').hidden).toBe(false);
    resposta = { saida: '', erro: null, spark: null };
    document.getElementById('btn-executar').click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.getElementById('aba-execucao').hidden).toBe(true);
    expect(document.getElementById('saida-execucao').hidden).toBe(true);
    expect(document.getElementById('terminal').hidden).toBe(false);
  });

  it('o input() do programa é respondido no terminal', async () => {
    const motor = {
      executar: async (a, o, g) => {
        if (!o.interativo) return { saida: '', erro: null };
        g.aoSaida('Nome: ');
        const nome = await g.aoPedirEntrada();
        return { saida: `Nome: ${nome}\nOlá, ${nome}!\n`, erro: null, ms: 1 };
      },
      interromper() {},
    };
    const { tela } = montarCom(motor);
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('prompt-terminal').textContent).toBe('Nome: ');
    expect(document.getElementById('campo-terminal').getAttribute('aria-label')).toBe('Resposta para o input()');
    const campo = document.getElementById('campo-terminal');
    campo.value = 'Ana';
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('saida-terminal').textContent).toContain('Nome: Ana\nOlá, Ana!\n');
  });

  it('trocar de exercício com o programa esperando um input() cancela a espera', async () => {
    // Só o livre (que tem dados) espera a digitação; o py-ola termina na hora.
    const motor = {
      executar: async (a, o, g) => (o.interativo && a['vendas.csv'] ? (await g.aoPedirEntrada(), { saida: '', erro: null }) : { saida: '', erro: null, ms: 1 }),
      interromper() {},
    };
    const { tela } = montarCom(motor);
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(tela.terminal.ocupado).toBe(true);
    expect(document.getElementById('prompt-terminal').textContent).toBe('');
    tela.abrir('py-ola');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.getElementById('prompt-terminal').textContent).toBe('aluno@sertao:~/py-ola$ ');
  });

  it('o livre mostra a aba 📦 Dados e envia os dados junto com o código', async () => {
    const { tela, pedidos } = montar({ saida: '', erro: null });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('aba-dados').hidden).toBe(false);
    expect(Object.keys(pedidos.at(-1).arquivos)).toContain('vendas.csv');
  });

  it('sem paralelismo no navegador, o terminal avisa que rodou em sequência', async () => {
    const { tela } = montar({ saida: '[1, 4]\n', erro: null, paralelismo: { disponivel: false, maximo: 1, tarefas: 2, workers: 1 } });
    tela.abrir('livre');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('saida-terminal').textContent).toContain('rodaram uma depois da outra');
  });
});

describe('aba Solução (só depois do tempo estimado e se não resolvido)', () => {
  beforeEach(() => localStorage.clear());
  const ID = 'py-ola'; // exercício fácil (~15 min)

  it('antes do tempo, a aba fica escondida e a descrição diz quanto falta', async () => {
    const { tela } = montar({ saida: '', erro: null });
    tela.abrir(ID);
    expect(document.getElementById('aba-solucao').hidden).toBe(true);
    expect(document.getElementById('desc-enunciado').textContent).toContain('A solução aparece depois de ~15 min tentando (faltam 15 min)');
  });

  it('depois do tempo, a aba aparece', async () => {
    somarTentativa(ID, 15 * 60);
    const { tela } = montar({ saida: '', erro: null });
    tela.abrir(ID);
    expect(document.getElementById('aba-solucao').hidden).toBe(false);
    expect(document.getElementById('desc-enunciado').textContent).not.toContain('A solução aparece depois');
  });

  it('com o exercício resolvido, a aba não aparece', async () => {
    somarTentativa(ID, 60 * 60);
    marcar(ID, 'resolvido');
    const { tela } = montar({ saida: '', erro: null });
    tela.abrir(ID);
    expect(document.getElementById('aba-solucao').hidden).toBe(true);
  });

  it('no perfil sem pressão, sem contagem de minutos', async () => {
    document.documentElement.classList.add('a11y-sem-pressao');
    try {
      const { tela } = montar({ saida: '', erro: null });
      tela.abrir(ID);
      const texto = document.getElementById('desc-enunciado').textContent;
      expect(texto).toContain('A solução aparece depois de um tempo tentando');
      expect(texto).not.toContain('faltam');
    } finally {
      document.documentElement.classList.remove('a11y-sem-pressao');
    }
  });
});
