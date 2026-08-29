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
    await tx.execute(sql`SET LOCAL ROLE paycheck_app`);
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
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
