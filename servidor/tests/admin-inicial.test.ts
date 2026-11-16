import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, migrar } from '../src/db.ts';
import { config } from '../src/config.ts';
import { criarAdminInicial } from '../src/admin-inicial.ts';

function banco() { const db = abrirBanco(':memory:'); migrar(db, config.pastaMigracoes); return db; }

test('admin inicial: cria só com banco sem usuários e variáveis válidas', () => {
  const db = banco();
  assert.equal(criarAdminInicial(db, {}), null);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'curta' }), null);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Prov1sorio!Teste', ADMIN_NOME: 'Master' }), 'master');
  const u = db.prepare('SELECT perfil, trocar_senha FROM usuarios WHERE login = ?').get('master') as { perfil: string; trocar_senha: number };
  assert.equal(u.perfil, 'admin'); assert.equal(u.trocar_senha, 1);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'outro', ADMIN_SENHA: 'Prov1sorio!Teste' }), null);
});

test('admin inicial: ADMIN_REDEFINIR=1 troca a senha de quem já existe e derruba as sessões', () => {
  const db = banco();
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Prov1sorio!Teste' }), 'master');
  const antes = (db.prepare('SELECT senha_hash FROM usuarios WHERE login = ?').get('master') as { senha_hash: string }).senha_hash;
  db.prepare('UPDATE usuarios SET trocar_senha = 0, perfil = ?, ativo = 0 WHERE login = ?').run('consulta', 'master');
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Outr@Forte-2026' }), null);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Outr@Forte-2026', ADMIN_REDEFINIR: '1' }), 'master');
  const u = db.prepare('SELECT senha_hash, perfil, ativo, trocar_senha FROM usuarios WHERE login = ?').get('master') as { senha_hash: string; perfil: string; ativo: number; trocar_senha: number };
  assert.notEqual(u.senha_hash, antes); assert.equal(u.perfil, 'admin'); assert.equal(u.ativo, 1); assert.equal(u.trocar_senha, 1);
});

test('admin inicial: ADMIN_EMAIL grava o e-mail (para o SSO) na criação e na redefinição; e-mail inválido não faz nada', () => {
  const db = banco();
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Prov1sorio!Teste', ADMIN_EMAIL: 'sem-arroba' }), null);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Prov1sorio!Teste', ADMIN_EMAIL: 'Master@DiPaula.com.br' }), 'master');
  const email = () => (db.prepare('SELECT email FROM usuarios WHERE login = ?').get('master') as { email: string | null }).email;
  assert.equal(email(), 'master@dipaula.com.br');
  db.prepare('UPDATE usuarios SET email = NULL WHERE login = ?').run('master');
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'Outr@Forte-2026', ADMIN_REDEFINIR: '1', ADMIN_EMAIL: 'master@dipaula.com.br' }), 'master');
  assert.equal(email(), 'master@dipaula.com.br');
});

test('admin inicial: senha óbvia (admin123, com ou sem sinais em volta) é recusada', () => {
  const db = banco();
  const log = console.error; console.error = () => {};
  try {
    assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'admin123' }), null);
    assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: '<admin123>' }), null);
  } finally { console.error = log; }
  assert.equal((db.prepare('SELECT COUNT(*) n FROM usuarios').get() as { n: number }).n, 0);
});
