"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { checkInSpeichern } from "@/lib/checkIns";
import {
  AUSBILDUNGSPASSUNG_WORTE,
  BERUFSNAEHE_WORTE,
  MARKEN,
  WECHSELGRUND_WORTE,
  markeText,
} from "@paycheck/domain";

/**
 * Der Check-in — eine Pflichtangabe, der Rest freiwillig.
 *
 * ── Warum nur eine Zahl verpflichtend ist ─────────────────────
 *
 * Vier Freitextfelder als Pflicht hiessen: Der Check-in wird nach
 * Feierabend im dritten Monat ausgefüllt oder gar nicht. Die eine Zahl
 * dauert drei Sekunden und trägt die ganze Auswertung — der Text ist
 * für den Menschen selbst wertvoll, nicht für die Statistik.
 *
 * ── Warum die Skala benannt ist ───────────────────────────────
 *
 * „1 bis 5" ohne Worte bedeutet für jeden etwas anderes. Mit
 * Beschriftung antworten Menschen auf dieselbe Frage.
 *
 * ── Warum der Wechselkontext nur einmal erscheint ─────────────
 *
 * Wechselgrund, Berufsnähe und Ausbildungspassung ändern sich nach dem
 * Antritt nicht mehr. Dreimal danach zu fragen wäre eine Zumutung —
 * besonders beim Grund, der eine Kündigung sein kann. Steht er schon,
 * verschwindet der Block; auf spätere Antworten wird er mitgeschrieben.
 */

const STUFEN = [
  { wert: 1, wort: "gar nicht" },
  { wert: 2, wort: "wenig" },
  { wert: 3, wort: "teils" },
  { wert: 4, wort: "gut" },
  { wert: 5, wort: "sehr gut" },
];

/*
 * Die späteren Marken fragen etwas anderes.
 *
 * Nach dreissig Tagen geht es um die Anzeige, nach einem Jahr um die
 * Entscheidung, nach drei Jahren darum, was aus ihr geworden ist. „Wie
 * war die Einarbeitung?" nach drei Jahren zu fragen wäre absurd.
 */
const FRAGEN: Record<number, string[]> = {
  30: ["Stimmen die Aufgaben mit der Anzeige überein?", "Wie war die Einarbeitung?"],
  90: [
    "Würdest du dich noch einmal so entscheiden?",
    "Welche Aufgaben geben Energie, welche kosten sie?",
  ],
  365: [
    "Ist es das geblieben, was es am Anfang war?",
    "Was hat sich verändert — an der Arbeit oder an dir?",
  ],
  1095: [
    "War der Wechsel rückblickend richtig?",
    "Was hat er dir gebracht, was du vorher nicht hattest?",
  ],
};

const PILLE = "min-h-8 rounded-(--radius-pill) border px-3 text-sm";
const AN = "border-accent bg-accent-soft text-accent-text";
const AUS = "border-line text-ink-2";

export function CheckInFormular({
  bewerbungen,
}: {
  bewerbungen: { id: string; titel: string; firma: string; kontextFehlt: boolean }[];
}) {
  const [laeuft, starten] = useTransition();
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [marke, setMarke] = useState<number>(MARKEN[0]);
  const [wert, setWert] = useState<number | null>(null);
  const [bewerbungId, setBewerbungId] = useState(bewerbungen[0]?.id ?? "");
  const [wechselgrund, setWechselgrund] = useState("");
  const [berufsnaehe, setBerufsnaehe] = useState("");
  const [ausbildungspassung, setAusbildungspassung] = useState("");

  if (bewerbungen.length === 0) return null;

  const gewaehlt = bewerbungen.find((b) => b.id === bewerbungId) ?? bewerbungen[0]!;

  if (fertig) {
    return (
      <Card>
        <p className="text-[15px] leading-relaxed text-ink">
          Gespeichert. Deine Antwort bleibt bei dir — geteilt wird nichts.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => {
            setFertig(false);
            setWert(null);
          }}
        >
          Noch einen Check-in
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form
        className="grid gap-4"
        action={(formData) => {
          setFehler(null);
          if (!bewerbungId || wert === null) {
            setFehler("Wähle eine Stelle und wie gut sie passt.");
            return;
          }
          starten(async () => {
            try {
              await checkInSpeichern({
                applicationId: bewerbungId,
                tagesmarke: marke,
                gesamtpassung: wert,
                versprechenGegenWirklichkeit: String(formData.get("versprechen") ?? ""),
                aufgabenEnergie: String(formData.get("energie") ?? ""),
                wechselgrund: wechselgrund || undefined,
                berufsnaehe: berufsnaehe || undefined,
                ausbildungspassung: ausbildungspassung || undefined,
              });
              setFertig(true);
            } catch (e) {
              setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
            }
          });
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="bewerbung" className="text-sm font-medium text-ink">
            Welche Stelle?
          </label>
          <select
            id="bewerbung"
            name="bewerbung"
            value={bewerbungId}
            onChange={(e) => setBewerbungId(e.target.value)}
            className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
          >
            {bewerbungen.map((b) => (
              <option key={b.id} value={b.id}>
                {b.titel} — {b.firma}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-medium text-ink">Seit wann bist du dort?</legend>
          <div className="flex flex-wrap gap-2">
            {MARKEN.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarke(m)}
                aria-pressed={marke === m}
                className={`${PILLE} ${marke === m ? AN : AUS}`}
              >
                {markeText(m)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-medium text-ink">Wie gut passt die Stelle wirklich?</legend>
          <div className="flex flex-wrap gap-2">
            {STUFEN.map((s) => (
              <button
                key={s.wert}
                type="button"
                onClick={() => setWert(s.wert)}
                aria-pressed={wert === s.wert}
                className={`${PILLE} ${wert === s.wert ? AN : AUS}`}
              >
                {s.wort}
              </button>
            ))}
          </div>
        </fieldset>

        {gewaehlt.kontextFehlt && (
          /*
           * Ohne diese drei Angaben ist die Zahl darüber nicht deutbar.
           *
           * Die Zufriedenheit nach einem Wechsel steigt im ersten Jahr
           * und fällt danach — aber wie stark, hängt daran, ob der
           * Wechsel gewollt war, ob er den Beruf verlassen hat und ob
           * die Ausbildung zur Stelle passt. Alle drei bleiben
           * freiwillig: Der Grund kann eine Kündigung sein.
           */
          <fieldset className="grid gap-3 rounded-(--radius-sm) border border-line p-3">
            <legend className="px-1 text-sm font-medium text-ink">
              Zum Wechsel selbst <span className="text-ink-3">(freiwillig, einmalig)</span>
            </legend>

            <div className="grid gap-1.5">
              <span className="text-sm text-ink-2">Wie kam der Wechsel zustande?</span>
              <div className="flex flex-wrap gap-2">
                {WECHSELGRUND_WORTE.map((o) => (
                  <button
                    key={o.wert}
                    type="button"
                    onClick={() => setWechselgrund(wechselgrund === o.wert ? "" : o.wert)}
                    aria-pressed={wechselgrund === o.wert}
                    className={`${PILLE} ${wechselgrund === o.wert ? AN : AUS}`}
                  >
                    {o.wort}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-sm text-ink-2">Wie nah ist die neue Stelle an der alten?</span>
              <div className="flex flex-wrap gap-2">
                {BERUFSNAEHE_WORTE.map((o) => (
                  <button
                    key={o.wert}
                    type="button"
                    onClick={() => setBerufsnaehe(berufsnaehe === o.wert ? "" : o.wert)}
                    aria-pressed={berufsnaehe === o.wert}
                    className={`${PILLE} ${berufsnaehe === o.wert ? AN : AUS}`}
                  >
                    {o.wort}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-sm text-ink-2">Und deine Ausbildung dazu?</span>
              <div className="flex flex-wrap gap-2">
                {AUSBILDUNGSPASSUNG_WORTE.map((o) => (
                  <button
                    key={o.wert}
                    type="button"
                    onClick={() =>
                      setAusbildungspassung(ausbildungspassung === o.wert ? "" : o.wert)
                    }
                    aria-pressed={ausbildungspassung === o.wert}
                    className={`${PILLE} ${ausbildungspassung === o.wert ? AN : AUS}`}
                  >
                    {o.wort}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-2xs leading-relaxed text-ink-3">
              Danach wird nur einmal gefragt. Es ist der Unterschied zwischen einer Zahl und einer
              Aussage — ein Verlauf nach einer Kündigung ist ein anderer als nach einem gewollten
              Wechsel. Jedes Feld darf leer bleiben.
            </p>
          </fieldset>
        )}

        {(FRAGEN[marke] ?? []).map((frage, i) => (
          <div key={frage} className="grid gap-1.5">
            <label htmlFor={`f${i}`} className="text-sm text-ink-2">
              {frage} <span className="text-ink-3">(freiwillig)</span>
            </label>
            <textarea
              id={`f${i}`}
              name={i === 0 ? "versprechen" : "energie"}
              rows={2}
              className="rounded-(--radius-sm) border border-line bg-surface px-3 py-2 text-[15px] text-ink"
            />
          </div>
        ))}

        {fehler && <p className="text-sm text-critical-text">{fehler}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={laeuft}>
            {laeuft ? "Wird gespeichert…" : "Check-in speichern"}
          </Button>
          <p className="text-2xs text-ink-3">Bleibt privat. Nichts davon geht an einen Arbeitgeber.</p>
        </div>
      </form>
    </Card>
  );
}
