// Calendário: datas locais (feriados, facultativos, eventos), agendas exibidas do Zimbra e aplicativos restritos por usuário.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { limparCacheCalendario } from '../api/index.ts';
import { feriadosDoAno, pascoa } from '../api/feriados.ts';

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; delete process.env.ZIMBRA_API_URL; delete process.env.ZIMBRA_API_TOKEN; delete process.env.ZIMBRA_AGENDA; limparCacheCalendario(); });
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const json = { 'content-type': 'application/json' };

test('Páscoa e feriados do ano: móveis calculados, Goiânia e facultativos separados', () => {
  assert.equal(pascoa(2026), '2026-04-05');
  const f = feriadosDoAno(2026, [{ titulo: 'Aniversário da cidade', dia: 24, mes: 10 }]), por = (t: string) => f.find((x) => x.titulo === t)!;
  assert.equal(por('Sexta-feira Santa').data, '2026-04-03');
  assert.equal(por('Carnaval (terça)').data, '2026-02-17');
  assert.equal(por('Carnaval (terça)').tipo, 'facultativo');
  assert.equal(por('Corpus Christi').data, '2026-06-04');
  assert.equal(por('Aniversário da cidade').tipo, 'municipal');
  assert.ok(!feriadosDoAno(2026).some((x) => x.tipo === 'municipal'));
  assert.equal(por('Natal').anual, true);
  assert.equal(por('Corpus Christi').anual, false);
});

test('datas locais: só quem tem permissão cadastra; aparecem no calendário mesmo sem Zimbra', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master'), le = await entrar(app, 'le');
  const mes = mesAtual();
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/calendario/datas', headers: le, payload: { titulo: 'X', data: `${mes}-10`, tipo: 'evento' } })).statusCode, 403);
  const ruim = await app.inject({ method: 'POST', url: '/api/gestao/calendario/datas', headers: adm, payload: { titulo: 'Auditoria', data: '2026-02-31', tipo: 'evento' } });
  assert.equal(ruim.statusCode, 400);
  const ok = await app.inject({ method: 'POST', url: '/api/gestao/calendario/datas', headers: adm, payload: { titulo: 'Auditoria', data: `${mes}-10`, data_fim: `${mes}-11`, tipo: 'evento' } });
  assert.equal(ok.statusCode, 201);
  const r = (await app.inject({ url: `/api/calendario?mes=${mes}`, headers: le })).json<{ conectado: boolean; datas: { titulo: string; data: string; data_fim: string }[] }>();
  assert.equal(r.conectado, false);
  assert.deepEqual(r.datas.map((d) => [d.titulo, d.data, d.data_fim]), [['Auditoria', `${mes}-10`, `${mes}-11`]]);
  const id = (ok.json<{ id: number }>()).id;
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/calendario/datas/${id}`, headers: adm })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/calendario/datas/${id}`, headers: adm })).statusCode, 404);
});

test('gerar feriados: não duplica e data anual vale em qualquer ano', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const um = (await app.inject({ method: 'POST', url: '/api/gestao/calendario/feriados', headers: adm, payload: { ano: 2026 } })).json<{ novos: number }>();
  assert.ok(um.novos >= 13);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/calendario/feriados', headers: adm, payload: { ano: 2026 } })).json<{ novos: number }>().novos, 0);
  // 2027: só os móveis são novos (os fixos são anuais e já existem)
  const dois = (await app.inject({ method: 'POST', url: '/api/gestao/calendario/feriados', headers: adm, payload: { ano: 2027 } })).json<{ novos: number }>();
  assert.equal(dois.novos, 4);
  assert.equal((await app.inject({ method: 'POST', url: '/api/gestao/calendario/feriados', headers: adm, payload: { ano: 1800 } })).statusCode, 400);
  const d = new Date(), natal = `${d.getFullYear()}-12`;
  if (natal >= mesAtual() && natal <= `${d.getFullYear() + 1}-01`) {
    const r = (await app.inject({ url: `/api/calendario?mes=${natal}`, headers: adm })).json<{ datas: { titulo: string }[] }>();
    assert.ok(r.datas.some((x) => x.titulo === 'Natal'));
  }
});

test('várias agendas do Zimbra: busca cada uma, marca a agenda de origem e tolera falha parcial', async () => {
  process.env.ZIMBRA_API_URL = 'http://zimbra.interno:8765'; process.env.ZIMBRA_API_TOKEN = 'token-secreto';
  const mes = mesAtual();
  const pedidas: string[] = [];
  globalThis.fetch = (async (url: string) => {
    const u = new URL(String(url)); const ag = u.searchParams.get('agenda') ?? '';
    if (u.pathname === '/api/agendas') return new Response(JSON.stringify([{ id: '1', nome: 'Empresa', selecionada: true }, { id: '2', nome: 'RH', selecionada: true }, { id: '3', nome: 'Salas', selecionada: false }]), { status: 200, headers: json });
    pedidas.push(ag);
    if (ag === 'Salas') return new Response(JSON.stringify({ erro: 'fora' }), { status: 500, headers: json });
    return new Response(JSON.stringify([{ id: ag + '1', titulo: `Evento ${ag}`, local: '', inicio: `${mes}-12`, fim: `${mes}-12`, dia_inteiro: true }]), { status: 200, headers: json });
  }) as unknown as typeof fetch;
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master'), le = await entrar(app, 'le');
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/calendario/agendas', headers: le, payload: { exibir: ['Empresa'] } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/calendario/agendas', headers: adm, payload: { exibir: 'Empresa' } })).statusCode, 400);
  const disp = (await app.inject({ url: '/api/gestao/calendario/agendas', headers: adm })).json<{ disponiveis: string[] }>();
  assert.deepEqual(disp.disponiveis, ['Empresa', 'RH', 'Salas']);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/calendario/agendas', headers: adm, payload: { exibir: ['Empresa', 'RH'] } })).statusCode, 200);
  const r = (await app.inject({ url: `/api/calendario?mes=${mes}`, headers: le })).json<{ erro?: string; eventos: { agenda: string; titulo: string }[] }>();
  assert.deepEqual(r.eventos.map((e) => e.agenda).sort(), ['Empresa', 'RH']);
  assert.equal(r.erro, undefined);
  await app.inject({ method: 'PUT', url: '/api/gestao/calendario/agendas', headers: adm, payload: { exibir: ['Empresa', 'Salas'] } });
  const p = (await app.inject({ url: `/api/calendario?mes=${mes}`, headers: le })).json<{ erro?: string; eventos: { agenda: string }[] }>();
  assert.match(p.erro ?? '', /Parte das agendas/);
  assert.deepEqual(p.eventos.map((e) => e.agenda), ['Empresa']);
});

test('aplicativo restrito: só aparece para quem foi liberado; admin vê todos; favorito segue a regra', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master'), le = await entrar(app, 'le'), ed = await entrar(app, 'edita');
  const novo = await app.inject({ method: 'POST', url: '/api/gestao/aplicacoes', headers: adm, payload: { nome: 'Folha Interna', descricao: 'x', categoria: 'RH', url: 'https://folha.exemplo.com.br', acesso: 'RH', restrita: true } });
  assert.equal(novo.statusCode, 201);
  const slug = novo.json<{ slug: string; restrita: number }>().slug;
  assert.equal(novo.json<{ restrita: number }>().restrita, 1);
  const lista = async (h: Record<string, string>) => (await app.inject({ url: '/api/aplicacoes', headers: h })).json<{ slug: string }[]>().map((a) => a.slug);
  assert.ok((await lista(adm)).includes(slug));
  assert.ok(!(await lista(le)).includes(slug));
  assert.equal((await app.inject({ method: 'PUT', url: `/api/favoritos/${slug}`, headers: le })).statusCode, 404);
  const leitor = (db.prepare("SELECT id FROM usuarios WHERE login = 'le'").get() as { id: number }).id;
  // quem não tem a permissão nova não define aplicativos
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${leitor}/aplicativos`, headers: ed, payload: { liberados: [slug] } })).statusCode, 403);
  const g = await app.inject({ url: `/api/usuarios/${leitor}/aplicativos`, headers: adm });
  assert.deepEqual(g.json<{ restritas: { slug: string }[] }>().restritas.map((r) => r.slug), [slug]);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/usuarios/${leitor}/aplicativos`, headers: adm, payload: { liberados: [slug, 'inexistente'] } })).json<{ liberados: string[] }>().liberados.length, 1);
  assert.ok((await lista(le)).includes(slug));
  assert.equal((await app.inject({ method: 'PUT', url: `/api/favoritos/${slug}`, headers: le })).statusCode, 200);
  // tirar a liberação derruba a visibilidade e o favorito
  await app.inject({ method: 'PUT', url: `/api/usuarios/${leitor}/aplicativos`, headers: adm, payload: { liberados: [] } });
  assert.ok(!(await lista(le)).includes(slug));
  assert.deepEqual((await app.inject({ url: '/api/favoritos', headers: le })).json(), []);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM favoritos WHERE usuario_id = ?').get(leitor) as { n: number }).n, 0);
});

test('permissões do calendário unificadas: editor cadastra/exclui datas, mas só quem tem "agendas" escolhe as agendas', async () => {
  const { app } = await criarAppTeste();
  const ed = await entrar(app, 'edita'), le = await entrar(app, 'le');
  const mes = new Date().toISOString().slice(0, 7);
  const nova = await app.inject({ method: 'POST', url: '/api/gestao/calendario/datas', headers: ed, payload: { titulo: 'Confraternização', data: `${mes}-15`, tipo: 'evento' } });
  assert.equal(nova.statusCode, 201);
  assert.equal((await app.inject({ url: '/api/gestao/calendario/agendas', headers: ed })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/gestao/calendario/agendas', headers: ed, payload: { exibir: ['Empresa'] } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/gestao/calendario/datas', headers: le })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/gestao/calendario/datas/${nova.json<{ id: number }>().id}`, headers: ed })).statusCode, 200);
});
