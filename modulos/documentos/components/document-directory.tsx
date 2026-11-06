"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/compartilhado/icons";
import type { DocumentRecord } from "@/modulos/documentos/data/documents";

export function DocumentDirectory({ items }: { items: DocumentRecord[] }) {
  const categories = useMemo(() => ["Todas", ...new Set(items.map((item) => item.category))], [items]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === "Todas" || item.category === selectedCategory;
    const matchesQuery = !normalizedQuery ||
      [item.title, item.category, item.summary, item.format].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
      );
    return matchesCategory && matchesQuery;
  });

  const clearFilters = () => {
    setQuery("");
    setSelectedCategory("Todas");
  };

  return (
    <section className="document-directory" aria-labelledby="document-directory-heading">
      <div className="document-directory-intro">
        <div>
          <p className="section-kicker">MATERIAIS DA EQUIPE</p>
          <h2 id="document-directory-heading">Materiais de consulta</h2>
          <p>Encontre modelos e materiais organizados por assunto.</p>
        </div>
        <span className="demo-content-badge"><Icon name="info" /> Demonstração</span>
      </div>

      <div className="document-filter-panel">
        <label className="document-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, assunto ou categoria"
            aria-label="Buscar documentos por título, assunto ou categoria"
          />
        </label>

        <div className="document-filter-row">
          <div className="document-category-filters" role="group" aria-label="Filtrar documentos por categoria">
            {categories.map((category) => (
              <button
                key={category}
                className={`filter-chip${selectedCategory === category ? " filter-chip-active" : ""}`}
                type="button"
                aria-pressed={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <span className="document-results" aria-live="polite">
            {filteredItems.length} {filteredItems.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <div className="document-card-list">
          {filteredItems.map((item) => (
            <article className="document-card" key={item.id}>
              <div className="document-card-head">
                <span className="document-icon"><Icon name="file" /></span>
                <span className="document-category">{item.category}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="document-summary">{item.summary}</p>
              <div className="document-card-foot">
                <span className="document-format">{item.format}</span>
                <span className="document-no-file">Sem arquivo</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state document-empty-state" role="status">
          <span className="empty-state-icon"><Icon name="search" /></span>
          <h3>Nenhum documento encontrado</h3>
          <p>{query.trim() ? `Não encontramos resultados para “${query.trim()}”.` : "Não há documentos nesta categoria."} Tente outro termo ou limpe os filtros.</p>
          <button className="text-link clear-filters-button" type="button" onClick={clearFilters}>
            Limpar busca e filtros <Icon name="arrowRight" />
          </button>
        </div>
      )}

      <p className="document-demo-note"><Icon name="info" /> Os títulos, categorias, resumos e formatos desta tela são fictícios. Nenhum documento real está anexado e não há downloads disponíveis no protótipo.</p>
    </section>
  );
}
