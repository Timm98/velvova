"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Vom Gespräch zur Stellensuche — durch Weiterscrollen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Wer am Ende des Gesprächs angekommen ist und weiterscrollt, landet
 * auf der Stellenseite. Das Eingabefeld unten wird dabei zum Suchfeld
 * oben — beide tragen denselben `view-transition-name`, und der
 * Browser bewegt sie ineinander.
 *
 * Der Gedanke dahinter: Es ist dasselbe Feld. Man schreibt hinein,
 * wonach man sucht. Dass es einmal unten und einmal oben steht, ist
 * eine Frage der Seite, nicht der Sache.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Scrollen NICHT einfach abgefangen wird
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Seite, die beim Scrollen woanders hinspringt, ist ein Übergriff
 * — man hat die Kontrolle über die eigene Hand verloren. Deshalb drei
 * Bedingungen, die alle gelten müssen:
 *
 *   1. Der Nachrichtenstrom ist bereits ganz unten. Wer noch liest,
 *      wird nicht weggezogen.
 *   2. Danach kommen weitere ABWÄRTS-Bewegungen zusammen — 240 Pixel,
 *      etwa zwei entschlossene Radbewegungen. Ein Nachlauf des
 *      Trackpads reicht nicht.
 *   3. Zwischen zwei Bewegungen liegen höchstens 600 ms. Wer die
 *      Hand hebt, fängt von vorn an.
 *
 * Und ein Riegel: Während man schreibt, passiert gar nichts. Sonst
 * verlässt der Text mitsamt der Seite die Bühne.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein sichtbarer Hinweis dazugehört
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Geste, die niemand kennt, ist keine Funktion. Sobald man unten
 * ankommt, erscheint der Hinweis — und er ist zugleich ein Knopf: Wer
 * nicht scrollen mag, klickt.
 */

/**
 * Ab wie vielen Pixeln Abwärtsbewegung der Wechsel ausgelöst wird.
 *
 * Erst 240 — gemessen an einer Maus mit festen 120er-Schritten waren
 * das zwei Rasten. Auf einem Trackpad kommen viele kleine Werte, und
 * wer sanft wischt, erreichte die Schwelle nie, bevor die Geduld
 * ablief. 150 bei 900 ms Geduld trifft beides.
 */
const SCHWELLE = 150;

/** Wie lange eine begonnene Bewegung ohne Fortsetzung gilt. */
const GEDULD_MS = 900;

/** Wie nah am Ende „ganz unten" heisst. */
const NAH_GENUG = 24;

const ZIEL = "/app/jobs";

export function WeiterZuStellen({ strom }: { strom: React.RefObject<HTMLElement | null> }) {
  const router = useRouter();
  const [bereit, setBereit] = useState(false);
  const gesammelt = useRef(0);
  const zuletzt = useRef(0);
  const unterwegs = useRef(false);

  useEffect(() => {
    const el = strom.current;
    if (!el) return;

    function amEnde(): boolean {
      const e = strom.current;
      return !!e && e.scrollHeight - e.scrollTop - e.clientHeight < NAH_GENUG;
    }

    /**
     * Nicht „ist ein Feld im Fokus", sondern „steht schon Text darin".
     *
     * Der erste Entwurf blockierte, sobald irgendein Eingabefeld den
     * Fokus hatte. Auf dieser Seite ist das IMMER der Fall: Das
     * Eingabefeld nimmt den Fokus beim Laden, damit man sofort
     * losschreiben kann. Die Geste war damit nie auslösbar — der
     * Riegel hat nicht die Gefahr getroffen, sondern den Normalfall.
     *
     * Was geschützt gehört, ist ein angefangener Text. Ein leeres
     * Feld mit Cursor darin ist kein angefangener Text.
     */
    function schreibtGerade(): boolean {
      const a = document.activeElement;
      if (a instanceof HTMLTextAreaElement || a instanceof HTMLInputElement) {
        return a.value.trim().length > 0;
      }
      if (a instanceof HTMLElement && a.isContentEditable) {
        return (a.textContent ?? "").trim().length > 0;
      }
      return false;
    }

    function pruefeLage(): void {
      const unten = amEnde();
      setBereit(unten);
      if (!unten) gesammelt.current = 0;
      /*
       * Vorladen, sobald jemand unten ankommt.
       *
       * Ohne das beginnt der Übergang und wartet dann auf die
       * Zielseite — man sieht ein stehendes Bild statt einer
       * Bewegung. Mit Vorladen ist sie meist schon da, wenn die
       * Geste kommt.
       */
      if (unten) router.prefetch(ZIEL);
    }

    /**
     * Der Wechsel — in einen Ansichtsübergang gelegt.
     *
     * ══════════════════════════════════════════════════════════
     * Warum von Hand und nicht über eine Fahne
     * ══════════════════════════════════════════════════════════
     *
     * `experimental.viewTransition` in der Next-Konfiguration klingt
     * danach, tut es aber nicht: Nachgemessen wurde
     * `document.startViewTransition` bei einer Navigation NULL Mal
     * gerufen. Die Fahne schaltet Reacts `<ViewTransition>` frei,
     * nicht das Umhüllen des Routers. Sie ist deshalb wieder raus —
     * eine eingeschaltete Fahne, die nichts bewirkt, ist eine
     * Behauptung im Quelltext.
     *
     * ══════════════════════════════════════════════════════════
     * Wann der Übergang endet
     * ══════════════════════════════════════════════════════════
     *
     * `startViewTransition` friert das Bild ein, bis die Zusage
     * erfüllt ist. Wir lösen sie, sobald die Adresse steht UND ein
     * Bild vergangen ist — dann hat React den neuen Baum gesetzt und
     * der Browser kann das zweite Standbild nehmen.
     *
     * Dazu eine harte Grenze von 1200 ms. Ohne sie hinge das Bild
     * fest, wenn die Zielseite lange braucht — in der Entwicklung
     * übersetzt Turbopack sie beim ersten Aufruf sekundenlang. Ein
     * eingefrorener Bildschirm ist schlimmer als ein Wechsel ohne
     * Bewegung.
     */
    function hinueber(): void {
      if (unterwegs.current) return;
      unterwegs.current = true;
      gesammelt.current = 0;

      const start = document.startViewTransition?.bind(document);
      const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!start || ruhig) {
        router.push(ZIEL);
        return;
      }

      start(
        () =>
          new Promise<void>((fertig) => {
            const t0 = performance.now();
            router.push(ZIEL);

            const schauen = (): void => {
              if (window.location.pathname === ZIEL) {
                /* Ein Bild abwarten: Die Adresse steht, bevor React
                   fertig gemalt hat. */
                requestAnimationFrame(() => fertig());
                return;
              }
              if (performance.now() - t0 > 1200) {
                fertig();
                return;
              }
              requestAnimationFrame(schauen);
            };
            requestAnimationFrame(schauen);
          }),
      );
    }

    function beiRad(e: WheelEvent): void {
      if (unterwegs.current || schreibtGerade()) return;
      if (e.deltaY <= 0) {
        gesammelt.current = 0;
        return;
      }
      if (!amEnde()) return;

      const jetzt = Date.now();
      if (jetzt - zuletzt.current > GEDULD_MS) gesammelt.current = 0;
      zuletzt.current = jetzt;

      gesammelt.current += e.deltaY;
      if (gesammelt.current >= SCHWELLE) hinueber();
    }

    /*
     * Auf dem Telefon gibt es kein Rad. Dort zählt die Wischbewegung
     * über den unteren Rand hinaus — dieselbe Schwelle, dieselbe
     * Bedingung.
     */
    let start = 0;
    function beiStart(e: TouchEvent): void {
      start = e.touches[0]?.clientY ?? 0;
      gesammelt.current = 0;
    }
    function beiZug(e: TouchEvent): void {
      if (unterwegs.current || !amEnde()) return;
      const y = e.touches[0]?.clientY ?? 0;
      const weg = start - y;
      if (weg > 0) gesammelt.current = weg;
      if (gesammelt.current >= SCHWELLE) hinueber();
    }

    el.addEventListener("scroll", pruefeLage, { passive: true });
    window.addEventListener("wheel", beiRad, { passive: true });
    el.addEventListener("touchstart", beiStart, { passive: true });
    el.addEventListener("touchmove", beiZug, { passive: true });
    pruefeLage();

    return () => {
      el.removeEventListener("scroll", pruefeLage);
      window.removeEventListener("wheel", beiRad);
      el.removeEventListener("touchstart", beiStart);
      el.removeEventListener("touchmove", beiZug);
    };
  }, [router, strom]);

  return (
    <button
      type="button"
      onClick={() => router.push(ZIEL)}
      aria-label="Weiter zu den Stellen"
      className={cn(
        "mx-auto flex items-center gap-2 rounded-(--radius-pill) px-4 py-1.5",
        "text-2xs text-ink-3 transition-opacity duration-(--duration-base)",
        "hover:bg-soft hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        /*
         * Unsichtbar, aber nicht weg: `opacity-0` statt `hidden`.
         * Ein Element, das erscheint und verschwindet, springt die
         * Zeile darunter; eines, das nur die Deckkraft wechselt,
         * bleibt an seinem Platz.
         */
        bereit ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowDown aria-hidden className="size-3.5" strokeWidth={2} />
      Weiterscrollen für passende Stellen
    </button>
  );
}
