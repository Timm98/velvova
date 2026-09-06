-- Der Index, den die Kandidatenabfrage tatsächlich braucht.
--
-- Die Stellenseite fragt: alle Anzeigen eines Landes, neueste zuerst.
-- Sortiert wird nach `coalesce(published_at, fetched_at)`, weil nicht
-- jede Quelle ein Veröffentlichungsdatum liefert.
--
-- Dafür gab es `jobs_kandidaten_idx (is_demo, coalesce(...) desc)` —
-- ohne Land. Der Planer las ihn der Reihe nach und warf alles weg, was
-- nicht zum Land passte. Bei 1,02 Mio. deutschen von 2,5 Mio. Zeilen
-- ging das lange gut.
--
-- Gemessen am 4.9.2026, als es nicht mehr gut ging: 116.899 ms für 400
-- Zeilen, 16.792 Blöcke von der Platte. Die Datenbank brach mit
-- `statement timeout` ab, und die Stellenseite zeigte nur noch eine
-- Fehlerseite.
--
-- Mit passender Spaltenreihenfolge sind es 116 ms — Faktor 1000. Der
-- Ausdruck muss dabei exakt dem in der Abfrage entsprechen; ein Index
-- auf `published_at` allein wird für `coalesce(...)` nicht benutzt.
--
-- Auf einer bestehenden Datenbank mit CONCURRENTLY anlegen
-- (scripts/_kandidatenindex.mjs) — hier für frische Umgebungen.
create index if not exists jobs_kandidaten_land_idx
  on jobs (country, (coalesce(published_at, fetched_at)) desc)
  where is_demo = false;
