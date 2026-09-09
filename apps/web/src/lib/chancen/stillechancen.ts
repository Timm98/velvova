import { and, desc, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import type { Chancenart, Initiativlage, Sicherheit } from "@paycheck/domain";

/**
 * Die stillen Chancen eines Menschen, für die Anzeige.
 *
 * ── Warum beide Zahlen mitkommen ────────────────────────────────
 *
 * `punkte` sagt, wie gut es passt. `belegdichte` sagt, worauf das
 * beruht. Eine 90 aus einem Datenpunkt ist keine 90, und die
 * Oberfläche darf sie nicht wie eine zeigen — deshalb reicht diese
 * Funktion nie die eine ohne die andere weiter.
 */
export interface StilleChance {
  id: string;
  arbeitgeber: string;
  art: Chancenart;
  punkte: number | null;
  belegdichte: number | null;
  initiativlage: Initiativlage;
  sicherheit: Sicherheit;
  karriereseiteUrl: string | null;
  karriereseiteGeprueftAm: Date | null;
  belege: { aussage: string; quelle: string; standAm: string }[];
  kanaele: { art: string; ziel: string; belegUrl: string }[];
  bestaetigteRolle: string | null;
  erwarteterZeitraum: string | null;
}

/**
 * Laden — und den Fehler abfangen, solange die Tabelle fehlt.
 *
 * Die Migration läuft nicht beim Deploy. Bis sie durch ist, gibt es
 * keine stillen Chancen; das ist ein leerer Abschnitt und kein
 * Ausfall der ganzen Seite.
 */
export async function stilleChancenLaden(userId: string): Promise<StilleChance[]> {
  try {
    const db = await getDb();
    const zeilen = await withUser(db, userId, (tx) =>
      tx
        .select({
          id: schema.arbeitgeberChancen.id,
          arbeitgeber: schema.companies.name,
          art: schema.arbeitgeberChancen.art,
          punkte: schema.arbeitgeberChancen.punkte,
          belegdichte: schema.arbeitgeberChancen.belegdichte,
          initiativlage: schema.arbeitgeberChancen.initiativlage,
          sicherheit: schema.arbeitgeberChancen.sicherheit,
          karriereseiteUrl: schema.arbeitgeberChancen.karriereseiteUrl,
          karriereseiteGeprueftAm: schema.arbeitgeberChancen.karriereseiteGeprueftAm,
          belege: schema.arbeitgeberChancen.belege,
          kanaele: schema.arbeitgeberChancen.kanaele,
          bestaetigteRolle: schema.arbeitgeberChancen.bestaetigteRolle,
          erwarteterZeitraum: schema.arbeitgeberChancen.erwarteterZeitraum,
        })
        .from(schema.arbeitgeberChancen)
        .innerJoin(
          schema.companies,
          eq(schema.companies.id, schema.arbeitgeberChancen.companyId),
        )
        .where(
          and(
            eq(schema.arbeitgeberChancen.userId, userId),
            eq(schema.arbeitgeberChancen.vomNutzerAusgeschlossen, false),
          ),
        )
        /*
         * Bestätigtes zuerst, dann nach Punkten.
         *
         * Was der Arbeitgeber selbst gesagt hat, steht über allem, was
         * wir aus früheren Anzeigen geschlossen haben — unabhängig von
         * der Punktzahl.
         */
        .orderBy(desc(schema.arbeitgeberChancen.bestaetigtAm), desc(schema.arbeitgeberChancen.punkte))
        .limit(20),
    );

    return zeilen.map((z) => ({
      ...z,
      art: z.art as Chancenart,
      initiativlage: z.initiativlage as Initiativlage,
      sicherheit: z.sicherheit as Sicherheit,
      belegdichte: z.belegdichte === null ? null : Number(z.belegdichte),
    }));
  } catch (fehler) {
    console.warn("[chancen] nicht geladen:", (fehler as Error).message);
    return [];
  }
}
