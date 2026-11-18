// Login único pelo Keycloak (OpenID Connect, fluxo "authorization code" com PKCE). Complementa o login local, que continua valendo.
// O servidor troca o código por um token e lê o e-mail em /userinfo (chamada direta ao Keycloak, por HTTPS); a pessoa só entra se o
// e-mail corporativo dela estiver em um usuário ATIVO do portal. Quem é do realm e ainda não tem cadastro é CRIADO na hora com o perfil
// padrão (consulta, só leitura; KEYCLOAK_PERFIL_PADRAO), sem senha local; o administrador vincula depois, à mão, os papéis de quem precisa
// de mais acesso. KEYCLOAK_CRIAR_USUARIOS=0 volta ao modo "só quem já está cadastrado".
// Variáveis: KEYCLOAK_ISSUER_URL (ou KEYCLOAK_URL + KEYCLOAK_REALM), KEYCLOAK_CLIENT_ID,
// KEYCLOAK_CLIENT_SECRET e, opcional, KEYCLOAK_REDIRECT_URI (padrão: <ORIGENS_PERMITIDAS[0]>/api/v1/admin/auth/callback, o endereço
// que a TI cadastrou no cliente). Sem elas, o login por Keycloak fica desligado.
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { config } from '../../../servidor/src/config.ts';
import { hashSenha } from '../../acessos/api/senha.ts';
import { perfilExiste } from '../../acessos/api/permissoes.ts';
import { auditar, COOKIE_SESSAO, criarSessao, exigirPerm, horasDaSessao } from '../../acessos/api/guard.ts';
import { registrarUso } from '../../uso/api/registro.ts';

export const CAMINHOS_RETORNO = ['/api/v1/admin/auth/callback', '/api/v1/auth/callback'];

interface Cfg { base: string; clientId: string; segredo: string; redirect: string; /** …/admin/realms/<realm> (API de administração, para listar as pessoas do realm) */ admin: string }
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
  return { base: `${emissor}/protocol/openid-connect`, clientId, segredo, redirect, admin: emissor.replace(/\/realms\/([^/]+)$/, '/admin/realms/$1') };
}

/** Login livre a partir do e-mail (letras minúsculas, números, ponto, hífen e sublinhado; 3 a 32 caracteres). */
function loginLivre(db: Banco, sugestao: string): string {
  let base = sugestao.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]+/g, '.').replace(/^[._-]+|[._-]+$/g, '').slice(0, 28);
  if (base.length < 3) base = `${base}usuario`.slice(0, 28);
  let login = base, n = 2;
  while (db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get(login)) login = `${base}${n++}`;
  return login;
}

/** Pessoa do realm do Keycloak, no formato que a tela de Usuários usa. */
export interface PessoaKeycloak { id: string; nome: string; login: string; email: string; ativo: boolean; /** Setor/departamento, se algum atributo conhecido do usuário no Keycloak o traz. */ departamento: string; /** Nome do atributo de onde veio o departamento (ou vazio). */ departamento_campo: string; /** Caminhos dos grupos do Keycloak a que a pessoa pertence (ex.: /Lojas/Goiânia). */ grupos: string[]; /** Todos os atributos do usuário (primeiro valor de cada), para a tela mostrar o que existe. */ atributos: Record<string, string> }

/** Atributos comuns de setor em Keycloak/AD/LDAP, em ordem de preferência (KEYCLOAK_ATRIBUTO_DEPARTAMENTO força um nome). */
const ATRIBUTOS_DEPARTAMENTO = ['department', 'departamento', 'setor', 'sector', 'departmentnumber', 'ou', 'organizationalunit', 'area', 'área', 'lotacao', 'lotação', 'unidade', 'division', 'divisao', 'company', 'empresa', 'physicaldeliveryofficename'];
export function departamentoDe(atributos: Record<string, string>, forcado = ''): { valor: string; campo: string } {
  const chaves = Object.keys(atributos);
  const ordem = forcado ? [forcado.toLowerCase(), ...ATRIBUTOS_DEPARTAMENTO] : ATRIBUTOS_DEPARTAMENTO;
  for (const nome of ordem) {
    const k = chaves.find((c) => c.toLowerCase() === nome && atributos[c]);
    if (k) return { valor: atributos[k], campo: k };
  }
  return { valor: '', campo: '' };
}

/** Lê todas as pessoas do realm pela API de administração do Keycloak (somente leitura), com a conta de serviço do cliente do portal.
 *  KEYCLOAK_ADMIN_CLIENT_ID / KEYCLOAK_ADMIN_CLIENT_SECRET usam outro cliente só para isso; sem elas vale o cliente do login. */
async function tokenAdmin(env: NodeJS.ProcessEnv): Promise<{ cfg: NonNullable<ReturnType<typeof lerCfg>>; token: string }> {
  const cfg = lerCfg(env);
  if (!cfg) throw new ErroKeycloak(503, 'O Keycloak não está configurado neste ambiente.');
  const id = env.KEYCLOAK_ADMIN_CLIENT_ID?.trim() || cfg.clientId, segredo = env.KEYCLOAK_ADMIN_CLIENT_SECRET?.trim() || cfg.segredo;
  const t = await fetch(`${cfg.base}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000), body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: segredo }) })
    .catch((e: Error) => { throw new ErroKeycloak(502, `Não foi possível falar com o Keycloak (${e.message}).`); });
  const tj = await t.json().catch(() => ({})) as { access_token?: string; error?: string };
  if (!t.ok || !tj.access_token) throw new ErroKeycloak(502, `O Keycloak recusou a conta de serviço do portal (HTTP ${t.status}${tj.error ? `, ${tj.error}` : ''}). Peça à TI para ligar "Service accounts" no cliente ${id} e dar à conta de serviço o papel view-users do realm-management (ou informe KEYCLOAK_ADMIN_CLIENT_ID e KEYCLOAK_ADMIN_CLIENT_SECRET).`);
  return { cfg, token: tj.access_token };
}

export async function listarPessoasKeycloak(env: NodeJS.ProcessEnv = process.env): Promise<PessoaKeycloak[]> {
  const { cfg, token } = await tokenAdmin(env);
  const tj = { access_token: token };
  const lista: PessoaKeycloak[] = [];
  const TAM = 200;
  for (let primeiro = 0; primeiro < 10_000; primeiro += TAM) {
    const r = await fetch(`${cfg.admin}/users?first=${primeiro}&max=${TAM}&briefRepresentation=false`, { headers: { Authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(15_000) })
      .catch((e: Error) => { throw new ErroKeycloak(502, `Não foi possível ler os usuários do Keycloak (${e.message}).`); });
    if (r.status === 401 || r.status === 403) throw new ErroKeycloak(502, 'A conta de serviço do portal não pode listar os usuários do Keycloak. Peça à TI o papel view-users (realm-management) para ela.');
    if (!r.ok) throw new ErroKeycloak(502, `O Keycloak respondeu com erro ao listar os usuários (HTTP ${r.status}).`);
    const pagina = await r.json() as { id: string; username?: string; firstName?: string; lastName?: string; email?: string; enabled?: boolean; attributes?: Record<string, string[] | string> }[];
    for (const u of pagina) {
      const nome = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().replace(/\s+/g, ' ');
      const atributos: Record<string, string> = {};
      for (const [k, v] of Object.entries(u.attributes ?? {})) { const x = String(Array.isArray(v) ? v[0] ?? '' : v ?? '').trim(); if (x) atributos[k] = x.slice(0, 200); }
      const dep = departamentoDe(atributos, env.KEYCLOAK_ATRIBUTO_DEPARTAMENTO?.trim());
      lista.push({ id: u.id, nome: nome || u.username || '', login: String(u.username ?? ''), email: String(u.email ?? '').trim().toLowerCase(), ativo: u.enabled !== false, departamento: dep.valor.slice(0, 80), departamento_campo: dep.campo, grupos: [], atributos });
    }
    if (pagina.length < TAM) break;
  }
  await anexarGrupos(cfg.admin, tj.access_token, lista);
  return lista;
}

/** Lê a árvore de grupos e os membros de cada um (somente leitura) e preenche `grupos`; sem atributo de setor, o grupo vira o departamento.
 *  Falha em silêncio (a lista de pessoas continua valendo) se a conta de serviço não puder ler grupos. Limites: 600 grupos. */
interface GrupoKc { id: string; name: string; path: string; subGroupCount?: number; subGroups?: GrupoKc[] }
const lerKc = async <T>(token: string, url: string): Promise<T | null> => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return r && r.ok ? await r.json() as T : null;
};
/** Todos os grupos do realm (árvore achatada, até 600). Vazio se a conta de serviço não puder ler grupos. */
async function arvoreGrupos(admin: string, token: string): Promise<GrupoKc[]> {
  const grupos: GrupoKc[] = [];
  const fila: GrupoKc[] = (await lerKc<GrupoKc[]>(token, `${admin}/groups?first=0&max=500&briefRepresentation=true`)) ?? [];
  while (fila.length && grupos.length < 600) {
    const g = fila.shift()!;
    grupos.push(g);
    const filhos = g.subGroups?.length ? g.subGroups : (g.subGroupCount ?? 0) > 0 ? ((await lerKc<GrupoKc[]>(token, `${admin}/groups/${g.id}/children?first=0&max=500`)) ?? []) : [];
    fila.push(...filhos);
  }
  return grupos;
}
/** Departamentos que o Keycloak conhece: nomes dos grupos (último nível do caminho), sem repetir. */
export async function listarDepartamentosKeycloak(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const { cfg, token } = await tokenAdmin(env);
  const nomes = new Map<string, string>();
  for (const g of await arvoreGrupos(cfg.admin, token)) { const n = (g.name || g.path.split('/').filter(Boolean).pop() || '').trim(); if (n) nomes.set(n.toLocaleLowerCase('pt-BR'), n.slice(0, 60)); }
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function anexarGrupos(admin: string, token: string, lista: PessoaKeycloak[]) {
  const ler = <T>(url: string) => lerKc<T>(token, url);
  const grupos = await arvoreGrupos(admin, token);
  const porId = new Map(lista.map((p) => [p.id, p]));
  for (const g of grupos) {
    for (let primeiro = 0; primeiro < 10_000; primeiro += 200) {
      const m = await ler<{ id: string }[]>(`${admin}/groups/${g.id}/members?first=${primeiro}&max=200&briefRepresentation=true`);
      if (!m) break;
      for (const u of m) porId.get(u.id)?.grupos.push(g.path || `/${g.name}`);
      if (m.length < 200) break;
    }
  }
  for (const p of lista) if (!p.departamento && p.grupos.length) { p.departamento = p.grupos.map((c) => c.split('/').filter(Boolean).pop() ?? c).join(', ').slice(0, 80); p.departamento_campo = 'grupo'; }
}
export class ErroKeycloak extends Error {
  status: number;
  constructor(status: number, mensagem: string) { super(mensagem); this.status = status; }
}

const b64 = (b: Buffer) => b.toString('base64url');
const VALE_MS = 10 * 60_000;

export async function rotasKeycloak(app: FastifyInstance, { db, producao }: { db: Banco; producao: boolean }) {
  const pendentes = new Map<string, { verificador: string; expira: number }>(); // state -> PKCE (10 min, uso único)
  const limpar = () => { const t = Date.now(); for (const [k, v] of pendentes) if (v.expira < t) pendentes.delete(k); };
  // Com MODO_DEBUG=1 o motivo técnico também vai na tela de entrada (parâmetro `detalhe`); a auditoria sempre o guarda (sem segredos).
  const falha = (resp: FastifyReply, motivo: string, detalhe?: string) => resp.redirect(`/login?sso=${motivo}${config.modoDebug && detalhe ? `&detalhe=${encodeURIComponent(detalhe.slice(0, 300))}` : ''}`);

  app.get('/api/auth/keycloak/ativo', async () => ({ ativo: lerCfg() !== null }));

  // Departamentos do Keycloak (grupos) para o campo Departamento do cadastro de usuário; cache de 10 min; sem Keycloak ou sem permissão devolve lista vazia com aviso.
  let cacheDeps: { ate: number; itens: string[]; aviso: string } | null = null;
  app.get('/api/gestao/departamentos-keycloak', { preHandler: exigirPerm('cfg.usuarios.criar', 'cfg.usuarios.editar') }, async () => {
    if (!cacheDeps || cacheDeps.ate < Date.now()) {
      try { const itens = await listarDepartamentosKeycloak(); cacheDeps = { ate: Date.now() + 600_000, itens, aviso: itens.length ? '' : 'O Keycloak não devolveu grupos (a conta de serviço pode não ter permissão de leitura de grupos).' }; }
      catch (e) { if (!(e instanceof ErroKeycloak)) throw e; cacheDeps = { ate: Date.now() + 60_000, itens: [], aviso: e.message }; }
    }
    return { itens: cacheDeps.itens, aviso: cacheDeps.aviso };
  });

  // Configurações › Usuários › "Sem cadastro": pessoas do Keycloak que ainda não têm usuário no portal (casa pelo e-mail ou pelo login).
  let cache: { ate: number; itens: PessoaKeycloak[] } | null = null;
  app.get<{ Querystring: { atualizar?: string } }>('/api/gestao/usuarios/keycloak', { preHandler: exigirPerm('cfg.usuarios.criar') }, async (req, resp) => {
    try {
      if (!cache || cache.ate < Date.now() || req.query.atualizar === '1') cache = { ate: Date.now() + 120_000, itens: await listarPessoasKeycloak() };
    } catch (e) {
      if (e instanceof ErroKeycloak) return resp.code(e.status).send({ erro: e.message });
      throw e;
    }
    const emails = new Set((db.prepare("SELECT lower(email) AS e FROM usuarios WHERE email IS NOT NULL AND email <> ''").all() as { e: string }[]).map((x) => x.e));
    const logins = new Set((db.prepare('SELECT lower(login) AS l FROM usuarios').all() as { l: string }[]).map((x) => x.l));
    const itens = cache.itens.filter((p) => !(p.email && emails.has(p.email)) && !(p.login && logins.has(p.login.toLowerCase())));
    return { total: cache.itens.length, cadastrados: cache.itens.length - itens.length, itens };
  });

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
    const { code, state, error, error_description: descricao } = req.query as { code?: string; state?: string; error?: string; error_description?: string };
    const pend = state ? pendentes.get(state) : undefined;
    if (state) pendentes.delete(state); // cada state vale uma vez
    if (error || !code || !pend || pend.expira < Date.now()) {
      const detalhe = error ? `Keycloak recusou: ${error}${descricao ? ` (${descricao})` : ''}` : !code ? 'faltou o código na volta' : !pend ? 'estado desconhecido ou já usado (sessão de login perdida)' : 'estado expirado';
      auditar(db, null, 'sso_falhou', { motivo: error ? 'recusado_no_keycloak' : 'estado_invalido', detalhe, ip: req.ip });
      return falha(resp, 'erro', detalhe);
    }
    let email = '', verificado: boolean | undefined, nomeKc = '', usuarioKc = '';
    try {
      const t = await fetch(`${cfg.base}/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirect, client_id: cfg.clientId, client_secret: cfg.segredo, code_verifier: pend.verificador }),
      });
      const tj = await t.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };
      if (!t.ok || !tj.access_token) throw new Error(`troca do código recusada (HTTP ${t.status}${tj.error ? `, ${tj.error}` : ''}${tj.error_description ? `: ${tj.error_description}` : ''}); endereço de retorno usado: ${cfg.redirect}`);
      const u = await fetch(`${cfg.base}/userinfo`, { headers: { Authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(10_000) });
      const uj = await u.json() as { email?: string; email_verified?: boolean; name?: string; given_name?: string; family_name?: string; preferred_username?: string };
      if (!u.ok) throw new Error(`consulta do usuário recusada (HTTP ${u.status})`);
      email = String(uj.email ?? '').trim().toLowerCase(); verificado = uj.email_verified;
      nomeKc = String(uj.name ?? `${uj.given_name ?? ''} ${uj.family_name ?? ''}`).trim().replace(/\s+/g, ' ').slice(0, 80);
      usuarioKc = String(uj.preferred_username ?? '').trim();
    } catch (e) {
      app.log.error(e);
      const detalhe = (e as Error).message;
      auditar(db, null, 'sso_falhou', { motivo: 'troca_de_codigo', detalhe, ip: req.ip });
      return falha(resp, 'erro', detalhe);
    }
    if (!email || verificado === false) { auditar(db, null, 'sso_recusado', { motivo: 'sem_email_verificado' }); return falha(resp, 'sem_conta'); }
    const achados = db.prepare('SELECT id, ativo FROM usuarios WHERE lower(email) = ?').all(email) as { id: number; ativo: number }[];
    if (achados.length > 1) { auditar(db, null, 'sso_recusado', { email, motivo: 'email_repetido' }); return falha(resp, 'sem_conta'); }
    if (achados.length === 0) {
      // Pessoa do realm ainda sem cadastro: entra como consulta (ou o perfil padrão definido); papéis maiores o administrador vincula depois.
      if (process.env.KEYCLOAK_CRIAR_USUARIOS === '0') { auditar(db, null, 'sso_recusado', { email, motivo: 'sem_cadastro' }); return falha(resp, 'sem_conta'); }
      const pedido = process.env.KEYCLOAK_PERFIL_PADRAO?.trim() || 'consulta';
      const perfil = pedido !== 'admin' && perfilExiste(db, pedido) ? pedido : 'consulta';
      const login = loginLivre(db, usuarioKc.includes('@') || !usuarioKc ? email.split('@')[0] : usuarioKc);
      const nome = nomeKc.length >= 2 ? nomeKc : login;
      const agora = new Date().toISOString();
      // Sem senha local utilizável: a pessoa entra só pelo Keycloak (o administrador pode definir uma senha depois, se quiser).
      const r = db.prepare('INSERT INTO usuarios (login, nome, email, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, ?, 0, ?)').run(login, nome, email, hashSenha(randomBytes(24).toString('base64url')), perfil, agora);
      achados.push({ id: Number(r.lastInsertRowid), ativo: 1 });
      auditar(db, achados[0].id, 'usuario_criado_sso', { login, email, perfil });
    }
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
