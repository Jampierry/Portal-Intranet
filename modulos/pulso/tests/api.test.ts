// Pesquisa de pulso: uma resposta por pessoa, anonimato (a resposta não guarda quem respondeu) e resultado só com o mínimo de respostas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar, SENHA } from '../../acessos/tests/ajuda.ts';
import { hashSenha } from '../../acessos/api/senha.ts';
import { MINIMO_RESPOSTAS } from '../api/index.ts';

const pergunta = (p: object = {}) => ({ pergunta: 'Como você se sentiu no trabalho esta semana?', status: 'aberto', ...p });

test('só uma pesquisa aberta por vez; cada pessoa responde uma vez; a resposta não guarda quem respondeu', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  assert.deepEqual((await app.inject({ url: '/api/pulso', headers: le })).json(), { aberto: false });
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: le, payload: pergunta() })).statusCode, 403);

  const a = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta() })).json<{ id: number }>();
  const b = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta({ pergunta: 'Você recomendaria a empresa como lugar para trabalhar?' }) })).json<{ id: number }>();
  const abertas = db.prepare("SELECT id FROM pulsos WHERE status = 'aberto'").all() as { id: number }[];
  assert.deepEqual(abertas.map((x) => x.id), [b.id]); // abrir a segunda encerrou a primeira
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${a.id}/responder`, headers: le, payload: { nota: 4 } })).statusCode, 404);

  const atual = (await app.inject({ url: '/api/pulso', headers: le })).json<{ aberto: boolean; id: number; respondeu: boolean }>();
  assert.deepEqual([atual.aberto, atual.id, atual.respondeu], [true, b.id, false]);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${b.id}/responder`, headers: le, payload: { nota: 9 } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${b.id}/responder`, headers: le, payload: { nota: 4, comentario: 'Tudo bem.' } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${b.id}/responder`, headers: le, payload: { nota: 5 } })).statusCode, 409);
  assert.equal((await app.inject({ url: '/api/pulso', headers: le })).json<{ respondeu: boolean }>().respondeu, true);
  assert.equal((await app.inject({ url: '/api/pulso', headers: ed })).json<{ respondeu: boolean }>().respondeu, false);

  // anonimato: nenhuma coluna da resposta liga a pessoa
  const colunas = (db.prepare('PRAGMA table_info(pulso_respostas)').all() as { name: string }[]).map((c) => c.name);
  assert.deepEqual(colunas, ['id', 'pulso_id', 'nota', 'comentario', 'dia']);
});

test('resultado só com o mínimo de respostas; mostra média, distribuição e comentários sem identificar ninguém; pergunta não muda depois de respondida', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const hash = hashSenha(SENHA);
  const { id } = (await app.inject({ method: 'POST', url: '/api/gestao/pulso', headers: ed, payload: pergunta() })).json<{ id: number }>();
  const notas = [5, 4, 4, 3, 2];
  const comentarios = ['Equipe unida.', '', 'Muito trabalho.', '', 'Falta material.'];
  for (let i = 0; i < notas.length; i++) {
    db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, 0, ?)').run(`pessoa${i}`, `Pessoa ${i}`, hash, 'consulta', new Date().toISOString());
    const h = await entrar(app, `pessoa${i}`);
    const antes = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: ed })).json<{ liberado: boolean; respostas: number; minimo: number }>();
    assert.equal(antes.liberado, false);
    assert.equal(antes.respostas, i);
    assert.equal(antes.minimo, MINIMO_RESPOSTAS);
    assert.equal((await app.inject({ method: 'POST', url: `/api/pulso/${id}/responder`, headers: h, payload: { nota: notas[i], comentario: comentarios[i] } })).statusCode, 200);
  }
  const r = (await app.inject({ url: `/api/gestao/pulso/${id}/resultado`, headers: ed })).json<{ liberado: boolean; media: number; distribuicao: number[]; comentarios: string[] }>();
  assert.equal(r.liberado, true);
  assert.equal(r.media, 3.6);
  assert.deepEqual(r.distribuicao, [0, 1, 1, 2, 1]);
  assert.deepEqual(r.comentarios, ['Equipe unida.', 'Falta material.', 'Muito trabalho.']); // ordem alfabética, sem datas nem nomes
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}`, headers: ed, payload: pergunta({ pergunta: 'Outra pergunta qualquer aqui' }) })).statusCode, 409);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/gestao/pulso/${id}`, headers: ed, payload: pergunta({ status: 'encerrado' }) })).json<{ status: string }>().status, 'encerrado');
  assert.deepEqual((await app.inject({ url: '/api/pulso', headers: ed })).json(), { aberto: false });
});
