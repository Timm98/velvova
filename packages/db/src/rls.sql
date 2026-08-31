-- Row Level Security.
--
-- Wichtig: RLS greift NICHT gegen einen Superuser. Auch FORCE ROW LEVEL
-- SECURITY aendert daran nichts - das ist Postgres-Verhalten, kein Fehler.
-- Deshalb legt diese Datei eine eigene, eingeschraenkte Anwendungsrolle an.
-- Die Anwendung arbeitet ausschliesslich unter dieser Rolle und setzt vor
-- jedem Request `SET LOCAL app.user_id`. Ohne gesetzte Kennung sieht eine
-- Sitzung keine Nutzerdaten - nicht einmal versehentlich.
--
-- Das ist die zweite Verteidigungslinie hinter der Autorisierung im
-- Anwendungscode, nicht ihr Ersatz.
--
-- Die Anweisungen sind mit dem Marker unten getrennt, weil der Treiber je
-- Aufruf genau eine Anweisung ausfuehrt. Alles hier ist idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paycheck_app') THEN
    CREATE ROLE paycheck_app NOLOGIN;
  END IF;
END $$
--> statement-breakpoint
/*
 * Die verbindende Rolle muss in die Anwendungsrolle wechseln duerfen.
 *
 * Auf einer eingebetteten Datenbank faellt das nie auf: dort verbindet
 * sich die Anwendung als Superuser, und ein Superuser darf ohnehin jede
 * Rolle annehmen. Auf einem gehosteten Postgres — Supabase, RDS, Cloud
 * SQL — ist die verbindende Rolle KEIN Superuser. Dort scheitert dann
 * jede einzelne Abfrage mit
 *
 *     permission denied to set role "paycheck_app"
 *
 * und zwar erst zur Laufzeit, auf jeder Seite gleichzeitig. Genau das
 * ist passiert. Die Zeile hier ist der Unterschied zwischen "laeuft
 * lokal" und "laeuft".
 */
DO $$
BEGIN
  EXECUTE format('GRANT paycheck_app TO %I', current_user);
EXCEPTION
  -- Wenn die Mitgliedschaft schon besteht oder die verbindende Rolle
  -- selbst Superuser ist, ist nichts zu tun. Ein Fehler hier duerfte
  -- die Migration nicht anhalten.
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO paycheck_app
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO paycheck_app
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO paycheck_app
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO paycheck_app
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE
--> statement-breakpoint
DO $$
DECLARE
  t text;
  user_tables text[] := ARRAY[
    'user_settings','consents','integrations','privacy_requests',
    'career_profiles','evidence_items','evidence_edges','experiences',
    'profile_skills','preferences','user_constraints',
    'interview_sessions','interview_turns','micro_assessment_results',
    'role_clusters','role_hypotheses','saved_jobs','job_matches',
    'applications','application_events','documents','generated_artifacts',
    'deliveries','coaching_sessions','offers','check_ins','reminders',
    'notifications','sessions',
    -- Nachgetragen: diese drei tragen eine Nutzerkennung und hatten
    -- trotzdem keinen Zeilenfilter. Aufgefallen ist es dem Generator
    -- fuer RLS_POLICIES.md, der den Katalog gegen die Spalten haelt --
    -- nicht einem Menschen beim Lesen.
    --
    --   auth_accounts  welche externen Konten zu einer Person gehoeren
    --   memberships    wer zu welcher Organisation gehoert
    --   ai_runs        Kennzahlen je Modellaufruf, ohne Inhalt
    --
    -- ai_runs erlaubt eine leere Nutzerkennung fuer Systemlaeufe. Solche
    -- Zeilen sind unter der Anwendungsrolle fuer niemanden sichtbar; die
    -- Betriebsansicht liest sie ueber die unbeschraenkte Verbindung.
    'auth_accounts','memberships','ai_runs',
    -- Abrechnung. Vier Tabellen mit Nutzerkennung, die ohne Zeilenfilter
    -- angelegt wurden -- der Abdeckungstest hat es beim ersten Lauf
    -- gemeldet, bevor eine einzige Zeile darin stand.
    --
    -- Was hier durchsickern koennte, waere besonders unangenehm: welchen
    -- Plan jemand hat, womit er zahlt, was er bezahlt hat. Nichts davon
    -- geht ein anderes Konto etwas an.
    'subscriptions','billing_customers','payment_methods','invoices',
    -- Decision Intelligence (Addendum V5.1). Alles hier ist
    -- nutzerbezogen: Chancenraum, Einstiegswege, Bewerbungspass,
    -- Prozessbeobachtungen, Zielunternehmen, Kontakte, Suchplan.
    'search_space_snapshots','market_reality_signals',
    'experience_equivalencies','seniority_alignment_assessments',
    'candidate_passport_fields','candidate_passport_uses',
    'application_process_observations',
    'target_companies','watchlist_job_events',
    'search_channel_activities','networking_contacts','networking_messages',
    'search_plans',
    -- Application Bridge (Addendum V5.2). Alles hier gehört einer
    -- Person: Bewerbungspaket, Antworten, Übergaben, Identitäten,
    -- E-Mail-Einstellungen.
    'application_packages','application_package_documents',
    'application_screening_answers','application_handoffs',
    'connected_identities','auth_identity_audit',
    'email_preferences','email_deliveries',
    -- Ninas Gedächtnis. Alle drei tragen eine Nutzerkennung, und genau
    -- hier liegt das Gespräch: wer diesen Filter vergisst, gibt fremde
    -- Karrieregespräche frei.
    'nina_conversations','nina_messages','workflow_states',
    'nina_role_hypotheses'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (user_id = app_current_user_id()) '
      'WITH CHECK (user_id = app_current_user_id())', t || '_owner', t);
  END LOOP;
END $$
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS users_self ON users
--> statement-breakpoint
CREATE POLICY users_self ON users
  USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id())
--> statement-breakpoint
/*
 * Job Briefs.
 *
 * Ein Sonderfall: `user_id` ist optional. Ein öffentlicher Brief gehört
 * niemandem und darf von allen gelesen werden; ein privater gehört
 * genau einer Person, weil er aus einem Text entstanden ist, den sie
 * selbst mitgebracht hat.
 *
 * Die Schleife oben kann das nicht — sie setzt `user_id = ...` und
 * würde damit auch die öffentlichen Briefe verstecken.
 */
ALTER TABLE job_briefs ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE job_briefs FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS job_briefs_read ON job_briefs
--> statement-breakpoint
CREATE POLICY job_briefs_read ON job_briefs FOR SELECT
  USING (user_id IS NULL OR user_id = app_current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS job_briefs_write ON job_briefs
--> statement-breakpoint
CREATE POLICY job_briefs_write ON job_briefs FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = app_current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS job_briefs_update ON job_briefs
--> statement-breakpoint
CREATE POLICY job_briefs_update ON job_briefs FOR UPDATE
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS job_briefs_delete ON job_briefs
--> statement-breakpoint
CREATE POLICY job_briefs_delete ON job_briefs FOR DELETE
  USING (user_id = app_current_user_id())
--> statement-breakpoint
/*
 * Rückmeldungen dürfen anonym sein. Eine Person sieht ihre eigenen;
 * anonyme gehören niemandem und werden nur serverseitig ausgewertet.
 */
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE feedback_items FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS feedback_own ON feedback_items
--> statement-breakpoint
CREATE POLICY feedback_own ON feedback_items FOR SELECT
  USING (user_id = app_current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS feedback_insert ON feedback_items
--> statement-breakpoint
CREATE POLICY feedback_insert ON feedback_items FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = app_current_user_id())
--> statement-breakpoint
/*
 * E-Mail-Einwilligungen.
 *
 * Wieder ein optionaler Eigentümer: wer den Newsletter abonniert, muss
 * kein Konto haben. Solche Zeilen gehören niemandem und sind über die
 * Anwendungsrolle unsichtbar — bearbeitet werden sie serverseitig über
 * den Bestätigungstoken.
 *
 * Eine angemeldete Person sieht ihre eigenen Einwilligungen. Das ist
 * die Voraussetzung dafür, dass sie sie widerrufen kann.
 */
ALTER TABLE email_consents ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE email_consents FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS email_consents_own ON email_consents
--> statement-breakpoint
CREATE POLICY email_consents_own ON email_consents FOR SELECT
  USING (user_id = app_current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS email_consents_update ON email_consents
--> statement-breakpoint
CREATE POLICY email_consents_update ON email_consents FOR UPDATE
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id())
