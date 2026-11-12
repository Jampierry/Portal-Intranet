import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

test('manuais: exigem login; cada perfil vê só os seus; o arquivo vem da lista fixa', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject('/api/ajuda/manuais')).statusCode, 401);
  const le = await entrar(app, 'le'), adm = await entrar(app, 'master');
  const ids = (h: Record<string, string>) => app.inject({ url: '/api/ajuda/manuais', headers: h }).then((r) => r.json<{ id: string }[]>().map((m) => m.id));
  assert.deepEqual(await ids(le), ['colaborador']);
  assert.equal((await ids(adm)).length, 4);
  assert.equal((await app.inject({ url: '/api/ajuda/manuais/administrador', headers: le })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/ajuda/manuais/..%2F..%2Fpackage', headers: adm })).statusCode, 404);
  const m = await app.inject({ url: '/api/ajuda/manuais/colaborador', headers: le });
  assert.equal(m.statusCode, 200);
  assert.match(m.json<{ texto: string }>().texto, /# Manual do colaborador/);
});
