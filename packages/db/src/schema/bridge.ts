import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";
import { employerBoards } from "./jobs.ts";
import { applications } from "./applications.ts";
import { generatedArtifacts } from "./applications.ts";
import { aiRuns } from "./ops.ts";

/**
 * Die Brücke zur externen Bewerbung.
 *
 * Die technische Wahrheit, um die sich alles hier dreht: eine Webseite
 * kann keine Formularfelder auf einer fremden Domain ausfüllen. Browser
 * trennen Origins, und das ist richtig so.
 *
 * Ein Produkt, das „wir bewerben uns für dich" verspricht, verspricht
 * also entweder etwas, das es nicht kann, oder es umgeht etwas, das es
 * nicht umgehen darf.
 *
 * Was bleibt, ist eine ehrliche Brücke: alles vorbereiten, prüfbar
 * machen, übergeben — und den Status erst ändern, wenn es einen Beleg
 * dafür gibt.
 */

export const applyCapabilities = pgTable("apply_capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceKey: text("source_key").notNull(),
  employerBoardId: uuid("employer_board_id").references(() => employerBoards.id, { onDelete: "cascade" }),
  countryCode: text("country_code"),
  applyMode: text("apply_mode").notNull(),
  authorizationStatus: text("authorization_status").notNull(),
  authorizationReference: text("authorization_reference"),
  supportsScreeningQuestions: boolean("supports_screening_questions").notNull().default(false),
  supportsResumeUpload: boolean("supports_resume_upload").notNull().default(false),
  supportsCoverLetterUpload: boolean("supports_cover_letter_upload").notNull().default(false),
  supportsAdditionalDocuments: boolean("supports_additional_documents").notNull().default(false),
  supportsStatusSync: boolean("supports_status_sync").notNull().default(false),
  requiresPartnerOauth: boolean("requires_partner_oauth").notNull().default(false),
  userConfirmationRequired: boolean("user_confirmation_required").notNull().default(true),
  /** Bleibt false. Eine Prüfregel in der Datenbank hält das fest. */
  autoSubmitAllowed: boolean("auto_submit_allowed").notNull().default(false),
  allowedDomains: jsonb("allowed_domains").$type<string[]>().notNull().default([]),
  legalReviewedAt: timestamp("legal_reviewed_at", { withTimezone: true }),
  technicalReviewedAt: timestamp("technical_reviewed_at", { withTimezone: true }),
  enabled: boolean("enabled").notNull().default(false),
  killSwitchReason: text("kill_switch_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const externalFormProfiles = pgTable("external_form_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull(),
  atsType: text("ats_type"),
  formVersion: text("form_version"),
  detectedFields: jsonb("detected_fields").$type<string[]>().notNull().default([]),
  requiredDocuments: jsonb("required_documents").$type<string[]>().notNull().default([]),
  fieldMappingSchema: jsonb("field_mapping_schema").$type<Record<string, string>>().notNull().default({}),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  confidence: doublePrecision("confidence").notNull().default(0.5),
  extensionAssistanceAllowed: boolean("extension_assistance_allowed").notNull().default(false),
  legalStatus: text("legal_status").notNull().default("pending_review"),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("external_form_domain_unique").on(t.domain)]);

export const applicationPackages = pgTable("application_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  applyMode: text("apply_mode").notNull(),
  status: text("status").notNull().default("draft"),
  language: text("language").notNull().default("de"),
  readiness: jsonb("readiness").$type<Record<string, string>>().notNull().default({}),
  estimatedMinutesMin: integer("estimated_minutes_min"),
  estimatedMinutesMax: integer("estimated_minutes_max"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("application_packages_user_idx").on(t.userId, t.jobId)]);

export const applicationPackageDocuments = pgTable("application_package_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").notNull().references(() => applicationPackages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  artifactId: uuid("artifact_id").references(() => generatedArtifacts.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash"),
  approvedByUser: boolean("approved_by_user").notNull().default(false),
  required: boolean("required").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applicationScreeningAnswers = pgTable("application_screening_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").notNull().references(() => applicationPackages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  /** Im Wortlaut der Anzeige. Umformuliert wäre es eine andere Frage. */
  questionText: text("question_text").notNull(),
  questionKind: text("question_kind").notNull().default("free_text"),
  draftAnswer: text("draft_answer"),
  finalAnswer: text("final_answer"),
  evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
  approvedByUser: boolean("approved_by_user").notNull().default(false),
  /** Freiwillige Angaben werden nie vorbelegt und nie abgeleitet. */
  voluntary: boolean("voluntary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ein Ereignis, keine Behauptung über den Ausgang. */
export const applicationHandoffs = pgTable("application_handoffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").notNull().references(() => applicationPackages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applyMode: text("apply_mode").notNull(),
  targetUrl: text("target_url"),
  handedOffAt: timestamp("handed_off_at", { withTimezone: true }).notNull().defaultNow(),
  /** Erst gesetzt, wenn ein Mensch bestätigt. Ein Redirect bedeutet nichts. */
  userConfirmation: text("user_confirmation"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  externalReference: text("external_reference"),
});

/**
 * Drei Ebenen, im Datenmodell getrennt: was die Quelle sagt, was wir
 * normalisiert haben, was Nina daraus schliesst. Vermischt liest sich
 * eine Vermutung wie eine Zusage des Arbeitgebers.
 */
export const jobBriefs = pgTable("job_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  /** Nur bei private_user_only gesetzt. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  audience: text("audience").notNull(),
  language: text("language").notNull().default("de"),
  briefType: text("brief_type").notNull(),
  headline: text("headline"),
  summary: text("summary"),
  sourcePolicyVersion: text("source_policy_version").notNull(),
  promptVersion: text("prompt_version"),
  modelRunId: uuid("model_run_id").references(() => aiRuns.id, { onDelete: "set null" }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reviewStatus: text("review_status").notNull().default("auto"),
  contentHash: text("content_hash"),
}, (t) => [index("job_briefs_job_idx").on(t.jobId, t.audience)]);

export const jobBriefFacts = pgTable("job_brief_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  briefId: uuid("brief_id").notNull().references(() => jobBriefs.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  valueText: text("value_text"),
  layer: text("layer").notNull(),
  sourceUrl: text("source_url"),
  observedAt: timestamp("observed_at", { withTimezone: true }),
  transformationType: text("transformation_type").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.5),
}, (t) => [index("brief_facts_brief_idx").on(t.briefId, t.layer)]);

export const connectedIdentities = pgTable("connected_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  email: text("email"),
  isPrimary: boolean("is_primary").notNull().default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (t) => [uniqueIndex("connected_identities_unique").on(t.provider, t.providerAccountId)]);

export const authIdentityAudit = pgTable("auth_identity_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  provider: text("provider"),
  detail: text("detail"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailPreferences = pgTable("email_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Keine Präferenz. Eine Prüfregel hält es fest. */
  securityEmail: boolean("security_email").notNull().default(true),
  productUpdates: boolean("product_updates").notNull().default(false),
  jobAlerts: boolean("job_alerts").notNull().default(false),
  applicationReminders: boolean("application_reminders").notNull().default(false),
  careerCheckins: boolean("career_checkins").notNull().default(false),
  marketing: boolean("marketing").notNull().default(false),
  frequency: text("frequency").notNull().default("weekly"),
  quietHoursStart: integer("quiet_hours_start"),
  quietHoursEnd: integer("quiet_hours_end"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("email_preferences_user_unique").on(t.userId)]);

export const emailConsents = pgTable("email_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  consentStatus: text("consent_status").notNull().default("pending"),
  consentTextVersion: text("consent_text_version").notNull(),
  source: text("source"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  confirmationTokenHash: text("confirmation_token_hash"),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
}, (t) => [index("email_consents_email_idx").on(t.email, t.purpose)]);

export const emailDeliveries = pgTable("email_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  templateKey: text("template_key").notNull(),
  purpose: text("purpose").notNull(),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull().default("queued"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  bouncedAt: timestamp("bounced_at", { withTimezone: true }),
  complainedAt: timestamp("complained_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailSuppressionList = pgTable("email_suppression_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("suppression_email_unique").on(t.email)]);

export const feedbackItems = pgTable("feedback_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonymousSessionId: text("anonymous_session_id"),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("normal"),
  title: text("title"),
  message: text("message").notNull(),
  route: text("route"),
  featureKey: text("feature_key"),
  workflowState: text("workflow_state"),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  appVersion: text("app_version"),
  browser: text("browser"),
  deviceType: text("device_type"),
  consentToContact: boolean("consent_to_contact").notNull().default(false),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("feedback_status_idx").on(t.status, t.createdAt)]);

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull().default("public"),
  language: text("language").notNull().default("de"),
  version: integer("version").notNull().default(1),
  published: boolean("published").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("knowledge_slug_lang_unique").on(t.slug, t.language)]);

/**
 * Ein Rechtstext ohne juristische Freigabe darf nicht als fertig
 * erscheinen. Der Zustand steht hier und wird beim Rendern geprüft.
 */
export const legalDocuments = pgTable("legal_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  language: text("language").notNull().default("de"),
  version: integer("version").notNull().default(1),
  reviewStatus: text("review_status").notNull().default("draft"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  missingFields: jsonb("missing_fields").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("legal_slug_lang_unique").on(t.slug, t.language)]);

export const assetRegistry = pgTable("asset_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetKey: text("asset_key").notNull(),
  filename: text("filename").notNull(),
  origin: text("origin").notNull(),
  license: text("license").notNull(),
  creator: text("creator"),
  createdOn: date("created_on"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  generationReference: text("generation_reference"),
  altText: text("alt_text").notNull(),
  allowedUsage: text("allowed_usage").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("asset_key_unique").on(t.assetKey)]);
