-- Wann Nina die Nachricht tatsaechlich gesagt hat.
--
-- Ohne diese Spalte muesste der Browser sich merken, was er schon
-- angezeigt hat. Das waere an drei Stellen falsch: Auf einem zweiten
-- Geraet kaeme dieselbe Nachricht noch einmal, im privaten Fenster
-- jedes Mal, und die Sprachausgabe wuesste nichts davon, was der Chat
-- schon gesagt hat.
--
-- `erstellt_am` sagt, wann Nina etwas zu sagen hatte. `gezeigt_am`
-- sagt, wann sie es gesagt hat. Zwischen beidem koennen Stunden
-- liegen -- die Handlung geschieht sofort, das Reden erst, wenn
-- jemand hinsieht.
ALTER TABLE "nina_handlungen" ADD COLUMN IF NOT EXISTS "gezeigt_am" timestamptz
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nina_handlungen_ungesagt_idx"
  ON "nina_handlungen" ("user_id", "erstellt_am")
  WHERE "nachricht" IS NOT NULL AND "gezeigt_am" IS NULL
