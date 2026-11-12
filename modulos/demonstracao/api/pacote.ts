// Pacote de dados de EXEMPLO de uma empresa 100% fictícia ("Aurora Esportes"): comunicados, documentos, apps, banners, pessoas,
// calendário, pulso, usuários e imagens. Tudo vai para o BANCO (imagens inclusive), então aparece para qualquer usuário, em qualquer
// máquina ou celular. Cada linha criada é anotada em `dados_exemplo`; desligar apaga só o que foi anotado (nada do que a empresa
// cadastrou de verdade). Ligar de novo não duplica. Nunca coloque dados reais aqui.
import { createHash, randomBytes } from 'node:crypto';
import type { Banco } from '../../../servidor/src/db.ts';
import { hashSenha } from '../../acessos/api/senha.ts';
import { guardarImagem } from '../../imagens/api/index.ts';
import { avatar, capa, ICONE_EMPRESA, logoEmpresa, QTD_AVATARES, type TemaCapa } from '../data/imagens.ts';

export const EMPRESA_EXEMPLO = 'Aurora Esportes';
export const SENHA_USUARIOS_EXEMPLO = 'demo12345';
type Chave = string | number;
type Par = string | number | null;

/** Dia (AAAA-MM-DD) a partir de uma data base; n negativo = passado. */
const dia = (n: number, base: Date) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n, 12);
  return d.toISOString().slice(0, 10);
};
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const AVISO = 'Texto de demonstração da empresa fictícia Aurora Esportes. Conteúdo criado só para testar a tela, sem valor oficial.';
const corpo = (t: string) => [t, AVISO, 'Este parágrafo existe para mostrar a quebra de linha e o espaçamento do texto completo no detalhe do comunicado.'].join('\n\n');

type Com = [slug: string, titulo: string, categoria: string, resumo: string, capa: TemaCapa, status: 'publicado' | 'rascunho' | 'arquivado', prio: 'normal' | 'urgente', publicado: number | null, exigeLeitura?: boolean];
const COMUNICADOS: Com[] = [
  ['ex-campanha-agasalho', 'Campanha do agasalho começa na segunda', 'Pessoas', 'Pontos de coleta em cada portaria até o fim do mês.', 'campanha', 'publicado', 'normal', -1],
  ['ex-simulado-evacuacao', 'Simulado de evacuação na quinta-feira', 'Segurança', 'Atenção ao sinal sonoro às 10h. Siga as rotas indicadas.', 'seguranca', 'publicado', 'urgente', 0, true],
  ['ex-nova-colecao', 'Nova coleção de verão chega à fábrica', 'Produto', 'Resumo da linha, prazos e células envolvidas.', 'colecao', 'publicado', 'normal', -2],
  ['ex-treinamento-qualidade', 'Treinamento de inspeção de qualidade', 'Treinamento', 'Inscrições abertas para duas turmas neste mês.', 'treinamento', 'publicado', 'normal', -3],
  ['ex-manutencao-sistema', 'Janela de manutenção do sistema interno', 'Tecnologia', 'Sábado, das 22h às 2h, o acesso ficará instável.', 'ti', 'publicado', 'urgente', -1],
  ['ex-beneficios', 'Revisão dos benefícios para o próximo ano', 'Benefícios', 'Veja o que muda e onde tirar dúvidas.', 'beneficios', 'publicado', 'normal', -5, true],
  ['ex-resultado-meta', 'Meta de produção do mês: balanço parcial', 'Resultados', 'Acompanhamento das células, sem ranking de pessoas.', 'resultados', 'publicado', 'normal', -4],
  ['ex-confraternizacao', 'Confraternização de fim de ano', 'Eventos', 'Data, local e programação preliminar.', 'eventos', 'publicado', 'normal', -6],
  ['ex-atendimento-lojas', 'Novo fluxo de atendimento a lojas', 'Comercial', 'Como registrar pedidos urgentes a partir do mês que vem.', 'comercial', 'publicado', 'normal', -8],
  ['ex-rotina-operacao', 'Ajuste na rotina de turnos', 'Operação', 'Novos horários de troca de turno nas células de costura.', 'operacao', 'publicado', 'normal', -9],
  ['ex-boas-vindas', 'Boas-vindas aos novos colegas', 'Pessoas', 'Conheça quem chegou à Aurora neste mês.', 'pessoas', 'publicado', 'normal', -10],
  ['ex-rascunho-uniformes', 'Rascunho: política de uniformes', 'Pessoas', 'Ainda em revisão; não aparece no portal.', 'pessoas', 'rascunho', 'normal', null],
  ['ex-arquivado-feira', 'Feira de negócios do semestre passado', 'Comercial', 'Comunicado antigo, arquivado.', 'comercial', 'arquivado', 'normal', -90],
  ['ex-programado-natal', 'Programação de natal (começa em 3 dias)', 'Eventos', 'Só aparece a partir da data programada.', 'eventos', 'publicado', 'normal', 3],
];

const DOCS: [slug: string, titulo: string, categoria: string, resumo: string, formato: string, versao: string, responsavel: string, classificacao: string][] = [
  ['ex-manual-seguranca', 'Manual de segurança no trabalho', 'Segurança', 'Regras gerais, EPIs e brigada.', 'PDF', '3.1', 'Segurança do trabalho', 'interno'],
  ['ex-codigo-conduta', 'Código de conduta', 'Institucional', 'Princípios e canais de denúncia.', 'PDF', '2.0', 'Compliance', 'interno'],
  ['ex-politica-viagens', 'Política de viagens e despesas', 'Financeiro', 'Limites, prazos e prestação de contas.', 'PDF', '1.4', 'Financeiro', 'interno'],
  ['ex-fluxo-pedidos', 'Fluxo de pedidos de lojas', 'Comercial', 'Etapas do pedido até a expedição.', 'Fluxograma', '1.2', 'Comercial', 'interno'],
  ['ex-instrucao-costura', 'Instrução de trabalho: costura de gola', 'Produção', 'Passo a passo ilustrado.', 'PDF', '5.0', 'PCP', 'interno'],
  ['ex-plano-cargos', 'Plano de cargos e salários', 'Pessoas e RH', 'Documento de acesso restrito.', 'PDF', '1.0', 'RH', 'restrito'],
  ['ex-checklist-qualidade', 'Checklist de inspeção final', 'Qualidade', 'Itens de conferência antes do embarque.', 'Planilha', '4.2', 'Qualidade', 'interno'],
  ['ex-guia-integracao', 'Guia de integração de novos colaboradores', 'Pessoas e RH', 'Primeiros dias na Aurora: tour, acessos e contatos.', 'PDF', '2.3', 'RH', 'interno'],
];

type App = [slug: string, nome: string, descricao: string, categoria: string, icone: string, acesso: string, restrita?: boolean];
const APPS: App[] = [
  ['ex-meu-rh', 'Aurora RH', 'Férias, holerite, cargo e documentos em um só lugar.', 'Pessoas e RH', 'users', 'Todos os colaboradores.'],
  ['ex-chamados', 'Chamados de TI', 'Abra e acompanhe pedidos de suporte e acessos.', 'Tecnologia', 'apps', 'Todos os colaboradores.'],
  ['ex-pedidos', 'Pedidos de lojas', 'Registro e acompanhamento de pedidos do comercial.', 'Comercial', 'apps', 'Equipe comercial.'],
  ['ex-qualidade', 'Inspeção de qualidade', 'Registro de não conformidades e inspeções.', 'Qualidade', 'apps', 'Equipe de qualidade.'],
  ['ex-reservas', 'Reserva de salas', 'Reserve salas de reunião e auditório.', 'Serviços', 'apps', 'Todos os colaboradores.'],
  ['ex-folha', 'Painel de folha', 'Fechamento e conferência da folha (restrito).', 'Pessoas e RH', 'users', 'Somente RH e quem for liberado.', true],
];

const CONTATOS: [area: string, nome: string, canal: string][] = [
  ['Recursos Humanos', 'Atendimento ao colaborador', 'rh@aurora-esportes.invalid'],
  ['Recursos Humanos', 'Folha de pagamento', 'ramal 2210'],
  ['Tecnologia da Informação', 'Suporte e acessos', 'suporte@aurora-esportes.invalid'],
  ['Tecnologia da Informação', 'Abrir chamado', 'https://chamados.aurora-esportes.invalid'],
  ['Qualidade', 'Não conformidades e inspeções', 'qualidade@aurora-esportes.invalid'],
  ['Produção', 'Planejamento e controle (PCP)', 'ramal 2300'],
  ['Comercial', 'Atendimento a lojas e clientes', 'comercial@aurora-esportes.invalid'],
  ['Segurança do Trabalho', 'Brigada e CIPA', 'cipa@aurora-esportes.invalid'],
  ['Segurança do Trabalho', 'Emergências', 'ramal 190'],
  ['Financeiro', 'Reembolsos', 'financeiro@aurora-esportes.invalid'],
  ['Manutenção', 'Chamado de máquina parada', 'ramal 2400'],
  ['Expedição', 'Agendamento de carga', 'expedicao@aurora-esportes.invalid'],
];

const NOMES = ['Helena Duarte', 'Rafael Monteiro', 'Camila Teixeira', 'Lucas Andrade', 'Beatriz Nogueira', 'Thiago Barros', 'Marina Prado', 'Gustavo Leal', 'Juliana Furtado', 'André Siqueira', 'Patrícia Moura', 'Felipe Rangel'];
const AREAS = ['Costura', 'Qualidade', 'Expedição', 'Corte', 'Manutenção', 'Comercial', 'Recursos Humanos', 'Tecnologia', 'Produção', 'Financeiro', 'Estamparia', 'Logística'];
const PERGUNTA_PULSO = 'De 1 a 5, como foi sua semana de trabalho? (exemplo)';

export interface Estado { ativo: boolean; total: number; por_tabela: Record<string, number>; empresa: string; usuarios: { login: string; nome: string; perfil: string }[] }

export function estadoExemplo(db: Banco): Estado {
  const linhas = db.prepare('SELECT tabela, COUNT(*) n FROM dados_exemplo GROUP BY tabela').all() as { tabela: string; n: number }[];
  const por_tabela: Record<string, number> = {};
  let total = 0;
  for (const l of linhas) { por_tabela[l.tabela] = l.n; total += l.n; }
  const usuarios = db.prepare("SELECT u.login, u.nome, u.perfil FROM dados_exemplo d JOIN usuarios u ON u.id = CAST(d.chave AS INTEGER) WHERE d.tabela = 'usuarios' ORDER BY u.id").all() as Estado['usuarios'];
  return { ativo: total > 0, total, por_tabela, empresa: EMPRESA_EXEMPLO, usuarios };
}

export function ativarExemplo(db: Banco, opcoes: { producao?: boolean; hoje?: Date } = {}): Estado {
  const hoje = opcoes.hoje ?? new Date();
  const d = (n: number) => dia(n, hoje);
  const agora = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const marcar = (tabela: string, chave: Chave, anterior: string | null = null, aplicado: string | null = null) =>
      db.prepare('INSERT OR IGNORE INTO dados_exemplo (tabela, chave, anterior, aplicado) VALUES (?, ?, ?, ?)').run(tabela, String(chave), anterior, aplicado);
    /** Acha a linha pela chave natural (e a adota) ou cria; sempre anota. `chaveSlug`: a chave é o próprio texto (não o rowid). */
    const unico = (tabela: string, achar: string, parAchar: Par[], inserir: string, parIns: Par[], chaveSlug?: string): Chave => {
      const e = db.prepare(achar).get(...parAchar) as { id: Chave } | undefined;
      let id: Chave;
      if (e) id = e.id;
      else {
        const r = db.prepare(inserir).run(...parIns);
        id = chaveSlug ?? Number(r.lastInsertRowid);
      }
      marcar(tabela, id);
      return id;
    };

    limparLegado(db);

    // Imagens (no banco; o nome é o resumo do conteúdo, então ligar de novo não cria cópias).
    const guardar = (svg: string) => {
      const buf = Buffer.from(svg, 'utf8');
      const nome = `${createHash('sha256').update(buf).digest('hex').slice(0, 24)}.svg`;
      if (!guardarImagem(db, buf, { aceitarSvg: true, nome })) throw new Error('Imagem de exemplo recusada.');
      marcar('imagens_arquivo', nome);
      return nome;
    };
    const urlCapa = (t: TemaCapa) => `/api/imagens/${guardar(capa(t))}`;
    const urlPublica = (svg: string) => `/api/publico/imagens/${guardar(svg)}`;
    const urlAvatar = (i: number) => `/api/imagens/${guardar(avatar(i % QTD_AVATARES))}`;

    // Identidade da empresa fictícia, tela de entrada e missão/visão/valores (guarda o valor de antes para voltar ao desligar).
    const config = (tabela: 'portal_config' | 'institucional', chave: string, valor: string) => {
      const col = tabela === 'portal_config' ? 'valor' : 'texto';
      const atual = db.prepare(`SELECT ${col} AS v FROM ${tabela} WHERE chave = ?`).get(chave) as { v: string } | undefined;
      const rastreada = db.prepare('SELECT 1 FROM dados_exemplo WHERE tabela = ? AND chave = ?').get(tabela, chave);
      if (!rastreada) marcar(tabela, chave, atual?.v ?? null, valor);
      else db.prepare('UPDATE dados_exemplo SET aplicado = ? WHERE tabela = ? AND chave = ?').run(valor, tabela, chave);
      db.prepare(`INSERT INTO ${tabela} (chave, ${col}, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET ${col} = excluded.${col}, atualizado_em = excluded.atualizado_em`).run(chave, valor, agora);
    };
    config('portal_config', 'empresa', JSON.stringify({
      nome: EMPRESA_EXEMPLO, nome_portal: 'Aurora Conecta', slogan: 'Movimento que nasce do cuidado', frase_rodape: 'Aurora Esportes: empresa fictícia de exemplo.',
      lema: ['MOVER', 'FAZ PARTE', 'DO NOSSO', 'JEITO'], rotulo_destaque: 'DESTAQUE', lema_destaque: ['PESSOAS', 'ENERGIA', 'RESULTADOS', 'SEMPRE'],
      logo: urlPublica(ICONE_EMPRESA), logo_nome: urlPublica(logoEmpresa(false)), logo_nome_escuro: urlPublica(logoEmpresa(true)),
      feriados_municipais: [{ titulo: 'Aniversário da cidade (exemplo)', dia: 15, mes: 8 }], fundacao: '2009-03-14',
    }));
    config('portal_config', 'entrada', JSON.stringify({
      fundo: 'carrossel', imagens: (['colecao', 'operacao', 'pessoas'] as TemaCapa[]).map((t) => urlPublica(capa(t))), intervalo: 7, escurecer: 35,
      linhas: ['Bem-vindo(a)', 'à Aurora', 'Conecta'], rodape: 'Empresa fictícia de exemplo', texto_extra: 'Comunicados, aplicativos e documentos em um só lugar.',
    }));
    config('institucional', 'missao', 'Vestir o movimento: criar roupas esportivas de qualidade, com pessoas que cuidam de cada detalhe (texto de exemplo).');
    config('institucional', 'visao', 'Ser referência em moda esportiva, reconhecida pela qualidade e pelo cuidado com as pessoas (texto de exemplo).');
    config('institucional', 'valores', 'Respeito às pessoas\nQualidade em cada detalhe\nSegurança em primeiro lugar\nTrabalho em equipe\nMelhoria contínua');

    // Usuários de exemplo. Em produção ficam sem senha utilizável (ninguém entra com eles).
    const senhaUsu = (s: string) => hashSenha(opcoes.producao ? randomBytes(18).toString('hex') : s);
    const ids: Record<string, number> = {};
    for (const [login, nome, perfil, senha] of [
      ['editor', 'Editor (exemplo)', 'editor', 'editor123'], ['leitor', 'Leitor (exemplo)', 'consulta', 'leitor123'],
      ['ana.demo', 'Ana Ribeiro (exemplo)', 'editor', SENHA_USUARIOS_EXEMPLO], ['bruno.demo', 'Bruno Carvalho (exemplo)', 'consulta', SENHA_USUARIOS_EXEMPLO], ['carla.demo', 'Carla Souza (exemplo)', 'consulta', SENHA_USUARIOS_EXEMPLO],
    ] as const) {
      ids[login] = unico('usuarios', 'SELECT id FROM usuarios WHERE login = ?', [login], 'INSERT INTO usuarios (login, nome, senha_hash, perfil, criado_em) VALUES (?, ?, ?, ?, ?)', [login, nome, senhaUsu(senha), perfil, agora]) as number;
    }

    // Aplicativos (um restrito, liberado só para a Ana).
    for (const [slug, nome, desc, cat, icone, acesso, restrita] of APPS) {
      unico('aplicacoes', 'SELECT slug AS id FROM aplicacoes WHERE slug = ?', [slug],
        'INSERT INTO aplicacoes (slug, nome, descricao, categoria, url, acesso, icone, restrita) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [slug, nome, desc, cat, `https://${slug.slice(3)}.aurora-esportes.invalid`, acesso, icone, restrita ? 1 : 0], slug);
    }
    db.prepare('INSERT OR IGNORE INTO usuarios_aplicativos (usuario_id, aplicacao_slug) VALUES (?, ?)').run(ids['ana.demo'], 'ex-folha');

    // Comunicados com capa.
    for (const [slug, titulo, cat, resumo, tema, status, prio, pub, exige] of COMUNICADOS) {
      const programado = pub !== null && pub > 0;
      unico('comunicados', 'SELECT id FROM comunicados WHERE slug = ?', [slug],
        'INSERT INTO comunicados (slug, titulo, resumo, corpo, categoria, prioridade, status, imagem, exibir_de, publicado_em, exige_leitura, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [slug, titulo, resumo, corpo(resumo), cat, prio, status, urlCapa(tema), programado ? d(pub) : null, pub === null ? null : d(pub), exige ? 1 : 0, agora, agora]);
    }

    DOCS.forEach(([slug, t, c, r, f, v, resp, cl], i) => unico('documentos', 'SELECT id FROM documentos WHERE slug = ?', [slug],
      'INSERT INTO documentos (slug, titulo, categoria, resumo, formato, versao, responsavel, classificacao, link_oficial, revisado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [slug, t, c, r, f, v, resp, cl, cl === 'restrito' ? null : `https://documentos.aurora-esportes.invalid/${slug}`, d(-5 - i * 7), agora]));

    // Contatos por área. Departamento só é anotado se foi criado agora (não apagamos área que já existia).
    for (const [area, nome, canal] of CONTATOS) {
      let depto = db.prepare('SELECT id FROM departamentos WHERE nome = ?').get(area) as { id: number } | undefined;
      if (!depto) {
        depto = { id: Number(db.prepare('INSERT INTO departamentos (nome) VALUES (?)').run(area).lastInsertRowid) };
        marcar('departamentos', depto.id);
      }
      unico('contatos', 'SELECT id FROM contatos WHERE departamento_id = ? AND nome = ?', [depto.id, nome], 'INSERT INTO contatos (departamento_id, nome, canal, publicavel) VALUES (?, ?, ?, 1)', [depto.id, nome, canal]);
    }

    // Colaboradores destaque (do mês e de meses anteriores deste ano).
    const mes = hoje.getMonth() + 1, ano = hoje.getFullYear();
    const periodo = (rotulo: string) => {
      let p = db.prepare("SELECT id FROM periodos_destaque WHERE tipo = 'mes' AND rotulo = ?").get(rotulo) as { id: number } | undefined;
      if (!p) {
        p = { id: Number(db.prepare("INSERT INTO periodos_destaque (tipo, rotulo, status) VALUES ('mes', ?, 'publicado')").run(rotulo).lastInsertRowid) };
        marcar('periodos_destaque', p.id);
      }
      return p.id;
    };
    const DESTAQUES: [string, string, string, number][] = [
      [NOMES[0], 'Costura', 'Reconhecida por ajudar colegas novos na célula.', mes], [NOMES[1], 'Qualidade', 'Reconhecido pela atenção aos detalhes.', mes],
      [NOMES[2], 'Expedição', 'Reconhecida por organizar o embarque no prazo.', mes],
      [NOMES[3], 'Corte', 'Reconhecido por sugestões de melhoria ao longo do ano.', Math.max(1, mes - 2)], [NOMES[4], 'Manutenção', 'Reconhecida por reduzir paradas de máquina.', Math.max(1, mes - 4)],
    ];
    DESTAQUES.forEach(([nome, area, ap, m], i) => {
      const pid = periodo(`${MESES[m - 1]}/${ano}`);
      const iniciais = nome.split(' ').map((p) => p[0]).join('').slice(0, 2);
      unico('destaques', 'SELECT id FROM destaques WHERE nome = ?', [nome],
        "INSERT INTO destaques (periodo_id, nome, area, iniciais, apresentacao, foto_aprovada, consentimento_ref, status, mes, ano) VALUES (?, ?, ?, ?, ?, ?, 'exemplo-ficticio', 'aprovado', ?, ?)",
        [pid, nome, area, iniciais, ap, urlAvatar(i), m, ano]);
    });

    // Banners dos carrosséis do Início.
    const BANNERS: [string, string | null, TemaCapa, string, string, 'principal' | 'lateral1' | 'lateral2', number][] = [
      ['Nova coleção de verão chega à fábrica', 'Linha, prazos e células envolvidas.', 'colecao', 'Saiba mais', '#comunicados/ex-nova-colecao', 'principal', 1],
      ['Campanha do agasalho', 'Pontos de coleta em cada portaria até o fim do mês.', 'campanha', 'Ver comunicado', '#comunicados/ex-campanha-agasalho', 'principal', 2],
      ['Simulado de evacuação na quinta', 'Atenção ao sinal sonoro às 10h.', 'seguranca', 'Ver comunicado', '#comunicados/ex-simulado-evacuacao', 'principal', 3],
      ['Treinamento de qualidade', null, 'treinamento', 'Inscreva-se', '#comunicados/ex-treinamento-qualidade', 'lateral1', 1],
      ['Confraternização de fim de ano', null, 'eventos', 'Saiba mais', '#comunicados/ex-confraternizacao', 'lateral1', 2],
      ['Meta do mês: balanço parcial', null, 'resultados', 'Ver balanço', '#comunicados/ex-resultado-meta', 'lateral2', 1],
      ['Janela de manutenção do sistema', null, 'ti', 'Ver aviso', '#comunicados/ex-manutencao-sistema', 'lateral2', 2],
    ];
    for (const [titulo, sub, tema, botao, link, pos, ordem] of BANNERS) {
      unico('banners', 'SELECT id FROM banners WHERE titulo = ? AND posicao = ?', [titulo, pos],
        'INSERT INTO banners (titulo, subtitulo, imagem, botao_texto, link, posicao, ordem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [titulo, sub, urlCapa(tema), botao, link, pos, ordem, agora, agora]);
    }

    // Aniversariantes (mês atual) e novos colaboradores.
    NOMES.slice(5, 11).forEach((nome, i) => {
      const diaMes = Math.min(28, 3 + i * 4);
      unico('aniversariantes', 'SELECT id FROM aniversariantes WHERE nome = ?', [nome],
        'INSERT INTO aniversariantes (nome, area, dia, mes, admissao, foto, autorizado) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [nome, AREAS[(i + 3) % AREAS.length], diaMes, mes, `${ano - 1 - (i % 5)}-${String(mes).padStart(2, '0')}-${String(Math.min(28, diaMes + 2)).padStart(2, '0')}`, urlAvatar(i + 5)]);
    });
    ['André Siqueira', 'Patrícia Moura', 'Felipe Rangel', 'Isabela Cunha'].forEach((nome, i) => {
      unico('novos_colaboradores', 'SELECT id FROM novos_colaboradores WHERE nome = ?', [nome],
        'INSERT INTO novos_colaboradores (nome, area, funcao, entrada, mensagem, foto, autorizado) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [nome, AREAS[(i + 6) % AREAS.length], ['Analista', 'Auxiliar de produção', 'Assistente', 'Coordenadora'][i], d(-3 - i * 6), 'Seja bem-vindo(a) à Aurora! (mensagem de exemplo)', urlAvatar(i + 9)]);
    });

    // Calendário da empresa.
    const EVENTOS: [number, number | null, string, 'evento' | 'facultativo'][] = [
      [2, null, 'Reunião geral de resultados', 'evento'], [5, null, 'Treinamento de segurança (turma 1)', 'evento'], [9, 11, 'Semana da qualidade', 'evento'],
      [14, null, 'Confraternização das áreas', 'evento'], [20, null, 'Ponto facultativo (exemplo)', 'facultativo'], [27, null, 'Inventário do estoque', 'evento'],
    ];
    for (const [n, fim, titulo, tipo] of EVENTOS) {
      unico('calendario_datas', 'SELECT id FROM calendario_datas WHERE data = ? AND titulo = ?', [d(n), titulo],
        'INSERT INTO calendario_datas (data, data_fim, titulo, tipo, anual, criado_em) VALUES (?, ?, ?, ?, 0, ?)', [d(n), fim === null ? null : d(fim), titulo, tipo, agora]);
    }

    // Pesquisa de pulso: abre só se não houver outra aberta (uma por vez, no exemplo).
    const aberta = db.prepare("SELECT 1 FROM pulsos WHERE status = 'aberto'").get();
    const idPulso = unico('pulsos', 'SELECT id FROM pulsos WHERE pergunta = ?', [PERGUNTA_PULSO],
      'INSERT INTO pulsos (pergunta, status, criado_em, aberto_em) VALUES (?, ?, ?, ?)', [PERGUNTA_PULSO, aberta ? 'rascunho' : 'aberto', agora, aberta ? null : agora]);
    if (!db.prepare('SELECT 1 FROM pulso_perguntas WHERE pulso_id = ?').get(idPulso))
      db.prepare("INSERT INTO pulso_perguntas (pulso_id, ordem, texto, tipo, obrigatoria) VALUES (?, 0, ?, 'nota', 1)").run(idPulso, PERGUNTA_PULSO);

    // Pesquisas encerradas, já com respostas inventadas, para testar a tela de Resultado (uma anônima e uma identificada).
    const colegas: number[] = [];
    for (let k = 1; k <= 30; k++) {
      const login = `colega${String(k).padStart(2, '0')}.demo`;
      colegas.push(unico('usuarios', 'SELECT id FROM usuarios WHERE login = ?', [login], 'INSERT INTO usuarios (login, nome, senha_hash, perfil, ativo, criado_em) VALUES (?, ?, ?, ?, 0, ?)',
        [login, `Colaborador ${String(k).padStart(2, '0')} (exemplo)`, hashSenha(randomBytes(18).toString('hex')), 'consulta', agora]) as number);
    }
    let semente = 12345;
    const sorte = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
    const pesos = <T,>(itens: [T, number][]): T => { let x = sorte() * itens.reduce((a, i) => a + i[1], 0); for (const [v, p] of itens) { x -= p; if (x <= 0) return v; } return itens[itens.length - 1][0]; };
    const pesquisaPronta = (titulo: string, descricao: string, anonima: boolean, qtd: number,
      perguntas: { texto: string; tipo: 'nota' | 'unica' | 'multipla' | 'texto'; opcoes?: string[]; comentario?: boolean }[],
      gerar: (q: { tipo: string; opcoes: string[] }, n: number) => { valor: string; comentario?: string }[], liberar = false) => {
      const idp = unico('pulsos', 'SELECT id FROM pulsos WHERE pergunta = ?', [titulo],
        'INSERT INTO pulsos (pergunta, descricao, status, anonima, criado_em, aberto_em, encerrado_em) VALUES (?, ?, ?, ?, ?, ?, ?)', [titulo, descricao, 'encerrado', anonima ? 1 : 0, agora, agora, agora]) as number;
      if (db.prepare('SELECT 1 FROM pulso_perguntas WHERE pulso_id = ?').get(idp)) return;
      const qs = perguntas.map((q, ordem) => ({ ...q, opcoes: q.opcoes ?? [], id: Number(db.prepare('INSERT INTO pulso_perguntas (pulso_id, ordem, texto, tipo, obrigatoria, opcoes, permite_comentario) VALUES (?, ?, ?, ?, 1, ?, ?)')
        .run(idp, ordem, q.texto, q.tipo, q.opcoes ? JSON.stringify(q.opcoes.map((t) => ({ texto: t, imagem: null }))) : null, q.comentario ? 1 : 0).lastInsertRowid) }));
      for (let n = 0; n < qtd; n++) {
        db.prepare('INSERT INTO pulso_participacao (pulso_id, usuario_id) VALUES (?, ?)').run(idp, colegas[n]);
        for (const q of qs) for (const r of gerar(q, n))
          db.prepare('INSERT INTO pulso_respostas_item (pulso_id, pergunta_id, valor, comentario, dia, usuario_id) VALUES (?, ?, ?, ?, ?, ?)').run(idp, q.id, r.valor, r.comentario ?? null, d(-2), anonima ? null : colegas[n]);
      }
      // exemplo já liberado aos colaboradores: resultado de todas as perguntas, só as respostas em texto da última (os comentários da nota ficam ocultos)
      if (liberar) {
        db.prepare('UPDATE pulsos SET resultado_liberado = 1, liberado_em = ? WHERE id = ?').run(agora, idp);
        db.prepare("UPDATE pulso_perguntas SET publico_textos = 1 WHERE pulso_id = ? AND tipo = 'texto'").run(idp);
      }
    };
    const COMENT = ['Ótimo ambiente de trabalho.', 'Gostaria de mais momentos de integração.', 'Equipe unida e prestativa.', 'A comunicação entre as áreas pode melhorar.', 'Me sinto valorizado(a) aqui.'];
    const SUGEST = ['Mais opções para vegetarianos.', 'Local com estacionamento.', 'Horário um pouco mais cedo.', 'Sorteio de brindes maiores.', 'Música ao vivo, de preferência pagode.', 'Espaço para as crianças.'];
    const CARDAPIO = ['Churrasco, arroz, feijão tropeiro e salada', 'Massas e saladas', 'Feijoada completa', 'Buffet de pratos executivos'];
    const ATRACOES = ['Banda ao vivo', 'DJ', 'Sorteio de brindes', 'Karaokê', 'Brincadeiras e gincanas'];
    pesquisaPronta('Festa de final de ano (exemplo)', 'Ajude a escolher a festa da empresa. Pesquisa de exemplo com respostas inventadas.', true, 28, [
      { texto: 'O que você acha da empresa?', tipo: 'nota', comentario: true },
      { texto: 'Qual cardápio você quer para a festa de final de ano?', tipo: 'unica', opcoes: CARDAPIO },
      { texto: 'Quais atrações você gostaria de ter?', tipo: 'multipla', opcoes: ATRACOES },
      { texto: 'Deixe uma sugestão para a festa', tipo: 'texto' },
    ], (q, n) => {
      if (q.tipo === 'nota') return [{ valor: String(pesos([[5, 9], [4, 11], [3, 5], [2, 2], [1, 1]])), comentario: n % 3 === 0 ? COMENT[n % COMENT.length] : undefined }];
      if (q.tipo === 'unica') return [{ valor: pesos(q.opcoes.map((o, i) => [o, [12, 6, 4, 2][i]] as [string, number])) }];
      if (q.tipo === 'multipla') return q.opcoes.filter((_, i) => sorte() < [0.7, 0.45, 0.8, 0.3, 0.35][i]).map((valor) => ({ valor }));
      return n % 3 === 1 ? [{ valor: SUGEST[n % SUGEST.length] }] : [];
    }, true);
    pesquisaPronta('Clima da equipe (exemplo, identificada)', 'Pesquisa identificada de exemplo: o RH vê quem respondeu.', false, 12, [
      { texto: 'Como você avalia o clima da sua equipe?', tipo: 'nota' },
      { texto: 'O que mais ajudaria o seu dia a dia?', tipo: 'unica', opcoes: ['Mais treinamento', 'Melhor comunicação', 'Mais flexibilidade de horário', 'Ferramentas melhores'] },
    ], (q) => q.tipo === 'nota' ? [{ valor: String(pesos([[5, 4], [4, 6], [3, 3], [2, 1]])), comentario: undefined }] : [{ valor: pesos(q.opcoes.map((o, i) => [o, [3, 5, 2, 4][i]] as [string, number])) }]);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return estadoExemplo(db);
}

/** Remove o que as versões antigas do exemplo (Di Paula / "demo-*") criaram, para não misturar com o pacote novo. */
function limparLegado(db: Banco) {
  db.prepare("DELETE FROM comunicados WHERE slug LIKE 'demo-%'").run();
  db.prepare("DELETE FROM documentos WHERE slug LIKE 'demo-%' OR slug LIKE '%-exemplo'").run();
  db.prepare("DELETE FROM banners WHERE link LIKE '#comunicados/demo-%'").run();
  db.prepare("DELETE FROM destaques WHERE consentimento_ref = 'exemplo-ficticio' AND id NOT IN (SELECT CAST(chave AS INTEGER) FROM dados_exemplo WHERE tabela = 'destaques')").run();
  db.prepare('DELETE FROM periodos_destaque WHERE id NOT IN (SELECT periodo_id FROM destaques)').run();
  db.prepare("DELETE FROM aplicacoes WHERE slug = 'meu-rh' AND url LIKE '%dipaula%'").run();
  db.prepare("DELETE FROM contatos WHERE canal LIKE '%exemplo.invalid%' OR canal LIKE '%(exemplo)'").run();
}

export function desativarExemplo(db: Banco): Estado {
  const linhas = db.prepare('SELECT tabela, chave, anterior, aplicado FROM dados_exemplo').all() as { tabela: string; chave: string; anterior: string | null; aplicado: string | null }[];
  const de = (t: string) => linhas.filter((l) => l.tabela === t);
  db.exec('BEGIN');
  try {
    const apagar = (tabela: string, col: string, chaves: (string | number)[]) => {
      const st = db.prepare(`DELETE FROM ${tabela} WHERE ${col} = ?`);
      for (const c of chaves) st.run(c);
    };
    for (const t of ['comunicados', 'documentos', 'banners', 'destaques', 'contatos', 'calendario_datas', 'aniversariantes', 'novos_colaboradores', 'pulsos']) {
      apagar(t, 'id', de(t).map((l) => Number(l.chave)));
    }
    apagar('aplicacoes', 'slug', de('aplicacoes').map((l) => l.chave));
    // Só some o período/departamento que o exemplo criou e que ficou vazio.
    for (const l of de('periodos_destaque')) db.prepare('DELETE FROM periodos_destaque WHERE id = ? AND NOT EXISTS (SELECT 1 FROM destaques WHERE periodo_id = ?)').run(Number(l.chave), Number(l.chave));
    for (const l of de('departamentos')) db.prepare('DELETE FROM departamentos WHERE id = ? AND NOT EXISTS (SELECT 1 FROM contatos WHERE departamento_id = ?)').run(Number(l.chave), Number(l.chave));
    // Usuários: se algo ainda aponta para eles, apenas desativa.
    for (const l of de('usuarios')) {
      try {
        db.exec('SAVEPOINT usu');
        db.prepare('DELETE FROM usuarios WHERE id = ?').run(Number(l.chave));
        db.exec('RELEASE usu');
      } catch {
        db.exec('ROLLBACK TO usu');
        db.exec('RELEASE usu');
        db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(Number(l.chave));
      }
    }
    // Configurações: volta o que havia antes, mas só se ninguém mexeu depois de ligar o exemplo.
    for (const [tabela, col] of [['portal_config', 'valor'], ['institucional', 'texto']] as const) {
      for (const l of de(tabela)) {
        const atual = db.prepare(`SELECT ${col} AS v FROM ${tabela} WHERE chave = ?`).get(l.chave) as { v: string } | undefined;
        if (atual && atual.v !== l.aplicado) continue;
        if (l.anterior === null) db.prepare(`DELETE FROM ${tabela} WHERE chave = ?`).run(l.chave);
        else db.prepare(`UPDATE ${tabela} SET ${col} = ?, atualizado_em = ? WHERE chave = ?`).run(l.anterior, new Date().toISOString(), l.chave);
      }
    }
    apagar('imagens_arquivo', 'nome', de('imagens_arquivo').map((l) => l.chave));
    db.exec('DELETE FROM dados_exemplo');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return estadoExemplo(db);
}
