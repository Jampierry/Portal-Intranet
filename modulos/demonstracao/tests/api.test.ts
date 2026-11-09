// Dados de exemplo: só o administrador liga/desliga; tudo (imagens inclusive) vai para o banco; desligar volta ao que havia antes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { ativarExemplo, desativarExemplo, estadoExemplo } from '../api/pacote.ts';

const contar = (db: { prepare: (s: string) => { get: () => unknown } }, t: string) => (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;

test('só o administrador vê e muda os dados de exemplo', async () => {
  const { app } = await criarAppTeste();
  for (const login of ['edita', 'le']) {
    const h = await entrar(app, login);
    assert.equal((await app.inject({ url: '/api/gestao/demonstracao', headers: h })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/demonstracao', headers: h, payload: { ativo: true } })).statusCode, 403);
  }
  const adm = await entrar(app, 'master');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/demonstracao', headers: adm, payload: { ativo: 'sim' } })).statusCode, 400);
  const lig = await app.inject({ method: 'POST', url: '/api/gestao/demonstracao', headers: adm, payload: { ativo: true } });
  assert.equal(lig.statusCode, 200);
  assert.equal(lig.json().ativo, true);
  const emp = (await app.inject({ url: '/api/empresa' })).json();
  assert.equal(emp.nome, 'Aurora Esportes');
  // A logo e o ícone da empresa vêm do banco e são públicos (aparecem antes do login).
  for (const u of [emp.logo, emp.logo_nome, emp.logo_nome_escuro]) {
    const r = await app.inject({ url: u });
    assert.equal(r.statusCode, 200, u);
    assert.equal(r.headers['content-type'], 'image/svg+xml');
  }
  const des = await app.inject({ method: 'POST', url: '/api/gestao/demonstracao', headers: adm, payload: { ativo: false } });
  assert.equal(des.json().ativo, false);
  assert.equal((await app.inject({ url: '/api/empresa' })).json().nome, 'Sua Empresa');
});

test('ligar cria tudo no banco, ligar de novo não duplica e desligar apaga só o do exemplo', async () => {
  const { db } = await criarAppTeste();
  const agoraIso = new Date().toISOString();
  db.prepare("INSERT INTO comunicados (slug, titulo, resumo, categoria, status, criado_em) VALUES ('real-1', 'Comunicado real', 'r', 'Pessoas', 'publicado', ?)").run(agoraIso);
  db.prepare("INSERT INTO portal_config (chave, valor) VALUES ('empresa', '{\"nome\":\"Empresa Real\",\"nome_portal\":\"Meu Portal\"}')").run();

  const e1 = ativarExemplo(db);
  assert.equal(e1.ativo, true);
  const totais = ['comunicados', 'documentos', 'aplicacoes', 'banners', 'destaques', 'contatos', 'aniversariantes', 'novos_colaboradores', 'calendario_datas', 'pulsos', 'usuarios', 'imagens_arquivo'].map((t) => [t, contar(db, t)] as const);
  for (const [t, n] of totais) assert.ok(n > 0, t);
  // Toda capa de comunicado aponta para uma imagem que existe no banco.
  for (const r of db.prepare('SELECT imagem FROM comunicados WHERE imagem IS NOT NULL').all() as { imagem: string }[]) {
    assert.ok(db.prepare('SELECT 1 FROM imagens_arquivo WHERE nome = ?').get(r.imagem.split('/').pop()!), r.imagem);
  }

  ativarExemplo(db);
  for (const [t, n] of totais) assert.equal(contar(db, t), n, `${t} duplicou`);

  desativarExemplo(db);
  assert.equal(estadoExemplo(db).ativo, false);
  assert.equal(contar(db, 'comunicados'), 1);
  assert.equal(contar(db, 'imagens_arquivo'), 0);
  assert.equal(contar(db, 'banners'), 0);
  assert.equal(contar(db, 'usuarios'), 3); // só os 3 do teste
  assert.match((db.prepare("SELECT valor FROM portal_config WHERE chave = 'empresa'").get() as { valor: string }).valor, /Empresa Real/);
});

test('desligar não desfaz a empresa se o administrador a editou depois de ligar', async () => {
  const { db } = await criarAppTeste();
  ativarExemplo(db);
  db.prepare("UPDATE portal_config SET valor = '{\"nome\":\"Editada\",\"nome_portal\":\"X\"}' WHERE chave = 'empresa'").run();
  desativarExemplo(db);
  assert.match((db.prepare("SELECT valor FROM portal_config WHERE chave = 'empresa'").get() as { valor: string }).valor, /Editada/);
});

test('em produção os usuários de exemplo não têm senha conhecida', async () => {
  const { db, app } = await criarAppTeste();
  ativarExemplo(db, { producao: true });
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'ana.demo', senha: 'demo12345' } });
  assert.notEqual(r.statusCode, 200);
});
