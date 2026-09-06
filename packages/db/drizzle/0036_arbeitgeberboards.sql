-- Gefundene und nicht gefundene Arbeitgeber-Boards.
--
-- ── Wozu ──────────────────────────────────────────────────────
--
-- Greenhouse, Ashby, SmartRecruiters und Personio betreiben je
-- Arbeitgeber ein offenes Stellenverzeichnis — ohne Schlüssel
-- abrufbar. Geprüft am 3.9.2026: Greenhouse/Stripe 591 Stellen,
-- Greenhouse/Datadog 442, Ashby/Ramp 140.
--
-- Was es nicht gibt, ist ein Verzeichnis der Kennungen. Aus dem
-- Firmennamen lässt sich eine raten: „gocomo GmbH" → `gocomo`.
-- Gemessen an 50 zufälligen DACH-Arbeitgebern trifft das in 4 % der
-- Fälle, im Schnitt mit 10 Stellen je Board.
--
-- ── Warum auch Misserfolge gespeichert werden ─────────────────
--
-- 96 % der Versuche gehen ins Leere. Ohne Gedächtnis würde jeder Lauf
-- dieselben zehntausend Fehlversuche wiederholen — für uns Zeit, für
-- die Anbieter sinnlose Last. Ein Misserfolg ist ein Ergebnis und
-- gehört aufgehoben.
--
-- Deshalb hat `gefunden` drei Zustände: true, false, und noch nie
-- gefragt (die Zeile fehlt).

CREATE TABLE IF NOT EXISTS arbeitgeber_boards (
  -- Anbieter und geratene Kennung, etwa ('personio','gocomo').
  anbieter text NOT NULL,
  kennung text NOT NULL,
  -- Der Firmenname, aus dem die Kennung entstand — zum Nachvollziehen.
  firma text NOT NULL,
  gefunden boolean NOT NULL DEFAULT false,
  -- Wie viele Stellen beim letzten Abruf dort standen.
  stellen integer NOT NULL DEFAULT 0,
  gefragt_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anbieter, kennung)
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS arbeitgeber_boards_gefunden_idx
  ON arbeitgeber_boards (gefunden, gefragt_am)
