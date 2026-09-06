-- Die amtliche Berufskennung an der Stelle selbst.
--
-- Sie steht schon in `beruf_zuordnung` (Titel → amtliche Bezeichnung)
-- und `beruf_schluessel` (Bezeichnung → KldB). Für die Rangfolge und
-- das Gehalt genügt das: beides läuft ohnehin über Abfragen.
--
-- Für das Titelbild nicht. `berufsbild()` läuft im Rendern jeder
-- einzelnen Zeile und ist synchron — zwei Verknüpfungen je Zeile wären
-- bei 25 Zeilen fünfzig zusätzliche Abfragen für ein Bild.
--
-- Deshalb hier, an der Stelle. Der Wert ändert sich nicht mehr, sobald
-- er einmal steht; die Zuordnung hängt am Titel, nicht am Datum.
alter table jobs add column if not exists kldb text;
--> statement-breakpoint
-- Die ersten beiden Ziffern sind die Berufshauptgruppe — 36 Gruppen
-- statt der fünfzehn Felder, die der Titel hergibt. Danach wird
-- gesucht, also steht der Index darauf.
create index if not exists jobs_kldb_idx on jobs (left(kldb, 2)) where kldb is not null;
