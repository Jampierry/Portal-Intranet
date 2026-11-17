// Login pelo Keycloak de ponta a ponta contra um Keycloak de mentira (servidor HTTP local).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

let kc: Server;
const emailDoKeycloak = 'ana@dipaula.com.br';
let verificado: boolean | undefined = true;
let ultimoToken: URLSearchParams | null = null;
let contaDeServicoOk = true;
const PESSOAS_KC = Array.from({ length: 250 }, (_, i) => ({ id: `kc-${i}`, username: `pessoa${i}`, firstName: `Pessoa`, lastName: `Número ${i}`, email: `pessoa${i}@dipaula.com.br`, enabled: i !== 3 }));

before(async () => {
  kc = createServer((req, resp) => {
    const fim = (status: number, corpo: unknown) => { resp.writeHead(status, { 'Content-Type': 'application/json' }); resp.end(JSON.stringify(corpo)); };
    if (req.url?.endsWith('/token') && req.method === 'POST') {
      let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
        ultimoToken = new URLSearchParams(b);
        if (ultimoToken.get('grant_type') === 'client_credentials') return contaDeServicoOk && ultimoToken.get('client_secret') === 'segredo-de-teste' ? fim(200, { access_token: 'tok-admin' }) : fim(401, { error: 'unauthorized_client' });
        if (ultimoToken.get('client_secret') !== 'segredo-de-teste' || ultimoToken.get('code') !== 'codigo-ok') return fim(400, { error: 'invalid_grant' });
        fim(200, { access_token: 'tok' });
      });
    } else if (req.url?.includes('/admin/realms/dipaula/users')) {
      if (req.headers.authorization !== 'Bearer tok-admin') return fim(403, {});
      const q = new URL(req.url, 'http://x').searchParams;
      const de = Number(q.get('first')), tam = Number(q.get('max'));
      fim(200, PESSOAS_KC.slice(de, de + tam));
    } else if (req.url?.endsWith('/userinfo')) {
      if (req.headers.authorization !== 'Bearer tok') return fim(401, {});
      fim(200, { email: emailDoKeycloak, email_verified: verificado, name: 'Ana Souza', preferred_username: 'ana.souza' });
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

test('quem é do realm e ainda não tem cadastro entra como consulta, sem senha local; repetido, não verificado e inativo seguem recusados', async () => {
  const { app, db } = await criarAppTeste();
  const total = () => (db.prepare('SELECT COUNT(*) n FROM usuarios').get() as { n: number }).n;
  const tentar = async () => (await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-ok&state=${(await iniciar(app)).state}` }));
  const antes = total();

  const nova = await tentar(); // ninguém com esse e-mail: é criado
  assert.equal(nova.headers.location, '/');
  assert.equal(total(), antes + 1);
  const criado = db.prepare("SELECT login, nome, perfil, ativo, trocar_senha, senha_hash FROM usuarios WHERE email = 'ana@dipaula.com.br'").get() as { login: string; nome: string; perfil: string; ativo: number; trocar_senha: number; senha_hash: string };
  assert.equal(criado.perfil, 'consulta'); assert.equal(criado.ativo, 1); assert.equal(criado.trocar_senha, 0);
  assert.equal(criado.login, 'ana.souza'); assert.equal(criado.nome, 'Ana Souza');
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'ana.souza', senha: 'qualquer-coisa-1' } });
  assert.equal(login.statusCode, 401, 'não há senha local utilizável');
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'usuario_criado_sso'").get());

  assert.equal((await tentar()).headers.location, '/', 'na volta seguinte entra no mesmo cadastro');
  assert.equal(total(), antes + 1);

  db.prepare("UPDATE usuarios SET perfil = 'editor' WHERE login = 'ana.souza'").run(); // o administrador promove depois
  await tentar();
  assert.equal((db.prepare("SELECT perfil FROM usuarios WHERE login = 'ana.souza'").get() as { perfil: string }).perfil, 'editor', 'o perfil dado à mão não é mexido');

  db.prepare("UPDATE usuarios SET email = ? WHERE login IN ('le', 'edita')").run('ana@dipaula.com.br');
  assert.equal((await tentar()).headers.location, '/login?sso=sem_conta'); // e-mail repetido: não adivinha quem é
  db.prepare("UPDATE usuarios SET email = NULL WHERE login IN ('le', 'edita')").run();
  verificado = false;
  assert.equal((await tentar()).headers.location, '/login?sso=sem_conta'); // e-mail não verificado
  verificado = true;
  db.prepare("UPDATE usuarios SET ativo = 0 WHERE login = 'ana.souza'").run();
  assert.equal((await tentar()).headers.location, '/login?sso=inativo');
});

test('KEYCLOAK_CRIAR_USUARIOS=0 volta a exigir cadastro prévio; login repetido ganha número', async () => {
  const { app, db } = await criarAppTeste();
  process.env.KEYCLOAK_CRIAR_USUARIOS = '0';
  try {
    const s1 = (await iniciar(app)).state;
    assert.equal((await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-ok&state=${s1}` })).headers.location, '/login?sso=sem_conta');
  } finally { delete process.env.KEYCLOAK_CRIAR_USUARIOS; }
  db.prepare("UPDATE usuarios SET login = 'ana.souza' WHERE login = 'le'").run();
  const s2 = (await iniciar(app)).state;
  await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-ok&state=${s2}` });
  assert.ok(db.prepare("SELECT 1 FROM usuarios WHERE login = 'ana.souza2' AND email = 'ana@dipaula.com.br'").get());
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

test('falha na troca do código fica na auditoria com o motivo do Keycloak (sem segredos)', async () => {
  const { app, db } = await criarAppTeste();
  const { state } = await iniciar(app);
  const r = await app.inject({ url: `/api/v1/admin/auth/callback?code=codigo-errado&state=${state}` });
  assert.equal(r.headers.location, '/login?sso=erro');
  const linha = db.prepare("SELECT detalhe FROM auditoria WHERE acao = 'sso_falhou' ORDER BY id DESC").get() as { detalhe: string };
  assert.match(linha.detalhe, /invalid_grant/);
  assert.match(linha.detalhe, /api\/v1\/admin\/auth\/callback/);
  assert.ok(!linha.detalhe.includes('segredo-de-teste'));
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


test('Configurações › Usuários › Sem cadastro: lista as pessoas do Keycloak (todas as páginas) que ainda não têm usuário no portal', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  // Duas já cadastradas: uma pelo e-mail (em maiúsculas) e outra pelo login.
  db.prepare("UPDATE usuarios SET email = ? WHERE login = 'le'").run('Pessoa10@DiPaula.com.br');
  db.prepare("UPDATE usuarios SET login = ? WHERE login = 'edita'").run('pessoa20');
  const r = await app.inject({ url: '/api/gestao/usuarios/keycloak?atualizar=1', headers: adm });
  assert.equal(r.statusCode, 200);
  const j = r.json<{ total: number; cadastrados: number; itens: { id: string; nome: string; login: string; email: string; ativo: boolean }[] }>();
  assert.equal(j.total, 250, 'leu as duas páginas');
  assert.equal(j.cadastrados, 2);
  assert.equal(j.itens.length, 248);
  assert.equal(j.itens.some((p) => p.login === 'pessoa10' || p.login === 'pessoa20'), false);
  assert.equal(j.itens.find((p) => p.login === 'pessoa3')?.ativo, false, 'mostra a situação no Keycloak');
  assert.equal(j.itens.find((p) => p.login === 'pessoa7')?.nome, 'Pessoa Número 7');
  // Só quem pode cadastrar usuários vê a lista.
  assert.equal((await app.inject({ url: '/api/gestao/usuarios/keycloak', headers: await entrar(app, 'le') })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/gestao/usuarios/keycloak' })).statusCode, 401);
});

test('cadastrar pessoa do Keycloak: sem senha local, entra pelo SSO e sai da lista de pendentes', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const cria = (extra: object) => app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'pessoa99', nome: 'Pessoa Número 99', perfil: 'consulta', sso: true, ...extra } });
  assert.equal((await cria({})).statusCode, 400, 'precisa do e-mail: é por ele que o SSO reconhece a pessoa');
  const ok = await cria({ email: 'pessoa99@dipaula.com.br' });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.json<{ trocar_senha: number }>().trocar_senha, 0, 'não pede troca de senha: não há senha local');
  const lista = (await app.inject({ url: '/api/gestao/usuarios/keycloak?atualizar=1', headers: adm })).json<{ itens: { login: string }[] }>();
  assert.equal(lista.itens.some((p) => p.login === 'pessoa99'), false);
  // Sem a senha vinda do formulário, ninguém consegue entrar por senha com esse login.
  assert.equal((await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'pessoa99', senha: '' } })).statusCode >= 400, true);
});

test('conta de serviço recusada pelo Keycloak devolve uma mensagem que diz o que a TI precisa fazer', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  contaDeServicoOk = false;
  try {
    const r = await app.inject({ url: '/api/gestao/usuarios/keycloak?atualizar=1', headers: adm });
    assert.equal(r.statusCode, 502);
    assert.match(r.json<{ erro: string }>().erro, /Service accounts.*view-users/s);
  } finally { contaDeServicoOk = true; }
});
