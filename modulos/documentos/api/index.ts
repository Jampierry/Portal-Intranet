import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import { corpoObjeto, dataIso, escolha, inteiro, slugUnico, texto, urlHttp } from '../../../servidor/src/validar.ts';

const CLASSIFICACOES = ['publico', 'interno', 'restrito'] as const;
const CAMPOS = 'id, slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, link_oficial, revisado_em, atualizado_em';

export async function rotasDocumentos(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // Documentos "restritos" só aparecem para editor e admin.
  app.get('/api/documentos', async (req) => {
    const podeVerRestrito = req.usuario?.perfil === 'admin' || req.usuario?.perfil === 'editor';
    return db
      .prepare(`SELECT slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, link_oficial, revisado_em FROM documentos ${podeVerRestrito ? '' : "WHERE classificacao <> 'restrito'"} ORDER BY titulo`)
      .all();
  });

  const gestao = { preHandler: exigir('admin', 'editor') };

  function ler(c: Record<string, unknown>) {
    return {
      titulo: String(texto(c, 'titulo', 'Título', { min: 3, max: 120 })),
      categoria: String(texto(c, 'categoria', 'Categoria', { max: 40 })),
      resumo: String(texto(c, 'resumo', 'Resumo', { max: 300 })),
      formato: String(texto(c, 'formato', 'Formato', { max: 40 })),
      versao: texto(c, 'versao', 'Versão', { max: 20, opcional: true }),
      responsavel: texto(c, 'responsavel', 'Responsável', { max: 80, opcional: true }),
      classificacao: escolha(c, 'classificacao', 'Classificação', CLASSIFICACOES, 'interno'),
      link_oficial: urlHttp(c, 'link_oficial', 'Link do documento'),
      revisado_em: dataIso(c, 'revisado_em', 'Revisado em'),
    };
  }

  app.get('/api/gestao/documentos', gestao, async () => db.prepare(`SELECT ${CAMPOS} FROM documentos ORDER BY titulo`).all());

  app.post('/api/gestao/documentos', gestao, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const slug = slugUnico((s) => !!db.prepare('SELECT 1 FROM documentos WHERE slug = ?').get(s), d.titulo);
    const r = db.prepare(
      `INSERT INTO documentos (slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, link_oficial, revisado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(slug, d.titulo, d.categoria, d.resumo, d.formato, d.versao, d.responsavel, d.classificacao, d.link_oficial, d.revisado_em, new Date().toISOString());
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'documento_criado', { id, titulo: d.titulo });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS} FROM documentos WHERE id = ?`).get(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/documentos/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Documento');
    if (!db.prepare('SELECT 1 FROM documentos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Documento não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare(
      `UPDATE documentos SET titulo = ?, categoria = ?, resumo = ?, formato = ?, versao = ?, responsavel = ?, classificacao = ?, link_oficial = ?, revisado_em = ?, atualizado_em = ? WHERE id = ?`,
    ).run(d.titulo, d.categoria, d.resumo, d.formato, d.versao, d.responsavel, d.classificacao, d.link_oficial, d.revisado_em, new Date().toISOString(), id);
    auditar(db, req.usuario!.id, 'documento_alterado', { id, titulo: d.titulo });
    return db.prepare(`SELECT ${CAMPOS} FROM documentos WHERE id = ?`).get(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/documentos/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Documento');
    const d = db.prepare('SELECT titulo FROM documentos WHERE id = ?').get(id) as { titulo: string } | undefined;
    if (!d) return resp.code(404).send({ erro: 'Documento não encontrado.' });
    db.prepare('DELETE FROM documentos WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'documento_apagado', { id, titulo: d.titulo });
    return { ok: true };
  });
}
