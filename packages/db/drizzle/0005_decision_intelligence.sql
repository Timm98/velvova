-- Addendum V5.1 — Decision Intelligence.
--
-- Die Leitidee dieser Migration in einem Satz: das Produkt misst sich
-- nicht daran, wie viele Stellen es zeigt, sondern daran, wie viel
-- Unsicherheit es zwischen "diese Stelle existiert" und "eine Bewerbung
-- hier ist ein sinnvoller nächster Schritt" abbaut.
--
-- Deshalb speichern die folgenden Tabellen fast durchgehend drei Dinge
-- zusammen: einen Wert, seine Herkunft und seine Unsicherheit. Ein Wert
-- ohne die anderen beiden ist in diesem Produkt keine Information,
-- sondern eine Behauptung.

-- ── Chancenraum ───────────────────────────────────────────────────
--
-- Eine Suche liefert tausend Treffer, und nach Dubletten, abgelaufenen
-- Anzeigen und harten Konflikten bleiben zwölf. Die tausend zu zeigen
-- ist keine Grosszügigkeit, sondern eine Täuschung über den Aufwand,
-- der noch bevorsteht.
CREATE TABLE IF NOT EXISTS "search_space_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "query_version" text NOT NULL,
  "country" text,
  "regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "role_cluster_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- Die Stufen des Trichters. Jede Zahl ist gezählt, keine geschätzt.
  "raw_results_count" integer DEFAULT 0 NOT NULL,
  "deduplicated_results_count" integer DEFAULT 0 NOT NULL,
  "source_verified_count" integer DEFAULT 0 NOT NULL,
  "currently_active_count" integer DEFAULT 0 NOT NULL,
  "hard_constraints_passed_count" integer DEFAULT 0 NOT NULL,
  "seniority_reachable_count" integer DEFAULT 0 NOT NULL,
  "evidence_supported_count" integer DEFAULT 0 NOT NULL,
  "decision_ready_count" integer DEFAULT 0 NOT NULL,
  "high_fit_count" integer DEFAULT 0 NOT NULL,
  "exploratory_count" integer DEFAULT 0 NOT NULL,
  "unknown_data_count" integer DEFAULT 0 NOT NULL,
  "calculation_version" text NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_space_user_idx" ON "search_space_snapshots" ("user_id", "created_at")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "market_reality_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "snapshot_id" uuid NOT NULL REFERENCES "search_space_snapshots"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role_label" text NOT NULL,
  "region" text,
  "signal_type" text NOT NULL,
  "signal_value" text NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_signals_snapshot_idx" ON "market_reality_signals" ("snapshot_id")
--> statement-breakpoint

-- ── Einstiegswege ─────────────────────────────────────────────────
--
-- Das Erfahrungsparadox: "zwei Jahre Erfahrung erforderlich" für eine
-- Stelle, die man ohne diese Stelle nicht bekommt. Die Antwort darauf
-- ist nicht Trost, sondern eine Unterscheidung — welche Anforderung ist
-- wirklich zwingend, welche ist ein Wunsch, und was davon ist bereits
-- anders belegt.
CREATE TABLE IF NOT EXISTS "experience_equivalencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "job_requirement_id" uuid REFERENCES "job_requirements"("id") ON DELETE cascade,
  "career_evidence_id" uuid REFERENCES "evidence_items"("id") ON DELETE cascade,
  "equivalency_type" text NOT NULL,
  "coverage_level" text NOT NULL,
  "rationale" text NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "user_confirmed" boolean DEFAULT false NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "equivalency_type_check" CHECK ("equivalency_type" IN (
    'direct','adjacent','transferable','academic_project','personal_project',
    'volunteering','internship','apprenticeship','not_supported')),
  CONSTRAINT "coverage_level_check" CHECK ("coverage_level" IN (
    'full','partial','onboarding_learnable','critical_gap','formal_blocker'))
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equivalency_user_idx" ON "experience_equivalencies" ("user_id")
--> statement-breakpoint

-- ── Überqualifikation ─────────────────────────────────────────────
--
-- Wer viel kann, wird aus einfacheren Rollen herausgefiltert und weiss
-- nicht warum. Das Produkt filtert deshalb nicht, sondern benennt: dein
-- Erfahrungsniveau liegt über der ausgeschriebenen Seniorität, und das
-- ist erklärungsbedürftig.
CREATE TABLE IF NOT EXISTS "seniority_alignment_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "user_seniority_estimate" text,
  "job_seniority_estimate" text,
  "alignment_status" text NOT NULL,
  "risk_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "motivation_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "motivation_statement" text,
  "motivation_confirmed" boolean DEFAULT false NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "alignment_status_check" CHECK ("alignment_status" IN (
    'aligned','stretch','entry_gap','potentially_overqualified','career_change','unclear'))
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seniority_alignment_unique"
  ON "seniority_alignment_assessments" ("user_id", "job_id")
--> statement-breakpoint

-- ── Bewerbungsaufwand ─────────────────────────────────────────────
--
-- Zwei fachlich gleiche Stellen können 5 oder 60 Minuten kosten. Diese
-- Zahl gehört vor die Entscheidung, nicht dahinter.
--
-- Bewusst NICHT hier: eine Einstellungswahrscheinlichkeit.
CREATE TABLE IF NOT EXISTS "application_effort_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "account_required" boolean,
  "cv_required" boolean,
  "cover_letter_required" boolean,
  "manual_work_history_required" boolean,
  "screening_questions_count" integer,
  "free_text_questions_count" integer,
  "portfolio_required" boolean,
  "certificate_upload_required" boolean,
  "assessment_likely" boolean,
  "video_required" boolean,
  "estimated_minutes_min" integer,
  "estimated_minutes_max" integer,
  "effort_source" text NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "last_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "effort_source_check" CHECK ("effort_source" IN (
    'provider_data','employer_data','user_reported','historical_aggregate','inferred','unknown'))
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "effort_job_unique" ON "application_effort_profiles" ("job_id")
--> statement-breakpoint

-- ── Bedingungsmatrix ──────────────────────────────────────────────
--
-- Was ist bestätigt, was ist unklar, was steht im Widerspruch. Vor der
-- Bewerbung, nicht im vierten Gespräch.
CREATE TABLE IF NOT EXISTS "job_condition_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "condition_key" text NOT NULL,
  "value_text" text,
  "status" text NOT NULL,
  "source_url" text,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  CONSTRAINT "condition_status_check" CHECK ("status" IN (
    'confirmed','ambiguous','unknown','not_applicable'))
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "condition_job_key_unique"
  ON "job_condition_facts" ("job_id", "condition_key")
--> statement-breakpoint

-- ── Bewerbungspass ────────────────────────────────────────────────
--
-- Dieselben Angaben zum zwanzigsten Mal einzutippen ist der Teil der
-- Jobsuche, der am wenigsten Sinn hat und am meisten Kraft kostet.
--
-- `sensitive` steht standardmässig auf true für alles, was es sein
-- könnte: ein Feld, das versehentlich als unsensibel angelegt wird,
-- wird versehentlich mitgeschickt.
CREATE TABLE IF NOT EXISTS "candidate_passport_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "field_key" text NOT NULL,
  "label" text NOT NULL,
  "value_text" text,
  "category" text NOT NULL,
  "sensitive" boolean DEFAULT true NOT NULL,
  "include_by_default" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passport_user_field_unique"
  ON "candidate_passport_fields" ("user_id", "field_key")
--> statement-breakpoint

-- Jede Verwendung wird protokolliert. Ohne dieses Protokoll ist
-- "du kontrollierst deine Daten" eine Behauptung ohne Nachweis.
CREATE TABLE IF NOT EXISTS "candidate_passport_uses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
  "field_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "purpose" text NOT NULL,
  "confirmed_by_user" boolean DEFAULT false NOT NULL,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passport_uses_user_idx" ON "candidate_passport_uses" ("user_id", "used_at")
--> statement-breakpoint

-- ── Prozesstransparenz ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hiring_process_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid REFERENCES "companies"("id") ON DELETE cascade,
  "job_family" text,
  "country" text,
  "stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_type" text NOT NULL,
  "source_url" text,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "last_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint

-- Eigene Beobachtungen der Person. Sie fliessen nur in Aggregate ein,
-- wenn sie es ausdrücklich erlaubt.
CREATE TABLE IF NOT EXISTS "application_process_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE cascade,
  "company_id" uuid REFERENCES "companies"("id") ON DELETE set null,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
  "submitted_at" timestamp with time zone,
  "acknowledged_at" timestamp with time zone,
  "first_human_response_at" timestamp with time zone,
  "interview_at" timestamp with time zone,
  "final_decision_at" timestamp with time zone,
  "outcome" text,
  "user_consent_for_aggregation" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_obs_user_idx" ON "application_process_observations" ("user_id")
--> statement-breakpoint

-- Aggregate über Unternehmen. `publishable` wird nur wahr, wenn die
-- Mindeststichprobe erreicht ist — sonst wäre eine einzelne Person aus
-- der Zahl rekonstruierbar.
CREATE TABLE IF NOT EXISTS "employer_process_aggregates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "country" text,
  "job_family" text,
  "sample_size" integer DEFAULT 0 NOT NULL,
  "observation_window_start" timestamp with time zone,
  "observation_window_end" timestamp with time zone,
  "median_acknowledgement_days" double precision,
  "median_first_response_days" double precision,
  "median_process_days" double precision,
  "no_response_share" double precision,
  "confidence" double precision DEFAULT 0.3 NOT NULL,
  "publishable" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint

-- ── Unternehmen im Blick ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "target_companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "company_id" uuid REFERENCES "companies"("id") ON DELETE set null,
  "company_name" text NOT NULL,
  "company_domain" text,
  "why_interesting" text,
  "notify" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "target_companies_user_idx" ON "target_companies" ("user_id")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "watchlist_job_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "target_company_id" uuid REFERENCES "target_companies"("id") ON DELETE cascade,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE cascade,
  "event_type" text NOT NULL,
  "seen_by_user" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watchlist_events_user_idx" ON "watchlist_job_events" ("user_id", "created_at")
--> statement-breakpoint

-- Wann eine Stelle wo zuerst auftauchte. Kein Versprechen, dass frühes
-- Bewerben hilft — aber eine Antwort auf "seit wann läuft das schon".
CREATE TABLE IF NOT EXISTS "job_source_timing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "source_id" uuid REFERENCES "job_sources"("id") ON DELETE set null,
  "first_seen_at_source" timestamp with time zone,
  "first_seen_by_paycheck" timestamp with time zone DEFAULT now() NOT NULL,
  "first_seen_at_aggregator" timestamp with time zone,
  "source_delay_hours" double precision,
  "confidence" double precision DEFAULT 0.5 NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_source_timing_job_idx" ON "job_source_timing" ("job_id")
--> statement-breakpoint

-- ── Suchkanäle und Kontakte ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "search_channel_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "channel" text NOT NULL,
  "activity_type" text NOT NULL,
  "outcome" text,
  "note" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_activity_user_idx" ON "search_channel_activities" ("user_id", "occurred_at")
--> statement-breakpoint

-- Kontakte kommen ausschliesslich von der Person selbst. Es gibt keinen
-- Codepfad, der sie irgendwo herausliest.
CREATE TABLE IF NOT EXISTS "networking_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "target_company_id" uuid REFERENCES "target_companies"("id") ON DELETE set null,
  "display_name" text NOT NULL,
  "relationship" text NOT NULL,
  "context_note" text,
  "contact_channel" text,
  "provided_by_user" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "networking_contacts_user_idx" ON "networking_contacts" ("user_id")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "networking_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "contact_id" uuid REFERENCES "networking_contacts"("id") ON DELETE cascade,
  "draft_text" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "sent_confirmed_by_user" boolean DEFAULT false NOT NULL,
  "response_received" boolean DEFAULT false NOT NULL,
  "insight_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "networking_status_check" CHECK ("status" IN (
    'draft','sent','answered','no_response','closed'))
)
--> statement-breakpoint

-- ── Suchprojekt ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "search_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "week_start" date NOT NULL,
  "search_mode" text NOT NULL,
  "hours_available" double precision,
  "target_applications" integer,
  "pause_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "load_rating" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "search_plans_user_week_unique"
  ON "search_plans" ("user_id", "week_start")
--> statement-breakpoint

-- ── Belegqualität ─────────────────────────────────────────────────
--
-- Nicht global-nutzerbezogen: ein Verzeichnis, das sagt, welchen
-- Belegwert eine Quelle hat. Ein Forenbeitrag erzeugt eine Hypothese,
-- eine amtliche Statistik trägt eine Aussage.
CREATE TABLE IF NOT EXISTS "research_evidence_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "publisher" text,
  "author" text,
  "publication_date" date,
  "url" text,
  "evidence_type" text NOT NULL,
  "geography" text,
  "population" text,
  "sample_size" integer,
  "method_summary" text,
  "commercial_interest" text,
  "limitations" text,
  "quality_tier" text NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text,
  "allowed_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "disallowed_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evidence_type_check" CHECK ("evidence_type" IN (
    'official_statistics','peer_reviewed_research','working_paper','institutional_report',
    'company_sponsored_survey','journalism','industry_article','user_review',
    'forum_or_social_anecdote')),
  CONSTRAINT "quality_tier_check" CHECK ("quality_tier" IN (
    'high','moderate','context_only','anecdotal','unverified'))
)
--> statement-breakpoint

-- ── Anforderungen genauer fassen ──────────────────────────────────
--
-- "Zwei Jahre Erfahrung" und "Führerschein Klasse C" stehen in derselben
-- Aufzählung und sind völlig verschiedene Dinge. Ohne diese Spalten
-- behandelt das Produkt beide gleich — und filtert Menschen aus, die
-- die Stelle bekommen könnten.
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "requirement_type" text
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "requirement_strength" text
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "explicit_or_inferred" text
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "minimum_years" double precision
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "preferred_years" double precision
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "equivalent_experience_allowed" boolean
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "degree_substitution_possible" boolean
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "onboarding_learnable" boolean
--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "classification_confidence" double precision
