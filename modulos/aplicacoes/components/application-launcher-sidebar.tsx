"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/compartilhado/icons";
import { applications } from "@/modulos/aplicacoes/data/applications";

const FAVORITES_KEY = "dp-intranet-app-favorites";
type LauncherTab = "favorites" | "all";

export function ApplicationLauncherSidebar({
  expanded,
  onToggleAction,
  onCloseAction,
}: {
  expanded: boolean;
  onToggleAction: () => void;
  onCloseAction: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LauncherTab>("favorites");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FAVORITES_KEY);
      if (saved === null) {
        setFavoriteIds(applications[0] ? [applications[0].id] : []);
      } else {
        const parsed: unknown = JSON.parse(saved);
        const validIds = new Set(applications.map((app) => app.id));
        setFavoriteIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && validIds.has(id)) : []);
      }
    } catch {
      setFavoriteIds(applications[0] ? [applications[0].id] : []);
    }
    setFavoritesLoaded(true);
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // O lançador continua utilizável mesmo se o navegador bloquear o armazenamento local.
    }
  }, [favoriteIds, favoritesLoaded]);

  const visibleApplications = activeTab === "all"
    ? applications
    : applications.filter((app) => favoriteIds.includes(app.id));
  const favoriteApplications = applications.filter((app) => favoriteIds.includes(app.id));

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => current.includes(id)
      ? current.filter((favoriteId) => favoriteId !== id)
      : [...current, id]);
  };

  return (
    <>
      {expanded ? (
        <button
          className="launcher-backdrop"
          type="button"
          aria-label="Fechar painel de aplicativos"
          onClick={onCloseAction}
        />
      ) : null}
      <aside
        id="application-launcher-panel"
        className={`app-launcher${expanded ? " app-launcher-expanded" : ""}`}
        aria-label="Aplicativos do portal"
      >
        <div className="launcher-collapsed-header">
          <button
            className="launcher-icon-button"
            type="button"
            aria-label="Expandir painel de aplicativos"
            aria-controls="application-launcher-panel"
            aria-expanded={expanded}
            onClick={onToggleAction}
          >
            <Icon name="apps" />
            <span className="sr-only">Aplicativos</span>
          </button>
        </div>

        {favoriteApplications.length > 0 ? (
          <nav className="launcher-collapsed-favorites" aria-label="Atalhos dos apps favoritos">
            {favoriteApplications.map((app) => (
              <a
                className="launcher-favorite-shortcut"
                key={app.id}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${app.name} em uma nova aba`}
                title={app.name}
              >
                <Icon name={app.icon} />
                <span className="sr-only">{app.name}</span>
              </a>
            ))}
          </nav>
        ) : null}

        <div className="launcher-expanded-header">
          <div>
            <p className="section-kicker">ACESSO RÁPIDO</p>
            <h2>Aplicativos</h2>
          </div>
          <button
            className="launcher-icon-button launcher-collapse-button"
            type="button"
            aria-label="Recolher painel de aplicativos"
            aria-controls="application-launcher-panel"
            aria-expanded={expanded}
            onClick={onToggleAction}
          >
            <Icon name="chevronRight" />
          </button>
        </div>

        <div className="launcher-content">
          <div
            className="launcher-tabs"
            role="tablist"
            aria-label="Lista de aplicativos"
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const nextTab = event.key === "Home"
                ? "favorites"
                : event.key === "End"
                  ? "all"
                  : activeTab === "favorites" ? "all" : "favorites";
              setActiveTab(nextTab);
              document.getElementById(`launcher-tab-${nextTab}`)?.focus();
            }}
          >
            <button
              id="launcher-tab-favorites"
              className={`launcher-tab${activeTab === "favorites" ? " launcher-tab-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === "favorites"}
              tabIndex={activeTab === "favorites" ? 0 : -1}
              aria-controls="launcher-tabpanel"
              onClick={() => setActiveTab("favorites")}
            >
              Favoritos
            </button>
            <button
              id="launcher-tab-all"
              className={`launcher-tab${activeTab === "all" ? " launcher-tab-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              tabIndex={activeTab === "all" ? 0 : -1}
              aria-controls="launcher-tabpanel"
              onClick={() => setActiveTab("all")}
            >
              Todos os apps
            </button>
          </div>

          <section
            id="launcher-tabpanel"
            className="launcher-tabpanel"
            role="tabpanel"
            aria-labelledby={activeTab === "favorites" ? "launcher-tab-favorites" : "launcher-tab-all"}
            tabIndex={0}
          >
            <p className="launcher-list-caption">
              {activeTab === "favorites" ? "SEUS ACESSOS FAVORITOS" : `${applications.length} ${applications.length === 1 ? "APP DISPONÍVEL" : "APPS DISPONÍVEIS"}`}
            </p>

            {visibleApplications.length > 0 ? (
              <ul className="launcher-app-list">
                {visibleApplications.map((app) => {
                  const isFavorite = favoriteIds.includes(app.id);
                  return (
                    <li className="launcher-app-item" key={app.id}>
                      <div className="launcher-app-row">
                        <span className="launcher-app-icon"><Icon name={app.icon} /></span>
                        <button
                          className={`launcher-favorite-button${isFavorite ? " launcher-favorite-active" : ""}`}
                          type="button"
                          aria-label={`${isFavorite ? "Remover" : "Adicionar"} ${app.name} ${isFavorite ? "dos" : "aos"} favoritos`}
                          aria-pressed={isFavorite}
                          onClick={() => toggleFavorite(app.id)}
                        >
                          <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
                        </button>
                        <span className="launcher-app-copy">
                          <strong>{app.name}</strong>
                          <small>{app.category}</small>
                        </span>
                      </div>
                      <a
                        className="launcher-app-link launcher-app-link-desktop"
                        href={app.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${app.name} em uma nova aba`}
                      >
                        Abrir app <Icon name="external" />
                      </a>
                      <a
                        className="launcher-app-link launcher-app-link-mobile"
                        href={app.href}
                        target="_self"
                        aria-label={`Abrir ${app.name} nesta aba; use o botão Voltar para retornar ao portal`}
                      >
                        Abrir app <Icon name="arrowRight" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="launcher-empty-state">
                <span className="launcher-empty-star" aria-hidden="true">☆</span>
                <p>Nenhum favorito por enquanto.</p>
                <button type="button" className="launcher-empty-action" onClick={() => setActiveTab("all")}>
                  Ver todos os apps
                </button>
              </div>
            )}
          </section>
          <p className="launcher-storage-note">Favoritos salvos somente neste navegador.</p>
        </div>
      </aside>
    </>
  );
}
