"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

interface Summary {
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
}

/**
 * Stellen jetzt abrufen.
 *
 * Der Lauf ist wiederholbar — zweimal gedrückt entsteht nichts doppelt.
 * Das Ergebnis wird ungeschönt angezeigt, einschließlich der Anzahl
 * fehlgeschlagener Anzeigen: ein stiller Teilausfall sieht sonst aus wie
 * Erfolg.
 */
export function RefreshJobs() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      const response = await fetch("/api/jobs/refresh?limit=150", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? `Der Abruf ist fehlgeschlagen (${response.status}).`);
        return;
      }
      setSummary(body.total as Summary);
      startTransition(() => router.refresh());
    } catch {
      setError("Die Quelle war nicht erreichbar. Es wurde nichts übernommen.");
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <Button type="button" variant="secondary" onClick={run} disabled={pending}>
          <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} strokeWidth={1.9} />
          {pending ? "Wird abgerufen …" : "Stellen jetzt abrufen"}
        </Button>
      </div>

      {summary && (
        <p role="status" className="text-sm leading-relaxed text-ink-2">
          {summary.fetched} Anzeigen geprüft: {summary.inserted} neu, {summary.updated}{" "}
          aktualisiert, {summary.unchanged} unverändert
          {summary.failed > 0 ? `, ${summary.failed} fehlgeschlagen` : ""}.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
