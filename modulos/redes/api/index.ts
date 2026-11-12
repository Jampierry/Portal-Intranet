// Publicações para redes sociais (Instagram, Facebook, LinkedIn…): a pessoa registra plataforma, legenda e imagem e envia para a aprovação do RH.
// Quem não precisa de aprovação (cadastro do usuário) fica com a publicação "aprovada" na hora. Depois de aprovada, a equipe publica na plataforma
// e marca como "publicada" (com o link do post, se quiser). A publicação automática por API das plataformas é uma etapa futura.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { cancelarPendentes, exigeAprovacao, PLATAFORMAS, solicitarAprovacao } from '../../aprovacoes/api/index.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

const CAMPOS = `p.id, p.plataforma, p.titulo, p.legenda, p.imagem, p.link, p.data_prevista, p.status, p.motivo, p.link_publicado, p.publicada_em, p.criado_por, p.criado_em, p.atualizado_em,
  (SELECT u.nome FROM usuarios u WHERE u.id = p.criado_por) AS autor`;

function urlHttp(v: string | null, rotulo: string): string | null {
  if (!v) return null;
  try { const u = new URL(v); if (u.protocol === 'http:' || u.protocol === 'https:') return u.href; } catch { /* abaixo */ }
  throw new ErroValidacao(`${rotulo}: use um endereço que comece com http:// ou https://.`);
}

export async function rotasRedes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const buscar = (id: number) => db.prepare(`SELECT ${CAMPOS} FROM publicacoes_externas p WHERE p.id = ?`).get(id) as { id: number; status: string; titulo: string; plataforma: string } | undefined;

  function ler(c: Record<string, unknown>) {
    const imagem = texto(c, 'imagem', 'Imagem', { max: 300, opcional: true });
    if (imagem && !/^\/api\/imagens\/[\w.-]+$/.test(imagem)) throw new ErroValidacao('Imagem: envie a imagem pela tela.');
    return {
      plataforma: escolha(c, 'plataforma', 'Plataforma', Object.keys(PLATAFORMAS) as [string, ...string[]], 'instagram'),
      titulo: String(texto(c, 'titulo', 'Título (uso interno)', { min: 3, max: 120 })),
      legenda: texto(c, 'legenda', 'Legenda / texto da publicação', { max: 2200, opcional: true }),
      imagem,
      link: urlHttp(texto(c, 'link', 'Link', { max: 500, opcional: true }), 'Link'),
      data_prevista: dataIso(c, 'data_prevista', 'Data prevista'),
    };
  }

  app.get('/api/gestao/redes', { preHandler: exigirPerm('pub.redes.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM publicacoes_externas p ORDER BY p.id DESC`).all());

  app.post('/api/gestao/redes', { preHandler: exigirPerm('pub.redes.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const agora = new Date().toISOString();
    const id = Number(db.prepare('INSERT INTO publicacoes_externas (plataforma, titulo, legenda, imagem, link, data_prevista, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(d.plataforma, d.titulo, d.legenda, d.imagem, d.link, d.data_prevista, req.usuario!.id, agora, agora).lastInsertRowid);
    auditar(db, req.usuario!.id, 'rede_criada', { id, plataforma: d.plataforma });
    return resp.code(201).send(buscar(id));
  });

  // Só dá para editar enquanto é rascunho ou depois de rejeitada (volta a rascunho para corrigir e reenviar).
  app.put<{ Params: { id: string } }>('/api/gestao/redes/:id', { preHandler: exigirPerm('pub.redes.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Publicação');
    const atual = buscar(id);
    if (!atual) return resp.code(404).send({ erro: 'Publicação não encontrada.' });
    if (!['rascunho', 'rejeitada'].includes(atual.status)) return resp.code(409).send({ erro: 'Esta publicação já foi enviada. Só dá para editar rascunho ou publicação rejeitada.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare("UPDATE publicacoes_externas SET plataforma = ?, titulo = ?, legenda = ?, imagem = ?, link = ?, data_prevista = ?, status = 'rascunho', atualizado_em = ? WHERE id = ?")
      .run(d.plataforma, d.titulo, d.legenda, d.imagem, d.link, d.data_prevista, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'rede_alterada', { id });
    return buscar(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/redes/:id', { preHandler: exigirPerm('pub.redes.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Publicação');
    const atual = buscar(id);
    if (!atual) return resp.code(404).send({ erro: 'Publicação não encontrada.' });
    if (atual.status === 'em_aprovacao') return resp.code(409).send({ erro: 'Esta publicação está na fila de aprovação. Peça ao RH para decidir primeiro.' });
    cancelarPendentes(db, 'rede_social', id);
    db.prepare('DELETE FROM publicacoes_externas WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'rede_apagada', { id });
    return { ok: true };
  });

  // Enviar para a aprovação do RH (quem não precisa de aprovação já fica com ela aprovada).
  app.post<{ Params: { id: string } }>('/api/gestao/redes/:id/enviar', { preHandler: exigirPerm('pub.redes.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Publicação');
    const atual = buscar(id);
    if (!atual) return resp.code(404).send({ erro: 'Publicação não encontrada.' });
    if (!['rascunho', 'rejeitada'].includes(atual.status)) return resp.code(409).send({ erro: 'Esta publicação já foi enviada.' });
    const agora = new Date().toISOString();
    if (exigeAprovacao(db, req.usuario!.id)) {
      db.prepare("UPDATE publicacoes_externas SET status = 'em_aprovacao', motivo = NULL, atualizado_em = ? WHERE id = ?").run(agora, id);
      solicitarAprovacao(db, { tipo: 'rede_social', registroId: id, titulo: atual.titulo, detalhe: atual.plataforma, solicitanteId: req.usuario!.id });
    } else {
      db.prepare("UPDATE publicacoes_externas SET status = 'aprovada', motivo = NULL, atualizado_em = ? WHERE id = ?").run(agora, id);
    }
    auditar(db, req.usuario!.id, 'rede_enviada', { id, direta: !exigeAprovacao(db, req.usuario!.id) });
    return buscar(id);
  });

  // Depois de aprovada, a equipe publica na plataforma e registra aqui.
  app.post<{ Params: { id: string } }>('/api/gestao/redes/:id/publicada', { preHandler: exigirPerm('pub.redes.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Publicação');
    const atual = buscar(id);
    if (!atual) return resp.code(404).send({ erro: 'Publicação não encontrada.' });
    if (atual.status !== 'aprovada') return resp.code(409).send({ erro: 'Só dá para marcar como publicada uma publicação aprovada.' });
    const c = corpoObjeto(req.body);
    const link = urlHttp(texto(c, 'link_publicado', 'Link da publicação', { max: 500, opcional: true }), 'Link da publicação');
    const agora = new Date().toISOString();
    db.prepare("UPDATE publicacoes_externas SET status = 'publicada', link_publicado = ?, publicada_em = ?, atualizado_em = ? WHERE id = ?").run(link, agora, agora, id);
    auditar(db, req.usuario!.id, 'rede_publicada', { id });
    return buscar(id);
  });
}
