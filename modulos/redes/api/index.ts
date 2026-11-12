// Publicações para redes sociais (Instagram, Facebook, LinkedIn…): a pessoa registra plataforma, legenda e imagem e envia para a aprovação do RH.
// Quem não precisa de aprovação (cadastro do usuário) fica com a publicação "aprovada" na hora. Depois de aprovada, a equipe publica na plataforma
// e marca como "publicada" (com o link do post, se quiser). A publicação automática por API das plataformas é uma etapa futura.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { cancelarPendentes, exigeAprovacao, PLATAFORMAS, solicitarAprovacao } from '../../aprovacoes/api/index.ts';
import { CSP_SVG, svgSeguro } from '../../imagens/api/index.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

const CAMPOS = `p.id, p.plataforma, p.titulo, p.legenda, p.imagem, p.link, p.data_prevista, p.status, p.motivo, p.link_publicado, p.publicada_em, p.criado_por, p.criado_em, p.atualizado_em,
  (SELECT u.nome FROM usuarios u WHERE u.id = p.criado_por) AS autor`;

function urlHttp(v: string | null, rotulo: string): string | null {
  if (!v) return null;
  try { const u = new URL(v); if (u.protocol === 'http:' || u.protocol === 'https:') return u.href; } catch { /* abaixo */ }
  throw new ErroValidacao(`${rotulo}: use um endereço que comece com http:// ou https://.`);
}

const LIMITE_ANEXO = 15 * 1024 * 1024;
const MAX_ANEXOS = 10;
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const comeca = (b: Buffer, ...p: number[]) => b.length > p.length && p.every((v, i) => b[i] === v);
const ZIP = (b: Buffer) => comeca(b, 0x50, 0x4b, 0x03, 0x04);
const OFFICE_ANTIGO = (b: Buffer) => b.subarray(0, 8).equals(OLE);
const SEM_NUL = (b: Buffer) => !b.subarray(0, 8000).includes(0);
const JPG = (b: Buffer) => comeca(b, 0xff, 0xd8, 0xff);
/** Tipos aceitos como anexo: extensão → tipo do arquivo e conferência do conteúdo (não confia no nome nem no tipo informado). */
const ANEXOS: Record<string, { mime: string; ok: (b: Buffer) => boolean; inline?: boolean }> = {
  pdf: { mime: 'application/pdf', ok: (b) => b.toString('latin1', 0, 5) === '%PDF-', inline: true },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ok: ZIP },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ok: ZIP },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ok: ZIP },
  odt: { mime: 'application/vnd.oasis.opendocument.text', ok: ZIP },
  ods: { mime: 'application/vnd.oasis.opendocument.spreadsheet', ok: ZIP },
  odp: { mime: 'application/vnd.oasis.opendocument.presentation', ok: ZIP },
  doc: { mime: 'application/msword', ok: OFFICE_ANTIGO },
  xls: { mime: 'application/vnd.ms-excel', ok: OFFICE_ANTIGO },
  ppt: { mime: 'application/vnd.ms-powerpoint', ok: OFFICE_ANTIGO },
  png: { mime: 'image/png', ok: (b) => comeca(b, 0x89, 0x50, 0x4e, 0x47), inline: true },
  jpg: { mime: 'image/jpeg', ok: JPG, inline: true },
  jpeg: { mime: 'image/jpeg', ok: JPG, inline: true },
  gif: { mime: 'image/gif', ok: (b) => b.toString('latin1', 0, 3) === 'GIF', inline: true },
  webp: { mime: 'image/webp', ok: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP', inline: true },
  svg: { mime: 'image/svg+xml', ok: (b) => svgSeguro(b) !== null, inline: true },
  txt: { mime: 'text/plain; charset=utf-8', ok: SEM_NUL },
  csv: { mime: 'text/csv; charset=utf-8', ok: SEM_NUL },
};
interface Anexo { id: number; nome: string; tipo: string; tamanho: number }

export async function rotasRedes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const anexosDe = (publicacaoId: number) => db.prepare('SELECT id, nome, tipo, tamanho FROM publicacoes_anexos WHERE publicacao_id = ? ORDER BY id').all(publicacaoId) as unknown as Anexo[];
  const buscar = (id: number) => {
    const r = db.prepare(`SELECT ${CAMPOS} FROM publicacoes_externas p WHERE p.id = ?`).get(id) as { id: number; status: string; titulo: string; plataforma: string } | undefined;
    return r && { ...r, anexos: anexosDe(r.id) };
  };

  /** Deixa na publicação exatamente os anexos escolhidos (os enviados por quem está salvando, ou já dela); o resto é apagado. */
  function vincular(publicacaoId: number, usuarioId: number, ids: number[]) {
    const lista = ids.length ? ids.join(',') : 'NULL';
    db.prepare(`DELETE FROM publicacoes_anexos WHERE publicacao_id = ? AND id NOT IN (${lista})`).run(publicacaoId);
    if (ids.length) db.prepare(`UPDATE publicacoes_anexos SET publicacao_id = ? WHERE id IN (${lista}) AND publicacao_id IS NULL AND criado_por = ?`).run(publicacaoId, usuarioId);
  }
  function idsAnexos(c: Record<string, unknown>): number[] {
    const v = c.anexos;
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || v.length > MAX_ANEXOS) throw new ErroValidacao(`Anexos: no máximo ${MAX_ANEXOS} arquivos.`);
    return v.map((x) => { const n = Number((x as { id?: unknown })?.id ?? x); if (!Number.isInteger(n) || n < 1) throw new ErroValidacao('Anexos: lista inválida.'); return n; });
  }

  // O arquivo é enviado antes (fica solto) e entra na publicação quando ela é salva.
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: LIMITE_ANEXO }, (_req, corpo, feito) => feito(null, corpo));
  app.post<{ Querystring: { nome?: string } }>('/api/gestao/redes/anexos', { preHandler: exigirPerm('pub.redes.criar', 'pub.redes.editar'), bodyLimit: LIMITE_ANEXO }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha um arquivo.' });
    const nome = String(req.query.nome ?? '').replace(/[\\/]+/g, ' ').replace(/[\u0000-\u001f]/g, '').trim().slice(-120);
    const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(nome)?.[1] ?? '').toLowerCase();
    const tipo = ANEXOS[ext];
    if (!nome || !tipo) return resp.code(400).send({ erro: 'Tipo de arquivo não aceito. Use PDF, Word, Excel, PowerPoint, imagem, SVG, TXT ou CSV.' });
    if (!tipo.ok(corpo)) return resp.code(400).send({ erro: `O conteúdo não parece um arquivo .${ext} válido.` });
    db.prepare('DELETE FROM publicacoes_anexos WHERE publicacao_id IS NULL AND criado_em < ?').run(new Date(Date.now() - 86_400_000).toISOString());
    const id = Number(db.prepare('INSERT INTO publicacoes_anexos (nome, tipo, tamanho, dados, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)').run(nome, ext, corpo.length, corpo, req.usuario!.id, new Date().toISOString()).lastInsertRowid);
    auditar(db, req.usuario!.id, 'rede_anexo_enviado', { id, nome, bytes: corpo.length });
    return resp.code(201).send({ id, nome, tipo: ext, tamanho: corpo.length });
  });

  // Abrir/baixar: quem vê as publicações e quem decide as aprovações. PDF, imagem e SVG abrem no navegador; o resto baixa.
  app.get<{ Params: { id: string } }>('/api/redes/anexos/:id', { preHandler: exigirPerm('pub.redes.ver', 'pub.aprovacoes.ver') }, async (req, resp) => {
    // Anexo ainda solto (enviado e não salvo) só quem enviou abre, para a miniatura do formulário.
    const a = db.prepare('SELECT nome, tipo, dados FROM publicacoes_anexos WHERE id = ? AND (publicacao_id IS NOT NULL OR criado_por = ?)').get(inteiro(req.params.id, 'Anexo'), req.usuario!.id) as { nome: string; tipo: string; dados: Uint8Array } | undefined;
    if (!a) return resp.code(404).send({ erro: 'Anexo não encontrado.' });
    const t = ANEXOS[a.tipo];
    resp.header('Content-Type', t.mime).header('X-Content-Type-Options', 'nosniff').header('Cache-Control', 'private, max-age=300')
      .header('Content-Disposition', `${t.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.nome)}`);
    if (a.tipo === 'svg') resp.header('Content-Security-Policy', CSP_SVG);
    return resp.send(Buffer.from(a.dados));
  });

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

  app.get('/api/gestao/redes', { preHandler: exigirPerm('pub.redes.ver') }, async () => (db.prepare(`SELECT ${CAMPOS} FROM publicacoes_externas p ORDER BY p.id DESC`).all() as { id: number }[]).map((r) => ({ ...r, anexos: anexosDe(r.id) })));

  app.post('/api/gestao/redes', { preHandler: exigirPerm('pub.redes.criar') }, async (req, resp) => {
    const corpo = corpoObjeto(req.body);
    const d = ler(corpo);
    const anexos = idsAnexos(corpo);
    const agora = new Date().toISOString();
    const id = Number(db.prepare('INSERT INTO publicacoes_externas (plataforma, titulo, legenda, imagem, link, data_prevista, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(d.plataforma, d.titulo, d.legenda, d.imagem, d.link, d.data_prevista, req.usuario!.id, agora, agora).lastInsertRowid);
    vincular(id, req.usuario!.id, anexos);
    auditar(db, req.usuario!.id, 'rede_criada', { id, plataforma: d.plataforma, anexos: anexos.length });
    return resp.code(201).send(buscar(id));
  });

  // Só dá para editar enquanto é rascunho ou depois de rejeitada (volta a rascunho para corrigir e reenviar).
  app.put<{ Params: { id: string } }>('/api/gestao/redes/:id', { preHandler: exigirPerm('pub.redes.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Publicação');
    const atual = buscar(id);
    if (!atual) return resp.code(404).send({ erro: 'Publicação não encontrada.' });
    if (!['rascunho', 'rejeitada'].includes(atual.status)) return resp.code(409).send({ erro: 'Esta publicação já foi enviada. Só dá para editar rascunho ou publicação rejeitada.' });
    const corpo = corpoObjeto(req.body);
    const d = ler(corpo);
    const anexos = idsAnexos(corpo);
    db.prepare("UPDATE publicacoes_externas SET plataforma = ?, titulo = ?, legenda = ?, imagem = ?, link = ?, data_prevista = ?, status = 'rascunho', atualizado_em = ? WHERE id = ?")
      .run(d.plataforma, d.titulo, d.legenda, d.imagem, d.link, d.data_prevista, new Date().toISOString(), id);
    vincular(id, req.usuario!.id, anexos);
    auditar(db, req.usuario!.id, 'rede_alterada', { id, anexos: anexos.length });
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
    if (exigeAprovacao(req.usuario!, 'redes')) {
      db.prepare("UPDATE publicacoes_externas SET status = 'em_aprovacao', motivo = NULL, atualizado_em = ? WHERE id = ?").run(agora, id);
      solicitarAprovacao(db, { tipo: 'rede_social', registroId: id, titulo: atual.titulo, detalhe: atual.plataforma, solicitanteId: req.usuario!.id });
    } else {
      db.prepare("UPDATE publicacoes_externas SET status = 'aprovada', motivo = NULL, atualizado_em = ? WHERE id = ?").run(agora, id);
    }
    auditar(db, req.usuario!.id, 'rede_enviada', { id, direta: !exigeAprovacao(req.usuario!, 'redes') });
    return buscar(id);
  });

  // Mudar a data de uma publicação já aprovada: quem precisa de aprovação volta para a fila do RH com a data nova.
  app.post<{ Params: { id: string } }>('/api/gestao/redes/:id/data', { preHandler: exigirPerm('pub.redes.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Publicação');
    const atual = buscar(id);
    if (!atual) return resp.code(404).send({ erro: 'Publicação não encontrada.' });
    if (atual.status !== 'aprovada') return resp.code(409).send({ erro: 'Só dá para mudar a data de uma publicação aprovada (as demais podem ser editadas).' });
    const data = dataIso(corpoObjeto(req.body), 'data_prevista', 'Nova data de publicação');
    if (!data) throw new ErroValidacao('Nova data de publicação: informe a data.');
    const agora = new Date().toISOString();
    const volta = exigeAprovacao(req.usuario!, 'redes');
    db.prepare('UPDATE publicacoes_externas SET data_prevista = ?, status = ?, motivo = NULL, atualizado_em = ? WHERE id = ?').run(data, volta ? 'em_aprovacao' : 'aprovada', agora, id);
    if (volta) solicitarAprovacao(db, { tipo: 'rede_social', registroId: id, titulo: `${atual.titulo} (nova data: ${data.split('-').reverse().join('/')})`, detalhe: atual.plataforma, solicitanteId: req.usuario!.id });
    auditar(db, req.usuario!.id, 'rede_data_alterada', { id, data, volta_para_aprovacao: volta });
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
