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
