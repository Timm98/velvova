-- Der Career Twin: benannte Dimensionen statt Freitext.
--
-- Bisher stand die Arbeitsweise als Liste von Sätzen in `preferences`
-- und wurde per Wortüberschneidung mit der Stellenbeschreibung
-- verglichen. Das misst, ob dieselben Wörter vorkommen — nicht, ob die
-- Arbeit zur Person passt. „Eigenständig" steht in fast jeder Anzeige.
--
-- Eine Zeile je Angabe, nicht je Dimension: Mehrere Aussagen zur
-- selben Achse ergeben zusammen ein belastbareres Bild als die
-- jeweils letzte, und die Herkunft entscheidet, wie schwer jede wiegt.
create table if not exists arbeitsprofil (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  dimension text not null,
  -- 0 bis 1. Die Enden benennt DIMENSIONSTEXT; eine nackte Zahl wäre
  -- ohne sie nicht deutbar.
  wert double precision not null,
  -- gespraech, selbstauskunft, probe, beobachtet
  herkunft text not null,
  -- Der Satz, der den Wert belegt. Ohne ihn ist die Zahl nicht prüfbar,
  -- und der Mensch könnte nicht widersprechen.
  beleg text not null default '',
  erfasst_am timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists arbeitsprofil_user_idx on arbeitsprofil (user_id, dimension);
--> statement-breakpoint
-- Dieselben Dimensionen für die Stelle.
--
-- Getrennt von `jobs`, weil sie abgeleitet sind und nicht aus der
-- Anzeige stammen: Wer sie in die Stellentabelle schriebe, könnte
-- später nicht mehr unterscheiden, was der Arbeitgeber gesagt und was
-- wir geschätzt haben.
create table if not exists stellen_profil (
  job_id uuid not null references jobs(id) on delete cascade,
  dimension text not null,
  wert double precision not null,
  -- 0 bis 1. Wie sicher die Ableitung ist. Bei 0 wird sie nicht gezeigt.
  sicherheit double precision not null default 0,
  -- Woran es erkannt wurde. Macht die Schätzung nachvollziehbar.
  beleg text not null default '',
  abgeleitet_am timestamptz not null default now(),
  primary key (job_id, dimension)
);
