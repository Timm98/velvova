import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadRuntimeConfig } from "@paycheck/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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


/**
 * ══════════════════════════════════════════════════════════════════
 * Die Supabase-Ablage
 * ══════════════════════════════════════════════════════════════════
 *
 * Warum es sie geben muss: Der Treiber `local` schreibt mit `mkdir`
 * und `writeFile` in ein Verzeichnis. Auf einer serverlosen Plattform
 * ist das Dateisystem schreibgeschützt — das Hochladen eines
 * Profilbilds scheiterte dort. Und `s3` warf „noch nicht
 * angeschlossen". Es gab also keine Ablage, die in Produktion
 * funktioniert.
 *
 * Warum Supabase und nichts Neues: Dieselbe Supabase trägt bereits
 * die Datenbank, und `lib/supabase/storage.ts` kennt die Buckets und
 * die signierten Links. Es fehlte nur das Schreiben. Ein zusätzlicher
 * Dienst wäre dafür weder nötig noch freigegeben.
 *
 * Warum der Admin-Client: Diese Funktionen laufen im Server, nachdem
 * der Aufrufer die Berechtigung geprüft hat. Der Pfad beginnt mit der
 * Nutzerkennung — dieselbe Regel wie bei der lokalen Ablage.
 *
 * ── Was hier NICHT passiert ────────────────────────────────────
 *
 * Kein Anlegen von Buckets. Ein Bucket ist eine Einstellung der
 * Umgebung, keine Nebenwirkung eines Uploads: Wer ihn im Code
 * erzeugt, legt in Produktion beim ersten Fehlversuch stillschweigend
 * einen an — womöglich öffentlich lesbar. Fehlt er, sagt die Meldung
 * unten, welcher.
 */
function supabaseAblage() {
  return createSupabaseAdminClient().storage;
}

function pfadIn(ziel: AblageZiel): { bucket: string; pfad: string } {
  return { bucket: ziel.bucket, pfad: ziel.pfad };
}

export async function ablegen(ziel: AblageZiel, daten: Uint8Array): Promise<void> {
  const cfg = loadRuntimeConfig();
  if (cfg.storage.driver === "supabase") {
    const { bucket, pfad } = pfadIn(ziel);
    const { error } = await supabaseAblage()
      .from(bucket)
      .upload(pfad, daten, { upsert: true, contentType: "application/octet-stream" });
    if (error) {
      throw new Error(
        `Die Datei konnte nicht abgelegt werden (Bucket "${bucket}"): ${error.message}. ` +
          `Existiert der Bucket in Supabase?`,
      );
    }
    return;
  }
  if (cfg.storage.driver === "s3") {
    throw new Error("Die S3-Ablage ist noch nicht angeschlossen.");
  }
  lokalNurAusserhalbProduktion(cfg.storage.driver);
  const voll = lokalerPfad(ziel);
  await mkdir(path.dirname(voll), { recursive: true });
  await writeFile(voll, daten);
}

/**
 * In Produktion gibt es keine Ablage auf der Festplatte.
 *
 * Derselbe Riegel wie bei der Datenbank, und aus demselben Grund: Ein
 * `mkdir` auf einem schreibgeschützten Dateisystem scheitert — und
 * wenn es nicht scheiterte, läge die Datei in einem Verzeichnis, das
 * beim nächsten Kaltstart verschwunden ist. Das wäre die stille
 * Variante: Der Upload meldet Erfolg, das Bild ist morgen weg.
 */
function lokalNurAusserhalbProduktion(treiber: string): void {
  const inProduktion =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (treiber === "local" && inProduktion) {
    throw new Error(
      "In Produktion ist keine Dateiablage konfiguriert. Der Treiber steht auf " +
        "\"local\" und schreibt auf die Festplatte, die hier schreibgeschützt ist. " +
        "Hinterlege NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY — dann wird " +
        "automatisch die Supabase-Ablage verwendet.",
    );
  }
}

export async function holen(ziel: AblageZiel): Promise<Uint8Array> {
  const cfg = loadRuntimeConfig();
  if (cfg.storage.driver === "supabase") {
    const { bucket, pfad } = pfadIn(ziel);
    const { data, error } = await supabaseAblage().from(bucket).download(pfad);
    if (error || !data) {
      throw new Error(
        `Die Datei wurde nicht gefunden (Bucket "${bucket}"): ${error?.message ?? "keine Daten"}.`,
      );
    }
    return new Uint8Array(await data.arrayBuffer());
  }
  if (cfg.storage.driver === "s3") {
    throw new Error("Die S3-Ablage ist noch nicht angeschlossen.");
  }
  lokalNurAusserhalbProduktion(cfg.storage.driver);
  return new Uint8Array(await readFile(lokalerPfad(ziel)));
}

export async function loeschen(ziel: AblageZiel): Promise<void> {
  const cfg = loadRuntimeConfig();
  if (cfg.storage.driver === "supabase") {
    const { bucket, pfad } = pfadIn(ziel);
    /* Ein fehlgeschlagenes Löschen bleibt still — wie bei der lokalen
       Ablage. Wer eine Datei entfernt, die schon weg ist, hat sein
       Ziel erreicht. */
    await supabaseAblage().from(bucket).remove([pfad]);
    return;
  }
  if (cfg.storage.driver === "s3") {
    throw new Error("Die S3-Ablage ist noch nicht angeschlossen.");
  }
  await unlink(lokalerPfad(ziel)).catch(() => undefined);
}
