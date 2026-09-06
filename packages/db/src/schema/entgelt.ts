import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Amtliche Entgeltwerte, an die Berufskennung gebunden.
 *
 * ── Warum es diese Tabelle gibt ───────────────────────────────
 *
 * `beruf_entgelt` führt die Referenzwerte des Entgeltatlas über den
 * BERUFSNAMEN, die Stellen tragen die KldB-Kennung. Der
 * Gehaltsvergleich suchte deshalb über den Stellentitel — und
 * Titelabgleich ist bei deutschen Berufsnamen unzuverlässig:
 * gemessen die Hälfte ohne Treffer, darunter grobe Fehlgriffe.
 *
 * `beruf_schluessel` verbindet beides, und zwar exakt: 1.926 von
 * 1.926 Entgeltnamen stehen dort wortgleich, weil beide Tabellen von
 * derselben Quelle stammen. Kein Textabgleich, kein Raten.
 */
export const entgeltKldb = pgTable("entgelt_kldb", {
  /** Der fünfstellige KldB-2010-Code. */
  kldb: text("kldb").primaryKey(),
  beruf: text("beruf").notNull(),
  q1: integer("q1"),
  /** Median-Bruttojahresentgelt in Euro. */
  median: integer("median").notNull(),
  q3: integer("q3"),
  /**
   * Auf wie vielen sozialversicherungspflichtig Beschäftigten der
   * Wert beruht. Gehört an jede Anzeige: 7.352 ist etwas anderes
   * als 88.508.
   */
  besetzung: integer("besetzung"),
  quelle: text("quelle").notNull(),
  stand: timestamp("stand", { withTimezone: true }).notNull(),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
});
