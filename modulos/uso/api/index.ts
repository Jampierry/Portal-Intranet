// Uso do portal: mede se ele é relevante (quem entra, o que abre, quando e de qual aparelho), por pessoa e por departamento.
// Aviso aos colaboradores: o portal registra data, tela aberta e tipo de aparelho (nada do que é digitado). Guarda 12 meses.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { corpoObjeto, texto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { limparUsoAntigo, registrarUso } from './registro.ts';

const PERIODOS = [7, 30, 90, 365];
const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function periodoDe(q: unknown): { dias: number; desde: string } {
  const n = Number((q as { dias?: string }).dias ?? 30);
  const dias = PERIODOS.includes(n) ? n : 30;
  return { dias, desde: dataLocal(new Date(Date.now() - (dias - 1) * 86_400_000)) };
}

export async function rotasUso(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  limparUsoAntigo(db);
  const faxina = setInterval(() => limparUsoAntigo(db), 6 * 3600_000);
  faxina.unref();
  app.addHook('onClose', async () => clearInterval(faxina));

  // O site avisa qual tela a pessoa abriu (só o nome da tela, sem conteúdo).
  app.post('/api/uso/tela', { bodyLimit: 1024 }, async (req) => {
    const c = corpoObjeto(req.body);
    const tela = String(texto(c, 'tela', 'Tela', { max: 30 }));
    if (!/^[a-z0-9-]{2,30}$/.test(tela)) throw new ErroValidacao('Tela inválida.');
    registrarUso(db, req.usuario!.id, 'tela', req.headers['user-agent'], tela);
    return { ok: true };
  });

  // Lista de departamentos (cadastro de usuário e filtros do painel).
  app.get('/api/departamentos', async () => db.prepare('SELECT id, nome FROM departamentos WHERE ativo = 1 ORDER BY nome').all());
  app.post('/api/departamentos', { preHandler: exigirPerm('cfg.usuarios.criar', 'cfg.usuarios.editar') }, async (req, resp) => {
    const nome = String(texto(corpoObjeto(req.body), 'nome', 'Nome do departamento', { min: 2, max: 60 }));
    const ja = db.prepare('SELECT id FROM departamentos WHERE nome = ? COLLATE NOCASE').get(nome) as { id: number } | undefined;
    if (ja) { db.prepare('UPDATE departamentos SET ativo = 1 WHERE id = ?').run(ja.id); return resp.code(200).send({ id: ja.id, nome }); }
    const id = Number(db.prepare('INSERT INTO departamentos (nome) VALUES (?)').run(nome).lastInsertRowid);
    auditar(db, req.usuario!.id, 'departamento_criado', { id, nome });
    return resp.code(201).send({ id, nome });
  });

  const ver = { preHandler: exigirPerm('cfg.uso.ver') };

  // Visão geral do período: adoção, dia a dia, telas, aparelhos, horas e departamentos.
  app.get('/api/gestao/uso/resumo', ver, async (req) => {
    const { dias, desde } = periodoDe(req.query);
    const um = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).get(...p) as T;
    const todos = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).all(...p) as T[];
    const { n: cadastrados } = um<{ n: number }>('SELECT COUNT(*) n FROM usuarios WHERE ativo = 1');
    const { n: ativos } = um<{ n: number }>('SELECT COUNT(DISTINCT e.usuario_id) n FROM uso_eventos e JOIN usuarios u ON u.id = e.usuario_id AND u.ativo = 1 WHERE e.dia >= ?', desde);
    const porDia = todos<{ dia: string; ativos: number; entradas: number; telas: number }>(
      "SELECT dia, COUNT(DISTINCT usuario_id) ativos, SUM(tipo = 'login') entradas, SUM(tipo = 'tela') telas FROM uso_eventos WHERE dia >= ? GROUP BY dia ORDER BY dia", desde);
    const mapa = new Map(porDia.map((d) => [d.dia, d]));
    const serie = Array.from({ length: dias }, (_, i) => {
      const dia = dataLocal(new Date(Date.now() - (dias - 1 - i) * 86_400_000));
      return mapa.get(dia) ?? { dia, ativos: 0, entradas: 0, telas: 0 };
    });
    const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, eventos: 0 }));
    for (const l of todos<{ hora: number; n: number }>('SELECT hora, COUNT(*) n FROM uso_eventos WHERE dia >= ? GROUP BY hora', desde)) horas[l.hora].eventos = l.n;
    return {
      dias, desde, cadastrados, ativos, semAcesso: cadastrados - ativos,
      serie, horas,
      telas: todos('SELECT tela, COUNT(*) acessos, COUNT(DISTINCT usuario_id) pessoas FROM uso_eventos WHERE tipo = \'tela\' AND dia >= ? GROUP BY tela ORDER BY acessos DESC', desde),
      aparelhos: todos('SELECT aparelho, COUNT(DISTINCT usuario_id) pessoas, COUNT(*) eventos FROM uso_eventos WHERE dia >= ? GROUP BY aparelho', desde),
      departamentos: todos(
        `SELECT d.id, COALESCE(d.nome, 'Sem departamento') nome, COUNT(DISTINCT u.id) pessoas, COUNT(DISTINCT e.usuario_id) ativos, COUNT(e.id) eventos
           FROM usuarios u LEFT JOIN departamentos d ON d.id = u.departamento_id LEFT JOIN uso_eventos e ON e.usuario_id = u.id AND e.dia >= ?
          WHERE u.ativo = 1 GROUP BY d.id ORDER BY nome`, desde),
    };
  });

  // Uso de cada pessoa (identificado). Cada consulta fica na auditoria.
  app.get('/api/gestao/uso/pessoas', ver, async (req) => {
    const { dias, desde } = periodoDe(req.query);
    auditar(db, req.usuario!.id, 'uso_consultado', { periodo_dias: dias });
    const lista = db.prepare(
      `SELECT u.id, u.nome, u.login, COALESCE(p.nome, u.perfil) AS perfil_nome, u.departamento_id, d.nome AS departamento, u.ultimo_acesso,
         (SELECT COUNT(*) FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ? AND e.tipo = 'login') AS entradas,
         (SELECT COUNT(*) FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ? AND e.tipo = 'tela') AS telas,
         (SELECT COUNT(DISTINCT e.dia) FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ?) AS dias_ativos,
         (SELECT e.aparelho FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ? GROUP BY e.aparelho ORDER BY COUNT(*) DESC LIMIT 1) AS aparelho,
         (SELECT e.tela FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ? AND e.tipo = 'tela' GROUP BY e.tela ORDER BY COUNT(*) DESC LIMIT 1) AS tela_preferida
       FROM usuarios u LEFT JOIN departamentos d ON d.id = u.departamento_id LEFT JOIN perfis_permissoes p ON p.perfil = u.perfil
       WHERE u.ativo = 1 ORDER BY u.nome`,
    ).all(desde, desde, desde, desde, desde);
    return { dias, desde, pessoas: lista };
  });
}
