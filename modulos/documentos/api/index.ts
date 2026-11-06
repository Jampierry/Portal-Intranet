import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';

/** Leitura simples (somente GET). Gestão entra quando o módulo for trabalhado. */
export async function rotasDocumentos(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/documentos', async () => db.prepare('SELECT * FROM documentos ORDER BY titulo').all());
}
