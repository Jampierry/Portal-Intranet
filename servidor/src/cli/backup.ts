// Cópia de segurança do banco, consistente mesmo com o portal rodando (VACUUM INTO).
//   npm run backup -w servidor            -> grava em <pasta de backups>/portal-AAAA-MM-DD_HHMMSS.db
// Variáveis: BANCO (banco a copiar), PASTA_BACKUP (padrão dados-privados/backups), BACKUP_MANTER_DIAS (padrão 30).
// Agende no servidor (Agendador de Tarefas do Windows ou cron). A pasta de documentos (DOCUMENTOS_PASTA) deve entrar no backup do servidor.
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from '../config.ts';
import { abrirBanco } from '../db.ts';

const pasta = resolve(process.env.PASTA_BACKUP ?? resolve(config.raiz, 'dados-privados', 'backups'));
const manterDias = Number(process.env.BACKUP_MANTER_DIAS ?? 30);
mkdirSync(pasta, { recursive: true });

const agora = new Date();
const p = (n: number) => String(n).padStart(2, '0');
const nome = `portal-${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}_${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}.db`;
const destino = join(pasta, nome);

const db = abrirBanco(config.caminhoBanco);
db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
db.close();
console.log(`Backup criado: ${destino}`);

// Remove backups antigos (só arquivos portal-*.db desta pasta).
const limite = Date.now() - manterDias * 86_400_000;
for (const f of readdirSync(pasta)) {
  if (!/^portal-.*\.db$/.test(f)) continue;
  const caminho = join(pasta, f);
  if (statSync(caminho).mtimeMs < limite) { unlinkSync(caminho); console.log(`Backup antigo removido: ${f}`); }
}
