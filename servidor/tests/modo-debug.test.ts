import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// A config lê as variáveis na importação: define antes de importar.
process.env.MODO_DEBUG = '1';
delete process.env.APP_ENV;
const { abrirBanco, migrar } = await import('../src/db.ts');
const { config } = await import('../src/config.ts');
const { rotasAcessos } = await import('../../modulos/acessos/api/index.ts');

test('modo debug: erro 500 devolve mensagem, pilha e rota; sem debug só a mensagem genérica', async () => {
  assert.equal(config.modoDebug, true);
  const db = abrirBanco(':memory:'); migrar(db, config.pastaMigracoes);
  const app = Fastify();
  await rotasAcessos(app, { db, producao: false });
  app.get('/boom', async () => { throw new Error('falha de teste'); });
  const r = await app.inject({ url: '/boom?x=1' });
  assert.equal(r.statusCode, 500);
  const j = r.json() as { erro: string; detalhe?: string; rota?: string };
  assert.match(j.detalhe ?? '', /falha de teste/);
  assert.equal(j.rota, 'GET /boom');
  await app.close();
});
