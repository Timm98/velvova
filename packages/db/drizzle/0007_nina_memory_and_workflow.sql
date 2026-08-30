-- Ninas Gedächtnis und der Ort, an dem die Person stehengeblieben ist.
--
-- Vor dieser Migration wurde ein Gespräch nirgends abgelegt: der Verlauf
-- lebte im Zustand einer React-Komponente und war nach dem Neuladen weg.
-- Und es gab kein Feld, das "Interview fertig" sagen konnte — deshalb
-- landete jeder Login wieder am Anfang des Interviews.

CREATE TYPE "nina_conversation_kind" AS ENUM ('career_interview', 'assistant', 'job_search');
--> statement-breakpoint
CREATE TYPE "nina_message_role" AS ENUM ('user', 'assistant', 'tool');
--> statement-breakpoint
CREATE TYPE "career_interview_status" AS ENUM ('not_started', 'in_progress', 'paused', 'completed', 'needs_review');
--> statement-breakpoint
CREATE TYPE "career_profile_status" AS ENUM ('empty', 'draft', 'awaiting_confirmation', 'confirmed', 'outdated');
--> statement-breakpoint

CREATE TABLE "nina_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "kind" "nina_conversation_kind" DEFAULT 'assistant' NOT NULL,
  "locale" "locale" DEFAULT 'de' NOT NULL,
  "title" text,
  "origin_route" text,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE set null,
  "summary" text,
  "summarised_through_index" integer DEFAULT 0 NOT NULL,
  "message_count" integer DEFAULT 0 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "nina_conversations_user_idx" ON "nina_conversations" ("user_id", "updated_at");
--> statement-breakpoint
CREATE INDEX "nina_conversations_job_idx" ON "nina_conversations" ("job_id");
--> statement-breakpoint

CREATE TABLE "nina_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "nina_conversations"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "index" integer NOT NULL,
  "role" "nina_message_role" NOT NULL,
  "content" text NOT NULL,
  "tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "context_route" text,
  "context_job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
  "model" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "latency_ms" integer,
  "from_voice" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "nina_messages_conversation_idx" ON "nina_messages" ("conversation_id", "index");
--> statement-breakpoint

-- Zwei Nachrichten mit derselben Nummer im selben Gespräch wären eine
-- Reihenfolge, die von der Einfügezeit abhängt. Bei zwei gleichzeitigen
-- Anfragen ist das ein Münzwurf.
CREATE UNIQUE INDEX "nina_messages_order_uq" ON "nina_messages" ("conversation_id", "index");
--> statement-breakpoint

CREATE TABLE "workflow_states" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
  "onboarding_complete" boolean DEFAULT false NOT NULL,
  "career_interview_status" "career_interview_status" DEFAULT 'not_started' NOT NULL,
  "career_interview_completed_at" timestamp with time zone,
  "career_profile_status" "career_profile_status" DEFAULT 'empty' NOT NULL,
  "active_career_project_id" uuid,
  "active_conversation_id" uuid REFERENCES "nina_conversations"("id") ON DELETE set null,
  "current_workflow_step" text DEFAULT 'account_setup' NOT NULL,
  "last_active_route" text,
  "last_active_job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
  "last_active_application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Ein abgeschlossenes Interview ohne Zeitpunkt wäre eine Behauptung ohne
-- Beleg — und genau die Spalte, auf die sich die Weiterleitung stützt.
ALTER TABLE "workflow_states" ADD CONSTRAINT "completed_needs_timestamp"
  CHECK ("career_interview_status" <> 'completed' OR "career_interview_completed_at" IS NOT NULL);
