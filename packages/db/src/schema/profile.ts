import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid,
  smallint,
} from "drizzle-orm/pg-core";
import { entryRealismEnum, evidenceRelationEnum, evidenceTypeEnum, interviewStageEnum,
  localeEnum, retentionClassEnum, roleClusterKindEnum, sensitivityEnum, sessionStatusEnum,
  sourceTypeEnum, taxonomyEnum, turnRoleEnum } from "./enums.ts";
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";

/** Career Evidence Graph, Interview und Rollencluster. */

export const careerProfiles = pgTable("career_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** In der Sprache des Menschen zusammengefasst, nicht in Modellsprache. */
  careerCompass: text("career_compass"),
  /** Der Mensch hat das Profil geprüft und bestätigt. Ohne dieses Flag
   *  bleiben personalisierte Jobempfehlungen gesperrt. */
  confirmedByUser: boolean("confirmed_by_user").notNull().default(false),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /** Anteil abgedeckter Interviewthemen, 0..1. */
  coverage: doublePrecision("coverage").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evidenceItems = pgTable("evidence_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").references(() => careerProfiles.id, { onDelete: "cascade" }),
  type: evidenceTypeEnum("type").notNull(),
  statement: text("statement").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  sourceRef: text("source_ref"),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  userConfirmed: boolean("user_confirmed").notNull().default(false),
  userRejected: boolean("user_rejected").notNull().default(false),
  /**
   * Ob dieser Beleg einem Arbeitgeber gezeigt werden darf.
   *
   * Je Beleg, nicht je Profil: Ein Beleg kann etwas Unangenehmes
   * sagen — „hat Vertriebsaufgaben dreimal versucht, jedes Mal
   * Energieverlust berichtet". Für die Person selbst ist das die
   * wertvollste Auskunft; gegenüber einem Arbeitgeber ist es ihre
   * Entscheidung.
   *
   * Voreinstellung ist nicht geteilt. Siehe Migration 0052.
   */
  geteilt: boolean("geteilt").notNull().default(false),
  /**
   * Weggeklickt, ohne ein Urteil zu fällen.
   *
   * Der dritte Weg neben „stimmt" und „stimmt nicht". Es gibt Aussagen,
   * die man weder bestätigen noch bestreiten will — weil sie halb
   * stimmen, weil man gerade keine Lust hat, weil es nicht wichtig ist.
   * Ohne diesen Weg blieb die Fläche stehen, bis jemand urteilte, und
   * das ist eine Nötigung in einem Produkt, dessen Versprechen die
   * eigene Verfügung ist.
   */
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  /**
   * Der Inhalt, nicht die Zeile.
   *
   * Eine Ablehnung hing bisher an der Kennung. Monday leitet denselben
   * Satz aber aus der nächsten Nachricht erneut ab — als neue Zeile mit
   * neuer Kennung, und damit unbelastet. Für den Menschen sah das aus,
   * als hätte das Ablehnen nichts bewirkt.
   *
   * Über den Hash erkennt die Abfrage den Satz wieder. Neue Erkenntnis
   * heisst dann wirklich: neuer Inhalt.
   */
  contentHash: text("content_hash"),
  sensitivityLevel: sensitivityEnum("sensitivity_level").notNull().default("normal"),
  retentionClass: retentionClassEnum("retention_class").notNull().default("profile"),
  /** Für besonders schutzbedürftige Freitexte: verschlüsselt abgelegt,
   *  statement bleibt dann leer. Siehe docs/PRIVACY_SECURITY.md. */
  statementEncrypted: text("statement_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("evidence_user_idx").on(t.userId),
  index("evidence_confirmed_idx").on(t.userId, t.userConfirmed),
  index("evidence_hash_idx").on(t.userId, t.contentHash),
]);

export const evidenceEdges = pgTable("evidence_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromId: uuid("from_id").notNull().references(() => evidenceItems.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => evidenceItems.id, { onDelete: "cascade" }),
  relation: evidenceRelationEnum("relation").notNull(),
  weight: doublePrecision("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("evidence_edges_from_idx").on(t.fromId)]);

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  organisation: text("organisation"),
  kind: text("kind").notNull().default("job"),
  startedOn: timestamp("started_on", { withTimezone: true }),
  endedOn: timestamp("ended_on", { withTimezone: true }),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable("skills", {
  key: text("key").primaryKey(),
  labelDe: text("label_de").notNull(),
  labelEn: text("label_en").notNull(),
  synonyms: jsonb("synonyms").$type<string[]>().notNull().default([]),
  kind: text("kind").notNull().default("technical"),
  relatedKeys: jsonb("related_keys").$type<string[]>().notNull().default([]),
  escoUri: text("esco_uri"),
  taxonomy: taxonomyEnum("taxonomy").notNull().default("internal"),
  taxonomyVersion: text("taxonomy_version").notNull().default("0"),
});

export const profileSkills = pgTable("profile_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillKey: text("skill_key").notNull().references(() => skills.key),
  /** Selbsteinschätzung, ausdrücklich getrennt vom Beleg. */
  selfAssessedLevel: integer("self_assessed_level"),
  evidenceItemId: uuid("evidence_item_id").references(() => evidenceItems.id, { onDelete: "set null" }),
  userConfirmed: boolean("user_confirmed").notNull().default(false),
  /**
   * Woher die Fähigkeit kommt.
   *
   * nutzer_aussage · lebenslauf · projekt · zertifikat ·
   * arbeitgeber_bestaetigt · nina_ableitung
   *
   * Der letzte Wert ist der Grund, warum diese Spalte existiert: Eine
   * Fähigkeit, die ein Modell aus einem Satz geschlossen hat, darf im
   * Profil stehen — aber nicht so aussehen wie eine, die jemand
   * belegt hat.
   */
  quelle: text("quelle").notNull().default("nutzer_aussage"),
  /** 0 bis 100. Bei `nina_ableitung` selten über 60. */
  konfidenz: smallint("konfidenz").notNull().default(70),
  jahreErfahrung: smallint("jahre_erfahrung"),
  /** Wann zuletzt eingesetzt — eine Fähigkeit von 2014 ist eine andere. */
  zuletztGenutzt: timestamp("zuletzt_genutzt", { withTimezone: true }),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("profile_skills_user_idx").on(t.userId)]);

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  /** Reihenfolge bei geordneten Werten wie der Wertehierarchie. */
  rank: integer("rank"),
  evidenceItemId: uuid("evidence_item_id").references(() => evidenceItems.id, { onDelete: "set null" }),
  /**
   * Ob die Vorliebe eine Bedingung ist.
   *
   * Der Unterschied entscheidet über Phase 1 des Matchings: Eine
   * harte Bedingung kann eine Stelle ausschliessen, eine weiche
   * senkt nur den Wert. Beides in einem Feld hiesse, dass jede
   * Vorliebe entweder alles blockiert oder nichts.
   */
  harteBedingung: boolean("harte_bedingung").notNull().default(false),
  /** 0 bis 100 — wie schwer sie wiegt, wenn sie nicht hart ist. */
  gewicht: smallint("gewicht").notNull().default(50),
  /** gespraech · dokument · feedback · nina_ableitung · nutzer */
  quelle: text("quelle").notNull().default("nutzer"),
  konfidenz: smallint("konfidenz").notNull().default(80),
  /**
   * Ob ein Mensch sie bestätigt hat.
   *
   * Monday darf aus Feedback eine Vorliebe ableiten. Sie darf sie nur
   * nicht als bestätigt hinstellen — sonst wird aus sieben
   * Ablehnungen ein Filter, den niemand gesetzt hat.
   */
  bestaetigt: boolean("bestaetigt").notNull().default(true),
}, (t) => [index("preferences_user_kind_idx").on(t.userId, t.kind)]);

export const userConstraints = pgTable("user_constraints", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** Vollständiges Constraint-Objekt, validiert über UserConstraintsSchema. */
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("text"),
  locale: localeEnum("locale").notNull().default("de"),
  stage: interviewStageEnum("stage").notNull().default("consent_and_goal"),
  completedStages: jsonb("completed_stages").$type<string[]>().notNull().default([]),
  skippedStages: jsonb("skipped_stages").$type<string[]>().notNull().default([]),
  status: sessionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [index("interview_sessions_user_idx").on(t.userId)]);

export const interviewTurns = pgTable("interview_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => interviewSessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  role: turnRoleEnum("role").notNull(),
  stage: interviewStageEnum("stage").notNull(),
  questionKey: text("question_key"),
  content: text("content").notNull(),
  fromVoice: boolean("from_voice").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("interview_turns_session_idx").on(t.sessionId, t.index)]);

export const microAssessments = pgTable("micro_assessments", {
  key: text("key").primaryKey(),
  titleDe: text("title_de").notNull(),
  titleEn: text("title_en").notNull(),
  /** Zweck und Bewertungsraster werden vor dem Start gezeigt. */
  purposeDe: text("purpose_de").notNull(),
  purposeEn: text("purpose_en").notNull(),
  rubric: jsonb("rubric").$type<{ criterion: string; description: string }[]>().notNull().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull().default(4),
  promptDe: text("prompt_de").notNull(),
  promptEn: text("prompt_en").notNull(),
  /** Zugaengliche Alternative zu einer visuellen oder Drag-Darstellung. */
  accessibleAlternativeDe: text("accessible_alternative_de"),
});

export const microAssessmentResults = pgTable("micro_assessment_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assessmentKey: text("assessment_key").notNull().references(() => microAssessments.key),
  response: text("response").notNull(),
  /** Bewertung entlang der vorab gezeigten Kriterien, nie als Diagnose. */
  criterionScores: jsonb("criterion_scores").$type<Record<string, number>>().notNull().default({}),
  feedback: text("feedback"),
  userAccepted: boolean("user_accepted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const occupations = pgTable("occupations", {
  key: text("key").primaryKey(),
  labelDe: text("label_de").notNull(),
  labelEn: text("label_en").notNull(),
  synonyms: jsonb("synonyms").$type<string[]>().notNull().default([]),
  tasks: jsonb("tasks").$type<string[]>().notNull().default([]),
  skillKeys: jsonb("skill_keys").$type<string[]>().notNull().default([]),
  escoUri: text("esco_uri"),
  kldbCode: text("kldb_code"),
  taxonomy: taxonomyEnum("taxonomy").notNull().default("internal"),
  taxonomyVersion: text("taxonomy_version").notNull().default("0"),
});

export const roleClusters = pgTable("role_clusters", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  supportingEvidenceIds: jsonb("supporting_evidence_ids").$type<string[]>().notNull().default([]),
  gaps: jsonb("gaps").$type<string[]>().notNull().default([]),
  criticalConstraints: jsonb("critical_constraints").$type<string[]>().notNull().default([]),
  entryRealism: entryRealismEnum("entry_realism").notNull().default("unclear"),
  nextValidationStep: text("next_validation_step").notNull(),
  kind: roleClusterKindEnum("kind").notNull().default("obvious"),
  escoUris: jsonb("esco_uris").$type<string[]>().notNull().default([]),
  kldbCodes: jsonb("kldb_codes").$type<string[]>().notNull().default([]),
  userConfirmed: boolean("user_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("role_clusters_user_idx").on(t.userId)]);

export const roleHypotheses = pgTable("role_hypotheses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clusterId: uuid("cluster_id").references(() => roleClusters.id, { onDelete: "cascade" }),
  occupationKey: text("occupation_key").references(() => occupations.key),
  statement: text("statement").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Der Career Twin — eine Zeile je Angabe, nicht je Dimension.
 *
 * Mehrere Aussagen zur selben Achse ergeben zusammen ein belastbareres
 * Bild als die jeweils letzte. `zusammenfassen()` in `@paycheck/domain`
 * gewichtet sie nach Herkunft: Beobachtetes schlägt Behauptetes.
 *
 * Siehe Migration 0045.
 */
export const arbeitsprofil = pgTable("arbeitsprofil", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(),
  /** 0 bis 1. Die Enden benennt `DIMENSIONSTEXT`. */
  wert: doublePrecision("wert").notNull(),
  /** gespraech, selbstauskunft, probe, beobachtet */
  herkunft: text("herkunft").notNull(),
  /** Der Satz, der den Wert belegt. Ohne ihn könnte niemand widersprechen. */
  beleg: text("beleg").notNull().default(""),
  /**
   * Ob der Mensch die abgeleitete Aussage bestätigt hat.
   *
   * `null` heisst „noch nicht gefragt" und ist NICHT dasselbe wie
   * `false`. Eine nicht gestellte Frage ist keine Ablehnung — und der
   * Unterschied entscheidet, ob ein Wert mitzählt oder verschwindet.
   *
   * Selbst eingestellte, erprobte und beobachtete Werte stehen auf
   * `true`: Wer einen Regler bewegt, hat bereits geantwortet.
   */
  bestaetigt: boolean("bestaetigt"),
  erfasstAm: timestamp("erfasst_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("arbeitsprofil_user_idx").on(t.userId, t.dimension)]);

/**
 * Dieselben Dimensionen für die Stelle — abgeleitet, nicht behauptet.
 *
 * Getrennt von `jobs`, damit später unterscheidbar bleibt, was der
 * Arbeitgeber gesagt und was wir geschätzt haben.
 */
export const stellenProfil = pgTable("stellen_profil", {
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(),
  wert: doublePrecision("wert").notNull(),
  /** 0 bis 1. Bei 0 wird die Schätzung nicht gezeigt. */
  sicherheit: doublePrecision("sicherheit").notNull().default(0),
  /** Woran es erkannt wurde. */
  beleg: text("beleg").notNull().default(""),
  abgeleitetAm: timestamp("abgeleitet_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.jobId, t.dimension] })]);

/**
 * Job-Simulationen: die Arbeit ausprobieren, bevor man sich bewirbt.
 *
 * Ein Lebenslauf sagt, was jemand getan hat. Eine kurze Aufgabe sagt
 * zwei andere Dinge: ob er es kann — und ob es ihm Energie gibt.
 *
 * Siehe Migration 0047.
 */
export const aufgabenproben = pgTable("aufgabenproben", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** KldB-Hauptgruppe (zwei Ziffern). `null` heisst: für alle geeignet. */
  kldbHauptgruppe: text("kldb_hauptgruppe"),
  titel: text("titel").notNull(),
  aufgabe: text("aufgabe").notNull(),
  /** auswahl · reihenfolge · text */
  art: text("art").notNull().default("auswahl"),
  optionen: jsonb("optionen").$type<string[]>().notNull().default([]),
  /** Bei `text` leer — dort wird nichts bewertet, nur die Energie erfragt. */
  loesung: jsonb("loesung").$type<number[]>().notNull().default([]),
  /** Eine Aufgabe ohne Erklärung ist eine Prüfung, keine Probe. */
  erklaerung: text("erklaerung").notNull().default(""),
  dauerSekunden: integer("dauer_sekunden").notNull().default(60),
  aktiv: boolean("aktiv").notNull().default(true),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Ein Versuch.
 *
 * `richtig` und `energie` stehen getrennt. „Du bist gut darin" und
 * „das macht dich wahrscheinlich glücklich" sind verschiedene
 * Aussagen und gehen oft auseinander — wer sie zu einer Zahl
 * zusammenfasst, verliert genau den Fall, um den es geht.
 */
export const probendurchlaeufe = pgTable("probendurchlaeufe", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  probeId: uuid("probe_id").notNull().references(() => aufgabenproben.id, { onDelete: "cascade" }),
  antwort: jsonb("antwort").$type<number[]>().notNull().default([]),
  /** `null` bei Textaufgaben — dort wird nichts bewertet. */
  richtig: boolean("richtig"),
  /** 1 bis 5: wie es sich angefühlt hat. Die eigentliche Auskunft. */
  energie: integer("energie"),
  dauerSekunden: integer("dauer_sekunden"),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("probendurchlaeufe_user_idx").on(t.userId, t.erstelltAm)]);

/**
 * Suchaufträge — gespeicherte Suchen, die benachrichtigen sollen.
 *
 * ── Warum die Filter als Zeichenkette ─────────────────────────
 *
 * Sie stehen in derselben Form wie in der Adresse der Stellenseite.
 * Damit ist ein Auftrag reproduzierbar: Man öffnet ihn und sieht genau
 * die Suche, die gemeint war. Ein eigenes Datenmodell daneben würde
 * bei jedem neuen Filter auseinanderlaufen.
 *
 * ── Was noch fehlt ────────────────────────────────────────────
 *
 * Der Versand. Die Oberfläche sagt das auch — „Benachrichtigungen
 * kommen, sobald der Versand steht" statt „Danke, du erhältst ab jetzt
 * Stellen". Eine Erfolgsmeldung, hinter der nichts passiert, ist eine
 * Lüge mit Häkchen.
 */
export const jobAlarme = pgTable(
  "job_alarme",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Die Filter als Abfragezeichenkette, wie in der Adresse. */
    filter: text("filter").notNull(),
    aktiv: boolean("aktiv").notNull().default(true),
    /**
     * Wohin die Benachrichtigung geht.
     *
     * `null` heisst: an die Adresse des Kontos. Eine eigene Adresse je
     * Auftrag ist der häufige Fall — wer im Job sucht, will die
     * Hinweise selten auf der Arbeitsadresse.
     */
    benachrichtigungEmail: text("benachrichtigung_email"),
    /** Wann zuletzt geprüft wurde. `null` heisst: noch nie. */
    zuletztGeprueft: timestamp("zuletzt_geprueft", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_alarme_user_idx").on(t.userId, t.aktiv)],
);
