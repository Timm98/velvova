"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { probeAbgeben, type Probe, type Probenergebnis } from "@/lib/proben";

/**
 * Eine Arbeitsprobe durchspielen.
 *
 * ── Warum die Energiefrage NACH der Aufgabe kommt ─────────────
 *
 * Vorher gefragt, beantwortet sie jemand aus der Erwartung heraus.
 * Danach gefragt, beantwortet er sie aus der Erfahrung — und genau
 * darin liegt der Unterschied zu einem Fragebogen.
 *
 * ── Warum die Auflösung immer erscheint ───────────────────────
 *
 * Auch bei richtiger Antwort. Eine Probe ohne Erklärung wäre eine
 * Prüfung, und Prüfungen macht niemand freiwillig zweimal.
 */

const ENERGIE = [
  { wert: 1, wort: "hat mich ausgelaugt" },
  { wert: 2, wort: "eher anstrengend" },
  { wert: 3, wort: "weder noch" },
  { wert: 4, wort: "hat Spass gemacht" },
  { wert: 5, wort: "davon mehr" },
];

export function ProbeSpielen({ probe }: { probe: Probe }) {
  const [begonnen] = useState(() => Date.now());
  const [auswahl, setAuswahl] = useState<number[]>([]);
  const [phase, setPhase] = useState<"aufgabe" | "energie" | "fertig">("aufgabe");
  const [ergebnis, setErgebnis] = useState<Probenergebnis | null>(null);
  const [laeuft, starten] = useTransition();

  const fertigMitAufgabe =
    probe.art === "text"
      ? true
      : probe.art === "auswahl"
        ? auswahl.length === 1
        : auswahl.length === probe.optionen.length;

  return (
    <Card>
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-ink">{probe.titel}</h2>
            <span className="abschnitts-titel text-ink-3">
              etwa {probe.dauerSekunden} Sekunden
            </span>
          </div>
          <p className="max-w-[var(--measure)] leading-relaxed text-ink">{probe.aufgabe}</p>
        </div>

        {phase === "aufgabe" && probe.art === "auswahl" && (
          <ul className="grid gap-2">
            {probe.optionen.map((o, i) => (
              <li key={o}>
                <button
                  type="button"
                  onClick={() => setAuswahl([i])}
                  aria-pressed={auswahl[0] === i}
                  className={`w-full rounded-(--radius-md) border px-4 py-3 text-left text-[15px] leading-relaxed ${
                    auswahl[0] === i ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2"
                  }`}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        )}

        {phase === "aufgabe" && probe.art === "reihenfolge" && (
          <div className="grid gap-2">
            <p className="text-2xs text-ink-3">
              In der Reihenfolge anklicken, in der du vorgehen würdest.
            </p>
            <ul className="grid gap-2">
              {probe.optionen.map((o, i) => {
                const platz = auswahl.indexOf(i);
                return (
                  <li key={o}>
                    <button
                      type="button"
                      onClick={() =>
                        setAuswahl(platz >= 0 ? auswahl.filter((x) => x !== i) : [...auswahl, i])
                      }
                      /* Die Wahl steht sonst nur in Farbe und Ziffer. */
                      aria-pressed={platz >= 0}
                      className={`flex w-full items-start gap-3 rounded-(--radius-md) border px-4 py-3 text-left text-[15px] leading-relaxed ${
                        platz >= 0 ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2"
                      }`}
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-(--radius-pill) border border-current font-mono text-2xs">
                        {platz >= 0 ? platz + 1 : ""}
                      </span>
                      {o}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {phase === "aufgabe" && (
          <Button disabled={!fertigMitAufgabe} onClick={() => setPhase("energie")}>
            Weiter
          </Button>
        )}

        {phase === "energie" && (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">Wie hat sich das angefühlt?</legend>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              Nicht, ob du es richtig gemacht hast — ob du so etwas gern tust. Das ist die Angabe,
              die keine Bewerbung hergibt.
            </p>
            <div className="flex flex-wrap gap-2">
              {ENERGIE.map((e) => (
                <button
                  key={e.wert}
                  type="button"
                  disabled={laeuft}
                  onClick={() =>
                    starten(async () => {
                      const r = await probeAbgeben(
                        probe.id,
                        auswahl,
                        e.wert,
                        Math.round((Date.now() - begonnen) / 1000),
                      );
                      setErgebnis(r);
                      setPhase("fertig");
                    })
                  }
                  className="min-h-9 rounded-(--radius-pill) border border-line px-3.5 text-sm text-ink-2 hover:border-accent hover:text-ink"
                >
                  {e.wort}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {phase === "fertig" && ergebnis && (
          <div className="grid gap-3 rounded-(--radius-md) bg-inset px-4 py-3.5">
            {ergebnis.richtig !== null && (
              <p className="text-[15px] font-medium text-ink">
                {ergebnis.richtig
                  ? "Genau so."
                  : "So macht man es üblicherweise nicht — hier ist der Grund."}
              </p>
            )}
            <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">{ergebnis.erklaerung}</p>
            {ergebnis.richtig === false && probe.art === "reihenfolge" && (
              <ol className="grid gap-1 text-sm text-ink-2">
                {ergebnis.loesung.map((i, platz) => (
                  <li key={i}>
                    {platz + 1}. {probe.optionen[i]}
                  </li>
                ))}
              </ol>
            )}
            <a
              href="/app/proben"
              className="w-fit text-sm text-accent-text underline underline-offset-[3px]"
            >
              Nächste Aufgabe
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}
