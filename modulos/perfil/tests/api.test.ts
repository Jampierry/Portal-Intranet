import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';

test('Meu perfil: grava, formata telefones, valida emergência e só mostra o próprio', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le'), ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'GET', url: '/api/eu/perfil' })).statusCode, 401);
  const ok = await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { apelido: 'Lê', celular: '62999990000', emergencia1_nome: 'Maria', emergencia1_parent: 'Mãe', emergencia1_tel: '6233330000' } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().celular, '(62) 99999-0000');
  assert.equal(ok.json().emergencia1_tel, '(62) 3333-0000');
  assert.equal((await app.inject({ method: 'GET', url: '/api/eu/perfil', headers: ed })).json().celular, null); // outra pessoa não vê
  assert.equal((await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { emergencia1_nome: 'Maria' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/eu/perfil', headers: le, payload: { celular: '123' } })).statusCode, 400);
});

test('Trocar e-mail exige a senha atual e e-mail válido', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  const put = (payload: object) => app.inject({ method: 'PUT', url: '/api/eu/email', headers: le, payload });
  assert.equal((await put({ email: 'novo@exemplo.invalid', senha: 'errada-errada' })).statusCode, 400);
  assert.equal((await put({ email: 'invalido', senha: SENHA })).statusCode, 400);
  assert.equal((await put({ email: 'Novo@Exemplo.invalid', senha: SENHA })).json().email, 'novo@exemplo.invalid');
  assert.equal((await app.inject({ method: 'GET', url: '/api/eu/perfil', headers: le })).json().email, 'novo@exemplo.invalid');
});
