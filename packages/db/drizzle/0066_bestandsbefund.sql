-- Kennzahlen für das Diagramm auf der Startseite.
--
-- Sie beantworten, woran eine Stellensuche tatsächlich scheitert:
-- fehlende Gehaltsangaben, veraltete Anzeigen, fehlende Berufskennung.
--
-- Vorberechnet, weil `count(*) filter (...)` über 2,5 Mio. Zeilen
-- Minuten dauert — und das Diagramm steht auf der Startseite, also auf
-- der Seite mit den meisten Aufrufen.
create table if not exists bestandsbefund (
  gemessen_am timestamptz primary key default now(),
  grundgesamtheit bigint not null,
  ohne_gehalt bigint not null default 0,
  alt bigint not null default 0,
  ohne_kennung bigint not null default 0
);
