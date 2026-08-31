import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";

/**
 * Jede Datenbankarbeit im Namen eines Menschen läuft hierdurch.
 *
 * Zwei Dinge passieren: die Verbindung legt ihre erhöhten Rechte ab
 * (`SET LOCAL ROLE paycheck_app`) und setzt die Kennung, an der die
 * RLS-Richtlinien haengen. Beides ist auf die Transaktion begrenzt, damit
 * kein Zustand in die nächste Anfrage sickert.
 *
 * Ohne diesen Rahmen sieht eine Abfrage keine Nutzerdaten. Das ist
 * Absicht: der sichere Fall ist der Standardfall.
 */
export async function withUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    /*
     * Beides in EINEM Netzweg.
     *
     * Vorher waren es zwei `await` hintereinander — erst die Rolle,
     * dann die Kennung. Gegen eine Datenbank auf demselben Rechner ist
     * das nicht messbar; gegen Supabase kostet jede Runde 44
     * Millisekunden. Eine Transaktion brauchte damit fünf Runden
     * (BEGIN, Rolle, Kennung, Abfrage, COMMIT) und lag bei 218 ms —
     * bei vier solchen Aufrufen je Seite fast eine Sekunde, bevor
     * überhaupt Daten geholt wurden.
     *
     * `set_config('role', …)` setzt dieselbe Rolle wie `SET LOCAL
     * ROLE`: die Rolle ist ein gewöhnlicher Konfigurationsparameter.
     * Mit `true` als drittem Argument gilt beides nur bis zum Ende
     * dieser Transaktion — genau wie vorher, damit kein Zustand in die
     * nächste Anfrage sickert.
     *
     * Dass die Zugriffstrennung dabei wirklich erhalten bleibt, prüft
     * `rls.test.ts` gegen die echte Datenbank: ein Konto darf die Daten
     * eines anderen weder sehen noch ändern.
     */
    await tx.execute(
      sql`SELECT set_config('role', 'paycheck_app', true), set_config('app.user_id', ${userId}, true)`,
    );
    return fn(tx as unknown as Database);
  });
}

/**
 * Für Arbeiten ohne Nutzerbezug: Stellenimport, Taxonomie, Wartung.
 * Berührt bewusst keine nutzerbezogenen Tabellen und wird nie für
 * Anfragen aus der Oberfläche verwendet.
 */
export async function withSystem<T>(db: Database, fn: (tx: Database) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx as unknown as Database));
}
