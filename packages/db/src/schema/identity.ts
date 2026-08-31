import { relations } from "drizzle-orm";
import {
  boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { consentKindEnum, integrationKindEnum, integrationStatusEnum, localeEnum,
  privacyRequestKindEnum, privacyRequestStatusEnum, userRoleEnum } from "./enums.ts";

/**
 * Identität, Einwilligungen und Datenschutzanfragen.
 *
 * Jede Tabelle mit Nutzerbezug trägt user_id. Darauf setzt die
 * Zugriffskontrolle auf (siehe migrate.ts, Row Level Security).
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Argon2id- oder Scrypt-Hash. Niemals das Passwort selbst. */
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("candidate"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Soft Delete. Der harte Löschlauf räumt später kontrolliert auf. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [uniqueIndex("users_email_unique").on(t.email)]);

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("auth_accounts_provider_unique").on(t.provider, t.providerAccountId)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Nur der Hash des Tokens. Das Token selbst steht ausschließlich im Cookie. */
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  deviceLabel: text("device_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]);

export const magicLinks = pgTable("magic_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").notNull().default("login"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("magic_links_token_unique").on(t.tokenHash)]);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),

  /* ---- Sprache ----
     Drei getrennte Sprachen, weil es drei getrennte Entscheidungen sind:
     Jemand kann die Oberfläche auf Deutsch wollen, mit der Assistenz
     lieber auf Türkisch sprechen und die Bewerbung auf Englisch
     schreiben. Ein einziges Feld würde alle drei aneinanderketten. */
  locale: localeEnum("locale").notNull().default("de"),
  assistantLocale: localeEnum("assistant_locale").notNull().default("de"),
  documentLocale: localeEnum("document_locale").notNull().default("de"),

  /* ---- Ort und Markt ----
     Wohnort und Jobmarkt sind nicht dasselbe: wer in Basel wohnt, kann
     auf den deutschen Markt schauen. */
  country: text("country").notNull().default("DE"),
  jobMarketCountry: text("job_market_country").notNull().default("DE"),
  currency: text("currency").notNull().default("EUR"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  distanceUnit: text("distance_unit").notNull().default("km"),
  baseLocation: text("base_location"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  searchRadiusKm: integer("search_radius_km"),
  maxCommuteMinutes: integer("max_commute_minutes"),
  commuteMode: text("commute_mode").notNull().default("public_transport"),
  willingToRelocate: boolean("willing_to_relocate").notNull().default(false),

  /* ---- Suche ---- */
  remotePreference: text("remote_preference").notNull().default("no_preference"),
  employmentTypes: jsonb("employment_types").$type<string[]>().notNull().default([]),
  /** Wunschgehalt. Bleibt leer, wenn nichts gesagt wurde — 0 wäre eine Aussage. */
  desiredSalaryMin: integer("desired_salary_min"),
  desiredSalaryPeriod: text("desired_salary_period").notNull().default("year"),

  /* ---- Darstellung und Benachrichtigungen ---- */
  theme: text("theme").notNull().default("system"),
  notificationEmail: boolean("notification_email").notNull().default(true),
  notificationPush: boolean("notification_push").notNull().default(false),

  /* ---- Stimme und Gespräch ---- */
  microphoneEnabled: boolean("microphone_enabled").notNull().default(false),
  voiceAutoplay: boolean("voice_autoplay").notNull().default(false),
  voiceCaptions: boolean("voice_captions").notNull().default(true),
  voiceSpeed: doublePrecision("voice_speed").notNull().default(1),
  /** Aufnahme nach dem Abtippen löschen. Voreinstellung: ja. */
  deleteAudioAfterTranscript: boolean("delete_audio_after_transcript").notNull().default(true),

  /** Nutzergewichte für den Fit, in Grenzen anpassbar. */
  fitWeights: jsonb("fit_weights").$type<Record<string, number>>(),
  /** Ist das Onboarding durchlaufen? Steuert die Weiterleitung. */
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Einwilligungs-Ledger. Jede Einwilligung einzeln, mit Zweck, Fassung und
 * Zeitpunkt - und mit dem Widerruf in derselben Zeile, damit die Historie
 * nachvollziehbar bleibt.
 */
export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: consentKindEnum("kind").notNull(),
  granted: boolean("granted").notNull(),
  /** Fassung des Textes, dem zugestimmt wurde. */
  policyVersion: text("policy_version").notNull(),
  purpose: text("purpose").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("consents_user_kind_idx").on(t.userId, t.kind)]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("institution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  /** Standardmäßig sieht ein Partner ausschließlich aggregierte Daten. */
  canSeeIndividualProfiles: boolean("can_see_individual_profiles").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("memberships_unique").on(t.organizationId, t.userId)]);

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: integrationKindEnum("kind").notNull(),
  status: integrationStatusEnum("status").notNull().default("not_connected"),
  displayName: text("display_name"),
  /** Verschlüsselt abgelegt. Nie im Klartext, nie in Logs. */
  credentialsEncrypted: text("credentials_encrypted"),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
}, (t) => [uniqueIndex("integrations_user_kind_unique").on(t.userId, t.kind)]);

export const privacyRequests = pgTable("privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: privacyRequestKindEnum("kind").notNull(),
  status: privacyRequestStatusEnum("status").notNull().default("open"),
  targetRef: text("target_ref"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  resultRef: text("result_ref"),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  /** Bei Supportzugriff verpflichtend: warum wurde zugegriffen. */
  justification: text("justification"),
  breakGlass: boolean("break_glass").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_logs_subject_idx").on(t.subjectUserId, t.createdAt)]);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  consents: many(consents),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}));

/* ── Abrechnung ────────────────────────────────────────────────
   Anbieterneutral: `provider` und `provider_ref` halten die Kennungen
   des jeweiligen Zahlungsdienstes. Zahlungsdaten selbst — Kartennummer,
   IBAN, Prüfziffer — stehen hier NIRGENDS. Sie gehören zum Anbieter. */

export const planKeyEnum = pgEnum("plan_key", ["free", "premium"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "trialing", "past_due", "canceled", "incomplete",
]);
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: planKeyEnum("plan").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  interval: billingIntervalEnum("interval"),
  /** Bis wann bezahlt ist. Danach fällt der Zugang von selbst auf free. */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingCustomers = pgTable("billing_customers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerCustomerId: text("provider_customer_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** card, paypal, apple_pay, google_pay, sepa_debit, bank_transfer */
  kind: text("kind").notNull(),
  /** Nur zur Wiedererkennung: „Visa •••• 4242". Nie die volle Nummer. */
  label: text("label").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** In Cent. Beträge als Fliesskomma sind der Klassiker unter den
      Abrechnungsfehlern. */
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  pdfUrl: text("pdf_url"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
});
