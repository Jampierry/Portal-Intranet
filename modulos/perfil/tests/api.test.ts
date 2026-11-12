import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';

test('Meu perfil: grava, formata telefones, valida emergência e só mostra o próprio', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le'), ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'GET', url: '/api/eu/perfil' })).statusCode, 401);
  const ok = await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { apelido: 'Lê', celular: '62999990000', emergencia1_nome: 'Maria', emergencia1_parent: 'Mãe', emergencia1_tel: '6233330000' } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().celular, '(62) 99999-0000');
  assert.equal(ok.json().emergencia1_tel, '(62) 3333-0000');
  assert.equal((await app.inject({ method: 'GET', url: '/api/eu/perfil', headers: ed })).json().celular, null); // outra pessoa não vê
  assert.equal((await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { emergencia1_nome: 'Maria' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { celular: '123' } })).statusCode, 400);
});

test('Trocar e-mail exige a senha atual e e-mail válido', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const put = (payload: object) => app.inject({ method: 'PUT', url: '/api/eu/email', headers: le, payload });
  assert.equal((await put({ email: 'novo@exemplo.invalid', senha: 'errada-errada' })).statusCode, 400);
  assert.equal((await put({ email: 'invalido', senha: SENHA })).statusCode, 400);
  assert.equal((await put({ email: 'Novo@Exemplo.invalid', senha: SENHA })).json().email, 'novo@exemplo.invalid');
  assert.equal((await app.inject({ method: 'GET', url: '/api/eu/perfil', headers: le })).json().email, 'novo@exemplo.invalid');
});

test('Ficha de emergência: só admin ou quem tem a permissão; consulta é auditada', async () => {
  const { app, db } = await criarAppTeste();
  const le = await entrar(app, 'le'), adm = await entrar(app, 'master');
  await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { emergencia1_nome: 'Maria', emergencia1_parent: 'Mãe', emergencia1_tel: '6233330000' } });
  const id = (await app.inject({ url: '/api/usuarios', headers: adm })).json<{ id: number; login: string }[]>().find((u) => u.login === 'le')!.id;
  assert.equal((await app.inject({ url: `/api/usuarios/${id}/ficha`, headers: await entrar(app, 'edita') })).statusCode, 403);
  const r = await app.inject({ url: `/api/usuarios/${id}/ficha`, headers: adm });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().emergencia1_tel, '(62) 3333-0000');
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'perfil_ficha_lida'").get());
  assert.equal((await app.inject({ url: '/api/usuarios/99999/ficha', headers: adm })).statusCode, 404);
});

test('Foto de perfil: só imagem de verdade; remover limpa', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const ruim = await app.inject({ method: 'POST', url: '/api/eu/foto', headers: { ...le, 'content-type': 'image/png' }, payload: Buffer.from('nao sou imagem') });
  assert.equal(ruim.statusCode, 400);
  const ok = await app.inject({ method: 'POST', url: '/api/eu/foto', headers: { ...le, 'content-type': 'image/png' }, payload: png });
  assert.equal(ok.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/eu/perfil', headers: le })).json().foto, ok.json().foto);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/eu/foto', headers: le })).json().foto, null);
});
