-- Die Filter der Stellenliste -- und warum sie NICHT im Suchauftrag stehen.
--
-- ══════════════════════════════════════════════════════════════
-- Drei Entscheidungen, drei Orte
-- ══════════════════════════════════════════════════════════════
--
-- Das Produkt kennt drei verschiedene Dinge, die sich aehneln und
-- niemals ein Feld werden duerfen:
--
--   Profil        wer jemand ist und was er kann
--   Suchauftrag   wonach Monday im Hintergrund weitersucht
--   Listenfilter  was gerade auf dem Bildschirm zu sehen ist
--
-- „Zeig mir mal Bayern" ist keine Beauftragung. Wer das in den
-- Suchauftrag schriebe, bekaeme morgen frueh eine Mail ueber Stellen
-- in Bayern -- fuer einen Satz, der nur „ich schau mich gerade um"
-- bedeutet hat. Schweigen aktiviert nichts, und Umschauen auch nicht.
--
-- ══════════════════════════════════════════════════════════════
-- Warum ueberhaupt gespeichert
-- ══════════════════════════════════════════════════════════════
--
-- Weil die Filter bisher nur in der Adresse standen. Ein geteilter
-- Link trug sie mit, ein frischer Besuch nicht: Wer gestern Umkreis,
-- Gehalt und Vertragsart eingestellt hatte, fing heute wieder bei
-- null an -- und musste dasselbe noch einmal eintippen.
--
-- Eine Zeile je Person, der zuletzt benutzte Stand. Keine Historie:
-- Was gestern eingestellt war, interessiert niemanden; was zuletzt
-- galt, schon.
CREATE TABLE IF NOT EXISTS "listenfilter" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  -- Die Filter als flaches Objekt, so wie sie in der Adresse stehen.
  --
  -- Als jsonb und nicht als Spalten: Ein neuer Filter ist dann eine
  -- Zeile im Code und keine Migration. Der Preis ist, dass die
  -- Datenbank die Schluessel nicht prueft -- und den zahlt sie gern,
  -- denn ein unbekannter Schluessel in der Adresse tut ohnehin nichts.
  "filter" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "aktualisiert_am" timestamptz NOT NULL DEFAULT now()
)
