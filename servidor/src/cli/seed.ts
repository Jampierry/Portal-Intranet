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
    console.log('Também: editor / editor123 (editor) e leitor / leitor123 (consulta).');
  }

  // Usuários de EXEMPLO por perfil (só desenvolvimento; senhas fracas de propósito).
  for (const [login, nome, perfil, senha] of [['editor', 'Editor (exemplo)', 'editor', 'editor123'], ['leitor', 'Leitor (exemplo)', 'consulta', 'leitor123']] as const) {
    if (!db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get(login)) {
      db.prepare('INSERT INTO usuarios (login, nome, senha_hash, perfil, criado_em) VALUES (?, ?, ?, ?, ?)').run(login, nome, hashSenha(senha), perfil, agora);
    }
  }

  const insApp = db.prepare('INSERT OR IGNORE INTO aplicacoes (slug, nome, descricao, categoria, url, acesso, icone) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const a of applications) insApp.run(a.id, a.name, a.description, a.category, a.href, a.access, a.icon);

  const insCom = db.prepare("INSERT OR IGNORE INTO comunicados (slug, titulo, resumo, categoria, status, publicado_em, criado_em) VALUES (?, ?, ?, ?, 'publicado', ?, ?)");
  for (const c of announcements) insCom.run(c.id, c.title, c.summary, c.category, dataIso(c.dateLabel), agora);

  // Texto completo de EXEMPLO para a tela de detalhe (só onde ainda não há corpo).
  const setCorpo = db.prepare('UPDATE comunicados SET corpo = ? WHERE slug = ? AND corpo IS NULL');
  for (const c of announcements) {
    setCorpo.run(
      [c.summary,
       `Este é um texto de demonstração da categoria ${c.category}. Ele mostra como o comunicado completo aparece no portal: título, categoria, data de publicação e o corpo do aviso, em parágrafos curtos.`,
       'Antes de publicar qualquer comunicado real, o conteúdo, a área responsável e a vigência precisam ser confirmados e aprovados. Nada aqui representa uma orientação oficial da empresa.'].join('\n\n'),
      c.id,
    );
  }

  const insDoc = db.prepare('INSERT OR IGNORE INTO documentos (slug, titulo, categoria, resumo, formato) VALUES (?, ?, ?, ?, ?)');
  for (const d of documents) insDoc.run(d.id, d.title, d.category, d.summary, d.format);

  // Metadados de EXEMPLO dos documentos (versão, responsável, revisão), só onde ainda estão vazios.
  const RESP = ['Comunicação interna (exemplo)', 'RH (exemplo)', 'Operações (exemplo)', 'Qualidade (exemplo)', 'Produto (exemplo)'];
  const setDoc = db.prepare("UPDATE documentos SET versao = ?, responsavel = ?, revisado_em = ? WHERE slug = ? AND versao IS NULL");
  documents.forEach((d, i) => setDoc.run(`1.${i}`, RESP[i % RESP.length], `2026-10-${String(5 + i * 3).padStart(2, '0')}`, d.id));

  // Contatos de EXEMPLO por área (canais fictícios: domínio .invalid não existe de verdade).
  const insDepto = db.prepare('INSERT OR IGNORE INTO departamentos (nome) VALUES (?)');
  const insCont = db.prepare('INSERT INTO contatos (departamento_id, nome, canal, publicavel) SELECT d.id, ?, ?, 1 FROM departamentos d WHERE d.nome = ? AND NOT EXISTS (SELECT 1 FROM contatos c WHERE c.departamento_id = d.id AND c.nome = ?)');
  for (const [area, nome, canal] of [
    ['Recursos Humanos', 'Atendimento ao colaborador', 'rh@exemplo.invalid'],
    ['Recursos Humanos', 'Folha de pagamento', 'ramal 2210 (exemplo)'],
    ['Tecnologia da Informação', 'Suporte e acessos', 'suporte@exemplo.invalid'],
    ['Tecnologia da Informação', 'Abrir chamado', 'https://chamados.exemplo.invalid'],
    ['Qualidade', 'Não conformidades e inspeções', 'qualidade@exemplo.invalid'],
    ['Produção', 'Planejamento e controle (PCP)', 'ramal 2300 (exemplo)'],
    ['Comercial', 'Atendimento a lojas e clientes', 'comercial@exemplo.invalid'],
  ] as const) {
    insDepto.run(area);
    insCont.run(nome, canal, area, nome);
  }

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
  // Destaques de exemplo ficam no mês e ano vigentes.
  const agoraD = new Date();
  db.prepare('UPDATE destaques SET mes = ?, ano = ? WHERE ano IS NULL').run(agoraD.getMonth() + 1, agoraD.getFullYear());
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

for (const t of ['aplicacoes', 'comunicados', 'documentos', 'periodos_destaque', 'destaques']) {
  console.log(`${t}: ${(db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n}`);
}
