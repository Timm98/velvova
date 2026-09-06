-- Die abgeleiteten Spalten verbindlich machen.
--
-- 0015 hat sie angelegt und den Bestand nachgezogen. Nullbar bleiben
-- dürfen sie nicht: die Rangfolge liest sie bei JEDER Stelle, und ein
-- NULL wäre dort kein „unbekannt", sondern ein stiller Nullwert im
-- Passungswert. Ein Standardwert macht daraus einen Import-Fehler, der
-- auffällt, statt eines Bewertungsfehlers, der es nicht tut.

UPDATE "jobs" SET "description_tokens" = '' WHERE "description_tokens" IS NULL;
--> statement-breakpoint
UPDATE "jobs" SET "description_length" = 0 WHERE "description_length" IS NULL;
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description_tokens" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description_tokens" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description_length" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description_length" SET NOT NULL;
