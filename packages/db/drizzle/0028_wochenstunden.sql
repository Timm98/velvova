-- Wochenstunden der aktuellen Stelle.
--
-- Ohne sie lässt sich kein Stundenwert rechnen, und der Stundenwert ist
-- die einzige Zahl, die zwei Stellen fair vergleicht:
--
--   70.000 € bei 40 Stunden und einer Stunde Weg an fünf Tagen
--   63.000 € bei 35 Stunden und zehn Minuten Weg an zwei Tagen
--
-- Die erste zahlt mehr und ist je aufgewendeter Stunde die schlechtere.
-- Im Jahresgehalt sieht man das nicht.
--
-- NULLABLE, wie alles in dieser Tabelle: Wer die Angabe nicht macht,
-- bekommt den Grund zu lesen statt einer Zahl, die auf einer Annahme
-- beruht. Vierzig zu unterstellen verfehlt eine Teilzeitstelle um die
-- Hälfte, und zwar in die Richtung, die schlechter aussieht.
ALTER TABLE current_employment
  ADD COLUMN IF NOT EXISTS weekly_hours integer;
