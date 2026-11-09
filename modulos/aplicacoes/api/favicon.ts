// Busca o ícone do próprio aplicativo (favicon) a partir do endereço cadastrado e guarda no portal.
// Só o administrador chama (cadastro de aplicativos). Endereços internos são permitidos de propósito: os sistemas ficam na rede da empresa.
import { guardarImagem } from '../../imagens/api/index.ts';
import type { Banco } from '../../../servidor/src/db.ts';

const AGENTE = 'PortalIntranet/0.1 (+icone-do-aplicativo)';

async function baixar(url: string, limite: number): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'follow', headers: { 'user-agent': AGENTE } });
    if (!r.ok || !r.body) return null;
    const partes: Buffer[] = [];
    let total = 0;
    for await (const p of r.body as unknown as AsyncIterable<Uint8Array>) {
      total += p.length;
      if (total > limite) return null;
      partes.push(Buffer.from(p));
    }
    return Buffer.concat(partes);
  } catch {
    return null;
  }
}

/** Endereços candidatos do ícone, na ordem de preferência (tags link rel="...icon" da página; por último /favicon.ico). */
export function candidatos(html: string, base: string): string[] {
  const achados: { href: string; peso: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.toLowerCase() ?? '';
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || !/icon/.test(rel) || /\.svg(\?|$)/i.test(href) || /mask-icon/.test(rel)) continue;
    const tam = Number(/\bsizes\s*=\s*["'](\d+)x\d+/i.exec(tag)?.[1] ?? 0);
    achados.push({ href, peso: (rel.includes('apple-touch') ? 1000 : 0) + (/\.png(\?|$)/i.test(href) ? 500 : 0) + Math.min(tam, 512) });
  }
  achados.sort((a, b) => b.peso - a.peso);
  const urls: string[] = [];
  for (const { href } of achados) {
    try { urls.push(new URL(href, base).toString()); } catch { /* href inválido */ }
  }
  urls.push(new URL('/favicon.ico', base).toString());
  return [...new Set(urls)];
}

/** Devolve o endereço da imagem guardada (ex.: /api/imagens/nome.png) ou null se não achou um ícone válido. */
export async function buscarIcone(db: Banco, urlApp: string): Promise<string | null> {
  const pagina = await baixar(urlApp, 1_000_000);
  const html = pagina ? pagina.toString('utf8') : '';
  for (const u of candidatos(html, urlApp)) {
    const img = await baixar(u, 512 * 1024);
    const salvo = img && guardarImagem(db, img);
    if (salvo) return salvo.url;
  }
  return null;
}
