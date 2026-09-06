import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadRuntimeConfig } from "@paycheck/config";

/**
 * Wo eine hochgeladene Datei liegt.
 *
 * Zwei Ablagen, ein Vertrag. Welche gilt, entscheidet
 * `STORAGE_DRIVER` — und beide halten dieselbe Regel ein, die für
 * persönliche Dokumente die wichtigste ist:
 *
 *   **Der Pfad beginnt mit der Nutzerkennung.**
 *
 * Das ist keine Ordnungsfrage. Daran hängt die Zugriffsregel: eine
 * Datei unter `a1b2…/dok/lebenslauf.pdf` gehört sichtbar zu einem
 * Konto, und eine Ablage kann darauf prüfen, ohne den Anwendungscode zu
 * fragen. Ein flacher Ordner mit zufälligen Namen wäre bequemer und
 * hätte diese Eigenschaft nicht.
 *
 * **Lokal** schreibt in `.storage` — für die Entwicklung und für den
 * Betrieb ohne Objektspeicher. Das Verzeichnis steht in `.gitignore`;
 * es enthält Nutzerinhalte und gehört nie ins Repository.
 *
 * **S3/Supabase** kommt dazu, sobald `STORAGE_DRIVER=s3` gesetzt ist.
 * Bis dahin meldet diese Datei ehrlich, dass sie es nicht kann, statt
 * eine Ablage zu behaupten, die es nicht gibt.
 */

export interface AblageZiel {
  bucket: string;
  pfad: string;
}

/** Aus einem fremden Dateinamen einen sicheren machen. */
export function sichererName(roh: string): string {
  return (
    roh
      .normalize("NFKD")
      // Alles, was in einem Pfad etwas bedeuten könnte, fällt weg —
      // Schrägstriche, Punkte am Anfang, Doppelpunkte aus macOS.
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^\.+/, "")
      .replace(/_{2,}/g, "_")
      .slice(-120) || "datei"
  );
}

export function inhaltsKennung(daten: Uint8Array): string {
  return createHash("sha256").update(daten).digest("hex");
}

function lokalerPfad(ziel: AblageZiel): string {
  const cfg = loadRuntimeConfig();
  const wurzel = path.resolve(process.cwd(), "../..", cfg.storage.dir);
  const voll = path.resolve(wurzel, ziel.bucket, ziel.pfad);

  /*
   * Der Ausbruchsschutz.
   *
   * `pfad` enthält eine Nutzerkennung und einen bereinigten Dateinamen,
   * ist also schon zweimal geprüft. Diese Zeile prüft ein drittes Mal —
   * gegen den zusammengesetzten Pfad. Ein Verzeichniswechsel, der es
   * bis hierher schafft, würde sonst irgendwo im Dateisystem schreiben,
   * und das wäre nicht mehr zu reparieren.
   */
  if (!voll.startsWith(path.resolve(wurzel) + path.sep)) {
    throw new Error("Ungültiger Ablagepfad.");
  }
  return voll;
}

export async function ablegen(ziel: AblageZiel, daten: Uint8Array): Promise<void> {
  const cfg = loadRuntimeConfig();
  if (cfg.storage.driver === "s3") {
    throw new Error("Die S3-Ablage ist noch nicht angeschlossen.");
  }
  const voll = lokalerPfad(ziel);
  await mkdir(path.dirname(voll), { recursive: true });
  await writeFile(voll, daten);
}

export async function holen(ziel: AblageZiel): Promise<Uint8Array> {
  const cfg = loadRuntimeConfig();
  if (cfg.storage.driver === "s3") {
    throw new Error("Die S3-Ablage ist noch nicht angeschlossen.");
  }
  return new Uint8Array(await readFile(lokalerPfad(ziel)));
}

export async function loeschen(ziel: AblageZiel): Promise<void> {
  const cfg = loadRuntimeConfig();
  if (cfg.storage.driver === "s3") {
    throw new Error("Die S3-Ablage ist noch nicht angeschlossen.");
  }
  await unlink(lokalerPfad(ziel)).catch(() => undefined);
}
