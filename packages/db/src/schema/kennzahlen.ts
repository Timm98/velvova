import { bigint, date, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

/**
 * Wechselkurse gegen den Euro.
 *
 * ══════════════════════════════════════════════════════════════
 * Wofür sie da sind
 * ══════════════════════════════════════════════════════════════
 *
 * Damit ein ausgeschriebenes Gehalt aus Zürich neben einem deutschen
 * einzuordnen ist. Umgerechnet wird ein BETRAG, den ein Arbeitgeber
 * genannt hat — nicht ein Lohnniveau.
 *
 * Der Unterschied ist in `lib/landeslage.ts` ausführlich begründet:
 * Aus einem deutschen Beispielgehalt per Kurs ein schweizerisches zu
 * machen, wäre eine Aussage über den Schweizer Arbeitsmarkt, die
 * niemand geprüft hat. Löhne folgen keinem Wechselkurs. Ein
 * ausgeschriebener Betrag schon.
 *
 * ── Warum eine Tabelle ──────────────────────────────────────
 *
 * Im Arbeitsspeicher hätte jede Serverinstanz ihren eigenen Kurs.
 * Zwei Besucher sähen dieselbe Stelle mit verschiedenen Beträgen, je
 * nachdem wer antwortet — und beim Neuladen änderte sich die Zahl
 * ohne Anlass.
 *
 * ── Zwei Zeitpunkte, mit Absicht ────────────────────────────
 *
 * `stand` ist der Tag, für den die Quelle den Kurs nennt; `geholtAm`
 * der Zeitpunkt unseres Abrufs. Die EZB veröffentlicht an Werktagen
 * gegen 16 Uhr — am Sonntag ist der frischeste Kurs zwei Tage alt.
 * Das ist kein Fehler, aber es soll dastehen können.
 *
 * Keine Nutzerdaten, deshalb keine RLS-Zeile.
 */
export const wechselkurse = pgTable("wechselkurse", {
  /** ISO-4217, drei Grossbuchstaben. */
  waehrung: text("waehrung").primaryKey(),
  /**
   * Wie viele Einheiten dieser Währung ein Euro kostet.
   *
   * `USD 1.1622` heisst: 1 EUR = 1,1622 USD. So veröffentlicht die
   * EZB, und so bleibt es — jede andere Umrechnung läuft über EUR als
   * Zwischenschritt. Kreuzkurse selbst zu bilden hiesse, zwei
   * Rundungen zu einer zusammenzufassen und das Ergebnis für genauer
   * zu halten, als es ist.
   *
   * `numeric` als Zeichenkette gelesen: Eine Gleitkommazahl über den
   * Treiber zu holen verliert Stellen, die in der Datenbank stehen.
   */
  kurs: numeric("kurs", { precision: 18, scale: 6 }).notNull(),
  stand: date("stand").notNull(),
  quelle: text("quelle").notNull().default("ecb"),
  geholtAm: timestamp("geholt_am", { withTimezone: true }).notNull().defaultNow(),
});
