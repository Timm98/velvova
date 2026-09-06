"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { Sterne } from "./Sterne";
import { initialen } from "@/lib/reviews/pruefung";
import { hilfreichMarkieren } from "@/lib/reviews/aktionen";

/**
 * Eine Bewertung, wie sie gelesen wird.
 *
 * Die Karte trägt bewusst wenig: keinen Rahmen, keinen Schatten, keine
 * Anführungszeichen in Übergrösse. Was sie hochwertig macht, ist der
 * Verzicht — eine Bewertungskarte mit fünf Auszeichnungen sieht aus wie
 * ein Werbebanner, und dann liest man sie wie eines.
 *
 * Drei Entscheidungen, die nicht offensichtlich sind:
 *
 *   **Kein erfundenes Gesicht.** Ohne Bild stehen Initialen da. Ein
 *   Stockfoto neben einer echten Bewertung ist eine kleine Fälschung,
 *   und sie fällt auf, sobald jemand das Bild anderswo wiedersieht.
 *
 *   **„Verifiziert" nur, wenn ein Mensch es gesetzt hat.** Es bedeutet
 *   „wir haben nachgesehen, dass diese Person das Produkt benutzt hat",
 *   nicht „diese Bewertung gefällt uns".
 *
 *   **Langer Text wird gekürzt, nicht abgeschnitten.** Mit einem Knopf,
 *   der ihn ganz zeigt. Ein Text, der ohne Hinweis nach drei Zeilen
 *   aufhört, sieht aus wie ein Darstellungsfehler.
 */

export interface OeffentlicheBewertung {
  id: string;
  displayName: string;
  roleOrCompany: string | null;
  rating: number;
  headline: string | null;
  body: string;
  isVerified: boolean;
  helpfulCount: number;
  publishedAt: Date | null;
}

/** Ab wann gekürzt wird. Etwa vier Zeilen in der Kartenbreite. */
const KUERZEN_AB = 280;

export function Bewertungskarte({
  bewertung,
  className,
  editorial = false,
}: {
  bewertung: OeffentlicheBewertung;
  className?: string;
  /**
   * Die Fassung für die Startseite.
   *
   * Sie hat eine eigene Farbfamilie (`--ed-*`) — heller Grund, andere
   * Kontraste, andere Haarlinien. Zwei Bauteile dafür zu pflegen hiesse,
   * jede spätere Änderung zweimal zu machen und beim zweiten Mal die
   * Hälfte zu vergessen. Ein Schalter mit zwei Tokensätzen ist die
   * kleinere Menge Code und die kleinere Menge Fehler.
   */
  editorial?: boolean;
}) {
  const [ganz, setGanz] = useState(false);
  const [anzahl, setAnzahl] = useState(bewertung.helpfulCount);
  const [gestimmt, setGestimmt] = useState(false);
  const [pending, startTransition] = useTransition();

  const lang = bewertung.body.length > KUERZEN_AB;
  const text = ganz || !lang ? bewertung.body : `${bewertung.body.slice(0, KUERZEN_AB).trimEnd()}…`;

  const ton = editorial
    ? {
        flaeche: { background: "var(--ed-surface, #ffffff)", color: "var(--ed-ink)" },
        haupt: { color: "var(--ed-ink)" },
        neben: { color: "var(--ed-ink-2)" },
        leise: { color: "var(--ed-ink-3)" },
        linie: { borderColor: "var(--ed-hairline)" },
        kreis: { background: "rgba(99, 91, 255, 0.1)", color: "var(--ed-ink)" },
      }
    : null;

  return (
    <article
      style={ton?.flaeche}
      className={cn(
        "grid content-start gap-4 rounded-(--radius-surface) p-6",
        !editorial && "bg-inset",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Sterne wert={bewertung.rating} />
        {bewertung.isVerified && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-pill) bg-positive-soft px-2.5 py-1 text-2xs font-medium text-ink">
            <BadgeCheck aria-hidden className="size-3.5 text-positive" strokeWidth={2.2} />
            Verifizierte Bewertung
          </span>
        )}
      </div>

      {bewertung.headline && (
        <h3 style={ton?.haupt} className={cn("text-[17px] font-semibold leading-snug", !editorial && "text-ink")}>
          {bewertung.headline}
        </h3>
      )}

      <p style={ton?.neben} className={cn("whitespace-pre-line text-[15px] leading-relaxed", !editorial && "text-ink-2")}>
        {text}
      </p>

      {lang && (
        <button
          type="button"
          onClick={() => setGanz((v) => !v)}
          aria-expanded={ganz}
          className="justify-self-start text-sm text-accent-text underline underline-offset-[3px]"
        >
          {ganz ? "Weniger anzeigen" : "Mehr anzeigen"}
        </button>
      )}

      <div
        style={ton?.linie}
        className={cn(
          "mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4",
          !editorial && "border-line-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* Initialen statt Stockfoto. Siehe oben. */}
          <span
            aria-hidden
            style={ton?.kreis}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full font-medium",
              !editorial && "bg-lavender text-ink",
            )}
          >
            {initialen(bewertung.displayName)}
          </span>
          <span className="min-w-0">
            <span style={ton?.haupt} className={cn("block truncate text-sm font-medium", !editorial && "text-ink")}>
              {bewertung.displayName}
            </span>
            {bewertung.roleOrCompany && (
              <span style={ton?.leise} className={cn("block truncate text-xs", !editorial && "text-ink-3")}>
                {bewertung.roleOrCompany}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {bewertung.publishedAt && (
            <time
              dateTime={bewertung.publishedAt.toISOString()}
              style={ton?.leise}
              className={cn("font-mono text-2xs", !editorial && "text-ink-3")}
            >
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
                bewertung.publishedAt,
              )}
            </time>
          )}

          <button
            type="button"
            disabled={pending || gestimmt}
            onClick={() =>
              startTransition(async () => {
                const r = await hilfreichMarkieren(bewertung.id);
                if (r.ok) {
                  setAnzahl(r.anzahl ?? anzahl);
                  setGestimmt(true);
                }
              })
            }
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-pill) px-3 text-xs transition-colors",
              gestimmt ? "text-ink-3" : "text-ink-2 hover:bg-soft hover:text-ink",
            )}
          >
            <ThumbsUp aria-hidden className="size-3.5" strokeWidth={1.9} />
            {gestimmt ? "Danke" : "Hilfreich"}
            {anzahl > 0 && <span className="font-mono tabular">{anzahl}</span>}
          </button>
        </div>
      </div>
    </article>
  );
}
