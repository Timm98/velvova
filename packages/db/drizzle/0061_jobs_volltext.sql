-- Volltextsuche über Stellentitel.
--
-- Ohne sie gibt es keine öffentliche Stellensuche: `title ilike
-- '%Pflegefachkraft%'` über 2,4 Mio. Zeilen ist ein Sequenz-Scan und
-- brauchte gemessen 30,3 Sekunden für zwanzig Treffer. Das ist keine
-- langsame Seite, das ist gar keine Seite.
--
-- `german` als Wörterbuch, nicht `simple`: Es führt Beugungen
-- zusammen, sodass „Pflegekräfte" auch „Pflegekraft" findet, und wirft
-- Füllwörter weg. Bei deutschen Stellentiteln ist das der Unterschied
-- zwischen Suchen und Raten.
--
-- Nur der Titel, nicht der Unternehmensname: Der Name steht in
-- `companies` und wäre nur über einen Verbund zu indizieren. Die Suche
-- nach Arbeitgebern läuft deshalb getrennt über `companies.name`.
--
-- Nicht der Beschreibungstext: Er ist bei vielen Quellen lizenzrechtlich
-- nicht frei wiedergebbar, und ein Index darauf würde den Bestand um ein
-- Vielfaches aufblähen, um Treffer zu erzeugen, die wir nicht anzeigen
-- dürfen.
--
-- Teilindex auf `is_demo = false` aus demselben Grund wie bei
-- jobs_country_published_idx: Demodaten stehen in keiner Suche.
--
-- Auf einer bestehenden Datenbank wird er mit CONCURRENTLY angelegt
-- (scripts/index-anlegen.mjs). Hier steht er für frische Umgebungen.
create index if not exists jobs_volltext_idx
  on jobs using gin (to_tsvector('german', title))
  where is_demo = false;
--> statement-breakpoint

-- Ortssuche über Wörter, nicht über Zeichenketten.
--
-- Gemessen an 2,4 Mio. Zeilen: `location ilike 'Berlin%'` braucht 27
-- Sekunden und findet trotzdem zu wenig — die Berliner Anzeigen stehen
-- überwiegend als „Wedding, Berlin", „Mitte, Berlin", „Charlottenburg,
-- Berlin". Ein Präfix verliert über zehntausend davon.
--
-- `location ilike '%Berlin%'` findet sie, fängt aber „Überlingen" mit
-- ein: „Ü-berlin-gen" enthält die Zeichenkette. Wer in Berlin sucht,
-- bekäme Stellen am Bodensee.
--
-- Ein Wortvektor löst beides: „Wedding, Berlin" enthält das Wort
-- Berlin, „Überlingen" nicht.
--
-- `simple` statt `german`: Ortsnamen sollen nicht gestemmt werden.
-- Der deutsche Stemmer macht aus Namen Wortstämme und führt dabei
-- Orte zusammen, die nichts miteinander zu tun haben.
create index if not exists jobs_ort_idx
  on jobs using gin (to_tsvector('simple', location))
  where is_demo = false;
--> statement-breakpoint

-- Die neuesten Anzeigen ohne Filter.
--
-- Die Startseite und eine leere Suche zeigen schlicht das Neueste.
-- Ohne diesen Index sortiert Postgres dafür 2,4 Mio. Zeilen: gemessen
-- 34 Sekunden. Mit ihm 142 ms.
--
-- `nulls last` gehört in die Indexdefinition, weil die Abfrage genau
-- so sortiert. `order by … desc` allein bedeutet in Postgres `nulls
-- first` — eine Sortierrichtung, die der Index nicht bedient, und
-- schon fällt der Planer auf einen vollständigen Sortierlauf zurück.
create index if not exists jobs_neueste_idx
  on jobs (published_at desc nulls last)
  where is_demo = false;
