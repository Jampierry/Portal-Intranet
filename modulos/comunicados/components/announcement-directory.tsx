"use client";

import { useMemo, useState } from "react";
import { AnnouncementList } from "@/modulos/comunicados/components/announcement-list";
import { Icon } from "@/compartilhado/icons";
import type { Announcement } from "@/modulos/comunicados/data/announcements";

type AnnouncementDirectoryProps = {
  items: Announcement[];
};

export function AnnouncementDirectory({ items }: AnnouncementDirectoryProps) {
  const categories = useMemo(() => ["Todas", ...new Set(items.map((item) => item.category))], [items]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === "Todas" || item.category === selectedCategory;
    const matchesQuery = !normalizedQuery ||
      [item.category, item.title, item.summary].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
    return matchesCategory && matchesQuery;
  });
  const clearFilters = () => {
    setQuery("");
    setSelectedCategory("Todas");
  };

  return (
    <section className="announcement-directory" aria-labelledby="announcement-directory-heading">
      <div className="announcement-directory-intro">
        <div>
          <p className="section-kicker">FIQUE POR DENTRO</p>
          <h2 id="announcement-directory-heading">Avisos da equipe</h2>
          <p>Uma central de avisos para acompanhar o que acontece na equipe.</p>
        </div>
        <span className="demo-content-badge"><Icon name="info" /> Conteúdo fictício</span>
      </div>

      <div className="announcement-filter-panel">
        <label className="announcement-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, tema ou categoria"
            aria-label="Buscar comunicados por título, tema ou categoria"
          />
        </label>

        <div className="announcement-filter-row">
          <div className="announcement-category-filters" role="group" aria-label="Filtrar comunicados por categoria">
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
          <span className="announcement-results" aria-live="polite">
            {filteredItems.length} {filteredItems.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <AnnouncementList items={filteredItems} />
      ) : (
        <div className="empty-state announcement-empty-state" role="status">
          <span className="empty-state-icon"><Icon name="search" /></span>
          <h3>Nenhum comunicado encontrado</h3>
          <p>{query.trim() ? `Não encontramos resultados para “${query.trim()}”.` : "Não há comunicados nesta categoria."} Tente outro termo ou limpe os filtros.</p>
          <button className="text-link clear-filters-button" type="button" onClick={clearFilters}>
            Limpar busca e filtros <Icon name="arrowRight" />
          </button>
        </div>
      )}

      <p className="announcement-demo-note"><Icon name="info" /> Esta tela é um protótipo. Os títulos, datas e resumos são fictícios e não representam orientações ou comunicados oficiais da empresa.</p>
    </section>
  );
}
