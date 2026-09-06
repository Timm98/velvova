-- Zweistufiges Ranking: die Beschreibung vorverdauen.
--
-- `description` ist mit 2,8 von 3,9 MB die mit Abstand grösste Spalte
-- der Tabelle. Sie wurde bei JEDEM Seitenaufruf für alle 994 Stellen
-- geladen — für eine Liste, die sie nie anzeigt.
--
-- Weglassen ging trotzdem nicht, weil sie ins Ranking einfliesst. Aber
-- nicht als Text: `overlap()` in fit.ts reduziert beide Seiten auf eine
-- MENGE eindeutiger Wörter über drei Zeichen. Was von einer
-- Stellenbeschreibung im Passungswert ankommt, ist also genau diese
-- Menge — nicht die Reihenfolge, nicht die Häufigkeit, nicht die
-- Grammatik.
--
-- Deshalb hier zwei abgeleitete Spalten:
--
--   description_tokens  die eindeutigen Wörter, alphabetisch, einmal
--   description_length  die Länge, die listingConfidence prüft
--
-- Das Ergebnis der Bewertung ist damit BITGLEICH — es ist keine
-- Näherung und kein Kompromiss. Nur die übertragene Menge schrumpft.
--
-- Was weiterhin die volle Beschreibung braucht: die Detailseite (sie
-- zeigt sie) und die Betrugserkennung (sie sucht Muster im Fliesstext).
-- Beides passiert für eine Stelle, nicht für tausend.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "description_tokens" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "description_length" integer;
--> statement-breakpoint

-- Bestand nachziehen. Dieselbe Normalisierung wie `overlap()`:
-- kleinschreiben, alles ausser Buchstaben und Ziffern zu Leerzeichen,
-- Wörter über drei Zeichen, eindeutig, sortiert.
UPDATE "jobs" SET
  "description_length" = length(coalesce("description", '')),
  "description_tokens" = (
    SELECT string_agg(DISTINCT w, ' ' ORDER BY w)
    FROM regexp_split_to_table(
      lower(regexp_replace(coalesce("description", ''), '[^[:alnum:]äöüßÄÖÜ]+', ' ', 'g')),
      '\s+'
    ) AS w
    WHERE length(w) > 3
  )
WHERE "description_tokens" IS NULL;
