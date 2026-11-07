import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { config } from '../../../servidor/src/config.ts';
import { corpoObjeto, escolha, inteiro, texto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { confereSenha, hashSenha } from './senha.ts';
import { auditar, COOKIE_SESSAO, criarSessao, encerrarSessao, exigir, HORAS_SESSAO, PERFIS, usuarioDaSessao } from './guard.ts';

const ROTAS_PUBLICAS = new Set(['/api/saude', '/api/login']);
const ROTAS_COM_SENHA_PENDENTE = new Set(['/api/eu', '/api/sair', '/api/eu/senha']);
const MAX_FALHAS = 5;
const JANELA_MIN = 15;
const SENHA_MIN = 8;
// Hash de mentira: login inexistente gasta o mesmo tempo que um existente (não revela quais logins existem).
const HASH_FALSO = hashSenha('senha-que-nunca-sera-usada');

const DTO = 'id, login, nome, perfil, ativo, trocar_senha, criado_em, ultimo_acesso';

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
    const u = db.prepare('SELECT id, login, nome, perfil, senha_hash, trocar_senha, ativo FROM usuarios WHERE login = ?').get(login) as
      | { id: number; login: string; nome: string; perfil: string; senha_hash: string; trocar_senha: number; ativo: number } | undefined;
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
    return { id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, trocar_senha: u.trocar_senha };
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

  // ----- Administração de usuários (somente admin master) -----
  const admin = { preHandler: exigir('admin') };

  app.get('/api/usuarios', admin, async () => db.prepare(`SELECT ${DTO} FROM usuarios ORDER BY nome`).all());

  app.post('/api/usuarios', admin, async (req, resp) => {
    const c = corpoObjeto(req.body);
    const login = String(texto(c, 'login', 'Login', { min: 3, max: 32 })).toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(login)) throw new ErroValidacao('Login: use só letras minúsculas, números, ponto, hífen e sublinhado.');
    const nome = String(texto(c, 'nome', 'Nome', { min: 2, max: 80 }));
    const perfil = escolha(c, 'perfil', 'Perfil', PERFIS, 'consulta');
    const senha = String(texto(c, 'senha', 'Senha provisória', { max: 128 }));
    validarSenhaNova(senha, login);
    if (db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get(login)) return resp.code(409).send({ erro: 'Já existe um usuário com esse login.' });
    const r = db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, 1, ?)')
      .run(login, nome, hashSenha(senha), perfil, new Date().toISOString());
    auditar(db, req.usuario!.id, 'usuario_criado', { id: Number(r.lastInsertRowid), login, perfil });
    return resp.code(201).send(db.prepare(`SELECT ${DTO} FROM usuarios WHERE id = ?`).get(Number(r.lastInsertRowid)));
  });

  app.put<{ Params: { id: string } }>('/api/usuarios/:id', admin, async (req, resp) => {
    const id = inteiro(req.params.id, 'Usuário');
    const atual = db.prepare('SELECT id, nome, perfil, ativo FROM usuarios WHERE id = ?').get(id) as { id: number; nome: string; perfil: string; ativo: number } | undefined;
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
    db.prepare('UPDATE usuarios SET nome = ?, perfil = ?, ativo = ? WHERE id = ?').run(nome, perfil, ativo, id);
    if (ativo === 0 || perfil !== atual.perfil) db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    auditar(db, req.usuario!.id, 'usuario_alterado', { id, perfil, ativo });
    return db.prepare(`SELECT ${DTO} FROM usuarios WHERE id = ?`).get(id);
  });

  app.post<{ Params: { id: string } }>('/api/usuarios/:id/senha', admin, async (req, resp) => {
    const id = inteiro(req.params.id, 'Usuário');
    const u = db.prepare('SELECT login FROM usuarios WHERE id = ?').get(id) as { login: string } | undefined;
    if (!u) return resp.code(404).send({ erro: 'Usuário não encontrado.' });
    const senha = String(texto(corpoObjeto(req.body), 'senha', 'Senha provisória', { max: 128 }));
    validarSenhaNova(senha, u.login);
    db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 1 WHERE id = ?').run(hashSenha(senha), id);
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
    db.prepare('DELETE FROM tentativas_login WHERE chave = ?').run(u.login);
    auditar(db, req.usuario!.id, 'senha_redefinida', { id });
    return { ok: true };
  });

  app.get('/api/auditoria', admin, async () =>
    db
      .prepare(
        `SELECT a.id, a.quando, a.acao, a.detalhe, u.nome AS usuario FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
         ORDER BY a.id DESC LIMIT 200`,
      )
      .all(),
  );
}
