import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao, inteiro, texto } from '../../../servidor/src/validar.ts';

/** Contatos por ÁREA (canal da área: e-mail, ramal, ferramenta). Não guarda dados pessoais de funcionários. */
export async function rotasPessoas(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/contatos', { preHandler: exigirPerm('ver.pessoas') }, async () =>
    db
      .prepare(
        `SELECT c.id, d.nome AS departamento, c.nome, c.canal, c.ramal, c.celular FROM contatos c JOIN departamentos d ON d.id = c.departamento_id
         WHERE c.publicavel = 1 AND d.ativo = 1 ORDER BY d.nome, c.nome`,
      )
      .all(),
  );

  // ----- Gestão (editor e admin) -----
  const CAMPOS = 'c.id, d.nome AS departamento, c.nome, c.canal, c.ramal, c.celular, c.publicavel';
  const buscar = (id: number) => db.prepare(`SELECT ${CAMPOS} FROM contatos c JOIN departamentos d ON d.id = c.departamento_id WHERE c.id = ?`).get(id);

  function ler(c: Record<string, unknown>) {
    const canal = texto(c, 'canal', 'Canal', { max: 120, opcional: true });
    const ramal = texto(c, 'ramal', 'Ramal', { max: 20, opcional: true });
    const celular = texto(c, 'celular', 'Celular', { max: 20, opcional: true });
    if (ramal && !/^[0-9][0-9 /.\-]{0,19}$/.test(ramal)) throw new ErroValidacao('Ramal: use só números (e, se precisar, espaço, / ou -). Ex.: 2400');
    if (celular && !/^\+?[0-9 ()\-]{8,20}$/.test(celular)) throw new ErroValidacao('Celular: informe com DDD. Ex.: (62) 99999-0000');
    if (!canal && !ramal && !celular) throw new ErroValidacao('Informe pelo menos um meio de contato: canal (e-mail ou link), ramal ou celular.');
    return {
      departamento: String(texto(c, 'departamento', 'Área', { max: 60 })),
      nome: String(texto(c, 'nome', 'Contato', { max: 80 })),
      canal: canal ?? '', ramal, celular,
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

  app.get('/api/gestao/contatos', { preHandler: exigirPerm('pub.contatos.ver') }, async () =>
    db.prepare(`SELECT ${CAMPOS} FROM contatos c JOIN departamentos d ON d.id = c.departamento_id ORDER BY d.nome, c.nome`).all(),
  );

  app.post('/api/gestao/contatos', { preHandler: exigirPerm('pub.contatos.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const r = db.prepare('INSERT INTO contatos (departamento_id, nome, canal, ramal, celular, publicavel) VALUES (?, ?, ?, ?, ?, ?)').run(departamentoId(d.departamento), d.nome, d.canal, d.ramal, d.celular, d.publicavel);
    const id = Number(r.lastInsertRowid);
    auditar(db, req.usuario!.id, 'contato_criado', { id, departamento: d.departamento, nome: d.nome });
    return resp.code(201).send(buscar(id));
  });

  app.put<{ Params: { id: string } }>('/api/gestao/contatos/:id', { preHandler: exigirPerm('pub.contatos.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Contato');
    if (!db.prepare('SELECT 1 FROM contatos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Contato não encontrado.' });
    const d = ler(corpoObjeto(req.body));
    db.prepare('UPDATE contatos SET departamento_id = ?, nome = ?, canal = ?, ramal = ?, celular = ?, publicavel = ? WHERE id = ?').run(departamentoId(d.departamento), d.nome, d.canal, d.ramal, d.celular, d.publicavel, id);
    auditar(db, req.usuario!.id, 'contato_alterado', { id, departamento: d.departamento, nome: d.nome });
    return buscar(id);
  });

  app.delete<{ Params: { id: string } }>('/api/gestao/contatos/:id', { preHandler: exigirPerm('pub.contatos.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Contato');
    const c = db.prepare('SELECT nome FROM contatos WHERE id = ?').get(id) as { nome: string } | undefined;
    if (!c) return resp.code(404).send({ erro: 'Contato não encontrado.' });
    db.prepare('DELETE FROM contatos WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'contato_apagado', { id, nome: c.nome });
    return { ok: true };
  });
}
