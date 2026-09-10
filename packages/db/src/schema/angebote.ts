import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies } from "./jobs.ts";
import { organizations, users } from "./identity.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Angebote — eine Zahl, für die jemand geradesteht
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Unterschied zu `jobs` ist kein technischer, sondern der ganze
 * Punkt: Eine Anzeige beschreibt, was sich jemand vorgestellt hat. Ein
 * Angebot ist bindend, sobald beide Seiten aufdecken.
 *
 * Siehe Migration 0110.
 */
export const angebote = pgTable(
  "angebote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Der registrierte Arbeitgeber — und der Anker des Zeilenschutzes.
     *
     * Nicht `companyId`: Der Schutz dieser Anwendung kennt zwei Anker,
     * `user_id` und `organization_id`. Ein Angebot gehört keinem
     * einzelnen Menschen und auch nicht einem Eintrag im Stellenindex.
     */
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    /**
     * Die Verbindung zum Stellenindex, falls es eine gibt.
     *
     * Nullbar: Ein Betrieb, der noch nie eine Anzeige geschaltet hat,
     * steht dort nicht — und genau der ist die Zielgruppe.
     */
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    /** Ohne verifizierten Kontakt kein Angebot. */
    angelegtVon: uuid("angelegt_von").references(() => users.id, { onDelete: "set null" }),

    /** stelle · dauerbedarf · nachfolge · wunschprofil · vorvakanz */
    art: text("art").notNull().default("wunschprofil"),
    /** dashboard · sprachnachricht · kandidatenbrief · nachfolge_planer · insider · partner */
    herkunft: text("herkunft").notNull().default("dashboard"),
    /**
     * entwurf · aktiv · pausiert · abgelaufen · besetzt
     *
     * Startet auf `entwurf`. Aktiv wird ein Angebot nur über eine
     * eigene Route mit verifiziertem Firmenkontakt — ein Modell, das
     * ein Transkript verarbeitet, kann nichts verbindlich machen.
     */
    status: text("status").notNull().default("entwurf"),

    rollenprofil: jsonb("rollenprofil").$type<Record<string, unknown>>().notNull().default({}),
    konditionen: jsonb("konditionen").$type<Record<string, unknown>>().notNull().default({}),
    plaetze: integer("plaetze").notNull().default(1),
    startVon: date("start_von"),
    startBis: date("start_bis"),
    gueltigBis: date("gueltig_bis").notNull(),

    /** Was Kandidaten vor dem Aufdecken sehen. */
    anonymBeschreibung: text("anonym_beschreibung").notNull().default(""),
    erlaubteRueckfragen: jsonb("erlaubte_rueckfragen").$type<string[]>().notNull().default([]),

    offenePunkte: jsonb("offene_punkte").$type<string[]>().notNull().default([]),
    /** Gestrichene Wünsche mit Begründung. Nachweis nach AGG. */
    gestrichen: jsonb("gestrichen").$type<{ wunsch: string; grund: string }[]>().notNull().default([]),
    /** Anweisungen im Fremdtext, die als Daten behandelt wurden. */
    auffaelligkeiten: jsonb("auffaelligkeiten").$type<string[]>().notNull().default([]),

    /** Der Zeitpunkt ist der Beleg, nicht ein Flag. */
    verbindlichBestaetigtAm: timestamp("verbindlich_bestaetigt_am", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("angebote_firma_idx").on(t.companyId, t.status),
    index("angebote_organisation_idx").on(t.organizationId, t.status),
    index("angebote_aktiv_idx").on(t.status, t.gueltigBis),
  ],
);

/**
 * Was an einem Tag ausgeschrieben war — je Arbeitgeber, Beruf und Ort.
 *
 * ── Warum eine eigene Beobachtung ─────────────────────────────
 *
 * Echten Dauerbedarf erkennt man daran, dass derselbe Arbeitgeber
 * dieselbe Rolle am selben Ort wieder und wieder ausschreibt. Am
 * 10.09.2026 gemessen: Velvovas eigene Beobachtung (`job_source_links`)
 * reichte elf Tage zurück. Das `published_at` der Anzeigen kommt aus
 * dem Feed und sagt nichts darüber, ob NEU ausgeschrieben wurde.
 *
 * Jeder Tag ohne Aufzeichnung ist ein Tag Historie, der sich nicht
 * herstellen lässt.
 *
 * ── Warum der Ort dazugehört ──────────────────────────────────
 *
 * Ohne ihn ist ein Filialnetz von Dauerbedarf nicht zu unterscheiden:
 * Netto stand mit 9.140 Anzeigen für Verkauf an der Spitze, jede in
 * einer anderen Filiale. Dauerbedarf heisst dieselbe Rolle am SELBEN
 * Ort, immer wieder.
 *
 * Keine RLS: eine Auszählung über den öffentlichen Stellenbestand.
 */
export const bedarfsSchnappschuss = pgTable(
  "bedarfs_schnappschuss",
  {
    /** Der Tag der Beobachtung, nicht der Veröffentlichung. */
    tag: date("tag").notNull(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** Die ersten vier Stellen der KldB. */
    beruf: text("beruf").notNull(),
    ort: text("ort").notNull(),
    stellen: integer("stellen").notNull(),
  },
  (t) => [index("bedarfs_schnappschuss_paar_idx").on(t.companyId, t.beruf, t.ort, t.tag)],
);
