// Cópia de segurança do banco, consistente mesmo com o portal rodando (VACUUM INTO).
//   npm run backup -w servidor            -> grava em <pasta de backups>/portal-AAAA-MM-DD_HHMMSS.db
// Variáveis: PASTA_MIDIA (mídia a copiar; padrão midia/ ao lado do banco), BANCO (banco a copiar), PASTA_BACKUP (padrão dados-privados/backups), BACKUP_MANTER_DIAS (padrão 30).
// Agende no servidor (Agendador de Tarefas do Windows ou cron). A pasta de documentos (DOCUMENTOS_PASTA) deve entrar no backup do servidor.
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from '../config.ts';
import { abrirBanco } from '../db.ts';
import { copiarParaBackup } from '../../../modulos/imagens/api/armazenamento.ts';

const pasta = resolve(process.env.PASTA_BACKUP ?? resolve(config.raiz, 'dados-privados', 'backups'));
const manterDias = Math.max(1, Number(process.env.BACKUP_MANTER_DIAS ?? 30) || 30); // nunca 0: apagaria o backup que acabou de ser feito
mkdirSync(pasta, { recursive: true });

const agora = new Date();
const p = (n: number) => String(n).padStart(2, '0');
const nome = `portal-${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}_${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}.db`;
const destino = join(pasta, nome);

const db = abrirBanco(config.caminhoBanco);
db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
// Imagens e vídeos moram em arquivos (pasta de mídia): copia só o que ainda não está no backup (os arquivos nunca mudam).
copiarParaBackup(db, join(pasta, 'midia'));
db.close();
console.log(`Backup criado: ${destino} (mídia em ${join(pasta, 'midia')})`);

// Remove backups antigos (só arquivos portal-*.db desta pasta).
const limite = Date.now() - manterDias * 86_400_000;
for (const f of readdirSync(pasta)) {
  if (!/^portal-.*\.db$/.test(f)) continue;
  const caminho = join(pasta, f);
  if (statSync(caminho).mtimeMs < limite) { unlinkSync(caminho); console.log(`Backup antigo removido: ${f}`); }
}
