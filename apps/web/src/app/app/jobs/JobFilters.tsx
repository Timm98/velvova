"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Suche und Filter.
 *
 * Das Suchfeld nimmt normale Sprache entgegen ("Teilzeit in Hamburg,
 * remote"), weil niemand in Feldern denkt. Was daraus erkannt wurde,
 * erscheint danach als Chip — sichtbar und einzeln abwählbar. Eine
 * Suche, die still etwas anderes tut als eingegeben wurde, ist die
 * schlechteste Sorte Magie.
 */

const REMOTE = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on_site", label: "Vor Ort" },
];

const CONTRACT = [
  { value: "permanent", label: "Unbefristet" },
  { value: "fixed_term", label: "Befristet" },
  { value: "working_student", label: "Werkstudium" },
  { value: "internship", label: "Praktikum" },
];

const FRESHNESS = [
  { value: "7", label: "Neu diese Woche" },
  { value: "30", label: "Letzter Monat" },
];

/**
 * Die Sortierung.
 *
 * Die Voreinstellung ist die beste begründete Gesamtchance. Alle
 * anderen Reihenfolgen sind ausdrücklich wählbar — aber keine davon
 * ist käuflich, und es gibt keine bezahlte Platzierung.
 */
const SORT = [
  { value: "best_overall", label: "Beste Gesamtchance" },
  { value: "highest_fit", label: "Höchste Passung" },
  { value: "best_job_quality", label: "Beste Jobqualität" },
  { value: "highest_salary", label: "Höchstes Gehalt" },
  { value: "future_robust", label: "Zukunftsrobust" },
  { value: "shortest_commute", label: "Kürzester Weg" },
  { value: "newest", label: "Neueste zuerst" },
];

export function JobFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(params.get("q") ?? ""), [params]);

  function apply(next: URLSearchParams) {
    startTransition(() => {
      const search = next.toString();
      router.push(search ? `/app/jobs?${search}` : "/app/jobs");
    });
  }

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    apply(next);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    apply(next);
  }

  const active = ["q", "remote", "contract", "since", "salary"].filter((k) => params.get(k));

  return (
    <div className="grid gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <form onSubmit={submitSearch} className="flex min-w-[260px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Beschreib in eigenen Worten, was du suchst …"
              aria-label="Stellen durchsuchen"
              className="h-11 w-full rounded-(--radius-md) border border-line-2 bg-raised pl-10 pr-3.5 text-base shadow-xs transition-colors placeholder:text-ink-3 hover:border-line-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30"
            />
          </div>
        </form>

        <label className="sr-only" htmlFor="sort">
          Sortierung
        </label>
        <select
          id="sort"
          value={params.get("sort") ?? "best_overall"}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            if (e.target.value === "best_overall") next.delete("sort");
            else next.set("sort", e.target.value);
            apply(next);
          }}
          className="h-11 shrink-0 rounded-(--radius-md) border border-line-2 bg-raised px-3.5 text-sm shadow-xs transition-colors hover:border-line-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30"
        >
          {SORT.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-(--radius-md) border px-4 text-sm font-medium shadow-xs transition-colors",
            open || active.length > 0
              ? "border-accent bg-accent-soft text-accent-text"
              : "border-line-2 bg-raised hover:border-line-3",
          )}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.9} />
          Filter
          {active.length > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-2xs font-semibold text-accent-on">
              {active.length}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          ref={panelRef}
          className="grid gap-5 rounded-(--radius-lg) border border-line bg-raised p-5 shadow-sm animate-fade-in"
        >
          <FilterRow legend="Arbeitsmodell" name="remote" options={REMOTE} params={params} onToggle={toggle} />
          <FilterRow legend="Vertragsart" name="contract" options={CONTRACT} params={params} onToggle={toggle} />
          <FilterRow legend="Aktualität" name="since" options={FRESHNESS} params={params} onToggle={toggle} />
          <FilterRow
            legend="Gehalt"
            name="salary"
            options={[{ value: "disclosed", label: "Nur mit genannter Spanne" }]}
            params={params}
            onToggle={toggle}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 text-sm text-ink-3">
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              wird sortiert …
            </>
          ) : (
            `${resultCount} ${resultCount === 1 ? "Stelle" : "Stellen"}`
          )}
        </p>

        {active.map((key) => {
          const value = params.get(key)!;
          const label =
            key === "q"
              ? `„${value}“`
              : (REMOTE.find((o) => o.value === value)?.label ??
                CONTRACT.find((o) => o.value === value)?.label ??
                FRESHNESS.find((o) => o.value === value)?.label ??
                "Mit Gehaltsangabe");

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                next.delete(key);
                apply(next);
              }}
              className="inline-flex items-center gap-1.5 rounded-(--radius-full) border border-accent-border bg-accent-soft px-3 py-1 text-xs font-medium text-accent-text transition-colors hover:border-accent"
            >
              {label}
              <X className="size-3" strokeWidth={2.4} />
              <span className="sr-only">Filter entfernen</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterRow({
  legend,
  name,
  options,
  params,
  onToggle,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  params: URLSearchParams;
  onToggle: (key: string, value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2.5">
      <legend className="text-2xs font-medium uppercase tracking-wider text-ink-3">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = params.get(name) === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(name, option.value)}
              className={cn(
                "inline-flex min-h-9 items-center rounded-(--radius-full) border px-3.5 text-sm transition-colors",
                active
                  ? "border-accent bg-accent-soft font-medium text-accent-text"
                  : "border-line-2 bg-raised text-ink-2 hover:border-line-3 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
