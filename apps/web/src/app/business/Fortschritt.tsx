import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Die fünf Schritte bis zur ersten Stelle.
 *
 * ── Warum eine Anzeige und kein Assistent ─────────────────────
 *
 * Ein Assistent führt: Er sperrt, was noch nicht dran ist, und lässt
 * nur vorwärts. Das ist richtig für eine Bezahlstrecke und falsch für
 * eine Einrichtung, die über Tage läuft — wer am dritten Tag die
 * Unternehmensseite ergänzen will, soll nicht durch drei erledigte
 * Schritte klicken müssen.
 *
 * Diese Leiste sagt deshalb nur, wo man steht und was noch fehlt. Jeder
 * erreichte Schritt ist anklickbar.
 *
 * ── Warum sie auch nach der Einrichtung bleibt ────────────────
 *
 * Sie verschwindet, sobald alle fünf erledigt sind. Bis dahin steht
 * sie über jeder Seite des Bereichs: Ein Unternehmen, das seine
 * Unternehmensseite nie veröffentlicht, hat sie nicht vergessen — es
 * hat nie wieder davon gehört.
 */

export type Schritt = {
  id: string;
  label: string;
  href: string;
  erledigt: boolean;
};

export function Fortschritt({ schritte }: { schritte: Schritt[] }) {
  const offen = schritte.filter((s) => !s.erledigt);
  if (offen.length === 0) return null;

  const aktuellerIndex = schritte.findIndex((s) => !s.erledigt);

  return (
    <nav
      aria-label="Einrichtung"
      className="border-b border-line"
      style={{ background: "color-mix(in oklab, var(--ed-violet) 6%, transparent)" }}
    >
      <div className="mx-auto w-full max-w-(--breite-inhalt) px-5 py-3 md:px-8">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          {schritte.map((s, i) => {
            const aktiv = i === aktuellerIndex;
            /* Erreichbar ist alles Erledigte und der nächste Schritt.
               Was danach kommt, hat noch keine Grundlage — eine Stelle
               ohne Unternehmen ist keine. */
            const erreichbar = s.erledigt || aktiv;
            const inhalt = (
              <span
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-pill) px-2.5",
                  aktiv && "bg-accent font-semibold text-accent-on",
                  !aktiv && s.erledigt && "text-ink-2",
                  !aktiv && !s.erledigt && "text-ink-3",
                )}
              >
                {s.erledigt ? (
                  <Check aria-hidden className="size-3.5" strokeWidth={2.4} />
                ) : (
                  <span aria-hidden className="font-mono text-2xs tabular-nums">
                    {i + 1}
                  </span>
                )}
                {s.label}
              </span>
            );

            return (
              <li key={s.id} className="flex items-center gap-2">
                {erreichbar ? (
                  <Link href={s.href} aria-current={aktiv ? "step" : undefined}>
                    {inhalt}
                  </Link>
                ) : (
                  inhalt
                )}
                {i < schritte.length - 1 && (
                  <span aria-hidden className="h-px w-4 bg-line" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
