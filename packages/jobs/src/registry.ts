import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { JobSourceAdapter } from "./adapter.ts";
import { UserTextImportAdapter } from "./sources/userImport.ts";
import { ArbeitnowAdapter } from "./sources/arbeitnow.ts";
import { AdzunaAdapter } from "./sources/adzuna.ts";
import { JOOBLE_COUNTRIES, JoobleAdapter } from "./sources/jooble.ts";
import { AtsBoardAdapter, type BoardKind, type BoardRegistration } from "./sources/ats/board.ts";
import { PARTNER_ADAPTERS } from "./sources/partners.ts";
import { LightcastAdapter } from "./sources/lightcast.ts";

/**
 * Welche Quellen aktiv sind.
 *
 * Eine Quelle läuft nur, wenn sie ausgewählt, konfiguriert UND lizenziert
 * ist. Alle drei Prüfungen stehen hier und nicht im Aufrufer — sonst
 * schleicht sich früher oder später eine Stelle ein, an der eine davon
 * vergessen wird.
 */

export interface SourceStatus {
  key: string;
  displayName: string;
  active: boolean;
  reason: string;
  /** Liefert diese Quelle echte Stellen oder synthetische? */
  real: boolean;
}

/**
 * Registrierte Arbeitgeberboards, prozessweit gehalten.
 *
 * Der Adapter fragt sie synchron ab (`isConfigured()`), der
 * Datenbankzugriff ist asynchron. Deshalb wird die Liste vom Abrufpfad
 * gesetzt, statt sie im Adapter zu laden. Ist sie leer, fragt der
 * Adapter niemanden — und das ist die richtige Antwort, nicht ein
 * Versehen: wir kennen dann keinen Arbeitgeber, dessen Stellen wir
 * abrufen dürfen.
 */
const boardRegistrations = new Map<BoardKind, BoardRegistration[]>();

export function setBoardRegistrations(board: BoardKind, rows: BoardRegistration[]): void {
  boardRegistrations.set(board, rows);
}

export const ATS_BOARDS: BoardKind[] = ["greenhouse", "lever", "ashby", "smartrecruiters"];

function allAdapters(): JobSourceAdapter[] {
  return [
    new ArbeitnowAdapter(),
    new AdzunaAdapter(),
    ...JOOBLE_COUNTRIES.map((country) => new JoobleAdapter({ country })),
    new LightcastAdapter(),
    ...ATS_BOARDS.map(
      (board) => new AtsBoardAdapter(board, () => boardRegistrations.get(board) ?? []),
    ),
    // Ohne Vertrag. Sie rufen nichts ab und werfen, wenn es jemand
    // versucht — aber sie machen die Lücke sichtbar. Fehlt der Adapter
    // ganz, sieht die Betriebsansicht aus, als gäbe es LinkedIn nicht,
    // und die nächste Person schreibt einen Scraper statt nach einem
    // Vertrag zu fragen.
    ...PARTNER_ADAPTERS.map((Adapter) => new Adapter()),
    new UserTextImportAdapter(),
  ];
}

export function adapterByKey(key: string): JobSourceAdapter | undefined {
  return allAdapters().find((a) => a.key === key);
}

export function activeAdapters(cfg: RuntimeConfig = loadRuntimeConfig()): JobSourceAdapter[] {
  return allAdapters().filter(
    (a) => cfg.jobs.sources.includes(a.key) && a.isConfigured() && a.licenseStatus !== "unclear",
  );
}

export function sourceStatuses(cfg: RuntimeConfig = loadRuntimeConfig()): SourceStatus[] {
  const statuses: SourceStatus[] = allAdapters().map((a) => {
    const selected = cfg.jobs.sources.includes(a.key);
    const configured = a.isConfigured();
    const licensed = a.licenseStatus !== "unclear";
    return {
      key: a.key,
      displayName: a.displayName,
      active: selected && configured && licensed,
      real: true,
      reason: !licensed
        ? "gesperrt: Rechtslage nicht geklärt"
        : !selected
          ? "nicht ausgewählt"
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
      real: false,
      reason: "aktiv — ausschließlich synthetische Stellen",
    });
  }

  return statuses;
}
