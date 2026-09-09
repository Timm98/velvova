"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * „Was ich über dich weiß“.
 *
 * Die ruhige Übersicht, die die frühere Themenleiste ersetzt. Der
 * Unterschied ist nicht das Aussehen, sondern der Ort: die Leiste stand
 * permanent über dem Gespräch und machte daraus einen Fragebogen mit
 * zwölf Feldern. Das hier öffnet nur, wer es wissen will — und schließt
 * wieder.
 *
 * Sechs Gruppen, nicht vierzehn Stufen. Die Stufen sind ein internes
 * Werkzeug; wer sie als Liste sieht, arbeitet sie ab.
 */

export interface Fortschrittsgruppe {
  key: string;
  label: string;
  done: boolean;
}

export function ProgressDrawer({
  open,
  onClose,
  groups,
  completeness,
  readiness,
  vermutungen = [],
  assistantName,
}: {
  open: boolean;
  onClose: () => void;
  groups: Fortschrittsgruppe[];
  completeness: number;
  readiness?: { state: string; missing: string[]; reason: string } | null;
  /**
   * Was Monday vermutet, aber noch nicht bestätigt hat.
   *
   * ── Warum das hierhin gehört ────────────────────────────────────
   *
   * „Was ich über dich weiss" ist unvollständig, solange nur das
   * Bestätigte darin steht. Eine Vermutung, die im Hintergrund die
   * Antworten mitprägt und nirgends sichtbar ist, kann niemand
   * berichtigen — und genau das ist der Fall, in dem eine falsche
   * Annahme lange bleibt.
   */
  vermutungen?: { id: string; statement: string }[];
  assistantName: string;
}) {
  const fläche = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    fläche.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fertig = groups.filter((g) => g.done).length;

  return (
    <>
      {/* Die Fläche dahinter schließt beim Antippen. Ein Drawer ohne
          diesen Ausweg fühlt sich an wie ein Fehler. */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-ink/10 backdrop-blur-[2px] motion-safe:animate-[fade-in_200ms_ease-out]"
      />

      <div
        ref={fläche}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Was ${assistantName} über dich weiß`}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-raised shadow-xl outline-none",
          // Auf schmalen Geräten ein Bogen von unten, auf breiten eine
          // Fläche rechts. Beides derselbe Inhalt, beides mit dem Daumen
          // bzw. der Maus dort, wo die Hand ohnehin ist.
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-(--radius-sheet)",
          "sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[340px] sm:max-h-none sm:rounded-(--radius-sheet)",
          "motion-safe:animate-[nina-rise_240ms_cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-7 pb-4 pt-7">
          <div className="grid gap-1">
            <h2 className="font-display text-xl font-normal tracking-[-0.02em]">
              Was ich über dich weiß
            </h2>
            <p className="text-sm text-ink-2">
              {fertig} von {groups.length} Bereichen sind klar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid size-11 shrink-0 place-items-center rounded-(--radius-control) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.9} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
          {/*
           * Ein Ring statt eines Balkens.
           *
           * Ein Balken liest sich als Strecke mit Ende — „noch 40 %“.
           * Der Ring zeigt dasselbe, ohne ein Versprechen über die
           * Restlänge zu machen.
           */}
          {/*
            Grau statt blau.

            Hier lag `bg-accent-soft` — eine getönte Fläche über die
            ganze Breite, und das Erste, was man beim Öffnen sah. Der
            Ring darin trägt die Zahl; die Fläche darunter musste
            nichts sagen und sagte trotzdem am lautesten.
          */}
          <div className="flex items-center gap-4 rounded-(--radius-surface) bg-(--app-erhoben-2) px-5 py-4">
            <div className="relative grid size-16 shrink-0 place-items-center">
              <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="20" cy="20" r="17" fill="none" stroke="var(--surface-1)" strokeWidth="4" />
                <circle
                  cx="20"
                  cy="20"
                  r="17"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(completeness / 100) * 106.8} 106.8`}
                  className="transition-[stroke-dasharray] duration-(--duration-slow) ease-(--ease-out)"
                />
              </svg>
              <span className="tabular text-sm font-semibold">{Math.round(completeness)}</span>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">
              {readiness?.reason ?? "Je mehr du erzählst, desto genauer wird die Auswahl."}
            </p>
          </div>

          <ul className="mt-6 grid gap-1">
            {groups.map((g) => (
              <li
                key={g.key}
                className="flex items-center gap-3 rounded-(--radius-input) px-3 py-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full",
                    g.done ? "bg-positive-soft text-positive" : "bg-soft text-ink-3",
                  )}
                >
                  {g.done ? <Check className="size-4" strokeWidth={2.6} /> : null}
                </span>
                <span className={cn("text-[15px]", g.done ? "text-ink" : "text-ink-2")}>
                  {g.label}
                </span>
                {/* Der Zustand steht auch als Wort da — Farbe allein
                    trägt keine Information. */}
                <span className="sr-only">{g.done ? "abgeschlossen" : "noch offen"}</span>
              </li>
            ))}
          </ul>

          {vermutungen.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium">Was ich vermute</h3>
              {/*
                Ausdrücklich getrennt von dem, was oben steht.
                
                Oben ist Bestätigtes, hier Angenommenes. Beides in
                einer Liste zu führen wäre die bequeme Lösung und die
                falsche: Wer eine Vermutung für eine Tatsache hält,
                berichtigt sie nicht — und eine unberichtigte Annahme
                prägt jede weitere Antwort mit.
              */}
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">
                Noch nicht bestätigt. Sag mir, wenn etwas davon nicht stimmt.
              </p>
              <ul className="mt-3 grid gap-2">
                {vermutungen.slice(0, 5).map((v) => (
                  <li key={v.id} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full border border-ink-3" />
                    {v.statement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {readiness && readiness.missing.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium">Was mir noch fehlt</h3>
              <ul className="mt-3 grid gap-2">
                {readiness.missing.slice(0, 5).map((m) => (
                  <li key={m} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
