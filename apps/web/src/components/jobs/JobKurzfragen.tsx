"use client";

import { useState } from "react";
import { HelpCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kurzfragen zu einer Stelle — auf der Stellenseite (§13.3).
 *
 * Vorher waren das vier Links nach `/app/nina?job=…`. Ein Klick nahm
 * einem also genau das weg, worüber man gerade eine Frage hatte: die
 * Anzeige. Man landete in einem leeren Gespräch, musste zurück,
 * suchte die Stelle wieder — und stellte die Frage nicht.
 *
 * Jetzt bleibt die Stelle stehen und die Antwort erscheint darunter.
 * Ein eigener, kleiner Faden mit eigener Gesprächsart (`job_context`),
 * kein Ableger des Karrieregesprächs: die Frage gehört zu dieser
 * Anzeige und soll das Hauptgespräch nicht mit vier
 * Stellenbetrachtungen füllen.
 */

const FRAGEN = [
  { key: "day", label: "Erklär mir den echten Arbeitsalltag" },
  { key: "gap", label: "Welche Anforderungen fehlen mir?" },
  { key: "flags", label: "Welche Warnsignale siehst du?" },
  { key: "questions", label: "Welche Fragen soll ich im Gespräch stellen?" },
] as const;

type FrageKey = (typeof FRAGEN)[number]["key"];

export function JobKurzfragen({
  jobId,
  assistantName,
}: {
  jobId: string;
  assistantName: string;
}) {
  const [offen, setOffen] = useState<FrageKey | null>(null);
  const [antworten, setAntworten] = useState<Partial<Record<FrageKey, string>>>({});
  const [läuft, setLäuft] = useState<FrageKey | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function frage(key: FrageKey) {
    // Zweiter Klick auf dieselbe Frage klappt sie wieder zu.
    if (offen === key) {
      setOffen(null);
      return;
    }
    setOffen(key);
    setFehler(null);

    // Schon beantwortet? Dann nicht noch einmal fragen — die Antwort
    // ändert sich nicht, und jeder Aufruf kostet.
    if (antworten[key]) return;

    setLäuft(key);
    try {
      const antwort = await fetch("/api/nina/job-frage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, frage: key }),
      });
      const daten = (await antwort.json().catch(() => null)) as
        | { antwort?: string; hinweis?: string }
        | null;

      if (!antwort.ok || !daten?.antwort) {
        setFehler(daten?.hinweis ?? "Die Antwort ist gerade nicht verfügbar.");
        return;
      }
      setAntworten((a) => ({ ...a, [key]: daten.antwort! }));
    } catch {
      setFehler("Keine Verbindung. Die Angaben zur Stelle stehen unverändert daneben.");
    } finally {
      setLäuft(null);
    }
  }

  return (
    <section aria-labelledby="nina-fragen" className="grid gap-2.5">
      <h3 id="nina-fragen" className="font-mono text-2xs uppercase tracking-wider text-ink-3">
        {assistantName} zu dieser Stelle
      </h3>

      <ul className="grid gap-1.5">
        {FRAGEN.map((f) => {
          const aktiv = offen === f.key;
          const antwort = antworten[f.key];
          return (
            <li key={f.key} className="grid gap-2">
              <button
                type="button"
                onClick={() => void frage(f.key)}
                aria-expanded={aktiv}
                disabled={läuft !== null && läuft !== f.key}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-(--radius-md) px-3.5 py-2.5 text-left text-sm transition-colors",
                  aktiv ? "bg-lavender" : "bg-soft hover:bg-soft-hover",
                  läuft !== null && läuft !== f.key && "opacity-60",
                )}
              >
                <HelpCircle
                  className={cn("size-3.5 shrink-0", aktiv ? "text-accent" : "text-ink-3")}
                  strokeWidth={1.8}
                />
                <span className="min-w-0 flex-1">{f.label}</span>
              </button>

              {aktiv && (
                <div className="px-1 pb-1">
                  {läuft === f.key ? (
                    <p className="text-sm text-ink-3" aria-live="polite">
                      {assistantName} liest die Anzeige …
                    </p>
                  ) : antwort ? (
                    <div className="grid gap-2">
                      <p className="max-w-[var(--measure)] whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                        {antwort}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setAntworten((a) => ({ ...a, [f.key]: undefined }));
                          void frage(f.key);
                        }}
                        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink-2"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.8} aria-hidden />
                        Noch einmal
                      </button>
                    </div>
                  ) : fehler ? (
                    <p role="alert" className="text-sm leading-relaxed text-ink-2">
                      {fehler}
                    </p>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
