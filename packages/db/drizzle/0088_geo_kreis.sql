-- Der Landkreis zur Ortsreferenz.
--
-- Gemessen an 1209 analysierten Stellen: 62 Ortsangaben blieben
-- mehrdeutig, weil das Bundesland sie nicht trennt. Der Kreis trennt
-- sie:
--
--   Bernau, Barnim (Kreis)              → Brandenburg  · Landkreis Barnim
--   Bernau                              → Baden-Wuerttemberg · Landkreis Waldshut
--   Moosburg, Freising (Kreis)          → Bayern       · Landkreis Freising
--   Hofstetten, Landsberg am Lech       → Bayern       · Landkreis Landsberg am Lech
--
-- Die Stellenanzeige nennt den Kreis in Klammern hinter dem Ort. Die
-- Quelle fuehrt ihn in `admin3name` -- in 23.296 von 23.297 Zeilen
-- gefuellt. Ohne diese Spalte wird aus einer eindeutigen Angabe eine
-- mehrdeutige, und die Stelle faellt aus jedem Umkreis.
ALTER TABLE "geo_referenz" ADD COLUMN IF NOT EXISTS "kreis" text
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_referenz_kreis_idx" ON "geo_referenz" ("land", "kreis")
--> statement-breakpoint
-- Der Kreis gehoert in den eindeutigen Schluessel.
--
-- Ohne ihn faellt die Mittelpunktzeile zweier gleichnamiger Orte
-- desselben Bundeslands zusammen, und der Mittelpunkt landet zwischen
-- ihnen -- bei den beiden Neuenhagen in Brandenburg zwanzig Kilometer
-- neben beiden. Ein Punkt, an dem keine der beiden Staedte liegt.
DROP INDEX IF EXISTS "geo_referenz_unique"
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "geo_referenz_unique" ON "geo_referenz"
  ("land", "name_norm", COALESCE("region", ''), COALESCE("kreis", ''), COALESCE("plz", ''), "quelle_fassung")
