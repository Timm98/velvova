-- ═══════════════════════════════════════════════════════════════
-- Der fehlende Volltextindex auf dem Stellentitel
-- ═══════════════════════════════════════════════════════════════
--
-- `kandidatenLaden` sucht mit
--
--   to_tsvector('german', title) @@ plainto_tsquery('german', begriff)
--   OR to_tsvector('simple', location) @@ plainto_tsquery('simple', begriff)
--
-- Für die zweite Hälfte gibt es `jobs_ort_idx`. Für die erste gab es
-- nichts — bei 3,37 Millionen Zeilen also ein vollständiger Durchlauf.
--
-- Gemessen auf der Stellenseite:
--
--   ohne Suchbegriff     Stellen  334 ms
--   mit „Vertrieb"       Stellen 7342 ms
--   mit „Lager"          Stellen 5080 ms
--
-- Dieselbe Abfrage steckt hinter Mondays Werkzeug `search_jobs`. Wer
-- „zeig mir Jobs" sagte, wartete deshalb Sekunden bis Minuten.
--
-- ── Warum `german` und nicht `simple` ─────────────────────────
--
-- Weil der Index zur Abfrage passen MUSS. `to_tsvector('german', …)`
-- und `to_tsvector('simple', …)` sind für Postgres zwei verschiedene
-- Ausdrücke; ein Index über den einen hilft dem anderen nicht. Die
-- Abfrage benutzt für den Titel `german` — das stemmt deutsche
-- Wortformen, „Lagerist" findet damit auch „Lageristen".
--
-- ── Warum die Teilbedingung ──────────────────────────────────
--
-- `WHERE is_demo = false` hält den Index klein und passt zur
-- Kandidatenauswahl, die Demodaten ohnehin ausschliesst. Dieselbe
-- Bedingung trägt `jobs_ort_idx` bereits.
--
-- ── Warum CONCURRENTLY ───────────────────────────────────────
--
-- Ein gewöhnliches CREATE INDEX sperrt die Tabelle gegen Schreiben,
-- bis es fertig ist. Bei 3,37 Millionen Zeilen sind das Minuten, in
-- denen kein Stellenabruf laufen könnte. `CONCURRENTLY` dauert
-- länger und sperrt nicht.
--
-- Es kann deshalb NICHT in einer Transaktion laufen. Bricht es ab,
-- bleibt ein ungültiger Index stehen; `DROP INDEX IF EXISTS` davor
-- räumt ihn weg, und der zweite Anlauf funktioniert.

-- ── Warum die Zeitgrenze aufgehoben wird ─────────────────────
--
-- Supabase beendet Anweisungen nach einer festen Zeit. Ein GIN-Index
-- über 3,37 Millionen Titel braucht länger als diese Grenze — der
-- erste Anlauf endete mit „canceling statement due to statement
-- timeout", und zurück blieb nichts.
--
-- `SET statement_timeout = 0` gilt nur für diese Verbindung und nur
-- für die Dauer dieser Migration. Es ist keine Einstellung an der
-- Datenbank.

SET statement_timeout = 0;
--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS jobs_volltext_idx;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_volltext_idx
  ON jobs USING gin (to_tsvector('german', title))
  WHERE is_demo = false;
