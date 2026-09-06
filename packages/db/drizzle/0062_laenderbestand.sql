-- Stellen je Land, vorberechnet.
--
-- Das Länderraster steht im Fuss und damit auf jeder Seite. Ein
-- `group by country` über 2,4 Mio. Zeilen bei jedem Aufruf ist der
-- Fehler, der die Stellenseite schon einmal auf 500 gesetzt hat —
-- diesmal an einer Stelle, die überall erscheint.
--
-- Gefüllt von scripts/laender-zaehlen.mjs im stündlichen Pflegelauf.
--
-- Keine Nutzerdaten, deshalb keine Zeile in rls.sql.
create table if not exists laenderbestand (
  land text primary key,
  stellen bigint not null default 0,
  berechnet_am timestamptz not null default now()
);
--> statement-breakpoint

-- Die neuesten Anzeigen eines Landes.
--
-- `jobs_country_published_idx` gibt es bereits, aber als
-- `(country, published_at desc)` — und `desc` heisst in Postgres
-- `nulls first`. Die Suche sortiert `desc nulls last`, weil das an
-- anderer Stelle den Unterschied zwischen 61 ms und 4,3 Sekunden
-- macht. Diese eine Abweichung genügt, damit der Index nicht mehr
-- passt: Gemessen für `country = 'US'` 16,8 Sekunden.
--
-- Mit passender Sortierrichtung sind es 49 ms — und zwar für jedes
-- Land gleich, weil der Planer nicht mehr raten muss, wie weit er im
-- Datumsindex zurückgehen wird.
--
-- Die beiden Indizes stehen bewusst nebeneinander: der ältere bedient
-- die Kandidatenabfrage der angemeldeten Suche, dieser die
-- öffentliche.
create index if not exists jobs_land_neueste_idx
  on jobs (country, published_at desc nulls last)
  where is_demo = false;
