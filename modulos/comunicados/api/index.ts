import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';

/** Leitura simples (somente GET). Gestão entra quando o módulo for trabalhado. */
export async function rotasComunicados(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/comunicados', async () =>
    db
      .prepare("SELECT slug, titulo, resumo, categoria, prioridade, publicado_em FROM comunicados WHERE status = 'publicado' ORDER BY publicado_em DESC")
      .all(),
  );
}
