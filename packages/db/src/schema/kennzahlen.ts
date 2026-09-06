import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Vorberechnete Bestandszahlen für die Stellenseite.
 *
 * ── Warum vorberechnet ────────────────────────────────────────
 *
 * Die Seite rechnete sie bei jedem Aufruf: `count(*)`,
 * `count(distinct content_hash)` und ein gefiltertes `count(*)` über
 * `jobs`. Der Kommentar dort nahm das Wachstum vorweg — „bei tausend
 * Zeilen ist das egal, bei hunderttausend nicht" — und bei 1,58 Mio.
 * unter laufendem Import bricht die Abfrage in die Zeitgrenze. Die
 * Stellenseite antwortete mit 500.
 *
 * ── Warum mit Zeitpunkt ───────────────────────────────────────
 *
 * `berechnet_am` steht dabei, damit die Zahl sagen kann, wie alt sie
 * ist. Eine Zahl von vor einer Stunde, die sich als solche zu
 * erkennen gibt, ist ehrlicher als eine tagesaktuelle, auf die
 * niemand warten kann.
 *
 * Keine Nutzerdaten, deshalb keine RLS-Zeile.
 */
export const bestandskennzahlen = pgTable("bestandskennzahlen", {
  /** Der Quellenschlüssel. Die Gesamtzeile trägt den leeren Text. */
  quelle: text("quelle").primaryKey(),
  roh: bigint("roh", { mode: "number" }).notNull().default(0),
  eindeutig: bigint("eindeutig", { mode: "number" }).notNull().default(0),
  aktiv: bigint("aktiv", { mode: "number" }).notNull().default(0),
  zuletztGeholt: timestamp("zuletzt_geholt", { withTimezone: true }),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Stellen je Land — für das Länderraster im Fuss.
 *
 * ── Warum eine eigene Tabelle ─────────────────────────────────
 *
 * Das Raster steht auf jeder Seite. `select country, count(*) from
 * jobs group by country` über 2,4 Mio. Zeilen bei jedem Aufruf ist
 * genau der Fehler, der die Stellenseite schon einmal auf 500 gesetzt
 * hat — und diesmal stünde er im Fuss, also überall.
 *
 * ── Warum überhaupt Zahlen ────────────────────────────────────
 *
 * Ein Länderraster ohne Zahlen ist Dekoration: neunzehn Fähnchen, die
 * behaupten, wir seien international. Mit Zahlen ist es eine Auskunft
 * — und eine überprüfbare, denn dieselbe Zahl liefert die Suche mit
 * `?land=XX`. Deshalb wird gezählt, was tatsächlich da ist, und keine
 * Länder aufgeführt, in denen wir nichts haben.
 */
export const laenderbestand = pgTable("laenderbestand", {
  /** ISO-3166-1 alpha-2, gross geschrieben. */
  land: text("land").primaryKey(),
  stellen: bigint("stellen", { mode: "number" }).notNull().default(0),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Der Verlauf des Bestands — stündlich fortgeschrieben.
 *
 * ── Warum eine eigene Tabelle ─────────────────────────────────
 *
 * „Seit gestern 4.812 neue Stellen" lässt sich aus dem aktuellen
 * Bestand nicht ableiten. Man braucht den Wert von gestern, und den
 * kennt nur, wer ihn aufgeschrieben hat.
 *
 * Der naheliegende Weg wäre gewesen, `fetched_at > now() - 24h` zu
 * zählen. Das ist eine Vollzählung über 2,5 Mio. Zeilen ohne
 * passenden Index — dieselbe Falle, die die Stellenseite schon
 * zweimal auf 500 gesetzt hat. Und es zählt das Falsche: Anzeigen
 * verschwinden auch wieder, der Bestand ist die Differenz aus beidem.
 *
 * Eine Zeile je Stunde kostet 8.760 Zeilen im Jahr. Das ist billiger
 * als jede Abfrage, die dasselbe ausrechnen wollte.
 */
export const bestandsverlauf = pgTable("bestandsverlauf", {
  gemessenAm: timestamp("gemessen_am", { withTimezone: true }).primaryKey().defaultNow(),
  stellen: bigint("stellen", { mode: "number" }).notNull(),
  laender: bigint("laender", { mode: "number" }).notNull().default(0),
  quellen: bigint("quellen", { mode: "number" }).notNull().default(0),
});
