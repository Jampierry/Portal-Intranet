import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { config } from '../../../servidor/src/config.ts';
import { corpoObjeto, escolha, inteiro, texto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { confereSenha, hashSenha } from './senha.ts';
import { auditar, COOKIE_SESSAO, criarSessao, encerrarSessao, exigirPerm, HORAS_SESSAO, PERFIS, usuarioDaSessao } from './guard.ts';
import { CATALOGO, lerAjustes, NOME_PERFIL, permissoesDoPerfil, permissoesEfetivas, PERFIS_EDITAVEIS, TODAS, validarAjustes, validarLista } from './permissoes.ts';

const ROTAS_PUBLICAS = new Set(['/api/saude', '/api/login']);
const ROTAS_COM_SENHA_PENDENTE = new Set(['/api/eu', '/api/sair', '/api/eu/senha']);
const MAX_FALHAS = 5;
const JANELA_MIN = 15;
const SENHA_MIN = 8;
// Hash de mentira: login inexistente gasta o mesmo tempo que um existente (não revela quais logins existem).
const HASH_FALSO = hashSenha('senha-que-nunca-sera-usada');

const DTO = 'id, login, nome, perfil, ativo, trocar_senha, criado_em, ultimo_acesso, permissoes';

/** Usuário para a tela de administração: ajustes viram objeto e vêm também as permissões que valem de fato. */
function paraTela(db: Banco, u: Record<string, unknown>) {
  const ajustes = lerAjustes(u.permissoes as string | null);
  return { ...u, permissoes: ajustes, efetivas: permissoesEfetivas(db, String(u.perfil), u.permissoes as string | null) };
}
function ajustesDoCorpo(c: Record<string, unknown>) {
  try { return validarAjustes(c.permissoes); } catch (e) { throw new ErroValidacao((e as Error).message); }
}

function validarSenhaNova(s: string, login?: string) {
  if (s.length < SENHA_MIN) throw new ErroValidacao(`Senha: mínimo de ${SENHA_MIN} caracteres.`);
  if (s.length > 128) throw new ErroValidacao('Senha: máximo de 128 caracteres.');
  if (login && s.toLowerCase() === login.toLowerCase()) throw new ErroValidacao('Senha: não use o próprio login.');
  if (/^(.)\1+$/.test(s)) throw new ErroValidacao('Senha: muito simples.');
}

export async function rotasAcessos(app: FastifyInstance, { db, producao }: { db: Banco; producao: boolean }) {
  app.decorateRequest('usuario', null);

  // Erros de validação viram 400 com mensagem clara; o resto vira 500 sem detalhes.
  app.setErrorHandler((erro, _req, resp) => {
    if (erro instanceof ErroValidacao) return resp.code(400).send({ erro: erro.message });
    const status = (erro as { statusCode?: number }).statusCode;
    if (status && status < 500) return resp.code(status).send({ erro: 'Requisição inválida.' });
    app.log.error(erro);
    return resp.code(500).send({ erro: 'Erro interno. Tente novamente.' });
  });

  // Proteção global: tudo em /api exige sessão, exceto saúde e login.
  app.addHook('onRequest', async (req, resp) => {
    const caminho = req.url.split('?')[0];
    if (!caminho.startsWith('/api/')) return;
    // Defesa extra contra CSRF: requisição que muda dados precisa vir da mesma origem.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origem = req.headers.origin;
      const mesmoSite = origem !== undefined && new URL(origem).host === req.headers.host;
      if (origem && !mesmoSite && !config.origensPermitidas.includes(origem)) return resp.code(403).send({ erro: 'Origem não permitida.' });
    }
    req.usuario = usuarioDaSessao(db, req.cookies[COOKIE_SESSAO]);
    if (ROTAS_PUBLICAS.has(caminho)) return;
    if (!req.usuario) return resp.code(401).send({ erro: 'Faça login para continuar.' });
    if (req.usuario.trocar_senha && !ROTAS_COM_SENHA_PENDENTE.has(caminho)) {
      return resp.code(403).send({ erro: 'Troque a senha provisória para continuar.', codigo: 'trocar_senha' });
    }
  });

  app.post('/api/login', async (req, resp) => {
    const c = corpoObjeto(req.body);
    const login = String(texto(c, 'login', 'Login', { max: 64 })).toLowerCase();
    const senha = String(texto(c, 'senha', 'Senha', { max: 128 }));
    const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
    const { n } = db.prepare('SELECT COUNT(*) n FROM tentativas_login WHERE chave = ? AND quando > ?').get(login, desde) as { n: number };
    if (n >= MAX_FALHAS) {
      auditar(db, null, 'login_bloqueado', { login });
      return resp.code(429).send({ erro: `Muitas tentativas. Aguarde ${JANELA_MIN} minutos e tente de novo.` });
    }
    const u = db.prepare('SELECT id, login, nome, perfil, senha_hash, trocar_senha, ativo, permissoes FROM usuarios WHERE login = ?').get(login) as
      | { id: number; login: string; nome: string; perfil: string; senha_hash: string; trocar_senha: number; ativo: number; permissoes: string | null } | undefined;
    const ok = confereSenha(senha, u?.senha_hash ?? HASH_FALSO) && !!u && u.ativo === 1;
    if (!ok || !u) {
      db.prepare('INSERT INTO tentativas_login (chave, quando) VALUES (?, ?)').run(login, new Date().toISOString());
      auditar(db, u?.id ?? null, 'login_falhou', { login });
      return resp.code(401).send({ erro: 'Login ou senha inválidos.' });
    }
    db.prepare('DELETE FROM tentativas_login WHERE chave = ?').run(login);
    db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(new Date().toISOString(), u.id);
    const token = criarSessao(db, u.id);
    resp.setCookie(COOKIE_SESSAO, token, { httpOnly: true, sameSite: 'lax', secure: producao, path: '/', maxAge: HORAS_SESSAO * 3600 });
    auditar(db, u.id, 'login');
    return { id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, trocar_senha: u.trocar_senha, permissoes: permissoesEfetivas(db, u.perfil, u.permissoes) };
  });

  app.post('/api/sair', async (req, resp) => {
    encerrarSessao(db, req.cookies[COOKIE_SESSAO]);
    resp.clearCookie(COOKIE_SESSAO, { path: '/' });
    if (req.usuario) auditar(db, req.usuario.id, 'sair');
    return { ok: true };
  });

  app.get('/api/eu', async (req) => req.usuario);

  app.post('/api/eu/senha', async (req, resp) => {
    const c = corpoObjeto(req.body);
    const atual = String(texto(c, 'atual', 'Senha atual', { max: 128 }));
    const nova = String(texto(c, 'nova', 'Nova senha', { max: 128 }));
    const u = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(req.usuario!.id) as { senha_hash: string };
    if (!confereSenha(atual, u.senha_hash)) return resp.code(400).send({ erro: 'Senha atual incorreta.' });
    validarSenhaNova(nova, req.usuario!.login);
    if (nova === atual) return resp.code(400).send({ erro: 'A nova senha precisa ser diferente da atual.' });
    db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?').run(hashSenha(nova), req.usuario!.id);
    // Encerra as outras sessões deste usuário (mantém a atual).
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(req.usuario!.id);
    resp.setCookie(COOKIE_SESSAO, criarSessao(db, req.usuario!.id), { httpOnly: true, sameSite: 'lax', secure: producao, path: '/', maxAge: HORAS_SESSAO * 3600 });
    auditar(db, req.usuario!.id, 'senha_trocada');
    return { ok: true };
  });

  // ----- Administração de usuários e perfis: abas de Configurações liberadas por permissão (cfg.*) -----
  const aUsuarios = { preHandler: exigirPerm('cfg.usuarios') };
  const aPerfis = { preHandler: exigirPerm('cfg.perfis') };
  const aAmbos = { preHandler: exigirPerm('cfg.usuarios', 'cfg.perfis') };
  const aAuditoria = { preHandler: exigirPerm('cfg.auditoria') };
  // Quem não é administrador nunca mexe em administradores nem concede mais do que ele mesmo tem (sem escalar privilégio).
  const ehAdmin = (req: FastifyRequest) => req.usuario!.perfil === 'admin';
  const excede = (req: FastifyRequest, chaves: string[]) => !ehAdmin(req) && chaves.some((c) => !req.usuario!.permissoes.includes(c));
  const NEGADO = { erro: 'Você não pode conceder mais acesso do que o seu, nem alterar administradores.' };

  app.get('/api/usuarios', aUsuarios, async (req) => (db.prepare(`SELECT ${DTO} FROM usuarios ORDER BY nome`).all() as Record<string, unknown>[]).filter((u) => ehAdmin(req) || u.perfil !== 'admin').map((u) => paraTela(db, u)));

  app.post('/api/usuarios', aUsuarios, async (req, resp) => {
    const c = corpoObjeto(req.body);
    const login = String(texto(c, 'login', 'Login', { min: 3, max: 32 })).toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(login)) throw new ErroValidacao('Login: use só letras minúsculas, números, ponto, hífen e sublinhado.');
    const nome = String(texto(c, 'nome', 'Nome', { min: 2, max: 80 }));
    const perfil = escolha(c, 'perfil', 'Perfil', PERFIS, 'consulta');
    const senha = String(texto(c, 'senha', 'Senha provisória', { max: 128 }));
    validarSenhaNova(senha, login);
    if (db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get(login)) return resp.code(409).send({ erro: 'Já existe um usuário com esse login.' });
    const ajustes = ajustesDoCorpo(c);
    if ((!ehAdmin(req) && perfil === 'admin') || excede(req, Object.keys(ajustes).filter((k) => ajustes[k]))) return resp.code(403).send(NEGADO);
    const r = db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em, permissoes) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .run(login, nome, hashSenha(senha), perfil, new Date().toISOString(), Object.keys(ajustes).length ? JSON.stringify(ajustes) : null);
    auditar(db, req.usuario!.id, 'usuario_criado', { id: Number(r.lastInsertRowid), login, perfil, ajustes });
    return resp.code(201).send(paraTela(db, db.prepare(`SELECT ${DTO} FROM usuarios WHERE id = ?`).get(Number(r.lastInsertRowid)) as Record<string, unknown>));
  });

  app.put<{ Params: { id: string } }>('/api/usuarios/:id', aUsuarios, async (req, resp) => {
    const id = inteiro(req.params.id, 'Usuário');
    const atual = db.prepare('SELECT id, nome, perfil, ativo, permissoes FROM usuarios WHERE id = ?').get(id) as { id: number; nome: string; perfil: string; ativo: number; permissoes: string | null } | undefined;
    if (!atual) return resp.code(404).send({ erro: 'Usuário não encontrado.' });
    const c = corpoObjeto(req.body);
    const nome = c.nome === undefined ? atual.nome : String(texto(c, 'nome', 'Nome', { min: 2, max: 80 }));
    const perfil = c.perfil === undefined ? atual.perfil : escolha(c, 'perfil', 'Perfil', PERFIS);
    const ativo = c.ativo === undefined ? atual.ativo : c.ativo ? 1 : 0;
    const deixaDeSerAdminAtivo = atual.perfil === 'admin' && atual.ativo === 1 && (perfil !== 'admin' || ativo === 0);
    if (deixaDeSerAdminAtivo) {
      if (id === req.usuario!.id) return resp.code(400).send({ erro: 'Você não pode tirar o próprio acesso de administrador.' });
      const { n } = db.prepare("SELECT COUNT(*) n FROM usuarios WHERE perfil = 'admin' AND ativo = 1").get() as { n: number };
      if (n <= 1) return resp.code(400).send({ erro: 'É preciso manter pelo menos um administrador ativo.' });
    }
    const ajustes = c.permissoes === undefined ? lerAjustes(atual.permissoes) : ajustesDoCorpo(c);
    if (!ehAdmin(req)) {
      const antes = lerAjustes(atual.permissoes);
      const novas = Object.keys(ajustes).filter((k) => ajustes[k] && !antes[k]);
      if (id === req.usuario!.id || atual.perfil === 'admin' || perfil === 'admin' || excede(req, novas)) return resp.code(403).send(NEGADO);
    }
    const ajustesJson = Object.keys(ajustes).length ? JSON.stringify(ajustes) : null;
    db.prepare('UPDATE usuarios SET nome = ?, perfil = ?, ativo = ?, permissoes = ? WHERE id = ?').run(nome, perfil, ativo, ajustesJson, id);
    if (ativo === 0 || perfil !== atual.perfil) db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    auditar(db, req.usuario!.id, 'usuario_alterado', { id, perfil, ativo, ajustes });
    return paraTela(db, db.prepare(`SELECT ${DTO} FROM usuarios WHERE id = ?`).get(id) as Record<string, unknown>);
  });

  app.post<{ Params: { id: string } }>('/api/usuarios/:id/senha', aUsuarios, async (req, resp) => {
    const id = inteiro(req.params.id, 'Usuário');
    const u = db.prepare('SELECT login, perfil FROM usuarios WHERE id = ?').get(id) as { login: string; perfil: string } | undefined;
    if (!u) return resp.code(404).send({ erro: 'Usuário não encontrado.' });
    if (!ehAdmin(req) && u.perfil === 'admin') return resp.code(403).send(NEGADO);
    const senha = String(texto(corpoObjeto(req.body), 'senha', 'Senha provisória', { max: 128 }));
    validarSenhaNova(senha, u.login);
    db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 1 WHERE id = ?').run(hashSenha(senha), id);
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    db.prepare('DELETE FROM tentativas_login WHERE chave = ?').run(u.login);
    auditar(db, req.usuario!.id, 'senha_redefinida', { id });
    return { ok: true };
  });

  // ----- Perfis: o administrador escolhe o que cada perfil pode fazer e quais telas acessa -----
  app.get('/api/perfis', aAmbos, async () => ({
    catalogo: CATALOGO,
    perfis: ['admin', ...PERFIS_EDITAVEIS].map((codigo) => ({ codigo, nome: NOME_PERFIL[codigo], fixo: codigo === 'admin', permissoes: permissoesDoPerfil(db, codigo) })),
  }));

  app.put<{ Params: { codigo: string } }>('/api/perfis/:codigo', aPerfis, async (req, resp) => {
    const codigo = req.params.codigo;
    if (codigo === 'admin') return resp.code(400).send({ erro: 'O administrador sempre tem todas as permissões.' });
    if (!(PERFIS_EDITAVEIS as readonly string[]).includes(codigo)) return resp.code(404).send({ erro: 'Perfil não encontrado.' });
    let lista: string[];
    try { lista = validarLista(corpoObjeto(req.body).permissoes); } catch (e) { throw new ErroValidacao((e as Error).message); }
    const antes = new Set(permissoesDoPerfil(db, codigo));
    if (excede(req, lista.filter((c) => !antes.has(c)))) return resp.code(403).send(NEGADO);
    db.prepare('INSERT INTO perfis_permissoes (perfil, permissoes, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(perfil) DO UPDATE SET permissoes = excluded.permissoes, atualizado_em = excluded.atualizado_em')
      .run(codigo, JSON.stringify(lista), new Date().toISOString());
    auditar(db, req.usuario!.id, 'perfil_alterado', { perfil: codigo, permissoes: lista.length, de: TODAS.length });
    return { codigo, permissoes: lista };
  });

  app.get('/api/auditoria', aAuditoria, async () =>
    db
      .prepare(
        `SELECT a.id, a.quando, a.acao, a.detalhe, u.nome AS usuario FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
         ORDER BY a.id DESC LIMIT 200`,
      )
      .all(),
  );
}
