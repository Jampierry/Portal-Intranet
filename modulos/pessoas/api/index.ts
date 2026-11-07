import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigir } from '../../acessos/api/guard.ts';
import { corpoObjeto, inteiro, texto } from '../../../servidor/src/validar.ts';

/** Contatos por ÁREA (canal da área: e-mail, ramal, ferramenta). Não guarda dados pessoais de funcionários. */
export async function rotasPessoas(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/contatos', async () =>
    db
      .prepare(
        `SELECT c.id, d.nome AS departamento, c.nome, c.canal FROM contatos c JOIN departamentos d ON d.id = c.departamento_id
         WHERE c.publicavel = 1 AND d.ativo = 1 ORDER BY d.nome, c.nome`,
      )
      .all(),
  );

  // ----- Gestão (editor e admin) -----
  const gestao = { preHandler: exigir('admin', 'editor') };
  const CAMPOS = 'c.id, d.nome AS departamento, c.nome, c.canal, c.publicavel';
  const buscar = (id: number) => db.prepare(`SELECT ${CAMPOS} FROM contatos c JOIN departamentos d ON d.id = c.departamento_id WHERE c.id = ?`).get(id);

  function ler(c: Record<string, unknown>) {
    return {
      departamento: String(texto(c, 'departamento', 'Área', { max: 60 })),
      nome: String(texto(c, 'nome', 'Contato', { max: 80 })),
      canal: String(texto(c, 'canal', 'Canal', { max: 120 })),
      publicavel: c.publicavel === undefined ? 1 : c.publicavel ? 1 : 0,
    };
  }
  const departamentoId = (nome: string): number => {
    const d = db.prepare('SELECT id FROM departamentos WHERE nome = ?').get(nome) as { id: number } | undefined;
    if (d) {
      db.prepare('UPDATE departamentos SET ativo = 1 WHERE id = ?').run(d.id);
      return d.id;
    }
    return Number(db.prepare('INSERT INTO departamentos (nome) VALUES (?)').run(nome).lastInsertRowid);
  };

  app.get('/api/gestao/contatos', gestao, async () =>
    db.prepare(`SELECT ${CAMPOS} FROM contatos c JOIN departamentos d ON d.id = c.departamento_id ORDER BY d.nome, c.nome`).all(),
  );

  app.post('/api/gestao/contatos', gestao, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const r = db.prepare('INSERT INTO contatos (departamento_id, nome, canal, publicavel) VALUES (?, ?, ?, ?)').run(departamentoId(d.departamento), d.nome, d.canal, d.publicavel);
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'contato_criado', { id, departamento: d.departamento, nome: d.nome });
    return resp.code(201).send(buscar(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/contatos/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Contato');
    if (!db.prepare('SELECT 1 FROM contatos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Contato não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare('UPDATE contatos SET departamento_id = ?, nome = ?, canal = ?, publicavel = ? WHERE id = ?').run(departamentoId(d.departamento), d.nome, d.canal, d.publicavel, id);
    auditar(db, req.usuario!.id, 'contato_alterado', { id, departamento: d.departamento, nome: d.nome });
    return buscar(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/contatos/:id', gestao, async (req, resp) => {
    const id = inteiro(req.params.id, 'Contato');
    const c = db.prepare('SELECT nome FROM contatos WHERE id = ?').get(id) as { nome: string } | undefined;
    if (!c) return resp.code(404).send({ erro: 'Contato não encontrado.' });
    db.prepare('DELETE FROM contatos WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'contato_apagado', { id, nome: c.nome });
    return { ok: true };
  });
}
