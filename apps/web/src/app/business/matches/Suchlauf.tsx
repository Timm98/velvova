"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { suchlaufStarten } from "@/lib/arbeitgeber/match-aktionen";

/**
 * Einen Suchlauf über eine Stelle auslösen.
 *
 * ── Warum das Ergebnis in Zahlen dasteht ──────────────────────
 *
 * „Fertig" sagt nichts. Wer nach einem Lauf keine Vorschläge sieht,
 * muss unterscheiden können zwischen „niemand hat zugestimmt",
 * „geprüft, aber nichts passte" und „es ist etwas schiefgegangen".
 * Drei Zahlen beantworten das; ein Häkchen nicht.
 */
export function Suchlauf({
  organizationId,
  stellen,
}: {
  organizationId: string;
  stellen: { id: string; title: string }[];
}) {
  const [stelle, setStelle] = useState(stellen[0]?.id ?? "");
  const [text, setText] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <section className="grid gap-3 rounded-(--radius-md) border border-line p-5">
      <h2 className="text-[15px] font-semibold text-ink">Suchlauf</h2>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={stelle}
          onChange={(e) => setStelle(e.target.value)}
          aria-label="Stelle für den Suchlauf"
          className="h-11 min-w-56 rounded-[10px] border border-line-3 bg-transparent px-3 text-sm text-ink"
        >
          {stellen.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={laeuft || !stelle}
          onClick={() => {
            setText(null);
            setFehler(null);
            starte(async () => {
              const r = await suchlaufStarten(organizationId, stelle);
              if (r.ok) setText(r.text ?? "Fertig.");
              else setFehler(r.fehler ?? "Der Lauf ist gescheitert.");
            });
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-pill) bg-accent px-4 text-sm font-semibold text-accent-on hover:opacity-90 disabled:opacity-55"
        >
          <Search aria-hidden className="size-3.5" strokeWidth={2} />
          {laeuft ? "Läuft …" : "Profile prüfen"}
        </button>
      </div>

      {text && (
        <p role="status" className="text-sm text-ink-2">
          {text}
        </p>
      )}
      {fehler && (
        <p role="alert" className="rounded-(--radius-sm) border border-critical/40 bg-critical-soft px-3 py-2 text-sm text-ink">
          {fehler}
        </p>
      )}
      <p className="text-xs leading-relaxed text-ink-3">
        Geprüft werden ausschliesslich Profile von Menschen, die der Auffindbarkeit ausdrücklich
        zugestimmt haben.
      </p>
    </section>
  );
}
