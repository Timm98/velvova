import { Card } from "@/components/ui";
import { passungsgruende, vorlaeufigkeit, type Passungsgrund } from "@paycheck/domain";
import type { ScoreFactor } from "@paycheck/domain";

/**
 * Warum diese Stelle passt, was dagegen spricht, und was offen ist.
 *
 * ── Warum drei Listen statt zweier Sätze ──────────────────────
 *
 * Bisher standen der stärkste Grund und der grösste Vorbehalt da —
 * je einer. Alles dazwischen war gerechnet und unsichtbar.
 *
 * ── Warum „noch ungeklärt" gleichberechtigt danebensteht ──────
 *
 * Weil es die häufigste stille Fehlannahme beim Lesen einer
 * Stellenanzeige aufhebt: „Keine Angabe zu Überstunden" heisst nicht
 * „keine Überstunden". Eine Achse ohne Daten zieht den Wert nicht
 * herunter — sie senkt die Sicherheit, und das gehört sichtbar hin.
 */
export function Passungsgruende({ factors }: { factors: readonly ScoreFactor[] }) {
  const g = passungsgruende(factors);
  const hinweis = vorlaeufigkeit(g);

  if (g.dafuer.length === 0 && g.dagegen.length === 0 && g.offen.length === 0) return null;

  return (
    <Card>
      <div className="grid gap-5">
        <Liste
          titel="Warum diese Stelle passt"
          punkte={g.dafuer}
          leer="Keine Achse spricht deutlich dafür."
          ton="positive"
        />
        <Liste
          titel="Was dagegen spricht"
          punkte={g.dagegen}
          leer="Keine Achse spricht deutlich dagegen."
          ton="caution"
        />
        <Liste
          titel="Noch ungeklärt"
          punkte={g.offen}
          leer="Zu allen Achsen liegen Angaben vor."
          ton="neutral"
        />

        {hinweis && (
          <p className="max-w-[var(--measure)] border-t border-line pt-3 text-sm leading-relaxed text-ink-2">
            {hinweis}
          </p>
        )}
      </div>
    </Card>
  );
}

const PUNKTFARBE = {
  positive: "bg-positive",
  caution: "bg-caution",
  neutral: "bg-ink-3",
} as const;

function Liste({
  titel,
  punkte,
  leer,
  ton,
}: {
  titel: string;
  punkte: Passungsgrund[];
  leer: string;
  ton: keyof typeof PUNKTFARBE;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="abschnitts-titel text-ink-3">{titel}</h3>
      {punkte.length === 0 ? (
        /*
          * Der leere Fall steht da, statt zu verschwinden.
          *
          * „Keine Achse spricht deutlich dagegen" ist eine Auskunft.
          * Ein fehlender Abschnitt sieht dagegen aus wie etwas, das
          * noch lädt — und lässt offen, ob geprüft wurde.
          */
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">{leer}</p>
      ) : (
        <ul className="grid gap-2">
          {punkte.map((p) => (
            <li key={p.key} className="flex gap-2.5">
              <span
                aria-hidden
                className={`mt-[9px] size-1.5 shrink-0 rounded-full ${PUNKTFARBE[ton]}`}
              />
              <span className="max-w-[var(--measure)] text-sm leading-relaxed">
                <span className="text-ink">{p.label}</span>
                <span className="text-ink-2"> — {p.satz}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
