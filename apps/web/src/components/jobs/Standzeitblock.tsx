import { Card } from "@/components/ui";
import type { Standzeitangabe } from "@/lib/jobs/standzeit";

/**
 * Wie lange diese Anzeige schon steht.
 *
 * ── Warum das vor der Bewerbung steht und nicht bei den Quellen ──
 *
 * Es ist keine Herkunftsangabe, sondern eine Entscheidungshilfe. Wer
 * gerade abwägt, ob er einen Nachmittag in eine Bewerbung steckt,
 * sollte wissen, dass vergleichbare Stellen nach drei Wochen weg sind
 * und diese seit zehn Monaten steht.
 *
 * ── Warum hier nicht „Geisterstelle" steht ────────────────────
 *
 * Über die Absicht des Arbeitgebers wissen wir nichts. Alt ist nicht
 * unecht: Eine Pflegestelle steht ein halbes Jahr, weil niemand kommt.
 * Behauptet wird deshalb nur, was gemessen ist — die Standzeit und
 * der Vergleich innerhalb desselben Berufsfelds.
 */
export function Standzeitblock({ angabe }: { angabe: Standzeitangabe }) {
  /* Unauffällig heisst: es gibt nichts zu sagen. Dann sagen wir nichts. */
  if (angabe.befund === "unauffaellig") return null;

  return (
    <Card>
      <div className="grid gap-2">
        <h2 className="abschnitts-titel text-ink-3">
          Wie lange diese Anzeige steht
        </h2>
        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink">
          {angabe.satz}
        </p>
        {angabe.folge && (
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{angabe.folge}</p>
        )}
      </div>
    </Card>
  );
}
