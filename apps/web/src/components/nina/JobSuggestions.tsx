"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Bookmark, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Jobvorschläge im Gespräch.
 *
 * Höchstens drei. Nicht als rechteckige Karten, sondern als weiche
 * Flächen in einer Reihe, die auf schmalen Geräten seitlich scrollt.
 *
 * Was an jedem Vorschlag steht, ist keine Designentscheidung, sondern
 * eine Wahrheitsbedingung: Quelle, Prüfzeit, Passungsband, Konfidenz,
 * ein Grund und ein möglicher Haken. Ein Vorschlag ohne Haken ist eine
 * Werbung — und eine Reihenfolge ohne Konfidenz behauptet eine
 * Genauigkeit, die es nicht gibt.
 *
 * Gehalt erscheint nur, wenn die Anzeige es nennt. Eine Schätzung an
 * dieser Stelle wäre eine erfundene Zahl in einer Gehaltsverhandlung.
 */

export interface JobVorschlag {
  id: string;
  title: string;
  company: string;
  location: string;
  workModel: string;
  salary: string | null;
  freshness: string;
  sourceName: string;
  /** Sehr gut / gut / teilweise — kein Prozentwert. */
  fitBand: string;
  /** hoch / mittel / niedrig */
  confidence: string;
  reason: string;
  caveat: string | null;
}

const BAND_TON: Record<string, string> = {
  "sehr gut": "bg-positive-soft text-positive",
  gut: "bg-accent-soft text-accent-text",
  teilweise: "bg-soft text-ink-2",
};

export function JobSuggestions({
  jobs,
  readiness,
  onDismiss,
}: {
  jobs: JobVorschlag[];
  readiness?: { state: string; reason: string } | null;
  onDismiss?: (id: string, grund: string) => void;
}) {
  const [verworfen, setVerworfen] = useState<Set<string>>(new Set());
  const [fragtNach, setFragtNach] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sichtbar = jobs.filter((j) => !verworfen.has(j.id)).slice(0, 3);
  if (sichtbar.length === 0) return null;

  function verwerfen(id: string, grund: string) {
    setVerworfen((s) => new Set(s).add(id));
    setFragtNach(null);
    if (onDismiss) startTransition(() => onDismiss(id, grund));
  }

  return (
    <section aria-label="Jobvorschläge" className="grid gap-4">
      {/*
       * Bei vorläufiger Einschätzung steht das ÜBER den Vorschlägen,
       * nicht darunter. Wer erst nach dem Lesen erfährt, dass die
       * Reihenfolge geraten war, hat schon geglaubt.
       */}
      {readiness?.state === "exploratory" && (
        <p className="rounded-(--radius-surface) bg-ice px-5 py-3.5 text-sm leading-relaxed text-ink-2">
          <span className="font-medium text-ink">Frühe Vorschläge.</span> {readiness.reason}
        </p>
      )}

      <ul className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sichtbar.map((job) => (
          <li
            key={job.id}
            className="w-[min(320px,82vw)] shrink-0 snap-start rounded-(--radius-job) bg-raised p-5 shadow-sm transition-shadow hover:shadow-lg"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-(--radius-chip) px-2.5 py-1 text-xs font-medium",
                  BAND_TON[job.fitBand] ?? BAND_TON.teilweise,
                )}
              >
                Passung: {job.fitBand}
              </span>
              <span className="rounded-(--radius-chip) bg-soft px-2.5 py-1 text-xs text-ink-2">
                Sicherheit: {job.confidence}
              </span>
            </div>

            <h3 className="mt-3.5 font-display text-[17px] font-normal leading-snug tracking-[-0.01em]">
              {job.title}
            </h3>
            <p className="mt-1 text-sm text-ink-2">
              {job.company} · {job.location}
            </p>
            <p className="mt-0.5 text-sm text-ink-3">
              {job.workModel}
              {/* Gehalt nur, wenn die Anzeige es nennt. */}
              {job.salary ? ` · ${job.salary}` : " · Gehalt nicht angegeben"}
            </p>

            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Dafür spricht: </span>
              {job.reason}
            </p>
            {job.caveat && (
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                <span className="font-medium text-ink">Zu prüfen: </span>
                {job.caveat}
              </p>
            )}

            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3">
              <ExternalLink className="size-3.5" strokeWidth={1.8} />
              {job.sourceName} · {job.freshness}
            </p>

            {fragtNach === job.id ? (
              <div className="mt-4 grid gap-2">
                <p className="text-sm text-ink-2">Was passt nicht?</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Aufgaben", "Bedingungen", "Unternehmen", "Anderes"].map((grund) => (
                    <button
                      key={grund}
                      type="button"
                      onClick={() => verwerfen(job.id, grund)}
                      className="rounded-(--radius-chip) bg-soft px-3.5 py-2 text-sm transition-colors hover:bg-soft-hover"
                    >
                      {grund}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/app/jobs/${job.id}`}
                  className="inline-flex h-11 items-center gap-1.5 rounded-(--radius-control) bg-accent px-4 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
                >
                  Ansehen
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Link>
                <button
                  type="button"
                  aria-label="Speichern"
                  className="grid size-11 place-items-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-soft"
                >
                  <Bookmark className="size-[18px]" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setFragtNach(job.id)}
                  aria-label="Nicht passend"
                  className="grid size-11 place-items-center rounded-(--radius-control) text-ink-3 transition-colors hover:bg-soft hover:text-ink-2"
                >
                  <X className="size-[18px]" strokeWidth={1.9} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/app/jobs"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
      >
        Vollständige Liste ansehen
        <ArrowRight className="size-3.5" strokeWidth={1.9} />
      </Link>
    </section>
  );
}
