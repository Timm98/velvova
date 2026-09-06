-- Die Role Truth Card: was der Arbeitgeber sagt, was Mitarbeiter bestätigen.
--
-- ── Warum das mehr ist als ein längeres Formular ──────────────
--
-- Eine Stellenanzeige beschreibt, was jemand können soll. Sie
-- beschreibt nicht, wie der Tag aussieht: Welche Aufgabe frisst
-- tatsächlich wie viel Zeit? Wie viel Druck? Wie viel Kundenkontakt?
-- Warum gehen Leute wieder?
--
-- Das sind die Fragen, an denen Menschen scheitern, obwohl sie die
-- Arbeit können. Sie stehen in keiner Anzeige, weil keine Anzeige sie
-- stellt.
--
-- ── Warum getrennte Tabellen für Aussage und Bestätigung ─────
--
-- Weil die Herkunft der Kern der Sache ist. „Der Arbeitgeber sagt: viel
-- Eigenverantwortung" und „vier von sechs Mitarbeitern bestätigen das"
-- sind zwei verschiedene Auskünfte, und die zweite ist die wertvolle.
--
-- In einer Tabelle mit einem Flag liesse sich das später nicht mehr
-- sauber trennen — und genau diese Trennung ist das Versprechen.

-- Was der Arbeitgeber über die Rolle sagt, Achse für Achse.
create table if not exists rollen_aussagen (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references job_postings(id) on delete cascade,
  -- Eine der zehn Arbeitsdimensionen.
  dimension text not null,
  -- 0 bis 1 auf derselben Achse wie der Career Twin.
  wert double precision not null,
  -- Der Satz dazu. Eine Zahl ohne Begründung ist keine Auskunft.
  begruendung text not null default '',
  erstellt_am timestamptz not null default now(),
  unique (posting_id, dimension)
);
--> statement-breakpoint
-- Was Mitarbeiter derselben Rolle dazu sagen.
create table if not exists rollen_bestaetigungen (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references job_postings(id) on delete cascade,
  -- Wer bestätigt hat. Für die Anzeige nie sichtbar; nur damit
  -- dieselbe Person nicht zweimal zählt.
  user_id uuid not null references users(id) on delete cascade,
  dimension text not null,
  -- Der eigene Wert, nicht ein Ja/Nein. Wer widerspricht, sagt damit
  -- auch, wie es stattdessen ist.
  wert double precision not null,
  -- Freiwillig, und der einzige Teil, der als Zitat erscheinen kann.
  kommentar text not null default '',
  erstellt_am timestamptz not null default now(),
  unique (posting_id, user_id, dimension)
);
--> statement-breakpoint
-- Welche Aufgabe wie viel Zeit frisst.
--
-- Die Anzeige listet Aufgaben als gleichrangige Punkte. In Wahrheit
-- macht eine davon sechzig Prozent des Tages aus, und genau die
-- entscheidet, ob jemand bleibt.
create table if not exists rollen_aufgaben (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references job_postings(id) on delete cascade,
  aufgabe text not null,
  -- 0 bis 100. Die Summe muss nicht 100 ergeben; wer nur die drei
  -- grössten nennt, hat trotzdem etwas gesagt.
  zeitanteil integer not null,
  reihenfolge integer not null default 0,
  erstellt_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists rollen_aufgaben_posting_idx on rollen_aufgaben (posting_id, reihenfolge);
--> statement-breakpoint
-- Warum Menschen diese Position wieder verlassen.
--
-- Vom Arbeitgeber selbst genannt. Wer das ausfüllt, sagt etwas über
-- sich — und wer es leer lässt, auch.
create table if not exists rollen_abgaenge (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references job_postings(id) on delete cascade,
  grund text not null,
  reihenfolge integer not null default 0,
  erstellt_am timestamptz not null default now()
);
