import { desc, gte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Die Zahlen für das Band auf der Startseite.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum genau diese vier
 * ══════════════════════════════════════════════════════════════
 *
 * Weil es die vier sind, die wir zählen können.
 *
 * Die Vorlage zeigt an dieser Stelle sechs Zahlen: Besucher im Monat,
 * zufriedene App-Nutzer, Jahre am Markt. Solche Zahlen ständen hier
 * als Behauptung — wir messen keine Besucher, es gibt keine App, und
 * das Produkt ist nicht zwanzig Jahre alt.
 *
 * Deshalb nur, was in der Datenbank steht und was ein Besucher
 * nachprüfen kann:
 *
 *   Stellen   →  dieselbe Zahl, die die Suche zeigt
 *   Länder    →  jedes mit `?land=XX` nachzählbar
 *   Quellen   →  jede Anzeige nennt ihre Herkunft
 *   Neu       →  aus dem stündlichen Verlauf, nicht geschätzt
 *
 * Vier ehrliche Zahlen tragen weiter als sechs schöne. Wer eine davon
 * nachrechnet und sie stimmt, glaubt auch der fünften — und wer eine
 * erfundene findet, glaubt keiner mehr.
 */
export type Kennzahl = {
  /** Die Zahl selbst, für `aria-label` und Auszeichnung. */
  wert: number;
  /** Fertig gesetzt, mit Tausenderpunkten. */
  text: string;
  /** Was sie bedeutet — eine Zeile, kein Werbesatz. */
  bedeutung: string;
};

export type Kennzahlenband = Kennzahl[];

export async function kennzahlenband(): Promise<Kennzahlenband> {
  const db = await getDb();

  const [gesamt, laender, quellen, verlauf] = await Promise.all([
    /* Die Gesamtzeile trägt den leeren Quellenschlüssel. */
    db
      .select({ aktiv: schema.bestandskennzahlen.aktiv })
      .from(schema.bestandskennzahlen)
      .where(sql`${schema.bestandskennzahlen.quelle} = ''`)
      .limit(1)
      .catch(() => []),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.laenderbestand)
      .where(gte(schema.laenderbestand.stellen, 1))
      .catch(() => []),

    /* Ohne die Gesamtzeile — die ist keine Quelle. */
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.bestandskennzahlen)
      .where(ne(schema.bestandskennzahlen.quelle, ""))
      .catch(() => []),

    /*
     * Zwei Punkte aus dem Verlauf: der neueste und der letzte, der
     * mindestens 24 Stunden zurückliegt. Die Differenz ist der
     * Zuwachs eines Tages.
     *
     * `limit 2` mit einer Bedingung statt zweier Abfragen: Der
     * Verlauf ist nach Zeit indiziert, und zwei Zeilen zu lesen
     * kostet nichts.
     */
    db
      .select({
        stellen: schema.bestandsverlauf.stellen,
        stand: schema.bestandsverlauf.gemessenAm,
      })
      .from(schema.bestandsverlauf)
      .orderBy(desc(schema.bestandsverlauf.gemessenAm))
      .limit(48)
      .catch(() => []),
  ]);

  const band: Kennzahlenband = [];
  const setzen = (n: number) => n.toLocaleString("de-DE");

  const stellen = Number(gesamt[0]?.aktiv ?? 0);
  if (stellen > 0) {
    band.push({
      wert: stellen,
      text: setzen(stellen),
      bedeutung: "aktive Stellen im Bestand",
    });
  }

  const laenderzahl = Number(laender[0]?.n ?? 0);
  if (laenderzahl > 0) {
    band.push({
      wert: laenderzahl,
      text: setzen(laenderzahl),
      bedeutung: "Länder mit Stellen — jedes einzeln durchsuchbar",
    });
  }

  const quellenzahl = Number(quellen[0]?.n ?? 0);
  if (quellenzahl > 0) {
    band.push({
      wert: quellenzahl,
      text: setzen(quellenzahl),
      bedeutung: "Quellen, jede an der Anzeige genannt",
    });
  }

  /*
   * Der Zuwachs eines Tages.
   *
   * Nur, wenn der Verlauf wirklich 24 Stunden zurückreicht und die
   * Zahl gestiegen ist. Ein negativer Wert wäre kein Fehler — der
   * Bestand sinkt, wenn Anzeigen ablaufen —, aber „−4.812 neue
   * Stellen" ist keine Aussage, die hierher gehört.
   */
  const jetzt = verlauf[0];
  const gestern = verlauf.find(
    (z) => jetzt && jetzt.stand.getTime() - z.stand.getTime() >= 23 * 60 * 60 * 1000,
  );
  if (jetzt && gestern) {
    const zuwachs = Number(jetzt.stellen) - Number(gestern.stellen);
    if (zuwachs > 0) {
      band.push({
        wert: zuwachs,
        text: setzen(zuwachs),
        bedeutung: "neue Stellen in den letzten 24 Stunden",
      });
    }
  }

  return band;
}
