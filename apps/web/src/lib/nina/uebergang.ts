"use client";

import type { useRouter } from "next/navigation";

/**
 * Wie lange der Übergang höchstens auf die Zielseite wartet.
 *
 * Deutlich unter Chromiums eigener Grenze von vier Sekunden: Wird die
 * überschritten, verwirft der Browser den Übergang von sich aus und
 * wirft „View transition update callback timed out" — dann gibt es
 * keine Bewegung UND einen Fehler.
 *
 * Gemessen, wie lange der Wechsel wirklich braucht — beide Seiten
 * haben inzwischen ein `loading.tsx`, das sofort dasteht:
 *
 *   Gespräch → Stellen    240, 241, 248, 252, 253, 259 ms
 *   Stellen  → Gespräch    25,  28,  31,  37,  38,  44 ms
 *
 * 800 ms sind also das Dreifache des langsameren Weges. Vorher
 * standen hier 2000 — mehr Luft, als je gebraucht wurde, und im
 * schlechten Fall zwei Sekunden Standbild: Wird die Grenze erreicht,
 * ist der Bildschirm bis dahin eingefroren. Diese Zeit zu verkürzen
 * kostet nichts, solange sie nie erreicht wird.
 *
 * Erreicht wird sie in der Entwicklung, wenn Turbopack die Zielseite
 * nach einer Änderung neu übersetzt — das dauert zehn bis fünfzehn
 * Sekunden, und dagegen hilft keine Grenze. Aber 0,8 Sekunden
 * Standbild sind besser als 2.
 */
const GEDULD_MS = 800;

/** Wie oft nachgesehen wird, ob die Adresse steht. */
const TAKT_MS = 16;

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
 * Warum hier ein Zeitgeber steht und kein `requestAnimationFrame`
 * ══════════════════════════════════════════════════════════════
 *
 * Weil `startViewTransition` das Bild einfriert — und mit dem Bild
 * auch die Bildtakte. Gemessen in einem eingefrorenen Übergang von
 * 1000 ms:
 *
 *   requestAnimationFrame:   4 Aufrufe
 *   setInterval(…, 16):     63 Aufrufe
 *
 * Die erste Fassung fragte per `requestAnimationFrame` ab, ob die
 * Adresse schon steht, und brach nach `GEDULD_MS` ab. Beides lief bei
 * vier Takten pro Sekunde ins Leere: Die Grenze wurde nie wirksam,
 * der Übergang hing bis zu Chromiums eigener Vier-Sekunden-Grenze und
 * wurde dort verworfen. Sichtbar war das als „keine Animation, man
 * ist einfach auf der anderen Seite" — plus ein Laufzeitfehler.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Richtung am Dokument steht
 * ══════════════════════════════════════════════════════════════
 *
 * `data-uebergang` wird gesetzt, bevor der Übergang beginnt, und das
 * Stylesheet liest es. Ein Rückweg, der aussieht wie der Hinweg,
 * fühlt sich falsch an — auch wenn man nicht benennen kann, warum.
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

  const uebergang = start(
    () =>
      new Promise<void>((fertig) => {
        const t0 = performance.now();
        router.push(ziel);

        const takt = window.setInterval(() => {
          const angekommen = window.location.pathname === ziel;
          const abgelaufen = performance.now() - t0 > GEDULD_MS;
          if (!angekommen && !abgelaufen) return;

          window.clearInterval(takt);
          /* Zwei Bilder Luft, damit React den neuen Baum gemalt hat.
             `requestAnimationFrame` wäre der richtige Weg, taktet hier
             aber nicht (siehe oben) — also eine Zeitspanne. */
          window.setTimeout(fertig, angekommen ? 32 : 0);
        }, TAKT_MS);
      }),
  );

  /*
   * Beide Zusagen brauchen einen Fänger.
   *
   * `ready` wird abgelehnt, wenn der Browser den Übergang verwirft —
   * und eine abgelehnte Zusage ohne Fänger landet in der Fehlerkonsole
   * und in Next' Fehlerfenster. Der Nutzer sah dann einen roten
   * Laufzeitfehler für etwas, das nur eine ausgefallene Animation ist.
   */
  const aufraeumen = (): void => {
    delete document.documentElement.dataset.uebergang;
  };
  uebergang.ready.catch(() => {});
  uebergang.finished.then(aufraeumen, aufraeumen);
}
