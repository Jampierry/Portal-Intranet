// Mídia no disco, pela API (pelo mesmo caminho que o navegador usa): envio, leitura inteira e por trechos (Range).
import { test, expect, request as pwRequest } from '@playwright/test';
import { ADMIN } from './ajuda.ts';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 3)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(300, 7)]);

test('imagem e vídeo enviados voltam iguais, o vídeo por trechos; sem login não vê', async ({ request, baseURL }) => {
  const origem = { origin: baseURL! };
  expect((await request.post('/api/login', { data: ADMIN, headers: origem })).ok()).toBeTruthy();

  const img = await request.post('/api/gestao/imagens', { data: PNG, headers: { ...origem, 'content-type': 'image/png' } });
  expect(img.status()).toBe(201);
  const urlImg = (await img.json()).url as string;
  expect(Buffer.from(await (await request.get(urlImg)).body()).equals(PNG)).toBeTruthy();

  const vid = await request.post('/api/gestao/videos', { data: MP4, headers: { ...origem, 'content-type': 'video/mp4' } });
  expect(vid.status()).toBe(201);
  const urlVid = (await vid.json()).url as string;
  const parte = await request.get(urlVid, { headers: { range: 'bytes=4-11' } });
  expect(parte.status()).toBe(206);
  expect(Buffer.from(await parte.body()).equals(MP4.subarray(4, 12))).toBeTruthy();
  expect(Buffer.from(await (await request.get(urlVid)).body()).equals(MP4)).toBeTruthy();

  const anonimo = await pwRequest.newContext({ baseURL });
  expect((await anonimo.get(urlImg)).status()).toBe(401);
  await anonimo.dispose();
});
