// Agenda por CalDAV (RFC 4791), direto do portal, sem o serviço zimbra-mcp. Serve para o Zimbra (https://<servidor>/dav/<conta>/) e para
// qualquer servidor CalDAV (Nextcloud, Google com senha de app etc.). Endereço, usuário, senha e agenda ficam no banco (Configurações ›
// Integrações) ou nas variáveis CALDAV_URL / CALDAV_USUARIO / CALDAV_SENHA / CALDAV_AGENDA. A senha nunca volta para o navegador.
// Todas as chamadas partem do servidor e só vão para a mesma origem (protocolo + endereço) configurada: um `href` de outro lugar é recusado.
import { randomUUID } from 'node:crypto';
import type { Banco } from '../../../servidor/src/db.ts';

export interface ConexaoCalDav { url: string; usuario: string; senha: string; agenda: string; origem: 'banco' | 'ambiente' }
export interface AgendaCalDav { nome: string; href: string }
export interface EventoCalDav { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string }

export class ErroCalDav extends Error {
  status: number;
  constructor(mensagem: string, status = 502) { super(mensagem); this.status = status; }
}

const CHAVES = { url: 'caldav.url', usuario: 'caldav.usuario', senha: 'caldav.senha', agenda: 'caldav.agenda' } as const;
const ler = (db: Banco, chave: string) => (db.prepare('SELECT valor FROM integracoes WHERE chave = ?').get(chave) as { valor: string } | undefined)?.valor ?? '';

export function gravarCalDav(db: Banco, chave: keyof typeof CHAVES, valor: string) {
  if (valor === '') db.prepare('DELETE FROM integracoes WHERE chave = ?').run(CHAVES[chave]);
  else db.prepare('INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em').run(CHAVES[chave], valor, new Date().toISOString());
}
export const urlCalDavSalva = (db: Banco) => ler(db, CHAVES.url);
export const usuarioCalDavSalvo = (db: Banco) => ler(db, CHAVES.usuario);
export const temSenhaCalDav = (db: Banco) => ler(db, CHAVES.senha) !== '';
export const agendaCalDavSalva = (db: Banco) => ler(db, CHAVES.agenda);

/** O que foi salvo na tela vale primeiro; sem isso, o ambiente. Sem endereço, usuário e senha = não conectado. */
export function conexaoCalDav(db: Banco): ConexaoCalDav | null {
  const url = ler(db, CHAVES.url), usuario = ler(db, CHAVES.usuario), senha = ler(db, CHAVES.senha);
  if (url && usuario && senha) return { url, usuario, senha, agenda: ler(db, CHAVES.agenda), origem: 'banco' };
  const eu = process.env.CALDAV_URL?.trim(), eus = process.env.CALDAV_USUARIO?.trim(), esn = process.env.CALDAV_SENHA;
  if (eu && eus && esn) return { url: eu, usuario: eus, senha: esn, agenda: process.env.CALDAV_AGENDA?.trim() ?? ler(db, CHAVES.agenda), origem: 'ambiente' };
  return null;
}

// ---------- Fuso horário ----------
const FUSO = () => process.env.PORTAL_FUSO?.trim() || 'America/Sao_Paulo';
const fmt = (fuso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** Quantos ms o relógio de `fuso` está à frente do UTC naquele instante. */
function deslocamento(ts: number, fuso: string): number {
  const p = fmt(fuso).format(new Date(ts)); // "2026-11-20 09:00:00"
  return Date.parse(`${p.replace(' ', 'T')}Z`) - Math.floor(ts / 1000) * 1000;
}
const valido = (fuso: string) => { try { fmt(fuso); return true; } catch { return false; } };

/** Converte um valor de data/hora do iCalendar para o horário do portal ("AAAA-MM-DD" ou "AAAA-MM-DD HH:MM"). */
export function paraHorarioLocal(valor: string, tzid?: string): { texto: string; diaInteiro: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(valor.trim());
  if (!m) return null;
  if (m[4] === undefined) return { texto: `${m[1]}-${m[2]}-${m[3]}`, diaInteiro: true };
  const parede = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  let instante: number | null = null;
  if (m[7]) instante = parede;
  else if (tzid && valido(tzid)) { const chute = parede - deslocamento(parede, tzid); instante = parede - deslocamento(chute, tzid); }
  if (instante === null) return { texto: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`, diaInteiro: false }; // sem fuso (flutuante): vale como está
  const f = fmt(FUSO()).format(new Date(instante));
  return { texto: f.slice(0, 16), diaInteiro: false };
}

// ---------- XML e iCalendar (só o que o CalDAV precisa) ----------
const P = '(?:[\\w-]+:)?';
const entidades = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;/g, '\r').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
function conteudo(s: string): string { const c = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s); return c ? c[1] : entidades(s); }
const blocos = (xml: string) => [...xml.matchAll(new RegExp(`<${P}response[\\s>][\\s\\S]*?</${P}response>`, 'gi'))].map((m) => m[0]);
const tag = (bloco: string, nome: string) => { const m = new RegExp(`<${P}${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${P}${nome}>`, 'i').exec(bloco); return m ? conteudo(m[1]).trim() : ''; };

const desfazer = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dia = (iso: string, soma: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + soma * 86_400_000).toISOString().slice(0, 10);

interface Prop { params: Record<string, string>; valor: string }
/** Lê os VEVENT de um texto iCalendar (com as instâncias já expandidas pelo servidor, quando ele suporta). */
export function lerEventosIcs(ics: string): { uid: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string }[] {
  const linhas = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out: ReturnType<typeof lerEventosIcs> = [];
  let atual: Record<string, Prop> | null = null;
  for (const l of linhas) {
    if (/^BEGIN:VEVENT$/i.test(l)) { atual = {}; continue; }
    if (/^END:VEVENT$/i.test(l)) {
      if (atual) {
        const ini = atual.DTSTART, status = atual.STATUS?.valor.toUpperCase();
        const di = ini && paraHorarioLocal(ini.valor, ini.params.TZID);
        if (di && status !== 'CANCELLED') {
          const f = atual.DTEND;
          const df = f ? paraHorarioLocal(f.valor, f.params.TZID) : null;
          let fim = df ? df.texto : di.texto;
          if (di.diaInteiro) { fim = df && df.diaInteiro ? dia(df.texto, -1) : di.texto; if (fim < di.texto) fim = di.texto; } // DTEND de dia inteiro é exclusivo
          out.push({ uid: atual.UID?.valor ?? '', titulo: desfazer(atual.SUMMARY?.valor ?? '(sem título)').slice(0, 120), inicio: di.texto, fim, dia_inteiro: di.diaInteiro, local: desfazer(atual.LOCATION?.valor ?? '').slice(0, 120) });
        }
      }
      atual = null; continue;
    }
    if (!atual) continue;
    const i = l.indexOf(':'); if (i < 1) continue;
    const [nome, ...ps] = l.slice(0, i).split(';');
    const params: Record<string, string> = {};
    for (const p of ps) { const [k, v] = p.split('='); if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
    const chave = nome.toUpperCase();
    if (!(chave in atual)) atual[chave] = { params, valor: l.slice(i + 1) };
  }
  return out;
}

const dobrar = (l: string) => { const p: string[] = []; for (let i = 0; i < l.length; i += 70) p.push((i ? ' ' : '') + l.slice(i, i + 70)); return p.join('\r\n'); };
const utc = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// ---------- Chamadas ----------
function base(c: ConexaoCalDav): URL {
  try { const u = new URL(c.url); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); return u; }
  catch { throw new ErroCalDav('Endereço do CalDAV inválido. Use http:// ou https:// com o endereço completo.', 400); }
}
function mesmaOrigem(c: ConexaoCalDav, href: string): string {
  const b = base(c); const u = new URL(href, b);
  if (u.origin !== b.origin) throw new ErroCalDav('O servidor indicou um endereço de outra origem; por segurança o portal não o acessa.', 502);
  return u.toString();
}

async function chamar(c: ConexaoCalDav, metodo: string, url: string, corpo?: string, extras: Record<string, string> = {}, timeoutMs = 20_000): Promise<{ status: number; texto: string; cabecalhos: Headers }> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Basic ${Buffer.from(`${c.usuario}:${c.senha}`).toString('base64')}`, ...(corpo !== undefined ? { 'Content-Type': 'application/xml; charset=utf-8' } : {}), ...extras },
      body: corpo, signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new ErroCalDav(`Não foi possível falar com o servidor de agenda (${(e as Error).name === 'TimeoutError' ? 'sem resposta no tempo esperado' : (e as Error).message}). Confira o endereço e se o servidor do portal alcança essa rede.`, 502);
  }
  const texto = await r.text().catch(() => '');
  if (r.status === 401 || r.status === 403) throw new ErroCalDav('O servidor de agenda recusou o usuário ou a senha (ou a conta não tem permissão de CalDAV).', 401);
  return { status: r.status, texto, cabecalhos: r.headers };
}

const PROPFIND = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>`;

const cacheAgendas = new Map<string, { em: number; lista: AgendaCalDav[] }>();
export const limparCacheCalDav = () => cacheAgendas.clear();

/** Agendas (calendários de eventos) que a conta enxerga. O endereço pode ser a pasta da conta (…/dav/conta/) ou uma agenda só. */
export async function listarAgendasCalDav(c: ConexaoCalDav): Promise<AgendaCalDav[]> {
  const chave = `${c.url}|${c.usuario}`, g = cacheAgendas.get(chave);
  if (g && Date.now() - g.em < 10 * 60_000) return g.lista;
  const u = mesmaOrigem(c, c.url);
  const r = await chamar(c, 'PROPFIND', u, PROPFIND, { Depth: '1' });
  if (r.status === 404) throw new ErroCalDav('Endereço não encontrado no servidor de agenda (404). No Zimbra use https://<servidor>/dav/<conta>/ .', 400);
  if (r.status !== 207) throw new ErroCalDav(`O servidor de agenda respondeu ${r.status} em vez de uma lista de agendas. Confira o endereço do CalDAV.`, 502);
  const lista: AgendaCalDav[] = [];
  for (const b of blocos(r.texto)) {
    if (!new RegExp(`<${P}calendar(?:\\s[^>]*)?/?>`, 'i').test(b)) continue; // não é calendário (pasta de contatos, raiz…)
    const comp = tag(b, 'supported-calendar-component-set');
    if (comp && !/name="VEVENT"/i.test(b)) continue; // lista de tarefas
    const href = tag(b, 'href'); if (!href) continue;
    const abs = new URL(href, u); if (abs.origin !== new URL(u).origin) continue;
    const nome = tag(b, 'displayname') || decodeURIComponent(abs.pathname.replace(/\/+$/, '').split('/').pop() ?? '') || 'Agenda';
    lista.push({ nome: nome.slice(0, 80), href: abs.toString() });
  }
  // O endereço pode ser a própria agenda e o servidor não a identificar como calendário na listagem: vale o endereço informado.
  if (!lista.length && blocos(r.texto).length) {
    const fim = decodeURIComponent(new URL(u).pathname.replace(/\/+$/, '').split('/').pop() ?? '');
    lista.push({ nome: fim || 'Agenda', href: u });
  }
  cacheAgendas.set(chave, { em: Date.now(), lista });
  return lista;
}

async function agendaPorNome(c: ConexaoCalDav, nome: string): Promise<AgendaCalDav> {
  const lista = await listarAgendasCalDav(c);
  const a = lista.find((x) => x.nome === nome) ?? lista.find((x) => x.nome.toLowerCase().includes(nome.toLowerCase()));
  if (!a) throw new ErroCalDav(`A agenda “${nome}” não foi encontrada nesta conta.`, 400);
  return a;
}

/** Eventos de uma agenda que tocam o período (datas AAAA-MM-DD). Repetições são expandidas pelo servidor. */
export async function eventosCalDav(c: ConexaoCalDav, agenda: string, primeiroDia: string, ultimoDia: string): Promise<EventoCalDav[]> {
  const a = await agendaPorNome(c, agenda);
  const ini = utc(Date.parse(`${dia(primeiroDia, -1)}T00:00:00Z`)), fim = utc(Date.parse(`${dia(ultimoDia, 2)}T00:00:00Z`));
  const corpo = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data><c:expand start="${ini}" end="${fim}"/></c:calendar-data></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${ini}" end="${fim}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const r = await chamar(c, 'REPORT', a.href, corpo, { Depth: '1' }, 30_000);
  if (r.status !== 207) throw new ErroCalDav(`O servidor de agenda respondeu ${r.status} ao pedir os eventos.`, 502);
  const out: EventoCalDav[] = [];
  for (const b of blocos(r.texto)) {
    const href = tag(b, 'href'), dados = tag(b, 'calendar-data');
    if (!href || !dados) continue;
    let idHref: string; try { idHref = new URL(mesmaOrigem(c, href)).pathname; } catch { continue; }
    const id = Buffer.from(idHref).toString('base64url');
    for (const e of lerEventosIcs(dados)) out.push({ id, titulo: e.titulo, inicio: e.inicio, fim: e.fim, dia_inteiro: e.dia_inteiro, local: e.local });
  }
  return out;
}

/** Cria um evento (data importante) na agenda. Dia inteiro: datas AAAA-MM-DD; com hora: "AAAA-MM-DD HH:MM" no horário do portal. */
export async function criarEventoCalDav(c: ConexaoCalDav, agenda: string, e: { titulo: string; local: string; dia_inteiro: boolean; inicio: string; fim: string }): Promise<string> {
  const a = await agendaPorNome(c, agenda);
  const uid = `${randomUUID()}@portal-intranet`;
  const agora = utc(Date.now());
  let ds: string, de: string;
  if (e.dia_inteiro) {
    ds = `DTSTART;VALUE=DATE:${e.inicio.slice(0, 10).replace(/-/g, '')}`;
    de = `DTEND;VALUE=DATE:${dia(e.fim.slice(0, 10), 1).replace(/-/g, '')}`;
  } else {
    const paraUtc = (t: string) => { const [d, h] = t.split(' '); const parede = Date.parse(`${d}T${h}:00Z`); const f = FUSO(); return utc(parede - deslocamento(parede - deslocamento(parede, f), f)); };
    ds = `DTSTART:${paraUtc(e.inicio)}`; de = `DTEND:${paraUtc(e.fim)}`;
  }
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portal Intranet//PT-BR//', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${agora}`, ds, de,
    dobrar(`SUMMARY:${escapar(e.titulo)}`), ...(e.local ? [dobrar(`LOCATION:${escapar(e.local)}`)] : []), 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  const url = new URL(`${randomUUID()}.ics`, a.href.endsWith('/') ? a.href : `${a.href}/`).toString();
  const r = await chamar(c, 'PUT', url, ics, { 'Content-Type': 'text/calendar; charset=utf-8', 'If-None-Match': '*' }, 30_000);
  if (r.status !== 201 && r.status !== 204 && r.status !== 200) throw new ErroCalDav(`O servidor de agenda não aceitou o evento (resposta ${r.status}). A conta precisa de permissão de escrita nesta agenda.`, r.status === 412 ? 409 : 502);
  limparCacheCalDav();
  return Buffer.from(new URL(url).pathname).toString('base64url');
}

/** Exclui um evento pelo identificador devolvido na leitura. Só aceita endereços dentro da pasta configurada (nada fora dela). */
export async function apagarEventoCalDav(c: ConexaoCalDav, id: string): Promise<void> {
  let caminho: string;
  try { caminho = Buffer.from(id, 'base64url').toString('utf8'); } catch { throw new ErroCalDav('Identificador inválido.', 400); }
  const b = base(c);
  const url = new URL(caminho, b);
  const raiz = b.pathname.endsWith('/') ? b.pathname : `${b.pathname}/`;
  const dentro = url.origin === b.origin && url.pathname.endsWith('.ics') && (url.pathname.startsWith(raiz) || (await listarAgendasCalDav(c)).some((a) => url.pathname.startsWith(new URL(a.href).pathname)));
  if (!dentro) throw new ErroCalDav('Identificador inválido.', 400);
  const r = await chamar(c, 'DELETE', url.toString(), undefined, {}, 30_000);
  if (r.status !== 200 && r.status !== 204 && r.status !== 404) throw new ErroCalDav(`O servidor de agenda não excluiu o evento (resposta ${r.status}). A conta precisa de permissão de escrita nesta agenda.`, 502);
}
