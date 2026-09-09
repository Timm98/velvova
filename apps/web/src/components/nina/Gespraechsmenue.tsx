"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, PauseCircle, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Die Gesprächsaktionen — hinter einem Punkt-Menü.
 *
 * ── Warum sie nicht mehr nebeneinander stehen ───────────────────
 *
 * Weil sie es taten und den oberen Fünftel der Fläche belegten:
 * fünf Knöpfe in einer Reihe, jeder mit Text, für Dinge, die man
 * einmal am Tag braucht. Eine Werkzeugleiste ist eine Aussage
 * darüber, was wichtig ist — und „Pause" ist es nicht.
 *
 * Drei Punkte sind an dieser Stelle das ehrlichere Zeichen: Hier ist
 * etwas, aber es drängt sich nicht auf.
 */
export function Gespraechsmenue({
  onPause,
  pending,
  labels,
}: {
  onPause: () => void;
  pending: boolean;
  labels: { pause: string };
}) {
  const [offen, setOffen] = useState(false);
  const hier = useRef<HTMLDivElement>(null);

  /* Klick daneben und Escape schliessen. Ein Menü, das nur über
     seinen eigenen Knopf zugeht, fängt Klicks ab, die woandershin
     wollten. */
  useEffect(() => {
    if (!offen) return;
    const aus = (e: MouseEvent) => {
      if (!hier.current?.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("mousedown", aus);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", aus);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  const eintrag =
    "flex w-full items-center gap-2.5 rounded-(--radius-sm) px-3 py-2 text-left text-[13px] text-(--app-text-2) transition-colors hover:bg-(--app-hover) hover:text-(--app-text) disabled:cursor-not-allowed disabled:text-(--app-text-3)";

  return (
    <div ref={hier} className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label="Gesprächsaktionen"
        className={cn(
          "flex size-9 items-center justify-center rounded-(--radius-sm) text-(--app-text-3) transition-colors",
          "hover:bg-(--app-hover) hover:text-(--app-text)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)",
          offen && "bg-(--app-hover) text-(--app-text)",
        )}
      >
        <MoreHorizontal className="size-[18px]" strokeWidth={1.8} />
      </button>

      {offen && (
        <div
          role="menu"
          className="absolute top-[calc(100%+0.25rem)] right-0 z-50 w-56 rounded-(--radius-lg) border border-(--app-rand) bg-(--app-erhoben) p-1.5 shadow-xl"
        >
          <Link href="/app/monday" role="menuitem" className={eintrag} onClick={() => setOffen(false)}>
            <Plus className="size-4 shrink-0" strokeWidth={1.8} />
            Neues Gespräch
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setOffen(false);
              onPause();
            }}
            className={eintrag}
          >
            <PauseCircle className="size-4 shrink-0" strokeWidth={1.8} />
            {labels.pause}
          </button>
        </div>
      )}
    </div>
  );
}
