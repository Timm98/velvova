"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
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
];

/**
 * Die Art der Stelle — aus dem Titel, nicht aus dem Vertragsfeld.
 *
 * ── Warum das nötig war ───────────────────────────────────────
 *
 * „Werkstudium" und „Praktikum" standen bisher bei der Vertragsart und
 * filterten auf `contract_type`. Das Feld ist bei 48.647 von 80.486
 * Stellen leer, und die Quellen füllen es kaum: Gemessen fand der
 * Filter 119 Praktika und 99 Werkstudien. Aus den Titeln lesen sich
 * 1.069 und 816 — also rund das Neunfache.
 *
 * Ausbildung und Minijob liessen sich gar nicht auswählen; das Feld
 * kennt fünf `apprenticeship` im ganzen Bestand.
 *
 * Ein Filter, der ein Zehntel findet, ist schlimmer als keiner: Er
 * sieht aus wie eine vollständige Antwort.
 */
const ART = [
  { value: "regulaer", label: "Feste Stelle" },
  { value: "praktikum", label: "Praktikum" },
  { value: "werkstudium", label: "Werkstudium" },
  { value: "ausbildung", label: "Ausbildung" },
  { value: "minijob", label: "Minijob" },
  { value: "trainee", label: "Trainee" },
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
    /*
     * Jede Änderung an Filter oder Sortierung beginnt wieder auf Seite 1.
     *
     * Bei Filtern ist der Grund offensichtlich: die Liste wird kürzer,
     * Seite 4 gibt es vielleicht nicht mehr. Bei der Sortierung ist er
     * es weniger — die Länge bleibt gleich. Aber auf Seite 4 stehen
     * danach völlig andere Stellen, ohne dass jemand geblättert hätte.
     * Wer neu sortiert, will oben anfangen.
     */
    next.delete("seite");
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


  const active = ["q", "art", "remote", "contract", "since", "salary"].filter((k) => params.get(k));

  return (
    <div className="grid gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {/*
          Das zweite Suchfeld ist entfallen.

          Es stand direkt unter „Frag Monday …" und versprach dasselbe —
          zwei Felder für eine Absicht sind keine Wahl, sondern eine
          Frage, die niemand beantworten kann. Der Text kommt jetzt aus
          dem Monday Search Composer und landet über `?q=` genauso hier.
        */}
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
          className="h-11 shrink-0 rounded-(--radius-pill) bg-soft px-4 text-sm transition-colors hover:bg-soft-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <FilterRow legend="Art der Stelle" name="art" options={ART} params={params} onToggle={toggle} />
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
        {/*
          Die Trefferzahl steht in der Abdeckungszeile darunter — dort
          im Zusammenhang („243 von 975 aktiven"). Hier stand sie
          nackt daneben und war damit dieselbe Zahl zweimal.
          Übrig bleibt der Ladehinweis: der gehört an die Filter, weil
          sie ihn auslösen.
        */}
        {pending && (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 className="size-3.5 animate-spin" />
            wird sortiert …
          </p>
        )}

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
