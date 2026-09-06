"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ein Balken, der beim Heranscrollen von null auf seinen Wert läuft.
 *
 * ── Warum Balken und Zahl zusammen ────────────────────────────
 *
 * Läuft nur der Balken, wirkt die Zahl daneben wie eine Beschriftung,
 * die schon vorher feststand. Laufen beide, liest man sie als
 * dasselbe Ereignis — und die Zahl ist das, worauf es ankommt.
 *
 * ── Warum die Zahl nicht weiterzählt ──────────────────────────
 *
 * Anders als der Bestand auf der Startseite ist das hier ein
 * feststehender Studienwert. Er läuft einmal hoch und bleibt dann
 * stehen; alles andere wäre eine Bewegung, die eine Veränderung
 * behauptet, die es nicht gibt.
 *
 * `prefers-reduced-motion` zeigt sofort den Endwert.
 */
export function Balken({
  anteil,
  beschriftung,
  erlaeuterung,
  nachkomma = 0,
}: {
  anteil: number;
  beschriftung: string;
  erlaeuterung?: string;
  /** Für Werte wie 80,5 — sonst wird gerundet angezeigt. */
  nachkomma?: number;
}) {
  const feld = useRef<HTMLLIElement>(null);
  const [stand, setStand] = useState(0);
  const [ruhig, setRuhig] = useState(false);

  useEffect(() => {
    const ziel = feld.current;
    if (!ziel) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRuhig(true);
      setStand(anteil);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setStand(anteil);
      return;
    }

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege[0]?.isIntersecting) return;
        beobachter.disconnect();

        const dauer = 1100;
        const beginn = performance.now();
        const schritt = (jetzt: number) => {
          const t = Math.min(1, (jetzt - beginn) / dauer);
          /* Auslaufen statt abbrechen — der Balken rastet ein. */
          const weich = 1 - Math.pow(1 - t, 3);
          setStand(anteil * weich);
          if (t < 1) requestAnimationFrame(schritt);
        };
        requestAnimationFrame(schritt);
      },
      { threshold: 0.5 },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [anteil]);

  return (
    <li ref={feld} className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-ink">{beschriftung}</span>
        <span className="font-mono text-lg font-bold tabular-nums text-accent-text">
          {stand.toLocaleString("de-DE", {
            minimumFractionDigits: nachkomma,
            maximumFractionDigits: nachkomma,
          })}{" "}
          %
        </span>
      </div>

      <div
        role="img"
        aria-label={`${beschriftung}: ${anteil.toLocaleString("de-DE", { maximumFractionDigits: nachkomma })} Prozent`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-inset"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{
            width: `${Math.min(100, stand)}%`,
            /* Ohne Übergang: Die Breite wird pro Bild gesetzt, ein
               zusätzlicher CSS-Übergang liefe der Rechnung hinterher
               und machte die Bewegung träge. */
            transition: ruhig ? undefined : "none",
          }}
        />
      </div>

      {erlaeuterung && <p className="text-2xs leading-relaxed text-ink-2">{erlaeuterung}</p>}
    </li>
  );
}
