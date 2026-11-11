import { createReadStream, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../servidor/src/config.ts';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, dataIso, ErroValidacao, escolha, inteiro, slugUnico, texto, urlHttp } from '../../../servidor/src/validar.ts';

const CLASSIFICACOES = ['publico', 'interno', 'restrito'] as const;
const ORIGENS = ['link', 'pasta', 'rede'] as const;
const CAMPOS = 'id, slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, origem, link_oficial, revisado_em, atualizado_em';
const TIPOS: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };

/** Endereço do documento conforme a origem: link http(s), caminho relativo à pasta do portal ou caminho de rede (UNC / unidade). */
function lerEndereco(c: Record<string, unknown>, origem: (typeof ORIGENS)[number]): string | null {
  if (origem === 'link') return urlHttp(c, 'link_oficial', 'Link do documento');
  const v = texto(c, 'link_oficial', origem === 'pasta' ? 'Caminho na pasta do portal' : 'Caminho de rede', { max: 500, opcional: true });
  if (v === null) return null;
  if (origem === 'rede') {
    if (!/^(\\\\[^\\/]+[\\/]|[A-Za-z]:[\\/])/.test(v)) throw new ErroValidacao('Caminho de rede: use o formato \\\\servidor\\pasta\\arquivo ou X:\\pasta\\arquivo.');
    return v;
  }
  const rel = v.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.split('/').some((p) => p === '..' || p === '') || /^[A-Za-z]:/.test(rel)) throw new ErroValidacao('Caminho na pasta do portal: informe um caminho relativo, como RH/politica.pdf (sem "..").');
  return rel;
}

export async function rotasDocumentos(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // Documentos "restritos" só aparecem para editor e admin.
  app.get('/api/documentos', { preHandler: exigirPerm('ver.documentos') }, async (req) => {
    const podeVerRestrito = !!req.usuario?.permissoes.includes('documentos.restritos');
    const podeAbrir = !!req.usuario?.permissoes.includes('documentos.abrir');
    const lista = db
      .prepare(`SELECT slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, origem, link_oficial, revisado_em FROM documentos ${podeVerRestrito ? '' : "WHERE classificacao <> 'restrito'"} ORDER BY titulo`)
      .all() as { slug: string; origem: string; link_oficial: string | null }[];
    // Sem a permissão de abrir, o endereço do documento nem sai do servidor. Na pasta do portal, o endereço é o da rota
    // de download (o caminho real no servidor nunca sai).
    return lista.map((d) => (!podeAbrir || !d.link_oficial ? { ...d, link_oficial: null } : d.origem === 'pasta' ? { ...d, link_oficial: `/api/documentos/${d.slug}/arquivo` } : d));
  });

  app.get<{ Params: { slug: string } }>('/api/documentos/:slug/arquivo', { preHandler: exigirPerm('ver.documentos') }, async (req, resp) => {
    if (!req.usuario?.permissoes.includes('documentos.abrir')) return resp.code(403).send({ erro: 'Sem permissão para abrir documentos.' });
    const d = db.prepare("SELECT classificacao, link_oficial FROM documentos WHERE slug = ? AND origem = 'pasta'").get(req.params.slug) as { classificacao: string; link_oficial: string | null } | undefined;
    if (!d?.link_oficial || (d.classificacao === 'restrito' && !req.usuario.permissoes.includes('documentos.restritos'))) return resp.code(404).send({ erro: 'Arquivo não encontrado.' });
    try {
      const raiz = realpathSync(config.pastaDocumentos());
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
      return resp.code(404).send({ erro: 'Arquivo não encontrado na pasta de documentos do servidor.' });
    }
  });


  function ler(c: Record<string, unknown>) {
    const origem = escolha(c, 'origem', 'Onde está o documento', ORIGENS, 'link');
    return {
      titulo: String(texto(c, 'titulo', 'Título', { min: 3, max: 120 })),
      categoria: String(texto(c, 'categoria', 'Categoria', { max: 40 })),
      resumo: String(texto(c, 'resumo', 'Resumo', { max: 300 })),
      formato: String(texto(c, 'formato', 'Formato', { max: 40 })),
      versao: texto(c, 'versao', 'Versão', { max: 20, opcional: true }),
      responsavel: texto(c, 'responsavel', 'Responsável', { max: 80, opcional: true }),
      classificacao: escolha(c, 'classificacao', 'Classificação', CLASSIFICACOES, 'interno'),
      origem,
      link_oficial: lerEndereco(c, origem),
      revisado_em: dataIso(c, 'revisado_em', 'Revisado em'),
    };
  }

  // Navegador da pasta de documentos do portal (subpastas e arquivos de um nível), para escolher o arquivo no formulário.
  app.get<{ Querystring: { sub?: string } }>('/api/gestao/documentos/pasta', { preHandler: exigirPerm('pub.documentos.criar', 'pub.documentos.editar') }, async (req, resp) => {
    const sub = (req.query.sub ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (sub.split('/').some((p) => p === '..')) return resp.code(400).send({ erro: 'Caminho inválido.' });
    try {
      const raiz = realpathSync(config.pastaDocumentos());
      const dir = realpathSync(resolve(raiz, sub));
      const rel = relative(raiz, dir);
      if (rel.startsWith('..') || isAbsolute(rel) || !statSync(dir).isDirectory()) throw new Error('fora');
      const itens = readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.') && (e.isDirectory() || e.isFile()))
        .map((e) => ({ nome: e.name, pasta: e.isDirectory() }))
        .sort((a, b) => Number(b.pasta) - Number(a.pasta) || a.nome.localeCompare(b.nome, 'pt-BR'));
      return { sub: rel.replace(/\\/g, '/'), itens };
    } catch {
      return resp.code(404).send({ erro: 'A pasta de documentos do portal não existe no servidor ou está vazia. Crie a pasta e copie os arquivos (variável DOCUMENTOS_PASTA).' });
    }
  });

  app.get('/api/gestao/documentos', { preHandler: exigirPerm('pub.documentos.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM documentos ORDER BY titulo`).all());

  app.post('/api/gestao/documentos', { preHandler: exigirPerm('pub.documentos.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM documentos WHERE slug = ?').get(s), d.titulo);
    const r = db.prepare(
      `INSERT INTO documentos (slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, origem, link_oficial, revisado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(slug, d.titulo, d.categoria, d.resumo, d.formato, d.versao, d.responsavel, d.classificacao, d.origem, d.link_oficial, d.revisado_em, new Date().toISOString());
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'documento_criado', { id, titulo: d.titulo });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM documentos WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/documentos/:id', { preHandler: exigirPerm('pub.documentos.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Documento');
    if (!db.prepare('SELECT 1 FROM documentos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Documento não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare(
      `UPDATE documentos SET titulo = ?, categoria = ?, resumo = ?, formato = ?, versao = ?, responsavel = ?, classificacao = ?, origem = ?, link_oficial = ?, revisado_em = ?, atualizado_em = ? WHERE id = ?`,
    ).run(d.titulo, d.categoria, d.resumo, d.formato, d.versao, d.responsavel, d.classificacao, d.origem, d.link_oficial, d.revisado_em, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'documento_alterado', { id, titulo: d.titulo });
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
