"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toggleSaveJob } from "@/lib/jobActions";
import { cn } from "@/lib/cn";

/**
 * Merken, ohne die Stelle zu öffnen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum dieser Knopf nicht im Zeilen-Link steckt
 * ══════════════════════════════════════════════════════════════
 *
 * Ein `<button>` in einem `<a>` ist ungültiges HTML — welches der
 * beiden den Klick bekommt, entscheidet dann der Browser, und das
 * Ergebnis ist je nach Browser ein anderes.
 *
 * `JobRow` legt den Zeilen-Link deshalb als Überlagerung UNTER den
 * Inhalt und schaltet dort `pointer-events-none`. Dieser Knopf holt
 * sich die Klicks mit `pointer-events-auto` zurück. Er steht damit im
 * Fluss der Score-Spalte und zentriert sich unter ihr, statt mit
 * einem Pixelwert danebenzuhängen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Zustand sofort wechselt
 * ══════════════════════════════════════════════════════════════
 *
 * Merken ist gefahrlos und jederzeit umkehrbar. Auf die Antwort des
 * Servers zu warten, bevor sich etwas rührt, lässt eine Liste träge
 * wirken — bei fünfundzwanzig Zeilen fällt das sofort auf.
 */
export function MerkKnopf({
  jobId,
  anfangsGemerkt,
}: {
  jobId: string;
  anfangsGemerkt: boolean;
}) {
  const [gemerkt, setGemerkt] = useState(anfangsGemerkt);
  const [unterwegs, starte] = useTransition();

  return (
    <button
      type="button"
      disabled={unterwegs}
      aria-pressed={gemerkt}
      aria-label={gemerkt ? "Nicht mehr merken" : "Stelle merken"}
      onClick={() => {
        setGemerkt((v) => !v);
        starte(async () => {
          const r = await toggleSaveJob(jobId);
          setGemerkt(r.saved);
        });
      }}
      /*
       * Grösse mit Absicht: 36 Pixel Fläche, 20 Pixel Symbol.
       *
       * Kleiner war der Knopf zwar dezenter, aber auf einem
       * Berührungsbildschirm nicht zuverlässig zu treffen — und in
       * einer Liste, in der die ganze Zeile ein Link ist, landet ein
       * verfehlter Klick auf der Stelle statt auf dem Symbol.
       */
      className={cn(
        "grid size-9 place-items-center rounded-full transition-colors",
        "disabled:opacity-60",
        gemerkt ? "text-accent" : "text-ink-3 hover:bg-soft hover:text-ink-2",
      )}
    >
      <Bookmark
        aria-hidden
        className="size-5"
        strokeWidth={1.9}
        fill={gemerkt ? "currentColor" : "none"}
      />
    </button>
  );
}
