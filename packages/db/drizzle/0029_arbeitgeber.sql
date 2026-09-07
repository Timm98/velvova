-- Arbeitgeberkonten: Organisation, Rollen, Einladungen, Stellen, Pipeline.
--
-- ── Was schon da war und nie benutzt wurde ────────────────────
--
-- `organizations` und `memberships` existieren seit Beginn. Kein
-- einziger Codepfad ausserhalb des Schemas hat sie je gelesen oder
-- geschrieben. Diese Migration macht aus zwei toten Tabellen die
-- Grundlage des Arbeitgeberbereichs — sie legt sie deshalb nicht neu an,
-- sondern erweitert sie.
--
-- ── Die Trennlinie, die dieses Schema durchzieht ──────────────
--
-- Ein Unternehmen darf NIEMALS sehen:
--   * den privaten Monday-Chat einer Person
--   * ihre Lebenshaltung, ihre Steuerangaben, ihr aktuelles Gehalt
--   * ihre anderen Bewerbungen
--   * ihre gespeicherten Stellen und ihr Karriereprofil, solange sie es
--     nicht ausdrücklich für genau diese Bewerbung freigibt
--
-- Das ist keine Bitte an die Anwendungsschicht. Die Kandidatendaten
-- stehen deshalb NICHT in den Arbeitgebertabellen: Was ein Unternehmen
-- sieht, ist ein eigener Datensatz, der beim Bewerben entsteht, und
-- nicht ein Verweis in das Profil der Person.

CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'recruiter',
  -- Der Einladende bleibt nachvollziehbar. Wer jemanden in eine
  -- Organisation holt, in der Kandidatendaten liegen, ist eine Auskunft,
  -- die man später braucht.
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nur der Hash. Das Geheimnis steht im Einladungslink und sonst
  -- nirgends — auch nicht bei uns.
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_token_idx
  ON organization_invitations (token_hash)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON organization_invitations (organization_id, created_at DESC)
--> statement-breakpoint

-- Die Organisation bekommt, was ein Arbeitgeberkonto braucht.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  -- „verified" heisst: Wir haben die Zugehörigkeit zum Unternehmen
  -- geprüft. Ungeprüfte Konten dürfen keine Stellen veröffentlichen —
  -- sonst steht im Index eine Anzeige im Namen eines Unternehmens, das
  -- davon nichts weiss.
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug)
  WHERE slug IS NOT NULL
--> statement-breakpoint

-- Von Arbeitgebern selbst eingestellte Stellen.
--
-- Sie landen im gemeinsamen Stellenindex — aber erst beim
-- Veröffentlichen, und nur aus einer bestätigten Organisation. Bis
-- dahin ist ein Entwurf ein Entwurf und für niemanden ausserhalb der
-- Organisation sichtbar.
CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Die Stelle im gemeinsamen Index, sobald veröffentlicht. NULL,
  -- solange es ein Entwurf ist.
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title text NOT NULL,
  location text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'DE',
  work_model text,
  contract_type text,
  weekly_hours integer,

  -- Gehalt: bei einer selbst eingestellten Anzeige gibt es keinen Grund,
  -- es wegzulassen. Pflicht ist es trotzdem nicht — erzwungene Angaben
  -- werden erfunden, und eine erfundene Zahl ist schlimmer als keine.
  salary_min integer,
  salary_max integer,
  salary_currency text NOT NULL DEFAULT 'EUR',
  salary_period text NOT NULL DEFAULT 'year',

  description text NOT NULL DEFAULT '',
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,

  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_postings_org_idx ON job_postings (organization_id, created_at DESC)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_postings_job_idx ON job_postings (job_id)
--> statement-breakpoint

-- Was ein Unternehmen von einer Bewerbung sieht.
--
-- ── Warum das eine eigene Tabelle ist ─────────────────────────
--
-- Es wäre einfacher, `applications` um eine Organisationskennung zu
-- erweitern und den Arbeitgeber dort lesen zu lassen. Genau das wäre der
-- Fehler: An `applications` hängen Notizen der Person, ihre Termine,
-- ihre Coaching-Sitzungen und über `user_id` ihr ganzes Profil. Ein
-- vergessener Join, eine zu weit gefasste Abfrage — und das Unternehmen
-- liest mit.
--
-- Hier steht deshalb NUR, was die Person für DIESE Stelle freigegeben
-- hat. Es ist eine Kopie, kein Fenster. Die Trennung ist damit eine
-- Eigenschaft des Schemas und nicht eine Sorgfaltspflicht beim Abfragen.
CREATE TABLE IF NOT EXISTS posting_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Die Kennung der Person bleibt drin, weil sie ihre Bewerbung
  -- zurückziehen können muss. Sie ist der SCHLÜSSEL, nicht der Zugang:
  -- Über sie wird nichts nachgeladen, und die Zeilensicherheit unten
  -- erlaubt dem Unternehmen ausschliesslich diese Tabelle.
  candidate_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Die freigegebenen Angaben, als Kopie zum Zeitpunkt der Bewerbung.
  display_name text NOT NULL,
  contact_email text NOT NULL,
  headline text,
  cover_note text,
  shared_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  stage text NOT NULL DEFAULT 'new',
  -- Notizen des Unternehmens. Sie gehören dem Unternehmen und sind für
  -- die Person NICHT sichtbar — die Gegenrichtung derselben Trennlinie.
  employer_note text NOT NULL DEFAULT '',
  rejected_reason text,

  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS posting_candidates_unique
  ON posting_candidates (posting_id, candidate_user_id)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS posting_candidates_org_idx
  ON posting_candidates (organization_id, stage)
--> statement-breakpoint

-- Wer im Arbeitgeberbereich was getan hat.
--
-- Eine Absage, eine Statusänderung, ein entfernter Kollege: In einem
-- Bereich, in dem mehrere Menschen an denselben Bewerbungen arbeiten,
-- ist „wer war das?" keine Nebenfrage.
CREATE TABLE IF NOT EXISTS organization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  subject_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organization_events_org_idx
  ON organization_events (organization_id, occurred_at DESC)
