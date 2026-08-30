import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { companies, jobs, jobRequirements, jobSources } from "./jobs.ts";
import { applications } from "./applications.ts";
import { evidenceItems } from "./profile.ts";

/**
 * Decision Intelligence.
 *
 * Die Leitidee dieser Tabellen in einem Satz: das Produkt misst sich
 * nicht daran, wie viele Stellen es zeigt, sondern daran, wie viel
 * Unsicherheit es zwischen „diese Stelle existiert" und „eine Bewerbung
 * hier ist ein sinnvoller nächster Schritt" abbaut.
 *
 * Deshalb tragen fast alle Zeilen hier drei Dinge zusammen: einen Wert,
 * seine Herkunft und seine Unsicherheit. Ein Wert ohne die anderen
 * beiden ist keine Information, sondern eine Behauptung.
 */

// ── Chancenraum ─────────────────────────────────────────────────

/**
 * Eine Momentaufnahme des Suchraums.
 *
 * Eine Suche liefert tausend Treffer; nach Dubletten, abgelaufenen
 * Anzeigen und harten Konflikten bleiben zwölf. Die tausend zu zeigen
 * ist keine Grosszügigkeit, sondern eine Täuschung über den Aufwand,
 * der noch bevorsteht.
 *
 * Jede Zahl hier ist **gezählt**, keine geschätzt.
 */
export const searchSpaceSnapshots = pgTable("search_space_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  queryVersion: text("query_version").notNull(),
  country: text("country"),
  regions: jsonb("regions").$type<string[]>().notNull().default([]),
  roleClusterIds: jsonb("role_cluster_ids").$type<string[]>().notNull().default([]),
  rawResultsCount: integer("raw_results_count").notNull().default(0),
  deduplicatedResultsCount: integer("deduplicated_results_count").notNull().default(0),
  sourceVerifiedCount: integer("source_verified_count").notNull().default(0),
  currentlyActiveCount: integer("currently_active_count").notNull().default(0),
  hardConstraintsPassedCount: integer("hard_constraints_passed_count").notNull().default(0),
  seniorityReachableCount: integer("seniority_reachable_count").notNull().default(0),
  evidenceSupportedCount: integer("evidence_supported_count").notNull().default(0),
  decisionReadyCount: integer("decision_ready_count").notNull().default(0),
  highFitCount: integer("high_fit_count").notNull().default(0),
  exploratoryCount: integer("exploratory_count").notNull().default(0),
  unknownDataCount: integer("unknown_data_count").notNull().default(0),
  calculationVersion: text("calculation_version").notNull(),
}, (t) => [index("search_space_user_idx").on(t.userId, t.createdAt)]);

export const marketRealitySignals = pgTable("market_reality_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id").notNull().references(() => searchSpaceSnapshots.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleLabel: text("role_label").notNull(),
  region: text("region"),
  signalType: text("signal_type").notNull(),
  signalValue: text("signal_value").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (t) => [index("market_signals_snapshot_idx").on(t.snapshotId)]);

// ── Einstiegswege ───────────────────────────────────────────────

/**
 * Das Erfahrungsparadox: „zwei Jahre Erfahrung erforderlich" für eine
 * Stelle, die man ohne diese Stelle nicht bekommt.
 *
 * Die Antwort darauf ist nicht Trost, sondern eine Unterscheidung —
 * welche Anforderung ist wirklich zwingend, welche ist ein Wunsch, und
 * was davon ist bereits anders belegt.
 */
export const experienceEquivalencies = pgTable("experience_equivalencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobRequirementId: uuid("job_requirement_id").references(() => jobRequirements.id, { onDelete: "cascade" }),
  careerEvidenceId: uuid("career_evidence_id").references(() => evidenceItems.id, { onDelete: "cascade" }),
  equivalencyType: text("equivalency_type").notNull(),
  coverageLevel: text("coverage_level").notNull(),
  rationale: text("rationale").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  userConfirmed: boolean("user_confirmed").notNull().default(false),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("equivalency_user_idx").on(t.userId)]);

/**
 * Wer viel kann, wird aus einfacheren Rollen herausgefiltert und weiss
 * nicht warum. Das Produkt filtert deshalb nicht, sondern benennt.
 */
export const seniorityAlignmentAssessments = pgTable("seniority_alignment_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userSeniorityEstimate: text("user_seniority_estimate"),
  jobSeniorityEstimate: text("job_seniority_estimate"),
  alignmentStatus: text("alignment_status").notNull(),
  riskReasons: jsonb("risk_reasons").$type<string[]>().notNull().default([]),
  motivationEvidenceIds: jsonb("motivation_evidence_ids").$type<string[]>().notNull().default([]),
  motivationStatement: text("motivation_statement"),
  motivationConfirmed: boolean("motivation_confirmed").notNull().default(false),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("seniority_alignment_unique").on(t.userId, t.jobId)]);

// ── Bewerbungsaufwand ───────────────────────────────────────────

/**
 * Zwei fachlich gleiche Stellen können 5 oder 60 Minuten kosten. Diese
 * Zahl gehört vor die Entscheidung, nicht dahinter.
 *
 * Bewusst nicht hier: eine Einstellungswahrscheinlichkeit.
 */
export const applicationEffortProfiles = pgTable("application_effort_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  accountRequired: boolean("account_required"),
  cvRequired: boolean("cv_required"),
  coverLetterRequired: boolean("cover_letter_required"),
  manualWorkHistoryRequired: boolean("manual_work_history_required"),
  screeningQuestionsCount: integer("screening_questions_count"),
  freeTextQuestionsCount: integer("free_text_questions_count"),
  portfolioRequired: boolean("portfolio_required"),
  certificateUploadRequired: boolean("certificate_upload_required"),
  assessmentLikely: boolean("assessment_likely"),
  videoRequired: boolean("video_required"),
  estimatedMinutesMin: integer("estimated_minutes_min"),
  estimatedMinutesMax: integer("estimated_minutes_max"),
  effortSource: text("effort_source").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("effort_job_unique").on(t.jobId)]);

/** Was ist bestätigt, was unklar, was im Widerspruch — vor der Bewerbung. */
export const jobConditionFacts = pgTable("job_condition_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  conditionKey: text("condition_key").notNull(),
  valueText: text("value_text"),
  status: text("status").notNull(),
  sourceUrl: text("source_url"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  confidence: doublePrecision("confidence").notNull().default(0.5),
}, (t) => [uniqueIndex("condition_job_key_unique").on(t.jobId, t.conditionKey)]);

// ── Bewerbungspass ──────────────────────────────────────────────

/**
 * Dieselben Angaben zum zwanzigsten Mal einzutippen ist der Teil der
 * Jobsuche, der am wenigsten Sinn hat und am meisten Kraft kostet.
 *
 * `sensitive` steht standardmässig auf true: ein Feld, das versehentlich
 * als unsensibel angelegt wird, wird versehentlich mitgeschickt.
 */
export const candidatePassportFields = pgTable("candidate_passport_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fieldKey: text("field_key").notNull(),
  label: text("label").notNull(),
  valueText: text("value_text"),
  category: text("category").notNull(),
  sensitive: boolean("sensitive").notNull().default(true),
  includeByDefault: boolean("include_by_default").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("passport_user_field_unique").on(t.userId, t.fieldKey)]);

/** Ohne dieses Protokoll ist „du kontrollierst deine Daten" eine Behauptung ohne Nachweis. */
export const candidatePassportUses = pgTable("candidate_passport_uses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  fieldKeys: jsonb("field_keys").$type<string[]>().notNull().default([]),
  purpose: text("purpose").notNull(),
  confirmedByUser: boolean("confirmed_by_user").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("passport_uses_user_idx").on(t.userId, t.usedAt)]);

// ── Prozesstransparenz ──────────────────────────────────────────

export const hiringProcessTemplates = pgTable("hiring_process_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  jobFamily: text("job_family"),
  country: text("country"),
  stages: jsonb("stages").$type<string[]>().notNull().default([]),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applicationProcessObservations = pgTable("application_process_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  firstHumanResponseAt: timestamp("first_human_response_at", { withTimezone: true }),
  interviewAt: timestamp("interview_at", { withTimezone: true }),
  finalDecisionAt: timestamp("final_decision_at", { withTimezone: true }),
  outcome: text("outcome"),
  userConsentForAggregation: boolean("user_consent_for_aggregation").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("process_obs_user_idx").on(t.userId)]);

/** `publishable` wird nur wahr, wenn die Mindeststichprobe erreicht ist. */
export const employerProcessAggregates = pgTable("employer_process_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  country: text("country"),
  jobFamily: text("job_family"),
  sampleSize: integer("sample_size").notNull().default(0),
  observationWindowStart: timestamp("observation_window_start", { withTimezone: true }),
  observationWindowEnd: timestamp("observation_window_end", { withTimezone: true }),
  medianAcknowledgementDays: doublePrecision("median_acknowledgement_days"),
  medianFirstResponseDays: doublePrecision("median_first_response_days"),
  medianProcessDays: doublePrecision("median_process_days"),
  noResponseShare: doublePrecision("no_response_share"),
  confidence: doublePrecision("confidence").notNull().default(0.3),
  publishable: boolean("publishable").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Unternehmen im Blick ────────────────────────────────────────

export const targetCompanies = pgTable("target_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  companyName: text("company_name").notNull(),
  companyDomain: text("company_domain"),
  whyInteresting: text("why_interesting"),
  notify: boolean("notify").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("target_companies_user_idx").on(t.userId)]);

export const watchlistJobEvents = pgTable("watchlist_job_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetCompanyId: uuid("target_company_id").references(() => targetCompanies.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  seenByUser: boolean("seen_by_user").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("watchlist_events_user_idx").on(t.userId, t.createdAt)]);

/** Kein Versprechen, dass frühes Bewerben hilft — aber eine Antwort auf
 *  „seit wann läuft das schon". */
export const jobSourceTiming = pgTable("job_source_timing", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").references(() => jobSources.id, { onDelete: "set null" }),
  firstSeenAtSource: timestamp("first_seen_at_source", { withTimezone: true }),
  firstSeenByPaycheck: timestamp("first_seen_by_paycheck", { withTimezone: true }).notNull().defaultNow(),
  firstSeenAtAggregator: timestamp("first_seen_at_aggregator", { withTimezone: true }),
  sourceDelayHours: doublePrecision("source_delay_hours"),
  confidence: doublePrecision("confidence").notNull().default(0.5),
}, (t) => [index("job_source_timing_job_idx").on(t.jobId)]);

// ── Suchkanäle und Kontakte ─────────────────────────────────────

export const searchChannelActivities = pgTable("search_channel_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  activityType: text("activity_type").notNull(),
  outcome: text("outcome"),
  note: text("note"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("channel_activity_user_idx").on(t.userId, t.occurredAt)]);

/** Kontakte kommen ausschliesslich von der Person selbst. Es gibt keinen
 *  Codepfad, der sie irgendwo herausliest. */
export const networkingContacts = pgTable("networking_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetCompanyId: uuid("target_company_id").references(() => targetCompanies.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  relationship: text("relationship").notNull(),
  contextNote: text("context_note"),
  contactChannel: text("contact_channel"),
  providedByUser: boolean("provided_by_user").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("networking_contacts_user_idx").on(t.userId)]);

export const networkingMessages = pgTable("networking_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => networkingContacts.id, { onDelete: "cascade" }),
  draftText: text("draft_text").notNull(),
  status: text("status").notNull().default("draft"),
  sentConfirmedByUser: boolean("sent_confirmed_by_user").notNull().default(false),
  responseReceived: boolean("response_received").notNull().default(false),
  insightNote: text("insight_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Suchprojekt ─────────────────────────────────────────────────

export const searchPlans = pgTable("search_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  searchMode: text("search_mode").notNull(),
  hoursAvailable: doublePrecision("hours_available"),
  targetApplications: integer("target_applications"),
  pauseDays: jsonb("pause_days").$type<string[]>().notNull().default([]),
  loadRating: integer("load_rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("search_plans_user_week_unique").on(t.userId, t.weekStart)]);

// ── Belegqualität ───────────────────────────────────────────────

/**
 * Ein Forenbeitrag erzeugt eine Hypothese, eine amtliche Statistik
 * trägt eine Aussage. Ohne diese Unterscheidung steht beides
 * gleichwertig nebeneinander — und das Produkt behauptet mehr, als es
 * belegen kann.
 */
export const researchEvidenceRegistry = pgTable("research_evidence_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  publisher: text("publisher"),
  author: text("author"),
  publicationDate: date("publication_date"),
  url: text("url"),
  evidenceType: text("evidence_type").notNull(),
  geography: text("geography"),
  population: text("population"),
  sampleSize: integer("sample_size"),
  methodSummary: text("method_summary"),
  commercialInterest: text("commercial_interest"),
  limitations: text("limitations"),
  qualityTier: text("quality_tier").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  allowedClaims: jsonb("allowed_claims").$type<string[]>().notNull().default([]),
  disallowedClaims: jsonb("disallowed_claims").$type<string[]>().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
