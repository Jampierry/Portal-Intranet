import type { Metadata } from "next";
import { ApplicationDirectory } from "@/modulos/aplicacoes/components/application-directory";
import { PortalShell } from "@/modulos/shell/portal-shell";
import { applications } from "@/modulos/aplicacoes/data/applications";

export const metadata: Metadata = {
  title: "Aplicações",
};

export default function ApplicationsPage() {
  return (
    <PortalShell active="applications">
      <div className="page-stack page-stack-narrow">
        <header className="page-heading">
          <p className="section-kicker">FERRAMENTAS DO DIA A DIA</p>
          <p>Encontre em um só lugar os sistemas web usados pela equipe.</p>
        </header>
        <ApplicationDirectory items={applications} />
      </div>
    </PortalShell>
  );
}
