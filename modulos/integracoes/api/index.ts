// Integrações (Configurações › Integrações): conexão do portal com o serviço Zimbra e repasse da configuração do próprio serviço.
// O serviço (MCP/zimbra-mcp) só aceita a configuração vinda do mesmo servidor, por isso o portal faz a ponte (com token, sem expor segredos).
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { agendaSalva, chamarZimbra, conexaoZimbra, ErroZimbra, gravarIntegracao, temTokenSalvo, urlSalva } from './zimbra.ts';

const CHAVES_PERMITIDAS = ['host', 'user', 'senha', 'smtp_host', 'smtp_port', 'servicos', 'agendas', 'listas_tarefas', 'servico', 'origens'] as const;
const SERVICOS = ['email', 'envio', 'agenda', 'agenda_escrita', 'contatos', 'tarefas', 'arquivos', 'notificacoes'] as const;

interface EstadoServico {
  host: string; user: string; smtp_host: string; smtp_port: number; senha_salva: boolean; servico_user: string; servico_senha_salva: boolean;
  remetente_nome: string; dominios_permitidos: string[]; limite_hora: number; api_usa: string; origens_permitidas: string[]; servicos: Record<string, boolean>;
}

function urlValida(v: unknown): string {
  const s = String(v ?? '').trim();
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) throw new Error();
    return `${u.protocol}//${u.host}`;
  } catch { throw new ErroValidacao('Endereço do serviço: use http:// ou https:// com o endereço (ex.: http://127.0.0.1:8765).'); }
}

export async function rotasIntegracoes(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  const ver = { preHandler: exigirPerm('cfg.integracoes.ver') };
  const editar = { preHandler: exigirPerm('cfg.integracoes.editar') };

  /** Converte erro do serviço em resposta amigável (a tela mostra a mensagem). */
  const falha = (e: unknown) => { if (e instanceof ErroZimbra) return { status: e.status, corpo: { erro: e.message } }; throw e; };
  const conectar = () => {
    const c = conexaoZimbra(db);
    if (!c) throw new ErroZimbra('Ainda não há conexão com o serviço Zimbra. Preencha o endereço e o token e salve.', 400);
    return c;
  };

  // Situação: o que o portal tem salvo + o que o serviço diz de si (se estiver ligado).
  app.get('/api/integracoes/zimbra', ver, async () => {
    const c = conexaoZimbra(db);
    const base = { url: urlSalva(db) || c?.url || '', token_salvo: temTokenSalvo(db), origem: c?.origem ?? null, agenda_destino: agendaSalva(db) };
    if (!c) return { ...base, servico: { alcancavel: false, erro: 'Sem conexão configurada.' } };
    try { return { ...base, servico: { alcancavel: true, config: await chamarZimbra<EstadoServico>(c, 'GET', '/api/config') } }; }
    catch (e) { return { ...base, servico: { alcancavel: false, erro: e instanceof ErroZimbra ? e.message : 'Falha inesperada ao consultar o serviço.' } }; }
  });

  // Conexão do portal com o serviço (endereço, token e agenda onde as datas importantes são criadas).
  app.put('/api/integracoes/zimbra', editar, async (req) => {
    const c = corpoObjeto(req.body);
    if (c.desconectar === true) {
      gravarIntegracao(db, 'url', ''); gravarIntegracao(db, 'token', '');
      auditar(db, req.usuario!.id, 'integracao_zimbra_desconectada');
      return { ok: true };
    }
    if (c.url !== undefined) gravarIntegracao(db, 'url', urlValida(c.url));
    if (typeof c.token === 'string' && c.token.trim()) {
      if (c.token.trim().length < 16) throw new ErroValidacao('Token: o valor parece curto demais. Cole o token completo do serviço.');
      gravarIntegracao(db, 'token', c.token.trim());
    }
    if (typeof c.agenda === 'string') gravarIntegracao(db, 'agenda', c.agenda.trim().slice(0, 80));
    auditar(db, req.usuario!.id, 'integracao_zimbra_alterada', { url: urlSalva(db), token_alterado: typeof c.token === 'string' && !!c.token.trim(), agenda: agendaSalva(db) });
    return { ok: true };
  });

  app.post('/api/integracoes/zimbra/testar', editar, async (req, resp) => {
    try { return await chamarZimbra<Record<string, unknown>>(conectar(), 'POST', '/api/testar', undefined, 45_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); } finally { auditar(db, req.usuario!.id, 'integracao_zimbra_testada'); }
  });

  // Configuração do serviço (conta do Zimbra, serviços ligados, agendas usadas, conta de serviço): repasse ao serviço.
  app.put('/api/integracoes/zimbra/config', editar, async (req, resp) => {
    const c = corpoObjeto(req.body);
    const corpo: Record<string, unknown> = {};
    for (const k of CHAVES_PERMITIDAS) if (c[k] !== undefined) corpo[k] = c[k];
    if (typeof corpo.host !== 'string' || !corpo.host.trim() || typeof corpo.user !== 'string' || !corpo.user.trim()) throw new ErroValidacao('Informe o servidor (host) e o e-mail do Zimbra.');
    if (corpo.servicos !== undefined) {
      const s = corpo.servicos as Record<string, unknown>;
      if (typeof s !== 'object' || s === null || Object.entries(s).some(([k, v]) => !(SERVICOS as readonly string[]).includes(k) || typeof v !== 'boolean')) throw new ErroValidacao('Serviços: formato inválido.');
    }
    for (const k of ['agendas', 'listas_tarefas', 'origens']) if (corpo[k] !== undefined && (!Array.isArray(corpo[k]) || (corpo[k] as unknown[]).some((x) => typeof x !== 'string' && typeof x !== 'number'))) throw new ErroValidacao(`${k}: formato inválido.`);
    try {
      const estado = await chamarZimbra<EstadoServico>(conectar(), 'PUT', '/api/config', corpo, 30_000);
      auditar(db, req.usuario!.id, 'integracao_zimbra_config', { host: corpo.host, user: corpo.user, senha_alterada: !!corpo.senha, servicos: corpo.servicos });
      return estado;
    } catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });

  app.get('/api/integracoes/zimbra/agendas', ver, async (_req, resp) => {
    try { return await chamarZimbra<unknown[]>(conectar(), 'GET', '/api/agendas', undefined, 30_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
}
