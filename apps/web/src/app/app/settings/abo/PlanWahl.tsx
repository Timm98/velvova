"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Plankarten } from "@/components/billing/Plankarten";
import { PLAENE, preisText, type PlanKey } from "@/lib/billing/plaene";
import { ZAHLART_TEXT, type Zahlart } from "@/lib/billing/anbieter";

/**
 * Die Planauswahl mitsamt dem, was danach passiert.
 *
 * Getrennt von der Seite, weil das Öffnen des Blatts ein Zustand im
 * Browser ist — die Seite selbst bleibt ein Server-Bauteil und liest
 * weiter Plan, Rechnungen und Zahlarten aus der Datenbank.
 *
 * Das Blatt ist bewusst klein und steht dort, wo man es geöffnet hat.
 * Ein Wechsel des Plans ist kein Ausflug auf eine andere Seite: danach
 * soll jemand genau da weitermachen, wo er war.
 */

export function PlanWahl({
  aktuell,
  zahlungBereit,
  anbieterName,
  zahlarten,
}: {
  aktuell: PlanKey;
  /** Ist wirklich ein Anbieter eingerichtet? */
  zahlungBereit: boolean;
  anbieterName: string;
  /** Was tatsächlich ginge, sobald er verbunden ist. */
  zahlarten: Zahlart[];
}) {
  const [gewaehlt, setGewaehlt] = useState<PlanKey | null>(null);

  return (
    <>
      <Plankarten aktuell={aktuell} onWaehlen={setGewaehlt} />

      {gewaehlt && (
        <UpgradeBlatt
          plan={gewaehlt}
          aktuell={aktuell}
          zahlungBereit={zahlungBereit}
          anbieterName={anbieterName}
          zahlarten={zahlarten}
          onSchliessen={() => setGewaehlt(null)}
        />
      )}
    </>
  );
}

export function UpgradeBlatt({
  plan,
  aktuell,
  zahlungBereit,
  anbieterName,
  zahlarten,
  onSchliessen,
}: {
  plan: PlanKey;
  aktuell: PlanKey;
  zahlungBereit: boolean;
  anbieterName: string;
  zahlarten: Zahlart[];
  onSchliessen: () => void;
}) {
  const ziel = PLAENE[plan];
  const runter = plan === "free";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-titel"
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center"
    >
      {/* Der Vorhang. Klick daneben schliesst — wie überall sonst auch. */}
      <button
        type="button"
        aria-label="Schliessen"
        onClick={onSchliessen}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <div className="relative m-0 grid w-full max-w-[34rem] gap-5 rounded-t-(--radius-surface) bg-surface p-6 shadow-2xl sm:m-5 sm:rounded-(--radius-surface)">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <span className="abschnitts-titel text-ink-3">
              {ziel.label}
            </span>
            <h2 id="upgrade-titel" className="font-display text-2xl font-normal tracking-[-0.02em]">
              {runter ? `Zu ${ziel.name} wechseln` : `Auf ${ziel.name} wechseln`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label="Schliessen"
            className="grid size-10 shrink-0 place-items-center rounded-(--radius-pill) text-ink-2 transition-colors hover:bg-soft hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>

        <p className="text-[15px] leading-relaxed text-ink-2">{ziel.claim}</p>

        {!runter && (
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-normal tracking-[-0.02em]">
              {preisText(ziel.preisMonatCent)}
            </span>
            <span className="text-sm text-ink-3">pro Monat</span>
          </p>
        )}

        {runter ? (
          /*
           * Ein Wechsel nach unten ist kein Kauf, sondern eine
           * Kündigung — und die gehört nicht in ein Upgrade-Blatt
           * versteckt, sondern klar benannt. Was danach passiert, steht
           * dabei: der Zugang bleibt bis zum Ende des bezahlten
           * Zeitraums.
           */
          <div className="grid gap-3 rounded-(--radius-md) bg-inset px-4 py-3.5">
            <p className="text-sm leading-relaxed text-ink-2">
              Damit endet dein bezahlter Plan. Bis zum Ende des bereits bezahlten Zeitraums
              ändert sich nichts — danach gilt Free.
            </p>
            <p className="text-sm leading-relaxed text-ink-2">
              Dein Profil, deine Gespräche und deine Bewerbungen bleiben vollständig erhalten.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {ziel.hauptvorteile.map((v) => (
              <li key={v} className="text-sm leading-relaxed text-ink-2">
                {v}
              </li>
            ))}
          </ul>
        )}

        {/*
         * Der ehrliche Teil.
         *
         * Solange kein Anbieter verbunden ist, steht hier kein Knopf,
         * der so aussieht, als würde er etwas abbuchen. Ein
         * Schein-Kaufknopf in einem Produktionspfad ist genau die Art
         * Fehler, die niemand bemerkt, bis jemand darauf klickt und
         * glaubt, er habe bezahlt.
         */}
        {zahlungBereit ? (
          <form action={`/api/billing/kassengang?plan=${plan}`} method="post" className="grid gap-3">
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-(--radius-pill) bg-accent px-6 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
            >
              {runter ? "Abo zum Zeitraumende beenden" : `Weiter zur Zahlung über ${anbieterName}`}
            </button>
            {!runter && zahlarten.length > 0 && (
              <p className="text-center text-xs text-ink-3">
                {zahlarten.map((z) => ZAHLART_TEXT[z]).join(" · ")}
              </p>
            )}
          </form>
        ) : (
          <div className="grid gap-3 rounded-(--radius-md) border border-line-2 bg-inset px-4 py-3.5">
            <p className="text-sm font-medium">Die Zahlung ist noch nicht freigeschaltet.</p>
            <p className="text-sm leading-relaxed text-ink-2">
              Es ist noch kein Zahlungsanbieter verbunden. Wir zeigen dir hier keinen Knopf, der
              so aussieht, als würde er etwas abbuchen — {aktuell === "free" ? "dein Plan" : "dein Abo"}{" "}
              bleibt unverändert.
            </p>
            {zahlarten.length > 0 && (
              <p className="text-xs leading-relaxed text-ink-3">
                Vorgesehen sind: {zahlarten.map((z) => ZAHLART_TEXT[z]).join(", ")}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
