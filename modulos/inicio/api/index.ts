import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

const TIPOS = ['mes', 'ano'] as const;
const STATUS = ['rascunho', 'aprovado', 'retirado'] as const;
const CAMPOS = `d.id, p.tipo, p.rotulo, d.nome, d.area, d.apresentacao, d.consentimento_ref, d.status`;

const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

export async function rotasInicio(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // Só aparece destaque aprovado, de período publicado. Sem ranking.
  app.get('/api/destaques', async () =>
    db
      .prepare(
        "SELECT p.tipo, p.rotulo, d.nome, d.area, d.iniciais, d.apresentacao FROM destaques d JOIN periodos_destaque p ON p.id = d.periodo_id WHERE d.status = 'aprovado' AND p.status = 'publicado' ORDER BY p.tipo, d.id",
      )
      .all(),
  );

  // ----- Gestão (editor e admin). Aprovar exige referência do consentimento da pessoa (LGPD). -----
  const gestao = { preHandler: exigir('admin', 'editor') };

  function ler(c: Record<string, unknown>) {
    const status = escolha(c, 'status', 'Situação', STATUS, 'rascunho');
    const consentimento_ref = texto(c, 'consentimento_ref', 'Referência do consentimento', { max: 200, opcional: true });
    if (status === 'aprovado' && !consentimento_ref) throw new ErroValidacao('Para aprovar, informe a referência do consentimento da pessoa (ex.: termo assinado em 02/10/2026).');
    const nome = String(texto(c, 'nome', 'Nome', { min: 2, max: 80 }));
    return {
      tipo: escolha(c, 'tipo', 'Tipo', TIPOS),
      rotulo: String(texto(c, 'rotulo', 'Período', { max: 40 })),
      nome, iniciais: iniciais(nome),
      area: String(texto(c, 'area', 'Área', { max: 60 })),
      apresentacao: String(texto(c, 'apresentacao', 'Apresentação', { max: 300 })),
      consentimento_ref, status,
    };
  }
  const periodoId = (tipo: string, rotulo: string): number => {
    const p = db.prepare('SELECT id FROM periodos_destaque WHERE tipo = ? AND rotulo = ?').get(tipo, rotulo) as { id: number } | undefined;
    if (p) return p.id;
    return Number(db.prepare("INSERT INTO periodos_destaque (tipo, rotulo, status) VALUES (?, ?, 'publicado')").run(tipo, rotulo).lastInsertRowid);
  };
  const buscar = (id: number) => db.prepare(`SELECT ${CAMPOS} FROM destaques d JOIN periodos_destaque p ON p.id = d.periodo_id WHERE d.id = ?`).get(id);

  app.get('/api/gestao/destaques', gestao, async () =>
    db.prepare(`SELECT ${CAMPOS} FROM destaques d JOIN periodos_destaque p ON p.id = d.periodo_id ORDER BY p.tipo, d.id DESC`).all(),
  );

  app.post('/api/gestao/destaques', gestao, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const r = db.prepare('INSERT INTO destaques (periodo_id, nome, area, iniciais, apresentacao, consentimento_ref, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(periodoId(d.tipo, d.rotulo), d.nome, d.area, d.iniciais, d.apresentacao, d.consentimento_ref, d.status);
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'destaque_criado', { id, nome: d.nome, status: d.status });
    return resp.code(201).send(buscar(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/destaques/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Destaque');
    if (!db.prepare('SELECT 1 FROM destaques WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Destaque não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare('UPDATE destaques SET periodo_id = ?, nome = ?, area = ?, iniciais = ?, apresentacao = ?, consentimento_ref = ?, status = ? WHERE id = ?')
      .run(periodoId(d.tipo, d.rotulo), d.nome, d.area, d.iniciais, d.apresentacao, d.consentimento_ref, d.status, id);
    auditar(db, req.usuario!.id, 'destaque_alterado', { id, nome: d.nome, status: d.status });
    return buscar(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/destaques/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Destaque');
    const d = db.prepare('SELECT nome FROM destaques WHERE id = ?').get(id) as { nome: string } | undefined;
    if (!d) return resp.code(404).send({ erro: 'Destaque não encontrado.' });
    db.prepare('DELETE FROM destaques WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'destaque_apagado', { id, nome: d.nome });
    return { ok: true };
  });
}
