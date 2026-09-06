-- Ein Index auf das Land.
--
-- Er fehlte. Gemessen an 1,7 Mio. Zeilen kostete `count(*) ... where
-- country = 'DE'` zwölf Sekunden — und dieselbe Bedingung steht unter
-- jeder Kandidatenabfrage der Stellensuche.
--
-- Die Sortierung nach Veröffentlichungsdatum gehört mit hinein: Die
-- Suche nimmt die neuesten Kandidaten zuerst. Ohne sie müsste der
-- Planer nach dem Filtern noch einmal über alles sortieren.
--
-- `where is_demo = false` macht ihn zum Teilindex: Demodaten stehen in
-- keiner Suche, und der Index bleibt dadurch kleiner.
--
-- Auf einer bestehenden Datenbank wird er mit CONCURRENTLY angelegt
-- (siehe scripts/index-anlegen.mjs) — hier steht er für frische
-- Umgebungen, in denen die Tabelle leer ist.
create index if not exists jobs_country_published_idx
  on jobs (country, published_at desc)
  where is_demo = false;
