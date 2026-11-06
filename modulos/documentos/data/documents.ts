export type DocumentRecord = {
  id: string;
  title: string;
  category: string;
  summary: string;
  format: string;
};

export const documents: DocumentRecord[] = [
  {
    id: "guia-integracao-exemplo",
    title: "Exemplo: guia de integração",
    category: "Institucional",
    summary: "Registro fictício para mostrar como um material de boas-vindas poderia aparecer na biblioteca.",
    format: "PDF de demonstração",
  },
  {
    id: "solicitacao-ferias-exemplo",
    title: "Exemplo: solicitação de férias",
    category: "Pessoas e RH",
    summary: "Item ilustrativo de um possível formulário; não contém regras ou procedimentos reais da empresa.",
    format: "PDF de demonstração",
  },
  {
    id: "checklist-conferencia-exemplo",
    title: "Exemplo: checklist de conferência",
    category: "Operações",
    summary: "Conteúdo inventado para demonstrar a organização de materiais de apoio operacional.",
    format: "Planilha de demonstração",
  },
  {
    id: "inspecao-peca-exemplo",
    title: "Exemplo: ficha de inspeção de peça",
    category: "Qualidade",
    summary: "Registro fictício relacionado ao contexto de confecção; não é um padrão nem instrução de trabalho.",
    format: "PDF de demonstração",
  },
  {
    id: "cadastro-material-exemplo",
    title: "Exemplo: cadastro de materiais",
    category: "Produto e Desenvolvimento",
    summary: "Amostra sem dados reais para visualizar uma futura categoria de documentos de produto.",
    format: "Planilha de demonstração",
  },
];
