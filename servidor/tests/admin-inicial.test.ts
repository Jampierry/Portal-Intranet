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
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'senha-provisoria-1', ADMIN_NOME: 'Master' }), 'master');
  const u = db.prepare('SELECT perfil, trocar_senha FROM usuarios WHERE login = ?').get('master') as { perfil: string; trocar_senha: number };
  assert.equal(u.perfil, 'admin'); assert.equal(u.trocar_senha, 1);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'outro', ADMIN_SENHA: 'senha-provisoria-1' }), null);
});

test('admin inicial: ADMIN_REDEFINIR=1 troca a senha de quem já existe e derruba as sessões', () => {
  const db = banco();
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'senha-provisoria-1' }), 'master');
  const antes = (db.prepare('SELECT senha_hash FROM usuarios WHERE login = ?').get('master') as { senha_hash: string }).senha_hash;
  db.prepare('UPDATE usuarios SET trocar_senha = 0, perfil = ?, ativo = 0 WHERE login = ?').run('consulta', 'master');
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'outra-senha-forte-2' }), null);
  assert.equal(criarAdminInicial(db, { ADMIN_LOGIN: 'master', ADMIN_SENHA: 'outra-senha-forte-2', ADMIN_REDEFINIR: '1' }), 'master');
  const u = db.prepare('SELECT senha_hash, perfil, ativo, trocar_senha FROM usuarios WHERE login = ?').get('master') as { senha_hash: string; perfil: string; ativo: number; trocar_senha: number };
  assert.notEqual(u.senha_hash, antes); assert.equal(u.perfil, 'admin'); assert.equal(u.ativo, 1); assert.equal(u.trocar_senha, 1);
});
