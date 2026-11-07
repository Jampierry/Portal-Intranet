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
  // Origens que podem enviar requisições que alteram dados (defesa contra CSRF). Em produção, informe o endereço
  // público do portal em ORIGENS_PERMITIDAS (separado por vírgula). Em desenvolvimento vale o site do Vite.
  origensPermitidas: (process.env.ORIGENS_PERMITIDAS ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5174,http://127.0.0.1:5174'))
    .split(',').map((o) => o.trim()).filter(Boolean),
};
