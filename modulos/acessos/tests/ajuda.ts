// Apoio dos testes de API: app com banco em memória, usuários de exemplo e login que devolve o cookie.
import { fileURLToPath } from 'node:url';
import { abrirBanco, migrar } from '../../../servidor/src/db.ts';
import { criarApp } from '../../../servidor/src/app.ts';
import { hashSenha } from '../api/senha.ts';

export const SENHA = 'senha-de-teste-1';

export async function criarAppTeste() {
  const db = abrirBanco(':memory:');
  migrar(db, fileURLToPath(new URL('../../../infra/migracoes', import.meta.url)));
  const ins = db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, ?, 0, ?)');
  const hash = hashSenha(SENHA);
  const agora = new Date().toISOString();
  ins.run('master', 'Admin Master', hash, 'admin', agora);
  ins.run('edita', 'Editora', hash, 'editor', agora);
  ins.run('le', 'Leitor', hash, 'consulta', agora);
  const app = await criarApp(db);
  return { app, db };
}

type App = Awaited<ReturnType<typeof criarAppTeste>>['app'];

/** Faz login e devolve o cabeçalho Cookie para as próximas chamadas. */
export async function entrar(app: App, login: string, senha = SENHA): Promise<Record<string, string>> {
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { login, senha } });
  const c = r.cookies.find((x) => x.name === 'portal_sessao');
  if (!c) throw new Error(`login falhou (${r.statusCode}): ${r.body}`);
  return { cookie: `portal_sessao=${c.value}` };
}
