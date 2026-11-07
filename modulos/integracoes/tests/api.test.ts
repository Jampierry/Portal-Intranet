// Integrações (Zimbra): só quem tem permissão mexe; o token fica no servidor; a configuração do serviço é repassada; datas importantes são criadas na agenda.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { limparCacheCalendario } from '../../calendario/api/index.ts';

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; delete process.env.ZIMBRA_API_URL; delete process.env.ZIMBRA_API_TOKEN; delete process.env.ZIMBRA_AGENDA; limparCacheCalendario(); });

type Chamada = { url: string; metodo: string; auth: string; corpo: unknown };
function simular(respostas: Record<string, { status?: number; json: unknown }>) {
  const chamadas: Chamada[] = [];
  globalThis.fetch = (async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const u = new URL(String(url));
    chamadas.push({ url: `${u.pathname}${u.search}`, metodo: init?.method ?? 'GET', auth: init?.headers?.Authorization ?? '', corpo: init?.body ? JSON.parse(init.body) : undefined });
    const r = respostas[`${init?.method ?? 'GET'} ${u.pathname}`] ?? { status: 404, json: { erro: 'rota inesperada' } };
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return chamadas;
}
const TOKEN = 'token-do-servico-1234567890';

test('só administrador (cfg.integracoes) acessa; editor e leitor recebem 403', async () => {
  const { app } = await criarAppTeste();
  for (const login of ['edita', 'le']) assert.equal((await app.inject({ url: '/api/integracoes/zimbra', headers: await entrar(app, login) })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: await entrar(app, 'edita'), payload: { url: 'http://x:1' } })).statusCode, 403);
});

test('salvar conexão: valida o endereço, guarda o token sem devolvê-lo e o calendário passa a usar', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: adm, payload: { url: 'ftp://x' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: adm, payload: { token: 'curto' } })).statusCode, 400);
  const chamadas = simular({ 'GET /api/config': { json: { host: 'webmail.exemplo', user: 'a@b.com', servicos: { agenda: true } } }, 'GET /api/eventos': { json: [] } });
  const salvar = await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: adm, payload: { url: 'http://127.0.0.1:8765/', token: TOKEN, agenda: 'Empresa' } });
  assert.equal(salvar.statusCode, 200);
  const estado = (await app.inject({ url: '/api/integracoes/zimbra', headers: adm })).json<{ url: string; token_salvo: boolean; origem: string; agenda_destino: string; servico: { alcancavel: boolean } }>();
  assert.equal(estado.url, 'http://127.0.0.1:8765');
  assert.equal(estado.token_salvo, true);
  assert.equal(estado.origem, 'banco');
  assert.equal(estado.servico.alcancavel, true);
  assert.ok(!JSON.stringify(estado).includes(TOKEN)); // o token nunca volta ao navegador
  assert.equal(chamadas[0].auth, `Bearer ${TOKEN}`);
  const cal = (await app.inject({ url: '/api/calendario', headers: await entrar(app, 'le') })).json<{ conectado: boolean }>();
  assert.equal(cal.conectado, true);
  assert.match(chamadas.at(-1)!.url, /agenda=Empresa/);
});

test('serviço fora do ar: a tela recebe o motivo, sem erro 500', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: adm, payload: { url: 'http://127.0.0.1:8765', token: TOKEN } });
  globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
  const r = await app.inject({ url: '/api/integracoes/zimbra', headers: adm });
  assert.equal(r.statusCode, 200);
  const j = r.json<{ servico: { alcancavel: boolean; erro: string } }>();
  assert.equal(j.servico.alcancavel, false);
  assert.match(j.servico.erro, /serviço Zimbra/i);
  const t = await app.inject({ method: 'POST', url: '/api/integracoes/zimbra/testar', headers: adm });
  assert.equal(t.statusCode, 502);
});

test('repasse da configuração ao serviço: só campos permitidos, validação e sem vazar a senha na auditoria', async () => {
  const { app, db } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: adm, payload: { url: 'http://127.0.0.1:8765', token: TOKEN } });
  const chamadas = simular({ 'PUT /api/config': { json: { host: 'webmail.exemplo', user: 'a@b.com', senha_salva: true } } });
  const put = (p: object) => app.inject({ method: 'PUT', url: '/api/integracoes/zimbra/config', headers: adm, payload: p });
  assert.equal((await put({ host: 'webmail.exemplo' })).statusCode, 400); // falta e-mail
  assert.equal((await put({ host: 'h', user: 'u@x.com', servicos: { agenda: 'sim' } })).statusCode, 400);
  assert.equal((await put({ host: 'h', user: 'u@x.com', servicos: { hackear: true } })).statusCode, 400);
  const ok = await put({ host: 'webmail.exemplo', user: 'a@b.com', senha: 'segredo-da-conta', servicos: { agenda: true }, agendas: ['10', 3703], intruso: 'x' });
  assert.equal(ok.statusCode, 200);
  const enviado = chamadas.at(-1)!.corpo as Record<string, unknown>;
  assert.equal(enviado.intruso, undefined); // campo fora da lista não passa
  assert.deepEqual(enviado.agendas, ['10', 3703]);
  const log = (db.prepare("SELECT detalhe FROM auditoria WHERE acao = 'integracao_zimbra_config'").get() as { detalhe: string }).detalhe;
  assert.ok(!log.includes('segredo-da-conta'));
  assert.ok(!JSON.stringify(ok.json()).includes('segredo-da-conta'));
});

test('datas importantes: criar e excluir seguem a permissão e vão para a agenda configurada', async () => {
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await app.inject({ method: 'PUT', url: '/api/integracoes/zimbra', headers: adm, payload: { url: 'http://127.0.0.1:8765', token: TOKEN, agenda: 'Empresa' } });
  const chamadas = simular({ 'POST /api/eventos': { status: 201, json: { id: '4321' } }, 'DELETE /api/eventos/4321': { json: { excluido: true } } });
  const criar = (h: Record<string, string>, p: object) => app.inject({ method: 'POST', url: '/api/calendario', headers: h, payload: p });
  const le = await entrar(app, 'le'), edita = await entrar(app, 'edita');
  assert.equal((await criar(le, { titulo: 'Feriado', data: '2026-12-25' })).statusCode, 403);
  assert.equal((await criar(edita, { titulo: 'x', data: '2026-12-25' })).statusCode, 400); // título curto
  assert.equal((await criar(edita, { titulo: 'Feriado', data: '2026-02-30' })).statusCode, 400); // data impossível
  assert.equal((await criar(edita, { titulo: 'Feriado', data: '2026-12-25', data_fim: '2026-12-24' })).statusCode, 400);
  assert.equal((await criar(edita, { titulo: 'Reunião', data: '2026-12-25', dia_inteiro: false, hora_inicio: '10:00', hora_fim: '09:00' })).statusCode, 400);
  const ok = await criar(edita, { titulo: 'Natal', data: '2026-12-25' });
  assert.equal(ok.statusCode, 201);
  assert.deepEqual(chamadas.at(-1)!.corpo, { titulo: 'Natal', local: '', agenda: 'Empresa', dia_inteiro: true, inicio: '2026-12-25', fim: '2026-12-25' });
  const hora = await criar(edita, { titulo: 'Reunião geral', data: '2026-12-10', dia_inteiro: false, hora_inicio: '14:00', hora_fim: '15:30' });
  assert.equal(hora.statusCode, 201);
  assert.deepEqual((chamadas.at(-1)!.corpo as { inicio: string; fim: string }), { ...(chamadas.at(-1)!.corpo as object), inicio: '2026-12-10 14:00', fim: '2026-12-10 15:30' });
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/calendario/4321', headers: le })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/calendario/4321', headers: edita })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/calendario/..%2Fx', headers: edita })).statusCode, 400);
});

test('serviço com agenda de escrita desligada devolve a mensagem dele', async () => {
  const { app } = await criarAppTeste();
  process.env.ZIMBRA_API_URL = 'http://127.0.0.1:8765'; process.env.ZIMBRA_API_TOKEN = TOKEN; process.env.ZIMBRA_AGENDA = 'Empresa';
  simular({ 'POST /api/eventos': { status: 403, json: { erro: "Serviço 'agenda_escrita' desligado na configuração." } } });
  const r = await app.inject({ method: 'POST', url: '/api/calendario', headers: await entrar(app, 'edita'), payload: { titulo: 'Natal', data: '2026-12-25' } });
  assert.equal(r.statusCode, 400);
  assert.match(r.json<{ erro: string }>().erro, /agenda_escrita/);
});

test('sem agenda escolhida o calendário não lê nada (privacidade) e não deixa cadastrar', async () => {
  const { app } = await criarAppTeste();
  process.env.ZIMBRA_API_URL = 'http://127.0.0.1:8765'; process.env.ZIMBRA_API_TOKEN = TOKEN;
  const chamadas = simular({ 'GET /api/eventos': { json: [{ id: '1', titulo: 'Agenda pessoal de alguém', inicio: '2026-11-10', fim: '2026-11-10', dia_inteiro: true, local: '' }] } });
  const cal = (await app.inject({ url: '/api/calendario', headers: await entrar(app, 'le') })).json<{ sem_agenda?: boolean; eventos: unknown[] }>();
  assert.equal(cal.sem_agenda, true);
  assert.deepEqual(cal.eventos, []);
  assert.equal(chamadas.length, 0); // nem chamou o serviço
  const criar = await app.inject({ method: 'POST', url: '/api/calendario', headers: await entrar(app, 'edita'), payload: { titulo: 'Natal', data: '2026-12-25' } });
  assert.equal(criar.statusCode, 400);
  assert.match(criar.json<{ erro: string }>().erro, /Escolha a agenda/);
});
