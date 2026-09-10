"use client";

import { useState, useTransition } from "react";
import type { Trefferlage } from "@paycheck/domain";
import { trefferSuchen } from "@/lib/arbeitgeber/bedarfstreffer";

/**
 * ══════════════════════════════════════════════════════════════════
 * Passende Menschen — eine interne Vorschau
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum hier kein Name steht ──────────────────────────────────
 *
 * Weil niemand zugestimmt hat, diesem Betrieb gegenüber genannt zu
 * werden. Zugestimmt wurde, gefunden zu werden — das ist etwas
 * anderes. Was hier steht, ist ein Umriss: eine Passung, die
 * Nachweise, die der Mensch selbst weitergegeben hat, und die offenen
 * Punkte.
 *
 * ── Warum die Zahl der Geprüften dabeisteht ─────────────────────
 *
 * „Keine passenden Personen" kann zwei sehr verschiedene Dinge
 * heissen: Es hat niemand zugestimmt, gefunden zu werden — oder es
 * haben vierhundert zugestimmt und keiner passt. Das eine ist ein
 * Problem der Plattform, das andere eine Auskunft über den Bedarf.
 */
export function Menschen({ orgId, vorgangId }: { orgId: string; vorgangId: string }) {
  const [lage, setLage] = useState<Trefferlage | null>(null);
  const [laeuft, starten] = useTransition();

  return (
    <section className="grid gap-3 border-t border-line pt-6">
      <h2 className="text-[15px] font-semibold text-ink">Passende Menschen</h2>
      <p className="max-w-[var(--measure)] text-[14px] leading-relaxed text-ink-2">
        Eine Vorschau für Sie. Es geht dabei nichts hinaus: Niemand wird benachrichtigt, niemand
        erfährt Ihren Namen, und was jemand als Gehaltsuntergrenze hinterlegt hat, sehen Sie nicht —
        auch dann nicht, wenn es passt.
      </p>

      <button
        type="button"
        disabled={laeuft}
        onClick={() => starten(async () => setLage(await trefferSuchen(orgId, vorgangId)))}
        className="inline-flex min-h-11 w-fit items-center rounded-(--radius-control) bg-accent px-4 text-[14px] font-medium text-accent-on transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {laeuft ? "Wird gesucht …" : "Passende Menschen suchen"}
      </button>

      {lage?.art === "gesperrt" && (
        <p className="max-w-[var(--measure)] rounded-(--radius-lg) border border-line bg-raised p-4 text-[14.5px] leading-relaxed text-caution">
          {lage.grund}
        </p>
      )}

      {lage?.art === "keine" && (
        <div className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-4">
          <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
            Niemand passt zu diesem Bedarf. Das ist ein Ergebnis, keine Panne.
          </p>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            {lage.geprueft === 0
              ? "Geprüft wurde niemand: Es hat noch niemand zugestimmt, gefunden zu werden. Ein registriertes Konto ist kein Kandidatenpool."
              : `Geprüft wurden ${lage.geprueft} Menschen, die zugestimmt haben, gefunden zu werden.`}
          </p>
        </div>
      )}

      {lage?.art === "vorschlaege" && (
        <div className="grid gap-3">
          <p className="text-2xs text-ink-3">
            {lage.kandidaten.length} von {lage.geprueft} Geprüften
            {lage.weitere > 0 ? ` · ${lage.weitere} weitere passen ebenfalls` : ""}
          </p>
          <ul className="grid gap-3">
            {lage.kandidaten.map((k, i) => (
              <li key={k.userId} className="grid gap-2 rounded-(--radius-lg) border border-line bg-raised p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[15px] font-medium text-ink">Vorschlag {i + 1}</span>
                  <span className="text-2xs text-ink-3">
                    {k.passung === null ? "Passung nicht ermittelbar" : `Passung ${k.passung} von 100`}
                  </span>
                </div>

                {k.freigegebeneNachweise.length > 0 ? (
                  <p className="text-[14px] leading-relaxed text-ink-2">
                    Freigegebene Nachweise: {k.freigegebeneNachweise.join(", ")}
                  </p>
                ) : (
                  <p className="text-[14px] leading-relaxed text-ink-3">
                    Kein freigegebener Nachweis — nur Selbstauskunft.
                  </p>
                )}

                {k.bedingungen.filter((b) => b.stand === "unbekannt").length > 0 && (
                  <ul className="grid gap-1">
                    {k.bedingungen
                      .filter((b) => b.stand === "unbekannt")
                      .map((b) => (
                        <li key={b.bedingung} className="text-2xs leading-relaxed text-caution">
                          {b.bedingung}: noch zu klären — {b.begruendung}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            Ein Vorschlag ist keine Zusage und keine Lösung Ihres Problems. Ob und wie jemand
            angesprochen wird, entscheidet ein Mensch bei Ihnen — und die Ansprache selbst ist noch
            nicht gebaut.
          </p>
        </div>
      )}
    </section>
  );
}
