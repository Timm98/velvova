import { createHash } from "node:crypto";

/**
 * Der Fingerabdruck der Angaben, die eine erneute Meldung rechtfertigen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum nicht der Analysezeitstempel
 * ══════════════════════════════════════════════════════════════
 *
 * Die bequeme Regel wäre: „Analyse neu, also melden." Sie führt
 * zuverlässig dazu, dass dieselbe Stelle jedes Mal wiederkommt, wenn
 * der Worker sie anfasst — und der fasst sie an, sobald sich ein
 * Leerzeichen im Text ändert oder eine Regelfassung steigt.
 *
 * Was eine zweite Mail rechtfertigt, ist eine Änderung, die die
 * Entscheidung berührt: Gehalt, Vertrag, Arbeitszeit, Ort, Titel.
 * Alles andere ist Bewegung im System, nicht am Arbeitsmarkt.
 */
export interface MaterielleAngaben {
  titel: string;
  arbeitgeber: string;
  ort: string;
  arbeitsmodell: string | null;
  vertragsform: string | null;
  wochenstunden: number | null;
  gehaltMin: number | null;
  gehaltMax: number | null;
  gehaltWaehrung: string | null;
  gehaltZeitraum: string | null;
  gehaltAngegeben: boolean;
}

export function materielleFassung(a: MaterielleAngaben): string {
  /*
   * Die Reihenfolge ist festgelegt, nicht die der Objektschlüssel.
   *
   * `JSON.stringify` folgt der Einfügereihenfolge — zwei gleich
   * aussehende Objekte aus verschiedenen Abfragen ergäben verschiedene
   * Hashes, und jede Stelle käme einmal zusätzlich in die Mail.
   */
  const teile = [
    a.titel.trim().toLowerCase().replace(/\s+/g, " "),
    a.arbeitgeber.trim().toLowerCase(),
    a.ort.trim().toLowerCase(),
    a.arbeitsmodell ?? "",
    a.vertragsform ?? "",
    a.wochenstunden === null ? "" : String(a.wochenstunden),
    a.gehaltAngegeben ? "1" : "0",
    a.gehaltMin === null ? "" : String(Math.round(a.gehaltMin)),
    a.gehaltMax === null ? "" : String(Math.round(a.gehaltMax)),
    a.gehaltWaehrung ?? "",
    a.gehaltZeitraum ?? "",
  ];
  return createHash("sha256").update(teile.join("")).digest("hex").slice(0, 32);
}
