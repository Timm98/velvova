import Link from "next/link";
import type { Berufsfeld } from "@/lib/berufsfelder-laden";

/**
 * Berufsfelder mit den meisten offenen Stellen.
 *
 * ── Warum mit Zahl ────────────────────────────────────────────
 *
 * „Beliebte Karrierebereiche" ohne Zahl ist eine Behauptung. Mit der
 * Anzahl daneben ist es eine Auskunft — und wer sie anzweifelt, kann
 * auf die Kachel klicken und nachzählen.
 *
 * Die Reihenfolge kommt aus dem Bestand, nicht aus einer Datei. Sie
 * ändert sich, wenn sich der Arbeitsmarkt ändert.
 */
export function Berufsfelder({ felder }: { felder: Berufsfeld[] }) {
  if (felder.length === 0) return null;

  return (
    <section aria-labelledby="berufsfelder" className="grid gap-6">
      <h2 id="berufsfelder" className="text-2xl font-semibold text-ink">
        Berufsfelder mit den meisten offenen Stellen
      </h2>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {felder.map((f) => (
          <li key={f.kldb}>
            <Link
              href={`/app/jobs?berufsfeld=${f.kldb}`}
              className={
                "grid gap-0.5 rounded-(--radius-md) border border-line bg-raised px-4 py-3.5 " +
                "transition-colors duration-(--duration-fast) hover:border-ink-3"
              }
            >
              <span className="text-sm font-medium leading-snug text-ink">{f.name}</span>
              <span className="text-2xs tabular text-ink-3">
                {f.anzahl.toLocaleString("de-DE")} Stellen
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-ink-2">
        <Link href="/app/jobs" className="text-accent-text underline underline-offset-[3px]">
          Alle Berufsfelder entdecken
        </Link>
      </p>
    </section>
  );
}
