"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eine Abfolge, die sich beim Scrollen aufbaut.
 *
 * ── Was hier passiert ─────────────────────────────────────────
 *
 * Die senkrechte Linie wächst mit dem Scrollfortschritt von oben nach
 * unten. Jeder Punkt springt an, sobald die Linie ihn erreicht — und
 * der Text daneben erscheint mit ihm.
 *
 * ── Warum am Scrollfortschritt und nicht an einem Zeitgeber ───
 *
 * Eine Abfolge, die nach festen Sekunden abläuft, ist beim schnellen
 * Scrollen vorbei, bevor man sie sieht, und beim langsamen längst
 * fertig. Am Fortschritt gebunden folgt sie dem Tempo des Lesers —
 * das ist der Punkt an der Sache.
 *
 * ── Warum nichts ohne JavaScript verschwindet ─────────────────
 *
 * Der Startzustand wird erst im Browser gesetzt. Ohne JavaScript
 * stehen alle Schritte da, mit voller Linie.
 */
export function Schrittfolge({
  schritte,
}: {
  schritte: readonly (readonly [string, string])[];
}) {
  const feld = useRef<HTMLOListElement>(null);
  const [fortschritt, setFortschritt] = useState(1);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    const ziel = feld.current;
    if (!ziel) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFortschritt(1);
      return;
    }
    setBereit(true);
    setFortschritt(0);

    let angefordert = false;
    const messen = () => {
      angefordert = false;
      const k = ziel.getBoundingClientRect();
      /*
       * Null, solange die Liste unterhalb von zwei Dritteln der
       * Fensterhöhe steht; eins, sobald ihr Ende dort angekommen ist.
       * Der Bezug ist bewusst nicht der obere Rand: Was ganz oben im
       * Bild steht, liest niemand — man liest im mittleren Drittel.
       */
      const linie = window.innerHeight * 0.66;
      const anteil = (linie - k.top) / Math.max(1, k.height);
      setFortschritt(Math.max(0, Math.min(1, anteil)));
    };
    const beiScrollen = () => {
      if (angefordert) return;
      angefordert = true;
      requestAnimationFrame(messen);
    };

    window.addEventListener("scroll", beiScrollen, { passive: true });
    window.addEventListener("resize", beiScrollen, { passive: true });
    beiScrollen();
    return () => {
      window.removeEventListener("scroll", beiScrollen);
      window.removeEventListener("resize", beiScrollen);
    };
  }, []);

  return (
    <ol ref={feld} className="relative grid gap-0">
      {schritte.map(([titel, text], i) => {
        /* Der Punkt ist erreicht, sobald die Linie seine Höhe passiert
           hat — gleichmässig über die Liste verteilt. */
        const schwelle = schritte.length > 1 ? i / (schritte.length - 1) : 0;
        const an = !bereit || fortschritt >= schwelle - 0.02;

        return (
          <li key={titel} className="grid grid-cols-[auto_1fr] gap-x-4">
            <span className="grid justify-items-center">
              <span
                aria-hidden
                className="mt-1.5 block size-2.5 rounded-full transition-colors duration-300"
                style={{
                  background: an ? "var(--ed-violet)" : "var(--ed-hairline-strong)",
                }}
              />
              {i < schritte.length - 1 && (
                <span
                  aria-hidden
                  className="relative my-1 block w-px flex-1"
                  style={{ background: "var(--ed-hairline)", minHeight: "2.6rem" }}
                >
                  {/*
                    Der blaue Teil der Linie wächst von oben nach
                    unten durch dieses Segment. `scaleY` mit
                    Ursprung oben statt einer Höhenänderung: Das
                    läuft auf dem Grafikprozessor und ruckelt nicht.
                  */}
                  <span
                    className="absolute inset-0 origin-top"
                    style={{
                      background: "var(--ed-violet)",
                      transform: `scaleY(${Math.max(
                        0,
                        Math.min(1, (fortschritt - schwelle) * (schritte.length - 1)),
                      )})`,
                      transition: bereit ? "transform 120ms linear" : undefined,
                    }}
                  />
                </span>
              )}
            </span>

            <span
              className="grid gap-1 pb-8"
              style={
                bereit
                  ? {
                      opacity: an ? 1 : 0.25,
                      transform: an ? "none" : "translateY(6px)",
                      transition: "opacity 420ms ease, transform 420ms ease",
                    }
                  : undefined
              }
            >
              <span className="text-[15px] font-semibold" style={{ color: "var(--ed-ink)" }}>
                {titel}
              </span>
              <span className="text-[15px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                {text}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
