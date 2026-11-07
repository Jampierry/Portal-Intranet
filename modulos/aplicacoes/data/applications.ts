// Ícones aceitos no catálogo (resto do sistema usa o nome como texto).
export type IconName = string;

export type Application = {
  id: string;
  name: string;
  description: string;
  category: string;
  href: string;
  access: string;
  icon: IconName;
};

export const applications: Application[] = [
  {
    id: "meu-rh",
    name: "Meu RH",
    description: "Pessoas e gestão em um só lugar: férias, salário, cargo e documentos.",
    category: "Pessoas e RH",
    href: "https://meurh.dipaula.com.br/dashboard",
    access: "Acesso restrito a colaboradores Di Paula; pode solicitar conta corporativa.",
    icon: "users",
  },
];
