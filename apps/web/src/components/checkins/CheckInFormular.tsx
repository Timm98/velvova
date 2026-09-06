"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { checkInSpeichern } from "@/lib/checkIns";

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
 */

const STUFEN = [
  { wert: 1, wort: "gar nicht" },
  { wert: 2, wort: "wenig" },
  { wert: 3, wort: "teils" },
  { wert: 4, wort: "gut" },
  { wert: 5, wort: "sehr gut" },
];

const FRAGEN: Record<number, string[]> = {
  30: ["Stimmen die Aufgaben mit der Anzeige überein?", "Wie war die Einarbeitung?"],
  90: ["Würdest du dich noch einmal so entscheiden?", "Welche Aufgaben geben Energie, welche kosten sie?"],
  180: ["Ist es das, was du wolltest?", "Was hat sich seit dem Anfang verändert?"],
};

export function CheckInFormular({
  bewerbungen,
}: {
  bewerbungen: { id: string; titel: string; firma: string }[];
}) {
  const [laeuft, starten] = useTransition();
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [marke, setMarke] = useState(30);
  const [wert, setWert] = useState<number | null>(null);

  if (bewerbungen.length === 0) return null;

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
          const applicationId = String(formData.get("bewerbung") ?? "");
          if (!applicationId || wert === null) {
            setFehler("Wähle eine Stelle und wie gut sie passt.");
            return;
          }
          starten(async () => {
            try {
              await checkInSpeichern({
                applicationId,
                tagesmarke: marke,
                gesamtpassung: wert,
                versprechenGegenWirklichkeit: String(formData.get("versprechen") ?? ""),
                aufgabenEnergie: String(formData.get("energie") ?? ""),
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
            {[30, 90, 180].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarke(m)}
                aria-pressed={marke === m}
                className={`min-h-8 rounded-(--radius-pill) border px-3 text-sm ${
                  marke === m ? "border-accent bg-accent-soft text-accent-text" : "border-line text-ink-2"
                }`}
              >
                {m} Tage
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
                className={`min-h-8 rounded-(--radius-pill) border px-3 text-sm ${
                  wert === s.wert ? "border-accent bg-accent-soft text-accent-text" : "border-line text-ink-2"
                }`}
              >
                {s.wort}
              </button>
            ))}
          </div>
        </fieldset>

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
