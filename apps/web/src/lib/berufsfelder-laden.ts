import { getDb, schema, withSystem } from "@paycheck/db";
import { desc, eq } from "drizzle-orm";
import { berufsfeldName } from "@paycheck/domain";

/**
 * Die Berufsfelder mit den meisten offenen Stellen.
 *
 * ── Warum aus einer vorberechneten Tabelle ────────────────────
 *
 * Ich habe es zuerst direkt gezählt — `group by left(kldb, 2)` über
 * 2,2 Mio. Zeilen. Gemessen: 120 Sekunden, dann die Zeitgrenze der
 * Datenbank. Die Stellenseite war damit unbenutzbar, und zwar
 * derselbe Fehler, den ich heute schon einmal auf genau dieser Seite
 * behoben hatte.
 *
 * Eine Aggregation über den ganzen Bestand gehört nie in einen
 * Seitenaufruf. `scripts/berufsfelder-zaehlen.mjs` rechnet sie im
 * Pflegelauf; hier steht ein Nachschlag über 36 Zeilen.
 *
 * ── Warum eine leere Liste kein Fehler ist ────────────────────
 *
 * Ist die Auszählung noch nie gelaufen, steht der Abschnitt nicht da.
 * Das ist besser als eine erfundene Reihenfolge — und es fällt auf,
 * weil ein ganzer Bereich fehlt.
 */
export interface Berufsfeld {
  kldb: string;
  name: string;
  anzahl: number;
}

export async function beliebteBerufsfelder(land = "DE", grenze = 10): Promise<Berufsfeld[]> {
  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx
      .select()
      .from(schema.berufsfeldBestand)
      .where(eq(schema.berufsfeldBestand.land, land))
      .orderBy(desc(schema.berufsfeldBestand.anzahl))
      .limit(20),
  ).catch(() => []);

  return zeilen
    .map((z) => ({ kldb: z.gruppe, name: berufsfeldName(z.gruppe) ?? "", anzahl: z.anzahl }))
    /* Ohne Namen keine Kachel — eine Zahl neben „51" sagt niemandem etwas. */
    .filter((z) => z.name !== "")
    .slice(0, grenze);
}
