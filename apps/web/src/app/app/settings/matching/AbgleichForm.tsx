"use client";

import { useState, useTransition } from "react";
import type { UserConstraints } from "@paycheck/domain";
import { bedingungAufheben, bedingungSetzen } from "@/lib/nina/bedingungen-aktionen";
import { gesetzteBedingungen } from "@/lib/nina/bedingungen";
import { X } from "lucide-react";

/**
 * Was mit offenen Angaben geschieht — und welche Bedingungen gelten.
 *
 * Die Einstellung sieht klein aus und ist es nicht. Sie entscheidet,
 * ob eine Stelle ohne Gehaltsangabe zwischen den geprüften steht,
 * daneben oder gar nicht. Deshalb steht bei jeder Möglichkeit, was sie
 * bedeutet, statt nur wie sie heisst — „mitzeigen" allein sagt keinem
 * Menschen, dass er danach ungeprüfte Stellen in seinen Haupttreffern
 * hat.
 */

const WAHL: { wert: UserConstraints["unklaresBehandeln"]; titel: string; text: string }[] = [
  {
    wert: "mitzeigen",
    titel: "Mitzeigen, aber gekennzeichnet",
    text: "Sie stehen zwischen den übrigen Treffern. An jeder Stelle steht, was offen ist — als erfüllt gilt es nie.",
  },
  {
    wert: "getrennt",
    titel: "In einem eigenen Abschnitt zeigen",
    text: "Strenger: oben nur Stellen, bei denen deine Bedingungen belegt erfüllt sind, der Rest darunter. Rechne damit, dass oben wenig steht — die meisten Anzeigen nennen kein Gehalt.",
  },
  {
    wert: "ausblenden",
    titel: "Nicht zeigen",
    text: "Am strengsten: nur belegt erfüllte Stellen. Die übrigen werden gezählt, nicht gezeigt.",
  },
];

export function AbgleichForm({ start }: { start: UserConstraints }) {
  const [c, setC] = useState(start);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, uebergang] = useTransition();

  const karten = gesetzteBedingungen(c);

  function waehlen(wert: UserConstraints["unklaresBehandeln"]) {
    setC((alt) => ({ ...alt, unklaresBehandeln: wert }));
    uebergang(async () => {
      const r = await bedingungSetzen("unklaresBehandeln", wert, wert);
      setMeldung(r.text);
    });
  }

  function aufheben(feld: (typeof karten)[number]["feld"], wert?: string) {
    uebergang(async () => {
      const r = await bedingungAufheben(feld, wert);
      setMeldung(r.text);
      if (r.ok) {
        // Ohne das stünde die entfernte Bedingung noch da, bis jemand
        // die Seite neu lädt — und sähe aus, als hätte es nicht geklappt.
        const { ladeBedingungen } = await import("@/lib/nina/bedingungen-aktionen");
        setC(await ladeBedingungen());
      }
    });
  }

  return (
    <div className="grid gap-8">
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">
          Wenn eine Anzeige nichts zu einer deiner Bedingungen sagt
        </legend>
        {WAHL.map((w) => (
          <label
            key={w.wert}
            className="flex cursor-pointer gap-3 rounded-(--radius-lg) bg-raised px-5 py-4 transition-colors hover:bg-soft"
          >
            <input
              type="radio"
              name="unklares"
              checked={c.unklaresBehandeln === w.wert}
              onChange={() => waehlen(w.wert)}
              disabled={pending}
              className="mt-1 size-4 shrink-0 accent-[var(--primary-fill)]"
            />
            <span className="min-w-0">
              <span className="block font-medium">{w.titel}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-ink-2">{w.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <section className="grid gap-3">
        <h2 className="text-sm font-medium">Deine harten Bedingungen</h2>
        {karten.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-2">
            Du hast keine festgelegt. Sag sie im Gespräch — etwa „mindestens 45.000, darunter lohnt
            es sich nicht" — und bestätige den Vorschlag. Erst dann wirken sie.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {karten.map((k) => (
              <li key={`${k.feld}:${k.wert ?? ""}`}>
                <span className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-raised py-1 pl-3.5 pr-1 text-sm">
                  <span className="text-ink-3">{k.label}:</span> {k.anzeige}
                  <button
                    type="button"
                    onClick={() => aufheben(k.feld, k.wert)}
                    disabled={pending}
                    aria-label={`Bedingung „${k.label}: ${k.anzeige}" aufheben`}
                    className="ml-0.5 inline-flex size-8 items-center justify-center rounded-(--radius-pill) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {meldung && (
        <p aria-live="polite" className="text-sm text-ink-2">
          {meldung}
        </p>
      )}
    </div>
  );
}
