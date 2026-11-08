// O perfil "RH" já vem pronto (migração 025): cuida das abas de pessoas e do pulso, e nada além disso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';
import { hashSenha } from '../../acessos/api/senha.ts';

test('perfil RH: cadastra aniversariantes, novos e pulso; não publica comunicados nem mexe em configurações', async () => {
  const { app, db } = await criarAppTeste();
  db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, 0, ?)').run('rh', 'Pessoa do RH', hashSenha(SENHA), 'p-rh', new Date().toISOString());
  const rh = await entrar(app, 'rh');
  const eu = (await app.inject({ url: '/api/eu', headers: rh })).json<{ perfil_nome: string; permissoes: string[] }>();
  assert.equal(eu.perfil_nome, 'RH');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aniversariantes', headers: rh, payload: { nome: 'Ana Souza', area: 'Costura', dia: 5, mes: 3 } })).statusCode, 201);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/novos', headers: rh, payload: { nome: 'Bruno Lima', area: 'Corte', entrada: '2026-11-01' } })).statusCode, 201);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: rh, payload: { pergunta: 'Como foi a sua semana de trabalho?' } })).statusCode, 201);
  const sem = [
    app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: rh, payload: { titulo: 'Teste de aviso', resumo: 'x', categoria: 'RH' } }),
    app.inject({ url: '/api/usuarios', headers: rh }),
    app.inject({ url: '/api/perfis', headers: rh }),
  ];
  for (const r of await Promise.all(sem)) assert.equal(r.statusCode, 403);
  assert.ok((await app.inject({ url: '/api/gestao/comunicados', headers: rh })).statusCode === 403);
});
