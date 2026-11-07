import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, slugUnico, texto } from '../../../servidor/src/validar.ts';

const STATUS = ['rascunho', 'publicado', 'arquivado'] as const;
const PRIORIDADES = ['normal', 'urgente'] as const;
// Só aparece para todos o que está publicado e dentro da janela de exibição (se houver).
const VISIVEL = "status = 'publicado' AND (exibir_de IS NULL OR exibir_de <= date('now','localtime')) AND (exibir_ate IS NULL OR exibir_ate >= date('now','localtime'))";

export async function rotasComunicados(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/comunicados', async () =>
    db.prepare(`SELECT slug, titulo, resumo, categoria, prioridade, publicado_em FROM comunicados WHERE ${VISIVEL} ORDER BY publicado_em DESC, id DESC`).all(),
  );

  // Detalhe: só comunicados visíveis (rascunho, arquivado e fora da janela não aparecem).
  app.get<{ Params: { slug: string } }>('/api/comunicados/:slug', async (req, resp) => {
    const c = db.prepare(`SELECT slug, titulo, resumo, corpo, categoria, prioridade, publicado_em FROM comunicados WHERE slug = ? AND ${VISIVEL}`).get(req.params.slug);
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    return c;
  });

  // ----- Gestão (editor e admin) -----
  const gestao = { preHandler: exigir('admin', 'editor') };
  const CAMPOS = 'id, slug, titulo, resumo, corpo, categoria, prioridade, status, exibir_de, exibir_ate, publicado_em, criado_em, atualizado_em';
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
      prioridade: escolha(c, 'prioridade', 'Prioridade', PRIORIDADES, 'normal'),
      status: escolha(c, 'status', 'Situação', STATUS, 'rascunho'),
      exibir_de, exibir_ate,
    };
  }

  app.get('/api/gestao/comunicados', gestao, async () => db.prepare(`SELECT ${CAMPOS} FROM comunicados ORDER BY id DESC`).all());

  app.post('/api/gestao/comunicados', gestao, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM comunicados WHERE slug = ?').get(s), d.titulo);
    const agora = new Date().toISOString();
    const r = db.prepare(
      `INSERT INTO comunicados (slug, titulo, resumo, corpo, categoria, prioridade, status, autor_id, exibir_de, exibir_ate, publicado_em, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(slug, d.titulo, d.resumo, d.corpo, d.categoria, d.prioridade, d.status, req.usuario!.id, d.exibir_de, d.exibir_ate, d.status === 'publicado' ? hoje() : null, agora, agora);
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'comunicado_criado', { id, titulo: d.titulo, status: d.status });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM comunicados WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/comunicados/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Comunicado');
    const atual = db.prepare('SELECT status, publicado_em FROM comunicados WHERE id = ?').get(id) as { status: string; publicado_em: string | null } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    // A data de publicação nasce na primeira vez que vira "publicado" e não muda depois.
    const publicado_em = atual.publicado_em ?? (d.status === 'publicado' ? hoje() : null);
    db.prepare(
      `UPDATE comunicados SET titulo = ?, resumo = ?, corpo = ?, categoria = ?, prioridade = ?, status = ?, exibir_de = ?, exibir_ate = ?, publicado_em = ?, atualizado_em = ? WHERE id = ?`,
    ).run(d.titulo, d.resumo, d.corpo, d.categoria, d.prioridade, d.status, d.exibir_de, d.exibir_ate, publicado_em, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'comunicado_alterado', { id, titulo: d.titulo, de: atual.status, para: d.status });
    return db.prepare(`SELECT ${CAMPOS} FROM comunicados WHERE id = ?`).get(id);
  });

  // Editor só apaga rascunho; admin apaga qualquer um (o ideal é arquivar).
  app.delete<{ Params: { id: string } }>('/api/gestao/comunicados/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Comunicado');
    const c = db.prepare('SELECT titulo, status FROM comunicados WHERE id = ?').get(id) as { titulo: string; status: string } | undefined;
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    if (req.usuario!.perfil !== 'admin' && c.status !== 'rascunho') return resp.code(403).send({ erro: 'Só o administrador apaga comunicado já publicado. Use "Arquivar".' });
    db.prepare('DELETE FROM comunicados WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'comunicado_apagado', { id, titulo: c.titulo });
    return { ok: true };
  });
}
