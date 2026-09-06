import Link from "next/link";
import { Compass } from "lucide-react";
import type { Suchrichtung } from "@paycheck/matching";

/**
 * Wonach Nina sucht — und warum.
 *
 * ── Was das für die Person ändert ─────────────────────────────
 *
 * Eine Jobbörse zeigt, was jemand ins Suchfeld getippt hat. Wer
 * „Bürokaufmann" eingibt, bekommt Bürokaufmann und sieht nie, dass
 * dieselben Fähigkeiten in der Disposition, im Auftragsmanagement oder
 * in der Kundenbetreuung gebraucht werden. Für einen Wechsel ist das
 * die eigentliche Sackgasse: man kann nur finden, was man schon
 * benennen kann.
 *
 * Hier stehen die Richtungen, die aus dem Gespräch entstanden sind —
 * mit dem Satz daneben, aus dem sie stammen.
 *
 * ── Warum der Beleg dabeisteht ────────────────────────────────
 *
 * „Disposition" allein ist eine Behauptung über einen Menschen. Mit
 * „weil du erzählt hast, dass du Touren geplant hast" ist es ein
 * Vorschlag, dem man widersprechen kann. Der Unterschied entscheidet,
 * ob jemand die Liste als Angebot liest oder als Zuschreibung.
 *
 * ── Suchrichtung ist keine Empfehlung ─────────────────────────
 *
 * Das steht auch für die Leserin da. Diese Wörter bestimmen, wonach
 * gefragt wird — nicht, dass ein Beruf passt. Was zurückkommt, wird
 * danach gegen die Bedingungen geprüft wie jede andere Stelle.
 */
export function Suchrichtungen({
  richtungen,
  assistantName,
}: {
  richtungen: Suchrichtung[];
  assistantName: string;
}) {
  /*
   * Nichts anzeigen, wenn nichts abgeleitet werden konnte.
   *
   * Ein leerer Kasten „Nina sucht nach: —" wäre schlimmer als kein
   * Kasten: er verspricht eine Fähigkeit und führt sie sofort ad
   * absurdum. Wer noch nichts erzählt hat, sieht hier nichts.
   */
  if (richtungen.length === 0) return null;

  return (
    <section
      aria-labelledby="suchrichtungen"
      data-suchrichtungen
      className="rounded-(--radius-surface) bg-raised px-6 py-5"
    >
      <div className="flex items-center gap-2.5">
        <Compass className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
        <h2 id="suchrichtungen" className="text-sm font-medium">
          Wonach {assistantName} für dich sucht
        </h2>
      </div>

      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
        Nicht nach einem Berufsnamen, sondern nach Tätigkeiten, die in dem vorkommen, was du erzählt
        hast. Das sind Suchrichtungen, keine Empfehlungen — was zurückkommt, wird gegen deine
        Bedingungen geprüft wie jede andere Stelle.
      </p>

      <ul className="mt-4 grid gap-2.5">
        {richtungen.map((r) => (
          <li key={r.begriff} className="rounded-(--radius-lg) bg-surface px-4 py-3">
            <p className="text-[0.9375rem] font-medium">{r.begriff}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{r.begruendung}</p>
            {r.belege[0] && (
              <p className="mt-1 text-sm italic leading-relaxed text-ink-3">„{r.belege[0]}"</p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        Passt eine Richtung nicht?{" "}
        <Link
          href="/app/nina"
          className="inline-flex min-h-6 items-center text-accent-text underline underline-offset-[3px]"
        >
          Sag es {assistantName} im Gespräch
        </Link>{" "}
        — sie entstehen aus deinen Sätzen, also ändern sie sich mit ihnen.
      </p>
    </section>
  );
}
