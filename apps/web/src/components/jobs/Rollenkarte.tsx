import { DIMENSIONSTEXT } from "@paycheck/domain";
import type { Rollenkarte as Karte } from "@/lib/rollenwahrheit";

/**
 * Die Arbeitsrealität — und woher jede Angabe stammt.
 *
 * ── Was eine Stellenanzeige nicht sagt ────────────────────────
 *
 * Sie listet Aufgaben als gleichrangige Punkte. In Wahrheit macht eine
 * davon sechzig Prozent des Tages aus, und genau die entscheidet, ob
 * jemand bleibt. Sie nennt Anforderungen, aber nicht, wie viel Druck,
 * wie viel Kundenkontakt, wie viel Wiederholung dahintersteckt. Und sie
 * sagt nie, warum Menschen wieder gehen.
 *
 * ── Warum die Herkunft an jeder Zeile steht ───────────────────
 *
 * „Viel Eigenverantwortung" ist dieselbe Zeichenkette, ob sie ein
 * Arbeitgeber angegeben, vier Mitarbeiter bestätigt oder ein regulärer
 * Ausdruck im Fliesstext gefunden hat. Als Auskunft sind es drei
 * verschiedene Dinge. Ein Etikett, das nur auf der Seite oben stünde,
 * ginge beim Lesen der dritten Zeile verloren.
 */

const HERKUNFTSWORT = {
  bestaetigt: "von Mitarbeitern bestätigt",
  arbeitgeber: "Angabe des Arbeitgebers",
  abgeleitet: "aus dem Anzeigentext gelesen",
} as const;

const HERKUNFTSTON = {
  bestaetigt: "bg-positive-bg text-positive-text",
  arbeitgeber: "bg-inset text-ink-2",
  abgeleitet: "bg-inset text-ink-3",
} as const;

export function Rollenkarte({ karte }: { karte: Karte }) {
  if (karte.angaben.length === 0 && karte.aufgaben.length === 0) return null;

  return (
    <section aria-labelledby="rollenkarte" className="grid gap-4">
      <div className="grid gap-1">
        <h2 id="rollenkarte" className="text-xl font-semibold">
          Wie der Arbeitsalltag wirklich aussieht
        </h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {karte.vomArbeitgeber
            ? "Der Arbeitgeber hat diese Rolle beschrieben. Wo Mitarbeiter geantwortet haben, steht deren Antwort — auch wenn sie der des Arbeitgebers widerspricht."
            : "Diese Angaben sind aus dem Anzeigentext gelesen, nicht vom Arbeitgeber bestätigt. Sie sind Hinweise, keine Auskunft."}
        </p>
      </div>

      {/*
       * Die Zeitanteile zuerst.
       *
       * Wer wissen will, ob eine Stelle zu ihm passt, fragt zuerst „was
       * mache ich den ganzen Tag" — nicht „welche Anforderungen gibt es".
       */}
      {karte.aufgaben.length > 0 && (
        <div className="grid gap-2 rounded-(--radius-md) bg-inset px-4 py-3.5">
          <h3 className="abschnitts-titel text-ink-3">
            Wofür die Zeit draufgeht
          </h3>
          <ul className="grid gap-2">
            {karte.aufgaben.map((a) => (
              <li key={a.aufgabe} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] text-ink">{a.aufgabe}</span>
                  <span className="font-mono text-sm tabular text-ink-2">{a.zeitanteil} %</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-(--radius-pill) bg-line">
                  <div
                    className="h-full rounded-(--radius-pill) bg-accent"
                    style={{ width: `${Math.min(100, a.zeitanteil)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {karte.angaben.length > 0 && (
        <ul className="grid gap-2.5">
          {karte.angaben.map((a) => {
            const text = DIMENSIONSTEXT[a.dimension];
            const seite = a.wert > 0.5 ? text.viel : text.wenig;
            return (
              <li
                key={a.dimension}
                className={`grid gap-1 rounded-(--radius-md) border px-4 py-3 ${
                  a.widerspruch ? "border-caution-border bg-caution-bg" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[15px] font-medium text-ink">{seite}</span>
                  <span
                    className={`rounded-(--radius-pill) px-2 py-0.5 abschnitts-titel ${
                      HERKUNFTSTON[a.herkunft]
                    }`}
                  >
                    {HERKUNFTSWORT[a.herkunft]}
                    {a.stimmen > 0 ? ` · ${a.stimmen}` : ""}
                  </span>
                </div>
                <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  {text.frage} — {a.beleg}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/*
       * Warum Menschen gehen.
       *
       * Die Angabe, die kein Portal verlangt. Wer sie ausfüllt, sagt
       * etwas über sich — und wer sie leer lässt, auch.
       */}
      {karte.abgaenge.length > 0 && (
        <div className="grid gap-1.5 rounded-(--radius-md) border border-line px-4 py-3.5">
          <h3 className="abschnitts-titel text-ink-3">
            Warum Menschen diese Position verlassen
          </h3>
          <ul className="grid gap-1">
            {karte.abgaenge.map((g) => (
              <li key={g} className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                {g}
              </li>
            ))}
          </ul>
          <p className="text-2xs text-ink-3">Vom Arbeitgeber selbst genannt.</p>
        </div>
      )}
    </section>
  );
}
