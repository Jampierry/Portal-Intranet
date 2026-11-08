import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, dataIso, ErroValidacao, inteiro, texto } from '../../../servidor/src/validar.ts';

/** Pessoas do mês: aniversariantes e novos colaboradores que o RH cadastra. Só vai ao ar quem estiver marcado como autorizado (LGPD). */
const FOTO_OK = /^\/(api\/imagens\/[a-f0-9]{24}\.(png|jpg|webp|gif))$/i;
const JANELA_NOVOS_DIAS = 30;

const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
const dois = (n: number) => String(n).padStart(2, '0');
const hojeLocal = () => { const d = new Date(); return { iso: `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`, dia: d.getDate(), mes: d.getMonth() + 1 }; };
const somarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`; };
const diaMesValido = (dia: number, mes: number) => Number.isInteger(dia) && Number.isInteger(mes) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= new Date(2024, mes, 0).getDate();

function foto(c: Record<string, unknown>): string | null {
  const f = texto(c, 'foto', 'Foto', { max: 120, opcional: true });
  if (f && !FOTO_OK.test(f)) throw new ErroValidacao('Foto: use "Escolher imagem" para enviar o arquivo.');
  return f;
}

export async function rotasPessoasMes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // ----- Público (qualquer pessoa logada): só autorizados; aniversariantes do mês atual; novos dos últimos 30 dias -----
  app.get('/api/pessoas-do-mes', async (_req, resp) => {
    const h = hojeLocal();
    const aniv = (db.prepare('SELECT nome, area, dia, mes, foto FROM aniversariantes WHERE autorizado = 1 AND mes = ? ORDER BY dia, nome').all(h.mes) as { nome: string; area: string; dia: number; mes: number; foto: string | null }[])
      .map((a) => ({ ...a, iniciais: iniciais(a.nome), hoje: a.dia === h.dia }));
    const novos = (db.prepare('SELECT nome, area, funcao, entrada, mensagem, foto FROM novos_colaboradores WHERE autorizado = 1 AND entrada <= ? AND entrada >= ? ORDER BY entrada DESC, nome').all(h.iso, somarDias(h.iso, -JANELA_NOVOS_DIAS)) as { nome: string }[])
      .map((n) => ({ ...n, iniciais: iniciais(n.nome) }));
    return resp.header('Cache-Control', 'no-cache').send({ mes: h.mes, aniversariantes: aniv, novos });
  });

  // ----- Gestão: aniversariantes -----
  const CAMPOS_A = 'id, nome, area, dia, mes, foto, autorizado';
  const lerAniversariante = (c: Record<string, unknown>) => {
    const dia = Number(c.dia), mes = Number(c.mes);
    if (!diaMesValido(dia, mes)) throw new ErroValidacao('Aniversário: informe um dia e um mês válidos.');
    return { nome: String(texto(c, 'nome', 'Nome', { min: 2, max: 80 })), area: String(texto(c, 'area', 'Área', { max: 60 })), dia, mes, foto: foto(c), autorizado: c.autorizado ? 1 : 0 };
  };
  app.get('/api/gestao/aniversariantes', { preHandler: exigirPerm('pub.aniversariantes.ver') }, async () => db.prepare(`SELECT ${CAMPOS_A} FROM aniversariantes ORDER BY mes, dia, nome`).all());
  app.post('/api/gestao/aniversariantes', { preHandler: exigirPerm('pub.aniversariantes.criar') }, async (req, resp) => {
    const d = lerAniversariante(corpoObjeto(req.body));
    const id = Number(db.prepare('INSERT INTO aniversariantes (nome, area, dia, mes, foto, autorizado) VALUES (?, ?, ?, ?, ?, ?)').run(d.nome, d.area, d.dia, d.mes, d.foto, d.autorizado).lastInsertRowid);
    auditar(db, req.usuario!.id, 'aniversariante_criado', { id, area: d.area });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS_A} FROM aniversariantes WHERE id = ?`).get(id));
  });
  app.put<{ Params: { id: string } }>('/api/gestao/aniversariantes/:id', { preHandler: exigirPerm('pub.aniversariantes.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Aniversariante');
    if (!db.prepare('SELECT 1 FROM aniversariantes WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Aniversariante não encontrado.' });
    const d = lerAniversariante(corpoObjeto(req.body));
    db.prepare('UPDATE aniversariantes SET nome = ?, area = ?, dia = ?, mes = ?, foto = ?, autorizado = ? WHERE id = ?').run(d.nome, d.area, d.dia, d.mes, d.foto, d.autorizado, id);
    auditar(db, req.usuario!.id, 'aniversariante_alterado', { id, area: d.area });
    return db.prepare(`SELECT ${CAMPOS_A} FROM aniversariantes WHERE id = ?`).get(id);
  });
  app.delete<{ Params: { id: string } }>('/api/gestao/aniversariantes/:id', { preHandler: exigirPerm('pub.aniversariantes.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Aniversariante');
    if (!db.prepare('SELECT 1 FROM aniversariantes WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Aniversariante não encontrado.' });
    db.prepare('DELETE FROM aniversariantes WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'aniversariante_apagado', { id });
    return { ok: true };
  });
  // Importação em lote (a tela lê a planilha CSV): cada item traz nome, área, dia e mês; só entra com a confirmação de que o RH tem a autorização.
  app.post('/api/gestao/aniversariantes/importar', { preHandler: exigirPerm('pub.aniversariantes.criar') }, async (req) => {
    const c = corpoObjeto(req.body);
    if (c.autorizado !== true) throw new ErroValidacao('Confirme que o RH tem a autorização das pessoas para divulgar o aniversário.');
    const itens = Array.isArray(c.itens) ? c.itens : [];
    if (itens.length === 0) throw new ErroValidacao('Nenhuma linha para importar.');
    if (itens.length > 2000) throw new ErroValidacao('Importe no máximo 2000 linhas por vez.');
    const existe = db.prepare('SELECT id FROM aniversariantes WHERE nome = ? AND dia = ? AND mes = ?');
    const ins = db.prepare('INSERT INTO aniversariantes (nome, area, dia, mes, foto, autorizado) VALUES (?, ?, ?, ?, NULL, 1)');
    const upd = db.prepare('UPDATE aniversariantes SET area = ?, autorizado = 1 WHERE id = ?');
    let novos = 0, atualizados = 0;
    const erros: string[] = [];
    itens.forEach((it, i) => {
      try {
        const d = lerAniversariante({ ...(it as Record<string, unknown>), autorizado: true });
        const e = existe.get(d.nome, d.dia, d.mes) as { id: number } | undefined;
        if (e) { upd.run(d.area, e.id); atualizados++; } else { ins.run(d.nome, d.area, d.dia, d.mes); novos++; }
      } catch (x) { erros.push(`Linha ${i + 1}: ${x instanceof Error ? x.message : 'inválida'}`); }
    });
    auditar(db, req.usuario!.id, 'aniversariantes_importados', { novos, atualizados, erros: erros.length });
    return { novos, atualizados, erros: erros.slice(0, 20), total_erros: erros.length };
  });

  // ----- Gestão: novos colaboradores -----
  const CAMPOS_N = 'id, nome, area, funcao, entrada, mensagem, foto, autorizado';
  const lerNovo = (c: Record<string, unknown>) => ({
    nome: String(texto(c, 'nome', 'Nome', { min: 2, max: 80 })), area: String(texto(c, 'area', 'Área', { max: 60 })),
    funcao: texto(c, 'funcao', 'Função', { max: 60, opcional: true }), entrada: String(dataIso(c, 'entrada', 'Data de entrada')),
    mensagem: texto(c, 'mensagem', 'Mensagem de boas-vindas', { max: 200, opcional: true }), foto: foto(c), autorizado: c.autorizado ? 1 : 0,
  });
  app.get('/api/gestao/novos', { preHandler: exigirPerm('pub.novos.ver') }, async () => db.prepare(`SELECT ${CAMPOS_N} FROM novos_colaboradores ORDER BY entrada DESC, nome`).all());
  app.post('/api/gestao/novos', { preHandler: exigirPerm('pub.novos.criar') }, async (req, resp) => {
    const d = lerNovo(corpoObjeto(req.body));
    const id = Number(db.prepare('INSERT INTO novos_colaboradores (nome, area, funcao, entrada, mensagem, foto, autorizado) VALUES (?, ?, ?, ?, ?, ?, ?)').run(d.nome, d.area, d.funcao, d.entrada, d.mensagem, d.foto, d.autorizado).lastInsertRowid);
    auditar(db, req.usuario!.id, 'novo_colaborador_criado', { id, area: d.area });
    return resp.code(201).send(db.prepare(`SELECT ${CAMPOS_N} FROM novos_colaboradores WHERE id = ?`).get(id));
  });
  app.put<{ Params: { id: string } }>('/api/gestao/novos/:id', { preHandler: exigirPerm('pub.novos.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Novo colaborador');
    if (!db.prepare('SELECT 1 FROM novos_colaboradores WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Registro não encontrado.' });
    const d = lerNovo(corpoObjeto(req.body));
    db.prepare('UPDATE novos_colaboradores SET nome = ?, area = ?, funcao = ?, entrada = ?, mensagem = ?, foto = ?, autorizado = ? WHERE id = ?').run(d.nome, d.area, d.funcao, d.entrada, d.mensagem, d.foto, d.autorizado, id);
    auditar(db, req.usuario!.id, 'novo_colaborador_alterado', { id, area: d.area });
    return db.prepare(`SELECT ${CAMPOS_N} FROM novos_colaboradores WHERE id = ?`).get(id);
  });
  app.delete<{ Params: { id: string } }>('/api/gestao/novos/:id', { preHandler: exigirPerm('pub.novos.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Novo colaborador');
    if (!db.prepare('SELECT 1 FROM novos_colaboradores WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Registro não encontrado.' });
    db.prepare('DELETE FROM novos_colaboradores WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'novo_colaborador_apagado', { id });
    return { ok: true };
  });
}
