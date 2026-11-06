import { ApplicationCard } from "@/modulos/aplicacoes/components/application-card";
import { applications } from "@/modulos/aplicacoes/data/applications";
import { AnnouncementList } from "@/modulos/comunicados/components/announcement-list";
import { announcements } from "@/modulos/comunicados/data/announcements";
import { RecognitionCarousel } from "@/modulos/inicio/components/recognition-carousel";
import { PortalShell } from "@/modulos/shell/portal-shell";

// Página inicial. Recriada na organização por módulos: o export original não trazia esta rota.
// Conteúdo 100% demonstrativo (dados fictícios).
export default function HomePage() {
  return (
    <PortalShell active="home">
      <div className="page-stack">
        <section className="welcome-panel" aria-labelledby="welcome-heading">
          <div className="welcome-copy">
            <p className="section-kicker">BEM-VINDO(A)</p>
            <h2 id="welcome-heading">Comunicados para acompanhar o que importa.</h2>
            <p className="welcome-summary">Avisos, aplicações e reconhecimento da equipe em um só lugar.</p>
            <a className="button button-plum" href="/comunicados/">Ver comunicados</a>
          </div>
        </section>
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <section className="content-section" aria-labelledby="home-announcements-heading">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">AVISOS RECENTES</p>
                  <h2 id="home-announcements-heading">Comunicados</h2>
                </div>
                <a className="text-link" href="/comunicados/">Ver todos</a>
              </div>
              <AnnouncementList items={announcements.slice(0, 3)} />
            </section>
            <RecognitionCarousel />
          </div>
          <section className="quick-apps-panel" aria-labelledby="home-apps-heading">
            <h2 id="home-apps-heading">Aplicações</h2>
            <div className="application-list">
              {applications.map((item) => (
                <ApplicationCard key={item.id} application={item} compact />
              ))}
            </div>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
