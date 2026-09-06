-- Der Index für die Kandidatenauswahl.
--
-- ── Warum er nötig wurde ──────────────────────────────────────
--
-- Bewertet wird nicht mehr der ganze Bestand, sondern eine Vorauswahl
-- der neuesten Stellen, die die harten Bedingungen nicht verletzen.
-- Der Speicherbedarf fiel damit von 3,4 GB auf 490 MB.
--
-- Die Abfrage dahinter sortiert aber 823.429 Zeilen nach Datum, um
-- zweitausend zu nehmen. Ohne Index ist das ein vollständiger Durchlauf
-- mit Sortierung: Die Stellenliste brauchte danach 35 Sekunden statt
-- fünf.
--
-- ── Warum ein Ausdrucksindex ──────────────────────────────────
--
-- Sortiert wird nach `coalesce(published_at, fetched_at)` — viele
-- Quellen nennen kein Veröffentlichungsdatum, und dann gilt der
-- Abrufzeitpunkt. Ein Index auf `published_at` allein hilft dieser
-- Abfrage nicht; Postgres kann ihn für den Ausdruck nicht verwenden.
--
-- `is_demo` steht vorn, weil jede Abfrage danach filtert.

CREATE INDEX IF NOT EXISTS jobs_kandidaten_idx
  ON jobs (is_demo, (coalesce(published_at, fetched_at)) DESC)
--> statement-breakpoint
-- Für die Gehaltsbedingung: Sie prüft `salary_disclosed` und die
-- Beträge. Ein Index darauf spart das Nachschlagen in der Tabelle,
-- wenn jemand eine Untergrenze gesetzt hat.
CREATE INDEX IF NOT EXISTS jobs_gehalt_idx
  ON jobs (salary_disclosed, salary_period, salary_max, salary_min)
  WHERE is_demo = false
