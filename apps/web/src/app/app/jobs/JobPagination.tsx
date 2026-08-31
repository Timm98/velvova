"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";

/**
 * Blättern, mit sichtbarem Zwischenzustand.
 *
 * Vorher waren das zwei nackte Links. Sie funktionierten — aber eine
 * Seite mit 25 bewerteten Stellen braucht einen Moment, und in diesem
 * Moment passierte nichts Sichtbares. Wer nicht sofort etwas sieht,
 * klickt noch einmal; der zweite Klick löst dieselbe Navigation erneut
 * aus, und es wirkt endgültig kaputt. Genau so entsteht der Eindruck,
 * „Weitere 25 Stellen" funktioniere nicht.
 *
 * `useTransition` gibt den Zustand, den es dafür braucht: gedrückt,
 * unterwegs, fertig. Während der Fahrt ist der Knopf nicht mehr
 * anklickbar und sagt, was er tut.
 *
 * `scroll: false` ist Absicht (§17.1): die Liste tauscht ihren Inhalt,
 * die Seite springt nicht an den Anfang. Wer unten stand, steht
 * weiterhin unten — bei den Knöpfen, die er gerade benutzt.
 */
export function JobPagination({
  seite,
  seitenGesamt,
  sichtbar,
  gesamt,
  zurückHref,
  weiterHref,
  weitereAnzahl,
}: {
  seite: number;
  seitenGesamt: number;
  sichtbar: number;
  gesamt: number;
  zurückHref: string | null;
  weiterHref: string | null;
  weitereAnzahl: number;
}) {
  const router = useRouter();
  const [unterwegs, starte] = useTransition();

  function geheZu(href: string) {
    starte(() => router.push(href, { scroll: false }));
  }

  return (
    <nav aria-label="Seiten" className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-sm text-ink-2" aria-live="polite">
        Seite {seite} von {seitenGesamt} · {sichtbar} von {gesamt.toLocaleString("de-DE")} Stellen
      </p>

      <div className="flex gap-2">
        {zurückHref && (
          <button
            type="button"
            onClick={() => geheZu(zurückHref)}
            disabled={unterwegs}
            className={cn(
              "inline-flex h-11 items-center rounded-(--radius-pill) bg-soft px-5 text-sm transition-colors",
              unterwegs ? "opacity-60" : "hover:bg-soft-hover",
            )}
          >
            Zurück
          </button>
        )}

        {weiterHref && (
          <button
            type="button"
            onClick={() => geheZu(weiterHref)}
            disabled={unterwegs}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-(--radius-pill) bg-accent px-5 text-sm font-medium text-accent-on transition-colors",
              unterwegs ? "opacity-70" : "hover:bg-accent-hover",
            )}
          >
            {unterwegs && (
              <span
                aria-hidden
                className="size-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
              />
            )}
            {unterwegs ? "Wird geladen …" : `Weitere ${weitereAnzahl} Stellen`}
          </button>
        )}
      </div>

      {/*
       * Ohne Javascript bleiben es Links.
       *
       * Sie stehen für Vorlesegeräte und Suchmaschinen ohnehin bereit
       * und sind der Grund, warum Blättern auch dann geht, wenn die
       * Hydration hängt.
       */}
      <noscript>
        <div className="flex gap-2">
          {zurückHref && <Link href={zurückHref}>Zurück</Link>}
          {weiterHref && <Link href={weiterHref}>Weitere {weitereAnzahl} Stellen</Link>}
        </div>
      </noscript>
    </nav>
  );
}
