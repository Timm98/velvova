import { MIN_BEWERBUNGEN, type Antwortquote } from "@/lib/antwortquote";

/**
 * Antwortet dieser Arbeitgeber?
 *
 * ── Warum diese Zahl auf keiner Jobbörse steht ────────────────
 *
 * Weil deren Kunden die Arbeitgeber sind. „Hier bekommen sechs von
 * zehn Bewerbern nie eine Antwort" verkauft keine Stellenanzeigen.
 *
 * Für den Suchenden ist es eine der nützlichsten Auskünfte überhaupt:
 * Eine Bewerbung kostet ihn eine Stunde, und er erfährt erst nach
 * Wochen, dass sie vergeblich war.
 *
 * ── Warum eine Absage als Antwort zählt ───────────────────────
 *
 * Wer absagt, respektiert die Zeit des anderen. Das ist etwas anderes
 * als Schweigen, und eine Quote, die beides gleichsetzte, bestrafte
 * den ehrlicheren Arbeitgeber.
 */
export function Antwortblock({ quote, firma }: { quote: Antwortquote; firma: string }) {
  if (quote.beurteilt === 0) return null;

  if (quote.quote === null) {
    return (
      <section aria-labelledby="antwort" className="grid gap-1.5">
        <h3 id="antwort" className="abschnitts-titel text-ink-3">
          Antwortet dieser Arbeitgeber?
        </h3>
        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
          {quote.beurteilt} {quote.beurteilt === 1 ? "Bewerbung ist" : "Bewerbungen sind"} bei{" "}
          {firma} alt genug, um es zu beurteilen — zu wenige für eine Quote. Ab{" "}
          {MIN_BEWERBUNGEN} steht hier eine Zahl.
        </p>
      </section>
    );
  }

  const prozent = Math.round(quote.quote * 100);
  /*
   * Die Einordnung in Worten, nicht als Ampel.
   *
   * Eine rote Ampel neben einem Arbeitgeber ist ein Urteil; „vier von
   * zehn bleiben ohne Antwort" ist eine Auskunft. Der Leser urteilt
   * selbst.
   */
  const ohne = 100 - prozent;

  return (
    <section aria-labelledby="antwort" className="grid gap-2">
      <h3 id="antwort" className="abschnitts-titel text-ink-3">
        Antwortet dieser Arbeitgeber?
      </h3>
      <div className="grid gap-1.5 rounded-(--radius-md) bg-inset px-4 py-3.5">
        <p className="max-w-[var(--measure)] leading-relaxed text-ink">
          <strong className="font-mono tabular">{prozent} %</strong> der Bewerbungen bekamen eine
          Reaktion
          {quote.medianTage !== null ? (
            <>
              , im Mittel nach <strong className="font-mono tabular">{quote.medianTage}</strong>{" "}
              {quote.medianTage === 1 ? "Tag" : "Tagen"}
            </>
          ) : null}
          .{ohne > 0 ? ` Bei ${ohne} % blieb es still.` : ""}
        </p>
        <p className="text-2xs leading-relaxed text-ink-3">
          Aus {quote.beurteilt} Bewerbungen, die mindestens vier Wochen zurückliegen. Eine Absage
          zählt als Antwort — wer absagt, respektiert die Zeit des anderen. Gezählt wird, was
          Menschen hier eingetragen haben; Bewerbungen ausserhalb dieser Anwendung sind nicht
          darin.
        </p>
      </div>
    </section>
  );
}
