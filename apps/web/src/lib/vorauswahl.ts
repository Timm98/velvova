import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * ══════════════════════════════════════════════════════════════════
 * Wem du vorgeschlagen wurdest
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum es das gibt ───────────────────────────────────────────
 *
 * Weil `bedarfstreffer` eine Zeile über einen Menschen anlegt: seine
 * Kennung, ein Passungswert, seine offenen Punkte. Migration 0114 gab
 * sie allein der Organisation und schrieb die Kehrseite als Schuld in
 * den Kommentar — es gab keine Ansicht, in der jemand nachsieht, was
 * über ihn entstanden ist. Eine solche Zeile ist dann keine Vorschau
 * mehr, sondern eine Akte.
 *
 * ── Was hier NICHT steht ────────────────────────────────────────
 *
 * Der Betrieb. `organizations` und `bedarfsvorgaenge` bleiben für die
 * Person gesperrt, und diese Abfrage fragt sie gar nicht erst. Sie
 * sagt: Etwas ist über dich entstanden, und das steht darin. Nicht:
 * bei wem.
 *
 * Das ist kein Versehen, sondern die Gegenrichtung derselben Regel,
 * die den Betrieb keinen Namen sehen lässt. Wer aufdecken will, tut
 * es ausdrücklich — und beidseitig.
 *
 * ── Warum es niemand geschickt bekommt ──────────────────────────
 *
 * Es steht in den Einstellungen und wartet dort. Eine Benachrichtigung
 * „Du wurdest vorgeschlagen" wäre eine Nachricht über etwas, das noch
 * gar nicht passiert ist — und würde eine Erwartung wecken, die
 * niemand eingelöst hat.
 */

export interface Vorauswahlzeile {
  /** 0–100. `null` heisst: nicht ermittelbar. */
  passung: number | null;
  offenePunkte: string[];
  freigegebeneNachweise: string[];
  am: Date;
}

export interface Vorauswahlstand {
  anzahl: number;
  zeilen: Vorauswahlzeile[];
}

/**
 * Die eigenen Zeilen.
 *
 * Gelesen unter der Kennung der Person, damit die Richtlinie
 * `bedarfstreffer_person` greift und nicht die Mitgliedsregel. Wer
 * hier mit Systemrechten läse, bekäme alle Zeilen aller Betriebe —
 * und der Zeilenschutz stünde nur noch im Kommentar.
 */
export async function eigeneVorauswahlen(userId: string, grenze = 10): Promise<Vorauswahlstand> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({
        passung: schema.bedarfstreffer.passung,
        offenePunkte: schema.bedarfstreffer.offenePunkte,
        freigegebeneNachweise: schema.bedarfstreffer.freigegebeneNachweise,
        am: schema.bedarfstreffer.erstelltAm,
      })
      .from(schema.bedarfstreffer)
      .where(eq(schema.bedarfstreffer.userId, userId))
      .orderBy(desc(schema.bedarfstreffer.erstelltAm))
      .limit(grenze),
  ).catch(() => []);

  return {
    anzahl: zeilen.length,
    zeilen: zeilen.map((z) => ({
      passung: z.passung,
      offenePunkte: z.offenePunkte ?? [],
      freigegebeneNachweise: z.freigegebeneNachweise ?? [],
      am: z.am,
    })),
  };
}
