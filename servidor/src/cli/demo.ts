// Dados e imagens de DEMONSTRAÇÃO (100% fictícios) para testar o portal cheio. Roda depois do seed. Pode repetir sem duplicar.
// Imagens: `npm run demo:imagens` (web/public/demo/). Nunca coloque dados reais aqui.
import { config } from '../config.ts';
import { abrirBanco, migrar } from '../db.ts';
import { hashSenha } from '../../../modulos/acessos/api/senha.ts';

if (config.producao) {
  console.error('Dados de demonstração não rodam em produção.');
  process.exit(1);
}

const db = abrirBanco(config.caminhoBanco);
migrar(db, config.pastaMigracoes);
const agora = new Date().toISOString();
const dia = (n: number) => {
  const d = new Date('2026-11-07T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const AVISO = 'Texto de demonstração. Conteúdo fictício criado só para testar a tela, sem valor oficial.';
const corpo = (t: string) => [t, AVISO, 'Este parágrafo existe para mostrar a quebra de linha e o espaçamento do texto completo no detalhe do comunicado.'].join('\n\n');

type Com = [slug: string, titulo: string, categoria: string, resumo: string, imagem: string, status: 'publicado' | 'rascunho' | 'arquivado', prio: 'normal' | 'urgente', publicado: number | null];
const COMUNICADOS: Com[] = [
  ['demo-campanha-agasalho', 'Campanha do agasalho começa na segunda', 'Pessoas', 'Pontos de coleta em cada portaria até o fim do mês (exemplo).', 'campanha', 'publicado', 'normal', -1],
  ['demo-simulado-evacuacao', 'Simulado de evacuação na quinta-feira', 'Segurança', 'Atenção ao sinal sonoro às 10h. Siga as rotas indicadas (exemplo).', 'seguranca', 'publicado', 'urgente', 0],
  ['demo-nova-colecao', 'Nova coleção de verão chega à fábrica', 'Produto', 'Resumo da linha, prazos e células envolvidas (exemplo).', 'colecao', 'publicado', 'normal', -2],
  ['demo-treinamento-qualidade', 'Treinamento de inspeção de qualidade', 'Treinamento', 'Inscrições abertas para duas turmas em novembro (exemplo).', 'treinamento', 'publicado', 'normal', -3],
  ['demo-manutencao-sistema', 'Janela de manutenção do sistema interno', 'Tecnologia', 'Sábado, das 22h às 2h, o acesso ficará instável (exemplo).', 'ti', 'publicado', 'urgente', -1],
  ['demo-beneficios-2027', 'Revisão dos benefícios para 2027', 'Benefícios', 'Veja o que muda e onde tirar dúvidas (exemplo).', 'beneficios', 'publicado', 'normal', -5],
  ['demo-resultado-meta', 'Meta de produção do mês: balanço parcial', 'Resultados', 'Acompanhamento das células, sem ranking de pessoas (exemplo).', 'resultados', 'publicado', 'normal', -4],
  ['demo-confraternizacao', 'Confraternização de fim de ano', 'Eventos', 'Data, local e programação preliminar (exemplo).', 'eventos', 'publicado', 'normal', -6],
  ['demo-atendimento-lojas', 'Novo fluxo de atendimento a lojas', 'Comercial', 'Como registrar pedidos urgentes a partir de dezembro (exemplo).', 'comercial', 'publicado', 'normal', -8],
  ['demo-rotina-operacao', 'Ajuste na rotina de turnos', 'Operação', 'Novos horários de troca de turno nas células de costura (exemplo).', 'operacao', 'publicado', 'normal', -9],
  ['demo-rascunho-politica', 'Rascunho: política de uniformes', 'Pessoas', 'Ainda em revisão; não aparece no portal (exemplo).', 'pessoas', 'rascunho', 'normal', null],
  ['demo-arquivado-feira', 'Feira de negócios do semestre passado', 'Comercial', 'Comunicado antigo, arquivado (exemplo).', 'comercial', 'arquivado', 'normal', -90],
  ['demo-programado-natal', 'Programação de natal (começa em 3 dias)', 'Eventos', 'Só aparece a partir da data programada (exemplo).', 'eventos', 'publicado', 'normal', 3],
];

const DOCS: [slug: string, titulo: string, categoria: string, resumo: string, formato: string, versao: string, responsavel: string, classificacao: string][] = [
  ['demo-manual-seguranca', 'Manual de segurança no trabalho', 'Segurança', 'Regras gerais, EPIs e brigada (exemplo).', 'PDF', '3.1', 'Segurança do trabalho (exemplo)', 'interno'],
  ['demo-codigo-conduta', 'Código de conduta', 'Institucional', 'Princípios e canais de denúncia (exemplo).', 'PDF', '2.0', 'Compliance (exemplo)', 'interno'],
  ['demo-politica-viagens', 'Política de viagens e despesas', 'Financeiro', 'Limites, prazos e prestação de contas (exemplo).', 'PDF', '1.4', 'Financeiro (exemplo)', 'interno'],
  ['demo-fluxo-pedidos', 'Fluxo de pedidos de lojas', 'Comercial', 'Etapas do pedido até a expedição (exemplo).', 'Fluxograma', '1.2', 'Comercial (exemplo)', 'interno'],
  ['demo-instrucao-costura', 'Instrução de trabalho: costura de gola', 'Produção', 'Passo a passo ilustrado (exemplo).', 'PDF', '5.0', 'PCP (exemplo)', 'interno'],
  ['demo-plano-cargos', 'Plano de cargos e salários', 'Pessoas e RH', 'Documento de acesso restrito (exemplo).', 'PDF', '1.0', 'RH (exemplo)', 'restrito'],
  ['demo-checklist-qualidade', 'Checklist de inspeção final', 'Qualidade', 'Itens de conferência antes do embarque (exemplo).', 'Planilha', '4.2', 'Qualidade (exemplo)', 'interno'],
];

const DESTAQUES: [tipo: 'mes' | 'ano', rotulo: string, nome: string, area: string, apresentacao: string][] = [
  ['mes', 'Novembro 2026', 'Pessoa de demonstração 03', 'Costura (demonstração)', 'Exemplo de reconhecimento por ajudar colegas novos na célula.'],
  ['mes', 'Novembro 2026', 'Pessoa de demonstração 04', 'Qualidade (demonstração)', 'Exemplo de reconhecimento pela atenção aos detalhes.'],
  ['mes', 'Novembro 2026', 'Pessoa de demonstração 05', 'Expedição (demonstração)', 'Exemplo de reconhecimento por organizar o embarque no prazo.'],
  ['ano', '2026', 'Pessoa de demonstração 06', 'Corte (demonstração)', 'Exemplo de reconhecimento por sugestões de melhoria ao longo do ano.'],
  ['ano', '2026', 'Pessoa de demonstração 07', 'Manutenção (demonstração)', 'Exemplo de reconhecimento por reduzir paradas de máquina.'],
];

const CONTATOS: [area: string, nome: string, canal: string][] = [
  ['Segurança do Trabalho', 'Brigada e CIPA', 'cipa@exemplo.invalid'],
  ['Segurança do Trabalho', 'Emergências', 'ramal 190 (exemplo)'],
  ['Financeiro', 'Reembolsos', 'financeiro@exemplo.invalid'],
  ['Manutenção', 'Chamado de máquina parada', 'ramal 2400 (exemplo)'],
  ['Expedição', 'Agendamento de carga', 'expedicao@exemplo.invalid'],
];

db.exec('BEGIN');
try {
  const insCom = db.prepare(
    'INSERT OR IGNORE INTO comunicados (slug, titulo, resumo, corpo, categoria, prioridade, status, imagem, exibir_de, publicado_em, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const [slug, titulo, cat, resumo, img, status, prio, pub] of COMUNICADOS) {
    const programado = pub !== null && pub > 0;
    insCom.run(slug, titulo, resumo, corpo(resumo), cat, prio, status, `/demo/capa-${img}.svg`, programado ? dia(pub) : null, pub === null ? null : dia(pub), agora, agora);
  }
  // Capas também nos comunicados do seed original (só onde ainda não há imagem).
  const capaSeed = db.prepare('UPDATE comunicados SET imagem = ? WHERE slug = ? AND imagem IS NULL');
  capaSeed.run('/demo/capa-pessoas.svg', 'demo-pessoas');
  capaSeed.run('/demo/capa-operacao.svg', 'demo-operacao');
  capaSeed.run('/demo/capa-qualidade.svg', 'demo-qualidade');

  const insDoc = db.prepare(
    'INSERT OR IGNORE INTO documentos (slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, link_oficial, revisado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  DOCS.forEach(([slug, t, c, r, f, v, resp, cl], i) =>
    insDoc.run(slug, t, c, r, f, v, resp, cl, cl === 'restrito' ? null : `https://documentos.exemplo.invalid/${slug}`, dia(-5 - i * 7), agora));

  const insPer = db.prepare("INSERT OR IGNORE INTO periodos_destaque (tipo, rotulo, status) VALUES (?, ?, 'publicado')");
  const insDes = db.prepare(
    "INSERT INTO destaques (periodo_id, nome, area, iniciais, apresentacao, foto_aprovada, consentimento_ref, status) SELECT p.id, ?, ?, ?, ?, ?, 'exemplo-ficticio', 'aprovado' FROM periodos_destaque p WHERE p.tipo = ? AND p.rotulo = ? AND NOT EXISTS (SELECT 1 FROM destaques d WHERE d.periodo_id = p.id AND d.nome = ?)",
  );
  DESTAQUES.forEach(([tipo, rotulo, nome, area, ap], i) => {
    insPer.run(tipo, rotulo);
    insDes.run(nome, area, nome.slice(-2), ap, `/demo/avatar-${String(i + 3).padStart(2, '0')}.svg`, tipo, rotulo, nome);
  });
  // Avatares nos destaques do seed original (só onde ainda não há foto).
  const semFoto = db.prepare('SELECT id FROM destaques WHERE foto_aprovada IS NULL ORDER BY id').all() as { id: number }[];
  const setFoto = db.prepare('UPDATE destaques SET foto_aprovada = ? WHERE id = ?');
  semFoto.forEach((r, i) => setFoto.run(`/demo/avatar-${String((i % 2) + 1).padStart(2, '0')}.svg`, r.id));

  const insUsu = db.prepare('INSERT OR IGNORE INTO usuarios (login, nome, senha_hash, perfil, criado_em) VALUES (?, ?, ?, ?, ?)');
  for (const [login, nome, perfil] of [['ana.demo', 'Ana (demonstração)', 'editor'], ['bruno.demo', 'Bruno (demonstração)', 'consulta'], ['carla.demo', 'Carla (demonstração)', 'consulta']] as const) {
    insUsu.run(login, nome, hashSenha('demo12345'), perfil, agora);
  }

  const insDepto = db.prepare('INSERT OR IGNORE INTO departamentos (nome) VALUES (?)');
  const insCont = db.prepare(
    'INSERT INTO contatos (departamento_id, nome, canal, publicavel) SELECT d.id, ?, ?, 1 FROM departamentos d WHERE d.nome = ? AND NOT EXISTS (SELECT 1 FROM contatos c WHERE c.departamento_id = d.id AND c.nome = ?)',
  );
  for (const [area, nome, canal] of CONTATOS) {
    insDepto.run(area);
    insCont.run(nome, canal, area, nome);
  }
  // Banners do carrossel do Início (só se ainda não houver nenhum).
  if ((db.prepare('SELECT COUNT(*) n FROM banners').get() as { n: number }).n === 0) {
    const insBan = db.prepare('INSERT INTO banners (titulo, subtitulo, imagem, botao_texto, link, ordem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)');
    insBan.run('Nova coleção de verão chega à fábrica', 'Linha, prazos e células envolvidas (exemplo).', '/demo/capa-colecao.svg', 'Saiba mais', '#comunicados/demo-nova-colecao', 1, agora, agora);
    insBan.run('Campanha do agasalho', 'Pontos de coleta em cada portaria até o fim do mês (exemplo).', '/demo/capa-campanha.svg', 'Ver comunicado', '#comunicados/demo-campanha-agasalho', 2, agora, agora);
    insBan.run('Simulado de evacuação na quinta', 'Atenção ao sinal sonoro às 10h (exemplo).', '/demo/capa-seguranca.svg', 'Ver comunicado', '#comunicados/demo-simulado-evacuacao', 3, agora, agora);
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

for (const t of ['comunicados', 'documentos', 'destaques', 'usuarios', 'contatos']) {
  console.log(`${t}: ${(db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n}`);
}
