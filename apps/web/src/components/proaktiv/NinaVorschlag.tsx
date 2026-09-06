"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { handlungEntscheiden, ninaSagtEtwas } from "@/lib/proaktiv/aktionen";
import type { Ninanachricht } from "@paycheck/jobs";

/**
 * Nina meldet sich von selbst.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie an derselben Kante steht wie der Hinweis
 * ══════════════════════════════════════════════════════════════
 *
 * Weil es dieselbe Stimme ist. Eine zweite Einblendung an einer
 * anderen Stelle wäre für die Person eine zweite Quelle, die
 * dazwischenredet — und sie müsste lernen, welche davon was bedeutet.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie nicht wiederkommt
 * ══════════════════════════════════════════════════════════════
 *
 * Der Server vermerkt beim Herausgeben, dass die Nachricht gesagt
 * wurde. Ein zweiter Tab bekommt sie nicht mehr, ein zweites Gerät
 * auch nicht.
 *
 * Wer sie wegklickt, ohne zu antworten, hat sie gelesen — mehr will
 * eine Beobachtung nicht. Nur ein Vorschlag braucht eine Antwort, und
 * der bleibt offen, bis eine kommt: In „Von Nina automatisch“ steht
 * er weiter.
 */

/** Wie lange nach dem Laden gewartet wird, bevor gefragt wird. */
const WARTEN_MS = 2500;

/** Wie lange die Nachricht stehen bleibt, wenn niemand reagiert. */
const BLEIBT_MS = 18_000;

export function NinaVorschlag() {
  const [nachricht, setNachricht] = useState<Ninanachricht | null>(null);
  const [erledigt, setErledigt] = useState<string | null>(null);
  const [laeuft, starten] = useTransition();

  useEffect(() => {
    /*
     * Erst nach einem Moment fragen.
     *
     * Wer die Seite gerade geöffnet hat, sucht etwas. Eine Einblendung
     * in derselben Sekunde ist keine Hilfe, sondern ein Hindernis vor
     * dem, weswegen jemand gekommen ist.
     */
    const auf = setTimeout(() => {
      void ninaSagtEtwas()
        .then((n) => setNachricht(n))
        /* Kein Vorschlag ist kein Fehler. */
        .catch(() => undefined);
    }, WARTEN_MS);
    return () => clearTimeout(auf);
  }, []);

  useEffect(() => {
    if (!nachricht || nachricht.brauchtZustimmung) return;
    /* Eine Beobachtung verschwindet von selbst. Eine Frage nicht. */
    const zu = setTimeout(() => setNachricht(null), BLEIBT_MS);
    return () => clearTimeout(zu);
  }, [nachricht]);

  if (!nachricht) return null;

  function antworten(antwort: "behalten" | "verworfen") {
    const id = nachricht!.handlungId;
    starten(async () => {
      await handlungEntscheiden(id, antwort);
      setErledigt(antwort === "behalten" ? "Mach ich." : "Alles klar, lasse ich.");
      setTimeout(() => setNachricht(null), 2200);
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed right-5 z-40 max-w-[21rem] rounded-(--radius-lg) " +
        "bg-raised px-3.5 py-3 text-sm leading-relaxed text-ink-2 ring-1 ring-line-2 " +
        "bottom-[calc(var(--nav-bottom-h)+3.5rem)] md:bottom-16 " +
        "motion-safe:animate-[fade-up_200ms_ease-out]"
      }
    >
      {erledigt ? (
        <p className="text-ink-2">{erledigt}</p>
      ) : (
        <div className="grid gap-2.5">
          <p className="text-ink-2">{nachricht.text}</p>

          {nachricht.brauchtZustimmung ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => antworten("behalten")}
                className="inline-flex items-center gap-1.5 rounded-(--radius-md) bg-accent px-2.5 py-1.5 text-sm font-medium text-on-accent disabled:opacity-60"
              >
                <Check aria-hidden className="size-4" />
                Ja
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => antworten("verworfen")}
                className="inline-flex items-center gap-1.5 rounded-(--radius-md) px-2.5 py-1.5 text-sm text-ink-2 disabled:opacity-60"
              >
                <X aria-hidden className="size-4" />
                Nein
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/*
                Bei einer Beobachtung ist „Nicht interessant“ die
                einzige Antwort, die etwas ändert — sie nimmt die
                Vormerkung zurück. Ein „Danke“ wäre ein Knopf, der
                nichts tut.
              */}
              <button
                type="button"
                disabled={laeuft}
                onClick={() => antworten("verworfen")}
                className="rounded-(--radius-md) px-2 py-1 text-sm text-ink-3 underline underline-offset-2 disabled:opacity-60"
              >
                Nicht interessant
              </button>
              <button
                type="button"
                onClick={() => setNachricht(null)}
                className="ml-auto rounded-(--radius-md) p-1 text-ink-3"
                aria-label="Ausblenden"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
