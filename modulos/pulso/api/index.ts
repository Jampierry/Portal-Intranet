// Pesquisas (pulso, cardápio da festa, atrações…): o RH monta várias perguntas, cada uma de um tipo (nota de 1 a 5, escolha única,
// múltipla escolha ou texto), com imagem na pergunta e nas opções. A resposta é anônima.
// Anonimato (padrão): a resposta não guarda quem respondeu (só a tabela de participação, separada, evita responder duas vezes) nem a hora.
// Se o RH marcar a pesquisa como NÃO anônima, a resposta guarda quem respondeu e o resultado mostra os nomes.
// O resultado das anônimas só é mostrado com pelo menos MINIMO_RESPOSTAS respostas, para ninguém ser identificado.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { aoInscrever, enviarPush } from '../../push/api/index.ts';
import { corpoObjeto, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

export const MINIMO_RESPOSTAS = 5;
const STATUS = ['rascunho', 'aberto', 'encerrado'] as const;
const TIPOS = ['nota', 'unica', 'multipla', 'texto'] as const;
type Tipo = (typeof TIPOS)[number];
const MAX_PERGUNTAS = 30, MAX_OPCOES = 20;
/** Data e hora locais no formato dos campos de período (AAAA-MM-DDTHH:MM). */
const agoraLocal = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
/** Pesquisa aberta E dentro do período (parâmetros: agora, agora). */
const NO_AR = "status = 'aberto' AND (abre_em IS NULL OR abre_em <= ?) AND (fecha_em IS NULL OR fecha_em > ?)";
const situacaoDe = (p: { status: string; abre_em: string | null; fecha_em: string | null }) => {
  if (p.status !== 'aberto') return p.status;
  const agora = agoraLocal();
  if (p.abre_em && p.abre_em > agora) return 'agendada';
  if (p.fecha_em && p.fecha_em <= agora) return 'prazo';
  return 'aberto';
};
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface Opcao { texto: string; imagem: string | null }
interface Pergunta { id?: number; texto: string; tipo: Tipo; obrigatoria: boolean; imagem: string | null; opcoes: Opcao[]; comentario: boolean }
interface LinhaPergunta { id: number; texto: string; tipo: Tipo; obrigatoria: number; imagem: string | null; opcoes: string | null; permite_comentario: number }

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
    return { texto: String(texto(c, 'texto', rot, { min: 3, max: 300 })), tipo, obrigatoria: c.obrigatoria !== false, imagem: imagemPortal(c.imagem, rot), opcoes, comentario: tipo === 'nota' && c.comentario === true };
  });
}

const paraPergunta = (q: LinhaPergunta) => ({ id: q.id, texto: q.texto, tipo: q.tipo, obrigatoria: !!q.obrigatoria, imagem: q.imagem, opcoes: q.opcoes ? JSON.parse(q.opcoes) as Opcao[] : [], comentario: q.tipo === 'nota' && !!q.permite_comentario });
const canonico = (ps: Pergunta[]) => JSON.stringify(ps.map((p) => ({ t: p.texto, k: p.tipo, o: p.obrigatoria, i: p.imagem, p: p.opcoes, c: p.comentario })));

interface Rodada { rodada: number; abre_em: string | null; fecha_em: string | null; publico?: string; respostas: number }
const rodadaAtual = (db: Banco, id: number) => (db.prepare('SELECT rodada FROM pulsos WHERE id = ?').get(id) as { rodada: number }).rodada;
/** Rodadas da pesquisa com o número de respostas de cada uma (pesquisas antigas sem registro viram a rodada 1). */
function listaRodadas(db: Banco, id: number): Rodada[] {
  const r = db.prepare('SELECT r.rodada, r.abre_em, r.fecha_em, r.publico, (SELECT COUNT(*) FROM pulso_participacao x WHERE x.pulso_id = r.pulso_id AND x.rodada = r.rodada) AS respostas FROM pulso_rodadas r WHERE r.pulso_id = ? ORDER BY r.rodada').all(id) as unknown as Rodada[];
  if (r.length) return r;
  const p = db.prepare('SELECT rodada, abre_em, fecha_em, (SELECT COUNT(*) FROM pulso_participacao x WHERE x.pulso_id = pulsos.id AND x.rodada = pulsos.rodada) AS respostas FROM pulsos WHERE id = ?').get(id) as unknown as Rodada | undefined;
  return p ? [p] : [];
}
/** Pesquisas no ar que a pessoa ainda não respondeu na rodada atual. */
const PENDENTE_DE = "NOT EXISTS (SELECT 1 FROM pulso_participacao x WHERE x.pulso_id = pulsos.id AND x.usuario_id = ? AND x.rodada = pulsos.rodada)";

/** Quem entra no aparelho depois de a pesquisa já ter sido avisada (cadastro novo, aparelho novo) recebe o aviso das pesquisas pendentes ao ativar o push. */
async function avisarPendentesDe(db: Banco, usuarioId: number): Promise<void> {
  try {
    const agora = agoraLocal();
    const lista = db.prepare(`SELECT id, pergunta AS titulo FROM pulsos WHERE ${NO_AR} AND push_abertura_em IS NOT NULL AND ${PENDENTE_DE}`).all(agora, agora, usuarioId) as { id: number; titulo: string }[];
    for (const p of lista) await enviarPush(db, [usuarioId], { titulo: 'Pesquisa aguardando sua resposta', corpo: `${p.titulo}. Abra o portal para responder.`, url: '/', tag: `pesquisa-${p.id}` });
  } catch { /* ignora */ }
}
aoInscrever('pulso', avisarPendentesDe);

/** Avisa (push) as pesquisas que acabaram de entrar no ar, uma vez cada. Roda ao salvar e a cada minuto (pesquisas agendadas). Nunca lança. */
export async function avisarAberturas(db: Banco): Promise<void> {
  try {
    const agora = agoraLocal();
    const abertas = db.prepare(`SELECT id, pergunta AS titulo, rodada, push_so_pendentes AS so_pendentes FROM pulsos WHERE ${NO_AR} AND push_abertura_em IS NULL`).all(agora, agora) as { id: number; titulo: string; rodada: number; so_pendentes: number }[];
    for (const p of abertas) {
      db.prepare('UPDATE pulsos SET push_abertura_em = ? WHERE id = ?').run(new Date().toISOString(), p.id); // marca antes de enviar
      // reenvio "só para quem não respondeu": avisa apenas os pendentes; senão, todos
      const destino = p.so_pendentes
        ? (db.prepare('SELECT u.id FROM usuarios u WHERE u.ativo = 1 AND NOT EXISTS (SELECT 1 FROM pulso_participacao x WHERE x.pulso_id = ? AND x.usuario_id = u.id AND x.rodada = ?)').all(p.id, p.rodada) as { id: number }[]).map((u) => u.id)
        : 'todos' as const;
      const titulo = p.so_pendentes ? 'Pesquisa aguardando sua resposta' : p.rodada > 1 ? 'Pesquisa de novo' : 'Nova pesquisa';
      await enviarPush(db, destino, { titulo, corpo: `${p.titulo}. Sua opinião é importante, leva poucos minutos.`, url: '/', tag: `pesquisa-${p.id}` });
    }
  } catch { /* ignora */ }
}

export async function rotasPulso(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const perguntasDe = (pulsoId: number) =>
    (db.prepare('SELECT id, texto, tipo, obrigatoria, imagem, opcoes, permite_comentario FROM pulso_perguntas WHERE pulso_id = ? ORDER BY ordem, id').all(pulsoId) as unknown as LinhaPergunta[]).map(paraPergunta);

  // ----- Quem responde: a pesquisa aberta mais recente que a pessoa ainda não respondeu -----
  app.get('/api/pulso', async (req) => {
    const p = db.prepare(`SELECT id, pergunta AS titulo, descricao, anonima FROM pulsos WHERE ${NO_AR} AND ${PENDENTE_DE} ORDER BY id DESC LIMIT 1`)
      .get(agoraLocal(), agoraLocal(), req.usuario!.id) as { id: number; titulo: string; descricao: string | null; anonima: number } | undefined;
    if (!p) return { aberto: false };
    return { aberto: true, id: p.id, titulo: p.titulo, descricao: p.descricao, anonima: !!p.anonima, respondeu: false, perguntas: perguntasDe(p.id) };
  });

  app.post<{ Params: { id: string } }>('/api/pulso/:id/responder', async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const cab = db.prepare(`SELECT anonima, rodada FROM pulsos WHERE id = ? AND ${NO_AR}`).get(id, agoraLocal(), agoraLocal()) as { anonima: number; rodada: number } | undefined;
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
        linhas.push({ pergunta_id: q.id!, valor: String(n), comentario: q.comentario ? texto(r!, 'comentario', 'Comentário', { max: 500, opcional: true }) : null });
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
      const novo = db.prepare('INSERT OR IGNORE INTO pulso_participacao (pulso_id, usuario_id, rodada) VALUES (?, ?, ?)').run(id, req.usuario!.id, cab.rodada);
      if (Number(novo.changes) === 0) { db.exec('ROLLBACK'); return resp.code(409).send({ erro: 'Você já respondeu esta pesquisa. Obrigado!' }); }
      const ins = db.prepare('INSERT INTO pulso_respostas_item (pulso_id, pergunta_id, valor, comentario, dia, usuario_id, rodada) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const dia = hoje(), quem = cab.anonima ? null : req.usuario!.id;
      for (const l of linhas) ins.run(id, l.pergunta_id, l.valor, l.comentario, dia, quem, cab.rodada);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { ok: true };
  });

  // ----- Gestão (aba Pesquisas em Publicar) -----
  const CAMPOS = 'p.id, p.pergunta, p.descricao, p.anonima, p.status, p.abre_em, p.fecha_em, p.criado_em, p.aberto_em, p.encerrado_em, p.rodada, (SELECT COUNT(*) FROM pulso_participacao x WHERE x.pulso_id = p.id AND x.rodada = p.rodada) AS respostas, (SELECT COUNT(*) FROM pulso_participacao x WHERE x.pulso_id = p.id) AS total_respostas, (SELECT COUNT(*) FROM usuarios u WHERE u.ativo = 1 AND NOT EXISTS (SELECT 1 FROM pulso_participacao x WHERE x.pulso_id = p.id AND x.usuario_id = u.id AND x.rodada = p.rodada)) AS pendentes, (SELECT COUNT(*) FROM pulso_perguntas q WHERE q.pulso_id = p.id) AS n_perguntas';
  const comSituacao = <T extends { status: string; abre_em: string | null; fecha_em: string | null }>(p: T) => ({ ...p, situacao: situacaoDe(p) });
  const buscar = (id: number) => ({ ...comSituacao(db.prepare(`SELECT ${CAMPOS} FROM pulsos p WHERE p.id = ?`).get(id) as { status: string; abre_em: string | null; fecha_em: string | null }), perguntas: perguntasDe(id) });
  function periodo(v: unknown, rotulo: string): string | null {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw new ErroValidacao(`${rotulo}: informe data e hora válidas.`);
    return v;
  }
  function ler(c: Record<string, unknown>) {
    const d = lerBruto(c);
    if (d.abre_em && d.fecha_em && d.fecha_em <= d.abre_em) throw new ErroValidacao('A data de encerramento precisa ser depois da data de abertura.');
    return d;
  }
  function lerBruto(c: Record<string, unknown>) {
    return {
      titulo: String(texto(c, 'pergunta', 'Título', { min: 3, max: 160 })),
      descricao: texto(c, 'descricao', 'Descrição', { max: 500, opcional: true }),
      anonima: c.anonima !== false && c.anonima !== 0 && c.anonima !== '0',
      status: escolha(c, 'status', 'Situação', STATUS, 'rascunho'),
      abre_em: periodo(c.abre_em, 'Abre em'), fecha_em: periodo(c.fecha_em, 'Encerra em'),
      // sem lista de perguntas (formato antigo): uma pergunta de nota com o próprio título
      perguntas: c.perguntas === undefined ? null : lerPerguntas(c.perguntas),
    };
  }
  function gravarPerguntas(id: number, ps: Pergunta[]) {
    db.prepare('DELETE FROM pulso_perguntas WHERE pulso_id = ?').run(id);
    const ins = db.prepare('INSERT INTO pulso_perguntas (pulso_id, ordem, texto, tipo, obrigatoria, imagem, opcoes, permite_comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    ps.forEach((p, i) => ins.run(id, i, p.texto, p.tipo, p.obrigatoria ? 1 : 0, p.imagem, p.opcoes.length ? JSON.stringify(p.opcoes) : null, p.comentario ? 1 : 0));
  }
  function aplicarStatus(id: number, novo: string, antigo: string | null) {
    const agora = new Date().toISOString();
    if (novo === 'aberto' && antigo !== 'aberto') db.prepare('UPDATE pulsos SET aberto_em = COALESCE(aberto_em, ?), encerrado_em = NULL WHERE id = ?').run(agora, id);
    if (novo === 'encerrado' && antigo !== 'encerrado') db.prepare('UPDATE pulsos SET encerrado_em = ? WHERE id = ?').run(agora, id);
  }
  app.get('/api/gestao/pulso', { preHandler: exigirPerm('pub.pulso.ver') }, async () =>
    (db.prepare(`SELECT ${CAMPOS} FROM pulsos p ORDER BY p.id DESC`).all() as { id: number; status: string; abre_em: string | null; fecha_em: string | null }[]).map((p) => ({ ...comSituacao(p), perguntas: perguntasDe(p.id) })));
  app.post('/api/gestao/pulso', { preHandler: exigirPerm('pub.pulso.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const ps = d.perguntas ?? [{ texto: d.titulo.length >= 3 ? d.titulo : 'Pergunta', tipo: 'nota' as Tipo, obrigatoria: true, imagem: null, opcoes: [], comentario: true }];
    db.exec('BEGIN');
    let id: number;
    try {
      id = Number(db.prepare('INSERT INTO pulsos (pergunta, descricao, anonima, status, abre_em, fecha_em, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(d.titulo, d.descricao, d.anonima ? 1 : 0, d.status, d.abre_em, d.fecha_em, new Date().toISOString()).lastInsertRowid);
      gravarPerguntas(id, ps);
      db.prepare("INSERT INTO pulso_rodadas (pulso_id, rodada, abre_em, fecha_em, publico, criado_em) VALUES (?, 1, ?, ?, 'todos', ?)").run(id, d.abre_em, d.fecha_em, new Date().toISOString());
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    aplicarStatus(id, d.status, null);
    void avisarAberturas(db);
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
      db.prepare('UPDATE pulsos SET pergunta = ?, descricao = ?, anonima = ?, status = ?, abre_em = ?, fecha_em = ? WHERE id = ?').run(d.titulo, d.descricao, d.anonima ? 1 : 0, d.status, d.abre_em, d.fecha_em, id);
      if (mudouPerguntas) gravarPerguntas(id, d.perguntas!);
      db.prepare('UPDATE pulso_rodadas SET abre_em = ?, fecha_em = ? WHERE pulso_id = ? AND rodada = (SELECT rodada FROM pulsos WHERE id = ?)').run(d.abre_em, d.fecha_em, id, id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    aplicarStatus(id, d.status, atual.status);
    void avisarAberturas(db);
    auditar(db, req.usuario!.id, 'pulso_alterado', { id, de: atual.status, para: d.status });
    return buscar(id);
  });
  // Enviar de novo, na mesma pesquisa, com um novo período. `publico = 'todos'` abre uma nova rodada (todos respondem outra vez, resultado separado);
  // `publico = 'pendentes'` continua a mesma rodada e avisa só quem ainda não respondeu.
  app.post<{ Params: { id: string } }>('/api/gestao/pulso/:id/reenviar', { preHandler: exigirPerm('pub.pulso.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const atual = db.prepare('SELECT rodada FROM pulsos WHERE id = ?').get(id) as { rodada: number } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    const c = corpoObjeto(req.body);
    const publico = escolha(c, 'publico', 'Enviar para', ['todos', 'pendentes'] as const, 'todos');
    const abre = periodo(c.abre_em, 'Abre em'), fecha = periodo(c.fecha_em, 'Encerra em');
    if (abre && fecha && fecha <= abre) throw new ErroValidacao('A data de encerramento precisa ser depois da data de abertura.');
    if (fecha && fecha <= agoraLocal()) throw new ErroValidacao('A data de encerramento precisa estar no futuro.');
    const rodada = publico === 'todos' ? atual.rodada + 1 : atual.rodada;
    db.exec('BEGIN');
    try {
      const agora = new Date().toISOString();
      if (publico === 'todos') db.prepare("INSERT INTO pulso_rodadas (pulso_id, rodada, abre_em, fecha_em, publico, criado_em) VALUES (?, ?, ?, ?, 'todos', ?)").run(id, rodada, abre, fecha, agora);
      else db.prepare("INSERT INTO pulso_rodadas (pulso_id, rodada, abre_em, fecha_em, publico, criado_em) VALUES (?, ?, ?, ?, 'pendentes', ?) ON CONFLICT(pulso_id, rodada) DO UPDATE SET abre_em = excluded.abre_em, fecha_em = excluded.fecha_em, publico = 'pendentes'").run(id, rodada, abre, fecha, agora);
      db.prepare("UPDATE pulsos SET status = 'aberto', abre_em = ?, fecha_em = ?, encerrado_em = NULL, aberto_em = COALESCE(aberto_em, ?), rodada = ?, push_abertura_em = NULL, push_so_pendentes = ? WHERE id = ?")
        .run(abre, fecha, agora, rodada, publico === 'pendentes' ? 1 : 0, id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    void avisarAberturas(db);
    auditar(db, req.usuario!.id, 'pulso_reenviado', { id, publico, rodada });
    return buscar(id);
  });
  app.delete<{ Params: { id: string } }>('/api/gestao/pulso/:id', { preHandler: exigirPerm('pub.pulso.excluir') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    if (!db.prepare('SELECT 1 FROM pulsos WHERE id = ?').get(id)) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    db.prepare('DELETE FROM pulsos WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'pulso_apagado', { id });
    return { ok: true };
  });

  // Resultado agregado; abaixo do mínimo de respostas (pesquisa anônima) só mostra quantas faltam.
  // `publico = true` é a visão dos colaboradores: só as perguntas que o RH liberou, sem nomes e com textos só se liberados.
  function apurar(id: number, publico: boolean, rodadaPedida?: number) {
    const p = db.prepare('SELECT pergunta AS titulo, status, anonima, resultado_liberado FROM pulsos WHERE id = ?').get(id) as { titulo: string; status: string; anonima: number; resultado_liberado: number } | undefined;
    if (!p) return null;
    // rodada mostrada: o RH escolhe (padrão: a atual); os colaboradores veem a rodada mais recente que já tem o mínimo de respostas
    const rodadas = listaRodadas(db, id);
    const atual = rodadaAtual(db, id);
    let rodada = rodadaPedida !== undefined && rodadas.some((r) => r.rodada === rodadaPedida) ? rodadaPedida : atual;
    if (publico) rodada = rodadas.filter((r) => r.respostas >= MINIMO_RESPOSTAS).at(-1)?.rodada ?? atual;
    const total = rodadas.find((r) => r.rodada === rodada)?.respostas ?? 0;
    const alvo = (db.prepare('SELECT COUNT(*) n FROM usuarios WHERE ativo = 1').get() as { n: number }).n;
    const anonima = !!p.anonima;
    const base = { titulo: p.titulo, status: p.status, anonima, respostas: total, alvo, minimo: MINIMO_RESPOSTAS, resultado_liberado: !!p.resultado_liberado, rodada, rodadas: publico ? [] : rodadas };
    // a divulgação aos colaboradores é sempre anônima: exige o mínimo de respostas mesmo nas pesquisas identificadas
    if ((anonima || publico) && total < MINIMO_RESPOSTAS) return { ...base, liberado: false };
    const flags = new Map((db.prepare('SELECT id, publico_resultado, publico_textos, publico_vencedora FROM pulso_perguntas WHERE pulso_id = ?').all(id) as { id: number; publico_resultado: number; publico_textos: number; publico_vencedora: number }[]).map((f) => [f.id, f]));
    const ordemTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
    const visivel = (q: Pergunta) => { const f = flags.get(q.id!)!; return !publico || (!!f.publico_resultado && !(q.tipo === 'texto' && !f.publico_textos)); };
    const perguntas = perguntasDe(id).filter(visivel).map((q) => {
      const fl = flags.get(q.id!)!;
      const verTextos = !publico || !!fl.publico_textos, verNomes = !anonima && !publico;
      const itens = db.prepare('SELECT i.valor, i.comentario, u.nome FROM pulso_respostas_item i LEFT JOIN usuarios u ON u.id = i.usuario_id WHERE i.pergunta_id = ? AND i.rodada = ?').all(q.id, rodada) as { valor: string; comentario: string | null; nome: string | null }[];
      const saida: Record<string, unknown> = { id: q.id, texto: q.texto, tipo: q.tipo, imagem: q.imagem, exibir_resultado: !!fl.publico_resultado, exibir_textos: !!fl.publico_textos, exibir_vencedora: !!fl.publico_vencedora, aceita_comentario: q.comentario };
      if (q.tipo === 'nota') {
        const notas = itens.map((x) => Number(x.valor));
        saida.respondentes = notas.length;
        saida.media = notas.length ? Math.round((notas.reduce((a, x) => a + x, 0) / notas.length) * 10) / 10 : null;
        saida.distribuicao = [1, 2, 3, 4, 5].map((n) => notas.filter((x) => x === n).length);
        // comentários sem data e em ordem alfabética (não revela a ordem de chegada)
        if (verTextos) saida.comentarios = itens.map((x) => x.comentario).filter((x): x is string => !!x).sort(ordemTexto);
        if (verNomes) saida.quem = itens.map((x) => ({ nome: x.nome ?? '—', resposta: x.valor })).sort((a, b) => ordemTexto(a.nome, b.nome));
      } else if (q.tipo === 'texto') {
        saida.respondentes = itens.length;
        if (verTextos) saida.textos = itens.map((x) => x.valor).sort(ordemTexto);
        if (verNomes) saida.quem = itens.map((x) => ({ nome: x.nome ?? '—', resposta: x.valor })).sort((a, b) => ordemTexto(a.nome, b.nome));
      } else {
        const contagem = new Map<string, number>();
        for (const x of itens) contagem.set(x.valor, (contagem.get(x.valor) ?? 0) + 1);
        if (q.tipo === 'unica') saida.respondentes = itens.length; // na múltipla não há como contar pessoas sem ligar as linhas
        saida.opcoes = q.opcoes.map((o) => ({ texto: o.texto, imagem: o.imagem, total: contagem.get(o.texto) ?? 0, ...(verNomes ? { nomes: itens.filter((x) => x.valor === o.texto).map((x) => x.nome ?? '—').sort(ordemTexto) } : {}) }));
        // só a opção mais votada (empates incluídos), sem o gráfico das demais
        if (publico && fl.publico_vencedora) {
          const todas = saida.opcoes as { total: number }[];
          const topo = Math.max(0, ...todas.map((o) => o.total));
          saida.opcoes = todas.filter((o) => o.total === topo && topo > 0);
          saida.so_vencedora = true;
        }
      }
      return saida;
    });
    return { ...base, liberado: true, perguntas };
  }
  app.get<{ Params: { id: string } }>('/api/gestao/pulso/:id/resultado', { preHandler: exigirPerm('pub.pulso.resultado') }, async (req, resp) => {
    const pedida = (req.query as { rodada?: string }).rodada;
    const r = apurar(inteiro(req.params.id, 'Pesquisa'), false, pedida ? inteiro(pedida, 'Rodada') : undefined);
    return r ?? resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
  });

  // O RH decide o que os colaboradores veem: libera a pesquisa e escolhe, por pergunta, o resultado e os textos.
  app.put<{ Params: { id: string } }>('/api/gestao/pulso/:id/publicacao', { preHandler: exigirPerm('pub.pulso.resultado') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const atual = db.prepare('SELECT resultado_liberado, liberado_em FROM pulsos WHERE id = ?').get(id) as { resultado_liberado: number; liberado_em: string | null } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    const c = corpoObjeto(req.body);
    if (!Array.isArray(c.perguntas)) throw new ErroValidacao('Informe o que mostrar em cada pergunta.');
    const liberado = c.liberado === true;
    db.exec('BEGIN');
    try {
      const up = db.prepare('UPDATE pulso_perguntas SET publico_resultado = ?, publico_textos = ?, publico_vencedora = ? WHERE id = ? AND pulso_id = ?');
      for (const b of c.perguntas) { const q = corpoObjeto(b); up.run(q.resultado === false ? 0 : 1, q.textos === true ? 1 : 0, q.vencedora === true ? 1 : 0, inteiro(q.id, 'Pergunta'), id); }
      db.prepare('UPDATE pulsos SET resultado_liberado = ?, liberado_em = ? WHERE id = ?').run(liberado ? 1 : 0, liberado ? (atual.liberado_em ?? new Date().toISOString()) : null, id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    auditar(db, req.usuario!.id, 'pulso_resultado_publicado', { id, liberado });
    // resultado divulgado: avisa uma vez, e só quando ele já pode ser visto (mínimo de respostas)
    const t = db.prepare('SELECT pergunta AS titulo, push_resultado_em, (SELECT COALESCE(MAX(n), 0) FROM (SELECT COUNT(*) AS n FROM pulso_participacao x WHERE x.pulso_id = pulsos.id GROUP BY x.rodada)) AS respostas FROM pulsos WHERE id = ?').get(id) as { titulo: string; push_resultado_em: string | null; respostas: number };
    if (liberado && !t.push_resultado_em && t.respostas >= MINIMO_RESPOSTAS) {
      db.prepare('UPDATE pulsos SET push_resultado_em = ? WHERE id = ?').run(new Date().toISOString(), id);
      void enviarPush(db, 'todos', { titulo: 'Resultado da pesquisa', corpo: `Veja o resultado de «${t.titulo}».`, url: '/', tag: `resultado-${id}` });
    }
    return { ok: true };
  });

  // ----- Colaboradores: resultados que o RH liberou -----
  /** Rodada que os colaboradores veem: a mais recente com o mínimo de respostas (ou null). */
  const rodadaPublica = (id: number) => listaRodadas(db, id).filter((r) => r.respostas >= MINIMO_RESPOSTAS).at(-1) ?? null;
  /** Até 3 imagens da pesquisa (perguntas e opções), para a miniatura do cartão. */
  const imagensDaPesquisa = (id: number): string[] => {
    const qs = db.prepare('SELECT imagem, opcoes FROM pulso_perguntas WHERE pulso_id = ? ORDER BY ordem, id').all(id) as { imagem: string | null; opcoes: string | null }[];
    const todas = qs.flatMap((q) => [q.imagem, ...(q.opcoes ? (JSON.parse(q.opcoes) as Opcao[]).map((o) => o.imagem) : [])]);
    return todas.filter((x): x is string => !!x).slice(0, 3);
  };
  app.get('/api/pulso/resultados', async (req) => {
    const lista = db.prepare('SELECT p.id, p.pergunta AS titulo, p.liberado_em FROM pulsos p WHERE p.resultado_liberado = 1 ORDER BY p.liberado_em DESC, p.id DESC').all() as { id: number; titulo: string; liberado_em: string | null }[];
    const visto = db.prepare('SELECT 1 FROM pulso_resultados_vistos WHERE usuario_id = ? AND pulso_id = ? AND rodada = ?');
    return lista.flatMap((p) => {
      const r = rodadaPublica(p.id);
      return r ? [{ id: p.id, titulo: p.titulo, liberado_em: p.liberado_em, imagens: imagensDaPesquisa(p.id), respostas: r.respostas, rodada: r.rodada, visto: !!visto.get(req.usuario!.id, p.id, r.rodada) }] : [];
    });
  });
  app.post<{ Params: { id: string } }>('/api/pulso/resultados/:id/visto', async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const lib = db.prepare('SELECT resultado_liberado FROM pulsos WHERE id = ?').get(id) as { resultado_liberado: number } | undefined;
    const r = lib?.resultado_liberado ? rodadaPublica(id) : null;
    if (!r) return resp.code(404).send({ erro: 'Este resultado não está disponível.' });
    db.prepare('INSERT OR IGNORE INTO pulso_resultados_vistos (usuario_id, pulso_id, rodada, em) VALUES (?, ?, ?, ?)').run(req.usuario!.id, id, r.rodada, new Date().toISOString());
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/pulso/resultados/:id', async (req, resp) => {
    const r = apurar(inteiro(req.params.id, 'Pesquisa'), true);
    if (!r || !r.resultado_liberado || !r.liberado) return resp.code(404).send({ erro: 'Este resultado não está disponível.' });
    return r;
  });
}
