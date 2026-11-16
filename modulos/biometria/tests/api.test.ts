// Biometria (passkeys): cadastro e entrada de ponta a ponta com um autenticador de mentira, "manter conectado" e as recusas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { AutenticadorFalso } from './autenticador-falso.ts';

const ORIGEM = 'http://localhost:5174';
const H = { origin: ORIGEM };
type App = Awaited<ReturnType<typeof criarAppTeste>>['app'];

async function cadastrar(app: App, cab: Record<string, string>, aut: AutenticadorFalso, nome = 'Meu celular') {
  const op = (await app.inject({ method: 'POST', url: '/api/biometria/registro/opcoes', headers: { ...cab, ...H }, payload: {} })).json<{ opcoes: { challenge: string }; desafio_id: string }>();
  return app.inject({ method: 'POST', url: '/api/biometria/registro', headers: { ...cab, ...H }, payload: { desafio_id: op.desafio_id, resposta: aut.cadastro(op.opcoes.challenge), nome } });
}
async function entrarComBiometria(app: App, aut: AutenticadorFalso, extra: object = {}, opcoes: { verificado?: boolean } = {}) {
  const op = (await app.inject({ method: 'POST', url: '/api/biometria/entrar/opcoes', headers: H, payload: {} })).json<{ opcoes: { challenge: string }; desafio_id: string }>();
  return app.inject({ method: 'POST', url: '/api/biometria/entrar', headers: H, payload: { desafio_id: op.desafio_id, resposta: aut.entrada(op.opcoes.challenge, opcoes), ...extra } });
}

test('cadastra a biometria, entra sem senha e a sessão funciona; replay e desafio reaproveitado são recusados', async () => {
  const { app, db } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const aut = new AutenticadorFalso('localhost', ORIGEM);
  const cad = await cadastrar(app, le, aut);
  assert.equal(cad.statusCode, 201, cad.body);
  const lista = (await app.inject({ url: '/api/biometria', headers: le })).json<{ nome: string }[]>();
  assert.deepEqual(lista.map((p) => p.nome), ['Meu celular']);
  assert.ok(!JSON.stringify(lista).includes('chave'), 'a lista não devolve chave nenhuma');

  const r = await entrarComBiometria(app, aut);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json<{ login: string }>().login, 'le');
  const cookie = r.cookies.find((c) => c.name === 'portal_sessao')!;
  assert.equal((await app.inject({ url: '/api/eu', headers: { cookie: `portal_sessao=${cookie.value}` } })).json<{ login: string }>().login, 'le');
  assert.equal((db.prepare("SELECT COUNT(*) n FROM auditoria WHERE acao = 'login_biometria'").get() as { n: number }).n, 1);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM uso_eventos WHERE tipo = 'login'").get() as { n: number }).n >= 1, true);

  // o mesmo desafio não vale duas vezes
  const op = (await app.inject({ method: 'POST', url: '/api/biometria/entrar/opcoes', headers: H, payload: {} })).json<{ opcoes: { challenge: string }; desafio_id: string }>();
  const resp = aut.entrada(op.opcoes.challenge);
  assert.equal((await app.inject({ method: 'POST', url: '/api/biometria/entrar', headers: H, payload: { desafio_id: op.desafio_id, resposta: resp } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/biometria/entrar', headers: H, payload: { desafio_id: op.desafio_id, resposta: resp } })).statusCode, 400);
});

test('"manter conectado" dura 30 dias; sem marcar, 12 horas', async () => {
  const { app, db } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const aut = new AutenticadorFalso('localhost', ORIGEM);
  await cadastrar(app, le, aut);
  const horas = (cookie: { maxAge?: number } | undefined) => Math.round((cookie?.maxAge ?? 0) / 3600);

  const curta = await entrarComBiometria(app, aut);
  assert.equal(horas(curta.cookies.find((c) => c.name === 'portal_sessao')), 12);
  const longa = await entrarComBiometria(app, aut, { manter: true });
  assert.equal(horas(longa.cookies.find((c) => c.name === 'portal_sessao')), 30 * 24);
  const ult = db.prepare('SELECT manter, criada_em, expira_em FROM sessoes ORDER BY criada_em DESC LIMIT 1').get() as { manter: number; criada_em: string; expira_em: string };
  assert.equal(ult.manter, 1);
  assert.equal(Math.round((Date.parse(ult.expira_em) - Date.parse(ult.criada_em)) / 86_400_000), 30);

  // login por senha também respeita a opção
  const s = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: 'senha-de-teste-1', manter: true } });
  assert.equal(horas(s.cookies.find((c) => c.name === 'portal_sessao')), 30 * 24);
  const s2 = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: 'senha-de-teste-1' } });
  assert.equal(horas(s2.cookies.find((c) => c.name === 'portal_sessao')), 12);
});

test('trocar a senha mantém o "manter conectado" da sessão', async () => {
  const { app, db } = await criarAppTeste();
  const l = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: 'senha-de-teste-1', manter: true } });
  const cab = { cookie: `portal_sessao=${l.cookies.find((c) => c.name === 'portal_sessao')!.value}` };
  const t = await app.inject({ method: 'POST', url: '/api/eu/senha', headers: cab, payload: { atual: 'senha-de-teste-1', nova: 'Outra-senha-forte-9!' } });
  assert.equal(t.statusCode, 200, t.body);
  assert.equal(Math.round((t.cookies.find((c) => c.name === 'portal_sessao')?.maxAge ?? 0) / 3600), 30 * 24);
  assert.equal((db.prepare('SELECT manter FROM sessoes').get() as { manter: number }).manter, 1);
});

test('recusas: sem verificação do usuário, credencial removida, pessoa desativada, endereço por IP e sem login', async () => {
  const { app, db } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const aut = new AutenticadorFalso('localhost', ORIGEM);
  const id = (await cadastrar(app, le, aut)).json<{ id: number }>().id;

  assert.equal((await entrarComBiometria(app, aut, {}, { verificado: false })).statusCode, 400, 'sem digital/rosto (UV) não entra');
  // outra pessoa não remove a biometria alheia
  const ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/biometria/${id}`, headers: ed })).statusCode, 404);
  // desativada: não entra
  db.prepare("UPDATE usuarios SET ativo = 0 WHERE login = 'le'").run();
  assert.equal((await entrarComBiometria(app, aut)).statusCode, 400);
  db.prepare("UPDATE usuarios SET ativo = 1 WHERE login = 'le'").run();
  // removida: não entra
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/biometria/${id}`, headers: le })).statusCode, 200);
  assert.equal((await entrarComBiometria(app, aut)).statusCode, 400);

  // WebAuthn não aceita IP como endereço do portal
  const ip = await app.inject({ method: 'POST', url: '/api/biometria/entrar/opcoes', headers: { origin: 'http://192.168.2.204:5174', host: '192.168.2.204:5174' }, payload: {} });
  assert.equal(ip.statusCode, 400);
  assert.match(ip.json<{ erro: string }>().erro, /endereço com nome/);
  // cadastrar exige login
  assert.equal((await app.inject({ method: 'POST', url: '/api/biometria/registro/opcoes', headers: H, payload: {} })).statusCode, 401);
  // entrar com lixo
  const op = (await app.inject({ method: 'POST', url: '/api/biometria/entrar/opcoes', headers: H, payload: {} })).json<{ desafio_id: string }>();
  assert.equal((await app.inject({ method: 'POST', url: '/api/biometria/entrar', headers: H, payload: { desafio_id: op.desafio_id, resposta: { id: 'nao-existe' } } })).statusCode, 400);
});

test('no máximo 5 biometrias por pessoa', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  for (let i = 0; i < 5; i++) assert.equal((await cadastrar(app, le, new AutenticadorFalso('localhost', ORIGEM), `Aparelho ${i}`)).statusCode, 201);
  const op = await app.inject({ method: 'POST', url: '/api/biometria/registro/opcoes', headers: { ...le, ...H }, payload: {} });
  assert.equal(op.statusCode, 400);
});
