// Vídeos curtos (MP4/WebM) dos banners e da tela de entrada: conferem o conteúdo, só quem edita envia, entrega por trechos (Range).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(200, 7)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 9)]);
const json = { 'content-type': 'application/json' };

test('editor envia MP4, leitor assiste; Range devolve só o trecho pedido; sem login não vê', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: MP4 });
  assert.equal(r.statusCode, 201);
  const { url } = r.json<{ url: string }>();
  assert.match(url, /^\/api\/videos\/[a-f0-9]{24}\.mp4$/);
  const le = await entrar(app, 'le');
  const inteiro = await app.inject({ url, headers: le });
  assert.equal(inteiro.statusCode, 200);
  assert.equal(inteiro.headers['content-type'], 'video/mp4');
  assert.equal(inteiro.headers['accept-ranges'], 'bytes');
  assert.equal(inteiro.rawPayload.length, MP4.length);
  const parte = await app.inject({ url, headers: { ...le, range: 'bytes=0-9' } });
  assert.equal(parte.statusCode, 206);
  assert.equal(parte.headers['content-range'], `bytes 0-9/${MP4.length}`);
  assert.deepEqual(parte.rawPayload, MP4.subarray(0, 10));
  const fim = await app.inject({ url, headers: { ...le, range: 'bytes=-5' } });
  assert.deepEqual(fim.rawPayload, MP4.subarray(MP4.length - 5));
  assert.equal((await app.inject({ url, headers: { ...le, range: 'bytes=9999-' } })).statusCode, 416);
  assert.equal((await app.inject({ url })).statusCode, 401);
});

test('recusa leitor, arquivo que não é vídeo (mesmo com tipo de vídeo) e nome inventado; WebM é aceito', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...le, 'content-type': 'video/mp4' }, payload: MP4 })).statusCode, 403);
  const ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: Buffer.from('<script>alert(1)</script>'.repeat(5)) })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/webm' }, payload: WEBM })).statusCode, 201);
  assert.equal((await app.inject({ url: '/api/videos/..%2Fportal.db', headers: ed })).statusCode, 404);
});

test('banner aceita o vídeo enviado e recusa endereço de fora', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const { url } = (await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: MP4 })).json<{ url: string }>();
  const ok = await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: { ...ed, ...json }, payload: { titulo: 'Com vídeo', imagem: url } });
  assert.equal(ok.statusCode, 201);
  const ruim = await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: { ...ed, ...json }, payload: { titulo: 'Fora', imagem: '/api/videos/../x.mp4' } });
  assert.equal(ruim.statusCode, 400);
});

test('vídeo de fundo da entrada: só o administrador envia e só é público se estiver em uso', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const ed = await entrar(app, 'edita');
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/entrada/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: MP4 })).statusCode, 403);
  const { url } = (await app.inject({ method: 'POST', url: '/api/gestao/entrada/videos', headers: { ...adm, 'content-type': 'video/mp4' }, payload: MP4 })).json<{ url: string }>();
  assert.match(url, /^\/api\/publico\/videos\/[a-f0-9]{24}\.mp4$/);
  assert.equal((await app.inject({ url })).statusCode, 404); // ainda fora da configuração
  const salvo = await app.inject({ method: 'PUT', url: '/api/gestao/entrada', headers: { ...adm, ...json }, payload: { fundo: 'imagem', fixa: [url] } });
  assert.equal(salvo.statusCode, 200);
  const g = await app.inject({ url: url, headers: { range: 'bytes=0-3' } }); // sem login: é a tela de entrada
  assert.equal(g.statusCode, 206);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/entrada', headers: { ...adm, ...json }, payload: { fundo: 'imagem', imagens: ['/api/publico/videos/../x.mp4'] } })).statusCode, 400);
});

test('aceita vídeo de 36 MB e recusa acima de 40 MB', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const grande = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(36 * 1024 * 1024, 1)]);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: grande })).statusCode, 201);
  const enorme = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(41 * 1024 * 1024, 1)]);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/videos', headers: { ...ed, 'content-type': 'video/mp4' }, payload: enorme })).statusCode, 413);
});
