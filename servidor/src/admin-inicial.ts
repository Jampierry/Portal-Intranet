import type { DatabaseSync } from 'node:sqlite';
import { hashSenha } from '../../modulos/acessos/api/senha.ts';
import { validarSenhaNova } from '../../modulos/acessos/api/index.ts';

// Cria o primeiro administrador a partir de ADMIN_LOGIN / ADMIN_SENHA, só quando não existe nenhum usuário.
// Com ADMIN_REDEFINIR=1, cria ou REDEFINE esse administrador mesmo com o banco em uso (recuperação sem terminal):
// a senha volta a ser a de ADMIN_SENHA, o perfil admin, a conta fica ativa, a troca de senha é exigida e as sessões dele caem.
// Depois de entrar, remova ADMIN_REDEFINIR e ADMIN_SENHA do ambiente.
// Pensado para ambientes sem terminal (deploy por push). Devolve o login criado, ou null se nada foi feito.
export function criarAdminInicial(db: DatabaseSync, env: NodeJS.ProcessEnv = process.env): string | null {
  const login = env.ADMIN_LOGIN?.trim(), senha = env.ADMIN_SENHA ?? '';
  if (!login || !/^[a-z0-9._-]{3,32}$/.test(login) || senha.length < 8) return null;
  const agora = new Date().toISOString();
  // ADMIN_EMAIL (opcional): grava o e-mail corporativo do administrador, que é o que liga a conta ao login pelo Keycloak (SSO).
  const email = env.ADMIN_EMAIL?.trim().toLowerCase() || null;
  // Mesma regra de senha do portal: recusa as óbvias (admin123, senha123...). Avisa no log em vez de subir com senha fraca.
  try { validarSenhaNova(senha, login); } catch (e) { console.error(`ADMIN_SENHA recusada (${(e as Error).message}). Administrador não criado/redefinido.`); return null; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (env.ADMIN_REDEFINIR === '1') {
    const u = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login) as { id: number } | undefined;
    if (u) {
      db.prepare("UPDATE usuarios SET senha_hash = ?, perfil = 'admin', ativo = 1, trocar_senha = 1, email = COALESCE(?, email) WHERE id = ?").run(hashSenha(senha), email, u.id);
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(u.id);
      db.prepare('INSERT INTO auditoria (quando, usuario_id, acao, detalhe) VALUES (?, NULL, ?, ?)').run(agora, 'admin_redefinido_env', JSON.stringify({ login }));
      return login;
    }
  } else {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number };
    if (n > 0) return null;
  }
  const nome = env.ADMIN_NOME?.trim() || 'Administrador';
  db.prepare("INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, email, criado_em) VALUES (?, ?, ?, 'admin', 1, ?, ?)").run(login, nome, hashSenha(senha), email, agora);
  db.prepare('INSERT INTO auditoria (quando, usuario_id, acao, detalhe) VALUES (?, NULL, ?, ?)').run(agora, 'admin_criado_inicial', JSON.stringify({ login }));
  return login;
}
