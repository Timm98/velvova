import { date, index, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Die ISCO-08-Berufsgruppen mit Zukunftsbewertung.
 *
 * ── Was das ist ───────────────────────────────────────────────
 *
 * 436 Unit Groups der internationalen Berufsklassifikation der ILO,
 * in zehn Hauptgruppen. Jeder Beruf weltweit gehört genau einer an.
 * Dazu je Gruppe eine Einschätzung zur Zukunft bis 2035.
 *
 * ── Was es NICHT ist ──────────────────────────────────────────
 *
 * Keine Messwerte. Die Quelle sagt es selbst: „synthetisierte
 * Einschätzung auf Basis der genannten Studien". Sie stützt sich auf
 * WEF Future of Jobs 2025, US BLS Projections 2024–2034, Stanford
 * „Canaries in the Coal Mine", ILO GenAI-Index und Eloundou et al.
 *
 * Deshalb tragen `quelle` und `stand` in dieser Tabelle, und deshalb
 * muss beides überall erscheinen, wo eine dieser Zahlen gezeigt wird.
 * Eine Einschätzung, die wie eine Messung aussieht, ist genau die
 * Sorte unbelegter Aussage, gegen die dieses Produkt gebaut ist.
 */
export const iscoBerufe = pgTable(
  "isco_berufe",
  {
    /** Der vierstellige ISCO-08-Code der Unit Group. */
    code: text("code").primaryKey(),
    hauptgruppe: text("hauptgruppe").notNull(),
    hauptgruppeNummer: smallint("hauptgruppe_nummer").notNull(),
    berufDe: text("beruf_de").notNull(),
    berufEn: text("beruf_en").notNull(),
    /** Über 1.300 konkrete Bezeichnungen — der Weg vom Titel zur Gruppe. */
    beispielberufe: text("beispielberufe").notNull().default(""),
    qualifikationsniveau: text("qualifikationsniveau"),
    /** 1 = stark gefährdet … 5 = sehr sicher. */
    zukunftssicherheit: smallint("zukunftssicherheit"),
    kiExposition: text("ki_exposition"),
    automatisierungsart: text("automatisierungsart"),
    nachfrage: text("nachfrage"),
    lohnaussicht: text("lohnaussicht"),
    haupttreiber: text("haupttreiber"),
    plus: text("plus"),
    kontra: text("kontra"),
    langzeit: text("langzeit"),
    kernargument: text("kernargument"),
    empfehlung: text("empfehlung"),
    quelle: text("quelle").notNull(),
    stand: date("stand").notNull(),
    importiertAm: timestamp("importiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("isco_berufe_hauptgruppe_idx").on(t.hauptgruppeNummer)],
);
