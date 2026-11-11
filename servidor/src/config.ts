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
  // Pasta raiz dos arquivos de documentos servidos pelo portal (origem "pasta"). Em produção, aponte DOCUMENTOS_PASTA
  // para a pasta do servidor (ou compartilhamento montado) onde ficam os arquivos.
  pastaDocumentos: () => resolve(process.env.DOCUMENTOS_PASTA ?? resolve(raiz, 'dados-privados', 'documentos')),
  producao: process.env.NODE_ENV === 'production',
  // Endereço de escuta. Padrão: só esta máquina (atrás de um proxy reverso com HTTPS). Use HOST=0.0.0.0 para escutar na rede.
  host: process.env.HOST ?? '127.0.0.1',
  // Site já compilado (npm run build) que o servidor entrega em produção.
  pastaSite: process.env.PASTA_SITE ?? resolve(raiz, 'web', 'dist'),
  // Atrás de proxy reverso: confia nos cabeçalhos X-Forwarded-* (TRUST_PROXY=1).
  confiarProxy: process.env.TRUST_PROXY === '1',
  // Em produção, ligar os dados fictícios de exemplo só com autorização explícita (PERMITIR_DADOS_EXEMPLO=1).
  permitirExemplo: process.env.NODE_ENV !== 'production' || process.env.PERMITIR_DADOS_EXEMPLO === '1',
  // Origens que podem enviar requisições que alteram dados (defesa contra CSRF). Em produção, informe o endereço
  // público do portal em ORIGENS_PERMITIDAS (separado por vírgula). Em desenvolvimento vale o site do Vite.
  origensPermitidas: (process.env.ORIGENS_PERMITIDAS ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5174,http://127.0.0.1:5174'))
    .split(',').map((o) => o.trim()).filter(Boolean),
};
