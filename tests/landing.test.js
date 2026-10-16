// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderLanding, numerosDaTrilha } from '../src/ui/landing.js';
import { modulos, problemas, PROXIMOS_MODULOS } from '../src/conteudo/trilha.js';
import { CERTIFICADOS, ORDEM } from '../src/certificados.js';

// Um certificado por módulo que tem certificado (os projetos não têm) e, quando a trilha tiver o final, mais um.
const TOTAL_CERTIFICADOS = Object.keys(CERTIFICADOS).length;

describe('landing page', () => {
  beforeEach(() => localStorage.clear());

  it('os números vêm do conteúdo da trilha', () => {
    const n = numerosDaTrilha();
    expect(n.exercicios).toBe(problemas.length);
    expect(n.modulos).toBe(modulos.length);
    expect(n.projetos).toBe(modulos.find((m) => m.grupos)?.grupos.length ?? 0);
    expect(n.certificados).toBe(TOTAL_CERTIFICADOS);
  });

  it('mostra todos os módulos, os badges e leva para a trilha', () => {
    const el = document.createElement('main');
    renderLanding(el);
    expect(el.querySelectorAll('.modulo-card:not(.em-breve)')).toHaveLength(modulos.length);
    expect(el.querySelectorAll('.vitrine-badges svg')).toHaveLength(TOTAL_CERTIFICADOS);
    expect(el.querySelector('.hero-acoes a').getAttribute('href')).toBe('#/trilha');
    expect(el.querySelector('a[href="#/privacidade"]')).not.toBeNull();
  });

  it('os próximos módulos aparecem como "em breve", sem link', () => {
    const el = document.createElement('main');
    renderLanding(el);
    const breve = [...el.querySelectorAll('.modulo-card.em-breve')];
    expect(breve.map((c) => c.dataset.modulo)).toEqual(PROXIMOS_MODULOS.map((m) => m.id));
    expect(breve.every((c) => c.textContent.includes('em breve') && !c.querySelector('a'))).toBe(true);
  });

  it('quem já começou vê "Continuar"', () => {
    localStorage.setItem('python-playground:progresso', JSON.stringify({ [problemas[0].id]: 'resolvido' }));
    const el = document.createElement('main');
    renderLanding(el);
    expect(el.querySelector('.hero-acoes a').textContent).toContain('Continuar');
  });
});

describe('contagem do progresso', () => {
  beforeEach(() => localStorage.clear());

  it('conta exercícios e lições separados, como o caminho mostra', async () => {
    const { resumoProgresso } = await import('../src/ui/inicio.js');
    const { itens } = await import('../src/conteudo/trilha.js');
    const licao = itens.find((i) => i.tipo === 'licao');
    const exercicios = itens.filter((i) => i.tipo === 'problema').slice(0, 2);
    const prog = Object.fromEntries([licao, ...exercicios].map((i) => [i.id, 'resolvido']));
    localStorage.setItem('python-playground:progresso', JSON.stringify(prog));
    expect(resumoProgresso()).toMatchObject({ resolvidos: 2, licoesLidas: 1 });
  });
});

describe.skipIf(ORDEM.length < 2)('certificados na trilha (regra da cadeia)', () => {
  const [primeiro, segundo] = ORDEM;
  beforeEach(() => localStorage.clear());

  it('módulo concluído sem o certificado anterior fica em espera', async () => {
    const { certificadosDaJornada } = await import('../src/ui/inicio.js');
    const { modulos } = await import('../src/conteudo/trilha.js');
    // O segundo módulo completo e o primeiro não: o segundo certificado espera o primeiro.
    const modulo = modulos.find((m) => m.id === segundo);
    const prog = Object.fromEntries(modulo.itens.filter((i) => i.tipo === 'problema').map((i) => [i.id, 'resolvido']));
    localStorage.setItem('python-playground:progresso', JSON.stringify(prog));
    const certs = certificadosDaJornada();
    expect(certs.find((c) => c.id === segundo)).toMatchObject({ concluido: true, liberado: false, falta: primeiro });
    expect(certs.find((c) => c.id === primeiro).liberado).toBe(false);
  });

  it('com os dois primeiros módulos concluídos, os dois saem, e o segundo leva a data do primeiro', async () => {
    const { certificadosDaJornada } = await import('../src/ui/inicio.js');
    const { modulos } = await import('../src/conteudo/trilha.js');
    const ids = modulos.filter((m) => [primeiro, segundo].includes(m.id))
      .flatMap((m) => m.itens.filter((i) => i.tipo === 'problema').map((i) => i.id));
    localStorage.setItem('python-playground:progresso', JSON.stringify(Object.fromEntries(ids.map((id) => [id, 'resolvido']))));
    const certs = certificadosDaJornada();
    const [a, b] = certs;
    expect(a.liberado && b.liberado).toBe(true);
    expect(b.cadeia).toEqual([a.data]);
  });
});
