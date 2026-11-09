// Integrações (Configurações › Integrações): conexão do portal com o serviço Zimbra e repasse da configuração do próprio serviço.
// O serviço (MCP/zimbra-mcp) só aceita a configuração vinda do mesmo servidor, por isso o portal faz a ponte (com token, sem expor segredos).
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { corpoObjeto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { agendaSalva, chamarZimbra, conexaoZimbra, ErroZimbra, gravarIntegracao, temTokenSalvo, urlSalva } from './zimbra.ts';

const CHAVES_PERMITIDAS = ['host', 'user', 'senha', 'smtp_host', 'smtp_port', 'servicos', 'agendas', 'listas_tarefas', 'servico', 'origens', 'provedor', 'permitir_outros_dominios'] as const;
const PROVEDORES = ['zimbra', 'gmail', 'outlook', 'outro'] as const;
const SERVICOS = ['email', 'envio', 'agenda', 'agenda_escrita', 'contatos', 'tarefas', 'arquivos', 'notificacoes'] as const;

interface EstadoServico {
  host: string; user: string; smtp_host: string; smtp_port: number; senha_salva: boolean; servico_user: string; servico_senha_salva: boolean;
  remetente_nome: string; dominios_permitidos: string[]; limite_hora: number; api_usa: string; origens_permitidas: string[]; servicos: Record<string, boolean>;
  provedor: string; permitir_outros_dominios: boolean; provedores: Record<string, string>;
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
    const prov = corpo.provedor ?? 'zimbra';
    if (!(PROVEDORES as readonly unknown[]).includes(prov)) throw new ErroValidacao('Provedor de e-mail inválido.');
    if (corpo.permitir_outros_dominios !== undefined && typeof corpo.permitir_outros_dominios !== 'boolean') throw new ErroValidacao('Permitir outros domínios: formato inválido.');
    const precisaHost = prov === 'zimbra' || prov === 'outro';
    if (typeof corpo.user !== 'string' || !corpo.user.trim() || (precisaHost && (typeof corpo.host !== 'string' || !corpo.host.trim()))) throw new ErroValidacao(precisaHost ? 'Informe o servidor (host) e o e-mail da conta.' : 'Informe o e-mail da conta.');
    if (corpo.servicos !== undefined) {
      const s = corpo.servicos as Record<string, unknown>;
      if (typeof s !== 'object' || s === null || Object.entries(s).some(([k, v]) => !(SERVICOS as readonly string[]).includes(k) || typeof v !== 'boolean')) throw new ErroValidacao('Serviços: formato inválido.');
    }
    for (const k of ['agendas', 'listas_tarefas', 'origens']) if (corpo[k] !== undefined && (!Array.isArray(corpo[k]) || (corpo[k] as unknown[]).some((x) => typeof x !== 'string' && typeof x !== 'number'))) throw new ErroValidacao(`${k}: formato inválido.`);
    try {
      const estado = await chamarZimbra<EstadoServico>(conectar(), 'PUT', '/api/config', corpo, 30_000);
      auditar(db, req.usuario!.id, 'integracao_zimbra_config', { host: corpo.host, user: corpo.user, senha_alterada: !!corpo.senha, servicos: corpo.servicos, provedor: prov, permitir_outros_dominios: corpo.permitir_outros_dominios });
      return estado;
    } catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });

  // Várias contas (Zimbra, Google, Microsoft, SMTP): o portal repassa ao serviço, que guarda senhas e tokens no cofre do servidor.
  const TIPOS = ['zimbra', 'google', 'microsoft', 'smtp'] as const;
  const idConta = (v: unknown) => { const s = String(v ?? ''); if (!/^[a-z0-9-]{2,30}$/.test(s)) throw new ErroValidacao('Identificador da conta: 2 a 30 letras minúsculas, números ou hífen.'); return s; };
  app.get('/api/integracoes/zimbra/contas', ver, async (_req, resp) => {
    try { return await chamarZimbra<unknown>(conectar(), 'GET', '/api/contas', undefined, 20_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
  app.post('/api/integracoes/zimbra/contas', editar, async (req, resp) => {
    const c = corpoObjeto(req.body);
    const corpo: Record<string, unknown> = { id: idConta(c.id), tipo: c.tipo, user: String(c.user ?? '').trim(), nome: String(c.nome ?? '').trim().slice(0, 60),
      host: String(c.host ?? '').trim().slice(0, 200), smtp_host: String(c.smtp_host ?? '').trim().slice(0, 200), funcoes: c.funcoes };
    if (!(TIPOS as readonly unknown[]).includes(corpo.tipo)) throw new ErroValidacao('Tipo de conta inválido.');
    if (!corpo.user || String(corpo.user).length > 200) throw new ErroValidacao('Informe o e-mail da conta.');
    if (!Array.isArray(corpo.funcoes) || corpo.funcoes.some((x) => !(SERVICOS as readonly unknown[]).includes(x))) throw new ErroValidacao('Funções: formato inválido.');
    if (c.smtp_port !== undefined && c.smtp_port !== '') { const p = Number(c.smtp_port); if (!Number.isInteger(p) || p < 1 || p > 65535) throw new ErroValidacao('Porta SMTP inválida.'); corpo.smtp_port = p; }
    if (typeof c.senha === 'string' && c.senha) corpo.senha = c.senha;
    if (Array.isArray(c.agendas) && c.agendas.every((x) => typeof x === 'string')) corpo.agendas = c.agendas;
    try {
      const r = await chamarZimbra<unknown>(conectar(), 'POST', '/api/contas', corpo, 30_000);
      auditar(db, req.usuario!.id, 'integracao_conta_salva', { id: corpo.id, tipo: corpo.tipo, funcoes: corpo.funcoes, senha_alterada: !!corpo.senha });
      return r;
    } catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
  app.delete<{ Params: { id: string } }>('/api/integracoes/zimbra/contas/:id', editar, async (req, resp) => {
    const id = idConta(req.params.id);
    try { const r = await chamarZimbra<unknown>(conectar(), 'DELETE', `/api/contas/${id}`, undefined, 20_000); auditar(db, req.usuario!.id, 'integracao_conta_removida', { id }); return r; }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
  app.post<{ Params: { id: string } }>('/api/integracoes/zimbra/contas/:id/testar', editar, async (req, resp) => {
    const id = req.params.id === 'principal' ? 'principal' : idConta(req.params.id);
    try { return await chamarZimbra<unknown>(conectar(), 'POST', `/api/contas/${id}/testar`, undefined, 60_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); } finally { auditar(db, req.usuario!.id, 'integracao_conta_testada', { id }); }
  });
  app.get<{ Params: { id: string } }>('/api/integracoes/zimbra/contas/:id/agendas', ver, async (req, resp) => {
    const id = req.params.id === 'principal' ? 'principal' : idConta(req.params.id);
    try { return await chamarZimbra<unknown>(conectar(), 'GET', `/api/contas/${id}/agendas`, undefined, 30_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
  // OAuth: identificador do aplicativo criado no Google Cloud / Azure e início do login (devolve a URL do provedor).
  app.put('/api/integracoes/zimbra/oauth/cliente', editar, async (req, resp) => {
    const c = corpoObjeto(req.body);
    if (c.provedor !== 'google' && c.provedor !== 'microsoft') throw new ErroValidacao('Provedor OAuth inválido.');
    const client_id = String(c.client_id ?? '').trim();
    if (!client_id || client_id.length > 300) throw new ErroValidacao('Informe o ID do aplicativo (client id).');
    try {
      const r = await chamarZimbra<unknown>(conectar(), 'PUT', '/api/oauth/cliente', { provedor: c.provedor, client_id, client_secret: typeof c.client_secret === 'string' && c.client_secret ? c.client_secret : undefined }, 20_000);
      auditar(db, req.usuario!.id, 'integracao_oauth_cliente', { provedor: c.provedor, segredo_alterado: !!c.client_secret });
      return r;
    } catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
  app.post('/api/integracoes/zimbra/oauth/iniciar', editar, async (req, resp) => {
    const id = idConta(corpoObjeto(req.body).conta);
    try { return await chamarZimbra<unknown>(conectar(), 'POST', '/api/oauth/iniciar', { conta: id }, 20_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });

  app.get('/api/integracoes/zimbra/agendas', ver, async (_req, resp) => {
    try { return await chamarZimbra<unknown[]>(conectar(), 'GET', '/api/agendas', undefined, 30_000); }
    catch (e) { const f = falha(e); return resp.code(f.status).send(f.corpo); }
  });
}
