import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from './ajuda.ts';

test('sem login, a API exige sessão (só saúde e login são públicos)', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject('/api/saude')).statusCode, 200);
  for (const url of ['/api/comunicados', '/api/documentos', '/api/aplicacoes', '/api/destaques', '/api/eu', '/api/usuarios', '/api/favoritos']) {
    assert.equal((await app.inject(url)).statusCode, 401, url);
  }
});

test('login correto abre sessão; /api/eu devolve o usuário sem dados sensíveis', async () => {
  const { app } = await criarAppTeste();
  const h = await entrar(app, 'MASTER'); // login não diferencia maiúsculas
  const r = await app.inject({ url: '/api/eu', headers: h });
  assert.equal(r.statusCode, 200);
  const eu = r.json() as Record<string, unknown>;
  assert.equal(eu.login, 'master');
  assert.equal(eu.perfil, 'admin');
  assert.equal('senha_hash' in eu, false);
});

test('login errado dá 401 com mensagem genérica (não revela se o login existe)', async () => {
  const { app } = await criarAppTeste();
  const a = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'master', senha: 'errada-errada' } });
  const b = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'nao-existe', senha: 'errada-errada' } });
  assert.equal(a.statusCode, 401);
  assert.equal(b.statusCode, 401);
  assert.equal(a.body, b.body);
});

test('bloqueia depois de 5 falhas, mesmo com a senha certa', async () => {
  const { app } = await criarAppTeste();
  for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: 'errada-errada' } });
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: SENHA } });
  assert.equal(r.statusCode, 429);
});

test('sair encerra a sessão', async () => {
  const { app } = await criarAppTeste();
  const h = await entrar(app, 'le');
  await app.inject({ method: 'POST', url: '/api/sair', headers: h });
  assert.equal((await app.inject({ url: '/api/eu', headers: h })).statusCode, 401);
});

test('requisição que muda dados de outra origem é recusada', async () => {
  const { app } = await criarAppTeste();
  const h = await entrar(app, 'master');
  const r = await app.inject({ method: 'POST', url: '/api/usuarios', headers: { ...h, origin: 'http://site-malicioso.example', host: 'localhost:5174' }, payload: {} });
  assert.equal(r.statusCode, 403);
});

test('só o admin gerencia usuários; editor e consulta recebem 403', async () => {
  const { app } = await criarAppTeste();
  for (const login of ['edita', 'le']) {
    const h = await entrar(app, login);
    assert.equal((await app.inject({ url: '/api/usuarios', headers: h })).statusCode, 403, login);
    assert.equal((await app.inject({ url: '/api/auditoria', headers: h })).statusCode, 403, login);
  }
  assert.equal((await app.inject({ url: '/api/usuarios', headers: await entrar(app, 'master') })).statusCode, 200);
});

test('admin cria usuário com senha provisória; ele precisa trocar antes de usar o portal', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const c = await app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: 'Maria.Silva', nome: 'Maria Silva', perfil: 'editor', senha: 'provisoria-77' } });
  assert.equal(c.statusCode, 201);
  assert.equal((c.json() as { login: string }).login, 'maria.silva');
  assert.equal('senha_hash' in (c.json() as object), false);

  const h = await entrar(app, 'maria.silva', 'provisoria-77');
  const bloqueado = await app.inject({ url: '/api/comunicados', headers: h });
  assert.equal(bloqueado.statusCode, 403);
  assert.equal((bloqueado.json() as { codigo: string }).codigo, 'trocar_senha');

  const troca = await app.inject({ method: 'POST', url: '/api/eu/senha', headers: h, payload: { atual: 'provisoria-77', nova: 'minha-senha-nova-1' } });
  assert.equal(troca.statusCode, 200);
  const novoCookie = troca.cookies.find((x) => x.name === 'portal_sessao')!;
  const liberado = await app.inject({ url: '/api/comunicados', headers: { cookie: `portal_sessao=${novoCookie.value}` } });
  assert.equal(liberado.statusCode, 200);
});

test('validação de usuário: login repetido, senha curta e perfil inválido', async () => {
  const { app } = await criarAppTeste();
  const h = await entrar(app, 'master');
  const novo = (p: object) => app.inject({ method: 'POST', url: '/api/usuarios', headers: h, payload: { login: 'novo.user', nome: 'Novo', perfil: 'consulta', senha: 'senha-boa-123', ...p } });
  assert.equal((await novo({ login: 'master' })).statusCode, 409);
  assert.equal((await novo({ senha: 'curta' })).statusCode, 400);
  assert.equal((await novo({ perfil: 'dono-do-mundo' })).statusCode, 400);
  assert.equal((await novo({ login: 'tem espaço' })).statusCode, 400);
  assert.equal((await novo({})).statusCode, 201);
});

test('não deixa o sistema sem administrador nem o admin se rebaixar', async () => {
  const { app } = await criarAppTeste();
  const h = await entrar(app, 'master');
  const id = (await app.inject({ url: '/api/usuarios', headers: h })).json<{ id: number; login: string }[]>().find((u) => u.login === 'master')!.id;
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${id}`, headers: h, payload: { perfil: 'consulta' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${id}`, headers: h, payload: { ativo: false } })).statusCode, 400);
});

test('usuário desativado perde a sessão na hora e não consegue entrar', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const hLe = await entrar(app, 'le');
  const id = (await app.inject({ url: '/api/usuarios', headers: adm })).json<{ id: number; login: string }[]>().find((u) => u.login === 'le')!.id;
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${id}`, headers: adm, payload: { ativo: false } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/eu', headers: hLe })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'le', senha: SENHA } })).statusCode, 401);
});

test('auditoria registra login, criação de usuário e nunca guarda senha', async () => {
  const { app, db } = await criarAppTeste();
  const h = await entrar(app, 'master');
  await app.inject({ method: 'POST', url: '/api/usuarios', headers: h, payload: { login: 'aud.teste', nome: 'Aud Teste', perfil: 'consulta', senha: 'senha-secreta-99' } });
  const linhas = (await app.inject({ url: '/api/auditoria', headers: h })).json<{ acao: string; detalhe: string | null }[]>();
  assert.ok(linhas.some((l) => l.acao === 'login'));
  assert.ok(linhas.some((l) => l.acao === 'usuario_criado'));
  assert.equal(JSON.stringify(linhas).includes('senha-secreta-99'), false);
  assert.throws(() => db.prepare('DELETE FROM auditoria').run(), /somente inclusão/);
});

test('o site do portal (origem permitida, mesmo atrás do proxy) consegue entrar', async () => {
  const { app } = await criarAppTeste();
  const r = await app.inject({ method: 'POST', url: '/api/login', headers: { origin: 'http://localhost:5174', host: '127.0.0.1:3100' }, payload: { login: 'le', senha: SENHA } });
  assert.equal(r.statusCode, 200);
});

test('bloqueio é por login+IP: outro IP não é travado pelo atacante, mas o IP que varre muitos logins é barrado', async () => {
  const { app } = await criarAppTeste();
  const tentar = (login: string, senha: string, ip: string) => app.inject({ method: 'POST', url: '/api/login', remoteAddress: ip, payload: { login, senha } });
  for (let i = 0; i < 5; i++) await tentar('le', 'errada-errada', '10.0.0.1'); // atacante trava só o par le+10.0.0.1
  assert.equal((await tentar('le', SENHA, '10.0.0.1')).statusCode, 429);
  assert.equal((await tentar('le', SENHA, '10.0.0.2')).statusCode, 200); // a pessoa de verdade entra do outro IP
  for (let i = 0; i < 20; i++) await tentar(`fulano${i}`, 'errada-errada', '10.0.0.9'); // varredura de logins
  assert.equal((await tentar('master', SENHA, '10.0.0.9')).statusCode, 429);
});

test('política de senha: recusa senha comum, sem variedade ou só letras; aceita senha boa', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const criar = (senha: string, n: number) => app.inject({ method: 'POST', url: '/api/usuarios', headers: adm, payload: { login: `novo${n}`, nome: 'Novo Usuário', perfil: 'consulta', senha } });
  assert.equal((await criar('Senha@123'.slice(0, 7), 0)).statusCode, 400); // curta
  assert.equal((await criar('password1', 1)).statusCode, 400); // comum
  assert.equal((await criar('Admin-123', 2)).statusCode, 400); // comum ignorando pontuação e caixa
  assert.equal((await criar('somenteletras', 3)).statusCode, 400); // sem número nem símbolo
  assert.equal((await criar('abababab1', 4)).statusCode, 400); // pouca variedade
  assert.equal((await criar('cafe-com-leite-7', 5)).statusCode, 201);
});

test('armazenamento: só quem vê a auditoria consulta o tamanho do banco', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/gestao/armazenamento', headers: await entrar(app, 'le') })).statusCode, 403);
  const r = await app.inject({ url: '/api/gestao/armazenamento', headers: await entrar(app, 'master') });
  assert.equal(r.statusCode, 200);
  assert.ok(r.json<{ banco_bytes: number }>().banco_bytes > 0);
});
