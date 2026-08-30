import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { localeEnum } from "./enums.ts";
import { users } from "./identity.ts";
import { jobs } from "./jobs.ts";
import { applications } from "./applications.ts";
import { documents } from "./applications.ts";

/**
 * Ninas Gedächtnis und der Ort, an dem die Person stehengeblieben ist.
 *
 * Zwei Dinge, die bisher fehlten und deren Fehlen dieselbe Wirkung
 * hatte: der Verlauf war nach einem Neuladen weg, und wer sein
 * Interview abgeschlossen hatte, landete beim nächsten Login wieder am
 * Anfang. Beides sieht aus wie ein Designfehler und ist in Wahrheit
 * eine fehlende Tabelle.
 */

export const ninaConversationKindEnum = pgEnum("nina_conversation_kind", [
  /** Das strukturierte Karrieregespräch. */
  "career_interview",
  /** Die schwebende Nina auf einer beliebigen Seite. */
  "assistant",
  /** Eine Suchanfrage in natürlicher Sprache auf der Jobs-Seite. */
  "job_search",
]);

export const ninaMessageRoleEnum = pgEnum("nina_message_role", [
  "user",
  "assistant",
  "tool",
]);

export const careerInterviewStatusEnum = pgEnum("career_interview_status", [
  "not_started",
  "in_progress",
  "paused",
  "completed",
  "needs_review",
]);

export const careerProfileStatusEnum = pgEnum("career_profile_status", [
  "empty",
  "draft",
  "awaiting_confirmation",
  "confirmed",
  "outdated",
]);

/* ── Gespräche ─────────────────────────────────────────────────── */

export const ninaConversations = pgTable(
  "nina_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: ninaConversationKindEnum("kind").notNull().default("assistant"),
    locale: localeEnum("locale").notNull().default("de"),
    /** Aus der ersten Nutzernachricht abgeleitet, damit die Liste lesbar ist. */
    title: text("title"),

    /*
     * Woher das Gespräch kam.
     *
     * Nicht zur Anzeige, sondern damit Nina beim Wiederaufnehmen weiß,
     * worüber gesprochen wurde. Die Route ist ohne Anfrageteil
     * gespeichert; Suchparameter können personenbezogene Angaben
     * enthalten.
     */
    originRoute: text("origin_route"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),

    /*
     * Die verdichtete Fassung des bisherigen Gesprächs.
     *
     * An das Modell geht diese Zusammenfassung plus die letzten Züge —
     * nie der ganze Verlauf. Ein Gespräch, das mit jeder Runde länger
     * wird, wird mit jeder Runde teurer und ungenauer.
     */
    summary: text("summary"),
    summarisedThroughIndex: integer("summarised_through_index").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("nina_conversations_user_idx").on(t.userId, t.updatedAt),
    index("nina_conversations_job_idx").on(t.jobId),
  ],
);

export const ninaMessages = pgTable(
  "nina_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => ninaConversations.id, { onDelete: "cascade" }),
    /* Redundant zur Konversation — aber ohne diese Spalte müsste jede
       Zeilensicherheitsregel über einen Join gehen, und eine Regel, die
       joint, ist eine Regel, die irgendwann jemand vereinfacht. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    role: ninaMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),

    /** Welche Werkzeuge in diesem Zug liefen. Namen und Ergebnis, kein Inhalt. */
    toolCalls: jsonb("tool_calls")
      .$type<{ name: string; ok: boolean; summary?: string }[]>()
      .notNull()
      .default([]),

    /** Seitenkontext zum Zeitpunkt der Nachricht. Beantwortet später „welcher Job war gemeint?“. */
    contextRoute: text("context_route"),
    contextJobId: uuid("context_job_id").references(() => jobs.id, { onDelete: "set null" }),

    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    fromVoice: boolean("from_voice").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nina_messages_conversation_idx").on(t.conversationId, t.index)],
);

/* ── Wo die Person stehengeblieben ist ─────────────────────────── */

/**
 * Ein Datensatz pro Person, nicht pro Sitzung.
 *
 * Genau deshalb überlebt der Zustand einen Gerätewechsel: er hängt an
 * der Person, nicht am Browser. Ein `localStorage`-Eintrag hätte
 * dasselbe für ein Gerät geleistet und für alle anderen nichts.
 */
export const workflowStates = pgTable("workflow_states", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  onboardingComplete: boolean("onboarding_complete").notNull().default(false),

  careerInterviewStatus: careerInterviewStatusEnum("career_interview_status")
    .notNull()
    .default("not_started"),
  careerInterviewCompletedAt: timestamp("career_interview_completed_at", {
    withTimezone: true,
  }),
  careerProfileStatus: careerProfileStatusEnum("career_profile_status")
    .notNull()
    .default("empty"),

  activeCareerProjectId: uuid("active_career_project_id"),
  activeConversationId: uuid("active_conversation_id").references(() => ninaConversations.id, {
    onDelete: "set null",
  }),

  /** Der Schritt im Produktablauf, nicht im Gespräch. */
  currentWorkflowStep: text("current_workflow_step").notNull().default("account_setup"),

  /*
   * Die letzte Stelle, an der jemand gearbeitet hat.
   *
   * Ohne Anfrageteil gespeichert. Eine Suchanfrage in einer URL ist
   * eine Aussage über den Menschen, und sie gehört nicht in eine
   * Spalte, die beim nächsten Login wieder aufgerufen wird.
   */
  lastActiveRoute: text("last_active_route"),
  lastActiveJobId: uuid("last_active_job_id").references(() => jobs.id, { onDelete: "set null" }),
  lastActiveApplicationId: uuid("last_active_application_id").references(() => applications.id, {
    onDelete: "set null",
  }),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
