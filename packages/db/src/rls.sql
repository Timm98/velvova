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
    'auth_accounts','memberships','ai_runs'
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
