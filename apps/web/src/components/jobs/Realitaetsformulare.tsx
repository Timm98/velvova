"use client";

import { useState, useTransition } from "react";
import { Button, Card, Textarea } from "@/components/ui";
import { gespraechAnbieten, rueckmeldungAbgeben } from "@/lib/realitaetsproben";

/**
 * Die beiden Schreibwege der Realitätsprobe.
 *
 * ── Was hier gefehlt hat ──────────────────────────────────────
 *
 * `gespraechAnbieten` und `rueckmeldungAbgeben` standen fertig im
 * Code, mit Kommentaren, ohne einen einzigen Aufrufer. Der Block auf
 * der Stellenseite konnte deshalb nur anzeigen, was niemand eintragen
 * konnte: `realitaetsproben` und `realitaetsrueckmeldungen` hatten
 * null Zeilen, und die Überschrift „Was Menschen sagen, die diese
 * Arbeit tun" stand über einer Leerstelle.
 */

const ACHSEN: [keyof Werte, string, string][] = [
  ["klarheit", "Klarheit", "Wusstest du hinterher, worum es in der Arbeit geht?"],
  ["rueckmeldung", "Rückmeldung", "Hast du eine ehrliche Einschätzung bekommen?"],
  ["respekt", "Respekt", "Wurdest du behandelt wie jemand, der eine Entscheidung trifft?"],
  ["tempo", "Tempo", "Wie schnell geht es dort zu?"],
  ["stimmtMitAnzeige", "Deckung mit der Anzeige", "Passt das Gesagte zu dem, was ausgeschrieben ist?"],
  ["energie", "Energie", "Hat dich das Gespräch angezogen oder ermüdet?"],
];

interface Werte {
  klarheit: number | null;
  rueckmeldung: number | null;
  respekt: number | null;
  tempo: number | null;
  stimmtMitAnzeige: number | null;
  energie: number | null;
}

const LEER: Werte = {
  klarheit: null, rueckmeldung: null, respekt: null,
  tempo: null, stimmtMitAnzeige: null, energie: null,
};

export function GespraechAnbieten({ jobId }: { jobId: string }) {
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState("");
  const [fertig, setFertig] = useState(false);
  const [laeuft, starten] = useTransition();

  if (fertig) {
    return (
      <p className="text-sm leading-relaxed text-ink-2">
        Dein Angebot steht. Es erscheint bei dieser Stelle, ohne deinen Namen.
      </p>
    );
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="w-fit text-sm text-accent-text underline underline-offset-[3px]"
      >
        Du machst diese Arbeit? Biete fünfzehn Minuten an.
      </button>
    );
  }

  return (
    <div className="grid gap-2.5">
      <label htmlFor="angebot" className="text-sm text-ink-2">
        Was du erzählen kannst — in einem Satz. Ohne Namen, ohne Firma.
      </label>
      <Textarea
        id="angebot"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Wie ein normaler Dienstag in dieser Rolle aussieht."
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={laeuft || text.trim().length < 10}
          onClick={() =>
            starten(async () => {
              await gespraechAnbieten(jobId, text);
              setFertig(true);
            })
          }
        >
          Anbieten
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOffen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

export function Rueckmeldung({ probeId }: { probeId: string }) {
  const [offen, setOffen] = useState(false);
  const [werte, setWerte] = useState<Werte>(LEER);
  const [notiz, setNotiz] = useState("");
  const [fertig, setFertig] = useState(false);
  const [laeuft, starten] = useTransition();

  if (fertig) {
    return (
      <p className="text-sm leading-relaxed text-ink-2">
        Danke. Deine Angabe erscheint erst als Mittelwert, wenn vier Menschen geantwortet haben —
        aus dreien liesse sich auf dich schliessen.
      </p>
    );
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="w-fit text-sm text-accent-text underline underline-offset-[3px]"
      >
        Du hast so ein Gespräch geführt? Sag, wie es war.
      </button>
    );
  }

  /* Mindestens eine Achse — sonst wäre es eine leere Stimme im Mittelwert. */
  const etwasGesetzt = Object.values(werte).some((v) => v !== null);

  return (
    <Card>
      <div className="grid gap-4">
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Eins bis fünf. Was du auslässt, zählt nicht mit — eine ausgelassene Frage ist etwas
          anderes als eine schlechte Note.
        </p>
        {ACHSEN.map(([k, titel, frage]) => (
          <fieldset key={k} className="grid gap-1.5">
            <legend className="text-sm font-medium text-ink">{titel}</legend>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">{frage}</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={werte[k] === n}
                  onClick={() => setWerte({ ...werte, [k]: werte[k] === n ? null : n })}
                  className={`size-9 rounded-(--radius-md) border text-sm tabular ${
                    werte[k] === n ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="grid gap-1.5">
          <label htmlFor="notiz" className="text-sm font-medium text-ink">
            Etwas, das keine Zahl hergibt
          </label>
          <Textarea id="notiz" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={laeuft || !etwasGesetzt}
            onClick={() =>
              starten(async () => {
                await rueckmeldungAbgeben({ probeId, ...werte, notiz });
                setFertig(true);
              })
            }
          >
            Abschicken
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOffen(false)}>
            Abbrechen
          </Button>
        </div>
      </div>
    </Card>
  );
}
