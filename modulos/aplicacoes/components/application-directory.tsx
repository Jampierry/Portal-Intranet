"use client";

import { useEffect, useState } from "react";
import { ApplicationCard } from "@/modulos/aplicacoes/components/application-card";
import { Icon } from "@/compartilhado/icons";
import type { Application } from "@/modulos/aplicacoes/data/applications";

export function ApplicationDirectory({ items }: { items: Application[] }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q")?.trim() ?? "");
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredApplications = items.filter((app) =>
    [app.name, app.category, app.description, app.access].some((value) =>
      value.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
    ),
  );

  return (
    <section className="application-directory" aria-labelledby="application-list-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">PESSOAS E GESTÃO</p>
          <h2 id="application-list-heading">Acessos disponíveis</h2>
        </div>
        <span className="section-count">
          {filteredApplications.length} {filteredApplications.length === 1 ? "aplicação" : "aplicações"}
        </span>
      </div>

      {filteredApplications.length > 0 ? (
        <div className="application-list">
          {filteredApplications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      ) : (
        <div className="empty-state" role="status">
          <span className="empty-state-icon"><Icon name="search" /></span>
          <h3>Nenhuma aplicação encontrada</h3>
          <p>Não encontramos resultados para “{query}”. Tente outro termo.</p>
          <a className="text-link" href="/aplicacoes/">Limpar busca <Icon name="arrowRight" /></a>
        </div>
      )}

      <p className="privacy-note"><Icon name="info" /> O acesso ao Meu RH é restrito a colaboradores Di Paula e pode exigir autenticação corporativa.</p>
    </section>
  );
}
