// Pesquisa de pulso: uma pergunta por vez, nota de 1 a 5 e comentário opcional, resposta anônima.
// Anonimato: a resposta não guarda quem respondeu (só a tabela de participação, separada, evita responder duas vezes) nem a hora.
// O resultado (média, distribuição e comentários) só é mostrado com pelo menos MINIMO_RESPOSTAS respostas, para ninguém ser identificado.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao, escolha, inteiro, texto } from '../../../servidor/src/validar.ts';

export const MINIMO_RESPOSTAS = 5;
const STATUS = ['rascunho', 'aberto', 'encerrado'] as const;
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function rotasPulso(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // ----- Quem responde: a pergunta aberta (a mais recente), se a pessoa ainda não respondeu -----
  app.get('/api/pulso', async (req) => {
    const p = db.prepare("SELECT id, pergunta FROM pulsos WHERE status = 'aberto' ORDER BY id DESC LIMIT 1").get() as { id: number; pergunta: string } | undefined;
    if (!p) return { aberto: false };
    const respondeu = !!db.prepare('SELECT 1 FROM pulso_participacao WHERE pulso_id = ? AND usuario_id = ?').get(p.id, req.usuario!.id);
    return { aberto: true, id: p.id, pergunta: p.pergunta, respondeu };
  });
  app.post<{ Params: { id: string } }>('/api/pulso/:id/responder', async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const p = db.prepare("SELECT id FROM pulsos WHERE id = ? AND status = 'aberto'").get(id);
    if (!p) return resp.code(404).send({ erro: 'Esta pesquisa não está aberta.' });
    const c = corpoObjeto(req.body);
    const nota = Number(c.nota);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new ErroValidacao('Nota: escolha de 1 a 5.');
    const comentario = texto(c, 'comentario', 'Comentário', { max: 500, opcional: true });
    // participação e resposta na mesma transação, mas sem ligação entre elas
    db.exec('BEGIN');
    try {
      const novo = db.prepare('INSERT OR IGNORE INTO pulso_participacao (pulso_id, usuario_id) VALUES (?, ?)').run(id, req.usuario!.id);
      if (Number(novo.changes) === 0) { db.exec('ROLLBACK'); return resp.code(409).send({ erro: 'Você já respondeu esta pesquisa. Obrigado!' }); }
      db.prepare('INSERT INTO pulso_respostas (pulso_id, nota, comentario, dia) VALUES (?, ?, ?, ?)').run(id, nota, comentario, hoje());
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { ok: true };
  });

  // ----- Gestão (aba Pesquisa de pulso em Publicar) -----
  const CAMPOS = 'p.id, p.pergunta, p.status, p.criado_em, p.aberto_em, p.encerrado_em, (SELECT COUNT(*) FROM pulso_participacao x WHERE x.pulso_id = p.id) AS respostas';
  const buscar = (id: number) => db.prepare(`SELECT ${CAMPOS} FROM pulsos p WHERE p.id = ?`).get(id);
  function ler(c: Record<string, unknown>) {
    return { pergunta: String(texto(c, 'pergunta', 'Pergunta', { min: 8, max: 160 })), status: escolha(c, 'status', 'Situação', STATUS, 'rascunho') };
  }
  /** Só uma pesquisa aberta por vez: abrir uma encerra a anterior. */
  function aplicarStatus(id: number, novo: string, antigo: string | null) {
    const agora = new Date().toISOString();
    if (novo === 'aberto' && antigo !== 'aberto') {
      db.prepare("UPDATE pulsos SET status = 'encerrado', encerrado_em = ? WHERE status = 'aberto' AND id <> ?").run(agora, id);
      db.prepare('UPDATE pulsos SET aberto_em = COALESCE(aberto_em, ?), encerrado_em = NULL WHERE id = ?').run(agora, id);
    }
    if (novo === 'encerrado' && antigo !== 'encerrado') db.prepare('UPDATE pulsos SET encerrado_em = ? WHERE id = ?').run(agora, id);
  }
  app.get('/api/gestao/pulso', { preHandler: exigirPerm('pub.pulso.ver') }, async () => db.prepare(`SELECT ${CAMPOS} FROM pulsos p ORDER BY p.id DESC`).all());
  app.post('/api/gestao/pulso', { preHandler: exigirPerm('pub.pulso.criar') }, async (req, resp) => {
    const d = ler(corpoObjeto(req.body));
    const id = Number(db.prepare('INSERT INTO pulsos (pergunta, status, criado_em) VALUES (?, ?, ?)').run(d.pergunta, d.status, new Date().toISOString()).lastInsertRowid);
    aplicarStatus(id, d.status, null);
    auditar(db, req.usuario!.id, 'pulso_criado', { id, status: d.status });
    return resp.code(201).send(buscar(id));
  });
  app.put<{ Params: { id: string } }>('/api/gestao/pulso/:id', { preHandler: exigirPerm('pub.pulso.editar') }, async (req, resp) => {
    const id = inteiro(req.params.id, 'Pesquisa');
    const atual = db.prepare('SELECT status, pergunta FROM pulsos WHERE id = ?').get(id) as { status: string; pergunta: string } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    const d = ler(corpoObjeto(req.body));
    const { n } = db.prepare('SELECT COUNT(*) n FROM pulso_participacao WHERE pulso_id = ?').get(id) as { n: number };
    if (n > 0 && d.pergunta !== atual.pergunta) return resp.code(409).send({ erro: 'A pergunta não pode mudar depois que alguém respondeu. Crie uma nova pesquisa.' });
    db.prepare('UPDATE pulsos SET pergunta = ?, status = ? WHERE id = ?').run(d.pergunta, d.status, id);
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
    const p = db.prepare('SELECT pergunta, status FROM pulsos WHERE id = ?').get(id) as { pergunta: string; status: string } | undefined;
    if (!p) return resp.code(404).send({ erro: 'Pesquisa não encontrada.' });
    const notas = db.prepare('SELECT nota FROM pulso_respostas WHERE pulso_id = ?').all(id) as { nota: number }[];
    const alvo = (db.prepare('SELECT COUNT(*) n FROM usuarios WHERE ativo = 1').get() as { n: number }).n;
    if (notas.length < MINIMO_RESPOSTAS) return { ...p, respostas: notas.length, alvo, minimo: MINIMO_RESPOSTAS, liberado: false };
    const distribuicao = [1, 2, 3, 4, 5].map((n) => notas.filter((x) => x.nota === n).length);
    const media = Math.round((notas.reduce((a, x) => a + x.nota, 0) / notas.length) * 10) / 10;
    // comentários sem data e em ordem alfabética (não revela a ordem de chegada)
    const comentarios = (db.prepare("SELECT comentario FROM pulso_respostas WHERE pulso_id = ? AND comentario IS NOT NULL AND comentario <> ''").all(id) as { comentario: string }[]).map((c) => c.comentario).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { ...p, respostas: notas.length, alvo, minimo: MINIMO_RESPOSTAS, liberado: true, media, distribuicao, comentarios };
  });
}
