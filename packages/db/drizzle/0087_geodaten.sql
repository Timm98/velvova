-- Geodaten der Stellen: getrennt nach Rohangabe, Auflösung und Herkunft.
--
-- ══════════════════════════════════════════════════════════════
-- Warum das nicht in zwei Spalten passt
-- ══════════════════════════════════════════════════════════════
--
-- `latitude` und `longitude` gibt es seit langem. Sie sind bei 11 von
-- 1.209 analysierten Anzeigen gefuellt, und man sieht ihnen nicht an,
-- woher sie kommen: aus einer vollstaendigen Adresse, aus dem
-- Stadtmittelpunkt, oder aus einem gleichnamigen Ort im falschen
-- Bundesland.
--
-- Fuer eine Umkreisbedingung ist genau das der Unterschied. „18 km
-- von Karlsruhe" aus einem Stadtmittelpunkt ist eine brauchbare
-- Auskunft; dieselbe Zahl aus einer geratenen Koordinate ist eine
-- Behauptung.
--
-- ══════════════════════════════════════════════════════════════
-- Warum `geo_status` mehr als „ja/nein" kennt
-- ══════════════════════════════════════════════════════════════
--
-- Weil „nicht gefunden" und „mehrdeutig" verschiedene Dinge sind. Das
-- erste behebt eine bessere Datenquelle, das zweite nicht -- dort
-- muessten die Anzeigen genauer sein. Und `not_applicable_remote`
-- sagt: Es gibt nichts aufzuloesen, die Stelle hat keinen Ort.
--
-- Blind einen Kandidaten zu waehlen waere der stille Fehler: Es gibt
-- vier Orte namens Neustadt, und eine Umkreisrechnung um den falschen
-- sieht genauso aus wie eine um den richtigen.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_stadt" text
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_plz" text
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_region" text
--> statement-breakpoint
-- resolved_exact · resolved_city · ambiguous · not_found ·
-- not_applicable_remote · invalid_input
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_status" text
--> statement-breakpoint
-- Woher die Koordinate stammt: geonames_plz · geonames_ort ·
-- nominatim_cache · anbieter
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_quelle" text
--> statement-breakpoint
-- exact · plz · stadt · region — wie genau die Koordinate ist.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_genauigkeit" text
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_aufgeloest_am" timestamptz
--> statement-breakpoint
-- Steigt sie, gelten alle aelteren Aufloesungen als veraltet.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_fassung" integer
--> statement-breakpoint
-- Die Rohangabe, aus der aufgeloest wurde. Aendert sie sich, muss neu
-- aufgeloest werden -- daran haengt die Idempotenz des Nachtragslaufs.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "geo_rohangabe" text
--> statement-breakpoint

-- Nur die offenen Stellen, und nur die, die noch keine Fassung tragen.
-- Ein Index ueber 2,6 Millionen Zeilen fuer eine Abfrage, die immer
-- „wo fehlt es noch" lautet.
CREATE INDEX IF NOT EXISTS "jobs_geo_offen_idx" ON "jobs" ("geo_fassung") WHERE "geo_fassung" IS NULL
--> statement-breakpoint

-- Die Ortsdatenbasis.
--
-- ══════════════════════════════════════════════════════════════
-- Quelle und Lizenz
-- ══════════════════════════════════════════════════════════════
--
--   GeoNames Postleitzahlen, https://download.geonames.org/export/zip/
--   Lizenz: Creative Commons Attribution 4.0 (laut readme.txt der
--   Quelle, geprueft am 6. September 2026)
--
-- Die Attribution gehoert damit ins Produkt, wo Entfernungen gezeigt
-- werden. Ein Datensatz mit Namensnennungspflicht, dessen Namen
-- niemand nennt, ist eine Lizenzverletzung mit Ansage.
--
-- Offline, weil der Auftrag es verlangt und weil es richtig ist:
-- Nominatim untersagt Massenabfragen ausdruecklich. Der bestehende
-- Zwischenspeicher `geo_orte` bleibt als zweite Quelle -- seine
-- Eintraege sind bereits bezahlt und werden nicht neu erfragt.
CREATE TABLE IF NOT EXISTS "geo_referenz" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "land" text NOT NULL,
  -- Kleingeschrieben, ohne Umlautbesonderheiten. Der Suchschluessel.
  "name_norm" text NOT NULL,
  "name" text NOT NULL,
  "region" text,
  "plz" text,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  -- Wie viele Postleitzahlen zu diesem Ort gehoeren. Ein Mittelwert
  -- ueber 40 PLZ ist der Stadtmittelpunkt; ueber eine ist er genauer.
  "plz_anzahl" integer NOT NULL DEFAULT 1,
  "quelle" text NOT NULL,
  "quelle_fassung" text NOT NULL,
  "erstellt_am" timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_referenz_name_idx" ON "geo_referenz" ("land", "name_norm")
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_referenz_plz_idx" ON "geo_referenz" ("land", "plz")
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "geo_referenz_unique"
  ON "geo_referenz" ("land", "name_norm", COALESCE("region", ''), COALESCE("plz", ''), "quelle_fassung")
