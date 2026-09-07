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
 *
 * ══════════════════════════════════════════════════════════════
 * Die Form der Vorlage — ohne Bilder
 * ══════════════════════════════════════════════════════════════
 *
 * Die Vorlage zeigt ihre Kategorien als Bildkacheln: Foto oben,
 * Beschriftung klein DARUNTER und ausserhalb der Kachel, darunter
 * mittig ein umrandeter Knopf für alle Kategorien.
 *
 * Die Beschriftung ausserhalb ist das Wesentliche daran. Innen wäre
 * sie eine Bildunterschrift auf dem Bild; aussen ist sie eine
 * Beschriftung des Ganzen, und die Kachel darf ruhig bleiben.
 *
 * Bilder haben wir nicht. Eines je Berufsfeld zu besorgen hiesse,
 * Stockfotos zu nehmen, die nichts über die Stellen dahinter sagen —
 * ein Lagerregal, das für „Logistik" steht, weil es aussieht wie
 * Logistik. Statt des Bildes trägt die Kachel deshalb die Zahl, die
 * ohnehin die eigentliche Auskunft ist.
 */
export function Berufsfelder({ felder }: { felder: Berufsfeld[] }) {
  if (felder.length === 0) return null;

  return (
    <section aria-labelledby="berufsfelder" className="grid gap-6">
      <h2 id="berufsfelder" className="font-display text-2xl font-normal tracking-[-0.015em] text-ink">
        Berufsfelder mit den meisten offenen Stellen
      </h2>

      <ul className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {felder.map((f) => (
          <li key={f.kldb}>
            <Link href={`/app/jobs?berufsfeld=${f.kldb}`} className="group grid gap-2.5">
              {/*
                Die Fläche trägt die Zahl, die Beschriftung steht
                darunter — wie das Bild und sein Titel in der Vorlage.

                `tabular-nums`: Vier Zahlen nebeneinander, die
                unterschiedlich breit springen, lesen sich als vier
                verschiedene Dinge.
              */}
              <span
                className={
                  "grid h-24 place-items-center rounded-(--radius-surface) bg-soft " +
                  "font-mono text-2xl tabular-nums text-ink " +
                  "transition-colors duration-(--duration-fast) group-hover:bg-soft-hover"
                }
              >
                {f.anzahl.toLocaleString("de-DE")}
              </span>

              <span className="grid gap-0.5">
                <span className="text-sm leading-snug text-ink transition-colors group-hover:text-accent-text">
                  {f.name}
                </span>
                <span className="text-2xs text-ink-3">offene Stellen</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/*
        Mittig und umrandet, nicht als unterstrichener Satz links.

        In der Vorlage schliesst jedes Raster mit einem solchen Knopf
        ab: Er sagt, dass die Auswahl darüber eine Auswahl ist und
        nicht alles. Ein Textlink am Rand sagt dasselbe leiser, als
        es hier gemeint ist.
      */}
      <Link
        href="/app/jobs"
        className={
          "mx-auto inline-flex h-11 items-center rounded-(--radius-control) border border-line-3 " +
          "px-6 text-sm text-ink transition-colors hover:bg-soft"
        }
      >
        Alle Berufsfelder
      </Link>
    </section>
  );
}
