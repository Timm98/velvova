-- Wie viele offene Stellen je Berufsfeld — vorberechnet.
--
-- ── Warum nicht im Seitenaufruf ───────────────────────────────
--
-- `group by left(kldb, 2)` über 2,2 Mio. Zeilen lief 120 Sekunden und
-- brach dann in die Zeitgrenze. Die Stellenseite war damit
-- unbenutzbar — derselbe Fehler, der schon einmal ein 500 auf dieser
-- Seite verursacht hat.
--
-- Eine Aggregation über den ganzen Bestand gehört nie in einen
-- Seitenaufruf. Sie gehört in den Pflegelauf, wo niemand wartet.
create table if not exists berufsfeld_bestand (
  land text not null,
  gruppe text not null,
  anzahl integer not null,
  berechnet_am timestamptz not null default now(),
  primary key (land, gruppe)
);
