-- Zwischenspeicher für Orte und Wege.
--
-- ── Warum das gespeichert wird ────────────────────────────────
--
-- Geocoding und Routing sind fremde Dienste mit Nutzungsgrenzen. Ohne
-- Zwischenspeicher würde jede Jobseite dieselbe Anfrage erneut stellen
-- — bei 563 verschiedenen Ortsangaben und ein paar hundert Abrufen am
-- Tag wäre das sowohl unhöflich als auch langsam.
--
-- Gespeichert wird nur, was ohnehin öffentlich ist: die Koordinate zu
-- einem Ortsnamen und die Fahrzeit zwischen zwei Koordinaten. Keine
-- Nutzerkennung, keine Adresse einer Person — die Wohnadresse steht in
-- den Einstellungen und wird hier nur als gerundete Koordinate
-- verwendet.

CREATE TABLE IF NOT EXISTS geo_orte (
  -- Der normalisierte Suchtext ist der Schlüssel: kleingeschrieben,
  -- ohne doppelte Leerzeichen. „Berlin" und „berlin " sind derselbe Ort.
  abfrage text PRIMARY KEY,
  latitude double precision,
  longitude double precision,
  anzeigename text,
  -- Wann zuletzt gefragt wurde. Auch ein Misserfolg wird vermerkt,
  -- damit „Germany" nicht bei jedem Aufruf erneut nachgeschlagen wird.
  gefunden boolean NOT NULL DEFAULT false,
  gefragt_am timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS geo_wege (
  -- Die beiden Koordinaten, auf drei Nachkommastellen gerundet: rund
  -- 100 Meter. Feiner brächte nichts für eine Fahrzeitangabe in
  -- Minuten und würde den Zwischenspeicher nutzlos machen, weil jede
  -- Anfrage einen eigenen Eintrag bekäme.
  schluessel text PRIMARY KEY,
  modus text NOT NULL,
  minuten integer,
  kilometer double precision,
  gefunden boolean NOT NULL DEFAULT false,
  gefragt_am timestamptz NOT NULL DEFAULT now()
)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS geo_wege_alter_idx ON geo_wege (gefragt_am)
