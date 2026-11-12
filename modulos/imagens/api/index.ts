// Envio e entrega de imagens de capa. A pessoa escolhe o arquivo no computador ou numa pasta da rede
// (seletor do navegador); o servidor confere o conteúdo, guarda NO BANCO (tabela imagens_arquivo) e devolve o endereço.
// Assim a imagem aparece para qualquer usuário, em qualquer máquina ou celular que acesse o portal.
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../servidor/src/config.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import type { Banco } from '../../../servidor/src/db.ts';

export /** Quem pode criar ou editar algo que leva imagem (comunicados, banners, documentos, destaques, contatos, aplicativos). */
const PUB_QUE_ENVIAM_IMAGEM = ['comunicados', 'banners', 'destaques', 'aplicativos', 'documentos', 'contatos', 'aniversariantes', 'novos'].flatMap((a) => [`pub.${a}.criar`, `pub.${a}.editar`]);
const LIMITE_BYTES = 5 * 1024 * 1024;
const TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' } as const;
export const MIME_POR_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon', svg: 'image/svg+xml' };
export const CSP_SVG = "default-src 'none'; style-src 'unsafe-inline'; sandbox"; // SVG aberto direto no navegador não executa nada

/** Confere os primeiros bytes (não confia no tipo informado). SVG só entra por guardarImagem com aceitarSvg, depois de svgSeguro (pode carregar script). */
function extensaoPeloConteudo(b: Buffer): string | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length > 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  if (b.length > 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'gif';
  return null;
}

/** Texto de um SVG sem nada que execute ou busque coisa de fora (script, eventos, foreignObject, links externos, DTD/entidades). Devolve null se não for um SVG seguro. */
export function svgSeguro(b: Buffer): string | null {
  if (b.length < 20 || b.length > 1024 * 1024) return null;
  const t = b.toString('utf8').replace(/^﻿/, '');
  if (!/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(t) || !/<\/svg>\s*$/i.test(t)) return null;
  if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<embed|<object|<audio|<video|<animate|<set[\s>]|@import/i.test(t)) return null;
  if (/\son[a-z]+\s*=|javascript:|vbscript:|data:text|data:application/i.test(t)) return null;
  if (/(?:href|src)\s*=\s*["']\s*(?!#)/i.test(t)) return null; // só referências internas (#id)
  if (/url\(\s*["']?\s*(?!#)/i.test(t)) return null;
  return t;
}

/** Vídeos curtos (MP4 ou WebM) dos banners e da tela de entrada. Limite de 20 MB; o portal toca sem som, em laço. */
export const LIMITE_VIDEO = 20 * 1024 * 1024;
const MIME_VIDEO: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm' };
export const NOME_VIDEO = /^[a-f0-9]{24}\.(mp4|webm)$/;

/** Confere os primeiros bytes: MP4 tem "ftyp" na posição 4; WebM começa com o cabeçalho EBML (1A 45 DF A3). */
function videoPeloConteudo(b: Buffer): 'mp4' | 'webm' | null {
  if (b.length > 16 && b.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  if (b.length > 16 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  return null;
}

/** Confere o conteúdo e guarda o vídeo no banco. Devolve o nome, ou null se não for MP4/WebM. */
export function guardarVideo(db: Banco, corpo: Buffer): { nome: string } | null {
  const ext = videoPeloConteudo(corpo);
  if (!ext || corpo.length > LIMITE_VIDEO) return null;
  const nome = `${randomBytes(12).toString('hex')}.${ext}`;
  db.prepare('INSERT INTO videos_arquivo (nome, tipo, dados, criado_em) VALUES (?, ?, ?, ?)').run(nome, MIME_VIDEO[ext], corpo, new Date().toISOString());
  return { nome };
}

/** Entrega o vídeo por trechos (Range), como o navegador pede para tocar e avançar. Devolve false se não existir. */
export function enviarVideo(db: Banco, req: import('fastify').FastifyRequest, resp: import('fastify').FastifyReply, nome: string, publico = false): boolean {
  const meta = NOME_VIDEO.test(nome) ? db.prepare('SELECT tipo, length(dados) AS tam FROM videos_arquivo WHERE nome = ?').get(nome) as { tipo: string; tam: number } | undefined : undefined;
  if (!meta) return false;
  resp.header('Content-Type', meta.tipo).header('X-Content-Type-Options', 'nosniff').header('Accept-Ranges', 'bytes')
    .header('Cache-Control', publico ? 'public, max-age=3600' : 'private, max-age=86400');
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (!m || (m[1] === '' && m[2] === '')) {
    resp.send(Buffer.from((db.prepare('SELECT dados FROM videos_arquivo WHERE nome = ?').get(nome) as { dados: Uint8Array }).dados));
    return true;
  }
  let ini = m[1] === '' ? Math.max(0, meta.tam - Number(m[2])) : Number(m[1]);
  let fim = m[1] === '' || m[2] === '' ? meta.tam - 1 : Math.min(Number(m[2]), meta.tam - 1);
  if (ini >= meta.tam || ini > fim) { resp.code(416).header('Content-Range', `bytes */${meta.tam}`).send(); return true; }
  fim = Math.min(fim, ini + 4 * 1024 * 1024 - 1); // trechos de até 4 MB
  ini = Math.max(0, ini);
  const parte = db.prepare('SELECT substr(dados, ?, ?) AS parte FROM videos_arquivo WHERE nome = ?').get(ini + 1, fim - ini + 1, nome) as { parte: Uint8Array };
  resp.code(206).header('Content-Range', `bytes ${ini}-${fim}/${meta.tam}`).send(Buffer.from(parte.parte));
  return true;
}

const pastaAntiga = () => resolve(process.env.PASTA_IMAGENS ?? join(config.raiz, 'dados-privados', 'imagens'));

/** Confere o conteúdo e guarda a imagem no banco. Devolve o endereço, ou null se não for imagem aceita. */
/** `aceitarSvg` só para logotipos da marca e imagens do pacote de exemplo (SVG conferido por svgSeguro); `nome` fixo só para o pacote de exemplo. */
export function guardarImagem(db: Banco, corpo: Buffer, opcoes: { aceitarSvg?: boolean; nome?: string } = {}): { nome: string; url: string } | null {
  const ext = extensaoPeloConteudo(corpo) ?? (opcoes.aceitarSvg && svgSeguro(corpo) ? 'svg' : null);
  if (!ext) return null;
  const nome = opcoes.nome ?? `${randomBytes(12).toString('hex')}.${ext}`;
  db.prepare('INSERT OR REPLACE INTO imagens_arquivo (nome, tipo, dados, criado_em) VALUES (?, ?, ?, ?)').run(nome, MIME_POR_EXT[ext], corpo, new Date().toISOString());
  return { nome, url: `/api/imagens/${nome}` };
}

/** Imagem guardada (ou null). */
export function lerImagem(db: Banco, nome: string): { tipo: string; dados: Buffer } | null {
  const r = db.prepare('SELECT tipo, dados FROM imagens_arquivo WHERE nome = ?').get(nome) as { tipo: string; dados: Uint8Array } | undefined;
  return r ? { tipo: r.tipo, dados: Buffer.from(r.dados) } : null;
}

/** Entrega uma imagem do banco. `publico` só muda o cache. */
export function enviarImagem(resp: import('fastify').FastifyReply, img: { tipo: string; dados: Buffer }, publico = false) {
  resp.header('Content-Type', img.tipo).header('X-Content-Type-Options', 'nosniff').header('Cache-Control', publico ? 'public, max-age=3600' : 'private, max-age=86400');
  if (img.tipo === 'image/svg+xml') resp.header('Content-Security-Policy', CSP_SVG);
  return resp.send(img.dados);
}

/** Uma vez só: imagens que versões antigas guardavam em arquivos (dados-privados/imagens) passam para o banco. */
export function importarImagensAntigas(db: Banco) {
  const pasta = pastaAntiga();
  if (!existsSync(pasta)) return 0;
  let n = 0;
  for (const arq of readdirSync(pasta)) {
    const m = /^[a-f0-9]{24}.(png|jpg|webp|gif|ico|svg)$/.exec(arq);
    if (!m || db.prepare('SELECT 1 FROM imagens_arquivo WHERE nome = ?').get(arq)) continue;
    db.prepare('INSERT INTO imagens_arquivo (nome, tipo, dados, criado_em) VALUES (?, ?, ?, ?)').run(arq, MIME_POR_EXT[m[1]], readFileSync(join(pasta, arq)), new Date().toISOString());
    n++;
  }
  return n;
}

export async function rotasImagens(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  importarImagensAntigas(db);

  // Corpo binário cru (o navegador manda o arquivo como está, com o tipo da imagem).
  for (const tipo of Object.keys(TIPOS)) app.addContentTypeParser(tipo, { parseAs: 'buffer', bodyLimit: LIMITE_BYTES }, (_req, corpo, feito) => feito(null, corpo));

  for (const tipo of ['video/mp4', 'video/webm']) app.addContentTypeParser(tipo, { parseAs: 'buffer', bodyLimit: LIMITE_VIDEO }, (_req, corpo, feito) => feito(null, corpo));
  // Vídeo (só banners): mesma regra de quem cria ou edita banners.
  app.post('/api/gestao/videos', { preHandler: exigirPerm('pub.banners.criar', 'pub.banners.editar'), bodyLimit: LIMITE_VIDEO }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha um vídeo MP4 ou WebM.' });
    const salvo = guardarVideo(db, corpo);
    if (!salvo) return resp.code(400).send({ erro: 'Arquivo não reconhecido como vídeo MP4 ou WebM (até 20 MB).' });
    auditar(db, req.usuario!.id, 'video.enviar', { nome: salvo.nome, bytes: corpo.length });
    return resp.code(201).send({ url: `/api/videos/${salvo.nome}` });
  });
  app.get<{ Params: { nome: string } }>('/api/videos/:nome', async (req, resp) => {
    if (!enviarVideo(db, req, resp, req.params.nome)) return resp.code(404).send({ erro: 'Vídeo não encontrado.' });
    return resp;
  });

  app.post('/api/gestao/imagens', { preHandler: exigirPerm(...PUB_QUE_ENVIAM_IMAGEM), bodyLimit: LIMITE_BYTES }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha uma imagem PNG, JPG, WebP ou GIF.' });
    const salvo = guardarImagem(db, corpo);
    if (!salvo) return resp.code(400).send({ erro: 'Arquivo não reconhecido como imagem PNG, JPG, WebP ou GIF.' });
    auditar(db, req.usuario!.id, 'imagem.enviar', { nome: salvo.nome, bytes: corpo.length });
    return resp.code(201).send({ url: salvo.url });
  });

  // Entrega (exige login pelo hook global). O nome é sempre gerado pelo servidor; qualquer outro formato é recusado.
  app.get<{ Params: { nome: string } }>('/api/imagens/:nome', async (req, resp) => {
    const img = /^[a-f0-9]{24}.(png|jpg|webp|gif|ico|svg)$/.test(req.params.nome) ? lerImagem(db, req.params.nome) : null;
    if (!img) return resp.code(404).send({ erro: 'Imagem não encontrada.' });
    return enviarImagem(resp, img);
  });
}
