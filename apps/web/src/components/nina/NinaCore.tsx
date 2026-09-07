"use client";

import { NinaVisual } from "./NinaVisual";
import { cn } from "@/lib/cn";

/**
 * Monday als kleines rundes Zeichen neben Name und Status.
 *
 * ── Warum es diese Fassung gibt ───────────────────────────────
 *
 * Im Gespräch stand Monday mit 120 Pixeln über der ersten Nachricht,
 * auf dem Telefon mit 72. Zusammen mit Titel, Statuszeile und Knöpfen
 * war der obere Bereich damit ein Viertel des Bildschirms hoch, bevor
 * ein einziger Satz zu sehen war.
 *
 * Der Kern ist kein Bild, das man betrachtet — er ist das Zeichen
 * dafür, mit wem man spricht. Dafür reicht die Grösse eines
 * Profilbilds: 60 Pixel auf dem Rechner, 48 auf dem Telefon.
 *
 * ── Warum quadratisch und rund ────────────────────────────────
 *
 * Höhe gleich Breite, `rounded-full`, und der Inhalt wird eingepasst
 * statt gestreckt. Ein ovaler oder an den Kanten abgeschnittener Kern
 * sieht nach einem Fehler aus, nicht nach Gestaltung — und genau das
 * war er.
 *
 * Die grosse Fassung bleibt für Stellen, an denen Monday die Hauptsache
 * ist. Dort wird `NinaVisual` direkt benutzt.
 */
export function NinaCore({ className }: { className?: string }) {
  return (
    <NinaVisual
      size="md"
      /*
       * Kein Verlauf dahinter.
       *
       * `grund="verlauf"` legt eine leuchtende Fläche hinter das
       * Modell — auf der Startseite richtig, wo Monday allein auf einer
       * grossen Fläche steht. Im Gespräch sitzt sie in einer Zeile
       * neben Überschrift und Statuszeile; dort ist der Schein ein
       * heller Fleck hinter Text und kein Licht.
       */
      grund="keiner"
      className={cn(
        /*
         * `size-*` überschreibt die Höhe und Breite aus `NinaVisual`.
         * Der Wechsel läuft über eine Medienabfrage, nicht über einen
         * Zustand — es gibt nichts zu animieren und nichts, was beim
         * Scrollen springt.
         */
        /*
         * 72 statt 48, 120 statt 60.
         *
         * Bei 60 Pixeln war vom Kern ein Punkt übrig — und die
         * Auflösung war zusätzlich gedeckelt (siehe `NinaScene`, die
         * Schwelle lag bei 240). Man sah eine Kugel, nicht das
         * Modell.
         *
         * 120 Pixel auf dem Rechner sind gross genug, dass die
         * Struktur im Inneren erkennbar wird, und klein genug, dass
         * die Kopfzeile eine Kopfzeile bleibt. Auf dem Telefon 72:
         * dort ist Platz das knappste Gut.
         */
        "size-[72px] shrink-0 rounded-full sm:size-[120px]",
        /* Eingepasst statt gestreckt — auch wenn ein Rückfallbild kommt. */
        "[&_img]:object-contain [&_canvas]:object-contain",
        className,
      )}
    />
  );
}
