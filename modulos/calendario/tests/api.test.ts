// Calendário: lê a agenda do Zimbra pelo servidor (token fica no servidor), com cache e sem expor o organizador.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { limitesDoMes, limparCacheCalendario } from '../api/index.ts';

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; delete process.env.ZIMBRA_API_URL; delete process.env.ZIMBRA_API_TOKEN; delete process.env.ZIMBRA_AGENDA; limparCacheCalendario(); });
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

test('exige login e valida o mês', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/calendario' })).statusCode, 401);
  const h = await entrar(app, 'le');
  assert.equal((await app.inject({ url: '/api/calendario?mes=2026-13', headers: h })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/calendario?mes=abc', headers: h })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/calendario?mes=1990-01', headers: h })).statusCode, 400);
});

test('sem ZIMBRA_API_URL/TOKEN: responde "não conectado", sem erro', async () => {
  const { app } = await criarAppTeste();
  const r = (await app.inject({ url: '/api/calendario', headers: await entrar(app, 'le') })).json<{ conectado: boolean; eventos: unknown[] }>();
  assert.deepEqual(r, { conectado: false, eventos: [], datas: [] });
});

test('conectado: manda o token ao Zimbra, devolve só campos públicos, filtra o mês e usa cache', async () => {
  process.env.ZIMBRA_API_URL = 'http://zimbra.interno:8765/'; process.env.ZIMBRA_API_TOKEN = 'token-secreto'; process.env.ZIMBRA_AGENDA = 'Empresa';
  const mes = mesAtual();
  const chamadas: { url: string; auth: string }[] = [];
  globalThis.fetch = (async (url: string, init?: { headers?: Record<string, string> }) => {
    chamadas.push({ url: String(url), auth: init?.headers?.Authorization ?? '' });
    return new Response(JSON.stringify([
      { id: '1', agenda: 'Empresa', titulo: 'Reunião geral', local: 'Auditório', inicio: `${mes}-10 09:00`, fim: `${mes}-10 10:00`, dia_inteiro: false, organizador: 'chefe@dipaula.com.br', ocupado: 'B' },
      { id: '2', agenda: 'Empresa', titulo: 'Fora do mês', local: '', inicio: '2020-01-05', fim: '2020-01-05', dia_inteiro: true, organizador: 'x@y', ocupado: 'F' },
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  const { app } = await criarAppTeste();
  const h = await entrar(app, 'le');
  const r = (await app.inject({ url: `/api/calendario?mes=${mes}`, headers: h })).json<{ conectado: boolean; eventos: Record<string, unknown>[] }>();
  assert.equal(r.conectado, true);
  assert.equal(r.eventos.length, 1);
  assert.deepEqual(Object.keys(r.eventos[0]).sort(), ['agenda', 'dia_inteiro', 'fim', 'id', 'inicio', 'local', 'titulo']);
  assert.equal(chamadas[0].auth, 'Bearer token-secreto');
  assert.ok(chamadas[0].url.startsWith('http://zimbra.interno:8765/api/eventos?'));
  await app.inject({ url: `/api/calendario?mes=${mes}`, headers: h });
  assert.equal(chamadas.length, 1); // a segunda chamada veio do cache
});

test('Zimbra fora do ar: avisa e não derruba o portal', async () => {
  process.env.ZIMBRA_API_URL = 'http://zimbra.interno:8765'; process.env.ZIMBRA_API_TOKEN = 't'; process.env.ZIMBRA_AGENDA = 'Empresa';
  globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
  const { app } = await criarAppTeste();
  const r = await app.inject({ url: '/api/calendario', headers: await entrar(app, 'le') });
  assert.equal(r.statusCode, 200);
  assert.match(r.json<{ erro: string }>().erro, /indispon/i);
});

test('limites do mês: janela relativa a hoje', () => {
  const { primeiroDia, ultimoDia, dias } = limitesDoMes(mesAtual());
  assert.match(primeiroDia, /-01$/);
  assert.ok(Number(ultimoDia.slice(8)) >= 28);
  assert.ok(dias >= 1);
});
