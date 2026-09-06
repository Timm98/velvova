"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { Loader2 } from "lucide-react";

/**
 * Lädt die nächsten Stellen nach, sobald das Ende in Sicht kommt.
 *
 * ══════════════════════════════════════════════════════════════
 * Nachladen und feste Begrenzung schliessen sich nicht aus
 * ══════════════════════════════════════════════════════════════
 *
 * Zwischenzeitlich stand hier ein Knopf statt des Fühlers, weil sich
 * die Liste beim Scrollen „immer weiter" anfühlte. Die Ursache lag
 * aber nicht im Nachladen, sondern daran, dass die Begrenzung erst ab
 * `lg` griff: Unter 1024 Pixeln gab es weder Höhe noch Rollbereich,
 * und die ganze SEITE wuchs mit jedem Nachladen.
 *
 * Seit die Begrenzung ab `md` gilt, wächst nur noch der Inhalt IM
 * Kasten. Der Kasten selbst behält seine Höhe und seine Linie —
 * nachgeladen wird unsichtbar, gerollt wird innen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Liste wächst statt zu blättern
 * ══════════════════════════════════════════════════════════════
 *
 * Die Adresse trägt die ANZAHL, nicht die Seite. `?anzahl=50` zeigt
 * fünfzig Stellen — die bisherigen plus fünfundzwanzig darunter.
 * Damit bleibt alles, was jemand schon gelesen hat, an seinem Platz,
 * und ein geteilter Link führt dorthin, wo der Absender war.
 */
export function JobPagination({
  weitereAnzahl,
  weiterHref,
}: {
  weitereAnzahl: number;
  weiterHref: string;
}) {
  const router = useRouter();
  const [unterwegs, starte] = useTransition();
  const fuehler = useRef<HTMLDivElement | null>(null);

  /*
   * Beim Scrollen prüfen, nicht beobachten.
   *
   * Der erste Anlauf benutzte einen `IntersectionObserver` mit 600
   * Pixeln Vorlauf. Er lud genau einmal nach und danach nie wieder —
   * gemessen über vier Scrollrunden: 26 Stellen, dann 51, dann
   * nichts mehr.
   *
   * Der Grund liegt in der Natur des Beobachters: Er meldet *Wechsel*
   * des Sichtbarkeitszustands. Nach dem Nachladen bleibt der Fühler
   * innerhalb des Vorlaufs — er wird also nie wieder „neu sichtbar"
   * und schweigt. Genau der Vorlauf, der das Nachladen flüssig machen
   * soll, verhindert die zweite Meldung.
   *
   * Eine Abstandsprüfung bei jedem Scrollen kennt das Problem nicht:
   * Sie fragt jedes Mal neu, wie weit das Ende entfernt ist.
   *
   * `requestAnimationFrame` bündelt die Prüfungen auf höchstens eine
   * je Bild — ein Scrollereignis feuert pro Sekunde hundertfach, und
   * `getBoundingClientRect` erzwingt jedes Mal eine Neuberechnung des
   * Layouts.
   */
  /*
   * ══════════════════════════════════════════════════════════════
   * Die nächsten fünfundzwanzig holen, bevor jemand danach fragt
   * ══════════════════════════════════════════════════════════════
   *
   * Der Fühler löst 600 Pixel vor dem Ende aus, und erst dann beginnt
   * die Arbeit: Der Server bewertet, rendert die ganze Seite und
   * schickt sie zurück. Bis dahin steht der Kreisel.
   *
   * `prefetch` verschiebt genau das nach vorn. Next lädt die
   * RSC-Antwort für die nächste Adresse im Hintergrund; wenn der
   * Fühler auslöst, liegt sie meistens schon da, und `push` schaltet
   * nur noch um.
   *
   * ── Warum das nichts doppelt rechnet ────────────────────────
   *
   * Die Bewertung je Person liegt 45 Sekunden im Speicher. Der
   * Vorabruf füllt sie, der eigentliche Aufruf trifft sie — es ist
   * derselbe Aufruf, nur früher.
   *
   * ── Und warum er nicht in der Scroll-Schleife steht ─────────
   *
   * Weil er einmal je Adresse genügt. In der Schleife stünde er
   * hundertmal je Sekunde, und Next würde jedes Mal prüfen, ob es
   * schon geholt hat — Arbeit für nichts.
   */
  useEffect(() => {
    router.prefetch(weiterHref);
  }, [router, weiterHref]);

  useEffect(() => {
    const ziel = fuehler.current;
    if (!ziel) return;

    /*
     * Auf den Behälter hören, nicht auf das Fenster.
     *
     * Die Liste hat einen eigenen Rollbereich. Ein Zuhörer am
     * `window` bekommt davon nichts mit — man rollt in der Liste, das
     * Fenster steht still, und nachgeladen wird nie wieder.
     */
    const rollender = (() => {
      let el: HTMLElement | null = ziel.parentElement;
      while (el) {
        const stil = getComputedStyle(el);
        if (/auto|scroll/.test(stil.overflowY)) return el;
        el = el.parentElement;
      }
      return null;
    })();
    const quelle: HTMLElement | Window = rollender ?? window;

    let angefordert = false;
    const pruefen = () => {
      angefordert = false;
      if (unterwegs) return;
      const unten = rollender
        ? rollender.getBoundingClientRect().bottom
        : window.innerHeight;
      const abstand = ziel.getBoundingClientRect().top - unten;
      if (abstand > 600) return;
      starte(() => router.push(weiterHref, { scroll: false }));
    };
    const beiScrollen = () => {
      if (angefordert) return;
      angefordert = true;
      requestAnimationFrame(pruefen);
    };

    quelle.addEventListener("scroll", beiScrollen, { passive: true });
    window.addEventListener("resize", beiScrollen, { passive: true });
    /* Einmal sofort: Wer mit kurzer Trefferliste ankommt, steht schon
       am Ende, ohne je gescrollt zu haben. */
    beiScrollen();

    return () => {
      quelle.removeEventListener("scroll", beiScrollen);
      window.removeEventListener("resize", beiScrollen);
    };
  }, [router, weiterHref, unterwegs, starte]);

  return (
    /*
      Kein Knopf — nur der Fühler und ein Kreisel beim Laden.

      Ist alles geladen, rendert die Elternkomponente diesen Baustein
      gar nicht mehr. Dann endet die Liste einfach, und das ist die
      richtige Auskunft.
    */
    <div className="flex flex-col items-center gap-2 pt-4 pb-2">
      <div ref={fuehler} aria-hidden className="h-px w-full" />
      {unterwegs && (
        <p className="flex items-center gap-2 text-sm text-ink-3" role="status" aria-live="polite">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Weitere {weitereAnzahl} Stellen
        </p>
      )}
    </div>
  );
}
