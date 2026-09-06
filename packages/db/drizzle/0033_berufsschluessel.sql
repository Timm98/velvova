-- Der amtliche Berufsschlüssel zu einer Berufsbezeichnung.
--
-- Der Entgeltatlas wird nicht über den Namen abgefragt, sondern über
-- die Berufsgattung der Klassifikation der Berufe — eine Kennung wie
-- „43414". Die offene Jobsuche liefert Namen, keine Kennungen, und
-- eine öffentliche Übersetzung gibt es nicht: die Vorschlagsdienste
-- der Jobbörse antworten mit 403, ein eigener Klassifikationsdienst
-- existiert nicht (geprüft am 2.9.2026).
--
-- Übersetzen kann deshalb nur der Entgeltatlas selbst, sobald
-- Zugangsdaten hinterlegt sind. Das Ergebnis gehört zwischengespeichert
-- — es ändert sich mit der Klassifikation, also praktisch nie.
--
-- `schluessel IS NULL` heisst „gefragt, nichts gefunden". Auch das wird
-- vermerkt, sonst wird derselbe Beruf bei jedem Aufruf erneut gesucht.

CREATE TABLE IF NOT EXISTS beruf_schluessel (
  beruf text PRIMARY KEY,
  schluessel text,
  gefragt_am timestamptz NOT NULL DEFAULT now()
)
