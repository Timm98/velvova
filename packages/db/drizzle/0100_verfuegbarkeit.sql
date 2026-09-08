-- Ob eine Stelle noch ausgeschrieben ist — und woher wir das wissen.
--
-- ══════════════════════════════════════════════════════════════
-- Die zwei Verwechslungen, gegen die diese Spalten stehen
-- ══════════════════════════════════════════════════════════════
--
--   „Link kaputt"        ist nicht  „Stelle abgelaufen"
--   „nicht mehr im Feed" ist nicht  „besetzt"
--
-- Bisher gab es `last_seen_at` und `last_check_ok`. Beides sind
-- Beobachtungen, kein Urteil: `last_seen_at` sagt, wann wir sie
-- zuletzt sahen, nicht warum wir sie nicht mehr sehen. Genau diese
-- Lücke füllen die neuen Spalten.
--
-- ══════════════════════════════════════════════════════════════
-- Warum der Zustand an der FUNDSTELLE hängt, nicht an der Stelle
-- ══════════════════════════════════════════════════════════════
--
-- Dieselbe Vakanz steht oft mehrfach da: einmal beim ATS des
-- Arbeitgebers, einmal bei einem Aggregator, der sie von dort hat.
-- Verschwindet sie beim Aggregator, während das ATS sie weiter führt,
-- ist sie aktiv — der Aggregator hat womöglich nur seinen Feed
-- geändert.
--
-- Jede Fundstelle trägt deshalb ihren eigenen Zustand, und die Stelle
-- bekommt ihren aus der NÄCHSTEN Quelle (`rank`, kleiner ist näher).
-- Die Regel steht in `packages/domain/src/verfuegbarkeit.ts` und ist
-- dort einzeln geprüft.
--
-- ══════════════════════════════════════════════════════════════
-- `missing_successful_sync_count` — der Zähler, der schützt
-- ══════════════════════════════════════════════════════════════
--
-- Gezählt wird ausschliesslich bei VOLLSTÄNDIGEN Läufen. Ein Fehler,
-- ein Zeitablauf, ein 429 oder ein abgebrochener Lauf erhöht ihn
-- nicht.
--
-- Ohne diese Bedingung schliesst ein fünfminütiger Ausfall eines ATS
-- den halben Bestand — und zwar lautlos, denn eine Stelle, die
-- verschwindet, beschwert sich nicht.
alter table job_source_links
  -- Siehe den Typ `Verfuegbarkeit` in @paycheck/domain. Absichtlich
  -- `text` und kein Enum: Ein neuer Zustand soll eine Codeänderung
  -- sein, keine Migration mit Tabellensperre.
  add column if not exists availability_state text not null default 'unknown',
  -- In Worten, für die Oberfläche und fürs Protokoll. Der Satz sagt,
  -- WARUM — und das ist der Unterschied zwischen einer Auskunft und
  -- einer Behauptung.
  add column if not exists availability_reason text,
  -- Wann zuletzt wirklich geprüft wurde. Bleibt bei einem
  -- unvollständigen Lauf ausdrücklich stehen: Es gab keine Prüfung.
  add column if not exists availability_checked_at timestamptz,
  -- Wie oft die Stelle bei einem VOLLSTÄNDIGEN Lauf gefehlt hat.
  add column if not exists missing_successful_sync_count integer not null default 0,
  -- Bewerbungsfrist laut Quelle. Getrennt von `jobs.expires_at`, weil
  -- verschiedene Quellen verschiedene Fristen zur selben Stelle
  -- nennen können — und dann ist die der näheren Quelle die richtige.
  add column if not exists valid_through timestamptz;
--> statement-breakpoint

-- Wann diese Quelle zuletzt VOLLSTÄNDIG geladen wurde.
--
-- `last_run_at` gibt es schon, aber es beantwortet die falsche Frage:
-- Es sagt, wann ein Lauf war, nicht ob er den ganzen Bestand gesehen
-- hat. Ein Lauf mit Zeitbudget oder Stückzahlgrenze endet mitten
-- drin — und aus so einem Lauf folgt über eine fehlende Stelle
-- nichts.
alter table job_sources
  add column if not exists last_full_sync_at timestamptz;
--> statement-breakpoint

-- Die aktiven Fundstellen einer Stelle finden, ohne die Tabelle zu
-- lesen. Der Teilindex ist klein, weil die meisten Zeilen 'active'
-- oder 'unknown' sind und gar nicht darin stehen.
create index if not exists job_source_links_availability_idx
  on job_source_links (availability_state)
  where availability_state <> 'active';
