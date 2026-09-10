import { pgEnum } from "drizzle-orm/pg-core";

/** Aufzählungen der Datenbank. Spiegeln die Typen aus @paycheck/domain. */

export const localeEnum = pgEnum("locale", ["de", "en"]);
export const userRoleEnum = pgEnum("user_role", ["candidate", "operator", "admin"]);

export const sourceTypeEnum = pgEnum("source_type", [
  "user_stated", "user_confirmed", "document_extract",
  "ai_hypothesis", "external_source", "work_sample",
]);
export const evidenceTypeEnum = pgEnum("evidence_type", [
  "experience_episode", "action", "result", "skill", "knowledge", "tool",
  "qualification", "preference", "motive", "constraint", "work_environment",
  "role", "occupation", "evidence_source",
]);
export const evidenceRelationEnum = pgEnum("evidence_relation", [
  "demonstrates", "supports", "contradicts", "prefers", "avoids",
  "requires", "transfers_to", "maps_to", "derived_from",
]);
export const sensitivityEnum = pgEnum("sensitivity", ["low", "normal", "high"]);
export const retentionClassEnum = pgEnum("retention_class", ["session_only", "profile", "legal_minimum"]);

export const interviewStageEnum = pgEnum("interview_stage", [
  "consent_and_goal", "current_situation", "background", "experience_episodes",
  "tasks_and_energy", "feedback_and_recognition", "work_style_and_environment",
  "values_and_motives", "hard_constraints", "location_and_logistics",
  "learning_goals", "micro_work_samples", "synthesis", "user_confirmation", "role_clusters",
]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "paused", "completed", "abandoned"]);
export const turnRoleEnum = pgEnum("turn_role", ["assistant", "user", "system"]);

export const workModelEnum = pgEnum("work_model", ["on_site", "hybrid", "remote"]);
export const contractTypeEnum = pgEnum("contract_type", [
  "permanent", "fixed_term", "internship", "working_student",
  "apprenticeship", "freelance", "temp_agency",
]);
export const experienceLevelEnum = pgEnum("experience_level", ["entry", "junior", "mid", "senior", "lead"]);
export const requirementKindEnum = pgEnum("requirement_kind", ["must", "nice"]);
export const salaryPeriodEnum = pgEnum("salary_period", ["year", "month", "hour"]);

/**
 * Woher eine Gehaltsangabe stammt.
 *
 * Kein Vertrauensmass, sondern eine Herkunftsangabe — und deshalb
 * zwei getrennte Werte statt einer Zahl zwischen 0 und 1: „aus dem
 * Text gelesen" ist eine andere Art von Wissen als „vom Anbieter
 * geliefert", nicht dasselbe Wissen mit weniger Sicherheit.
 */
/*
 * Woher der Gehaltsbetrag stammt.
 *
 *   provider        — der Anbieter hat ein Gehaltsfeld geliefert
 *   board_estimate  — die Plattform SCHÄTZT und sagt das dazu
 *   text            — wir haben ihn aus der Beschreibung gelesen
 *
 * `board_estimate` kam später dazu. Adzuna markiert geschätzte Werte
 * mit `salary_is_predicted`; der Adapter warf sie weg, weil es keinen
 * Zustand für sie gab. Eine Plattformschätzung ist eine brauchbare
 * Grössenordnung und keine Zusage des Arbeitgebers — wer damit
 * verhandelt, muss den Unterschied sehen.
 */
export const salaryProvenanceEnum = pgEnum("salary_provenance", [
  "provider",
  "board_estimate",
  "text",
  /**
   * Vom Arbeitgeber selbst eingetragen.
   *
   * Die verlässlichste Herkunft im Index: Die Zahl kommt von dem, der
   * sie zahlt. Ohne eigenen Wert wäre sie von der Angabe eines Portals
   * nicht zu unterscheiden.
   */
  "employer",
]);
export const applyMethodEnum = pgEnum("apply_method", [
  "email",
  "portal",
  "form",
  "unknown",
  /** Bewerbung bleibt hier — nur bei selbst eingestellten Stellen. */
  "internal",
]);

export const jobSourceKindEnum = pgEnum("job_source_kind", [
  "licensed_api", "employer_feed", "partner", "user_url", "user_text", "seed",
]);
export const licenseStatusEnum = pgEnum("license_status", [
  "licensed", "public_link_only", "user_provided", "demo", "unclear",
]);
export const reviewSourceKindEnum = pgEnum("review_source_kind", [
  "employee_reviews", "customer_reviews", "employer_statement",
  "official_registry", "journalistic", "regulatory", "user_report",
]);
export const sentimentEnum = pgEnum("sentiment", ["positive", "negative", "mixed"]);

export const applicationStageEnum = pgEnum("application_stage", [
  "saved", "preparing", "sent", "acknowledged", "interview",
  "offer", "rejected", "withdrawn", "accepted",
]);
export const applicationEventTypeEnum = pgEnum("application_event_type", [
  "job_viewed", "job_saved", "application_started", "application_sent",
  "acknowledged", "response_received", "interview_scheduled", "interview_held",
  "offer_received", "rejected", "withdrawn", "accepted",
  /*
   * Die Marken des Wechselverlaufs (Migration 0107).
   *
   * 60 und 180 werden nicht mehr geplant, bleiben aber gültig: dazu
   * liegen Erinnerungen in der Datenbank. 365 und 1095 sind neu — die
   * Zufriedenheit nach einem Wechsel steigt im ersten Jahr und fällt
   * danach, und dieser Teil der Kurve war bisher unbeobachtet.
   */
  "fit_check_30", "fit_check_60", "fit_check_90", "fit_check_180",
  "fit_check_365", "fit_check_1095",
]);
export const artifactKindEnum = pgEnum("artifact_kind", [
  "cv_ats", "cv_designed", "cover_letter", "application_email",
  "portal_answers", "recruiter_message", "attachment_list", "portfolio_checklist",
]);
export const claimStatusEnum = pgEnum("claim_status", ["supported", "unsupported", "needs_confirmation", "user_override"]);

export const consentKindEnum = pgEnum("consent_kind", [
  "career_profile", "document_analysis", "voice_input", "transcript_storage",
  "external_ai_processing", "model_training", "partner_sharing",
  /*
   * Der Suchauftrag, in drei getrennten Entscheidungen (Migration 0082).
   *
   *   background_search   im Hintergrund weitersuchen
   *   behaviour_signals   dafür Gesprächs- und Verhaltenssignale auswerten
   *   job_digest_email    Ergebnisse per E-Mail bekommen
   *
   * Getrennt, weil die Suche mit ausdrücklich bestätigten Angaben
   * allein funktionieren muss. Wer nur das erste will, soll das zweite
   * nicht mitgeben müssen — und das dritte schon gar nicht.
   */
  "background_search", "behaviour_signals", "job_digest_email",
]);
export const privacyRequestKindEnum = pgEnum("privacy_request_kind", ["export", "delete_item", "delete_account", "withdraw_consent"]);
export const privacyRequestStatusEnum = pgEnum("privacy_request_status", ["open", "processing", "done", "failed"]);
export const roleClusterKindEnum = pgEnum("role_cluster_kind", ["obvious", "adjacent", "niche"]);
export const entryRealismEnum = pgEnum("entry_realism", ["direct", "with_bridge", "longer_path", "unclear"]);
export const taxonomyEnum = pgEnum("taxonomy", ["esco", "kldb", "internal"]);
export const aiRunStatusEnum = pgEnum("ai_run_status", ["ok", "failed", "timeout", "budget_exceeded", "refused"]);
export const integrationKindEnum = pgEnum("integration_kind", ["email_gmail", "email_outlook", "storage_s3", "job_api", "review_api"]);
export const integrationStatusEnum = pgEnum("integration_status", ["not_connected", "connected", "error", "revoked"]);
