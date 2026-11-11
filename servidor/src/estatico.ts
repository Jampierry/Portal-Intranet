// Entrega do site compilado (web/dist) pelo próprio servidor, para produção: sem Vite, sem dependência extra.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

export function servirSite(app: FastifyInstance, pasta: string): boolean {
  if (!existsSync(join(pasta, 'index.html'))) return false;
  const raiz = normalize(pasta) + sep;
  const arquivo = (url: string): string | null => {
    let caminho: string;
    try { caminho = decodeURIComponent(url.split('?')[0]); } catch { return null; }
    if (caminho.includes('\0')) return null;
    const alvo = normalize(join(pasta, caminho));
    if (!alvo.startsWith(raiz)) return null; // saiu da pasta do site
    try { return statSync(alvo).isFile() ? alvo : null; } catch { return null; }
  };
  app.setNotFoundHandler((req, resp) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return resp.code(404).send({ erro: 'Não encontrado.' });
    if (req.url.startsWith('/api/')) return resp.code(404).send({ erro: 'Não encontrado.' });
    const alvo = arquivo(req.url);
    // Arquivos em /assets têm nome com hash: podem ficar em cache por muito tempo. O resto (index.html) sempre revalida.
    const cache = alvo && req.url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    const final = alvo ?? join(pasta, 'index.html'); // rotas do app (SPA) caem no index.html
    return resp.header('Content-Type', TIPOS[extname(final).toLowerCase()] ?? 'application/octet-stream').header('Cache-Control', cache).send(createReadStream(final));
  });
  return true;
}
