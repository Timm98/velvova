-- Der Zustand der STELLE, aus ihren Fundstellen gebildet.
--
-- ══════════════════════════════════════════════════════════════
-- Warum es zwei Ebenen gibt
-- ══════════════════════════════════════════════════════════════
--
-- 0100 gab jeder FUNDSTELLE ihren eigenen Zustand — richtig so:
-- Dieselbe Vakanz kann beim ATS des Arbeitgebers aktiv sein und beim
-- Aggregator verschwunden.
--
-- Nur beantwortet das nicht die Frage, die eine Liste stellt: Soll
-- diese Stelle noch angezeigt werden? Dafür braucht es eine Antwort
-- je Stelle, und die entsteht aus den Fundstellen nach der Regel in
-- `standAusFundstellen`:
--
--   ATS aktiv  + Aggregator weg    -> aktiv
--   ATS weg    + Aggregator aktiv  -> nicht mehr veroeffentlicht
--   gleichrangig uneinig           -> aktiv
--
-- Die naehere Quelle entscheidet (`job_source_links.rank`, kleiner
-- ist naeher). Bei Gleichstand gewinnt die aktivste Aussage: Eine zu
-- viel gezeigte Stelle aergert, eine zu wenig gezeigte fehlt.
--
-- ══════════════════════════════════════════════════════════════
-- Warum gespeichert und nicht bei jeder Abfrage gerechnet
-- ══════════════════════════════════════════════════════════════
--
-- Weil die Stellenliste danach filtern muss. Ein Verbund ueber
-- `job_source_links` mit Gruppierung und Rangwahl bei jeder Abfrage
-- ueber 3,45 Mio. Zeilen ist genau der Fehler, der diese Seite schon
-- einmal in die Zeitgrenze gebracht hat.
--
-- Geschrieben wird der Wert am Ende jedes vollstaendigen Laufs, und
-- nur fuer die Stellen, deren Fundstellen sich geaendert haben.
alter table jobs
  add column if not exists availability_state text not null default 'unknown';
--> statement-breakpoint

alter table jobs
  add column if not exists availability_reason text;
--> statement-breakpoint

alter table jobs
  add column if not exists availability_checked_at timestamptz;
--> statement-breakpoint

-- Die Stellenliste fragt nach den AKTIVEN. Der Teilindex enthaelt nur
-- die anderen und ist deshalb klein: Im Normalfall ist fast alles
-- aktiv, und was aktiv ist, muss nicht indiziert werden, um
-- ausgeschlossen zu werden.
create index if not exists jobs_availability_idx
  on jobs (availability_state)
  where availability_state <> 'active';
