import Link from "next/link";
import { meineBewerbungen } from "@/lib/arbeitgeber/bewerbungen";
import { STUFENNAME, type Stufe } from "@/lib/arbeitgeber/stufen";
import { Zuruckziehen } from "./Zuruckziehen";

/**
 * Bewerbungen auf Stellen, die ein Arbeitgeber hier eingestellt hat.
 *
 * ── Warum das getrennt steht ──────────────────────────────────
 *
 * Die Liste darunter führt Bewerbungen, die jemand selbst verwaltet: Er
 * trägt ein, wo er sich beworben hat und wie es steht. Diese hier sind
 * anders — der Stand kommt vom Unternehmen, nicht aus der eigenen
 * Notiz. „Sichtung" heisst hier tatsächlich, dass jemand hineingesehen
 * hat.
 *
 * Beides in eine Liste zu werfen sähe aufgeräumter aus und wäre eine
 * Verwechslung: Bei der einen Hälfte steht der Stand für die
 * Wirklichkeit, bei der anderen für eine Vermutung.
 *
 * ── Was hier NICHT steht ──────────────────────────────────────
 *
 * Die interne Notiz des Unternehmens. Sie gehört dem Unternehmen —
 * die Gegenrichtung derselben Trennlinie, die den Monday-Chat vor dem
 * Unternehmen schützt. Eine interne Notiz, die der Bewerber lesen kann,
 * ist keine interne Notiz, und dann schreibt niemand mehr eine ehrliche.
 */
export async function VelvovaBewerbungen() {
  const bewerbungen = await meineBewerbungen();
  if (bewerbungen.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">Über Velvova beworben</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Bei diesen Stellen kommt der Stand vom Unternehmen selbst — nicht aus deiner Notiz.
        </p>
      </div>

      <ul className="grid gap-2">
        {bewerbungen.map((b) => (
          <li
            key={b.id}
            className="grid gap-2 rounded-(--radius-surface) bg-surface p-4 ring-1 ring-line"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-ink">{b.stellentitel}</span>
                <span className="text-2xs text-ink-2">
                  beworben am {b.createdAt.toLocaleDateString("de-DE")}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-(--radius-pill) bg-inset px-2.5 py-0.5 font-mono text-2xs text-ink-2">
                  {b.withdrawnAt
                    ? "zurückgezogen"
                    : (STUFENNAME[b.stage as Stufe] ?? b.stage)}
                </span>
                {!b.withdrawnAt && <Zuruckziehen id={b.id} />}
              </span>
            </div>

            {b.rejectedReason && (
              /*
               * Der Absagegrund steht hier, wenn das Unternehmen einen
               * eingetragen hat.
               *
               * Eine Absage ohne Begründung ist die am häufigsten
               * kritisierte Erfahrung im ganzen Bewerbungsprozess. Wenn
               * ein Grund existiert, gibt es keinen Anlass, ihn
               * zurückzuhalten.
               */
              <p className="max-w-[var(--measure)] border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-2">
                {b.rejectedReason}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="text-2xs text-ink-3">
        <Link href="/app/jobs" className="text-accent-text underline underline-offset-[3px]">
          Weitere Stellen ansehen
        </Link>
      </p>
    </section>
  );
}
