// Propriedade do conteúdo publicado.
//  - Ninguém apaga o que outra pessoa publicou: só o administrador.
//  - Para editar o que outra pessoa criou, o dono (ou o administrador) precisa autorizar um pedido; a autorização vale 24 horas.
//  - Conteúdo sem dono conhecido (anterior a esta regra) só o administrador apaga, e os pedidos de edição vão para ele.
// Fica num lugar só: um gancho global confere as rotas de editar/apagar e anota o dono quando uma rota de criar responde 201.
import { enviarPush } from '../../push/api/index.ts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar } from '../../acessos/api/guard.ts';
import { corpoObjeto, inteiro } from '../../../servidor/src/validar.ts';

interface Recurso {
  id: string;
  rotulo: string;
  tabela: string;
  chave: string;
  /** coluna com o nome mostrado no aviso */
  titulo: string;
  /** padrão da rota (req.routeOptions.url) de criar / editar / apagar */
  criar?: string;
  editar?: string;
  apagar?: string;
  /** a chave é texto (slug / id externo) em vez de número */
  textual?: boolean;
  /** o dono fica numa tabela à parte (eventos do Zimbra) */
  tabelaDono?: boolean;
}

export const RECURSOS: Recurso[] = [
  { id: 'comunicado', rotulo: 'Comunicado', tabela: 'comunicados', chave: 'id', titulo: 'titulo', criar: '/api/gestao/comunicados', editar: '/api/gestao/comunicados/:id', apagar: '/api/gestao/comunicados/:id' },
  { id: 'banner', rotulo: 'Banner', tabela: 'banners', chave: 'id', titulo: 'titulo', criar: '/api/gestao/banners', editar: '/api/gestao/banners/:id', apagar: '/api/gestao/banners/:id' },
  { id: 'documento', rotulo: 'Documento', tabela: 'documentos', chave: 'id', titulo: 'titulo', criar: '/api/gestao/documentos', editar: '/api/gestao/documentos/:id', apagar: '/api/gestao/documentos/:id' },
  { id: 'destaque', rotulo: 'Colaborador destaque', tabela: 'destaques', chave: 'id', titulo: 'nome', criar: '/api/gestao/destaques', editar: '/api/gestao/destaques/:id', apagar: '/api/gestao/destaques/:id' },
  { id: 'contato', rotulo: 'Contato', tabela: 'contatos', chave: 'id', titulo: 'nome', criar: '/api/gestao/contatos', editar: '/api/gestao/contatos/:id', apagar: '/api/gestao/contatos/:id' },
  { id: 'aplicacao', rotulo: 'Aplicativo', tabela: 'aplicacoes', chave: 'slug', titulo: 'nome', textual: true, criar: '/api/gestao/aplicacoes', editar: '/api/gestao/aplicacoes/:slug', apagar: '/api/gestao/aplicacoes/:slug' },
  { id: 'aniversariante', rotulo: 'Aniversariante', tabela: 'aniversariantes', chave: 'id', titulo: 'nome', criar: '/api/gestao/aniversariantes', editar: '/api/gestao/aniversariantes/:id', apagar: '/api/gestao/aniversariantes/:id' },
  { id: 'novo', rotulo: 'Novo colaborador', tabela: 'novos_colaboradores', chave: 'id', titulo: 'nome', criar: '/api/gestao/novos', editar: '/api/gestao/novos/:id', apagar: '/api/gestao/novos/:id' },
  { id: 'pulso', rotulo: 'Pesquisa de pulso', tabela: 'pulsos', chave: 'id', titulo: 'pergunta', criar: '/api/gestao/pulso', editar: '/api/gestao/pulso/:id', apagar: '/api/gestao/pulso/:id' },
  { id: 'rede', rotulo: 'Publicação para rede social', tabela: 'publicacoes_externas', chave: 'id', titulo: 'titulo', criar: '/api/gestao/redes', editar: '/api/gestao/redes/:id', apagar: '/api/gestao/redes/:id' },
  { id: 'data', rotulo: 'Data do calendário', tabela: 'calendario_datas', chave: 'id', titulo: 'titulo', criar: '/api/gestao/calendario/datas', editar: '/api/gestao/calendario/datas/:id', apagar: '/api/gestao/calendario/datas/:id' },
  { id: 'evento', rotulo: 'Evento da agenda', tabela: 'calendario_eventos_dono', chave: 'evento_id', titulo: 'titulo', textual: true, tabelaDono: true, criar: '/api/calendario', apagar: '/api/calendario/:id' },
];

const HORAS_AUTORIZACAO = 24;
const ehAdmin = (req: FastifyRequest) => req.usuario?.perfil === 'admin';

/** Dono do registro: `existe` diz se o registro existe; `dono` é null quando não se sabe quem criou. */
function donoDe(db: Banco, r: Recurso, registro: string): { existe: boolean; dono: number | null; titulo: string | null } {
  const valor = r.textual ? registro : Number(registro);
  const linha = db.prepare(`SELECT criado_por AS dono, ${r.titulo} AS titulo FROM ${r.tabela} WHERE ${r.chave} = ?`).get(valor) as { dono: number | null; titulo: string | null } | undefined;
  // Evento do Zimbra que o portal não registrou: existe no Zimbra, mas sem dono conhecido.
  if (!linha) return { existe: r.tabelaDono === true, dono: null, titulo: null };
  return { existe: true, dono: linha.dono, titulo: linha.titulo };
}

const porRota = (campo: 'criar' | 'editar' | 'apagar', rota: string, metodo: string) => {
  const esperado = campo === 'criar' ? 'POST' : campo === 'editar' ? 'PUT' : 'DELETE';
  return metodo === esperado ? RECURSOS.find((r) => r[campo] === rota) : undefined;
};

export const autorizacaoVigente = (db: Banco, usuarioId: number, recurso: string, registro: string) =>
  !!db.prepare("SELECT 1 FROM pedidos_edicao WHERE solicitante_id = ? AND recurso = ? AND registro = ? AND status = 'aprovado' AND decidido_em > ?")
    .get(usuarioId, recurso, registro, new Date(Date.now() - HORAS_AUTORIZACAO * 3600_000).toISOString());

export async function rotasPropriedade(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  // Confere editar e apagar antes de a rota rodar.
  app.addHook('preHandler', async (req: FastifyRequest, resp: FastifyReply) => {
    if (!req.usuario || ehAdmin(req)) return;
    const rota = req.routeOptions.url ?? '';
    const edicao = porRota('editar', rota, req.method), exclusao = porRota('apagar', rota, req.method);
    const r = edicao ?? exclusao;
    if (!r) return;
    const params = req.params as Record<string, string>;
    const registro = String(params[r.chave === 'slug' ? 'slug' : 'id'] ?? '');
    if (r.textual && !/^[\w.:-]{1,80}$/.test(registro)) return; // identificador inválido: a própria rota responde 400
    const { existe, dono } = donoDe(db, r, registro);
    if (!existe || dono === req.usuario.id) return; // inexistente: a própria rota responde 404
    if (exclusao) return resp.code(403).send({ erro: `Só o administrador apaga ${dono ? 'o que outra pessoa publicou' : 'conteúdo sem dono registrado'}.` });
    if (autorizacaoVigente(db, req.usuario.id, r.id, registro)) return;
    return resp.code(403).send({ erro: `Este conteúdo foi criado por ${dono ? 'outra pessoa' : 'alguém que não está mais registrado'}. Para editar, peça autorização.`, codigo: 'precisa_autorizacao', recurso: r.id, registro });
  });

  // Anota o dono quando uma rota de criar responde 201.
  app.addHook('onSend', async (req: FastifyRequest, resp: FastifyReply, payload: unknown) => {
    if (!req.usuario || resp.statusCode !== 201 || typeof payload !== 'string') return payload;
    const r = porRota('criar', req.routeOptions.url ?? '', req.method);
    if (!r) return payload;
    try {
      const corpo = JSON.parse(payload) as Record<string, unknown>;
      const registro = corpo[r.chave] ?? corpo.id;
      if (registro === undefined) return payload;
      if (r.tabelaDono) {
        const enviado = req.body && typeof req.body === 'object' ? String((req.body as Record<string, unknown>).titulo ?? '') : '';
        db.prepare('INSERT OR REPLACE INTO calendario_eventos_dono (evento_id, titulo, criado_por) VALUES (?, ?, ?)').run(String(registro), enviado || null, req.usuario.id);
      } else {
        db.prepare(`UPDATE ${r.tabela} SET criado_por = ? WHERE ${r.chave} = ?`).run(req.usuario.id, registro as string | number);
      }
    } catch { /* sem dono registrado: só o administrador mexe */ }
    return payload;
  });

  // ----- Pedidos de autorização para editar -----
  app.post('/api/pedidos-edicao', async (req, resp) => {
    const c = corpoObjeto(req.body);
    const r = RECURSOS.find((x) => x.id === c.recurso);
    if (!r || !r.editar) return resp.code(400).send({ erro: 'Conteúdo desconhecido.' });
    const registro = String(c.registro ?? '');
    const { existe, dono, titulo } = donoDe(db, r, registro);
    if (!existe) return resp.code(404).send({ erro: `${r.rotulo} não encontrado.` });
    const eu = req.usuario!;
    if (eu.perfil === 'admin' || dono === eu.id) return resp.code(400).send({ erro: 'Você já pode editar este conteúdo.' });
    const aberto = db.prepare("SELECT id FROM pedidos_edicao WHERE solicitante_id = ? AND recurso = ? AND registro = ? AND status = 'pendente'").get(eu.id, r.id, registro) as { id: number } | undefined;
    if (aberto) return { id: aberto.id, repetido: true };
    const id = Number(db.prepare('INSERT INTO pedidos_edicao (recurso, registro, titulo, solicitante_id, dono_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(r.id, registro, titulo, eu.id, dono, new Date().toISOString()).lastInsertRowid);
    auditar(db, eu.id, 'edicao_pedida', { id, recurso: r.id, registro });
    const decisores = dono ? [dono] : (db.prepare("SELECT id FROM usuarios WHERE perfil = 'admin' AND ativo = 1").all() as { id: number }[]).map((a) => a.id);
    void enviarPush(db, decisores, { titulo: 'Pedido para editar', corpo: `${eu.nome} pede para editar «${titulo}».`, url: '/', tag: `pedido-${id}` });
    return resp.code(201).send({ id });
  });

  // Caixa do sino: o que espera a minha decisão (sou o dono; o administrador vê tudo) e as respostas aos meus pedidos.
  app.get('/api/pedidos-edicao/caixa', async (req) => {
    const eu = req.usuario!;
    const rotulo = (recurso: string) => RECURSOS.find((x) => x.id === recurso)?.rotulo ?? recurso;
    const base = `SELECT p.id, p.recurso, p.registro, p.titulo, p.criado_em, p.status, p.decidido_em, p.dono_id, s.nome AS solicitante, d.nome AS dono
                    FROM pedidos_edicao p JOIN usuarios s ON s.id = p.solicitante_id LEFT JOIN usuarios d ON d.id = p.dono_id`;
    const pendentes = (db.prepare(`${base} WHERE p.status = 'pendente' ${eu.perfil === 'admin' ? '' : 'AND p.dono_id = ?'} ORDER BY p.criado_em`)
      .all(...(eu.perfil === 'admin' ? [] : [eu.id])) as Record<string, unknown>[]).map((p) => ({ ...p, rotulo: rotulo(String(p.recurso)) }));
    const desde = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const respostas = (db.prepare(`${base} WHERE p.solicitante_id = ? AND p.status <> 'pendente' AND p.decidido_em > ? ORDER BY p.decidido_em DESC`)
      .all(eu.id, desde) as Record<string, unknown>[]).map((p) => ({ ...p, rotulo: rotulo(String(p.recurso)) }));
    return { pendentes, respostas };
  });

  app.post<{ Params: { id: string } }>('/api/pedidos-edicao/:id/decidir', async (req, resp) => {
    const id = inteiro(req.params.id, 'Pedido');
    const eu = req.usuario!;
    const p = db.prepare("SELECT id, dono_id, recurso, registro FROM pedidos_edicao WHERE id = ? AND status = 'pendente'").get(id) as { id: number; dono_id: number | null; recurso: string; registro: string } | undefined;
    if (!p) return resp.code(404).send({ erro: 'Pedido não encontrado ou já respondido.' });
    if (eu.perfil !== 'admin' && p.dono_id !== eu.id) return resp.code(403).send({ erro: 'Só o dono do conteúdo ou o administrador responde este pedido.' });
    const aprovar = corpoObjeto(req.body).aprovar === true;
    db.prepare('UPDATE pedidos_edicao SET status = ?, decidido_em = ?, decidido_por = ? WHERE id = ?').run(aprovar ? 'aprovado' : 'negado', new Date().toISOString(), eu.id, id);
    auditar(db, eu.id, aprovar ? 'edicao_autorizada' : 'edicao_negada', { id, recurso: p.recurso, registro: p.registro });
    const sol = db.prepare('SELECT solicitante_id, titulo FROM pedidos_edicao WHERE id = ?').get(id) as { solicitante_id: number; titulo: string };
    void enviarPush(db, [sol.solicitante_id], { titulo: aprovar ? 'Edição autorizada' : 'Edição negada', corpo: `Seu pedido para editar «${sol.titulo}» foi ${aprovar ? 'autorizado (vale por 24 horas)' : 'negado'}.`, url: '/', tag: `pedido-${id}` });
    return { ok: true };
  });
}
