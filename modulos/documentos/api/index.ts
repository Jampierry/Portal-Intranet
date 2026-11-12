import { createReadStream, existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../servidor/src/config.ts';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigir, exigirPerm } from '../../acessos/api/guard.ts';
import { cancelarPendentes, exigeAprovacao, solicitarAprovacao } from '../../aprovacoes/api/index.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, slugUnico, texto, urlHttp } from '../../../servidor/src/validar.ts';

const CLASSIFICACOES = ['publico', 'interno', 'restrito'] as const;
const CAMPOS = 'id, slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, origem, origem_id, link_oficial, revisado_em, exibir_de, atualizado_em, publicado';
const TIPOS: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };
const CAMINHO_ABSOLUTO = /^(\\\\[^\\/]+[\\/]|[A-Za-z]:[\\/]|\/)/;

/** Endereço do documento: link http(s) ou caminho relativo dentro da pasta de origem (portal ou servidor cadastrado). */
function lerEndereco(c: Record<string, unknown>, origem: 'link' | 'pasta' | 'servidor'): string | null {
  if (origem === 'link') return urlHttp(c, 'link_oficial', 'Link do documento');
  const v = texto(c, 'link_oficial', 'Arquivo na pasta', { max: 500, opcional: true });
  if (v === null) return null;
  const rel = v.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.split('/').some((p) => p === '..' || p === '') || /^[A-Za-z]:/.test(rel)) throw new ErroValidacao('Arquivo na pasta: escolha o arquivo na lista (caminho relativo, sem "..").');
  return rel;
}

/** Pasta-raiz do documento: a do portal ('pasta') ou a origem cadastrada ('servidor'). */
function raizDe(db: Banco, origem: string, origemId: number | null): string | null {
  if (origem === 'pasta') return config.pastaDocumentos();
  if (origem === 'servidor' && origemId) return (db.prepare('SELECT caminho FROM documento_origens WHERE id = ?').get(origemId) as { caminho: string } | undefined)?.caminho ?? null;
  return null;
}

export async function rotasDocumentos(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // Documentos "restritos" só aparecem para editor e admin.
  app.get('/api/documentos', { preHandler: exigirPerm('ver.documentos') }, async (req) => {
    const podeVerRestrito = !!req.usuario?.permissoes.includes('documentos.restritos');
    const podeAbrir = !!req.usuario?.permissoes.includes('documentos.abrir');
    const lista = db
      .prepare(`SELECT slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, origem, link_oficial, revisado_em FROM documentos WHERE publicado = 1 AND (exibir_de IS NULL OR exibir_de <= date('now','localtime'))${podeVerRestrito ? '' : " AND classificacao <> 'restrito'"} ORDER BY titulo`)
      .all() as { slug: string; origem: string; link_oficial: string | null }[];
    // Sem a permissão de abrir, o endereço do documento nem sai do servidor. Em pasta (portal ou servidor), o endereço é o da
    // rota de download (o caminho real no servidor nunca sai).
    return lista.map((d) => (!podeAbrir || !d.link_oficial ? { ...d, link_oficial: null } : (d.origem === 'pasta' || d.origem === 'servidor') ? { ...d, link_oficial: `/api/documentos/${d.slug}/arquivo` } : d));
  });

  app.get<{ Params: { slug: string } }>('/api/documentos/:slug/arquivo', { preHandler: exigirPerm('ver.documentos') }, async (req, resp) => {
    if (!req.usuario?.permissoes.includes('documentos.abrir')) return resp.code(403).send({ erro: 'Sem permissão para abrir documentos.' });
    const d = db.prepare("SELECT classificacao, link_oficial, origem, origem_id FROM documentos WHERE slug = ? AND publicado = 1 AND (exibir_de IS NULL OR exibir_de <= date('now','localtime')) AND origem IN ('pasta', 'servidor')").get(req.params.slug) as { classificacao: string; link_oficial: string | null; origem: string; origem_id: number | null } | undefined;
    if (!d?.link_oficial || (d.classificacao === 'restrito' && !req.usuario.permissoes.includes('documentos.restritos'))) return resp.code(404).send({ erro: 'Arquivo não encontrado.' });
    try {
      const base = raizDe(db, d.origem, d.origem_id);
      if (!base) throw new Error('sem origem');
      const raiz = realpathSync(base);
      const alvo = realpathSync(resolve(raiz, d.link_oficial));
      const rel = relative(raiz, alvo);
      if (rel.startsWith('..') || isAbsolute(rel) || !statSync(alvo).isFile()) throw new Error('fora da pasta');
      const tipo = TIPOS[extname(alvo).toLowerCase()];
      return resp
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Type', tipo ?? 'application/octet-stream')
        .header('Content-Disposition', `${tipo ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(basename(alvo))}`)
        .send(createReadStream(alvo));
    } catch {
      return resp.code(404).send({ erro: 'Arquivo não encontrado na pasta do servidor.' });
    }
  });

  function ler(c: Record<string, unknown>) {
    // O formulário envia 'link', 'pasta' ou 's<id>' (origem cadastrada).
    const m = /^s(\d+)$/.exec(String(c.origem ?? ''));
    const origem: 'link' | 'pasta' | 'servidor' = m ? 'servidor' : escolha(c, 'origem', 'Onde está o documento', ['link', 'pasta'] as const, 'link');
    const origemId = m ? Number(m[1]) : null;
    if (origemId !== null && !db.prepare('SELECT 1 FROM documento_origens WHERE id = ?').get(origemId)) throw new ErroValidacao('Origem de documentos não encontrada.');
    return {
      titulo: String(texto(c, 'titulo', 'Título', { min: 3, max: 120 })),
      categoria: String(texto(c, 'categoria', 'Categoria', { max: 40 })),
      resumo: String(texto(c, 'resumo', 'Resumo', { max: 300 })),
      formato: String(texto(c, 'formato', 'Formato', { max: 40 })),
      versao: texto(c, 'versao', 'Versão', { max: 20, opcional: true }),
      responsavel: texto(c, 'responsavel', 'Responsável', { max: 80, opcional: true }),
      classificacao: escolha(c, 'classificacao', 'Classificação', CLASSIFICACOES, 'interno'),
      origem,
      origem_id: origemId,
      link_oficial: lerEndereco(c, origem),
      revisado_em: dataIso(c, 'revisado_em', 'Revisado em'),
      exibir_de: dataIso(c, 'exibir_de', 'Publicar a partir de'),
    };
  }

  // Navegador de pastas (subpastas e arquivos de um nível): pasta do portal (sem ?origem) ou origem cadastrada (?origem=<id>).
  app.get<{ Querystring: { sub?: string; origem?: string } }>('/api/gestao/documentos/pasta', { preHandler: exigirPerm('pub.documentos.criar', 'pub.documentos.editar') }, async (req, resp) => {
    const sub = (req.query.sub ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (sub.split('/').some((p) => p === '..')) return resp.code(400).send({ erro: 'Caminho inválido.' });
    const idOrigem = /^\d+$/.test(req.query.origem ?? '') ? Number(req.query.origem) : null;
    try {
      const base = idOrigem ? raizDe(db, 'servidor', idOrigem) : config.pastaDocumentos();
      if (!base) throw new Error('sem origem');
      const raiz = realpathSync(base);
      const dir = realpathSync(resolve(raiz, sub));
      const rel = relative(raiz, dir);
      if (rel.startsWith('..') || isAbsolute(rel) || !statSync(dir).isDirectory()) throw new Error('fora');
      const itens = readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.') && (e.isDirectory() || e.isFile()))
        .map((e) => ({ nome: e.name, pasta: e.isDirectory() }))
        .sort((a, b) => Number(b.pasta) - Number(a.pasta) || a.nome.localeCompare(b.nome, 'pt-BR'));
      return { sub: rel.replace(/\\/g, '/'), itens };
    } catch {
      return resp.code(404).send({ erro: idOrigem ? 'O servidor do portal não consegue abrir esta pasta (caminho errado ou sem permissão de leitura). Fale com a TI.' : 'A pasta de documentos do portal não existe no servidor ou está vazia (variável DOCUMENTOS_PASTA).' });
    }
  });

  // Origens de documentos: quem publica vê só os nomes; o administrador vê o caminho e altera.
  app.get('/api/gestao/documentos/origens', { preHandler: exigirPerm('pub.documentos.ver', 'pub.documentos.criar', 'pub.documentos.editar') }, async (req) => {
    const lista = db.prepare('SELECT id, nome, caminho FROM documento_origens ORDER BY nome').all() as { id: number; nome: string; caminho: string }[];
    if (req.usuario?.perfil !== 'admin') return lista.map((o) => ({ id: o.id, nome: o.nome }));
    return lista.map((o) => ({ ...o, acessivel: (() => { try { return statSync(o.caminho).isDirectory(); } catch { return false; } })() }));
  });
  // Seletor de pasta do servidor (só administrador): lista as subpastas de um caminho; sem caminho, lista as unidades (Windows) ou a raiz.
  app.get<{ Querystring: { caminho?: string } }>('/api/gestao/documentos/origens/navegar', { preHandler: exigir('admin') }, async (req, resp) => {
    const caminho = (req.query.caminho ?? '').trim();
    if (!caminho) {
      const raizes = process.platform === 'win32' ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`).filter((r) => existsSync(r)) : ['/'];
      return { caminho: '', pai: null, pastas: raizes.map((r) => ({ nome: r, caminho: r })) };
    }
    if (!CAMINHO_ABSOLUTO.test(caminho)) return resp.code(400).send({ erro: 'Informe um caminho completo (\\\\servidor\\pasta ou X:\\pasta).' });
    try {
      if (!statSync(caminho).isDirectory()) throw new Error('não é pasta');
      const pastas = readdirSync(caminho, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'))
        .map((e) => ({ nome: e.name, caminho: resolve(caminho, e.name) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const pai = dirname(resolve(caminho));
      return { caminho: resolve(caminho), pai: pai === resolve(caminho) ? '' : pai, pastas };
    } catch {
      return resp.code(404).send({ erro: 'O servidor do portal não consegue abrir essa pasta (não existe ou sem permissão de leitura).' });
    }
  });
  const lerOrigem = (c: Record<string, unknown>, idAtual: number) => {
    const caminho = String(texto(c, 'caminho', 'Pasta no servidor', { max: 500 }));
    if (!CAMINHO_ABSOLUTO.test(caminho)) throw new ErroValidacao('Pasta no servidor: use \\\\servidor\\pasta, X:\\pasta ou um caminho absoluto.');
    const nome = String(texto(c, 'nome', 'Nome da origem', { min: 2, max: 40 }));
    if (db.prepare('SELECT 1 FROM documento_origens WHERE nome = ? AND id <> ?').get(nome, idAtual)) throw new ErroValidacao('Já existe uma origem com esse nome.');
    return { nome, caminho };
  };
  app.post('/api/gestao/documentos/origens', { preHandler: exigir('admin') }, async (req, resp) => {
    const o = lerOrigem(corpoObjeto(req.body), 0);
    const id = Number(db.prepare('INSERT INTO documento_origens (nome, caminho) VALUES (?, ?)').run(o.nome, o.caminho).lastInsertRowid);
    auditar(db, req.usuario!.id, 'documento_origem_criada', { id, ...o });
    return resp.code(201).send({ id, ...o });
  });
  app.put<{ Params: { id: string } }>('/api/gestao/documentos/origens/:id', { preHandler: exigir('admin') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Origem');
    if (!db.prepare('SELECT 1 FROM documento_origens WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Origem não encontrada.' });
    const o = lerOrigem(corpoObjeto(req.body), id);
    db.prepare('UPDATE documento_origens SET nome = ?, caminho = ? WHERE id = ?').run(o.nome, o.caminho, id);
    auditar(db, req.usuario!.id, 'documento_origem_alterada', { id, ...o });
    return { id, ...o };
  });
  app.delete<{ Params: { id: string } }>('/api/gestao/documentos/origens/:id', { preHandler: exigir('admin') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Origem');
    const n = (db.prepare("SELECT COUNT(*) AS n FROM documentos WHERE origem = 'servidor' AND origem_id = ?").get(id) as { n: number }).n;
    if (n > 0) return resp.code(400).send({ erro: `Há ${n} documento(s) usando esta origem. Mude ou apague esses documentos antes.` });
    db.prepare('DELETE FROM documento_origens WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'documento_origem_apagada', { id });
    return { ok: true };
  });

  app.get('/api/gestao/documentos', { preHandler: exigirPerm('pub.documentos.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM documentos ORDER BY titulo`).all());

  app.post('/api/gestao/documentos', { preHandler: exigirPerm('pub.documentos.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const paraAprovar = exigeAprovacao(req.usuario!, 'documentos'); // fica oculto até o RH aprovar
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM documentos WHERE slug = ?').get(s), d.titulo);
    const r = db.prepare(
      `INSERT INTO documentos (slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, origem, origem_id, link_oficial, revisado_em, exibir_de, atualizado_em, publicado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(slug, d.titulo, d.categoria, d.resumo, d.formato, d.versao, d.responsavel, d.classificacao, d.origem, d.origem_id, d.link_oficial, d.revisado_em, d.exibir_de, new Date().toISOString(), paraAprovar ? 0 : 1);
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'documento_criado', { id, titulo: d.titulo });
    if (paraAprovar) solicitarAprovacao(db, { tipo: 'documento', registroId: id, titulo: d.titulo, solicitanteId: req.usuario!.id });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM documentos WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/documentos/:id', { preHandler: exigirPerm('pub.documentos.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Documento');
    if (!db.prepare('SELECT 1 FROM documentos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Documento não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    const paraAprovar = exigeAprovacao(req.usuario!, 'documentos'); // a versão nova fica oculta até o RH aprovar
    db.prepare(
      `UPDATE documentos SET publicado = ${paraAprovar ? 0 : 1}, titulo = ?, categoria = ?, resumo = ?, formato = ?, versao = ?, responsavel = ?, classificacao = ?, origem = ?, origem_id = ?, link_oficial = ?, revisado_em = ?, exibir_de = ?, atualizado_em = ? WHERE id = ?`,
    ).run(d.titulo, d.categoria, d.resumo, d.formato, d.versao, d.responsavel, d.classificacao, d.origem, d.origem_id, d.link_oficial, d.revisado_em, d.exibir_de, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'documento_alterado', { id, titulo: d.titulo });
    if (paraAprovar) solicitarAprovacao(db, { tipo: 'documento', registroId: id, titulo: d.titulo, solicitanteId: req.usuario!.id });
    else cancelarPendentes(db, 'documento', id);
    return db.prepare(`SELECT ${CAMPOS} FROM documentos WHERE id = ?`).get(id);
  });

  // Mudar só a data de publicação: quem precisa de aprovação volta para a fila do RH (o documento sai do ar até lá).
  app.post<{ Params: { id: string } }>('/api/gestao/documentos/:id/data', { preHandler: exigirPerm('pub.documentos.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Documento');
    const d = db.prepare('SELECT titulo FROM documentos WHERE id = ?').get(id) as { titulo: string } | undefined;
    if (!d) return resp.code(404).send({ erro: 'Documento não encontrado.' });
    const data = dataIso(corpoObjeto(req.body), 'exibir_de', 'Nova data de publicação');
    if (!data) throw new ErroValidacao('Nova data de publicação: informe a data.');
    const volta = exigeAprovacao(req.usuario!, 'documentos');
    db.prepare(`UPDATE documentos SET exibir_de = ?${volta ? ', publicado = 0' : ''}, atualizado_em = ? WHERE id = ?`).run(data, new Date().toISOString(), id);
    if (volta) solicitarAprovacao(db, { tipo: 'documento', registroId: id, titulo: `${d.titulo} (nova data: ${data.split('-').reverse().join('/')})`, solicitanteId: req.usuario!.id });
    auditar(db, req.usuario!.id, 'documento_data_alterada', { id, data, volta_para_aprovacao: volta });
    return db.prepare(`SELECT ${CAMPOS} FROM documentos WHERE id = ?`).get(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/documentos/:id', { preHandler: exigirPerm('pub.documentos.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Documento');
    const d = db.prepare('SELECT titulo FROM documentos WHERE id = ?').get(id) as { titulo: string } | undefined;
    if (!d) return resp.code(404).send({ erro: 'Documento não encontrado.' });
    db.prepare('DELETE FROM documentos WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'documento_apagado', { id, titulo: d.titulo });
    return { ok: true };
  });
}
