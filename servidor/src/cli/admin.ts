// Cria (ou redefine a senha de) o administrador master. Uso:
//   npm run admin -w servidor -- <login> "<Nome completo>"
// A senha provisória vem da variável ADMIN_SENHA ou é gerada e mostrada UMA vez. O usuário troca no primeiro acesso.
import { randomBytes } from 'node:crypto';
import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';
import { hashSenha } from '../../../modulos/acessos/api/senha.ts';

const [login, ...resto] = process.argv.slice(2);
const nome = resto.join(' ').trim();
if (!login || !/^[a-z0-9._-]{3,32}$/.test(login) || nome.length < 2) {
  console.error('Uso: npm run admin -w servidor -- <login> "<Nome completo>"   (login: 3 a 32 letras minúsculas, números, . - _)');
  process.exit(1);
}
const senha = process.env.ADMIN_SENHA ?? randomBytes(9).toString('base64url');
if (senha.length < 8) {
  console.error('ADMIN_SENHA precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}
const db = abrirBanco(config.caminhoBanco);
migrar(db, config.pastaMigracoes);
const existe = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login) as { id: number } | undefined;
if (existe) {
  db.prepare("UPDATE usuarios SET senha_hash = ?, perfil = 'admin', ativo = 1, trocar_senha = 1 WHERE id = ?").run(hashSenha(senha), existe.id);
  db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(existe.id);
} else {
  db.prepare("INSERT INTO usuarios (login, nome, senha_hash, perfil, trocar_senha, criado_em) VALUES (?, ?, ?, 'admin', 1, ?)").run(login, nome, hashSenha(senha), new Date().toISOString());
}
db.prepare('INSERT INTO auditoria (quando, usuario_id, acao, detalhe) VALUES (?, NULL, ?, ?)').run(new Date().toISOString(), existe ? 'admin_redefinido_cli' : 'admin_criado_cli', JSON.stringify({ login }));
console.log(`${existe ? 'Administrador redefinido' : 'Administrador criado'}: ${login}`);
console.log(process.env.ADMIN_SENHA ? 'Senha provisória: a informada em ADMIN_SENHA.' : `Senha provisória (mostrada só agora): ${senha}`);
console.log('No primeiro acesso o sistema pede para trocar a senha.');
