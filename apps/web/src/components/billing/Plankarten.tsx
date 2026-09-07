"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PLAENE,
  PLAN_RANG,
  PLAN_REIHENFOLGE,
  preisText,
  type PlanKey,
} from "@/lib/billing/plaene";

/**
 * Die drei Pläne, nebeneinander.
 *
 * Vorher waren es zwei grosse isolierte Kästen mit vollständigen
 * Funktionslisten darin — nebeneinandergestellt sahen sie aus wie zwei
 * Formulare, und gelesen wurde keines davon.
 *
 * Was sich geändert hat, ist nicht die Farbe, sondern die Menge:
 *
 *   **Fünf Punkte je Plan, nicht fünfzehn.** Eine Liste, die scrollt,
 *   wird überflogen und hinterlässt das Gefühl, etwas übersehen zu
 *   haben. Der vollständige Vergleich ist einen Klick entfernt und
 *   damit für die wenigen da, die ihn wirklich wollen.
 *
 *   **Der Preis ist das grösste Element.** Er ist die Frage, mit der
 *   jemand hierherkommt.
 *
 *   **Max wird hervorgehoben, ohne zu schreien.** Ein leiser violetter
 *   Schein und ein Ring — kein „BEST VALUE", keine Verknappung, kein
 *   ablaufendes Angebot. Der Plan trägt seinen Satz, und der Satz muss
 *   reichen.
 */

export function Plankarten({
  aktuell,
  onWaehlen,
}: {
  aktuell: PlanKey;
  /** Wird mit dem gewählten Plan aufgerufen. Der Aufrufer entscheidet,
   *  was dann passiert — Sheet öffnen, Formular abschicken, nichts. */
  onWaehlen: (plan: PlanKey) => void;
}) {
  const [matrixOffen, setMatrixOffen] = useState(false);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_REIHENFOLGE.map((key) => {
          const plan = PLAENE[key];
          const istAktuell = key === aktuell;
          const istHoeher = PLAN_RANG[key] > PLAN_RANG[aktuell];
          const hervor = key === "max";

          return (
            <div
              key={key}
              className={cn(
                "relative grid content-start gap-5 rounded-(--radius-surface) p-6",
                /* Sehr helle Fläche, keine harte Kante: die Karten
                   heben sich durch Ton voneinander ab, nicht durch
                   Rahmen. */
                hervor ? "bg-lavender" : "bg-inset",
                hervor && "ring-1 ring-inset ring-accent/20",
                istAktuell && !hervor && "ring-1 ring-inset ring-line-2",
              )}
            >
              {/* Der Schein hinter Max. Sehr leise und nur dort. */}
              {hervor && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-6 -top-2 h-24 rounded-full opacity-60 blur-2xl"
                  style={{ background: "radial-gradient(60% 100% at 50% 0%, var(--accent), transparent 70%)" }}
                />
              )}

              <div className="relative grid gap-1.5">
                <span className="abschnitts-titel text-ink-3">
                  {plan.label}
                </span>
                <h3 className="font-display text-2xl font-normal tracking-[-0.02em]">
                  {plan.name}
                </h3>
              </div>

              <p className="relative flex items-baseline gap-1.5">
                <span className="font-display text-[2.5rem] font-normal leading-none tracking-[-0.02em]">
                  {preisText(plan.preisMonatCent)}
                </span>
                <span className="text-sm text-ink-3">
                  {plan.preisMonatCent === 0 ? "dauerhaft" : "pro Monat"}
                </span>
              </p>

              <p className="relative text-[15px] font-medium leading-snug text-ink">{plan.claim}</p>

              <ul className="relative grid gap-2.5">
                {plan.hauptvorteile.map((v) => (
                  <li key={v} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
                    <Check
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      strokeWidth={2.2}
                    />
                    {v}
                  </li>
                ))}
              </ul>

              <div className="relative pt-1">
                {istAktuell ? (
                  <p className="inline-flex min-h-11 items-center text-sm font-medium text-ink-2">
                    Dein aktueller Plan
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onWaehlen(key)}
                    className={cn(
                      "inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-pill) px-5 text-sm font-medium transition-colors",
                      istHoeher
                        ? "bg-accent text-accent-on hover:bg-accent-hover"
                        : "bg-surface text-ink hover:bg-soft",
                    )}
                  >
                    {istHoeher ? `Auf ${plan.name} wechseln` : `Zu ${plan.name} wechseln`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/*
       * Die vollständige Matrix erst auf Verlangen.
       *
       * Sie ist lang und für die meisten uninteressant. Sie hier
       * dauerhaft aufzuklappen hiesse, jeden durch sechzig Zeilen
       * scrollen zu lassen, damit drei Leute sie lesen können.
       */}
      <div className="grid justify-items-center">
        <button
          type="button"
          onClick={() => setMatrixOffen((v) => !v)}
          aria-expanded={matrixOffen}
          className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-pill) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
        >
          {matrixOffen ? "Vergleich schliessen" : "Alle Funktionen vergleichen"}
          <ChevronDown
            aria-hidden
            className={cn("size-4 transition-transform", matrixOffen && "rotate-180")}
            strokeWidth={2}
          />
        </button>
      </div>

      {matrixOffen && <Funktionsmatrix aktuell={aktuell} />}
    </div>
  );
}

/**
 * Der vollständige Vergleich.
 *
 * Bewusst als drei Spalten mit Gruppen statt als Kreuztabelle mit
 * Häkchen. Eine Kreuztabelle über dreissig Zeilen liest niemand: man
 * verliert die Zeile, sobald man den Blick auf die dritte Spalte
 * bewegt. Untereinander gelesen ergibt jeder Plan einen zusammen-
 * hängenden Text — und das ist es, was jemand wissen will: was bekomme
 * ich hier, nicht welches Feld ist leer.
 */
function Funktionsmatrix({ aktuell }: { aktuell: PlanKey }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLAN_REIHENFOLGE.map((key) => {
        const plan = PLAENE[key];
        return (
          <div key={key} className="grid content-start gap-5">
            <div className="flex items-baseline gap-2.5">
              <h4 className="font-display text-lg font-normal tracking-[-0.02em]">{plan.name}</h4>
              {key === aktuell && (
                <span className="rounded-(--radius-pill) bg-lavender px-2.5 py-0.5 abschnitts-titel">
                  aktuell
                </span>
              )}
            </div>

            {PLAN_RANG[key] > 0 && (
              <p className="text-xs leading-relaxed text-ink-3">
                Alles aus {PLAENE[PLAN_REIHENFOLGE[PLAN_RANG[key] - 1]!].name}, und zusätzlich:
              </p>
            )}

            {plan.gruppen.map((g) => (
              <div key={g.titel} className="grid gap-2">
                <h5 className="abschnitts-titel text-ink-3">
                  {g.titel}
                </h5>
                <ul className="grid gap-1.5">
                  {g.punkte.map((punkt) => (
                    <li key={punkt} className="text-sm leading-relaxed text-ink-2">
                      {punkt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
