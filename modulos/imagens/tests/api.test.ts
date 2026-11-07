// Envio de imagens de capa: só editor/admin, só imagem de verdade, entrega com login.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

process.env.PASTA_IMAGENS = mkdtempSync(join(tmpdir(), 'portal-img-'));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

test('editor envia PNG, leitor consegue ver e o endereço fica em /api/imagens', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/imagens', headers: { ...ed, 'content-type': 'image/png' }, payload: PNG });
  assert.equal(r.statusCode, 201);
  const { url } = r.json<{ url: string }>();
  assert.match(url, /^\/api\/imagens\/[a-f0-9]{24}\.png$/);
  const le = await entrar(app, 'le');
  const g = await app.inject({ url, headers: le });
  assert.equal(g.statusCode, 200);
  assert.equal(g.headers['content-type'], 'image/png');
  assert.equal((await app.inject({ url })).statusCode, 401);
});

test('recusa leitor, arquivo que não é imagem (mesmo com tipo imagem) e nome inventado', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/imagens', headers: { ...le, 'content-type': 'image/png' }, payload: PNG })).statusCode, 403);
  const ed = await entrar(app, 'edita');
  const falso = await app.inject({ method: 'POST', url: '/api/gestao/imagens', headers: { ...ed, 'content-type': 'image/png' }, payload: Buffer.from('<script>alert(1)</script>') });
  assert.equal(falso.statusCode, 400);
  assert.equal((await app.inject({ url: '/api/imagens/..%2Fportal.db', headers: ed })).statusCode, 404);
});
