import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';

/** Leitura simples (somente GET). Só aparece destaque aprovado, de período publicado. */
export async function rotasInicio(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/destaques', async () =>
    db
      .prepare(
        "SELECT p.tipo, p.rotulo, d.nome, d.area, d.iniciais, d.apresentacao FROM destaques d JOIN periodos_destaque p ON p.id = d.periodo_id WHERE d.status = 'aprovado' AND p.status = 'publicado' ORDER BY p.tipo, d.id",
      )
      .all(),
  );
}
