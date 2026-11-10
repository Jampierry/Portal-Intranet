// Missão, visão e valores: todos leem, só editor/admin edita, com limites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

test('começa vazio; editor grava e o leitor vê missão, visão e valores em lista', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  assert.deepEqual((await app.inject({ url: '/api/institucional', headers: le })).json(), { missao: '', visao: '', proposito: '', valores: [] });
  const r = await app.inject({ method: 'PUT', url: '/api/gestao/institucional', headers: await entrar(app, 'edita'), payload: { missao: 'Vestir o movimento', visao: 'Ser referência', valores: 'Respeito\n\n Qualidade \nSegurança' } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/institucional', headers: le })).json(), { missao: 'Vestir o movimento', visao: 'Ser referência', proposito: '', valores: ['Respeito', 'Qualidade', 'Segurança'] });
});

test('leitor não edita; limites de valores', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/institucional', headers: await entrar(app, 'le'), payload: { missao: 'x' } })).statusCode, 403);
  const ed = await entrar(app, 'edita');
  const muitos = Array.from({ length: 9 }, (_, i) => `Valor ${i}`).join('\n');
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/institucional', headers: ed, payload: { valores: muitos } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/institucional', headers: ed, payload: { valores: 'a'.repeat(61) } })).statusCode, 400);
});
