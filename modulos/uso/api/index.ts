// Uso do portal: mede se ele é relevante (quem entra, o que abre, quando e de qual aparelho), por pessoa e por departamento.
// Aviso aos colaboradores: o portal registra data, tela aberta e tipo de aparelho (nada do que é digitado). Guarda 12 meses.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { corpoObjeto, texto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { permissoesEfetivas } from '../../acessos/api/permissoes.ts';
import { pessoasDoPublico, resumoPublico } from '../../publico/api/index.ts';
import { limparUsoAntigo, registrarUso } from './registro.ts';

const PERIODOS = [7, 30, 90, 365];

interface LinhaComunicado { id: number; titulo: string; publicado_em: string; publico: string; esperadas: number; abriram: number; confirmaram: number; exige_leitura: boolean }
/** Comunicados publicados no período: quantas pessoas do público abriram (ou confirmaram) cada um. */
export function comunicadosDoPeriodo(db: Banco, desde: string): { publicados: number; esperadas: number; abriram: number; itens: LinhaComunicado[] } {
  const podem = new Set((db.prepare('SELECT id, perfil, permissoes FROM usuarios WHERE ativo = 1').all() as { id: number; perfil: string; permissoes: string | null }[])
    .filter((u) => permissoesEfetivas(db, u.perfil, u.permissoes).includes('ver.comunicados')).map((u) => u.id));
  const lista = db.prepare("SELECT id, titulo, publicado_em, exige_leitura FROM comunicados WHERE status = 'publicado' AND publicado_em >= ? ORDER BY publicado_em DESC, id DESC").all(desde) as { id: number; titulo: string; publicado_em: string; exige_leitura: number }[];
  const itens = lista.map((c) => {
    const alvo = pessoasDoPublico(db, 'comunicado', c.id).filter((i) => podem.has(i));
    const quem = new Set(alvo);
    const abriu = new Set((db.prepare('SELECT usuario_id FROM comunicado_aberturas WHERE comunicado_id = ? UNION SELECT usuario_id FROM comunicado_leituras WHERE comunicado_id = ?').all(c.id, c.id) as { usuario_id: number }[]).map((r) => r.usuario_id).filter((i) => quem.has(i)));
    const conf = (db.prepare('SELECT usuario_id FROM comunicado_leituras WHERE comunicado_id = ?').all(c.id) as { usuario_id: number }[]).filter((r) => quem.has(r.usuario_id)).length;
    return { id: c.id, titulo: c.titulo, publicado_em: c.publicado_em, publico: resumoPublico(db, 'comunicado', c.id), esperadas: alvo.length, abriram: abriu.size, confirmaram: conf, exige_leitura: !!c.exige_leitura };
  });
  return { publicados: itens.length, esperadas: itens.reduce((s, i) => s + i.esperadas, 0), abriram: itens.reduce((s, i) => s + i.abriram, 0), itens };
}
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
      serie, horas, comunicados: comunicadosDoPeriodo(db, desde),
      telas: todos('SELECT tela, COUNT(*) acessos, COUNT(DISTINCT usuario_id) pessoas FROM uso_eventos WHERE tipo = \'tela\' AND dia >= ? GROUP BY tela ORDER BY acessos DESC', desde),
      aparelhos: todos('SELECT aparelho, COUNT(DISTINCT usuario_id) pessoas, COUNT(*) eventos FROM uso_eventos WHERE dia >= ? GROUP BY aparelho', desde),
      departamentos: todos(
        `SELECT d.id, COALESCE(d.nome, 'Sem departamento') nome, COUNT(DISTINCT u.id) pessoas, COUNT(DISTINCT e.usuario_id) ativos, COUNT(e.id) eventos
           FROM usuarios u LEFT JOIN departamentos d ON d.id = u.departamento_id LEFT JOIN uso_eventos e ON e.usuario_id = u.id AND e.dia >= ?
          WHERE u.ativo = 1 GROUP BY d.id ORDER BY nome`, desde),
    };
  });

  // Exporta o painel em CSV (Excel, separador ;): resumo, dia a dia, telas, departamentos, comunicados e pessoas. A consulta fica na auditoria.
  app.get('/api/gestao/uso/exportar', ver, async (req, resp) => {
    const { dias, desde } = periodoDe(req.query);
    const todos = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).all(...p) as T[];
    const cel = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; // evita fórmula no Excel
    const L: unknown[][] = [['Uso do portal'], ['Período', `${desde} a ${dataLocal(new Date())} (${dias} dias)`]];
    const { n: cadastrados } = db.prepare('SELECT COUNT(*) n FROM usuarios WHERE ativo = 1').get() as { n: number };
    const { n: ativos } = db.prepare('SELECT COUNT(DISTINCT e.usuario_id) n FROM uso_eventos e JOIN usuarios u ON u.id = e.usuario_id AND u.ativo = 1 WHERE e.dia >= ?').get(desde) as { n: number };
    L.push(['Pessoas cadastradas', cadastrados], ['Pessoas ativas', ativos], ['Sem acesso no período', cadastrados - ativos], []);
    L.push(['Por dia'], ['Dia', 'Pessoas ativas', 'Entradas', 'Telas abertas']);
    for (const d of todos<{ dia: string; a: number; e: number; t: number }>("SELECT dia, COUNT(DISTINCT usuario_id) a, SUM(tipo = 'login') e, SUM(tipo = 'tela') t FROM uso_eventos WHERE dia >= ? GROUP BY dia ORDER BY dia", desde)) L.push([d.dia, d.a, d.e, d.t]);
    L.push([], ['Telas'], ['Tela', 'Acessos', 'Pessoas']);
    for (const t of todos<{ tela: string; acessos: number; pessoas: number }>("SELECT tela, COUNT(*) acessos, COUNT(DISTINCT usuario_id) pessoas FROM uso_eventos WHERE tipo = 'tela' AND dia >= ? GROUP BY tela ORDER BY acessos DESC", desde)) L.push([t.tela, t.acessos, t.pessoas]);
    L.push([], ['Departamentos'], ['Departamento', 'Pessoas', 'Ativas', 'Eventos']);
    for (const d of todos<{ nome: string; pessoas: number; ativos: number; eventos: number }>(
      `SELECT COALESCE(d.nome, 'Sem departamento') nome, COUNT(DISTINCT u.id) pessoas, COUNT(DISTINCT e.usuario_id) ativos, COUNT(e.id) eventos
         FROM usuarios u LEFT JOIN departamentos d ON d.id = u.departamento_id LEFT JOIN uso_eventos e ON e.usuario_id = u.id AND e.dia >= ? WHERE u.ativo = 1 GROUP BY d.id ORDER BY nome`, desde)) L.push([d.nome, d.pessoas, d.ativos, d.eventos]);
    L.push([], ['Comunicados publicados no período'], ['Comunicado', 'Publicado em', 'Para', 'Pessoas do público', 'Abriram', 'Confirmaram leitura']);
    for (const c of comunicadosDoPeriodo(db, desde).itens) L.push([c.titulo, c.publicado_em, c.publico, c.esperadas, c.abriram, c.exige_leitura ? c.confirmaram : 'não pede']);
    L.push([], ['Por pessoa'], ['Pessoa', 'Login', 'Departamento', 'Último acesso', 'Dias ativos', 'Entradas', 'Telas']);
    for (const p of todos<{ nome: string; login: string; departamento: string | null; ultimo_acesso: string | null; dias: number; entradas: number; telas: number }>(
      `SELECT u.nome, u.login, d.nome AS departamento, u.ultimo_acesso,
         (SELECT COUNT(DISTINCT e.dia) FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ?) AS dias,
         (SELECT COUNT(*) FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ? AND e.tipo = 'login') AS entradas,
         (SELECT COUNT(*) FROM uso_eventos e WHERE e.usuario_id = u.id AND e.dia >= ? AND e.tipo = 'tela') AS telas
       FROM usuarios u LEFT JOIN departamentos d ON d.id = u.departamento_id WHERE u.ativo = 1 ORDER BY u.nome`, desde, desde, desde)) L.push([p.nome, p.login, p.departamento ?? '', p.ultimo_acesso ?? 'Nunca', p.dias, p.entradas, p.telas]);
    auditar(db, req.usuario!.id, 'uso_exportado', { periodo_dias: dias, formato: 'csv' });
    return resp.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="uso-do-portal-${dias}-dias.csv"`)
      .send('\uFEFF' + L.map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n');

  });

  // Registra no log que o relatório em PDF foi gerado (o PDF sai do navegador, pela impressão).
  app.post('/api/gestao/uso/exportar-pdf', ver, async (req) => {
    const { dias } = periodoDe(corpoObjeto(req.body));
    auditar(db, req.usuario!.id, 'uso_exportado', { periodo_dias: dias, formato: 'pdf' });
    return { ok: true };
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
