-- Wie lange eine Stelle üblicherweise steht — je Berufsgruppe.
--
-- Gemessen im eigenen Bestand: Der Median reicht von 25 Tagen
-- (Informatik) bis 108 Tagen (Hoch- und Tiefbau). Eine absolute Grenze
-- wäre deshalb wertlos: Sie würde jede Baustelle als auffällig melden
-- und jede IT-Stelle durchlassen, die seit einem halben Jahr steht.
--
-- Eigene Tabelle statt Berechnung bei jedem Aufruf: Das Perzentil über
-- 1,58 Mio. Zeilen kostet Sekunden, der Nachschlag hier nichts.
create table if not exists standzeit_referenz (
  gruppe text primary key,
  stellen integer not null,
  median_tage double precision not null,
  p90_tage double precision not null,
  berechnet_am timestamptz not null default now()
);
