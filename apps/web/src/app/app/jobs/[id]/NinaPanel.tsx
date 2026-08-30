"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Die kontextuelle Assistenz an der Stelle.
 *
 * Bewusst keine weitere Chatoberfläche in der Seitenleiste, sondern
 * vorbereitete Einstiege: eine Frage, die man mit einem Klick stellt,
 * ist hilfreicher als ein leeres Eingabefeld neben einer Stellenanzeige.
 * Jede Frage nimmt den Stellenbezug mit ins Gespräch.
 */
export function NinaPanel({
  jobId,
  assistantName,
  hasReviews,
}: {
  jobId: string;
  assistantName: string;
  hasReviews: boolean;
}) {
  const prompts = [
    { key: "day", label: "Erklär mir den Arbeitsalltag" },
    { key: "gap", label: "Welche Anforderung fehlt mir?" },
    { key: "flags", label: "Zeig mir mögliche Warnsignale" },
    { key: "questions", label: "Welche Fragen soll ich im Gespräch stellen?" },
    ...(hasReviews ? [{ key: "reviews", label: "Fass die Bewertungen zusammen" }] : []),
  ];

  return (
    <section
      aria-labelledby="nina-panel"
      className="rounded-(--radius-lg) border border-assistant-border bg-assistant-soft p-5"
    >
      <h2 id="nina-panel" className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-assistant-text" strokeWidth={2} />
        {assistantName} zu dieser Stelle
      </h2>

      <ul className="mt-3.5 grid gap-1.5">
        {prompts.map((prompt) => (
          <li key={prompt.key}>
            <Link
              href={`/app/nina?job=${jobId}&ask=${prompt.key}`}
              className="flex items-center justify-between gap-3 rounded-(--radius-md) bg-raised/70 px-3.5 py-2.5 text-sm transition-colors hover:bg-raised"
            >
              {prompt.label}
              <ArrowRight className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.9} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
