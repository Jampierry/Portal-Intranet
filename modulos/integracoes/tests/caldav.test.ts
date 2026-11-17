// Agenda por CalDAV direto do portal: leitura do iCalendar, fuso, conexão salva sem devolver a senha, calendário, criar e excluir.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppTeste, entrar } from '../../acessos/tests/ajuda.ts';
import { limparCacheCalendario } from '../../calendario/api/index.ts';
import { limparCacheCalDav, lerEventosIcs, paraHorarioLocal } from '../api/caldav.ts';

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; limparCacheCalendario(); limparCacheCalDav(); });
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

test('iCalendar: dia inteiro (fim exclusivo), UTC para Brasília, TZID, cancelado fora, texto escapado e linhas dobradas', () => {
  const ev = lerEventosIcs([
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Feriado\\, nacional', 'DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261121', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:b', 'SUMMARY:Reunião', 'LOCATION:Sala 1', 'DTSTART:20261120T120000Z', 'DTEND:20261120T133000Z', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:c', 'SUMMARY:Com fuso', 'DTSTART;TZID=America/New_York:20261120T090000', 'DTEND;TZID=America/New_York:20261120T100000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d', 'SUMMARY:Cancelado', 'STATUS:CANCELLED', 'DTSTART:20261121T120000Z', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:e', 'SUMMARY:Título muito ', ' comprido', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20261204', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n'));
  assert.equal(ev.length, 4);
  assert.deepEqual(ev[0], { uid: 'a', titulo: 'Feriado, nacional', inicio: '2026-11-20', fim: '2026-11-20', dia_inteiro: true, local: '' });
  assert.equal(ev[1].inicio, '2026-11-20 09:00'); // 12:00Z = 09:00 em Brasília
  assert.equal(ev[1].fim, '2026-11-20 10:30');
  assert.equal(ev[1].local, 'Sala 1');
  assert.equal(ev[2].inicio, '2026-11-20 11:00'); // 09:00 em Nova York (-05:00) = 14:00Z = 11:00 em Brasília
  assert.equal(ev[3].titulo, 'Título muito comprido');
  assert.equal(ev[3].fim, '2026-12-03');
});

test('fuso: UTC e hora sem fuso', () => {
  assert.deepEqual(paraHorarioLocal('20261120T000000Z'), { texto: '2026-11-19 21:00', diaInteiro: false });
  assert.deepEqual(paraHorarioLocal('20261120T100000'), { texto: '2026-11-20 10:00', diaInteiro: false });
  assert.equal(paraHorarioLocal('lixo'), null);
});

const ICS = (mes: string) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Reunião geral\r\nDTSTART:${mes.replace('-', '')}10T120000Z\r\nDTEND:${mes.replace('-', '')}10T130000Z\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const multistatus = (itens: string[]) => `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${itens.join('')}</D:multistatus>`;
const resp207 = (xml: string) => new Response(xml, { status: 207, headers: { 'content-type': 'application/xml' } });

type Chamada = { metodo: string; caminho: string; auth: string; corpo: string; ctype: string };
function simular(mes: string) {
  const chamadas: Chamada[] = [];
  globalThis.fetch = (async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const u = new URL(String(url)), m = init?.method ?? 'GET';
    chamadas.push({ metodo: m, caminho: u.pathname, auth: init?.headers?.Authorization ?? '', corpo: init?.body ?? '', ctype: init?.headers?.['Content-Type'] ?? '' });
    if (u.hostname !== 'zimbra.interno') return new Response('fora', { status: 500 });
    if (m === 'PROPFIND') return resp207(multistatus([
      '<D:response><D:href>/dav/agenda@empresa.com.br/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>',
      '<D:response><D:href>/dav/agenda@empresa.com.br/Calendar/</D:href><D:propstat><D:prop><D:displayname>Empresa</D:displayname><D:resourcetype><D:collection/><C:calendar/></D:resourcetype><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set></D:prop></D:propstat></D:response>',
      '<D:response><D:href>/dav/agenda@empresa.com.br/Tasks/</D:href><D:propstat><D:prop><D:displayname>Tarefas</D:displayname><D:resourcetype><D:collection/><C:calendar/></D:resourcetype><C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set></D:prop></D:propstat></D:response>',
      '<D:response><D:href>/dav/agenda@empresa.com.br/Contacts/</D:href><D:propstat><D:prop><D:displayname>Contatos</D:displayname><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>',
    ]));
    if (m === 'REPORT') return resp207(multistatus([`<D:response><D:href>/dav/agenda@empresa.com.br/Calendar/1.ics</D:href><D:propstat><D:prop><C:calendar-data>${ICS(mes).replace(/&/g, '&amp;')}</C:calendar-data></D:prop></D:propstat></D:response>`]));
    if (m === 'PUT') return new Response(null, { status: 201 });
    if (m === 'DELETE') return new Response(null, { status: 204 });
    return new Response('?', { status: 405 });
  }) as unknown as typeof fetch;
  return chamadas;
}
const URL_DAV = 'https://zimbra.interno/dav/agenda@empresa.com.br/';

test('configuração: só administrador; senha não volta; endereço é validado', async () => {
  const { app } = await criarAppTeste();
  assert.equal((await app.inject({ url: '/api/integracoes/caldav', headers: await entrar(app, 'edita') })).statusCode, 403);
  const adm = await entrar(app, 'master');
  assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/caldav', headers: adm, payload: { url: 'ftp://x' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/integracoes/caldav', headers: adm, payload: { url: URL_DAV, usuario: 'agenda@empresa.com.br', senha: 'segredo-123', agenda: 'Empresa' } })).statusCode, 200);
  const est = (await app.inject({ url: '/api/integracoes/caldav', headers: adm })).json<Record<string, unknown>>();
  assert.equal(est.senha_salva, true); assert.equal(est.origem, 'banco'); assert.equal(est.usuario, 'agenda@empresa.com.br');
  assert.ok(!JSON.stringify(est).includes('segredo-123'));
});

test('testar lista só agendas de eventos; calendário lê eventos com Basic auth; criar e excluir', async () => {
  const mes = mesAtual();
  const chamadas = simular(mes);
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  const antes = (await app.inject({ url: `/api/calendario?mes=${mes}`, headers: adm })).json<{ conectado: boolean }>();
  assert.equal(antes.conectado, false);
  await app.inject({ method: 'PUT', url: '/api/integracoes/caldav', headers: adm, payload: { url: URL_DAV, usuario: 'agenda@empresa.com.br', senha: 'segredo-123', agenda: 'Empresa' } });
  const t = await app.inject({ method: 'POST', url: '/api/integracoes/caldav/testar', headers: adm, payload: {} });
  assert.deepEqual(t.json(), { ok: true, agendas: ['Empresa'] });
  assert.equal(chamadas[0].auth, `Basic ${Buffer.from('agenda@empresa.com.br:segredo-123').toString('base64')}`);

  const cal = (await app.inject({ url: `/api/calendario?mes=${mes}`, headers: adm })).json<{ conectado: boolean; eventos: Record<string, unknown>[] }>();
  assert.equal(cal.conectado, true);
  assert.equal(cal.eventos.length, 1);
  assert.equal(cal.eventos[0].titulo, 'Reunião geral');
  assert.equal(cal.eventos[0].inicio, `${mes}-10 09:00`);
  assert.deepEqual(Object.keys(cal.eventos[0]).sort(), ['agenda', 'dia_inteiro', 'fim', 'id', 'inicio', 'local', 'titulo']);
  const report = chamadas.find((c) => c.metodo === 'REPORT')!;
  assert.match(report.corpo, /calendar-query/); assert.match(report.corpo, /expand/);

  const criar = await app.inject({ method: 'POST', url: '/api/calendario', headers: adm, payload: { titulo: 'Confraternização, geral', data: `${mes}-20`, data_fim: `${mes}-20`, dia_inteiro: true } });
  assert.equal(criar.statusCode, 201);
  const put = chamadas.find((c) => c.metodo === 'PUT')!;
  assert.match(put.caminho, /^\/dav\/agenda@empresa\.com\.br\/Calendar\/[\w-]+\.ics$/);
  assert.equal(put.ctype, 'text/calendar; charset=utf-8');
  assert.match(put.corpo, /SUMMARY:Confraternização\\, geral/);
  assert.match(put.corpo, new RegExp(`DTSTART;VALUE=DATE:${mes.replace('-', '')}20`));
  assert.match(put.corpo, new RegExp(`DTEND;VALUE=DATE:${mes.replace('-', '')}21`)); // fim exclusivo

  const id = cal.eventos[0].id as string;
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/calendario/${id}`, headers: adm })).statusCode, 200);
  assert.equal(chamadas.find((c) => c.metodo === 'DELETE')!.caminho, '/dav/agenda@empresa.com.br/Calendar/1.ics');
  // identificador que aponta para fora da pasta configurada é recusado
  const fora = Buffer.from('/outra/pasta/x.ics').toString('base64url');
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/calendario/${fora}`, headers: adm })).statusCode, 400);
});

test('senha errada: mensagem clara, sem derrubar o calendário', async () => {
  globalThis.fetch = (async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
  const { app } = await criarAppTeste();
  const adm = await entrar(app, 'master');
  await app.inject({ method: 'PUT', url: '/api/integracoes/caldav', headers: adm, payload: { url: URL_DAV, usuario: 'x', senha: 'errada', agenda: 'Empresa' } });
  const t = await app.inject({ method: 'POST', url: '/api/integracoes/caldav/testar', headers: adm, payload: {} });
  assert.equal(t.statusCode, 400);
  assert.match(t.json<{ erro: string }>().erro, /usuário ou a senha/);
  const cal = await app.inject({ url: `/api/calendario?mes=${mesAtual()}`, headers: adm });
  assert.equal(cal.statusCode, 200);
  assert.match(cal.json<{ erro: string }>().erro, /indispon/i);
});
