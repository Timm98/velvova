-- Eine Stelle, mehrere Quellen (§10.3).
--
-- Bisher trug jede Zeile in `jobs` genau eine Quelle. Dieselbe offene
-- Stelle auf drei Portalen war damit dreimal dieselbe Arbeit für die
-- Person: dreimal lesen, dreimal prüfen, einmal bewerben.
CREATE TABLE IF NOT EXISTS "job_source_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "source_id" uuid NOT NULL REFERENCES "job_sources"("id") ON DELETE cascade,
  "external_id" text NOT NULL,
  "url" text NOT NULL,
  "canonical_key" text,
  "rank" integer DEFAULT 100 NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_check_ok" boolean
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_source_links_unique"
  ON "job_source_links" ("source_id", "external_id")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_source_links_job_idx" ON "job_source_links" ("job_id")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_source_links_key_idx" ON "job_source_links" ("canonical_key")
