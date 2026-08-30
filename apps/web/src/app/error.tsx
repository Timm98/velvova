"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

/**
 * Was die Person sieht, wenn etwas abstürzt.
 *
 * Drei Dinge gehören hier hinein und drei ausdrücklich nicht.
 *
 * Hinein: eine Erklärung in einem Satz, ein Weg weiter, und eine
 * Kennung, mit der sich der Vorfall später zuordnen lässt.
 *
 * Nicht hinein: der Stapelverlauf, der Dateiname, die Meldung des
 * Fehlers. Sie können Pfade, Abfragen oder Zugangsdaten enthalten — und
 * sie helfen niemandem, der gerade eine Bewerbung schreiben wollte.
 *
 * Die Kennung ist die Brücke: die Person nennt sie, und im Protokoll
 * steht der Rest.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Die Meldung geht ins Serverprotokoll, nicht auf den Bildschirm.
    console.error("Unbehandelter Fehler:", error.digest ?? "ohne Kennung", error.message);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-5 py-16">
      <div className="grid max-w-[46ch] gap-5">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          Da ist etwas schiefgegangen.
        </h1>

        <p className="leading-relaxed text-ink-2">
          Der Fehler liegt bei uns, nicht bei dir. Deine Angaben sind gespeichert — es ist nichts
          verloren gegangen.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center gap-2 rounded-(--radius-full) bg-accent px-5 text-sm font-medium text-accent-on"
          >
            <RotateCw className="size-4" strokeWidth={1.9} />
            Erneut versuchen
          </button>

          <a
            href="/app"
            className="inline-flex min-h-10 items-center text-sm text-accent-text underline underline-offset-[3px]"
          >
            Zurück zur Übersicht
          </a>
        </div>

        {error.digest && (
          <p className="pt-2 font-mono text-2xs text-ink-3">
            Kennung: {error.digest}
            <span className="block font-sans">
              Nenn sie uns, wenn du nachfragst — damit finden wir den Vorgang wieder.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
