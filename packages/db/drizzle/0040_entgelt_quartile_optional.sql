-- Quartile dürfen fehlen, der Median nicht.
--
-- `beruf_entgelt.q1` und `q3` standen als `integer not null`. Das war
-- richtig, solange die Werte aus unserem eigenen Bestand kamen: Wer
-- einen Median aus Anzeigen bildet, hat auch die Quartile.
--
-- Der Entgeltatlas verhält sich anders. Er weist für manche
-- Berufsgattungen einen echten Median aus und lässt ein Quartil offen —
-- gemessen: Median 7.958 € je Monat, `entgeltQ25` 6.404 €, `entgeltQ75`
-- als Kennzahl „nicht ausgewiesen" (-2).
--
-- Mit `not null` bliebe nur, die Zahl zu erfinden oder den echten
-- Median wegzuwerfen. Beides ist schlechter als eine Spanne, die
-- ehrlich einseitig ist, und `alsSpanne()` schreibt dann „ab 76.848 €"
-- statt einer Grenze, die niemand ausgewiesen hat.
alter table beruf_entgelt alter column q1 drop not null;
--> statement-breakpoint
alter table beruf_entgelt alter column q3 drop not null;

--> statement-breakpoint
-- Die Zahl der Beschäftigten hinter einem amtlichen Median.
--
-- `anzahl` trug bisher die Zahl der Anzeigen, auf denen ein eigener
-- Median beruht. Beim Atlas ist das etwas anderes: dort stehen
-- Beschäftigte, nicht Stichproben. Ein Median über 40 Beschäftigte ist
-- nicht dasselbe wie einer über 40.000, und ohne diese Spalte liesse
-- sich der Unterschied nicht sehen.
alter table beruf_entgelt add column if not exists besetzung integer;

--> statement-breakpoint
-- true, wenn der Median an der Beitragsbemessungsgrenze liegt.
--
-- Die Beschäftigungsstatistik erfasst Entgelte nur bis zu dieser
-- Grenze. Liegt der Median dort, ist er abgeschnitten und in Wahrheit
-- höher. Als Vergleichswert taugt er dann nicht — wer ihn trotzdem
-- zeigt, muss es dazusagen.
alter table beruf_entgelt add column if not exists abgeschnitten boolean not null default false;
