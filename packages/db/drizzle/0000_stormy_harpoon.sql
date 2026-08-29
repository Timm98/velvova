CREATE TYPE "public"."ai_run_status" AS ENUM('ok', 'failed', 'timeout', 'budget_exceeded', 'refused');--> statement-breakpoint
CREATE TYPE "public"."application_event_type" AS ENUM('job_viewed', 'job_saved', 'application_started', 'application_sent', 'acknowledged', 'response_received', 'interview_scheduled', 'interview_held', 'offer_received', 'rejected', 'withdrawn', 'accepted', 'fit_check_30', 'fit_check_60', 'fit_check_90');--> statement-breakpoint
CREATE TYPE "public"."application_stage" AS ENUM('saved', 'preparing', 'sent', 'acknowledged', 'interview', 'offer', 'rejected', 'withdrawn', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."apply_method" AS ENUM('email', 'portal', 'form', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."artifact_kind" AS ENUM('cv_ats', 'cv_designed', 'cover_letter', 'application_email', 'portal_answers', 'recruiter_message', 'attachment_list', 'portfolio_checklist');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('supported', 'unsupported', 'weakened', 'user_override');--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM('career_profile', 'document_analysis', 'voice_input', 'transcript_storage', 'external_ai_processing', 'model_training', 'partner_sharing');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('permanent', 'fixed_term', 'internship', 'working_student', 'apprenticeship', 'freelance', 'temp_agency');--> statement-breakpoint
CREATE TYPE "public"."entry_realism" AS ENUM('direct', 'with_bridge', 'longer_path', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."evidence_relation" AS ENUM('demonstrates', 'supports', 'contradicts', 'prefers', 'avoids', 'requires', 'transfers_to', 'maps_to', 'derived_from');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('experience_episode', 'action', 'result', 'skill', 'knowledge', 'tool', 'qualification', 'preference', 'motive', 'constraint', 'work_environment', 'role', 'occupation', 'evidence_source');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('entry', 'junior', 'mid', 'senior', 'lead');--> statement-breakpoint
CREATE TYPE "public"."integration_kind" AS ENUM('email_gmail', 'email_outlook', 'storage_s3', 'job_api', 'review_api');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('not_connected', 'connected', 'error', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."interview_stage" AS ENUM('consent_and_goal', 'current_situation', 'background', 'experience_episodes', 'tasks_and_energy', 'feedback_and_recognition', 'work_style_and_environment', 'values_and_motives', 'hard_constraints', 'location_and_logistics', 'learning_goals', 'micro_work_samples', 'synthesis', 'user_confirmation', 'role_clusters');--> statement-breakpoint
CREATE TYPE "public"."job_source_kind" AS ENUM('licensed_api', 'employer_feed', 'partner', 'user_url', 'user_text', 'seed');--> statement-breakpoint
CREATE TYPE "public"."license_status" AS ENUM('licensed', 'public_link_only', 'user_provided', 'demo', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('de', 'en');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_kind" AS ENUM('export', 'delete_item', 'delete_account', 'withdraw_consent');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_status" AS ENUM('open', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."requirement_kind" AS ENUM('must', 'nice');--> statement-breakpoint
CREATE TYPE "public"."retention_class" AS ENUM('session_only', 'profile', 'legal_minimum');--> statement-breakpoint
CREATE TYPE "public"."review_source_kind" AS ENUM('employee_reviews', 'customer_reviews', 'employer_statement', 'official_registry', 'journalistic', 'regulatory', 'user_report');--> statement-breakpoint
CREATE TYPE "public"."role_cluster_kind" AS ENUM('obvious', 'adjacent', 'niche');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('year', 'month', 'hour');--> statement-breakpoint
CREATE TYPE "public"."sensitivity" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'negative', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'paused', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('user_stated', 'user_confirmed', 'document_extract', 'ai_hypothesis', 'external_source', 'work_sample');--> statement-breakpoint
CREATE TYPE "public"."taxonomy" AS ENUM('esco', 'kldb', 'internal');--> statement-breakpoint
CREATE TYPE "public"."turn_role" AS ENUM('assistant', 'user', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('candidate', 'operator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."work_model" AS ENUM('on_site', 'hybrid', 'remote');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"subject_user_id" uuid,
	"action" text NOT NULL,
	"justification" text,
	"break_glass" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "consent_kind" NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"purpose" text NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "integration_kind" NOT NULL,
	"status" "integration_status" DEFAULT 'not_connected' NOT NULL,
	"display_name" text,
	"credentials_encrypted" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connected_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text DEFAULT 'login' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"can_see_individual_profiles" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'institution' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "privacy_request_kind" NOT NULL,
	"status" "privacy_request_status" DEFAULT 'open' NOT NULL,
	"target_ref" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"result_ref" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"device_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locale" "locale" DEFAULT 'de' NOT NULL,
	"country" text DEFAULT 'DE' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"base_location" text,
	"search_radius_km" integer,
	"max_commute_minutes" integer,
	"commute_mode" text DEFAULT 'public_transport' NOT NULL,
	"willing_to_relocate" boolean DEFAULT false NOT NULL,
	"notification_email" boolean DEFAULT true NOT NULL,
	"notification_push" boolean DEFAULT false NOT NULL,
	"microphone_enabled" boolean DEFAULT false NOT NULL,
	"fit_weights" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"role" "user_role" DEFAULT 'candidate' NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "career_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"career_compass" text,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone,
	"coverage" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"relation" "evidence_relation" NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid,
	"type" "evidence_type" NOT NULL,
	"statement" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_ref" text,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"user_confirmed" boolean DEFAULT false NOT NULL,
	"user_rejected" boolean DEFAULT false NOT NULL,
	"sensitivity_level" "sensitivity" DEFAULT 'normal' NOT NULL,
	"retention_class" "retention_class" DEFAULT 'profile' NOT NULL,
	"statement_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"organisation" text,
	"kind" text DEFAULT 'job' NOT NULL,
	"started_on" timestamp with time zone,
	"ended_on" timestamp with time zone,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text DEFAULT 'text' NOT NULL,
	"locale" "locale" DEFAULT 'de' NOT NULL,
	"stage" "interview_stage" DEFAULT 'consent_and_goal' NOT NULL,
	"completed_stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skipped_stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"role" "turn_role" NOT NULL,
	"stage" "interview_stage" NOT NULL,
	"question_key" text,
	"content" text NOT NULL,
	"from_voice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "micro_assessment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assessment_key" text NOT NULL,
	"response" text NOT NULL,
	"criterion_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feedback" text,
	"user_accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "micro_assessments" (
	"key" text PRIMARY KEY NOT NULL,
	"title_de" text NOT NULL,
	"title_en" text NOT NULL,
	"purpose_de" text NOT NULL,
	"purpose_en" text NOT NULL,
	"rubric" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_minutes" integer DEFAULT 4 NOT NULL,
	"prompt_de" text NOT NULL,
	"prompt_en" text NOT NULL,
	"accessible_alternative_de" text
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"key" text PRIMARY KEY NOT NULL,
	"label_de" text NOT NULL,
	"label_en" text NOT NULL,
	"synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"esco_uri" text,
	"kldb_code" text,
	"taxonomy" "taxonomy" DEFAULT 'internal' NOT NULL,
	"taxonomy_version" text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"rank" integer,
	"evidence_item_id" uuid
);
--> statement-breakpoint
CREATE TABLE "profile_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_key" text NOT NULL,
	"self_assessed_level" integer,
	"evidence_item_id" uuid,
	"user_confirmed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"supporting_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"critical_constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entry_realism" "entry_realism" DEFAULT 'unclear' NOT NULL,
	"next_validation_step" text NOT NULL,
	"kind" "role_cluster_kind" DEFAULT 'obvious' NOT NULL,
	"esco_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kldb_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_hypotheses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cluster_id" uuid,
	"occupation_key" text,
	"statement" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"key" text PRIMARY KEY NOT NULL,
	"label_de" text NOT NULL,
	"label_en" text NOT NULL,
	"synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kind" text DEFAULT 'technical' NOT NULL,
	"related_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"esco_uri" text,
	"taxonomy" "taxonomy" DEFAULT 'internal' NOT NULL,
	"taxonomy_version" text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_constraints" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"industry" text,
	"size_band" text,
	"headquarters" text,
	"registry_verified" boolean DEFAULT false NOT NULL,
	"registry_ref" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_kind" "review_source_kind" NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"license_status" "license_status" DEFAULT 'public_link_only' NOT NULL,
	"attribution_text" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"fit_score" integer,
	"fit_band" text NOT NULL,
	"fit_coverage" double precision DEFAULT 0 NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"job_quality_score" integer,
	"listing_confidence_score" integer DEFAULT 0 NOT NULL,
	"ai_transition_category" text DEFAULT 'unclear_data' NOT NULL,
	"overall_score" integer,
	"constraint_verdict" text DEFAULT 'uncertain' NOT NULL,
	"top_reason" text DEFAULT '' NOT NULL,
	"top_reservation" text DEFAULT '' NOT NULL,
	"scoring_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" "requirement_kind" NOT NULL,
	"text" text NOT NULL,
	"skill_key" text,
	"category" text DEFAULT 'other' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" "job_source_kind" NOT NULL,
	"license_status" "license_status" DEFAULT 'unclear' NOT NULL,
	"attribution_required" boolean DEFAULT false NOT NULL,
	"attribution_text" text,
	"terms_url" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_ok" boolean,
	"last_run_error" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company_id" uuid NOT NULL,
	"location" text NOT NULL,
	"country" text DEFAULT 'DE' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"work_model" "work_model" NOT NULL,
	"remote_percent" integer,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text DEFAULT 'EUR' NOT NULL,
	"salary_period" "salary_period" DEFAULT 'year' NOT NULL,
	"salary_disclosed" boolean DEFAULT false NOT NULL,
	"contract_type" "contract_type",
	"weekly_hours" double precision,
	"shift_work" boolean,
	"travel_percent" integer,
	"experience_level" "experience_level",
	"industry" text,
	"language_requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"required_licenses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"work_permit_required" boolean,
	"core_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"apply_method" "apply_method" DEFAULT 'unknown' NOT NULL,
	"apply_target" text,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_link_check_at" timestamp with time zone,
	"last_link_check_ok" boolean,
	"original_url" text,
	"source_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"score_kind" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"raw" double precision,
	"weight" double precision NOT NULL,
	"contribution" double precision DEFAULT 0 NOT NULL,
	"explanation" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_kind" "review_source_kind" NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"rating_average" double precision,
	"rating_scale_max" double precision DEFAULT 5 NOT NULL,
	"sample_size" integer,
	"location_scope" text,
	"role_scope" text,
	"period_from" timestamp with time zone,
	"period_to" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attribution_text" text,
	"selection_note" text,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"theme" text NOT NULL,
	"sentiment" "sentiment" NOT NULL,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"summary" text NOT NULL,
	"source_url" text,
	"period_from" timestamp with time zone,
	"period_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"source_kind" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"license_note" text
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"job_id" uuid,
	"type" "application_event_type" NOT NULL,
	"role_cluster_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"stage" "application_stage" DEFAULT 'saved' NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_step_at" timestamp with time zone,
	"next_step_label" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"day_mark" integer NOT NULL,
	"promise_vs_reality" text,
	"task_energy" text,
	"leadership_and_team" text,
	"learning_opportunities" text,
	"overall_fit" integer,
	"shared_with_partner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"claim_text" text NOT NULL,
	"evidence_item_id" uuid,
	"status" "claim_status" DEFAULT 'unsupported' NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaching_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"relevance" text,
	"structure" text,
	"concrete_evidence" text,
	"clarity" text,
	"missing_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaching_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"job_id" uuid,
	"mode" text DEFAULT 'practice' NOT NULL,
	"channel" text DEFAULT 'text' NOT NULL,
	"locale" "locale" DEFAULT 'de' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "coaching_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"question_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"confirmed_by_user_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"artifact_versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"malware_scan_status" text DEFAULT 'pending' NOT NULL,
	"malware_scan_at" timestamp with time zone,
	"extracted_text" text,
	"retain_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generated_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "artifact_kind" NOT NULL,
	"locale" "locale" DEFAULT 'de' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"prompt_version" text,
	"ai_run_id" uuid,
	"approved_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"base_salary" integer,
	"bonus" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"vacation_days" integer,
	"weekly_hours" double precision,
	"remote_percent" integer,
	"start_date" timestamp with time zone,
	"probation_months" integer,
	"other_benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision_deadline" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"kind" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"label" text NOT NULL,
	"draft_message" text,
	"dismissed_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_key" text,
	"prompt_version" text,
	"status" "ai_run_status" DEFAULT 'ok' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_eur_cents" integer,
	"latency_ms" integer,
	"error_message" text,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_key" text NOT NULL,
	"name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag_overrides" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"deduplicated" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"duration_ms" double precision
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"notes" text,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_edges" ADD CONSTRAINT "evidence_edges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_edges" ADD CONSTRAINT "evidence_edges_from_id_evidence_items_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_edges" ADD CONSTRAINT "evidence_edges_to_id_evidence_items_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_profile_id_career_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_assessment_results" ADD CONSTRAINT "micro_assessment_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_assessment_results" ADD CONSTRAINT "micro_assessment_results_assessment_key_micro_assessments_key_fk" FOREIGN KEY ("assessment_key") REFERENCES "public"."micro_assessments"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_skill_key_skills_key_fk" FOREIGN KEY ("skill_key") REFERENCES "public"."skills"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_clusters" ADD CONSTRAINT "role_clusters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_hypotheses" ADD CONSTRAINT "role_hypotheses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_hypotheses" ADD CONSTRAINT "role_hypotheses_cluster_id_role_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."role_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_hypotheses" ADD CONSTRAINT "role_hypotheses_occupation_key_occupations_key_fk" FOREIGN KEY ("occupation_key") REFERENCES "public"."occupations"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_constraints" ADD CONSTRAINT "user_constraints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_sources" ADD CONSTRAINT "company_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_snapshots" ADD CONSTRAINT "job_snapshots_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_snapshots" ADD CONSTRAINT "job_snapshots_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_factors" ADD CONSTRAINT "match_factors_match_id_job_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."job_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_aggregates" ADD CONSTRAINT "review_aggregates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_themes" ADD CONSTRAINT "review_themes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_themes" ADD CONSTRAINT "review_themes_aggregate_id_review_aggregates_id_fk" FOREIGN KEY ("aggregate_id") REFERENCES "public"."review_aggregates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_role_cluster_id_role_clusters_id_fk" FOREIGN KEY ("role_cluster_id") REFERENCES "public"."role_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_artifact_id_generated_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."generated_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_turn_id_coaching_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."coaching_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_turns" ADD CONSTRAINT "coaching_turns_session_id_coaching_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coaching_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_subject_idx" ON "audit_logs" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_unique" ON "auth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "consents_user_kind_idx" ON "consents" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_user_kind_unique" ON "integrations" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_unique" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_unique" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "evidence_edges_from_idx" ON "evidence_edges" USING btree ("from_id");--> statement-breakpoint
CREATE INDEX "evidence_user_idx" ON "evidence_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "evidence_confirmed_idx" ON "evidence_items" USING btree ("user_id","user_confirmed");--> statement-breakpoint
CREATE INDEX "interview_sessions_user_idx" ON "interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_turns_session_idx" ON "interview_turns" USING btree ("session_id","index");--> statement-breakpoint
CREATE INDEX "preferences_user_kind_idx" ON "preferences" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "profile_skills_user_idx" ON "profile_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_clusters_user_idx" ON "role_clusters" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_matches_unique" ON "job_matches" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "job_matches_user_idx" ON "job_matches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_requirements_job_idx" ON "job_requirements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_snapshots_job_idx" ON "job_snapshots" USING btree ("job_id","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_key_unique" ON "job_sources" USING btree ("key");--> statement-breakpoint
CREATE INDEX "jobs_content_hash_idx" ON "jobs" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "jobs_published_idx" ON "jobs" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "match_factors_match_idx" ON "match_factors" USING btree ("match_id","score_kind");--> statement-breakpoint
CREATE INDEX "review_aggregates_company_idx" ON "review_aggregates" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_jobs_unique" ON "saved_jobs" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "source_citations_subject_idx" ON "source_citations" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "application_events_user_idx" ON "application_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "applications_user_stage_idx" ON "applications" USING btree ("user_id","stage");--> statement-breakpoint
CREATE INDEX "claim_links_artifact_idx" ON "claim_evidence_links" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "coaching_turns_session_idx" ON "coaching_turns" USING btree ("session_id","index");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_artifacts_app_idx" ON "generated_artifacts" USING btree ("application_id","kind","version");--> statement-breakpoint
CREATE INDEX "reminders_user_due_idx" ON "reminders" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "ai_runs_created_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_status_idx" ON "ai_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_unique" ON "prompt_versions" USING btree ("key","version");