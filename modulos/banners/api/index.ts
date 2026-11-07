// Banners do carrossel "Novidades da semana" do Início: leitura para todos os logados; gestão por editor e admin.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import { corpoObjeto, dataIso, ErroValidacao, inteiro, texto } from '../../../servidor/src/validar.ts';

const VISIVEL = "ativo = 1 AND (exibir_de IS NULL OR exibir_de <= date('now','localtime')) AND (exibir_ate IS NULL OR exibir_ate >= date('now','localtime'))";
const CAMPOS = 'id, titulo, subtitulo, imagem, botao_texto, link, ordem, ativo, exibir_de, exibir_ate';

/** Imagem: guardada pelo portal (ou imagem de demonstração em /demo). Vazio = fundo em cor do tema. */
const IMAGEM_OK = /^\/(api\/imagens\/[a-f0-9]{24}\.(png|jpg|webp|gif|ico)|demo\/[a-z0-9._-]+)$/i;
/** Link: página do portal (#comunicados/slug) ou endereço http(s). */
const LINK_INTERNO = /^#[a-z0-9/_-]{1,80}$/i;

function ler(c: Record<string, unknown>) {
  const imagem = texto(c, 'imagem', 'Imagem', { max: 120, opcional: true });
  if (imagem && !IMAGEM_OK.test(imagem)) throw new ErroValidacao('Imagem: use "Escolher imagem" para enviar o arquivo.');
  const link = texto(c, 'link', 'Link', { max: 300, opcional: true });
  if (link && !LINK_INTERNO.test(link)) {
    try { if (!['http:', 'https:'].includes(new URL(link).protocol)) throw new Error(); }
    catch { throw new ErroValidacao('Link: informe um endereço http/https ou uma página do portal (ex.: #comunicados).'); }
  }
  const botao = texto(c, 'botao_texto', 'Texto do botão', { max: 30, opcional: true });
  if (link && !botao) throw new ErroValidacao('Texto do botão: informe o texto (ex.: Saiba mais) quando houver link.');
  const ordem = Number(c.ordem ?? 1);
  if (!Number.isInteger(ordem) || ordem < 1 || ordem > 99) throw new ErroValidacao('Ordem: use um número de 1 a 99.');
  const exibir_de = dataIso(c, 'exibir_de', 'Exibir a partir de');
  const exibir_ate = dataIso(c, 'exibir_ate', 'Exibir até');
  if (exibir_de && exibir_ate && exibir_ate < exibir_de) throw new ErroValidacao('A data final não pode ser anterior à inicial.');
  return {
    titulo: String(texto(c, 'titulo', 'Título', { min: 2, max: 80 })),
    subtitulo: texto(c, 'subtitulo', 'Subtítulo', { max: 160, opcional: true }),
    imagem, botao_texto: link ? botao : null, link, ordem,
    ativo: c.ativo === undefined ? 1 : c.ativo ? 1 : 0,
    exibir_de, exibir_ate,
  };
}

export async function rotasBanners(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/banners', async () =>
    db.prepare(`SELECT id, titulo, subtitulo, imagem, botao_texto, link FROM banners WHERE ${VISIVEL} ORDER BY ordem, id`).all(),
  );

  const gestao = { preHandler: exigir('admin', 'editor') };
  app.get('/api/gestao/banners', gestao, async () => db.prepare(`SELECT ${CAMPOS} FROM banners ORDER BY ordem, id`).all());

  app.post('/api/gestao/banners', gestao, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const agora = new Date().toISOString();
    const id = Number(db.prepare(
      'INSERT INTO banners (titulo, subtitulo, imagem, botao_texto, link, ordem, ativo, exibir_de, exibir_ate, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(d.titulo, d.subtitulo, d.imagem, d.botao_texto, d.link, d.ordem, d.ativo, d.exibir_de, d.exibir_ate, agora, agora).lastInsertRowid);
    auditar(db, req.usuario!.id, 'banner_criado', { id, titulo: d.titulo });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM banners WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/banners/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Banner');
    if (!db.prepare('SELECT 1 FROM banners WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Banner não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare('UPDATE banners SET titulo = ?, subtitulo = ?, imagem = ?, botao_texto = ?, link = ?, ordem = ?, ativo = ?, exibir_de = ?, exibir_ate = ?, atualizado_em = ? WHERE id = ?')
      .run(d.titulo, d.subtitulo, d.imagem, d.botao_texto, d.link, d.ordem, d.ativo, d.exibir_de, d.exibir_ate, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'banner_alterado', { id, ativo: d.ativo });
    return db.prepare(`SELECT ${CAMPOS} FROM banners WHERE id = ?`).get(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/banners/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Banner');
    const b = db.prepare('SELECT titulo FROM banners WHERE id = ?').get(id) as { titulo: string } | undefined;
    if (!b) return resp.code(404).send({ erro: 'Banner não encontrado.' });
    db.prepare('DELETE FROM banners WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'banner_apagado', { id, titulo: b.titulo });
    return { ok: true };
  });
}
