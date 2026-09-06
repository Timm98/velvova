"use client";

import { useState, useTransition } from "react";
import { bewerbungZurueckziehen } from "@/lib/arbeitgeber/bewerbungen";

/**
 * Eine Bewerbung zurückziehen.
 *
 * Mit Rückfrage: Zurückziehen ist gegenüber dem Unternehmen sichtbar und
 * lässt sich nicht rückgängig machen. Ein Klick daneben wäre teuer.
 */
export function Zuruckziehen({ id }: { id: string }) {
  const [frage, setFrage] = useState(false);
  const [pending, start] = useTransition();

  if (!frage) {
    return (
      <button
        type="button"
        onClick={() => setFrage(true)}
        className="text-2xs text-ink-3 underline underline-offset-[3px] hover:text-ink"
      >
        Zurückziehen
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-2xs">
      <span className="text-ink-2">Sicher?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await bewerbungZurueckziehen(id); })}
        className="text-ink underline underline-offset-[3px]"
      >
        Ja
      </button>
      <button type="button" onClick={() => setFrage(false)} className="text-ink-3 underline underline-offset-[3px]">
        Abbrechen
      </button>
    </span>
  );
}
