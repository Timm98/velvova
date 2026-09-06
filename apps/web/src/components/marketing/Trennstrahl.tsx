"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Die Linie unter dem Core, die von der Mitte nach aussen aufgeht.
 *
 * ── Warum von der Mitte ───────────────────────────────────────
 *
 * Über der Linie steht der Core, und der steht mittig. Eine Linie,
 * die von links nach rechts einläuft, hätte einen Anfang irgendwo am
 * Rand — sie käme von woanders her. Von der Mitte aus geöffnet
 * kommt sie aus dem Core: Der Übergang vom Versprechen zum Beleg
 * beginnt dort, wo das Versprechen steht.
 *
 * ── Warum `transform` und nicht `width` ───────────────────────
 *
 * Eine Breitenänderung löst in jedem Bild ein neues Layout aus — der
 * Browser muss die Seite neu setzen, sechzig Mal je Sekunde, für eine
 * Linie. `scaleX` läuft im Compositor und rührt das Layout nicht an.
 * Die Linie ist ein Pixel hoch; sie zu skalieren verzerrt nichts.
 *
 * ── Warum nur einmal ──────────────────────────────────────────
 *
 * Der Beobachter trennt sich nach dem ersten Mal. Eine Linie, die
 * bei jedem Vorbeiscrollen erneut aufgeht, ist beim dritten Mal ein
 * Zucken und beim fünften ein Fehler.
 */
export function Trennstrahl({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const feld = useRef<HTMLSpanElement>(null);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    const ziel = feld.current;
    if (!ziel) return;

    /* Ohne Bewegung steht die Linie einfach da — sie trägt eine
       Trennung, keine Aussage, und darf deshalb ganz entfallen als
       Bewegung. */
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setOffen(true);
      return;
    }

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege[0]?.isIntersecting) return;
        beobachter.disconnect();
        setOffen(true);
      },
      { threshold: 0.4 },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, []);

  return (
    <span
      ref={feld}
      aria-hidden
      className={className}
      style={{
        ...style,
        transformOrigin: "center",
        transform: `scaleX(${offen ? 1 : 0})`,
        /*
         * Langsam und mit weichem Auslauf. Die Linie ist über tausend
         * Pixel breit; bei einer üblichen Viertelsekunde wäre sie ein
         * Aufblitzen, kein Aufgehen.
         */
        transition: "transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    />
  );
}
