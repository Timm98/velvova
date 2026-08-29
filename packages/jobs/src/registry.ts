import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { JobSourceAdapter } from "./adapter.ts";
import { UserTextImportAdapter } from "./sources/userImport.ts";

/**
 * Welche Quellen aktiv sind.
 *
 * Eine Quelle läuft nur, wenn sie konfiguriert UND lizenziert ist. Beides
 * wird hier geprüft, nicht im Aufrufer - sonst schleicht sich früher
 * oder später eine Stelle ein, an der es vergessen wird.
 */

export interface SourceStatus {
  key: string;
  displayName: string;
  active: boolean;
  reason: string;
}

export function activeAdapters(cfg: RuntimeConfig = loadRuntimeConfig()): JobSourceAdapter[] {
  const all: JobSourceAdapter[] = [new UserTextImportAdapter()];
  return all.filter((a) => cfg.jobs.sources.includes(a.key) && a.isConfigured());
}

export function sourceStatuses(cfg: RuntimeConfig = loadRuntimeConfig()): SourceStatus[] {
  const all: JobSourceAdapter[] = [new UserTextImportAdapter()];

  const statuses = all.map((a) => {
    const selected = cfg.jobs.sources.includes(a.key);
    const configured = a.isConfigured();
    return {
      key: a.key,
      displayName: a.displayName,
      active: selected && configured,
      reason: !selected
        ? "nicht ausgewaehlt"
        : !configured
          ? "nicht eingerichtet: Zugangsdaten fehlen"
          : "aktiv",
    };
  });

  if (cfg.jobs.sources.includes("seed")) {
    statuses.unshift({
      key: "seed",
      displayName: "Demo-Datensatz",
      active: true,
      reason: "aktiv - ausschließlich synthetische Stellen",
    });
  }

  return statuses;
}
