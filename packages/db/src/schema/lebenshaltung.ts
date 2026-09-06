import { boolean, date, doublePrecision, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { salaryPeriodEnum, workModelEnum } from "./enums.ts";
import { users } from "./identity.ts";

/**
 * Monatliche Kosten und die aktuelle Stelle.
 *
 * ── Warum eigene Tabellen ─────────────────────────────────────
 *
 * Diese Angaben sind privat in einem anderen Sinn als der Rest des
 * Profils. Wer schreibt, was er für Miete zahlt, teilt etwas mit, das
 * in keiner Bewerbung auftaucht, keinen Arbeitgeber etwas angeht und
 * nicht in einen Modellkontext gehört.
 *
 * Am Karriereprofil hätten sie deshalb nichts verloren: Von dort
 * fliessen Angaben in Lebensläufe, in Ninas Begründungen und in die
 * Suchrichtungen. Eine Miete, die versehentlich in einem Anschreiben
 * landet, ist ein Schaden, den keine Korrektur zurückholt.
 *
 * Getrennte Tabellen machen diese Grenze zu einer Eigenschaft des
 * Schemas statt zu einer Regel, an die sich jemand erinnern muss.
 */

/**
 * Was im Monat fest weggeht.
 *
 * Alle Felder sind NULLABLE, und das ist der Kern: `null` heisst „nicht
 * angegeben", `0` heisst „gibt es nicht". Ohne diesen Unterschied lässt
 * sich nicht sagen, wie vollständig eine Rechnung ist — und eine
 * unvollständige Rechnung, die vollständig aussieht, ist schlimmer als
 * gar keine.
 */
export const livingCosts = pgTable("living_costs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  wohnen: integer("wohnen"),
  energie: integer("energie"),
  versicherungen: integer("versicherungen"),
  mobilitaet: integer("mobilitaet"),
  lebensmittel: integer("lebensmittel"),
  kredite: integer("kredite"),
  abos: integer("abos"),
  kinder: integer("kinder"),
  freizeit: integer("freizeit"),
  sparen: integer("sparen"),
  sonstiges: integer("sonstiges"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Die aktuelle Stelle — als Seite, gegen die verglichen wird.
 *
 * Ohne sie ist „lohnt sich der Wechsel" nicht beantwortbar: Man kann
 * die neue Stelle ausrechnen und hat nichts, wogegen man sie hält.
 *
 * `commuteMinutes` wird vom Menschen genannt und nicht gerechnet. Es
 * gibt keinen Routingdienst, und eine geschätzte Fahrzeit wäre hier
 * besonders teuer: Sie ginge direkt in eine Differenz ein, nach der
 * jemand eine Entscheidung trifft.
 */
export const currentEmployment = pgTable("current_employment", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  jobTitle: text("job_title"),
  companyName: text("company_name"),
  grossAmount: integer("gross_amount"),
  currency: text("currency").notNull().default("EUR"),
  salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("year"),
  workModel: workModelEnum("work_model"),
  /*
   * Ohne die Wochenstunden gibt es keinen Stundenwert.
   *
   * Und der ist die einzige Zahl, die zwei Stellen fair vergleicht:
   * Mehr Gehalt bei mehr Stunden und längerem Weg kann je aufgewendeter
   * Stunde weniger sein. Im Jahresgehalt ist das unsichtbar.
   */
  weeklyHours: integer("weekly_hours"),
  officeDaysPerWeek: integer("office_days_per_week"),
  commuteMinutes: integer("commute_minutes"),
  commuteCostMonth: integer("commute_cost_month"),
  startedAt: date("started_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});


/**
 * Zwischenspeicher für Orte und Wege.
 *
 * Geocoding und Routing sind fremde Dienste mit Nutzungsgrenzen. Ohne
 * Zwischenspeicher stellte jede Jobseite dieselbe Anfrage erneut — bei
 * 563 verschiedenen Ortsangaben wäre das sowohl unhöflich als auch
 * langsam.
 *
 * Gespeichert wird nur, was ohnehin öffentlich ist: die Koordinate zu
 * einem Ortsnamen, die Fahrzeit zwischen zwei Koordinaten. Keine
 * Nutzerkennung — deshalb steht hier auch keine Zeilensicherheit.
 */
export const geoOrte = pgTable("geo_orte", {
  /** Kleingeschrieben, ohne doppelte Leerzeichen. */
  abfrage: text("abfrage").primaryKey(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  anzeigename: text("anzeigename"),
  /** Auch Misserfolge werden vermerkt — sonst wird „Germany" ewig neu gesucht. */
  gefunden: boolean("gefunden").notNull().default(false),
  gefragtAm: timestamp("gefragt_am", { withTimezone: true }).notNull().defaultNow(),
});

export const geoWege = pgTable("geo_wege", {
  /** Beide Koordinaten auf drei Nachkommastellen plus Modus. */
  schluessel: text("schluessel").primaryKey(),
  modus: text("modus").notNull(),
  minuten: integer("minuten"),
  kilometer: doublePrecision("kilometer"),
  gefunden: boolean("gefunden").notNull().default(false),
  gefragtAm: timestamp("gefragt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Amtliche Berufsbezeichnung zu einem Stellentitel.
 *
 * Der Zwischenspeicher für die Übersetzung „Vertriebsinnendienst
 * (m/w/d)" → „Kaufmann/-frau - Büromanagement". Aufgelöst wird sie von
 * der offenen Jobsuche-Schnittstelle der Bundesagentur; ohne diesen
 * Speicher wäre das ein fremder Aufruf je Stellenaufruf.
 *
 * `beruf = null` heisst „gefragt, nichts gefunden" — auch das wird
 * vermerkt, damit derselbe Titel nicht ewig neu aufgelöst wird.
 */
export const berufZuordnung = pgTable("beruf_zuordnung", {
  /** Normalisiert: kleingeschrieben, ohne Geschlechtszusatz. */
  titel: text("titel").primaryKey(),
  beruf: text("beruf"),
  /** Wie eindeutig die Zuordnung war: Treffer dieser Bezeichnung von wie vielen. */
  treffer: integer("treffer").notNull().default(0),
  gesamt: integer("gesamt").notNull().default(0),
  gefragtAm: timestamp("gefragt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Entgelt-Referenz je amtlichem Beruf.
 *
 * Quartile über viele reale Gehaltsangaben — keine Anzeige, sondern
 * deren Auswertung. `quelle` und `stand` stehen dabei, weil eine Zahl
 * ohne Herkunft und Datum keine Auskunft ist.
 */
export const berufEntgelt = pgTable("beruf_entgelt", {
  beruf: text("beruf").primaryKey(),
  /*
   * Euro je Jahr. Quartile dürfen fehlen, der Median nicht.
   *
   * Der Entgeltatlas weist für manche Berufsgattungen einen echten
   * Median aus und lässt ein Quartil offen. Siehe Migration 0040 für
   * die Begründung, warum hier kein `notNull()` mehr steht.
   */
  q1: integer("q1"),
  median: integer("median").notNull(),
  q3: integer("q3"),
  anzahl: integer("anzahl").notNull(),
  /**
   * Wie viele Beschäftigte hinter einem amtlichen Median stehen.
   *
   * Nicht dasselbe wie `anzahl`: Dort steht bei eigenen Werten die
   * Zahl der Anzeigen. Beim Atlas sind es Beschäftigte der
   * Beschäftigungsstatistik — ein Median über 40 ist etwas anderes
   * als einer über 40.000.
   */
  besetzung: integer("besetzung"),
  /** true, wenn der Median an der Beitragsbemessungsgrenze liegt und damit abgeschnitten ist. */
  abgeschnitten: boolean("abgeschnitten").notNull().default(false),
  /** 'bundesagentur' oder 'entgeltatlas'. */
  quelle: text("quelle").notNull(),
  stand: timestamp("stand", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Der amtliche Berufsschlüssel zu einer Berufsbezeichnung.
 *
 * Der Entgeltatlas fragt nach der Berufsgattung („43414"), nicht nach
 * dem Namen. Übersetzen kann nur er selbst — eine öffentliche
 * Umschlüsselung gibt es nicht. Das Ergebnis wird deshalb behalten; es
 * ändert sich mit der Klassifikation der Berufe, also praktisch nie.
 */
export const berufSchluessel = pgTable("beruf_schluessel", {
  beruf: text("beruf").primaryKey(),
  /** `null` heisst: gefragt, nichts gefunden. */
  schluessel: text("schluessel"),
  gefragtAm: timestamp("gefragt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Der Wortschatz amtlicher Berufsbezeichnungen.
 *
 * Die Suchbegriffe für die Jobbörse. Sie stammten bisher aus dem
 * eigenen Bestand — ein Zirkelschluss, der die Abdeckung auf 573.662
 * von 999.398 Anzeigen begrenzte. Geerntet werden sie aus `hauptberuf`
 * und `alleBerufe` der Anzeigen selbst; siehe Migration 0035.
 */
export const berufWortschatz = pgTable("beruf_wortschatz", {
  beruf: text("beruf").primaryKey(),
  /** 'jobboerse' oder 'kldb'. */
  quelle: text("quelle").notNull().default("jobboerse"),
  vorkommen: integer("vorkommen").notNull().default(1),
  /** Wie viele Anzeigen die Jobbörse dazu kennt. `null` = ungefragt. */
  anzeigen: integer("anzeigen"),
  /**
   * Wann dieser Begriff zuletzt für einen Import verwendet wurde.
   *
   * Ohne diesen Vermerk begann jeder Lauf wieder am Anfang des
   * Wortschatzes und holte, was längst da war: gemessen 12 neue
   * Stellen aus 3.000. Siehe Migration 0039.
   */
  zuletztGeholt: timestamp("zuletzt_geholt", { withTimezone: true }),
  gefundenAm: timestamp("gefunden_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Arbeitgeber-Boards: gefunden und nicht gefunden.
 *
 * Greenhouse, Ashby, SmartRecruiters und Personio führen je Arbeitgeber
 * ein offenes Stellenverzeichnis, aber kein Verzeichnis der Kennungen.
 * Die wird aus dem Firmennamen geraten; gemessene Trefferquote 4 %.
 *
 * Auch Misserfolge stehen hier — sonst wiederholte jeder Lauf dieselben
 * zehntausend Fehlversuche. Siehe Migration 0036.
 */
export const arbeitgeberBoards = pgTable(
  "arbeitgeber_boards",
  {
    anbieter: text("anbieter").notNull(),
    kennung: text("kennung").notNull(),
    /** Der Firmenname, aus dem die Kennung entstand. */
    firma: text("firma").notNull(),
    gefunden: boolean("gefunden").notNull().default(false),
    stellen: integer("stellen").notNull().default(0),
    gefragtAm: timestamp("gefragt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.anbieter, t.kennung] })],
);
