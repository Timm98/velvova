CREATE TABLE IF NOT EXISTS "job_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"aufgabe" text NOT NULL,
	"normalisiert" text,
	"wichtigkeit" text DEFAULT 'regelmaessig' NOT NULL,
	"anteil" smallint,
	"quelle" text DEFAULT 'anzeige' NOT NULL,
	"konfidenz" smallint DEFAULT 100 NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nina_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"art" text NOT NULL,
	"bezugsart" text,
	"bezug_id" uuid,
	"prioritaet" smallint DEFAULT 3 NOT NULL,
	"titel" text NOT NULL,
	"nutzlast" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verarbeitet_am" timestamp with time zone,
	"gezeigt_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"art" text NOT NULL,
	"schluessel" text NOT NULL,
	"wert" jsonb NOT NULL,
	"quelle" text NOT NULL,
	"beleg" text,
	"konfidenz" smallint DEFAULT 50 NOT NULL,
	"bestaetigt" boolean DEFAULT false NOT NULL,
	"bestaetigt_am" timestamp with time zone,
	"gueltig_bis" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid,
	"job_id" uuid,
	"art" text NOT NULL,
	"grund" text,
	"freitext" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" text DEFAULT 'candidate' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profile_skills" ADD COLUMN IF NOT EXISTS "quelle" text DEFAULT 'nutzer_aussage' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profile_skills" ADD COLUMN IF NOT EXISTS "konfidenz" smallint DEFAULT 70 NOT NULL;
--> statement-breakpoint
ALTER TABLE "profile_skills" ADD COLUMN IF NOT EXISTS "jahre_erfahrung" smallint;
--> statement-breakpoint
ALTER TABLE "profile_skills" ADD COLUMN IF NOT EXISTS "zuletzt_genutzt" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "profile_skills" ADD COLUMN IF NOT EXISTS "aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "harte_bedingung" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "gewicht" smallint DEFAULT 50 NOT NULL;
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "quelle" text DEFAULT 'nutzer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "konfidenz" smallint DEFAULT 80 NOT NULL;
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN IF NOT EXISTS "bestaetigt" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "zwingend" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "erlernbar" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "wichtigkeit" smallint DEFAULT 50 NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "konfidenz" smallint DEFAULT 70 NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "belegstelle" text;
--> statement-breakpoint
ALTER TABLE "match_factors" ADD COLUMN IF NOT EXISTS "art" text DEFAULT 'neutral' NOT NULL;
--> statement-breakpoint
ALTER TABLE "match_factors" ADD COLUMN IF NOT EXISTS "schwere" smallint;
--> statement-breakpoint
ALTER TABLE "nina_einrichtung" ADD COLUMN IF NOT EXISTS "berechtigungen" jsonb DEFAULT '{"search_jobs":"allowed","save_jobs":"allowed","prepare_application":"ask_every_time","send_application":"denied","prepare_message":"ask_every_time","send_message":"denied","share_profile":"ask_every_time","contact_company":"denied"}'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nina_events" ADD CONSTRAINT "nina_events_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."job_matches"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_tasks_job_idx" ON "job_tasks" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_events_offen_idx" ON "nina_events" ("user_id","verarbeitet_am","prioritaet");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_events_bezug_idx" ON "nina_events" ("bezugsart","bezug_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_facts_schluessel_idx" ON "profile_facts" ("user_id","schluessel","bestaetigt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_feedback_user_idx" ON "match_feedback" ("user_id","grund","erstellt_am");
