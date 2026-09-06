"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card } from "@/components/ui";
import {
  automatikAbschalten,
  eigeninitiativeSetzen,
  type Eigeninitiativestand,
} from "@/lib/proaktiv/aktionen";

/**
 * Wie viel Nina von sich aus tun darf.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Einstellung NICHT kann
 * ══════════════════════════════════════════════════════════════
 *
 * Sie ändert die Häufigkeit, nicht die Berechtigung. „Proaktiv“ macht
 * Nina gesprächiger, nicht mächtiger — eine Bewerbung schickt sie
 * auch dann nicht.
 *
 * Das steht auch im Text unter den Stufen. Eine Einstellung, bei der
 * jemand vermuten könnte, sie schalte Sicherheitsregeln ab, wäre eine
 * schlechte Einstellung, selbst wenn sie es nicht tut.
 */
const STUFEN = [
  {
    wert: "zurueckhaltend",
    name: "Zurückhaltend",
    text: "Nina meldet sich selten und nur bei etwas Wichtigem.",
  },
  {
    wert: "ausgeglichen",
    name: "Ausgeglichen",
    text: "Nina merkt Stellen vor und sagt gelegentlich Bescheid.",
  },
  {
    wert: "proaktiv",
    name: "Proaktiv",
    text: "Nina denkt laut mit und schlägt öfter etwas vor.",
  },
] as const;

export function Eigeninitiative({ stand }: { stand: Eigeninitiativestand }) {
  const [stufe, setStufe] = useState(stand.stufe);
  const [schalter, setSchalter] = useState(stand.schalter);
  const [laeuft, starten] = useTransition();

  function stufeWaehlen(neu: string) {
    setStufe(neu);
    starten(async () => {
      await eigeninitiativeSetzen(neu);
    });
  }

  function schalten(handlung: string, erlaubt: boolean) {
    setSchalter((s) => s.map((x) => (x.handlung === handlung ? { ...x, erlaubt } : x)));
    starten(async () => {
      await automatikAbschalten(handlung, erlaubt);
    });
  }

  return (
    <Card>
      <div className="grid gap-5">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold text-ink">Ninas Eigeninitiative</h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Wie oft Nina sich von selbst meldet. Das ändert nur, wie häufig sie etwas sagt — nicht,
            was sie darf. Bewerbungen schickt sie nie ohne deinen ausdrücklichen Auftrag.
          </p>
        </div>

        <fieldset className="grid gap-2">
          <legend className="sr-only">Stufe der Eigeninitiative</legend>
          {STUFEN.map((s) => (
            <label
              key={s.wert}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-2 px-3 py-2.5 has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name="eigeninitiative"
                value={s.wert}
                checked={stufe === s.wert}
                disabled={laeuft}
                onChange={() => stufeWaehlen(s.wert)}
                className="mt-1"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-ink">{s.name}</span>
                <span className="text-sm text-ink-2">{s.text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-2">
          <h4 className="text-sm font-semibold text-ink">Nina darf automatisch</h4>
          <ul className="grid gap-1.5">
            {schalter.map((s) => (
              <li key={s.handlung}>
                <label className="flex cursor-pointer items-start gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={s.erlaubt}
                    disabled={laeuft}
                    onChange={(e) => schalten(s.handlung, e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-ink-2">{s.beschreibung}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/*
          Die Grenze steht in der Oberfläche, nicht nur im Code.
          Wer wissen will, was Nina niemals von selbst tut, soll es
          lesen können, ohne jemanden zu fragen.
        */}
        <div className="grid gap-1 rounded-lg bg-soft px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <Badge tone="outline">Nie von selbst</Badge>
          </span>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Bewerbungen abschicken, Arbeitgeber kontaktieren, deine Daten weitergeben, dein Profil
            freigeben, etwas kündigen, unterschreiben oder bezahlen. Dafür braucht Nina jedes Mal
            deinen ausdrücklichen Auftrag.
          </p>
        </div>
      </div>
    </Card>
  );
}
