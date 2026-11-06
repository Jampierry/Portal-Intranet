import { Icon, type IconName } from "@/compartilhado/icons";
import type { Application } from "@/modulos/aplicacoes/data/applications";

export function ApplicationCard({
  application,
  compact = false,
}: {
  application: Application;
  compact?: boolean;
}) {
  return (
    <article className={`application-card${compact ? " application-card-compact" : ""}`}>
      <div className="application-card-top">
        <span className="application-icon"><Icon name={application.icon as IconName} /></span>
        <span className="external-badge">WEB EXTERNO</span>
      </div>
      <div className="application-card-copy">
        <p className="application-category">{application.category}</p>
        <h3>{application.name}</h3>
        <p className="application-description">{application.description}</p>
        <p className="application-access"><Icon name="info" /> {application.access}</p>
      </div>
      <div className="application-card-actions">
        <a
          className="button button-plum desktop-external-link"
          href={application.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${application.name} em uma nova aba`}
        >
          Abrir {application.name} <Icon name="external" />
        </a>
        <a
          className="button button-plum mobile-external-link"
          href={application.href}
          target="_self"
          aria-label={`Abrir ${application.name} nesta aba; use o botão Voltar para retornar ao portal`}
        >
          Abrir {application.name} <Icon name="arrowRight" />
        </a>
        <span className="link-guidance desktop-link-guidance">No computador, abre em nova aba.</span>
        <span className="link-guidance mobile-link-guidance">No celular, abre nesta aba. Use Voltar para retornar.</span>
      </div>
    </article>
  );
}
