import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ tipo: 'mes', rotulo: 'Novembro/2026', nome: 'Pessoa Exemplo', area: 'Produção', apresentacao: 'Texto de exemplo', ...p });

test('aprovar destaque exige a referência do consentimento (LGPD)', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const sem = await app.inject({ method: 'POST', url: '/api/gestao/destaques', headers: ed, payload: novo({ status: 'aprovado' }) });
  assert.equal(sem.statusCode, 400);
  assert.match(sem.json<{ erro: string }>().erro, /consentimento/i);
  const com = await app.inject({ method: 'POST', url: '/api/gestao/destaques', headers: ed, payload: novo({ status: 'aprovado', consentimento_ref: 'Termo assinado em 02/10/2026' }) });
  assert.equal(com.statusCode, 201);
});

test('o portal só mostra destaque aprovado; rascunho e retirado ficam fora', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/destaques', headers: ed, payload: novo(p) });
  await post({ nome: 'Aprovada Silva', status: 'aprovado', consentimento_ref: 'termo' });
  await post({ nome: 'Rascunho Souza' });
  await post({ nome: 'Retirada Lima', status: 'retirado' });
  const vis = (await app.inject({ url: '/api/destaques', headers: await entrar(app, 'le') })).json<{ nome: string; iniciais: string }[]>();
  assert.deepEqual(vis.map((d) => d.nome), ['Aprovada Silva']);
  assert.equal(vis[0].iniciais, 'AS');
});

test('consulta não gerencia destaques; editar e apagar funcionam', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/destaques', headers: await entrar(app, 'le'), payload: novo() })).statusCode, 403);
  const ed = await entrar(app, 'edita');
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/destaques', headers: ed, payload: novo() })).json<{ id: number }>();
  const up = await app.inject({ method: 'PUT', url: `/api/gestao/destaques/${d.id}`, headers: ed, payload: novo({ area: 'Qualidade' }) });
  assert.equal(up.json<{ area: string }>().area, 'Qualidade');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/destaques/${d.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/destaques/${d.id}`, headers: ed })).statusCode, 404);
});

test('iniciais ignoram palavras que não começam com letra (ex.: "(exemplo)")', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/destaques', headers: ed, payload: novo({ nome: 'Maria Souza (exemplo)', status: 'aprovado', consentimento_ref: 'termo' }) });
  const vis = (await app.inject({ url: '/api/destaques', headers: ed })).json<{ iniciais: string }[]>();
  assert.equal(vis[0].iniciais, 'MS');
});
