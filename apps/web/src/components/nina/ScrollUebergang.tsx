"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Der Weg zwischen Gespräch und Stellensuche — durch Weiterscrollen.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Beide Seiten tragen dasselbe Eingabefeld: unten im Gespräch, oben
 * auf der Stellenseite. Wer am Ende der einen weiterscrollt, landet
 * auf der anderen — und das Feld wandert mit, statt zu verschwinden
 * und woanders neu zu erscheinen.
 *
 * Ein Bauteil für beide Richtungen. Zwei fast gleiche wären beim
 * ersten Unterschied auseinandergelaufen, und dann führte ein Weg
 * anders zurück, als er hingeführt hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Scrollen NICHT einfach abgefangen wird
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Seite, die beim Scrollen woanders hinspringt, ist ein
 * Übergriff — man hat die Kontrolle über die eigene Hand verloren.
 * Deshalb müssen drei Bedingungen zusammenkommen:
 *
 *   1. Es geht in dieser Richtung nirgends mehr weiter. Nicht im
 *      Fenster und in keinem rollbaren Bereich unter dem Zeiger.
 *   2. Danach kommen 150 Pixel in dieselbe Richtung zusammen.
 *   3. Zwischen zwei Bewegungen liegen höchstens 900 ms.
 *
 * Und ein Riegel: Wer einen Text angefangen hat, wird nicht
 * weggezogen. Ein leeres Feld mit Cursor zählt nicht als
 * angefangener Text — sonst wäre die Geste auf der Gesprächsseite
 * nie auslösbar, weil das Feld dort beim Laden den Fokus nimmt.
 */

/** Ab wie vielen Pixeln in eine Richtung der Wechsel ausgelöst wird. */
const SCHWELLE = 150;

/** Wie lange eine begonnene Bewegung ohne Fortsetzung gilt. */
const GEDULD_MS = 900;

/** Wie nah an der Kante „ganz am Rand" heisst. */
const NAH_GENUG = 24;

/** Wie lange der Übergang höchstens auf die Zielseite wartet. */
const GEDULD_UEBERGANG_MS = 1200;

export function ScrollUebergang({
  ziel,
  richtung,
  hinweis,
}: {
  ziel: string;
  /** `runter`: ans Ende scrollen. `hoch`: an den Anfang. */
  richtung: "runter" | "hoch";
  hinweis: string;
}) {
  const router = useRouter();
  const [bereit, setBereit] = useState(false);
  const gesammelt = useRef(0);
  const zuletzt = useRef(0);
  const unterwegs = useRef(false);

  useEffect(() => {
    const runter = richtung === "runter";

    /**
     * Ist in einem ROLLBEREICH unter dem Zeiger noch Weg?
     *
     * Nicht nur das Fenster zählt: Die Stellenseite hat zwei eigene
     * Rollbereiche, das Gespräch einen. Wer in der Liste steht und
     * dort noch scrollen kann, ist nicht am Ende der SEITE — er ist
     * mitten in der Liste.
     *
     * Das Dokument selbst steht hier bewusst NICHT: siehe
     * `seiteBewegtSich`.
     */
    function restInAhnen(x: number, y: number): boolean {
      let el = document.elementFromPoint(x, y) as HTMLElement | null;
      while (el) {
        const stil = getComputedStyle(el);
        if (/(auto|scroll)/.test(stil.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          const rest = runter
            ? el.scrollHeight - el.scrollTop - el.clientHeight
            : el.scrollTop;
          if (rest > NAH_GENUG) return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    /**
     * ══════════════════════════════════════════════════════════
     * Bewegt sich die Seite noch? — beobachten statt vorhersagen
     * ══════════════════════════════════════════════════════════
     *
     * Zwei Versuche vorher sind gescheitert, beide an derselben
     * Sache:
     *
     *   1. „Rest = scrollHeight − scrollTop − clientHeight" — die
     *      Gesprächsseite meldet dauerhaft 107 Pixel Rest, den sie nie
     *      erreicht. Die Geste war blockiert.
     *   2. „Zählt nur, wenn `overflow` rollbar ist" — sie meldet
     *      `visible`. Auch blockiert.
     *
     * Beide haben versucht vorherzusagen, ob Scrollen möglich IST.
     * Das ist aus dem Stilbaum nicht sicher zu beantworten: Ob sich
     * etwas bewegt, entscheidet der Browser aus Layout, Overflow und
     * Overscroll zusammen.
     *
     * Also andersherum: Wir merken uns die Rollposition und sehen bei
     * der nächsten Radbewegung nach, ob sie sich geändert hat. Hat
     * sie sich bewegt, ist noch Weg. Bleibt sie stehen, obwohl gerollt
     * wird, sind wir am Ende — genau die Bedingung, die auch der
     * Browser für Overscroll benutzt.
     */
    let letzterStand = -1;

    function seiteBewegtSich(): boolean {
      const d = document.scrollingElement ?? document.documentElement;
      const jetzt = Math.round(d.scrollTop);
      const bewegt = letzterStand >= 0 && jetzt !== letzterStand;
      letzterStand = jetzt;
      return bewegt;
    }

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

    /**
     * Der Wechsel — in einen Ansichtsübergang gelegt.
     *
     * `startViewTransition` friert das Bild ein, bis die Zusage
     * erfüllt ist. Wir lösen sie, sobald die Adresse steht und ein
     * Bild vergangen ist; dann hat React den neuen Baum gesetzt.
     *
     * Dazu eine harte Grenze. Ohne sie hinge der Bildschirm, wenn die
     * Zielseite lange braucht — in der Entwicklung übersetzt
     * Turbopack sie beim ersten Aufruf sekundenlang. Ein
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
        router.push(ziel);
        return;
      }

      /*
       * Die Richtung steht am Dokument, bevor der Übergang beginnt.
       * Das Stylesheet liest sie: Nach unten fährt die alte Seite
       * hoch und die neue kommt von unten, nach oben umgekehrt. Ein
       * Rückweg, der aussieht wie der Hinweg, fühlt sich falsch an.
       */
      document.documentElement.dataset.uebergang = richtung;

      start(
        () =>
          new Promise<void>((fertig) => {
            const t0 = performance.now();
            router.push(ziel);

            const schauen = (): void => {
              if (window.location.pathname === ziel) {
                requestAnimationFrame(() => fertig());
                return;
              }
              if (performance.now() - t0 > GEDULD_UEBERGANG_MS) {
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

    let zeigerX = window.innerWidth / 2;
    let zeigerY = window.innerHeight / 2;
    function beiBewegung(e: PointerEvent): void {
      zeigerX = e.clientX;
      zeigerY = e.clientY;
    }

    function pruefeLage(): void {
      const amRand = !restInAhnen(zeigerX, zeigerY);
      setBereit(amRand);
      if (!amRand) gesammelt.current = 0;
      /* Vorladen, sobald jemand die Kante erreicht: Sonst beginnt der
         Übergang und wartet dann auf die Zielseite — man sähe ein
         stehendes Bild statt einer Bewegung. */
      if (amRand) router.prefetch(ziel);
    }

    function beiRad(e: WheelEvent): void {
      if (unterwegs.current || schreibtGerade()) return;

      const passt = runter ? e.deltaY > 0 : e.deltaY < 0;
      if (!passt) {
        gesammelt.current = 0;
        return;
      }
      if (restInAhnen(e.clientX, e.clientY)) {
        gesammelt.current = 0;
        return;
      }
      /* Bewegt sich die Seite noch, ist der Weg nicht zu Ende. */
      if (seiteBewegtSich()) {
        gesammelt.current = 0;
        return;
      }

      const jetzt = Date.now();
      if (jetzt - zuletzt.current > GEDULD_MS) gesammelt.current = 0;
      zuletzt.current = jetzt;

      gesammelt.current += Math.abs(e.deltaY);
      if (gesammelt.current >= SCHWELLE) hinueber();
    }

    /* Auf dem Telefon gibt es kein Rad — dort zählt der Wisch. */
    let start = 0;
    function beiStart(e: TouchEvent): void {
      start = e.touches[0]?.clientY ?? 0;
      gesammelt.current = 0;
    }
    function beiZug(e: TouchEvent): void {
      if (unterwegs.current || schreibtGerade()) return;
      const y = e.touches[0]?.clientY ?? 0;
      const weg = runter ? start - y : y - start;
      if (weg <= 0) return;
      if (restInAhnen(e.touches[0]?.clientX ?? zeigerX, y)) return;
      if (seiteBewegtSich()) return;
      gesammelt.current = weg;
      if (gesammelt.current >= SCHWELLE) hinueber();
    }

    window.addEventListener("pointermove", beiBewegung, { passive: true });
    window.addEventListener("wheel", beiRad, { passive: true });
    window.addEventListener("scroll", pruefeLage, { passive: true, capture: true });
    window.addEventListener("touchstart", beiStart, { passive: true });
    window.addEventListener("touchmove", beiZug, { passive: true });
    pruefeLage();

    return () => {
      window.removeEventListener("pointermove", beiBewegung);
      window.removeEventListener("wheel", beiRad);
      window.removeEventListener("scroll", pruefeLage, { capture: true });
      window.removeEventListener("touchstart", beiStart);
      window.removeEventListener("touchmove", beiZug);
    };
  }, [richtung, router, ziel]);

  const Zeichen = richtung === "runter" ? ArrowDown : ArrowUp;

  return (
    <button
      type="button"
      onClick={() => router.push(ziel)}
      className={cn(
        "mx-auto flex items-center gap-2 rounded-(--radius-pill) px-4 py-1.5",
        "text-2xs text-ink-3 transition-opacity duration-(--duration-base)",
        "hover:bg-soft hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        /*
         * Unsichtbar, aber nicht weg: `opacity-0` statt `hidden`. Ein
         * Element, das erscheint und verschwindet, springt die Zeile
         * darunter; eines, das nur die Deckkraft wechselt, bleibt an
         * seinem Platz.
         */
        bereit ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <Zeichen aria-hidden className="size-3.5" strokeWidth={2} />
      {hinweis}
    </button>
  );
}
