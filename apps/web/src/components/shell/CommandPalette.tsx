"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Compass,
  CornerDownLeft,
  FileText,
  Globe,
  LayoutGrid,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavLabels } from "./AppShell.tsx";

/**
 * Die Befehlspalette.
 *
 * Sie ist kein Suchfeld über einer Jobbörse, sondern der schnelle Weg zu
 * einem Ort im Produkt. Zwei Sorten Treffer, klar getrennt: Bereiche
 * (sofort, ohne Netz) und echte Stellen (vom Server, mit Verzögerung).
 * Die Trennung ist wichtig, damit die Liste nicht bei jedem Tastendruck
 * springt.
 */

interface JobHit {
  id: string;
  title: string;
  companyName: string;
  location: string;
}

interface Destination {
  href: string;
  label: string;
  hint: string;
  icon: typeof Search;
}

export function CommandPalette({
  open,
  onClose,
  assistantName,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  assistantName: string;
  labels: NavLabels;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<JobHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const destinations = useMemo<Destination[]>(
    () => [
      { href: "/app", label: labels.home, hint: "Nächster Schritt und Überblick", icon: LayoutGrid },
      { href: "/app/nina", label: assistantName, hint: "Gespräch fortsetzen", icon: Sparkles },
      { href: "/app/jobs", label: labels.discover, hint: "Echte Stellen, begründet sortiert", icon: Compass },
      { href: "/app/applications", label: labels.applications, hint: "Entwürfe und Stand", icon: FileText },
      { href: "/app/proben", label: "Ausprobieren", hint: "Kurze Aufgaben aus echten Berufen", icon: Sparkles },
      { href: "/app/belege", label: "Belege", hint: "Was du zeigen kannst — und was du nur sagst", icon: FileText },
      { href: "/app/tools/gehalt", label: "Gehaltsrechner", hint: "Was von einem Brutto übrig bleibt", icon: Compass },
      { href: "/app/tools/route", label: "Pendelrechner", hint: "Was der Weg an Zeit und Geld kostet", icon: Compass },
      { href: "/app/bilanz", label: "Haben Empfehlungen getaugt?", hint: "Was aus ihnen wurde", icon: Compass },
      { href: "/app/beitraege", label: "Was gerade passiert", hint: "Auszählungen aus dem Bestand", icon: Compass },
      { href: "/app/offers", label: "Angebote", hint: "Eintragen und gegen den Median halten", icon: FileText },
      { href: "/app/zusagen", label: "Was dir zugesagt wurde", hint: "Festhalten und nach 14, 30, 90 Tagen prüfen", icon: FileText },
      { href: "/app/career", label: labels.career, hint: "Belegte Stärken und Rollen", icon: Waypoints },
      { href: "/app/documents", label: "Dokumente", hint: "Lebenslauf und Anlagen", icon: FileText },
      { href: "/app/settings/language-region", label: labels.languageRegion, hint: "Sprache, Land, Umkreis", icon: Globe },
      { href: "/app/settings/privacy", label: labels.privacy, hint: "Daten, Einwilligungen, Export", icon: ShieldCheck },
    ],
    [assistantName, labels],
  );

  const matchedDestinations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter(
      (d) => d.label.toLowerCase().includes(q) || d.hint.toLowerCase().includes(q),
    );
  }, [destinations, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setJobs([]);
      setCursor(0);
      // Der Fokus muss nach dem Einblenden gesetzt werden, sonst fängt
      // ihn das Element ab, das die Palette geöffnet hat.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Stellen erst ab drei Zeichen und mit Verzögerung: eine Abfrage je
  // Tastendruck belastet die Datenbank ohne Nutzen für die Suchende.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { jobs: JobHit[] };
        setJobs(body.jobs);
      } catch {
        // Ein fehlgeschlagener Vorschlag ist kein Fehler, der die
        // Oberfläche unterbrechen darf. Die Bereiche funktionieren
        // weiter; die Stellen fehlen still.
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const rows = useMemo(
    () => [
      ...matchedDestinations.map((d) => ({ kind: "destination" as const, href: d.href, data: d })),
      ...jobs.map((j) => ({ kind: "job" as const, href: `/app/jobs/${j.id}`, data: j })),
    ],
    [matchedDestinations, jobs],
  );

  useEffect(() => setCursor(0), [rows.length]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[cursor];
      if (row) go(row.href);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-page/70 px-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.search}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="glass w-full max-w-[600px] overflow-hidden rounded-(--radius-xl) shadow-xl animate-fade-up"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bereich öffnen oder Stelle suchen …"
            aria-label={labels.search}
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          {loading && <Loader2 className="size-4 shrink-0 animate-spin text-ink-3" />}
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-3">
              Nichts gefunden. Versuch einen Bereichsnamen oder einen Jobtitel.
            </p>
          ) : (
            <ul className="grid gap-0.5">
              {matchedDestinations.length > 0 && (
                <li className="px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-wider text-ink-3">
                  Bereiche
                </li>
              )}
              {rows.map((row, index) => {
                if (row.kind === "destination") {
                  const Icon = row.data.icon;
                  return (
                    <li key={row.href}>
                      <button
                        type="button"
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => go(row.href)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-(--radius-md) px-3 py-2.5 text-left transition-colors",
                          index === cursor ? "bg-sunken" : "hover:bg-sunken/60",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{row.data.label}</span>
                          <span className="block truncate text-xs text-ink-3">{row.data.hint}</span>
                        </span>
                        {index === cursor && (
                          <CornerDownLeft className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.8} />
                        )}
                      </button>
                    </li>
                  );
                }

                const isFirstJob = rows[index - 1]?.kind !== "job";
                return (
                  <li key={row.href}>
                    {isFirstJob && (
                      <p className="px-3 pb-1 pt-3 text-2xs font-medium uppercase tracking-wider text-ink-3">
                        Stellen
                      </p>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(row.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-(--radius-md) px-3 py-2.5 text-left transition-colors",
                        index === cursor ? "bg-sunken" : "hover:bg-sunken/60",
                      )}
                    >
                      <Briefcase className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{row.data.title}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {row.data.companyName} · {row.data.location}
                        </span>
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.8} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-2xs text-ink-3">
          <span>↑↓ wählen</span>
          <span>↵ öffnen</span>
          <span>esc schließen</span>
        </p>
      </div>
    </div>
  );
}
