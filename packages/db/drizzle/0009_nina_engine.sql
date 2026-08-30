-- Ninas Gesprächsmaschine: Stufe, Jobreife, Rollenhypothesen.
--
-- Die Stufe liegt in der Datenbank und nicht im Modellkontext. Das ist
-- der ganze Unterschied: ein Modell, das seinen eigenen Fortschritt
-- kennt, kann ihn auch setzen — und setzt ihn dann zu früh.

CREATE TYPE "nina_stage" AS ENUM (
  'orientation', 'current_situation', 'evidence_discovery', 'task_preferences',
  'work_style', 'values_and_tradeoffs', 'constraints', 'role_hypotheses',
  'validation', 'job_ready', 'job_search', 'application', 'follow_up', 'career_mode'
);
--> statement-breakpoint
CREATE TYPE "job_readiness_state" AS ENUM ('not_ready', 'exploratory', 'ready');
--> statement-breakpoint

ALTER TABLE "workflow_states" ADD COLUMN IF NOT EXISTS "nina_stage" "nina_stage" DEFAULT 'orientation' NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_states" ADD COLUMN IF NOT EXISTS "job_readiness_state" "job_readiness_state" DEFAULT 'not_ready' NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_states" ADD COLUMN IF NOT EXISTS "job_readiness_score" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Zustimmung ist eine eigene Spalte und kein abgeleiteter Wert: Nina
-- zeigt ohne sie nichts bildschirmfüllend an, und "hat wohl zugestimmt"
-- ist keine Grundlage dafür.
ALTER TABLE "workflow_states" ADD COLUMN IF NOT EXISTS "agreed_to_see_jobs" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_states" ADD COLUMN IF NOT EXISTS "profile_completeness" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Die Stufe, in der eine Nachricht entstanden ist. Ohne sie lässt sich
-- später nicht rekonstruieren, unter welcher Annahme Nina gefragt hat.
ALTER TABLE "nina_messages" ADD COLUMN IF NOT EXISTS "stage" "nina_stage";
--> statement-breakpoint
ALTER TABLE "nina_messages" ADD COLUMN IF NOT EXISTS "recommended_action" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nina_role_hypotheses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "conversation_id" uuid REFERENCES "nina_conversations"("id") ON DELETE set null,
  "role" text NOT NULL,
  -- adjacent / neighbouring / unusual. Eine ungewöhnliche Rolle darf nur
  -- mit Begründung erscheinen, deshalb sind die vier Textspalten unten
  -- nicht optional gedacht, auch wenn die Datenbank sie zulässt.
  "group_kind" text NOT NULL,
  "based_on" text NOT NULL,
  "difference" text,
  "gap" text,
  "small_test" text,
  "confidence" double precision NOT NULL DEFAULT 0.5,
  "user_confirmed" boolean DEFAULT false NOT NULL,
  "user_rejected" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_role_hypotheses_user_idx" ON "nina_role_hypotheses" ("user_id");
--> statement-breakpoint
-- Bestätigt und abgelehnt zugleich gibt es nicht. Ohne diese Bedingung
-- entscheidet die Auswertung, welches Feld gewinnt — und zwei Stellen
-- entscheiden es unterschiedlich.
ALTER TABLE "nina_role_hypotheses" DROP CONSTRAINT IF EXISTS "hypothesis_not_both";
--> statement-breakpoint
ALTER TABLE "nina_role_hypotheses" ADD CONSTRAINT "hypothesis_not_both"
  CHECK (NOT ("user_confirmed" AND "user_rejected"));
