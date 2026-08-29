import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { aiRunStatusEnum } from "./enums.ts";
import { users } from "./identity.ts";

/** Betrieb: KI-Läufe, Prompt-Fassungen, Analytics. */

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  version: text("version").notNull(),
  /** Der Systemprompt liegt versioniert im Repository; hier steht sein Hash,
   *  damit nachvollziehbar bleibt, welche Fassung ein Ergebnis erzeugt hat. */
  contentHash: text("content_hash").notNull(),
  notes: text("notes"),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("prompt_versions_unique").on(t.key, t.version)]);

export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptKey: text("prompt_key"),
  promptVersion: text("prompt_version"),
  status: aiRunStatusEnum("status").notNull().default("ok"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costEurCents: integer("cost_eur_cents"),
  latencyMs: integer("latency_ms"),
  /** Nur der Fehlertext, nie der Inhalt der Anfrage. Kein Personenbezug. */
  errorMessage: text("error_message"),
  /** Kurze, nachvollziehbare Begründung des Ergebnisses. Ausdrücklich
   *  kein gespeicherter innerer Gedankengang des Modells. */
  rationale: text("rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ai_runs_created_idx").on(t.createdAt), index("ai_runs_status_idx").on(t.status)]);

/**
 * Analytics. Bewusst datensparsam: keine Chattexte, keine Dokumentinhalte,
 * kein Freitext des Menschen. Nur Ereignisart und grobe Einordnung.
 */
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Pseudonym, rotierbar. Kein direkter Personenbezug im Ereignisstrom. */
  subjectKey: text("subject_key").notNull(),
  name: text("name").notNull(),
  properties: jsonb("properties").$type<Record<string, string | number | boolean>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("analytics_events_name_idx").on(t.name, t.occurredAt)]);

export const featureFlagOverrides = pgTable("feature_flag_overrides", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull(),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobIngestionRuns = pgTable("job_ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceKey: text("source_key").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  fetched: integer("fetched").notNull().default(0),
  created: integer("created").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  deduplicated: integer("deduplicated").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  errorSummary: text("error_summary"),
  durationMs: doublePrecision("duration_ms"),
});
