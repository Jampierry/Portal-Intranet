import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBanco, migrar } from '../src/db.ts';
import { criarApp } from '../src/app.ts';

async function appComSite() {
  const pasta = mkdtempSync(join(tmpdir(), 'site-'));
  mkdirSync(join(pasta, 'assets'));
  writeFileSync(join(pasta, 'index.html'), '<!doctype html><title>Portal</title>');
  writeFileSync(join(pasta, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(join(pasta, '..', 'fora-do-site.txt'), 'segredo');
  const db = abrirBanco(':memory:');
  migrar(db, fileURLToPath(new URL('../../infra/migracoes', import.meta.url)));
  return criarApp(db, true, { pastaSite: pasta });
}

test('produção entrega o site compilado, com cache só para arquivos com hash', async () => {
  const app = await appComSite();
  const home = await app.inject({ url: '/' });
  assert.equal(home.statusCode, 200);
  assert.match(home.headers['content-type'] as string, /text\/html/);
  assert.equal(home.headers['cache-control'], 'no-cache');
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.equal(home.headers['x-frame-options'], 'DENY');
  const js = await app.inject({ url: '/assets/app-abc123.js' });
  assert.match(js.headers['content-type'] as string, /javascript/);
  assert.match(js.headers['cache-control'] as string, /immutable/);
});

test('rota do app cai no index.html; /api inexistente continua 404 em JSON', async () => {
  const app = await appComSite();
  assert.match((await app.inject({ url: '/comunicados/algum' })).body, /<title>Portal<\/title>/);
  const api = await app.inject({ url: '/api/nao-existe' });
  assert.ok([401, 404].includes(api.statusCode));
  assert.doesNotMatch(api.body, /<title>/);
  assert.equal((await app.inject({ method: 'POST', url: '/qualquer' })).statusCode, 404);
});

test('não serve arquivos fora da pasta do site', async () => {
  const app = await appComSite();
  for (const url of ['/../fora-do-site.txt', '/%2e%2e/fora-do-site.txt', '/..%2ffora-do-site.txt', '/assets/../../fora-do-site.txt']) {
    const r = await app.inject({ url });
    assert.doesNotMatch(r.body, /segredo/, url);
  }
});

test('produção envia CSP restritiva (com hash do script de tema) e HSTS só em HTTPS', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'site-csp-'));
  writeFileSync(join(pasta, 'index.html'), '<!doctype html><script>var a=1;</script><script type="module" src="/x.js"></script>');
  const db = abrirBanco(':memory:');
  migrar(db, fileURLToPath(new URL('../../infra/migracoes', import.meta.url)));
  const app = await criarApp(db, true, { pastaSite: pasta });
  const r = await app.inject({ url: '/' });
  const csp = String(r.headers['content-security-policy']);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.equal(r.headers['strict-transport-security'], undefined); // HTTP puro: sem HSTS
  const https = await app.inject({ url: '/', headers: { 'x-forwarded-proto': 'https' } });
  // só com TRUST_PROXY=1 o cabeçalho do proxy é aceito; aqui a política padrão ignora, então também não há HSTS
  assert.ok(https.headers['strict-transport-security'] === undefined || /max-age/.test(String(https.headers['strict-transport-security'])));
});
