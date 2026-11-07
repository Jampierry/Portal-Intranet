import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { permissoesEfetivas } from './permissoes.ts';

/** Código do perfil: 'admin', 'editor', 'consulta' (do sistema) ou 'p-nome' (personalizado). */
export type Perfil = string;

export interface UsuarioSessao { id: number; login: string; nome: string; perfil: Perfil; perfil_nome: string; trocar_senha: number; permissoes: string[] }

declare module 'fastify' {
  interface FastifyRequest { usuario: UsuarioSessao | null }
}

export const COOKIE_SESSAO = 'portal_sessao';
export const HORAS_SESSAO = 12;

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Cria a sessão e devolve o token (só o hash vai para o banco). */
export function criarSessao(db: Banco, usuarioId: number): string {
  const token = randomBytes(32).toString('base64url');
  const agora = new Date();
  db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agora.toISOString());
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, criada_em, expira_em) VALUES (?, ?, ?, ?)').run(
    hashToken(token), usuarioId, agora.toISOString(), new Date(agora.getTime() + HORAS_SESSAO * 3600_000).toISOString(),
  );
  return token;
}

export function usuarioDaSessao(db: Banco, token: string | undefined): UsuarioSessao | null {
  if (!token) return null;
  const u = db
    .prepare(
      `SELECT u.id, u.login, u.nome, u.perfil, (SELECT p.nome FROM perfis_permissoes p WHERE p.perfil = u.perfil) AS perfil_nome, u.trocar_senha, u.permissoes AS ajustes FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expira_em > ? AND u.ativo = 1`,
    )
    .get(hashToken(token), new Date().toISOString());
  if (!u) return null;
  const { ajustes, ...resto } = u as Omit<UsuarioSessao, 'permissoes' | 'perfil_nome'> & { perfil_nome: string | null; ajustes: string | null };
  return { ...resto, perfil_nome: resto.perfil_nome ?? resto.perfil, permissoes: permissoesEfetivas(db, resto.perfil, ajustes) };
}

export function encerrarSessao(db: Banco, token: string | undefined) {
  if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
}

/** Registro de auditoria (só inclusão). Nunca grave senhas nem tokens no detalhe. */
export function auditar(db: Banco, usuarioId: number | null, acao: string, detalhe?: Record<string, unknown>) {
  db.prepare('INSERT INTO auditoria (quando, usuario_id, acao, detalhe) VALUES (?, ?, ?, ?)').run(
    new Date().toISOString(), usuarioId, acao, detalhe ? JSON.stringify(detalhe) : null,
  );
}

/** preHandler: só os perfis informados passam (o login já foi exigido pelo hook global). */
export function exigir(...perfis: Perfil[]) {
  return async (req: FastifyRequest, resp: FastifyReply) => {
    if (!req.usuario) return resp.code(401).send({ erro: 'Faça login para continuar.' });
    if (!perfis.includes(req.usuario.perfil)) return resp.code(403).send({ erro: 'Seu perfil não tem permissão para esta ação.' });
  };
}

/** preHandler: passa quem tem pelo menos uma das permissões informadas (perfil + ajustes do usuário; admin sempre passa). */
export function exigirPerm(...chaves: string[]) {
  return async (req: FastifyRequest, resp: FastifyReply) => {
    if (!req.usuario) return resp.code(401).send({ erro: 'Faça login para continuar.' });
    if (req.usuario.perfil === 'admin') return;
    if (!chaves.some((c) => req.usuario!.permissoes.includes(c))) return resp.code(403).send({ erro: 'Você não tem permissão para esta ação.' });
  };
}
