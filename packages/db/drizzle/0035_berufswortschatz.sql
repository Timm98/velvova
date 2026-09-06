-- Der Wortschatz amtlicher Berufsbezeichnungen.
--
-- ── Warum er eine eigene Tabelle bekommt ──────────────────────
--
-- Bisher stammten die Suchbegriffe für die Jobbörse aus
-- `beruf_zuordnung` — also aus den Berufen, die unser eigener Bestand
-- schon enthielt. Das ist ein Zirkelschluss: Wir finden nur, wonach
-- wir suchen, und wir suchen nur nach dem, was wir schon gefunden
-- haben. Gemessen deckten die so gewonnenen 236 Bezeichnungen 573.662
-- der 999.398 Anzeigen ab.
--
-- ── Woher die Bezeichnungen kommen ────────────────────────────
--
-- Aus den Anzeigen selbst. Jede trägt `hauptberuf` und `alleBerufe` —
-- Begriffe aus der Klassifikation der Berufe, mit denen die Jobbörse
-- ihren eigenen Bestand verschlagwortet. Wer blätternd liest, sammelt
-- sie ein: 700 Anzeigen ohne Suchwort ergaben bereits 413
-- verschiedene.
--
-- Das amtliche Verzeichnis direkt zu laden wäre der kürzere Weg. Der
-- Klassifikationsserver des Statistischen Bundesamts verbietet den
-- Download-Pfad aber in seiner robots.txt
-- (`Disallow: /klassService/thyme/variant/download/`), und Sperren
-- werden hier nicht umgangen. Liegt die Datei einmal von Hand
-- daneben, lässt sie sich in dieselbe Tabelle einlesen — dafür steht
-- `quelle`.

CREATE TABLE IF NOT EXISTS beruf_wortschatz (
  beruf text PRIMARY KEY,
  -- 'jobboerse' (aus Anzeigen geerntet) oder 'kldb' (amtliche Liste).
  quelle text NOT NULL DEFAULT 'jobboerse',
  -- Wie oft die Bezeichnung beim Ernten vorkam. Häufige zuerst zu
  -- durchsuchen bringt früher mehr Anzeigen je Anfrage.
  vorkommen integer NOT NULL DEFAULT 1,
  -- Wie viele Anzeigen die Jobbörse zu diesem Begriff kennt. NULL
  -- heisst: noch nicht nachgefragt.
  anzeigen integer,
  gefunden_am timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS beruf_wortschatz_anzeigen_idx ON beruf_wortschatz (anzeigen DESC NULLS LAST)
