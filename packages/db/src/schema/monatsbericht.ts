import { boolean, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, users } from "./identity.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Monatsbericht
 * ══════════════════════════════════════════════════════════════════
 *
 * Siehe Migration 0113. Zwei Tabellen: was eingeschaltet ist, und was
 * gelaufen ist.
 */

/**
 * Aus, bis jemand es einschaltet.
 *
 * Ein Bericht, den ein Betrieb nicht bestellt hat, ist Werbung — auch
 * wenn er stimmt.
 */
export const monatsberichtEinstellungen = pgTable("monatsbericht_einstellungen", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  aktiv: boolean("aktiv").notNull().default(false),
  /** UTC wäre am Monatsersten um 00:30 Ortszeit der falsche Monat. */
  zeitzone: text("zeitzone").notNull().default("Europe/Berlin"),
  /** Leer heisst: niemand — der Bericht liegt nur in der Anwendung. */
  empfaenger: jsonb("empfaenger").$type<string[]>().notNull().default([]),
  /** Ändert er sich, ist der Vergleich mit dem Vormonat ausgesetzt. */
  umfang: text("umfang").notNull().default("alle_vorgaenge"),
  zustaendig: text("zustaendig"),
  aktiviertAm: timestamp("aktiviert_am", { withTimezone: true }),
  aktiviertVon: uuid("aktiviert_von").references(() => users.id, { onDelete: "set null" }),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
});

export const monatsberichte = pgTable(
  "monatsberichte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Der erste Tag des Berichtsmonats, in der Zeitzone der Einstellung. */
    berichtsmonat: date("berichtsmonat").notNull(),
    zeitzone: text("zeitzone").notNull().default("Europe/Berlin"),
    umfang: text("umfang").notNull().default("alle_vorgaenge"),

    /** `monatslauf` · `manuell` */
    art: text("art").notNull().default("monatslauf"),
    laufKennung: text("lauf_kennung").notNull(),

    /** `laeuft` · `fertig` · `abgebrochen` */
    zustand: text("zustand").notNull().default("laeuft"),
    begonnenAm: timestamp("begonnen_am", { withTimezone: true }).notNull().defaultNow(),
    fertigAm: timestamp("fertig_am", { withTimezone: true }),
    fehler: text("fehler"),

    /**
     * Der Stand zum Berichtszeitpunkt.
     *
     * Der nächste Monat vergleicht gegen diese Zeile, nicht gegen den
     * heutigen Bestand — sonst schriebe eine spätere Änderung die
     * Vergangenheit um.
     */
    staende: jsonb("staende").$type<unknown[]>().notNull().default([]),
    veraenderungen: jsonb("veraenderungen").$type<unknown[]>().notNull().default([]),

    /** `stand` · `kein_neuer_stand` */
    lage: text("lage").notNull().default("kein_neuer_stand"),
    grund: text("grund"),

    /** Getrennt vom Fertigwerden. Fertig heisst nicht versandt. */
    versandtAm: timestamp("versandt_am", { withTimezone: true }),
  },
  (t) => [
    /*
     * Der Riegel gegen den doppelten Auslöser.
     *
     * Nur für `monatslauf`: Manuelle Analysen dürfen mehrfach im
     * selben Monat stehen, sie sind etwas anderes als der Bericht.
     */
    uniqueIndex("monatsberichte_ein_lauf_idx")
      .on(t.organizationId, t.berichtsmonat)
      .where(sql`art = 'monatslauf'`),
    index("monatsberichte_organisation_idx").on(t.organizationId, t.berichtsmonat),
  ],
);
