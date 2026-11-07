// Banners do Início: só ativos dentro da janela de datas aparecem; gestão por editor/admin com validação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ titulo: 'Coleção de verão', subtitulo: 'Chega em dezembro', ...p });
const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('leitor vê só banners ativos e dentro da janela, na ordem', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/banners', headers: ed, payload: novo(p) });
  await post({ titulo: 'Segundo', ordem: 2 });
  await post({ titulo: 'Primeiro', ordem: 1 });
  await post({ titulo: 'Inativo', ativo: false });
  await post({ titulo: 'Futuro', exibir_de: dia(5) });
  await post({ titulo: 'Vencido', exibir_ate: dia(-1) });
  const lista = (await app.inject({ url: '/api/banners', headers: await entrar(app, 'le') })).json<{ titulo: string }[]>();
  assert.deepEqual(lista.map((b) => b.titulo), ['Primeiro', 'Segundo']);
  assert.equal((await app.inject({ url: '/api/gestao/banners', headers: await entrar(app, 'edita') })).json<unknown[]>().length, 5);
});

test('leitor não gerencia; validações de link, imagem e datas', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: await entrar(app, 'le'), payload: novo() })).statusCode, 403);
  const ed = await entrar(app, 'edita');
  const post = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/banners', headers: ed, payload: novo(p) });
  assert.equal((await post({ link: 'javascript:alert(1)', botao_texto: 'Ir' })).statusCode, 400);
  assert.equal((await post({ link: '#comunicados' })).statusCode, 400); // link sem texto de botão
  assert.equal((await post({ link: '#comunicados/demo', botao_texto: 'Saiba mais' })).statusCode, 201);
  assert.equal((await post({ imagem: 'https://externo/x.png' })).statusCode, 400);
  assert.equal((await post({ imagem: '/api/imagens/aaaaaaaaaaaaaaaaaaaaaaaa.png' })).statusCode, 201);
  assert.equal((await post({ exibir_de: dia(3), exibir_ate: dia(1) })).statusCode, 400);
  assert.equal((await post({ ordem: 0 })).statusCode, 400);
});

test('editar e apagar', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const b = (await app.inject({ method: 'POST', url: '/api/gestao/banners', headers: ed, payload: novo() })).json<{ id: number }>();
  const up = await app.inject({ method: 'PUT', url: `/api/gestao/banners/${b.id}`, headers: ed, payload: novo({ titulo: 'Novo título' }) });
  assert.equal(up.json<{ titulo: string }>().titulo, 'Novo título');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${b.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/banners/${b.id}`, headers: ed })).statusCode, 404);
});
