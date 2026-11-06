"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApplicationLauncherSidebar } from "@/modulos/aplicacoes/components/application-launcher-sidebar";
import { Icon, type IconName } from "@/compartilhado/icons";

const SIDEBAR_COLLAPSED_KEY = "dp-intranet-sidebar-collapsed";

type NavItem = {
  label: string;
  href?: string;
  icon: IconName;
  available: boolean;
  active?: boolean;
};

export function PortalShell({
  children,
  active,
}: {
  children: ReactNode;
  active: "home" | "announcements" | "applications" | "documents";
}) {
  const [appsOpen, setAppsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      setSidebarCollapsed(false);
    }
    setSidebarPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // O menu continua utilizável mesmo se o navegador bloquear o armazenamento local.
    }
  }, [sidebarCollapsed, sidebarPreferenceLoaded]);

  useEffect(() => {
    if (!appsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAppsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [appsOpen]);

  const items: NavItem[] = [
    { label: "Início", href: "/", icon: "home", available: true, active: active === "home" },
    { label: "Comunicados", href: "/comunicados/", icon: "megaphone", available: true, active: active === "announcements" },
    { label: "Aplicações", href: "/aplicacoes/", icon: "grid", available: true, active: active === "applications" },
    { label: "Documentos", href: "/documentos/", icon: "file", available: true, active: active === "documents" },
    { label: "Pessoas", icon: "users", available: false },
    { label: "Ajuda", icon: "help", available: false },
  ];
  const mobileItems = items.slice(0, 4);
  const currentPageTitle = items.find((item) => item.active)?.label ?? "Início";

  return (
    <div className={`portal-layout${appsOpen ? " app-launcher-open" : ""}${sidebarCollapsed ? " portal-sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
      <aside id="portal-primary-sidebar" className="desktop-sidebar" aria-label="Navegação principal">
        <a className="brand-lockup" href="/" aria-label="Di Paula Intranet — início" title="Di Paula Intranet — início">
          <span className="brand-symbol" aria-hidden="true">dp<span>.</span></span>
          <span className="brand-copy"><strong>Di Paula</strong><small>INTRANET</small></span>
        </a>

        <div className="sidebar-label">ESPAÇO DE TRABALHO</div>
        <nav className="sidebar-nav">
          {items.map((item) => item.available && item.href ? (
            <a
              key={item.label}
              href={item.href}
              className={`nav-item${item.active ? " nav-item-active" : ""}`}
              aria-current={item.active ? "page" : undefined}
              aria-label={sidebarCollapsed ? item.label : undefined}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.active ? <span className="sr-only">Página atual</span> : null}
            </a>
          ) : (
            <span key={item.label} className="nav-item nav-item-disabled" aria-disabled="true" aria-label={item.label} title={item.label}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <small>Em breve</small>
            </span>
          ))}
        </nav>

        <div className="sidebar-footnote">
          <span className="sidebar-footnote-line" />
          <p>Um lugar para<br />o que nos move.</p>
          <small>PROTÓTIPO INTERNO</small>
        </div>
      </aside>

      <div className="portal-main">
        <header className="topbar">
          <div className="topbar-identity">
            <button
              className="sidebar-toggle-button"
              type="button"
              aria-controls="portal-primary-sidebar"
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expandir menu principal" : "Recolher menu principal"}
              title={sidebarCollapsed ? "Expandir menu principal" : "Recolher menu principal"}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              <Icon name="menu" />
            </button>
            <a className="mobile-brand" href="/" aria-label="Di Paula Intranet — início">
              <span className="brand-symbol" aria-hidden="true">dp<span>.</span></span>
              <span className="brand-copy"><strong>Di Paula</strong><small>INTRANET</small></span>
            </a>
            <h1 className="topbar-page-title">{currentPageTitle}</h1>
          </div>
          <form className="portal-search" action="/aplicacoes/" role="search">
            <Icon name="search" />
            <input type="search" name="q" placeholder="Buscar aplicações" aria-label="Buscar aplicações no portal" />
            <span className="search-hint" aria-hidden="true">ENTER</span>
          </form>
          <div className="topbar-actions">
            <button
              className="launcher-mobile-toggle"
              type="button"
              aria-controls="application-launcher-panel"
              aria-expanded={appsOpen}
              onClick={() => setAppsOpen((open) => !open)}
            >
              <Icon name="apps" /><span>Apps</span>
            </button>
            <span className="prototype-label"><span /> Protótipo</span>
            <span className="profile-chip" aria-label="Perfil demonstrativo">DP</span>
          </div>
        </header>

        <main className="page-content" id="conteudo-principal">{children}</main>
      </div>

      <ApplicationLauncherSidebar
        expanded={appsOpen}
        onToggleAction={() => setAppsOpen((open) => !open)}
        onCloseAction={() => setAppsOpen(false)}
      />

      <nav className="mobile-nav" aria-label="Navegação principal">
        {mobileItems.map((item) => item.href ? (
          <a
            key={item.label}
            className={`mobile-nav-item${item.active ? " mobile-nav-active" : ""}`}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ) : null)}
      </nav>
    </div>
  );
}
