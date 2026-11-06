import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Portal Intranet | Di Paula",
    template: "%s | Portal Intranet Di Paula",
  },
  description: "Acesso interno Di Paula — aplicações, comunicados e informações do dia a dia.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
