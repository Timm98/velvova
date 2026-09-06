-- Woher eine Gehaltsangabe stammt.
--
-- Bis hierher gab es nur `salary_disclosed`: ja oder nein. Das reicht
-- nicht mehr, seit Angaben aus dem Beschreibungstext gelesen werden.
--
-- Gemessen an echten Daten: von 1015 Stellen hatte keine einzige ein
-- Gehaltsfeld vom Anbieter — Arbeitnow kennt keines, Adzuna lieferte
-- bei 20 deutschen Anzeigen keines, JSearch bei 10 keines. Im Text
-- stehen Angaben in etwa 4,5 % der Fälle.
--
-- Eine aus Fliesstext gelesene Zahl ist aber nicht dasselbe wie ein
-- Feld, das der Arbeitgeber ausgefüllt hat. Sie kann sich auf etwas
-- anderes beziehen. Beides gleich zu speichern hiesse, die
-- Unterscheidung wegzuwerfen, auf die es ankommt — und danach hinge
-- eine harte Bedingung an einer Vermutung.
--
--   provider  Der Anbieter hat ein Gehaltsfeld geliefert.
--   text      Aus der Beschreibung gelesen. Belegt, aber nicht bestätigt.
--   NULL      Keine Angabe.
-- Wiederholbar: ein abgebrochener Lauf darf den nächsten nicht
-- blockieren. Postgres kennt kein CREATE TYPE IF NOT EXISTS.
DO $$ BEGIN
  CREATE TYPE salary_provenance AS ENUM ('provider', 'text');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_provenance salary_provenance;

-- Der Beleg: die Textstelle, aus der gelesen wurde. Ohne sie ist die
-- Angabe nicht überprüfbar, und eine unüberprüfbare Zahl darf neben
-- einer bestätigten nicht stehen.
--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_evidence text;
--> statement-breakpoint
-- Bestand: alles Vorhandene kam bisher ausschliesslich von Anbietern.
UPDATE jobs SET salary_provenance = 'provider' WHERE salary_disclosed = true;
