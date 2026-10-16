import { describe, it, expect } from 'vitest';
import {
  CERTIFICADOS, EMISSOR, codificarCertificado, decodificarCertificado, idCertificado, hashCertificado,
  ORDEM, anteriores, montarCadeia,
  linkLinkedInPerfil, linkLinkedInPublicar, linkPublico, textoPublicacao, SITE,
} from '../src/certificados.js';
import { modulos } from '../src/conteudo/trilha.js';
import { lerRota, paraBase64Url, deBase64Url } from '../src/compartilhar.js';

const lerCodigo = (codigo) => JSON.parse(new TextDecoder().decode(deBase64Url(codigo)));
const escreverCodigo = (obj) => paraBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

// O Python básico é o primeiro da cadeia: não precisa de certificados anteriores.
const CERT = { nome: 'Maria da Conceição', modulo: 'basico', data: '2026-10-11' };

describe('certificados', () => {
  it('existe um certificado para cada módulo, menos os projetos (o final chega com a trilha completa)', () => {
    expect(Object.keys(CERTIFICADOS).filter((id) => id !== 'final').sort()).toEqual(modulos.map((m) => m.id).filter((id) => id !== 'projetos').sort());
    for (const c of Object.values(CERTIFICADOS)) {
      expect(c.titulo).toBeTruthy();
      expect(c.conteudos.length).toBeGreaterThan(2);
    }
  });

  it('emitido pela Sertão será cloud, assinado por Cláudio Raposo', () => {
    expect(EMISSOR.organizacao).toBe('Sertão será cloud');
    expect(EMISSOR.responsavel).toBe('Cláudio Raposo');
  });

  it('o código guarda nome, módulo e data (com acentos)', () => {
    const codigo = codificarCertificado(CERT);
    const cert = decodificarCertificado(codigo);
    expect(cert).toMatchObject({ nome: CERT.nome, modulo: 'basico', data: CERT.data, selo: 'confere', hash: hashCertificado(CERT) });
    expect(lerRota(`#/certificado/${codigo}`)).toEqual({ tela: 'certificado', codigo });
  });

  it('id estável no formato SSC-AAAA-XXXX-XXXX, tirado do selo', () => {
    const id = idCertificado(CERT);
    expect(id).toMatch(/^SSC-2026-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(id.replace(/-/g, '').slice(7).toLowerCase()).toBe(montarCadeia(CERT).at(-1).hash.slice(0, 8));
    expect(idCertificado({ ...CERT })).toBe(id);
  });

  it('selo HMAC-SHA256: muda com data, aluno e módulo', () => {
    const hash = hashCertificado(CERT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    for (const mudanca of [{ data: '2026-10-12' }, { nome: 'Maria da Conceicao' }, { modulo: 'outro' }]) {
      expect(hashCertificado({ ...CERT, ...mudanca })).not.toBe(hash);
    }
    expect(hashCertificado({ ...CERT, nome: '  Maria da Conceição ' })).toBe(hash); // espaços nas pontas não contam
  });

  it('o link leva o selo, e a palavra secreta nunca aparece', () => {
    const dados = lerCodigo(codificarCertificado(CERT));
    expect(dados.h).toBe(montarCadeia(CERT).at(-1).hash);
    expect(JSON.stringify(dados).toLowerCase()).not.toMatch(/caf[eé]/);
  });

  it('detecta link alterado e link antigo sem selo', () => {
    const dados = lerCodigo(codificarCertificado(CERT));
    const alterado = decodificarCertificado(escreverCodigo({ ...dados, n: 'Outra Pessoa' }));
    expect(alterado.selo).toBe('nao-confere');
    expect(alterado.hash).toBe(dados.h);
    const antigo = decodificarCertificado(escreverCodigo({ n: CERT.nome, m: CERT.modulo, d: CERT.data }));
    expect(antigo.selo).toBe('ausente');
  });

  it('rejeita códigos inválidos', () => {
    expect(decodificarCertificado('@@@')).toBeNull();
    expect(decodificarCertificado(escreverCodigo({ n: 'Ana', m: 'inexistente', d: '2026-10-11', h: 'x' }))).toBeNull();
    expect(decodificarCertificado(escreverCodigo({ n: '  ', m: 'basico', d: '2026-10-11', h: 'x' }))).toBeNull();
    expect(decodificarCertificado(escreverCodigo({ n: 'Ana', m: 'basico', d: 'ontem', h: 'x' }))).toBeNull();
  });
});

describe('cadeia de certificados (como num blockchain)', () => {
  it('a ordem é a da trilha', () => {
    expect(ORDEM).toEqual(modulos.map((m) => m.id).filter((id) => id in CERTIFICADOS));
    expect(anteriores(ORDEM[0])).toEqual([]);
  });

  it('o primeiro não tem anterior e mantém o selo de antes da cadeia', () => {
    const [primeiro] = montarCadeia(CERT);
    expect(primeiro.anterior).toBe('');
    expect(primeiro.hash).toBe(hashCertificado(CERT));
    expect(lerCodigo(codificarCertificado(CERT))).not.toHaveProperty('c');
  });

  // Com um módulo só (fase 1), não há o que encadear: estes testes voltam sozinhos
  // quando a trilha tiver o segundo módulo.
  describe.skipIf(ORDEM.length < 2)('com dois ou mais módulos', () => {
    const SEGUNDO = { nome: 'Ana', modulo: ORDEM[1], data: '2026-10-11', cadeia: ['2026-10-01'] };

    it('cada certificado leva no selo o hash do anterior', () => {
      const elos = montarCadeia(SEGUNDO);
      expect(elos.map((e) => e.modulo)).toEqual(ORDEM.slice(0, 2));
      expect(elos[1].anterior).toBe(elos[0].hash);
      expect(elos[1].hash).not.toBe(hashCertificado(SEGUNDO)); // sem o anterior, o selo é outro
    });

    it('mudar a data do anterior quebra o selo do seguinte', () => {
      const dados = lerCodigo(codificarCertificado(SEGUNDO));
      expect(decodificarCertificado(escreverCodigo({ ...dados, c: ['2026-09-01'] })).selo).toBe('nao-confere');
    });

    it('não dá para pular um certificado da cadeia', () => {
      expect(() => codificarCertificado({ ...SEGUNDO, cadeia: [] })).toThrow(/1 certificado/);
    });

    it('link de módulo seguinte sem a cadeia é tratado como antigo', () => {
      const dados = lerCodigo(codificarCertificado(SEGUNDO));
      delete dados.c;
      expect(decodificarCertificado(escreverCodigo(dados)).selo).toBe('ausente');
    });
  });
});

describe('compartilhar', () => {
  it('links do LinkedIn: adicionar ao perfil e publicar', () => {
    const url = 'https://sertaoseracloud.github.io/python-playground/#/certificado/abc';
    const perfil = new URL(linkLinkedInPerfil(CERT, url));
    expect(perfil.origin + perfil.pathname).toBe('https://www.linkedin.com/profile/add');
    expect(Object.fromEntries(perfil.searchParams)).toEqual({
      startTask: 'CERTIFICATION_NAME',
      name: CERTIFICADOS.basico.titulo,
      organizationName: 'Sertão será cloud',
      issueYear: '2026',
      issueMonth: '10',
      certUrl: url,
      certId: idCertificado(CERT),
    });
    const publicar = new URL(linkLinkedInPublicar(CERT, url));
    expect(publicar.origin + publicar.pathname).toBe('https://www.linkedin.com/feed/');
    expect(publicar.searchParams.get('shareActive')).toBe('true');
    expect(publicar.searchParams.get('text')).toBe(textoPublicacao(CERT, url));
  });

  it('link público aponta para a página estática do badge, com o código', () => {
    const link = new URL(linkPublico(CERT));
    expect(link.href.startsWith(`${SITE}badge/basico/`)).toBe(true);
    expect(decodificarCertificado(link.searchParams.get('c'))).toMatchObject({ nome: CERT.nome, modulo: 'basico', selo: 'confere' });
  });

  it('texto do post cita o badge, o emissor, o link e hashtags', () => {
    const texto = textoPublicacao(CERT, 'https://exemplo/x');
    expect(texto).toContain(`"${CERTIFICADOS.basico.titulo}"`);
    expect(texto).toContain('Sertão será cloud');
    expect(texto).toContain('https://exemplo/x');
    expect(texto).toMatch(/#SertaoSeraCloud/);
  });

  it('os números do texto batem com o conteúdo da trilha', () => {
    for (const m of modulos.filter((x) => CERTIFICADOS[x.id])) {
      const problemas = m.itens.filter((i) => i.tipo === 'problema').length;
      expect(CERTIFICADOS[m.id].resumo).toMatch(new RegExp(`(^|\\D)${problemas} problemas`));
    }
  });
});
