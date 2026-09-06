"use client";

import { useState, useTransition } from "react";
import { ARBEITSDIMENSIONEN, DIMENSIONSTEXT, type Arbeitsdimension } from "@paycheck/domain";
import { Button, Card } from "@/components/ui";
import { twinSetzen } from "@/lib/twinAktionen";

/**
 * Zehn Achsen, jede mit benannten Enden.
 *
 * ── Warum keine Zahlen an den Reglern ─────────────────────────
 *
 * „7 von 10 Autonomie" bedeutet für niemanden etwas. „Klare Ansagen"
 * gegen „eigene Entscheidungen" bedeutet für jeden dasselbe — und nur
 * dann antworten zwei Menschen auf dieselbe Frage.
 *
 * ── Warum nichts vorausgewählt ist ────────────────────────────
 *
 * Ein Regler in der Mitte sähe aus wie eine Antwort. Solange niemand
 * ihn angefasst hat, ist die Achse unbeantwortet — und eine
 * unbeantwortete Achse fällt aus dem Vergleich, statt ihn zu
 * verwässern.
 */
export function TwinRegler({
  vorhanden,
}: {
  vorhanden: Partial<Record<Arbeitsdimension, number>>;
}) {
  const [werte, setWerte] = useState<Partial<Record<Arbeitsdimension, number>>>(vorhanden);
  const [beruehrt, setBeruehrt] = useState<Set<string>>(new Set(Object.keys(vorhanden)));
  const [laeuft, starten] = useTransition();
  const [fertig, setFertig] = useState(false);

  return (
    <Card>
      <div className="grid gap-5">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-ink">Wie du arbeiten willst</h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Zehn Fragen, keine Pflicht. Was du hier einstellst, vergleichen wir mit dem, was in den
            Anzeigen steht — Achse für Achse. Was du auslässt, fällt aus dem Vergleich und wird
            nicht geraten.
          </p>
        </div>

        <div className="grid gap-4">
          {ARBEITSDIMENSIONEN.map((d) => {
            const text = DIMENSIONSTEXT[d];
            const wert = werte[d];
            const gesetzt = beruehrt.has(d);
            return (
              <div key={d} className="grid gap-1.5">
                <label htmlFor={`d-${d}`} className="text-sm font-medium text-ink">
                  {text.frage}
                </label>
                <input
                  id={`d-${d}`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((wert ?? 0.5) * 100)}
                  onChange={(e) => {
                    setWerte({ ...werte, [d]: Number(e.target.value) / 100 });
                    setBeruehrt(new Set([...beruehrt, d]));
                    setFertig(false);
                  }}
                />
                <div className="flex flex-wrap justify-between gap-2 text-2xs text-ink-3">
                  <span>{text.wenig}</span>
                  {!gesetzt && <span>noch nicht beantwortet</span>}
                  <span>{text.viel}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={laeuft || beruehrt.size === 0}
            onClick={() => {
              starten(async () => {
                const nur: Record<string, number> = {};
                for (const d of beruehrt) {
                  const w = werte[d as Arbeitsdimension];
                  if (w !== undefined) nur[d] = w;
                }
                await twinSetzen(nur);
                setFertig(true);
              });
            }}
          >
            {laeuft ? "Wird gespeichert…" : `${beruehrt.size} von 10 speichern`}
          </Button>
          {fertig && <span className="text-sm text-positive-text">Gespeichert.</span>}
        </div>
      </div>
    </Card>
  );
}
