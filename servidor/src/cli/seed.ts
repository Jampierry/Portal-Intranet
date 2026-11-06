// Dados de EXEMPLO (fictícios), reaproveitando os mesmos dados do protótipo. Nunca coloque dados reais aqui.
import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';
import { hashSenha } from '../../../modulos/acessos/api/senha.ts';
import { applications } from '../../../modulos/aplicacoes/data/applications.ts';
import { announcements } from '../../../modulos/comunicados/data/announcements.ts';
import { documents } from '../../../modulos/documentos/data/documents.ts';
import { recognition } from '../../../modulos/inicio/data/recognition.ts';

if (config.producao) {
  console.error('Seed de exemplo não roda em produção.');
  process.exit(1);
}

const db = abrirBanco(config.caminhoBanco);
migrar(db, config.pastaMigracoes);
const agora = new Date().toISOString();

const MESES: Record<string, string> = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
function dataIso(rotulo: string): string {
  const [dia, mes, ano] = rotulo.split(' ');
  return `${ano}-${MESES[mes] ?? '01'}-${dia.padStart(2, '0')}`;
}

db.exec('BEGIN');
try {
  if (!db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get('admin')) {
    db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, criado_em) VALUES (?, ?, ?, ?, ?)').run(
      'admin', 'Administrador (exemplo)', hashSenha('admin123'), 'admin', agora,
    );
    console.log('Criado usuário de exemplo: admin / admin123  (só para desenvolvimento)');
  }

  const insApp = db.prepare('INSERT OR IGNORE INTO aplicacoes (slug, nome, descricao, categoria, url, acesso, icone) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const a of applications) insApp.run(a.id, a.name, a.description, a.category, a.href, a.access, a.icon);

  const insCom = db.prepare("INSERT OR IGNORE INTO comunicados (slug, titulo, resumo, categoria, status, publicado_em, criado_em) VALUES (?, ?, ?, ?, 'publicado', ?, ?)");
  for (const c of announcements) insCom.run(c.id, c.title, c.summary, c.category, dataIso(c.dateLabel), agora);

  const insDoc = db.prepare('INSERT OR IGNORE INTO documentos (slug, titulo, categoria, resumo, formato) VALUES (?, ?, ?, ?, ?)');
  for (const d of documents) insDoc.run(d.id, d.title, d.category, d.summary, d.format);

  const insPer = db.prepare("INSERT OR IGNORE INTO periodos_destaque (tipo, rotulo, status) VALUES (?, ?, 'publicado')");
  const insDes = db.prepare(
    "INSERT INTO destaques (periodo_id, nome, area, iniciais, apresentacao, consentimento_ref, status) SELECT p.id, ?, ?, ?, ?, 'exemplo-ficticio', 'aprovado' FROM periodos_destaque p WHERE p.tipo = ? AND p.rotulo = ? AND NOT EXISTS (SELECT 1 FROM destaques d WHERE d.periodo_id = p.id AND d.nome = ?)",
  );
  for (const [chave, tipo] of [['month', 'mes'], ['year', 'ano']] as const) {
    for (const e of recognition[chave]) {
      insPer.run(tipo, e.period);
      insDes.run(e.name, e.role, e.initials, e.note, tipo, e.period, e.name);
    }
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

for (const t of ['aplicacoes', 'comunicados', 'documentos', 'periodos_destaque', 'destaques']) {
  console.log(`${t}: ${(db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n}`);
}
