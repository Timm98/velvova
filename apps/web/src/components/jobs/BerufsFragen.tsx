"use client";

import { ArrowRight } from "lucide-react";
import { berufsfragen, type Stellenlage } from "@/lib/jobs/berufsfragen";
import { useNinaActions } from "@/components/nina/NinaProvider";

/**
 * Typische Fragen zu diesem Beruf — beantwortet in der Blase.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Antwort nicht hier erscheint
 * ══════════════════════════════════════════════════════════════
 *
 * Hier stand `JobKurzfragen`: vier Fragen, die ihre Antwort in einer
 * Ziehharmonika darunter ausklappten. Damit gab es zwei Orte, an denen
 * Nina antwortet — hier und unten rechts —, und beide kannten den
 * anderen nicht. Wer erst hier fragte und dann unten, begann von vorn.
 *
 * Jetzt ist ein Klick dasselbe wie das Tippen der Frage: Sie geht in
 * die eine Sitzung, und die Antwort steht dort, wo alle Antworten
 * stehen. Die Blase blinkt kurz, damit man sieht, wohin.
 */
export function BerufsFragen({
  titel,
  lage,
  assistantName,
}: {
  titel: string;
  lage: Stellenlage;
  assistantName: string;
}) {
  const nina = useNinaActions();
  const fragen = berufsfragen(titel, lage);

  /* Ohne brauchbaren Titel keine Fragen — und dann auch keine
     Überschrift über einer leeren Liste. */
  if (fragen.length === 0) return null;

  return (
    <section aria-labelledby="berufsfragen" className="grid gap-2.5">
      <h3
        id="berufsfragen"
        /* Titelschrift statt Laufschrift: Eine Überschrift steht in
           keiner Spalte und braucht keine gleichen Zeichenbreiten. */
        className="font-titel text-[11px] uppercase tracking-[0.08em] text-ink-3"
      >
        Typische Fragen zu diesem Beruf
      </h3>

      <ul className="grid gap-1.5">
        {fragen.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              onClick={() => {
                /*
                 * Erst hervorheben, dann senden.
                 *
                 * `pulsAnstossen` öffnet die Blase; käme das Senden
                 * zuerst, liefe die Antwort in eine geschlossene
                 * Fläche und wäre da, bevor jemand hinsieht.
                 */
                nina.pulsAnstossen();
                void nina.send(f.text);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-(--radius-md) bg-soft px-3.5 py-2.5 text-left text-sm leading-relaxed transition-colors hover:bg-soft-hover"
            >
              {f.text}
              <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.9} />
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-ink-3">
        {assistantName} antwortet unten rechts.
      </p>
    </section>
  );
}
