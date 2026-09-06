import { Card } from "@/components/ui";
import type { Zukunftsangabe } from "@/lib/jobs/zukunft";

/**
 * Was über die Zukunft dieses Berufsfelds bekannt ist.
 *
 * ── Warum das kein Orakel ist ─────────────────────────────────
 *
 * Hier steht keine Prognose über eine einzelne Stelle, sondern was
 * über ihre Berufsgruppe in veröffentlichten Studien steht — mit
 * Herkunft, Stand und Konfidenz darunter.
 *
 * Nie steht hier „dieser Beruf verschwindet" oder „KI ersetzt das".
 * Substituierbarkeit beschreibt Tätigkeiten, die sich automatisieren
 * lassen; sie ist keine Wahrscheinlichkeit dafür, dass ein Beruf
 * aufhört zu existieren. Der Unterschied ist nicht Vorsicht, sondern
 * der zwischen einer Auskunft und einer Prophezeiung.
 */
export function Zukunftsblock({ angabe }: { angabe: Zukunftsangabe }) {
  const { bild } = angabe;
  const prozent = (x: number) => `${Math.round(x * 100)} %`;

  return (
    <Card>
      <div className="grid gap-3">
        <h2 className="abschnitts-titel text-ink-3">
          Zukunft dieses Berufsfelds
        </h2>

        <p className="max-w-[var(--measure)] text-base leading-relaxed text-ink">
          {angabe.nachfrage}
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {angabe.automatisierung}
        </p>

        <dl className="grid gap-1.5 border-t border-line pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">Einschätzung zur Sicherheit bis 2035</dt>
            <dd className="tabular text-ink">{bild.sicherheit.toFixed(1)} von 5</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">Berufsgruppen mit hoher KI-Exposition</dt>
            <dd className="tabular text-ink">{prozent(bild.kiExpositionHoch)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">davon mit wachsender Nachfrage</dt>
            <dd className="tabular text-ink">{prozent(bild.nachfrageWachsend)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">Datensicherheit</dt>
            <dd className="text-ink">{angabe.konfidenz}</dd>
          </div>
        </dl>

        <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
          {angabe.herkunft}
        </p>
      </div>
    </Card>
  );
}
