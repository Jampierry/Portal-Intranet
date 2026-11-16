import type { DatabaseSync } from 'node:sqlite';
import { hashSenha } from '../../modulos/acessos/api/senha.ts';

// Cria o primeiro administrador a partir de ADMIN_LOGIN / ADMIN_SENHA, só quando não existe nenhum usuário.
// Pensado para ambientes sem terminal (deploy por push). Devolve o login criado, ou null se nada foi feito.
export function criarAdminInicial(db: DatabaseSync, env: NodeJS.ProcessEnv = process.env): string | null {
  const login = env.ADMIN_LOGIN?.trim(), senha = env.ADMIN_SENHA ?? '';
  if (!login || !/^[a-z0-9._-]{3,32}$/.test(login) || senha.length < 8) return null;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number };
  if (n > 0) return null;
  const nome = env.ADMIN_NOME?.trim() || 'Administrador';
  const agora = new Date().toISOString();
  db.prepare("INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, 'admin', 1, ?)").run(login, nome, hashSenha(senha), agora);
  db.prepare('INSERT INTO auditoria (quando, usuario_id, acao, detalhe) VALUES (?, NULL, ?, ?)').run(agora, 'admin_criado_inicial', JSON.stringify({ login }));
  return login;
}
