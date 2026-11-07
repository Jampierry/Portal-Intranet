import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ titulo: 'Política de exemplo', categoria: 'Institucional', resumo: 'Resumo', formato: 'PDF', ...p });

test('editor cria documento com versão, responsável e link; leitor só lê', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ versao: '2.1', responsavel: 'RH', link_oficial: 'https://exemplo.com.br/doc.pdf', revisado_em: '2026-10-01' }) });
  assert.equal(r.statusCode, 201);
  const le = await entrar(app, 'le');
  const lista = (await app.inject({ url: '/api/documentos', headers: le })).json<{ titulo: string; versao: string; link_oficial: string }[]>();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].versao, '2.1');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: le, payload: novo() })).statusCode, 403);
});

test('link do documento só aceita http/https (bloqueia javascript:)', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (link: string) => app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ link_oficial: link }) });
  assert.equal((await post('javascript:alert(1)')).statusCode, 400);
  assert.equal((await post('ftp://servidor/arquivo')).statusCode, 400);
  assert.equal((await post('não é url')).statusCode, 400);
  assert.equal((await post('https://ok.example/doc')).statusCode, 201);
});

test('documento restrito só aparece para editor e admin', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Aberto' }) });
  await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo({ titulo: 'Sigiloso', classificacao: 'restrito' }) });
  const ver = async (login: string) => (await app.inject({ url: '/api/documentos', headers: await entrar(app, login) })).json<{ titulo: string }[]>().map((d) => d.titulo);
  assert.deepEqual(await ver('le'), ['Aberto']);
  assert.deepEqual((await ver('edita')).sort(), ['Aberto', 'Sigiloso']);
});

test('editar, apagar e 404', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const d = (await app.inject({ method: 'POST', url: '/api/gestao/documentos', headers: ed, payload: novo() })).json<{ id: number }>();
  const up = await app.inject({ method: 'PUT', url: `/api/gestao/documentos/${d.id}`, headers: ed, payload: novo({ versao: '3.0' }) });
  assert.equal(up.json<{ versao: string }>().versao, '3.0');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/${d.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/documentos/${d.id}`, headers: ed })).statusCode, 404);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/documentos/999', headers: ed, payload: novo() })).statusCode, 404);
});
