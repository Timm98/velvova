"use client";

import { ArrowLeft } from "lucide-react";
import { useNinaSteuerung } from "../NinaSteuerung";
import { cn } from "@/lib/cn";

/**
 * Der Rahmen des Nina-Panels: Kopf, Zurück-Weg, Übergang.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sich der Inhalt austauscht statt ein Fenster aufzugehen
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Dialog über der Seite nimmt die Stelle weg, um die es gerade
 * geht. Wer wissen will, ob das Gehalt passt, will die Anzeige
 * daneben behalten — die Frage entsteht ja beim Lesen.
 *
 * Deshalb wechselt nur der Inhalt dieser Spalte. Die Anzeige in der
 * Mitte bleibt stehen, die Liste links bleibt stehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das Panel anders aussieht als der Rest
 * ══════════════════════════════════════════════════════════════
 *
 * Es soll auf einen Blick erkennbar sein, dass hier gedeutet wird und
 * nicht bloss wiedergegeben. Der Unterschied ist bewusst klein — ein
 * eigener Grundton und ein eigener Rand, keine Farbfläche, kein
 * Verlauf. Das Panel steht dauerhaft da; was dauerhaft dasteht, darf
 * nicht laut sein.
 */
export function NinaPanelRahmen({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  const { zurueckMoeglich, zurueck, ansicht } = useNinaSteuerung();

  return (
    <section
      aria-labelledby="nina-panel-titel"
      className="flex h-full min-h-0 flex-col rounded-(--radius-lg) border border-assistant-border bg-assistant-soft"
    >
      {/*
       * Kopfzeile nur in den Unteransichten.
       *
       * Auf der Übersicht stand hier „Nina" und darunter „Analysiert:
       * <Stellentitel>". Beides ist weg: Der Name benennt die Spalte,
       * in der er steht, und die Statuszeile wiederholte den
       * Stellentitel, der zwei Zentimeter weiter links bereits groß
       * dasteht. Zwei Zeilen, die nichts sagen, was man nicht sieht.
       *
       * In einer Unteransicht ist die Überschrift dagegen die
       * Auskunft, WO man ist — „Gehalt & Marktvergleich" — und der
       * Zurück-Weg hängt daran. Deshalb bleibt sie dort.
       */}
      {zurueckMoeglich ? (
        <header className="shrink-0 border-b border-assistant-border/70 px-4 py-3.5">
          <button
            type="button"
            onClick={zurueck}
            className="mb-2 inline-flex min-h-6 items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-3.5" strokeWidth={1.9} />
            Zurück
          </button>

          <h2 id="nina-panel-titel" className="text-sm font-semibold">
            {titel}
          </h2>
        </header>
      ) : null}

      {/*
        Der Übergang ist bewusst knapp.

        140 Millisekunden, nur Deckkraft und ein kleiner Versatz. Länger
        oder mit Bewegung quer über die Spalte wirkt es wie eine
        Vorführung — und man wartet auf Inhalt, den man schon lesen
        könnte. `key` an der Ansicht sorgt dafür, dass der Übergang bei
        jedem Wechsel neu läuft.
      */}
      <div
        key={ansicht}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-4",
          /* `fade-up` gibt es schon im Designsystem — dieselbe Bewegung
             ein zweites Mal zu definieren hiesse, sie beim nächsten
             Feinschliff nur an einer von zwei Stellen zu ändern. */
          "motion-safe:animate-[fade-up_140ms_ease-out]",
        )}
      >
        {children}
      </div>
    </section>
  );
}
