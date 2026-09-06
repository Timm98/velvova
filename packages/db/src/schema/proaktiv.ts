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
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";
import { suchAuftraege } from "./suchauftrag.ts";

/**
 * Was Nina beobachtet, was sie daraus vermutet, und was sie getan hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Tabellen, weil es drei verschiedene Dinge sind
 * ══════════════════════════════════════════════════════════════
 *
 *   nutzer_ereignisse    was geschehen ist        — Tatsache
 *   verhaltenssignale    was Nina daraus liest    — Vermutung
 *   nina_handlungen      was Nina getan hat       — Rechenschaft
 *
 * Sie zusammenzulegen wäre bequemer und würde genau die Grenze
 * verwischen, auf die es ankommt: Ein Klick ist nachprüfbar, eine
 * Deutung nicht.
 */

/* ═══════════════════════════════════════════════════════════════
   Was geschehen ist
   ═══════════════════════════════════════════════════════════════ */

export const nutzerEreignisse = pgTable(
  "nutzer_ereignisse",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Eine der Arten aus `EREIGNISARTEN`. Unbekanntes wird abgewiesen. */
    art: text("art").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    auftragId: uuid("auftrag_id").references(() => suchAuftraege.id, { onDelete: "set null" }),
    /** Damit „in derselben Sitzung" beantwortbar ist. Rotiert mit der Sitzung. */
    sitzungId: text("sitzung_id"),
    geschehenAm: timestamp("geschehen_am", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Zahlen und kurze Kennungen.
     *
     * ── Was hier ausdrücklich nicht hineingehört ──────────────
     *
     * Freie Texte der Person, Suchbegriffe im Wortlaut, Inhalte von
     * Formularfeldern. Ein Ereignisstrom wächst schnell und wird
     * selten gelesen — er ist der schlechteste Ort für alles, was
     * jemand über sich preisgibt.
     *
     * Und keine Mausbewegungen, keine Tippgeschwindigkeit. Daraus
     * liessen sich Persönlichkeitsvermutungen bauen, und dafür hat
     * uns niemand ein Mandat gegeben.
     */
    kontext: jsonb("kontext").$type<Record<string, string | number | boolean>>().notNull().default({}),
    /** app · voice */
    quelle: text("quelle").notNull().default("app"),
    /**
     * Wer es ausgelöst hat: `user` · `nina` · `system`.
     *
     * ══════════════════════════════════════════════════════════
     * Der Kreis, den dieses Feld verhindert
     * ══════════════════════════════════════════════════════════
     *
     * Nina merkt eine Stelle vor, weil sie Interesse vermutet. Würde
     * daraus ein Ereignis entstehen, das wie eine Nutzerhandlung
     * aussieht, bestätigte Nina ihre eigene Vermutung — beim nächsten
     * Lauf stärker, beim übernächsten noch stärker.
     *
     * Am Ende stünde ein sehr starkes Signal da, dessen Belege
     * ausschliesslich Ninas eigene Handlungen sind. Von aussen sähe
     * das aus wie ein Mensch mit klarem Interesse.
     *
     * Nur `user` verstärkt ein Verhaltenssignal.
     */
    urheber: text("urheber").notNull().default("user"),
    /**
     * Der Schlüssel gegen Doppelmeldungen.
     *
     * Zwei offene Tabs senden dasselbe Ereignis zweimal. Ohne diesen
     * Schlüssel würde daraus ein „mehrfach geöffnet", und Nina merkte
     * eine Stelle vor, die niemand zweimal angesehen hat.
     */
    ereignisSchluessel: text("ereignis_schluessel").notNull(),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("nutzer_ereignisse_unique").on(t.userId, t.ereignisSchluessel),
    index("nutzer_ereignisse_job_idx").on(t.userId, t.jobId, t.geschehenAm),
    index("nutzer_ereignisse_zeit_idx").on(t.userId, t.geschehenAm),
  ],
);

/* ═══════════════════════════════════════════════════════════════
   Was Nina daraus liest
   ═══════════════════════════════════════════════════════════════ */

export const verhaltenssignale = pgTable(
  "verhaltenssignale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** interesse_an_stelle · gehalt_wichtig · remote_interesse · … */
    art: text("art").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    /** 0 bis 1 — eine Ordnung, keine Wahrscheinlichkeit. */
    staerke: doublePrecision("staerke").notNull(),
    /**
     * Die Ereignisse, auf die sich das Signal beruft.
     *
     * Ohne sie könnte Nina nur behaupten. Mit ihnen kann sie sagen
     * „du hast diese Stelle dreimal geöffnet" — und die Person kann
     * widersprechen, ohne gegen eine unbelegte Behauptung anzureden.
     */
    belege: jsonb("belege").$type<string[]>().notNull().default([]),
    /** Als Beobachtung formuliert, nie als Diagnose. */
    beobachtung: text("beobachtung").notNull(),
    /**
     * inferred · confirmed · rejected
     *
     * `inferred` ändert nie von selbst ein bestätigtes Suchprofil.
     * Der Weg zu `confirmed` führt ausschliesslich über eine Antwort
     * der Person.
     */
    status: text("status").notNull().default("inferred"),
    /**
     * Wann die Vermutung verfällt.
     *
     * Interesse von vor drei Wochen ist kein Interesse von heute. Ein
     * System, das das nicht vergisst, hält Menschen an ihrer
     * Vergangenheit fest.
     */
    gueltigBis: timestamp("gueltig_bis", { withTimezone: true }).notNull(),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("verhaltenssignale_unique").on(t.userId, t.art, t.jobId),
    index("verhaltenssignale_offen_idx").on(t.userId, t.status, t.gueltigBis),
  ],
);

/* ═══════════════════════════════════════════════════════════════
   Was Nina getan hat
   ═══════════════════════════════════════════════════════════════ */

export const ninaHandlungen = pgTable(
  "nina_handlungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Ein Schlüssel aus `HANDLUNGEN`. */
    handlung: text("handlung").notNull(),
    /** auto_allowed · propose_first · explicit_only */
    klasse: text("klasse").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    auftragId: uuid("auftrag_id").references(() => suchAuftraege.id, { onDelete: "set null" }),
    /** In der Sprache der Person — die Antwort auf „warum hat Nina das gemacht?“ */
    begruendung: text("begruendung").notNull(),
    belegEreignisse: jsonb("beleg_ereignisse").$type<string[]>().notNull().default([]),
    /**
     * Nach welcher Regeltabelle gehandelt wurde.
     *
     * Ohne sie liesse sich später nicht sagen, was damals erlaubt war
     * — und „warum hat Nina das gemacht" wäre nicht mehr beantwortbar,
     * sobald jemand die Tabelle ändert.
     */
    policyFassung: text("policy_fassung").notNull(),
    /**
     * vorgeschlagen · ausgefuehrt · zugestimmt · abgelehnt · rueckgaengig
     *
     * `vorgeschlagen` und `ausgefuehrt` schliessen sich aus: Was
     * Zustimmung braucht, ist nicht getan, bis sie da ist.
     */
    zustand: text("zustand").notNull(),
    /** Die kurze Nachricht im Chat. `null` heisst: still ausgeführt. */
    nachricht: text("nachricht"),
    /**
     * Was die Handlung hervorgebracht hat.
     *
     * Ein vorbereiteter Vergleich, eine Liste offener Fragen. Am
     * Eintrag geführt und nicht in einer eigenen Tabelle: Wer die
     * Handlung zurücknimmt, nimmt damit auch ihr Ergebnis zurück —
     * ohne dass jemand daran denken muss.
     */
    ergebnis: jsonb("ergebnis").$type<Record<string, unknown> | null>(),
    /**
     * Wann Nina die Nachricht tatsächlich gesagt hat.
     *
     * `erstelltAm` sagt, wann sie etwas zu sagen hatte; dieses Feld,
     * wann sie es gesagt hat. Zwischen beidem können Stunden liegen —
     * die Handlung geschieht sofort, das Reden erst, wenn jemand
     * hinsieht.
     *
     * Im Server geführt und nicht im Browser: Sonst käme dieselbe
     * Nachricht auf einem zweiten Gerät noch einmal, und die
     * Sprachausgabe wüsste nichts von dem, was der Chat schon gesagt
     * hat.
     */
    gezeigtAm: timestamp("gezeigt_am", { withTimezone: true }),
    /** Bis wann sich die Handlung zurücknehmen lässt. `null` heisst: dauerhaft. */
    rueckgaengigBis: timestamp("rueckgaengig_bis", { withTimezone: true }),
    /** Warum die Person abgelehnt hat, falls sie es gesagt hat. */
    ablehnungsgrund: text("ablehnungsgrund"),
    /**
     * Woran die Handlung hängt, wenn nicht an einer Stelle.
     *
     * Die Entdopplung fragte nach Handlungsart und Stelle. Eine
     * Klärung aus der Intelligenzschicht hat keine Stelle — sie hängt
     * an einer Aussage oder an einem Wissensfeld. Ohne diese Spalte
     * wären zwei verschiedene Widersprüche für die Entdopplung
     * dasselbe, und der zweite käme nie zur Sprache.
     */
    schluessel: text("schluessel"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    entschiedenAm: timestamp("entschieden_am", { withTimezone: true }),
  },
  (t) => [
    index("nina_handlungen_user_idx").on(t.userId, t.erstelltAm),
    index("nina_handlungen_zustand_idx").on(t.userId, t.zustand, t.erstelltAm),
    index("nina_handlungen_job_idx").on(t.userId, t.jobId),
    index("nina_handlungen_schluessel_idx").on(t.userId, t.schluessel),
  ],
);

/* ═══════════════════════════════════════════════════════════════
   Ninas Vormerkung
   ═══════════════════════════════════════════════════════════════ */

/**
 * Was Nina vermutet — getrennt von dem, was die Person gesagt hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht in `saved_jobs` gehört
 * ══════════════════════════════════════════════════════════════
 *
 * „Gespeichert" bedeutet in Velvova: Ich will diese Stelle bewusst
 * behalten. Das ist eine Aussage der Person über sich selbst, und
 * Nina kann sie nicht an ihrer Stelle treffen.
 *
 * Und `match_feedback` hält bereits, was die Person ausdrücklich
 * gesagt hat — interessiert, abgelehnt, später, beworben. Ninas
 * Vermutung dort hineinzuschreiben hiesse, eine Vermutung als Aussage
 * der Person zu führen.
 *
 * Deshalb eine eigene Tabelle mit einem eigenen Wort in der
 * Oberfläche: „Von Nina vorgemerkt", nicht „Gespeichert".
 */
export const ninaVormerkungen = pgTable(
  "nina_vormerkungen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    /** interessant · zu_klaeren */
    art: text("art").notNull().default("interessant"),
    /** Die Handlung, aus der die Vormerkung entstand. */
    handlungId: uuid("handlung_id").references(() => ninaHandlungen.id, { onDelete: "set null" }),
    begruendung: text("begruendung").notNull(),
    /** offen · behalten · verworfen — die Antwort der Person. */
    zustand: text("zustand").notNull().default("offen"),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
    entschiedenAm: timestamp("entschieden_am", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("nina_vormerkungen_unique").on(t.userId, t.jobId, t.art),
    index("nina_vormerkungen_offen_idx").on(t.userId, t.zustand),
  ],
);

/* ═══════════════════════════════════════════════════════════════
   Was die Person erlaubt
   ═══════════════════════════════════════════════════════════════ */

export const ninaEigeninitiative = pgTable("nina_eigeninitiative", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * zurueckhaltend · ausgeglichen · proaktiv
   *
   * Ändert die Häufigkeit, nicht die Berechtigung. Wer beides
   * vermischt, baut eine Einstellung, mit der sich Sicherheitsregeln
   * abschalten lassen.
   */
  stufe: text("stufe").notNull().default("ausgeglichen"),
  /**
   * Einzeln abgeschaltete automatische Handlungen.
   *
   * Eine Liste dessen, was NICHT erlaubt ist — nicht dessen, was
   * erlaubt ist. So wirkt eine neue Handlung sofort, statt bei jedem
   * Bestandsnutzer als stillschweigend abgeschaltet zu gelten.
   */
  abgeschaltet: jsonb("abgeschaltet").$type<string[]>().notNull().default([]),
  /** Wann Nina zuletzt von sich aus etwas gesagt hat. */
  letzteNachrichtAm: timestamp("letzte_nachricht_am", { withTimezone: true }),
  /** Wie viele proaktive Hinweise in der laufenden Sitzung schon kamen. */
  inSitzung: integer("in_sitzung").notNull().default(0),
  sitzungId: text("sitzung_id"),
  /** Ob die Person proaktive Hinweise ganz abgeschaltet hat. */
  aktiv: boolean("aktiv").notNull().default(true),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
});
