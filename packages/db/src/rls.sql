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

-- Ein veröffentlichtes Unternehmensprofil darf jeder lesen.
--
-- ── Warum eine zweite Richtlinie und keine gelockerte erste ────
--
-- Die Richtlinie oben gibt Mitgliedern vollen Zugriff — schreiben
-- eingeschlossen. Sie zu lockern, damit auch Besucher lesen können,
-- hiesse, das Schreibrecht mitzulockern.
--
-- Zwei Richtlinien nebeneinander sind in Postgres ein ODER: Mitglieder
-- dürfen alles, alle anderen dürfen genau eines — eine Zeile lesen,
-- die veröffentlicht ist. Ein Entwurf bleibt unsichtbar, auch wenn
-- jemand den Slug kennt.
--
-- Das ist die ganze Regel der öffentlichen Unternehmensseite, und sie
-- steht damit in der Datenbank statt in einer Abfrage. Ein vergessenes
-- `where veroeffentlicht_am is not null` an einer einzigen Stelle
-- könnte sonst einen Entwurf öffentlich machen.
DROP POLICY IF EXISTS unternehmensprofile_oeffentlich ON unternehmensprofile
--> statement-breakpoint
CREATE POLICY unternehmensprofile_oeffentlich ON unternehmensprofile
  FOR SELECT USING (veroeffentlicht_am IS NOT NULL)
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
    -- Bestätigungscodes gehören der Person, für die sie ausgestellt
    -- wurden. Ohne Richtlinie stünden die Hashes fremder Codes offen —
    -- und der Versuchszähler liesse sich von aussen zurücksetzen.
    'bestaetigungscodes',
    -- Eine Tiefenanalyse verbindet eine Person mit einer Stelle und
    -- enthält Aussagen über ihr Profil. Ohne Richtlinie stünde sie
    -- jedem offen, der die Kennung kennt.
    'job_tiefenanalysen',
    -- Mondays Einrichtung und deren Protokoll. Die eine Zeile sagt, was
    -- eine Person Monday erlaubt hat; das Protokoll, wann sie es erlaubt
    -- und wann sie es zurueckgenommen hat. Ohne Richtlinie liesse sich
    -- die Hintergrundsuche eines fremden Kontos einschalten -- und der
    -- Nachweis darueber im selben Zug faelschen.
    'nina_einrichtung','nina_einrichtung_protokoll',
    -- Das Fundament fuer Chancenradar und Matching. Jede dieser
    -- Zeilen ist eine Aussage ueber einen bestimmten Menschen: was er
    -- kann, was er will, was ihm vorgeschlagen wurde und warum er
    -- abgelehnt hat. Ohne Richtlinie laege das offen.
    'nina_events','profile_facts','match_feedback',
    -- Nachweise gehoeren dem Menschen, ueber den sie etwas sagen. Ohne
    -- Richtlinie koennte ein fremdes Konto sie lesen -- und damit
    -- genau das tun, was die Tabelle verhindert: aus einem Zeugnis,
    -- das jemand weitergibt, wenn er will, eine Akte machen, die
    -- ohnehin offen liegt.
    'nachweise',
    -- Der Nachtlauf. Die Zeile sagt, wonach jemand sucht, wie viele
    -- Anzeigen an seinen Bedingungen gescheitert sind und wann er den
    -- Bericht geoeffnet hat. Aus der Zaehlerreihe allein liesse sich
    -- ablesen, wie eng seine Gehaltsgrenze liegt und ob er noch sucht.
    'nacht_laeufe',
    -- Die Einmal-Freigabe fuer den Versand. Wer sie lesen koennte,
    -- saehe, an welche Arbeitgeber jemand gerade schreibt -- und
    -- koennte, waere der Riegel nicht der Token-Hash, in seinem Namen
    -- senden. Beides gehoert ihm allein.
    'versandfreigaben',
    -- Der Outcome Loop. Die Zeile enthaelt, worauf sich jemand beworben
    -- hat und wie zufrieden er danach war -- das Empfindlichste, was
    -- das Produkt speichert. Die Auswertung liest ueber die
    -- Systemverbindung und nie einzelne Zeilen.
    'empfehlungs_ergebnisse',
    -- Der Career Twin. Enthaelt, wie viel Druck jemand vertraegt und
    -- wie viel Verantwortung er will -- Aussagen ueber die Person, die
    -- kein anderer Nutzer je sehen darf. `stellen_profil` steht hier
    -- NICHT: es gehoert zur Stelle, nicht zu einem Menschen.
    'arbeitsprofil',
    -- Wer welche Rollenangabe bestaetigt hat. Die Eigentuemerregel
    -- laesst jeden nur seine eigene Antwort sehen und aendern.
    --
    -- Die Karte auf der Stellenseite zeigt nur Median und Stimmenzahl
    -- und liest ueber die Systemverbindung -- niemals einzelne Zeilen.
    -- Ohne diesen Filter koennte ein Angemeldeter nachsehen, welcher
    -- Mitarbeiter seinem Arbeitgeber widersprochen hat.
    'rollen_bestaetigungen',
    -- Stille Chancen und was daraus hinausging. Die Zeile sagt, welchen
    -- Arbeitgeber jemand interessant fand und ob er ihn angeschrieben
    -- hat -- eine Aussage ueber die Person, nicht ueber die Firma. Ohne
    -- Richtlinie liesse sich die Wechselabsicht eines Fremden ablesen.
    --
    -- `arbeitgeber_kontaktsperre` steht hier NICHT und darf es nicht:
    -- Sie traegt keine Nutzerkennung, weil eine Sperre dem Arbeitgeber
    -- gegenueber gilt und nicht gegenueber einer Person. Sie muss fuer
    -- jeden Lauf lesbar sein, sonst schreibt der naechste Mensch
    -- morgen wieder.
    'arbeitgeber_chancen','arbeitgeber_kontakte',
    -- Projekte. Der Name eines Vorhabens sagt, wonach jemand sucht --
    -- "Wechsel aus der Pflege", "Zurueck nach Zuerich". Das ist eine
    -- Aussage ueber seine Lage, und sie geht niemanden sonst etwas an.
    'projekte',
    -- Was jemand bei einer Arbeitsprobe geantwortet hat und wie es sich
    -- angefuehlt hat. Die Aufgaben selbst (`aufgabenproben`) sind fuer
    -- alle sichtbar; die Versuche gehoeren dem Menschen.
    'probendurchlaeufe',
    -- Der Promise Lock. Was ein Arbeitgeber jemandem zugesagt hat und
    -- ob er Wort hielt -- eine Aussage ueber beide, die niemand sonst
    -- lesen darf. Der Arbeitgeber-Score liest ueber die
    -- Systemverbindung und nie einzelne Zeilen.
    'zusagen', 'zusagen_pruefungen',
    -- Was jemand nach einer Reality Session ueber Fuehrung, Tempo und
    -- Respekt gesagt hat. Anonym heisst: Der Arbeitgeber sieht nur
    -- Mittelwerte ueber genug Rueckmeldungen, nie eine einzelne Zeile.
    'realitaetsrueckmeldungen',
    -- Suchauftraege gehoeren dem Menschen, der sie angelegt hat. Ohne
    -- diese Zeile koennte jeder die gespeicherten Suchen jedes anderen
    -- lesen -- und daraus ablesen, wonach jemand sucht, in welcher
    -- Stadt und ab welchem Gehalt.
    'job_alarme',
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
    -- `memberships` steht hier NICHT mehr.
    --
    -- Die Eigentuemerregel lautet `user_id = app_current_user_id()`, und
    -- zwar fuer ALLE Befehle — auch fuer INSERT. Postgres verknuepft
    -- zulassende Richtlinien mit ODER. Zusammen mit der
    -- Verwalterrichtlinie weiter unten hiess das: Jeder Angemeldete
    -- durfte sich selbst in JEDE Organisation eintragen, denn die Zeile
    -- traegt ja seine eigene Kennung.
    --
    -- Das ist keine theoretische Luecke. Wer die Organisationskennung
    -- kennt — sie steht in jedem Arbeitgeber-Link —, haette sich Zugang
    -- zu allen Bewerbungen dieses Unternehmens verschafft. Die Tabelle
    -- bekommt deshalb weiter unten eigene, getrennte Richtlinien je
    -- Befehl.
    'auth_accounts','ai_runs',
    -- Abrechnung. Vier Tabellen mit Nutzerkennung, die ohne Zeilenfilter
    -- angelegt wurden -- der Abdeckungstest hat es beim ersten Lauf
    -- gemeldet, bevor eine einzige Zeile darin stand.
    --
    -- Was hier durchsickern koennte, waere besonders unangenehm: welchen
    -- Plan jemand hat, womit er zahlt, was er bezahlt hat. Nichts davon
    -- geht ein anderes Konto etwas an.
    'subscriptions','billing_customers','payment_methods','invoices',
    -- Dokumente, die eine Person selbst mitbringt (V9 §11.4).
    --
    -- Die schutzbeduerftigsten Daten im ganzen Produkt: in einem
    -- Lebenslauf stehen Name, Adresse, Geburtsdatum, Stationen; in einem
    -- Zeugnis manchmal eine Krankheit, in einer Absage ein Grund. Wer
    -- hier durchsickert, sickert nicht als Datensatz durch, sondern als
    -- Biografie.
    --
    -- Auch die abgeleiteten Tabellen: der extrahierte Text ist dasselbe
    -- Dokument in anderer Form, und eine Behauptung daraus ist dasselbe
    -- noch einmal, nur kuerzer.
    'user_documents','document_versions','document_extractions',
    'document_claims','document_permissions','document_processing_runs',
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
    -- Mondays Gedächtnis. Alle drei tragen eine Nutzerkennung, und genau
    -- hier liegt das Gespräch: wer diesen Filter vergisst, gibt fremde
    -- Karrieregespräche frei.
    'nina_conversations','nina_messages','workflow_states',
    'nina_role_hypotheses',
    -- Plattformbewertungen.
    --
    -- Ein Sonderfall, und deshalb steht er hier und nicht in einer
    -- Ausnahmeliste: die Tabelle traegt eine Nutzerkennung, ihr Inhalt
    -- ist aber zur Veroeffentlichung bestimmt. Die Eigentuemerregel
    -- unten gilt trotzdem — sie schuetzt E-Mail-Adresse,
    -- Moderationsnotiz und alles, was noch nicht freigegeben ist.
    --
    -- Direkt danach kommt eine ZWEITE Richtlinie, die freigegebene
    -- Zeilen zum Lesen freigibt. Postgres verknuepft zulassende
    -- Richtlinien mit ODER: wer eingeloggt ist, sieht seine eigene
    -- Bewertung auch im Zustand „ausstehend"; alle anderen sehen nur,
    -- was freigegeben ist.
    'platform_reviews',
    -- Gehaltsberechnung.
    --
    -- Steuerklasse, Kinderzahl, Krankenkasse, Bundesland: zusammen ein
    -- Bild der Lebensform, das niemanden ausser der Person angeht. Und
    -- in den Laeufen steht ausserdem, was jemand verdient beziehungs-
    -- weise verdienen moechte.
    'salary_calculation_profiles','salary_calculation_runs',
    -- Lebenshaltung und aktuelle Stelle.
    --
    -- Was jemand fuer Miete zahlt, was im Monat fuer Kinder weggeht,
    -- was er heute verdient: Angaben, die in keiner Bewerbung
    -- auftauchen und keinen Arbeitgeber etwas angehen.
    --
    -- Sie stehen bewusst in eigenen Tabellen und nicht am
    -- Karriereprofil — von dort fliessen Angaben in Lebenslaeufe, in
    -- Mondays Begruendungen und in die Suchrichtungen. Eine Miete, die
    -- versehentlich in einem Anschreiben landet, ist ein Schaden, den
    -- keine Korrektur zurueckholt.
    'living_costs','current_employment',
    -- „Monday sucht fuer dich weiter" (Migration 0082).
    --
    -- Der Suchauftrag ist die verdichtetste Aussage ueber einen
    -- Menschen, die das Produkt speichert: wonach er sucht, ab welchem
    -- Gehalt, in welcher Stadt, welchen Arbeitgeber er ausschliesst und
    -- ob er ueberhaupt sucht. Wer diesen Filter vergisst, gibt nicht
    -- Datensaetze frei, sondern die berufliche Lage einer Person.
    --
    -- `mail_ausgang` traegt zusaetzlich die fertige Mail samt Adresse.
    -- `abmelde_token` traegt den Hash, mit dem sich jemand abmelden
    -- kann -- lesbar waere er ein Weg, fremde Benachrichtigungen
    -- abzuschalten.
    'such_auftraege','such_profile','such_kriterien','profil_signale',
    'benachrichtigung_einstellungen','auftrag_treffer',
    'job_benachrichtigungen','zusammenfassungen','zusammenfassung_posten',
    'mail_ausgang','abmelde_token','verarbeitungs_fortschritt',
    -- Der Einbettungsvektor einer Person.
    --
    -- Er entsteht aus dem, was sie ueber ihre Arbeit gesagt hat. Man
    -- sieht ihm nicht an, was in ihm steckt -- und genau deshalb
    -- gehoert er hinter denselben Zeilenfilter wie der Klartext.
    'profil_einbettungen'
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
/*
 * Freigegebene Bewertungen darf jeder lesen.
 *
 * Die zweite Richtlinie neben der Eigentuemerregel. Ohne sie waere die
 * Landingpage leer, sobald sie unter der Anwendungsrolle liest — und
 * die Versuchung waere gross, sie ganz aus dem Zeilenschutz zu nehmen.
 *
 * Nur SELECT und nur `approved`: Schreiben bleibt dem Eigentuemer und
 * der Moderation vorbehalten. Und `WITH CHECK` fehlt bewusst — eine
 * Richtlinie, die nur liest, darf nichts durchlassen, was schreibt.
 */
DROP POLICY IF EXISTS platform_reviews_public_read ON platform_reviews
--> statement-breakpoint
CREATE POLICY platform_reviews_public_read ON platform_reviews
  FOR SELECT USING (status = 'approved' AND consent_publish AND consent_privacy)
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
 * ── Arbeitgeberbereich ────────────────────────────────────────
 *
 * Hier greift die Eigentuemerregel nicht: An diesen Zeilen haengt keine
 * Nutzerkennung, sondern eine Organisation. Wer sie sehen darf,
 * entscheidet die Mitgliedschaft.
 *
 * Die Funktion darunter ist SECURITY DEFINER — sie muss `memberships`
 * lesen, und auf dieser Tabelle liegt selbst ein Zeilenfilter. Ohne
 * DEFINER liefe die Pruefung gegen dieselbe Einschraenkung, die sie
 * gerade aufloesen soll.
 *
 * Und sie ist auf ein festes `search_path` gesetzt: Eine SECURITY-
 * DEFINER-Funktion ohne das ist eine bekannte Rechteausweitung — wer
 * den Suchpfad umbiegt, kann eine eigene `memberships`-Tabelle
 * unterschieben.
 */
CREATE OR REPLACE FUNCTION app_is_org_member(org uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = org
      AND m.user_id = app_current_user_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
--> statement-breakpoint
/*
 * Nur Besitzer und Verwalter duerfen die Organisation aendern, Leute
 * einladen oder entfernen. Das steht ZUSAETZLICH in der
 * Anwendungsschicht; hier ist die zweite Linie.
 */
CREATE OR REPLACE FUNCTION app_is_org_admin(org uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = org
      AND m.user_id = app_current_user_id()
      AND m.role IN ('owner', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
--> statement-breakpoint
DO $$
DECLARE
  t text;
  /*
   * Tabellen, die einer Organisation gehoeren.
   *
   * `posting_candidates` steht bewusst dabei: Was ein Unternehmen von
   * einer Bewerbung sieht, ist eine Kopie in dieser Tabelle und kein
   * Fenster in das Profil der Person. Der Zeilenfilter sorgt dafuer,
   * dass auch diese Kopie nur die eine Organisation erreicht.
   */
  org_tables text[] := ARRAY[
    'organization_invitations','job_postings','posting_candidates','organization_events',
    'unternehmensprofile','stellen_matches','match_regeln','match_protokoll',
    'onboarding_gespraeche','onboarding_nachrichten','onboarding_angaben'
  ];
BEGIN
  FOREACH t IN ARRAY org_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_member', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_is_org_member(organization_id)) '
      'WITH CHECK (app_is_org_member(organization_id))', t || '_member', t);
  END LOOP;
END $$
--> statement-breakpoint
/*
 * Die Person sieht ihre eigene Bewerbung — und darf sie zurueckziehen.
 *
 * Ohne diese zweite Richtlinie waere die Bewerbung fuer die Person, die
 * sie geschrieben hat, unsichtbar: Sie ist kein Mitglied der
 * Organisation. Das waere die falsche Sorte Datenschutz — eine
 * Bewerbung, die man abschickt und nie wiedersieht.
 *
 * Nur SELECT und UPDATE, nicht DELETE: Ein Unternehmen muss
 * nachvollziehen koennen, dass eine Bewerbung zurueckgezogen wurde. Sie
 * spurlos verschwinden zu lassen waere fuer beide Seiten schlechter.
 */
DROP POLICY IF EXISTS posting_candidates_self_read ON posting_candidates
--> statement-breakpoint
CREATE POLICY posting_candidates_self_read ON posting_candidates FOR SELECT
  USING (candidate_user_id = app_current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS posting_candidates_self_write ON posting_candidates
--> statement-breakpoint
CREATE POLICY posting_candidates_self_write ON posting_candidates FOR UPDATE
  USING (candidate_user_id = app_current_user_id())
  WITH CHECK (candidate_user_id = app_current_user_id())
--> statement-breakpoint
/*
 * Eine Bewerbung entsteht beim Bewerber, nicht beim Unternehmen.
 *
 * Ohne diese Richtlinie koennte niemand ausser einem Mitglied der
 * Organisation eine Zeile anlegen — also gaebe es nie eine Bewerbung.
 */
DROP POLICY IF EXISTS posting_candidates_self_insert ON posting_candidates
--> statement-breakpoint
CREATE POLICY posting_candidates_self_insert ON posting_candidates FOR INSERT
  WITH CHECK (candidate_user_id = app_current_user_id())
--> statement-breakpoint
/*
 * Organisationen selbst.
 *
 * Sichtbar fuer Mitglieder; anlegen darf sie jeder Angemeldete (dabei
 * wird man Besitzer). Aendern nur Besitzer und Verwalter.
 */
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE organizations FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS organizations_member_read ON organizations
--> statement-breakpoint
CREATE POLICY organizations_member_read ON organizations FOR SELECT
  USING (app_is_org_member(id))
--> statement-breakpoint
DROP POLICY IF EXISTS organizations_create ON organizations
--> statement-breakpoint
CREATE POLICY organizations_create ON organizations FOR INSERT
  WITH CHECK (app_current_user_id() IS NOT NULL)
--> statement-breakpoint
DROP POLICY IF EXISTS organizations_admin_update ON organizations
--> statement-breakpoint
CREATE POLICY organizations_admin_update ON organizations FOR UPDATE
  USING (app_is_org_admin(id)) WITH CHECK (app_is_org_admin(id))
--> statement-breakpoint
/*
 * Mitgliedschaften.
 *
 * Die Eigentuemerregel aus der Schleife oben bleibt bestehen — jeder
 * sieht seine eigenen. Zusaetzlich sehen Mitglieder einer Organisation
 * einander: Ein Arbeitgeberbereich, in dem niemand weiss, wer sonst
 * Zugriff auf die Bewerbungen hat, waere selbst ein Datenschutzproblem.
 *
 * Ausserdem: Beim Anlegen einer Organisation muss der Gruender sich
 * selbst eintragen koennen. Die Eigentuemerregel deckt das ab, weil die
 * Zeile seine eigene Kennung traegt.
 */
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE memberships FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS memberships_owner ON memberships
--> statement-breakpoint
/*
 * Lesen: die eigene Zeile ODER die Zeilen der eigenen Organisation.
 *
 * Ein Arbeitgeberbereich, in dem niemand weiss, wer sonst Zugriff auf
 * die Bewerbungen hat, waere selbst ein Datenschutzproblem.
 */
DROP POLICY IF EXISTS memberships_org_read ON memberships
--> statement-breakpoint
CREATE POLICY memberships_org_read ON memberships FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_org_member(organization_id))
--> statement-breakpoint
/*
 * Eintragen darf NUR ein Verwalter — auch nicht man selbst.
 *
 * Der Gruender einer Organisation kaeme damit nicht hinein: Solange es
 * kein Mitglied gibt, gibt es keinen Verwalter. Genau dafuer gibt es
 * `app_create_organization` weiter unten, das beides in einem Schritt
 * und unter definierten Rechten anlegt.
 */
DROP POLICY IF EXISTS memberships_admin_write ON memberships
--> statement-breakpoint
CREATE POLICY memberships_admin_write ON memberships FOR INSERT
  WITH CHECK (app_is_org_admin(organization_id))
--> statement-breakpoint
DROP POLICY IF EXISTS memberships_admin_update ON memberships
--> statement-breakpoint
CREATE POLICY memberships_admin_update ON memberships FOR UPDATE
  USING (app_is_org_admin(organization_id)) WITH CHECK (app_is_org_admin(organization_id))
--> statement-breakpoint
/*
 * Entfernen darf ein Verwalter — und jeder sich selbst.
 *
 * Ohne das Zweite gaebe es kein Austreten: Wer einmal in einer
 * Organisation ist, kaeme nur wieder heraus, indem ein Verwalter ihn
 * entfernt. Dass der letzte Besitzer sich nicht selbst entfernen darf,
 * prueft die Anwendungsschicht — eine Organisation ohne Besitzer waere
 * nicht mehr verwaltbar.
 */
DROP POLICY IF EXISTS memberships_admin_delete ON memberships
--> statement-breakpoint
CREATE POLICY memberships_admin_delete ON memberships FOR DELETE
  USING (app_is_org_admin(organization_id) OR user_id = app_current_user_id())
--> statement-breakpoint
/*
 * Organisation anlegen: Organisation und Besitzer in einem Schritt.
 *
 * Unter definierten Rechten, weil beides zusammengehoert. Ohne die
 * Funktion braeuchte es eine Richtlinie, die Selbsteintragung erlaubt —
 * und die waere genau die Luecke, die oben beschrieben ist.
 */
CREATE OR REPLACE FUNCTION app_create_organization(p_name text, p_kind text DEFAULT 'employer')
RETURNS uuid AS $$
DECLARE
  v_user uuid := app_current_user_id();
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Ohne angemeldete Person kann keine Organisation entstehen.';
  END IF;
  INSERT INTO organizations (name, kind, created_by) VALUES (p_name, p_kind, v_user)
  RETURNING id INTO v_org;
  INSERT INTO memberships (organization_id, user_id, role) VALUES (v_org, v_user, 'owner');
  RETURN v_org;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_create_organization(text, text) TO paycheck_app
--> statement-breakpoint
/*
 * Der Bewerber darf seine Bewerbung zurueckziehen — und sonst nichts.
 *
 * Die Richtlinie `posting_candidates_self_write` erlaubt ihm UPDATE auf
 * seiner eigenen Zeile. Zeilenschutz kennt aber keine Spalten: Damit
 * koennte er `stage` auf „eingestellt" setzen oder die Notiz des
 * Unternehmens ueberschreiben.
 *
 * Der Trigger zieht die Spaltengrenze nach. Er greift nur, wenn die
 * aendernde Person NICHT zur Organisation gehoert — ein Recruiter darf
 * selbstverstaendlich den Stand aendern.
 */
CREATE OR REPLACE FUNCTION app_posting_candidate_guard() RETURNS trigger AS $$
BEGIN
  IF app_is_org_member(OLD.organization_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.stage IS DISTINCT FROM OLD.stage
     OR NEW.employer_note IS DISTINCT FROM OLD.employer_note
     OR NEW.rejected_reason IS DISTINCT FROM OLD.rejected_reason
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.posting_id IS DISTINCT FROM OLD.posting_id
     OR NEW.candidate_user_id IS DISTINCT FROM OLD.candidate_user_id THEN
    RAISE EXCEPTION 'Diese Felder gehoeren dem Unternehmen.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
--> statement-breakpoint
DROP TRIGGER IF EXISTS posting_candidates_guard ON posting_candidates
--> statement-breakpoint
CREATE TRIGGER posting_candidates_guard BEFORE UPDATE ON posting_candidates
  FOR EACH ROW EXECUTE FUNCTION app_posting_candidate_guard()
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_org_member(uuid) TO paycheck_app
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_org_admin(uuid) TO paycheck_app
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

--> statement-breakpoint
/*
 * Die nutzerunabhängige Jobanalyse.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie NICHT in der Eigentümerliste steht
 * ══════════════════════════════════════════════════════════════
 *
 * `job_analysen` hat kein `user_id` — sie gehört zur Stelle, nicht zu
 * einer Person, und ist für alle Lesenden dieselbe. Die Eigentümer-
 * regel `user_id = app_current_user_id()` liesse sich darauf gar nicht
 * anwenden.
 *
 * Genau deshalb fiel sie durch die Abdeckungsprüfung: Die zählt
 * Tabellen mit `user_id`. Eine Tabelle ohne bleibt unbemerkt offen —
 * und offen heisst hier: Wer die Anwendungsrolle hat, kann Analysen
 * überschreiben.
 *
 * ══════════════════════════════════════════════════════════════
 * Lesen für alle, Schreiben nur für den Dienst
 * ══════════════════════════════════════════════════════════════
 *
 * Analysen sind für jeden dieselbe Auskunft über eine öffentliche
 * Stellenanzeige — es gibt nichts zu verbergen.
 *
 * Schreiben dagegen ist Sache des Workers. Ohne diese Trennung könnte
 * eine Anwendungssitzung Bewertungen setzen, und die Zahl, die eine
 * Person zur Bewerbung bewegt, käme nicht mehr nachweislich aus dem
 * Code.
 *
 * `WITH CHECK` fehlt bewusst: Eine Richtlinie, die nur liest, darf
 * nichts durchlassen, was schreibt.
 */
ALTER TABLE job_analysen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE job_analysen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS job_analysen_read ON job_analysen
--> statement-breakpoint
CREATE POLICY job_analysen_read ON job_analysen FOR SELECT USING (true)

--> statement-breakpoint
/*
 * Zwei Tabellen ohne Nutzerkennung, die trotzdem einen Zeilenfilter
 * brauchen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie sonst durchfallen
 * ══════════════════════════════════════════════════════════════
 *
 * Die Abdeckungspruefung zaehlt Tabellen mit `user_id`. Diese beiden
 * haben keine — aus gutem Grund:
 *
 *   `unterdrueckungen`     eine Adresse bleibt gesperrt, auch wenn sie
 *                          spaeter zu einem anderen Konto gehoert
 *   `zustell_ereignisse`   haengen an der Mail, nicht an der Person
 *
 * Ohne Richtlinie waeren sie offen. Wer die Anwendungsrolle hat,
 * koennte eine Sperre loeschen und damit an eine Adresse schreiben,
 * die sich beschwert hat — oder Zustellereignisse faelschen und einen
 * Bounce in eine Zustellung verwandeln.
 *
 * Beide bekommen deshalb RLS ohne jede zulassende Richtlinie fuer die
 * Anwendungsrolle: Der Versanddienst arbeitet ueber die
 * Systemverbindung, die Anwendung liest hier nie.
 *
 * RLS ohne Richtlinie sperrt alles. Damit die Pruefung „zu jedem
 * aktivierten RLS auch eine Richtlinie" nicht anschlaegt, steht je
 * eine ausdrueckliche Verweigerung da — sie ist ehrlicher als eine
 * fehlende Zeile, denn sie sagt, dass hier nichts erlaubt sein soll.
 */
ALTER TABLE unterdrueckungen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE unterdrueckungen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS unterdrueckungen_kein_zugriff ON unterdrueckungen
--> statement-breakpoint
CREATE POLICY unterdrueckungen_kein_zugriff ON unterdrueckungen USING (false)
--> statement-breakpoint
ALTER TABLE zustell_ereignisse ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE zustell_ereignisse FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS zustell_ereignisse_kein_zugriff ON zustell_ereignisse
--> statement-breakpoint
CREATE POLICY zustell_ereignisse_kein_zugriff ON zustell_ereignisse USING (false)

--> statement-breakpoint
/*
 * Die Einbettungen der Stellen.
 *
 * Dieselbe Luecke wie bei `job_analysen`: Die Tabelle traegt keine
 * `user_id` und faellt deshalb durch die Abdeckungspruefung -- und
 * offen heisst hier, dass eine Anwendungssitzung Vektoren
 * ueberschreiben koennte.
 *
 * Ein manipulierter Vektor ist kein auffaelliger Schaden. Er
 * verschiebt lautlos, was jemand als Kandidat zu sehen bekommt.
 *
 * Lesen ist frei: Ein Vektor aus Titel, Aufgaben und Anforderungen
 * einer oeffentlichen Anzeige verraet nichts, was die Anzeige nicht
 * selbst sagt. Schreiben gehoert dem Dienst.
 *
 * `WITH CHECK` fehlt bewusst -- eine Richtlinie, die nur liest, darf
 * nichts durchlassen, was schreibt.
 */
ALTER TABLE job_einbettungen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE job_einbettungen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS job_einbettungen_read ON job_einbettungen
--> statement-breakpoint
CREATE POLICY job_einbettungen_read ON job_einbettungen FOR SELECT USING (true)

--> statement-breakpoint
/*
 * Die Ortsreferenz.
 *
 * Dieselbe Lage wie bei `job_einbettungen`: keine `user_id`, also
 * unsichtbar fuer die Abdeckungspruefung -- und offen hiesse, dass
 * eine Anwendungssitzung Koordinaten aendern koennte.
 *
 * Eine verschobene Koordinate ist kein auffaelliger Schaden. Sie
 * verschiebt lautlos, welche Stellen in einem Umkreis liegen: Wer
 * Karlsruhe um zweihundert Kilometer versetzt, entfernt jede Stelle
 * dort aus jedem Suchauftrag, ohne dass irgendwo ein Fehler steht.
 *
 * Lesen ist frei -- es sind veroeffentlichte Postleitzahlen und
 * Ortsnamen aus einer offenen Quelle. Schreiben gehoert dem Import.
 */
ALTER TABLE geo_referenz ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE geo_referenz FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS geo_referenz_read ON geo_referenz
--> statement-breakpoint
CREATE POLICY geo_referenz_read ON geo_referenz FOR SELECT USING (true)

--> statement-breakpoint
/*
 * Mondays Eigeninitiative.
 *
 * Fuenf Tabellen, alle mit `user_id`. Was hier steht, ist besonders
 * heikel: `nutzer_ereignisse` sagt, wann jemand welche Stelle wie
 * lange angesehen hat, und `verhaltenssignale` sagt, was Monday daraus
 * schliesst.
 *
 * Ein Kandidat, der den Ereignisstrom eines anderen lesen koennte,
 * wuesste ueber dessen Jobsuche mehr als dessen Arbeitgeber.
 */
ALTER TABLE nutzer_ereignisse ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE nutzer_ereignisse FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS nutzer_ereignisse_self ON nutzer_ereignisse
--> statement-breakpoint
CREATE POLICY nutzer_ereignisse_self ON nutzer_ereignisse
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)
--> statement-breakpoint

ALTER TABLE verhaltenssignale ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE verhaltenssignale FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS verhaltenssignale_self ON verhaltenssignale
--> statement-breakpoint
CREATE POLICY verhaltenssignale_self ON verhaltenssignale
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)
--> statement-breakpoint

ALTER TABLE nina_handlungen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE nina_handlungen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS nina_handlungen_self ON nina_handlungen
--> statement-breakpoint
CREATE POLICY nina_handlungen_self ON nina_handlungen
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)
--> statement-breakpoint

ALTER TABLE nina_vormerkungen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE nina_vormerkungen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS nina_vormerkungen_self ON nina_vormerkungen
--> statement-breakpoint
CREATE POLICY nina_vormerkungen_self ON nina_vormerkungen
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)
--> statement-breakpoint

ALTER TABLE nina_eigeninitiative ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE nina_eigeninitiative FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS nina_eigeninitiative_self ON nina_eigeninitiative
--> statement-breakpoint
CREATE POLICY nina_eigeninitiative_self ON nina_eigeninitiative
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)

--> statement-breakpoint
/*
 * Profilintelligenz.
 *
 * Was Monday ueber einen Menschen zusammengetragen hat -- Staerken,
 * Widersprueche, offene Fragen. Fuer die Person selbst die
 * wertvollste Auskunft im Produkt, fuer jeden anderen ein Einblick,
 * den niemand erlaubt hat.
 */
ALTER TABLE profil_synthesen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE profil_synthesen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS profil_synthesen_self ON profil_synthesen
--> statement-breakpoint
CREATE POLICY profil_synthesen_self ON profil_synthesen
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)
--> statement-breakpoint

ALTER TABLE profil_klaerungen ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE profil_klaerungen FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS profil_klaerungen_self ON profil_klaerungen
--> statement-breakpoint
CREATE POLICY profil_klaerungen_self ON profil_klaerungen
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)

--> statement-breakpoint

/*
 * Das Betriebsprotokoll der Hintergrundlaeufe.
 *
 * Es enthaelt keine Inhalte -- nur Anlass, Zustand und Fehlerklasse.
 * Trotzdem traegt es eine Nutzerkennung, und damit gilt dieselbe
 * Regel wie ueberall: Wer die Zeilen eines anderen lesen kann, kann
 * sehen, wann und wie oft Monday sich mit ihm beschaeftigt hat.
 */
ALTER TABLE profil_laeufe ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE profil_laeufe FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS profil_laeufe_self ON profil_laeufe
--> statement-breakpoint
CREATE POLICY profil_laeufe_self ON profil_laeufe
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)

--> statement-breakpoint

/*
 * Die Filter der Stellenliste.
 *
 * Sie sagen, wonach jemand gerade sucht -- Ort, Gehaltsuntergrenze,
 * Arbeitszeit. Das ist wenig und trotzdem seine Sache.
 */
ALTER TABLE listenfilter ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE listenfilter FORCE ROW LEVEL SECURITY
--> statement-breakpoint
DROP POLICY IF EXISTS listenfilter_self ON listenfilter
--> statement-breakpoint
CREATE POLICY listenfilter_self ON listenfilter
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid)

