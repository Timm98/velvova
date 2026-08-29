import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applyMethodEnum, contractTypeEnum, experienceLevelEnum, jobSourceKindEnum,
  licenseStatusEnum, requirementKindEnum, reviewSourceKindEnum, salaryPeriodEnum,
  sentimentEnum, workModelEnum } from "./enums.ts";
import { users } from "./identity.ts";

/** Stellen, Unternehmen, Quellen und Bewertungen. */

export const jobSources = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  displayName: text("display_name").notNull(),
  kind: jobSourceKindEnum("kind").notNull(),
  /** Eine Quelle ohne geklaerte Lizenz wird nicht aktiviert. */
  licenseStatus: licenseStatusEnum("license_status").notNull().default("unclear"),
  attributionRequired: boolean("attribution_required").notNull().default(false),
  attributionText: text("attribution_text"),
  termsUrl: text("terms_url"),
  enabled: boolean("enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunOk: boolean("last_run_ok"),
  lastRunError: text("last_run_error"),
}, (t) => [uniqueIndex("job_sources_key_unique").on(t.key)]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  sizeBand: text("size_band"),
  headquarters: text("headquarters"),
  /** Nur true, wenn aus einem offiziellen Register bestätigt. */
  registryVerified: boolean("registry_verified").notNull().default(false),
  registryRef: text("registry_ref"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  location: text("location").notNull(),
  country: text("country").notNull().default("DE"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  workModel: workModelEnum("work_model").notNull(),
  remotePercent: integer("remote_percent"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency").notNull().default("EUR"),
  salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("year"),
  /** false heisst: die Anzeige schweigt. Nie als 0 interpretieren. */
  salaryDisclosed: boolean("salary_disclosed").notNull().default(false),
  contractType: contractTypeEnum("contract_type"),
  weeklyHours: doublePrecision("weekly_hours"),
  shiftWork: boolean("shift_work"),
  travelPercent: integer("travel_percent"),
  experienceLevel: experienceLevelEnum("experience_level"),
  industry: text("industry"),
  languageRequirements: jsonb("language_requirements").$type<Record<string, string>>().notNull().default({}),
  requiredLicenses: jsonb("required_licenses").$type<string[]>().notNull().default([]),
  workPermitRequired: boolean("work_permit_required"),
  coreTasks: jsonb("core_tasks").$type<string[]>().notNull().default([]),
  description: text("description").notNull(),
  benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
  applyMethod: applyMethodEnum("apply_method").notNull().default("unknown"),
  applyTarget: text("apply_target"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  lastLinkCheckAt: timestamp("last_link_check_at", { withTimezone: true }),
  lastLinkCheckOk: boolean("last_link_check_ok"),
  originalUrl: text("original_url"),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id),
  /** Erkennt Reposts derselben Stelle über Quellen hinweg. */
  contentHash: text("content_hash").notNull(),
  /** Zeigt die Stelle als Demo-Datensatz aus, nie als Live-Angebot. */
  isDemo: boolean("is_demo").notNull().default(false),
}, (t) => [
  index("jobs_content_hash_idx").on(t.contentHash),
  index("jobs_published_idx").on(t.publishedAt),
  index("jobs_company_idx").on(t.companyId),
]);

/** Rohfassung je Abruf. Erlaubt später zu zeigen, was sich geaendert hat. */
export const jobSnapshots = pgTable("job_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
  contentHash: text("content_hash").notNull(),
}, (t) => [index("job_snapshots_job_idx").on(t.jobId, t.fetchedAt)]);

export const jobRequirements = pgTable("job_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  kind: requirementKindEnum("kind").notNull(),
  text: text("text").notNull(),
  skillKey: text("skill_key"),
  category: text("category").notNull().default("other"),
}, (t) => [index("job_requirements_job_idx").on(t.jobId)]);

export const companySources = pgTable("company_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceKind: reviewSourceKindEnum("source_kind").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  licenseStatus: licenseStatusEnum("license_status").notNull().default("public_link_only"),
  attributionText: text("attribution_text"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewAggregates = pgTable("review_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  /** Art der Quelle steht immer sichtbar dabei: Kundenurteile sind keine
   *  Aussage über die Arbeitskultur. */
  sourceKind: reviewSourceKindEnum("source_kind").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  ratingAverage: doublePrecision("rating_average"),
  ratingScaleMax: doublePrecision("rating_scale_max").notNull().default(5),
  sampleSize: integer("sample_size"),
  locationScope: text("location_scope"),
  roleScope: text("role_scope"),
  periodFrom: timestamp("period_from", { withTimezone: true }),
  periodTo: timestamp("period_to", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  attributionText: text("attribution_text"),
  /** Wie die Quelle selbst auswaehlt und sortiert. Nie verschweigen. */
  selectionNote: text("selection_note"),
  isDemo: boolean("is_demo").notNull().default(false),
}, (t) => [index("review_aggregates_company_idx").on(t.companyId)]);

export const reviewThemes = pgTable("review_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  aggregateId: uuid("aggregate_id").notNull().references(() => reviewAggregates.id, { onDelete: "cascade" }),
  theme: text("theme").notNull(),
  sentiment: sentimentEnum("sentiment").notNull(),
  mentionCount: integer("mention_count").notNull().default(0),
  /** Als KI-Zusammenfassung gekennzeichnet, mit Quelle und Zeitraum. */
  summary: text("summary").notNull(),
  sourceUrl: text("source_url"),
  periodFrom: timestamp("period_from", { withTimezone: true }),
  periodTo: timestamp("period_to", { withTimezone: true }),
});

/** Jede externe Aussage im Produkt trägt eine Zeile hier. */
export const sourceCitations = pgTable("source_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  sourceKind: text("source_kind").notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  licenseNote: text("license_note"),
}, (t) => [index("source_citations_subject_idx").on(t.subjectType, t.subjectId)]);

export const savedJobs = pgTable("saved_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("saved_jobs_unique").on(t.userId, t.jobId)]);

export const jobMatches = pgTable("job_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  fitScore: integer("fit_score"),
  fitBand: text("fit_band").notNull(),
  fitCoverage: doublePrecision("fit_coverage").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  jobQualityScore: integer("job_quality_score"),
  listingConfidenceScore: integer("listing_confidence_score").notNull().default(0),
  aiTransitionCategory: text("ai_transition_category").notNull().default("unclear_data"),
  overallScore: integer("overall_score"),
  constraintVerdict: text("constraint_verdict").notNull().default("uncertain"),
  topReason: text("top_reason").notNull().default(""),
  topReservation: text("top_reservation").notNull().default(""),
  /** Fassung der Bewertungslogik, damit alte Ergebnisse lesbar bleiben. */
  scoringVersion: text("scoring_version").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("job_matches_unique").on(t.userId, t.jobId), index("job_matches_user_idx").on(t.userId)]);

/** Einzelne Faktoren je Bewertung, damit ein Score reproduzierbar bleibt. */
export const matchFactors = pgTable("match_factors", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => jobMatches.id, { onDelete: "cascade" }),
  scoreKind: text("score_kind").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  raw: doublePrecision("raw"),
  weight: doublePrecision("weight").notNull(),
  contribution: doublePrecision("contribution").notNull().default(0),
  explanation: text("explanation").notNull(),
  evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
}, (t) => [index("match_factors_match_idx").on(t.matchId, t.scoreKind)]);
