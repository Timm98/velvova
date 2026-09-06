-- Amtliche Berufsbezeichnung und Entgelt-Referenz.
--
-- ── Warum es diese zwei Tabellen gibt ─────────────────────────
--
-- Für rund ein Drittel der Stellen konnte das Produkt keine
-- Gehaltsgrössenordnung nennen: die eigene Datenbasis trug in diesen
-- Berufsgruppen zu wenige Angaben, und der Entgeltatlas der
-- Bundesagentur verlangt eine Registrierung, die nur der Betreiber
-- vornehmen kann.
--
-- Die offene Jobsuche-Schnittstelle derselben Behörde beantwortet
-- beides ohne Zugangsdaten:
--
--   1. Sie liefert zu jeder Anzeige `hauptberuf` — die amtliche
--      Berufsbezeichnung aus der Klassifikation der Berufe. Damit wird
--      aus dem freien Anzeigentitel „Vertriebsinnendienst (m/w/d)" ein
--      Begriff, unter dem sich Stellen sinnvoll vergleichen lassen.
--
--   2. Rund 29 % ihrer Anzeigen tragen ein echtes, vom Arbeitgeber
--      angegebenes Gehalt — als Spanne oder als Festbetrag.
--
-- Gespeichert wird deshalb keine Anzeige, sondern deren Auswertung:
-- Quartile über viele reale Angaben, mit Anzahl, Quelle und Stand.
-- Keine erfundene Zahl, keine Nutzerkennung, keine Zeilensicherheit
-- nötig — dieselbe Begründung wie bei `geo_orte`.

CREATE TABLE IF NOT EXISTS beruf_zuordnung (
  -- Der normalisierte Stellentitel: kleingeschrieben, ohne
  -- Geschlechtszusatz, ohne doppelte Leerzeichen.
  titel text PRIMARY KEY,
  -- Die amtliche Bezeichnung, etwa „Kaufmann/-frau - Büromanagement".
  -- NULL heisst: nachgefragt und nichts gefunden. Auch das wird
  -- vermerkt, sonst wird derselbe Titel ewig neu aufgelöst.
  beruf text,
  -- Wie oft diese Bezeichnung unter den Treffern vorkam, und wie viele
  -- Treffer es insgesamt waren. Aus beidem ergibt sich, wie eindeutig
  -- die Zuordnung ist — eine Zuordnung aus 3 von 100 Treffern ist
  -- keine.
  treffer integer NOT NULL DEFAULT 0,
  gesamt integer NOT NULL DEFAULT 0,
  gefragt_am timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS beruf_entgelt (
  -- Die amtliche Berufsbezeichnung.
  beruf text PRIMARY KEY,
  -- Unteres Quartil, Median, oberes Quartil — Euro je Jahr.
  q1 integer NOT NULL,
  median integer NOT NULL,
  q3 integer NOT NULL,
  -- Auf wie vielen unabhängigen Angaben es beruht. Unter der
  -- Mindestzahl wird gar nicht erst geschrieben.
  anzahl integer NOT NULL,
  -- 'bundesagentur' (Auswertung offener Anzeigen) oder 'entgeltatlas'
  -- (amtliche Statistik, sobald Zugangsdaten vorliegen). Die Quelle
  -- steht in der Oberfläche — wer eine Zahl liest, soll wissen, woher.
  quelle text NOT NULL,
  stand timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS beruf_zuordnung_beruf_idx ON beruf_zuordnung (beruf)
