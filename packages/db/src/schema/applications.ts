import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { applicationEventTypeEnum, applicationStageEnum, artifactKindEnum,
  claimStatusEnum, localeEnum } from "./enums.ts";
import { users } from "./identity.ts";
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
  /** Schlüssel im Objektspeicher, nie ein direkter oeffentlicher Link. */
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  malwareScanStatus: text("malware_scan_status").notNull().default("pending"),
  malwareScanAt: timestamp("malware_scan_at", { withTimezone: true }),
  extractedText: text("extracted_text"),
  /** Aufbewahrung endet automatisch; danach raeumt der Worker auf. */
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
  /** Der Zeitpunkt der ausdruecklichen Freigabe durch den Menschen. */
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
  /** Versprechen der Anzeige gegen die tatsaechliche Erfahrung. */
  promiseVsReality: text("promise_vs_reality"),
  taskEnergy: text("task_energy"),
  leadershipAndTeam: text("leadership_and_team"),
  learningOpportunities: text("learning_opportunities"),
  overallFit: integer("overall_fit"),
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
