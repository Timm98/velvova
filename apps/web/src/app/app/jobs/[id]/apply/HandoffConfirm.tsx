"use client";

import { useState } from "react";

/**
 * „Hast du die Bewerbung abgeschickt?"
 *
 * Die einzige Stelle, an der der Status auf „gesendet" springen kann.
 * Ein Redirect sagt darüber nichts aus: das Produkt weiss nach dem
 * Öffnen der Originalseite genau so viel wie vorher.
 *
 * Deshalb wird gefragt — und „noch nicht" ist eine ebenso gültige
 * Antwort wie „ja". Ohne diese Möglichkeit wäre die Frage eine
 * Aufforderung.
 */

const ANTWORTEN = [
  { key: "sent", label: "Ja, abgeschickt" },
  { key: "not_yet", label: "Noch nicht" },
  { key: "aborted", label: "Abgebrochen" },
  { key: "later", label: "Später" },
] as const;

export function HandoffConfirm({
  jobId,
  assistantName,
}: {
  jobId: string;
  assistantName: string;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  void jobId;

  return (
    <section className="grid gap-3 border-t border-line pt-6">
      <h2 className="text-base font-semibold">Wenn du zurück bist</h2>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
        {assistantName} trägt den Stand nur ein, wenn du ihn bestätigst. Nichts hier zählt eine
        Bewerbung, die du vielleicht gar nicht abgeschickt hast.
      </p>

      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Stand der Bewerbung">
        {ANTWORTEN.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setGewaehlt(a.key)}
            aria-pressed={gewaehlt === a.key}
            className={`inline-flex min-h-10 items-center rounded-[--radius-full] border px-4 text-sm transition-colors ${
              gewaehlt === a.key
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-line-2 text-ink-2"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {gewaehlt && (
        <p className="text-xs leading-relaxed text-ink-3">
          {gewaehlt === "sent"
            ? "Notiert. Wir erinnern dich, wenn ein Nachfassen sinnvoll wird — vorher nicht."
            : gewaehlt === "aborted"
              ? "Notiert. Die Stelle bleibt gespeichert, falls du zurückkommst."
              : "Notiert. Die Bewerbung bleibt vorbereitet, du kannst jederzeit weitermachen."}
        </p>
      )}
    </section>
  );
}
