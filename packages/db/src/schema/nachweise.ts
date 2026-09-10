import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Nachweise — was jemand nachweislich getan hat
 * ══════════════════════════════════════════════════════════════════
 *
 * Teilbare Kompetenznachweise erhöhten in einem randomisierten
 * Feldexperiment die Beschäftigungswahrscheinlichkeit um 5,2
 * Prozentpunkte; rein privates Feedback bewirkte nichts. „Monday hält
 * dich für geeignet" ist deshalb wertlos — ein Zeugnis, das ein Mensch
 * weitergeben kann, ist es nicht.
 *
 * ── Was diese Tabelle NICHT hat ────────────────────────────────
 *
 * Keine Spalte für Versuche, keine für Misserfolge, keine Punktzahl,
 * kein Gesamturteil.
 *
 * Ein misslungener Versuch hinterlässt keine Spur. Der Grund ist nicht
 * Freundlichkeit, sondern Brauchbarkeit: Ein System, in dem Üben
 * aktenkundig wird, ist ein System, in dem niemand übt. Und eine
 * gespeicherte Misserfolgsquote wäre die verdeckte Negativliste, die
 * ein Kompetenznachweis nie werden darf.
 *
 * `wirdFestgehalten()` in `@paycheck/domain` hält die Regel; das
 * Schema stützt sie. Was es nicht gibt, lässt sich auch nicht
 * versehentlich schreiben.
 */
export const nachweise = pgTable(
  "nachweise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Welche Tätigkeit geprüft wurde. */
    taetigkeit: text("taetigkeit").notNull(),
    /** Was konkret bearbeitet wurde. */
    aufgabe: text("aufgabe").notNull(),
    /**
     * Unter welchen Bedingungen: Zeit, Hilfsmittel, Umgebung.
     *
     * Pflicht, weil das Ergebnis ohne sie nicht einzuordnen ist —
     * „hat alle vier gefunden" heisst etwas anderes mit
     * Nachschlagewerk als ohne.
     */
    bedingungen: text("bedingungen").notNull(),
    /** Was dabei herauskam, als Beobachtung statt als Urteil. */
    ergebnis: text("ergebnis").notNull(),
    /** Wer dafür einsteht. */
    aussteller: text("aussteller").notNull(),

    /**
     * Für welche Stelle der Nachweis entstand.
     *
     * `set null`: Ein Zeugnis überlebt die Anzeige, aus der seine
     * Aufgabe abgeleitet wurde — sonst verfiele es mit ihr.
     */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),

    ausgestelltAm: timestamp("ausgestellt_am", { withTimezone: true }).notNull().defaultNow(),
    /** Bis wann die Aussage trägt. `null` heisst unbefristet. */
    gueltigBis: timestamp("gueltig_bis", { withTimezone: true }),

    /**
     * Ob der Mensch ihn weitergegeben hat.
     *
     * Die Entscheidung gehört ihm, nicht dem System: Ein Nachweis, der
     * ungefragt sichtbar wird, ist kein Nachweis, sondern eine Akte.
     */
    geteilt: boolean("geteilt").notNull().default(false),
    geteiltAm: timestamp("geteilt_am", { withTimezone: true }),
  },
  (t) => [
    index("nachweise_person_idx").on(t.userId, t.ausgestelltAm),
    /* Ein Nachweis je Person und Tätigkeit. Zwei Zeugnisse über
       dieselbe Sache nebeneinander laden dazu ein, sich das
       günstigere auszusuchen. */
    uniqueIndex("nachweise_person_taetigkeit_unique").on(t.userId, sql`lower(${t.taetigkeit})`),
  ],
);
