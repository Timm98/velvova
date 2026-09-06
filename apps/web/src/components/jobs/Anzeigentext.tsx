import { anzeigenblöcke } from "@paycheck/domain";

/**
 * Den Text einer Stellenanzeige lesbar darstellen.
 *
 * ── Was vorher passierte ──────────────────────────────────────
 *
 * Der Rohtext stand in einem Absatz mit `whitespace-pre-wrap`. Bei
 * 13,6 Prozent der Anzeigen erschien dadurch „**WHY DASH?**" mitten im
 * Text, bei 9,8 Prozent Rauten als Überschrift und bei fast jeder
 * vierten eine Liste ohne Einzug.
 *
 * ── Warum hier kein HTML entsteht ─────────────────────────────
 *
 * `anzeigenblöcke` liefert Text mit einer Art — Überschrift, Absatz,
 * Punkt. Was daraus wird, entscheidet diese Komponente. Es gibt an
 * keiner Stelle fremden Text, der zu Markup wird, und damit nichts
 * einzuschleusen.
 */
export function Anzeigentext({ text, className }: { text: string | null; className?: string }) {
  const blöcke = anzeigenblöcke(text);

  if (blöcke.length === 0) {
    return (
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
        Diese Anzeige enthält keinen Beschreibungstext.
      </p>
    );
  }

  return (
    <div className={className}>
      {blöcke.map((b, i) => {
        if (b.art === "ueberschrift") {
          return (
            <h4
              key={i}
              className="mt-5 mb-1.5 text-sm font-semibold text-ink first:mt-0"
            >
              {b.text}
            </h4>
          );
        }
        if (b.art === "punkt") {
          return (
            <div key={i} className="flex gap-2.5 py-0.5">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-3" />
              <span className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                {b.text}
              </span>
            </div>
          );
        }
        return (
          <p key={i} className="mt-2.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2 first:mt-0">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
