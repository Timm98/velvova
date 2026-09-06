"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { organisationBestaetigen } from "./aktionen";

export function Bestaetigen({
  orgId,
  name,
  bestaetigt,
}: {
  orgId: string;
  name: string;
  bestaetigt: boolean;
}) {
  const [an, setAn] = useState(bestaetigt);
  const [frage, setFrage] = useState(false);
  const [pending, start] = useTransition();

  if (an) {
    return (
      <span className="flex items-center gap-3">
        <span className="rounded-(--radius-pill) bg-positive-soft px-2.5 py-0.5 font-mono text-2xs text-ink">
          bestätigt
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await organisationBestaetigen(orgId, false);
              setAn(false);
            })
          }
          className="text-sm text-ink-3 underline underline-offset-[3px] hover:text-ink"
        >
          Zurücknehmen
        </button>
      </span>
    );
  }

  if (!frage) {
    return (
      <button
        type="button"
        onClick={() => setFrage(true)}
        className="inline-flex h-10 items-center rounded-(--radius-control) px-4 text-sm text-ink-2 ring-1 ring-line transition-colors hover:bg-soft hover:text-ink"
      >
        Bestätigen
      </button>
    );
  }

  return (
    /*
     * Eine Rückfrage, kein Sofortklick.
     *
     * Nach dem Bestätigen kann dieses Konto im Namen des Unternehmens
     * ausschreiben, und Menschen schicken ihm ihre Unterlagen. Das ist
     * keine Einstellung, die man im Vorbeigehen umlegt.
     */
    <span className="flex flex-wrap items-center gap-2">
      <span className="max-w-[22rem] text-sm text-ink-2">
        Geprüft, dass diese Leute für {name} sprechen?
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await organisationBestaetigen(orgId, true);
            setAn(true);
            setFrage(false);
          })
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-pill) bg-accent px-4 text-sm font-medium text-accent-on"
      >
        {pending && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
        Ja, bestätigen
      </button>
      <button
        type="button"
        onClick={() => setFrage(false)}
        className="inline-flex h-9 items-center rounded-(--radius-pill) px-3 text-sm text-ink-2 hover:bg-soft"
      >
        Abbrechen
      </button>
    </span>
  );
}
