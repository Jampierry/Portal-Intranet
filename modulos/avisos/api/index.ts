// Aviso de novos comunicados por e-mail. Quando um comunicado é publicado pela primeira vez, quem tem e-mail cadastrado,
// não desligou os avisos e pode ver comunicados recebe uma mensagem padronizada enviada pelo serviço Zimbra (POST /api/notificar).
// Configuração em Configurações › Integrações (cfg.integracoes.*); cada pessoa liga/desliga em "Minha conta".
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { permissoesEfetivas } from '../../acessos/api/permissoes.ts';
import { chamarZimbra, conexaoZimbra, ErroZimbra } from '../../integracoes/api/zimbra.ts';
import { corpoObjeto, ErroValidacao } from '../../../servidor/src/validar.ts';

export interface ConfigAvisos { ativo: boolean; so_urgentes: boolean; url_portal: string }
const PADRAO: ConfigAvisos = { ativo: false, so_urgentes: true, url_portal: '' };
const CHAVE = 'avisos_email';
const LOTE = 40;

export function lerAvisos(db: Banco): ConfigAvisos {
  const r = db.prepare('SELECT valor FROM portal_config WHERE chave = ?').get(CHAVE) as { valor: string } | undefined;
  if (!r) return { ...PADRAO };
  try { return { ...PADRAO, ...(JSON.parse(r.valor) as Partial<ConfigAvisos>) }; } catch { return { ...PADRAO }; }
}
function gravarAvisos(db: Banco, c: ConfigAvisos) {
  db.prepare('INSERT INTO portal_config (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em')
    .run(CHAVE, JSON.stringify(c), new Date().toISOString());
}
const nomePortal = (db: Banco) => {
  const r = db.prepare("SELECT valor FROM portal_config WHERE chave = 'empresa'").get() as { valor: string } | undefined;
  try { return String((JSON.parse(r?.valor ?? '{}') as { nome_portal?: string }).nome_portal || 'Portal Intranet'); } catch { return 'Portal Intranet'; }
};

export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Destinatários: ativos, com e-mail, que não desligaram os avisos e podem ver comunicados. */
export function destinatarios(db: Banco): string[] {
  const linhas = db.prepare("SELECT email, perfil, permissoes FROM usuarios WHERE ativo = 1 AND avisos_email = 1 AND email IS NOT NULL AND email <> ''").all() as { email: string; perfil: string; permissoes: string | null }[];
  const vistos = new Set<string>();
  for (const l of linhas) if (permissoesEfetivas(db, l.perfil, l.permissoes).includes('ver.comunicados')) vistos.add(l.email.toLowerCase());
  return [...vistos];
}

/** Envia o aviso de um comunicado recém-publicado (uma vez só). Nunca lança: falhas ficam na auditoria. */
export async function avisarNovoComunicado(db: Banco, slug: string, quem: number | null): Promise<void> {
  try {
    const cfg = lerAvisos(db);
    if (!cfg.ativo) return;
    const c = db.prepare("SELECT id, titulo, resumo, prioridade, status, notificado_em FROM comunicados WHERE slug = ?").get(slug) as { id: number; titulo: string; resumo: string; prioridade: string; status: string; notificado_em: string | null } | undefined;
    if (!c || c.status !== 'publicado' || c.notificado_em) return;
    if (cfg.so_urgentes && c.prioridade !== 'urgente') return;
    // marca antes de enviar: duas edições seguidas não mandam duas vezes
    db.prepare('UPDATE comunicados SET notificado_em = ? WHERE id = ?').run(new Date().toISOString(), c.id);
    const conexao = conexaoZimbra(db);
    if (!conexao) { auditar(db, quem, 'avisos_email_sem_conexao', { slug }); return; }
    const para = destinatarios(db);
    let enviados = 0, falhas = 0;
    const urgente = c.prioridade === 'urgente';
    const base = cfg.url_portal.replace(/\/+$/, '');
    for (let i = 0; i < para.length; i += LOTE) {
      try {
        const r = await chamarZimbra<{ enviados?: number }>(conexao, 'POST', '/api/notificar', {
          para: para.slice(i, i + LOTE), assunto: `${urgente ? 'URGENTE: ' : 'Novo comunicado: '}${c.titulo}`, titulo: c.titulo, mensagem: c.resumo,
          ...(base ? { botao_texto: 'Abrir no portal', botao_link: `${base}/#comunicados/${encodeURIComponent(slug)}` } : {}), app: nomePortal(db),
        }, 60_000);
        enviados += r.enviados ?? Math.min(LOTE, para.length - i);
      } catch { falhas += Math.min(LOTE, para.length - i); }
    }
    auditar(db, quem, 'avisos_email_enviados', { slug, destinatarios: para.length, enviados, falhas });
  } catch { /* o aviso nunca atrapalha a publicação */ }
}

export async function rotasAvisos(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // ----- Sino: avisos que a pessoa já abriu ou limpou -----
  app.get('/api/avisos/lidos', async (req) => ({ chaves: (db.prepare('SELECT chave FROM avisos_lidos WHERE usuario_id = ?').all(req.usuario!.id) as { chave: string }[]).map((r) => r.chave) }));
  app.post('/api/avisos/lidos', async (req) => {
    const c = corpoObjeto(req.body);
    const lista = Array.isArray(c.chaves) ? c.chaves.map(String) : [];
    if (lista.length === 0 || lista.length > 200) throw new ErroValidacao('Informe os avisos a marcar como lidos.');
    if (!lista.every((k) => /^(urgente|resposta|aprov):[\w.%-]{1,120}$/.test(k))) throw new ErroValidacao('Aviso inválido.');
    const ins = db.prepare('INSERT OR IGNORE INTO avisos_lidos (usuario_id, chave, em) VALUES (?, ?, ?)');
    const agora = new Date().toISOString();
    for (const k of lista) ins.run(req.usuario!.id, k, agora);
    auditar(db, req.usuario!.id, 'avisos_lidos', { quantidade: lista.length });
    return { ok: true };
  });

  const ver = { preHandler: exigirPerm('cfg.integracoes.ver') }, editar = { preHandler: exigirPerm('cfg.integracoes.editar') };

  app.get('/api/integracoes/avisos', ver, async () => ({ ...lerAvisos(db), destinatarios: destinatarios(db).length, conectado: !!conexaoZimbra(db) }));
  app.put('/api/integracoes/avisos', editar, async (req) => {
    const c = corpoObjeto(req.body);
    let url = String(c.url_portal ?? '').trim();
    if (url) {
      try { const u = new URL(url); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); url = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`; }
      catch { throw new ErroValidacao('Endereço do portal: use http:// ou https:// (ex.: https://portal.suaempresa.com.br).'); }
    }
    const nova: ConfigAvisos = { ativo: c.ativo === true, so_urgentes: c.so_urgentes !== false, url_portal: url };
    gravarAvisos(db, nova);
    auditar(db, req.usuario!.id, 'avisos_email_configurados', { ativo: nova.ativo, so_urgentes: nova.so_urgentes });
    return { ...nova, destinatarios: destinatarios(db).length, conectado: !!conexaoZimbra(db) };
  });
  // E-mail de teste para o próprio e-mail de quem pede.
  app.post('/api/integracoes/avisos/teste', editar, async (req, resp) => {
    const eu = db.prepare('SELECT email FROM usuarios WHERE id = ?').get(req.usuario!.id) as { email: string | null };
    if (!eu.email) return resp.code(400).send({ erro: 'Cadastre o seu e-mail em Configurações › Usuários › Editar para receber o teste.' });
    const conexao = conexaoZimbra(db);
    if (!conexao) return resp.code(400).send({ erro: 'Ainda não há conexão com o serviço Zimbra (Configurações › Integrações).' });
    try {
      await chamarZimbra(conexao, 'POST', '/api/notificar', { para: eu.email, assunto: 'Teste de aviso do portal', titulo: 'Teste de aviso', mensagem: 'Se você recebeu este e-mail, os avisos de comunicados por e-mail estão funcionando.', app: nomePortal(db) });
    } catch (e) { if (e instanceof ErroZimbra) return resp.code(e.status).send({ erro: e.message }); throw e; }
    auditar(db, req.usuario!.id, 'avisos_email_teste', {});
    return { ok: true, para: eu.email };
  });

  // Preferência de cada pessoa ("Minha conta").
  app.get('/api/eu/avisos', async (req) => db.prepare('SELECT email, avisos_email FROM usuarios WHERE id = ?').get(req.usuario!.id));
  app.put('/api/eu/avisos', async (req) => {
    const c = corpoObjeto(req.body);
    db.prepare('UPDATE usuarios SET avisos_email = ? WHERE id = ?').run(c.avisos_email === false ? 0 : 1, req.usuario!.id);
    auditar(db, req.usuario!.id, 'avisos_email_preferencia', { avisos_email: c.avisos_email !== false });
    return db.prepare('SELECT email, avisos_email FROM usuarios WHERE id = ?').get(req.usuario!.id);
  });
}
