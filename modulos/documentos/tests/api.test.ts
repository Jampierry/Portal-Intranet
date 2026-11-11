import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ titulo: 'Política de exemplo', categoria: 'Institucional', resumo: 'Resumo', formato: 'PDF', ...p });

test('editor cria documento com versão, responsável e link; leitor só lê', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ versao: '2.1', responsavel: 'RH', link_oficial: 'https://exemplo.com.br/doc.pdf', revisado_em: '2026-10-01' }) });
  assert.equal(r.statusCode, 201);
  const le = await entrar(app, 'le');
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ titulo: string; versao: string; link_oficial: string }[]>();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].versao, '2.1');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: le, payload: novo() })).statusCode, 403);
});

test('link do documento só aceita http/https (bloqueia javascript:)', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (link: string) => app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ link_oficial: link }) });
  assert.equal((await post('javascript:alert(1)')).statusCode, 400);
  assert.equal((await post('ftp://servidor/arquivo')).statusCode, 400);
  assert.equal((await post('não é url')).statusCode, 400);
  assert.equal((await post('https://ok.example/doc')).statusCode, 201);
});

test('documento restrito só aparece para editor e admin', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Aberto' }) });
  await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Sigiloso', classificacao: 'restrito' }) });
  const ver = async (login: string) => (await app.inject({ url: '/api/documentos', headers: await entrar(app, login) })).json<{ titulo: string }[]>().map((d) => d.titulo);
  assert.deepEqual(await ver('le'), ['Aberto']);
  assert.deepEqual((await ver('edita')).sort(), ['Aberto', 'Sigiloso']);
});

test('editar, apagar e 404', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo() })).json<{ id: number }>();
  const up = await app.inject({ method: 'PUT', url: `/api/gestao/documentos/${d.id}`, headers: ed, payload: novo({ versao: '3.0' }) });
  assert.equal(up.json<{ versao: string }>().versao, '3.0');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/${d.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/${d.id}`, headers: ed })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/documentos/999', headers: ed, payload: novo() })).statusCode, 404);
});

test('documento na pasta do portal: serve o arquivo e bloqueia saída da pasta', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const raiz = mkdtempSync(join(tmpdir(), 'docs-'));
  mkdirSync(join(raiz, 'RH'));
  writeFileSync(join(raiz, 'RH', 'ferias.txt'), 'conteudo ok');
  writeFileSync(join(raiz, '..', 'segredo-fora.txt'), 'nao pode');
  process.env.DOCUMENTOS_PASTA = raiz;
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (origem: string, link: string, extra: object = {}) => app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ origem, link_oficial: link, ...extra }) });
  assert.equal((await post('pasta', '../segredo-fora.txt')).statusCode, 400);
  assert.equal((await post('pasta', 'C:/Windows/win.ini')).statusCode, 400);
  assert.equal((await post('s999', 'RH/ferias.txt')).statusCode, 400);
  assert.equal((await post('pasta', 'RH/ferias.txt', { titulo: 'Férias' })).statusCode, 201);
  assert.equal((await post('pasta', 'RH/nao-existe.txt', { titulo: 'Sumiu' })).statusCode, 201);
  const le = await entrar(app, 'le');
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ slug: string; titulo: string; origem: string; link_oficial: string }[]>();
  const ferias = lista.find((d) => d.titulo === 'Férias')!;
  assert.equal(ferias.link_oficial, `/api/documentos/${ferias.slug}/arquivo`);
  const r = await app.inject({ url: ferias.link_oficial, headers: le });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, 'conteudo ok');
  assert.equal((await app.inject({ url: `/api/documentos/${lista.find((d) => d.titulo === 'Sumiu')!.slug}/arquivo`, headers: le })).statusCode, 404);
  assert.equal((await app.inject({ url: ferias.link_oficial })).statusCode, 401);
  const raizLista = (await app.inject({ url: '/api/gestao/documentos/pasta', headers: ed })).json<{ sub: string; itens: { nome: string; pasta: boolean }[] }>();
  assert.deepEqual(raizLista.itens, [{ nome: 'RH', pasta: true }]);
  const rh = (await app.inject({ url: '/api/gestao/documentos/pasta?sub=RH', headers: ed })).json<{ sub: string; itens: { nome: string }[] }>();
  assert.equal(rh.sub, 'RH');
  assert.deepEqual(rh.itens.map((i) => i.nome), ['ferias.txt']);
  assert.equal((await app.inject({ url: '/api/gestao/documentos/pasta?sub=..', headers: ed })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/gestao/documentos/pasta', headers: le })).statusCode, 403);
  delete process.env.DOCUMENTOS_PASTA;
});

test('origem cadastrada pelo administrador: publicador escolhe o arquivo e o portal entrega', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const raiz = mkdtempSync(join(tmpdir(), 'orig-'));
  mkdirSync(join(raiz, 'Politicas'));
  writeFileSync(join(raiz, 'Politicas', 'conduta.txt'), 'texto da origem');
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const ed = await entrar(app, 'edita');
  const le = await entrar(app, 'le');
  const cria = (h: Record<string, string>, caminho = raiz) => app.inject({ method: 'POST', url: '/api/gestao/documentos/origens', headers: h, payload: { nome: 'RH', caminho } });
  assert.equal((await cria(ed)).statusCode, 403);
  assert.equal((await cria(adm, 'relativo/x')).statusCode, 400);
  const id = (await cria(adm)).json<{ id: number }>().id;
  assert.equal((await cria(adm)).statusCode, 400); // nome repetido
  // Publicador vê só o nome; administrador vê o caminho.
  assert.deepEqual((await app.inject({ url: '/api/gestao/documentos/origens', headers: ed })).json(), [{ id, nome: 'RH' }]);
  assert.equal((await app.inject({ url: '/api/gestao/documentos/origens', headers: adm })).json<{ caminho: string }[]>()[0].caminho, raiz);
  const nav = (await app.inject({ url: `/api/gestao/documentos/pasta?origem=${id}&sub=Politicas`, headers: ed })).json<{ itens: { nome: string }[] }>();
  assert.deepEqual(nav.itens.map((i) => i.nome), ['conduta.txt']);
  assert.equal((await app.inject({ url: `/api/gestao/documentos/pasta?origem=${id}&sub=..`, headers: ed })).statusCode, 400);
  const doc = await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Conduta', origem: `s${id}`, link_oficial: 'Politicas/conduta.txt' }) });
  assert.equal(doc.statusCode, 201);
  assert.equal(doc.json<{ origem: string; origem_id: number }>().origem_id, id);
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ slug: string; link_oficial: string }[]>();
  const r = await app.inject({ url: lista[0].link_oficial, headers: le });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, 'texto da origem');
  // Seletor de pasta do servidor: só administrador.
  const sel = (h: Record<string, string>, caminho: string) => app.inject({ url: `/api/gestao/documentos/origens/navegar?caminho=${encodeURIComponent(caminho)}`, headers: h });
  assert.equal((await sel(ed, raiz)).statusCode, 403);
  assert.deepEqual((await sel(adm, raiz)).json<{ pastas: { nome: string }[] }>().pastas.map((p) => p.nome), ['Politicas']);
  assert.equal((await sel(adm, 'relativo')).statusCode, 400);
  assert.ok((await app.inject({ url: '/api/gestao/documentos/origens/navegar', headers: adm })).json<{ pastas: unknown[] }>().pastas.length > 0);
  // Origem em uso não pode ser apagada.
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/origens/${id}`, headers: adm })).statusCode, 400);
});
