import { Icon } from "@/compartilhado/icons";
import type { Announcement } from "@/modulos/comunicados/data/announcements";

export function AnnouncementList({ items }: { items: Announcement[] }) {
  return (
    <div className="announcement-list">
      {items.map((item) => (
        <article className="announcement-card" key={item.id}>
          <div className={`announcement-marker announcement-marker-${item.tone}`} aria-hidden="true">
            <Icon name="megaphone" />
          </div>
          <div className="announcement-body">
            <div className="announcement-meta">
              <span className={`announcement-category category-${item.tone}`}>{item.category}</span>
              <span className="announcement-date"><Icon name="calendar" /> {item.dateLabel}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </div>
          <span className="announcement-arrow" aria-hidden="true"><Icon name="chevronRight" /></span>
        </article>
      ))}
    </div>
  );
}
