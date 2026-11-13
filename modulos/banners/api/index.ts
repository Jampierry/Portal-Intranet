// Banners do carrossel "Novidades da semana" do Início: leitura para todos os logados; gestão por editor e admin.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { cancelarPendentes, exigeAprovacao, solicitarAprovacao } from '../../aprovacoes/api/index.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

const VISIVEL = "ativo = 1 AND (exibir_de IS NULL OR exibir_de <= date('now','localtime')) AND (exibir_ate IS NULL OR exibir_ate >= date('now','localtime'))";
const POSICOES = ['principal', 'lateral1', 'lateral2'] as const;
const CAMPOS = 'id, titulo, subtitulo, imagem, botao_texto, link, posicao, ordem, ativo, exibir_de, exibir_ate';

/** Imagem ou vídeo curto (MP4/WebM): guardado pelo portal (ou imagem de demonstração em /demo). Vazio = fundo em cor do tema. */
const IMAGEM_OK = /^\/(api\/imagens\/[a-f0-9]{24}\.(png|jpg|webp|gif|ico)|api\/videos\/[a-f0-9]{24}\.(mp4|webm)|demo\/[a-z0-9._-]+)$/i;
/** Link: página do portal (#comunicados/slug) ou endereço http(s). */
const LINK_INTERNO = /^#[a-z0-9/_-]{1,80}$/i;

function ler(c: Record<string, unknown>) {
  const imagem = texto(c, 'imagem', 'Imagem', { max: 120, opcional: true });
  if (imagem && !IMAGEM_OK.test(imagem)) throw new ErroValidacao('Imagem: use "Escolher imagem ou vídeo" para enviar o arquivo.');
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
    posicao: escolha(c, 'posicao', 'Carrossel', POSICOES, 'principal'),
    ativo: c.ativo === undefined ? 1 : c.ativo ? 1 : 0,
    exibir_de, exibir_ate,
  };
}

export async function rotasBanners(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/banners', async () =>
    db.prepare(`SELECT id, titulo, subtitulo, imagem, botao_texto, link, posicao FROM banners WHERE ${VISIVEL} ORDER BY posicao, ordem, id`).all(),
  );

  app.get('/api/gestao/banners', { preHandler: exigirPerm('pub.banners.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM banners ORDER BY ordem, id`).all());

  app.post('/api/gestao/banners', { preHandler: exigirPerm('pub.banners.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    // quem precisa de aprovação não publica direto: o banner fica inativo e vai para a fila do RH
    const paraAprovar = d.ativo === 1 && exigeAprovacao(req.usuario!, 'banners');
    if (paraAprovar) d.ativo = 0;
    const agora = new Date().toISOString();
    const id = Number(db.prepare(
      'INSERT INTO banners (titulo, subtitulo, imagem, botao_texto, link, posicao, ordem, ativo, exibir_de, exibir_ate, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(d.titulo, d.subtitulo, d.imagem, d.botao_texto, d.link, d.posicao, d.ordem, d.ativo, d.exibir_de, d.exibir_ate, agora, agora).lastInsertRowid);
    auditar(db, req.usuario!.id, 'banner_criado', { id, titulo: d.titulo });
    if (paraAprovar) solicitarAprovacao(db, { tipo: 'banner', registroId: id, titulo: d.titulo, solicitanteId: req.usuario!.id });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM banners WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/banners/:id', { preHandler: exigirPerm('pub.banners.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Banner');
    if (!db.prepare('SELECT 1 FROM banners WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Banner não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    const paraAprovar = d.ativo === 1 && exigeAprovacao(req.usuario!, 'banners');
    if (paraAprovar) d.ativo = 0; // volta a ficar inativo até o RH aprovar a versão nova
    db.prepare('UPDATE banners SET titulo = ?, subtitulo = ?, imagem = ?, botao_texto = ?, link = ?, posicao = ?, ordem = ?, ativo = ?, exibir_de = ?, exibir_ate = ?, atualizado_em = ? WHERE id = ?')
      .run(d.titulo, d.subtitulo, d.imagem, d.botao_texto, d.link, d.posicao, d.ordem, d.ativo, d.exibir_de, d.exibir_ate, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'banner_alterado', { id, ativo: d.ativo });
    if (paraAprovar) solicitarAprovacao(db, { tipo: 'banner', registroId: id, titulo: d.titulo, solicitanteId: req.usuario!.id });
    else cancelarPendentes(db, 'banner', id);
    return db.prepare(`SELECT ${CAMPOS} FROM banners WHERE id = ?`).get(id);
  });

  // Mudar só a data de publicação (exibir a partir de): quem precisa de aprovação volta para a fila do RH (o banner sai do ar até lá).
  app.post<{ Params: { id: string } }>('/api/gestao/banners/:id/data', { preHandler: exigirPerm('pub.banners.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Banner');
    const atual = db.prepare('SELECT titulo, ativo, exibir_ate FROM banners WHERE id = ?').get(id) as { titulo: string; ativo: number; exibir_ate: string | null } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Banner não encontrado.' });
    const data = dataIso(corpoObjeto(req.body), 'exibir_de', 'Nova data de publicação');
    if (!data) throw new ErroValidacao('Nova data de publicação: informe a data.');
    if (atual.exibir_ate && atual.exibir_ate < data) throw new ErroValidacao('A nova data fica depois do fim da exibição. Ajuste o campo "Exibir até" pelo botão Editar.');
    const volta = atual.ativo === 1 && exigeAprovacao(req.usuario!, 'banners');
    db.prepare(`UPDATE banners SET exibir_de = ?${volta ? ', ativo = 0' : ''}, atualizado_em = ? WHERE id = ?`).run(data, new Date().toISOString(), id);
    if (volta) solicitarAprovacao(db, { tipo: 'banner', registroId: id, titulo: `${atual.titulo} (nova data: ${data.split('-').reverse().join('/')})`, solicitanteId: req.usuario!.id });
    auditar(db, req.usuario!.id, 'banner_data_alterada', { id, data, volta_para_aprovacao: volta });
    return db.prepare(`SELECT ${CAMPOS} FROM banners WHERE id = ?`).get(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/banners/:id', { preHandler: exigirPerm('pub.banners.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Banner');
    const b = db.prepare('SELECT titulo FROM banners WHERE id = ?').get(id) as { titulo: string } | undefined;
    if (!b) return resp.code(404).send({ erro: 'Banner não encontrado.' });
    cancelarPendentes(db, 'banner', id);
    db.prepare('DELETE FROM banners WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'banner_apagado', { id, titulo: b.titulo });
    return { ok: true };
  });
}
