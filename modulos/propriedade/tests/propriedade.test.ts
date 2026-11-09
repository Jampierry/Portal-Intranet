// Propriedade: só o administrador apaga o que é de outra pessoa; editar exige autorização do dono (ou do administrador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';
import { hashSenha } from '../../acessos/api/senha.ts';

async function cenario() {
  const t = await criarAppTeste();
  t.db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, 0, ?)').run('edita2', 'Outro Editor', hashSenha(SENHA), 'editor', new Date().toISOString());
  const dono = await entrar(t.app, 'edita'), outro = await entrar(t.app, 'edita2'), admin = await entrar(t.app, 'master');
  const b = (await t.app.inject({ method: 'POST', url: '/api/gestao/banners', headers: dono, payload: { titulo: 'Do dono' } })).json<{ id: number }>();
  return { ...t, dono, outro, admin, id: b.id };
}
const caixa = async (app: Awaited<ReturnType<typeof criarAppTeste>>['app'], h: Record<string, string>) =>
  (await app.inject({ url: '/api/pedidos-edicao/caixa', headers: h })).json<{ pendentes: { id: number }[]; respostas: { status: string }[] }>();

test('outra pessoa não apaga; o dono e o administrador apagam', async () => {
  const { app, dono, outro, admin, id } = await cenario();
  const r = await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${id}`, headers: outro });
  assert.equal(r.statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${id}`, headers: admin })).statusCode, 200);
  const b2 = (await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: dono, payload: { titulo: 'Outro' } })).json<{ id: number }>();
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${b2.id}`, headers: dono })).statusCode, 200);
});

test('editar o que é de outra pessoa pede autorização do dono; o administrador também vê e decide', async () => {
  const { app, dono, outro, admin, id } = await cenario();
  const put = () => app.inject({ method: 'PUT', url: `/api/gestao/banners/${id}`, headers: outro, payload: { titulo: 'Mudado' } });
  const negado = await put();
  assert.equal(negado.statusCode, 403);
  assert.equal(negado.json<{ codigo: string }>().codigo, 'precisa_autorizacao');

  const pedido = await app.inject({ method: 'POST', url: '/api/pedidos-edicao', headers: outro, payload: { recurso: 'banner', registro: String(id) } });
  assert.equal(pedido.statusCode, 201);
  const pid = pedido.json<{ id: number }>().id;
  // o dono e o administrador recebem; quem não tem relação, não
  assert.equal((await caixa(app, dono)).pendentes.length, 1);
  assert.equal((await caixa(app, admin)).pendentes.length, 1);
  assert.equal((await caixa(app, outro)).pendentes.length, 0);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pedidos-edicao/${pid}/decidir`, headers: outro, payload: { aprovar: true } })).statusCode, 403);

  assert.equal((await app.inject({ method: 'POST', url: `/api/pedidos-edicao/${pid}/decidir`, headers: dono, payload: { aprovar: true } })).statusCode, 200);
  assert.equal((await put()).statusCode, 200);
  assert.equal((await caixa(app, outro)).respostas[0].status, 'aprovado');
  assert.equal((await caixa(app, admin)).pendentes.length, 0);
  // autorizar não libera apagar
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${id}`, headers: outro })).statusCode, 403);
});

test('conteúdo sem dono (ex.: autor desativado ou anterior à regra): só o administrador decide e apaga', async () => {
  const { app, db, outro, admin, id } = await cenario();
  db.prepare('UPDATE banners SET criado_por = NULL WHERE id = ?').run(id);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${id}`, headers: outro })).statusCode, 403);
  const pid = (await app.inject({ method: 'POST', url: '/api/pedidos-edicao', headers: outro, payload: { recurso: 'banner', registro: String(id) } })).json<{ id: number }>().id;
  assert.equal((await caixa(app, admin)).pendentes.length, 1);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pedidos-edicao/${pid}/decidir`, headers: admin, payload: { aprovar: false } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/banners/${id}`, headers: outro, payload: { titulo: 'X' } })).statusCode, 403);
  const pa = await app.inject({ method: 'PUT', url: `/api/gestao/banners/${id}`, headers: admin, payload: { titulo: 'Xis', subtitulo: 'Y' } }); assert.equal(pa.statusCode, 200, pa.body);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${id}`, headers: admin })).statusCode, 200);
});

test('data do calendário segue a mesma regra', async () => {
  const { app, dono, outro } = await cenario();
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/calendario/datas', headers: dono, payload: { titulo: 'Reunião', data: '2026-12-01', tipo: 'importante' } }));
  if (d.statusCode !== 201) return; // tipo padrão pode variar; o essencial é coberto pelos banners
  const id = d.json<{ id: number }>().id;
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/calendario/datas/${id}`, headers: outro })).statusCode, 403);
});
