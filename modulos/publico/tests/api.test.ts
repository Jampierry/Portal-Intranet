// Público por departamento: comunicados e pesquisas só aparecem para quem é do departamento escolhido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const COM = { titulo: 'Aviso do Marketing', resumo: 'Resumo', categoria: 'RH', status: 'publicado' };

async function cenario() {
  const t = await criarAppTeste();
  const adm = await entrar(t.app, 'master'), le = await entrar(t.app, 'le');
  const dep = async (nome: string) => (await t.app.inject({ method: 'POST', url: '/api/departamentos', headers: adm, payload: { nome } })).json<{ id: number }>().id;
  const mkt = await dep('Marketing'), fin = await dep('Financeiro');
  const idLe = (t.db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  const colocar = (id: number | null) => t.app.inject({ method: 'PUT', url: `/api/usuarios/${idLe}`, headers: adm, payload: { departamento_id: id } });
  return { ...t, adm, le, mkt, fin, idLe, colocar };
}

test('comunicado para um departamento: só quem é dele vê (lista, detalhe e confirmação)', async () => {
  const { app, adm, le, mkt, fin, colocar } = await cenario();
  const c = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: { ...COM, exige_leitura: true, departamentos: [mkt] } })).json<{ slug: string; departamentos: number[] }>();
  assert.deepEqual(c.departamentos, [mkt]);
  const todos = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: { ...COM, titulo: 'Para todos' } })).json<{ slug: string }>();

  const slugs = async () => (await app.inject({ url: '/api/comunicados', headers: le })).json<{ slug: string }[]>().map((x) => x.slug);
  assert.deepEqual(await slugs(), [todos.slug], 'sem departamento: só o que é para todos');
  assert.equal((await app.inject({ url: `/api/comunicados/${c.slug}`, headers: le })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: `/api/comunicados/${c.slug}/confirmar`, headers: le })).statusCode, 404);

  await colocar(fin);
  assert.deepEqual(await slugs(), [todos.slug], 'outro departamento: continua sem ver');
  await colocar(mkt);
  assert.ok((await slugs()).includes(c.slug));
  assert.equal((await app.inject({ url: `/api/comunicados/${c.slug}`, headers: le })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/comunicados/${c.slug}/confirmar`, headers: le })).statusCode, 200);

  // lista da gestão mostra o público; editar para "todos" libera
  const lista = (await app.inject({ url: '/api/gestao/comunicados', headers: adm })).json<{ slug: string; publico_texto: string }[]>();
  assert.equal(lista.find((x) => x.slug === c.slug)!.publico_texto, 'Marketing');
  assert.equal(lista.find((x) => x.slug === todos.slug)!.publico_texto, 'Todos');
});

test('leituras de um comunicado contam só o público escolhido; departamento inexistente é recusado', async () => {
  const { app, adm, mkt, fin, colocar } = await cenario();
  await colocar(fin);
  const c = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: { ...COM, exige_leitura: true, departamentos: [mkt] } })).json<{ id: number }>();
  const l = (await app.inject({ url: `/api/gestao/comunicados/${c.id}/leituras`, headers: adm })).json<{ total: number; pendentes: { login: string }[] }>();
  assert.ok(!l.pendentes.some((p) => p.login === 'le'), 'quem é de outro departamento não é cobrado');
  const ruim = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: adm, payload: { ...COM, departamentos: [9999] } });
  assert.equal(ruim.statusCode, 400);
});

test('pesquisa para um departamento: só ele recebe e responde; o alvo conta só o departamento', async () => {
  const { app, adm, le, mkt, fin, colocar } = await cenario();
  const perguntas = [{ texto: 'Como vai?', tipo: 'nota', obrigatoria: true }];
  const p = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: adm, payload: { pergunta: 'Clima do Marketing', status: 'aberto', perguntas, departamentos: [mkt] } })).json<{ id: number; pendentes: number; publico_texto: string; perguntas: { id: number }[] }>();
  assert.equal(p.publico_texto, 'Marketing');
  await colocar(fin);
  assert.equal((await app.inject({ url: '/api/pulso', headers: le })).json<{ aberto: boolean }>().aberto, false, 'outro departamento não recebe');
  const resp = { respostas: [{ pergunta_id: p.perguntas[0].id, valor: 4 }] };
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${p.id}/responder`, headers: le, payload: resp })).statusCode, 404);
  await colocar(mkt);
  assert.equal((await app.inject({ url: '/api/pulso', headers: le })).json<{ aberto: boolean }>().aberto, true);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${p.id}/responder`, headers: le, payload: resp })).statusCode, 200);
  const g = (await app.inject({ url: '/api/gestao/pulso', headers: adm })).json<{ id: number; pendentes: number }[]>().find((x) => x.id === p.id)!;
  assert.equal(g.pendentes, 0, 'só o Marketing conta, e a pessoa do Marketing já respondeu');
  // anônima: com menos de 5 respostas o resultado continua escondido
  const r = (await app.inject({ url: `/api/gestao/pulso/${p.id}/resultado`, headers: adm })).json<{ liberado: boolean; alvo: number }>();
  assert.equal(r.liberado, false);
  assert.equal(r.alvo, 1);
});
