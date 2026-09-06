import { MIN_ZUSAGEN_FUER_QUOTE, type PromiseKept } from "@paycheck/domain";

/**
 * Der Promise-Kept-Score eines Arbeitgebers.
 *
 * ── Warum das etwas anderes ist als eine Sternebewertung ──────
 *
 * Glassdoor und Vergleichbare bewerten das Unternehmen oder die
 * Kultur: „3,8 von 5". Das ist eine Stimmung, gemittelt über Rollen,
 * Standorte und Jahre.
 *
 * Diese Zahl beantwortet eine engere und nützlichere Frage: Von den
 * Zusagen, die dieses Unternehmen Bewerbern gemacht hat, wie viele
 * haben nach drei Monaten gestimmt?
 *
 * ── Warum sie meistens fehlt ──────────────────────────────────
 *
 * Weil sie erst entsteht, wenn genug Menschen geantwortet haben.
 * Unter acht beurteilten Zusagen liesse sich aus einer Quote auf eine
 * einzelne Person schliessen — und eine Quote aus drei Antworten
 * springt um dreissig Prozentpunkte, sobald eine anders ausgeht.
 *
 * Ein leerer Block ist deshalb kein Mangel, sondern der Normalfall am
 * Anfang.
 */
export function PromiseKeptBlock({ score, firma }: { score: PromiseKept; firma: string }) {
  if (score.beurteilt === 0) return null;

  return (
    <section aria-labelledby="promise" className="grid gap-2">
      <h3 id="promise" className="abschnitts-titel text-ink-3">
        Hält dieser Arbeitgeber, was er zusagt?
      </h3>

      {score.quote === null ? (
        <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
          {score.beurteilt} {score.beurteilt === 1 ? "Zusage wurde" : "Zusagen wurden"} bei {firma}{" "}
          bisher überprüft — zu wenige für eine Quote. Ab {MIN_ZUSAGEN_FUER_QUOTE} steht hier eine
          Zahl.
        </p>
      ) : (
        <div className="grid gap-1.5 rounded-(--radius-md) bg-inset px-4 py-3.5">
          <p className="max-w-[var(--measure)] leading-relaxed text-ink">
            Bei{" "}
            <strong className="font-mono tabular">{Math.round(score.quote * 100)} %</strong> der
            überprüften Punkte stimmte das, was im Bewerbungsprozess gesagt wurde, mit der
            Erfahrung nach drei Monaten überein.
          </p>
          <p className="text-2xs leading-relaxed text-ink-3">
            {score.gehalten} gehalten · {score.teilweise} teilweise · {score.gebrochen} nicht
            gehalten
            {score.zuFrueh > 0 ? ` · ${score.zuFrueh} zu früh zum Beurteilen` : ""}. Aus den
            Angaben von Menschen, die dort angefangen haben — nicht aus Bewertungen.
          </p>
        </div>
      )}
    </section>
  );
}
