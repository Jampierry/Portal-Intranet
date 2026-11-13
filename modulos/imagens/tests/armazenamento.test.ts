// Mídia no disco: o banco guarda só nome e tipo; o conteúdo vai para a pasta de mídia. Conteúdo antigo (dentro do banco) é movido na subida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { guardarImagem, lerImagem } from '../api/index.ts';
import { limparAnexosOrfaos, moverMidiaDoBanco, pastaMidia } from '../api/armazenamento.ts';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 3)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(200, 7)]);

test('imagem nova: arquivo no disco, coluna dados vazia no banco, leitura devolve o mesmo conteúdo', async () => {
  const { db } = await criarAppTeste();
  const salvo = guardarImagem(db, PNG)!;
  assert.ok(existsSync(join(pastaMidia(db), 'imagens', salvo.nome)));
  assert.equal((db.prepare('SELECT length(dados) AS n FROM imagens_arquivo WHERE nome = ?').get(salvo.nome) as { n: number }).n, 0);
  assert.deepEqual(lerImagem(db, salvo.nome)!.dados, PNG);
});

test('vídeo novo: arquivo no disco e entrega por trechos lendo do disco', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: MP4 });
  const { url } = r.json<{ url: string }>();
  const nome = url.split('/').pop()!;
  assert.ok(existsSync(join(pastaMidia(db), 'videos', nome)));
  assert.equal((db.prepare('SELECT length(dados) AS n FROM videos_arquivo WHERE nome = ?').get(nome) as { n: number }).n, 0);
  const parte = await app.inject({ url, headers: { ...ed, range: 'bytes=4-11' } });
  assert.equal(parte.statusCode, 206);
  assert.deepEqual(parte.rawPayload, MP4.subarray(4, 12));
  assert.deepEqual((await app.inject({ url, headers: ed })).rawPayload, MP4);
});

test('conteúdo antigo dentro do banco continua servindo e é movido para o disco sem perder nada (e repetir não faz mal)', async () => {
  const { app, db } = await criarAppTeste();
  const nomeImg = 'a'.repeat(24) + '.png', nomeVid = 'b'.repeat(24) + '.mp4';
  db.prepare('INSERT INTO imagens_arquivo (nome, tipo, dados, criado_em) VALUES (?, ?, ?, ?)').run(nomeImg, 'image/png', PNG, 'x');
  db.prepare('INSERT INTO videos_arquivo (nome, tipo, dados, criado_em) VALUES (?, ?, ?, ?)').run(nomeVid, 'video/mp4', MP4, 'x');
  const ed = await entrar(app, 'edita');
  assert.deepEqual((await app.inject({ url: `/api/imagens/${nomeImg}`, headers: ed })).rawPayload, PNG); // antes de mover
  assert.deepEqual((await app.inject({ url: `/api/videos/${nomeVid}`, headers: { ...ed, range: 'bytes=0-9' } })).rawPayload, MP4.subarray(0, 10));
  assert.equal(moverMidiaDoBanco(db), 2);
  assert.equal(moverMidiaDoBanco(db), 0);
  assert.equal((db.prepare('SELECT length(dados) AS n FROM imagens_arquivo WHERE nome = ?').get(nomeImg) as { n: number }).n, 0);
  assert.deepEqual((await app.inject({ url: `/api/imagens/${nomeImg}`, headers: ed })).rawPayload, PNG); // depois de mover
  assert.deepEqual((await app.inject({ url: `/api/videos/${nomeVid}`, headers: ed })).rawPayload, MP4);
});

test('anexo de rede social: vai para o disco, abre igual, conteúdo antigo é movido e o arquivo some junto com a linha', async () => {
  const { app, db } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 5)]);
  const r = await app.inject({ method: 'POST', url: '/api/gestao/redes/anexos?nome=cartaz.pdf', headers: { ...ed, 'content-type': 'application/octet-stream' }, payload: PDF });
  assert.equal(r.statusCode, 201);
  const { id } = r.json<{ id: number }>();
  const arq = join(pastaMidia(db), 'anexos', `${id}.pdf`);
  assert.ok(existsSync(arq));
  assert.equal((db.prepare('SELECT length(dados) AS n FROM publicacoes_anexos WHERE id = ?').get(id) as { n: number }).n, 0);
  const aberto = await app.inject({ url: `/api/redes/anexos/${id}`, headers: ed });
  assert.equal(aberto.statusCode, 200);
  assert.deepEqual(aberto.rawPayload, PDF);

  // Anexo antigo, ainda dentro do banco: serve e depois é movido.
  const antigo = Number(db.prepare("INSERT INTO publicacoes_anexos (nome, tipo, tamanho, dados, criado_por, criado_em) VALUES ('velho.pdf', 'pdf', ?, ?, 2, 'x')").run(PDF.length, PDF).lastInsertRowid);
  assert.equal((await app.inject({ url: `/api/redes/anexos/${antigo}`, headers: ed })).rawPayload.equals(PDF), true);
  assert.equal(moverMidiaDoBanco(db), 1);
  assert.ok(existsSync(join(pastaMidia(db), 'anexos', `${antigo}.pdf`)));
  assert.equal((await app.inject({ url: `/api/redes/anexos/${antigo}`, headers: ed })).rawPayload.equals(PDF), true);

  // Linha apagada: o arquivo órfão é varrido.
  db.prepare('DELETE FROM publicacoes_anexos WHERE id = ?').run(antigo);
  assert.equal(limparAnexosOrfaos(db), 1);
  assert.equal(existsSync(join(pastaMidia(db), 'anexos', `${antigo}.pdf`)), false);
  assert.ok(existsSync(arq));
});
