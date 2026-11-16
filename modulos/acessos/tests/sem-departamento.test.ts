// Aviso do RH: colaboradores ativos sem departamento (só quem edita usuários vê; o administrador master fica de fora).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from './ajuda.ts';

test('lista quem está sem departamento e some da lista quando o cadastro é completado', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master'), ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ url: '/api/gestao/sem-departamento' })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/gestao/sem-departamento', headers: ed })).statusCode, 403, 'sem a permissão de editar usuários');

  const lista = (await app.inject({ url: '/api/gestao/sem-departamento', headers: adm })).json<{ id: number; nome: string; login: string }[]>();
  const logins = lista.map((x) => x.login);
  assert.ok(logins.includes('le') && logins.includes('edita'));
  assert.ok(!logins.includes('master'), 'o administrador não entra no aviso');

  const d = (await app.inject({ method: 'POST', url: '/api/departamentos', headers: adm, payload: { nome: 'Logística' } })).json<{ id: number }>();
  const idLe = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${idLe}`, headers: adm, payload: { departamento_id: d.id } })).statusCode, 200);
  db.prepare("UPDATE usuarios SET ativo = 0 WHERE login = 'edita'").run();
  const depois = (await app.inject({ url: '/api/gestao/sem-departamento', headers: adm })).json<{ login: string }[]>();
  assert.ok(!depois.some((x) => x.login === 'le'), 'com departamento sai do aviso');
  assert.ok(!depois.some((x) => x.login === 'edita'), 'desativado não aparece');
});
