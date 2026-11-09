import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { nomeDoPerfil, perfilExiste } from '../../acessos/api/permissoes.ts';
import { buscarIcone } from './favicon.ts';
import { ErroValidacao, corpoObjeto, slugUnico, texto, urlHttp } from '../../../servidor/src/validar.ts';

const CAMPOS = 'slug, nome, descricao, categoria, url, acesso, icone, logo, responsavel, ativo, restrita';
/** Aplicativo restrito aparece para quem foi liberado pessoalmente OU por ter um perfil que o libera (administrador vê todos). Parâmetros: id do usuário e perfil dele. */
const VISIVEL = '(restrita = 0 OR EXISTS (SELECT 1 FROM usuarios_aplicativos ua WHERE ua.usuario_id = ? AND ua.aplicacao_slug = aplicacoes.slug) OR EXISTS (SELECT 1 FROM perfis_aplicativos pa WHERE pa.perfil = ? AND pa.aplicacao_slug = aplicacoes.slug))';

export async function rotasAplicacoes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/aplicacoes', async (req) => req.usuario!.perfil === 'admin'
    ? db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE ativo = 1 ORDER BY nome`).all()
    : db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE ativo = 1 AND ${VISIVEL} ORDER BY nome`).all(req.usuario!.id, req.usuario!.perfil));

  // ----- Favoritos de cada usuário (guardados no servidor) -----
  app.get('/api/favoritos', async (req) =>
    (db.prepare(`SELECT f.aplicacao_slug FROM favoritos f JOIN aplicacoes ON aplicacoes.slug = f.aplicacao_slug WHERE f.usuario_id = ? AND (? = 'admin' OR ${VISIVEL}) ORDER BY f.criado_em`).all(req.usuario!.id, req.usuario!.perfil, req.usuario!.id, req.usuario!.perfil) as { aplicacao_slug: string }[]).map((f) => f.aplicacao_slug),
  );
  app.put<{ Params: { slug: string } }>('/api/favoritos/:slug', async (req, resp) => {
    if (!db.prepare(`SELECT 1 FROM aplicacoes WHERE slug = ? AND ativo = 1 AND (? = 'admin' OR ${VISIVEL})`).get(req.params.slug, req.usuario!.perfil, req.usuario!.id, req.usuario!.perfil)) return resp.code(404).send({ erro: 'Aplicação não encontrada.' });
    db.prepare('INSERT OR IGNORE INTO favoritos (usuario_id, aplicacao_slug, criado_em) VALUES (?, ?, ?)').run(req.usuario!.id, req.params.slug, new Date().toISOString());
    return { ok: true };
  });
  app.delete<{ Params: { slug: string } }>('/api/favoritos/:slug', async (req) => {
    db.prepare('DELETE FROM favoritos WHERE usuario_id = ? AND aplicacao_slug = ?').run(req.usuario!.id, req.params.slug);
    return { ok: true };
  });

  // ----- Gestão do catálogo (somente admin: cada app é um link para sistema externo) -----

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
      restrita: c.restrita ? 1 : 0,
    };
  }

  // Traz o ícone do próprio aplicativo (favicon do endereço informado) e guarda no portal.
  app.post('/api/gestao/aplicacoes/icone', { preHandler: exigirPerm('pub.aplicativos.criar', 'pub.aplicativos.editar') }, async (req, resp) => {
    const url = String(urlHttp(corpoObjeto(req.body), 'url', 'Endereço (URL)', false));
    const logo = await buscarIcone(db, url);
    if (!logo) return resp.code(404).send({ erro: 'Não encontramos o ícone deste aplicativo. Envie uma imagem pelo botão "Escolher imagem".' });
    auditar(db, req.usuario!.id, 'aplicacao_icone_buscado', { url });
    return { logo };
  });

  app.get('/api/gestao/aplicacoes', { preHandler: exigirPerm('pub.aplicativos.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM aplicacoes ORDER BY nome`).all());

  app.post('/api/gestao/aplicacoes', { preHandler: exigirPerm('pub.aplicativos.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM aplicacoes WHERE slug = ?').get(s), d.nome);
    db.prepare('INSERT INTO aplicacoes (slug, nome, descricao, categoria, url, acesso, icone, logo, responsavel, ativo, restrita) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(slug, d.nome, d.descricao, d.categoria, d.url, d.acesso, d.icone, d.logo, d.responsavel, d.ativo, d.restrita);
    auditar(db, req.usuario!.id, 'aplicacao_criada', { slug, nome: d.nome });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE slug = ?`).get(slug));
  });

  app.put<{ Params: { slug: string } }>('/api/gestao/aplicacoes/:slug', { preHandler: exigirPerm('pub.aplicativos.editar') }, async (req, resp) => {
    if (!db.prepare('SELECT 1 FROM aplicacoes WHERE slug = ?').get(req.params.slug)) return resp.code(404).send({ erro: 'Aplicação não encontrada.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare('UPDATE aplicacoes SET nome = ?, descricao = ?, categoria = ?, url = ?, acesso = ?, icone = ?, logo = ?, responsavel = ?, ativo = ?, restrita = ? WHERE slug = ?')
      .run(d.nome, d.descricao, d.categoria, d.url, d.acesso, d.icone, d.logo, d.responsavel, d.ativo, d.restrita, req.params.slug);
    auditar(db, req.usuario!.id, 'aplicacao_alterada', { slug: req.params.slug, ativo: d.ativo, restrita: d.restrita });
    return db.prepare(`SELECT ${CAMPOS} FROM aplicacoes WHERE slug = ?`).get(req.params.slug);
  });

  // ----- Aplicativos de cada pessoa (Configurações › Usuários › Aplicativos) -----
  const doUsuario = { preHandler: exigirPerm('cfg.usuarios.aplicativos') };
  const alvo = (id: string) => { const n = Number(id); return Number.isInteger(n) ? db.prepare('SELECT id, login, perfil FROM usuarios WHERE id = ?').get(n) as { id: number; login: string; perfil: string } | undefined : undefined; };
  app.get<{ Params: { id: string } }>('/api/usuarios/:id/aplicativos', doUsuario, async (req, resp) => {
    const u = alvo(req.params.id); if (!u) return resp.code(404).send({ erro: 'Usuário não encontrado.' });
    const restritas = db.prepare('SELECT slug, nome, categoria, ativo FROM aplicacoes WHERE restrita = 1 ORDER BY nome').all();
    const liberados = (db.prepare('SELECT aplicacao_slug FROM usuarios_aplicativos WHERE usuario_id = ?').all(u.id) as { aplicacao_slug: string }[]).map((r) => r.aplicacao_slug);
    const doPerfil = (db.prepare('SELECT aplicacao_slug FROM perfis_aplicativos WHERE perfil = ?').all(u.perfil) as { aplicacao_slug: string }[]).map((r) => r.aplicacao_slug);
    return { restritas, liberados, doPerfil, perfilNome: nomeDoPerfil(db, u.perfil), admin: u.perfil === 'admin' };
  });
  app.put<{ Params: { id: string } }>('/api/usuarios/:id/aplicativos', doUsuario, async (req, resp) => {
    const u = alvo(req.params.id); if (!u) return resp.code(404).send({ erro: 'Usuário não encontrado.' });
    if (u.perfil === 'admin' && req.usuario!.perfil !== 'admin') return resp.code(403).send({ erro: 'Você não pode alterar administradores.' });
    const lista = corpoObjeto(req.body).liberados;
    if (!Array.isArray(lista) || lista.some((x) => typeof x !== 'string')) throw new ErroValidacao('Aplicativos: envie a lista de aplicativos liberados.');
    const validos = new Set((db.prepare('SELECT slug FROM aplicacoes WHERE restrita = 1').all() as { slug: string }[]).map((r) => r.slug));
    const novos = [...new Set(lista as string[])].filter((x) => validos.has(x));
    db.prepare('DELETE FROM usuarios_aplicativos WHERE usuario_id = ?').run(u.id);
    const ins = db.prepare('INSERT INTO usuarios_aplicativos (usuario_id, aplicacao_slug) VALUES (?, ?)');
    for (const slug of novos) ins.run(u.id, slug);
    db.prepare('DELETE FROM favoritos WHERE usuario_id = ? AND aplicacao_slug IN (SELECT slug FROM aplicacoes WHERE restrita = 1) AND aplicacao_slug NOT IN (SELECT aplicacao_slug FROM usuarios_aplicativos WHERE usuario_id = ?) AND aplicacao_slug NOT IN (SELECT aplicacao_slug FROM perfis_aplicativos WHERE perfil = ?)').run(u.id, u.id, u.perfil);
    auditar(db, req.usuario!.id, 'usuario_aplicativos_alterados', { usuario: u.login, liberados: novos.length });
    return { ok: true, liberados: novos };
  });

  // ----- Aplicativos de cada PERFIL (Configurações › Perfis): o que o perfil libera; cada pessoa ainda pode receber extras -----
  const restritasLista = () => db.prepare('SELECT slug, nome, categoria, ativo FROM aplicacoes WHERE restrita = 1 ORDER BY nome').all();
  app.get('/api/aplicativos-restritos', { preHandler: exigirPerm('cfg.perfis.ver', 'cfg.usuarios.aplicativos') }, async () => restritasLista());
  app.get<{ Params: { codigo: string } }>('/api/perfis/:codigo/aplicativos', { preHandler: exigirPerm('cfg.perfis.ver') }, async (req, resp) => {
    if (!perfilExiste(db, req.params.codigo)) return resp.code(404).send({ erro: 'Perfil não encontrado.' });
    const liberados = (db.prepare('SELECT aplicacao_slug FROM perfis_aplicativos WHERE perfil = ?').all(req.params.codigo) as { aplicacao_slug: string }[]).map((r) => r.aplicacao_slug);
    return { restritas: restritasLista(), liberados, admin: req.params.codigo === 'admin' };
  });
  app.put<{ Params: { codigo: string } }>('/api/perfis/:codigo/aplicativos', { preHandler: exigirPerm('cfg.perfis.editar') }, async (req, resp) => {
    const codigo = req.params.codigo;
    if (!perfilExiste(db, codigo)) return resp.code(404).send({ erro: 'Perfil não encontrado.' });
    if (codigo === 'admin') return resp.code(400).send({ erro: 'O administrador sempre vê todos os aplicativos.' });
    const lista = corpoObjeto(req.body).liberados;
    if (!Array.isArray(lista) || lista.some((x) => typeof x !== 'string')) throw new ErroValidacao('Aplicativos: envie a lista de aplicativos liberados.');
    const validos = new Set((restritasLista() as { slug: string }[]).map((r) => r.slug));
    const novos = [...new Set(lista as string[])].filter((x) => validos.has(x));
    db.prepare('DELETE FROM perfis_aplicativos WHERE perfil = ?').run(codigo);
    const ins = db.prepare('INSERT INTO perfis_aplicativos (perfil, aplicacao_slug) VALUES (?, ?)');
    for (const slug of novos) ins.run(codigo, slug);
    // Quem perdeu o acesso (nem pelo perfil, nem pessoalmente) deixa de ter o aplicativo nos favoritos.
    db.prepare(`DELETE FROM favoritos WHERE usuario_id IN (SELECT id FROM usuarios WHERE perfil = ?)
                AND aplicacao_slug IN (SELECT slug FROM aplicacoes WHERE restrita = 1)
                AND aplicacao_slug NOT IN (SELECT aplicacao_slug FROM perfis_aplicativos WHERE perfil = ?)
                AND NOT EXISTS (SELECT 1 FROM usuarios_aplicativos ua WHERE ua.usuario_id = favoritos.usuario_id AND ua.aplicacao_slug = favoritos.aplicacao_slug)`).run(codigo, codigo);
    auditar(db, req.usuario!.id, 'perfil_aplicativos_alterados', { perfil: codigo, liberados: novos.length });
    return { ok: true, liberados: novos };
  });

  app.delete<{ Params: { slug: string } }>('/api/gestao/aplicacoes/:slug', { preHandler: exigirPerm('pub.aplicativos.excluir') }, async (req, resp) => {
    const a = db.prepare('SELECT nome FROM aplicacoes WHERE slug = ?').get(req.params.slug) as { nome: string } | undefined;
    if (!a) return resp.code(404).send({ erro: 'Aplicação não encontrada.' });
    db.prepare('DELETE FROM aplicacoes WHERE slug = ?').run(req.params.slug);
    auditar(db, req.usuario!.id, 'aplicacao_apagada', { slug: req.params.slug, nome: a.nome });
    return { ok: true };
  });
}
