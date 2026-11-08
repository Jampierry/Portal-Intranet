// "Esqueci a senha": pedido público (sem revelar logins), visível só para quem redefine senhas, resolvido ao redefinir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from './ajuda.ts';

const json = { 'content-type': 'application/json' };

test('pedido vira aviso para quem redefine senhas; login inexistente recebe a mesma resposta; redefinir resolve', async () => {
  const { app, db } = await criarAppTeste();
  const pede = (login: string) => app.inject({ method: 'POST', url: '/api/esqueci-senha', headers: json, payload: { login } });
  const a = await pede('le'), b = await pede('nao.existe');
  assert.equal(a.statusCode, 200); assert.deepEqual(a.json(), b.json());
  assert.equal((await pede('le')).statusCode, 200); // repetir não duplica
  assert.equal((await app.inject({ method: 'POST', url: '/api/esqueci-senha', headers: json, payload: {} })).statusCode, 400);

  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ url: '/api/gestao/pedidos-senha', headers: ed })).statusCode, 403);
  const lista = (await app.inject({ url: '/api/gestao/pedidos-senha', headers: adm })).json<{ id: number; login: string }[]>();
  assert.equal(lista.length, 1); assert.equal(lista[0].login, 'le');

  const leitor = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  const r = await app.inject({ method: 'POST', url: `/api/usuarios/${leitor}/senha`, headers: { ...adm, ...json }, payload: { senha: 'NovaSenha-123' } });
  assert.equal(r.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/gestao/pedidos-senha', headers: adm })).json<unknown[]>().length, 0);

  await pede('le');
  const id = (await app.inject({ url: '/api/gestao/pedidos-senha', headers: adm })).json<{ id: number }[]>()[0].id;
  assert.equal((await app.inject({ method: 'POST', url: `/api/gestao/pedidos-senha/${id}/dispensar`, headers: adm })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/gestao/pedidos-senha', headers: adm })).json<unknown[]>().length, 0);
});

test('limite de pedidos por origem e administrador não aparece para quem não é administrador', async () => {
  const { app, db } = await criarAppTeste();
  const pede = (login: string) => app.inject({ method: 'POST', url: '/api/esqueci-senha', headers: json, payload: { login } });
  await pede('master');
  const ins = db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) SELECT ?, ?, senha_hash, ?, 0, criado_em FROM usuarios WHERE login = ?');
  ins.run('gestor', 'Gestor', 'editor', 'edita');
  const adm = await entrar(app, 'master');
  assert.equal((await app.inject({ url: '/api/gestao/pedidos-senha', headers: adm })).json<unknown[]>().length, 1);
  for (let i = 0; i < 4; i++) await pede('nada' + i);
  assert.equal((await pede('x5')).statusCode, 429);
});
