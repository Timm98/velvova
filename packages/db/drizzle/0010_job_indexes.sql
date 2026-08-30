-- Vier Indizes, die bei 994 Stellen noch niemand vermisst und bei
-- 100.000 die Jobliste unbenutzbar machen.
--
-- Geprüft gegen pg_indexes, nicht geraten: die übrigen 178 Indizes
-- decken alles ab, was hier nicht steht.

-- Die Quellenabdeckung gruppiert über source_id. Ohne Index ist das ein
-- vollständiger Tabellendurchlauf bei jedem Aufruf der Jobseite.
CREATE INDEX IF NOT EXISTS "jobs_source_idx" ON "jobs" ("source_id");
--> statement-breakpoint

-- Abgelaufene Stellen werden bei JEDER Liste weggefiltert. Ein
-- Teilindex reicht: nach Zeilen ohne Ablaufdatum wird nie gesucht.
CREATE INDEX IF NOT EXISTS "jobs_expires_idx" ON "jobs" ("expires_at")
  WHERE "expires_at" IS NOT NULL;
--> statement-breakpoint

-- Dasselbe für tote Links. Auch hier ein Teilindex: `false` ist die
-- Ausnahme, und nur nach ihr wird gefragt.
CREATE INDEX IF NOT EXISTS "jobs_dead_link_idx" ON "jobs" ("last_link_check_ok")
  WHERE "last_link_check_ok" = false;
--> statement-breakpoint

-- Beim Löschen einer Stelle räumt Postgres die Treffer auf. Ohne diesen
-- Index sucht es sie mit einem Tabellendurchlauf je gelöschter Zeile.
CREATE INDEX IF NOT EXISTS "job_matches_job_idx" ON "job_matches" ("job_id");
