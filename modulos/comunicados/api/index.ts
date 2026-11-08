import { avisarNovoComunicado } from '../../avisos/api/index.ts';
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { permissoesEfetivas } from '../../acessos/api/permissoes.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, slugUnico, texto } from '../../../servidor/src/validar.ts';

const STATUS = ['rascunho', 'publicado', 'arquivado'] as const;
const PRIORIDADES = ['normal', 'urgente'] as const;
// Só aparece para todos o que está publicado e dentro da janela de exibição (se houver).
const VISIVEL = "status = 'publicado' AND (exibir_de IS NULL OR exibir_de <= date('now','localtime')) AND (exibir_ate IS NULL OR exibir_ate >= date('now','localtime'))";

export async function rotasComunicados(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const LIDO = 'EXISTS (SELECT 1 FROM comunicado_leituras l WHERE l.comunicado_id = comunicados.id AND l.usuario_id = ?) AS lido';
  app.get('/api/comunicados', { preHandler: exigirPerm('ver.comunicados') }, async (req) =>
    db.prepare(`SELECT slug, titulo, resumo, categoria, prioridade, imagem, publicado_em, exige_leitura, ${LIDO} FROM comunicados WHERE ${VISIVEL} ORDER BY publicado_em DESC, id DESC`).all(req.usuario!.id),
  );

  // Detalhe: só comunicados visíveis (rascunho, arquivado e fora da janela não aparecem).
  app.get<{ Params: { slug: string } }>('/api/comunicados/:slug', { preHandler: exigirPerm('ver.comunicados') }, async (req, resp) => {
    const c = db.prepare(`SELECT slug, titulo, resumo, corpo, categoria, prioridade, imagem, publicado_em, exige_leitura, ${LIDO}, (SELECT l.lido_em FROM comunicado_leituras l WHERE l.comunicado_id = comunicados.id AND l.usuario_id = ?) AS lido_em FROM comunicados WHERE slug = ? AND ${VISIVEL}`).get(req.usuario!.id, req.usuario!.id, req.params.slug);
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    return c;
  });
  // "Li e estou ciente": só em comunicado visível que exige confirmação; confirmar de novo não muda a data.
  app.post<{ Params: { slug: string } }>('/api/comunicados/:slug/confirmar', { preHandler: exigirPerm('ver.comunicados') }, async (req, resp) => {
    const c = db.prepare(`SELECT id, exige_leitura FROM comunicados WHERE slug = ? AND ${VISIVEL}`).get(req.params.slug) as { id: number; exige_leitura: number } | undefined;
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    if (!c.exige_leitura) return resp.code(400).send({ erro: 'Este comunicado não pede confirmação de leitura.' });
    db.prepare('INSERT OR IGNORE INTO comunicado_leituras (comunicado_id, usuario_id, lido_em) VALUES (?, ?, ?)').run(c.id, req.usuario!.id, new Date().toISOString());
    return { ok: true, lido_em: (db.prepare('SELECT lido_em FROM comunicado_leituras WHERE comunicado_id = ? AND usuario_id = ?').get(c.id, req.usuario!.id) as { lido_em: string }).lido_em };
  });

  // ----- Gestão (editor e admin) -----
  const CAMPOS = 'id, slug, titulo, resumo, corpo, categoria, prioridade, imagem, status, exibir_de, exibir_ate, exige_leitura, publicado_em, criado_em, atualizado_em';
  const hoje = () => new Date().toISOString().slice(0, 10);

  function ler(c: Record<string, unknown>) {
    const exibir_de = dataIso(c, 'exibir_de', 'Exibir a partir de');
    const exibir_ate = dataIso(c, 'exibir_ate', 'Exibir até');
    if (exibir_de && exibir_ate && exibir_ate < exibir_de) throw new ErroValidacao('A data final não pode ser anterior à inicial.');
    return {
      titulo: String(texto(c, 'titulo', 'Título', { min: 3, max: 120 })),
      resumo: String(texto(c, 'resumo', 'Resumo', { max: 300 })),
      corpo: texto(c, 'corpo', 'Texto', { max: 5000, opcional: true }),
      categoria: String(texto(c, 'categoria', 'Categoria', { max: 40 })),
      imagem: texto(c, 'imagem', 'Imagem', { max: 300, opcional: true }),
      prioridade: escolha(c, 'prioridade', 'Prioridade', PRIORIDADES, 'normal'),
      status: escolha(c, 'status', 'Situação', STATUS, 'rascunho'),
      exibir_de, exibir_ate, exige_leitura: c.exige_leitura ? 1 : 0,
    };
  }

  app.get('/api/gestao/comunicados', { preHandler: exigirPerm('pub.comunicados.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM comunicados ORDER BY id DESC`).all());

  app.post('/api/gestao/comunicados', { preHandler: exigirPerm('pub.comunicados.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM comunicados WHERE slug = ?').get(s), d.titulo);
    const agora = new Date().toISOString();
    const r = db.prepare(
      `INSERT INTO comunicados (slug, titulo, resumo, corpo, imagem, categoria, prioridade, status, autor_id, exibir_de, exibir_ate, exige_leitura, publicado_em, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(slug, d.titulo, d.resumo, d.corpo, d.imagem, d.categoria, d.prioridade, d.status, req.usuario!.id, d.exibir_de, d.exibir_ate, d.exige_leitura, d.status === 'publicado' ? hoje() : null, agora, agora);
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'comunicado_criado', { id, titulo: d.titulo, status: d.status });
    if (d.status === 'publicado') void avisarNovoComunicado(db, slug, req.usuario!.id); // e-mail de aviso (se ligado em Integrações)
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM comunicados WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/comunicados/:id', { preHandler: exigirPerm('pub.comunicados.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Comunicado');
    const atual = db.prepare('SELECT status, publicado_em FROM comunicados WHERE id = ?').get(id) as { status: string; publicado_em: string | null } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    // A data de publicação nasce na primeira vez que vira "publicado" e não muda depois.
    const publicado_em = atual.publicado_em ?? (d.status === 'publicado' ? hoje() : null);
    db.prepare(
      `UPDATE comunicados SET titulo = ?, resumo = ?, corpo = ?, imagem = ?, categoria = ?, prioridade = ?, status = ?, exibir_de = ?, exibir_ate = ?, exige_leitura = ?, publicado_em = ?, atualizado_em = ? WHERE id = ?`,
    ).run(d.titulo, d.resumo, d.corpo, d.imagem, d.categoria, d.prioridade, d.status, d.exibir_de, d.exibir_ate, d.exige_leitura, publicado_em, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'comunicado_alterado', { id, titulo: d.titulo, de: atual.status, para: d.status });
    if (d.status === 'publicado') { const s = (db.prepare('SELECT slug FROM comunicados WHERE id = ?').get(id) as { slug: string }).slug; void avisarNovoComunicado(db, s, req.usuario!.id); }
    return db.prepare(`SELECT ${CAMPOS} FROM comunicados WHERE id = ?`).get(id);
  });

  // Editor só apaga rascunho; admin apaga qualquer um (o ideal é arquivar).
  // Quem já confirmou e quem falta (entre as pessoas ativas que podem ver comunicados).
  app.get<{ Params: { id: string } }>('/api/gestao/comunicados/:id/leituras', { preHandler: exigirPerm('pub.comunicados.ver') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Comunicado');
    const c = db.prepare('SELECT titulo, exige_leitura FROM comunicados WHERE id = ?').get(id) as { titulo: string; exige_leitura: number } | undefined;
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    const lidas = new Map((db.prepare('SELECT usuario_id, lido_em FROM comunicado_leituras WHERE comunicado_id = ?').all(id) as { usuario_id: number; lido_em: string }[]).map((l) => [l.usuario_id, l.lido_em]));
    const alvo = (db.prepare('SELECT id, login, nome, perfil, permissoes FROM usuarios WHERE ativo = 1 ORDER BY nome').all() as { id: number; login: string; nome: string; perfil: string; permissoes: string | null }[])
      .filter((u) => permissoesEfetivas(db, u.perfil, u.permissoes).includes('ver.comunicados'));
    const lidos = alvo.filter((u) => lidas.has(u.id)).map((u) => ({ nome: u.nome, login: u.login, lido_em: lidas.get(u.id)! })).sort((a, b) => a.lido_em.localeCompare(b.lido_em));
    const pendentes = alvo.filter((u) => !lidas.has(u.id)).map((u) => ({ nome: u.nome, login: u.login }));
    return { titulo: c.titulo, exige_leitura: !!c.exige_leitura, total: alvo.length, lidos, pendentes };
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/comunicados/:id', { preHandler: exigirPerm('pub.comunicados.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Comunicado');
    const c = db.prepare('SELECT titulo, status FROM comunicados WHERE id = ?').get(id) as { titulo: string; status: string } | undefined;
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    if (req.usuario!.perfil !== 'admin' && c.status !== 'rascunho') return resp.code(403).send({ erro: 'Só o administrador apaga comunicado já publicado. Use "Arquivar".' });
    db.prepare('DELETE FROM comunicados WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'comunicado_apagado', { id, titulo: c.titulo });
    return { ok: true };
  });
}
