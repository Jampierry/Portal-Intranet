import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ departamento: 'Recursos Humanos', nome: 'Atendimento ao colaborador', canal: 'rh@exemplo.invalid', ...p });

test('contatos exigem login; leitor só vê os publicáveis', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject('/api/contatos')).statusCode, 401);
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: ed, payload: novo() });
  await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: ed, payload: novo({ nome: 'Interno', publicavel: false }) });
  const lista = (await app.inject({ url: '/api/contatos', headers: await entrar(app, 'le') })).json<{ nome: string }[]>();
  assert.deepEqual(lista.map((c) => c.nome), ['Atendimento ao colaborador']);
});

test('a área é criada na hora e reaproveitada; consulta não gerencia', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: ed, payload: novo() });
  await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: ed, payload: novo({ nome: 'Folha' }) });
  assert.equal((db.prepare('SELECT COUNT(*) n FROM departamentos').get() as { n: number }).n, 1);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: await entrar(app, 'le'), payload: novo() })).statusCode, 403);
});

test('validação, edição, exclusão e auditoria', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), adm = await entrar(app, 'master');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: ed, payload: novo({ canal: '' }) })).statusCode, 400);
  const c = (await app.inject({ method: 'POST', url: '/api/gestao/contatos', headers: ed, payload: novo() })).json<{ id: number }>();
  const up = await app.inject({ method: 'PUT', url: `/api/gestao/contatos/${c.id}`, headers: ed, payload: novo({ canal: 'ramal 2200' }) });
  assert.equal(up.json<{ canal: string }>().canal, 'ramal 2200');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/contatos/${c.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/contatos/${c.id}`, headers: ed })).statusCode, 404);
  const acoes = (await app.inject({ url: '/api/auditoria', headers: adm })).json<{ acao: string }[]>().map((l) => l.acao);
  assert.ok(acoes.includes('contato_criado') && acoes.includes('contato_apagado'));
});
