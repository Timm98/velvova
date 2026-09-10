"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aktivierungSetzen } from "@/lib/arbeitgeber/monatsbericht";

/**
 * Ein und aus — und dazwischen ein Satz, was das heisst.
 *
 * ── Warum das Einschalten eine eigene Handlung ist ──────────────
 *
 * Ein Monatsbericht ist eine wiederkehrende Ansprache. Ihn
 * mitzuliefern, weil jemand eine Klärung angelegt hat, wäre eine
 * Einwilligung, die niemand gegeben hat.
 */
export function Aktivierungsschalter({
  orgId,
  aktiv,
  zustaendig,
  darfSchalten,
}: {
  orgId: string;
  aktiv: boolean;
  zustaendig: string | null;
  darfSchalten: boolean;
}) {
  const router = useRouter();
  const [laeuft, starten] = useTransition();
  const [name, setName] = useState(zustaendig ?? "");

  return (
    <section className="grid gap-3 rounded-(--radius-lg) border border-line bg-raised p-5">
      <h2 className="text-[15px] font-semibold text-ink">
        {aktiv ? "Eingeschaltet" : "Nicht eingeschaltet"}
      </h2>
      <p className="max-w-[var(--measure)] text-[14.5px] leading-relaxed text-ink-2">
        {aktiv
          ? "Einmal im Kalendermonat wird der Stand Ihrer Klärungen mit dem Vormonat verglichen. Sie können jederzeit ausschalten — die bisherigen Berichte bleiben."
          : "Solange der Bericht aus ist, entsteht keiner. Kein Versand, keine Erinnerung, kein täglicher Hinweis."}
      </p>

      {darfSchalten ? (
        <>
          {!aktiv && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wer ist bei Ihnen dafür zuständig? Name oder Funktion."
              className="w-full max-w-[var(--measure)] rounded-(--radius-lg) border border-line bg-page px-3 py-2 text-[14.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent"
            />
          )}
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starten(async () => {
                await aktivierungSetzen(orgId, !aktiv, name.trim() || null);
                router.refresh();
              })
            }
            className={`inline-flex min-h-11 w-fit items-center rounded-(--radius-control) px-4 text-[14px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60 ${
              aktiv ? "border border-line text-ink" : "bg-accent text-accent-on"
            }`}
          >
            {laeuft ? "Wird gespeichert …" : aktiv ? "Ausschalten" : "Monatsbericht einschalten"}
          </button>
        </>
      ) : (
        <p className="text-2xs leading-relaxed text-ink-3">
          Ein- und ausschalten darf, wer im Unternehmenskonto Administrator ist.
        </p>
      )}
    </section>
  );
}
