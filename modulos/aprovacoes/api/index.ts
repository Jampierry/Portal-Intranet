// Fluxo de aprovação de publicações. Quem tem "precisa de aprovação para publicar" no cadastro envia o que cria para a fila do RH:
//  - comunicado do portal: fica em rascunho até ser aprovado; ao aprovar, sobe no portal (e dispara os avisos de sempre);
//  - publicação para rede social (Instagram etc.): registrada com plataforma, legenda e imagem; ao aprovar, a equipe publica na plataforma e marca como publicada.
// Em qualquer caso, quem pediu recebe o retorno (push e sino); na rejeição, o RH informa o motivo.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import type { ABAS_COM_APROVACAO } from '../../acessos/api/permissoes.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { avisarNovoComunicado } from '../../avisos/api/index.ts';
import { avisarPushComunicado, enviarPush } from '../../push/api/index.ts';
import { corpoObjeto, inteiro, texto } from '../../../servidor/src/validar.ts';

export type TipoAprovacao = 'comunicado' | 'rede_social' | 'banner' | 'documento';
const LINK_TIPO: Record<TipoAprovacao, string> = { comunicado: '/#publicar/comunicados', rede_social: '/#publicar/redes', banner: '/#publicar/banners', documento: '/#publicar/documentos' };
export const PLATAFORMAS: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp', outra: 'Outra plataforma' };

/** A pessoa precisa de aprovação do RH para publicar nesta aba? Vale a permissão `pub.<aba>.aprovacao` (do perfil ou do ajuste do usuário); o administrador nunca precisa. */
export const exigeAprovacao = (u: { perfil: string; permissoes: string[] }, aba: (typeof ABAS_COM_APROVACAO)[number]) =>
  u.perfil !== 'admin' && u.permissoes.includes(`pub.${aba}.aprovacao`);

/** Cancela pedidos pendentes do mesmo conteúdo (um novo envio substitui o anterior). */
/** Data de hoje no horário do servidor (AAAA-MM-DD); toISOString daria o dia seguinte à noite no Brasil. */
export const dataLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function cancelarPendentes(db: Banco, tipo: TipoAprovacao, registroId: number) {
  db.prepare("UPDATE aprovacoes SET status = 'cancelado', decidido_em = ? WHERE tipo = ? AND registro_id = ? AND status = 'pendente'").run(new Date().toISOString(), tipo, registroId);
}

/** Coloca o conteúdo na fila do RH e avisa (push) quem decide. Devolve o id do pedido. */
export function solicitarAprovacao(db: Banco, o: { tipo: TipoAprovacao; registroId: number; titulo: string; detalhe?: string; solicitanteId: number }): number {
  cancelarPendentes(db, o.tipo, o.registroId);
  const id = Number(db.prepare('INSERT INTO aprovacoes (tipo, registro_id, titulo, detalhe, solicitante_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(o.tipo, o.registroId, o.titulo, o.detalhe ?? null, o.solicitanteId, new Date().toISOString()).lastInsertRowid);
  const quem = (db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(o.solicitanteId) as { nome: string } | undefined)?.nome ?? 'Alguém';
  void enviarPush(db, 'todos', { titulo: 'Publicação aguardando aprovação', corpo: `${quem} enviou «${o.titulo}» para aprovação.`, url: '/#publicar/aprovacoes', tag: `aprovacao-${id}` }, 'pub.aprovacoes.decidir');
  return id;
}

interface Linha { id: number; tipo: TipoAprovacao; registro_id: number; titulo: string; detalhe: string | null; solicitante_id: number; solicitante: string; status: string; motivo: string | null; decidido_por: number | null; decisor: string | null; decidido_em: string | null; criado_em: string }
const SELECT = `SELECT a.id, a.tipo, a.registro_id, a.titulo, a.detalhe, a.solicitante_id, s.nome AS solicitante, a.status, a.motivo, a.decidido_por, d.nome AS decisor, a.decidido_em, a.criado_em
                  FROM aprovacoes a JOIN usuarios s ON s.id = a.solicitante_id LEFT JOIN usuarios d ON d.id = a.decidido_por`;

export async function rotasAprovacoes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  /** Prévia do conteúdo para quem decide enxergar o que está aprovando. */
  const previa = (l: Linha) => {
    if (l.tipo === 'comunicado') {
      const c = db.prepare('SELECT titulo, resumo, corpo, categoria, prioridade, imagem, exibir_de, exibir_ate, exige_leitura FROM comunicados WHERE id = ?').get(l.registro_id) as Record<string, unknown> | undefined;
      return c ? { ...c, tipo: 'comunicado' } : null;
    }
    if (l.tipo === 'banner') {
      const b = db.prepare('SELECT titulo, subtitulo, imagem, botao_texto, link, posicao, ordem, exibir_de, exibir_ate FROM banners WHERE id = ?').get(l.registro_id) as Record<string, unknown> | undefined;
      return b ? { ...b, tipo: 'banner' } : null;
    }
    if (l.tipo === 'documento') {
      const d = db.prepare('SELECT titulo, resumo, categoria, formato, versao, responsavel, classificacao, origem, link_oficial, revisado_em, exibir_de FROM documentos WHERE id = ?').get(l.registro_id) as Record<string, unknown> | undefined;
      return d ? { ...d, tipo: 'documento' } : null;
    }
    const r = db.prepare('SELECT plataforma, titulo, legenda, imagem, link, data_prevista FROM publicacoes_externas WHERE id = ?').get(l.registro_id) as { plataforma: string } & Record<string, unknown> | undefined;
    const anexos = db.prepare('SELECT id, nome, tipo, tamanho FROM publicacoes_anexos WHERE publicacao_id = ? ORDER BY id').all(l.registro_id);
    return r ? { ...r, tipo: 'rede_social', plataforma_nome: PLATAFORMAS[r.plataforma] ?? r.plataforma, anexos } : null;
  };

  // Fila e histórico (quem decide).
  app.get('/api/aprovacoes', { preHandler: exigirPerm('pub.aprovacoes.ver') }, async (req) => {
    const so = (req.query as { situacao?: string }).situacao;
    const filtro = so === 'pendentes' ? "WHERE a.status = 'pendente'" : so === 'historico' ? "WHERE a.status <> 'pendente' AND a.status <> 'cancelado'" : "WHERE a.status <> 'cancelado'";
    const linhas = db.prepare(`${SELECT} ${filtro} ORDER BY a.status = 'pendente' DESC, COALESCE(a.decidido_em, a.criado_em) DESC LIMIT 200`).all() as unknown as Linha[];
    return linhas.map((l) => ({ ...l, previa: previa(l) }));
  });

  // Decisão: aprovar (o conteúdo segue) ou rejeitar (com motivo).
  app.post<{ Params: { id: string } }>('/api/aprovacoes/:id/decidir', { preHandler: exigirPerm('pub.aprovacoes.decidir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pedido');
    const l = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as unknown as Linha | undefined;
    if (!l) return resp.code(404).send({ erro: 'Pedido não encontrado.' });
    if (l.status !== 'pendente') return resp.code(409).send({ erro: 'Este pedido já foi respondido ou foi substituído por um novo envio.' });
    const eu = req.usuario!;
    if (l.solicitante_id === eu.id && eu.perfil !== 'admin') return resp.code(403).send({ erro: 'Você não pode aprovar uma publicação que você mesmo enviou.' });
    const c = corpoObjeto(req.body);
    const aprovar = c.aprovar === true;
    const motivo = aprovar ? (texto(c, 'motivo', 'Observação', { max: 500, opcional: true }) as string | null) : String(texto(c, 'motivo', 'Motivo', { min: 3, max: 500 }));
    const agora = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE aprovacoes SET status = ?, motivo = ?, decidido_por = ?, decidido_em = ? WHERE id = ?').run(aprovar ? 'aprovado' : 'rejeitado', motivo, eu.id, agora, id);
      if (l.tipo === 'comunicado') {
        if (aprovar) db.prepare("UPDATE comunicados SET status = 'publicado', publicado_em = COALESCE(publicado_em, ?), atualizado_em = ? WHERE id = ?").run(dataLocal(), agora, l.registro_id);
      } else if (l.tipo === 'banner') {
        if (aprovar) db.prepare('UPDATE banners SET ativo = 1, atualizado_em = ? WHERE id = ?').run(agora, l.registro_id);
      } else if (l.tipo === 'documento') {
        if (aprovar) db.prepare('UPDATE documentos SET publicado = 1, atualizado_em = ? WHERE id = ?').run(agora, l.registro_id);
      } else {
        db.prepare('UPDATE publicacoes_externas SET status = ?, motivo = ?, atualizado_em = ? WHERE id = ?').run(aprovar ? 'aprovada' : 'rejeitada', motivo, agora, l.registro_id);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    auditar(db, eu.id, aprovar ? 'publicacao_aprovada' : 'publicacao_rejeitada', { id, tipo: l.tipo, registro: l.registro_id });
    // aprovado: o comunicado sai no portal e dispara os avisos de sempre (e-mail e push para todos)
    if (aprovar && l.tipo === 'comunicado') {
      const slug = (db.prepare('SELECT slug FROM comunicados WHERE id = ?').get(l.registro_id) as { slug: string } | undefined)?.slug;
      if (slug) { void avisarNovoComunicado(db, slug, eu.id); void avisarPushComunicado(db, slug); }
    }
    // retorno para quem pediu
    const noPortal = l.tipo !== 'rede_social';
    const onde = noPortal ? 'no portal' : `para ${PLATAFORMAS[l.detalhe ?? ''] ?? 'a rede social'}`;
    void enviarPush(db, [l.solicitante_id], {
      titulo: aprovar ? 'Publicação aprovada' : 'Publicação rejeitada',
      corpo: aprovar ? `«${l.titulo}» foi aprovada${noPortal ? ' e já está no portal' : ': pode publicar na plataforma'}.` : `«${l.titulo}» ${onde} foi rejeitada. Motivo: ${motivo}`,
      url: LINK_TIPO[l.tipo], tag: `aprovacao-${id}`,
    });
    return { ok: true };
  });

  // Sino: o que espera decisão (para quem decide) e as respostas aos meus envios (últimos 7 dias).
  app.get('/api/aprovacoes/caixa', async (req) => {
    const eu = req.usuario!;
    const decide = eu.perfil === 'admin' || eu.permissoes.includes('pub.aprovacoes.decidir');
    const pendentes = decide ? db.prepare(`${SELECT} WHERE a.status = 'pendente' ORDER BY a.criado_em`).all() : [];
    const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const respostas = db.prepare(`${SELECT} WHERE a.solicitante_id = ? AND a.status IN ('aprovado','rejeitado') AND a.decidido_em > ? ORDER BY a.decidido_em DESC`).all(eu.id, desde);
    return { pendentes, respostas };
  });

  // Minhas solicitações (para a pessoa acompanhar o andamento).
  app.get('/api/aprovacoes/minhas', async (req) => db.prepare(`${SELECT} WHERE a.solicitante_id = ? AND a.status <> 'cancelado' ORDER BY a.id DESC LIMIT 50`).all(req.usuario!.id));
}

