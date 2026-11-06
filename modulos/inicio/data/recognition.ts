export type RecognitionPeriod = "month" | "year";

export type RecognitionEntry = {
  id: string;
  name: string;
  role: string;
  initials: string;
  note: string;
  period: string;
};

export const recognition: Record<RecognitionPeriod, RecognitionEntry[]> = {
  month: [
    {
      id: "exemplo-mes-1",
      name: "Pessoa de demonstração 01",
      role: "Área demonstrativa",
      initials: "01",
      note: "Exemplo de reconhecimento por colaboração e troca de conhecimento.",
      period: "Novembro 2026",
    },
    {
      id: "exemplo-mes-2",
      name: "Pessoa de demonstração 02",
      role: "Área demonstrativa",
      initials: "02",
      note: "Exemplo de reconhecimento por cuidado com a qualidade do trabalho.",
      period: "Novembro 2026",
    },
    {
      id: "exemplo-mes-3",
      name: "Pessoa de demonstração 03",
      role: "Área demonstrativa",
      initials: "03",
      note: "Exemplo de reconhecimento por apoio e parceria no dia a dia.",
      period: "Novembro 2026",
    },
  ],
  year: [
    {
      id: "exemplo-ano-1",
      name: "Pessoa de demonstração 04",
      role: "Área demonstrativa",
      initials: "04",
      note: "Exemplo de contribuição para a colaboração entre áreas.",
      period: "Destaque do ano — 2026",
    },
    {
      id: "exemplo-ano-2",
      name: "Pessoa de demonstração 05",
      role: "Área demonstrativa",
      initials: "05",
      note: "Exemplo de contribuição com foco em melhoria contínua.",
      period: "Destaque do ano — 2026",
    },
    {
      id: "exemplo-ano-3",
      name: "Pessoa de demonstração 06",
      role: "Área demonstrativa",
      initials: "06",
      note: "Exemplo de atitude de cuidado e cooperação.",
      period: "Destaque do ano — 2026",
    },
    {
      id: "exemplo-ano-4",
      name: "Pessoa de demonstração 07",
      role: "Área demonstrativa",
      initials: "07",
      note: "Exemplo de reconhecimento com texto editorial aprovado.",
      period: "Destaque do ano — 2026",
    },
  ],
};
