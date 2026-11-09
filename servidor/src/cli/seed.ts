// Cria o administrador de desenvolvimento e liga os dados de EXEMPLO (empresa fictícia). Nunca coloque dados reais aqui.
import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';
import { hashSenha } from '../../../modulos/acessos/api/senha.ts';
import { ativarExemplo } from '../../../modulos/demonstracao/api/pacote.ts';

if (config.producao) {
  console.error('Seed de exemplo não roda em produção.');
  process.exit(1);
}

const db = abrirBanco(config.caminhoBanco);
migrar(db, config.pastaMigracoes);

if (!db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get('admin')) {
  db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, criado_em) VALUES (?, ?, ?, ?, ?)').run('admin', 'Administrador (exemplo)', hashSenha('admin123'), 'admin', new Date().toISOString());
  console.log('Criado usuário de exemplo: admin / admin123  (só para desenvolvimento)');
}
const e = ativarExemplo(db);
console.log(`Dados de exemplo ligados (${e.total} registros). Também: editor / editor123, leitor / leitor123, ana.demo (editor) e bruno.demo / carla.demo (consulta), senha demo12345.`);
