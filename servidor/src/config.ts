import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const config = {
  raiz,
  // 3100 para não colidir com o site (Next.js, 3000).
  porta: Number(process.env.PORTA ?? 3100),
  // Banco de desenvolvimento: um arquivo SQLite fora do Git.
  caminhoBanco: process.env.BANCO ?? resolve(raiz, 'dados-privados', 'portal.db'),
  pastaMigracoes: resolve(raiz, 'infra', 'migracoes'),
  producao: process.env.NODE_ENV === 'production',
};
