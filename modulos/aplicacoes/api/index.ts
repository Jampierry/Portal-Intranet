import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';

/** Leitura simples (somente GET). Gestão entra quando o módulo for trabalhado. */
export async function rotasAplicacoes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/aplicacoes', async () => db.prepare('SELECT * FROM aplicacoes WHERE ativo = 1 ORDER BY nome').all());
}
