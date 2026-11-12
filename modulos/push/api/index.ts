// Avisos push (Web Push) para computador e celular. Cada pessoa ativa os avisos em "Minha conta" em cada aparelho; o servidor manda a
// notificação mesmo com o portal fechado. Todo aviso do sistema passa por `enviarPush` (comunicados, pedidos de edição, pesquisas…).
// Exige HTTPS no endereço público (ou localhost em testes); no iPhone, o portal precisa estar instalado na tela inicial.
import * as webpush from 'web-push';
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { permissoesEfetivas } from '../../acessos/api/permissoes.ts';
import { corpoObjeto, ErroValidacao } from '../../../servidor/src/validar.ts';

export interface Mensagem { titulo: string; corpo: string; /** Endereço aberto ao clicar (ex.: "/#comunicados/slug"). */ url?: string; /** Mensagens com a mesma tag se substituem. */ tag?: string }
interface Vapid { publica: string; privada: string }
type Enviador = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, carga: string, opcoes: webpush.RequestOptions) => Promise<{ statusCode: number }>;
let enviador: Enviador = (sub, carga, opcoes) => webpush.sendNotification(sub, carga, opcoes);
/** Só para testes: troca o envio real por um simulado. */
export const definirEnviadorPush = (f: Enviador | null) => { enviador = f ?? ((sub, carga, opcoes) => webpush.sendNotification(sub, carga, opcoes)); };

const CHAVE = 'push_vapid';
const ASSUNTO = process.env.PUSH_ASSUNTO || 'mailto:portal@localhost.com';

/** Chaves do servidor (VAPID): geradas uma vez e guardadas no banco. */
export function chavesVapid(db: Banco): Vapid {
  const r = db.prepare('SELECT valor FROM portal_config WHERE chave = ?').get(CHAVE) as { valor: string } | undefined;
  if (r) { try { return JSON.parse(r.valor) as Vapid; } catch { /* regenera abaixo */ } }
  const k = webpush.generateVAPIDKeys();
  const v: Vapid = { publica: k.publicKey, privada: k.privateKey };
  db.prepare('INSERT INTO portal_config (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em')
    .run(CHAVE, JSON.stringify(v), new Date().toISOString());
  return v;
}

interface Alvo { id: number; perfil: string; permissoes: string | null }
/** Manda o aviso para as pessoas indicadas (ids), ou para todas (`'todos'`), opcionalmente só as que passam no filtro de permissão. Nunca lança. */
export async function enviarPush(db: Banco, destino: number[] | 'todos', msg: Mensagem, exigePermissao?: string): Promise<{ enviados: number; removidos: number }> {
  const saldo = { enviados: 0, removidos: 0 };
  try {
    const ids = destino === 'todos' ? null : destino;
    if (ids && ids.length === 0) return saldo;
    const usuarios = db.prepare('SELECT id, perfil, permissoes FROM usuarios WHERE ativo = 1').all() as unknown as Alvo[];
    const aceitos = new Set(usuarios.filter((u) => (!ids || ids.includes(u.id)) && (!exigePermissao || permissoesEfetivas(db, u.perfil, u.permissoes).includes(exigePermissao))).map((u) => u.id));
    if (aceitos.size === 0) return saldo;
    const subs = (db.prepare('SELECT id, usuario_id, endpoint, p256dh, auth FROM push_inscricoes').all() as { id: number; usuario_id: number; endpoint: string; p256dh: string; auth: string }[]).filter((s) => aceitos.has(s.usuario_id));
    if (subs.length === 0) return saldo;
    const v = chavesVapid(db);
    const carga = JSON.stringify({ titulo: msg.titulo, corpo: msg.corpo, url: msg.url ?? '/', tag: msg.tag });
    for (let i = 0; i < subs.length; i += 20) {
      await Promise.all(subs.slice(i, i + 20).map(async (s) => {
        try {
          await enviador({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { vapidDetails: { subject: ASSUNTO, publicKey: v.publica, privateKey: v.privada }, TTL: 12 * 3600, urgency: 'normal' });
          saldo.enviados++;
        } catch (e) {
          const codigo = (e as { statusCode?: number }).statusCode;
          if (codigo === 404 || codigo === 410) { db.prepare('DELETE FROM push_inscricoes WHERE id = ?').run(s.id); saldo.removidos++; } // aparelho desfez a inscrição
        }
      }));
    }
  } catch { /* aviso nunca derruba a operação que o disparou */ }
  return saldo;
}

/** Comunicado recém-publicado: avisa uma vez só quem pode ver comunicados. */
export async function avisarPushComunicado(db: Banco, slug: string): Promise<void> {
  try {
    const c = db.prepare('SELECT id, titulo, resumo, prioridade, status, push_em, exige_leitura FROM comunicados WHERE slug = ?').get(slug) as { id: number; titulo: string; resumo: string; prioridade: string; status: string; push_em: string | null; exige_leitura: number } | undefined;
    if (!c || c.status !== 'publicado' || c.push_em) return;
    db.prepare('UPDATE comunicados SET push_em = ? WHERE id = ?').run(new Date().toISOString(), c.id); // marca antes: duas edições seguidas não avisam duas vezes
    const urgente = c.prioridade === 'urgente';
    await enviarPush(db, 'todos', { titulo: `${urgente ? 'URGENTE: ' : 'Novo comunicado: '}${c.titulo}`, corpo: c.exige_leitura ? `${c.resumo} (confirme a leitura)` : c.resumo, url: `/#comunicados/${encodeURIComponent(slug)}`, tag: `comunicado-${c.id}` }, 'ver.comunicados');
  } catch { /* ignora */ }
}

/** Outros módulos pedem para ser avisados quando alguém ativa o push (ex.: pesquisas pendentes para quem acabou de entrar). Chave = nome, para não duplicar. */
const ganchosInscricao = new Map<string, (db: Banco, usuarioId: number) => Promise<void>>();
export const aoInscrever = (nome: string, f: (db: Banco, usuarioId: number) => Promise<void>) => { ganchosInscricao.set(nome, f); };

export async function rotasPush(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/push/chave', async () => ({ chave: chavesVapid(db).publica }));

  app.post('/api/push/inscrever', async (req) => {
    const c = corpoObjeto(req.body);
    const k = corpoObjeto(c.keys);
    const endpoint = String(c.endpoint ?? ''), p256dh = String(k.p256dh ?? ''), auth = String(k.auth ?? '');
    if (!/^https:\/\/[^\s]{10,2000}$/.test(endpoint) || !/^[\w-]{20,200}$/.test(p256dh) || !/^[\w-]{10,100}$/.test(auth)) throw new ErroValidacao('Inscrição de aviso inválida.');
    const jaTinha = !!db.prepare('SELECT 1 FROM push_inscricoes WHERE endpoint = ? AND usuario_id = ?').get(endpoint, req.usuario!.id);
    db.prepare('INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth, agente, criado_em) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth')
      .run(req.usuario!.id, endpoint, p256dh, auth, String(req.headers['user-agent'] ?? '').slice(0, 200), new Date().toISOString());
    if (!jaTinha) for (const g of ganchosInscricao.values()) void g(db, req.usuario!.id); // aparelho novo: avisa o que está pendente
    return { ok: true };
  });

  app.post('/api/push/cancelar', async (req) => {
    const endpoint = String(corpoObjeto(req.body).endpoint ?? '');
    db.prepare('DELETE FROM push_inscricoes WHERE endpoint = ? AND usuario_id = ?').run(endpoint, req.usuario!.id);
    return { ok: true };
  });

  /** Quantos aparelhos desta pessoa recebem avisos. */
  app.get('/api/push/meus', async (req) => ({ aparelhos: (db.prepare('SELECT COUNT(*) n FROM push_inscricoes WHERE usuario_id = ?').get(req.usuario!.id) as { n: number }).n }));

  app.post('/api/push/teste', async (req) => {
    const r = await enviarPush(db, [req.usuario!.id], { titulo: 'Avisos ativados', corpo: 'Você vai receber os avisos do portal neste aparelho.', url: '/', tag: 'teste' });
    return r;
  });
}
