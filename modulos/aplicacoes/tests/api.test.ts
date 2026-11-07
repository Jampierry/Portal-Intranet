import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ nome: 'Sistema X', descricao: 'Descrição', categoria: 'Operação', url: 'https://x.example.com', acesso: 'Acesso restrito', ...p });

test('só o admin cadastra aplicações; URL só http/https', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: await entrar(app, 'edita'), payload: novo() })).statusCode, 403);
  const adm = await entrar(app, 'master');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: novo({ url: 'javascript:alert(1)' }) })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: novo() })).statusCode, 201);
  const lista = (await app.inject({ url: '/api/aplicacoes', headers: await entrar(app, 'le') })).json<{ slug: string }[]>();
  assert.deepEqual(lista.map((a) => a.slug), ['sistema-x']);
});

test('app inativo some do catálogo, mas continua na gestão', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: novo() });
  await app.inject({ method: 'PUT', url: '/api/gestao/aplicacoes/sistema-x', headers: adm, payload: novo({ ativo: false }) });
  assert.equal((await app.inject({ url: '/api/aplicacoes', headers: adm })).json<unknown[]>().length, 0);
  assert.equal((await app.inject({ url: '/api/gestao/aplicacoes', headers: adm })).json<unknown[]>().length, 1);
});

test('favoritos são por usuário e guardados no servidor', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master'), le = await entrar(app, 'le');
  await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: novo() });
  assert.equal((await app.inject({ method: 'PUT', url: '/api/favoritos/sistema-x', headers: le })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/favoritos/sistema-x', headers: le })).statusCode, 200); // repetir não duplica
  assert.deepEqual((await app.inject({ url: '/api/favoritos', headers: le })).json(), ['sistema-x']);
  assert.deepEqual((await app.inject({ url: '/api/favoritos', headers: adm })).json(), []);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/favoritos/nao-existe', headers: le })).statusCode, 404);
  await app.inject({ method: 'DELETE', url: '/api/favoritos/sistema-x', headers: le });
  assert.deepEqual((await app.inject({ url: '/api/favoritos', headers: le })).json(), []);
});
