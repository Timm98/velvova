"use client";

import { useState, useTransition } from "react";
import { ARBEITSDIMENSIONEN, DIMENSIONSTEXT, type Arbeitsdimension } from "@paycheck/domain";
import { Button, Card } from "@/components/ui";
import { abgaengeSpeichern, aufgabenSpeichern, rollenachsenSpeichern } from "@/lib/arbeitgeber/rollenkarte";

/**
 * Die Role Truth Card ausfüllen.
 *
 * ── Warum ein Arbeitgeber das freiwillig tut ──────────────────
 *
 * Weil es ihm nützt. Wer „viel Druck" angibt, verliert die Menschen,
 * die keinen wollen — und findet die, die ihn suchen. Die Angaben
 * verbessern keine Passung; sie schärfen sie in beide Richtungen.
 *
 * Auf der Stellenseite steht sichtbar, ob eine Karte ausgefüllt wurde
 * oder ob die Angaben nur aus dem Anzeigentext gelesen sind. Ein leeres
 * Formular ist damit auch eine Aussage.
 */

export function Rollenwahrheit({
  postingId,
  achsen,
  aufgaben: anfangsAufgaben,
  abgaenge: anfangsAbgaenge,
}: {
  postingId: string;
  achsen: Partial<Record<Arbeitsdimension, { wert: number; begruendung: string }>>;
  aufgaben: { aufgabe: string; zeitanteil: number }[];
  abgaenge: string[];
}) {
  const [werte, setWerte] = useState(achsen);
  const [beruehrt, setBeruehrt] = useState<Set<string>>(new Set(Object.keys(achsen)));
  const [aufgaben, setAufgaben] = useState(
    anfangsAufgaben.length > 0 ? anfangsAufgaben : [{ aufgabe: "", zeitanteil: 0 }],
  );
  const [abgaenge, setAbgaenge] = useState(anfangsAbgaenge.length > 0 ? anfangsAbgaenge : [""]);
  const [laeuft, starten] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  const summe = aufgaben.reduce((a, b) => a + (b.zeitanteil || 0), 0);

  return (
    <Card>
      <div className="grid gap-6">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-ink">Wie der Alltag in dieser Rolle aussieht</h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Alles freiwillig. Diese Angaben verbessern keine Passung — sie schärfen sie: Wer viel
            Druck angibt, verliert die Menschen, die keinen wollen, und findet die, die ihn suchen.
            Auf der Stellenseite steht, ob eine Karte ausgefüllt wurde.
          </p>
        </div>

        {/* ── Zeitanteile ── */}
        <div className="grid gap-2">
          <h3 className="abschnitts-titel text-ink-3">
            Wofür geht die Zeit drauf?
          </h3>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Die Anzeige listet Aufgaben als gleichrangige Punkte. In Wahrheit macht eine davon oft
            die Hälfte des Tages aus — und genau die entscheidet, ob jemand bleibt.
          </p>
          {aufgaben.map((a, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={a.aufgabe}
                placeholder="Aufgabe"
                onChange={(e) => {
                  const neu = [...aufgaben];
                  neu[i] = { ...a, aufgabe: e.target.value };
                  setAufgaben(neu);
                }}
                className="min-h-9 min-w-48 flex-1 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={a.zeitanteil || ""}
                placeholder="%"
                onChange={(e) => {
                  const neu = [...aufgaben];
                  neu[i] = { ...a, zeitanteil: Number(e.target.value) };
                  setAufgaben(neu);
                }}
                className="min-h-9 w-20 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] tabular text-ink"
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setAufgaben([...aufgaben, { aufgabe: "", zeitanteil: 0 }])}>
              Aufgabe hinzufügen
            </Button>
            <span className={`text-2xs ${summe > 100 ? "text-critical-text" : "text-ink-3"}`}>
              {summe} % vergeben{summe > 100 ? " — mehr als ein Tag hat" : ""}
            </span>
          </div>
        </div>

        {/* ── Die zehn Achsen ── */}
        <div className="grid gap-3">
          <h3 className="abschnitts-titel text-ink-3">
            Wie ist die Arbeit wirklich?
          </h3>
          {ARBEITSDIMENSIONEN.map((d) => {
            const text = DIMENSIONSTEXT[d];
            const v = werte[d];
            const gesetzt = beruehrt.has(d);
            return (
              <div key={d} className="grid gap-1.5">
                <label htmlFor={`a-${d}`} className="text-sm font-medium text-ink">
                  {text.frage}
                </label>
                <input
                  id={`a-${d}`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((v?.wert ?? 0.5) * 100)}
                  onChange={(e) => {
                    setWerte({
                      ...werte,
                      [d]: { wert: Number(e.target.value) / 100, begruendung: v?.begruendung ?? "" },
                    });
                    setBeruehrt(new Set([...beruehrt, d]));
                  }}
                />
                <div className="flex flex-wrap justify-between gap-2 text-2xs text-ink-3">
                  <span>{text.wenig}</span>
                  {!gesetzt && <span>nicht beantwortet</span>}
                  <span>{text.viel}</span>
                </div>
                {gesetzt && (
                  <input
                    value={v?.begruendung ?? ""}
                    placeholder="Warum? (steht auf der Stellenseite)"
                    onChange={(e) =>
                      setWerte({ ...werte, [d]: { wert: v?.wert ?? 0.5, begruendung: e.target.value } })
                    }
                    className="min-h-8 rounded-(--radius-sm) border border-line bg-surface px-3 text-sm text-ink"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Warum Menschen gehen ── */}
        <div className="grid gap-2">
          <h3 className="abschnitts-titel text-ink-3">
            Warum verlassen Menschen diese Position?
          </h3>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Die Frage, die kein Portal stellt. Eine ehrliche Antwort hier spart beiden Seiten das
            dritte Gespräch.
          </p>
          {abgaenge.map((g, i) => (
            <input
              key={i}
              value={g}
              placeholder="z. B. Der Schichtdienst passt auf Dauer nicht zu jeder Familie"
              onChange={(e) => {
                const neu = [...abgaenge];
                neu[i] = e.target.value;
                setAbgaenge(neu);
              }}
              className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
            />
          ))}
          <Button variant="secondary" size="sm" onClick={() => setAbgaenge([...abgaenge, ""])}>
            Grund hinzufügen
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={laeuft}
            onClick={() => {
              setMeldung(null);
              starten(async () => {
                try {
                  const nur: Record<string, { wert: number; begruendung: string }> = {};
                  for (const d of beruehrt) if (werte[d as Arbeitsdimension]) nur[d] = werte[d as Arbeitsdimension]!;
                  await rollenachsenSpeichern(postingId, nur);
                  await aufgabenSpeichern(postingId, aufgaben);
                  await abgaengeSpeichern(postingId, abgaenge);
                  setMeldung("Gespeichert.");
                } catch (e) {
                  setMeldung(e instanceof Error ? e.message : "Das hat nicht geklappt.");
                }
              });
            }}
          >
            {laeuft ? "Wird gespeichert…" : "Rollenbeschreibung speichern"}
          </Button>
          {meldung && <span className="text-sm text-ink-2">{meldung}</span>}
        </div>
      </div>
    </Card>
  );
}
