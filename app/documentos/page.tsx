import type { Metadata } from "next";
import { DocumentDirectory } from "@/modulos/documentos/components/document-directory";
import { documents } from "@/modulos/documentos/data/documents";
import { PortalShell } from "@/modulos/shell/portal-shell";

export const metadata: Metadata = { title: "Documentos" };

export default function DocumentsPage() {
  return (
    <PortalShell active="documents">
      <div className="page-stack page-stack-narrow">
        <header className="page-heading">
          <p className="section-kicker">BIBLIOTECA</p>
          <p>Catálogo demonstrativo de políticas, procedimentos e materiais.</p>
        </header>
        <DocumentDirectory items={documents} />
      </div>
    </PortalShell>
  );
}
