// Identidade do portal e tela de entrada configuráveis: leitura pública, só quem tem permissão altera, imagens públicas só se estiverem em uso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

process.env.PASTA_IMAGENS = mkdtempSync(join(tmpdir(), 'portal-marca-'));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const json = { 'content-type': 'application/json' };

test('instalação nova: padrões neutros e públicos (nenhuma empresa embutida)', async () => {
  const { app } = await criarAppTeste();
  const e = (await app.inject({ url: '/api/empresa' })).json<{ nome: string; slogan: string; feriados_municipais: unknown[] }>();
  assert.equal(e.nome, 'Sua Empresa'); assert.equal(e.slogan, ''); assert.deepEqual(e.feriados_municipais, []);
  const t = (await app.inject({ url: '/api/entrada' })).json<{ fundo: string; linhas: string[] }>();
  assert.equal(t.fundo, 'cor'); assert.deepEqual(t.linhas, []);
});

test('empresa: só quem tem permissão altera; vale para todos, sem login; valida feriado municipal', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita');
  const corpo = { nome: 'Malharia Aurora', nome_portal: 'Aurora Conecta', slogan: 'Tecendo gente', frase_rodape: 'Juntos.', lema: ['A', 'B'], feriados_municipais: [{ titulo: 'Aniversário da cidade', dia: 3, mes: 4 }] };
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...ed, ...json }, payload: corpo })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { ...corpo, nome: '' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { ...corpo, feriados_municipais: [{ titulo: 'X', dia: 31, mes: 2 }] } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: corpo })).statusCode, 200);
  const pub = (await app.inject({ url: '/api/empresa' })).json<{ nome: string; nome_portal: string }>();
  assert.equal(pub.nome, 'Malharia Aurora'); assert.equal(pub.nome_portal, 'Aurora Conecta');
});

test('feriados gerados usam os feriados municipais da empresa', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', feriados_municipais: [{ titulo: 'Dia da cidade', dia: 3, mes: 4 }] } });
  await app.inject({ method: 'POST', url: '/api/gestao/calendario/feriados', headers: { ...adm, ...json }, payload: { ano: 2030 } });
  const r = (await app.inject({ url: '/api/gestao/calendario/datas', headers: adm })).json<{ titulo: string; tipo: string }[]>();
  assert.ok(r.some((d) => d.titulo === 'Dia da cidade' && d.tipo === 'municipal'));
  assert.ok(!r.some((d) => /Goiânia/.test(d.titulo)));
});

test('tela de entrada: só quem tem permissão altera; imagem só é pública se estiver em uso (entrada ou ícone da empresa)', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/entrada', headers: { ...ed, ...json }, payload: { fundo: 'cor' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/entrada/imagens', headers: { ...ed, 'content-type': 'image/png' }, payload: PNG })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/entrada', headers: { ...adm, ...json }, payload: { fundo: 'carrossel', imagens: [] } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/entrada', headers: { ...adm, ...json }, payload: { fundo: 'imagem', imagens: ['/api/imagens/aaaaaaaaaaaaaaaaaaaaaaaa.png'] } })).statusCode, 400);

  const up = await app.inject({ method: 'POST', url: '/api/gestao/entrada/imagens', headers: { ...adm, 'content-type': 'image/png' }, payload: PNG });
  assert.equal(up.statusCode, 201);
  const url = up.json<{ url: string }>().url;
  assert.match(url, /^\/api\/publico\/imagens\/[a-f0-9]{24}\.png$/);
  assert.equal((await app.inject({ url })).statusCode, 404); // ainda não está em uso
  const ok = await app.inject({ method: 'PUT', url: '/api/gestao/entrada', headers: { ...adm, ...json }, payload: { fundo: 'carrossel', imagens: [url], intervalo: 5, escurecer: 40, linhas: ['Um', 'Dois'], rodape: 'Rodapé', texto_extra: 'Bem-vindo' } });
  assert.equal(ok.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/entrada' })).json<{ rodape: string }>().rodape, 'Rodapé'); // sem login
  const img = await app.inject({ url });
  assert.equal(img.statusCode, 200); assert.equal(img.headers['content-type'], 'image/png');
  assert.equal((await app.inject({ url: '/api/publico/imagens/..%2Fportal.db' })).statusCode, 404);

  const up2 = await app.inject({ method: 'POST', url: '/api/gestao/empresa/imagens', headers: { ...adm, 'content-type': 'image/png' }, payload: PNG });
  const logo = up2.json<{ url: string }>().url;
  assert.equal((await app.inject({ url: logo })).statusCode, 404);
  await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', logo } });
  assert.equal((await app.inject({ url: logo })).statusCode, 200);

  // logo do nome (imagem larga que substitui o nome escrito): só imagem enviada por esta tela e só aparece quando em uso
  const up3 = await app.inject({ method: 'POST', url: '/api/gestao/empresa/imagens', headers: { ...adm, 'content-type': 'image/png' }, payload: PNG });
  const logoNome = up3.json<{ url: string }>().url;
  assert.equal((await app.inject({ url: logoNome })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', logo_nome: 'https://externo/x.png' } })).statusCode, 400);
  const salvo = await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', logo_nome: logoNome } });
  assert.equal(salvo.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/empresa' })).json<{ logo_nome: string }>().logo_nome, logoNome);
  assert.equal((await app.inject({ url: logoNome })).statusCode, 200);

  // versão da logo para o tema escuro: mesma regra (só imagem do portal; só é entregue quando em uso)
  const up4 = await app.inject({ method: 'POST', url: '/api/gestao/empresa/imagens', headers: { ...adm, 'content-type': 'image/png' }, payload: PNG });
  const logoEscuro = up4.json<{ url: string }>().url;
  assert.equal((await app.inject({ url: logoEscuro })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', logo_nome: logoNome, logo_nome_escuro: 'https://externo/x.png' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', logo_nome: logoNome, logo_nome_escuro: logoEscuro } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/empresa' })).json<{ logo_nome_escuro: string }>().logo_nome_escuro, logoEscuro);
  assert.equal((await app.inject({ url: logoEscuro })).statusCode, 200);

  // logo em SVG: aceita o vetor limpo; recusa script, eventos e links externos; não vale para as imagens da Tela de entrada
  const svgOk = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="#123"/></svg>');
  const envioSvg = (corpo: Buffer, rota = 'empresa') => app.inject({ method: 'POST', url: `/api/gestao/${rota}/imagens`, headers: { ...adm, 'content-type': 'image/svg+xml' }, payload: corpo });
  for (const ruim of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://externo/x.png"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>'])
    assert.equal((await envioSvg(Buffer.from(ruim))).statusCode, 400, ruim);
  assert.equal((await envioSvg(svgOk, 'entrada')).statusCode, 400);
  const upSvg = await envioSvg(svgOk);
  assert.equal(upSvg.statusCode, 201);
  const logoSvg = upSvg.json<{ url: string }>().url;
  assert.match(logoSvg, /\.svg$/);
  assert.equal((await app.inject({ url: logoSvg })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/empresa', headers: { ...adm, ...json }, payload: { nome: 'X', nome_portal: 'P', logo_nome: logoSvg } })).statusCode, 200);
  const entregue = await app.inject({ url: logoSvg });
  assert.equal(entregue.statusCode, 200);
  assert.equal(entregue.headers['content-type'], 'image/svg+xml');
  assert.match(String(entregue.headers['content-security-policy']), /sandbox/);
});
