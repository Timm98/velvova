import { schnappschussNehmen } from "@paycheck/jobs/bedarfsschnappschuss";

/**
 * Einmal am Tag festhalten, was ausgeschrieben ist.
 *
 * ── Warum das trotz 15-Minuten-Takt nur einmal täglich läuft ───
 *
 * Der Schlüssel enthält den Tag. Ein zweiter Lauf am selben Tag
 * schreibt dieselben Zahlen — das schadet nicht, kostet aber einen
 * Durchlauf über 1,2 Millionen Anzeigen. Deshalb die Sperre auf den
 * zuletzt geschriebenen Tag.
 *
 * ── Warum es überhaupt einen eigenen Auftrag gibt ──────────────
 *
 * Weil sich diese Daten nicht nachholen lassen. Alles andere in
 * diesem Verzeichnis liesse sich nach einem Ausfall nachrechnen; ein
 * Tag ohne Schnappschuss ist ein Tag, über den nie jemand etwas sagen
 * kann.
 */

let zuletzt: string | null = null;

export async function runBedarfsschnappschuss(): Promise<{
  uebersprungen?: true;
  tag?: string;
  zeilen?: number;
  dauerMs?: number;
}> {
  const heute = new Date().toISOString().slice(0, 10);
  if (zuletzt === heute) return { uebersprungen: true };
  const bericht = await schnappschussNehmen();
  zuletzt = heute;
  return bericht;
}
