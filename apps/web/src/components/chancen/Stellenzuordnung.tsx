"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { stelleLoesen, stelleZuordnen } from "@/lib/chancen/zuordnen";
import { cn } from "@/lib/cn";

/**
 * Gemerkte Stellen einem Vorhaben zuordnen und wieder lösen.
 *
 * ── Warum die Liste erst beim Öffnen erscheint ──────────────────
 *
 * Sie ist eine Auswahl, kein Inhalt. Dauerhaft ausgeklappt stünden
 * unter jedem Vorhaben dreissig Stellen, die noch nirgends
 * hingehören — und die Seite handelte davon statt von dem, was
 * bereits zugeordnet ist.
 */
export function Stellenzuordnung({
  projektId,
  frei,
}: {
  projektId: string;
  frei: { id: string; titel: string; firma: string }[];
}) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starten] = useTransition();

  if (frei.length === 0) {
    return (
      <p className="text-2xs leading-relaxed text-(--app-text-3)">
        Keine gemerkte Stelle frei. Was du unter „Jobs &amp; Checks" merkst, kannst du
        hier einem Vorhaben zuordnen.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className={cn(
          "flex w-fit min-h-9 items-center gap-1.5 rounded-(--radius-control) border border-(--app-rand) px-3 text-[13px] text-(--app-text-2)",
          "transition-colors hover:border-(--app-rand-stark) hover:bg-(--app-hover) hover:text-(--app-text)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)",
        )}
      >
        <Plus className="size-3.5 shrink-0" strokeWidth={2} />
        Gemerkte Stelle zuordnen
        <span className="text-(--app-text-3)">({frei.length})</span>
      </button>

      {offen && (
        <ul className="grid gap-1 rounded-(--radius-lg) border border-(--app-rand) bg-(--app-erhoben) p-1.5">
          {frei.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => starten(() => void stelleZuordnen(s.id, projektId))}
                className="flex w-full items-baseline gap-2 rounded-(--radius-sm) px-2.5 py-2 text-left text-[13px] text-(--app-text-2) transition-colors hover:bg-(--app-hover) hover:text-(--app-text) disabled:opacity-50"
              >
                <span className="truncate">{s.titel}</span>
                <span className="shrink-0 text-2xs text-(--app-text-3)">{s.firma}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Eine zugeordnete Stelle wieder lösen. */
export function StelleLoesen({ savedJobId, projektId }: { savedJobId: string; projektId: string }) {
  const [laeuft, starten] = useTransition();
  return (
    <button
      type="button"
      disabled={laeuft}
      onClick={() => starten(() => void stelleLoesen(savedJobId, projektId))}
      aria-label="Aus diesem Vorhaben lösen"
      title="Aus diesem Vorhaben lösen"
      className="grid size-7 shrink-0 place-items-center rounded-(--radius-sm) text-(--app-text-3) transition-colors hover:bg-(--app-hover) hover:text-(--app-text) disabled:opacity-50"
    >
      <X className="size-3.5" strokeWidth={2} />
    </button>
  );
}
