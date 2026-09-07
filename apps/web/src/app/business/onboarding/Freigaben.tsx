"use client";

import { useMemo, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Angabe } from "@/lib/arbeitgeber/onboarding/bewertung";
import {
  freigabenstand,
  KONTAKTREGELN,
  STUFEN,
  type Kontaktregel,
  type Stufe,
} from "@/lib/arbeitgeber/onboarding/freigaben";
import { angabeSetzen } from "./aktionen";

/**
 * Die Freigaben.
 *
 * ── Warum kein Schalter, der alles auf einmal erlaubt ─────────
 *
 * „Monday alles überlassen“ wäre ein Klick und eine Zustimmung, deren
 * Umfang niemand gelesen hat. Zwei getrennte Entscheidungen zwingen
 * dazu, zweimal hinzusehen — und die zweite (der Kontakt) ist die,
 * bei der es um fremde Daten geht.
 */
export function Freigaben({
  angaben,
  aufFrisch,
}: {
  angaben: Angabe[];
  aufFrisch: (a: Angabe[]) => void;
}) {
  const stand = useMemo(() => freigabenstand(angaben), [angaben]);
  const [laeuft, start] = useTransition();

  const setzen = (feld: "stufe" | "kontaktFreigabe", wert: Stufe | Kontaktregel) => {
    start(async () => {
      const e = await angabeSetzen({ bereich: "freigaben", feld, wert });
      if (e.ok) aufFrisch(e.angaben);
    });
  };

  return (
    <section className="grid gap-5 rounded-[12px] border border-line-3 bg-surface p-4">
      <header className="grid gap-1">
        <h2 className="text-sm font-600 text-ink">Was Monday für euch tun darf</h2>
        <p className="max-w-[62ch] text-2xs text-ink-2">
          Zwei Entscheidungen. Beide lassen sich jederzeit ändern, und eine Änderung
          gilt ab sofort — nicht erst für die nächste Stelle.
        </p>
      </header>

      {/* ── Stufe ─────────────────────────────────────────── */}
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-2xs uppercase tracking-wide text-ink-3">
          Wie weit Monday von sich aus geht
        </legend>
        {STUFEN.map((s) => (
          <label
            key={s.wert}
            className={cn(
              "grid cursor-pointer gap-0.5 rounded-[8px] border px-3 py-2.5",
              stand.stufe === s.wert ? "border-accent bg-accent-subtle" : "border-line-3 hover:bg-soft",
              laeuft && "opacity-60",
            )}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio" name="freigabestufe" value={s.wert}
                checked={stand.stufe === s.wert}
                onChange={() => setzen("stufe", s.wert)}
                disabled={laeuft}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              <span className="text-sm text-ink">{s.label}</span>
            </span>
            <span className="pl-[1.375rem] text-2xs text-ink-2">{s.erklaerung}</span>
          </label>
        ))}
      </fieldset>

      {/* ── Kontakt ───────────────────────────────────────── */}
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-2xs uppercase tracking-wide text-ink-3">
          Wann Kontaktdaten sichtbar werden
        </legend>
        {KONTAKTREGELN.map((k) => (
          <label
            key={k.wert}
            className={cn(
              "grid cursor-pointer gap-0.5 rounded-[8px] border px-3 py-2.5",
              stand.kontakt === k.wert ? "border-accent bg-accent-subtle" : "border-line-3 hover:bg-soft",
              laeuft && "opacity-60",
            )}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio" name="kontaktregel" value={k.wert}
                checked={stand.kontakt === k.wert}
                onChange={() => setzen("kontaktFreigabe", k.wert)}
                disabled={laeuft}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              <span className="text-sm text-ink">{k.label}</span>
            </span>
            <span className="pl-[1.375rem] text-2xs text-ink-2">{k.erklaerung}</span>
          </label>
        ))}
      </fieldset>

      {/* ── Die Zusammenfassung ───────────────────────────── */}
      <div className="grid gap-3 rounded-[8px] bg-inset p-3 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <h3 className="text-2xs font-600 uppercase tracking-wide text-ink-3">Monday darf</h3>
          <ul className="grid gap-1">
            {stand.darf.map((d) => (
              <li key={d} className="flex gap-2 text-2xs text-ink">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-positive" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid content-start gap-1.5">
          <h3 className="text-2xs font-600 uppercase tracking-wide text-ink-3">Monday darf nicht</h3>
          <ul className="grid gap-1">
            {stand.niemals.map((n) => (
              <li key={n} className="flex gap-2 text-2xs text-ink">
                <Lock className="mt-0.5 h-3 w-3 shrink-0 text-ink-3" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
          <p className="pt-0.5 text-2xs text-ink-3">
            Diese vier gelten in jeder Einstellung. Es gibt keinen Schalter, der sie aufhebt.
          </p>
        </div>
      </div>

      {!stand.vollstaendig && (
        <p className="text-2xs text-caution-text">
          Solange du nicht beide Fragen beantwortet hast, gilt die vorsichtigste
          Einstellung — und die Stelle geht nicht online.
        </p>
      )}
    </section>
  );
}
