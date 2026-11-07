// Testa a API de comunicados com um banco em memória (migrações reais, dados criados aqui).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, migrar } from '../../../servidor/src/db.ts';
import { criarApp } from '../../../servidor/src/app.ts';

async function appComDados() {
  const db = abrirBanco(':memory:');
  migrar(db, new URL('../../../infra/migracoes', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const ins = db.prepare("INSERT INTO comunicados (slug, titulo, resumo, corpo, categoria, status, publicado_em, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  ins.run('a', 'Aviso A', 'Resumo A', 'Corpo A', 'Pessoas', 'publicado', '2026-11-01', '2026-11-01');
  ins.run('b', 'Rascunho B', 'Resumo B', 'Corpo B', 'Pessoas', 'rascunho', null, '2026-11-01');
  return criarApp(db);
}

test('lista só comunicados publicados', async () => {
  const app = await appComDados();
  const r = await app.inject('/api/comunicados');
  assert.equal(r.statusCode, 200);
  assert.deepEqual((r.json() as { slug: string }[]).map((c) => c.slug), ['a']);
});

test('detalhe traz o corpo do comunicado publicado', async () => {
  const app = await appComDados();
  const r = await app.inject('/api/comunicados/a');
  assert.equal(r.statusCode, 200);
  assert.equal((r.json() as { corpo: string }).corpo, 'Corpo A');
});

test('detalhe de rascunho ou inexistente dá 404', async () => {
  const app = await appComDados();
  assert.equal((await app.inject('/api/comunicados/b')).statusCode, 404);
  assert.equal((await app.inject('/api/comunicados/nao-existe')).statusCode, 404);
});
