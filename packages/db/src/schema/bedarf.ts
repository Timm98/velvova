import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.ts";
import { angebote } from "./angebote.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Bedarfsdiagnose — vier Tabellen für sechs Ebenen
 * ══════════════════════════════════════════════════════════════════
 *
 * `bedarfsebenen.ts` und `befundlage.ts` rechnen; hier steht, was sie
 * gerechnet haben. Ohne diese Tabellen überlebt kein Befund eine
 * Sitzung — und was eine Sitzung nicht überlebt, lässt sich weder
 * prüfen noch widerrufen noch einen Monat später vergleichen.
 *
 * Siehe Migration 0112.
 */

export const bedarfsvorgaenge = pgTable(
  "bedarfsvorgaenge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    angelegtVon: uuid("angelegt_von").references(() => users.id, { onDelete: "set null" }),

    titel: text("titel").notNull(),
    /** Der Satz, mit dem alles anfing. Unverändert, als Beleg. */
    ausgangslage: text("ausgangslage").notNull(),

    /** Eine aus `EBENEN`. Nur diese Zeile trägt sie. */
    ebene: text("ebene").notNull().default("beduerfnis"),

    /**
     * Einer aus `LOESUNGSWEGE`.
     *
     * `null` heisst noch nicht gewählt — und das ist etwas anderes als
     * „keine Lösung nötig", was als `erst_messen` oder
     * `vorerst_beobachten` dasteht.
     */
    weg: text("weg"),

    /** Ein Name, kein Flag: „freigegeben" ohne Person ist keine Freigabe. */
    freigabeVon: text("freigabe_von"),
    freigabeAm: timestamp("freigabe_am", { withTimezone: true }),

    /**
     * Die Verbindung zum Angebot, falls eines daraus wurde.
     *
     * Bleibt meistens leer: Die häufigste richtige Antwort auf ein
     * bestätigtes Problem ist keine neue Stelle.
     */
    angebotId: uuid("angebot_id").references(() => angebote.id, { onDelete: "set null" }),

    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bedarfsvorgaenge_organisation_idx").on(t.organizationId, t.ebene, t.erstelltAm)],
);

export const bedarfsquellen = pgTable(
  "bedarfsquellen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vorgangId: uuid("vorgang_id")
      .notNull()
      .references(() => bedarfsvorgaenge.id, { onDelete: "cascade" }),

    art: text("art").notNull(),
    eigentuemer: text("eigentuemer").notNull(),
    /** Einer aus `ZWECKE`. Ein Zweck deckt keinen anderen. */
    zweck: text("zweck"),
    zeitraum: text("zeitraum"),
    alterTage: integer("alter_tage"),
    sichtbarFuer: jsonb("sichtbar_fuer").$type<string[]>().notNull().default([]),

    /* Die drei getrennten Voraussetzungen — siehe `quellenfreigabe.ts`. */
    technischVerbunden: boolean("technisch_verbunden").notNull().default(false),
    betrieblichBerechtigt: boolean("betrieblich_berechtigt").notNull().default(false),
    rechtsgrundlage: text("rechtsgrundlage"),

    aufVorgangsebene: boolean("auf_vorgangsebene").notNull().default(true),

    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bedarfsquellen_vorgang_idx").on(t.vorgangId)],
);

export const bedarfsbefunde = pgTable(
  "bedarfsbefunde",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vorgangId: uuid("vorgang_id")
      .notNull()
      .references(() => bedarfsvorgaenge.id, { onDelete: "cascade" }),

    /** Was beobachtet wurde. Keine Ursache, kein Urteil. */
    beobachtung: text("beobachtung").notNull(),

    /**
     * Die Quellen als Kennungsfeld statt als Verbundtabelle.
     *
     * Der Preis steht in der Migration: Die Datenbank prüft diese
     * Verweise nicht. Das Lesen filtert tote Kennungen heraus.
     */
    quellenIds: uuid("quellen_ids").array().notNull().default([]),

    alternativen: jsonb("alternativen").$type<string[]>().notNull().default([]),
    gegenbelege: jsonb("gegenbelege").$type<string[]>().notNull().default([]),
    gegenbelegeGeprueft: boolean("gegenbelege_geprueft").notNull().default(false),
    vomUnternehmenBestaetigt: boolean("vom_unternehmen_bestaetigt").notNull().default(false),

    /**
     * `bestaetigt` · `hypothese` · `verworfen` · `kein_befund`
     *
     * Beim Schreiben aus `befundPruefen()` gerechnet und
     * mitgespeichert — damit ein später geänderter Massstab einen
     * früheren Bericht nicht still umschreibt.
     */
    stand: text("stand").notNull().default("kein_befund"),

    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bedarfsbefunde_vorgang_idx").on(t.vorgangId, t.stand)],
);

/**
 * Jeder versuchte Aufstieg — auch der abgelehnte.
 *
 * Nur die gelungenen aufzuzeichnen hiesse, eine Geschichte zu führen,
 * in der nie etwas gefehlt hat. Der Grund einer Ablehnung ist die
 * nützlichste Zeile im ganzen Vorgang: Er sagt, was zu besorgen ist.
 */
export const bedarfsschritte = pgTable(
  "bedarfsschritte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vorgangId: uuid("vorgang_id")
      .notNull()
      .references(() => bedarfsvorgaenge.id, { onDelete: "cascade" }),
    wer: uuid("wer").references(() => users.id, { onDelete: "set null" }),

    vonEbene: text("von_ebene").notNull(),
    nachEbene: text("nach_ebene").notNull(),
    erlaubt: boolean("erlaubt").notNull(),
    grund: text("grund"),

    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bedarfsschritte_vorgang_idx").on(t.vorgangId, t.erstelltAm)],
);

/**
 * Die Verbindung zwischen freigegebenem Bedarf und einem Menschen.
 *
 * ── Warum die Person diese Zeile nicht liest ────────────────────
 *
 * Der Zeilenschutz hängt allein an `organizationId`. Es ist eine
 * interne Vorschau: Sie löst keine Nachricht aus, und der Mensch
 * erfährt von ihr nichts — weil es noch nichts zu erfahren gibt.
 * Dieselbe Bauart wie `postingCandidates`, aus demselben Grund.
 *
 * Die Kehrseite gehört dazu: Solange das so ist, gibt es keine
 * Ansicht, in der ein Mensch nachsieht, wem er vorgeschlagen wurde.
 * Eine Schuld, kein Entwurf. Siehe Migration 0114.
 */
export const bedarfstreffer = pgTable(
  "bedarfstreffer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vorgangId: uuid("vorgang_id")
      .notNull()
      .references(() => bedarfsvorgaenge.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** 0–100. `null` heisst nicht ermittelbar — etwas anderes als null Punkte. */
    passung: integer("passung"),
    /** 0–1. Ohne sie ist die Passung eine Zahl ohne Aussage. */
    abdeckung: real("abdeckung"),

    bedingungen: jsonb("bedingungen").$type<unknown[]>().notNull().default([]),
    offenePunkte: jsonb("offene_punkte").$type<string[]>().notNull().default([]),
    freigegebeneNachweise: jsonb("freigegebene_nachweise").$type<string[]>().notNull().default([]),

    /** Der Fingerabdruck der Stände, aus denen der Vorschlag entstand. */
    grundlage: text("grundlage").notNull(),

    /** `vorschau` · `angefragt` · `zurueckgezogen` */
    zustand: text("zustand").notNull().default("vorschau"),

    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Ein zweiter Lauf aktualisiert, er verdoppelt nicht. */
    uniqueIndex("bedarfstreffer_paar_idx").on(t.vorgangId, t.userId),
    index("bedarfstreffer_organisation_idx").on(t.organizationId, t.vorgangId),
  ],
);
