import {
  boolean,
  index,
  jsonb,
  numeric,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { companies } from "./jobs.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Stille Chancen — Arbeitgeber ohne passende Anzeige
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Entscheidungslogik steht in `@paycheck/domain`
 * (`stillechancen.ts`, `arbeitgeberpassung.ts`). Hier liegt nur, was
 * sie zwischen zwei Läufen braucht.
 *
 * ── Warum drei Tabellen und nicht zwei ──────────────────────────
 *
 * Die dritte ist die, die man beim ersten Entwurf vergisst:
 * `arbeitgeber_kontaktsperre` trägt keine Nutzerkennung. Wenn ein
 * Arbeitgeber schreibt „bitte nicht mehr kontaktieren", gilt das ihm
 * gegenüber — nicht gegenüber der einen Person, die zufällig gefragt
 * hat. Eine Sperre je Nutzer wäre aus seiner Sicht keine: Der nächste
 * Mensch schriebe morgen wieder.
 *
 * Gespeichert wird dabei die Tatsache, nicht der Wortlaut. Der gehört
 * dem Menschen, der die Antwort bekommen hat.
 */

/**
 * Ein passender Arbeitgeber ohne passende Anzeige, bezogen auf einen
 * Menschen.
 */
export const arbeitgeberChancen = pgTable(
  "arbeitgeber_chancen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

    /**
     * `stille_chance` oder `bestaetigte_moeglichkeit`.
     *
     * `oeffentliche_stelle` steht hier NICHT und darf es nie: Eine
     * ausgeschriebene Stelle ist ein Job und gehört in `jobs`. Sie hier
     * zuzulassen wäre der eine Weg, auf dem eine Vermutung und eine
     * Anzeige in derselben Liste landen.
     */
    art: text("art").notNull().default("stille_chance"),
    status: text("status").notNull().default("entdeckt"),

    /** Wie gut es passt, 0–100. Internes Rangsignal, keine Wahrheit. */
    punkte: integer("punkte"),
    /** Worauf die Punkte beruhen, 0–1. Gehört immer mit ausgegeben. */
    belegdichte: numeric("belegdichte", { precision: 3, scale: 2 }),

    initiativlage: text("initiativlage").notNull().default("unbekannt"),
    arbeitgeberart: text("arbeitgeberart").notNull().default("privat"),

    karriereseiteUrl: text("karriereseite_url"),
    karriereseiteGeprueftAm: timestamp("karriereseite_geprueft_am", { withTimezone: true }),

    /** Belegte Kontaktwege. Ohne Fundstelle wird ein Eintrag verworfen. */
    kanaele: jsonb("kanaele")
      .$type<{ art: string; ziel: string; belegUrl: string; geprueftAm: string }[]>()
      .notNull()
      .default([]),
    /** Warum diese Chance besteht — mit Quelle und Datum. */
    belege: jsonb("belege")
      .$type<{ aussage: string; quelle: string; standAm: string }[]>()
      .notNull()
      .default([]),

    sicherheit: text("sicherheit").notNull().default("niedrig"),

    /*
     * Was der Arbeitgeber selbst gesagt hat.
     *
     * Nur diese Felder dürfen `art` auf `bestaetigte_moeglichkeit`
     * heben. Keine Menge an Belegen und keine Punktzahl führt dorthin.
     */
    bestaetigtAm: timestamp("bestaetigt_am", { withTimezone: true }),
    bestaetigteRolle: text("bestaetigte_rolle"),
    erwarteterZeitraum: text("erwarteter_zeitraum"),

    vomNutzerAusgeschlossen: boolean("vom_nutzer_ausgeschlossen").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * Eine Chance je Mensch und Arbeitgeber.
     *
     * Ohne diese Regel entstehen bei jedem Suchlauf neue Zeilen für
     * denselben Arbeitgeber, und die Abkühlfrist findet die vorherige
     * nicht mehr — der Duplikatschutz hinge dann an der Sorgfalt des
     * Aufrufers statt an der Datenbank.
     */
    uniqueIndex("arbeitgeber_chancen_person_firma_unique").on(t.userId, t.companyId),
    index("arbeitgeber_chancen_person_idx").on(t.userId, t.punkte),
  ],
);

/** Was tatsächlich hinausgegangen ist. */
export const arbeitgeberKontakte = pgTable(
  "arbeitgeber_kontakte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    chanceId: uuid("chance_id").references(() => arbeitgeberChancen.id, { onDelete: "set null" }),

    anfrageart: text("anfrageart").notNull(),
    kanalArt: text("kanal_art").notNull(),
    kanalZiel: text("kanal_ziel").notNull(),
    /** Wo dieser Weg stand. Pflicht, damit nachvollziehbar bleibt, warum. */
    kanalBelegUrl: text("kanal_beleg_url").notNull(),

    /**
     * `pending` | `freigegeben` | `laeuft` | `zugestellt` |
     * `fehlgeschlagen` | `unklar`
     *
     * `unklar` ist kein Zwischenzustand, sondern ein Ergebnis: Der
     * Versand ging hinaus und die Bestätigung ging verloren. Wer
     * diesen Fall als `fehlgeschlagen` führt, sendet erneut — und der
     * Arbeitgeber bekommt dieselbe Anfrage zweimal.
     */
    status: text("status").notNull().default("pending"),

    /**
     * Der Schutz gegen doppelten Versand — in der Datenbank, nicht im
     * Aufrufer. Ein Wiederholungsversuch mit demselben Schlüssel legt
     * keine zweite Zeile an.
     */
    idempotenzSchluessel: text("idempotenz_schluessel").notNull(),

    /**
     * Der Text selbst steht NICHT hier.
     *
     * Er gehört zum Entwurf, den der Mensch freigegeben hat, und ist
     * dort auch löschbar. Hier steht sein Fingerabdruck — genug, um zu
     * prüfen, ob nach der Freigabe noch etwas geändert wurde, und zu
     * wenig, um ein zweites Archiv persönlicher Texte zu sein.
     */
    nachrichtHash: text("nachricht_hash").notNull(),

    gesendetAm: timestamp("gesendet_am", { withTimezone: true }),
    antwortAm: timestamp("antwort_am", { withTimezone: true }),
    /** Die Einordnung der Antwort. Nicht ihr Wortlaut. */
    antwortart: text("antwortart"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("arbeitgeber_kontakte_idempotenz_unique").on(t.idempotenzSchluessel),
    index("arbeitgeber_kontakte_person_firma_idx").on(t.userId, t.companyId, t.createdAt),
  ],
);

/**
 * Wer nicht mehr angeschrieben werden will.
 *
 * Ohne Nutzerkennung, ohne Wortlaut, ohne Nachricht — siehe Kopf
 * dieser Datei. Die Sperre schützt den Arbeitgeber und darf dafür
 * nicht offenlegen, wer ihn angeschrieben hat.
 */
export const arbeitgeberKontaktsperre = pgTable("arbeitgeber_kontaktsperre", {
  companyId: uuid("company_id")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  /** `arbeitgeber_wunsch` | `zustellung_dauerhaft_fehlgeschlagen` | `beschwerde` */
  grund: text("grund").notNull(),
  gesetztAm: timestamp("gesetzt_am", { withTimezone: true }).notNull().defaultNow(),
  notiz: text("notiz"),
});
