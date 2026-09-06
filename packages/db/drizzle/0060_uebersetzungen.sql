-- Originalsprache der Anzeige und der Übersetzungsspeicher.
--
-- ── Warum die Sprache an der Stelle steht ─────────────────────
--
-- Gemessen an 400 zufälligen deutschen Stellen: 15 sind auf Englisch
-- geschrieben — hochgerechnet rund 31.000 Anzeigen, die in einer
-- deutschen Oberfläche englisch dastehen.
--
-- Erkannt wird deterministisch über Funktionswörter, nicht mit einem
-- Modell: Bei 2,3 Mio. Anzeigen wäre ein Modellaufruf je Anzeige nicht
-- bezahlbar, und Zählen ist prüfbar.
alter table jobs add column if not exists original_language text;
--> statement-breakpoint
create index if not exists jobs_original_language_idx on jobs (original_language)
  where original_language is not null;
--> statement-breakpoint
-- ── Warum ein eigener Speicher ────────────────────────────────
--
-- Eine Übersetzung bei jedem Seitenaufruf neu zu erzeugen kostet bei
-- jedem Leser dasselbe Geld für dasselbe Ergebnis. Sie ist zudem nicht
-- reproduzierbar: Zwei Menschen sähen zwei verschiedene Fassungen
-- derselben Anzeige.
--
-- Der Originaltext bleibt in `jobs` unverändert. Was hier steht, ist
-- eine zusätzliche Fassung, keine Ersetzung — und die Oberfläche kann
-- jederzeit auf das Original zurückschalten.
create table if not exists job_uebersetzungen (
  job_id uuid not null references jobs(id) on delete cascade,
  sprache text not null,
  titel text not null,
  beschreibung text not null,
  /* Welches Modell und welche Fassung — ohne das lässt sich später
     nicht sagen, warum eine Übersetzung so aussieht, wie sie aussieht. */
  modell text not null,
  erstellt_am timestamptz not null default now(),
  primary key (job_id, sprache)
);
