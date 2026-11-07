// Permissões: o administrador define o que cada perfil pode; ajustes por usuário valem por cima do perfil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from './ajuda.ts';

const put = (app: Awaited<ReturnType<typeof criarAppTeste>>['app'], url: string, headers: Record<string, string>, payload: object) =>
  app.inject({ method: 'PUT', url, headers, payload });
const idDe = (db: Awaited<ReturnType<typeof criarAppTeste>>['db'], login: string) =>
  (db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login) as { id: number }).id;

test('padrões: editor publica (menos aplicativos), consulta só vê; /api/eu traz as permissões', async () => {
  const { app } = await criarAppTeste();
  const ed = (await app.inject({ url: '/api/eu', headers: await entrar(app, 'edita') })).json<{ permissoes: string[] }>().permissoes;
  assert.ok(ed.includes('pub.comunicados') && ed.includes('ver.documentos') && !ed.includes('pub.aplicativos'));
  const le = (await app.inject({ url: '/api/eu', headers: await entrar(app, 'le') })).json<{ permissoes: string[] }>().permissoes;
  assert.ok(le.includes('ver.comunicados') && !le.some((p) => p.startsWith('pub.')));
});

test('só o administrador lê e altera perfis; admin é fixo; chaves inválidas são recusadas', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/perfis', headers: await entrar(app, 'edita') })).statusCode, 403);
  const adm = await entrar(app, 'master');
  const r = (await app.inject({ url: '/api/perfis', headers: adm })).json<{ perfis: { codigo: string; fixo: boolean }[] }>();
  assert.deepEqual(r.perfis.map((p) => [p.codigo, p.fixo]), [['admin', true], ['editor', false], ['consulta', false]]);
  assert.equal((await put(app, '/api/perfis/admin', adm, { permissoes: [] })).statusCode, 400);
  assert.equal((await put(app, '/api/perfis/editor', adm, { permissoes: ['voar'] })).statusCode, 400);
  assert.equal((await put(app, '/api/perfis/visitante', adm, { permissoes: [] })).statusCode, 404);
});

test('mudar o perfil vale na hora: tirar pub.comunicados do editor bloqueia a gestão; dar ao consulta libera', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const edita = await entrar(app, 'edita');
  const post = (h: Record<string, string>) => app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: h, payload: { titulo: 'Aviso geral', resumo: 'Resumo do aviso', categoria: 'Geral' } });
  assert.equal((await post(edita)).statusCode, 201);
  const sem = ['ver.comunicados', 'pub.documentos'];
  assert.equal((await put(app, '/api/perfis/editor', adm, { permissoes: sem })).statusCode, 200);
  assert.equal((await post(edita)).statusCode, 403);
  const le = await entrar(app, 'le');
  assert.equal((await post(le)).statusCode, 403);
  await put(app, '/api/perfis/consulta', adm, { permissoes: ['ver.comunicados', 'pub.comunicados'] });
  assert.equal((await post(le)).statusCode, 201);
});

test('ajuste do usuário vale por cima do perfil (permitir e negar) e "herdar" volta ao perfil', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const le = await entrar(app, 'le');
  const edita = await entrar(app, 'edita');
  const novo = () => app.inject({ method: 'POST', url: '/api/gestao/banners', headers: le, payload: { titulo: 'Banner novo' } });
  assert.equal((await novo()).statusCode, 403);
  // Permitir a um leitor o que o perfil não dá
  const a = await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'pub.banners': true } });
  assert.equal(a.statusCode, 200);
  assert.ok(a.json<{ efetivas: string[] }>().efetivas.includes('pub.banners'));
  assert.equal((await novo()).statusCode, 201);
  // Negar a um editor o que o perfil dá, e esconder a tela
  await put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: { 'pub.documentos': false, 'ver.documentos': false } });
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: edita, payload: {} })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/documentos', headers: edita })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/comunicados', headers: edita })).statusCode, 200);
  // Mudar o perfil depois não apaga o ajuste; limpar os ajustes volta ao perfil
  await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: {} });
  assert.equal((await novo()).statusCode, 403);
});

test('ajustes inválidos são recusados; admin ignora ajustes; documentos restritos seguem pub.documentos', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { voar: true } })).statusCode, 400);
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'pub.banners': 'sim' } })).statusCode, 400);
  await put(app, `/api/usuarios/${idDe(db, 'master')}`, adm, { permissoes: { 'pub.banners': false } });
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: adm, payload: { titulo: 'Banner do admin' } })).statusCode, 201);
  db.prepare("INSERT INTO documentos (slug, titulo, categoria, resumo, formato, classificacao) VALUES ('sigilo', 'Sigilo', 'RH', 'x', 'PDF', 'restrito')").run();
  const lista = async (login: string) => (await app.inject({ url: '/api/documentos', headers: await entrar(app, login) })).json<{ slug: string }[]>().map((d) => d.slug);
  assert.ok((await lista('edita')).includes('sigilo'));
  assert.ok(!(await lista('le')).includes('sigilo'));
});

test('criar usuário já com ajustes', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const r = await app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'nova.pessoa', nome: 'Nova Pessoa', perfil: 'consulta', senha: 'Provisoria#2026', permissoes: { 'ver.pessoas': false } } });
  assert.equal(r.statusCode, 201);
  assert.ok(!r.json<{ efetivas: string[] }>().efetivas.includes('ver.pessoas'));
});

test('abas de Configurações: o administrador libera cada aba; sem liberar, 403', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const edita = await entrar(app, 'edita');
  assert.equal((await app.inject({ url: '/api/usuarios', headers: edita })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/auditoria', headers: edita })).statusCode, 403);
  await put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: { 'cfg.auditoria': true } });
  assert.equal((await app.inject({ url: '/api/auditoria', headers: edita })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/usuarios', headers: edita })).statusCode, 403); // outra aba continua fechada
  // por perfil: dar cfg.usuarios a todo o perfil consulta
  await put(app, '/api/perfis/consulta', adm, { permissoes: ['ver.comunicados', 'cfg.usuarios'] });
  assert.equal((await app.inject({ url: '/api/usuarios', headers: await entrar(app, 'le') })).statusCode, 200);
});

test('quem gerencia usuários sem ser admin não escala privilégio', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: { 'cfg.usuarios': true } });
  const edita = await entrar(app, 'edita');
  const lista = (await app.inject({ url: '/api/usuarios', headers: edita })).json<{ perfil: string }[]>();
  assert.ok(lista.length > 0 && lista.every((u) => u.perfil !== 'admin')); // administradores não aparecem
  const base = { login: 'novo.user', nome: 'Novo Usuário', senha: 'Provisoria#2026' };
  const criar = (p: object) => app.inject({ method: 'POST', url: '/api/usuarios', headers: edita, payload: { ...base, ...p } });
  assert.equal((await criar({ perfil: 'admin' })).statusCode, 403);
  assert.equal((await criar({ perfil: 'consulta', permissoes: { 'cfg.perfis': true } })).statusCode, 403); // ele não tem cfg.perfis
  assert.equal((await criar({ perfil: 'consulta', permissoes: { 'pub.banners': true } })).statusCode, 201); // tem pub.banners pelo perfil editor
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'master')}`, edita, { nome: 'Hackeado' })).statusCode, 403);
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'edita')}`, edita, { nome: 'Eu mesma' })).statusCode, 403); // nem o próprio cadastro
  assert.equal((await app.inject({ method: 'POST', url: `/api/usuarios/${idDe(db, 'master')}/senha`, headers: edita, payload: { senha: 'Outra#senha2026' } })).statusCode, 403);
  // perfis: só concede o que ele mesmo tem
  await put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: { 'cfg.usuarios': true, 'cfg.perfis': true } });
  assert.equal((await put(app, '/api/perfis/consulta', edita, { permissoes: ['ver.comunicados', 'pub.aplicativos'] })).statusCode, 403);
  assert.equal((await put(app, '/api/perfis/consulta', edita, { permissoes: ['ver.comunicados', 'pub.banners'] })).statusCode, 200);
});
