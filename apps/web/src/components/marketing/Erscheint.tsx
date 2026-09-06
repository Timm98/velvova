"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Inhalt, der beim Heranscrollen erscheint.
 *
 * ── Warum ein Beobachter und keine CSS-Zeitachse ──────────────
 *
 * `animation-timeline: view()` täte dasselbe ohne JavaScript, wird
 * aber noch nicht überall unterstützt — und dort, wo es fehlt, bliebe
 * der Inhalt unsichtbar, weil der Startzustand `opacity: 0` ist. Ein
 * Effekt, der bei Nichtunterstützung den Text verschluckt, ist kein
 * Effekt, sondern ein Ausfall.
 *
 * ── Warum nur einmal ──────────────────────────────────────────
 *
 * Der Beobachter trennt sich nach dem ersten Auslösen. Etwas, das
 * beim Zurückscrollen wieder verschwindet, liest sich wie ein Fehler
 * — und wer nach oben scrollt, sucht meist etwas, das er schon
 * gesehen hat.
 *
 * ── Warum ohne JavaScript sichtbar ────────────────────────────
 *
 * Der Startzustand kommt aus einer Klasse, die erst im Browser
 * gesetzt wird. Ohne JavaScript steht der Inhalt einfach da.
 */
export function Erscheint({
  children,
  verzoegerung = 0,
  className,
}: {
  children: React.ReactNode;
  /** Millisekunden, um versetzte Abfolgen zu bauen. */
  verzoegerung?: number;
  className?: string;
}) {
  const feld = useRef<HTMLDivElement>(null);
  const [sichtbar, setSichtbar] = useState(false);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSichtbar(true);
      setBereit(true);
      return;
    }
    setBereit(true);

    const ziel = feld.current;
    if (!ziel || typeof IntersectionObserver === "undefined") {
      setSichtbar(true);
      return;
    }
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege[0]?.isIntersecting) return;
        setSichtbar(true);
        beobachter.disconnect();
      },
      /* Erst, wenn ein gutes Stück im Bild ist — sonst löst es am
         unteren Rand aus und die Bewegung ist vorbei, bevor man
         hinsieht. */
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, []);

  return (
    <div
      ref={feld}
      className={className}
      style={
        bereit
          ? {
              opacity: sichtbar ? 1 : 0,
              transform: sichtbar ? "none" : "translateY(18px)",
              transition: `opacity 700ms cubic-bezier(.22,.61,.36,1) ${verzoegerung}ms, transform 700ms cubic-bezier(.22,.61,.36,1) ${verzoegerung}ms`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
