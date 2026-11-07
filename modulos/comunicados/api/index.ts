import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';

/** Leitura simples (somente GET). Gestão entra quando o módulo for trabalhado. */
export async function rotasComunicados(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/comunicados', async () =>
    db
      .prepare("SELECT slug, titulo, resumo, categoria, prioridade, publicado_em FROM comunicados WHERE status = 'publicado' ORDER BY publicado_em DESC")
      .all(),
  );

  // Detalhe: só comunicados publicados (rascunho e arquivado não aparecem).
  app.get<{ Params: { slug: string } }>('/api/comunicados/:slug', async (req, resp) => {
    const c = db
      .prepare("SELECT slug, titulo, resumo, corpo, categoria, prioridade, publicado_em FROM comunicados WHERE slug = ? AND status = 'publicado'")
      .get(req.params.slug);
    if (!c) return resp.code(404).send({ erro: 'Comunicado não encontrado.' });
    return c;
  });
}
