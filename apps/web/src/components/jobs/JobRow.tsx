"use client";

import Link from "next/link";
import { AlertTriangle, Building2, Check, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { JobMiniatur } from "@/components/jobs/JobBild";

/**
 * Eine Stelle in der linken Spalte.
 *
 * Bewusst eine Zeile, keine Karte. Eine Liste, die man überfliegt,
 * braucht gleiche Zeilenhöhen und einen ruhigen linken Rand — jede
 * Karte mit eigenem Rahmen zerschneidet genau das.
 *
 * Sieben Angaben, mehr nicht: Titel, Unternehmen, Ort, Arbeitsmodell,
 * Gehalt (nur wenn genannt), Alter, Passung. Der Rest steht rechts.
 */

export interface JobRowData {
  id: string;
  title: string;
  companyName: string;
  location: string;
  workModel: string;
  contractType: string | null;
  salaryLabel: string | null;
  ageLabel: string | null;
  isFresh: boolean;
  sourceName: string;
  score: number | null;
  band: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  reservation: string;
  blocked: boolean;
  saved: boolean;
}

const WORK_MODEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "Vor Ort",
};

export function JobRow({
  job,
  selected,
  href,
}: {
  job: JobRowData;
  selected: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      /*
       * Weiche Zeilen statt Karten mit Kante.
       *
       * Der ausgewählte Job trägt die Lavendelfläche — kein linker
       * Balken, kein Rahmen. Ein 2-Pixel-Streifen links ist die Form,
       * die Tabellenwerkzeuge benutzen, und sie macht aus einer Liste
       * ein Gitter.
       */
      className={cn(
        "relative block rounded-(--radius-job) px-4 py-4 transition-colors duration-(--duration-fast)",
        selected ? "bg-lavender" : "hover:bg-soft",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Ein Motiv der Berufsgruppe statt zweier Buchstaben: die
            Liste bekommt Rhythmus, ohne etwas über den Arbeitgeber zu
            behaupten. */}
        <JobMiniatur job={{ id: job.id, title: job.title, companyName: job.companyName }} />

        <div className="min-w-0 flex-1">
          {/* 19px, halbfett — die Spanne aus §16.5. Vorher 15px:
              der Titel war kleiner als der Fliesstext daneben. */}
          <h3 className="truncate text-lg font-semibold leading-snug">{job.title}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-2">{job.companyName}</p>
        </div>

        {/* Der Wert steht rechts oben und nutzt Ziffern gleicher Breite:
            sonst springt die Spalte bei jeder Zeile. */}
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block font-mono text-lg font-semibold leading-none tabular",
              job.score === null
                ? "text-ink-3"
                : job.score >= 70
                  ? "text-positive"
                  : job.score >= 45
                    ? "text-accent-text"
                    : "text-ink-2",
            )}
          >
            {job.score ?? "–"}
          </span>
          <span aria-hidden className="mt-1.5 flex justify-end gap-[2px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-2.5 rounded-full",
                  i < (job.confidence === "high" ? 3 : job.confidence === "medium" ? 2 : 1)
                    ? job.confidence === "high"
                      ? "bg-positive"
                      : job.confidence === "medium"
                        ? "bg-caution"
                        : "bg-critical"
                    : "bg-inset",
                )}
              />
            ))}
          </span>
          <span className="sr-only">
            Passung {job.score ?? "nicht berechenbar"}, Sicherheit{" "}
            {job.confidence === "high" ? "hoch" : job.confidence === "medium" ? "mittel" : "niedrig"}
          </span>
        </span>
      </div>

      <ul className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 text-xs text-ink-3">
        <li className="flex items-center gap-1">
          <MapPin className="size-3 shrink-0" strokeWidth={1.8} />
          {job.location}
        </li>
        <li>{WORK_MODEL[job.workModel] ?? job.workModel}</li>
        {job.contractType && <li>{job.contractType}</li>}
        <li className={job.salaryLabel ? "" : "italic"}>
          {job.salaryLabel ?? "Gehalt nicht angegeben"}
        </li>
        {job.ageLabel && (
          <li className={cn("flex items-center gap-1", job.isFresh && "text-positive")}>
            <Clock className="size-3 shrink-0" strokeWidth={1.8} />
            {job.ageLabel}
          </li>
        )}
      </ul>

      <div className="mt-2.5 grid gap-1 pl-12 text-xs leading-relaxed">
        <p className="flex gap-1.5">
          <Check className="mt-[3px] size-3 shrink-0 text-positive" strokeWidth={2.6} />
          <span className="line-clamp-1 text-ink-2">{job.reason}</span>
        </p>
        <p className="flex gap-1.5">
          <AlertTriangle className="mt-[3px] size-3 shrink-0 text-caution" strokeWidth={2} />
          <span className="line-clamp-1 text-ink-2">{job.reservation}</span>
        </p>
      </div>

      {(job.blocked || job.saved) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-12">
          {job.blocked && (
            <span className="rounded-(--radius-full) border border-critical/30 bg-critical-soft px-2 py-0.5 text-2xs text-critical">
              Ausschlusskriterium
            </span>
          )}
          {job.saved && (
            <span className="rounded-(--radius-full) border border-line-2 px-2 py-0.5 text-2xs text-ink-3">
              gemerkt
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
