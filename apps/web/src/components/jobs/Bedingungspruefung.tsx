import { AlertTriangle, Check, HelpCircle } from "lucide-react";
import type { ConstraintResult } from "@paycheck/domain";

/**
 * Deine harten Bedingungen an dieser Stelle — offen ausgewiesen.
 *
 * ── Warum das eine eigene Fläche ist ───────────────────────────
 *
 * Bis hierher gab es die Prüfung, aber fast keine Anzeige: `blocked`
 * färbte eine Karte in der Liste, `uncertain` erzeugte still eine Frage
 * fürs Erstgespräch, und `eligible` war gar nicht zu sehen. Wer wissen
 * wollte, ob eine Stelle die eigene Gehaltsgrenze hält, fand es
 * nirgends.
 *
 * ── Die drei Zustände sehen verschieden aus ────────────────────
 *
 * Das ist der eigentliche Punkt. Drei Ausgänge, drei Erscheinungen:
 *
 *   **erfüllt** — belegt, mit dem Wert aus der Anzeige daneben.
 *   **unbekannt** — die Anzeige sagt nichts dazu. Fragezeichen, graue
 *     Schrift, und im Text steht, dass es offen ist.
 *   **verletzt** — die Stelle widerspricht der Bedingung nachweislich.
 *
 * „Unbekannt" darf nie wie „erfüllt" aussehen. Ein grauer Haken neben
 * „Gehalt" liest sich als „passt", und die Person geht mit einer
 * Sicherheit in ein Gespräch, die niemand geprüft hat. Deshalb ein
 * anderes Symbol, eine andere Farbe und ein Satz, der die Lücke
 * benennt, statt sie zu glätten.
 *
 * „Unbekannt" wird umgekehrt auch nicht zu „verletzt". Eine Anzeige,
 * die das Gehalt verschweigt, ist kein Grund, die Stelle wegzuwerfen —
 * sie ist ein Grund, danach zu fragen.
 */
export function Bedingungspruefung({ ergebnis }: { ergebnis: ConstraintResult }) {
  /*
   * Nur echte Bedingungen.
   *
   * Wo nichts festgelegt wurde, gibt es nichts zu prüfen. „Reiseanteil:
   * Du hast keine Grenze festgelegt" als Zeile mit Symbol suggeriert
   * eine Prüfung, die keine ist, und verwässert die Zeilen daneben, die
   * wirklich etwas aussagen.
   */
  const zeilen = ergebnis.checks.filter((c) => !/keine (Unter)?[Gg]renze festgelegt/.test(c.reason));
  if (zeilen.length === 0) return null;

  const verletzt = zeilen.filter((c) => c.verdict === "blocked");
  const offen = zeilen.filter((c) => c.verdict === "uncertain");

  return (
    <section
      aria-labelledby="bedingungspruefung"
      data-bedingungspruefung
      className="mt-8 rounded-(--radius-surface) bg-raised px-6 py-5"
    >
      <h3 id="bedingungspruefung" className="text-sm font-medium">
        Deine Bedingungen an dieser Stelle
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        {verletzt.length > 0
          ? `${verletzt.length === 1 ? "Eine Bedingung wird" : `${verletzt.length} Bedingungen werden`} nachweislich verletzt.`
          : offen.length > 0
            ? `Nichts spricht dagegen — aber ${offen.length === 1 ? "ein Punkt steht" : `${offen.length} Punkte stehen`} nicht in der Anzeige.`
            : "Alles, was du festgelegt hast, ist belegt erfüllt."}
      </p>

      <ul className="mt-4 grid gap-3">
        {zeilen.map((c) => (
          <li key={c.key} className="flex gap-3">
            <span aria-hidden className="mt-0.5 shrink-0">
              {c.verdict === "eligible" ? (
                <Check className="size-[18px] text-positive" strokeWidth={2.4} />
              ) : c.verdict === "blocked" ? (
                <AlertTriangle className="size-[18px] text-caution" strokeWidth={2.2} />
              ) : (
                <HelpCircle className="size-[18px] text-ink-3" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem]">
                <span className="font-medium">{c.label}</span>
                {/*
                 * Der Zustand steht als Wort da, nicht nur als Symbol.
                 *
                 * Ein Symbol allein ist für Screenreader stumm und für
                 * Menschen mit Farbsehschwäche mehrdeutig — und
                 * ausgerechnet der Unterschied zwischen „geprüft" und
                 * „unbekannt" darf an keiner Farbe hängen.
                 */}
                <span
                  className={
                    c.verdict === "blocked"
                      ? "text-caution"
                      : c.verdict === "uncertain"
                        ? "text-ink-3"
                        : "text-ink-2"
                  }
                >
                  {" · "}
                  {c.verdict === "eligible"
                    ? "erfüllt"
                    : c.verdict === "blocked"
                      ? "verletzt"
                      : "steht nicht in der Anzeige"}
                </span>
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{c.reason}</p>
              {c.jobValue && c.userValue && (
                <p className="mt-0.5 text-sm text-ink-3">
                  Anzeige: {c.jobValue} · Deine Vorgabe: {c.userValue}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
