import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.ts";

/**
 * Was Monday über einen Menschen zusammengetragen hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine Ableitung ist und keine Quelle
 * ══════════════════════════════════════════════════════════════
 *
 * Die Belege stehen in `evidence_items`. Diese Tabelle hält nur das
 * Ergebnis ihrer Auswertung — und darf jederzeit verworfen und neu
 * gerechnet werden.
 *
 * Der Unterschied ist wichtig: Wer hier etwas ändert, ändert eine
 * Zusammenfassung. Wer die Belege ändert, ändert, was über einen
 * Menschen bekannt ist. Das eine ist Technik, das andere seine Sache.
 */
export const profilSynthesen = pgTable(
  "profil_synthesen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** profilsynthese · karriereanalyse */
    art: text("art").notNull(),
    ergebnis: jsonb("ergebnis").$type<Record<string, unknown>>().notNull(),
    /**
     * Welche Belege eingeflossen sind, als Fingerabdruck.
     *
     * Ändert sich die Menge, ist die Synthese veraltet — und das
     * lässt sich vergleichen, statt es an einem Zeitstempel zu raten.
     * „Vor zwei Tagen gerechnet" sagt nichts darüber, ob sich seither
     * etwas geändert hat.
     */
    belegStand: text("beleg_stand").notNull(),
    belegAnzahl: integer("beleg_anzahl").notNull(),
    modell: text("modell").notNull(),
    promptFassung: text("prompt_fassung").notNull(),
    konfidenz: doublePrecision("konfidenz").notNull(),
    /** Nur gesetzt, wenn eine zweite Meinung eingeholt wurde. */
    zweitmodell: text("zweitmodell"),
    zweitErgebnis: jsonb("zweit_ergebnis").$type<Record<string, unknown> | null>(),
    einig: boolean("einig"),
    abweichungen: jsonb("abweichungen").$type<unknown[]>().notNull().default([]),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profil_synthesen_user_idx").on(t.userId, t.art, t.erstelltAm)],
);

/**
 * Offene Fragen und erkannte Widersprüche.
 *
 * ── Warum getrennt von der Synthese ───────────────────────────
 *
 * Sie haben einen anderen Lebenszyklus. Eine Frage ist beantwortet
 * oder nicht; ein Widerspruch aufgelöst oder nicht. Beides ändert
 * sich durch eine Antwort der Person — nicht durch einen neuen
 * Modelllauf.
 *
 * Läge beides zusammen, würde eine frische Synthese die
 * Gesprächsgeschichte überschreiben.
 */
export const profilKlaerungen = pgTable(
  "profil_klaerungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** frage · widerspruch */
    art: text("art").notNull(),
    schluessel: text("schluessel").notNull(),
    frage: text("frage").notNull(),
    grund: text("grund"),
    belege: jsonb("belege").$type<string[]>().notNull().default([]),
    staerke: doublePrecision("staerke"),
    /** offen · beantwortet · uebergangen */
    zustand: text("zustand").notNull().default("offen"),
    /**
     * Die Antwort als Beleg-ID, nicht als Text.
     *
     * Der Text steht in `evidence_items`, wo er hingehört: mit
     * Quelle, Konfidenz und der Möglichkeit, ihn zu widerrufen. Ihn
     * hier zu kopieren ergäbe eine zweite Fassung derselben Aussage.
     */
    antwortBeleg: uuid("antwort_beleg"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    entschiedenAm: timestamp("entschieden_am", { withTimezone: true }),
  },
  (t) => [
    /* Zweimal dieselbe offene Frage ist keine Nachfrage, sondern ein Fehler. */
    uniqueIndex("profil_klaerungen_offen_unique")
      .on(t.userId, t.art, t.schluessel)
      .where(sql`${t.zustand} = 'offen'`),
    index("profil_klaerungen_user_idx").on(t.userId, t.zustand, t.erstelltAm),
  ],
);

/* ═══════════════════════════════════════════════════════════════
   Der Hintergrundlauf
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ein Anspruch auf ein Profil — und was daraus wurde.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Zeile und kein Advisory Lock
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Synthese liegt zwischen zwei Transaktionen: laden, Modell
 * fragen, schreiben. Ein Advisory Lock müsste über diese Sekunden auf
 * DERSELBEN Verbindung gehalten werden — mit einem Verbindungspool
 * ist das nicht garantiert, und der Fehlschlag wäre lautlos.
 *
 * Diese Zeile überlebt einen Neustart, sie ist lesbar, und sie
 * beantwortet nebenbei die Frage, die man sonst nicht beantworten
 * kann: Was hat der Hintergrund gestern getan, und was ist dabei
 * schiefgegangen.
 *
 * ── Was hier ausdrücklich nicht hineingehört ──────────────────
 *
 * Die Modellmeldung im Wortlaut. Sie kann Teile des Prompts
 * enthalten, und der Prompt enthält, was die Person über sich gesagt
 * hat. Ein Betriebsprotokoll ist der falsche Ort dafür — deshalb nur
 * die Fehlerklasse.
 */
export const profilLaeufe = pgTable(
  "profil_laeufe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** profilsynthese · karriereanalyse */
    art: text("art").notNull(),
    /** erste_analyse · genug_neues · zu_lange_her · wichtiges_ereignis · ausdruecklich */
    anlass: text("anlass").notNull(),
    /** laeuft · fertig · fehler · abgebrochen · uebersprungen */
    zustand: text("zustand").notNull().default("laeuft"),
    /**
     * Der wievielte Versuch.
     *
     * Nach drei Fehlschlägen in Folge ruht das Profil. Ein Modell, das
     * dreimal nacheinander nicht antwortet, antwortet auch beim
     * vierten Mal nicht — und der Versuch kostet jedes Mal Geld.
     */
    versuch: integer("versuch").notNull().default(1),
    modell: text("modell"),
    modellaufrufe: integer("modellaufrufe").notNull().default(0),
    /** Die Fehlerklasse, nicht die Meldung. */
    fehler: text("fehler"),
    begonnenAm: timestamp("begonnen_am", { withTimezone: true }).notNull().defaultNow(),
    beendetAm: timestamp("beendet_am", { withTimezone: true }),
  },
  (t) => [
    /*
     * Höchstens ein laufender Anspruch je Profil und Art.
     *
     * Zwei Arbeiter, die dasselbe Profil greifen, bezahlten zweimal
     * das tiefe Modell für denselben Belegstand. Der zweite bekommt
     * hier eine Verletzung des Index und geht weiter.
     */
    uniqueIndex("profil_laeufe_laeuft_unique")
      .on(t.userId, t.art)
      .where(sql`${t.zustand} = 'laeuft'`),
    index("profil_laeufe_user_idx").on(t.userId, t.art, t.begonnenAm),
    index("profil_laeufe_zustand_idx").on(t.zustand, t.begonnenAm),
  ],
);
