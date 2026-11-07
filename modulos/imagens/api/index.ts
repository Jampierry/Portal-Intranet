// Envio e entrega de imagens de capa. A pessoa escolhe o arquivo no computador ou numa pasta da rede
// (seletor do navegador); o servidor confere o conteúdo, guarda em dados-privados/imagens e devolve o endereço.
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../servidor/src/config.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import type { Banco } from '../../../servidor/src/db.ts';

export /** Quem pode criar ou editar algo que leva imagem (comunicados, banners, documentos, destaques, contatos, aplicativos). */
const PUB_QUE_ENVIAM_IMAGEM = ['comunicados', 'banners', 'destaques', 'aplicativos', 'documentos', 'contatos'].flatMap((a) => [`pub.${a}.criar`, `pub.${a}.editar`]);
const LIMITE_BYTES = 5 * 1024 * 1024;
const TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' } as const;
const MIME_POR_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon' };

/** Confere os primeiros bytes (não confia no tipo informado). SVG fica de fora de propósito: pode carregar script. */
function extensaoPeloConteudo(b: Buffer): string | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length > 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  if (b.length > 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'gif';
  return null;
}

const pastaImagens = () => resolve(process.env.PASTA_IMAGENS ?? join(config.raiz, 'dados-privados', 'imagens'));

/** Confere o conteúdo e guarda a imagem na pasta do portal. Devolve o endereço, ou null se não for imagem aceita. */
export function guardarImagem(corpo: Buffer): { nome: string; url: string } | null {
  const ext = extensaoPeloConteudo(corpo);
  if (!ext) return null;
  const nome = `${randomBytes(12).toString('hex')}.${ext}`;
  mkdirSync(pastaImagens(), { recursive: true });
  writeFileSync(join(pastaImagens(), nome), corpo);
  return { nome, url: `/api/imagens/${nome}` };
}

export async function rotasImagens(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const pasta = pastaImagens;

  // Corpo binário cru (o navegador manda o arquivo como está, com o tipo da imagem).
  for (const tipo of Object.keys(TIPOS)) app.addContentTypeParser(tipo, { parseAs: 'buffer', bodyLimit: LIMITE_BYTES }, (_req, corpo, feito) => feito(null, corpo));

  app.post('/api/gestao/imagens', { preHandler: exigirPerm(...PUB_QUE_ENVIAM_IMAGEM), bodyLimit: LIMITE_BYTES }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha uma imagem PNG, JPG, WebP ou GIF.' });
    const salvo = guardarImagem(corpo);
    if (!salvo) return resp.code(400).send({ erro: 'Arquivo não reconhecido como imagem PNG, JPG, WebP ou GIF.' });
    auditar(db, req.usuario!.id, 'imagem.enviar', { nome: salvo.nome, bytes: corpo.length });
    return resp.code(201).send({ url: salvo.url });
  });

  // Entrega (exige login pelo hook global). O nome é sempre gerado pelo servidor; qualquer outro formato é recusado.
  app.get<{ Params: { nome: string } }>('/api/imagens/:nome', async (req, resp) => {
    const m = /^[a-f0-9]{24}\.(png|jpg|webp|gif|ico)$/.exec(req.params.nome);
    const arq = m ? join(pasta(), req.params.nome) : '';
    if (!m || !existsSync(arq)) return resp.code(404).send({ erro: 'Imagem não encontrada.' });
    return resp.header('Content-Type', MIME_POR_EXT[m[1]]).header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, max-age=86400').send(readFileSync(arq));
  });
}
