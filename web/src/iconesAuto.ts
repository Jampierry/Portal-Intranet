// Escolhe o ícone de um item (aplicativo, documento, comunicado) pelo nome e pela categoria.
// A primeira regra que combinar vence; sem combinação, quem chama usa o ícone padrão da tela.

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const REGRAS: [string, RegExp][] = [
  ['relogio', /\b(ponto|jornada|frequencia|banco de horas|horas extras?)\b/],
  ['pessoas', /\b(rh|recursos humanos|pessoas|colaboradores?|funcionarios?|holerite|folha|beneficios?|ferias|admissao|demissao|contracheque)\b/],
  ['dinheiro', /\b(financeiro|financas|contabil\w*|fiscal|pagamentos?|despesas?|viagens?|reembolso|nota fiscal|tesouraria|custos?|orcamento|comissao|premiacao)\b/],
  ['carrinho', /\b(compras?|comercial|vendas?|clientes?|pedidos?|loja|lojas|e-?commerce|representantes?|catalogo)\b/],
  ['chat', /\b(chamados?|suporte|helpdesk|atendimento|sac|ouvidoria|contato)\b/],
  ['monitor', /\b(ti|tecnologia|infra\w*|software|rede|senha|sistemas?|computador\w*|erp)\b/],
  ['escudo', /\b(seguranca|epi|cipa|lgpd|privacidade|compliance|conduta|etica|auditoria)\b/],
  ['qualidade', /\b(qualidade|inspecao|conformidade)\b/],
  ['caminhao', /\b(logistica|expedicao|transporte|entregas?|frete|embarque)\b/],
  ['pacote', /\b(estoque|almoxarifado|inventario|suprimentos|materiais|material)\b/],
  ['tesoura', /\b(corte|costura|modelagem|enfesto|risco|acabamento)\b/],
  ['fabrica', /\b(producao|pcp|fabrica|industrial|operacao|eventos?)\b/],
  ['ferramenta', /\b(manutencao|mecanica|ferramentas?|equipamentos?|maquinas?)\b/],
  ['capelo', /\b(treinamentos?|capacitacao|cursos?|aprendizado|universidade|educacao|ead)\b/],
  ['dashboard', /\b(indicadores?|dashboard|bi|relatorios?|resultados?|desempenho|analises?|paineis|painel|metas?)\b/],
  ['calendario', /\b(agenda|calendario|reunioes?|salas?)\b/],
  ['colecoes', /\b(colecao|colecoes|moda|design|desenvolvimento|produtos?)\b/],
  ['documentos', /\b(documentos?|politicas?|normas?|procedimentos?|manual|manuais|regulamentos?|contratos?)\b/],
  ['comunicados', /\b(comunicados?|avisos?|noticias?|campanhas?|comunicacao)\b/],
  ['ajuda', /\b(ajuda|faq|duvidas?)\b/],
];

/** Nome do ícone (chave de icones.tsx) para o texto, ou o padrão informado quando nada combina. */
export function iconePorTexto(texto: string, padrao: string): string {
  const t = sem(texto);
  return REGRAS.find(([, re]) => re.test(t))?.[0] ?? padrao;
}

/** Opções de ícone para escolher à mão no cadastro de aplicativos (o primeiro é o automático). */
export const ICONES_ESCOLHA: [string, string][] = [
  ['auto', 'Automático (pela categoria e nome)'], ['aplicacoes', 'Aplicações (genérico)'], ['pessoas', 'Pessoas e RH'], ['relogio', 'Ponto e jornada'], ['dinheiro', 'Financeiro'],
  ['carrinho', 'Comercial e compras'], ['chat', 'Chamados e suporte'], ['monitor', 'Tecnologia (TI)'], ['escudo', 'Segurança e compliance'], ['qualidade', 'Qualidade'],
  ['caminhao', 'Logística'], ['pacote', 'Estoque e materiais'], ['tesoura', 'Corte e costura'], ['fabrica', 'Produção'], ['ferramenta', 'Manutenção'],
  ['capelo', 'Treinamento'], ['dashboard', 'Indicadores e relatórios'], ['calendario', 'Agenda'], ['colecoes', 'Coleções e produtos'], ['documentos', 'Documentos'],
];
