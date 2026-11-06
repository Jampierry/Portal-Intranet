"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/compartilhado/icons";
import { recognition, type RecognitionPeriod } from "@/modulos/inicio/data/recognition";

const periodLabels: Record<RecognitionPeriod, string> = {
  month: "Destaque do mês",
  year: "Destaques do ano",
};

export function RecognitionCarousel() {
  const [period, setPeriod] = useState<RecognitionPeriod>("month");
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const entries = recognition[period];
  const isRotating = autoPlay && !reducedMotion;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!isRotating || entries.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % entries.length);
    }, 7200);
    return () => window.clearInterval(timer);
  }, [entries.length, isRotating]);

  const selectPeriod = (nextPeriod: RecognitionPeriod) => {
    setPeriod(nextPeriod);
    setActiveIndex(0);
  };

  const move = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + entries.length) % entries.length);
  };

  const visibleEntries = [-1, 0, 1].map((offset) => {
    const index = (activeIndex + offset + entries.length) % entries.length;
    return { entry: entries[index], isCurrent: offset === 0 };
  });

  return (
    <div className="recognition-block">
      <div className="recognition-heading-row">
        <div>
          <p className="section-kicker">GENTE QUE FAZ ACONTECER</p>
          <h2 id="recognition-heading">Pessoas em destaque</h2>
          <p className="section-subtitle">Reconhecimento demonstrativo — nomes e histórias fictícios.</p>
        </div>
        <div className="recognition-tabs" role="tablist" aria-label="Período dos destaques">
          {(["month", "year"] as const).map((option) => (
            <button
              key={option}
              id={`recognition-tab-${option}`}
              className={`recognition-tab${period === option ? " recognition-tab-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={period === option}
              aria-controls="recognition-panel"
              onClick={() => selectPeriod(option)}
            >
              {periodLabels[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="recognition-toolbar">
        <span className="recognition-demo-pill"><span /> DADOS FICTÍCIOS</span>
        <div className="carousel-controls">
          <button className="icon-button" type="button" onClick={() => move(-1)} aria-label="Mostrar pessoa anterior">
            <Icon name="chevronLeft" />
          </button>
          <span className="carousel-count" aria-live={isRotating ? "off" : "polite"}>
            {String(activeIndex + 1).padStart(2, "0")} <span>/</span> {String(entries.length).padStart(2, "0")}
          </span>
          <button className="icon-button" type="button" onClick={() => move(1)} aria-label="Mostrar próxima pessoa">
            <Icon name="chevronRight" />
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
          <button
            className="motion-button"
            type="button"
            onClick={() => setAutoPlay((playing) => !playing)}
            aria-pressed={!isRotating}
            aria-label={reducedMotion ? "Animação pausada pela preferência de movimento reduzido" : isRotating ? "Pausar rotação automática" : "Retomar rotação automática"}
            disabled={reducedMotion}
          >
            <Icon name={isRotating ? "pause" : "play"} />
            <span>{reducedMotion ? "Movimento reduzido" : isRotating ? "Pausar" : "Retomar"}</span>
          </button>
        </div>
      </div>

      <div
        id="recognition-panel"
        className="recognition-cards"
        role="tabpanel"
        aria-labelledby={`recognition-tab-${period}`}
        aria-live={isRotating ? "off" : "polite"}
      >
        {visibleEntries.map(({ entry, isCurrent }) => (
          <article className={`recognition-card${isCurrent ? " recognition-card-current" : ""}`} key={`${period}-${entry.id}`}>
            <div className={`recognition-avatar avatar-${entry.initials.slice(-1)}`} aria-hidden="true">{entry.initials}</div>
            <div className="recognition-card-copy">
              <span className="recognition-card-period">{entry.period}</span>
              <h3>{entry.name}</h3>
              <p className="recognition-role">{entry.role}</p>
              <p className="recognition-note">{entry.note}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="carousel-dots" aria-label={`Pessoa ${activeIndex + 1} de ${entries.length}`}>
        {entries.map((entry, index) => (
          <button
            key={entry.id}
            className={`carousel-dot${index === activeIndex ? " carousel-dot-active" : ""}`}
            type="button"
            aria-label={`Mostrar ${entry.name}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
