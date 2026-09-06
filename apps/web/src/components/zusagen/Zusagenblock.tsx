"use client";

import { useState, useTransition } from "react";
import {
  PUNKTTEXT,
  STANDTEXT,
  ZUSAGEPUNKTE,
  type Zusagenherkunft,
  type Zusagenstand,
  type Zusagepunkt,
} from "@paycheck/domain";
import { Button, Card } from "@/components/ui";
import { zusageFesthalten, zusagePruefen, type ZusageZeile } from "@/lib/zusagen";

/**
 * Zusagen festhalten und später prüfen.
 *
 * ── Warum das vor der Unterschrift passiert ───────────────────
 *
 * Nach drei Monaten erinnert sich niemand mehr genau, was im zweiten
 * Gespräch gesagt wurde. Genau darauf beruht die häufigste schlechte
 * Jobentscheidung: nicht der falsche Beruf, sondern eine Arbeit, die
 * nicht dem entsprach, was versprochen wurde.
 *
 * ── Warum „zu früh“ eine eigene Antwort ist ───────────────────
 *
 * „Zwei Homeoffice-Tage nach dem ersten Monat" lässt sich nach
 * vierzehn Tagen nicht beurteilen. Wer hier „stimmt nicht" anklickt,
 * würde einen Arbeitgeber für etwas abwerten, das noch gar nicht
 * fällig war.
 */

const HERKUNFT: { wert: Zusagenherkunft; wort: string }[] = [
  { wert: "arbeitgeber_bestaetigt", wort: "auf Nachfrage bestätigt" },
  { wert: "vertrag", wort: "steht im Vertrag" },
  { wert: "gespraech", wort: "im Gespräch gesagt" },
  { wert: "anzeige", wort: "stand in der Anzeige" },
];

const STAENDE: Zusagenstand[] = ["gehalten", "teilweise", "gebrochen", "zu_frueh"];

const TON: Record<Zusagenstand, string> = {
  gehalten: "border-positive-border bg-positive-bg text-positive-text",
  teilweise: "border-caution-border bg-caution-bg text-caution-text",
  gebrochen: "border-critical-border bg-critical-bg text-critical-text",
  zu_frueh: "border-line bg-inset text-ink-3",
};

export function Zusagenblock({
  applicationId,
  zusagen,
  pruefbar,
}: {
  applicationId: string;
  zusagen: ZusageZeile[];
  /** Die Marken, die schon fällig sind. Leer, solange niemand angefangen hat. */
  pruefbar: number[];
}) {
  const [laeuft, starten] = useTransition();
  const [punkt, setPunkt] = useState<Zusagepunkt>("aufgaben");
  const [herkunft, setHerkunft] = useState<Zusagenherkunft>("gespraech");
  const [fehler, setFehler] = useState<string | null>(null);

  const offen = ZUSAGEPUNKTE.filter((p) => !zusagen.some((z) => z.punkt === p));

  return (
    <div className="grid gap-6">
      <Card>
        <form
          className="grid gap-4"
          action={(fd) => {
            setFehler(null);
            const zusage = String(fd.get("zusage") ?? "").trim();
            if (zusage.length < 3) {
              setFehler("Schreib kurz, was zugesagt wurde.");
              return;
            }
            starten(async () => {
              try {
                await zusageFesthalten({
                  applicationId,
                  punkt,
                  zusage,
                  herkunft,
                  beleg: String(fd.get("beleg") ?? ""),
                });
                (document.getElementById("zusage") as HTMLInputElement | null)?.form?.reset();
              } catch (e) {
                setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
              }
            });
          }}
        >
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold text-ink">Was wurde dir zugesagt?</h2>
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Halte es jetzt fest, solange es frisch ist. Nach drei Monaten erinnert sich niemand
              mehr genau, was im zweiten Gespräch gesagt wurde — und genau daran scheitern die
              meisten Jobentscheidungen.
            </p>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="punkt" className="text-sm font-medium text-ink">
              Worum geht es?
            </label>
            <select
              id="punkt"
              value={punkt}
              onChange={(e) => setPunkt(e.target.value as Zusagepunkt)}
              className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
            >
              {ZUSAGEPUNKTE.map((p) => (
                <option key={p} value={p}>
                  {PUNKTTEXT[p].titel}
                  {offen.includes(p) ? "" : " · schon festgehalten"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="zusage" className="text-sm font-medium text-ink">
              Was genau?
            </label>
            <input
              id="zusage"
              name="zusage"
              placeholder={PUNKTTEXT[punkt].beispiel}
              className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
            />
          </div>

          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium text-ink">Woher stammt die Zusage?</legend>
            <div className="flex flex-wrap gap-2">
              {HERKUNFT.map((h) => (
                <button
                  key={h.wert}
                  type="button"
                  onClick={() => setHerkunft(h.wert)}
                  aria-pressed={herkunft === h.wert}
                  className={`min-h-8 rounded-(--radius-pill) border px-3 text-sm ${
                    herkunft === h.wert ? "border-accent bg-accent-soft text-accent-text" : "border-line text-ink-2"
                  }`}
                >
                  {h.wort}
                </button>
              ))}
            </div>
            <p className="text-2xs leading-relaxed text-ink-3">
              Was in der Anzeige steht, ist eine Werbeaussage. Was jemand dir auf Nachfrage
              bestätigt hat, ist eine Zusage — und wiegt später schwerer.
            </p>
          </fieldset>

          <div className="grid gap-1.5">
            <label htmlFor="beleg" className="text-sm text-ink-2">
              Wer hat es gesagt, wann? <span className="text-ink-3">(freiwillig)</span>
            </label>
            <input
              id="beleg"
              name="beleg"
              placeholder="z. B. Teamleiterin im zweiten Gespräch, 12.09."
              className="min-h-9 rounded-(--radius-sm) border border-line bg-surface px-3 text-[15px] text-ink"
            />
          </div>

          {fehler && <p className="text-sm text-critical-text">{fehler}</p>}

          <Button type="submit" disabled={laeuft} className="w-fit">
            {laeuft ? "Wird gespeichert…" : "Zusage festhalten"}
          </Button>
        </form>
      </Card>

      {zusagen.length > 0 && (
        <section aria-labelledby="festgehalten" className="grid gap-3">
          <h2 id="festgehalten" className="text-lg font-semibold text-ink">
            Festgehalten ({zusagen.length})
          </h2>
          <ul className="grid gap-3">
            {zusagen.map((z) => (
              <li key={z.id}>
                <Card>
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="abschnitts-titel text-ink-3">
                        {PUNKTTEXT[z.punkt].titel}
                      </span>
                      <span className="text-2xs text-ink-3">
                        {HERKUNFT.find((h) => h.wert === z.herkunft)?.wort}
                      </span>
                    </div>
                    <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink">
                      {z.zusage}
                    </p>
                    {z.beleg && <p className="text-2xs text-ink-3">{z.beleg}</p>}

                    {pruefbar.length > 0 && (
                      <div className="grid gap-2 border-t border-line pt-2.5">
                        <p className="text-sm text-ink-2">{PUNKTTEXT[z.punkt].pruefung}</p>
                        {pruefbar.map((marke) => (
                          <div key={marke} className="flex flex-wrap items-center gap-2">
                            <span className="abschnitts-titel text-ink-3">
                              Tag {marke}
                            </span>
                            {STAENDE.map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={laeuft}
                                onClick={() =>
                                  starten(async () => {
                                    await zusagePruefen(z.id, marke, s);
                                  })
                                }
                                className={`min-h-8 rounded-(--radius-pill) border px-3 text-sm ${
                                  z.stand[marke] === s ? TON[s] : "border-line text-ink-2"
                                }`}
                              >
                                {STANDTEXT[s]}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
