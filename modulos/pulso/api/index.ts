// Pesquisas (pulso, cardápio da festa, atrações…): o RH monta várias perguntas, cada uma de um tipo (nota de 1 a 5, escolha única,
// múltipla escolha ou texto), com imagem na pergunta e nas opções. A resposta é anônima.
// Anonimato (padrão): a resposta não guarda quem respondeu (só a tabela de participação, separada, evita responder duas vezes) nem a hora.
// Se o RH marcar a pesquisa como NÃO anônima, a resposta guarda quem respondeu e o resultado mostra os nomes.
// O resultado das anônimas só é mostrado com pelo menos MINIMO_RESPOSTAS respostas, para ninguém ser identificado.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

export const MINIMO_RESPOSTAS = 5;
const STATUS = ['rascunho', 'aberto', 'encerrado'] as const;
const TIPOS = ['nota', 'unica', 'multipla', 'texto'] as const;
type Tipo = (typeof TIPOS)[number];
const MAX_PERGUNTAS = 30, MAX_OPCOES = 20;
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface Opcao { texto: string; imagem: string | null }
interface Pergunta { id?: number; texto: string; tipo: Tipo; obrigatoria: boolean; imagem: string | null; opcoes: Opcao[] }
interface LinhaPergunta { id: number; texto: string; tipo: Tipo; obrigatoria: number; imagem: string | null; opcoes: string | null }

/** Imagem só pode ser do próprio portal (enviada pela tela) — nunca endereço externo. */
function imagemPortal(v: unknown, rotulo: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\/api\/imagens\/[\w.-]+$/.test(v)) throw new ErroValidacao(`${rotulo}: imagem inválida. Envie a imagem pela tela.`);
  return v;
}

function lerPerguntas(bruto: unknown): Pergunta[] {
  if (!Array.isArray(bruto)) throw new ErroValidacao('Perguntas inválidas.');
  if (bruto.length === 0) throw new ErroValidacao('Inclua pelo menos uma pergunta.');
  if (bruto.length > MAX_PERGUNTAS) throw new ErroValidacao(`No máximo ${MAX_PERGUNTAS} perguntas por pesquisa.`);
  return bruto.map((b, i) => {
    const c = corpoObjeto(b);
    const rot = `Pergunta ${i + 1}`;
    const tipo = escolha(c, 'tipo', `${rot} (tipo)`, TIPOS, 'nota');
    const opcoes: Opcao[] = [];
    if (tipo === 'unica' || tipo === 'multipla') {
      const lista = Array.isArray(c.opcoes) ? c.opcoes : [];
      if (lista.length < 2) throw new ErroValidacao(`${rot}: informe pelo menos 2 opções.`);
      if (lista.length > MAX_OPCOES) throw new ErroValidacao(`${rot}: no máximo ${MAX_OPCOES} opções.`);
      for (const o of lista) {
        const oc = corpoObjeto(o);
        opcoes.push({ texto: String(texto(oc, 'texto', `${rot} (opção)`, { min: 1, max: 200 })), imagem: imagemPortal(oc.imagem, `${rot} (opção)`) });
      }
      if (new Set(opcoes.map((o) => o.texto.toLowerCase())).size !== opcoes.length) throw new ErroValidacao(`${rot}: há opções repetidas.`);
    }
    return { texto: String(texto(c, 'texto', rot, { min: 3, max: 300 })), tipo, obrigatoria: c.obrigatoria !== false, imagem: imagemPortal(c.imagem, rot), opcoes };
  });
}

const paraPergunta = (q: LinhaPergunta) => ({ id: q.id, texto: q.texto, tipo: q.tipo, obrigatoria: !!q.obrigatoria, imagem: q.imagem, opcoes: q.opcoes ? JSON.parse(q.opcoes) as Opcao[] : [] });
const canonico = (ps: Pergunta[]) => JSON.stringify(ps.map((p) => ({ t: p.texto, k: p.tipo, o: p.obrigatoria, i: p.imagem, p: p.opcoes })));

export async function rotasPulso(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const perguntasDe = (pulsoId: number) =>
    (db.prepare('SELECT id, texto, tipo, obrigatoria, imagem, opcoes FROM pulso_perguntas WHERE pulso_id = ? ORDER BY ordem, id').all(pulsoId) as unknown as LinhaPergunta[]).map(paraPergunta);

  // ----- Quem responde: a pesquisa aberta mais recente que a pessoa ainda não respondeu -----
  app.get('/api/pulso', async (req) => {
    const p = db.prepare("SELECT id, pergunta AS titulo, descricao, anonima FROM pulsos WHERE status = 'aberto' AND id NOT IN (SELECT pulso_id FROM pulso_participacao WHERE usuario_id = ?) ORDER BY id DESC LIMIT 1")
      .get(req.usuario!.id) as { id: number; titulo: string; descricao: string | null; anonima: number } | undefined;
    if (!p) return { aberto: false };
    return { aberto: true, id: p.id, titulo: p.titulo, descricao: p.descricao, anonima: !!p.anonima, respondeu: false, perguntas: perguntasDe(p.id) };
  });

  app.post<{ Params: { id: string } }>('/api/pulso/:id/responder', async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const cab = db.prepare("SELECT anonima FROM pulsos WHERE id = ? AND status = 'aberto'").get(id) as { anonima: number } | undefined;
    if (!cab) return resp.code(404).send({ erro: 'Esta pesquisa não está aberta.' });
    const perguntas = perguntasDe(id);
    const c = corpoObjeto(req.body);
    // formato antigo (uma nota só) continua valendo para pesquisas de uma pergunta de nota
    const brutas: unknown[] = Array.isArray(c.respostas) ? c.respostas : (perguntas.length === 1 && perguntas[0].tipo === 'nota' ? [{ pergunta_id: perguntas[0].id, valor: c.nota, comentario: c.comentario }] : []);
    const porId = new Map<number, Record<string, unknown>>();
    for (const b of brutas) { const r = corpoObjeto(b); porId.set(Number(r.pergunta_id), r); }
    for (const k of porId.keys()) if (!perguntas.some((q) => q.id === k)) throw new ErroValidacao('Resposta para uma pergunta que não existe nesta pesquisa.');

    const linhas: { pergunta_id: number; valor: string; comentario: string | null }[] = [];
    for (const q of perguntas) {
      const r = porId.get(q.id!);
      const vazio = !r || r.valor === undefined || r.valor === null || r.valor === '' && !Array.isArray(r.valores);
      if (q.tipo === 'multipla') {
        const vals = Array.isArray(r?.valores) ? [...new Set((r!.valores as unknown[]).map(String))] : [];
        if (vals.length === 0) { if (q.obrigatoria) throw new ErroValidacao(`Responda: ${q.texto}`); continue; }
        if (!vals.every((v) => q.opcoes.some((o) => o.texto === v))) throw new ErroValidacao(`Opção inválida em: ${q.texto}`);
        for (const v of vals) linhas.push({ pergunta_id: q.id!, valor: v, comentario: null });
        continue;
      }
      if (vazio) { if (q.obrigatoria) throw new ErroValidacao(`Responda: ${q.texto}`); continue; }
      if (q.tipo === 'nota') {
        const n = Number(r!.valor);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw new ErroValidacao('Nota: escolha de 1 a 5.');
        linhas.push({ pergunta_id: q.id!, valor: String(n), comentario: texto(r!, 'comentario', 'Comentário', { max: 500, opcional: true }) });
      } else if (q.tipo === 'unica') {
        const v = String(r!.valor);
        if (!q.opcoes.some((o) => o.texto === v)) throw new ErroValidacao(`Opção inválida em: ${q.texto}`);
        linhas.push({ pergunta_id: q.id!, valor: v, comentario: null });
      } else {
        const t = String(r!.valor).trim();
        if (t.length > 1000) throw new ErroValidacao('Resposta de texto: no máximo 1000 caracteres.');
        if (t) linhas.push({ pergunta_id: q.id!, valor: t, comentario: null }); else if (q.obrigatoria) throw new ErroValidacao(`Responda: ${q.texto}`);
      }
    }
    if (linhas.length === 0) throw new ErroValidacao('Responda pelo menos uma pergunta.');
    // participação e respostas na mesma transação, mas sem ligação entre elas
    db.exec('BEGIN');
    try {
      const novo = db.prepare('INSERT OR IGNORE INTO pulso_participacao (pulso_id, usuario_id) VALUES (?, ?)').run(id, req.usuario!.id);
      if (Number(novo.changes) === 0) { db.exec('ROLLBACK'); return resp.code(409).send({ erro: 'Você já respondeu esta pesquisa. Obrigado!' }); }
      const ins = db.prepare('INSERT INTO pulso_respostas_item (pulso_id, pergunta_id, valor, comentario, dia, usuario_id) VALUES (?, ?, ?, ?, ?, ?)');
      const dia = hoje(), quem = cab.anonima ? null : req.usuario!.id;
      for (const l of linhas) ins.run(id, l.pergunta_id, l.valor, l.comentario, dia, quem);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { ok: true };
  });

  // ----- Gestão (aba Pesquisas em Publicar) -----
  const CAMPOS = 'p.id, p.pergunta, p.descricao, p.anonima, p.status, p.criado_em, p.aberto_em, p.encerrado_em, (SELECT COUNT(*) FROM pulso_participacao x WHERE x.pulso_id = p.id) AS respostas, (SELECT COUNT(*) FROM pulso_perguntas q WHERE q.pulso_id = p.id) AS n_perguntas';
  const buscar = (id: number) => ({ ...(db.prepare(`SELECT ${CAMPOS} FROM pulsos p WHERE p.id = ?`).get(id) as object), perguntas: perguntasDe(id) });
  function ler(c: Record<string, unknown>) {
    return {
      titulo: String(texto(c, 'pergunta', 'Título', { min: 3, max: 160 })),
      descricao: texto(c, 'descricao', 'Descrição', { max: 500, opcional: true }),
      anonima: c.anonima !== false && c.anonima !== 0 && c.anonima !== '0',
      status: escolha(c, 'status', 'Situação', STATUS, 'rascunho'),
      // sem lista de perguntas (formato antigo): uma pergunta de nota com o próprio título
      perguntas: c.perguntas === undefined ? null : lerPerguntas(c.perguntas),
    };
  }
  function gravarPerguntas(id: number, ps: Pergunta[]) {
    db.prepare('DELETE FROM pulso_perguntas WHERE pulso_id = ?').run(id);
    const ins = db.prepare('INSERT INTO pulso_perguntas (pulso_id, ordem, texto, tipo, obrigatoria, imagem, opcoes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    ps.forEach((p, i) => ins.run(id, i, p.texto, p.tipo, p.obrigatoria ? 1 : 0, p.imagem, p.opcoes.length ? JSON.stringify(p.opcoes) : null));
  }
  function aplicarStatus(id: number, novo: string, antigo: string | null) {
    const agora = new Date().toISOString();
    if (novo === 'aberto' && antigo !== 'aberto') db.prepare('UPDATE pulsos SET aberto_em = COALESCE(aberto_em, ?), encerrado_em = NULL WHERE id = ?').run(agora, id);
    if (novo === 'encerrado' && antigo !== 'encerrado') db.prepare('UPDATE pulsos SET encerrado_em = ? WHERE id = ?').run(agora, id);
  }
  app.get('/api/gestao/pulso', { preHandler: exigirPerm('pub.pulso.ver') }, async () =>
    (db.prepare(`SELECT ${CAMPOS} FROM pulsos p ORDER BY p.id DESC`).all() as { id: number }[]).map((p) => ({ ...p, perguntas: perguntasDe(p.id) })));
  app.post('/api/gestao/pulso', { preHandler: exigirPerm('pub.pulso.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const ps = d.perguntas ?? [{ texto: d.titulo.length >= 3 ? d.titulo : 'Pergunta', tipo: 'nota' as Tipo, obrigatoria: true, imagem: null, opcoes: [] }];
    db.exec('BEGIN');
    let id: number;
    try {
      id = Number(db.prepare('INSERT INTO pulsos (pergunta, descricao, anonima, status, criado_em) VALUES (?, ?, ?, ?, ?)').run(d.titulo, d.descricao, d.anonima ? 1 : 0, d.status, new Date().toISOString()).lastInsertRowid);
      gravarPerguntas(id, ps);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    aplicarStatus(id, d.status, null);
    auditar(db, req.usuario!.id, 'pulso_criado', { id, status: d.status, perguntas: ps.length });
    return resp.code(201).send(buscar(id));
  });
  app.put<{ Params: { id: string } }>('/api/gestao/pulso/:id', { preHandler: exigirPerm('pub.pulso.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const atual = db.prepare('SELECT status, anonima FROM pulsos WHERE id = ?').get(id) as { status: string; anonima: number } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    const d = ler(corpoObjeto(req.body));
    const { n } = db.prepare('SELECT COUNT(*) n FROM pulso_participacao WHERE pulso_id = ?').get(id) as { n: number };
    const mudouPerguntas = d.perguntas !== null && canonico(d.perguntas) !== canonico(perguntasDe(id));
    if (n > 0 && mudouPerguntas) return resp.code(409).send({ erro: 'As perguntas não podem mudar depois que alguém respondeu. Crie uma nova pesquisa.' });
    if (n > 0 && d.anonima !== !!atual.anonima) return resp.code(409).send({ erro: 'Não dá para trocar entre anônima e identificada depois que alguém respondeu.' });
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE pulsos SET pergunta = ?, descricao = ?, anonima = ?, status = ? WHERE id = ?').run(d.titulo, d.descricao, d.anonima ? 1 : 0, d.status, id);
      if (mudouPerguntas) gravarPerguntas(id, d.perguntas!);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    aplicarStatus(id, d.status, atual.status);
    auditar(db, req.usuario!.id, 'pulso_alterado', { id, de: atual.status, para: d.status });
    return buscar(id);
  });
  app.delete<{ Params: { id: string } }>('/api/gestao/pulso/:id', { preHandler: exigirPerm('pub.pulso.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    if (!db.prepare('SELECT 1 FROM pulsos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    db.prepare('DELETE FROM pulsos WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'pulso_apagado', { id });
    return { ok: true };
  });

  // Resultado agregado e anônimo; abaixo do mínimo de respostas só mostra quantas faltam.
  app.get<{ Params: { id: string } }>('/api/gestao/pulso/:id/resultado', { preHandler: exigirPerm('pub.pulso.ver') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const p = db.prepare('SELECT pergunta AS titulo, status, anonima FROM pulsos WHERE id = ?').get(id) as { titulo: string; status: string; anonima: number } | undefined;
    if (!p) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    const total = (db.prepare('SELECT COUNT(*) n FROM pulso_participacao WHERE pulso_id = ?').get(id) as { n: number }).n;
    const alvo = (db.prepare('SELECT COUNT(*) n FROM usuarios WHERE ativo = 1').get() as { n: number }).n;
    const anonima = !!p.anonima;
    const base = { ...p, anonima, respostas: total, alvo, minimo: MINIMO_RESPOSTAS };
    if (anonima && total < MINIMO_RESPOSTAS) return { ...base, liberado: false };
    const ordemTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
    const perguntas = perguntasDe(id).map((q) => {
      const itens = db.prepare('SELECT i.valor, i.comentario, u.nome FROM pulso_respostas_item i LEFT JOIN usuarios u ON u.id = i.usuario_id WHERE i.pergunta_id = ?').all(q.id) as { valor: string; comentario: string | null; nome: string | null }[];
      const saida: Record<string, unknown> = { id: q.id, texto: q.texto, tipo: q.tipo, imagem: q.imagem };
      if (q.tipo === 'nota') {
        const notas = itens.map((x) => Number(x.valor));
        saida.respondentes = notas.length;
        saida.media = notas.length ? Math.round((notas.reduce((a, x) => a + x, 0) / notas.length) * 10) / 10 : null;
        saida.distribuicao = [1, 2, 3, 4, 5].map((n) => notas.filter((x) => x === n).length);
        // comentários sem data e em ordem alfabética (não revela a ordem de chegada)
        saida.comentarios = itens.map((x) => x.comentario).filter((x): x is string => !!x).sort(ordemTexto);
        if (!anonima) saida.quem = itens.map((x) => ({ nome: x.nome ?? '—', resposta: x.valor })).sort((a, b) => ordemTexto(a.nome, b.nome));
      } else if (q.tipo === 'texto') {
        saida.respondentes = itens.length;
        saida.textos = itens.map((x) => x.valor).sort(ordemTexto);
        if (!anonima) saida.quem = itens.map((x) => ({ nome: x.nome ?? '—', resposta: x.valor })).sort((a, b) => ordemTexto(a.nome, b.nome));
      } else {
        const contagem = new Map<string, number>();
        for (const x of itens) contagem.set(x.valor, (contagem.get(x.valor) ?? 0) + 1);
        if (q.tipo === 'unica') saida.respondentes = itens.length; // na múltipla não há como contar pessoas sem ligar as linhas
        saida.opcoes = q.opcoes.map((o) => ({ texto: o.texto, imagem: o.imagem, total: contagem.get(o.texto) ?? 0, ...(anonima ? {} : { nomes: itens.filter((x) => x.valor === o.texto).map((x) => x.nome ?? '—').sort(ordemTexto) }) }));
      }
      return saida;
    });
    return { ...base, liberado: true, perguntas };
  });
}
