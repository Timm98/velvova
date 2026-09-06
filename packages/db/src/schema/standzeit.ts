import { doublePrecision, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Wie lange eine Stelle je Berufsgruppe üblicherweise steht.
 *
 * Gemessen im eigenen Bestand: Der Median reicht von 25 Tagen
 * (Informatik) bis 108 Tagen (Hoch- und Tiefbau). Eine absolute Grenze
 * wäre wertlos — sie würde jede Baustelle als auffällig melden und
 * jede IT-Stelle durchlassen, die seit einem halben Jahr steht.
 *
 * Keine Nutzerdaten, deshalb keine RLS-Zeile: Das sind Auszählungen
 * über den öffentlichen Stellenbestand.
 */
export const standzeitReferenz = pgTable("standzeit_referenz", {
  /** Die ersten zwei Stellen der KldB — die Berufshauptgruppe. */
  gruppe: text("gruppe").primaryKey(),
  stellen: integer("stellen").notNull(),
  medianTage: doublePrecision("median_tage").notNull(),
  p90Tage: doublePrecision("p90_tage").notNull(),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
});
