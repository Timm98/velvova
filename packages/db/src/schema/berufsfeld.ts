import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Offene Stellen je Berufsfeld, vorberechnet.
 *
 * `group by left(kldb, 2)` über 2,2 Mio. Zeilen kostet zwei Minuten
 * und bricht in die Zeitgrenze der Datenbank. Im Seitenaufruf hat das
 * die Stellenseite unbenutzbar gemacht — dieselbe Sorte Fehler, die
 * dort schon einmal ein 500 verursacht hat.
 */
export const berufsfeldBestand = pgTable(
  "berufsfeld_bestand",
  {
    land: text("land").notNull(),
    /** Die zweistellige KldB-Berufshauptgruppe. */
    gruppe: text("gruppe").notNull(),
    anzahl: integer("anzahl").notNull(),
    berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.land, t.gruppe] })],
);
