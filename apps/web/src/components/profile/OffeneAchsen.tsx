"use client";

import { useState, useTransition } from "react";
import { DIMENSIONSTEXT, type Arbeitsdimension } from "@paycheck/domain";
import { Button, Card } from "@/components/ui";
import { achseBeurteilen } from "@/lib/achsenAktionen";

/**
 * Was Nina aus dem Gespräch gelesen hat — zur Bestätigung.
 *
 * ── Warum überhaupt gefragt wird ──────────────────────────────
 *
 * „Du willst wenig Kundenkontakt" ist eine Aussage über einen
 * Menschen, die seine Stellenauswahl verändert. Aus einem Nebensatz
 * abgeleitet und nicht nachgefragt, behauptet sie etwas über ihn, das
 * er so nie gesagt hat.
 *
 * Bei den Erkenntnissen macht Nina das längst richtig. Hier fehlte es.
 *
 * ── Warum die Belegstelle dabeisteht ──────────────────────────
 *
 * „Nina meint, du magst keinen Kundenkontakt" lässt sich nur
 * beantworten, wenn man weiss, woran sie es festmacht. Mit dem Zitat
 * wird aus einer Behauptung eine überprüfbare Frage.
 */
export function OffeneAchsen({
  achsen,
}: {
  achsen: { id: string; dimension: Arbeitsdimension; wert: number; beleg: string }[];
}) {
  const [erledigt, setErledigt] = useState<Set<string>>(new Set());
  const [laeuft, starten] = useTransition();

  const offen = achsen.filter((a) => !erledigt.has(a.id));
  if (offen.length === 0) return null;

  return (
    <Card className="border-assistant-border bg-assistant-soft">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-ink">Habe ich das richtig verstanden?</h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Das habe ich aus unserem Gespräch herausgehört. Es zählt schon jetzt mit — aber nur
            halb, solange du nichts dazu gesagt hast.
          </p>
        </div>

        <ul className="grid gap-2.5">
          {offen.map((a) => {
            const text = DIMENSIONSTEXT[a.dimension];
            const seite = a.wert > 0.5 ? text.viel : text.wenig;
            return (
              <li key={a.id} className="grid gap-2 rounded-(--radius-md) bg-surface px-4 py-3">
                <div className="grid gap-1">
                  <p className="text-[15px] leading-relaxed text-ink">
                    Du möchtest eher <strong className="font-medium">{seite}</strong>.
                  </p>
                  <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                    {a.beleg}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={laeuft}
                    onClick={() =>
                      starten(async () => {
                        await achseBeurteilen(a.id, true);
                        setErledigt(new Set([...erledigt, a.id]));
                      })
                    }
                  >
                    Stimmt
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={laeuft}
                    onClick={() =>
                      starten(async () => {
                        await achseBeurteilen(a.id, false);
                        setErledigt(new Set([...erledigt, a.id]));
                      })
                    }
                  >
                    So nicht
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-2xs leading-relaxed text-ink-3">
          „So nicht" nimmt die Aussage zurück — sie zählt dann gar nicht mehr. Den Regler darunter
          kannst du trotzdem jederzeit selbst setzen.
        </p>
      </div>
    </Card>
  );
}
