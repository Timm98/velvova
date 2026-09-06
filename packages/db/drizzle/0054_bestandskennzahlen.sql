-- Die Bestandszahlen der Stellenseite, vorberechnet.
--
-- Sie standen bisher in einer Abfrage, die bei jedem Seitenaufruf über
-- die ganze Tabelle lief: count(*), count(distinct content_hash) und
-- ein gefiltertes count(*). Bei 2.500 Stellen war das eine Bagatelle,
-- bei 1,58 Mio. unter Importlast bricht es in die Zeitgrenze — die
-- Stellenseite antwortete mit 500.
--
-- Eine Zeile je Quelle plus eine Gesamtzeile (quelle = ''). Der
-- Zeitpunkt steht dabei: Eine Zahl von vor einer Stunde, die sich als
-- solche zu erkennen gibt, ist ehrlicher als eine tagesaktuelle, für
-- die niemand die Seite abwarten kann.
create table if not exists bestandskennzahlen (
  quelle text primary key,
  roh bigint not null default 0,
  eindeutig bigint not null default 0,
  aktiv bigint not null default 0,
  zuletzt_geholt timestamptz,
  berechnet_am timestamptz not null default now()
);
