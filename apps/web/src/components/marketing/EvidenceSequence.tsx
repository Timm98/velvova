"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Check, Quote } from "lucide-react";
import { cn } from "@/lib/cn";
import { NinaSignal } from "@/components/nina/NinaSignal";

/**
 * Die Produktvorschau im Hero.
 *
 * Kein Chat-Bildschirmfoto. Gezeigt wird der eine Vorgang, der dieses
 * Produkt vom Rest der Branche trennt: aus einem beiläufigen Satz wird
 * eine belegte Stärke, daraus werden Rollen — und daraus echte offene
 * Stellen.
 *
 * Die letzten Einträge sind keine Erfindung: sie kommen aus derselben
 * Datenbank wie die Stellen in der Anwendung, mit Quelle. Erfundene
 * Unternehmensnamen auf einer Startseite, die Ehrlichkeit verspricht,
 * wären der schlechteste mögliche erste Eindruck.
 */

export interface SequenceLabels {
  assistantName: string;
  example: string;
  saidLabel: string;
  saidText: string;
  askedLabel: string;
  askedText: string;
  evidenceLabel: string;
  evidenceText: string;
  rolesLabel: string;
  jobsLabel: string;
  jobsNote: string;
}

export interface LiveJobTeaser {
  title: string;
  companyName: string;
  location: string;
  sourceName: string;
}

export function EvidenceSequence({
  labels,
  jobs,
}: {
  labels: SequenceLabels;
  jobs: LiveJobTeaser[];
}) {
  const steps = [
    { kind: "said" as const, label: labels.saidLabel, text: labels.saidText },
    { kind: "asked" as const, label: labels.askedLabel, text: labels.askedText },
    { kind: "evidence" as const, label: labels.evidenceLabel, text: labels.evidenceText },
  ];
  const total = steps.length + (jobs.length > 0 ? 1 : 0);
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(total);
      return;
    }
    const timers = [1200, 2500, 3800]
      .slice(0, total - 1)
      .map((delay, index) => setTimeout(() => setVisible(index + 2), delay));
    return () => timers.forEach(clearTimeout);
  }, [total]);

  return (
    <div className="relative">
      {/* Sehr weites, sehr schwaches Licht. Es trägt keine Information —
          es hebt die Fläche von der Bühne ab. */}
      <div aria-hidden className="aurora absolute -inset-16 -z-10 blur-2xl" />

      <div className="glass overflow-hidden rounded-[--radius-xl] shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <NinaSignal size="sm" state="active" />
          <span className="text-sm font-medium">{labels.assistantName}</span>
          <span className="ml-auto font-mono text-2xs uppercase tracking-wider text-ink-3">
            {labels.example}
          </span>
        </div>

        <ol className="grid gap-2.5 p-5">
          {steps.map((step, index) => (
            <li
              key={step.kind}
              aria-hidden={index >= visible}
              className={cn(
                "transition-all duration-[--duration-slow] ease-[--ease-out]",
                index < visible
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-2 opacity-0",
              )}
            >
              {index > 0 && (
                <div aria-hidden className="flex justify-center py-0.5">
                  <ArrowDown className="size-3.5 text-ink-3" strokeWidth={1.7} />
                </div>
              )}

              <div
                className={cn(
                  "rounded-[--radius-md] px-4 py-3",
                  step.kind === "said" && "bg-inset",
                  step.kind === "asked" && "border border-line-2 bg-assistant-soft",
                  step.kind === "evidence" && "border border-positive/25 bg-positive-soft",
                )}
              >
                <p className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-ink-3">
                  {step.kind === "said" && <Quote className="size-3" strokeWidth={2} />}
                  {step.kind === "asked" && <NinaSignal size="xs" state="thinking" />}
                  {step.kind === "evidence" && (
                    <Check className="size-3 text-positive" strokeWidth={2.6} />
                  )}
                  {step.label}
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-sm leading-relaxed",
                    step.kind === "evidence" ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {step.text}
                </p>
              </div>
            </li>
          ))}

          {jobs.length > 0 && (
            <li
              aria-hidden={visible < total}
              className={cn(
                "transition-all duration-[--duration-slow] ease-[--ease-out]",
                visible >= total
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-2 opacity-0",
              )}
            >
              <div aria-hidden className="flex justify-center py-0.5">
                <ArrowDown className="size-3.5 text-ink-3" strokeWidth={1.7} />
              </div>

              <div className="rounded-[--radius-md] border border-line-2 bg-raised px-4 py-3.5">
                <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-ink-3">
                  <span aria-hidden className="size-1.5 rounded-full bg-positive" />
                  {labels.jobsLabel}
                </p>

                <ul className="mt-3 grid gap-2.5">
                  {jobs.slice(0, 3).map((job) => (
                    <li key={`${job.companyName}-${job.title}`} className="min-w-0">
                      <span className="block truncate text-sm font-medium">{job.title}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {job.companyName} · {job.location} · {job.sourceName}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-2xs text-ink-3">{labels.jobsNote}</p>
              </div>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
