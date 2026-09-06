-- Wann eine Firma zuletzt angereichert wurde — und ob es klappte.
--
-- ── Warum das gespeichert werden muss ─────────────────────────
--
-- Die Anreicherung kostet Geld: gemessen 14 Einheiten je erfolgreichem
-- Treffer, und 38 % der Firmen lassen sich überhaupt zuordnen. Ohne
-- Gedächtnis würde jeder Lauf dieselben 62 % erfolglos erneut
-- versuchen — bei 134.221 Firmen wären das zehntausende Einheiten für
-- nichts.
--
-- `angereichert_am` heisst „gefragt", nicht „gefunden". Ob etwas
-- gefunden wurde, steht in den Spalten `industry`, `size_band` und
-- `headquarters` — sie waren bis heute bei allen 134.221 Firmen leer,
-- obwohl es sie seit jeher gibt.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS angereichert_am timestamptz
--> statement-breakpoint
-- Mitarbeiterzahl als Spanne, wie der Anbieter sie liefert
-- („201-500 employees"). Nicht als Zahl: „10,001+" ist keine.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mitarbeiter text
--> statement-breakpoint
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gegruendet integer
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS companies_angereichert_idx ON companies (angereichert_am NULLS FIRST)
