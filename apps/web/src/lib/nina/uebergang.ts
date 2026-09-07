"use client";

import type { useRouter } from "next/navigation";

/** Wie lange der Übergang höchstens auf die Zielseite wartet. */
const GEDULD_MS = 1200;

/**
 * Der Weg zwischen Gespräch und Stellensuche, als eine Bewegung.
 *
 * ══════════════════════════════════════════════════════════════
 * Was der Browser dabei tut
 * ══════════════════════════════════════════════════════════════
 *
 * Beide Seiten tragen genau ein Eingabefeld mit demselben
 * `view-transition-name`: unten im Gespräch, oben auf der
 * Stellenseite. Der Browser erkennt sie als DASSELBE Element und
 * bewegt es — Ort, Grösse, Form — statt eines hier verschwinden und
 * dort neu erscheinen zu lassen.
 *
 * Gleichzeitig fährt das Gespräch nach oben aus dem Bild und die
 * Stellenseite von unten nach. Beide laufen so lang wie das Feld und
 * mit derselben Kurve; sonst kommt eines an, während das andere noch
 * unterwegs ist, und die Bewegung zerfällt in zwei.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Richtung am Dokument steht
 * ══════════════════════════════════════════════════════════════
 *
 * `data-uebergang` wird gesetzt, bevor der Übergang beginnt, und das
 * Stylesheet liest es. Ein Rückweg, der aussieht wie der Hinweg,
 * fühlt sich falsch an — auch wenn man nicht benennen kann, warum.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine harte Zeitgrenze
 * ══════════════════════════════════════════════════════════════
 *
 * `startViewTransition` friert das Bild ein, bis die Zusage erfüllt
 * ist. Ohne Grenze hinge der Bildschirm, wenn die Zielseite lange
 * braucht — in der Entwicklung übersetzt Turbopack sie beim ersten
 * Aufruf sekundenlang. Ein eingefrorener Bildschirm ist schlimmer als
 * ein Wechsel ohne Bewegung.
 */
export function seitenwechsel(
  router: ReturnType<typeof useRouter>,
  ziel: string,
  richtung: "runter" | "hoch",
): void {
  const start = document.startViewTransition?.bind(document);
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!start || ruhig) {
    router.push(ziel);
    return;
  }

  document.documentElement.dataset.uebergang = richtung;

  start(
    () =>
      new Promise<void>((fertig) => {
        const t0 = performance.now();
        router.push(ziel);

        const schauen = (): void => {
          if (window.location.pathname === ziel) {
            /* Ein Bild abwarten: Die Adresse steht, bevor React
               fertig gemalt hat. */
            requestAnimationFrame(() => fertig());
            return;
          }
          if (performance.now() - t0 > GEDULD_MS) {
            fertig();
            return;
          }
          requestAnimationFrame(schauen);
        };
        requestAnimationFrame(schauen);
      }),
  ).finished.finally(() => {
    delete document.documentElement.dataset.uebergang;
  });
}
