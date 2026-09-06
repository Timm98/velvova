-- Der Verlauf des Bestands, stündlich fortgeschrieben.
--
-- „Seit gestern 4.812 neue Stellen" lässt sich aus dem aktuellen
-- Bestand nicht ableiten — man braucht den Wert von gestern.
--
-- Nicht über `fetched_at > now() - interval '24 hours'`: Das wäre eine
-- Vollzählung über 2,5 Mio. Zeilen ohne passenden Index, also dieselbe
-- Falle, die die Stellenseite schon zweimal auf 500 gesetzt hat. Und
-- es zählte das Falsche: Anzeigen laufen auch ab, der Bestand ist die
-- Differenz aus Zugang und Abgang.
--
-- Eine Zeile je Stunde sind 8.760 im Jahr — billiger als jede Abfrage,
-- die dasselbe ausrechnen wollte.
--
-- Keine Nutzerdaten, deshalb keine Zeile in rls.sql.
create table if not exists bestandsverlauf (
  gemessen_am timestamptz primary key default now(),
  stellen bigint not null,
  laender bigint not null default 0,
  quellen bigint not null default 0
);
