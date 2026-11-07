// Ícone próprio do aplicativo: busca do favicon (servidor local de teste, sem rede externa) e validação do campo logo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { candidatos } from '../api/favicon.ts';

process.env.PASTA_IMAGENS = mkdtempSync(join(tmpdir(), 'portal-ico-'));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

async function sistemaFalso() {
  const srv = createServer((req, resp) => {
    if (req.url === '/com-icone') { resp.setHeader('content-type', 'text/html'); return void resp.end('<html><head><link rel="icon" href="/img/logo.png"></head></html>'); }
    if (req.url === '/img/logo.png') { resp.setHeader('content-type', 'image/png'); return void resp.end(PNG); }
    if (req.url === '/so-favicon-ico') return void resp.end('nada');
    if (req.url === '/favicon.ico') { resp.setHeader('content-type', 'image/x-icon'); return void resp.end(Buffer.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0])); }
    resp.statusCode = 404; resp.end('nao');
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  return { base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, fechar: () => srv.close() };
}

test('candidatos: prefere apple-touch/png, ignora svg e termina em /favicon.ico', () => {
  const html = '<link rel="icon" href="a.svg"><link rel="shortcut icon" href="/f.ico"><link rel="apple-touch-icon" sizes="180x180" href="/t.png">';
  assert.deepEqual(candidatos(html, 'https://meurh.exemplo/dashboard'), ['https://meurh.exemplo/t.png', 'https://meurh.exemplo/f.ico', 'https://meurh.exemplo/favicon.ico']);
});

test('admin busca o ícone da página e vê o endereço guardado; sem ícone na página usa /favicon.ico', async () => {
  const sis = await sistemaFalso();
  try {
    const { app } = await criarAppTeste();
    const adm = await entrar(app, 'master');
    const r = await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes/icone', headers: adm, payload: { url: `${sis.base}/com-icone` } });
    assert.equal(r.statusCode, 200);
    assert.match(r.json<{ logo: string }>().logo, /^\/api\/imagens\/[a-f0-9]{24}\.png$/);
    const r2 = await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes/icone', headers: adm, payload: { url: `${sis.base}/so-favicon-ico` } });
    assert.match(r2.json<{ logo: string }>().logo, /\.ico$/);
  } finally { sis.fechar(); }
});

test('sem ícone achado volta 404; editor não busca; endereço inválido recusado', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const morto = await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes/icone', headers: adm, payload: { url: 'http://127.0.0.1:1/' } });
  assert.equal(morto.statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes/icone', headers: await entrar(app, 'edita'), payload: { url: 'http://127.0.0.1:1/' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes/icone', headers: adm, payload: { url: 'ftp://x' } })).statusCode, 400);
});

test('campo logo só aceita imagem guardada pelo portal e aparece na lista pública', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const base = { nome: 'Meu RH', descricao: 'Holerite', categoria: 'Pessoas e RH', url: 'https://meurh.exemplo/', acesso: 'Todos' };
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: { ...base, logo: 'https://externo/x.png' } })).statusCode, 400);
  const ok = await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: { ...base, logo: '/api/imagens/aaaaaaaaaaaaaaaaaaaaaaaa.png' } });
  assert.equal(ok.statusCode, 201);
  const lista = (await app.inject({ url: '/api/aplicacoes', headers: await entrar(app, 'le') })).json<{ logo: string }[]>();
  assert.equal(lista[0].logo, '/api/imagens/aaaaaaaaaaaaaaaaaaaaaaaa.png');
});
