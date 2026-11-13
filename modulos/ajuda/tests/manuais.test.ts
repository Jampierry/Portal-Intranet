// Prints dos manuais: só com login, só nomes simples (sem sair da pasta) e só PNG que existe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

test('imagens dos manuais exigem login, entregam PNG e recusam nome fora do padrão', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/ajuda/manuais/img/entrada-login.png' })).statusCode, 401);
  const le = await entrar(app, 'le');
  const ok = await app.inject({ url: '/api/ajuda/manuais/img/entrada-login.png', headers: le });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['content-type'], 'image/png');
  assert.deepEqual([...ok.rawPayload.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  for (const nome of ['..%2F..%2Fpackage.json', 'nao-existe.png', 'Entrada.PNG', '.png', 'a.png.exe']) {
    assert.equal((await app.inject({ url: `/api/ajuda/manuais/img/${nome}`, headers: le })).statusCode, 404, nome);
  }
});

test('todo print citado nos manuais existe na pasta de imagens', async () => {
  const { readdirSync, readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const pasta = join(import.meta.dirname, '..', '..', '..', 'docs', 'manuais');
  for (const arq of readdirSync(pasta).filter((f) => f.endsWith('.md'))) {
    for (const [, nome] of readFileSync(join(pasta, arq), 'utf8').matchAll(/!\[[^\]]*\]\(img\/([a-z0-9-]+\.png)\)/g)) {
      assert.ok(existsSync(join(pasta, 'img', nome)), `${arq} cita img/${nome}, que não existe`);
    }
  }
});
