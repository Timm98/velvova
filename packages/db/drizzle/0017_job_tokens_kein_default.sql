-- Den Standardwert wieder wegnehmen.
--
-- 0016 hat ihn gesetzt, um die Spalten überhaupt auf NOT NULL bringen
-- zu können. Stehen bleiben darf er nicht: ein Standardwert heisst,
-- dass ein INSERT die Spalte weglassen DARF — und genau das ist hier
-- der Fehler, den man nicht sieht. Die Zeile entsteht, niemand
-- beschwert sich, und die Stelle wird für immer mit leerer Wortmenge
-- bewertet: kein Absturz, keine Warnung, nur ein Passungswert, dem zwei
-- seiner sieben Achsen fehlen.
--
-- Ohne Standardwert verlangt Drizzle die Felder beim Schreiben, und der
-- Typprüfer meldet die vergessene Stelle, bevor sie Daten anfasst.

ALTER TABLE "jobs" ALTER COLUMN "description_tokens" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description_length" DROP DEFAULT;
