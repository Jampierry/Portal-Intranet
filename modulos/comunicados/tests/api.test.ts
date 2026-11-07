// API de comunicados com banco em memória: leitura para todos os logados e gestão por editor/admin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';

const novo = (p: object = {}) => ({ titulo: 'Aviso importante', resumo: 'Resumo do aviso', categoria: 'Pessoas', ...p });

test('leitor vê só publicados; rascunho e arquivado ficam escondidos', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo(p) });
  await post({ titulo: 'Publicado A', status: 'publicado' });
  await post({ titulo: 'Rascunho B' });
  await post({ titulo: 'Arquivado C', status: 'arquivado' });
  const lista = (await app.inject({ url: '/api/comunicados', headers: await entrar(app, 'le') })).json<{ slug: string }[]>();
  assert.deepEqual(lista.map((c) => c.slug), ['publicado-a']);
});

test('detalhe traz o corpo; rascunho e inexistente dão 404', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: 'Com corpo', corpo: 'Texto completo', status: 'publicado' }) });
  await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: 'Escondido' }) });
  const le = await entrar(app, 'le');
  const ok = await app.inject({ url: '/api/comunicados/com-corpo', headers: le });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json<{ corpo: string }>().corpo, 'Texto completo');
  assert.equal((await app.inject({ url: '/api/comunicados/escondido', headers: le })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/comunicados/nao-existe', headers: le })).statusCode, 404);
});

test('janela de exibição: só aparece dentro de exibir_de / exibir_ate', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ status: 'publicado', ...p }) });
  await post({ titulo: 'Futuro', exibir_de: '2999-01-01' });
  await post({ titulo: 'Vencido', exibir_ate: '2000-01-01' });
  await post({ titulo: 'Valido', exibir_de: '2000-01-01', exibir_ate: '2999-01-01' });
  const lista = (await app.inject({ url: '/api/comunicados', headers: await entrar(app, 'le') })).json<{ slug: string }[]>();
  assert.deepEqual(lista.map((c) => c.slug), ['valido']);
});

test('consulta não gerencia; editor e admin sim', async () => {
  const { app } = await criarAppTeste();
  const le = await entrar(app, 'le');
  assert.equal((await app.inject({ url: '/api/gestao/comunicados', headers: le })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: le, payload: novo() })).statusCode, 403);
  for (const login of ['edita', 'master']) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: await entrar(app, login), payload: novo({ titulo: `Do ${login}` }) })).statusCode, 201, login);
  }
});

test('validação: título curto, categoria vazia, prioridade e datas inválidas', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const post = (p: object) => app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo(p) });
  assert.equal((await post({ titulo: 'ab' })).statusCode, 400);
  assert.equal((await post({ categoria: '' })).statusCode, 400);
  assert.equal((await post({ prioridade: 'gritante' })).statusCode, 400);
  assert.equal((await post({ exibir_de: '31/12/2026' })).statusCode, 400);
  assert.equal((await post({ exibir_de: '2026-12-31', exibir_ate: '2026-01-01' })).statusCode, 400);
  assert.equal((await post({ titulo: 'x'.repeat(121) })).statusCode, 400);
});

test('a data de publicação nasce ao publicar e não muda depois; slug nunca repete', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const a = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: 'Mesmo título' }) })).json<{ id: number; slug: string; publicado_em: string | null }>();
  const b = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: 'Mesmo título' }) })).json<{ slug: string }>();
  assert.notEqual(a.slug, b.slug);
  assert.equal(a.publicado_em, null);
  const pub = (await app.inject({ method: 'PUT', url: `/api/gestao/comunicados/${a.id}`, headers: ed, payload: novo({ titulo: 'Mesmo título', status: 'publicado' }) })).json<{ publicado_em: string }>();
  assert.match(pub.publicado_em, /^\d{4}-\d{2}-\d{2}$/);
  const arq = (await app.inject({ method: 'PUT', url: `/api/gestao/comunicados/${a.id}`, headers: ed, payload: novo({ titulo: 'Mesmo título', status: 'arquivado' }) })).json<{ publicado_em: string }>();
  assert.equal(arq.publicado_em, pub.publicado_em);
});

test('editor só apaga rascunho; admin apaga publicado; tudo fica na auditoria', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), adm = await entrar(app, 'master');
  const r = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: 'Rasc' }) })).json<{ id: number }>();
  const p = (await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: 'Pub', status: 'publicado' }) })).json<{ id: number }>();
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/comunicados/${p.id}`, headers: ed })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/comunicados/${r.id}`, headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/comunicados/${p.id}`, headers: adm })).statusCode, 200);
  const acoes = (await app.inject({ url: '/api/auditoria', headers: adm })).json<{ acao: string }[]>().map((l) => l.acao);
  assert.ok(acoes.includes('comunicado_criado') && acoes.includes('comunicado_apagado'));
});

test('texto com HTML é guardado como texto (a tela escapa; nada é interpretado)', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({ method: 'POST', url: '/api/gestao/comunicados', headers: ed, payload: novo({ titulo: '<img src=x onerror=alert(1)>', status: 'publicado' }) });
  assert.equal(r.statusCode, 201);
  assert.equal(r.json<{ titulo: string }>().titulo, '<img src=x onerror=alert(1)>');
});

test('aceita o formulário da tela: campos opcionais vêm como texto vazio', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita');
  const r = await app.inject({
    method: 'POST', url: '/api/gestao/comunicados', headers: ed,
    payload: { titulo: 'Vindo do formulário', resumo: 'Resumo', corpo: '', categoria: 'Pessoas', prioridade: 'normal', status: 'rascunho', exibir_de: '', exibir_ate: '' },
  });
  assert.equal(r.statusCode, 201);
  const c = r.json<{ corpo: string | null; exibir_de: string | null }>();
  assert.equal(c.corpo, null);
  assert.equal(c.exibir_de, null);
});
