-- Addendum V5.2 — Application Bridge, Job Briefs, Vertrauen.
--
-- Die technische Wahrheit, um die sich der grösste Teil dieser
-- Migration dreht: eine Webseite kann keine Formularfelder auf einer
-- fremden Domain ausfüllen. Browser trennen Origins, und das ist
-- richtig so.
--
-- Ein Produkt, das "wir bewerben uns für dich" verspricht, verspricht
-- also entweder etwas, das es nicht kann, oder es umgeht etwas, das es
-- nicht umgehen darf. Beides scheidet aus.
--
-- Was bleibt, ist eine ehrliche Brücke: alles vorbereiten, prüfbar
-- machen, übergeben — und den Status erst ändern, wenn es einen Beleg
-- dafür gibt.

-- ── Was auf welchem Weg möglich ist ───────────────────────────────
CREATE TABLE IF NOT EXISTS "apply_capabilities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_key" text NOT NULL,
  "employer_board_id" uuid REFERENCES "employer_boards"("id") ON DELETE cascade,
  "country_code" text,
  "apply_mode" text NOT NULL,
  "authorization_status" text NOT NULL,
  "authorization_reference" text,
  "supports_screening_questions" boolean DEFAULT false NOT NULL,
  "supports_resume_upload" boolean DEFAULT false NOT NULL,
  "supports_cover_letter_upload" boolean DEFAULT false NOT NULL,
  "supports_additional_documents" boolean DEFAULT false NOT NULL,
  "supports_status_sync" boolean DEFAULT false NOT NULL,
  "requires_partner_oauth" boolean DEFAULT false NOT NULL,
  "user_confirmation_required" boolean DEFAULT true NOT NULL,
  -- Bleibt false. Es gibt keinen Codepfad, der das setzt.
  "auto_submit_allowed" boolean DEFAULT false NOT NULL,
  "allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "legal_reviewed_at" timestamp with time zone,
  "technical_reviewed_at" timestamp with time zone,
  "enabled" boolean DEFAULT false NOT NULL,
  "kill_switch_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "apply_mode_check" CHECK ("apply_mode" IN (
    'native_apply','embedded_partner_apply','prepared_redirect',
    'apply_companion','manual_only','email_draft')),
  CONSTRAINT "authorization_status_check" CHECK ("authorization_status" IN (
    'authorized','pending_review','not_authorized','revoked')),
  -- Als Regel in der Datenbank, nicht nur als Vorsatz im Code.
  CONSTRAINT "no_auto_submit" CHECK ("auto_submit_allowed" = false)
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apply_capabilities_unique"
  ON "apply_capabilities" ("source_key", COALESCE("country_code", ''))
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "external_form_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain" text NOT NULL,
  "ats_type" text,
  "form_version" text,
  "detected_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "required_documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "field_mapping_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_verified_at" timestamp with time zone,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "extension_assistance_allowed" boolean DEFAULT false NOT NULL,
  "legal_status" text DEFAULT 'pending_review' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_form_domain_unique"
  ON "external_form_profiles" ("domain")
--> statement-breakpoint

-- ── Das Bewerbungspaket ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "application_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE cascade,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "apply_mode" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "language" text DEFAULT 'de' NOT NULL,
  "readiness" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "estimated_minutes_min" integer,
  "estimated_minutes_max" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "package_status_check" CHECK ("status" IN (
    'draft','ready','handed_off','confirmed_sent','abandoned'))
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_packages_user_idx"
  ON "application_packages" ("user_id", "job_id")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "application_package_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "artifact_id" uuid REFERENCES "generated_artifacts"("id") ON DELETE set null,
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "content_hash" text,
  "approved_by_user" boolean DEFAULT false NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "application_screening_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  -- Die Frage im Wortlaut der Anzeige. Umformuliert wäre sie eine
  -- andere Frage, und die Antwort passte nicht mehr dazu.
  "question_text" text NOT NULL,
  "question_kind" text DEFAULT 'free_text' NOT NULL,
  "draft_answer" text,
  "final_answer" text,
  "evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "approved_by_user" boolean DEFAULT false NOT NULL,
  -- Freiwillige Angaben (Diversität u. ä.) werden nie vorbelegt und
  -- nie aus etwas abgeleitet.
  "voluntary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint

-- Die Übergabe an die fremde Seite. Ein Ereignis, keine Behauptung
-- über den Ausgang.
CREATE TABLE IF NOT EXISTS "application_handoffs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "apply_mode" text NOT NULL,
  "target_url" text,
  "handed_off_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Wird erst gesetzt, wenn ein Mensch bestätigt oder eine API es
  -- meldet. Ein Redirect allein bedeutet gar nichts.
  "user_confirmation" text,
  "confirmed_at" timestamp with time zone,
  "external_reference" text,
  CONSTRAINT "handoff_confirmation_check" CHECK ("user_confirmation" IS NULL OR "user_confirmation" IN (
    'sent','not_yet','aborted','later'))
)
--> statement-breakpoint

-- ── Job Briefs ────────────────────────────────────────────────────
--
-- Drei Ebenen, im Datenmodell getrennt: was die Quelle sagt, was wir
-- normalisiert haben, was Nina daraus schliesst. Vermischt man sie,
-- liest sich eine Vermutung wie eine Zusage des Arbeitgebers.
CREATE TABLE IF NOT EXISTS "job_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  -- Nur bei private_user_only gesetzt: dann gehört der Brief einer
  -- Person und erscheint in keinem öffentlichen Bestand.
  "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "audience" text NOT NULL,
  "language" text DEFAULT 'de' NOT NULL,
  "brief_type" text NOT NULL,
  "headline" text,
  "summary" text,
  "source_policy_version" text NOT NULL,
  "prompt_version" text,
  "model_run_id" uuid REFERENCES "ai_runs"("id") ON DELETE set null,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "review_status" text DEFAULT 'auto' NOT NULL,
  "content_hash" text,
  CONSTRAINT "brief_audience_check" CHECK ("audience" IN (
    'public','authenticated','private_user_only')),
  -- Ein privater Brief ohne Eigentümer wäre öffentlich. Die Regel
  -- steht in der Datenbank, nicht nur im Anwendungscode.
  CONSTRAINT "private_brief_needs_owner" CHECK (
    "audience" <> 'private_user_only' OR "user_id" IS NOT NULL)
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_briefs_job_idx" ON "job_briefs" ("job_id", "audience")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_brief_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "brief_id" uuid NOT NULL REFERENCES "job_briefs"("id") ON DELETE cascade,
  "field_name" text NOT NULL,
  "value_text" text,
  "layer" text NOT NULL,
  "source_url" text,
  "observed_at" timestamp with time zone,
  "transformation_type" text NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  CONSTRAINT "brief_layer_check" CHECK ("layer" IN (
    'source_fact','normalized_fact','nina_interpretation')),
  CONSTRAINT "transformation_check" CHECK ("transformation_type" IN (
    'verbatim_licensed','normalized','summarized','inferred','user_supplied','unknown'))
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brief_facts_brief_idx" ON "job_brief_facts" ("brief_id", "layer")
--> statement-breakpoint

-- ── Identitäten ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "connected_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "email" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connected_identities_unique"
  ON "connected_identities" ("provider", "provider_account_id")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "auth_identity_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "event" text NOT NULL,
  "provider" text,
  "detail" text,
  "ip_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint

-- ── E-Mail ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  -- Sicherheitsmails sind keine Präferenz. Die Spalte existiert, damit
  -- niemand auf die Idee kommt, sie wie Marketing zu behandeln.
  "security_email" boolean DEFAULT true NOT NULL,
  "product_updates" boolean DEFAULT false NOT NULL,
  "job_alerts" boolean DEFAULT false NOT NULL,
  "application_reminders" boolean DEFAULT false NOT NULL,
  "career_checkins" boolean DEFAULT false NOT NULL,
  "marketing" boolean DEFAULT false NOT NULL,
  "frequency" text DEFAULT 'weekly' NOT NULL,
  "quiet_hours_start" integer,
  "quiet_hours_end" integer,
  "timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "security_email_always_on" CHECK ("security_email" = true)
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_preferences_user_unique"
  ON "email_preferences" ("user_id")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "purpose" text NOT NULL,
  "consent_status" text DEFAULT 'pending' NOT NULL,
  "consent_text_version" text NOT NULL,
  "source" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "withdrawn_at" timestamp with time zone,
  "confirmation_token_hash" text,
  "ip_hash" text,
  "user_agent_hash" text,
  CONSTRAINT "consent_status_check" CHECK ("consent_status" IN (
    'pending','confirmed','withdrawn','bounced'))
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_consents_email_idx" ON "email_consents" ("email", "purpose")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "template_key" text NOT NULL,
  "purpose" text NOT NULL,
  "provider_message_id" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "bounced_at" timestamp with time zone,
  "complained_at" timestamp with time zone,
  "unsubscribed_at" timestamp with time zone,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_suppression_list" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppression_email_unique"
  ON "email_suppression_list" ("email")
--> statement-breakpoint

-- ── Rückmeldungen ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "feedback_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "anonymous_session_id" text,
  "category" text NOT NULL,
  "severity" text DEFAULT 'normal' NOT NULL,
  "title" text,
  "message" text NOT NULL,
  "route" text,
  "feature_key" text,
  "workflow_state" text,
  "job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
  "app_version" text,
  "browser" text,
  "device_type" text,
  "consent_to_contact" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feedback_category_check" CHECK ("category" IN (
    'bug','wrong_job','wrong_nina_statement','missing_feature','confusing_ui',
    'application_problem','privacy','idea','praise','other'))
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback_items" ("status", "created_at")
--> statement-breakpoint

-- ── Wissen und Rechtstexte ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "audience" text DEFAULT 'public' NOT NULL,
  "language" text DEFAULT 'de' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "knowledge_audience_check" CHECK ("audience" IN ('public','authenticated','internal'))
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_slug_lang_unique"
  ON "knowledge_documents" ("slug", "language")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "language" text DEFAULT 'de' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  -- Ein Rechtstext ohne juristische Freigabe darf nicht als fertig
  -- erscheinen. Der Zustand steht hier und wird beim Rendern geprüft.
  "review_status" text DEFAULT 'draft' NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "missing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_review_status_check" CHECK ("review_status" IN (
    'draft','legal_review_required','approved','published'))
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_slug_lang_unique"
  ON "legal_documents" ("slug", "language")
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "asset_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_key" text NOT NULL,
  "filename" text NOT NULL,
  "origin" text NOT NULL,
  "license" text NOT NULL,
  "creator" text,
  "created_on" date,
  "ai_generated" boolean DEFAULT false NOT NULL,
  "generation_reference" text,
  "alt_text" text NOT NULL,
  "allowed_usage" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_key_unique" ON "asset_registry" ("asset_key")
