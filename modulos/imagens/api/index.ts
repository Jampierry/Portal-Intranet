// Envio e entrega de imagens de capa. A pessoa escolhe o arquivo no computador ou numa pasta da rede
// (seletor do navegador); o servidor confere o conteúdo, guarda em dados-privados/imagens e devolve o endereço.
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../servidor/src/config.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import type { Banco } from '../../../servidor/src/db.ts';

export const LIMITE_BYTES = 5 * 1024 * 1024;
const TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as const;
const MIME_POR_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** Confere os primeiros bytes (não confia no tipo informado). SVG fica de fora de propósito: pode carregar script. */
function extensaoPeloConteudo(b: Buffer): string | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length > 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'gif';
  return null;
}

export async function rotasImagens(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const pasta = () => resolve(process.env.PASTA_IMAGENS ?? join(config.raiz, 'dados-privados', 'imagens'));

  // Corpo binário cru (o navegador manda o arquivo como está, com o tipo da imagem).
  for (const tipo of Object.keys(TIPOS)) app.addContentTypeParser(tipo, { parseAs: 'buffer', bodyLimit: LIMITE_BYTES }, (_req, corpo, feito) => feito(null, corpo));

  app.post('/api/gestao/imagens', { preHandler: exigir('admin', 'editor'), bodyLimit: LIMITE_BYTES }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha uma imagem PNG, JPG, WebP ou GIF.' });
    const ext = extensaoPeloConteudo(corpo);
    if (!ext) return resp.code(400).send({ erro: 'Arquivo não reconhecido como imagem PNG, JPG, WebP ou GIF.' });
    const nome = `${randomBytes(12).toString('hex')}.${ext}`;
    mkdirSync(pasta(), { recursive: true });
    writeFileSync(join(pasta(), nome), corpo);
    auditar(db, req.usuario!.id, 'imagem.enviar', { nome, bytes: corpo.length });
    return resp.code(201).send({ url: `/api/imagens/${nome}` });
  });

  // Entrega (exige login pelo hook global). O nome é sempre gerado pelo servidor; qualquer outro formato é recusado.
  app.get<{ Params: { nome: string } }>('/api/imagens/:nome', async (req, resp) => {
    const m = /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/.exec(req.params.nome);
    const arq = m ? join(pasta(), req.params.nome) : '';
    if (!m || !existsSync(arq)) return resp.code(404).send({ erro: 'Imagem não encontrada.' });
    return resp.header('Content-Type', MIME_POR_EXT[m[1]]).header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, max-age=86400').send(readFileSync(arq));
  });
}
