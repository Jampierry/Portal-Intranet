// Login pelo Keycloak de ponta a ponta contra um Keycloak de mentira (servidor HTTP local).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarAppTeste } from '../../acessos/tests/ajuda.ts';

let kc: Server;
const emailDoKeycloak = 'ana@dipaula.com.br';
let verificado: boolean | undefined = true;
let ultimoToken: URLSearchParams | null = null;

before(async () => {
  kc = createServer((req, resp) => {
    const fim = (status: number, corpo: unknown) => { resp.writeHead(status, { 'Content-Type': 'application/json' }); resp.end(JSON.stringify(corpo)); };
    if (req.url?.endsWith('/token') && req.method === 'POST') {
      let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
        ultimoToken = new URLSearchParams(b);
        if (ultimoToken.get('client_secret') !== 'segredo-de-teste' || ultimoToken.get('code') !== 'codigo-ok') return fim(400, { error: 'invalid_grant' });
        fim(200, { access_token: 'tok' });
      });
    } else if (req.url?.endsWith('/userinfo')) {
      if (req.headers.authorization !== 'Bearer tok') return fim(401, {});
      fim(200, { email: emailDoKeycloak, email_verified: verificado });
    } else fim(404, {});
  });
  await new Promise<void>((ok) => kc.listen(0, '127.0.0.1', ok));
  process.env.KEYCLOAK_URL = `http://127.0.0.1:${(kc.address() as AddressInfo).port}`;
  process.env.KEYCLOAK_REALM = 'dipaula';
  process.env.KEYCLOAK_CLIENT_ID = 'portal-intranet-hml';
  process.env.KEYCLOAK_CLIENT_SECRET = 'segredo-de-teste';
});
after(() => { kc.close(); for (const k of ['KEYCLOAK_URL', 'KEYCLOAK_REALM', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET']) delete process.env[k]; });

async function iniciar(app: Awaited<ReturnType<typeof criarAppTeste>>['app']) {
  const r = await app.inject({ url: '/api/auth/keycloak/entrar' });
  assert.equal(r.statusCode, 302);
  const alvo = new URL(r.headers.location as string);
  return { alvo, state: alvo.searchParams.get('state')! };
}

test('entrar leva ao Keycloak com PKCE e o endereço de retorno cadastrado pela TI; só o state certo vale e uma vez', async () => {
  const { app, db } = await criarAppTeste();
  assert.deepEqual((await app.inject({ url: '/api/auth/keycloak/ativo' })).json(), { ativo: true });
  db.prepare("UPDATE usuarios SET email = ? WHERE login = 'le'").run('Ana@DiPaula.com.br');
  const { alvo, state } = await iniciar(app);
  assert.match(alvo.pathname, /\/realms\/dipaula\/protocol\/openid-connect\/auth$/);
  assert.equal(alvo.searchParams.get('client_id'), 'portal-intranet-hml');
  assert.equal(alvo.searchParams.get('code_challenge_method'), 'S256');
  assert.match(alvo.searchParams.get('redirect_uri')!, /\/api\/v1\/admin\/auth\/callback$/);

  const errado = await app.inject({ url: '/api/v1/admin/auth/callback?code=codigo-ok&state=inventado' });
  assert.equal(errado.headers.location, '/login?sso=erro');

  const ok = await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-ok&state=${state}` });
  assert.equal(ok.statusCode, 302);
  assert.equal(ok.headers.location, '/');
  assert.equal(ultimoToken?.get('code_verifier')?.length, 64);
  const cookie = ok.cookies.find((c) => c.name === 'portal_sessao')!;
  assert.ok(cookie, 'abre a sessão');
  const eu = (await app.inject({ url: '/api/eu', headers: { cookie: `portal_sessao=${cookie.value}` } })).json<{ login: string }>();
  assert.equal(eu.login, 'le');
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'login_sso'").get());

  const outra = await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-ok&state=${state}` });
  assert.equal(outra.headers.location, '/login?sso=erro', 'o state vale uma vez só');
});

test('recusa e-mail sem cadastro, repetido, não verificado e usuário inativo; nada é criado sozinho', async () => {
  const { app, db } = await criarAppTeste();
  const total = () => (db.prepare('SELECT COUNT(*) n FROM usuarios').get() as { n: number }).n;
  const antes = total();
  const tentar = async () => (await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-ok&state=${(await iniciar(app)).state}` })).headers.location;

  assert.equal(await tentar(), '/login?sso=sem_conta'); // ninguém com esse e-mail
  db.prepare("UPDATE usuarios SET email = ? WHERE login IN ('le', 'edita')").run('ana@dipaula.com.br');
  assert.equal(await tentar(), '/login?sso=sem_conta'); // e-mail repetido: não adivinha quem é
  db.prepare("UPDATE usuarios SET email = NULL WHERE login = 'edita'").run();
  verificado = false;
  assert.equal(await tentar(), '/login?sso=sem_conta'); // e-mail não verificado
  verificado = true;
  db.prepare("UPDATE usuarios SET ativo = 0 WHERE login = 'le'").run();
  assert.equal(await tentar(), '/login?sso=inativo');
  assert.equal(total(), antes);
});

test('KEYCLOAK_ISSUER_URL sozinho basta e tem prioridade sobre URL + realm', async () => {
  const { app } = await criarAppTeste();
  const base = process.env.KEYCLOAK_URL!;
  delete process.env.KEYCLOAK_URL; delete process.env.KEYCLOAK_REALM;
  process.env.KEYCLOAK_ISSUER_URL = `${base}/realms/dipaula-corp/`;
  const alvo = new URL((await app.inject({ url: '/api/auth/keycloak/entrar' })).headers.location as string);
  assert.equal(alvo.pathname, '/realms/dipaula-corp/protocol/openid-connect/auth');
  delete process.env.KEYCLOAK_ISSUER_URL;
  process.env.KEYCLOAK_URL = base; process.env.KEYCLOAK_REALM = 'dipaula';
});

test('sem as variáveis o login por Keycloak fica desligado; erro vindo do Keycloak volta ao login', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/v1/admin/auth/callback?error=access_denied&state=x' })).headers.location, '/login?sso=erro');
  const guardado = process.env.KEYCLOAK_CLIENT_SECRET;
  delete process.env.KEYCLOAK_CLIENT_SECRET;
  assert.deepEqual((await app.inject({ url: '/api/auth/keycloak/ativo' })).json(), { ativo: false });
  assert.equal((await app.inject({ url: '/api/auth/keycloak/entrar' })).headers.location, '/login?sso=desligado');
  process.env.KEYCLOAK_CLIENT_SECRET = guardado;
});
