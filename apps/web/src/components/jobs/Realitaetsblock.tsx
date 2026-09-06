import { EBENENTEXT } from "@paycheck/domain";
import type { Realitaetsangebot, Realitaetsbild } from "@/lib/realitaetsproben";
import { GespraechAnbieten, Rueckmeldung } from "./Realitaetsformulare";

/**
 * Was Menschen sagen, die diese Arbeit tun.
 *
 * ── Warum das über einer Bewertung steht ──────────────────────
 *
 * Eine Sternebewertung mittelt über Rollen, Standorte und Jahre. Diese
 * Angaben stammen von Menschen, die für DIESE Stelle ein Gespräch
 * geführt oder eine Aufgabe gemacht haben — und sie beantworten, was
 * keine Anzeige beantwortet: wie klar geführt wird, wie schnell es
 * zugeht, wie respektvoll der Umgang war.
 *
 * ── Warum die Zahlen meistens fehlen ──────────────────────────
 *
 * Unter vier Rückmeldungen steht keine. Bei dreien liesse sich aus
 * einem Mittelwert auf eine einzelne Person schliessen — und die hat
 * anonym geantwortet.
 */

const ACHSEN: [keyof Realitaetsbild, string][] = [
  ["klarheit", "Wie klar geführt wird"],
  ["rueckmeldung", "Qualität der Rückmeldung"],
  ["respekt", "Respekt im Umgang"],
  ["tempo", "Wie schnell es zugeht"],
  ["stimmtMitAnzeige", "Stimmt mit der Anzeige überein"],
];

export function Realitaetsblock({
  bild,
  angebote,
  jobId,
}: {
  bild: Realitaetsbild;
  angebote: Realitaetsangebot[];
  jobId: string;
}) {
  /*
   * Der Block erscheint jetzt auch leer.
   *
   * Vorher wurde er ausgeblendet, solange niemand etwas angeboten
   * hatte — und da beide Schreibwege keinen Aufrufer hatten, hiess das:
   * immer. Der Abschnitt war unerreichbar, und mit ihm die einzige
   * Stelle, an der jemand ein Gespräch anbieten könnte. Genau die
   * Henne-Ei-Sperre, die eine Funktion still leer hält.
   */

  return (
    <section aria-labelledby="realitaet" className="grid gap-3">
      <h2 id="realitaet" className="text-xl font-semibold">
        Was Menschen sagen, die diese Arbeit tun
      </h2>

      {angebote.length > 0 && (
        <div className="grid gap-2 rounded-(--radius-md) border border-line px-4 py-3.5">
          <h3 className="abschnitts-titel text-ink-3">
            Vor der Entscheidung ausprobieren
          </h3>
          <ul className="grid gap-2">
            {angebote.map((a) => (
              <li key={a.id} className="grid gap-0.5">
                <p className="text-[15px] leading-relaxed text-ink">
                  {a.beschreibung || "Ein Gespräch über den Arbeitsalltag"}
                </p>
                <p className="text-2xs text-ink-3">
                  {a.dauerMinuten} Minuten
                  {a.art === "gespraech" ? " · anonymes Gespräch" : a.verguetet ? " · vergütet" : " · in einer Testumgebung, keine produktive Arbeit"}
                </p>
              </li>
            ))}
          </ul>
          {/* Wer teilgenommen hat, kann sagen, wie es war. */}
          <Rueckmeldung probeId={angebote[0]!.id} />
        </div>
      )}

      {bild.anzahl > 0 &&
        (bild.klarheit === null ? (
          <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
            {bild.anzahl} {bild.anzahl === 1 ? "Person hat" : "Personen haben"} nach einem Gespräch
            geantwortet — zu wenige, um Mittelwerte zu zeigen. Aus dreien liesse sich auf eine
            einzelne Person schliessen, und die hat anonym geantwortet.
          </p>
        ) : (
          <div className="grid gap-2 rounded-(--radius-md) bg-inset px-4 py-3.5">
            <ul className="grid gap-1.5">
              {ACHSEN.map(([k, titel]) => {
                const wert = bild[k] as number | null;
                if (wert === null) return null;
                return (
                  <li key={k} className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] text-ink">{titel}</span>
                    <span className="font-mono text-sm tabular text-ink-2">
                      {wert.toFixed(1)} von 5
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-2xs leading-relaxed text-ink-3">
              {/*
                * Die Ebene gehört an die Zahl.
                *
                * „Vier Menschen sagen, es geht respektvoll zu" bedeutet
                * etwas anderes, je nachdem, ob sie bei DIESEM
                * Arbeitgeber waren oder irgendwo in diesem Beruf. Ohne
                * diesen Zusatz liest man das Zweite als das Erste.
                */}
              Aus {bild.anzahl} anonymen Rückmeldungen {EBENENTEXT[bild.ebene]} — von Menschen, die
              ein Gespräch geführt oder eine Aufgabe gemacht haben.
            </p>
          </div>
        ))}

      {/*
       * Der Weg hinein — für die, die diese Arbeit tun.
       *
       * Ohne ihn bleibt der Abschnitt für immer leer: Niemand kann
       * etwas anbieten, also gibt es nichts zu bewerten, also gibt es
       * keine Mittelwerte. Er steht bewusst unten und klein: Es ist
       * ein Angebot, keine Aufforderung.
       */}
      <GespraechAnbieten jobId={jobId} />
    </section>
  );
}
