import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import type { PlanKey, PremiumMerkmal } from "./plaene.ts";

/**
 * Wer darf was.
 *
 * Eine Stelle, an der die Frage beantwortet wird — nicht eine pro
 * Seite. Verstreute Prüfungen waren der Grund, warum vorher halbe
 * Seiten gesperrt waren, ohne dass jemand das so entschieden hätte.
 *
 * Die Voreinstellung ist grosszügig: ohne Abo gilt `free`, und `free`
 * ist ein vollständiges kleines Produkt. Fällt die Datenbank aus, gilt
 * ebenfalls `free` — niemand verliert Zugang, weil eine Abfrage
 * scheitert. Der umgekehrte Fehler wäre schlimmer: jemand sähe eine
 * Sperre, für die er bezahlt hat.
 */

export interface Zugang {
  plan: PlanKey;
  /** Läuft ein bezahlter Zeitraum noch, obwohl gekündigt wurde? */
  laeuftAus: Date | null;
  darf: (merkmal: PremiumMerkmal) => boolean;
}

const NUR_PREMIUM: PremiumMerkmal[] = [
  "tiefe_jobanalyse",
  "unbegrenzte_jobs",
  "live_gespraech",
  "alle_sprachen",
  "ausfuehrliche_unterlagen",
  "bewerbungsbegleitung",
];

export const zugangFür = cache(async function zugangFür(userId: string): Promise<Zugang> {
  let plan: PlanKey = "free";
  let laeuftAus: Date | null = null;

  try {
    const db = await getDb();
    const [abo] = await withUser(db, userId, (tx) =>
      tx
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, userId))
        .limit(1),
    );

    /*
     * Bezahlt ist, wer ein aktives Abo hat UND dessen Zeitraum noch
     * läuft. Ein gekündigtes Abo bleibt bis zum Ende des bezahlten
     * Zeitraums gültig — wer bis zum 30. bezahlt hat, wird nicht am 3.
     * ausgesperrt.
     */
    if (abo && (abo.status === "active" || abo.status === "trialing")) {
      const endet = abo.currentPeriodEnd;
      if (!endet || endet.getTime() > Date.now()) {
        plan = abo.plan;
        laeuftAus = abo.cancelAtPeriodEnd ? endet : null;
      }
    }
  } catch {
    // Siehe oben: im Zweifel free, nicht gesperrt.
  }

  return {
    plan,
    laeuftAus,
    darf: (merkmal) => plan === "premium" || !NUR_PREMIUM.includes(merkmal),
  };
});
