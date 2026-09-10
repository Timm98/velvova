import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applicationEventTypeEnum, applicationStageEnum, artifactKindEnum,
  claimStatusEnum, localeEnum } from "./enums.ts";
import { users } from "./identity.ts";
import { projekte } from "./projekte.ts";
import { jobs } from "./jobs.ts";
import { evidenceItems, roleClusters } from "./profile.ts";

/** Bewerbungen, Dokumente, Coaching, Angebote und Check-ins. */

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  stage: applicationStageEnum("stage").notNull().default("saved"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  nextStepAt: timestamp("next_step_at", { withTimezone: true }),
  nextStepLabel: text("next_step_label"),
  /**
   * Zu welchem Vorhaben das gehört. `null` heisst: zu keinem.
   *
   * `set null` beim Löschen und NICHT cascade: Wer ein Projekt
   * löscht, will das Vorhaben loswerden — nicht seine Bewerbungen.
   */
  projektId: uuid("projekt_id").references(() => projekte.id, { onDelete: "set null" }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("applications_user_stage_idx").on(t.userId, t.stage)]);

export const applicationEvents = pgTable("application_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  type: applicationEventTypeEnum("type").notNull(),
  /** Erlaubt der Trichterdiagnose, nach Richtung statt nur nach Menge zu trennen. */
  roleClusterId: uuid("role_cluster_id").references(() => roleClusters.id, { onDelete: "set null" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index("application_events_user_idx").on(t.userId, t.occurredAt)]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  /** Schlüssel im Objektspeicher, nie ein direkter öffentlicher Link. */
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  malwareScanStatus: text("malware_scan_status").notNull().default("pending"),
  malwareScanAt: timestamp("malware_scan_at", { withTimezone: true }),
  extractedText: text("extracted_text"),
  /** Aufbewahrung endet automatisch; danach räumt der Worker auf. */
  retainUntil: timestamp("retain_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("documents_user_idx").on(t.userId)]);

export const generatedArtifacts = pgTable("generated_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  kind: artifactKindEnum("kind").notNull(),
  locale: localeEnum("locale").notNull().default("de"),
  version: integer("version").notNull().default(1),
  content: text("content").notNull(),
  promptVersion: text("prompt_version"),
  aiRunId: uuid("ai_run_id"),
  /** Ohne diese Freigabe verlässt nichts das System. */
  approvedByUser: boolean("approved_by_user").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("generated_artifacts_app_idx").on(t.applicationId, t.kind, t.version)]);

/**
 * Claim-Provenienz. Der technische Riegel gegen erfundene Aussagen:
 * ein Satz ohne verknuepfte, bestätigte Evidenz erreicht den Status
 * "unsupported" und blockiert die Freigabe des Dokuments.
 */
export const claimEvidenceLinks = pgTable("claim_evidence_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull().references(() => generatedArtifacts.id, { onDelete: "cascade" }),
  claimText: text("claim_text").notNull(),
  evidenceItemId: uuid("evidence_item_id").references(() => evidenceItems.id, { onDelete: "set null" }),
  status: claimStatusEnum("status").notNull().default("unsupported"),
  note: text("note").notNull().default(""),
}, (t) => [index("claim_links_artifact_idx").on(t.artifactId)]);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  /** true = nichts wurde tatsächlich versendet. Im UI deutlich markiert. */
  isDemo: boolean("is_demo").notNull().default(true),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("draft"),
  /** Der Zeitpunkt der ausdrücklichen Freigabe durch den Menschen. */
  confirmedByUserAt: timestamp("confirmed_by_user_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  providerMessageId: text("provider_message_id"),
  artifactVersions: jsonb("artifact_versions").$type<Record<string, number>>().notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coachingSessions = pgTable("coaching_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  mode: text("mode").notNull().default("practice"),
  channel: text("channel").notNull().default("text"),
  locale: localeEnum("locale").notNull().default("de"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const coachingTurns = pgTable("coaching_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => coachingSessions.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  questionKey: text("question_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("coaching_turns_session_idx").on(t.sessionId, t.index)]);

/**
 * Rückmeldung ausschließlich zu Inhalt und Struktur. Bewusst keine
 * Bewertung von Stimme, Akzent, Gesicht, Emotion oder Ehrlichkeit.
 */
export const coachingFeedback = pgTable("coaching_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  turnId: uuid("turn_id").notNull().references(() => coachingTurns.id, { onDelete: "cascade" }),
  relevance: text("relevance"),
  structure: text("structure"),
  concreteEvidence: text("concrete_evidence"),
  clarity: text("clarity"),
  missingPoints: jsonb("missing_points").$type<string[]>().notNull().default([]),
  suggestedEvidenceIds: jsonb("suggested_evidence_ids").$type<string[]>().notNull().default([]),
});

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  baseSalary: integer("base_salary"),
  bonus: integer("bonus"),
  currency: text("currency").notNull().default("EUR"),
  vacationDays: integer("vacation_days"),
  weeklyHours: doublePrecision("weekly_hours"),
  remotePercent: integer("remote_percent"),
  startDate: timestamp("start_date", { withTimezone: true }),
  probationMonths: integer("probation_months"),
  otherBenefits: jsonb("other_benefits").$type<string[]>().notNull().default([]),
  decisionDeadline: timestamp("decision_deadline", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkIns = pgTable("check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  dayMark: integer("day_mark").notNull(),
  /** Versprechen der Anzeige gegen die tatsächliche Erfahrung. */
  promiseVsReality: text("promise_vs_reality"),
  taskEnergy: text("task_energy"),
  leadershipAndTeam: text("leadership_and_team"),
  learningOpportunities: text("learning_opportunities"),
  overallFit: integer("overall_fit"),
  /*
   * Der Wechselkontext (Migration 0107).
   *
   * Eine Zufriedenheitszahl ohne diese drei Angaben ist nicht deutbar:
   * Ein freiwilliger Wechsel und eine Betriebsschliessung erzeugen
   * verschiedene Verläufe, ein Berufswechsel einen anderen als ein
   * Arbeitgeberwechsel, und Überqualifikation senkt die Zufriedenheit
   * dauerhaft und unabhängig vom Wechsel.
   *
   * Nullbar und ohne Vorgabewert: `null` heisst „nicht gesagt". Der
   * Wechselgrund kann eine Kündigung sein — danach zu fragen ist
   * zumutbar, eine Antwort zu erzwingen nicht. Geprüft wird in
   * `wechselverlauf.ts`, bevor geschrieben wird.
   */
  wechselgrund: text("wechselgrund"),
  berufsnaehe: text("berufsnaehe"),
  ausbildungspassung: text("ausbildungspassung"),
  /** Bleibt privat, solange nicht ausdrücklich geteilt. */
  sharedWithPartner: boolean("shared_with_partner").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  label: text("label").notNull(),
  /** Vorschlagstext, den der Mensch bearbeiten kann - kein Automatikversand. */
  draftMessage: text("draft_message"),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [index("reminders_user_due_idx").on(t.userId, t.dueAt)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("in_app"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Die eingefrorene Vorhersage und was daraus wurde.
 *
 * ── Warum getrennt von `job_matches` ──────────────────────────
 *
 * `job_matches` zeigt den aktuellen Stand und wird bei jeder
 * Neuberechnung überschrieben. Das ist für die Anzeige richtig und für
 * die Auswertung wertlos: Trifft ein Ergebnis Monate später ein, steht
 * dort längst eine andere Zahl.
 *
 * Hier stehen die Vorhersagefelder ein einziges Mal. Sie werden nie
 * aktualisiert — wer das täte, zerstörte genau den Vergleich, für den
 * die Tabelle da ist. Siehe Migration 0043.
 */
export const empfehlungsErgebnisse = pgTable("empfehlungs_ergebnisse", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),

  /* ── Unveränderlich ab dem ersten Schreiben ── */
  fitScore: integer("fit_score"),
  fitBand: text("fit_band").notNull(),
  fitCoverage: doublePrecision("fit_coverage").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  constraintVerdict: text("constraint_verdict").notNull(),
  overallScore: integer("overall_score"),
  topReason: text("top_reason").notNull().default(""),
  topReservation: text("top_reservation").notNull().default(""),
  /** Ohne die Fassung wäre ein Vergleich über Zeit nicht deutbar. */
  scoringVersion: text("scoring_version").notNull(),
  vorhergesagtAm: timestamp("vorhergesagt_am", { withTimezone: true }).notNull().defaultNow(),

  /* ── Wächst mit der Zeit ── */
  beworbenAm: timestamp("beworben_am", { withTimezone: true }),
  antwortAm: timestamp("antwort_am", { withTimezone: true }),
  interviewAm: timestamp("interview_am", { withTimezone: true }),
  angebotAm: timestamp("angebot_am", { withTimezone: true }),
  angenommenAm: timestamp("angenommen_am", { withTimezone: true }),
  abgelehntAm: timestamp("abgelehnt_am", { withTimezone: true }),

  /** `null` heisst „noch nicht gefragt", nie „unzufrieden". */
  zufriedenheit30: integer("zufriedenheit_30"),
  zufriedenheit90: integer("zufriedenheit_90"),
  zufriedenheit180: integer("zufriedenheit_180"),
  /*
   * Über das erste Jahr hinaus (Migration 0107).
   *
   * Die Zufriedenheit nach einem Wechsel steigt im Jahr des Wechsels
   * und fällt danach. Wer nur bis 180 Tage misst, misst den Anstieg —
   * und hält eine Empfehlung für gelungen, die nach zwölf Monaten
   * gekippt ist.
   */
  zufriedenheit365: integer("zufriedenheit_365"),
  zufriedenheit1095: integer("zufriedenheit_1095"),

  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("empfehlungs_ergebnisse_unique").on(t.userId, t.jobId),
  index("empfehlungs_ergebnisse_band_idx").on(t.fitBand, t.scoringVersion),
]);

/**
 * Der Promise Lock — was zugesagt wurde.
 *
 * Die meisten schlechten Jobentscheidungen entstehen nicht, weil der
 * Beruf falsch war, sondern weil die Arbeit nicht dem entsprach, was im
 * Bewerbungsprozess versprochen wurde.
 *
 * `check_ins.promise_vs_reality` fragte nach genau diesem Vergleich —
 * und hielt nie fest, womit verglichen werden sollte. Siehe Migration
 * 0050.
 */
export const zusagen = pgTable("zusagen", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  /** aufgaben · homeoffice · arbeitszeit · einarbeitung · vorgesetzter · gehalt · … */
  punkt: text("punkt").notNull(),
  /** Was genau zugesagt wurde — in den Worten des Menschen. */
  zusage: text("zusage").notNull(),
  /**
   * anzeige · gespraech · vertrag · arbeitgeber_bestaetigt
   *
   * Was in der Anzeige steht, ist eine Werbeaussage; was der
   * Arbeitgeber auf Nachfrage bestätigt hat, ist eine Zusage.
   */
  herkunft: text("herkunft").notNull().default("gespraech"),
  /** Die Fundstelle: Zitat aus der Anzeige, Datum des Gesprächs. */
  beleg: text("beleg").notNull().default(""),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("zusagen_bewerbung_idx").on(t.applicationId)]);

/**
 * Ob eine Zusage gehalten wurde — je Zeitpunkt.
 *
 * Getrennt von der Zusage, weil dieselbe Zusage nach 14 Tagen anders
 * dasteht als nach 90: Eine fehlende Einarbeitung in der ersten Woche
 * ist ein Anlaufproblem, nach drei Monaten ein Bruch.
 */
export const zusagenPruefungen = pgTable("zusagen_pruefungen", {
  id: uuid("id").primaryKey().defaultRandom(),
  zusageId: uuid("zusage_id").notNull().references(() => zusagen.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** 14, 30 oder 90 */
  tagesmarke: integer("tagesmarke").notNull(),
  /**
   * gehalten · teilweise · gebrochen · zu_frueh
   *
   * `zu_frueh` ist kein Ausweichen: „Zwei Homeoffice-Tage nach dem
   * ersten Monat" lässt sich nach 14 Tagen nicht beurteilen, und ein
   * „gebrochen" wäre dort schlicht falsch.
   */
  stand: text("stand").notNull(),
  notiz: text("notiz").notNull().default(""),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("zusagen_pruefungen_unique").on(t.zusageId, t.tagesmarke)]);

/**
 * ══════════════════════════════════════════════════════════════
 * Die Freigabe für genau eine Nachricht
 * ══════════════════════════════════════════════════════════════
 *
 * `consents` trägt die dauerhafte, allgemeine Einwilligung („Monday
 * darf mein Postfach benutzen"). Diese Tabelle trägt die andere Art:
 * einmalig, an eine bestimmte Nachricht gebunden, verfallend.
 *
 * Die erste allein reicht nicht. Wer „ja, benutze mein Gmail" gesagt
 * hat, hat nicht gesagt, dass irgendetwas in seinem Namen hinausgehen
 * darf — nur, dass der Weg offensteht.
 *
 * Die Entscheidung fällt in `versandfreigabe.ts` gegen die Werte
 * dieser Zeile: vier Zeitpunkte, zwei Vergleiche, kein Modell.
 *
 * Siehe Migration 0109.
 */
export const versandfreigaben = pgTable(
  "versandfreigaben",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),

    /** Gebunden an die Adresse, die der Mensch gesehen hat. */
    empfaenger: text("empfaenger").notNull(),
    /** sha256 über Empfänger, Betreff und Text. */
    fingerabdruck: text("fingerabdruck").notNull(),
    /** sha256 des Tokens. Das Token selbst wird nie gespeichert. */
    tokenHash: text("token_hash").notNull(),

    gueltigBis: timestamp("gueltig_bis", { withTimezone: true }).notNull(),
    /** Einmal verwendbar. Gesetzt beim Einlösen, nicht beim Senden. */
    verwendetAm: timestamp("verwendet_am", { withTimezone: true }),
    widerrufenAm: timestamp("widerrufen_am", { withTimezone: true }),
    erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("versandfreigaben_token_unique").on(t.tokenHash),
    index("versandfreigaben_user_idx").on(t.userId, t.erstelltAm),
  ],
);
