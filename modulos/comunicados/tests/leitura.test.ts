// Confirmação de leitura: o comunicado pede, cada pessoa confirma, e o relatório mostra quem leu e quem falta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const com = (p: object = {}) => ({ titulo: 'Política de segurança', resumo: 'Leia e confirme.', categoria: 'Segurança', prioridade: 'normal', status: 'publicado', exige_leitura: true, ...p });

test('confirmar leitura: só quando o comunicado pede, uma vez por pessoa, com relatório de quem leu e quem falta', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le'), adm = await entrar(app, 'master');
  const novo = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: com() });
  assert.equal(novo.statusCode, 201);
  const { id, slug } = novo.json<{ id: number; slug: string }>();
  const livre = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: com({ titulo: 'Aviso comum', exige_leitura: false }) })).json<{ slug: string }>();

  const lista = (h: Record<string, string>) => app.inject({ url: '/api/comunicados', headers: h }).then((r) => r.json<{ slug: string; exige_leitura: number; lido: number }[]>());
  const antes = (await lista(le)).find((c) => c.slug === slug)!;
  assert.deepEqual([antes.exige_leitura, antes.lido], [1, 0]);

  assert.equal((await app.inject({ method: 'POST', url: `/api/comunicados/${livre.slug}/confirmar`, headers: le })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/comunicados/nao-existe/confirmar', headers: le })).statusCode, 404);
  const ok = await app.inject({ method: 'POST', url: `/api/comunicados/${slug}/confirmar`, headers: le });
  assert.equal(ok.statusCode, 200);
  const quando = ok.json<{ lido_em: string }>().lido_em;
  assert.equal((await app.inject({ method: 'POST', url: `/api/comunicados/${slug}/confirmar`, headers: le })).json<{ lido_em: string }>().lido_em, quando); // confirmar de novo não muda a data

  assert.equal((await lista(le)).find((c) => c.slug === slug)!.lido, 1);
  assert.equal((await lista(ed)).find((c) => c.slug === slug)!.lido, 0); // cada pessoa tem o seu
  const det = (await app.inject({ url: `/api/comunicados/${slug}`, headers: le })).json<{ lido: number; lido_em: string }>();
  assert.deepEqual([det.lido, det.lido_em], [1, quando]);

  const rel = (await app.inject({ url: `/api/gestao/comunicados/${id}/leituras`, headers: ed })).json<{ total: number; lidos: { login: string }[]; pendentes: { login: string }[] }>();
  assert.equal(rel.total, 3);
  assert.deepEqual(rel.lidos.map((x) => x.login), ['le']);
  assert.deepEqual(rel.pendentes.map((x) => x.login).sort(), ['edita', 'master']);
  assert.equal((await app.inject({ url: `/api/gestao/comunicados/${id}/leituras`, headers: le })).statusCode, 403);
  assert.equal((await app.inject({ url: `/api/gestao/comunicados/9999/leituras`, headers: adm })).statusCode, 404);
});

test('usuário desativado ou sem acesso a comunicados não conta como pendente', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: com() })).json<{ id: number }>();
  db.prepare("UPDATE usuarios SET ativo = 0 WHERE login = 'le'").run();
  const rel = (await app.inject({ url: `/api/gestao/comunicados/${id}/leituras`, headers: ed })).json<{ total: number; pendentes: { login: string }[] }>();
  assert.deepEqual(rel.pendentes.map((x) => x.login).sort(), ['edita', 'master']);
  assert.equal(rel.total, 2);
});
