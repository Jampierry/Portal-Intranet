import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { buscarIcone } from './favicon.ts';
import { ErroValidacao, corpoObjeto, slugUnico, texto, urlHttp } from '../../../servidor/src/validar.ts';

const CAMPOS = 'slug, nome, descricao, categoria, url, acesso, icone, logo, responsavel, ativo';

export async function rotasAplicacoes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/aplicacoes', async () => db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE ativo = 1 ORDER BY nome`).all());

  // ----- Favoritos de cada usuário (guardados no servidor) -----
  app.get('/api/favoritos', async (req) =>
    (db.prepare('SELECT aplicacao_slug FROM favoritos WHERE usuario_id = ? ORDER BY criado_em').all(req.usuario!.id) as { aplicacao_slug: string }[]).map((f) => f.aplicacao_slug),
  );
  app.put<{ Params: { slug: string } }>('/api/favoritos/:slug', async (req, resp) => {
    if (!db.prepare('SELECT 1 FROM aplicacoes WHERE slug = ? AND ativo = 1').get(req.params.slug)) return resp.code(404).send({ erro: 'Aplicação não encontrada.' });
    db.prepare('INSERT OR IGNORE INTO favoritos (usuario_id, aplicacao_slug, criado_em) VALUES (?, ?, ?)').run(req.usuario!.id, req.params.slug, new Date().toISOString());
    return { ok: true };
  });
  app.delete<{ Params: { slug: string } }>('/api/favoritos/:slug', async (req) => {
    db.prepare('DELETE FROM favoritos WHERE usuario_id = ? AND aplicacao_slug = ?').run(req.usuario!.id, req.params.slug);
    return { ok: true };
  });

  // ----- Gestão do catálogo (somente admin: cada app é um link para sistema externo) -----
  const admin = { preHandler: exigirPerm('pub.aplicativos') };

  /** Ícone próprio: só imagens guardadas pelo portal (ou vazio = ícone padrão). */
  function logo(c: Record<string, unknown>): string | null {
    const v = texto(c, 'logo', 'Ícone do aplicativo', { max: 100, opcional: true });
    if (v && !/^\/api\/imagens\/[a-f0-9]{24}\.(png|jpg|webp|gif|ico)$/.test(v)) throw new ErroValidacao('Ícone do aplicativo: use "Escolher imagem" ou "Buscar do aplicativo".');
    return v;
  }

  function ler(c: Record<string, unknown>) {
    return {
      nome: String(texto(c, 'nome', 'Nome', { min: 2, max: 60 })),
      descricao: String(texto(c, 'descricao', 'Descrição', { max: 200 })),
      categoria: String(texto(c, 'categoria', 'Categoria', { max: 40 })),
      url: String(urlHttp(c, 'url', 'Endereço (URL)', false)),
      acesso: String(texto(c, 'acesso', 'Condição de acesso', { max: 200 })),
      icone: texto(c, 'icone', 'Ícone', { max: 20, opcional: true }) ?? 'apps',
      logo: logo(c),
      responsavel: texto(c, 'responsavel', 'Responsável', { max: 80, opcional: true }),
      ativo: c.ativo === undefined ? 1 : c.ativo ? 1 : 0,
    };
  }

  // Traz o ícone do próprio aplicativo (favicon do endereço informado) e guarda no portal.
  app.post('/api/gestao/aplicacoes/icone', admin, async (req, resp) => {
    const url = String(urlHttp(corpoObjeto(req.body), 'url', 'Endereço (URL)', false));
    const logo = await buscarIcone(url);
    if (!logo) return resp.code(404).send({ erro: 'Não encontramos o ícone deste aplicativo. Envie uma imagem pelo botão "Escolher imagem".' });
    auditar(db, req.usuario!.id, 'aplicacao_icone_buscado', { url });
    return { logo };
  });

  app.get('/api/gestao/aplicacoes', admin, async () => db.prepare(`SELECT ${CAMPOS} FROM aplicacoes ORDER BY nome`).all());

  app.post('/api/gestao/aplicacoes', admin, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM aplicacoes WHERE slug = ?').get(s), d.nome);
    db.prepare('INSERT INTO aplicacoes (slug, nome, descricao, categoria, url, acesso, icone, logo, responsavel, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(slug, d.nome, d.descricao, d.categoria, d.url, d.acesso, d.icone, d.logo, d.responsavel, d.ativo);
    auditar(db, req.usuario!.id, 'aplicacao_criada', { slug, nome: d.nome });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE slug = ?`).get(slug));
  });

  app.put<{ Params: { slug: string } }>('/api/gestao/aplicacoes/:slug', admin, async (req, resp) => {
    if (!db.prepare('SELECT 1 FROM aplicacoes WHERE slug = ?').get(req.params.slug)) return resp.code(404).send({ erro: 'Aplicação não encontrada.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare('UPDATE aplicacoes SET nome = ?, descricao = ?, categoria = ?, url = ?, acesso = ?, icone = ?, logo = ?, responsavel = ?, ativo = ? WHERE slug = ?')
      .run(d.nome, d.descricao, d.categoria, d.url, d.acesso, d.icone, d.logo, d.responsavel, d.ativo, req.params.slug);
    auditar(db, req.usuario!.id, 'aplicacao_alterada', { slug: req.params.slug, ativo: d.ativo });
    return db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE slug = ?`).get(req.params.slug);
  });

  app.delete<{ Params: { slug: string } }>('/api/gestao/aplicacoes/:slug', admin, async (req, resp) => {
    const a = db.prepare('SELECT nome FROM aplicacoes WHERE slug = ?').get(req.params.slug) as { nome: string } | undefined;
    if (!a) return resp.code(404).send({ erro: 'Aplicação não encontrada.' });
    db.prepare('DELETE FROM aplicacoes WHERE slug = ?').run(req.params.slug);
    auditar(db, req.usuario!.id, 'aplicacao_apagada', { slug: req.params.slug, nome: a.nome });
    return { ok: true };
  });
}
