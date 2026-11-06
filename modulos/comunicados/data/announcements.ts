export type Announcement = {
  id: string;
  category: string;
  title: string;
  summary: string;
  dateLabel: string;
  tone: "people" | "operations" | "quality";
};

export const announcements: Announcement[] = [
  {
    id: "demo-pessoas",
    category: "Pessoas",
    title: "Exemplo: informações úteis para a equipe",
    summary: "Conteúdo demonstrativo para representar um comunicado de Pessoas e RH. Substituir por texto aprovado antes do uso real.",
    dateLabel: "05 nov 2026",
    tone: "people",
  },
  {
    id: "demo-operacao",
    category: "Operação",
    title: "Exemplo: atualização de rotina",
    summary: "Este cartão ilustra como avisos operacionais podem aparecer na home. Não representa uma orientação oficial.",
    dateLabel: "04 nov 2026",
    tone: "operations",
  },
  {
    id: "demo-qualidade",
    category: "Qualidade",
    title: "Exemplo: procedimento em revisão",
    summary: "A área, responsável e vigência devem ser confirmados antes de publicar qualquer procedimento real.",
    dateLabel: "03 nov 2026",
    tone: "quality",
  },
  {
    id: "demo-pessoas-2",
    category: "Pessoas",
    title: "Exemplo: agenda de ações da equipe",
    summary: "Exemplo de pauta para avisos internos. Datas, inscrições e responsáveis devem ser aprovados antes de qualquer divulgação.",
    dateLabel: "02 nov 2026",
    tone: "people",
  },
  {
    id: "demo-operacao-2",
    category: "Operação",
    title: "Exemplo: informação de rotina da confecção",
    summary: "Texto ilustrativo para a categoria Operação; não contém instrução de trabalho nem orientação vigente.",
    dateLabel: "01 nov 2026",
    tone: "operations",
  },
  {
    id: "demo-qualidade-2",
    category: "Qualidade",
    title: "Exemplo: lembrete sobre materiais de apoio",
    summary: "Exemplo visual de comunicado. Documentos, padrões e versões oficiais serão definidos pela área responsável.",
    dateLabel: "31 out 2026",
    tone: "quality",
  },
];
