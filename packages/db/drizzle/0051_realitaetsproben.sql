-- Reality Sessions: die konkrete Stelle erleben, bevor man unterschreibt.
--
-- ── Was die allgemeinen Arbeitsproben nicht können ───────────
--
-- Sie zeigen, ob jemand grundsätzlich zu Pflege, Vertrieb oder
-- Handwerk passt. Sie zeigen nicht, wie DIESER Vorgesetzte
-- kommuniziert, wie klar die Aufgaben in DIESEM Haus sind, wie sich
-- das tatsächliche Tempo anfühlt.
--
-- ── Warum die kleine Fassung zuerst ──────────────────────────
--
-- Die grosse Fassung — ein halber Tag im Team, mit Aufgabe und
-- Rückmeldung — braucht Arbeitgeber, die mitmachen. Die kleine
-- braucht nur einen Menschen, der die Rolle kennt: fünfzehn Minuten,
-- anonym, mit einer Person, die dort arbeitet oder gearbeitet hat.
--
-- Deshalb steht hier beides in einer Tabelle, unterschieden durch
-- `art`. Wer mit dem Grossen anfinge, hätte auf Monate nichts.
create table if not exists realitaetsproben (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid references job_postings(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  -- gespraech · aufgabe · teamtermin
  art text not null default 'gespraech',
  -- Wer sie anbietet: die Person, die die Rolle kennt.
  anbieter_user_id uuid not null references users(id) on delete cascade,
  -- Was angeboten wird, in Worten der anbietenden Person.
  beschreibung text not null default '',
  dauer_minuten integer not null default 15,
  -- Ob sie vergütet wird. Eine Aufgabe ohne Vergütung darf keine
  -- produktive Arbeit sein -- das steht in der Beschreibung und wird
  -- hier festgehalten, damit es prüfbar bleibt.
  verguetet boolean not null default false,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists realitaetsproben_stelle_idx on realitaetsproben (job_id) where aktiv;
--> statement-breakpoint
-- Was der Bewerber danach sagt.
--
-- Beide Seiten bewerten: Nicht nur das Unternehmen den Bewerber,
-- sondern der Bewerber anonym die Klarheit der Führung, die Qualität
-- der Rückmeldung, den Respekt im Umgang und die Übereinstimmung mit
-- der Anzeige.
create table if not exists realitaetsrueckmeldungen (
  id uuid primary key default gen_random_uuid(),
  probe_id uuid not null references realitaetsproben(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  -- Je 1 bis 5.
  klarheit integer,
  rueckmeldung integer,
  respekt integer,
  tempo integer,
  -- Stimmte, was in der Anzeige stand?
  stimmt_mit_anzeige integer,
  -- Hat die Arbeit Energie gegeben? Dieselbe Frage wie bei den
  -- Arbeitsproben -- und dieselbe Trennung von „konnte ich es".
  energie integer,
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  unique (probe_id, user_id)
);
