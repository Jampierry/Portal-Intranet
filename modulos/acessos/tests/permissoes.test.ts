// Permissões por ação: o administrador define, por perfil e por usuário, o que cada um acessa e faz em cada tela e aba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from './ajuda.ts';

type Ctx = Awaited<ReturnType<typeof criarAppTeste>>;
const put = (app: Ctx['app'], url: string, headers: Record<string, string>, payload: object) => app.inject({ method: 'PUT', url, headers, payload });
const idDe = (db: Ctx['db'], login: string) => (db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login) as { id: number }).id;
const eu = async (app: Ctx['app'], h: Record<string, string>) => (await app.inject({ url: '/api/eu', headers: h })).json<{ permissoes: string[]; perfil_nome: string }>();
const comunicado = { titulo: 'Aviso geral', resumo: 'Resumo do aviso', categoria: 'Geral' };

test('padrões: editor publica (sem aplicativos nem configurações), consulta só vê; /api/eu traz as permissões', async () => {
  const { app } = await criarAppTeste();
  const ed = (await eu(app, await entrar(app, 'edita'))).permissoes;
  assert.ok(ed.includes('pub.comunicados.criar') && ed.includes('pub.comunicados.excluir') && ed.includes('documentos.restritos'));
  assert.ok(!ed.some((p) => p.startsWith('pub.aplicativos') || p.startsWith('cfg.')));
  const le = (await eu(app, await entrar(app, 'le'))).permissoes;
  assert.deepEqual(le, ['ver.comunicados', 'ver.documentos', 'documentos.abrir', 'ver.calendario', 'ver.pessoas', 'ver.ajuda']);
  assert.ok(ed.includes('calendario.criar') && ed.includes('calendario.excluir') && !le.includes('calendario.criar'));
});

test('perfis: só quem tem cfg.perfis.* mexe; admin é fixo; chaves inválidas são recusadas', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/perfis', headers: await entrar(app, 'edita') })).statusCode, 403);
  const adm = await entrar(app, 'master');
  const r = (await app.inject({ url: '/api/perfis', headers: adm })).json<{ perfis: { codigo: string; fixo: boolean }[] }>();
  assert.deepEqual(r.perfis.map((p) => [p.codigo, p.fixo]), [['admin', true], ['editor', false], ['consulta', false], ['p-rh', false]]);
  assert.equal((await put(app, '/api/perfis/admin', adm, { permissoes: [] })).statusCode, 400);
  assert.equal((await put(app, '/api/perfis/editor', adm, { permissoes: ['voar'] })).statusCode, 400);
  assert.equal((await put(app, '/api/perfis/visitante', adm, { permissoes: [] })).statusCode, 404);
});

test('"ver" é o portão: sem ele, nenhuma ação da aba vale', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const r = await put(app, '/api/perfis/editor', adm, { permissoes: ['pub.banners.criar', 'pub.banners.editar', 'ver.comunicados'] });
  assert.deepEqual(r.json<{ permissoes: string[] }>().permissoes, ['ver.comunicados']);
});

test('cada ação é conferida separada: criar, editar e excluir', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const edita = await entrar(app, 'edita');
  const base = ['ver.comunicados', 'pub.comunicados.ver'];
  const criar = () => app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: edita, payload: comunicado });
  await put(app, '/api/perfis/editor', adm, { permissoes: base });
  assert.equal((await app.inject({ url: '/api/gestao/comunicados', headers: edita })).statusCode, 200);
  assert.equal((await criar()).statusCode, 403);
  await put(app, '/api/perfis/editor', adm, { permissoes: [...base, 'pub.comunicados.criar'] });
  const c = await criar();
  assert.equal(c.statusCode, 201);
  const id = c.json<{ id: number }>().id;
  assert.equal((await put(app, `/api/gestao/comunicados/${id}`, edita, { ...comunicado, titulo: 'Novo título' })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/comunicados/${id}`, headers: edita })).statusCode, 403);
  await put(app, '/api/perfis/editor', adm, { permissoes: [...base, 'pub.comunicados.editar'] });
  assert.equal((await put(app, `/api/gestao/comunicados/${id}`, edita, { ...comunicado, titulo: 'Novo título' })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/comunicados/${id}`, headers: edita })).statusCode, 403);
  await put(app, '/api/perfis/editor', adm, { permissoes: [...base, 'pub.comunicados.excluir'] });
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/comunicados/${id}`, headers: edita })).statusCode, 200);
});

test('documentos: abrir o link e ver restritos são ações separadas', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  db.prepare("INSERT INTO documentos (slug, titulo, categoria, resumo, formato, classificacao, link_oficial) VALUES ('norma', 'Norma', 'RH', 'x', 'PDF', 'interno', 'https://docs.exemplo/norma')").run();
  db.prepare("INSERT INTO documentos (slug, titulo, categoria, resumo, formato, classificacao) VALUES ('sigilo', 'Sigilo', 'RH', 'x', 'PDF', 'restrito')").run();
  const lista = async (h: Record<string, string>) => (await app.inject({ url: '/api/documentos', headers: h })).json<{ slug: string; link_oficial: string | null }[]>();
  const le = await entrar(app, 'le');
  let l = await lista(le);
  assert.deepEqual(l.map((d) => d.slug), ['norma']);
  assert.equal(l[0].link_oficial, 'https://docs.exemplo/norma');
  await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'documentos.abrir': false } });
  assert.equal((await lista(le))[0].link_oficial, null);
  await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'documentos.restritos': true } });
  l = await lista(le);
  assert.deepEqual(l.map((d) => d.slug), ['norma', 'sigilo']);
  await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'ver.documentos': false } });
  assert.equal((await app.inject({ url: '/api/documentos', headers: le })).statusCode, 403);
});

test('ajuste do usuário vale por cima do perfil e limpar volta ao perfil', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const le = await entrar(app, 'le');
  const novo = () => app.inject({ method: 'POST', url: '/api/gestao/banners', headers: le, payload: { titulo: 'Banner novo' } });
  assert.equal((await novo()).statusCode, 403);
  const a = await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'pub.banners.ver': true, 'pub.banners.criar': true } });
  assert.equal(a.statusCode, 200);
  assert.ok(a.json<{ efetivas: string[] }>().efetivas.includes('pub.banners.criar'));
  assert.equal((await novo()).statusCode, 201);
  await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: {} });
  assert.equal((await novo()).statusCode, 403);
});

test('ajustes inválidos são recusados; admin ignora ajustes', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { voar: true } })).statusCode, 400);
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'pub.banners.ver': 'sim' } })).statusCode, 400);
  await put(app, `/api/usuarios/${idDe(db, 'master')}`, adm, { permissoes: { 'pub.banners.criar': false } });
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: adm, payload: { titulo: 'Banner do admin' } })).statusCode, 201);
});

test('abas de Configurações por ação: ver, criar, editar e redefinir senha', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const edita = await entrar(app, 'edita');
  const dar = (p: Record<string, boolean>) => put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: p });
  assert.equal((await app.inject({ url: '/api/usuarios', headers: edita })).statusCode, 403);
  await dar({ 'cfg.auditoria.ver': true });
  assert.equal((await app.inject({ url: '/api/auditoria', headers: edita })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/usuarios', headers: edita })).statusCode, 403);
  await dar({ 'cfg.usuarios.ver': true });
  assert.equal((await app.inject({ url: '/api/usuarios', headers: edita })).statusCode, 200);
  const criar = (login: string) => app.inject({ method: 'POST', url: '/api/usuarios', headers: edita, payload: { login, nome: 'Fulano Teste', perfil: 'consulta', senha: 'Provisoria#2026' } });
  assert.equal((await criar('fulano.um')).statusCode, 403);
  await dar({ 'cfg.usuarios.ver': true, 'cfg.usuarios.criar': true });
  assert.equal((await criar('fulano.um')).statusCode, 201);
  const alvo = idDe(db, 'fulano.um');
  assert.equal((await put(app, `/api/usuarios/${alvo}`, edita, { nome: 'Fulano Editado' })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: `/api/usuarios/${alvo}/senha`, headers: edita, payload: { senha: 'Outra#senha2026' } })).statusCode, 403);
  await dar({ 'cfg.usuarios.ver': true, 'cfg.usuarios.editar': true, 'cfg.usuarios.senha': true });
  assert.equal((await put(app, `/api/usuarios/${alvo}`, edita, { nome: 'Fulano Editado' })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/usuarios/${alvo}/senha`, headers: edita, payload: { senha: 'Outra#senha2026' } })).statusCode, 200);
});

test('quem gerencia usuários sem ser admin não escala privilégio', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: { 'cfg.usuarios.ver': true, 'cfg.usuarios.criar': true, 'cfg.usuarios.editar': true, 'cfg.usuarios.senha': true } });
  const edita = await entrar(app, 'edita');
  const lista = (await app.inject({ url: '/api/usuarios', headers: edita })).json<{ perfil: string }[]>();
  assert.ok(lista.length > 0 && lista.every((u) => u.perfil !== 'admin'));
  const base = { login: 'novo.user', nome: 'Novo Usuário', senha: 'Provisoria#2026' };
  const criar = (p: object) => app.inject({ method: 'POST', url: '/api/usuarios', headers: edita, payload: { ...base, ...p } });
  assert.equal((await criar({ perfil: 'admin' })).statusCode, 403);
  assert.equal((await criar({ perfil: 'consulta', permissoes: { 'cfg.perfis.ver': true } })).statusCode, 403);
  assert.equal((await criar({ perfil: 'consulta', permissoes: { 'pub.banners.ver': true, 'pub.banners.criar': true } })).statusCode, 201);
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'master')}`, edita, { nome: 'Hackeado' })).statusCode, 403);
  assert.equal((await put(app, `/api/usuarios/${idDe(db, 'edita')}`, edita, { nome: 'Eu mesma' })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: `/api/usuarios/${idDe(db, 'master')}/senha`, headers: edita, payload: { senha: 'Outra#senha2026' } })).statusCode, 403);
});

test('perfis personalizados: criar, usar em um usuário, editar, e só apagar sem usuários', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const criar = (p: object) => app.inject({ method: 'POST', url: '/api/perfis', headers: adm, payload: p });
  assert.equal((await criar({ nome: 'x' })).statusCode, 400);
  assert.equal((await criar({ nome: 'Editor' })).statusCode, 400);
  assert.equal((await criar({ nome: 'RH', permissoes: ['voar'] })).statusCode, 400);
  const r = await criar({ nome: 'Recursos Humanos', permissoes: ['ver.comunicados', 'pub.comunicados.ver', 'pub.comunicados.criar'] });
  assert.equal(r.statusCode, 201);
  const rh = r.json<{ codigo: string; sistema: boolean }>();
  assert.equal(rh.codigo, 'p-recursos-humanos');
  assert.equal(rh.sistema, false);
  const u = await app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'rh.maria', nome: 'Maria do RH', perfil: rh.codigo, senha: 'Provisoria#2026' } });
  assert.equal(u.statusCode, 201);
  assert.equal(u.json<{ perfil_nome: string }>().perfil_nome, 'Recursos Humanos');
  db.prepare('UPDATE usuarios SET trocar_senha = 0 WHERE login = ?').run('rh.maria');
  const maria = await eu(app, await entrar(app, 'rh.maria', 'Provisoria#2026'));
  assert.deepEqual(maria.permissoes, ['ver.comunicados', 'pub.comunicados.ver', 'pub.comunicados.criar']);
  assert.equal(maria.perfil_nome, 'Recursos Humanos');
  assert.equal((await app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'sem.perfil', nome: 'Sem Perfil', perfil: 'inventado', senha: 'Provisoria#2026' } })).statusCode, 400);
  const ed = await put(app, `/api/perfis/${rh.codigo}`, adm, { nome: 'RH Central', permissoes: ['ver.comunicados'] });
  assert.equal(ed.json<{ nome: string }>().nome, 'RH Central');
  const sis = await put(app, '/api/perfis/editor', adm, { nome: 'Outro nome' });
  assert.equal(sis.json<{ nome: string }>().nome, 'Editor');
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/perfis/editor', headers: adm })).statusCode, 400);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/perfis/${rh.codigo}`, headers: adm })).statusCode, 409);
  await put(app, `/api/usuarios/${u.json<{ id: number }>().id}`, adm, { perfil: 'consulta' });
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/perfis/${rh.codigo}`, headers: adm })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/perfis/${rh.codigo}`, headers: adm })).statusCode, 404);
});

test('quem não é admin só cria perfil com permissões que ele tem', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await put(app, `/api/usuarios/${idDe(db, 'edita')}`, adm, { permissoes: { 'cfg.perfis.ver': true, 'cfg.perfis.criar': true } });
  const edita = await entrar(app, 'edita');
  const criar = (permissoes: string[]) => app.inject({ method: 'POST', url: '/api/perfis', headers: edita, payload: { nome: 'Teste ' + permissoes.join('+'), permissoes } });
  assert.equal((await criar(['pub.aplicativos.ver'])).statusCode, 403);
  assert.equal((await criar(['pub.banners.ver', 'pub.banners.criar'])).statusCode, 201);
});

test('quem não é administrador não escolhe perfil mais forte que o seu nem redefine a senha de quem tem mais acesso', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  // O leitor (perfil consulta) ganha só a gestão de usuários.
  await put(app, `/api/usuarios/${idDe(db, 'le')}`, adm, { permissoes: { 'cfg.usuarios.ver': true, 'cfg.usuarios.criar': true, 'cfg.usuarios.editar': true, 'cfg.usuarios.senha': true } });
  const le = await entrar(app, 'le');
  const base = { login: 'subiu.de.nivel', nome: 'Sobe de Nível', senha: 'Provisoria#2026' };
  assert.equal((await app.inject({ method: 'POST', url: '/api/usuarios', headers: le, payload: { ...base, perfil: 'editor' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/usuarios', headers: le, payload: { ...base, perfil: 'consulta' } })).statusCode, 201);
  const novo = idDe(db, 'subiu.de.nivel');
  assert.equal((await put(app, `/api/usuarios/${novo}`, le, { perfil: 'editor' })).statusCode, 403);
  // Redefinir a senha do editor (que tem mais acesso que o leitor) seria virar o editor.
  assert.equal((await app.inject({ method: 'POST', url: `/api/usuarios/${idDe(db, 'edita')}/senha`, headers: le, payload: { senha: 'Outra#senha2026' } })).statusCode, 403);
});

test('o texto digitado no login não vira a chave de bloqueio de outro login nem de um IP', async () => {
  const { app, db } = await criarAppTeste();
  for (let i = 0; i < 6; i++) await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'par:le|127.0.0.1', senha: 'errada' } });
  assert.equal((await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: 'senha-de-teste-1' } })).statusCode, 200); // o leitor continua entrando
  const chaves = (db.prepare('SELECT DISTINCT chave FROM tentativas_login').all() as { chave: string }[]).map((c) => c.chave);
  assert.ok(chaves.includes('login:par:le|127.0.0.1'));
});
