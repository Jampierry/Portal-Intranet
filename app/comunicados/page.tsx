import type { Metadata } from "next";
import { AnnouncementDirectory } from "@/modulos/comunicados/components/announcement-directory";
import { announcements } from "@/modulos/comunicados/data/announcements";
import { PortalShell } from "@/modulos/shell/portal-shell";

export const metadata: Metadata = { title: "Comunicados" };

export default function AnnouncementsPage() {
  return (
    <PortalShell active="announcements">
      <div className="page-stack page-stack-narrow">
        <header className="page-heading">
          <p className="section-kicker">CENTRAL DE AVISOS</p>
          <p>Acompanhe os avisos da equipe, com busca e filtros por categoria.</p>
        </header>
        <AnnouncementDirectory items={announcements} />
      </div>
    </PortalShell>
  );
}
