import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entryRealismEnum, evidenceRelationEnum, evidenceTypeEnum, interviewStageEnum,
  localeEnum, retentionClassEnum, roleClusterKindEnum, sensitivityEnum, sessionStatusEnum,
  sourceTypeEnum, taxonomyEnum, turnRoleEnum } from "./enums.ts";
import { users } from "./identity.ts";

/** Career Evidence Graph, Interview und Rollencluster. */

export const careerProfiles = pgTable("career_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** In der Sprache des Menschen zusammengefasst, nicht in Modellsprache. */
  careerCompass: text("career_compass"),
  /** Der Mensch hat das Profil geprueft und bestaetigt. Ohne dieses Flag
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
  sensitivityLevel: sensitivityEnum("sensitivity_level").notNull().default("normal"),
  retentionClass: retentionClassEnum("retention_class").notNull().default("profile"),
  /** Fuer besonders schutzbeduerftige Freitexte: verschluesselt abgelegt,
   *  statement bleibt dann leer. Siehe docs/PRIVACY_SECURITY.md. */
  statementEncrypted: text("statement_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("evidence_user_idx").on(t.userId),
  index("evidence_confirmed_idx").on(t.userId, t.userConfirmed),
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
  /** Selbsteinschaetzung, ausdruecklich getrennt vom Beleg. */
  selfAssessedLevel: integer("self_assessed_level"),
  evidenceItemId: uuid("evidence_item_id").references(() => evidenceItems.id, { onDelete: "set null" }),
  userConfirmed: boolean("user_confirmed").notNull().default(false),
}, (t) => [index("profile_skills_user_idx").on(t.userId)]);

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  /** Reihenfolge bei geordneten Werten wie der Wertehierarchie. */
  rank: integer("rank"),
  evidenceItemId: uuid("evidence_item_id").references(() => evidenceItems.id, { onDelete: "set null" }),
}, (t) => [index("preferences_user_kind_idx").on(t.userId, t.kind)]);

export const userConstraints = pgTable("user_constraints", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** Vollstaendiges Constraint-Objekt, validiert ueber UserConstraintsSchema. */
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
