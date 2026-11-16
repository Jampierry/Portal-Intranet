// Login único pelo Keycloak (OpenID Connect, fluxo "authorization code" com PKCE). Complementa o login local, que continua valendo.
// O servidor troca o código por um token e lê o e-mail em /userinfo (chamada direta ao Keycloak, por HTTPS); a pessoa só entra se o
// e-mail corporativo dela estiver cadastrado em um usuário ATIVO do portal (nada é criado sozinho).
// Variáveis: KEYCLOAK_ISSUER_URL (ou KEYCLOAK_URL + KEYCLOAK_REALM), KEYCLOAK_CLIENT_ID,
// KEYCLOAK_CLIENT_SECRET e, opcional, KEYCLOAK_REDIRECT_URI (padrão: <ORIGENS_PERMITIDAS[0]>/api/v1/admin/auth/callback, o endereço
// que a TI cadastrou no cliente). Sem elas, o login por Keycloak fica desligado.
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { config } from '../../../servidor/src/config.ts';
import { auditar, COOKIE_SESSAO, criarSessao, horasDaSessao } from '../../acessos/api/guard.ts';
import { registrarUso } from '../../uso/api/registro.ts';

export const CAMINHOS_RETORNO = ['/api/v1/admin/auth/callback', '/api/v1/auth/callback'];

interface Cfg { base: string; clientId: string; segredo: string; redirect: string }
export function lerCfg(env: NodeJS.ProcessEnv = process.env): Cfg | null {
  // O jeito simples: KEYCLOAK_ISSUER_URL (ex.: https://auth.dipaula.com.br/realms/dipaula-corp). Alternativa: KEYCLOAK_URL + KEYCLOAK_REALM.
  const issuer = env.KEYCLOAK_ISSUER_URL?.trim().replace(/\/+$/, '');
  const url = env.KEYCLOAK_URL?.trim().replace(/\/+$/, ''), realm = env.KEYCLOAK_REALM?.trim();
  const clientId = env.KEYCLOAK_CLIENT_ID?.trim(), segredo = env.KEYCLOAK_CLIENT_SECRET?.trim();
  const emissor = issuer || (url && realm ? `${url}/realms/${encodeURIComponent(realm)}` : '');
  if (!emissor || !clientId || !segredo) return null;
  const origem = config.origensPermitidas[0]?.replace(/\/+$/, '');
  const redirect = env.KEYCLOAK_REDIRECT_URI?.trim() || (origem ? `${origem}${CAMINHOS_RETORNO[0]}` : '');
  if (!redirect) return null;
  return { base: `${emissor}/protocol/openid-connect`, clientId, segredo, redirect };
}

const b64 = (b: Buffer) => b.toString('base64url');
const VALE_MS = 10 * 60_000;

export async function rotasKeycloak(app: FastifyInstance, { db, producao }: { db: Banco; producao: boolean }) {
  const pendentes = new Map<string, { verificador: string; expira: number }>(); // state -> PKCE (10 min, uso único)
  const limpar = () => { const t = Date.now(); for (const [k, v] of pendentes) if (v.expira < t) pendentes.delete(k); };
  const falha = (resp: FastifyReply, motivo: string) => resp.redirect(`/login?sso=${motivo}`);

  app.get('/api/auth/keycloak/ativo', async () => ({ ativo: lerCfg() !== null }));

  app.get('/api/auth/keycloak/entrar', async (_req, resp) => {
    const cfg = lerCfg();
    if (!cfg) return falha(resp, 'desligado');
    limpar();
    if (pendentes.size > 1000) return falha(resp, 'erro');
    const state = b64(randomBytes(24)), verificador = b64(randomBytes(48));
    pendentes.set(state, { verificador, expira: Date.now() + VALE_MS });
    const q = new URLSearchParams({
      client_id: cfg.clientId, response_type: 'code', scope: 'openid email profile', redirect_uri: cfg.redirect, state,
      code_challenge: b64(createHash('sha256').update(verificador).digest()), code_challenge_method: 'S256',
    });
    return resp.redirect(`${cfg.base}/auth?${q}`);
  });

  const retorno = async (req: FastifyRequest, resp: FastifyReply) => {
    const cfg = lerCfg();
    if (!cfg) return falha(resp, 'desligado');
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    const pend = state ? pendentes.get(state) : undefined;
    if (state) pendentes.delete(state); // cada state vale uma vez
    if (error || !code || !pend || pend.expira < Date.now()) {
      auditar(db, null, 'sso_falhou', { motivo: error ? 'recusado_no_keycloak' : 'estado_invalido', ip: req.ip });
      return falha(resp, 'erro');
    }
    let email = '', verificado: boolean | undefined;
    try {
      const t = await fetch(`${cfg.base}/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirect, client_id: cfg.clientId, client_secret: cfg.segredo, code_verifier: pend.verificador }),
      });
      const tj = await t.json() as { access_token?: string };
      if (!t.ok || !tj.access_token) throw new Error(`token ${t.status}`);
      const u = await fetch(`${cfg.base}/userinfo`, { headers: { Authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(10_000) });
      const uj = await u.json() as { email?: string; email_verified?: boolean };
      if (!u.ok) throw new Error(`userinfo ${u.status}`);
      email = String(uj.email ?? '').trim().toLowerCase(); verificado = uj.email_verified;
    } catch (e) {
      app.log.error(e);
      auditar(db, null, 'sso_falhou', { motivo: 'troca_de_codigo', ip: req.ip });
      return falha(resp, 'erro');
    }
    if (!email || verificado === false) { auditar(db, null, 'sso_recusado', { motivo: 'sem_email_verificado' }); return falha(resp, 'sem_conta'); }
    const achados = db.prepare('SELECT id, ativo FROM usuarios WHERE lower(email) = ?').all(email) as { id: number; ativo: number }[];
    if (achados.length !== 1) { auditar(db, null, 'sso_recusado', { email, motivo: achados.length ? 'email_repetido' : 'sem_cadastro' }); return falha(resp, 'sem_conta'); }
    if (achados[0].ativo !== 1) { auditar(db, achados[0].id, 'sso_recusado', { motivo: 'inativo' }); return falha(resp, 'inativo'); }
    const id = achados[0].id;
    db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(new Date().toISOString(), id);
    resp.setCookie(COOKIE_SESSAO, criarSessao(db, id, false), { httpOnly: true, sameSite: 'lax', secure: producao, path: '/', maxAge: horasDaSessao(false) * 3600 });
    auditar(db, id, 'login_sso');
    registrarUso(db, id, 'login', req.headers['user-agent']);
    return resp.redirect('/');
  };
  for (const c of CAMINHOS_RETORNO) app.get(c, retorno);
}
