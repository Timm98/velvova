-- Erkenntnisse dauerhaft schliessen können.
--
-- Bisher gab es nur „stimmt" und „stimmt nicht". Wer eine Aussage weder
-- bestätigen noch bestreiten wollte, hatte keinen Weg — die Fläche
-- blieb. Und was abgelehnt war, kam trotzdem zurück: Nina leitet
-- denselben Satz aus der nächsten Nachricht erneut ab, und weil die
-- Ablehnung an der ZEILE hing und nicht am INHALT, war die neue Zeile
-- unbelastet.
--
-- Zwei Spalten beheben beides:
--
--   dismissed_at   „nicht jetzt" — weder bestätigt noch bestritten,
--                  aber vom Tisch.
--
--   content_hash   der Inhalt statt der Zeile. Damit erkennt die
--                  Abfrage einen bereits abgelehnten Satz wieder, auch
--                  wenn er unter neuer Kennung ankommt.

ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "content_hash" text;
--> statement-breakpoint

-- Bestand nachziehen. Dieselbe Normalisierung wie im Anwendungscode:
-- kleinschreiben, Satzzeichen weg, Leerraum vereinheitlichen. Zwei
-- Sätze, die sich nur in einem Komma unterscheiden, sind derselbe Satz.
UPDATE "evidence_items"
SET "content_hash" = md5(
  regexp_replace(
    lower(regexp_replace(coalesce("statement", ''), '[^[:alnum:]äöüßÄÖÜ ]+', ' ', 'g')),
    '\s+', ' ', 'g'
  )
)
WHERE "content_hash" IS NULL AND "statement" IS NOT NULL;
--> statement-breakpoint

-- Die Abfrage sucht „alle abgelehnten oder verworfenen Inhalte dieser
-- Person". Ohne Index wäre das ein Durchlauf über alle Belege bei jedem
-- Seitenaufruf der Nina-Seite.
CREATE INDEX IF NOT EXISTS "evidence_hash_idx" ON "evidence_items" ("user_id", "content_hash");
